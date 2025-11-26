/**
 * @file Performance monitoring integration test fixtures
 * @description Test data and scenarios for validating performance monitoring workflows
 * during realistic gaming action execution patterns
 *
 * Supports Priority 2.2: Performance Monitoring Integration (MEDIUM) from
 * reports/actions-tracing-architecture-analysis.md
 */

/**
 * Performance monitoring test configurations for different gaming scenarios
 */
export const PERFORMANCE_MONITORING_CONFIGS = {
  // Lightweight monitoring for basic gaming
  LIGHT_GAMING: {
    thresholds: {
      slowOperationMs: 50,
      criticalOperationMs: 200,
      maxConcurrency: 5,
      maxTotalDurationMs: 2000,
      maxErrorRate: 2,
      maxMemoryUsageMB: 25,
    },
    samplingConfig: {
      rate: 1.0,
      strategy: 'random',
      alwaysSampleErrors: true,
      alwaysSampleSlow: true,
      slowThresholdMs: 100,
    },
    intervalMs: 500,
  },

  // Standard monitoring for typical gaming sessions
  STANDARD_GAMING: {
    thresholds: {
      slowOperationMs: 100,
      criticalOperationMs: 500,
      maxConcurrency: 10,
      maxTotalDurationMs: 5000,
      maxErrorRate: 5,
      maxMemoryUsageMB: 50,
    },
    samplingConfig: {
      rate: 1.0,
      strategy: 'adaptive',
      alwaysSampleErrors: true,
      alwaysSampleSlow: true,
      slowThresholdMs: 200,
    },
    intervalMs: 1000,
  },

  // Heavy monitoring for intensive gaming scenarios
  INTENSIVE_GAMING: {
    thresholds: {
      slowOperationMs: 200,
      criticalOperationMs: 1000,
      maxConcurrency: 20,
      maxTotalDurationMs: 10000,
      maxErrorRate: 10,
      maxMemoryUsageMB: 100,
    },
    samplingConfig: {
      rate: 0.8,
      strategy: 'error_biased',
      alwaysSampleErrors: true,
      alwaysSampleSlow: true,
      slowThresholdMs: 500,
    },
    intervalMs: 2000,
  },
};

/**
 * Gaming action patterns that simulate realistic usage
 * Note: Durations reduced by 75% for faster test execution while maintaining relative timing relationships
 */
export const GAMING_ACTION_PATTERNS = {
  // Basic character movement and interaction
  EXPLORATION: [
    { actionId: 'core:move', expectedDurationMs: 5, weight: 0.4 },
    { actionId: 'core:look', expectedDurationMs: 4, weight: 0.3 },
    { actionId: 'core:pickup', expectedDurationMs: 8, weight: 0.15 },
    { actionId: 'core:interact', expectedDurationMs: 6, weight: 0.15 },
  ],

  // Combat scenarios with timing-sensitive actions
  COMBAT: [
    { actionId: 'combat:attack', expectedDurationMs: 12, weight: 0.3 },
    { actionId: 'combat:defend', expectedDurationMs: 10, weight: 0.2 },
    { actionId: 'combat:dodge', expectedDurationMs: 9, weight: 0.2 },
    { actionId: 'combat:cast_spell', expectedDurationMs: 20, weight: 0.15 },
    { actionId: 'combat:use_item', expectedDurationMs: 11, weight: 0.15 },
  ],

  // Complex interactions requiring multiple components
  SOCIAL: [
    { actionId: 'social:talk', expectedDurationMs: 15, weight: 0.4 },
    { actionId: 'social:trade', expectedDurationMs: 22, weight: 0.3 },
    { actionId: 'social:persuade', expectedDurationMs: 19, weight: 0.2 },
    { actionId: 'social:intimidate', expectedDurationMs: 14, weight: 0.1 },
  ],

  // Inventory and equipment management
  INVENTORY: [
    { actionId: 'inventory:equip', expectedDurationMs: 9, weight: 0.3 },
    { actionId: 'inventory:unequip', expectedDurationMs: 8, weight: 0.25 },
    { actionId: 'inventory:drop', expectedDurationMs: 5, weight: 0.2 },
    { actionId: 'inventory:combine', expectedDurationMs: 12, weight: 0.15 },
    { actionId: 'inventory:examine', expectedDurationMs: 10, weight: 0.1 },
  ],
};

/**
 * Expected performance metrics for different gaming patterns
 * Note: Expectations adjusted to match reduced durations
 */
