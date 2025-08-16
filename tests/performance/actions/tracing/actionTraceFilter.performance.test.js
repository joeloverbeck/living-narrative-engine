/**
 * @file Performance tests for ActionTraceFilter
 * @description Validates filtering efficiency and performance characteristics
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';

describe('ActionTraceFilter Performance', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  describe('Exact Match Performance', () => {
    it('should handle 10,000 exact match operations in <20ms', () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        tracedActions: ['core:go', 'core:take', 'core:use', 'test:action'],
        logger: mockLogger,
      });

      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        filter.shouldTrace('core:go');
      }
      const duration = performance.now() - start;

      console.log(`Exact match 10k operations: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(20);
    });

    it('should handle 10,000 non-matching exact operations in <20ms', () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        tracedActions: ['core:go', 'core:take'],
        logger: mockLogger,
      });

      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        filter.shouldTrace('non:existent');
      }
      const duration = performance.now() - start;

      console.log(
        `Non-matching exact 10k operations: ${duration.toFixed(2)}ms`
      );
      expect(duration).toBeLessThan(20);
    });
  });

  describe('Wildcard Pattern Performance', () => {
    it('should handle 10,000 prefix wildcard operations in <50ms', () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        tracedActions: ['core:*', 'test:*', 'mod:*'],
        logger: mockLogger,
      });

      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        filter.shouldTrace(`core:action_${i % 100}`);
      }
      const duration = performance.now() - start;

      console.log(`Prefix wildcard 10k operations: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(50);
    });

    it('should handle 10,000 suffix wildcard operations in <50ms', () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        tracedActions: ['*:go', '*:take', '*:use'],
        logger: mockLogger,
      });

      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        filter.shouldTrace(`mod_${i % 100}:go`);
      }
      const duration = performance.now() - start;

      console.log(`Suffix wildcard 10k operations: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(50);
    });

    it('should handle 10,000 universal wildcard operations in <10ms', () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        tracedActions: ['*'],
        logger: mockLogger,
      });

      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        filter.shouldTrace(`any:action_${i}`);
      }
      const duration = performance.now() - start;

      console.log(
        `Universal wildcard 10k operations: ${duration.toFixed(2)}ms`
      );
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Regex Pattern Performance', () => {
    it('should handle 10,000 simple regex operations in <100ms', () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        tracedActions: ['/^core:.+go$/', '/^test:[0-9]+$/'],
        logger: mockLogger,
      });

      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        filter.shouldTrace(`core:action_${i}_go`);
      }
      const duration = performance.now() - start;

      console.log(`Simple regex 10k operations: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });

    it('should handle 10,000 complex regex operations in <200ms', () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        tracedActions: [
          '/^core:(?:go|take|use)_[a-z]+_[0-9]{3}$/',
          '/^test:(?!exclude)[a-zA-Z]+$/',
        ],
        logger: mockLogger,
      });

      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        const suffix = String(i % 1000).padStart(3, '0');
        filter.shouldTrace(`core:go_action_${suffix}`);
      }
      const duration = performance.now() - start;

      console.log(`Complex regex 10k operations: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(200);
    });
  });

  describe('Mixed Pattern Performance', () => {
    it('should handle 10,000 mixed pattern operations in <100ms', () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        tracedActions: [
          'exact:match',
          'core:*',
          '*:suffix',
          '/^regex:[0-9]+$/',
          'test:specific',
          'mod:*',
          '*:action',
        ],
        excludedActions: ['debug:*', '*:internal'],
        logger: mockLogger,
      });

      const testActions = [
        'exact:match',
        'core:go',
        'any:suffix',
        'regex:123',
        'test:other',
        'debug:trace',
        'core:internal',
      ];

      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        filter.shouldTrace(testActions[i % testActions.length]);
      }
      const duration = performance.now() - start;

      console.log(`Mixed patterns 10k operations: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Large Pattern Set Performance', () => {
    it('should handle 100 patterns efficiently', () => {
      const patterns = [];
      for (let i = 0; i < 100; i++) {
        patterns.push(`pattern_${i}:*`);
      }

      const filter = new ActionTraceFilter({
        enabled: true,
        tracedActions: patterns,
        logger: mockLogger,
      });

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        filter.shouldTrace(`pattern_${i % 100}:action`);
      }
      const duration = performance.now() - start;

      console.log(`100 patterns, 1k operations: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(50);
    });

    it('should handle 1000 patterns with acceptable performance', () => {
      const patterns = [];
      for (let i = 0; i < 1000; i++) {
        patterns.push(`pattern_${i}:specific`);
      }

      const filter = new ActionTraceFilter({
        enabled: true,
        tracedActions: patterns,
        logger: mockLogger,
      });

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        filter.shouldTrace(`pattern_${i}:specific`);
      }
      const duration = performance.now() - start;

      console.log(`1000 patterns, 1k operations: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Dynamic Pattern Updates Performance', () => {
    it('should handle rapid pattern additions efficiently', () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        tracedActions: [],
        logger: mockLogger,
      });

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        filter.addTracedActions(`pattern_${i}:*`);
      }
      const duration = performance.now() - start;

      console.log(`1000 pattern additions: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(10);

      // Verify patterns work after bulk addition
      expect(filter.shouldTrace('pattern_500:action')).toBe(true);
    });

    it('should handle rapid pattern removals efficiently', () => {
      const patterns = [];
      for (let i = 0; i < 1000; i++) {
        patterns.push(`pattern_${i}:*`);
      }

      const filter = new ActionTraceFilter({
        enabled: true,
        tracedActions: patterns,
        logger: mockLogger,
      });

      const start = performance.now();
      for (let i = 0; i < 500; i++) {
        filter.removeTracedActions(`pattern_${i}:*`);
      }
      const duration = performance.now() - start;

      console.log(`500 pattern removals: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(10);

      // Verify removals worked
      expect(filter.shouldTrace('pattern_100:action')).toBe(false);
      expect(filter.shouldTrace('pattern_600:action')).toBe(true);
    });
  });

  describe('Exclusion Performance', () => {
    it('should handle exclusion checks efficiently', () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        tracedActions: ['*'],
        excludedActions: [
          'debug:*',
          '*:internal',
          'test:specific',
          '/^temp:.*/',
        ],
        logger: mockLogger,
      });

      const testActions = [
        'core:go', // Should trace
        'debug:trace', // Excluded
        'core:internal', // Excluded
        'test:specific', // Excluded
        'temp:file', // Excluded by regex
        'normal:action', // Should trace
      ];

      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        filter.shouldTrace(testActions[i % testActions.length]);
      }
      const duration = performance.now() - start;

      console.log(`Exclusion checks 10k operations: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(100);
    });
  });

  describe('System Action Bypass Performance', () => {
    it('should handle system action bypass with minimal overhead', () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        tracedActions: [],
        excludedActions: ['*'],
        logger: mockLogger,
      });

      const start = performance.now();
      for (let i = 0; i < 10000; i++) {
        filter.shouldTrace('__system:action');
      }
      const duration = performance.now() - start;

      console.log(
        `System action bypass 10k operations: ${duration.toFixed(2)}ms`
      );
      // 10ms threshold allows for validation overhead while ensuring sub-microsecond performance
      // (1 microsecond per operation is still excellent for a bypass path with safety checks)
      expect(duration).toBeLessThan(10);
    });
  });

  describe('Configuration Updates Performance', () => {
    it('should update verbosity level quickly', () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        logger: mockLogger,
      });

      const levels = ['minimal', 'standard', 'detailed', 'verbose'];
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        filter.setVerbosityLevel(levels[i % 4]);
      }
      const duration = performance.now() - start;

      console.log(`1000 verbosity updates: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(5);
    });

    it('should update inclusion config quickly', () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        logger: mockLogger,
      });

      const configs = [
        { componentData: true },
        { prerequisites: true },
        { targets: true },
        { componentData: false, prerequisites: false },
      ];

      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        filter.updateInclusionConfig(configs[i % 4]);
      }
      const duration = performance.now() - start;

      console.log(`1000 inclusion config updates: ${duration.toFixed(2)}ms`);
      expect(duration).toBeLessThan(5);
    });
  });

  describe('Worst Case Scenarios', () => {
    it('should handle worst-case pattern matching scenario', () => {
      // Create patterns that all need to be checked
      const patterns = [];
      for (let i = 0; i < 50; i++) {
        patterns.push(`/^specific_${i}:exact_match$/`);
      }

      const filter = new ActionTraceFilter({
        enabled: true,
        tracedActions: patterns,
        logger: mockLogger,
      });

      // Test with action that doesn't match any pattern (worst case)
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        filter.shouldTrace('no:match:here');
      }
      const duration = performance.now() - start;

      console.log(
        `Worst-case 50 regex patterns, 1k operations: ${duration.toFixed(2)}ms`
      );
      expect(duration).toBeLessThan(200);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
});
