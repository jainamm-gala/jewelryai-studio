import os
import threading
from functools import lru_cache
from pathlib import Path
from typing import Literal
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[1] / ".env")
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import Field, ValidationError
from .models import StrictModel, JewelryDesign, GenerateRequest, ReviseRequest, UpdateRequest, RecommendationRequest, ExportRequest
from . import prompts, store
from .geometry import build_ring, design_hash, model_data
from .analysis import analyze, MATERIALS
from .exports import write_export

app = FastAPI(title="JewelryAI", version="0.1.0")
app.add_middleware(TrustedHostMiddleware, allowed_hosts=["localhost", "127.0.0.1", "testserver"])
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"], allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
CAD_LOCK = threading.RLock()

@lru_cache(maxsize=16)
def cached_geometry(serialized):
    return build_ring(JewelryDesign.model_validate_json(serialized))

def geometry_for(design):
    # Appearance and title do not affect this template's physical construction.
    # Keep them in the saved design/hash, but reuse the identical CAD and mesh.
    geometry_design = design.model_copy(deep=True)
    geometry_design.title = "CAD template"
    geometry_design.material = "18k_yellow"
    geometry_design.stone.type = "diamond"
    return cached_geometry(geometry_design.model_dump_json())

def require_version(id):
    version = store.get_version(id)
    if not version:
        raise HTTPException(404, "Version not found.")
    return version

def commit(design, label, prompt, engine, assumptions, parent=None):
    with CAD_LOCK:
        geometry = geometry_for(design)
        analysis = analyze(design, geometry)
        changes = prompts.changes_between(parent["design"], design.model_dump()) if parent else []
        if parent and not changes:
            raise ValueError("No parameter changes to save.")
        version = store.save_version(design.model_dump(), analysis, design_hash(design), label, prompt, engine, assumptions, changes, parent)
        return {"version": version, "model": model_data(geometry, version["geometry_hash"])}

def safe(action):
    try:
        return action()
    except HTTPException:
        raise
    except (ValidationError, ValueError) as exc:
        raise HTTPException(422, str(exc)) from exc
    except Exception as exc:
        # No provider request headers, credentials or prompts are logged.
        raise HTTPException(422, "Geometry operation could not complete. Try less extreme dimensions; the last valid design is preserved.") from exc

class InterpretRequest(StrictModel):
    prompt: str = Field(min_length=3, max_length=2000)
    versionId: str | None = None
    engine: Literal["local", "gemini"] = "local"

class CommitRequest(StrictModel):
    design: JewelryDesign
    parentVersionId: str | None = None
    prompt: str = Field(default="Parameter adjustment", max_length=2000)
    engine: Literal["local", "gemini", "parameters"] = "parameters"
    assumptions: list[str] = Field(default_factory=list, max_length=30)

class VersionRequest(StrictModel):
    versionId: str

class KeyRequest(StrictModel):
    apiKey: str = Field(max_length=500)

@app.get("/api/health")
def health():
    return {"status": "ok", "cadEngine": "CadQuery / OpenCascade", "geminiConfigured": prompts.configured(), "geminiModel": os.getenv("GEMINI_MODEL", "gemini-2.5-flash"), "supportedExports": ["step", "stl", "3mf", "glb", "dxf", "json"], "materials": MATERIALS}

@app.post("/api/config/gemini")
def gemini_config(req: KeyRequest):
    prompts.SESSION_GEMINI_KEY = req.apiKey.strip()
    return {"configured": prompts.configured(), "storage": "server memory only"}

@app.post("/api/design/interpret")
def interpret_request(req: InterpretRequest):
    current = JewelryDesign.model_validate(require_version(req.versionId)["design"]) if req.versionId else None
    return safe(lambda: prompts.interpret(req.prompt, current, req.engine))

@app.post("/api/design/commit")
def commit_request(req: CommitRequest):
    parent = require_version(req.parentVersionId) if req.parentVersionId else None
    return safe(lambda: commit(req.design, req.prompt[:120], req.prompt, req.engine, req.assumptions, parent))

@app.post("/api/design/generate")
def generate(req: GenerateRequest):
    def action():
        plan = prompts.interpret(req.prompt, engine=req.engine)
        return commit(JewelryDesign.model_validate(plan["design"]), "Initial design", req.prompt, req.engine, plan["assumptions"])
    return safe(action)

@app.post("/api/design/revise")
def revise(req: ReviseRequest):
    parent = require_version(req.versionId)
    def action():
        plan = prompts.interpret(req.prompt, JewelryDesign.model_validate(parent["design"]), req.engine)
        return commit(JewelryDesign.model_validate(plan["design"]), req.prompt[:120], req.prompt, req.engine, plan["assumptions"], parent)
    return safe(action)

@app.post("/api/design/update")
def update(req: UpdateRequest):
    parent = require_version(req.versionId)
    return safe(lambda: commit(req.design, req.label, req.label, "parameters", [], parent))

@app.post("/api/design/analyze")
def analyze_request(req: VersionRequest):
    design = JewelryDesign.model_validate(require_version(req.versionId)["design"])
    with CAD_LOCK:
        return safe(lambda: analyze(design, geometry_for(design)))

@app.post("/api/design/recommend")
def recommend(req: RecommendationRequest):
    parent = require_version(req.versionId)
    def action():
        design = JewelryDesign.model_validate(parent["design"])
        with CAD_LOCK:
            fresh = analyze(design, geometry_for(design))
        check = next((c for c in fresh["checks"] if c["id"] == req.checkId), None)
        if not check or check["status"] != "fail" or not check.get("recommendation"):
            raise ValueError("No applicable automatic recommendation exists for this check.")
        data = design.model_dump()
        prompts.set_path(data, check["recommendation"]["path"], check["recommendation"]["value"])
        return commit(JewelryDesign.model_validate(data), f"Adjusted {check['title'].lower()}", "Applied configured recommendation", "parameters", [], parent)
    return safe(action)

@app.get("/api/versions")
def versions(projectId: str | None = None):
    return {"versions": store.list_versions(projectId)}

@app.get("/api/design/current")
def current():
    return {"version": store.get_selected()}

@app.get("/api/versions/{id}")
def version_details(id: str):
    version = require_version(id)
    with CAD_LOCK:
        design = JewelryDesign.model_validate(version["design"])
        return safe(lambda: {"version": version, "model": model_data(geometry_for(design), version["geometry_hash"])})

@app.post("/api/design/select")
def select(req: VersionRequest):
    require_version(req.versionId)
    store.select_version(req.versionId)
    return version_details(req.versionId)

@app.post("/api/design/export")
def export(req: ExportRequest):
    version = require_version(req.versionId)
    if req.format in ("dwg", "3dm"):
        raise HTTPException(501, f"{req.format.upper()} export is not implemented. Use STEP for CAD handoff.")
    def action():
        design = JewelryDesign.model_validate(version["design"])
        directory = store.DATA_DIR / "exports" / version["id"]
        directory.mkdir(parents=True, exist_ok=True)
        filename = f"jewelryai-v{version['number']}-{version['geometry_hash']}.{req.format}"
        path = directory / filename
        with CAD_LOCK:
            write_export(path, req.format, geometry_for(design), design, version)
        response = FileResponse(path, filename=filename, media_type="application/octet-stream")
        response.headers["X-Design-Version"] = version["id"]
        response.headers["X-Geometry-Hash"] = version["geometry_hash"]
        return response
    return safe(action)

FRONTEND = Path(__file__).resolve().parents[1] / "out"
if FRONTEND.exists():
    app.mount("/", StaticFiles(directory=FRONTEND, html=True), name="studio")
