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

    it('should handle large traces with acceptable performance', () => {
      const largeTracedActions = new Map();

      // Create a large number of actions
      for (let i = 0; i < 100; i++) {
        largeTracedActions.set(`action${i}`, {
          actionId: `action${i}`,
          actorId: `actor${i}`,
          startTime: Date.now() + i * 100,
          stages: {
            stage1: { timestamp: Date.now() + i * 100 },
            stage2: { timestamp: Date.now() + i * 100 + 50 },
          },
        });
      }

      const mockTrace = {
        getTracedActions: jest.fn(() => largeTracedActions),
        getSpans: jest.fn(() => []),
      };

      const startTime = Date.now();
      const result = JSON.parse(formatter.format(mockTrace));
      const duration = Date.now() - startTime;

      expect(result.actions).toBeDefined();
      expect(Object.keys(result.actions)).toHaveLength(100);
      expect(result.summary.totalActions).toBe(100);

      // Should complete in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
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
});
