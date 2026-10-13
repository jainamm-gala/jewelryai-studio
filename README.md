# JewelryAI Studio

### From a ring idea to inspectable CAD.

A local-first jewelry design studio that turns supported descriptions into structured parameters, real ring geometry, and versioned CAD exports. Describe a solitaire, review the proposed changes, inspect the same model from every angle, and keep the history of your design decisions.

**Local ring-design MVP · CadQuery / OpenCascade geometry · Optional Gemini interpretation**

![JewelryAI Studio showing a four-prong oval solitaire, version history, camera views and measurements](docs/studio-preview.jpg)

[Quick start](#quick-start) · [Try a design](#your-first-design) · [Exports](#export-formats) · [Development](#development-and-verification) · [Roadmap](#roadmap)

> This is a working prototype for **CAD review**, not an automatic manufacturing approval system. It supports a defined family of solitaire rings. The broader project vision is preserved in the original briefs; features outside the current scope are not claimed as implemented.

## What you can do

- **Describe and refine a ring.** Interpret supported requests with the built-in parser or an optional Gemini connection. Review parameters and assumptions before building.
- **Work with actual CAD.** A vetted parametric template creates a metal body, gallery basket, tapered prongs, stone seat, and simplified faceted gemstone.
- **Inspect one consistent design.** Orbit, zoom, pan, switch camera modes, and examine front, back, left, right, top, bottom, and cutaway views derived from the same CAD geometry.
- **Edit precise dimensions.** Adjust the band, inner diameter, stone, setting, metal appearance, and predefined milgrain detail.
- **Keep every saved version.** Restore earlier designs, branch revisions from them, and compare geometry with a violet wireframe overlay.
- **Review measurements and findings.** See CAD-derived volume and bounds, estimated metal weight, evaluated template checks, and explicitly unassessed production concerns.
- **Export the version you selected.** Download STEP, STL, 3MF, GLB, DXF, or JSON with the saved version identity attached.

The local parser is **not an LLM**. It handles constrained template requests; Gemini provides broader language interpretation within the same supported schema. Neither mode generates arbitrary executable CAD code.

## Quick start

### Requirements

- **Windows and PowerShell** for the provided setup and launch scripts.
- **Python 3.12**, available as `python`.
- **Node.js 22 or newer** and npm, available as `npm.cmd`.
- **Git** and access to this private repository.
- A browser with **WebGL** enabled.

No Gemini API key is required to try the studio. Initial setup needs internet access to install dependencies; CadQuery includes a substantial native CAD kernel.

### Clone, install, and run

Run these commands in PowerShell:

```powershell
git clone https://github.com/jainamm-gala/jewelryai-studio.git
cd jewelryai-studio
powershell -ExecutionPolicy Bypass -File .\Setup-Studio.ps1
powershell -ExecutionPolicy Bypass -File .\Start-Studio.ps1
```

The setup script creates `.venv`, installs backend dependencies, restores the frontend from `package-lock.json`, and builds the static frontend. The launch script serves both the interface and API from one local address.

Open **[http://127.0.0.1:8765](http://127.0.0.1:8765)**. Keep the launch terminal open; press **Ctrl+C** there to stop the service. This is a localhost address, not a public deployment.

If setup is already complete, run only `Start-Studio.ps1`. To use another port:

```powershell
powershell -ExecutionPolicy Bypass -File .\Start-Studio.ps1 -Port 8766
```

On the original prepared workspace, the launcher can reuse `../../work/jewelryai-venv` and its existing runtime. A fresh clone uses its project-local environment and default `data/` directory.

## Your first design

1. **Start with an idea.** The studio opens with a starter ring or your last selected version. Use the new-project control for a separate design.
2. **Describe the ring.** Enter a supported request and click the send arrow or press **Ctrl+Enter**.
3. **Review before building.** Check the interpreted parameters, differences, and disclosed defaults. Choose **Adjust parameters** if needed.
4. **Build and save.** The backend validates the design, builds its CAD geometry, evaluates preliminary checks, and then saves a version.
5. **Inspect and iterate.** Explore the views, edit dimensions, compare versions, or apply an available check recommendation.
6. **Export deliberately.** Select the version you want before exporting. Restoring V1 means exporting V1, even when newer versions exist.

### Example prompts

For a new project:

```text
Create an 18K gold ring with an oval 8 x 6 mm diamond and six prongs.
Create a white gold ring with a round 6 x 6 mm sapphire and four prongs.
Create a rose gold ring with an oval 8 x 6 mm emerald.
```

To revise the selected design:

```text
Make the band thinner to 1.6 mm.
Change the six prongs to four.
Increase the center stone to 9 x 7 mm.
Use white gold.
Add milgrain beads.
Make the design more manufacturable.
```

Use explicit millimetre dimensions or specify the sizing system, such as **US size 7**. Bare requests such as “ring size 14” are rejected as ambiguous. US-size conversion is approximate and disclosed; confirm the actual inner diameter before production.

Unsupported requests and failed geometry operations preserve the last saved design. A proposal alone does not create a version, and failed operations do not add a saved revision.

## Supported design scope

| Component | Current support |
| --- | --- |
| Jewelry family | Solitaire rings |
| Stone profiles | Oval and round, with simplified faceting |
| Gemstone appearances | Diamond, emerald, sapphire, and ruby |
| Metal profiles | 18K yellow, white, and rose gold; sterling silver; platinum 950 |
| Setting | Four or six tapered prongs, connected gallery basket, modeled stone seat |
| Detail | Plain or predefined milgrain beads |
| Dimensions | Millimetres, validated against bounded template ranges |
| History | Persistent projects, immutable saved versions, restoration, and comparison |

The complete parameter ranges and acceptance criteria are in [MVP-SPEC.md](MVP-SPEC.md); the executable schema is in [backend/models.py](backend/models.py). A permitted parameter value is not a manufacturing guarantee, and extreme combinations can still fail CAD generation or review.

**Not implemented:** necklaces or other jewelry families; halo, pavé, floral or filigree designs; supplier-specific gemstone cuts; FEA; casting simulation; global minimum-wall analysis; manufacturing certification; native DWG/3DM export; direct AutoCAD/Rhino launch; cloud accounts and multiuser collaboration.

## Export formats

| Format | What the file contains | Units and limits |
| --- | --- | --- |
| **STEP** | Metal CAD solid, excluding the gemstone | Millimetres; CAD exchange, not original modeling history |
| **STL** | Tessellated metal body | Unitless format; interpret coordinates as millimetres |
| **3MF** | Metal mesh | Explicit millimetre units |
| **GLB** | Metal and gemstone with appearance materials | Metres, with Y-up orientation |
| **DXF** | Actual central XZ planar section of the metal geometry | A section, not a fully annotated production drawing |
| **JSON** | Saved design, assumptions, changes, findings, and version identity | Structured design and review record |

CAD uses millimetres, a Y-axis ring bore, and Z-up orientation. The browser views are tessellated derivatives of the backend shapes, not a separately approximated frontend ring. GLB explicitly converts the scale and orientation for its display format.

Export filenames include the saved version number and geometry hash. API downloads also include `X-Design-Version` and `X-Geometry-Hash` headers. Draft exports are allowed; they are never labeled production approved. DWG and native 3DM requests return an explicit not-implemented response.

Try the [sample oval-solitaire STEP file](samples/oval-solitaire-v1.step) for a CAD import check.

## What the checks mean

**“Ready for CAD review” means only that the evaluated prototype checks passed. It does not mean ready for manufacture.** Any failed evaluated check blocks that readiness label. Unassessed items remain visible and are excluded from the evaluated-check count.

The backend checks connected metal-solid count, CAD topology validity, nominal band width/thickness, prong stock diameter, actual stone-to-band minimum distance, post-seat-cut interference, and optional nominal bead diameter.

It does **not** assess global minimum wall thickness, residual prong retention/strength, printing or casting allowances, finishing allowances, or workshop-specific alloy/process feasibility. Nominal template dimensions are not presented as measurements of those unassessed properties.

Metal volume and bounding dimensions come from CAD. Weight is estimated as:

```text
metal weight (g) = CAD metal volume (mm³) / 1000 × illustrative alloy density (g/cm³)
```

This excludes gemstones, sprues, finishing losses, and manufacturing material demand. Thresholds and densities in [backend/analysis.py](backend/analysis.py) are illustrative. Have a qualified jeweler or workshop validate the geometry, alloy, setting, and process before production.

## Optional Gemini connection

### Session-only setup

Open **Settings**, enter your own Gemini API key, and choose the Gemini prompt engine. A key supplied through Settings stays in backend memory for that service session; it is not saved to SQLite or browser storage.

### Environment-file setup

```powershell
Copy-Item .env.example .env
```

Edit `.env` locally, set `GEMINI_API_KEY`, and restart the service. `GEMINI_MODEL` selects the provider model; the example configuration names `gemini-2.5-flash`. Model availability depends on your provider account. Never put a real key in the README, source code, commits, or prompt history.

Requests use Google's REST API with structured JSON output, followed by Pydantic validation. A configured key is **not** proof of successful provider connectivity. The integration has mocked contract tests; a live Gemini call has not been verified without a user-provided key. Provider usage may incur charges.

The built-in parser and CAD workflow remain available without Gemini. Once dependencies are installed, that mode does not require a provider call.

## Architecture

```text
Next.js / React interface
          │ supported description or explicit parameter edits
          ▼
FastAPI + Pydantic ── local parser / optional Gemini
          │ reviewed, schema-valid design
          ▼
CadQuery / OpenCascade ── vetted solitaire template
          │ successful geometry and preliminary analysis
          ▼
SQLite saved version
          ├── CAD-derived meshes → Three.js viewport and camera views
          ├── measurements, findings, and version comparison
          └── selected-version STEP / STL / 3MF / GLB / DXF / JSON
```

The backend computes authoritative parameter differences and rebuilds dependent geometry. Changing stone dimensions therefore rebuilds the basket and seat; appearance-only changes can reuse identical physical geometry while keeping distinct saved identities.

The CAD kernel is guarded by a process-wide lock and used from FastAPI worker threads. Geometry and display meshes are cached for sixteen physical parameter states. The application favors a single local designer over concurrent CAD throughput.

### Repository map

```text
app/                 Interface, styles, types, and CAD mesh viewer
backend/             Schema, interpretation, geometry, checks, storage, exporters, API
tests/               Backend acceptance and prompt-revision tests
docs/                Studio preview and original project briefs
samples/             Verified example STEP export
deliverables/        Original handoff ZIP snapshot; not a rolling release
MVP-SPEC.md          Supported ranges, contracts, and acceptance criteria
Setup-Studio.ps1     Dependency installation and frontend build
Start-Studio.ps1     Local service launcher
```

The current Git checkout is the source of truth. The original briefs describe the broader vision, and the handoff ZIP may predate subsequent repository changes.

### API reference

When the service is running, open **[http://127.0.0.1:8765/docs](http://127.0.0.1:8765/docs)** for the live OpenAPI specification. If you chose another port, use it in the address.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/health` | Engine, provider configuration status, and supported exports |
| `POST /api/design/interpret` | Propose a design or revision without saving a version |
| `POST /api/design/commit` | Validate, build, analyze, and save the reviewed proposal |
| `POST /api/design/generate` / `POST /api/design/revise` | Convenience create/revise workflows |
| `POST /api/design/update` | Apply an explicit parameter edit |
| `POST /api/design/analyze` / `POST /api/design/recommend` | Re-evaluate findings or apply an available recommendation |
| `GET /api/versions` / `GET /api/versions/{id}` | List history or retrieve a saved version and its geometry |
| `GET /api/design/current` / `POST /api/design/select` | Retrieve or persist the selected version |
| `POST /api/design/export` | Export an explicitly identified version |

## Storage and privacy

SQLite stores saved design state, assumptions, changes, findings, parent links, timestamps, and geometry identity. Selecting an older version does not overwrite it; editing it creates a new numbered version linked to that parent. Selection survives browser reloads and service restarts.

Runtime state defaults to `data/`, and exports are generated in version-specific directories beneath it. Set `JEWELRYAI_DATA_DIR` before launch to choose a different location. Back up the complete runtime directory while the service is stopped; saved designs are not part of the Git repository.

Saved geometry is rebuilt from parameters using the recorded generator. The current implementation supports `solitaire-1.0`; a different generator needs an explicit migration policy.

API keys are not stored in the database. A key entered in Settings is session-only; a key you put in `.env` is stored in that local file, which is ignored by Git. Installed dependencies, environments, caches, and runtime files are also ignored.

The service binds to localhost and has no cloud authentication or multiuser access controls. Do not expose it publicly as-is. In Gemini mode, your design request and relevant design context are sent to the provider for interpretation.

## Development and verification

After running setup on a fresh clone:

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q
npm.cmd run typecheck
npm.cmd run build
npm.cmd audit --omit=dev --audit-level=high
```

In the original prepared workspace, substitute `..\..\work\jewelryai-venv\Scripts\python.exe` for the project-local Python path. CAD acceptance tests can take several minutes and use temporary databases for their test clients.

For frontend development, keep the backend running on port 8765 and run `npm.cmd run dev` in a second terminal. Open `http://127.0.0.1:3000`; the frontend uses the local API on 8765. After frontend changes, run `npm.cmd run build` to refresh the static frontend used by the regular launcher.

### Recorded verification — 10 October 2026

- **25 backend tests passed**, including prompt validation, unrelated-field preservation, failed-revision preservation, dependent geometry, recommendations, restored-version export identity, and actual export contents.
- STEP was reimported for geometry/scale/volume checks; STL was checked for watertightness; 3MF units, GLB components, and DXF section entities were checked.
- TypeScript checking and the production frontend build passed.
- The production npm dependency audit reported no known vulnerabilities **at that time**; run it again for a current result.
- Browser checks covered prompt review, parameter adjustment, revisions, persistence, version restoration/comparison, a STEP download, keyboard dialog dismissal, and a narrow mobile layout.

The test runner emitted one upstream Starlette/httpx deprecation warning. Live Gemini connectivity remains unverified. These are recorded results, not a claim that every future commit or dependency change has been tested.

## Troubleshooting

| Problem | What to check |
| --- | --- |
| Private clone fails | Authenticate with the GitHub account that has access. Do not embed a token in the clone URL. |
| `python` or `npm.cmd` is missing | Install the required runtime, check its PATH entry, and reopen PowerShell. |
| Installation takes a while | CadQuery includes native dependencies. Let setup finish and inspect any reported installation error. |
| “Address already in use” | Open the existing studio if it is running, or launch with `-Port 8766`. |
| Page cannot connect | Keep the launch terminal open and use the port printed there. |
| Frontend changes do not appear | Run `npm.cmd run build`, then reload the browser. The regular launcher serves the static build. |
| Geometry fails | Try less extreme dimensions. The last saved version remains intact. |
| Gemini interpretation fails | Check your key, chosen model, provider access, and network; use the local parser to continue. |
| 3D viewport is unavailable | Check WebGL and browser hardware acceleration. |
| A CAD import appears at the wrong scale | Check the export table: STL assumes mm; GLB uses metres. |

## Roadmap

Future work, **not implemented or certified by this MVP**:

- Additional jewelry families and vetted setting/detail templates.
- Supplier-specific gemstone geometry, alloy profiles, and workshop-calibrated process allowances.
- Validated global wall-thickness and stone-retention analysis, plus professional production trials.
- Annotated technical drawings and native CAD integrations.
- A hosted CAD service with persistent storage, HTTPS, authentication, and multiuser access.

The native Python/OpenCascade backend needs a compatible service host; a static frontend alone cannot perform the CAD workflow. No public deployment is claimed.

For the implemented contracts and acceptance criteria, see [MVP-SPEC.md](MVP-SPEC.md). For the original ambition, see [the project description](docs/source-briefs/JEWE-DESCRIPTION.docx) and [initial brief](docs/source-briefs/original-project-brief.txt).

