# XAI Feedback Contract

`evaluate(source_text_tr, student_translation_en) -> XAIResult`

The adapter must return:

- `overall_score`: 0..1
- `summary`
- `errors[]`
- `target_span`
- `target_start`
- `target_end`
- `source_span`
- `severity`: `minor`, `major`, `critical`
- `confidence`: 0..1
- `category`
- `explanation`
- `hint`
- `detector_model`
- `explainer_model`

Adapters must not expose full corrected translations as hints.
