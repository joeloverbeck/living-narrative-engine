# MULTARRESSTAREF-000: Multi-Target Resolution Stage Refactoring - Overview

**Status:** Not Started
**Priority:** Critical
**Total Estimated Effort:** 4 weeks
**Reference:** See `reports/multi-target-resolution-stage-refactoring-analysis.md` for complete context and analysis

## Executive Summary

The `MultiTargetResolutionStage` has grown to 1,220 lines (2.4x the 500-line target) due to **tracing integration bloat**. This refactoring extracts tracing (~200 lines), result assembly (~80 lines), and coordination logic (~150 lines) into specialized services, reducing the stage to ~250-300 lines while improving maintainability and testability.

**Primary Issue:** A lightweight orchestrator has become bloated with extensive tracing instrumentation, diagnostic logging, and cross-cutting concerns that obscure the core target resolution logic.

**Approach:** Incremental service extraction with validation at each step, maintaining backward compatibility throughout.

## Success Metrics

**Quantitative:**

- Stage reduced from 1,220 → 250-300 lines (75-80% reduction)
- All methods under 100 lines
- Maintain 80%+ test coverage
- No performance regression (within 5%)

**Qualitative:**

- Clear separation of concerns
- Each class has single responsibility
- Easy to understand and modify
- Backward compatibility maintained

## Refactoring Phases

### Phase 1: Tracing Extraction (Week 1)

**Goal:** Remove ~200 lines of tracing logic

**Tickets:**

- MULTARRESSTAREF-001: Create Tracing Orchestrator Interface (0.5 days)
- MULTARRESSTAREF-002: Implement Tracing Orchestrator (1.5 days)
- MULTARRESSTAREF-003: Create Tracing Orchestrator Tests (1 day)
- MULTARRESSTAREF-004: Register Tracing Orchestrator in DI (0.5 days)
- MULTARRESSTAREF-005: Integrate Tracing Orchestrator into Stage (2 days)

**Outcome:** Stage reduced to ~1,020 lines, tracing centralized

### Phase 2: Result Assembly Extraction (Week 1-2)

**Goal:** Remove ~80 lines of duplicated result assembly

**Tickets:**

- MULTARRESSTAREF-006: Create Result Builder Interface (0.5 days)
- MULTARRESSTAREF-007: Implement Result Builder (1.5 days)
- MULTARRESSTAREF-008: Create Result Builder Tests (1 day)
- MULTARRESSTAREF-009: Register Result Builder in DI (0.5 days)
- MULTARRESSTAREF-010: Integrate Result Builder into Stage (1.5 days)

**Outcome:** Stage reduced to ~940 lines, result assembly centralized

### Phase 3: Resolution Coordination Extraction (Week 3)

**Goal:** Remove ~150 lines of coordination logic

**Tickets:**

- MULTARRESSTAREF-011: Create Resolution Coordinator Interface (0.5 days)
- MULTARRESSTAREF-012: Implement Resolution Coordinator (2 days)
- MULTARRESSTAREF-013: Create Resolution Coordinator Tests (1.5 days)
- MULTARRESSTAREF-014: Register Resolution Coordinator in DI (0.5 days)

**Outcome:** Service created, ready for integration

### Phase 4: Final Stage Simplification (Week 3-4)

**Goal:** Reduce stage to <300 lines of pure orchestration

**Tickets:**

- MULTARRESSTAREF-015: Integrate Coordinator & Simplify Stage (2.5 days)

**Outcome:** Stage reduced to 150-200 lines, clear orchestration flow

### Phase 5: Cleanup and Documentation (Week 4)

**Goal:** Remove temporary code and document new architecture

**Tickets:**

- MULTARRESSTAREF-016: Remove Diagnostic Logging (0.5 days)
- MULTARRESSTAREF-017: Update Documentation & Create Diagrams (1.5 days)

**Outcome:** Clean code, comprehensive documentation

## Architecture Transformation

### Before (1,220 lines)

```
MultiTargetResolutionStage
├── Orchestration (288 lines)
├── Tracing Logic (200 lines) ← EXTRACT
├── Result Assembly (80 lines) ← EXTRACT
├── Resolution Coordination (150 lines) ← EXTRACT
├── Diagnostic Logging (30 lines) ← REMOVE
└── Helper Methods (472 lines)
```

### After (150-200 lines)

```
MultiTargetResolutionStage (~150-200 lines)
├── Pure orchestration
└── Service delegation

TargetResolutionTracingOrchestrator (~200 lines)
└── All tracing concerns

TargetResolutionResultBuilder (~150 lines)
└── All result assembly

TargetResolutionCoordinator (~180 lines)
└── Resolution coordination
```

## Ticket Dependencies

```
Phase 1 (Tracing):
001 → 002 → 003 → 004 → 005

Phase 2 (Results):
006 → 007 → 008 → 009 → 010
(Can run parallel with Phase 1)

Phase 3 (Coordination):
011 → 012 → 013 → 014
(Can run parallel with Phases 1-2)

Phase 4 (Integration):
015 depends on: 005, 010, 014

Phase 5 (Cleanup):
016, 017 depend on: 015
```

## Risk Assessment

**High Risk:**

- Tracing integration (action-aware traces must work)
- Backward compatibility (downstream stages must work)
- Legacy action handling (must preserve compatibility)

**Mitigation:**

- Incremental extraction with validation
- Comprehensive regression testing
- Maintain exact result structure
- Test with real ActionAwareStructuredTrace

**Low Risk:**

- DI container registration (established pattern)
- Diagnostic logging removal (temporary code)

## Testing Strategy

**Per-Ticket Testing:**

- Unit tests for each service (90%+ coverage)
- Integration tests for service interactions
- Regression tests after each integration

**Final Validation:**

- All existing unit tests pass
- All existing integration tests pass
- All e2e tests pass
- Performance within 5% of baseline
- Tracing works end-to-end
- All downstream stages work

## Rollback Plan

Each phase is independently reversible:

- **Phase 1-3:** Revert stage changes, keep services
- **Phase 4:** Revert stage simplification
- **Phase 5:** Revert documentation changes

Services can exist without being used, allowing safe rollback at any point.

## Success Criteria

- [ ] Stage <300 lines (target: 150-200)
- [ ] All individual methods <100 lines
- [ ] 80%+ test coverage maintained
- [ ] No performance regression
- [ ] All tests pass
- [ ] Backward compatibility maintained
- [ ] Clear separation of concerns
- [ ] Documentation complete

## Timeline

- **Week 1:** Phases 1-2 (Tracing + Results)
- **Week 2:** Phase 2 completion + Phase 3 start
- **Week 3:** Phase 3 completion + Phase 4
- **Week 4:** Phase 5 (Cleanup + Documentation)

**Contingency:** +1 week for unexpected issues

## Next Steps

1. Review this overview and detailed tickets
2. Approve refactoring plan and timeline
3. Start with MULTARRESSTAREF-001 (Tracing Interface)
4. Execute tickets sequentially within each phase
5. Validate at each integration point
6. Monitor metrics throughout

---

**See individual tickets for detailed implementation instructions:**

- MULTARRESSTAREF-001 through MULTARRESSTAREF-017
- Each ticket is self-contained with clear acceptance criteria
- All tickets reference the analysis report for context
