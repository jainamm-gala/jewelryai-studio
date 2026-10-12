"""Transparent prototype rules, not a manufacturing certification or FEA."""
from .models import JewelryDesign
from .geometry import RingGeometry, GENERATOR_VERSION

RULE_VERSION = "preliminary-casting-1.0"
MATERIALS = {
    "18k_yellow": {"name": "18K yellow gold", "densityGcm3": 15.5, "color": "#d7b66c"},
    "18k_white": {"name": "18K white gold", "densityGcm3": 15.8, "color": "#d9dce5"},
    "18k_rose": {"name": "18K rose gold", "densityGcm3": 15.2, "color": "#d6a08e"},
    "silver_925": {"name": "Sterling silver", "densityGcm3": 10.36, "color": "#e0e3e9"},
    "platinum_950": {"name": "Platinum 950", "densityGcm3": 20.7, "color": "#cfd1d8"},
}

def analyze(design: JewelryDesign, geometry: RingGeometry):
    checks = []
    def check(id, title, okay, measured, minimum=None, recommendation=None, detail=""):
        checks.append({"id": id, "title": title, "status": "pass" if okay else "fail", "measured": measured,
                       "minimum": minimum, "recommendation": recommendation, "detail": detail, "blocking": not okay})
    check("solid", "Connected metal body", len(geometry.metal.Solids()) == 1, len(geometry.metal.Solids()),
          detail="OpenCascade solid count; the supported template requires one connected metal solid.")
    check("valid", "Valid CAD topology", geometry.metal.isValid(), geometry.metal.isValid(),
          detail="OpenCascade topology validation. This does not establish casting success.")
    check("band_thickness", "Nominal band thickness", design.shank.thicknessMm >= 1.5, design.shank.thicknessMm, 1.5,
          {"path": "shank.thicknessMm", "value": 1.5}, "Prototype guideline for this ring template; not a measured global minimum wall thickness.")
    check("band_width", "Nominal band width", design.shank.widthMm >= 1.8, design.shank.widthMm, 1.8,
          {"path": "shank.widthMm", "value": 1.8}, "Prototype guideline; confirm the final dimensions with your jeweler.")
    check("prong", "Prong stock diameter", design.setting.prongDiameterMm >= .8, design.setting.prongDiameterMm, .8,
          {"path": "setting.prongDiameterMm", "value": .8}, "Stock diameter before the seat cut. Residual prong strength is not assessed.")
    # Measured actual distance between the gemstone and the original band.
    clearance = geometry.ring.distance(geometry.stone)
    check("clearance", "Stone to shank clearance", clearance >= .25 - 1e-5, round(clearance, 3), .25,
          detail="Minimum CAD distance between gemstone and band; gallery and prongs intentionally support the stone.")
    intersection = geometry.metal.intersect(geometry.stone).Volume()
    check("interference", "Stone seat interference", intersection < 1e-5, round(intersection, 7),
          detail="Boolean intersection volume after cutting the stone seat, in mm³.")
    if design.decoration.type != "none":
        check("detail", "Milgrain bead diameter", design.decoration.scaleMm >= .6, design.decoration.scaleMm, .6,
              {"path": "decoration.scaleMm", "value": .6}, "Prototype detail threshold; printing and finishing limits depend on the chosen workshop.")
    for id, title in (("wall", "Global minimum wall thickness"), ("strength", "Prong retention and structural strength"),
                      ("process", "Printing, casting and finishing allowances"), ("alloy", "Workshop alloy and process validation")):
        checks.append({"id": id, "title": title, "status": "not_assessed", "blocking": False,
                       "detail": "Requires a production workflow and professional review; excluded from the evaluated-check count."})
    measured = geometry.metal.BoundingBox()
    assembly_bounds = geometry.metal.fuse(geometry.stone).BoundingBox()
    volume = geometry.metal.Volume()
    failures = [c for c in checks if c["status"] == "fail"]
    passes = sum(c["status"] == "pass" for c in checks)
    evaluated = sum(c["status"] != "not_assessed" for c in checks)
    material = MATERIALS[design.material]
    return {
        "ruleVersion": RULE_VERSION, "generatorVersion": GENERATOR_VERSION,
        "status": "requires_changes" if failures else "ready_for_cad_review",
        "label": "Requires modification" if failures else "Ready for CAD review",
        "passes": passes, "evaluated": evaluated, "checks": checks,
        "productionApproved": False,
        "scope": "Preliminary checks of the supported template. No FEA, casting simulation, global wall-thickness certification or production approval.",
        "measurements": {
            "innerDiameterMm": design.innerDiameterMm,
            "innerCircumferenceMm": round(design.innerDiameterMm * 3.141592653589793, 3),
            "overallWidthMm": round(assembly_bounds.xlen, 3),
            "overallDepthMm": round(assembly_bounds.ylen, 3),
            "overallHeightMm": round(assembly_bounds.zlen, 3),
            "metalVolumeMm3": round(volume, 3),
            "estimatedMetalWeightG": round(volume / 1000 * material["densityGcm3"], 3),
            "stoneShankClearanceMm": round(clearance, 3),
            "metalSolidCount": len(geometry.metal.Solids()),
        },
        "material": {**material, "densitySource": "Illustrative density profile; replace with your supplier's alloy datasheet before production."},
    }
