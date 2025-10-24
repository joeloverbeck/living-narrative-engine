# LEGSTRREF-000: Master Coordination - LegacyStrategy Refactoring

## Metadata
- **Ticket ID**: LEGSTRREF-000
- **Type**: Coordination/Tracking
- **Priority**: Critical
- **Total Effort**: 4 weeks (20 working days)
- **Status**: Not Started
- **Phase**: Master Coordination

## Executive Summary

This master ticket coordinates the complete refactoring of `LegacyStrategy.js` to address critical technical debt including ~80% code duplication, high cyclomatic complexity (18), and poor maintainability. The refactoring follows a 4-phase approach over 4 weeks with 12 implementation tickets.

### Current State
- **File**: `src/actions/pipeline/stages/actionFormatting/legacy/LegacyStrategy.js`
- **Lines of Code**: 745
- **Technical Debt Score**: 7.5/10 (High)
- **Maintainability Index**: 42/100 (Low)
- **Code Duplication**: ~80% between `#formatTraced` and `#formatStandard`
- **Cyclomatic Complexity**: 18 (recommended max: 10)
- **Constructor Dependencies**: 9 (recommended max: 7)

### Target State
- **Lines of Code**: 550-600 (20% reduction)
- **Code Duplication**: 0%
- **Cyclomatic Complexity**: 6-8 (56% reduction)
- **Constructor Dependencies**: 6-7 (22% reduction)
- **Test Coverage**: 95%+ (10% increase)
- **Cognitive Complexity**: 12-15 (57% reduction)

## Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal**: Establish refactoring foundation without breaking changes

| Ticket | Task | Effort | Dependencies |
|--------|------|--------|--------------|
| LEGSTRREF-001 | Create Statistics Abstraction | 0.5 days | None |
| LEGSTRREF-002 | Create Error Handler | 0.5-1 day | None |
| LEGSTRREF-003 | Extract Static Utilities | 0.5 days | None |

**Deliverable**: New utility classes with comprehensive tests, no changes to LegacyStrategy yet.

### Phase 2: Method Extraction (Week 2)
**Goal**: Break down large methods into focused units

| Ticket | Task | Effort | Dependencies |
|--------|------|--------|--------------|
| LEGSTRREF-004 | Extract Single-Target Formatting | 1 day | LEGSTRREF-001, 002, 003 |
| LEGSTRREF-005 | Extract Multi-Target Formatting | 1-2 days | LEGSTRREF-001, 002, 003 |
| LEGSTRREF-006 | Extract Command Processing | 0.5 days | LEGSTRREF-004, 005 |

**Deliverable**: Extracted methods with comprehensive test coverage, LegacyStrategy still has duplication.

### Phase 3: Duplication Elimination (Week 3)
**Goal**: Unify duplicated logic into single source of truth

| Ticket | Task | Effort | Dependencies |
|--------|------|--------|--------------|
| LEGSTRREF-007 | Create Trace Adapter | 0.5-1 day | LEGSTRREF-004, 005, 006 |
| LEGSTRREF-008 | Implement Unified Formatting | 1-2 days | LEGSTRREF-007 |
| LEGSTRREF-009 | Remove Deprecated Methods | 0.5 days | LEGSTRREF-008 |

**Deliverable**: Single unified formatting method, zero duplication, all tests passing.

### Phase 4: Dependency Optimization (Week 4)
**Goal**: Reduce coupling and improve testability

| Ticket | Task | Effort | Dependencies |
|--------|------|--------|--------------|
| LEGSTRREF-010 | Optimize Constructor Dependencies | 1 day | LEGSTRREF-009 |
| LEGSTRREF-011 | Integration Testing & Validation | 1-2 days | LEGSTRREF-010 |
| LEGSTRREF-012 | Documentation & Cleanup | 0.5-1 day | LEGSTRREF-011 |

**Deliverable**: Optimized LegacyStrategy with reduced dependencies, full test coverage, updated documentation.

## Success Metrics

### Code Quality Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Lines of Code | 745 | 550-600 | 20% reduction |
| Cyclomatic Complexity | 18 | 6-8 | 56% reduction |
| Code Duplication | 80% (400 lines) | 0% | 100% elimination |
| Method Size (max) | 247 lines | 40-50 lines | 80% reduction |
| Constructor Dependencies | 9 | 6-7 | 22-33% reduction |
| Test Coverage | ~85% | 95%+ | 10+ point increase |
| Cognitive Complexity | 35 | 12-15 | 57-66% reduction |

### Business Value Metrics

**Maintainability**:
- ✅ 60% reduction in code duplication
- ✅ 50% reduction in method complexity
- ✅ 80% reduction in nesting depth
- ✅ 30% faster code comprehension (estimated)

**Robustness**:
- ✅ Single source of truth for formatting logic
- ✅ Consistent error handling across all paths
- ✅ Better test coverage in critical paths
- ✅ Easier to validate behavioral correctness

**Extensibility**:
- ✅ New trace types can be added via adapter pattern
- ✅ New formatting strategies can be added without modifying core
- ✅ Statistics tracking can be extended without touching business logic
- ✅ Error handling can be customized via strategy

