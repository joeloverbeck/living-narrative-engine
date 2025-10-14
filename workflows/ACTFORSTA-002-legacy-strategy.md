# ACTFORSTA-002: Implement Legacy Formatting Strategy & Fallback Service

## Summary
Decouple the existing single-target/legacy formatting branch inside `ActionFormattingStage` into a reusable strategy and fallback
service while preserving today’s behaviour, trace payloads, and logger output. The work supplies the coordinator refactor with
a drop-in legacy path that can later be wired through the instrumentation abstractions introduced in **ACTFORSTA-001**.

## Background
- The legacy code path currently lives inside `src/actions/pipeline/stages/actionFormatting/ActionFormattingStage.js` and relies on
  several private helper methods (`#extractTargetsFromContexts`, `#prepareLegacyFallback`, `#formatWithLegacyFallback`, etc.).
- Instrumentation, error factory, and accumulator modules from **ACTFORSTA-001** exist but are not yet consumed by the legacy path;
  the stage still calls `trace.captureActionData` and writes warnings/errors directly.
- Legacy formatting is exercised by suites such as `ActionFormattingStage.visual`, `.rubOverClothesFallback`,
  `ActionFormattingStage.fallbackTargets`, and the regression snapshots stored under `tests/integration/actions/actionFormatting/`.
- The follow-up tickets introduce new strategies, a shared task model, and a coordinator, so the legacy strategy must present a
  stable API that those pieces can adopt without reworking behaviour.

## Implementation Plan
### 1. Build `LegacyFallbackFormatter`
- Locate the new module at `src/actions/pipeline/stages/actionFormatting/legacy/LegacyFallbackFormatter.js` (co-locate tests under
  `tests/unit/actions/pipeline/stages/actionFormatting/legacy/`).
- Encapsulate the template preparation, placeholder substitution, sanitisation, and fallback command construction logic that today
  is scattered across `ActionFormattingStage`.
- Expose methods such as `prepareFallback({ actionDefinition, actorContext, targetContext, formatterOptions })` and
  `formatWithFallback({ preparedFallback, defaultCommand, traceContext })` that return the command payload and associated metadata
  currently produced by the stage helpers.
- Mirror sanitisation behaviours (e.g., trimming whitespace, removing null/undefined tokens, keeping markdown escapes) and ensure
  missing targets or template data bubble actionable errors (throw via the existing error types or return error objects consistent
  with the stage’s expectations).

### 2. Introduce `LegacyStrategy`
- Create `src/actions/pipeline/stages/actionFormatting/legacy/LegacyStrategy.js` that consumes `LegacyFallbackFormatter` along with
  injected dependencies (logger, trace adapter, error factory once wired) and exposes a method like
  `format({ actor, actionDefinition, targetContexts, resolvedTargets, formatterOptions, trace })`.
- Port logic from the legacy branch so the strategy:
  - Extracts actionable targets (using a helper equivalent to `#extractTargetsFromContexts`).
  - Prepares fallback data via the formatter, applies substitutions, and builds the final command list.
  - Reports trace and logger messages exactly as today (`trace.captureActionData`, warnings for missing templates, etc.).
  - Returns an object compatible with the accumulator/stage expectations (`{ formattedCommands, fallbackUsed, statistics }`).
- Structure arguments and return values so the upcoming `ActionFormattingTask` can replace the raw parameter list without breaking
  call sites (e.g., accept a single payload object, avoid spreading positional arguments).

### 3. Update `ActionFormattingStage`
- Instantiate `LegacyFallbackFormatter` and `LegacyStrategy` inside `ActionFormattingStage` (likely in the constructor or a private
  factory method) to avoid re-creating them for every action.
- Replace the inline legacy branch with a call to `legacyStrategy.format(...)`, keeping surrounding instrumentation, accumulator,
  and error handling untouched for now.
- Remove or mark with TODO comments any obsolete private helper methods, pointing maintainers to the new module locations.
- Confirm that traced and non-traced executions pass through the same strategy path and still emit the identical trace payloads.

### 4. Testing & Validation
- Add unit tests for `LegacyFallbackFormatter` covering:
  - Missing targets / placeholder data.
  - Sanitisation of actor/target names and formatter options.
  - Fallback template selection logic (default command vs. fallback override).
- Add unit tests for `LegacyStrategy` verifying:
  - Successful formatting returns the same command strings and metadata as the pre-refactor stage.
  - Error propagation when the formatter raises issues.
  - Trace/log interactions (use spies/mocks to assert `trace.captureActionData` and logger calls fire in the same order).
- Execute existing regression suites (`npm run test:unit`, `npm run test:integration -- ActionFormattingStage`) to confirm parity;
  no changes to the test fixtures or snapshots should be required.

## Validation Checklist
- [ ] Legacy helper logic removed from `ActionFormattingStage` in favour of the new modules with clear TODO references.
- [ ] `LegacyFallbackFormatter` exposes deterministic fallback construction that matches current outputs.
- [ ] `LegacyStrategy` delegates to the formatter, manages trace/log interactions, and returns data compatible with the stage.
- [ ] Unit tests cover formatter edge cases and strategy control flow, asserting parity against pre-refactor expectations.
- [ ] Action formatting regression suites (visuals, fallback-specific tests) pass without modification.
- [ ] New modules are ready to plug into the coordinator/decider work in ACTFORSTA-003 through ACTFORSTA-006.

## Dependencies
- Depends on **ACTFORSTA-001** for instrumentation, accumulator, and error factory foundations (even though the stage continues to
  call instrumentation directly until the coordinator wiring lands).
