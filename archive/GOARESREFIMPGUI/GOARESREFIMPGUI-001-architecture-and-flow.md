# GOARESREFIMPGUI-001 – Establish refinement implementation guide foundation

**Status:** Completed

## Goal
Author the initial version of `docs/goap/implementing-refinement-engine.md` so future contributors can understand how the existing refinement runtime is wired. The deliverable must introduce the guide, map core components and responsibilities, and outline the invocation flow from `GoapController` through the refinement services.

## File list
- docs/goap/implementing-refinement-engine.md (new)

## Scope of work
- Create the guide file with an intro that states the purpose, truth sources, and when to use the document versus the existing topic-specific guides.
- Provide a component/responsibility overview that explicitly references the implemented modules and their paths (`src/goap/controllers/goapController.js`, `src/goap/refinement/refinementEngine.js`, `src/goap/refinement/methodSelectionService.js`, `src/goap/refinement/steps/primitiveActionStepExecutor.js`, `src/goap/refinement/steps/conditionalStepExecutor.js`, `src/goap/services/contextAssemblyService.js`, `src/goap/services/parameterResolutionService.js`, `src/goap/refinement/refinementStateManager.js`). A textual diagram or table is acceptable but must describe relationships and event hand-offs.
- Document the invocation flow: how `GoapController` collects planner output, how `RefinementEngine.refine` is called, how methods are selected, and how primitive/conditional steps resolve parameters and contexts. Reference existing docs instead of duplicating schema details.
- Provide pseudocode for `RefinementEngine.refine(taskId, actorId, params)` that mirrors the actual sequencing in `src/goap/refinement/refinementEngine.js`, including state manager initialization, method selection, step execution loop, diagnostics/event emission, and termination paths.
- Summarize API contracts for the public-facing entry points (`RefinementEngine.refine`, `MethodSelectionService.selectMethod`, `PrimitiveActionStepExecutor.execute`, `ConditionalStepExecutor.execute`, `ParameterResolutionService.resolve`). List parameters, expected returns, and major side effects/events for each so maintainers know what callers rely on.
- Cross-link to `docs/goap/refinement-parameter-binding.md`, `docs/goap/refinement-condition-context.md`, `docs/goap/refinement-action-references.md`, and other relevant guides instead of restating their content.

## Out of scope
- Modifying runtime code, tests, or service implementations.
- Rewriting existing docs outside of adding references from the new guide.
- Detailing fallback behaviors, diagnostics tooling, or failure modes (covered by follow-up tickets).

## Acceptance criteria
### Tests
- `npm run lint`

### Invariants
- No source files outside the listed file may change.
- Runtime behavior and test fixtures remain untouched.
- API contract descriptions must match the actual method signatures and event names present in the referenced modules.
- New guide must clearly link to the authoritative truth sources listed in the residual spec.

## Outcome
- Authored `docs/goap/implementing-refinement-engine.md`, delivering the architectural overview, invocation flow, pseudocode, and API contract summaries requested so contributors can trace the runtime without spelunking through source files.
- Clarified the component list to reference the actual `src/goap/refinement/refinementStateManager.js` location instead of the outdated `src/goap/state/` path noted in the original request.
- Met acceptance by keeping runtime code untouched and running `npm run lint` (warnings remain in benchmark scripts where `console` usage is intentional and pre-existing).
