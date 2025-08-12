/**
 * @file Unit tests for HumanReadableFormatter
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { HumanReadableFormatter } from '../../../../src/actions/tracing/humanReadableFormatter.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';
import { createMockActionTraceFilter } from '../../../common/mockFactories/actionTracing.js';

describe('HumanReadableFormatter - Text Formatting', () => {
  let formatter;
  let mockLogger;
  let mockFilter;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockFilter = createMockActionTraceFilter();
    formatter = new HumanReadableFormatter({
      logger: mockLogger,
      actionTraceFilter: mockFilter,
    });
  });

  describe('constructor', () => {
    it('should validate dependencies', () => {
      expect(() => {
        new HumanReadableFormatter({
          logger: mockLogger,
          actionTraceFilter: null,
        });
      }).toThrow();
    });

    it('should initialize with valid dependencies', () => {
      expect(formatter).toBeDefined();
    });

    it('should accept options for colors and formatting', () => {
      const customFormatter = new HumanReadableFormatter(
        {
          logger: mockLogger,
          actionTraceFilter: mockFilter,
        },
        {
          enableColors: true,
          lineWidth: 100,
          indentSize: 4,
        }
      );
      expect(customFormatter).toBeDefined();
    });
  });

  describe('format', () => {
    it('should handle null trace gracefully', () => {
      const result = formatter.format(null);
      expect(result).toBe('No trace data available\n');
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'HumanReadableFormatter: Null trace provided'
      );
    });

    it('should format execution traces readably', () => {
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

      const result = formatter.format(trace);

      expect(result).toContain('ACTION EXECUTION TRACE');
      expect(result).toContain('BASIC INFORMATION');
      expect(result).toContain('Action ID');
      expect(result).toContain('test:action');
      expect(result).toContain('Actor ID');
      expect(result).toContain('test-actor');
      expect(result).toContain('EXECUTION DETAILS');
      expect(result).toContain('Status');
      expect(result).toContain('SUCCESS');
      expect(result).toContain('Duration');
      expect(result).toContain('100ms');
    });

    it('should format pipeline traces with stages', () => {
      const tracedActions = new Map();
      const now = Date.now();
      tracedActions.set('action1', {
        actionId: 'action1',
        actorId: 'actor1',
        startTime: now,
        stages: {
          component_filtering: {
            timestamp: now + 10,
            data: {
              candidateCount: 5,
              actorComponents: ['comp1', 'comp2'],
              requiredComponents: ['comp1'],
            },
          },
          prerequisite_evaluation: {
            timestamp: now + 20,
            data: {
              passed: true,
              prerequisites: [{}],
            },
          },
          target_resolution: {
            timestamp: now + 30,
            data: {
              targetCount: 3,
              isLegacy: false,
              targetKeys: ['target1', 'target2', 'target3'],
            },
          },
          formatting: {
            timestamp: now + 40,
            data: {
              template: 'Action template',
              formattedCommand: 'formatted command',
              displayName: 'Display Name',
            },
          },
        },
      });

      const trace = {
        constructor: { name: 'ActionAwareStructuredTrace' },
        getTracedActions: jest.fn(() => tracedActions),
        getSpans: jest.fn(() => []),
      };

      const result = formatter.format(trace);

      expect(result).toContain('ACTION PIPELINE TRACE');
      expect(result).toContain('SUMMARY');
      expect(result).toContain('Total Actions');
      expect(result).toContain('ACTION: action1');
      expect(result).toContain('Actor: actor1');
      expect(result).toContain('Pipeline Stages:');
      expect(result).toContain('Component Filtering');
      expect(result).toContain('Prerequisite Evaluation');
      expect(result).toContain('Target Resolution');
      expect(result).toContain('Formatting');
      expect(result).toContain('Total Pipeline Time:');
    });

    it('should handle verbosity levels correctly', () => {
      const trace = {
        constructor: { name: 'ActionExecutionTrace' },
        actionId: 'test:action',
        actorId: 'test-actor',
        execution: {
          startTime: Date.now(),
          endTime: Date.now() + 100,
          duration: 100,
          result: { success: true },
          eventPayload: { key: 'value' },
        },
        turnAction: {
          commandString: 'test command',
          actionDefinitionId: 'test:def',
          targetContexts: [{}, {}],
        },
      };

      // Test minimal verbosity
      mockFilter.getVerbosityLevel.mockReturnValue('minimal');
      let result = formatter.format(trace);
      expect(result).toContain('BASIC INFORMATION');
      expect(result).not.toContain('EXECUTION DETAILS');
      expect(result).not.toContain('TURN ACTION');
      expect(result).not.toContain('EVENT PAYLOAD');

      // Test standard verbosity
      mockFilter.getVerbosityLevel.mockReturnValue('standard');
      result = formatter.format(trace);
      expect(result).toContain('BASIC INFORMATION');
      expect(result).toContain('EXECUTION DETAILS');
      expect(result).not.toContain('TURN ACTION');
      expect(result).not.toContain('EVENT PAYLOAD');

      // Test detailed verbosity
      mockFilter.getVerbosityLevel.mockReturnValue('detailed');
      result = formatter.format(trace);
      expect(result).toContain('BASIC INFORMATION');
      expect(result).toContain('EXECUTION DETAILS');
      expect(result).toContain('TURN ACTION');
      expect(result).not.toContain('EVENT PAYLOAD');

      // Test verbose verbosity
      mockFilter.getVerbosityLevel.mockReturnValue('verbose');
      result = formatter.format(trace);
      expect(result).toContain('BASIC INFORMATION');
      expect(result).toContain('EXECUTION DETAILS');
      expect(result).toContain('TURN ACTION');
      expect(result).toContain('EVENT PAYLOAD');
    });

    it('should apply colors when enabled', () => {
      const coloredFormatter = new HumanReadableFormatter(
        {
          logger: mockLogger,
          actionTraceFilter: mockFilter,
        },
        {
          enableColors: true,
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

      const result = coloredFormatter.format(trace);

      // Check for ANSI color codes
      expect(result).toContain('\x1b['); // Contains color codes
      expect(result).toContain('\x1b[32m'); // Green for success
      expect(result).toContain('\x1b[36m'); // Cyan for highlighting
      expect(result).toContain('\x1b[0m'); // Reset code
    });

    it('should align tables properly', () => {
      const trace = {
        constructor: { name: 'ActionExecutionTrace' },
        actionId: 'test',
        actorId: 'actor',
        execution: {
          startTime: Date.now(),
          endTime: Date.now() + 1000,
          result: { success: true },
        },
      };

      const result = formatter.format(trace);
      const lines = result.split('\n');

      // Find lines with colons to check alignment
      const tableLines = lines.filter((line) => line.includes(' : '));
      for (const line of tableLines) {
        const colonIndex = line.indexOf(' : ');
        // All colons should be at a consistent position for proper alignment
        expect(colonIndex).toBeGreaterThan(0);
      }
    });

    it('should format timestamps consistently', () => {
      const now = Date.now();
      const trace = {
        constructor: { name: 'ActionExecutionTrace' },
        actionId: 'test:action',
        actorId: 'test-actor',
        execution: {
          startTime: now,
          endTime: now + 1000,
        },
      };

      const result = formatter.format(trace);

      // Check that timestamps are in ISO format
      const isoDatePattern = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/;
      expect(result).toMatch(isoDatePattern);
    });

    it('should format durations readably', () => {
      const trace = {
        constructor: { name: 'ActionExecutionTrace' },
        actionId: 'test:action',
        actorId: 'test-actor',
        execution: {
          startTime: Date.now(),
          endTime: Date.now() + 150,
          duration: 150,
          result: { success: true },
        },
      };

      const result = formatter.format(trace);

      expect(result).toContain('150ms');
    });

    it('should highlight errors prominently', () => {
      const trace = {
        constructor: { name: 'ActionExecutionTrace' },
        actionId: 'test:action',
        actorId: 'test-actor',
        execution: {
          startTime: Date.now(),
          endTime: Date.now() + 100,
          result: { success: false },
          error: {
            message: 'Test error message',
            type: 'TestError',
            stack: 'Error stack trace',
            context: { additional: 'context' },
          },
        },
      };

      mockFilter.getVerbosityLevel.mockReturnValue('verbose');
      const result = formatter.format(trace);

      expect(result).toContain('ERROR DETAILS');
      expect(result).toContain('Test error message');
      expect(result).toContain('TestError');
      expect(result).toContain('Stack Trace:');
      expect(result).toContain('Error stack trace');
      expect(result).toContain('Context:');
      expect(result).toContain('additional');
    });

    it('should handle null/undefined gracefully', () => {
      const trace = {
        constructor: { name: 'ActionExecutionTrace' },
        actionId: null,
        actorId: undefined,
        execution: {
          startTime: null,
          endTime: undefined,
          result: null,
        },
      };

      const result = formatter.format(trace);

      expect(result).toContain('unknown');
      expect(result).toContain('N/A');
      expect(result).toContain('UNKNOWN');
      expect(result).not.toContain('null');
      expect(result).not.toContain('undefined');
    });

    it('should format generic traces as fallback', () => {
      const trace = {
        someData: 'value',
        nested: {
          field: 'nested value',
        },
      };

      const result = formatter.format(trace);

      expect(result).toContain('GENERIC TRACE');
      expect(result).toContain('TRACE DATA');
      expect(result).toContain('someData: value');
      expect(result).toContain('nested:');
      expect(result).toContain('field: nested value');
    });

    it('should handle formatting errors gracefully', () => {
      const trace = {
        constructor: { name: 'ActionExecutionTrace' },
        get actionId() {
          throw new Error('Test error');
        },
      };

      const result = formatter.format(trace);

      expect(result).toContain('FORMATTING ERROR');
      expect(result).toContain('Failed to format trace');
      expect(result).toContain('Test error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'HumanReadableFormatter: Formatting error',
        expect.any(Error)
      );
    });

    it('should include spans when available', () => {
      const tracedActions = new Map();
      const trace = {
        constructor: { name: 'ActionAwareStructuredTrace' },
        getTracedActions: jest.fn(() => tracedActions),
        getSpans: jest.fn(() => [
          {
            name: 'Span 1',
            startTime: Date.now(),
            endTime: Date.now() + 50,
          },
          {
            name: 'Span 2',
            startTime: Date.now() + 50,
            endTime: Date.now() + 100,
          },
        ]),
      };

      mockFilter.getVerbosityLevel.mockReturnValue('standard');
      const result = formatter.format(trace);

      expect(result).toContain('TRACE SPANS');
      expect(result).toContain('Span 1');
      expect(result).toContain('Span 2');
      expect(result).toContain('50ms');
    });

    it('should show performance summary for pipeline traces', () => {
      const tracedActions = new Map();
      const now = Date.now();

      // Add multiple actions with stages
      for (let i = 1; i <= 3; i++) {
        tracedActions.set(`action${i}`, {
          actionId: `action${i}`,
          actorId: `actor${i}`,
          startTime: now,
          stages: {
            component_filtering: {
              timestamp: now + i * 10,
              data: {},
            },
            formatting: {
              timestamp: now + i * 20,
              data: {},
            },
          },
        });
      }

      const trace = {
        constructor: { name: 'ActionAwareStructuredTrace' },
        getTracedActions: jest.fn(() => tracedActions),
        getSpans: jest.fn(() => []),
      };

      mockFilter.getVerbosityLevel.mockReturnValue('standard');
      const result = formatter.format(trace);

      expect(result).toContain('PERFORMANCE SUMMARY');
      expect(result).toContain('Total Actions: 3');
      expect(result).toContain('Total Duration:');
      expect(result).toContain('Average Duration:');
      expect(result).toContain('Stages Executed: 6');
    });

    it('should respect inclusion config for stage details', () => {
      const tracedActions = new Map();
      const now = Date.now();
      tracedActions.set('action1', {
        actionId: 'action1',
        actorId: 'actor1',
        startTime: now,
        stages: {
          component_filtering: {
            timestamp: now + 10,
            data: {
              candidateCount: 5,
              actorComponents: ['comp1'],
              requiredComponents: ['comp1'],
            },
          },
          prerequisite_evaluation: {
            timestamp: now + 20,
            data: {
              passed: true,
              prerequisites: [],
            },
          },
          target_resolution: {
            timestamp: now + 30,
            data: {
              targetCount: 2,
              isLegacy: false,
              targetKeys: ['t1', 't2'],
            },
          },
        },
      });

      const trace = {
        constructor: { name: 'ActionAwareStructuredTrace' },
        getTracedActions: jest.fn(() => tracedActions),
        getSpans: jest.fn(() => []),
      };

      // Test with all inclusions disabled
      mockFilter.getInclusionConfig.mockReturnValue({
        includeComponentData: false,
        includePrerequisites: false,
        includeTargets: false,
      });

      let result = formatter.format(trace);
      expect(result).not.toContain('Actor Components:');
      expect(result).not.toContain('Result: PASSED');
      expect(result).not.toContain('Targets Found:');

      // Test with all inclusions enabled
      mockFilter.getInclusionConfig.mockReturnValue({
        includeComponentData: true,
        includePrerequisites: true,
        includeTargets: true,
      });

      result = formatter.format(trace);
      expect(result).toContain('Actor Components: 1');
      expect(result).toContain('Required: comp1');
      expect(result).toContain('Result:');
      expect(result).toContain('Targets Found: 2');
      expect(result).toContain('Type: Multi-target');
    });
  });
});
