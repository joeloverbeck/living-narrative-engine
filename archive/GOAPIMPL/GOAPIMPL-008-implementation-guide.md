# GOAPIMPL-008: Create Implementation Guide for Developers

**Status**: Ready
**Priority**: MEDIUM
**Estimated Effort**: 2-3 days
**Dependencies**: GOAPIMPL-006 (Specification Document)
**Blocks**: None
**Parent**: GOAPSPECANA-001

## Problem Statement

Developers implementing the refinement system need a practical guide that translates the specification into concrete implementation steps. This guide must:

1. Provide clear architecture guidance
2. Define all components and their interfaces
3. Specify implementation order and dependencies
4. Include testing strategies
5. Provide debugging and troubleshooting guidance
6. Reference existing codebase patterns

Without this guide, developers may make inconsistent implementation choices or miss critical integration points.

## Objective

Create a comprehensive implementation guide for developers that translates the refinement method specification into actionable implementation tasks, architecture patterns, and testing strategies.

## Acceptance Criteria

- [ ] Complete implementation guide created at `docs/goap/implementing-refinement-engine.md`
- [ ] Architecture overview with component diagram
- [ ] Refinement execution algorithm documented (pseudocode)
- [ ] All component interfaces specified
- [ ] Integration points with existing systems defined
- [ ] Testing strategy and test cases provided
- [ ] Debugging and troubleshooting section included
- [ ] Implementation order and dependencies documented
- [ ] Code examples for key components

## Implementation Assessment (2025-02)

> Remaining documentation scope is now tracked by [`goapimpl__residual__refinement-implementation-guide.md`](./goapimpl__residual__refinement-implementation-guide.md).

### Already implemented & tested (3-5 bullets)

- `RefinementEngine` orchestrates method selection, fallback handling, state-scoped step execution, and GOAP event emission (`src/goap/refinement/refinementEngine.js:22-592`) with unit coverage for success/failure flows (`tests/unit/goap/refinement/refinementEngine.test.js:113-185`) and integration tests that exercise the full pipeline.
- Method selection, JSON-logic applicability checks, and diagnostics are provided by the shipped `MethodSelectionService` (`src/goap/refinement/methodSelectionService.js:1-160`), so developers already rely on its contract instead of a theoretical `MethodSelector` class.
- Primitive and conditional execution layers manage target binding, `storeResultAs`, nested conditionals, and `onFailure` semantics (`src/goap/refinement/steps/primitiveActionStepExecutor.js:12-200`, `src/goap/refinement/steps/conditionalStepExecutor.js:12-200`) with integration coverage around state isolation and error handling (`tests/integration/goap/primitiveActionExecution.integration.test.js:203-280`).
- Parameter resolution, refinement state snapshots, and context assembly utilities are implemented and tested (`src/goap/services/parameterResolutionService.js:12-210`, `src/goap/refinement/refinementStateManager.js:1-210`, `tests/integration/goap/parameterResolution.integration.test.js:239-334`).
- Refinement authoring docs already cover parameter binding, condition context, action references, and event-based debugging traces (`docs/goap/refinement-parameter-binding.md:1-50`, `docs/goap/refinement-condition-context.md:1-60`, `docs/goap/refinement-action-references.md:1-55`, `docs/goap/debugging-tools.md:240-305`).

### Superseded by design changes

- Component names now differ from the pre-implementation plan: we ship `MethodSelectionService`, `PrimitiveActionStepExecutor`, `ConditionalStepExecutor`, and `ParameterResolutionService` rather than abstract `MethodSelector`, `StepExecutor`, `ParameterResolver`, and `ConditionEvaluator` types, so the guide must reference the actual classes (`src/goap/refinement/refinementEngine.js:22`, `src/goap/refinement/methodSelectionService.js:60`, `src/goap/refinement/steps/primitiveActionStepExecutor.js:26`).
- Condition evaluation is handled via the shared `JsonLogicEvaluationService` that the conditional executor and method selection both consume, so a standalone `ConditionEvaluator` component section would duplicate code that does not exist.
- Scope DSL integration is not part of refinement runtime today; world snapshots returned by `ContextAssemblyService` intentionally stub out location/time data (`src/goap/services/contextAssemblyService.js:334-377`), so the guide should instead document context assembly and parameter binding constraints.
- Documentation has moved to modular guides referenced from `docs/goap/README.md:133-138`, meaning the single giant walkthrough originally described never got written; the new residual spec covers finishing that deliverable instead of redefining runtime work.

### Still missing or under-specified

