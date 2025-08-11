/**
 * @file Unit tests for JsonTraceFormatter
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { JsonTraceFormatter } from '../../../../src/actions/tracing/jsonTraceFormatter.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import { createMockActionTraceFilter } from '../../../common/mockFactories/actionTracing.js';

describe('JsonTraceFormatter', () => {
  let formatter;
  let mockLogger;
  let mockFilter;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockFilter = createMockActionTraceFilter();
    formatter = new JsonTraceFormatter({
      logger: mockLogger,
      actionTraceFilter: mockFilter,
    });
  });

  describe('constructor', () => {
    it('should validate dependencies', () => {
      expect(() => {
        new JsonTraceFormatter({
          logger: mockLogger,
          actionTraceFilter: null,
        });
      }).toThrow();
    });

    it('should initialize with valid dependencies', () => {
      expect(formatter).toBeDefined();
    });
  });

  describe('format', () => {
    it('should return empty object for null trace', () => {
      const result = formatter.format(null);
      expect(result).toBe('{}');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'JsonTraceFormatter: Null trace provided'
      );
    });

    it('should format execution trace correctly', () => {
      const trace = {
        constructor: { name: 'ActionExecutionTrace' },
        actionId: 'test:action',
        actorId: 'test-actor',
        execution: {
          startTime: Date.now(),
          endTime: Date.now() + 100,
          duration: 100,
          result: { success: true },
        },
      };

      const result = JSON.parse(formatter.format(trace));

      expect(result.metadata.type).toBe('execution');
      expect(result.actionId).toBe('test:action');
      expect(result.actorId).toBe('test-actor');
      expect(result.execution).toBeDefined();
      expect(result.execution.status).toBe('success');
    });

    it('should format pipeline trace correctly', () => {
      const tracedActions = new Map();
      tracedActions.set('action1', {
        actionId: 'action1',
        actorId: 'actor1',
        startTime: Date.now(),
        stages: {
          component_filtering: {
            timestamp: Date.now(),
            data: { candidateCount: 5 },
          },
        },
      });

      const trace = {
        constructor: { name: 'ActionAwareStructuredTrace' },
        getTracedActions: jest.fn(() => tracedActions),
        getSpans: jest.fn(() => []),
      };

      const result = JSON.parse(formatter.format(trace));

      expect(result.metadata.type).toBe('pipeline');
      expect(result.actions).toBeDefined();
      expect(result.actions.action1).toBeDefined();
      expect(result.summary.totalActions).toBe(1);
    });

    it('should handle verbosity levels correctly', () => {
      mockFilter.getVerbosityLevel.mockReturnValue('minimal');

      const trace = {
        actionId: 'test:action',
        actorId: 'test-actor',
        execution: {
          startTime: Date.now(),
        },
      };

      const result = JSON.parse(formatter.format(trace));

      // Minimal verbosity should not include execution details
      expect(result.execution).toBeUndefined();
    });

    it('should handle verbose verbosity level', () => {
      mockFilter.getVerbosityLevel.mockReturnValue('verbose');
      mockFilter.getInclusionConfig.mockReturnValue({
        componentData: true,
        prerequisites: true,
        targets: true,
      });

      const trace = {
        constructor: { name: 'ActionExecutionTrace' },
        actionId: 'test:action',
        actorId: 'test-actor',
        execution: {
          startTime: Date.now(),
          eventPayload: { type: 'TEST_EVENT', data: 'test' },
        },
      };

      const result = JSON.parse(formatter.format(trace));

      expect(result.eventPayload).toBeDefined();
      expect(result.eventPayload.type).toBe('TEST_EVENT');
    });

    it('should handle circular references', () => {
      const circularObj = { name: 'test' };
      circularObj.self = circularObj;

      const trace = {
        actionId: 'test:action',
        actorId: 'test-actor',
        data: circularObj,
      };

      const result = formatter.format(trace);
      expect(result).toContain('[Circular reference]');
    });

    it('should handle special types correctly', () => {
      const trace = {
        actionId: 'test:action',
        actorId: 'test-actor',
        specialData: {
          date: new Date('2024-01-01'),
          error: new Error('Test error'),
          map: new Map([['key', 'value']]),
          set: new Set(['item1', 'item2']),
          bigint: BigInt(12345),
        },
      };

      const result = JSON.parse(formatter.format(trace));

      // This is a generic trace, so data is wrapped in result.data
      expect(result.data.specialData.date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(result.data.specialData.error.message).toBe('Test error');
      expect(result.data.specialData.map.key).toBe('value');
      expect(result.data.specialData.set).toContain('item1');
      expect(result.data.specialData.bigint).toBe('12345');
    });

    it('should handle error traces', () => {
      const trace = {
        actionId: 'test:action',
        actorId: 'test-actor',
        execution: {
          error: {
            message: 'Test error',
            stack: 'Error stack trace',
            type: 'TestError',
          },
        },
      };

      const result = JSON.parse(formatter.format(trace));

      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Test error');
      expect(result.error.type).toBe('TestError');
    });

    it('should calculate stage timing correctly', () => {
      const tracedActions = new Map();
      tracedActions.set('action1', {
        actionId: 'action1',
        actorId: 'actor1',
        startTime: 1000,
        stages: {
          stage1: { timestamp: 1000 },
          stage2: { timestamp: 1100 },
          stage3: { timestamp: 1200 },
        },
      });

      const trace = {
        getTracedActions: jest.fn(() => tracedActions),
        getSpans: jest.fn(() => []),
      };

      const result = JSON.parse(formatter.format(trace));

      expect(result.actions.action1.timing.stage1.duration).toBe(100);
      expect(result.actions.action1.timing.stage2.duration).toBe(100);
      expect(result.actions.action1.timing.total).toBe(200);
    });

    it('should handle formatting errors gracefully', () => {
      const trace = {
        actionId: 'test:action',
        toJSON: jest.fn(() => {
          throw new Error('Format error');
        }),
      };

      // Mock circular reference to cause error
      jest.spyOn(JSON, 'stringify').mockImplementationOnce(() => {
        throw new Error('Stringify error');
      });

      const result = formatter.format(trace);
      const parsed = JSON.parse(result);

      expect(parsed.metadata.type).toBe('error');
      expect(parsed.error.message).toBe('Failed to format trace');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should format stage data based on inclusion config', () => {
      mockFilter.getInclusionConfig.mockReturnValue({
        componentData: true,
        prerequisites: false,
        targets: true,
      });

      const tracedActions = new Map();
      tracedActions.set('action1', {
        actionId: 'action1',
        actorId: 'actor1',
        startTime: Date.now(),
        stages: {
          component_filtering: {
            timestamp: Date.now(),
            data: {
              actorComponents: ['comp1', 'comp2'],
              candidateCount: 2,
            },
          },
          prerequisite_evaluation: {
            timestamp: Date.now(),
            data: {
              prerequisites: ['prereq1'],
              passed: true,
            },
          },
          target_resolution: {
            timestamp: Date.now(),
            data: {
              targetCount: 3,
              isLegacy: false,
            },
          },
        },
      });

      const trace = {
        getTracedActions: jest.fn(() => tracedActions),
        getSpans: jest.fn(() => []),
      };

      const result = JSON.parse(formatter.format(trace));
      const stages = result.actions.action1.stages;

      // Should include component data
      expect(stages.component_filtering).toBeDefined();
      expect(stages.component_filtering.actorComponents).toBeDefined();

      // Should not include prerequisite data
      expect(stages.prerequisite_evaluation.prerequisites).toBeUndefined();

      // Should include target data
      expect(stages.target_resolution.targetCount).toBe(3);
    });

    it('should handle different indentation levels based on verbosity', () => {
      mockFilter.getVerbosityLevel.mockReturnValue('minimal');

      const trace = {
        actionId: 'test:action',
        actorId: 'test-actor',
      };

      const result = formatter.format(trace);

      // Minimal should have no indentation
      expect(result).not.toContain('\n');

      mockFilter.getVerbosityLevel.mockReturnValue('detailed');
      const detailedResult = formatter.format(trace);

      // Detailed should have indentation
      expect(detailedResult).toContain('\n');
    });

    it('should format spans correctly', () => {
      const spans = [
        {
          name: 'span1',
          startTime: 1000,
          endTime: 1100,
          data: { test: 'data' },
        },
        {
          name: 'span2',
          startTime: 1100,
          endTime: 1300,
          data: { test: 'data2' },
        },
      ];

      const trace = {
        getTracedActions: jest.fn(() => new Map()),
        getSpans: jest.fn(() => spans),
      };

      mockFilter.getVerbosityLevel.mockReturnValue('standard');
      const result = JSON.parse(formatter.format(trace));

      expect(result.spans).toBeDefined();
      expect(result.spans[0].name).toBe('span1');
      expect(result.spans[0].duration).toBe(100);
      expect(result.spans[0].data).toBeUndefined(); // Not included in standard verbosity

      mockFilter.getVerbosityLevel.mockReturnValue('verbose');
      const verboseResult = JSON.parse(formatter.format(trace));

      expect(verboseResult.spans[0].data).toBeDefined(); // Included in verbose
    });
  });
});
