import json
from pathlib import Path
import cadquery as cq
import numpy as np
import trimesh
from .geometry import RingGeometry
from .models import JewelryDesign
from .analysis import MATERIALS

def write_export(path: Path, format: str, geometry: RingGeometry, design: JewelryDesign, version: dict):
    if format in ("step", "stl", "3mf"):
        cq.exporters.export(geometry.metal, str(path), exportType={"step": "STEP", "stl": "STL", "3mf": "3MF"}[format], tolerance=.015, angularTolerance=.08)
    elif format == "dxf":
        # True central XZ section of the selected metal solid; DXF contains 2D geometry only.
        section = cq.Workplane("XZ").newObject([geometry.metal]).section()
        cq.exporters.export(section, str(path), exportType="DXF")
    elif format == "glb":
        scene = trimesh.Scene()
        colors = {"diamond": [225, 238, 252, 255], "emerald": [17, 157, 113, 255], "sapphire": [54, 92, 218, 255], "ruby": [182, 29, 75, 255]}
        for name, shape in (("metal", geometry.metal), ("stone", geometry.stone)):
            vertices, faces = shape.tessellate(.025, .10)
            mesh = trimesh.Trimesh(vertices=[(v.x, v.y, v.z) for v in vertices], faces=faces, process=False)
            # glTF is in metres and Y-up; CAD model is in millimetres and Z-up.
            transform = trimesh.transformations.rotation_matrix(-np.pi / 2, [1, 0, 0])
            transform[:3, :3] *= .001
            mesh.apply_transform(transform)
            if name == "metal":
                color = MATERIALS[design.material]["color"]
                rgba = [int(color[i:i+2], 16) for i in (1, 3, 5)] + [255]
                mesh.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(baseColorFactor=rgba, metallicFactor=1, roughnessFactor=.22))
            else:
                mesh.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(baseColorFactor=colors[design.stone.type], metallicFactor=0, roughnessFactor=.08))
            scene.add_geometry(mesh, node_name=name)
        path.write_bytes(scene.export(file_type="glb"))
    elif format == "json":
        path.write_text(json.dumps({"application": "JewelryAI", "units": "mm", "version": version}, indent=2), encoding="utf-8")
    else:
        raise ValueError("This export is not implemented. No substitute file will be generated.")

