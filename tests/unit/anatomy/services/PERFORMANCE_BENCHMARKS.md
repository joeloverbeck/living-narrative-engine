# ActivityDescriptionService Performance Benchmarks

## Overview

This document defines performance benchmarks and expectations for the ActivityDescriptionService characterization tests. These benchmarks ensure that the service maintains acceptable performance characteristics during and after refactoring.

## Benchmark Categories

### 1. Cache Performance

#### Name Resolution Cache
- **Metric**: Cache hit rate after first call
- **Target**: ≥ 90%
- **Test**: `performance_test_data.json` → `name_resolution_cache_test`
- **Rationale**: Name resolution is expensive (entity lookup + component access). Caching should prevent repeated lookups.

#### Metadata Collection Cache
- **Metric**: Cache hit rate for repeated metadata collection
- **Target**: ≥ 80%
- **Test**: `performance_test_data.json` → `metadata_collection_cache_test`
- **Rationale**: Metadata collection involves 3-tier traversal. Caching should reduce this overhead.

#### Priority Sort Cache
- **Metric**: Cache hit rate for activity sorting
- **Target**: ≥ 75%
- **Test**: Section 7 Performance tests
- **Rationale**: Sorting is O(n log n). Caching sorted results prevents redundant sorting.

#### Activity Group Cache
- **Metric**: Cache hit rate for grouping operations
- **Target**: ≥ 70%
- **Test**: Section 7 Performance tests
- **Rationale**: Grouping involves pair-wise comparison. Caching prevents recomputation.

### 2. Algorithm Performance

#### Grouping Algorithm Scalability
- **Metric**: Latency by activity count
- **Targets**:
  - 10 activities: < 5ms
  - 50 activities: < 20ms
  - 100 activities: < 50ms
  - 500 activities: < 200ms
- **Test**: `performance_test_data.json` → `grouping_*_activities`
- **Rationale**: Sequential pair-wise comparison should scale linearly with sorted input (O(n) after O(n log n) sort).

#### Filter Pipeline Performance
- **Metric**: 4-stage pipeline latency for 1000 activities
- **Target**: < 100ms
- **Test**: `performance_test_data.json` → `filter_pipeline_performance`
- **Rationale**: Filter stages should be efficient with early rejection optimizations.

### 3. Memory Management

#### Stable Memory Usage
- **Metric**: Memory growth over 10,000 iterations
- **Target**: < 50MB growth
- **Test**: `performance_test_data.json` → `stable_memory_usage`
- **Rationale**: Cache pruning should prevent unbounded memory growth.

#### Cache Pruning Effectiveness
- **Metric**: LRU pruning rate
- **Target**: ≥ 10% items pruned when cache full
- **Test**: `performance_test_data.json` → `cache_pruning_effectiveness`
- **Rationale**: LRU should effectively remove stale entries.

### 4. Concurrency

#### Concurrent Description Generation
- **Metric**: Latency for 100 concurrent requests
- **Target**: < 500ms
- **Test**: `performance_test_data.json` → `concurrent_description_generation`
- **Rationale**: Service should handle concurrent access without significant degradation.

#### Cache Contention
- **Metric**: Cache hit rate with 50 readers + 10 writers
- **Target**: ≥ 70%
- **Test**: `performance_test_data.json` → `cache_contention`
- **Rationale**: ActivityCacheManager should handle concurrent access safely.

## Performance Test Execution

### Running Performance Tests

```bash
# Run all performance tests
NODE_ENV=test npm run test:unit -- tests/unit/anatomy/services/activityDescriptionService.characterization.test.js --testNamePattern="Performance"

# Run specific performance category
NODE_ENV=test npm run test:unit -- tests/unit/anatomy/services/activityDescriptionService.characterization.test.js --testNamePattern="Cache Performance"
```

### Interpreting Results

Performance tests should:
1. **Pass** - All benchmarks meet target thresholds
2. **Warn** - Performance degradation detected (10-20% below target)
3. **Fail** - Performance regression (>20% below target)

### Performance Regression Detection

