from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)

class Stone(StrictModel):
    type: Literal["diamond", "emerald", "sapphire", "ruby"] = "diamond"
    shape: Literal["oval", "round"] = "oval"
    lengthMm: float = Field(default=8, ge=3, le=14)
    widthMm: float = Field(default=6, ge=3, le=12)
    depthMm: float = Field(default=4, ge=1.5, le=8)

    @model_validator(mode="after")
    def supported_proportions(self):
        if self.widthMm > self.lengthMm:
            raise ValueError("Stone width must not exceed its length.")
        if self.shape == "round" and abs(self.lengthMm - self.widthMm) > 0.001:
            raise ValueError("A round stone needs equal length and width.")
        if self.depthMm > self.widthMm:
            raise ValueError("Stone depth must not exceed its width.")
        return self

class Shank(StrictModel):
    widthMm: float = Field(default=2.4, ge=1, le=6)
    thicknessMm: float = Field(default=1.8, ge=0.7, le=3.5)

class Setting(StrictModel):
    type: Literal["prong"] = "prong"
    prongCount: Literal[4, 6] = 6
    prongDiameterMm: float = Field(default=0.9, ge=0.45, le=1.8)
    clearanceMm: float = Field(default=0.55, ge=0.25, le=1.5)

class Decoration(StrictModel):
    type: Literal["none", "milgrain"] = "none"
    scaleMm: float = Field(default=0.65, ge=0.4, le=1.2)

class JewelryDesign(StrictModel):
    schemaVersion: Literal[1] = 1
    jewelryType: Literal["ring"] = "ring"
    title: str = Field(default="Oval solitaire", min_length=1, max_length=80)
    material: Literal["18k_yellow", "18k_white", "18k_rose", "silver_925", "platinum_950"] = "18k_yellow"
    innerDiameterMm: float = Field(default=17.4, ge=13, le=23)
    stone: Stone = Field(default_factory=Stone)
    shank: Shank = Field(default_factory=Shank)
    setting: Setting = Field(default_factory=Setting)
    decoration: Decoration = Field(default_factory=Decoration)
    manufacturingRoute: Literal["resin_pattern_casting"] = "resin_pattern_casting"

class GenerateRequest(StrictModel):
    prompt: str = Field(min_length=3, max_length=2000)
    engine: Literal["local", "gemini"] = "local"

class ReviseRequest(StrictModel):
    versionId: str = Field(min_length=1, max_length=50)
    prompt: str = Field(min_length=3, max_length=2000)
    engine: Literal["local", "gemini"] = "local"

class UpdateRequest(StrictModel):
    versionId: str
    design: JewelryDesign
    label: str = Field(default="Parameter adjustment", max_length=120)

class RecommendationRequest(StrictModel):
    versionId: str
    checkId: str

class ExportRequest(StrictModel):
    versionId: str
    format: Literal["step", "stl", "3mf", "glb", "dxf", "json", "dwg", "3dm"]

