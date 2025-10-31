# ACTDESSERREF-002: Create Characterization Test Suite

**Priority**: HIGH
**Effort**: 8 days
**Risk**: LOW
**Dependencies**: None (can run parallel with ACTDESSERREF-001)
**Phase**: 1 - Foundation (Weeks 1-2)

## Context

Before refactoring the 2,885-line ActivityDescriptionService, we MUST capture its current behavior through comprehensive characterization tests. These tests act as a safety net, ensuring refactorings don't introduce regressions.

**Critical**: The service exposes 19+ private methods via `getTestHooks()` for testing. The existing test suite has 6,658 lines across 8 files. We must NOT break these hooks during refactoring.

**File Location**: Current tests in `tests/unit/anatomy/services/activityDescriptionService.test.js`

## Why Characterization Tests

Traditional unit tests focus on **expected behavior**. Characterization tests capture **actual behavior**, including:
- Edge cases not explicitly tested
- Implicit contracts (ordering, formatting, error messages)
- Performance characteristics
- Integration points between methods

## Test Coverage Areas

### 1. Metadata Collection (3-Tier Fallback)
- ActivityIndex (Tier 1) - optional performance optimization
- Inline metadata (Tier 2) - component.activityMetadata scanning
- Dedicated metadata (Tier 3) - activity:description_metadata components
- Deduplication by activity signature

**Key Methods**:
- `#collectActivityMetadata(entityId, entity)` - Line 387
- `#collectInlineMetadata(entity)` - Line 436
- `#collectDedicatedMetadata(entity)` - Line 613
- `#deduplicateActivitiesBySignature(activities)` - Line 719

### 2. Activity Filtering (4-Stage Pipeline)
- Property-based filtering (category, actorType, etc.)
- Required component checks
- Forbidden component checks
- Custom JSON Logic conditions

**Key Methods**:
- `#filterByConditions(activities, entity)` - Line 775
- `#evaluateActivityVisibility(activity, entity)` - Line 801
- `#buildLogicContext(activity, entity)` - Line 881
- `#hasRequiredComponents(entity, required)` - Line 980
- `#hasForbiddenComponents(entity, forbidden)` - Line 1014

### 3. Activity Grouping (Sequential Pair-Wise Algorithm)
- Sequential pair-wise comparison (NOT target-based grouping)
- Conjunction selection ("while" vs "and" based on priority proximity)
- Priority sorting
- Index-based optimization

**Key Methods**:
- `#groupActivities(activities, cacheKey)` - Line 1839
- `#sortByPriority(activities, cacheKey)` - Line 1040
- `#determineConjunction(first, second)` - Line 1968 (takes TWO activities)
- `#activitiesOccurSimultaneously(p1, p2)` - Line 1987

### 4. Natural Language Generation
- Name resolution with caching
- Pronoun resolution (self-contained, NOT from AnatomyFormattingService)
- Gender detection via `core:gender` component
- Phrase generation from templates
- Tone modifiers (adverbs, softeners)

**Key Methods**:
- `#resolveEntityName(entityId)` - Line 2204
- `#detectEntityGender(entityId)` - Line 2263 (via core:gender component)
- `#getPronounSet(gender)` - Line 2285
- `#getReflexivePronoun(pronouns)` - Line 2304
- `#generateActivityPhrase(...)` - Line 1668
- `#mergeAdverb(currentAdverb, injected)` - Line 2333
- `#injectSoftener(template, descriptor)` - Line 2359

### 5. Context Building
- Relationship tone detection (via closeness component, NO RelationshipService)
- Activity intensity mapping
- Contextual tone application

**Key Methods**:
- `#buildActivityContext(actorId, activity)` - Line 2569
- `#determineActivityIntensity(priority)` - Line 2623

### 6. Edge Cases
- Null/undefined handling
- Empty collections
- Malformed data
- Missing components

### 7. Performance Characteristics
- Caching performance
- Grouping algorithm with large datasets
- Memory usage patterns

### 8. Golden Master Tests
- Standard scenarios with exact output matching
- Regression detection

## Implementation Plan

### File Structure
```
tests/unit/anatomy/services/
├── activityDescriptionService.characterization.test.js (2000+ lines)
├── goldenMasters/
│   ├── standard_scenario.json
│   ├── complex_grouping_output.json
│   └── pronoun_resolution_output.txt
├── fixtures/
│   ├── complex_grouping_activities.json
│   └── pronoun_test_groups.json
└── activityDescriptionServiceTestHelpers.js
```

### Test Template Structure

```javascript
describe('ActivityDescriptionService - [Area] Characterization', () => {
  let service;
  let mockEntityManager;
  let mockLogger;
  let mockEventBus;

  beforeEach(() => {
    // Setup using test helpers
    ({ service, mockEntityManager, mockLogger, mockEventBus } =
      createTestService());
  });

  describe('[Specific Feature]', () => {
    it('should [expected behavior]', () => {
      // Arrange
      const input = createTestInput();

      // Act
      const result = service.methodUnderTest(input);

      // Assert
      expect(result).toBeDefined();
      // Capture actual behavior
    });
  });
});
```

### Critical Test Cases

**Grouping Algorithm** (most complex):
```javascript
it('should group activities via sequential pair-wise comparison', () => {
  const activities = [
    { verb: 'touch', targetId: 'A', priority: 5 },
    { verb: 'touch', targetId: 'A', priority: 6 },  // Groups with first
    { verb: 'kiss', targetId: 'B', priority: 8 },   // New group
  ];

  const hooks = service.getTestHooks();
  const groups = hooks.groupActivities(activities, 'cacheKey');

  expect(groups).toHaveLength(2);
  expect(groups[0].primaryActivity.verb).toBe('touch');
  expect(groups[0].relatedActivities).toHaveLength(1);
  expect(groups[0].relatedActivities[0].conjunction).toBe('while'); // Priority close
});
```