## Risk Management

### High Risk Areas

1. **Behavioral Changes**
   - **Risk**: Subtle changes in formatting behavior
   - **Mitigation**: Comprehensive test suite, behavior snapshots, code review
   - **Probability**: Low-Medium
   - **Impact**: High

2. **Test Coverage Gaps**
   - **Risk**: Untested edge cases revealed during refactoring
   - **Mitigation**: Increase test coverage before refactoring
   - **Probability**: Medium
   - **Impact**: Medium

3. **Integration Breakage**
   - **Risk**: Breaking dependent components
   - **Mitigation**: Integration tests, staged rollout
   - **Probability**: Low
   - **Impact**: High

### Mitigation Strategies

- **Phase Gating**: Complete each phase fully before proceeding
- **Continuous Testing**: Run full test suite after each ticket
- **Code Reviews**: Review all changes at phase boundaries
- **Backward Compatibility**: Maintain existing behavior throughout
- **Rollback Plan**: Git commits allow easy rollback per phase

## Quality Gates

### Phase 1 Exit Criteria
- ✅ All utility classes implemented with >95% test coverage
- ✅ No changes to LegacyStrategy.js yet
- ✅ All existing tests still pass
- ✅ Documentation complete for new classes

### Phase 2 Exit Criteria
- ✅ All methods extracted with >90% test coverage
- ✅ Cyclomatic complexity reduced to <12 per method
- ✅ All existing tests still pass
- ✅ No behavioral changes verified

### Phase 3 Exit Criteria
- ✅ Code duplication eliminated completely
- ✅ Single unified formatting method
- ✅ All tests pass with >95% coverage
- ✅ No performance regression (benchmarked)

### Phase 4 Exit Criteria
- ✅ Constructor dependencies reduced to 6-7
- ✅ Integration tests pass
- ✅ Documentation updated
- ✅ Code review approved

## Validation Process

### Pre-Refactoring Baseline
1. Capture current test results
2. Document expected behavior
3. Create behavior snapshots
4. Run performance benchmarks

### Post-Refactoring Verification
1. All existing tests pass
2. No performance degradation
3. Same output for same inputs
4. Error handling unchanged
5. Integration tests pass

### Continuous Validation
- Run tests after each ticket completion
- Verify no behavioral changes
- Check code coverage metrics
- Review error handling paths

## Timeline & Milestones

### Week 1 (Days 1-5)
- **Day 1**: LEGSTRREF-001 (StatisticsCollector)
- **Day 2**: LEGSTRREF-002 (ErrorHandler)
- **Day 3**: LEGSTRREF-003 (Static Utilities)
- **Days 4-5**: Phase 1 testing and documentation

### Week 2 (Days 6-10)
- **Day 6**: LEGSTRREF-004 (Single-Target Extraction)
- **Days 7-8**: LEGSTRREF-005 (Multi-Target Extraction)
- **Day 9**: LEGSTRREF-006 (Command Processing)
- **Day 10**: Phase 2 testing and review

### Week 3 (Days 11-15)
- **Days 11-12**: LEGSTRREF-007 (Trace Adapter)
- **Days 13-14**: LEGSTRREF-008 (Unified Formatting)
- **Day 15**: LEGSTRREF-009 (Remove Deprecated)

### Week 4 (Days 16-20)
- **Day 16**: LEGSTRREF-010 (Constructor Optimization)
- **Days 17-18**: LEGSTRREF-011 (Integration Testing)
- **Days 19-20**: LEGSTRREF-012 (Documentation & Cleanup)

## Dependencies

### External Dependencies
- None - this is internal refactoring

### Related Files
- `LegacyFallbackFormatter.js` - May need updates
- `TargetNormalizationService.js` - Interface changes may propagate
- `ActionFormattingStage.js` - Integration tests needed
- All test files - Review and updates required

### Critical Dependencies
- `PipelineResult.js` - Used for return values
- `IActionCommandFormatter` - Primary formatting interface
- `EntityManager` - Entity resolution
- Various trace implementations - Polymorphic behavior

## Communication Plan

### Stakeholder Updates
- **Daily**: Update ticket status in tracking system
- **Weekly**: Phase completion reports
- **Ad-hoc**: Blocker notifications

### Documentation Updates
- Phase completion: Update architecture docs
- Ticket completion: Update inline documentation
- Final: Complete README and contribution guide updates

## Next Steps

1. ✅ Review this master coordination ticket
2. ⏳ Set up project tracking board
3. ⏳ Assign developers to phases
4. ⏳ Schedule phase boundary code reviews
5. ⏳ Begin Phase 1 with LEGSTRREF-001

## Related Documents
- Source Analysis: `reports/legacy-strategy-refactoring-analysis.md`
- Implementation Tickets: `workflows/LEGSTRREF-001` through `LEGSTRREF-012`

## Notes
- This refactoring follows the "Gradual Refactoring" approach (Option 2)
- Each phase maintains working state and can be stopped if needed
- All changes maintain backward compatibility
- Full test suite validation required between phases
