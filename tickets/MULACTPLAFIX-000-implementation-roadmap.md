# MULACTPLAFIX-000: Multi-Action Planning Fix - Implementation Roadmap

**Status**: Planning Complete
**Priority**: CRITICAL (BLOCKER)
**Type**: Epic/Meta-Ticket
**Created**: 2025-01-16
**Specification**: `specs/multi-action-planning-fix.md`

## Executive Summary

This epic addresses the critical blocker where GOAP planner fails to create plans requiring multiple applications of the same task to reach numeric goals. Currently **7/16 integration tests pass** (all single-action scenarios), while **9/16 fail** (all multi-action scenarios).

**Root Cause**: A* search applies each task only once per state, not allowing task reuse for multi-step progress toward numeric goals.

**Solution**: Implement task reusability algorithm that allows same task to be applied multiple times when it continues reducing distance to goal.

## Ticket Breakdown

### Phase 1: Core Functionality (CRITICAL)

#### MULACTPLAFIX-001: Task Reuse Algorithm ⚡ BLOCKER
**Priority**: CRITICAL
**Effort**: 8 hours
**Dependencies**: None
**Impact**: Unblocks all 9 failing tests

**Deliverables**:
- `#isTaskReusable()` method in `GoapPlanner`
- Distance reduction check
- Reuse limit enforcement (default: 10)
- Modified successor generation loop

**Success Criteria**: 16/16 integration tests passing (currently 7/16)

**Files Modified**:
- `src/goap/planner/goapPlanner.js` (main implementation)

**Tests Required**:
- Unit tests: `tests/unit/goap/planner/goapPlanner.taskReuse.test.js`
- Integration: Verify all 16 tests in `numericGoalPlanning.integration.test.js` pass

---

### Phase 2: Optimization (HIGH Priority)

#### MULACTPLAFIX-002: Enhanced Heuristic
**Priority**: HIGH
**Effort**: 6 hours
**Dependencies**: MULACTPLAFIX-001 (can be done in parallel after 001 complete)
**Impact**: 20-30% reduction in nodes expanded

**Deliverables**:
- Enhanced `calculate()` method in `GoalDistanceHeuristic`
- `#findBestTaskForGoal()` helper
- `#estimateTaskEffect()` helper
- Action count estimation

**Success Criteria**: Improved planning efficiency, no correctness regression

**Files Modified**:
- `src/goap/planner/goalDistanceHeuristic.js`
- `src/goap/planner/goapPlanner.js` (heuristic call sites)

**Tests Required**:
- Unit tests: `tests/unit/goap/planner/goalDistanceHeuristic.enhanced.test.js`
- Performance benchmarks

---

#### MULACTPLAFIX-003: Stopping Criteria
**Priority**: MEDIUM
**Effort**: 4 hours
**Dependencies**: MULACTPLAFIX-001
**Impact**: Prevents runaway planning, better error messages

**Deliverables**:
- Cost limit check in A* loop
- Action count limit check
- Pre-planning feasibility check
- Enhanced failure event payloads

**Success Criteria**: Planning terminates gracefully within limits

**Files Modified**:
- `src/goap/planner/goapPlanner.js` (A* loop modifications)

**Tests Required**:
- Unit tests: `tests/unit/goap/planner/goapPlanner.stoppingCriteria.test.js`
- Integration tests: `tests/integration/goap/planningFailures.integration.test.js`

---

### Phase 3: Robustness (MEDIUM Priority)

#### MULACTPLAFIX-004: Edge Case Handling
**Priority**: MEDIUM
**Effort**: 5 hours
**Dependencies**: MULACTPLAFIX-001
**Impact**: Diagnostic visibility, robustness

**Deliverables**:
- `goalTypeDetector.js` utility module
- Overshoot detection and logging
- Equality vs inequality goal handling
- Enhanced error messages

**Success Criteria**: All edge cases handled gracefully with clear diagnostics

**Files Created**:
- `src/goap/planner/goalTypeDetector.js`

**Files Modified**:
- `src/goap/planner/goapPlanner.js` (logging enhancements)

**Tests Required**:
- Unit tests: `tests/unit/goap/planner/goalTypeDetector.test.js`
- Integration tests: `tests/integration/goap/edgeCases.integration.test.js`

---

### Phase 4: Testing & Validation (HIGH Priority)

#### MULACTPLAFIX-005: Comprehensive Test Suite
**Priority**: HIGH
**Effort**: 8 hours
**Dependencies**: MULACTPLAFIX-001, MULACTPLAFIX-002, MULACTPLAFIX-003, MULACTPLAFIX-004
**Impact**: Regression protection, confidence in implementation

