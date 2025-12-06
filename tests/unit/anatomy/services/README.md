# ActivityDescriptionService Characterization Test Suite

## Overview

This directory contains comprehensive characterization tests for the ActivityDescriptionService, created as part of the ACTDESSERREF-002 workflow. These tests capture the actual behavior of the ~2,700 line service before refactoring, serving as a safety net to prevent regressions during the planned refactoring phases (ACTDESSERREF-003 through ACTDESSERREF-008).

## Test Suite Structure

### Main Test File

- **`activityDescriptionService.characterization.test.js`** (2,392 lines, ~211 tests)
  - Section 1: Metadata Collection (31 tests)
  - Section 2: Activity Filtering (14 tests)
  - Section 3: Activity Grouping (35 tests)
  - Section 4: Natural Language Generation (35 tests)
  - Section 5: Context Building (20 tests)
  - Section 6: Edge Cases (50 tests)
  - Section 7: Performance & Cache Management (16 tests)
  - Section 8: Golden Master Tests (10 tests)

### Supporting Files

#### Cache Manager

- **`activityCacheManager.test.js`** (638 lines)
  - Comprehensive tests for ActivityCacheManager
  - Cache lifecycle, LRU pruning, event-driven invalidation

#### Test Helpers

- **`activityDescriptionServiceTestHelpers.js`** (423 lines)
  - Factory functions for creating test entities, activities, scenarios
  - Mock service creators (logger, entity manager, event bus, etc.)
  - Golden master and fixture loading utilities

### Test Data

#### Golden Masters (`goldenMasters/`)

Reference outputs for regression detection:

- `standard_scenario.json` - Basic single-activity scenario
- `complex_grouping_output.json` - Multi-activity grouping
- `pronoun_resolution_output.json` - Gender-based pronoun scenarios
- `relationship_tone_scenarios.json` - Closeness-based tone detection
- `multi_target_activities.json` - Multiple targets with grouping
- `activity_intensity_mapping.json` - Priority-to-intensity mapping
- `edge_case_scenarios.json` - Boundary conditions and edge cases
- `performance_benchmarks.json` - Performance expectations
- `end_to_end_workflow.json` - Complete workflow validation
- `conjunction_selection_rules.json` - Grouping conjunction rules

#### Fixtures (`fixtures/`)

Test data for specific scenarios:

- `complex_grouping_activities.json` - Activity grouping test data
- `pronoun_test_groups.json` - Pronoun resolution test cases
- `edge_case_entities.json` - Edge case entity definitions
- `performance_test_data.json` - Performance test scenarios
- `relationship_tone_test_data.json` - Relationship tone test data
- `metadata_collection_test_data.json` - 3-tier metadata collection

## Running Tests

### Run All Characterization Tests

```bash
NODE_ENV=test npm run test:unit -- tests/unit/anatomy/services/activityDescriptionService.characterization.test.js
```

### Run Specific Sections

```bash
# Metadata Collection
NODE_ENV=test npm run test:unit -- tests/unit/anatomy/services/activityDescriptionService.characterization.test.js --testNamePattern="Metadata Collection"

# Activity Filtering
NODE_ENV=test npm run test:unit -- tests/unit/anatomy/services/activityDescriptionService.characterization.test.js --testNamePattern="Activity Filtering"

# Activity Grouping
NODE_ENV=test npm run test:unit -- tests/unit/anatomy/services/activityDescriptionService.characterization.test.js --testNamePattern="Activity Grouping"

# Natural Language Generation
NODE_ENV=test npm run test:unit -- tests/unit/anatomy/services/activityDescriptionService.characterization.test.js --testNamePattern="Natural Language Generation"

# Context Building
NODE_ENV=test npm run test:unit -- tests/unit/anatomy/services/activityDescriptionService.characterization.test.js --testNamePattern="Context Building"

# Edge Cases
NODE_ENV=test npm run test:unit -- tests/unit/anatomy/services/activityDescriptionService.characterization.test.js --testNamePattern="Edge Cases"

# Performance & Cache
NODE_ENV=test npm run test:unit -- tests/unit/anatomy/services/activityDescriptionService.characterization.test.js --testNamePattern="Performance"

# Golden Master
NODE_ENV=test npm run test:unit -- tests/unit/anatomy/services/activityDescriptionService.characterization.test.js --testNamePattern="Golden Master"
```

### Run Cache Manager Tests

```bash
NODE_ENV=test npm run test:unit -- tests/unit/anatomy/cache/activityCacheManager.test.js
```

### Run with Coverage

```bash
NODE_ENV=test npm run test:unit -- tests/unit/anatomy/services/activityDescriptionService.characterization.test.js --coverage --collectCoverageFrom='src/anatomy/services/activityDescriptionService.js'
```

## Test Coverage Goals

### Target Metrics (from ACTDESSERREF-002)

- **Test Count**: 1,500+ tests _(Currently: ~211 core tests + ~200 parameterized variations)_
- **Code Coverage**: ≥ 95%
- **Branch Coverage**: ≥ 90%
- **Execution Time**: < 30 seconds

### Coverage by Area

1. **Metadata Collection**: 100% of 3-tier fallback system
2. **Activity Filtering**: 100% of 4-stage pipeline
3. **Activity Grouping**: 100% of sequential pair-wise algorithm
4. **Natural Language Generation**: 100% of template resolution
5. **Context Building**: 100% of relationship tone detection
6. **Edge Cases**: Comprehensive null/undefined/malformed handling
7. **Performance**: Cache hit rates, latency targets, memory usage
8. **Golden Masters**: Regression detection for key scenarios

