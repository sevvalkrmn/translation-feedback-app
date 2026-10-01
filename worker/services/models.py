from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

Severity = Literal["minor", "major", "critical"]
Category = Literal["meaning_shift", "omission", "addition", "terminology", "grammar", "fluency", "register_style", "cohesion"]
Dimension = Literal["meaning_accuracy", "completeness", "grammar_fluency", "terminology_register"]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class DimensionScores(StrictModel):
    meaning_accuracy: int = Field(ge=0, le=100)
    completeness: int = Field(ge=0, le=100)
    grammar_fluency: int = Field(ge=0, le=100)
    terminology_register: int = Field(ge=0, le=100)


class CriticalEvidence(StrictModel):
    criterion: Literal["claim_reversal", "central_sentence_omitted", "unusable_translation"]
    source_span: str = Field(min_length=1)
    translation_span: str = Field(min_length=1)


class EvaluationError(StrictModel):
    id: str = Field(pattern=r"^error_[1-9][0-9]*$")
    source_span: str = Field(min_length=1)
    translation_span: str = Field(min_length=1)
    category: Category
    severity: Severity
    source_meaning: str = Field(min_length=1)
    detected_problem: str = Field(min_length=1)
    student_hint: str = Field(min_length=1)
    critical_evidence: CriticalEvidence | None = Field(default=None, exclude=True)


class TranslationEvaluation(StrictModel):
    schema_version: Literal["1.0"]
    prompt_version: Literal["translation-evaluation-v1", "translation-evaluation-v1.1"]
    model: Literal["Qwen3.8-27B"]
    language_pair: Literal["tr-en"]
    overall_score: int = Field(ge=0, le=100)
    dimension_scores: DimensionScores
    errors: list[EvaluationError] = Field(max_length=2)
    summary: str = Field(min_length=1)

    @model_validator(mode="after")
    def unique_error_ids(self):
        if len({error.id for error in self.errors}) != len(self.errors):
            raise ValueError("duplicate error id")
        return self


class FeedbackIssue(StrictModel):
    source_span: str
    translation_span: str
    category: Category
    severity: Severity
    explanation: str
    hint: str


class LLMFeedbackResult(StrictModel):
    method: Literal["llm"] = "llm"
    summary: str
    errors: list[FeedbackIssue] = Field(max_length=2)
    evaluation: TranslationEvaluation


class Verification(StrictModel):
    status: Literal["verified", "inconclusive"]
    before_severity: Severity
    after_severity: Severity | None
    relevant_dimension: Dimension
    score_delta: int
    no_new_major_error: bool


class EvidenceItem(StrictModel):
    source_span: str
    translation_span: str
    category: Category
    severity: Severity
    decision_explanation: str
    verification: Verification
    student_hint: str


class XAIResult(StrictModel):
    method: Literal["xai"] = "xai"
    summary: str
    evidence_items: list[EvidenceItem] = Field(max_length=2)
    evaluation: TranslationEvaluation


class CounterfactualCandidate(StrictModel):
    replacement_span: str = Field(min_length=1, max_length=160)


class TranslationTaskPayload(StrictModel):
    id: str
    task_number: int
    method: Literal["llm", "xai"]
    source_text: str
    initial_translation: str
