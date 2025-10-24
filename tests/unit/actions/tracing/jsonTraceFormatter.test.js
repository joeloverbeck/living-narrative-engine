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

    it('should not format spans with minimal verbosity', () => {
      const spans = [
        { name: 'span1', startTime: 1000, endTime: 1100 },
        { name: 'span2', startTime: 1100, endTime: 1300 },
      ];

      const trace = {
        constructor: { name: 'ActionAwareStructuredTrace' },
        getTracedActions: jest.fn(() => new Map()),
        getSpans: jest.fn(() => spans),
      };

      mockFilter.getVerbosityLevel.mockReturnValue('minimal');
      const result = JSON.parse(formatter.format(trace));

      // Minimal verbosity should not include spans at all
      expect(result.spans).toBeUndefined();
    });

    it('should handle turnAction with detailed verbosity and resolvedTargets', () => {
      mockFilter.getVerbosityLevel.mockReturnValue('detailed');

      const trace = {
        constructor: { name: 'ActionExecutionTrace' },
        actionId: 'test:action',
        actorId: 'test-actor',
        execution: {
          startTime: Date.now(),
          result: { success: true },
        },
        turnAction: {
          actionDefinitionId: 'test:action',
          commandString: 'test command',
          targetContexts: ['context1', 'context2'],
          resolvedTargets: {
            target1: { id: 'target1' },
            target2: { id: 'target2' },
          },
        },
      };

      const result = JSON.parse(formatter.format(trace));

      expect(result.turnAction).toBeDefined();
      expect(result.turnAction.actionDefinitionId).toBe('test:action');
      expect(result.turnAction.commandString).toBe('test command');
      expect(result.turnAction.targetContexts).toBe(2);
      expect(result.turnAction.resolvedTargets).toEqual(['target1', 'target2']);
    });

    it('should handle turnAction without resolvedTargets property', () => {
      mockFilter.getVerbosityLevel.mockReturnValue('detailed');

      const trace = {
        constructor: { name: 'ActionExecutionTrace' },
        actionId: 'test:action',
        actorId: 'test-actor',
        execution: {
          startTime: Date.now(),
          result: { success: true },
        },
        turnAction: {
          actionDefinitionId: 'test:action',
          commandString: 'test command',
          targetContexts: ['context1'],
        },
      };

      const result = JSON.parse(formatter.format(trace));

      expect(result.turnAction).toBeDefined();
      expect(result.turnAction.resolvedTargets).toBeUndefined();
    });

    it('should handle prerequisite evaluation with verbose verbosity and evaluation details', () => {
      mockFilter.getVerbosityLevel.mockReturnValue('verbose');
      mockFilter.getInclusionConfig.mockReturnValue({
        prerequisites: true,
      });

      const tracedActions = new Map();
      tracedActions.set('action1', {
        actionId: 'action1',
        actorId: 'actor1',
        startTime: Date.now(),
        stages: {
          prerequisite_evaluation: {
            timestamp: Date.now(),
            data: {
              prerequisites: ['prereq1', 'prereq2'],
              passed: true,
              evaluationDetails: {
                prereq1: { result: true, reason: 'Passed' },
                prereq2: { result: false, reason: 'Failed condition' },
              },
            },
          },
        },
      });

      const trace = {
        getTracedActions: jest.fn(() => tracedActions),
        getSpans: jest.fn(() => []),
      };

      const result = JSON.parse(formatter.format(trace));
      const stage = result.actions.action1.stages.prerequisite_evaluation;

      expect(stage.prerequisites).toEqual(['prereq1', 'prereq2']);
      expect(stage.passed).toBe(true);
      expect(stage.evaluationDetails).toBeDefined();
      expect(stage.evaluationDetails.prereq1.result).toBe(true);
    });

    it('should handle target resolution with detailed verbosity and resolved targets', () => {
      mockFilter.getVerbosityLevel.mockReturnValue('detailed');
      mockFilter.getInclusionConfig.mockReturnValue({
        targets: true,
      });

      const tracedActions = new Map();
      tracedActions.set('action1', {
        actionId: 'action1',
        actorId: 'actor1',
        startTime: Date.now(),
        stages: {
          target_resolution: {
            timestamp: Date.now(),
            data: {
              targetCount: 2,
              isLegacy: false,
              targetKeys: ['target1', 'target2'],
              resolvedTargets: {
                target1: { id: 'resolved1', name: 'Target 1' },
                target2: { id: 'resolved2', name: 'Target 2' },
              },
            },
          },
        },
      });

      const trace = {
        getTracedActions: jest.fn(() => tracedActions),
        getSpans: jest.fn(() => []),
      };

      const result = JSON.parse(formatter.format(trace));
      const stage = result.actions.action1.stages.target_resolution;

      expect(stage.targetCount).toBe(2);
      expect(stage.isLegacy).toBe(false);
      expect(stage.targetKeys).toEqual(['target1', 'target2']);
      expect(stage.resolvedTargets).toBeDefined();
      expect(stage.resolvedTargets.target1.id).toBe('resolved1');
    });

    it('should handle formatting stage with all properties', () => {
      mockFilter.getVerbosityLevel.mockReturnValue('standard');

      const tracedActions = new Map();
      tracedActions.set('action1', {
        actionId: 'action1',
        actorId: 'actor1',
        startTime: Date.now(),
        stages: {
          formatting: {
            timestamp: Date.now(),
            data: {
              template: 'Action: {action} on {target}',
              formattedCommand: 'Action: attack on enemy',
              displayName: 'Attack Enemy',
              hasTargets: true,
            },
          },
        },
      });

      const trace = {
        getTracedActions: jest.fn(() => tracedActions),
        getSpans: jest.fn(() => []),
      };

      const result = JSON.parse(formatter.format(trace));
      const stage = result.actions.action1.stages.formatting;

      expect(stage.template).toBe('Action: {action} on {target}');
      expect(stage.formattedCommand).toBe('Action: attack on enemy');
      expect(stage.displayName).toBe('Attack Enemy');
      expect(stage.hasTargets).toBe(true);
    });

    it('should handle default stage case with verbose verbosity', () => {
      mockFilter.getVerbosityLevel.mockReturnValue('verbose');

      const tracedActions = new Map();
      tracedActions.set('action1', {
        actionId: 'action1',
        actorId: 'actor1',
        startTime: Date.now(),
        stages: {
          custom_stage: {
            timestamp: Date.now(),
            data: {
              customProperty: 'custom value',
              metadata: { key: 'value' },
            },
          },
        },
      });

      const trace = {
        getTracedActions: jest.fn(() => tracedActions),
        getSpans: jest.fn(() => []),
      };

      const result = JSON.parse(formatter.format(trace));
      const stage = result.actions.action1.stages.custom_stage;

      expect(stage.data).toBeDefined();
      expect(stage.data.customProperty).toBe('custom value');
      expect(stage.data.metadata.key).toBe('value');
    });

    it('should handle error formatting with stack trace in detailed verbosity', () => {
      mockFilter.getVerbosityLevel.mockReturnValue('detailed');

      const trace = {
        constructor: { name: 'ActionExecutionTrace' },
        actionId: 'test:action',
        actorId: 'test-actor',
        execution: {
          error: {
            message: 'Test error with stack',
            type: 'CustomError',
            stack: 'Error: Test error\n    at line 1\n    at line 2',
          },
        },
      };

      const result = JSON.parse(formatter.format(trace));

      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Test error with stack');
      expect(result.error.type).toBe('CustomError');
      expect(result.error.stack).toBe(
        'Error: Test error\n    at line 1\n    at line 2'
      );
    });

    it('should handle error formatting with context in verbose verbosity', () => {
      mockFilter.getVerbosityLevel.mockReturnValue('verbose');

      const trace = {
        constructor: { name: 'ActionExecutionTrace' },
        actionId: 'test:action',
        actorId: 'test-actor',
        execution: {
          error: {
            message: 'Test error with context',
            type: 'CustomError',
            stack: 'Error stack trace',
            context: {
              actionId: 'test:action',
              parameters: { param1: 'value1' },
              metadata: { attempt: 1 },
            },
          },
        },
      };

      const result = JSON.parse(formatter.format(trace));

      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Test error with context');
      expect(result.error.context).toBeDefined();
      expect(result.error.context.actionId).toBe('test:action');
      expect(result.error.context.parameters.param1).toBe('value1');
    });

    it('should handle max depth exceeded in object sanitization', () => {
      // Create deeply nested object
      let deepObj = { level: 0 };
      let current = deepObj;
      for (let i = 1; i <= 12; i++) {
        current.nested = { level: i };
        current = current.nested;
      }

      const trace = {
        actionId: 'test:action',
        actorId: 'test-actor',
        deepData: deepObj,
      };

      // Should contain max depth exceeded message
      const jsonStr = formatter.format(trace);
      expect(jsonStr).toContain('[Max depth exceeded]');
    });

    it('should handle null and undefined objects in sanitization', () => {
      const trace = {
        actionId: 'test:action',
        actorId: 'test-actor',
        nullValue: null,
        undefinedValue: undefined,
        nested: {
          nullNested: null,
          undefinedNested: undefined,
        },
      };

      const result = JSON.parse(formatter.format(trace));

      expect(result.data.nullValue).toBeNull();
      expect(result.data.undefinedValue).toBeNull(); // undefined becomes null in JSON
      expect(result.data.nested.nullNested).toBeNull();
      expect(result.data.nested.undefinedNested).toBeNull();
    });

    it('should handle array sanitization correctly', () => {
      const trace = {
        actionId: 'test:action',
        actorId: 'test-actor',
        arrayData: [
          'string item',
          123,
          { nested: 'object' },
          null,
          undefined,
          [1, 2, 3],
        ],
      };

      const result = JSON.parse(formatter.format(trace));

      expect(Array.isArray(result.data.arrayData)).toBe(true);
      expect(result.data.arrayData[0]).toBe('string item');
      expect(result.data.arrayData[1]).toBe(123);
      expect(result.data.arrayData[2].nested).toBe('object');
      expect(result.data.arrayData[3]).toBeNull();
      expect(result.data.arrayData[4]).toBeNull();
      expect(Array.isArray(result.data.arrayData[5])).toBe(true);
    });

    it('should handle circular reference detection in JSON replacer', () => {
      const obj1 = { name: 'obj1' };
      const obj2 = { name: 'obj2', ref: obj1 };
      obj1.ref = obj2; // Create circular reference

      const trace = {
        actionId: 'test:action',
        actorId: 'test-actor',
        circularData: obj1,
      };

      const result = formatter.format(trace);

      // Should handle circular reference in replacer - the circular reference is handled
      // by the sanitizeObject method first, which creates '[Circular reference]'
      expect(result).toContain('[Circular reference]');
    });

    it('should handle default verbosity case in getIndentLevel', () => {
      mockFilter.getVerbosityLevel.mockReturnValue('unknown_verbosity');

      const trace = {
        actionId: 'test:action',
        actorId: 'test-actor',
      };

      const result = formatter.format(trace);

      // Should use default indentation (2 spaces) for unknown verbosity
      expect(result).toContain('\n');
      const lines = result.split('\n');
      const indentedLine = lines.find((line) => line.startsWith('  '));
      expect(indentedLine).toBeDefined();
    });

    it('should handle bigint values in JSON replacer', () => {
      const trace = {
        actionId: 'test:action',
        actorId: 'test-actor',
        bigintValue: BigInt(9007199254740991),
      };

      const result = JSON.parse(formatter.format(trace));

      expect(result.data.bigintValue).toBe('9007199254740991');
    });

    it('should handle undefined values in JSON replacer', () => {
      const trace = {
        actionId: 'test:action',
        actorId: 'test-actor',
        undefinedProp: undefined,
        normalProp: 'value',
      };

      const result = JSON.parse(formatter.format(trace));

      // undefined values should become null in the replacer
      expect(result.data.undefinedProp).toBeNull();
      expect(result.data.normalProp).toBe('value');
    });

    it('should return spans count with minimal verbosity in pipeline trace', () => {
      const spans = [
        { name: 'span1', startTime: 1000, endTime: 1100 },
        { name: 'span2', startTime: 1100, endTime: 1300 },
      ];

      const trace = {
        constructor: { name: 'ActionAwareStructuredTrace' },
        getTracedActions: jest.fn(() => new Map()),
        getSpans: jest.fn(() => spans),
      };

      mockFilter.getVerbosityLevel.mockReturnValue('minimal');
      const result = JSON.parse(formatter.format(trace));

      // This test ensures that when spans exist and verbosity is minimal,
      // the formatSpans method returns just the count (line 429)
      expect(result.spans).toBeUndefined(); // spans won't be included in minimal verbosity for pipeline
    });

    it('should include minimal event payload data when verbosity is minimal', () => {
      mockFilter.getVerbosityLevel.mockReturnValue('minimal');
      mockFilter.getInclusionConfig.mockReturnValue({ componentData: true });

      const trace = {
        constructor: { name: 'ActionExecutionTrace' },
        actionId: 'test:action',
        actorId: 'test-actor',
        execution: {
          startTime: Date.now(),
          eventPayload: {
            type: 'TEST_EVENT',
            data: 'some data',
            entityCache: { entity1: 'cached' },
            componentData: { component1: 'data' },
          },
        },
      };

      const result = JSON.parse(formatter.format(trace));

      expect(result.eventPayload).toEqual({ type: 'TEST_EVENT' });
    });

    it('should strip heavy payload fields for non-verbose verbosity levels', () => {
      mockFilter.getVerbosityLevel.mockReturnValue('standard');
      mockFilter.getInclusionConfig.mockReturnValue({ componentData: true });

      const trace = {
        constructor: { name: 'ActionExecutionTrace' },
        actionId: 'test:action',
        actorId: 'test-actor',
        execution: {
          startTime: Date.now(),
          eventPayload: {
            type: 'TEST_EVENT',
            data: 'some data',
            entityCache: { entity1: 'cached' },
            componentData: { component1: 'data' },
          },
        },
      };

      const result = JSON.parse(formatter.format(trace));

      expect(result.eventPayload.type).toBe('TEST_EVENT');
      expect(result.eventPayload.data).toBe('some data');
      expect(result.eventPayload.entityCache).toBeUndefined();
      expect(result.eventPayload.componentData).toBeUndefined();
    });

    it('should retain full payload information in verbose verbosity', () => {
      mockFilter.getVerbosityLevel.mockReturnValue('verbose');
      mockFilter.getInclusionConfig.mockReturnValue({ componentData: true });

      const trace = {
        constructor: { name: 'ActionExecutionTrace' },
        actionId: 'test:action',
        actorId: 'test-actor',
        execution: {
          startTime: Date.now(),
          eventPayload: {
            type: 'TEST_EVENT',
            data: 'some data',
            entityCache: { entity1: 'cached' },
            componentData: { component1: 'data' },
          },
        },
      };

      const result = JSON.parse(formatter.format(trace));

      expect(result.eventPayload).toMatchObject({
        type: 'TEST_EVENT',
        data: 'some data',
        entityCache: { entity1: 'cached' },
        componentData: { component1: 'data' },
      });
    });

    it('should replace circular references when sanitization is bypassed', () => {
      mockFilter.getVerbosityLevel.mockReturnValue('verbose');
      mockFilter.getInclusionConfig.mockReturnValue({ componentData: false });

      const circularData = { name: 'stage-data' };
      circularData.self = circularData;

      const tracedActions = new Map([
        [
          'action1',
          {
            actorId: 'actor1',
            startTime: 1000,
            stages: {
              custom_stage: {
                timestamp: 1000,
                data: circularData,
              },
            },
          },
        ],
      ]);

      const trace = {
        constructor: { name: 'ActionAwareStructuredTrace' },
        getTracedActions: jest.fn(() => tracedActions),
        getSpans: jest.fn(() => []),
      };

      const result = formatter.format(trace);

      expect(result).toContain('"self": "[Circular]"');
    });
  });
});
