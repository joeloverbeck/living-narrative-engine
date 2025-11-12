/**
 * @file Integration tests exercising EnhancedActionTraceFilter with real collaborators.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import EnhancedActionTraceFilter, {
  TRACE_CATEGORIES,
} from '../../../../src/actions/tracing/enhancedActionTraceFilter.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

class CollectingLogger {
  constructor() {
    this.entries = [];
  }

  #record(level, message, ...args) {
    this.entries.push({ level, message, args });
  }

  debug(message, ...args) {
    this.#record('debug', message, ...args);
  }

  info(message, ...args) {
    this.#record('info', message, ...args);
  }

  warn(message, ...args) {
    this.#record('warn', message, ...args);
  }

  error(message, ...args) {
    this.#record('error', message, ...args);
  }

  countByLevel(level) {
    return this.entries.filter((entry) => entry.level === level).length;
  }

  findMessages(level) {
    return this.entries
      .filter((entry) => entry.level === level)
      .map((entry) => entry.message);
  }
}

describe('EnhancedActionTraceFilter integration behaviour', () => {
  /** @type {CollectingLogger} */
  let logger;

  beforeEach(() => {
    logger = new CollectingLogger();
  });

  it('evaluates categories, caches decisions, applies dynamic rules, and maintains cache health', () => {
    const filter = new EnhancedActionTraceFilter({
      logger,
      tracedActions: ['*'],
      verbosityLevel: 'standard',
    });

    const firstDecision = filter.shouldCaptureEnhanced(
      'performance',
      'resource_usage',
      { metrics: { cpu: 0.8 } },
      { actionId: 'performance:profile' }
    );
    expect(firstDecision).toBe(false);

    const cachedDecision = filter.shouldCaptureEnhanced(
      'performance',
      'resource_usage',
      { metrics: { cpu: 0.9 } },
      { actionId: 'performance:profile' }
    );
    expect(cachedDecision).toBe(false);

    const initialStats = filter.getEnhancedStats();
    expect(initialStats.totalChecks).toBe(2);
    expect(initialStats.filteredOut).toBe(1);
    expect(initialStats.cacheHits).toBe(1);
    expect(initialStats.cacheHitRate).toBeCloseTo(50, 0);

    filter.setVerbosityLevel('verbose');

    filter.addDynamicRule('blockLowPriority', ({ data }) => {
      if (data.priority === 'low') {
        return false;
      }
      return undefined;
    });

    const allowed = filter.shouldCaptureEnhanced(
      'performance',
      'resource_usage',
      { metrics: { cpu: 0.75 }, priority: 'normal' },
      { actionId: 'performance:profile' }
    );
    expect(allowed).toBe(true);

    const blockedByDynamicRule = filter.shouldCaptureEnhanced(
      'performance',
      'resource_usage',
      { metrics: { cpu: 0.65 }, priority: 'low' },
      { actionId: 'performance:profile' }
    );
    expect(blockedByDynamicRule).toBe(false);

    const dynamicStats = filter.getEnhancedStats();
    expect(dynamicStats.dynamicRuleApplications).toBeGreaterThanOrEqual(2);
    expect(dynamicStats.filteredOut).toBeGreaterThanOrEqual(2);

    filter.removeDynamicRule('blockLowPriority');

    const afterRemoval = filter.shouldCaptureEnhanced(
      'performance',
      'resource_usage',
      { metrics: { cpu: 0.6 }, priority: 'low' },
      { actionId: 'performance:profile' }
    );
    expect(afterRemoval).toBe(true);

    filter.clearEnhancedCache();
    expect(logger.findMessages('info')).toEqual(
      expect.arrayContaining([
        "Dynamic filter rule 'blockLowPriority' added",
        "Dynamic filter rule 'blockLowPriority' removed",
        'Enhanced filter cache cleared',
      ])
    );

    const diagnosticCapture = filter.shouldCaptureEnhanced(
      'diagnostic',
      'debug_info',
      { state: 'after-clear' },
      { actionId: 'diagnostic:trace' }
    );
    expect(diagnosticCapture).toBe(true);

    filter.optimizeCache(-1);

    expect(
      logger
        .findMessages('info')
        .some((message) =>
          typeof message === 'string' &&
          message.includes('Removed') &&
          message.includes('enhanced filter cache')
        )
    ).toBe(true);

    const statsBeforeReset = filter.getEnhancedStats();
    expect(statsBeforeReset.totalChecks).toBeGreaterThanOrEqual(5);
    expect(statsBeforeReset.filterRate).toBeGreaterThanOrEqual(0);

    filter.resetEnhancedStats();
    expect(filter.getEnhancedStats()).toEqual({
      totalChecks: 0,
      filteredOut: 0,
      cacheHits: 0,
      dynamicRuleApplications: 0,
      filterRate: 0,
      cacheHitRate: 0,
    });
  });

  it('falls back to base filter, uses heuristics for unknown types, and guards dynamic rule registration', () => {
    const restrictiveFilter = new EnhancedActionTraceFilter({
      logger,
      tracedActions: ['allowed:*'],
    });

    const blocked = restrictiveFilter.shouldCaptureEnhanced(
      'core',
      'action_start',
      {},
      { actionId: 'other:action' }
    );
    expect(blocked).toBe(false);

    const heuristicFilter = new EnhancedActionTraceFilter({
      logger,
      tracedActions: ['*'],
      verbosityLevel: 'minimal',
    });

    expect(
      heuristicFilter.shouldCaptureEnhanced(
        'unknown',
        'critical_error_event',
        {},
        { actionId: 'critical:error' }
      )
    ).toBe(true);

    heuristicFilter.setVerbosityLevel('standard');
    expect(
      heuristicFilter.shouldCaptureEnhanced(
        'unknown',
        'performance_snapshot',
        {},
        { actionId: 'performance:sample' }
      )
    ).toBe(false);

    heuristicFilter.setVerbosityLevel('verbose');
    expect(
      heuristicFilter.shouldCaptureEnhanced(
        'unknown',
        'debug_trace_event',
        {},
        { actionId: 'debug:trace' }
      )
    ).toBe(true);

    heuristicFilter.setVerbosityLevel('minimal');
    expect(
      heuristicFilter.shouldCaptureEnhanced(
        'unknown',
        'miscellaneous_event',
        {},
        { actionId: 'misc:action' }
      )
    ).toBe(true);

    const guardFilter = new EnhancedActionTraceFilter({
      logger,
      tracedActions: ['*'],
      verbosityLevel: 'verbose',
    });

    expect(() => guardFilter.addDynamicRule(' ', () => true)).toThrow(
      InvalidArgumentError
    );

    expect(() => guardFilter.addDynamicRule('invalid', null)).toThrow(
      /Dynamic rule must be a function/
    );

    guardFilter.addDynamicRule('unstableRule', () => {
      throw new Error('dynamic failure');
    });

    const resultWithErroringRule = guardFilter.shouldCaptureEnhanced(
      'core',
      'action_complete',
      { detail: 'check error handling' },
      { actionId: 'critical:error' }
    );
    expect(resultWithErroringRule).toBe(true);

    expect(logger.countByLevel('error')).toBeGreaterThan(0);
    expect(
      logger
        .findMessages('error')
        .some((message) =>
          typeof message === 'string' &&
          message.includes("Error applying dynamic rule 'unstableRule'")
        )
    ).toBe(true);
  });

  it('respects category configuration overrides when provided during construction', () => {
    const customLevels = {
      core: 'minimal',
      performance: 'standard',
      diagnostic: 'detailed',
      business_logic: 'verbose',
      legacy: 'standard',
    };

    const filter = new EnhancedActionTraceFilter({
      logger,
      tracedActions: ['*'],
      verbosityLevel: 'standard',
      categoryConfig: customLevels,
    });

    const categoryLevels = Array.from(TRACE_CATEGORIES.PERFORMANCE.types).map(
      (type) =>
        filter.shouldCaptureEnhanced(
          'performance',
          type,
          {},
          { actionId: `performance:${type}` }
        )
    );

    expect(categoryLevels.every((decision) => decision === true)).toBe(true);

    filter.setVerbosityLevel('minimal');

    const businessLogicCapture = filter.shouldCaptureEnhanced(
      'business_logic',
      'formatting',
      {},
      { actionId: 'business:format' }
    );
    expect(businessLogicCapture).toBe(false);
  });
});
