"""Acceptance tests cover geometry, version identity and actual exported contents."""
import io
import json
import math
import zipfile
from pathlib import Path
from xml.etree import ElementTree
import cadquery as cq
import ezdxf
import httpx
import pytest
import trimesh
from fastapi.testclient import TestClient
from backend import prompts, store
from backend.main import app
from backend.models import JewelryDesign

@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(store, "DATA_DIR", tmp_path)
    monkeypatch.setattr(store, "DB_PATH", tmp_path / "studio.sqlite3")
    return TestClient(app)

@pytest.fixture
def initial(client):
    response = client.post("/api/design/generate", json={"prompt": "Create an 18K gold ring with an oval 8 x 6 mm diamond and six prongs"})
    assert response.status_code == 200, response.text
    return response.json()

def test_revision_only_changes_requested_parameters():
    original = JewelryDesign()
    result = prompts.local_interpret("Make the band thinner to 1.6 mm", original)
    assert result["changes"] == [{"path": "shank.thicknessMm", "oldValue": 1.8, "newValue": 1.6}]
    assert result["design"]["stone"] == original.stone.model_dump()
    assert result["design"]["setting"] == original.setting.model_dump()

@pytest.mark.parametrize("prompt", ["Create a necklace", "Make a floral ring", "Use 22K gold", "Ring size 14", "four prongs and six prongs", "hello world"])
def test_unsupported_and_ambiguous_requests_are_rejected(prompt):
    with pytest.raises(ValueError):
        prompts.local_interpret(prompt)

def test_round_stone_and_ring_size_are_resolved():
    result = prompts.local_interpret("Create a round 6 x 6 mm sapphire ring with four prongs, US size 7")
    design = result["design"]
    assert design["stone"]["lengthMm"] == design["stone"]["widthMm"] == 6
    assert design["setting"]["prongCount"] == 4
    assert design["innerDiameterMm"] == pytest.approx(17.32)
    assert any("approximate" in note for note in result["assumptions"])

def test_invalid_dimensions_are_rejected():
    with pytest.raises(ValueError):
        prompts.local_interpret("Create an oval 8 x 6 x 12 mm diamond ring")
    with pytest.raises(ValueError):
        JewelryDesign(innerDiameterMm=float("nan"))

def test_solid_geometry_measurements_and_scope(initial):
    version, model = initial["version"], initial["model"]
    analysis = version["analysis"]
    assert model["geometryHash"] == version["geometry_hash"]
    assert model["units"] == "mm"
    assert len(model["metal"]["positions"]) > 100
    assert analysis["measurements"]["metalSolidCount"] == 1
    assert analysis["measurements"]["metalVolumeMm3"] > 0
    assert analysis["measurements"]["stoneShankClearanceMm"] == pytest.approx(.55, abs=.005)
    assert not analysis["productionApproved"]
    assert any(c["status"] == "not_assessed" for c in analysis["checks"])
    assert analysis["evaluated"] < len(analysis["checks"])

def test_revision_restore_and_export_identity(client, initial):
    first = initial["version"]
    response = client.post("/api/design/revise", json={"versionId": first["id"], "prompt": "Make the band thinner to 1.6 mm"})
    assert response.status_code == 200, response.text
    second = response.json()["version"]
    assert second["parent_id"] == first["id"]
    assert second["number"] == 2
    assert second["geometry_hash"] != first["geometry_hash"]
    assert second["analysis"]["measurements"]["metalVolumeMm3"] < first["analysis"]["measurements"]["metalVolumeMm3"]
    assert second["design"]["stone"] == first["design"]["stone"]
    restored = client.post("/api/design/select", json={"versionId": first["id"]}).json()
    assert restored["model"]["geometryHash"] == first["geometry_hash"]
    assert client.get("/api/design/current").json()["version"]["id"] == first["id"]
    exported = client.post("/api/design/export", json={"versionId": first["id"], "format": "json"})
    assert exported.headers["X-Design-Version"] == first["id"]
    assert exported.json()["version"]["design"]["shank"]["thicknessMm"] == 1.8
    count = len(client.get("/api/versions").json()["versions"])
    failed = client.post("/api/design/revise", json={"versionId": first["id"], "prompt": "Make a necklace"})
    assert failed.status_code == 422
    assert len(client.get("/api/versions").json()["versions"]) == count
    assert client.get("/api/design/current").json()["version"]["id"] == first["id"]