Golden master tests include performance snapshots:
- Baseline established during initial test run
- Subsequent runs compare against baseline
- Deviations > 20% trigger test failure

## Optimization Strategies

### If Name Resolution Cache Hit Rate < 90%
1. Check cache TTL (default: 5 minutes)
2. Verify cache invalidation events are not firing too frequently
3. Ensure entity IDs are consistent (no dynamic ID generation)

### If Grouping Algorithm Exceeds Latency Targets
1. Verify activities are pre-sorted by priority
2. Check for unnecessary repeated grouping calls
3. Ensure cache is being utilized for repeated groupings

### If Memory Growth Exceeds 50MB
1. Verify LRU pruning is enabled (default: enabled)
2. Check for memory leaks in test code
3. Reduce cache TTL if too many items accumulate

### If Concurrent Performance Degrades
1. Verify ActivityCacheManager is properly handling concurrent access
2. Check for lock contention or race conditions
3. Consider increasing cache size to reduce eviction rate

## Benchmark Validation Workflow

1. **Baseline Establishment** (Initial Implementation)
   - Run performance tests on clean implementation
   - Record baseline metrics
   - Commit baseline to golden masters

2. **Pre-Refactoring Validation** (Before ACTDESSERREF-003)
   - Run full performance test suite
   - Verify all benchmarks pass
   - Document any performance concerns

3. **Post-Refactoring Validation** (After Each Refactoring Phase)
   - Run full performance test suite
   - Compare against baseline
   - Investigate any regressions > 10%

4. **Continuous Monitoring**
   - Include performance tests in CI/CD pipeline
   - Track performance metrics over time
   - Alert on degradation trends

## Known Performance Characteristics

### Expected Cache Hit Rates (After Warm-up)
- Name Resolution: 90-95%
- Metadata Collection: 80-85%
- Priority Sorting: 75-80%
- Activity Grouping: 70-75%

### Expected Latencies (P95)
- Single Activity Description: < 10ms
- 10 Activities: < 20ms
- 50 Activities: < 50ms
- 100 Activities: < 100ms
- 500 Activities: < 300ms

### Expected Memory Usage
- Base Service: ~5MB
- With 1000 Cached Entities: ~15MB
- With 10,000 Cached Entities: ~50MB
- After LRU Pruning: ~30MB (40% reduction)

## Troubleshooting Performance Issues

### Symptom: High Latency for Small Activity Counts
**Possible Causes**:
- Cache not being utilized
- Excessive validation overhead
- Inefficient component lookup

**Debug Steps**:
1. Enable cache hit/miss logging
2. Profile component lookup operations
3. Check validation overhead

### Symptom: Memory Growth Over Time
**Possible Causes**:
- LRU pruning not working
- Cache invalidation not firing
- Memory leak in service or dependencies

**Debug Steps**:
1. Monitor cache size over time
2. Verify LRU pruning is enabled
3. Use heap profiler to identify leaks

### Symptom: Cache Hit Rate Below Target
**Possible Causes**:
- Cache keys not stable (dynamic generation)
- TTL too short
- Cache invalidation too aggressive

**Debug Steps**:
1. Log cache keys to verify stability
2. Increase TTL temporarily to test
3. Review invalidation event triggers

## Future Performance Improvements

### Potential Optimizations
1. **Batch Operations**: Cache multiple entities in single operation
2. **Lazy Evaluation**: Defer expensive operations until needed
3. **Parallel Processing**: Process independent activities concurrently
4. **Index Optimization**: Pre-index activities by verb/target for faster filtering

### Performance Monitoring Tools
- Jest performance reporters
- Node.js profiler (`--prof`)
- Heap snapshots (`--inspect`)
- Custom performance metrics collection

## References

- ActivityCacheManager Implementation: `src/anatomy/cache/activityCacheManager.js`
- Performance Test Fixtures: `tests/unit/anatomy/services/fixtures/performance_test_data.json`
- Golden Master Benchmarks: `tests/unit/anatomy/services/goldenMasters/performance_benchmarks.json`
