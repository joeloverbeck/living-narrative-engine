# ACTDESSERREF-010: Migrate Test Suite

**Priority**: CRITICAL | **Effort**: 10 days | **Risk**: MEDIUM
**Dependencies**: ACTDESSERREF-009 (Facade) | **Phase**: 4 - Integration & Cleanup (Weeks 11-12)

## Context

Migrate the existing 6,658-line test suite across 8 test files to use the new extracted services and facade. This is CRITICAL because tests depend on 19+ exposed hooks that must be maintained during refactoring.

**Test Files to Migrate**:
- `tests/unit/anatomy/services/activityDescriptionService.test.js` (main suite)
- 7+ additional test files

## Migration Strategy

### Phase 1: Maintain Backward Compatibility (During Refactoring)

```javascript
// ActivityDescriptionService maintains adapter layer
getTestHooks() {
  return {
    // NLG hooks (delegate to ActivityNLGSystem)
    mergeAdverb: (...args) => this.#nlgSystem.mergeAdverb(...args),
    injectSoftener: (...args) => this.#nlgSystem.injectSoftener(...args),
    sanitizeVerbPhrase: (...args) => this.#nlgSystem.sanitizeVerbPhrase(...args),
    buildRelatedActivityFragment: (...args) => this.#nlgSystem.buildRelatedActivityFragment(...args),

    // Filtering hooks (delegate to ActivityFilteringSystem)
    evaluateActivityVisibility: (...args) => this.#filteringSystem.evaluateActivityVisibility(...args),
    buildLogicContext: (...args) => this.#filteringSystem.buildLogicContext(...args),
    filterByConditions: (...args) => this.#filteringSystem.filterByConditions(...args),

    // Grouping hooks (delegate to ActivityGroupingSystem)
    groupActivities: (...args) => this.#groupingSystem.groupActivities(...args),

    // Context hooks (delegate to ActivityContextBuildingSystem)
    buildActivityContext: (...args) => this.#contextSystem.buildActivityContext(...args),

    // Original hooks (not yet refactored)
    formatActivityDescription: (...args) => this.#formatActivityDescription(...args),
  };
}
```

### Phase 2: Create Parallel Test Suites

Create new test files for extracted services:

```
tests/unit/anatomy/services/
├── caching/activityCacheManager.test.js (NEW)
├── indexing/activityIndexManager.test.js (NEW)
├── metadata/activityMetadataCollectionSystem.test.js (NEW)
├── filtering/activityFilteringSystem.test.js (NEW)
├── nlg/activityNLGSystem.test.js (NEW)
├── grouping/activityGroupingSystem.test.js (NEW)
├── context/activityContextBuildingSystem.test.js (NEW)
├── activityDescriptionFacade.test.js (NEW)
└── activityDescriptionService.test.js (MIGRATE)
```

### Phase 3: Gradual Migration

1. Keep old tests passing via adapter layer
2. Create new tests for extracted services
3. Migrate old tests to new hooks gradually
4. Remove adapter layer once all tests migrated
5. Validate coverage remains ≥80%

### Phase 4: Remove Old Hooks

```javascript
// After full migration, remove adapter layer
// Tests now use extracted services directly

// OLD (deprecated):
const hooks = service.getTestHooks();
hooks.mergeAdverb('quickly', 'very');

// NEW (after migration):
const nlgSystem = container.resolve(tokens.ActivityNLGSystem);
nlgSystem.mergeAdverb('quickly', 'very');
```

## Test Migration Checklist

- [ ] Create new test files for all 7 extracted services
- [ ] Maintain adapter layer in ActivityDescriptionService
- [ ] All 6,658 lines of tests pass via adapter
- [ ] Migrate tests incrementally to new services
- [ ] Validate coverage ≥80% throughout migration
- [ ] Remove adapter layer after full migration
- [ ] All tests pass with new architecture
- [ ] Test execution time ≤ previous baseline

## Acceptance Criteria

- [ ] All 19+ test hooks migrated
- [ ] New test files for 7 extracted services
- [ ] All 6,658 lines of tests pass
- [ ] Coverage maintained ≥80%
- [ ] Adapter layer removed
- [ ] No performance regression in test execution

## Success Metrics

- **Test Count**: Maintain or increase (distribute across services)
- **Coverage**: ≥80% across all files
- **Execution Time**: ≤ previous baseline
- **Hook Migration**: 100% of 19+ hooks migrated

## Dependencies

- ACTDESSERREF-009 (Facade must be complete)
- All extracted services (001-008)

## Related Tickets

- ACTDESSERREF-001 through ACTDESSERREF-009
- ACTDESSERREF-011 (Documentation)