**Deliverables**:
- 7 core multi-action tests
- 5 edge case tests
- 4 backward compatibility tests
- 3 performance tests
- **Total: 19 new tests + verification of 16 existing**

**Success Criteria**: 35/35 tests passing, 80%+ coverage

**Test Files Created**:
- `tests/integration/goap/multiActionCore.integration.test.js`
- `tests/integration/goap/edgeCases.integration.test.js`
- `tests/integration/goap/backwardCompatibility.integration.test.js`
- `tests/performance/goap/multiActionPlanning.performance.test.js`
- `tests/memory/goap/multiActionPlanning.memory.test.js`

---

### Phase 5: Documentation (MEDIUM Priority)

#### MULACTPLAFIX-006: Documentation & Debugging
**Priority**: MEDIUM
**Effort**: 6 hours
**Dependencies**: MULACTPLAFIX-001, MULACTPLAFIX-002, MULACTPLAFIX-003, MULACTPLAFIX-004, MULACTPLAFIX-005
**Impact**: Developer experience, maintainability

**Deliverables**:
- Multi-action planning guide
- Debugging workflows
- JSDoc enhancements
- Updated GOAP documentation index

**Success Criteria**: New developers can understand and debug multi-action planning

**Files Created**:
- `docs/goap/multi-action-planning.md`
- `docs/goap/debugging-multi-action.md`

**Files Updated**:
- `docs/goap/debugging-tools.md`
- `docs/goap/README.md`
- JSDoc in all modified source files

---

## Implementation Order (Recommended)

### Sprint 1: Core Fix (1-2 days)
1. **MULACTPLAFIX-001** (Task Reuse Algorithm) - CRITICAL
   - Implement core algorithm
   - Verify 16/16 tests pass
   - Code review and refinement

### Sprint 2: Optimization (1-2 days)
2. **MULACTPLAFIX-002** (Enhanced Heuristic) - HIGH
   - Improve search efficiency
   - Performance benchmarks
3. **MULACTPLAFIX-003** (Stopping Criteria) - MEDIUM
   - Add safety limits
   - Better error handling

### Sprint 3: Robustness & Testing (2-3 days)
4. **MULACTPLAFIX-004** (Edge Case Handling) - MEDIUM
   - Goal type detection
   - Diagnostic enhancements
5. **MULACTPLAFIX-005** (Comprehensive Tests) - HIGH
   - Full test coverage
   - Performance validation
   - Regression protection

### Sprint 4: Documentation (1 day)
6. **MULACTPLAFIX-006** (Documentation) - MEDIUM
   - Usage guides
   - Debugging workflows
   - API documentation

**Total Estimated Time**: 5-8 days (37 hours of implementation)

---

## Parallel Work Opportunities

After **MULACTPLAFIX-001** is complete:
- **002**, **003**, and **004** can be done in parallel (independent)
- **005** requires all core work complete
- **006** can start once implementation stabilizes

**Critical Path**: 001 → 002/003/004 → 005 → 006

---

## Success Metrics

### Functional
- [ ] **Test Pass Rate**: 16/16 integration tests (100%, currently 7/16)
- [ ] **New Tests**: 35/35 tests passing (19 new + 16 existing)
- [ ] **Backward Compatibility**: All 7 existing passing tests remain green

### Performance
- [ ] **Planning Time**: < 100ms for 10-action plans
- [ ] **Node Expansion**: 20-30% reduction with enhanced heuristic
- [ ] **Memory Usage**: No leaks, < 5MB growth for 100 plans

### Quality
- [ ] **Code Coverage**: 80%+ for modified files
- [ ] **ESLint**: Zero violations
- [ ] **Documentation**: Complete usage and debugging guides

---

## Risk Assessment

### High Risk Areas
1. **Task Reuse Algorithm** (MULACTPLAFIX-001)
   - **Risk**: Breaking existing single-action scenarios
   - **Mitigation**: Comprehensive backward compatibility tests
   - **Contingency**: Feature flag for gradual rollout

2. **Performance Regression** (MULACTPLAFIX-002)
   - **Risk**: Enhanced heuristic adds overhead
   - **Mitigation**: Performance benchmarks, profiling
   - **Contingency**: Make heuristic enhancement optional

### Medium Risk Areas
1. **Edge Case Handling** (MULACTPLAFIX-004)
   - **Risk**: Incomplete coverage of edge cases
   - **Mitigation**: Extensive edge case test suite
   - **Contingency**: Add cases as discovered