- There is no `docs/goap/implementing-refinement-engine.md` despite being the primary acceptance criterion; contributors must manually glean architecture details from code and scattered docs (`docs/goap/README.md:133-138`).
- No guide explains how `GoapController` hands work to `RefinementEngine`, what events are emitted, or how fallback behaviors propagate back into planner retries (`src/goap/controllers/goapController.js:1-220`).
- The promised architecture diagram, pseudocode, and implementation order remain undocumented even though the system exists; the new residual spec focuses on capturing that knowledge while linking to the tests that demonstrate behavior.

### Next steps

- Finish the residual spec deliverable above by writing the consolidated implementation guide, then consider moving this ticket into `archive/` with a note that runtime work shipped earlier and only documentation remained.

## Document Structure

```markdown
# Implementing the Refinement Engine

## 1. Architecture Overview
   - System components
   - Data flow
   - Integration with GOAP planner and action executor

## 2. Component Design
   - RefinementEngine
   - MethodSelectionService
   - PrimitiveActionStepExecutor
   - ConditionalStepExecutor
   - ParameterResolutionService
   - JSON Logic evaluation & diagnostics

## 3. Refinement Execution Algorithm
   - High-level flow (pseudocode)
   - Step-by-step execution
   - State management
   - Error handling

## 4. Integration with Existing Systems
   - GOAP planner integration
   - Action executor integration
   - Event bus integration
   - Context assembly & parameter resolution integration
   - JSON-logic integration

## 5. Implementation Order
   - Phase 1: Core infrastructure
   - Phase 2: Basic execution
   - Phase 3: Conditionals and state
   - Phase 4: Failure handling
   - Phase 5: Optimization

## 6. Testing Strategy
   - Unit tests
   - Integration tests
   - End-to-end tests
   - Performance tests

## 7. Debugging and Troubleshooting
   - Common issues
   - Debugging tools
   - Logging strategy
   - Performance profiling

## 8. Code Patterns and Examples
   - Component implementation examples
   - Common patterns
   - Anti-patterns to avoid
```

## Tasks

### 1. Write Architecture Overview
- [ ] Create component diagram (RefinementEngine, MethodSelectionService, PrimitiveActionStepExecutor, ConditionalStepExecutor, ParameterResolutionService, ContextAssemblyService, JsonLogicEvaluationService)
- [ ] Describe data flow from task selection to primitive execution
- [ ] Map components to existing codebase structure
- [ ] Document dependencies between components
- [ ] Specify component responsibilities (single responsibility principle)
- [ ] Reference existing architectural patterns in codebase

### 2. Document RefinementEngine Component
- [ ] Define RefinementEngine class interface
- [ ] Specify constructor dependencies (logger, eventBus, methodRegistry, etc.)
- [ ] Document `refine(task, context)` method signature
- [ ] Specify return value (sequence of primitives or failure)
- [ ] Document error handling and event dispatching
- [ ] Provide implementation skeleton code
- [ ] Reference similar components (e.g., action executor)

### 3. Document MethodSelectionService Component
- [ ] Define MethodSelectionService contract
- [ ] Specify `selectMethod(taskId, actorId, params, options)` signature
- [ ] Document applicability condition evaluation
- [ ] Specify fallback behavior when no method matches
- [ ] Document method priority/ordering
- [ ] Provide implementation skeleton code

### 4. Document PrimitiveActionStepExecutor Component
- [ ] Define PrimitiveActionStepExecutor dependencies and contract
- [ ] Specify `execute(step, context, stepIndex)` signature and parameters
- [ ] Document action lookup, target binding, and parameter merging flow
- [ ] Specify how `storeResultAs` uses RefinementStateManager
- [ ] Document failure propagation and result schema
- [ ] Provide implementation skeleton code

### 5. Document ConditionalStepExecutor Component
- [ ] Define ConditionalStepExecutor dependencies and contract
- [ ] Specify `execute(step, context, stepIndex, currentDepth)` signature
- [ ] Document nesting limits, branch selection, and reuse of primitive executor
- [ ] Specify `onFailure` handling and `replanRequested` signaling
- [ ] Document diagnostic logging expectations
- [ ] Provide implementation skeleton code

### 6. Document ParameterResolutionService Component
- [ ] Define ParameterResolutionService responsibilities and constructor requirements
- [ ] Specify `resolve(reference, context, options)` signature
- [ ] Document supported reference formats and scope (task.params, refinement.localState, actor, world)
- [ ] Specify caching/clearing behavior and entity validation safeguards
- [ ] Document common error cases and logging expectations
- [ ] Provide implementation skeleton code

### 7. Document JSON Logic Evaluation Integration
- [ ] Define how JsonLogicEvaluationService is wired into method selection and conditional execution
- [ ] Specify `evaluate(condition, context)` expectations and diagnostics
- [ ] Document available custom operators / safe access helpers
- [ ] Specify error handling for undefined variables or malformed expressions
- [ ] Provide implementation skeleton or pseudo-API usage examples

