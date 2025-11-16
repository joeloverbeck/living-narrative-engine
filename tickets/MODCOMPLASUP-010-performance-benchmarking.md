# MODCOMPLASUP-010: Performance Benchmarking for Numeric Planning

**Spec Reference**: `specs/modify-component-planner-support.md` - Section 8, Performance Tests
**Related GOAP Spec**: `specs/goap-system-specs.md` - Performance considerations

## Summary
Create performance benchmarks to ensure numeric constraint planning meets performance targets and doesn't cause regressions in existing planning scenarios.

## Problem
New features like numeric constraint evaluation add computational overhead to the planning process. Need to verify that performance remains acceptable and identify any bottlenecks.

## Performance Targets

### Planning Performance
- **Simple numeric goal**: < 100ms for plan creation
- **Multiple numeric goals**: < 1 second for 10 different goals
- **Heuristic calculation**: < 5ms per goal evaluation
- **No regression**: Existing component-based planning maintains current performance

### Memory Performance
- **Memory growth**: < 1MB per 100 planning iterations
- **No memory leaks**: Memory usage stable over 1000+ plans

## Implementation Details

### Test File Location
`tests/performance/goap/numericPlanning.performance.test.js` (NEW)

### Benchmark Scenarios

#### 1. Simple Numeric Goal Planning

```javascript
describe('Numeric Planning Performance', () => {
  describe('Simple Numeric Goals', () => {
    it('should plan hunger reduction in < 100ms', async () => {
      const { planner, actorId, goal } = await setupHungerScenario();

      const startTime = performance.now();
      const plan = await planner.createPlan(actorId, goal);
      const duration = performance.now() - startTime;

      expect(plan).toBeDefined();
      expect(duration).toBeLessThan(100); // < 100ms
    });

    it('should plan health restoration in < 100ms', async () => {
      const { planner, actorId, goal } = await setupHealthScenario();

      const startTime = performance.now();
      const plan = await planner.createPlan(actorId, goal);
      const duration = performance.now() - startTime;

      expect(plan).toBeDefined();
      expect(duration).toBeLessThan(100);
    });

    it('should plan resource accumulation in < 100ms', async () => {
      const { planner, actorId, goal } = await setupGoldScenario();

      const startTime = performance.now();
      const plan = await planner.createPlan(actorId, goal);
      const duration = performance.now() - startTime;

      expect(plan).toBeDefined();
      expect(duration).toBeLessThan(100);
    });
  });
});
```

#### 2. Batch Planning Performance

```javascript
describe('Batch Planning Performance', () => {
  it('should plan 10 different numeric goals in < 1 second', async () => {
    const { planner, actorId } = await setupMultiGoalScenario();

    const goals = [
      createHungerGoal(),
      createThirstGoal(),
      createHealthGoal(),
      createEnergyGoal(),
      createGoldGoal(),
      createStrengthGoal(),
      createAgilityGoal(),
      createIntelligenceGoal(),
      createExperienceGoal(),
      createReputationGoal()
    ];

    const startTime = performance.now();

    for (const goal of goals) {
      await planner.createPlan(actorId, goal);
    }

    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(1000); // < 1 second total
  });

  it('should average < 100ms per goal in batch', async () => {
    const { planner, actorId } = await setupMultiGoalScenario();

    const goals = createTestGoals(10);
    const durations = [];

    for (const goal of goals) {
      const start = performance.now();
      await planner.createPlan(actorId, goal);
      durations.push(performance.now() - start);
    }

    const average = durations.reduce((a, b) => a + b, 0) / durations.length;

    expect(average).toBeLessThan(100);
  });
});
```

#### 3. Heuristic Calculation Performance

```javascript
describe('Heuristic Calculation Performance', () => {
  it('should calculate numeric distance in < 5ms', () => {
    const { heuristic, state, goal } = setupDistanceTest();

    const startTime = performance.now();

    for (let i = 0; i < 100; i++) {
      heuristic.calculateDistance(state, goal);
    }

    const duration = performance.now() - startTime;
    const averagePerCall = duration / 100;

    expect(averagePerCall).toBeLessThan(5); // < 5ms per call
  });

  it('should handle complex numeric constraints efficiently', () => {
    const { heuristic, state } = setupComplexConstraintTest();

    const complexGoal = {
      goalState: {
        and: [
          { '<=': [{ var: 'actor.hunger' }, 30] },
          { '>=': [{ var: 'actor.health' }, 80] },
          { '>=': [{ var: 'actor.gold' }, 100] }
        ]
      }
    };

    const startTime = performance.now();

    for (let i = 0; i < 100; i++) {
      heuristic.calculateDistance(state, complexGoal);
    }

    const duration = performance.now() - startTime;
    const averagePerCall = duration / 100;

    expect(averagePerCall).toBeLessThan(10); // < 10ms for complex
  });
});
```

#### 4. Regression Testing (Component-Based Planning)

```javascript
describe('Performance Regression Tests', () => {
  it('should not slow down component-based planning', async () => {
    const { planner, actorId } = await setupComponentScenario();

    const componentGoal = {
      id: 'test:component_goal',
      goalState: { has_component: ['actor', 'core:armed'] }
    };

    const startTime = performance.now();

    for (let i = 0; i < 100; i++) {
      await planner.createPlan(actorId, componentGoal);
    }

    const duration = performance.now() - startTime;
    const averagePerPlan = duration / 100;

    // Should maintain existing performance (baseline: ~50ms)
    expect(averagePerPlan).toBeLessThan(60); // 20% tolerance
  });

  it('should handle mixed goals without performance degradation', async () => {
    const { planner, actorId } = await setupMixedScenario();

    const mixedGoals = [
      { goalState: { has_component: ['actor', 'core:armed'] } },
      { goalState: { '<=': [{ var: 'actor.hunger' }, 30] } },
      { goalState: { has_component: ['actor', 'core:shelter'] } },
      { goalState: { '>=': [{ var: 'actor.health' }, 80] } }
    ];

    const startTime = performance.now();

    for (const goal of mixedGoals) {
      await planner.createPlan(actorId, goal);
    }

    const duration = performance.now() - startTime;

    expect(duration).toBeLessThan(400); // < 100ms average
  });
});
```

