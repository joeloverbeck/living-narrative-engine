# GOARESREFIMPGUI-003 – Capture diagnostics, test references, and discoverability

**Status**: Completed (2025-02-14)

## Goal

Round out `docs/goap/implementing-refinement-engine.md` with practical debugging/test coverage guidance and make the guide discoverable from the GOAP docs index.

## Reality check (2025-02-14)

- The implementation guide already documents component responsibilities, invocation flow, events, and invariants but stops short of offering concrete diagnostics workflows or test-suite pointers, so added sections must plug directly into the existing structure instead of rewriting the file.
- Canonical refinement tests live at:
  - `tests/unit/goap/refinement/refinementEngine.test.js`
  - `tests/integration/goap/refinementEngine.integration.test.js`
  - `tests/integration/goap/primitiveActionExecution.integration.test.js`
  - `tests/integration/goap/parameterResolution.integration.test.js`
    These suites already exist, so the guide should summarize their coverage areas rather than directing contributors to create them.
- Event-bus payloads for refinement are emitted by `src/goap/refinement/refinementEngine.js` (`GOAP_EVENTS.REFINEMENT_*`) and consumed by `GoapController` and the GOAP debugging tools described in `docs/goap/debugging-tools.md` / `docs/goap/debugging-multi-action.md`; instructions must align with these actual emitters.
- No discoverability link for the implementation guide exists in `docs/goap/README.md`, so the ticket still needs a navigation entry there.

## File list

- docs/goap/implementing-refinement-engine.md
- docs/goap/README.md

## Scope of work

- Extend `docs/goap/implementing-refinement-engine.md` with a diagnostics/discoverability section that:
  - Shows how to capture refinement traces using the shipped tooling (`docs/goap/debugging-tools.md`, `docs/goap/debugging-multi-action.md`).
  - Maps event bus payloads emitted from `RefinementEngine`/`GoapController` (`GOAP_EVENTS.REFINEMENT_*`, `goap:controller:*`) to the debugging workflows so contributors know which events to subscribe to.
  - Documents how to inspect `RefinementEngine` lifecycle events, controller replan handling, and event payload fields directly in the runtime (logs, debugger, Plan Inspector).
- Add a “Testing refinement changes” subsection summarizing usage of the canonical suites listed above, what each suite asserts (state isolation, primitive execution, parameter bindings), and when to run them. Mention the `--runInBand` stability note from AGENTS.md.
- Provide instructions for deciding when to add or update tests when extending refinement behavior, including referencing relevant helper files/fixtures under `tests/`.
- Describe how refinement events integrate with the planner/event bus/action executor so maintainers know where diagnostics hooks belong; this must reference the existing event tokens and their payload structures instead of hypothetical names.
- Update `docs/goap/README.md` (GOAP docs index) with a navigation entry for the implementation guide to make it discoverable for designers and engineers.

## Out of scope

- Changes to runtime logging, diagnostics APIs, or testing harnesses.
- Restating fallback/invariant content already covered in GOARESREFIMPGUI-002 beyond the minimal references required for context.
- Creating new debugging tools or modifying scripts.

## Acceptance criteria

### Tests

- `npm run lint`

### Invariants

- Only the listed files may change.
- Documentation changes must remain consistent with the actual debugging docs and test files referenced; no fabricated commands or suite names.
- The GOAP docs index must link to the new guide without removing existing links.
- No runtime code or test implementation files are altered.

## Outcome

- `docs/goap/implementing-refinement-engine.md` now contains an explicit diagnostics/testing section that walks through using GOAPDebugger/RefinementTracer, shows how refinement events (`GOAP_EVENTS.REFINEMENT_*`, `TASK_REFINED`, `ACTION_HINT_*`) integrate with `GoapController`/the planner/event bus/action executor, and documents how to capture traces + hook event probes.
- The implementation guide also lists the canonical refinement-centric test suites (`tests/unit/goap/refinement/refinementEngine.test.js`, `tests/integration/goap/refinementEngine.integration.test.js`, `tests/integration/goap/primitiveActionExecution.integration.test.js`, `tests/integration/goap/parameterResolution.integration.test.js`), the commands/`--runInBand` guidance to execute them, and advice on when to add or update tests/fixtures.
- `docs/goap/README.md` gained a navigation entry for the implementation guide so the new material is discoverable from the GOAP docs home page.
