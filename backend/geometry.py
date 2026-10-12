"""Vetted ring template. All geometry uses millimetres; the bore axis is Y."""
import hashlib
import json
import math
from dataclasses import dataclass
import cadquery as cq
from .models import JewelryDesign

GENERATOR_VERSION = "solitaire-1.0"

@dataclass
class RingGeometry:
    metal: cq.Shape
    stone: cq.Shape
    ring: cq.Shape
    gallery: cq.Shape
    girdle_z: float
    metal_mesh: dict | None = None
    stone_mesh: dict | None = None

def design_hash(design: JewelryDesign) -> str:
    payload = {"design": design.model_dump(), "generator": GENERATOR_VERSION}
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:20]

def ellipse_ring(rx, ry, wall, height, z):
    outer = cq.Workplane("XY").ellipse(rx + wall / 2, ry + wall / 2).extrude(height)
    inner = cq.Workplane("XY").ellipse(max(.2, rx - wall / 2), max(.2, ry - wall / 2)).extrude(height)
    return outer.cut(inner).translate((0, 0, z)).val()

def gem_wire(rx, ry, z, scale, count):
    points = [(rx * scale * math.cos(i * math.tau / count), ry * scale * math.sin(i * math.tau / count)) for i in range(count)]
    return cq.Workplane("XY", origin=(0, 0, z)).polyline(points).close().val()

def build_ring(design: JewelryDesign) -> RingGeometry:
    ri = design.innerDiameterMm / 2
    ro = ri + design.shank.thicknessMm
    width = design.shank.widthMm
    ring_wp = cq.Workplane("XZ").circle(ro).circle(ri).extrude(width / 2, both=True)
    # Rounded comfort edges, bounded so the specified bore and envelope remain.
    edge_radius = min(.28, design.shank.thicknessMm * .16, width * .12)
    ring = ring_wp.edges().fillet(edge_radius).val()
    rx, ry = design.stone.widthMm / 2, design.stone.lengthMm / 2
    depth = design.stone.depthMm
    girdle_z = ro + depth * .65 + design.setting.clearanceMm
    count = 48 if design.stone.shape == "oval" else 40
    stone = cq.Solid.makeLoft([
        gem_wire(rx, ry, girdle_z - depth * .65, .015, count),
        gem_wire(rx, ry, girdle_z, 1, count),
        gem_wire(rx, ry, girdle_z + depth * .35, .58, count),
    ], ruled=True)
    pd = design.setting.prongDiameterMm
    lower_z = ro - .65
    gallery = ellipse_ring(rx * .60, ry * .60, pd * .80, .80, lower_z)
    upper = ellipse_ring(rx + pd * .10, ry + pd * .10, pd * .70, .55, girdle_z - .65)
    metal = ring.fuse(gallery).fuse(upper)
    for i in range(design.setting.prongCount):
        angle = math.tau * i / design.setting.prongCount + math.pi / design.setting.prongCount
        c, s = math.cos(angle), math.sin(angle)
        base = cq.Vector(rx * .60 * c, ry * .60 * s, lower_z + .15)
        top = cq.Vector((rx + pd * .10) * c, (ry + pd * .10) * s, girdle_z + depth * .26)
        vec = top.sub(base)
        prong = cq.Solid.makeCone(pd * .52, pd * .43, vec.Length, base, vec.normalized())
        metal = metal.fuse(prong)
    if design.decoration.type == "milgrain":
        bead_r = design.decoration.scaleMm / 2
        bead_center_r = ri + design.shank.thicknessMm * .64
        for side in (-1, 1):
            for i in range(28):
                angle = .42 + (math.tau - .84) * i / 27
                x, z = bead_center_r * math.sin(angle), bead_center_r * math.cos(angle)
                bead = cq.Solid.makeSphere(bead_r, cq.Vector(x, side * (width / 2 - bead_r * .30), z), angleDegrees1=-90)
                metal = metal.fuse(bead)
    # Cut a real faceted seat; gemstone is retained separately for visualization.
    metal = metal.cut(stone).clean()
    if not metal.isValid() or not stone.isValid():
        raise ValueError("The requested parameters produced invalid CAD geometry. The previous version is retained.")
    return RingGeometry(metal, stone, ring, gallery, girdle_z)

def mesh_data(shape: cq.Shape):
    vertices, triangles = shape.tessellate(.035, .12)
    return {
        "positions": [coordinate for v in vertices for coordinate in (v.x, v.y, v.z)],
        "indices": [index for t in triangles for index in t],
    }

def model_data(geometry: RingGeometry, geometry_hash: str):
    if geometry.metal_mesh is None:
        geometry.metal_mesh = mesh_data(geometry.metal)
    if geometry.stone_mesh is None:
        geometry.stone_mesh = mesh_data(geometry.stone)
    return {"units": "mm", "geometryHash": geometry_hash, "metal": geometry.metal_mesh, "stone": geometry.stone_mesh}

