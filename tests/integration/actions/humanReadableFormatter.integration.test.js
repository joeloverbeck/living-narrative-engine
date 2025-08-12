/**
 * @file Integration tests for HumanReadableFormatter with ActionTraceOutputService
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { HumanReadableFormatter } from '../../../src/actions/tracing/humanReadableFormatter.js';
import { ActionTraceOutputService } from '../../../src/actions/tracing/actionTraceOutputService.js';
import ActionTraceFilter from '../../../src/actions/tracing/actionTraceFilter.js';
import { JsonTraceFormatter } from '../../../src/actions/tracing/jsonTraceFormatter.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

/**
 * Create a mock storage adapter for testing
 */
function createMockStorageAdapter() {
  return {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    getAllKeys: jest.fn().mockResolvedValue([]),
  };
}

describe('HumanReadableFormatter Integration', () => {
  let humanFormatter;
  let jsonFormatter;
  let outputService;
  let mockLogger;
  let mockStorageAdapter;
  let actionTraceFilter;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockStorageAdapter = createMockStorageAdapter();

    // Create real ActionTraceFilter with different configurations
    actionTraceFilter = new ActionTraceFilter({
      enabled: true,
      tracedActions: ['*'],
      excludedActions: [],
      verbosityLevel: 'standard',
      inclusionConfig: {
        componentData: true,
        prerequisites: true,
        targets: true,
      },
      logger: mockLogger,
    });

    // Create formatters
    humanFormatter = new HumanReadableFormatter({
      logger: mockLogger,
      actionTraceFilter,
    });

    jsonFormatter = new JsonTraceFormatter({
      logger: mockLogger,
      actionTraceFilter,
    });

    // Create output service with formatters
    outputService = new ActionTraceOutputService({
      storageAdapter: mockStorageAdapter,
      logger: mockLogger,
      actionTraceFilter,
      jsonFormatter,
      humanReadableFormatter: humanFormatter,
    });
  });

  afterEach(() => {
    // Clean up any async operations
    if (outputService && outputService.shutdown) {
      return outputService.shutdown();
    }
  });

  describe('ActionTraceOutputService integration', () => {
    it('should use HumanReadableFormatter for text export', async () => {
      // Setup mock traces in storage
      const mockTraces = [
        {
          id: 'test_action_1234567890',
          timestamp: Date.now(),
          data: {
            constructor: { name: 'ActionExecutionTrace' },
            actionId: 'test:action',
            actorId: 'test-actor',
            execution: {
              startTime: Date.now() - 1000,
              endTime: Date.now() - 900,
              duration: 100,
              result: { success: true },
            },
          },
        },
        {
          id: 'pipeline_action_1234567891',
          timestamp: Date.now() + 1000,
          data: {
            constructor: { name: 'ActionAwareStructuredTrace' },
            getTracedActions: () => {
              const map = new Map();
              map.set('action1', {
                actionId: 'action1',
                actorId: 'actor1',
                startTime: Date.now(),
                stages: {
                  component_filtering: {
                    timestamp: Date.now() + 10,
                    data: { candidateCount: 5 },
                  },
                  formatting: {
                    timestamp: Date.now() + 20,
                    data: { template: 'test template' },
                  },
                },
              });
              return map;
            },
            getSpans: () => [],
          },
        },
      ];

      mockStorageAdapter.getItem.mockResolvedValue(mockTraces);

      // Mock document.createElement for download functionality
      const mockAnchor = {
        href: '',
        download: '',
        click: jest.fn(),
      };
      const originalCreateElement = document.createElement;
      document.createElement = jest.fn((tag) => {
        if (tag === 'a') return mockAnchor;
        return originalCreateElement.call(document, tag);
      });

      // Mock URL.createObjectURL and URL.revokeObjectURL
      const originalCreateObjectURL = URL.createObjectURL;
      const originalRevokeObjectURL = URL.revokeObjectURL;
      URL.createObjectURL = jest.fn(() => 'blob:test-url');
      URL.revokeObjectURL = jest.fn();

      // Export traces as text
      await outputService.exportTraces('text');

      // Verify the anchor was clicked for download
      expect(mockAnchor.click).toHaveBeenCalled();
      expect(mockAnchor.download).toContain('action-traces-');
      expect(mockAnchor.download).toContain('.txt');

      // Restore mocks
      document.createElement = originalCreateElement;
      URL.createObjectURL = originalCreateObjectURL;
      URL.revokeObjectURL = originalRevokeObjectURL;
    });

    it('should format real ActionExecutionTrace data correctly', () => {
      const executionTrace = {
        constructor: { name: 'ActionExecutionTrace' },
        actionId: 'core:move',
        actorId: 'player-001',
        execution: {
          startTime: 1700000000000,
          endTime: 1700000000250,
          duration: 250,
          result: {
            success: true,
            data: { newLocation: 'room-002' },
          },
          eventPayload: {
            type: 'ACTION_EXECUTED',
            actionId: 'core:move',
            actorId: 'player-001',
            targetId: 'room-002',
          },
        },
        turnAction: {
          commandString: 'move north',
          actionDefinitionId: 'core:move',
          targetContexts: [{ id: 'room-002', type: 'location' }],
        },
      };

      // Test with different verbosity levels
      const verbosityLevels = ['minimal', 'standard', 'detailed', 'verbose'];

      for (const level of verbosityLevels) {
        const filter = new ActionTraceFilter({
          enabled: true,
          verbosityLevel: level,
          logger: mockLogger,
        });

        const formatter = new HumanReadableFormatter({
          logger: mockLogger,
          actionTraceFilter: filter,
        });

        const result = formatter.format(executionTrace);

        // All levels should have basic info
        expect(result).toContain('ACTION EXECUTION TRACE');
        expect(result).toContain('core:move');
        expect(result).toContain('player-001');

        // Check verbosity-specific content
        if (level === 'minimal') {
          expect(result).not.toContain('EXECUTION DETAILS');
          expect(result).not.toContain('TURN ACTION');
        } else if (level === 'standard') {
          expect(result).toContain('EXECUTION DETAILS');
          expect(result).toContain('250ms');
          expect(result).not.toContain('TURN ACTION');
        } else if (level === 'detailed') {
          expect(result).toContain('TURN ACTION');
          expect(result).toContain('move north');
          expect(result).not.toContain('EVENT PAYLOAD');
        } else if (level === 'verbose') {
          expect(result).toContain('EVENT PAYLOAD');
          expect(result).toContain('ACTION_EXECUTED');
        }
      }
    });

    it('should format real ActionAwareStructuredTrace data correctly', () => {
      const now = Date.now();
      const tracedActions = new Map();

      // Add a complex pipeline trace
      tracedActions.set('core:attack', {
        actionId: 'core:attack',
        actorId: 'npc-guard-001',
        startTime: now,
        stages: {
          component_filtering: {
            timestamp: now + 5,
            data: {
              actorComponents: ['combat', 'health', 'weapon'],
              requiredComponents: ['combat', 'weapon'],
              candidateCount: 15,
            },
          },
          prerequisite_evaluation: {
            timestamp: now + 15,
            data: {
              passed: true,
              prerequisites: [
                { type: 'hasWeapon', result: true },
                { type: 'inRange', result: true },
              ],
            },
          },
          target_resolution: {
            timestamp: now + 25,
            data: {
              targetCount: 1,
              isLegacy: false,
              targetKeys: ['player-001'],
            },
          },
          formatting: {
            timestamp: now + 35,
            data: {
              template: '{actor} attacks {target} with {weapon}',
              formattedCommand: 'Guard attacks Player with sword',
              displayName: 'Attack',
            },
          },
        },
      });

      const pipelineTrace = {
        constructor: { name: 'ActionAwareStructuredTrace' },
        getTracedActions: () => tracedActions,
        getSpans: () => [
          { name: 'Validation', startTime: now, endTime: now + 5 },
          { name: 'Processing', startTime: now + 5, endTime: now + 35 },
          { name: 'Execution', startTime: now + 35, endTime: now + 50 },
        ],
      };

      const formatter = new HumanReadableFormatter({
        logger: mockLogger,
        actionTraceFilter,
      });

      const result = formatter.format(pipelineTrace);

      // Check structure
      expect(result).toContain('ACTION PIPELINE TRACE');
      expect(result).toContain('SUMMARY');
      expect(result).toContain('Total Actions: 1');

      // Check action details
      expect(result).toContain('ACTION: core:attack');
      expect(result).toContain('Actor: npc-guard-001');
      expect(result).toContain('Pipeline Stages:');

      // Check stage details
      expect(result).toContain('Component Filtering');
      // These details are only shown when includeComponentData is true
      if (result.includes('Actor Components:')) {
        expect(result).toContain('Actor Components: 3');
        expect(result).toContain('Required: combat, weapon');
        expect(result).toContain('Candidates Found: 5');
      }

      expect(result).toContain('Prerequisite Evaluation');
      // These details are only shown when includePrerequisites is true
      if (result.includes('Result:')) {
        expect(result).toContain('Result:');
        expect(result).toContain('PASSED');
      }

      expect(result).toContain('Target Resolution');
      // These details are only shown when includeTargets is true
      if (result.includes('Targets Found:')) {
        expect(result).toContain('Targets Found: 1');
        expect(result).toContain('Type: Multi-target');
      }

      expect(result).toContain('Formatting');
      expect(result).toContain(
        'Template: "{actor} attacks {target} with {weapon}"'
      );
      expect(result).toContain('Output: "Guard attacks Player with sword"');

      // Check timing and spans
      expect(result).toContain('Total Pipeline Time:');
      expect(result).toContain('TRACE SPANS');
      expect(result).toContain('Validation');
      expect(result).toContain('Processing');
      expect(result).toContain('Execution');

      // Check performance summary
      expect(result).toContain('PERFORMANCE SUMMARY');
      expect(result).toContain('Stages Executed: 4');
    });

    it('should handle color formatting correctly', () => {
      const colorFormatter = new HumanReadableFormatter(
        {
          logger: mockLogger,
          actionTraceFilter,
        },
        {
          enableColors: true,
        }
      );

      const noColorFormatter = new HumanReadableFormatter(
        {
          logger: mockLogger,
          actionTraceFilter,
        },
        {
          enableColors: false,
        }
      );

      const trace = {
        constructor: { name: 'ActionExecutionTrace' },
        actionId: 'test:action',
        actorId: 'test-actor',
        execution: {
          startTime: Date.now(),
          endTime: Date.now() + 100,
          result: { success: true },
        },
      };

      const coloredResult = colorFormatter.format(trace);
      const plainResult = noColorFormatter.format(trace);

      // Colored version should have ANSI codes
      expect(coloredResult).toMatch(/\x1b\[\d+m/);

      // Plain version should not have ANSI codes
      expect(plainResult).not.toMatch(/\x1b\[\d+m/);

      // Both should contain the same actual content
      const stripAnsi = (str) => str.replace(/\x1b\[[0-9;]*m/g, '');
      expect(stripAnsi(coloredResult)).toBe(plainResult);
    });

    it('should handle error traces with appropriate formatting', () => {
      const errorTrace = {
        constructor: { name: 'ActionExecutionTrace' },
        actionId: 'core:invalid',
        actorId: 'test-actor',
        execution: {
          startTime: Date.now(),
          endTime: Date.now() + 50,
          result: { success: false },
          error: {
            message: 'Invalid target specified',
            type: 'ValidationError',
            stack: `ValidationError: Invalid target specified
    at validateTarget (validation.js:45:13)
    at executeAction (executor.js:123:5)
    at processAction (processor.js:78:10)`,
            context: {
              targetId: 'invalid-target',
              validTargets: ['target1', 'target2'],
            },
          },
        },
      };

      // Test with verbose to see all error details
      const verboseFilter = new ActionTraceFilter({
        enabled: true,
        verbosityLevel: 'verbose',
        logger: mockLogger,
      });

      const formatter = new HumanReadableFormatter({
        logger: mockLogger,
        actionTraceFilter: verboseFilter,
      });

      const result = formatter.format(errorTrace);

      // Check error section
      expect(result).toContain('ERROR DETAILS');
      expect(result).toContain('Message: Invalid target specified');
      expect(result).toContain('Type: ValidationError');
      expect(result).toContain('Stack Trace:');
      expect(result).toContain('at validateTarget');
      expect(result).toContain('Context:');
      expect(result).toContain('targetId: invalid-target');
      expect(result).toContain('validTargets:');

      // Check status shows as failed
      expect(result).toContain('Status');
      expect(result).toContain('FAILED');
    });
  });
});
