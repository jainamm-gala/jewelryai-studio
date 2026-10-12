"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import {
  Gem,
  Sparkles,
  ArrowUpRight,
  ArrowUp,
  Plus,
  ChevronDown,
  ChevronRight,
  Check,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  Settings2,
  Layers3,
  Ruler,
  RotateCcw,
  Grid2X2,
  Box,
  ScanLine,
  Clock3,
  GitCompareArrows,
  LoaderCircle,
  CircleHelp,
  FolderOpen,
  KeyRound,
  WandSparkles,
  Save,
  Move3D,
  FileJson,
  ExternalLink,
} from "lucide-react";
import type {
  Design,
  Version,
  ModelData,
  Plan,
  Result,
  Check as CheckType,
} from "./types";
import { MATERIALS } from "./types";
import { VIEWS, type View } from "./viewer";
const Viewer = dynamic(() => import("./viewer"), {
  ssr: false,
  loading: () => (
    <div className="loading-model">
      <LoaderCircle className="spin" />
      Preparing viewport
    </div>
  ),
});
const API =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== "undefined" && window.location.port === "3000"
    ? "http://127.0.0.1:8765"
    : "");
async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    API + path,
    body === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  if (!response.ok) {
    const result = await response
      .json()
      .catch(() => ({
        detail: "The service could not complete this operation.",
      }));
    throw new Error(
      typeof result.detail === "string"
        ? result.detail
        : result.detail
            ?.map((d: any) => `${d.loc?.slice(1).join(".")}: ${d.msg}`)
            .join("; ") || "Request failed.",
    );
  }
  return response.json();
}
const EXAMPLES = [
  "Create an 18K gold ring with an oval 8 x 6 mm diamond and six prongs",
  "Create a white gold ring with a round 6 x 6 mm sapphire and four prongs",
  "Create a rose gold ring with an oval 8 x 6 mm emerald",
];
const FIELD_NAMES: Record<string, string> = {
  innerDiameterMm: "Inner diameter",
  material: "Metal",
  "stone.type": "Gemstone",
  "stone.shape": "Stone shape",
  "stone.lengthMm": "Stone length",
  "stone.widthMm": "Stone width",
  "stone.depthMm": "Stone depth",
  "shank.widthMm": "Band width",
  "shank.thicknessMm": "Band thickness",
  "setting.prongCount": "Prong count",
  "setting.prongDiameterMm": "Prong diameter",
  "decoration.type": "Detail",
  "decoration.scaleMm": "Bead diameter",
};
function formatValue(value: unknown) {
  return typeof value === "number"
    ? String(value)
    : String(value).replaceAll("_", " ");
}
function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 0.1,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <label className="parameter-field">
      <span>{label}</span>
      <div>
        <input
          type="number"
          aria-label={label}
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <small>mm</small>
      </div>
    </label>
  );
}
export default function Studio() {
  const [version, setVersion] = useState<Version | null>(null),
    [model, setModel] = useState<ModelData | null>(null);
  const [versions, setVersions] = useState<Version[]>([]),
    [allVersions, setAllVersions] = useState<Version[]>([]);
  const [prompt, setPrompt] = useState(""),
    [createMode, setCreateMode] = useState(false);
  const [engine, setEngine] = useState<"local" | "gemini">("local"),
    [gemini, setGemini] = useState(false),
    [key, setKey] = useState("");
  const [busy, setBusy] = useState("Connecting to the CAD engine"),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null),
    [draft, setDraft] = useState<Design | null>(null),
    [reviewOpen, setReviewOpen] = useState(true);
  const [view, setView] = useState<View>("Perspective"),
    [wireframe, setWireframe] = useState(false),
    [grid, setGrid] = useState(true),
    [orthographic, setOrthographic] = useState(false),
    [reset, setReset] = useState(0);
  const [tab, setTab] = useState<"overview" | "parameters" | "checks">(
      "overview",
    ),
    [modal, setModal] = useState<
      "export" | "projects" | "settings" | "compare" | "help" | null
    >(null);
  const [compare, setCompare] = useState<Result | null>(null),
    [compareId, setCompareId] = useState("");
  const [exporting, setExporting] = useState("");
  useEffect(() => {
    if (!modal && !(plan && reviewOpen)) return;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    if (!dialog) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]'));
    focusable()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy && !exporting) {
        event.preventDefault();
        if (modal) setModal(null);
        else { setPlan(null); setDraft(version ? structuredClone(version.design) : null); }
      }
      if (event.key === "Tab") {
        const elements = focusable();
        const first = elements[0], last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previousFocus?.focus(); };
  }, [modal, plan, reviewOpen, busy, exporting, version]);
  const refresh = useCallback(async (v: Version) => {
    const result = await request<{ versions: Version[] }>(
      `/api/versions?projectId=${v.project_id}`,
    );
    setVersions(result.versions);
  }, []);
  const accept = useCallback(
    async (result: Result) => {
      setVersion(result.version);
      setModel(result.model);
      setDraft(structuredClone(result.version.design));
      setPlan(null);
      setCompare(null);
      setCompareId("");
      setCreateMode(false);
      await refresh(result.version);
    },
    [refresh],
  );
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const health = await request<{ geminiConfigured: boolean }>(
          "/api/health",
        );
        if (!alive) return;
        setGemini(health.geminiConfigured);
        const current = await request<{ version: Version | null }>(
          "/api/design/current",
        );
        const result = current.version
          ? await request<Result>(`/api/versions/${current.version.id}`)
          : await request<Result>("/api/design/generate", {
              prompt: EXAMPLES[0],
              engine: "local",
            });
        if (alive) await accept(result);
      } catch (e) {
        if (alive)
          setError(
            (e as Error).message === "Failed to fetch"
              ? "The CAD service is offline. Start the app with Start-Studio.ps1, then reload."
              : (e as Error).message,
          );
      } finally {
        if (alive) setBusy("");
      }
    })();
    return () => {
      alive = false;
    };
  }, [accept]);
  async function run(label: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  function interpretPrompt() {
    if (!prompt.trim()) return;
    void run("Interpreting your design", async () => {
      const result = await request<Plan>("/api/design/interpret", {
        prompt,
        versionId: createMode ? null : version?.id || null,
        engine,
      });
      setPlan(result);
      setReviewOpen(true);
      setDraft(structuredClone(result.design));
    });
  }
  function applyPlan() {
    if (!plan || !draft) return;
    void run("Building your CAD model", async () => {
      await accept(
        await request<Result>("/api/design/commit", {
          design: draft,
          parentVersionId: createMode ? null : version?.id || null,
          prompt,
          engine: plan.engine,
          assumptions: plan.assumptions,
        }),
      );
      setPrompt("");
      setNotice(
        "Design saved. Geometry, measurements and checks are up to date.",
      );
    });
  }
  function edit(path: string, value: unknown) {
    setDraft((previous) => {
      if (!previous) return previous;
      const d = structuredClone(previous);
      const parts = path.split(".");
      let ref: any = d;
      for (const p of parts.slice(0, -1)) ref = ref[p];
      ref[parts.at(-1)!] = value;
      if (
        d.stone.shape === "round" &&
        (path === "stone.shape" ||
          path === "stone.widthMm" ||
          path === "stone.lengthMm")
      ) {
        const dimension =
          path === "stone.lengthMm" ? d.stone.lengthMm : d.stone.widthMm;
        d.stone.widthMm = dimension;
        d.stone.lengthMm = dimension;
      }
      return d;
    });
  }
  function saveParameters() {
    if (!version || !draft) return;
    void run("Rebuilding the ring", async () => {
      await accept(
        await request<Result>("/api/design/update", {
          versionId: version.id,
          design: draft,
          label: "Parameter adjustment",
        }),
      );
      setNotice("Parameters saved as a new version.");
    });
  }
  function selectVersion(v: Version) {
    void run(`Loading version ${v.number}`, async () => {
      await accept(
        await request<Result>("/api/design/select", { versionId: v.id }),
      );
      setModal(null);
      setNotice(
        `Version ${v.number} is selected. Exports will use this exact version.`,
      );
    });
  }
  function quickMaterial(material: Design["material"]) {
    if (!version || material === version.design.material) return;
    void run("Updating metal", async () => {
      const d = structuredClone(version.design);
      d.material = material;
      await accept(
        await request<Result>("/api/design/update", {
          versionId: version.id,
          design: d,
          label: `Changed to ${MATERIALS.find((m) => m.id === material)?.name}`,
        }),
      );
    });
  }
  function recommend(check: CheckType) {
    if (!version) return;
    void run("Applying recommendation", async () => {
      await accept(
        await request<Result>("/api/design/recommend", {
          versionId: version.id,
          checkId: check.id,
        }),
      );
      setNotice("Recommendation applied to a new version.");
    });
  }
  async function download(format: string) {
    if (!version || exporting) return;
    setExporting(format);
    setError("");
    try {
      const response = await fetch(API + "/api/design/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: version.id, format }),
      });
      if (!response.ok) {
        const e = await response.json();
        throw new Error(e.detail);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `jewelryai-v${version.number}-${version.geometry_hash}.${format}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setNotice(
        `${format.toUpperCase()} exported from version ${version.number}.`,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setExporting("");
    }
  }
  function openProjects() {
    void run("Loading projects", async () => {
      const result = await request<{ versions: Version[] }>("/api/versions");
      setAllVersions(result.versions);
      setModal("projects");
    });
  }
  function loadCompare(id: string) {
    setCompareId(id);
    void run("Loading comparison", async () => {
      setCompare(await request<Result>(`/api/versions/${id}`));
    });
  }
  const design = version?.design,
    analysis = version?.analysis,
    measurements = analysis?.measurements;
  const dirty =
    !!version &&
    !!draft &&
    JSON.stringify(draft) !== JSON.stringify(version.design);
  const projectLatest = allVersions.filter(
    (v, i, a) => a.findIndex((x) => x.project_id === v.project_id) === i,
  );
  return (
    <div className="studio-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="JewelryAI Studio">
          <span className="brand-icon">
            <Gem size={20} />
          </span>
          <span>
            Jewelry<span className="brand-ai">AI</span>
          </span>
          <span className="beta">STUDIO</span>
        </a>
        <nav aria-label="Main navigation">
          <button className="nav-active">Studio</button>
          <button onClick={openProjects}>Projects</button>
          <button onClick={() => setModal("help")}>
            Guide <ArrowUpRight size={12} />
          </button>
        </nav>
        <div className="top-actions">
          <span className="local-status">
            <i /> Local workspace
          </span>
          <button
            className="icon-button"
            title="Settings"
            aria-label="Settings"
            onClick={() => setModal("settings")}
          >
            <Settings2 size={16} />
          </button>
          <button
            className="primary small"
            disabled={!version || !!busy}
            onClick={() => setModal("export")}
          >
            <Download size={14} />
            Export design
          </button>
        </div>
      </header>
      <div className="workspace-bar">
        <div>
          <span className="breadcrumb">Workspace</span>
          <ChevronRight size={12} />
          <span>{design?.title || "New ring design"}</span>
          <span className="version-pill">V{version?.number || 1}</span>
        </div>
        <span className="saved">
          <span className={busy ? "pulse" : ""}>
            {busy ? (
              <LoaderCircle size={12} className="spin" />
            ) : (
              <Check size={12} />
            )}
          </span>
          {busy ? "Working…" : "Saved locally"}
        </span>
      </div>
      <main className="workspace">
        <aside className="copilot-panel">
          <div className="panel-heading">
            <div>
              <Sparkles size={17} />
              <h2>Design copilot</h2>
            </div>
            <button
              className="icon-button"
              title="Create a new project"
              aria-label="Create a new project"
              disabled={!!busy}
              onClick={() => {
                setCreateMode(true);
                setPrompt("");
                setPlan(null);
                setNotice(
                  "Describe a new ring below. Your existing projects stay saved.",
                );
              }}
            >
              <Plus size={16} />
            </button>
          </div>
          <div className="copilot-intro">
            <span className="eyebrow">AN IDEA, MADE TANGIBLE</span>
            <h1>
              Your next
              <br />
              signature piece.
            </h1>
            <p>
              Describe your ring. Refine the details.
              <br />
              Keep every version of the idea.
            </p>
          </div>
          <div className="engine-select">
            <span className="engine-dot" />
            <select
              aria-label="Prompt engine"
              value={engine}
              onChange={(e) => setEngine(e.target.value as any)}
              disabled={!!busy}
            >
              <option value="local">Local template parser</option>
              <option value="gemini" disabled={!gemini}>
                Gemini {gemini ? "connected" : "— connect in Settings"}
              </option>
            </select>
            <ChevronDown size={12} />
          </div>
          <div className="timeline-header">
            <span>{createMode ? "NEW DESIGN" : "DESIGN JOURNEY"}</span>
            <span>{versions.length} versions</span>
          </div>
          <div className="journey">
            {versions
              .slice()
              .reverse()
              .map((v) => (
                <button
                  key={v.id}
                  disabled={!!busy}
                  className={`journey-entry ${version?.id === v.id ? "selected" : ""}`}
                  onClick={() => selectVersion(v)}
                >
                  <span className="journey-dot">
                    {version?.id === v.id ? (
                      <Gem size={12} />
                    ) : (
                      <Check size={10} />
                    )}
                  </span>
                  <span>
                    <span className="journey-number">
                      VERSION {String(v.number).padStart(2, "0")}{" "}
                      <span>
                        {v.engine === "gemini"
                          ? "Gemini"
                          : v.engine === "local"
                            ? "Local"
                            : "Edited"}
                      </span>
                    </span>
                    <strong>{v.number === 1 ? v.design.title : v.label}</strong>
                    <small>
                      {v.design.stone.lengthMm} × {v.design.stone.widthMm} mm ·{" "}
                      {v.design.setting.prongCount} prongs
                    </small>
                  </span>
                </button>
              ))}
            {!version && !busy && (
              <p className="empty-note">Create your first design below.</p>
            )}
          </div>
          <div className="prompt-area">
            <div className="prompt-title">
              <span>
                {createMode ? "Describe a new ring" : "Refine this design"}
              </span>
              <WandSparkles size={13} />
            </div>
            <textarea
              aria-label="Jewelry prompt"
              placeholder={
                createMode
                  ? "An oval emerald ring in rose gold…"
                  : "Make the band thinner to 1.6 mm…"
              }
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={2000}
              disabled={!!busy}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  interpretPrompt();
                }
              }}
            />
            <div className="prompt-footer">
              <small>Ctrl + Enter to send</small>
              <button
                className="send-button"
                aria-label="Interpret prompt"
                disabled={!prompt.trim() || !!busy}
                onClick={interpretPrompt}
              >
                {busy ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <ArrowUp size={17} />
                )}
              </button>
            </div>
            <div className="suggestions">
              {(createMode
                ? ["Oval diamond ring", "Round sapphire ring"]
                : ["Four prongs", "Use white gold", "Make more manufacturable"]
              ).map((s) => (
                <button
                  key={s}
                  disabled={!!busy}
                  onClick={() =>
                    setPrompt(
                      createMode
                        ? s.startsWith("Oval")
                          ? EXAMPLES[0]
                          : EXAMPLES[1]
                        : s,
                    )
                  }
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="parser-note">
              {engine === "local"
                ? "Supports explicit dimensions, metals, stones and template details. Review before applying."
                : "Gemini interprets your intent. The CAD engine builds and checks the geometry."}
            </p>
          </div>
        </aside>
        <section className="canvas-panel" aria-label="Ring design viewer">
          <div className="viewport-heading">
            <div>
              <span className="eyebrow">DESIGN VIEWPORT</span>
              <h2>{design?.title || "Your design studio"}</h2>
              <span className="view-meta">
                {design
                  ? `${MATERIALS.find((m) => m.id === design.material)?.name} / ${design.stone.shape} ${design.stone.type}`
                  : "Connecting to geometry engine"}
              </span>
            </div>
            <button
              className="subtle-button"
              disabled={!version || !!busy}
              onClick={() => {
                setTab("parameters");
                setDraft(version ? structuredClone(version.design) : null);
              }}
            >
              <Settings2 size={13} />
              Edit parameters
            </button>
          </div>
          <div className="viewport">
            <div className="viewport-label">
              <span className="live-dot" />
              PARAMETRIC MODEL<span className="mm-pill">mm</span>
            </div>
            <div className="viewer-wrap">
              {model && design ? (
                <Viewer
                  model={model}
                  design={design}
                  view={view}
                  wireframe={wireframe}
                  grid={grid}
                  orthographic={orthographic}
                  reset={reset}
                  compare={
                    compare
                      ? { model: compare.model, design: compare.version.design }
                      : null
                  }
                />
              ) : (
                <div className="loading-model">
                  <Gem size={38} />
                  <span>{busy || "Create a design to begin"}</span>
                </div>
              )}
            </div>
            {busy && (
              <div className="busy-overlay" role="status">
                <LoaderCircle size={15} className="spin" />
                {busy}
              </div>
            )}
            {compare && (
              <div className="comparison-tag">
                <Layers3 size={12} />
                Ghost overlay · V{compare.version.number}
                <button
                  aria-label="Remove comparison"
                  onClick={() => setCompare(null)}
                >
                  <X size={12} />
                </button>
              </div>
            )}
            <div className="viewport-bottom">
              <span>
                <Move3D size={12} /> Drag to orbit · Scroll to zoom · Right-drag
                to pan
              </span>
              <span>
                {view === "Section"
                  ? "Uncapped cutaway"
                  : orthographic
                    ? "Orthographic"
                    : "Perspective"}
              </span>
            </div>
            <div className="viewer-tools">
              <button
                className={grid ? "active" : ""}
                aria-label="Toggle grid"
                title="Grid"
                onClick={() => setGrid(!grid)}
              >
                <Grid2X2 size={16} />
              </button>
              <button
                className={wireframe ? "active" : ""}
                aria-label="Toggle wireframe"
                title="Wireframe"
                onClick={() => setWireframe(!wireframe)}
              >
                <Box size={16} />
              </button>
              <button
                className={orthographic ? "active" : ""}
                aria-label="Toggle orthographic camera"
                title="Orthographic camera"
                onClick={() => setOrthographic(!orthographic)}
              >
                <ScanLine size={16} />
              </button>
              <span />
              <button
                aria-label="Reset camera"
                title="Reset camera"
                onClick={() => {
                  setView("Perspective");
                  setReset(reset + 1);
                }}
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
          <div className="views-header">
            <span>ONE DESIGN. EVERY ANGLE.</span>
            <span>
              <Layers3 size={12} /> Same CAD geometry
            </span>
          </div>
          <div className="views-strip">
            {VIEWS.filter((v) => v !== "Perspective").map((v) => (
              <button
                key={v}
                className={`view-card ${view === v ? "selected" : ""}`}
                onClick={() => setView(v)}
                aria-label={`View ${v.toLowerCase()}`}
              >
                <div>
                  {model && design ? (
                    <Viewer
                      model={model}
                      design={design}
                      view={v}
                      thumbnail
                      orthographic={false}
                    />
                  ) : (
                    <Box size={23} />
                  )}
                </div>
                <span>{v === "Section" ? "Cutaway" : v}</span>
                {view === v && <i />}
              </button>
            ))}
          </div>
          <div className="material-bar">
            <span>METAL FINISH</span>
            <div>
              {MATERIALS.map((m) => (
                <button
                  title={m.name}
                  aria-label={`Use ${m.name}`}
                  key={m.id}
                  disabled={!version || !!busy}
                  onClick={() => quickMaterial(m.id)}
                  className={design?.material === m.id ? "selected" : ""}
                >
                  <i
                    style={{
                      background: `linear-gradient(135deg,#fff6,${m.color} 45%,#0008)`,
                    }}
                  />
                  {design?.material === m.id && <Check size={10} />}
                </button>
              ))}
            </div>
            <strong>
              {MATERIALS.find((m) => m.id === design?.material)?.short ||
                "Yellow gold"}
            </strong>
            <span className="material-spacer" />
            <button
              className="subtle-button"
              disabled={versions.length < 2 || !!busy}
              onClick={() => setModal("compare")}
            >
              <GitCompareArrows size={13} />
              Compare versions
            </button>
          </div>
        </section>
        <aside className="details-panel">
          <div className="detail-tabs">
            <button
              className={tab === "overview" ? "active" : ""}
              onClick={() => setTab("overview")}
            >
              Overview
            </button>
            <button
              className={tab === "parameters" ? "active" : ""}
              onClick={() => setTab("parameters")}
            >
              Parameters
            </button>
            <button
              className={tab === "checks" ? "active" : ""}
              onClick={() => setTab("checks")}
            >
              Checks{analysis?.checks.some((c) => c.status === "fail") && <i />}
            </button>
          </div>
          <div className="details-scroll">
            {tab === "overview" && design && analysis && measurements && (
              <>
                <div className="detail-section">
                  <div className="section-title">
                    <Gem size={14} />
                    <h3>Design summary</h3>
                  </div>
                  <dl className="summary-list">
                    <div>
                      <dt>Jewelry</dt>
                      <dd>Solitaire ring</dd>
                    </div>
                    <div>
                      <dt>Metal</dt>
                      <dd>{analysis.material.name}</dd>
                    </div>
                    <div>
                      <dt>Gemstone</dt>
                      <dd className="capitalize">{design.stone.type}</dd>
                    </div>
                    <div>
                      <dt>Cut profile</dt>
                      <dd className="capitalize">{design.stone.shape}</dd>
                    </div>
                    <div>
                      <dt>Setting</dt>
                      <dd>{design.setting.prongCount}-prong basket</dd>
                    </div>
                    <div>
                      <dt>Detail</dt>
                      <dd className="capitalize">{design.decoration.type}</dd>
                    </div>
                  </dl>
                </div>
                <div className="detail-section">
                  <div className="section-title">
                    <Ruler size={14} />
                    <h3>Measurements</h3>
                    <span>mm</span>
                  </div>
                  <div className="measurement-grid">
                    <div>
                      <span>Inner diameter</span>
                      <strong>
                        {measurements.innerDiameterMm.toFixed(2)}
                        <small>mm</small>
                      </strong>
                    </div>
                    <div>
                      <span>Overall height</span>
                      <strong>
                        {measurements.overallHeightMm.toFixed(2)}
                        <small>mm</small>
                      </strong>
                    </div>
                    <div>
                      <span>Stone size</span>
                      <strong>
                        {design.stone.lengthMm} × {design.stone.widthMm}
                        <small>mm</small>
                      </strong>
                    </div>
                    <div>
                      <span>Band thickness</span>
                      <strong>
                        {design.shank.thicknessMm.toFixed(2)}
                        <small>mm</small>
                      </strong>
                    </div>
                  </div>
                  <dl className="summary-list compact">
                    <div>
                      <dt>Band width · nominal</dt>
                      <dd>{design.shank.widthMm.toFixed(2)} mm</dd>
                    </div>
                    <div>
                      <dt>Prong stock diameter</dt>
                      <dd>{design.setting.prongDiameterMm.toFixed(2)} mm</dd>
                    </div>
                    <div>
                      <dt>Stone / band clearance</dt>
                      <dd>
                        {measurements.stoneShankClearanceMm.toFixed(3)} mm
                      </dd>
                    </div>
                    <div>
                      <dt>Metal volume · CAD</dt>
                      <dd>{measurements.metalVolumeMm3.toFixed(1)} mm³</dd>
                    </div>
                  </dl>
                  <div className="weight-row">
                    <span>Estimated metal weight</span>
                    <strong>
                      {measurements.estimatedMetalWeightG.toFixed(2)}
                      <small> g</small>
                    </strong>
                  </div>
                  <p className="fine-print">
                    Finished metal only. Illustrative alloy density; excludes
                    gemstones, sprues and finishing allowances.
                  </p>
                </div>
                <div className="detail-section">
                  <div className="section-title">
                    <CheckCircle2 size={14} />
                    <h3>Geometry review</h3>
                  </div>
                  <div
                    className={`review-status ${analysis.status === "requires_changes" ? "warning" : ""}`}
                  >
                    <span>
                      {analysis.status === "requires_changes" ? (
                        <AlertCircle size={16} />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                    </span>
                    <div>
                      <strong>{analysis.label}</strong>
                      <small>
                        {analysis.passes} of {analysis.evaluated} evaluated
                        checks passed
                      </small>
                    </div>
                  </div>
                  <div className="check-progress">
                    <i
                      style={{
                        width: `${(analysis.passes / analysis.evaluated) * 100}%`,
                      }}
                    />
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setTab("checks")}
                  >
                    Inspect findings <ArrowUpRight size={12} />
                  </button>
                  <p className="fine-print">
                    Preliminary template checks. Production feasibility still
                    needs professional review.
                  </p>
                </div>
                {!!version?.assumptions.length && (
                  <div className="detail-section">
                    <div className="section-title">
                      <CircleHelp size={14} />
                      <h3>Design assumptions</h3>
                    </div>
                    {version.assumptions.map((s, i) => (
                      <p className="assumption" key={i}>
                        {s}
                      </p>
                    ))}
                  </div>
                )}
              </>
            )}
            {tab === "parameters" && draft && (
              <>
                <div className="detail-section">
                  <div className="section-title">
                    <Settings2 size={14} />
                    <h3>Ring geometry</h3>
                    <span>{dirty ? "UNSAVED" : "mm"}</span>
                  </div>
                  <NumberField
                    label="Inner diameter"
                    value={draft.innerDiameterMm}
                    min={13}
                    max={23}
                    onChange={(v) => edit("innerDiameterMm", v)}
                  />
                  <NumberField
                    label="Band width"
                    value={draft.shank.widthMm}
                    min={1}
                    max={6}
                    onChange={(v) => edit("shank.widthMm", v)}
                  />
                  <NumberField
                    label="Band thickness"
                    value={draft.shank.thicknessMm}
                    min={0.7}
                    max={3.5}
                    onChange={(v) => edit("shank.thicknessMm", v)}
                  />
                </div>
                <div className="detail-section">
                  <div className="section-title">
                    <Gem size={14} />
                    <h3>Gemstone</h3>
                  </div>
                  <label className="select-field">
                    Type
                    <select
                      value={draft.stone.type}
                      onChange={(e) => edit("stone.type", e.target.value)}
                    >
                      {["diamond", "emerald", "sapphire", "ruby"].map((t) => (
                        <option key={t}>{t}</option>
                      ))}
                    </select>
                  </label>
                  <label className="select-field">
                    Shape
                    <select
                      value={draft.stone.shape}
                      onChange={(e) => edit("stone.shape", e.target.value)}
                    >
                      <option>oval</option>
                      <option>round</option>
                    </select>
                  </label>
                  <NumberField
                    label="Stone length"
                    value={draft.stone.lengthMm}
                    min={3}
                    max={14}
                    onChange={(v) => edit("stone.lengthMm", v)}
                  />
                  <NumberField
                    label="Stone width"
                    value={draft.stone.widthMm}
                    min={3}
                    max={12}
                    onChange={(v) => edit("stone.widthMm", v)}
                  />
                  <NumberField
                    label="Stone depth"
                    value={draft.stone.depthMm}
                    min={1.5}
                    max={8}
                    onChange={(v) => edit("stone.depthMm", v)}
                  />
                </div>
                <div className="detail-section">
                  <div className="section-title">
                    <Layers3 size={14} />
                    <h3>Setting & detail</h3>
                  </div>
                  <label className="select-field">
                    Prongs
                    <select
                      value={draft.setting.prongCount}
                      onChange={(e) =>
                        edit("setting.prongCount", Number(e.target.value))
                      }
                    >
                      <option value={4}>4 prongs</option>
                      <option value={6}>6 prongs</option>
                    </select>
                  </label>
                  <NumberField
                    label="Prong diameter"
                    value={draft.setting.prongDiameterMm}
                    min={0.45}
                    max={1.8}
                    onChange={(v) => edit("setting.prongDiameterMm", v)}
                  />
                  <NumberField
                    label="Seat height clearance"
                    value={draft.setting.clearanceMm}
                    min={0.25}
                    max={1.5}
                    onChange={(v) => edit("setting.clearanceMm", v)}
                  />
                  <label className="select-field">
                    Decoration
                    <select
                      value={draft.decoration.type}
                      onChange={(e) => edit("decoration.type", e.target.value)}
                    >
                      <option value="none">None</option>
                      <option value="milgrain">Milgrain beads</option>
                    </select>
                  </label>
                  {draft.decoration.type === "milgrain" && (
                    <NumberField
                      label="Bead diameter"
                      value={draft.decoration.scaleMm}
                      min={0.4}
                      max={1.2}
                      onChange={(v) => edit("decoration.scaleMm", v)}
                    />
                  )}
                  <label className="select-field">
                    Metal
                    <select
                      value={draft.material}
                      onChange={(e) => edit("material", e.target.value)}
                    >
                      {MATERIALS.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="parameter-save">
                  <button
                    className="primary"
                    disabled={(!dirty && !plan) || !!busy}
                    onClick={plan ? () => setReviewOpen(true) : saveParameters}
                  >
                    <Save size={14} />
                    {plan ? "Review & build" : "Apply parameters"}
                  </button>
                  <p className="fine-print">
                    Rebuilds the model and saves a new version. The viewer shows
                    the saved design until applied.
                  </p>
                </div>
              </>
            )}
            {tab === "checks" && analysis && (
              <>
                <div className="detail-section">
                  <div className="section-title">
                    <CheckCircle2 size={14} />
                    <h3>Preliminary review</h3>
                  </div>
                  <p className="fine-print">
                    Route: resin pattern → casting → finishing → stone setting.
                    Thresholds are illustrative prototype guidelines.
                  </p>
                </div>
                <div className="checks-list">
                  {analysis.checks.map((c) => (
                    <div key={c.id} className={`check-card ${c.status}`}>
                      <div>
                        {c.status === "pass" ? (
                          <CheckCircle2 size={14} />
                        ) : c.status === "fail" ? (
                          <AlertCircle size={14} />
                        ) : (
                          <CircleHelp size={14} />
                        )}
                        <strong>{c.title}</strong>
                      </div>
                      <p>{c.detail}</p>
                      {typeof c.measured === "number" && (
                        <small>
                          Measured / nominal: {c.measured}
                          {c.minimum ? ` · Guideline: ≥ ${c.minimum}` : ""}
                        </small>
                      )}
                      {c.status === "not_assessed" && (
                        <span className="not-assessed">Not assessed</span>
                      )}
                      {c.status === "fail" && c.recommendation && (
                        <button
                          className="subtle-button"
                          disabled={!!busy}
                          onClick={() => recommend(c)}
                        >
                          Apply recommendation <ArrowUpRight size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <div className="detail-section">
                  <p className="fine-print">
                    Rules: {analysis.ruleVersion}
                    <br />
                    Generator: {analysis.generatorVersion}
                    <br />
                    Production approved: No
                  </p>
                </div>
              </>
            )}
          </div>
          <div className="handoff-panel">
            <span className="eyebrow">NEXT, INTO YOUR WORKFLOW</span>
            <h3>Ready to take it further?</h3>
            <p>
              Export this version for CAD review
              <br />
              or a printing prototype.
            </p>
            <button
              className="secondary"
              disabled={!version || !!busy}
              onClick={() => setModal("export")}
            >
              CAD handoff <ArrowUpRight size={14} />
            </button>
          </div>
        </aside>
      </main>
      <footer className="statusbar">
        <span>
          <i />
          CadQuery / OpenCascade
        </span>
        <span>
          {model
            ? `${Math.round(model.metal.indices.length / 3).toLocaleString()} metal triangles`
            : "Geometry engine"}
        </span>
        <span className="status-spacer" />
        <span>
          {version
            ? `V${version.number} · ${version.geometry_hash.slice(0, 8)}`
            : "No version selected"}
        </span>
        <span>
          <Clock3 size={11} />
          SQLite persistence
        </span>
        <button onClick={() => setModal("help")} aria-label="Open studio guide">
          <CircleHelp size={13} />
        </button>
      </footer>
      {(error || notice) && (
        <div
          className={`toast ${error ? "error" : ""}`}
          role={error ? "alert" : "status"}
        >
          {error ? <AlertCircle size={17} /> : <CheckCircle2 size={17} />}
          <span>{error || notice}</span>
          <button
            aria-label="Dismiss message"
            onClick={() => {
              setError("");
              setNotice("");
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}
      {plan && draft && reviewOpen && (
        <div className="modal-backdrop">
          <section
            className="modal plan-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Review design interpretation"
          >
            <button
              className="modal-close"
              aria-label="Cancel interpretation"
              disabled={!!busy}
              onClick={() => {
                setPlan(null);
                setDraft(version ? structuredClone(version.design) : null);
              }}
            >
              <X size={18} />
            </button>
            <span className="eyebrow">REVIEW BEFORE BUILDING</span>
            <h2>{createMode ? "Your new design" : "A considered revision."}</h2>
            <p>{plan.summary}</p>
            <div className="plan-spec">
              <span>
                {MATERIALS.find((m) => m.id === draft.material)?.name}
              </span>
              <span>
                {draft.stone.lengthMm} × {draft.stone.widthMm} ×{" "}
                {draft.stone.depthMm} mm {draft.stone.type}
              </span>
              <span>
                {draft.setting.prongCount} prongs · {draft.shank.thicknessMm} mm
                band thickness
              </span>
              <span>{draft.innerDiameterMm} mm inner diameter</span>
            </div>
            {plan.changes.length > 0 && (
              <div className="changes-table">
                {plan.changes.map((c) => (
                  <div key={c.path}>
                    <span>{FIELD_NAMES[c.path] || c.path}</span>
                    <span>
                      {formatValue(c.oldValue)} <ArrowUpRight size={11} />{" "}
                      <strong>{formatValue(c.newValue)}</strong>
                    </span>
                  </div>
                ))}
              </div>
            )}
            {plan.assumptions.length > 0 && (
              <div className="plan-assumptions">
                <h4>Assumptions to confirm</h4>
                {plan.assumptions.map((s, i) => (
                  <p key={i}>{s}</p>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button
                className="secondary"
                disabled={!!busy}
                onClick={() => {
                  setReviewOpen(false);
                  setTab("parameters");
                }}
              >
                Adjust parameters
              </button>
              <button className="primary" disabled={!!busy} onClick={applyPlan}>
                {busy ? (
                  <LoaderCircle size={14} className="spin" />
                ) : (
                  <Sparkles size={14} />
                )}
                Build & save version
              </button>
            </div>
          </section>
        </div>
      )}
      {modal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModal(null);
          }}
        >
          <section
            className={`modal ${modal === "compare" ? "wide-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={`${modal} dialog`}
          >
            <button
              className="modal-close"
              aria-label="Close dialog"
              disabled={!!exporting}
              onClick={() => setModal(null)}
            >
              <X size={18} />
            </button>
            {modal === "export" && version && (
              <>
                <span className="eyebrow">CAD HANDOFF</span>
                <h2>Take your design further.</h2>
                <p>
                  Exporting <strong>version {version.number}</strong>. Every
                  file is generated from its saved geometry.
                </p>
                <div className="export-grid">
                  {[
                    {
                      format: "step",
                      name: "STEP",
                      detail: "Metal solid · mm · CAD exchange",
                    },
                    {
                      format: "stl",
                      name: "STL",
                      detail: "Metal mesh · interpret coordinates as mm",
                    },
                    {
                      format: "3mf",
                      name: "3MF",
                      detail: "Metal mesh · explicit millimetre units",
                    },
                    {
                      format: "glb",
                      name: "GLB",
                      detail: "Metal + gemstone · metres · 3D sharing",
                    },
                    {
                      format: "dxf",
                      name: "DXF",
                      detail: "Central XZ section · 2D metal geometry",
                    },
                    {
                      format: "json",
                      name: "Design JSON",
                      detail: "Parameters, assumptions and findings",
                    },
                  ].map((f) => (
                    <button
                      key={f.format}
                      disabled={!!exporting || !!busy}
                      onClick={() => download(f.format)}
                    >
                      <div>
                        {f.format === "json" ? (
                          <FileJson size={19} />
                        ) : (
                          <Box size={19} />
                        )}
                        <strong>{f.name}</strong>
                        {exporting === f.format ? (
                          <LoaderCircle size={15} className="spin" />
                        ) : (
                          <Download size={15} />
                        )}
                      </div>
                      <span>{f.detail}</span>
                    </button>
                  ))}
                </div>
                <div className="coming-soon">
                  <span>DWG / native 3DM / direct AutoCAD & Rhino launch</span>
                  <small>Not implemented</small>
                </div>
                <p className="fine-print">
                  Metal exports exclude the gemstone and contain the current
                  modeled seat geometry. These are CAD review / prototype files.
                  Manufacturing allowances and final stone retention need
                  professional review.
                </p>
              </>
            )}
            {modal === "settings" && (
              <>
                <span className="eyebrow">STUDIO SETTINGS</span>
                <h2>Connect your AI copilot.</h2>
                <p>
                  The local parser works without an API key. Connect Gemini for
                  broader interpretation within the supported ring template.
                </p>
                <label className="key-field">
                  Gemini API key
                  <input
                    type="password"
                    autoComplete="off"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="Paste your Gemini API key"
                  />
                </label>
                <p className="fine-print">
                  The key stays in server memory for this session. It is never
                  saved to design history or browser storage. Alternatively, set
                  GEMINI_API_KEY in .env.
                </p>
                <div className="connection-status">
                  <span className={gemini ? "live-dot" : "engine-dot"} />
                  {gemini
                    ? "Gemini key configured · provider connectivity not yet verified"
                    : "Local parser active · Gemini not configured"}
                </div>
                <div className="modal-actions">
                  <button className="secondary" onClick={() => setModal(null)}>
                    Close
                  </button>
                  <button
                    className="primary"
                    disabled={!key.trim() || !!busy}
                    onClick={() =>
                      void run("Connecting Gemini", async () => {
                        const result = await request<{ configured: boolean }>(
                          "/api/config/gemini",
                          { apiKey: key },
                        );
                        setGemini(result.configured);
                        setKey("");
                        setEngine("gemini");
                        setModal(null);
                        setNotice(
                          "Gemini key configured. Your next prompt will use Gemini.",
                        );
                      })
                    }
                  >
                    <KeyRound size={14} />
                    Use Gemini
                  </button>
                </div>
              </>
            )}
            {modal === "projects" && (
              <>
                <span className="eyebrow">YOUR WORKSPACE</span>
                <h2>Ideas worth keeping.</h2>
                <p>
                  Your projects and versions are saved in the local SQLite
                  database.
                </p>
                <div className="project-list">
                  {projectLatest.map((v) => (
                    <button
                      key={v.project_id}
                      disabled={!!busy}
                      onClick={() => selectVersion(v)}
                    >
                      <span>
                        <Gem size={21} />
                      </span>
                      <div>
                        <strong>{v.design.title}</strong>
                        <small>
                          {
                            MATERIALS.find((m) => m.id === v.design.material)
                              ?.name
                          }{" "}
                          · V{v.number}
                        </small>
                      </div>
                      <ArrowUpRight size={16} />
                    </button>
                  ))}
                </div>
                <button
                  className="primary"
                  onClick={() => {
                    setCreateMode(true);
                    setPrompt("");
                    setModal(null);
                  }}
                >
                  <Plus size={14} />
                  New ring design
                </button>
              </>
            )}
            {modal === "compare" && version && (
              <>
                <span className="eyebrow">VERSION COMPARISON</span>
                <h2>See how your idea evolved.</h2>
                <p>
                  Current: V{version.number}. Choose another saved version to
                  compare.
                </p>
                <select
                  className="compare-select"
                  aria-label="Compare with version"
                  value={compareId}
                  onChange={(e) => loadCompare(e.target.value)}
                  disabled={!!busy}
                >
                  <option value="">Select a version</option>
                  {versions
                    .filter((v) => v.id !== version.id)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        V{v.number} · {v.label}
                      </option>
                    ))}
                </select>
                {compare && (
                  <>
                    <div className="compare-summary">
                      <div>
                        <span>Metal weight · estimate</span>
                        <strong>
                          {compare.version.analysis.measurements.estimatedMetalWeightG.toFixed(
                            2,
                          )}{" "}
                          g → {measurements?.estimatedMetalWeightG.toFixed(2)} g
                        </strong>
                      </div>
                      <div>
                        <span>Metal volume · CAD</span>
                        <strong>
                          {compare.version.analysis.measurements.metalVolumeMm3.toFixed(
                            1,
                          )}{" "}
                          → {measurements?.metalVolumeMm3.toFixed(1)} mm³
                        </strong>
                      </div>
                    </div>
                    <div className="changes-table">
                      {Object.entries(FIELD_NAMES).map(([path, name]) => {
                        const get = (d: any) =>
                          path.split(".").reduce((o, p) => o[p], d);
                        const old = get(compare.version.design),
                          current = get(version.design);
                        return old !== current ? (
                          <div key={path}>
                            <span>{name}</span>
                            <span>
                              {formatValue(old)} <ArrowUpRight size={11} />{" "}
                              <strong>{formatValue(current)}</strong>
                            </span>
                          </div>
                        ) : null;
                      })}
                    </div>
                    <p className="fine-print">
                      The selected comparison is also shown as a violet
                      wireframe overlay in the main viewport.
                    </p>
                  </>
                )}
                <div className="modal-actions">
                  <button className="primary" onClick={() => setModal(null)}>
                    Return to viewport
                  </button>
                </div>
              </>
            )}
            {modal === "help" && (
              <>
                <span className="eyebrow">A QUICK STUDIO GUIDE</span>
                <h2>From an idea to geometry.</h2>
                <ol className="guide-list">
                  <li>
                    <strong>Describe a supported ring.</strong>
                    <p>
                      Oval or round stone, 4/6 prongs, a plain or milgrain band.
                      Set dimensions in millimetres or specify a US ring size.
                    </p>
                  </li>
                  <li>
                    <strong>Review the interpretation.</strong>
                    <p>
                      Confirm defaults and proposed changes before building the
                      CAD model.
                    </p>
                  </li>
                  <li>
                    <strong>Refine and compare.</strong>
                    <p>
                      Use prompts or Parameters. Every applied change creates a
                      saved version; selecting an older version restores it.
                    </p>
                  </li>
                  <li>
                    <strong>Inspect and export.</strong>
                    <p>
                      Review evaluated checks and unassessed items. Export the
                      selected version for professional CAD review.
                    </p>
                  </li>
                </ol>
                <p className="fine-print">
                  This is a constrained prototype. Floral geometry, halo, pavé,
                  production simulation and direct CAD-app launch are not
                  implemented. Gemstone geometry is a simplified faceted
                  profile, not a supplier's actual stone scan.
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