## Test Patterns

### Characterization Testing Approach

Tests use `getTestHooks()` to access private methods, capturing actual behavior:

```javascript
const hooks = testBed.service.getTestHooks();
const result = hooks.collectActivityMetadata('entityId', entity);
expect(result).toMatchSnapshot();
```

### Mock Service Pattern

All dependencies are mocked using test helpers:

```javascript
const testBed = {
  service: await createTestService({
    logger: createMockLogger(),
    entityManager: createMockEntityManager(),
    eventBus: createMockEventBus(),
  }),
  mockEntityManager: mockEntityManager,
  mockLogger: mockLogger,
};
```

### Golden Master Pattern

Reference outputs for regression detection:

```javascript
const goldenMaster = loadGoldenMaster('standard_scenario.json');
const result = testBed.service.describeActivities(actorId, actor);
expect(result).toMatchSnapshot();
```

## Key Technical Concepts

### 3-Tier Metadata Fallback

1. **Tier 1**: ActivityIndex (highest priority)
2. **Tier 2**: Inline metadata in components
3. **Tier 3**: Dedicated metadata components (lowest priority)

Deduplication by activity signature prevents duplicates across tiers.

### 4-Stage Activity Filtering Pipeline

1. **Property-based**: Filter by activity properties
2. **Required Components**: Verify entity has required components
3. **Forbidden Components**: Reject if entity has forbidden components
4. **Custom JSON Logic**: Apply custom filtering conditions

### Sequential Pair-Wise Grouping

- NOT target-based grouping
- Activities sorted by priority (descending)
- Pair-wise comparison determines grouping
- Conjunction selection: "while" (simultaneous) vs "and" (sequential)

### Self-Contained Pronoun Resolution

- Uses `core:gender` component directly
- NO dependency on AnatomyFormattingService
- Supports: male, female, non_binary, futa, unknown → "they"

### Relationship Detection

- Uses `positioning:closeness` component
- NO dependency on RelationshipService
- Tones: closeness_partner, closeness_close, closeness_acquaintance, neutral

## ActivityCacheManager Integration

### Cached Operations

- Name resolution (`resolveEntityName`)
- Metadata collection (`collectActivityMetadata`)
- Priority sorting (`sortByPriority`)
- Activity grouping (`groupActivities`)

### Cache Configuration

- **TTL**: 5 minutes (300,000ms)
- **Pruning**: LRU strategy when cache full
- **Invalidation**: Event-driven (COMPONENT_ADDED, COMPONENT_REMOVED, etc.)
- **Cleanup**: Every 30 seconds

### Performance Expectations

- Name Resolution Cache Hit Rate: ≥ 90%
- Metadata Collection Cache Hit Rate: ≥ 80%
- Priority Sort Cache Hit Rate: ≥ 75%
- Activity Group Cache Hit Rate: ≥ 70%

## Refactoring Workflow

### Pre-Refactoring Checklist

- [ ] Run full characterization test suite
- [ ] Verify all tests pass
- [ ] Record baseline performance metrics
- [ ] Document any known issues or limitations

### During Refactoring

- [ ] Run tests after each significant change
- [ ] Investigate any test failures immediately
- [ ] Update tests if behavior intentionally changes
- [ ] Document behavior changes in commit messages

### Post-Refactoring Validation

- [ ] Run full test suite
- [ ] Verify no regressions (all tests pass)
- [ ] Compare performance against baseline
- [ ] Update golden masters if behavior improved
- [ ] Document improvements and changes

## Maintenance

### Adding New Tests

1. Add test case to appropriate section in `activityDescriptionService.characterization.test.js`
2. Create/update fixtures in `fixtures/` if needed
3. Add golden master reference if creating regression test
4. Document test purpose and expected behavior

### Updating Golden Masters

```bash
# Update all snapshots
NODE_ENV=test npm run test:unit -- tests/unit/anatomy/services/activityDescriptionService.characterization.test.js --updateSnapshot

# Update specific section
NODE_ENV=test npm run test:unit -- tests/unit/anatomy/services/activityDescriptionService.characterization.test.js --testNamePattern="Golden Master" --updateSnapshot
```

### Debugging Test Failures

1. Check if entity mocks are correctly configured
2. Verify ActivityCacheManager is properly initialized
3. Enable verbose logging: `testBed.mockLogger.debug = console.log`
4. Use Jest's `--verbose` flag for detailed output
5. Check for cache invalidation issues

## Troubleshooting

### Common Issues

#### Test Fails: "Cannot read property of null"

**Cause**: Missing entity mock or component
**Fix**: Verify entity is added to mock entity manager

#### Test Fails: Performance degradation

**Cause**: Cache not being utilized or excessive operations
**Fix**: Check cache hit rates, verify cache is enabled

#### Test Fails: Unexpected output format

**Cause**: Changes to natural language generation logic
**Fix**: Review changes, update golden master if intentional

#### Test Timeout

**Cause**: Excessive activity count or inefficient algorithm
**Fix**: Reduce test data size or optimize algorithm

## Performance Benchmarks

See `PERFORMANCE_BENCHMARKS.md` for detailed performance expectations, targets, and optimization strategies.

## References

- **Workflow**: `workflows/ACTDESSERREF-002-characterization-tests.md`
- **Service Implementation**: `src/anatomy/services/activityDescriptionService.js`
- **Cache Manager**: `src/anatomy/cache/activityCacheManager.js`
- **Performance Benchmarks**: `PERFORMANCE_BENCHMARKS.md`

## Contact

For questions or issues with the characterization tests, refer to the ACTDESSERREF workflow series or consult the project documentation.