export const PERFORMANCE_EXPECTATIONS = {
  EXPLORATION: {
    averageDurationMs: 5.5,
    maxDurationMs: 10,
    concurrencyLevel: 2,
    errorRate: 0.5, // 0.5%
    memoryGrowthMB: 0.1, // per 100 actions
  },

  COMBAT: {
    averageDurationMs: 12.5,
    maxDurationMs: 30,
    concurrencyLevel: 4,
    errorRate: 1.0, // 1%
    memoryGrowthMB: 0.15, // per 100 actions
  },

  SOCIAL: {
    averageDurationMs: 17.5,
    maxDurationMs: 37,
    concurrencyLevel: 3,
    errorRate: 2.0, // 2%
    memoryGrowthMB: 0.2, // per 100 actions
  },

  INVENTORY: {
    averageDurationMs: 8.8,
    maxDurationMs: 20,
    concurrencyLevel: 2,
    errorRate: 0.8, // 0.8%
    memoryGrowthMB: 0.12, // per 100 actions
  },
};

/**
 * Test scenarios that deliberately trigger alerts
 * Note: Durations reduced for faster test execution
 */
export const ALERT_TRIGGER_SCENARIOS = {
  // Slow operations that should trigger warnings
  SLOW_OPERATIONS: [
    {
      actionId: 'test:slow_database_query',
      simulatedDurationMs: 60, // Above slow threshold (reduced from 150)
      expectedAlertType: 'slow_operation',
      expectedSeverity: 'warning',
    },
    {
      actionId: 'test:complex_calculation',
      simulatedDurationMs: 55,
      expectedAlertType: 'slow_operation',
      expectedSeverity: 'warning',
    },
  ],

  // Critical operations that should trigger critical alerts
  CRITICAL_OPERATIONS: [
    {
      actionId: 'test:massive_file_operation',
      simulatedDurationMs: 250, // Above critical threshold (reduced from 800)
      expectedAlertType: 'critical_operation',
      expectedSeverity: 'critical',
    },
    {
      actionId: 'test:heavy_ai_processing',
      simulatedDurationMs: 300,
      expectedAlertType: 'critical_operation',
      expectedSeverity: 'critical',
    },
  ],

  // High concurrency scenarios
  HIGH_CONCURRENCY: [
    {
      actionId: 'test:parallel_action_1',
      simulatedDurationMs: 25, // Reduced from 100
      concurrentCount: 8,
      expectedAlertType: 'high_concurrency',
      expectedSeverity: 'warning',
    },
  ],

  // Memory usage scenarios
  HIGH_MEMORY: [
    {
      actionId: 'test:memory_intensive',
      simulatedDurationMs: 12, // Reduced from 50
      simulatedMemoryMB: 60, // Above memory threshold
      expectedAlertType: 'high_memory_usage',
      expectedSeverity: 'warning',
    },
  ],

  // Error scenarios
  HIGH_ERROR_RATE: [
    {
      actionId: 'test:failing_action',
      simulatedDurationMs: 8, // Reduced from 30
      failureRate: 0.15, // 15% failure rate
      expectedAlertType: 'high_error_rate',
      expectedSeverity: 'critical',
    },
  ],
};

/**
 * Load testing patterns for sustained monitoring validation
 * Note: Durations and counts reduced for faster test execution
 */
export const LOAD_TEST_PATTERNS = {
  // Burst pattern - high activity followed by quiet period
  BURST_PATTERN: {
    burstDurationMs: 500, // Reduced from 2000
    burstActionCount: 25, // Reduced from 100
    quietDurationMs: 250, // Reduced from 1000
    cycles: 2, // Reduced from 3
    actionPattern: 'EXPLORATION',
  },

  // Sustained pattern - consistent activity over time
  SUSTAINED_PATTERN: {
    durationMs: 1200, // Reduced from 2500 (was 10000) - sufficient for drift detection
    actionsPerSecond: 15, // Kept same for rate testing
    actionPattern: 'COMBAT',
  },

  // Mixed pattern - different action types with varying intensity
  MIXED_PATTERN: {
    phases: [
      { pattern: 'EXPLORATION', durationMs: 750, intensity: 0.6 }, // Reduced from 3000
      { pattern: 'COMBAT', durationMs: 500, intensity: 1.0 }, // Reduced from 2000
      { pattern: 'SOCIAL', durationMs: 500, intensity: 0.4 }, // Reduced from 2000
      { pattern: 'INVENTORY', durationMs: 250, intensity: 0.8 }, // Reduced from 1000
    ],
  },
};