### 8. Document Refinement Execution Algorithm
- [ ] Write high-level algorithm pseudocode
- [ ] Document method selection process
- [ ] Specify step execution loop
- [ ] Document state accumulation
- [ ] Specify failure detection and handling
- [ ] Show execution flow diagram
- [ ] Provide annotated code example

### 9. Document Integration with GOAP Planner
- [ ] Specify where refinement is triggered in planning flow
- [ ] Document task-to-method lookup mechanism
- [ ] Specify parameter passing from planner to refinement
- [ ] Document failure feedback to planner (replanning trigger)
- [ ] Show integration sequence diagram
- [ ] Reference `goapDecisionProvider.js` integration points

### 10. Document Integration with Action Executor
- [ ] Specify how primitives are queued for execution
- [ ] Document action parameter binding
- [ ] Specify target resolution from refinement context
- [ ] Document execution feedback to refinement engine
- [ ] Show integration sequence diagram
- [ ] Reference existing action executor code

### 11. Document Integration with Event Bus
- [ ] List all events dispatched by refinement engine:
  - REFINEMENT_STARTED
  - REFINEMENT_METHOD_SELECTED
  - REFINEMENT_STEP_EXECUTED
  - REFINEMENT_COMPLETED
  - REFINEMENT_FAILED
- [ ] Specify event payload structure
- [ ] Document event listeners (for debugging, logging)
- [ ] Reference existing event bus patterns

### 12. Define Implementation Order
- [ ] Phase 1: Core infrastructure (loaders, registry, basic components)
- [ ] Phase 2: Basic execution (simple sequential methods)
- [ ] Phase 3: Conditionals and state (branching, storeResultAs)
- [ ] Phase 4: Failure handling (replanning, fallback)
- [ ] Phase 5: Optimization (caching, performance)
- [ ] Document dependencies between phases
- [ ] Provide milestone checklist

### 13. Create Testing Strategy
- [ ] Unit test guidelines (mock dependencies, test components in isolation)
- [ ] Integration test guidelines (test component interactions)
- [ ] E2E test guidelines (test complete refinement flow)
- [ ] Performance test guidelines (method selection, execution speed)
- [ ] Provide test case examples for each level
- [ ] Reference existing test patterns (`tests/common/`)

### 14. Write Debugging Section
- [ ] List common implementation issues:
  - Method not found
  - Condition evaluation failure
  - Parameter resolution failure
  - Infinite loops in conditionals
- [ ] Provide debugging strategies for each issue
- [ ] Document logging best practices
- [ ] Specify debug events to dispatch
- [ ] Provide troubleshooting flowchart

### 15. Create Code Examples
- [ ] Example: RefinementEngine implementation
- [ ] Example: MethodSelector implementation
- [ ] Example: Conditional step execution
- [ ] Example: Parameter resolution
- [ ] Example: Error handling pattern
- [ ] Annotate examples with explanations

### 15. Review and Polish
- [ ] Ensure consistency with specification document
- [ ] Verify all components are covered
- [ ] Check for clarity and comprehensibility
- [ ] Add cross-references to specification
- [ ] Proofread for technical accuracy
- [ ] Get feedback from other developers

## Expected Outputs

1. **Implementation Guide**: `docs/goap/implementing-refinement-engine.md`
   - Complete guide (25-35 pages)
   - Architecture diagrams
   - Component interfaces
   - Algorithm pseudocode
   - Code examples
   - Testing strategy
   - Debugging guidance

2. **Component Skeletons**: Code examples in guide
   - RefinementEngine skeleton
   - MethodSelector skeleton
   - StepExecutor skeleton
   - ParameterResolver skeleton
   - ConditionEvaluator skeleton

3. **Test Case Examples**: Embedded in guide
   - Unit test examples
   - Integration test examples
   - E2E test examples

## Success Metrics

- Guide is complete and actionable
- Developers can implement system from guide
- All components have clear interfaces
- Algorithm is unambiguous and implementable
- Integration points are clearly specified
- Testing strategy is comprehensive
- Debugging guidance is practical
- Code examples compile and run

## Notes

- Reference existing codebase patterns extensively
- Use project conventions (dependency injection, validation utilities)
- Provide concrete code examples, not abstract descriptions
- Focus on "how to implement", not "what to implement" (spec covers that)
- Emphasize testability and maintainability
- Consider performance from the start

## Key Spec References

- **GOAPIMPL-006**: Refinement specification (primary reference)
- **Existing**: Action executor in `src/actions/`
- **Existing**: Rule execution in `src/logic/`
- **Existing**: Loader patterns in `src/loaders/`
- **Existing**: Event bus in `src/events/`
- **Existing**: Dependency injection in `src/dependencyInjection/`
