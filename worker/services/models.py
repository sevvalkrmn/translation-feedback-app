from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Severity = Literal["minor", "major", "critical"]


class LLMFeedbackError(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    target_span: str = Field(min_length=1)
    category: str = Field(min_length=1)
    severity: Severity
    explanation: str = Field(min_length=1)
    hint: str = Field(min_length=1)


class LLMFeedbackResult(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    summary: str = Field(min_length=1)
    strengths: list[str] = Field(min_length=1)
    errors: list[LLMFeedbackError]
    revision_guidance: list[str] = Field(min_length=1)


class XAIError(BaseModel):
    target_span: str
    target_start: int = Field(ge=0)
    target_end: int = Field(ge=0)
    source_span: str
    severity: Severity
    confidence: float = Field(ge=0, le=1)
    category: str
    explanation: str
    hint: str
    detector_model: str
    explainer_model: str

    @model_validator(mode="after")
    def check_span(self):
        if self.target_end <= self.target_start:
            raise ValueError("target_end must be greater than target_start")
        return self


class XAIResult(BaseModel):
    overall_score: float = Field(ge=0, le=1)
    summary: str
    errors: list[XAIError]


class TranslationTaskPayload(BaseModel):
    id: str
    task_number: int
    method: Literal["llm", "xai"]
    source_text: str
    initial_translation: str