#### 5. Memory Performance

```javascript
describe('Memory Performance', () => {
  it('should not leak memory during repeated planning', async () => {
    const { planner, actorId, goal } = await setupMemoryTest();

    const initialMemory = process.memoryUsage().heapUsed;

    // Run 1000 planning iterations
    for (let i = 0; i < 1000; i++) {
      await planner.createPlan(actorId, goal);

      // Force GC every 100 iterations if available
      if (i % 100 === 0 && global.gc) {
        global.gc();
      }
    }

    // Force final GC
    if (global.gc) {
      global.gc();
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryGrowth = (finalMemory - initialMemory) / 1024 / 1024; // MB

    expect(memoryGrowth).toBeLessThan(1); // < 1MB growth
  });

  it('should maintain stable memory under continuous load', async () => {
    const { planner, actorId, goals } = await setupContinuousLoadTest();

    const memorySnapshots = [];

    for (let i = 0; i < 10; i++) {
      // Plan 100 times
      for (let j = 0; j < 100; j++) {
        await planner.createPlan(actorId, goals[j % goals.length]);
      }

      // Force GC and snapshot
      if (global.gc) {
        global.gc();
      }
      memorySnapshots.push(process.memoryUsage().heapUsed);
    }

    // Memory should be relatively stable (not growing continuously)
    const firstHalf = memorySnapshots.slice(0, 5);
    const secondHalf = memorySnapshots.slice(5, 10);

    const firstAverage = firstHalf.reduce((a, b) => a + b) / 5;
    const secondAverage = secondHalf.reduce((a, b) => a + b) / 5;

    const percentageIncrease = ((secondAverage - firstAverage) / firstAverage) * 100;

    expect(percentageIncrease).toBeLessThan(5); // < 5% growth
  });
});
```

### Performance Monitoring

```javascript
describe('Performance Metrics Collection', () => {
  it('should collect and report performance statistics', async () => {
    const { planner, actorId, goals } = await setupMetricsTest();

    const metrics = {
      planCreationTimes: [],
      heuristicCalculationTimes: [],
      actionApplicabilityTimes: []
    };

    for (const goal of goals) {
      const start = performance.now();
      const plan = await planner.createPlan(actorId, goal);
      metrics.planCreationTimes.push(performance.now() - start);
    }

    // Calculate statistics
    const stats = {
      mean: calculateMean(metrics.planCreationTimes),
      median: calculateMedian(metrics.planCreationTimes),
      p95: calculatePercentile(metrics.planCreationTimes, 95),
      p99: calculatePercentile(metrics.planCreationTimes, 99),
      min: Math.min(...metrics.planCreationTimes),
      max: Math.max(...metrics.planCreationTimes)
    };

    console.log('Performance Statistics:', stats);

    expect(stats.p95).toBeLessThan(150); // 95th percentile < 150ms
    expect(stats.p99).toBeLessThan(200); // 99th percentile < 200ms
  });
});
```

## Dependencies
- MODCOMPLASUP-001 through MODCOMPLASUP-006: Implementation complete

## Testing Requirements

### Execution
```bash
# Run performance tests
npm run test:performance -- tests/performance/goap/numericPlanning.performance.test.js

# Run with memory profiling (requires --expose-gc)
node --expose-gc node_modules/.bin/jest tests/performance/goap/numericPlanning.performance.test.js

# Compare with baseline
npm run test:performance:compare
```

### Reporting
Create performance report with:
- Test scenario descriptions
- Performance metrics (mean, median, p95, p99)
- Memory usage statistics
- Comparison with targets
- Regression analysis

## Acceptance Criteria
- [ ] Performance test file created
- [ ] Simple goal planning tests (3+ scenarios)
- [ ] Batch planning tests (2+ scenarios)
- [ ] Heuristic calculation tests (2+ scenarios)
- [ ] Regression tests for component-based planning (2+ scenarios)
- [ ] Memory performance tests (2+ scenarios)
- [ ] All performance targets met
- [ ] No regressions in existing planning performance
- [ ] Memory usage stable (no leaks)
- [ ] Performance report generated
- [ ] ESLint passes
- [ ] TypeScript type checking passes

## Performance Targets Summary
| Metric | Target | Test |
|--------|--------|------|
| Simple goal planning | < 100ms | ✅ |
| Batch planning (10 goals) | < 1 second | ✅ |
| Heuristic calculation | < 5ms | ✅ |
| Component-based (no regression) | < 60ms | ✅ |
| Memory growth (1000 plans) | < 1MB | ✅ |
| Memory stability | < 5% increase | ✅ |

## Estimated Effort
1 hour

## Final Notes
This is the last ticket in the MODCOMPLASUP series. After completion, all numeric constraint planning functionality will be implemented, tested, documented, and benchmarked.

## Follow-up
After implementation complete, consider:
- Profiling specific bottlenecks if performance issues found
- Optimizing heuristic calculation if needed
- Adding more complex benchmark scenarios
- Integration with CI/CD performance monitoring
