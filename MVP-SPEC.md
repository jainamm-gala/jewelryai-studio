# JewelryAI Prototype Specification

## Product outcome

A designer can describe a supported ring, confirm parameters and assumptions, inspect one consistent model from multiple angles, revise the same design, review measurements and preliminary findings, restore/compare versions, and export the selected geometry for professional CAD review.

## Data contract

The executable schema is `backend/models.py`. `JewelryDesign` uses a fixed schema version and controlled enums. Numeric dimensions use millimetres, are finite and have bounded ranges. Round stones require equal length/width, width cannot exceed length, and depth cannot exceed width. A complete validated state is required before geometry generation. Missing prompt values use disclosed template defaults. Unsupported features are rejected rather than silently ignored.

| Parameter | Supported range or values |
| --- | --- |
| Inner diameter | 13–23 mm |
| Band width | 1–6 mm |
| Band nominal radial thickness | 0.7–3.5 mm |
| Stone shape | Oval, round |
| Stone length | 3–14 mm |
| Stone width | 3–12 mm; no greater than length |
| Stone depth | 1.5–8 mm; no greater than width |
| Prongs | 4 or 6 |
| Prong stock diameter | 0.45–1.8 mm |
| Stone/shank height clearance | 0.25–1.5 mm |
| Decoration | None or milgrain |
| Milgrain bead diameter | 0.4–1.2 mm |
| Manufacturing route | Resin pattern → casting → finishing → setting |

These are permitted prototype parameter ranges, not universal manufacturing limits. Extreme combinations may fail geometry generation or preliminary review.

## Design ownership and revision rules

The application owns validated state and CAD geometry. Gemini interprets requests; it never supplies executable CAD code. A local constrained interpreter is also available. The backend computes the authoritative difference between the existing and proposed state. Unrelated input parameters remain unchanged; geometry derived from changed parameters is regenerated. A larger stone therefore rebuilds its basket and seat. No version is saved until CAD generation and analysis complete. Failed operations preserve the last saved design. Version selection is explicit and persistent; every export names a version ID.

## Geometry and display

The vetted solitaire template builds a rounded annular band, lower/upper elliptical galleries, tapered prongs and a simplified faceted gemstone. The gemstone solid is subtracted from metal to make a seat. Milgrain uses predefined bead placement. Actual CAD shapes are tessellated for the browser. Front, back, left, right, top and bottom are camera views of the same geometry. Cutaway is an uncapped visual clipping view. DXF is a real planar central section, not a production drawing with annotations.

## Preliminary checks and readiness

Evaluated checks: connected metal solid, valid CAD topology, nominal band thickness/width, prong stock diameter, stone-to-band minimum CAD distance, post-seat-cut interference and optional bead diameter. Every failed evaluated check blocks readiness. Readiness means only that evaluated prototype checks permit CAD review. The app never claims production approval.

Unassessed items remain explicit: global wall thickness, retention and structural strength, manufacturing/process allowances, and workshop alloy/process validation. They are excluded from evaluated-check counts. No weighted manufacturing percentage is presented. Rules and material density estimates are labeled illustrative and require workshop calibration.

## Persistence and credentials

SQLite stores project ID, version ID, parent version, monotonically increasing project version number, label, request, interpreter, timestamp, validated design, assumptions, authoritative changes, analysis and geometry hash. Selecting a version persists that selection; it does not mutate the version. Gemini credentials come from environment variables or session memory, never from version records or localStorage.

## Export contracts

STEP/STL/3MF contain the selected metal geometry, excluding the gemstone. GLB contains both components and appearance materials. DXF contains a planar metal section. JSON preserves the design and review record. Filenames include the saved version number and geometry hash. DWG/native 3DM/direct CAD launch are unsupported and labeled accordingly.

## Acceptance criteria

1. A supported natural-language request produces schema-valid parameters and visible assumptions.
2. A proposal can be reviewed without changing saved design state.
3. A valid ring produces connected valid CAD metal geometry and matching browser meshes.
4. Changing thickness affects actual CAD volume while preserving stone/setting inputs.
5. Changing stone dimensions rebuilds dependent setting geometry.
6. A failed request creates no version and preserves the selected valid design.
7. A configured failure prevents readiness, and applying its recommendation creates a new version.
8. Restoring V1 restores its model and export contents even when later versions exist.
9. A STEP round trip retains valid geometry, scale and volume.
10. STL is a watertight metal mesh at the intended scale; 3MF declares units; GLB has two components; DXF contains real section entities.
11. Browser controls, prompt review, parameter edits, version comparison and downloads operate without fabricated integrations.

## Later work

Additional jewelry/template families, manufacturer-specific settings and alloy data, validated process allowances, real minimum-wall analysis, stone retention design, annotated technical drawings, a CAD service deployment, user accounts, production trials and native CAD integrations require further implementation and validation. They are not part of this completed local prototype.