def test_failed_check_and_recommendation(client, initial):
    version = initial["version"]
    data = json.loads(json.dumps(version["design"]))
    data["shank"]["thicknessMm"] = 1.2
    changed = client.post("/api/design/update", json={"versionId": version["id"], "design": data}).json()["version"]
    assert changed["analysis"]["status"] == "requires_changes"
    check = next(c for c in changed["analysis"]["checks"] if c["id"] == "band_thickness")
    assert check["status"] == "fail" and check["blocking"]
    applied = client.post("/api/design/recommend", json={"versionId": changed["id"], "checkId": "band_thickness"})
    assert applied.status_code == 200, applied.text
    fixed = applied.json()["version"]
    assert fixed["design"]["shank"]["thicknessMm"] == 1.5
    assert fixed["parent_id"] == changed["id"]

def test_larger_stone_rebuilds_setting_geometry(client, initial):
    first = initial["version"]
    response = client.post("/api/design/revise", json={"versionId": first["id"], "prompt": "Increase the center stone to 9 x 7 mm"})
    assert response.status_code == 200, response.text
    changed = response.json()["version"]
    assert changed["design"]["shank"] == first["design"]["shank"]
    assert changed["analysis"]["measurements"]["metalVolumeMm3"] > first["analysis"]["measurements"]["metalVolumeMm3"]
    assert changed["analysis"]["measurements"]["metalSolidCount"] == 1

@pytest.mark.parametrize("format", ["step", "stl", "3mf", "glb", "dxf"])
def test_exports_contain_real_current_geometry(client, initial, tmp_path, format):
    version = initial["version"]
    response = client.post("/api/design/export", json={"versionId": version["id"], "format": format})
    assert response.status_code == 200, response.text
    assert response.headers["X-Geometry-Hash"] == version["geometry_hash"]
    path = tmp_path / f"verify.{format}"
    path.write_bytes(response.content)
    if format == "step":
        shape = cq.importers.importStep(str(path)).val()
        assert shape.isValid() and len(shape.Solids()) == 1
        assert shape.Volume() == pytest.approx(version["analysis"]["measurements"]["metalVolumeMm3"], abs=.01)
        assert shape.BoundingBox().xlen == pytest.approx(21, abs=.01)
    elif format == "stl":
        mesh = trimesh.load_mesh(path, process=True)
        assert mesh.is_watertight
        assert mesh.extents[0] == pytest.approx(21, abs=.1)
        assert abs(mesh.volume) == pytest.approx(version["analysis"]["measurements"]["metalVolumeMm3"], rel=.025)
    elif format == "3mf":
        with zipfile.ZipFile(path) as archive:
            model_entry = next(n for n in archive.namelist() if n.endswith(".model"))
            root = ElementTree.fromstring(archive.read(model_entry))
            assert root.attrib.get("unit", "millimeter") == "millimeter"
            assert len(list(root.iter("{http://schemas.microsoft.com/3dmanufacturing/core/2015/02}triangle"))) > 100
    elif format == "glb":
        scene = trimesh.load(path, force="scene")
        assert len(scene.geometry) == 2
        assert scene.bounds[1][0] - scene.bounds[0][0] == pytest.approx(.021, abs=.0001)
    elif format == "dxf":
        doc = ezdxf.readfile(path)
        assert len(doc.modelspace()) > 0

def test_unimplemented_exports_are_honest(client, initial):
    for format in ("dwg", "3dm"):
        response = client.post("/api/design/export", json={"versionId": initial["version"]["id"], "format": format})
        assert response.status_code == 501
        assert "not implemented" in response.json()["detail"]

def test_gemini_contract_and_validation(monkeypatch):
    monkeypatch.setattr(prompts, "SESSION_GEMINI_KEY", "test-key-not-real")
    sent = {}
    def provider(url, **kwargs):
        sent.update(kwargs)
        result = {"design": JewelryDesign().model_dump(), "assumptions": ["Template dimensions"], "unsupported": []}
        return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"text": json.dumps(result)}]}}]})
    monkeypatch.setattr(prompts.httpx, "post", provider)
    result = prompts.interpret("Create a ring", engine="gemini")
    assert result["engine"] == "gemini"
    assert sent["headers"]["x-goog-api-key"] == "test-key-not-real"
    schema_json = json.dumps(sent["json"]["generationConfig"]["responseJsonSchema"])
    assert "$ref" not in schema_json
    assert "test-key-not-real" not in json.dumps(result)

def test_plan_review_does_not_create_a_version(client, initial):
    first = initial["version"]
    result = client.post("/api/design/interpret", json={"versionId": first["id"], "prompt": "Use white gold"})
    assert result.status_code == 200
    assert result.json()["design"]["material"] == "18k_white"
    assert len(client.get("/api/versions").json()["versions"]) == 1