2. **Stopping Criteria** (MULACTPLAFIX-003)
   - **Risk**: Limits too restrictive or too permissive
   - **Mitigation**: Configurable defaults, extensive testing
   - **Contingency**: Make all limits configurable

---

## Dependencies

### External Dependencies
- No external library changes required ✓
- No API changes required ✓
- No data migration required ✓

### Internal Dependencies
- `NumericConstraintEvaluator` (MODCOMPLASUP-001) ✅ Complete
- `PlanningEffectsSimulator` (MODCOMPLASUP-003) ✅ Complete
- Dual-format state sync (MODCOMPLASUP-005) ✅ Complete
- Debugging tools infrastructure ✅ Exists

**All prerequisites complete** ✓

---

## Rollout Strategy

### Phase 1: Development (This Epic)
- Implement all 6 tickets
- Comprehensive testing
- Code review and refinement

### Phase 2: Integration
- Merge to development branch
- Run full integration test suite
- Performance profiling

### Phase 3: Staging
- Deploy to staging environment
- Run extended test scenarios
- Gather performance metrics

### Phase 4: Production
- Feature flag for gradual rollout (optional)
- Monitor planning performance
- Watch for edge cases

---

## Monitoring & Validation

### Metrics to Track
1. **Planning Success Rate**: % of planning attempts that succeed
2. **Average Plan Length**: Actions per plan (expect increase for multi-action)
3. **Planning Time**: Distribution of planning times
4. **Failure Reasons**: Categorization of planning failures
5. **Node Expansion**: Average nodes expanded per plan

### Alerting Thresholds
- Planning time > 1 second: Investigate
- Planning failure rate > 5%: Alert
- Memory usage > 100MB per plan: Critical

---

## Related Tickets

**Completed (Prerequisites)**:
- ✅ MODCOMPLASUP-001: NumericConstraintEvaluator
- ✅ MODCOMPLASUP-002: Numeric constraint heuristic integration
- ✅ MODCOMPLASUP-003: PlanningEffectsSimulator validation
- ✅ MODCOMPLASUP-004: Test coverage for numeric goals
- ✅ MODCOMPLASUP-005: Dual-format state sync

**This Epic**:
- 🔄 MULACTPLAFIX-001: Task reuse algorithm (CRITICAL)
- 📋 MULACTPLAFIX-002: Enhanced heuristic
- 📋 MULACTPLAFIX-003: Stopping criteria
- 📋 MULACTPLAFIX-004: Edge case handling
- 📋 MULACTPLAFIX-005: Comprehensive tests
- 📋 MULACTPLAFIX-006: Documentation

**Blocked By This Epic**:
- ⏸️ MODCOMPLASUP-007: Activate external goal test
- ⏸️ MODCOMPLASUP-008: Documentation updates
- ⏸️ MODCOMPLASUP-009: Schema updates
- ⏸️ MODCOMPLASUP-010: Performance benchmarking

---

## Contact & Escalation

**Primary Developer**: [Assign implementation owner]
**Reviewer**: [Assign code reviewer]
**QA Contact**: [Assign QA engineer]

**Escalation Path**:
1. Implementation issues → Primary Developer
2. Architectural decisions → Tech Lead
3. Performance concerns → Performance Team
4. Release blockers → Engineering Manager

---

## Checklist for Epic Completion

### Implementation
- [ ] MULACTPLAFIX-001: Task Reuse Algorithm complete
- [ ] MULACTPLAFIX-002: Enhanced Heuristic complete
- [ ] MULACTPLAFIX-003: Stopping Criteria complete
- [ ] MULACTPLAFIX-004: Edge Case Handling complete
- [ ] MULACTPLAFIX-005: Comprehensive Tests complete
- [ ] MULACTPLAFIX-006: Documentation complete

### Validation
- [ ] All 35 tests passing (16 existing + 19 new)
- [ ] Code coverage 80%+ on modified files
- [ ] ESLint validation passing
- [ ] Performance benchmarks within targets
- [ ] No memory leaks detected

### Quality
- [ ] Code review completed
- [ ] Documentation reviewed
- [ ] Edge cases verified
- [ ] Backward compatibility confirmed
- [ ] Production deployment plan approved

### Release
- [ ] Merged to development branch
- [ ] Staging environment validated
- [ ] Performance monitoring configured
- [ ] Rollout strategy approved
- [ ] Post-deployment validation plan ready

---

**Epic Status**: Planning Complete, Ready for Implementation

**Next Action**: Begin MULACTPLAFIX-001 (Task Reuse Algorithm)
