/**
 * @file Integration tests for JsonTraceFormatter
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { JsonTraceFormatter } from '../../../../src/actions/tracing/jsonTraceFormatter.js';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import {
  createMockActionExecutionTrace,
  createMockActionTraceFilter,
} from '../../../common/mockFactories/actionTracing.js';

describe('JsonTraceFormatter - Integration', () => {
  let formatter;
  let logger;
  let actionTraceFilter;

  beforeEach(() => {
    logger = createMockLogger();
    actionTraceFilter = new ActionTraceFilter({
      enabled: true,
      tracedActions: ['*'],
      excludedActions: [],
      verbosityLevel: 'standard',
      inclusionConfig: {
        componentData: false,
        prerequisites: false,
        targets: false,
      },
      logger,
    });

    formatter = new JsonTraceFormatter({
      logger,
      actionTraceFilter,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ActionExecutionTrace formatting', () => {
    it('should format complete execution trace with all verbosity levels', () => {
      const mockTrace = createMockActionExecutionTrace();
      mockTrace.execution = {
        startTime: Date.now(),
        endTime: Date.now() + 500,
        duration: 500,
        result: { success: true },
        eventPayload: {
          type: 'ACTION_EXECUTED',
          payload: { data: 'test' },
        },
      };
      mockTrace.turnAction = {
        actionDefinitionId: 'test:action',
        commandString: 'test command',
        targetContexts: ['target1', 'target2'],
        resolvedTargets: { target1: 'entity1', target2: 'entity2' },
      };

      // Test minimal verbosity
      actionTraceFilter.setVerbosityLevel('minimal');
      const minimalResult = JSON.parse(formatter.format(mockTrace));
      expect(minimalResult.metadata.type).toBe('execution');
      expect(minimalResult.actionId).toBe('test:action');
      expect(minimalResult.execution).toBeUndefined();

      // Test standard verbosity
      actionTraceFilter.setVerbosityLevel('standard');
      const standardResult = JSON.parse(formatter.format(mockTrace));
      expect(standardResult.execution).toBeDefined();
      expect(standardResult.execution.status).toBe('success');
      expect(standardResult.turnAction).toBeUndefined();

      // Test detailed verbosity
      actionTraceFilter.setVerbosityLevel('detailed');
      const detailedResult = JSON.parse(formatter.format(mockTrace));
      expect(detailedResult.turnAction).toBeDefined();
      expect(detailedResult.turnAction.commandString).toBe('test command');

      // Test verbose verbosity with component data
      actionTraceFilter.setVerbosityLevel('verbose');
      actionTraceFilter.updateInclusionConfig({ componentData: true });
      const verboseResult = JSON.parse(formatter.format(mockTrace));
      expect(verboseResult.eventPayload).toBeDefined();
      expect(verboseResult.eventPayload.type).toBe('ACTION_EXECUTED');
    });

    it('should handle execution trace with error', () => {
      const mockTrace = createMockActionExecutionTrace();
      const testError = new Error('Test execution error');
      testError.stack = 'Error stack trace here';

      mockTrace.execution = {
        startTime: Date.now(),
        endTime: Date.now() + 100,
        duration: 100,
        result: { success: false },
        error: testError,
      };
      mockTrace.hasError = true;

      actionTraceFilter.setVerbosityLevel('detailed');
      const result = JSON.parse(formatter.format(mockTrace));

      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('Test execution error');
      expect(result.error.stack).toBeDefined();
      expect(result.execution.status).toBe('failed');
    });
  });

  describe('ActionAwareStructuredTrace formatting', () => {
    it('should format complete pipeline trace with multiple actions', () => {
      const tracedActions = new Map();

      // Add multiple actions with different stages
      tracedActions.set('action1', {
        actionId: 'action1',
        actorId: 'actor1',
        startTime: 1000,
        stages: {
          component_filtering: {
            timestamp: 1000,
            data: {
              actorComponents: ['health', 'position'],
              requiredComponents: ['health'],
              candidateCount: 5,
            },
          },
          prerequisite_evaluation: {
            timestamp: 1100,
            data: {
              prerequisites: ['hasEnoughHealth', 'isInRange'],
              passed: true,
              evaluationDetails: { health: 100, range: 5 },
            },
          },
          target_resolution: {
            timestamp: 1200,
            data: {
              targetCount: 2,
              isLegacy: false,
              targetKeys: ['enemy1', 'enemy2'],
              resolvedTargets: {
                enemy1: 'entity123',
                enemy2: 'entity456',
              },
            },
          },
          formatting: {
            timestamp: 1300,
            data: {
              template: 'Attack {target}',
              formattedCommand: 'Attack enemy',
              displayName: 'Attack',
              hasTargets: true,
            },
          },
        },
      });

      tracedActions.set('action2', {
        actionId: 'action2',
        actorId: 'actor1',
        startTime: 1400,
        stages: {
          component_filtering: {
            timestamp: 1400,
            data: { candidateCount: 3 },
          },
          formatting: {
            timestamp: 1500,
            data: {
              template: 'Move {direction}',
              formattedCommand: 'Move north',
            },
          },
        },
      });

      const mockTrace = {
        getTracedActions: jest.fn(() => tracedActions),
        getSpans: jest.fn(() => [
          { name: 'action1', startTime: 1000, endTime: 1300 },
          { name: 'action2', startTime: 1400, endTime: 1500 },
        ]),
      };

      // Test with different inclusion configs
      actionTraceFilter.setVerbosityLevel('detailed');
      actionTraceFilter.updateInclusionConfig({
        componentData: true,
        prerequisites: true,
        targets: true,
      });

      const result = JSON.parse(formatter.format(mockTrace));

      expect(result.metadata.type).toBe('pipeline');
      expect(result.actions.action1).toBeDefined();
      expect(result.actions.action2).toBeDefined();

      // Check stage data inclusion
      const action1Stages = result.actions.action1.stages;
      expect(action1Stages.component_filtering.actorComponents).toEqual([
        'health',
        'position',
      ]);
      expect(action1Stages.prerequisite_evaluation.prerequisites).toEqual([
        'hasEnoughHealth',
        'isInRange',
      ]);
      expect(action1Stages.target_resolution.targetCount).toBe(2);
      expect(action1Stages.target_resolution.resolvedTargets).toBeDefined();

      // Check timing calculations
      expect(result.actions.action1.timing.component_filtering.duration).toBe(
        100
      );
      expect(result.actions.action1.timing.total).toBe(300);

      // Check summary
      expect(result.summary.totalActions).toBe(2);
      expect(result.summary.stages).toContain('component_filtering');
      expect(result.summary.stages).toContain('formatting');
      expect(result.summary.avgDuration).toBeGreaterThan(0);
    });

    it('should handle pipeline trace with no inclusion config', () => {
      actionTraceFilter.updateInclusionConfig({
        componentData: false,
        prerequisites: false,
        targets: false,
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
              actorComponents: ['comp1'],
              candidateCount: 1,
            },
          },
          prerequisite_evaluation: {
            timestamp: Date.now() + 100,
            data: {
              prerequisites: ['prereq1'],
              passed: true,
            },
          },
          target_resolution: {
            timestamp: Date.now() + 200,
            data: {
              targetCount: 1,
              isLegacy: false,
            },
          },
        },
      });

      const mockTrace = {
        getTracedActions: jest.fn(() => tracedActions),
        getSpans: jest.fn(() => []),
      };

      const result = JSON.parse(formatter.format(mockTrace));
      const stages = result.actions.action1.stages;

      // Should not include data when config is false
      expect(stages.component_filtering.actorComponents).toBeUndefined();
      expect(stages.prerequisite_evaluation.prerequisites).toBeUndefined();
      expect(stages.target_resolution.targetCount).toBeUndefined();
    });
  });

  describe('Real trace data compatibility', () => {
    it('should handle complex nested objects and arrays', () => {
      const complexTrace = {
        actionId: 'complex:action',
        actorId: 'complex-actor',
        execution: {
          startTime: Date.now(),
          eventPayload: {
            type: 'COMPLEX_EVENT',
            nested: {
              level1: {
                level2: {
                  level3: {
                    data: ['item1', 'item2'],
                    map: new Map([['key', 'value']]),
                  },
                },
              },
            },
            array: [
              { id: 1, name: 'first' },
              { id: 2, name: 'second' },
            ],
          },
        },
      };

      actionTraceFilter.setVerbosityLevel('verbose');
      actionTraceFilter.updateInclusionConfig({ componentData: true });

      const result = JSON.parse(formatter.format(complexTrace));

      expect(result.eventPayload.nested.level1.level2.level3.data).toEqual([
        'item1',
        'item2',
      ]);
      expect(result.eventPayload.nested.level1.level2.level3.map.key).toBe(
        'value'
      );
      expect(result.eventPayload.array).toHaveLength(2);
    });

    it('should validate output against JSON schema structure', () => {
      const trace = {
        actionId: 'schema:test',
        actorId: 'schema-actor',
        execution: {
          startTime: Date.now(),
          endTime: Date.now() + 100,
          duration: 100,
          result: { success: true },
        },
      };

      const result = JSON.parse(formatter.format(trace));

      // Validate required schema fields
      expect(result.metadata).toBeDefined();
      expect(result.metadata.version).toBeDefined();
      expect(result.metadata.type).toMatch(
        /^(execution|pipeline|generic|error)$/
      );
      expect(result.metadata.generated).toBeDefined();
      expect(result.timestamp).toBeDefined();

      // Validate ISO date format
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(() => new Date(result.metadata.generated)).not.toThrow();
    });
  });

  describe('Error handling and recovery', () => {
    it('should recover from partial formatting failures', () => {
      const tracedActions = new Map();

      // Add action with problematic data
      const problematicData = {
        actionId: 'action1',
        actorId: 'actor1',
        startTime: 1000,
        stages: {
          badStage: {
            timestamp: 'not-a-number', // Invalid timestamp
            data: undefined,
          },
        },
      };

      tracedActions.set('action1', problematicData);

      const mockTrace = {
        getTracedActions: jest.fn(() => tracedActions),
        getSpans: jest.fn(() => []),
      };

      const result = formatter.format(mockTrace);

      // Should still produce valid JSON
      expect(() => JSON.parse(result)).not.toThrow();
    });

    it('should handle traces with missing methods gracefully', () => {
      const incompleteTrace = {
        actionId: 'incomplete:action',
        // Missing expected methods
      };

      const result = JSON.parse(formatter.format(incompleteTrace));

      expect(result.metadata.type).toBe('generic');
      expect(result.data).toBeDefined();
    });
  });

  describe('Edge case coverage', () => {
    const buildDeepNestedObject = () => {
      const root = {};
      let current = root;
      for (let i = 0; i < 12; i++) {
        current.next = {};
        current = current.next;
      }
      return root;
    };

    const walkToTerminalDepth = (value) => {
      let current = value;
      let steps = 0;

      while (
        current &&
        typeof current === 'object' &&
        'next' in current &&
        steps < 30
      ) {
        current = current.next;
        steps += 1;
      }

      return { terminal: current, steps };
    };

    const createComplexExecutionTrace = () => {
      const trace = createMockActionExecutionTrace();

      const payloadCircular = { name: 'payload-circular' };
      payloadCircular.self = payloadCircular;

      const payloadNestedError = new Error('Nested payload error');

      const executionError = new Error('Execution failure for sanitization');
      const contextCircular = { tag: 'context-circular' };
      contextCircular.self = contextCircular;

      executionError.context = {
        nullable: null,
        timestamp: new Date('2024-02-02T00:00:00Z'),
        deep: buildDeepNestedObject(),
        items: new Set(['ctx-one', 'ctx-two']),
        circular: contextCircular,
        nestedError: new Error('Inner context error'),
      };

      trace.execution = {
        startTime: Date.now(),
        endTime: Date.now() + 25,
        duration: 25,
        result: { success: false },
        eventPayload: {
          type: 'COMPLEX_EVENT',
          entityCache: { shouldRemove: true },
          componentData: { shouldRemove: true },
          mapping: new Map([
            ['alpha', { id: 1 }],
            ['beta', { id: 2 }],
          ]),
          timestamp: new Date('2024-01-01T00:00:00Z'),
          deep: buildDeepNestedObject(),
          circular: payloadCircular,
          nullable: null,
          items: new Set(['alpha', 'beta']),
          nested: { innerError: payloadNestedError },
        },
        error: executionError,
      };

      return trace;
    };

    it('should warn and return empty JSON when null trace is provided', () => {
      const result = formatter.format(null);

      expect(result).toBe('{}');
      expect(logger.warn).toHaveBeenCalledWith(
        'JsonTraceFormatter: Null trace provided'
      );
    });

    it('should return error metadata when formatting throws unexpectedly', () => {
      const failingTrace = {
        constructor: { name: 'ActionAwareStructuredTrace' },
        actionId: 'broken:trace',
        getTracedActions: () => {
          throw new Error('Intentional failure');
        },
      };

      const result = formatter.format(failingTrace);

      expect(logger.error).toHaveBeenCalledWith(
        'JsonTraceFormatter: Formatting error',
        expect.any(Error)
      );

      const parsed = JSON.parse(result);
      expect(parsed.metadata.type).toBe('error');
      expect(parsed.error.details).toBe('Intentional failure');
      expect(parsed.rawTrace.actionId).toBe('broken:trace');
    });

    it('should include verbose prerequisite details and handle complex stage data', () => {
      actionTraceFilter.setVerbosityLevel('verbose');
      actionTraceFilter.updateInclusionConfig({ prerequisites: true });

      const tracedActions = new Map();
      const circularStageData = { stageName: 'custom' };
      circularStageData.self = circularStageData;
      circularStageData.bigValue = BigInt('987654321');

      tracedActions.set('complex-action', {
        actionId: 'complex-action',
        actorId: 'actor-99',
        startTime: 2000,
        stages: {
          prerequisite_evaluation: {
            timestamp: 2100,
            data: {
              prerequisites: ['ready'],
              passed: true,
              evaluationDetails: { readiness: 'confirmed' },
            },
          },
          custom_stage: {
            timestamp: 2200,
            data: circularStageData,
          },
        },
      });

      const pipelineTrace = {
        constructor: { name: 'ActionAwareStructuredTrace' },
        getTracedActions: () => tracedActions,
        getSpans: () => [],
      };

      const result = JSON.parse(formatter.format(pipelineTrace));
      const stages = result.actions['complex-action'].stages;

      expect(stages.prerequisite_evaluation.evaluationDetails).toEqual({
        readiness: 'confirmed',
      });
      expect(stages.custom_stage.data.bigValue).toBe('987654321');
      expect(stages.custom_stage.data.self).toBe('[Circular]');
    });

    it('should sanitize event payloads and error context across verbosity levels', () => {
      actionTraceFilter.updateInclusionConfig({ componentData: true });

      actionTraceFilter.setVerbosityLevel('minimal');
      const minimalTrace = createComplexExecutionTrace();
      const minimalResult = JSON.parse(formatter.format(minimalTrace));
      expect(minimalResult.eventPayload).toEqual({ type: 'COMPLEX_EVENT' });

      actionTraceFilter.setVerbosityLevel('standard');
      const standardTrace = createComplexExecutionTrace();
      const standardResult = JSON.parse(formatter.format(standardTrace));
      const sanitizedPayload = standardResult.eventPayload;

      expect(sanitizedPayload.entityCache).toBeUndefined();
      expect(sanitizedPayload.componentData).toBeUndefined();
      expect(sanitizedPayload.timestamp).toBe('2024-01-01T00:00:00.000Z');
      expect(sanitizedPayload.circular.self).toBe('[Circular reference]');
      expect(sanitizedPayload.items).toEqual(['alpha', 'beta']);
      expect(sanitizedPayload.nullable).toBeNull();
      expect(sanitizedPayload.nested.innerError.message).toBe(
        'Nested payload error'
      );
      expect(sanitizedPayload.mapping.alpha).toEqual({ id: 1 });

      const payloadDepth = walkToTerminalDepth(sanitizedPayload.deep);
      expect(payloadDepth.terminal).toBe('[Max depth exceeded]');
      expect(payloadDepth.steps).toBeGreaterThan(0);

      actionTraceFilter.setVerbosityLevel('verbose');
      const verboseTrace = createComplexExecutionTrace();
      const verboseResult = JSON.parse(formatter.format(verboseTrace));

      expect(verboseResult.eventPayload.entityCache).toEqual({
        shouldRemove: true,
      });
      expect(verboseResult.error.context.items).toEqual(['ctx-one', 'ctx-two']);
      expect(verboseResult.error.context.circular.self).toBe('[Circular reference]');
      const contextDepth = walkToTerminalDepth(
        verboseResult.error.context.deep
      );
      expect(contextDepth.terminal).toBe('[Max depth exceeded]');
      expect(contextDepth.steps).toBeGreaterThan(0);
      expect(verboseResult.error.context.nestedError.message).toBe(
        'Inner context error'
      );
      expect(verboseResult.error.context.timestamp).toBe(
        '2024-02-02T00:00:00.000Z'
      );
    });

    it('should default to standard indentation for unknown verbosity levels', () => {
      const indentSpy = jest
        .spyOn(actionTraceFilter, 'getVerbosityLevel')
        .mockReturnValue('experimental');

      const genericTrace = { foo: 'bar' };
      const output = formatter.format(genericTrace);

      expect(indentSpy).toHaveBeenCalled();
      expect(output).toContain('\n  "metadata"');
    });
  });
});
