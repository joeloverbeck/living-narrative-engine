# GOARESREFIMPGUI-002 – Document refinement edge cases and invariants

**Status:** Completed

## Goal
Extend `docs/goap/implementing-refinement-engine.md` with guidance for handling refinement edge cases, fallback policies, and runtime invariants so maintainers can reason about failure handling without digging through source code.

## File list
- docs/goap/implementing-refinement-engine.md

## Scope of work
- Add dedicated sections that describe how fallback behaviors flow through the system: `replan`, `continue`, `fail`, plus conditional `onFailure` handlers. Include how these choices impact `GoapController` retries, event payloads, and diagnostics visibility.
- Document refinement failure codes/errors (`NO_APPLICABLE_METHOD`, `INVALID_STEP_TYPE`, `STEP_REPLAN_REQUESTED`, etc.) and explain which modules raise them, what events they emit, and how callers should respond.
- Explain refinement local state management: how `RefinementStateManager` instances are created per refine call, what data they isolate, and guidelines for adding new step types or long-running primitives.
- Call out current limitations and assumptions noted in the spec (placeholder world state in `ContextAssemblyService`, knowledge limitation flags, unsupported step types) so contributors know what not to rely on yet.
- Capture key invariants that the runtime enforces: one refinement state per execution, deterministic event ordering, diagnostics enabled by default, parameter contexts resolved before execution, etc., citing where these guarantees live in code or tests.
- Ensure new content references the truth sources (`src/goap/refinement/refinementEngine.js`, `src/goap/services/contextAssemblyService.js`, relevant tests) instead of adding speculative behavior.

## Out of scope
- Rehashing the high-level architecture, pseudocode, or API contracts already handled in GOARESREFIMPGUI-001.
- Editing runtime logic or adding new failure handling in code.
- Creating new troubleshooting/diagnostics walkthroughs (see next ticket).

## Acceptance criteria
### Tests
- `npm run lint`

### Invariants
- Only the listed file may change.
- No runtime behavior, schemas, or tests are modified.
- Documented failure modes and invariants must match the behavior asserted in the referenced tests and source files.
- Guide must clearly distinguish between implemented guarantees and current limitations; no promises of unsupported capabilities.

## Outcome
- Expanded `docs/goap/implementing-refinement-engine.md` with new sections that enumerate fallback behaviors, `ConditionalStepExecutor.onFailure` semantics, failure codes, state-management guarantees, known limitations, and runtime invariants, each tied back to the source modules and relevant unit/e2e tests.
- Confirmed acceptance by running `npm run lint` (existing benchmark `console` warnings persist and are unrelated to this work) and leaving runtime/test files untouched.
