# Expression prerequisite evaluation hardening

## Goal
Make expression prerequisite evaluation fail fast with detailed, actionable errors, and remove ambiguity about value ranges (especially mood axes).

## Current state (as observed)
- Expression definitions live in `data/mods/emotions/expressions/` (31 files).
- Expression prerequisites are evaluated via:
  - `src/expressions/expressionPersistenceListener.js` (trigger)
  - `src/expressions/expressionContextBuilder.js` (context)
  - `src/expressions/expressionEvaluatorService.js` (prerequisite loop)
  - `src/logic/jsonLogicEvaluationService.js` (JSON Logic eval + validation)
- Context fields for prerequisites:
  - `emotions`: calculated from normalized mood axes (0..1 intensities)
  - `sexualStates`: calculated intensities (0..1)
  - `sexualArousal`: calculated (0..1)
  - `moodAxes`: raw mood component values (docs say -100..100)
  - `previousEmotions`/`previousSexualStates`/`previousMoodAxes`: cached prior state
- Expression prerequisites use JSON Logic with `var`, `and`, `or`, `max`, `-`, etc. No `condition_ref` usages in current expression pack.
- Observed value ranges in expressions:
  - `emotions.*` and `sexualStates.*` use thresholds like `0.35` to `0.75` (0..1)
  - `moodAxes.*` use thresholds like `-50`, `-40`, `10`, `45` (raw -100..100)
  - Several expressions compare against `previousEmotions.*` deltas using `-` and `max`.
- `ExpressionEvaluatorService` currently:
  - Treats missing `prerequisite.logic` as a warning and skips it (expression may still pass).
  - Returns `false` on evaluation errors (log + continue), which can hide data or logic errors.

## Primary risks
1. Silent failures: invalid logic or runtime errors convert to false and drop the expression without clear, actionable diagnostics.
2. Range ambiguity: `moodAxes` are raw (-100..100) while `emotions` are normalized (0..1). If authors assume normalized axes or future changes normalize these values, existing thresholds will fail silently.
3. Missing context keys or `previous*` state can lead to `null` or `NaN` math, producing hard-to-diagnose falsy results.
4. Inconsistent operator use and argument types are only partially validated today (allowed operations are checked, but not argument shapes or var paths).

## Recommendations (fail-fast + robust)

### 1) Add a strict validation pass for expression prerequisites
Perform validation at load time (or at validate command time) and fail the expression early.

Proposed checks:
- Every `prerequisites` entry must have a `logic` object; missing logic is an error.
- Validate JSON Logic structure and operator argument counts.
- Validate `var` references against allowed context roots:
  - allowed: `actor`, `emotions`, `sexualStates`, `sexualArousal`, `moodAxes`, `previousEmotions`, `previousSexualStates`, `previousMoodAxes`
- Validate that `var` paths point to known axes/keys (e.g., `moodAxes.valence`, `emotions.sadness`).
- Validate numeric threshold ranges based on expected scale:
  - `emotions.*` and `sexualStates.*` should be within [0, 1]
  - `sexualArousal` within [0, 1]
  - `moodAxes.*` within [-100, 100]
- Validate that `previous*` usage is paired with defaults if null is possible (e.g., use `{"var": ["previousEmotions.rage", 0]}` for numeric math).

Where to enforce:
- Add an expression-specific validator in the load pipeline (e.g., extend `ExpressionLoader` or add a validation stage in `npm run validate`).
- Consider a strict mode toggle for dev/test to throw on any invalid expression prereq.

### 2) Add explicit, structured error reporting
When evaluation fails, provide a detailed error record:
- Expression id + mod source
- Prerequisite index (1-based) and a compact JSON summary of the logic
- Resolved logic (after condition refs)
- Context keys and relevant values (for the vars used)
- Error category (invalid-logic, missing-var, range-mismatch, evaluation-error)

This should be returned/logged in a structured way. For example:
- `ExpressionPrerequisiteError` with a standardized payload.
- Logging to include a stable prefix and short error code for grepability.

### 3) Fail-fast evaluation mode for expressions
In strict mode, any of the following should throw and mark the expression as invalid for the session:
- Missing `logic`.
- Invalid JSON Logic structure.
- Unknown or disallowed operator.
- `var` path outside allowed context.
- Range mismatch for known value types.
- Runtime evaluation error (e.g., NaN, undefined arithmetic).

In non-strict mode, errors should still be recorded with full detail, but evaluation can return false.

### 4) Normalize or explicitly name axes to remove ambiguity
To avoid future confusion:
- Keep `moodAxes` as raw (-100..100) but add `moodAxesNormalized` to the context as [-1..1].
- Update the expression schema description to explicitly call out the ranges for each context field.
- Optionally add a validation rule that forbids comparing `moodAxes.*` to values in [0, 1] unless explicitly using `moodAxesNormalized`.

### 5) Improve authoring ergonomics
- Add optional `failure_message` to all expressions for better diagnostics (currently only some have it).
- Provide a small "expression linter" or `npm run validate:expressions` that prints specific errors and suggested fixes.

## Concrete validation examples
- `moodAxes.valence >= 0.55` should fail validation (likely normalized scale confusion).
- `emotions.anger >= 45` should fail validation (emotion scale mismatch).
- `{ "var": "emotions.unknown_key" }` should fail with an unknown key error.
- `{ "and": [] }` should warn (vacuous truth) and be discouraged in expressions.

## Test plan (recommended)
- Unit tests for the new validation logic:
  - Missing logic, invalid operator, invalid var path, range mismatch.
  - Detection of `previous*` usage without default in numeric arithmetic.
- Unit tests for strict vs non-strict evaluation behavior:
  - Strict mode throws and records detailed error object.
  - Non-strict returns false but logs the same detail.
- Integration test: validate all `data/mods/emotions/expressions/*.json` against the stricter rules.
- Add a negative test with a known-bad expression fixture to ensure the validator catches it.

## Open questions
- Do we want to treat `previous*` nulls as zero automatically in the context builder?
- Should expression evaluation share the same prerequisite tracing infrastructure used by actions?
- Should `moodAxesNormalized` be added now, or should expressions standardize on raw axes only?