**Pronoun Resolution** (self-contained):
```javascript
it('should detect gender via core:gender component', () => {
  mockEntityManager.getEntityInstance.mockReturnValue({
    getComponentData: (id) => {
      if (id === 'core:gender') return { value: 'male' };
      return null;
    }
  });

  const hooks = service.getTestHooks();
  const gender = hooks.detectEntityGender('entity1');

  expect(gender).toBe('male');
});

it('should generate pronoun set', () => {
  const hooks = service.getTestHooks();
  const pronouns = hooks.getPronounSet('female');

  expect(pronouns).toEqual({
    subject: 'she',
    object: 'her',
    possessive: 'her',
    possessivePronoun: 'hers'
  });
});
```

**Relationship Detection** (NO RelationshipService):
```javascript
it('should detect closeness_partner from positioning:closeness', () => {
  mockEntityManager.getEntityInstance.mockReturnValue({
    getComponentData: (id) => {
      if (id === 'positioning:closeness') {
        return { partners: ['target1'] };
      }
      return null;
    }
  });

  const hooks = service.getTestHooks();
  const activity = { targetId: 'target1' };
  const context = hooks.buildActivityContext('actor1', activity);

  expect(context.relationshipTone).toBe('closeness_partner');
});
```

## Test Helpers

**Location**: `tests/unit/anatomy/services/activityDescriptionServiceTestHelpers.js`

```javascript
export function createTestService(options = {}) {
  return {
    service: new ActivityDescriptionService({
      logger: options.logger || createMockLogger(),
      entityManager: options.entityManager || createMockEntityManager(),
      anatomyFormattingService: options.anatomyFormattingService || {},
      jsonLogicEvaluationService: options.jsonLogicEvaluationService || createMockJsonLogic(),
      activityIndex: options.activityIndex || null,
      eventBus: options.eventBus || createMockEventBus()
    }),
    // Return mocks for test assertions
    mockEntityManager: options.entityManager || createMockEntityManager(),
    mockLogger: options.logger || createMockLogger(),
    mockEventBus: options.eventBus || createMockEventBus()
  };
}

export function createStandardEntity() {
  return {
    id: 'entity1',
    getAllComponents: () => new Map([
      ['core:name', { value: 'John' }],
      ['core:gender', { value: 'male' }],
      ['positioning:touch', {
        activityMetadata: {
          verb: 'touch',
          verbPhrase: '{actor} is touching {target}',
          targetId: 'target1',
          priority: 5
        }
      }]
    ]),
    getComponentData: function(id) {
      return this.getAllComponents().get(id);
    },
    hasComponent: function(id) {
      return this.getAllComponents().has(id);
    }
  };
}

export function createMockEntityManager() {
  return {
    getEntityInstance: jest.fn().mockReturnValue(null)
  };
}

export function createMockJsonLogic() {
  return {
    evaluateConditions: jest.fn().mockReturnValue(true)
  };
}

export function createMockEventBus() {
  return {
    on: jest.fn(),
    dispatch: jest.fn()
  };
}

export function loadGoldenMaster(filename) {
  const path = `${__dirname}/goldenMasters/${filename}`;
  return JSON.parse(fs.readFileSync(path, 'utf-8'));
}

export function loadFixture(filename) {
  const path = `${__dirname}/fixtures/${filename}`;
  return JSON.parse(fs.readFileSync(path, 'utf-8'));
}
```

## Acceptance Criteria

- [ ] 1500+ characterization tests covering all 8 areas
- [ ] Golden master tests capture critical paths (10+ scenarios)
- [ ] Property-based tests for grouping algorithm
- [ ] Performance benchmarks established (baseline metrics)
- [ ] Edge case coverage (null, undefined, empty, malformed)
- [ ] All tests pass with current implementation
- [ ] Test execution time <30 seconds
- [ ] Coverage report shows 95%+ characterization coverage
- [ ] Golden master files committed to repository
- [ ] Test helpers extracted to shared utilities

## Success Metrics

- **Test Count**: 1500+ characterization tests
- **Coverage**: 95%+ of ActivityDescriptionService methods
- **Golden Masters**: 10+ golden master scenarios
- **Performance Baseline**: Benchmarks for all major operations
- **Execution Time**: <30s for full characterization suite
- **Regression Detection**: Catches any behavior changes immediately

## Deliverables

1. `tests/unit/anatomy/services/activityDescriptionService.characterization.test.js` (2000+ lines)
2. `tests/unit/anatomy/services/goldenMasters/` directory (10+ files)
3. `tests/unit/anatomy/services/fixtures/` directory (5+ files)
4. `tests/unit/anatomy/services/activityDescriptionServiceTestHelpers.js`
5. `tests/performance/activityDescriptionService.benchmark.js`
6. Documentation: `docs/testing/activity-description-service-characterization.md`

## Risks & Mitigation

**Risk**: Test suite becomes maintenance burden
**Mitigation**: Focus on golden masters and critical paths, not exhaustive unit tests

**Risk**: Tests too slow
**Mitigation**: Use jest.useFakeTimers() for time-dependent tests, optimize fixtures

**Risk**: Golden masters become stale
**Mitigation**: Document when golden masters should be updated, provide update scripts

## Dependencies

None - can start immediately and run in parallel with ACTDESSERREF-001.

## Blockers

None.

## Related Tickets

- ACTDESSERREF-001 (parallel)
- All refactoring tickets (003-008) depend on this
