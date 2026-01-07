# Expression simulator evaluation diagnostics

## Goal
Provide a reliable, per-expression diagnostic report for prerequisite evaluation so we can see why expressions are rejected. Add an evaluation panel in the expressions simulator that shows pass/fail with clear failure reasons each time "Trigger Expression" is pressed.

## Current flow (key files)
- `expressions-simulator.html`: UI with four result panels and a Trigger Expression button.
- `src/domUI/expressions-simulator/ExpressionsSimulatorController.js`: Button handler builds context and calls `IExpressionEvaluatorService.evaluateAll()`.
- `src/expressions/expressionContextBuilder.js`: Builds JSON Logic context (actor, emotions, sexualStates, moodAxes, previous* values).
- `src/expressions/expressionEvaluatorService.js`: Resolves condition refs and evaluates each prerequisite via `IJsonLogicEvaluationService.evaluate()`.
- `src/logic/jsonLogicEvaluationService.js`: Validates and evaluates JSON Logic; returns falsy on validation or evaluation errors.
- Data: `data/mods/emotions/expressions/*.expression.json` (53 entries in manifest).

## Observations about prerequisites
- Expressions use JSON Logic with nested `and`/`or` plus `var` lookups to `emotions.*`, `sexualStates.*`, `sexualArousal`, `moodAxes.*`, and `previous*` fields.
- Many expressions compare against `previousEmotions` or `previousSexualStates` deltas. In the simulator, `previousState` starts as `null`, so `previousEmotions.*` resolves to null unless defaults are provided.
- `ExpressionEvaluatorService` currently logs only that a prerequisite failed and returns `false`. It does not surface which prerequisite or which variable path caused the rejection.

## Why "no expressions triggered" is plausible (and suspicious)
Possible contributing factors worth validating:
- `previous*` values are null on the first run; many prerequisites reference them without defaults, producing falsy comparisons.
- If prerequisites rely on mood/sexual values outside the simulator's ranges, evaluation returns false with no detail.
- Any `condition_ref` or invalid operator failures are swallowed as false by the evaluator, which hides the true reason.

## Desired diagnostics behavior
- Every evaluation cycle should report each expression's status.
- If an expression passes: say it passed (and mention no prerequisites or skipped ones if relevant).
- If an expression fails: show the prerequisite index and a clear failure reason.
- The diagnostics panel should clear on every "Trigger Expression" click before rendering the new cycle's output.

## Proposed UI change
Add a new, full-width panel under the existing four result panels:
- Title: "Evaluation Log"
- Content: one entry per expression with a pass/fail badge and failure details.

## Proposed evaluation diagnostics API
Add a diagnostics method in `ExpressionEvaluatorService`:
- `evaluateAllWithDiagnostics(context)` returns:
  - `matches`: list of passing expressions in priority order.
  - `evaluations`: list of per-expression results, each including:
    - `passed`: boolean
    - `prerequisites`: array with `index`, `status`, and `message`

Per-prerequisite diagnostics:
- Missing `logic`: mark as `skipped` with a message.
- `condition_ref` resolution error: mark as `failed` with the resolver error.
- JSON Logic evaluation error: mark as `failed` with the error message.
- Falsy evaluation result: mark as `failed` and include one of:
  - Missing context data paths (based on `var` traversal)
  - A generic "evaluated to false" message

## Suggested ways to make evaluation more trustworthy
1. Add a strict validation mode for expressions (load-time or `npm run validate`):
   - Require `logic` in every prerequisite.
   - Validate JSON Logic operators against the allowed list.
   - Validate `var` roots against allowed context keys.
   - Require defaults for `previous*` references.
2. Surface a structured diagnostic payload for expression evaluation (errors and warnings) in both logs and UI.
3. Add a CLI validator target for expression packs (e.g., `npm run validate:expressions`).
4. Consider a normalized mood axes context (e.g., `moodAxesNormalized`) to reduce scale confusion.

## Open questions
- Should the simulator seed `previous*` values with the current state on the first run to avoid null comparisons?
- Do we want expression evaluation to short-circuit on the first failed prerequisite, or capture all failures?
