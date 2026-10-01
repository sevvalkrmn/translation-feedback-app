from typing import Literal

from pydantic import BaseModel, Field, model_validator

Severity = Literal["minor", "major", "critical"]


class LLMFeedbackError(BaseModel):
    target_span: str
    category: str
    severity: Severity
    explanation: str
    hint: str


class LLMFeedbackResult(BaseModel):
    summary: str
    strengths: list[str]
    errors: list[LLMFeedbackError]
    revision_guidance: list[str]


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