/**
 * Creates test action data with realistic gaming properties
 *
 * @param actionId
 * @param pattern
 */
export function createTestActionData(actionId, pattern = 'EXPLORATION') {
  const patternData = GAMING_ACTION_PATTERNS[pattern];
  const actionData =
    patternData.find((a) => a.actionId === actionId) || patternData[0];

  return {
    actionId: actionData.actionId,
    actorId: `test-actor-${Math.floor(Math.random() * 1000)}`,
    components: {
      'core:position': { x: Math.random() * 100, y: Math.random() * 100 },
      'core:stats': { health: 100, energy: 80 },
      'core:inventory': { items: ['sword', 'potion'] },
    },
    context: {
      location: 'test-room',
      timestamp: performance.now(),
      pattern: pattern,
    },
    expectedDuration: actionData.expectedDurationMs, // Make sure this is set correctly
    // Add some realistic variation (±20%)
    maxDuration: actionData.expectedDurationMs * 1.2,
    minDuration: actionData.expectedDurationMs * 0.8,
  };
}

/**
 * Generates a sequence of actions for load testing
 *
 * @param pattern
 * @param count
 */
export function generateActionSequence(pattern, count) {
  const patternData = GAMING_ACTION_PATTERNS[pattern];
  const sequence = [];

  for (let i = 0; i < count; i++) {
    // Select action based on weight distribution
    const random = Math.random();
    let cumulativeWeight = 0;
    let selectedAction = patternData[0];

    for (const action of patternData) {
      cumulativeWeight += action.weight;
      if (random <= cumulativeWeight) {
        selectedAction = action;
        break;
      }
    }

    sequence.push(createTestActionData(selectedAction.actionId, pattern));
  }

  return sequence;
}

/**
 * Performance monitoring validation helpers
 */
export const MONITORING_VALIDATION = {
  // Validate monitoring overhead stays below threshold
  validateMonitoringOverhead(measurements, thresholdMs = 1.0) {
    const average =
      measurements.reduce((sum, m) => sum + m, 0) / measurements.length;
    const max = Math.max(...measurements);
    const p95 = measurements.sort((a, b) => a - b)[
      Math.floor(measurements.length * 0.95)
    ];

    return {
      isValid:
        average < thresholdMs &&
        max < thresholdMs * 2 &&
        p95 < thresholdMs * 1.5,
      average,
      max,
      p95,
      threshold: thresholdMs,
    };
  },

  // Validate alert generation accuracy
  validateAlertAccuracy(expectedAlerts, actualAlerts, toleranceMs = 50) {
    const matches = [];
    const missed = [];
    const falsePositives = [];

    for (const expected of expectedAlerts) {
      const match = actualAlerts.find(
        (actual) =>
          actual.type === expected.expectedAlertType &&
          actual.severity === expected.expectedSeverity &&
          actual.operation.includes(expected.actionId) &&
          Math.abs(actual.timestamp - expected.timestamp) < toleranceMs
      );

      if (match) {
        matches.push({ expected, actual: match });
      } else {
        missed.push(expected);
      }
    }

    // Find false positives (alerts that weren't expected)
    for (const actual of actualAlerts) {
      const wasExpected = matches.some((m) => m.actual === actual);
      if (!wasExpected) {
        falsePositives.push(actual);
      }
    }

    return {
      accuracy: matches.length / expectedAlerts.length,
      matches,
      missed,
      falsePositives,
      isAccurate: missed.length === 0 && falsePositives.length <= 1, // Allow 1 false positive
    };
  },

  // Validate memory usage calculations
  validateMemoryAccuracy(reported, expected, tolerancePercent = 10) {
    const difference = Math.abs(reported - expected);
    const toleranceAmount = expected * (tolerancePercent / 100);

    return {
      isAccurate: difference <= toleranceAmount,
      reported,
      expected,
      difference,
      toleranceAmount,
      accuracyPercent: ((expected - difference) / expected) * 100,
    };
  },
};

export default {
  PERFORMANCE_MONITORING_CONFIGS,
  GAMING_ACTION_PATTERNS,
  PERFORMANCE_EXPECTATIONS,
  ALERT_TRIGGER_SCENARIOS,
  LOAD_TEST_PATTERNS,
  createTestActionData,
  generateActionSequence,
  MONITORING_VALIDATION,
};
