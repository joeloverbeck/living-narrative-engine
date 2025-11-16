# GOAPIMPL-025 Implementation Order Guide

**Parent Ticket**: GOAPIMPL-025 (GOAP Debugging Tools)
**Total Sub-Tickets**: 7
**Total Estimated Effort**: 8.5 hours

## Overview

This document outlines the implementation order for GOAPIMPL-025 sub-tickets. The tickets are organized into three phases: Prerequisites, Core Tools, and Integration.

## Implementation Phases

### Phase 1: Prerequisites (2.5 hours)

These tickets add required infrastructure for debug tools:

#### GOAPIMPL-025-01: GoapController Debug API
**Effort**: 1 hour | **Priority**: HIGH | **Dependencies**: None

**Purpose**: Add read-only debug API methods to GoapController for plan inspection.

**Deliverables**:
- `getActivePlan(actorId)` method
- `getFailedGoals(actorId)` method
- `getFailedTasks(actorId)` method
- `getCurrentTask(actorId)` method
- Unit tests for all methods

**Blocks**: GOAPIMPL-025-03 (Plan Inspector)

---

#### GOAPIMPL-025-02: Refinement Step Events
**Effort**: 1.5 hours | **Priority**: HIGH | **Dependencies**: None

**Purpose**: Add step-level events to GOAP event system for refinement tracing.

**Deliverables**:
- 4 new event types in `goapEvents.js`
- Event dispatching in `RefinementEngine`
- Event dispatching in `RefinementStateManager`
- Unit and integration tests

**Blocks**: GOAPIMPL-025-05 (Refinement Tracer)

---

### Phase 2: Core Tools (4 hours)

These tickets implement the actual debug tools:

#### GOAPIMPL-025-03: Plan Inspector
**Effort**: 1 hour | **Priority**: MEDIUM | **Dependencies**: GOAPIMPL-025-01

**Purpose**: Create tool for displaying active GOAP plans in human-readable format.

**Deliverables**:
- `PlanInspector` class
- Text and JSON output modes
- Entity ID resolution
- Unit tests

**File**: `src/goap/debug/planInspector.js`

---

#### GOAPIMPL-025-04: State Diff Viewer
**Effort**: 1.5 hours | **Priority**: MEDIUM | **Dependencies**: None

**Purpose**: Create tool for visualizing planning state changes.

**Deliverables**:
- `StateDiffViewer` class
- Diff calculation (added/modified/removed)
- Text and JSON output modes
- Unit and integration tests

**File**: `src/goap/debug/stateDiffViewer.js`

**Note**: Works with planning state hashes, NOT ECS components.

---

#### GOAPIMPL-025-05: Refinement Tracer
**Effort**: 1.5 hours | **Priority**: MEDIUM | **Dependencies**: GOAPIMPL-025-02

**Purpose**: Create tool for capturing step-by-step refinement execution.

**Deliverables**:
- `RefinementTracer` class
- Event capture for specific actors
- Start/stop trace functionality
- Text formatting
- Unit and integration tests

**File**: `src/goap/debug/refinementTracer.js`

---

### Phase 3: Integration (2 hours)

These tickets integrate everything and provide documentation:

#### GOAPIMPL-025-06: GOAP Debugger Main API
**Effort**: 1 hour | **Priority**: MEDIUM | **Dependencies**: GOAPIMPL-025-01, 03, 04, 05

**Purpose**: Create unified debug API coordinating all tools.

**Deliverables**:
- `GOAPDebugger` class
- Combined reporting functionality
- DI token registration
- DI service registration
- Unit and integration tests

**Files**:
- `src/goap/debug/goapDebugger.js`
- `src/dependencyInjection/tokens/tokens-core.js` (add token)
- `src/dependencyInjection/registrations/goapRegistrations.js` (register)

---

#### GOAPIMPL-025-07: Documentation
**Effort**: 1 hour | **Priority**: LOW | **Dependencies**: All other tickets

**Purpose**: Create comprehensive documentation for debug tools.

**Deliverables**:
- Usage guide with examples
- API reference
- Troubleshooting section
- Test integration patterns

**File**: `docs/goap/debugging-tools.md`

---

## Dependency Graph

```
Phase 1: Prerequisites
├─ GOAPIMPL-025-01 (GoapController Debug API)
└─ GOAPIMPL-025-02 (Refinement Step Events)

Phase 2: Core Tools
├─ GOAPIMPL-025-03 (Plan Inspector) ← depends on 01
├─ GOAPIMPL-025-04 (State Diff Viewer) ← no dependencies
└─ GOAPIMPL-025-05 (Refinement Tracer) ← depends on 02

Phase 3: Integration
├─ GOAPIMPL-025-06 (GOAP Debugger API) ← depends on 01, 03, 04, 05
└─ GOAPIMPL-025-07 (Documentation) ← depends on all
```

## Recommended Implementation Order

1. **GOAPIMPL-025-01** (GoapController Debug API) - 1 hour
2. **GOAPIMPL-025-02** (Refinement Step Events) - 1.5 hours
3. **Parallel Implementation** (can be done simultaneously):
   - **GOAPIMPL-025-03** (Plan Inspector) - 1 hour
   - **GOAPIMPL-025-04** (State Diff Viewer) - 1.5 hours
   - **GOAPIMPL-025-05** (Refinement Tracer) - 1.5 hours
