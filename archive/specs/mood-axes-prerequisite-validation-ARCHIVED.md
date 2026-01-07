# Mood axes prerequisite validation + de-normalization

## Goal
Ensure expression prerequisite validation (via `npm run validate`) rejects mood axis thresholds that are not raw [-100..100] values, including normalized fractional values like `0.44`, and document the required de-normalization of current expression data.

## Background
- `docs/modding/expressions-prerequisites-context.md` defines `moodAxes`/`previousMoodAxes` as raw mood component values with an expected range of `-100..100`.
- `ExpressionPrerequisiteValidator` already enforces range checks by root for *direct* comparisons, but fractional values like `0.45` pass because they are still within `-100..100`.
- Some expression prerequisites currently appear to treat `moodAxes` as normalized values (0..1), which conflicts with the documented scale and leads to inconsistent comparison behavior.

## Audit results (current expression usage)
Direct comparisons against `moodAxes` with numeric thresholds:

| Expression file | Var path | Threshold | Notes |
| --- | --- | --- | --- |
| `data/mods/emotions/expressions/amused_chuckle.expression.json` | `moodAxes.threat` | `0.45` | Appears normalized (should be `45`). |
| `data/mods/emotions/expressions/confident_composure.expression.json` | `moodAxes.threat` | `0.35` | Appears normalized (should be `35`). |
| `data/mods/emotions/expressions/optimistic_lift.expression.json` | `moodAxes.threat` | `0.45` | Appears normalized (should be `45`). |
| `data/mods/emotions/expressions/horror_revulsion.expression.json` | `moodAxes.threat` | `0.25` | Appears normalized (should be `25`). |
| `data/mods/emotions/expressions/horror_revulsion.expression.json` | `moodAxes.valence` | `-0.2` | Appears normalized (should be `-20`). |

Other comparisons against `moodAxes` use integer thresholds in the expected range (examples: `-40`, `10`, `30`, `50`, `20`, `0`).

Nested usage:
- `data/mods/emotions/expressions/horror_revulsion.expression.json` uses `previousMoodAxes.threat` inside a `max` of deltas and compares the `max` to `0.12`. This mixes `emotions` (0..1) deltas with `moodAxes` (raw) deltas and currently bypasses the validator range checks because the var path is nested inside `max`.

## Requirements
1. Validation must treat `moodAxes.*` and `previousMoodAxes.*` threshold values as raw `-100..100` values.
2. Validation must flag *fractional* numeric thresholds for `moodAxes` and `previousMoodAxes` (e.g., `0.44`) as violations, even though they are within `-100..100`.
3. Validation must detect improper `moodAxes` usage even when `moodAxes` appears inside nested JSON Logic (e.g., `max`, `-`, `+`).
4. `npm run validate` must surface these violations via the existing expression prerequisite validation report.
5. Expression data that currently uses normalized `moodAxes` thresholds must be de-normalized to the `-100..100` range.

## Specification

### 1) De-normalize existing expression data
Update the following expression thresholds from normalized to raw scale:
- `data/mods/emotions/expressions/amused_chuckle.expression.json`: `moodAxes.threat <= 0.45` -> `moodAxes.threat <= 45`
- `data/mods/emotions/expressions/confident_composure.expression.json`: `moodAxes.threat <= 0.35` -> `moodAxes.threat <= 35`
- `data/mods/emotions/expressions/optimistic_lift.expression.json`: `moodAxes.threat <= 0.45` -> `moodAxes.threat <= 45`
- `data/mods/emotions/expressions/horror_revulsion.expression.json`:
  - `moodAxes.threat >= 0.25` -> `moodAxes.threat >= 25`
  - `moodAxes.valence <= -0.2` -> `moodAxes.valence <= -20`

For the delta-based spike check in `horror_revulsion`:
- Current logic: `max(disgust_delta, threat_delta, fear_delta) >= 0.12`
- Because `threat_delta` is raw and the other deltas are normalized, this should be reworked to avoid scale mixing. Two acceptable approaches:
  1) **Scale emotion deltas to raw** by multiplying by `100` before feeding them into the `max`, and compare against a raw threshold (e.g., `>= 12`).
  2) **Normalize mood axis delta** by dividing `threat_delta` by `100`, keeping the `0..1` threshold. This is *not* preferred because the project standard is raw mood axes.

The de-normalization plan should adopt option (1) to keep all `moodAxes` data raw and explicit.

### 2) Strengthen validation for mood axes thresholds
Extend `ExpressionPrerequisiteValidator` so it can detect and reject fractional thresholds when a comparison is driven by `moodAxes` or `previousMoodAxes`, even if the var path is nested.

Proposed validation behavior:
- For each comparison operator (`<`, `<=`, `>`, `>=`, `==`, `!=`), inspect **all argument subtrees** to collect:
  - numeric literals
  - var roots (`moodAxes`, `previousMoodAxes`, `emotions`, etc.)
- If any var root in the comparison subtree is `moodAxes` or `previousMoodAxes`, then:
  - all numeric literals in that comparison must be integers
  - all numeric literals must be within `-100..100`
- If a comparison includes both `moodAxes` roots and `emotions`/`sexualStates` roots, emit a **warning** (or violation in strict mode) indicating mixed scale usage. This guards against `max`/`min` patterns that blend raw and normalized values.

This logic must apply regardless of whether the `moodAxes` var is directly in the comparison operator or nested inside expressions like `max`, `min`, `-`, etc.

### 3) Validation reporting
- Use existing `expression_prerequisite` violations/warnings.
- Add a new `issueType` for fractional/scale mismatch (e.g., `mood_axes_fractional_threshold`), and/or reuse `range_mismatch` with a clearer message.
- Include `varPath` (if found) and a `logicSummary` to aid debugging.

## Tests
Create comprehensive tests for validation and data adjustments.

### Unit tests (validator)
- **Direct comparison**: `moodAxes.threat <= 0.44` should fail with fractional threshold violation.
- **Direct comparison**: `moodAxes.threat <= 45` should pass.
- **Nested comparison**: `{"<": [{"max": [{"-": [{"var": "moodAxes.threat"}, {"var": "previousMoodAxes.threat"}]}]}, 0.12]}` should fail.
- **Mixed roots**: `{"<": [{"max": [{"var": "emotions.fear"}, {"var": "moodAxes.threat"}]}, 12]}` should raise a mixed-scale warning/violation.

### Integration tests (validate)
- Add a fixture expression with a fractional mood axis threshold and assert `npm run validate` reports the violation in the expression prerequisite report.
- Validate the updated expressions in `data/mods/emotions/expressions/` to ensure no new violations and the warnings count is expected.

## Implementation notes
- `ExpressionPrerequisiteValidator` already centralizes comparison range checks; extend this logic to walk nested args and return var roots for each comparison.
- `cli/validation/modValidationOrchestrator.js` already calls the validator during `npm run validate`; no pipeline changes are needed beyond enhancing validation logic.

## Open questions
- Should fractional mood axis thresholds ever be allowed (e.g., `12.5`)? This spec assumes **no**, to flag accidental normalization. If fractional thresholds are desired in the future, we should introduce an explicit normalized context field (`moodAxesNormalized`) instead of using raw `moodAxes`.
- Should mixed-scale comparisons be hard errors or warnings by default?
