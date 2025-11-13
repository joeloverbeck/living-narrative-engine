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

## Document Structure

```markdown
# Implementing the Refinement Engine

## 1. Architecture Overview
   - System components
   - Data flow
   - Integration with GOAP planner and action executor

## 2. Component Design
   - RefinementEngine
   - MethodSelector
   - StepExecutor
   - ParameterResolver
   - ConditionEvaluator

## 3. Refinement Execution Algorithm
   - High-level flow (pseudocode)
   - Step-by-step execution
   - State management
   - Error handling

## 4. Integration with Existing Systems
   - GOAP planner integration
   - Action executor integration
   - Event bus integration
   - Scope DSL integration
   - json-logic integration

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
- [ ] Create component diagram (RefinementEngine, MethodSelector, StepExecutor, etc.)
- [ ] Describe data flow from task selection to primitive execution
- [ ] Map components to existing codebase structure
- [ ] Document dependencies between components
- [ ] Specify component responsibilities (single responsibility principle)
- [ ] Reference existing architectural patterns in codebase

### 2. Design RefinementEngine Component
- [ ] Define RefinementEngine class interface
- [ ] Specify constructor dependencies (logger, eventBus, methodRegistry, etc.)
- [ ] Document `refine(task, context)` method signature
- [ ] Specify return value (sequence of primitives or failure)
- [ ] Document error handling and event dispatching
- [ ] Provide implementation skeleton code
- [ ] Reference similar components (e.g., action executor)

### 3. Design MethodSelector Component
- [ ] Define MethodSelector class interface
- [ ] Specify `selectMethod(task, methods, context)` signature
- [ ] Document applicability condition evaluation
- [ ] Specify fallback behavior when no method matches
- [ ] Document method priority/ordering
- [ ] Provide implementation skeleton code

### 4. Design StepExecutor Component
- [ ] Define StepExecutor class interface
- [ ] Specify `executeStep(step, context)` signature
- [ ] Document step type dispatching (primitive_action, conditional, etc.)
- [ ] Specify state accumulation mechanism
- [ ] Document failure propagation
- [ ] Provide implementation skeleton code

### 5. Design ParameterResolver Component
- [ ] Define ParameterResolver class interface
- [ ] Specify `resolve(expression, context)` signature
- [ ] Document json-logic expression evaluation
- [ ] Specify variable scope management
- [ ] Document performance optimization (caching)
- [ ] Provide implementation skeleton code

### 6. Design ConditionEvaluator Component
- [ ] Define ConditionEvaluator class interface
- [ ] Specify `evaluate(condition, context)` signature
- [ ] Document json-logic integration
- [ ] Specify custom operators (if needed)
- [ ] Document error handling for undefined variables
- [ ] Provide implementation skeleton code

### 7. Document Refinement Execution Algorithm
- [ ] Write high-level algorithm pseudocode
- [ ] Document method selection process
- [ ] Specify step execution loop
- [ ] Document state accumulation
- [ ] Specify failure detection and handling
- [ ] Show execution flow diagram
- [ ] Provide annotated code example

### 8. Document Integration with GOAP Planner
- [ ] Specify where refinement is triggered in planning flow
- [ ] Document task-to-method lookup mechanism
- [ ] Specify parameter passing from planner to refinement
- [ ] Document failure feedback to planner (replanning trigger)
- [ ] Show integration sequence diagram
- [ ] Reference `goapDecisionProvider.js` integration points

### 9. Document Integration with Action Executor
- [ ] Specify how primitives are queued for execution
- [ ] Document action parameter binding
- [ ] Specify target resolution from refinement context
- [ ] Document execution feedback to refinement engine
- [ ] Show integration sequence diagram
- [ ] Reference existing action executor code

### 10. Document Integration with Event Bus
- [ ] List all events dispatched by refinement engine:
  - REFINEMENT_STARTED
  - REFINEMENT_METHOD_SELECTED
  - REFINEMENT_STEP_EXECUTED
  - REFINEMENT_COMPLETED
  - REFINEMENT_FAILED
- [ ] Specify event payload structure
- [ ] Document event listeners (for debugging, logging)
- [ ] Reference existing event bus patterns

### 11. Define Implementation Order
- [ ] Phase 1: Core infrastructure (loaders, registry, basic components)
- [ ] Phase 2: Basic execution (simple sequential methods)
- [ ] Phase 3: Conditionals and state (branching, storeResultAs)
- [ ] Phase 4: Failure handling (replanning, fallback)
- [ ] Phase 5: Optimization (caching, performance)
- [ ] Document dependencies between phases
- [ ] Provide milestone checklist

### 12. Create Testing Strategy
- [ ] Unit test guidelines (mock dependencies, test components in isolation)
- [ ] Integration test guidelines (test component interactions)
- [ ] E2E test guidelines (test complete refinement flow)
- [ ] Performance test guidelines (method selection, execution speed)
- [ ] Provide test case examples for each level
- [ ] Reference existing test patterns (`tests/common/`)

### 13. Write Debugging Section
- [ ] List common implementation issues:
  - Method not found
  - Condition evaluation failure
  - Parameter resolution failure
  - Infinite loops in conditionals
- [ ] Provide debugging strategies for each issue
- [ ] Document logging best practices
- [ ] Specify debug events to dispatch
- [ ] Provide troubleshooting flowchart

### 14. Create Code Examples
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
