/**
 * @file Integration tests for legacy action analytics reporting utilities.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import LegacyAnalytics from '../../../../src/actions/tracing/legacyAnalytics.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

/**
 * Helper to create a mock trace compatible with LegacyAnalytics expectations.
 *
 * @param {object} summary
 * @param {Map<string, object>} tracedActions
 * @returns {{ getLegacyProcessingSummary: jest.Mock, getTracedActions: jest.Mock }}
 */
function createTrace(summary, tracedActions) {
  return {
    getLegacyProcessingSummary: jest.fn().mockReturnValue(summary),
    getTracedActions: jest.fn().mockReturnValue(tracedActions),
  };
}

describe('LegacyAnalytics integration', () => {
  let analytics;
  let logger;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    analytics = new LegacyAnalytics({ logger });
  });

  it('generates comprehensive reports for mixed legacy action traces', () => {
    const summary = {
      totalLegacyActions: 5,
      averageConversionTime: 6.5,
      failedConversions: 1,
      additionalMetadata: {
        lastRunAt: '2024-01-01T00:00:00Z',
      },
    };

    const tracedActions = new Map([
      [
        'action:alpha',
        {
          stages: {
            legacy_processing: {
              data: {
                isLegacy: true,
                originalFormat: 'text/plain',
                conversionTime: 10,
                success: true,
              },
            },
          },
        },
      ],
      [
        'action:beta',
        {
          stages: {
            legacy_processing: {
              data: {
                isLegacy: true,
                originalFormat: 'application/json',
                conversionTime: 4,
                success: true,
              },
            },
          },
        },
      ],
      [
        'action:gamma',
        {
          stages: {
            legacy_processing: {
              data: {
                isLegacy: true,
                originalFormat: 'application/json',
                conversionTime: 2,
                success: false,
              },
            },
          },
        },
      ],
      [
        'action:delta',
        {
          stages: {
            legacy_processing: {
              data: {
                isLegacy: true,
                originalFormat: 'image/svg',
                conversionTime: 1,
                success: true,
              },
            },
          },
        },
      ],
      [
        'action:eta',
        {
          stages: {
            legacy_processing: {
              data: {
                isLegacy: true,
                originalFormat: 'application/json',
                conversionTime: undefined,
                success: true,
              },
            },
          },
        },
      ],
      [
        'action:epsilon',
        {
          stages: {
            legacy_processing: {
              data: {
                isLegacy: false,
                originalFormat: 'modern',
                conversionTime: 3,
                success: true,
              },
            },
          },
        },
      ],
      [
        'action:zeta',
        {
          stages: {},
        },
      ],
    ]);

    const trace = createTrace(summary, tracedActions);
    const report = analytics.generateLegacyReport(trace);

    expect(report.overview).toBe(summary);
    expect(report.formatBreakdown).toEqual({
      'text/plain': 1,
      'application/json': 3,
      'image/svg': 1,
    });
    expect(report.performanceImpact).toEqual({
      totalConversions: 4,
      totalTime: 17,
      maxTime: 10,
      minTime: 1,
      averageTime: 4.25,
    });
    expect(report.migrationPriority).toEqual({
      high: [
        { actionId: 'action:alpha', reason: 'slow_conversion' },
        { actionId: 'action:gamma', reason: 'conversion_errors' },
      ],
      medium: [{ actionId: 'action:beta', reason: 'moderate_conversion_time' }],
      low: [
        { actionId: 'action:delta', reason: 'fast_conversion' },
        { actionId: 'action:eta', reason: 'fast_conversion' },
      ],
    });
    expect(report.recommendations).toEqual([
      {
        type: 'migration_opportunity',
        priority: 'medium',
        description: 'Found 5 legacy actions that could be modernized',
        actions: [
          'Review migration suggestions in trace data',
          'Plan gradual modernization',
        ],
      },
      {
        type: 'performance_concern',
        priority: 'high',
        description: 'Legacy conversion taking 6.5ms on average',
        actions: [
          'Profile legacy conversion bottlenecks',
          'Consider caching conversion results',
        ],
      },
      {
        type: 'reliability_issue',
        priority: 'high',
        description: '1 legacy conversions failed',
        actions: [
          'Review failed conversion logs',
          'Improve error handling in legacy layer',
        ],
      },
    ]);

    expect(trace.getLegacyProcessingSummary).toHaveBeenCalledTimes(1);
    expect(trace.getTracedActions).toHaveBeenCalledTimes(1);
  });

  it('handles traces without conversions while still classifying legacy usage', () => {
    const summary = {
      totalLegacyActions: 0,
      averageConversionTime: 0,
      failedConversions: 0,
    };

    const tracedActions = new Map([
      [
        'action:minimalLegacy',
        {
          stages: {
            legacy_processing: {
              data: {
                isLegacy: true,
                originalFormat: 'text/plain',
                conversionTime: 0,
                success: true,
              },
            },
          },
        },
      ],
      [
        'action:modern',
        {
          stages: {
            legacy_processing: {
              data: {
                isLegacy: false,
                originalFormat: 'application/json',
                conversionTime: 2,
                success: true,
              },
            },
          },
        },
      ],
      [
        'action:missingStage',
        {
          stages: {},
        },
      ],
    ]);

    const trace = createTrace(summary, tracedActions);
    const report = analytics.generateLegacyReport(trace);

    expect(report.formatBreakdown).toEqual({ 'text/plain': 1 });
    expect(report.performanceImpact).toEqual({
      totalConversions: 0,
      totalTime: 0,
      maxTime: 0,
      minTime: 0,
      averageTime: 0,
    });
    expect(report.migrationPriority).toEqual({
      high: [],
      medium: [],
      low: [{ actionId: 'action:minimalLegacy', reason: 'fast_conversion' }],
    });
    expect(report.recommendations).toEqual([]);
  });

  it('validates the presence of trace dependencies', () => {
    expect(() => analytics.generateLegacyReport(null)).toThrow(
      InvalidArgumentError
    );
    expect(() => analytics.generateLegacyReport(undefined)).toThrow(
      'Missing required dependency: ActionAwareStructuredTrace.'
    );
  });
});
