export type Design = {
  schemaVersion: 1;
  jewelryType: "ring";
  title: string;
  material:
    "18k_yellow" | "18k_white" | "18k_rose" | "silver_925" | "platinum_950";
  innerDiameterMm: number;
  stone: {
    type: "diamond" | "emerald" | "sapphire" | "ruby";
    shape: "oval" | "round";
    lengthMm: number;
    widthMm: number;
    depthMm: number;
  };
  shank: { widthMm: number; thicknessMm: number };
  setting: {
    type: "prong";
    prongCount: 4 | 6;
    prongDiameterMm: number;
    clearanceMm: number;
  };
  decoration: { type: "none" | "milgrain"; scaleMm: number };
  manufacturingRoute: "resin_pattern_casting";
};
export type Check = {
  id: string;
  title: string;
  status: "pass" | "fail" | "not_assessed";
  measured?: number | boolean;
  minimum?: number;
  recommendation?: { path: string; value: number };
  detail: string;
  blocking: boolean;
};
export type Analysis = {
  label: string;
  status: string;
  passes: number;
  evaluated: number;
  scope: string;
  ruleVersion: string;
  generatorVersion: string;
  checks: Check[];
  productionApproved: false;
  measurements: Record<string, number>;
  material: {
    name: string;
    color: string;
    densityGcm3: number;
    densitySource: string;
  };
};
export type Version = {
  id: string;
  project_id: string;
  parent_id: string | null;
  number: number;
  label: string;
  prompt: string;
  engine: string;
  created_at: string;
  design: Design;
  assumptions: string[];
  changes: { path: string; oldValue: unknown; newValue: unknown }[];
  analysis: Analysis;
  geometry_hash: string;
};
export type MeshData = { positions: number[]; indices: number[] };
export type ModelData = {
  units: "mm";
  geometryHash: string;
  metal: MeshData;
  stone: MeshData;
};
export type Plan = {
  design: Design;
  assumptions: string[];
  changes: Version["changes"];
  engine: "local" | "gemini";
  summary: string;
};
export type Result = { version: Version; model: ModelData };
export const MATERIALS: {
  id: Design["material"];
  name: string;
  color: string;
  short: string;
}[] = [
  {
    id: "18k_yellow",
    name: "18K yellow gold",
    short: "Yellow gold",
    color: "#d7b66c",
  },
  {
    id: "18k_white",
    name: "18K white gold",
    short: "White gold",
    color: "#d9dce5",
  },
  {
    id: "18k_rose",
    name: "18K rose gold",
    short: "Rose gold",
    color: "#d6a08e",
  },
  {
    id: "silver_925",
    name: "Sterling silver",
    short: "Silver",
    color: "#e0e3e9",
  },
  {
    id: "platinum_950",
    name: "Platinum 950",
    short: "Platinum",
    color: "#bcbec8",
  },
];
