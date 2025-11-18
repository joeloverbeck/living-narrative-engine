# GOAPIMPL Residual Spec: Refinement Implementation Guide

**Reference**: [`GOAPIMPL-008-implementation-guide.md`](./GOAPIMPL-008-implementation-guide.md) — create a developer-facing implementation guide for the refinement engine.

This spec covers only the remaining scope after previous partial implementation.

## Context

- Source modules already exist under `src/goap/refinement/` (`refinementEngine.js`, `methodSelectionService.js`, `steps/`) and are orchestrated by `src/goap/controllers/goapController.js` during turns.
- Refinement-specific docs currently live in `docs/goap/` (parameter binding, condition context, action references, debugging tools) but there is no cohesive "implementation guide" entry point to connect the dots.
- The missing deliverable is documentation: a practitioner-oriented guide at `docs/goap/implementing-refinement-engine.md` that explains how to extend/maintain the implemented system, not new runtime code.

## Original intent (brief)

- Translate the refinement specification (GOAPIMPL-006) into a concrete developer guide with architecture diagrams, component interfaces, and testing/debugging instructions.
- House the guide at `docs/goap/implementing-refinement-engine.md` with pseudocode, implementation order, and example code snippets.
- Provide troubleshooting advice and integration points for planner, action executor, event bus, and diagnostics.

## Already implemented (for reference only)

- Runtime pipeline exists and is fully tested across `src/goap/refinement/refinementEngine.js`, `methodSelectionService.js`, `steps/primitiveActionStepExecutor.js`, and `steps/conditionalStepExecutor.js`, plus `tests/unit` and `tests/integration` coverage.
- Parameter binding, condition context, and action reference docs (`docs/goap/refinement-parameter-binding.md`, `refinement-condition-context.md`, `refinement-action-references.md`) already teach schema specifics.
- Debugging workflows, event traces, and tracer usage are documented in `docs/goap/debugging-tools.md` and `debugging-multi-action.md`.
- Example refinement methods are published under `docs/goap/examples/`, giving JSON samples for most step patterns.

## Remaining Problem

- There is no single document that establishes the architecture of the refinement subsystem, maps implemented classes to their responsibilities, or describes how diagnostics and tests prove correctness. New contributors must hunt across multiple guides and source files.
- Acceptance criteria that called for pseudocode, implementation ordering, event payload descriptions, and integration diagrams were never produced even though the engine exists, leaving institutional knowledge scattered across PRs and inline comments.
- The current docs do not explain how RefinementEngine emits GOAP events, how it interacts with GoapController, or how refinement failure modes (fallback behaviors, replan requests, conditional `onFailure`) should be reasoned about during maintenance.

## Truth sources

- `specs/goap-system-specs.md` — authoritative architecture narrative for planning/refinement hand-off.
- `src/goap/refinement/refinementEngine.js` — definitive runtime behavior for orchestration, events, and fallback handling.
- `src/goap/refinement/steps/*.js` — execution semantics for primitive and conditional steps.
- `src/goap/services/contextAssemblyService.js` and `parameterResolutionService.js` — context and binding responsibilities the guide must reference.
- `docs/goap/refinement-parameter-binding.md`, `refinement-condition-context.md`, `refinement-action-references.md`, `debugging-tools.md` — existing topic-specific docs that should be linked instead of rewritten.
- `tests/unit/goap/refinement/refinementEngine.test.js`, `tests/integration/goap/refinementEngine.integration.test.js`, `tests/integration/goap/primitiveActionExecution.integration.test.js`, `tests/integration/goap/parameterResolution.integration.test.js` — canonical test suites whose intent should be cited in the guide.

## Desired behavior (residual only)

### Normal cases

- Author `docs/goap/implementing-refinement-engine.md` that walks through how `GoapController` invokes `RefinementEngine`, how method selection works, how step execution flows, and how state is stored, referencing the actual class names and file paths.
- Include a component diagram or textual architecture overview mapping `MethodSelectionService`, `PrimitiveActionStepExecutor`, `ConditionalStepExecutor`, `RefinementStateManager`, `ContextAssemblyService`, and diagnostics/event flows.
- Provide pseudocode for `refine(taskId, actorId, params)` that mirrors `src/goap/refinement/refinementEngine.js` so future contributors can understand sequencing without reading the code.
- Summarize the integration points with planner/event bus/action executor and how fallback behaviors propagate to GoapController.
- Document the recommended implementation order / onboarding checklist that mirrors today’s runtime layering rather than the pre-implementation plan.

### Edge cases

- Explicitly cover fallback behaviors (`replan`, `continue`, `fail`) and conditional `onFailure` modes, explaining how they interact with controller retries and diagnostics.
- Describe how refinement local state isolation works (fresh `RefinementStateManager` per call) and what to watch out for when adding new step types or long-running primitives.
- Call out current limitations such as placeholder world data in `ContextAssemblyService` and knowledge-limitation flags so maintainers know what not to rely on yet.

### Failure modes

- In the documentation, instruct developers on how to detect and react to `NO_APPLICABLE_METHOD`, `INVALID_STEP_TYPE`, `STEP_REPLAN_REQUESTED`, and other errors from `RefinementEngine`, including which events/tests surface them.
- Describe how to capture refinement traces and correlate them with controller failure history using existing debugging APIs.

### Invariants

- Clarify invariants enforced by the runtime (one refinement state per execution, events fire in deterministic order, diagnostics enabled by default) so new code or mods can rely on them.
- Reiterate API contracts already encoded in DI tokens (e.g., `tokens.IRefinementEngine`, `tokens.IRefinementStateManager`) and note that the guide must stay in sync with the implemented method signatures.

### API contracts

- Document expected public signatures: `RefinementEngine.refine`, `MethodSelectionService.selectMethod`, `PrimitiveActionStepExecutor.execute`, `ConditionalStepExecutor.execute`, `ParameterResolutionService.resolve`, including parameter/return semantics and event side effects.
- Spell out how external callers (controller, decision provider, diagnostics tools) are allowed to interact with refinement results and what parts are internal-only.

## Out of scope

- Re-explaining JSON Logic basics, parameter binding mechanics, and schema details that are already captured in dedicated docs.
- Implementing new runtime behavior or altering refinement algorithms; this is a documentation/update effort.
- Scope DSL documentation outside of referencing existing links.

## Testing plan (residual)

- Ensure documentation updates link to and reflect the behavior covered by the existing test suites (`tests/unit/goap/refinement/refinementEngine.test.js`, `tests/integration/goap/refinementEngine.integration.test.js`, `tests/integration/goap/primitiveActionExecution.integration.test.js`, `tests/integration/goap/parameterResolution.integration.test.js`).
- Run `npm run lint` / `npm run format` as needed to satisfy doc linting hooks and keep Markdown consistent.
- Optionally add a docs-only checklist entry (e.g., in `docs/goap/README.md`) to verify the new guide is discoverable.