4. **GOAPIMPL-025-06** (GOAP Debugger API) - 1 hour
5. **GOAPIMPL-025-07** (Documentation) - 1 hour

**Total Time**: 8.5 hours (can be reduced to ~6 hours with parallel work)

## Critical Path

The critical path (minimum time with parallelization):

```
Start → 01 (1h) → 03 (1h) → 06 (1h) → 07 (1h) = 4 hours
        02 (1.5h) → 05 (1.5h) ─┘
        04 (1.5h) ─────────────┘
```

**Minimum Total Time**: 4 hours (with perfect parallelization)
**Realistic Time**: 6-7 hours (accounting for context switching)

## Quality Gates

Each ticket should pass before moving to next:

### Unit Tests
- ✅ All unit tests pass
- ✅ Coverage > 80%
- ✅ No TypeScript errors
- ✅ No ESLint errors

### Integration Tests
- ✅ Integration tests pass (where applicable)
- ✅ Event flow validated (for event-based tools)

### Manual Validation
- ✅ Console testing confirms functionality
- ✅ Output matches expected format
- ✅ Performance acceptable (< 1% overhead)

## Files Summary

### New Files (11 total)

**Debug Tools** (4):
- `src/goap/debug/planInspector.js`
- `src/goap/debug/stateDiffViewer.js`
- `src/goap/debug/refinementTracer.js`
- `src/goap/debug/goapDebugger.js`

**Unit Tests** (4):
- `tests/unit/goap/debug/planInspector.test.js`
- `tests/unit/goap/debug/stateDiffViewer.test.js`
- `tests/unit/goap/debug/refinementTracer.test.js`
- `tests/unit/goap/debug/goapDebugger.test.js`

**Integration Tests** (2):
- `tests/integration/goap/debug/stateDiffViewerIntegration.test.js`
- `tests/integration/goap/debug/refinementTracerIntegration.test.js`
- `tests/integration/goap/debug/goapDebuggerIntegration.test.js`

**Documentation** (1):
- `docs/goap/debugging-tools.md`

### Modified Files (5 total)

**GOAP System**:
- `src/goap/controllers/goapController.js` (add debug API)
- `src/goap/events/goapEvents.js` (add step events)
- `src/goap/refinement/refinementEngine.js` (dispatch step events)

**DI System**:
- `src/dependencyInjection/tokens/tokens-core.js` (add tokens)
- `src/dependencyInjection/registrations/goapRegistrations.js` (register services)

**Documentation**:
- `docs/goap/IMPLEMENTATION-STATUS.md` (update status)

### Modified Tests (1 total)

**Controller Tests**:
- `tests/unit/goap/controllers/goapController.DebugAPI.test.js` (new test file)

## Key Design Decisions

### Event-Driven Architecture
- Debug tools consume existing GOAP events
- No direct coupling to GOAP internals
- Tools can be enabled/disabled at runtime

### Read-Only Design
- All debug APIs return deep copies
- No modification of internal GOAP state
- Safe for concurrent access

### Planning State vs ECS
- State diff works with **planning state hashes** (symbolic)
- NOT with ECS components (execution-time)
- Clear separation documented

### Opt-In Performance
- Debug tools disabled by default
- No overhead when not in use
- < 1% overhead when active

## Common Issues & Solutions

### Issue: "No active plan"
**Solution**: Check goal selection and failure history first.

### Issue: Empty refinement trace
**Solution**: Start trace BEFORE executing turn, not after.

### Issue: State diff unexpected
**Solution**: Verify task planning effects and parameter substitution.

## References

- **Parent Ticket**: `tickets/GOAPIMPL-025-goap-debugging-tools.md`
- **Validation Report**: `claudedocs/workflow-validation-GOAPIMPL-025.md`
- **Validation Summary**: `claudedocs/workflow-validation-summary-GOAPIMPL-025.md`
- **GOAP Spec**: `specs/goap-system-specs.md` lines 507-516

## Completion Checklist

- [ ] Phase 1: Prerequisites complete (2.5 hours)
  - [ ] GOAPIMPL-025-01: GoapController Debug API
  - [ ] GOAPIMPL-025-02: Refinement Step Events
  
- [ ] Phase 2: Core Tools complete (4 hours)
  - [ ] GOAPIMPL-025-03: Plan Inspector
  - [ ] GOAPIMPL-025-04: State Diff Viewer
  - [ ] GOAPIMPL-025-05: Refinement Tracer
  
- [ ] Phase 3: Integration complete (2 hours)
  - [ ] GOAPIMPL-025-06: GOAP Debugger API
  - [ ] GOAPIMPL-025-07: Documentation

- [ ] Final Validation
  - [ ] All tests passing
  - [ ] Manual testing complete
  - [ ] Documentation accurate
  - [ ] No performance regression
  - [ ] Parent ticket GOAPIMPL-025 can be closed

---

**Next Steps**: Begin with GOAPIMPL-025-01 (GoapController Debug API)
