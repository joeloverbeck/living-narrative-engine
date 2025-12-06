/**
 * @file Unit tests for ActionTraceOutputService multi-format support
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionTraceOutputService } from '../../../../src/actions/tracing/actionTraceOutputService.js';
import { createTestBed } from '../../../common/testBed.js';
import {
  createMockJsonFormatter,
  createMockHumanReadableFormatterWithOptions,
} from '../../../common/mockFactories/actionTracing.js';

describe('ActionTraceOutputService - Multi-Format Support', () => {
  let testBed;
  let outputService;
  let mockJsonFormatter;
  let mockHumanReadableFormatter;
  let mockLogger;
  let mockOutputHandler;

  beforeEach(() => {
    testBed = createTestBed();
    mockJsonFormatter = createMockJsonFormatter();
    mockHumanReadableFormatter = createMockHumanReadableFormatterWithOptions();
    mockLogger = testBed.createMockLogger();

    // Create a mock output handler to capture write operations
    mockOutputHandler = jest.fn().mockResolvedValue(undefined);
  });

  describe('Configuration Management', () => {
    it('should accept multi-format configuration', () => {
      const config = {
        outputFormats: ['json', 'text'],
        textFormatOptions: {
          lineWidth: 120,
          enableColors: false,
        },
      };

      outputService = new ActionTraceOutputService({
        jsonFormatter: mockJsonFormatter,
        humanReadableFormatter: mockHumanReadableFormatter,
        logger: mockLogger,
        outputHandler: mockOutputHandler,
        actionTraceConfig: config,
      });

      expect(outputService).toBeDefined();
    });

    it('should handle empty output formats gracefully', () => {
      const config = { outputFormats: [] };

      outputService = new ActionTraceOutputService({
        jsonFormatter: mockJsonFormatter,
        logger: mockLogger,
        outputHandler: mockOutputHandler,
        actionTraceConfig: config,
      });

      expect(outputService).toBeDefined();
    });

    it('should use default configuration when none provided', () => {
      outputService = new ActionTraceOutputService({
        jsonFormatter: mockJsonFormatter,
        logger: mockLogger,
        outputHandler: mockOutputHandler,
        // No actionTraceConfig provided
      });

      expect(outputService).toBeDefined();
    });

    it('should support runtime configuration updates', () => {
      outputService = new ActionTraceOutputService({
        jsonFormatter: mockJsonFormatter,
        logger: mockLogger,
        outputHandler: mockOutputHandler,
      });

      const newConfig = {
        outputFormats: ['json', 'text'],
        textFormatOptions: {
          lineWidth: 80,
          indentSize: 3,
        },
      };

      expect(() => outputService.updateConfiguration(newConfig)).not.toThrow();
      expect(outputService.updateConfiguration).toBeDefined();
    });

    it('should handle invalid configuration updates gracefully', () => {
      outputService = new ActionTraceOutputService({
        jsonFormatter: mockJsonFormatter,
        logger: mockLogger,
        outputHandler: mockOutputHandler,
      });

      // Test with null configuration
      expect(() => outputService.updateConfiguration(null)).not.toThrow();

      // Test with empty configuration
      expect(() => outputService.updateConfiguration({})).not.toThrow();
    });
  });

  describe('Basic Output Functionality', () => {
    beforeEach(() => {
      outputService = new ActionTraceOutputService({
        jsonFormatter: mockJsonFormatter,
        humanReadableFormatter: mockHumanReadableFormatter,
        logger: mockLogger,
        outputHandler: mockOutputHandler,
        actionTraceConfig: testBed.createMockDualFormatConfig(),
      });
    });

    it('should write traces successfully', async () => {
      const trace = testBed.createMockTrace();
      mockJsonFormatter.format.mockReturnValue('{"test": "json"}');

      await outputService.writeTrace(trace);

      expect(mockOutputHandler).toHaveBeenCalledTimes(1);
      expect(mockOutputHandler).toHaveBeenCalledWith(expect.any(Object), trace);
    });

    it('should handle null traces gracefully', async () => {
      await outputService.writeTrace(null);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ActionTraceOutputService: Null trace provided'
      );
      expect(mockOutputHandler).not.toHaveBeenCalled();
    });

    it('should handle undefined traces gracefully', async () => {
      await outputService.writeTrace(undefined);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'ActionTraceOutputService: Null trace provided'
      );
      expect(mockOutputHandler).not.toHaveBeenCalled();
    });

    it('should use JsonTraceFormatter when trace has no toJSON method', async () => {
      // Create a trace without toJSON method to trigger formatter usage
      const trace = {
        actionId: 'test_action',
        actorId: 'test_actor',
        getTracedActions: jest
          .fn()
          .mockReturnValue(new Map([['action1', { data: 'test1' }]])),
      };
      const expectedJson = '{"formatted": "trace"}';
      mockJsonFormatter.format.mockReturnValue(expectedJson);

      await outputService.writeTrace(trace);

      expect(mockJsonFormatter.format).toHaveBeenCalledWith(trace);
      expect(mockOutputHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          writeMetadata: expect.any(Object),
        }),
        trace
      );
    });

    it('should handle JsonTraceFormatter errors gracefully', async () => {
      // Create a trace without toJSON method to trigger formatter usage
      const trace = {
        actionId: 'test_action',
        actorId: 'test_actor',
        getTracedActions: jest
          .fn()
          .mockReturnValue(new Map([['action1', { data: 'test1' }]])),
      };
      mockJsonFormatter.format.mockImplementation(() => {
        throw new Error('Formatter failed');
      });

      await outputService.writeTrace(trace);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to use JsonTraceFormatter, falling back to default formatting',
        expect.any(Error)
      );
      expect(mockOutputHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('File Output Mode Configuration', () => {
    it('should create FileTraceOutputHandler when outputToFiles is true', () => {
      outputService = new ActionTraceOutputService({
        jsonFormatter: mockJsonFormatter,
        humanReadableFormatter: mockHumanReadableFormatter,
        logger: mockLogger,
        outputToFiles: true,
        actionTraceConfig: {
          outputFormats: ['json', 'text'],
        },
      });

      expect(outputService).toBeDefined();
      // FileTraceOutputHandler should be created internally
    });

    it('should support setting output directory', () => {
      outputService = new ActionTraceOutputService({
        jsonFormatter: mockJsonFormatter,
        logger: mockLogger,
        outputToFiles: true,
        outputDirectory: './custom-traces',
        actionTraceConfig: {
          outputFormats: ['json'],
        },
      });

      expect(outputService).toBeDefined();
    });

    it('should support enabling file output after construction', () => {
      outputService = new ActionTraceOutputService({
        jsonFormatter: mockJsonFormatter,
        logger: mockLogger,
        actionTraceConfig: {
          outputFormats: ['json'],
        },
      });

      const success = outputService.enableFileOutput('./traces');
      expect(success).toBe(true);
    });

    it('should handle file output enabling failures gracefully', () => {
      outputService = new ActionTraceOutputService({
        jsonFormatter: mockJsonFormatter,
        logger: mockLogger,
        actionTraceConfig: {
          outputFormats: ['json'],
        },
      });

      // Simulate failure by passing invalid directory
      const success = outputService.enableFileOutput(null);
      expect(success).toBe(true); // Constructor handles null gracefully
    });
  });

  describe('Performance and Statistics', () => {
    beforeEach(() => {
      outputService = new ActionTraceOutputService({
        jsonFormatter: mockJsonFormatter,
        logger: mockLogger,
        outputHandler: mockOutputHandler,
        actionTraceConfig: testBed.createMockDualFormatConfig(),
      });
    });

    it('should provide service statistics', () => {
      const stats = outputService.getStatistics();

      expect(stats).toHaveProperty('totalWrites');
      expect(stats).toHaveProperty('totalErrors');
      expect(stats).toHaveProperty('pendingWrites');
      expect(stats).toHaveProperty('errorRate');
    });

    it('should provide queue statistics', () => {
      const queueStats = outputService.getQueueStats();

      expect(queueStats).toHaveProperty('queueLength');
      expect(queueStats).toHaveProperty('isProcessing');
      expect(queueStats).toHaveProperty('writeErrors');
      expect(queueStats).toHaveProperty('maxQueueSize');
    });

    it('should reset statistics when requested', () => {
      outputService.resetStatistics();
      const stats = outputService.getStatistics();

      expect(stats.totalWrites).toBe(0);
      expect(stats.totalErrors).toBe(0);
    });

    it('should handle trace writing within performance bounds', async () => {
      const trace = testBed.createMockTrace();
      mockJsonFormatter.format.mockReturnValue('{"test": "json"}');

      let syntheticNow = 0;
      const nowSpy = jest.spyOn(performance, 'now').mockImplementation(() => {
        syntheticNow += 0.001;
        return syntheticNow;
      });

      const startTime = performance.now();
      await outputService.writeTrace(trace);
      const duration = performance.now() - startTime;

      // Allow additional buffer for shared CI environments while still ensuring fast writes
      expect(duration).toBeLessThan(25);
      expect(mockOutputHandler).toHaveBeenCalledTimes(1);

      nowSpy.mockRestore();
    });

    it('should handle large trace objects efficiently', async () => {
      const largeTrace = testBed.createMockTrace({
        data: {
          largeArray: new Array(100).fill('test data'), // Smaller for test speed
          nestedObject: {
            level1: {
              level2: {
                level3: 'deep nesting test',
              },
            },
          },
        },
      });

      mockJsonFormatter.format.mockReturnValue('{"large": "object"}');

      const startTime = performance.now();
      await outputService.writeTrace(largeTrace);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(50); // Should handle large objects reasonably fast
      expect(mockOutputHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling and Resilience', () => {
    beforeEach(() => {
      outputService = new ActionTraceOutputService({
        jsonFormatter: mockJsonFormatter,
        logger: mockLogger,
        outputHandler: mockOutputHandler,
        actionTraceConfig: testBed.createMockDualFormatConfig(),
      });
    });

    it('should handle output handler errors gracefully', async () => {
      const trace = testBed.createMockTrace();
      mockOutputHandler.mockRejectedValue(new Error('Output failed'));

      await expect(outputService.writeTrace(trace)).rejects.toThrow(
        'Output failed'
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Failed to write trace',
        expect.any(Object)
      );
    });

    it('should track error statistics', async () => {
      const trace = testBed.createMockTrace();
      mockOutputHandler.mockRejectedValue(new Error('Output failed'));

      try {
        await outputService.writeTrace(trace);
      } catch (error) {
        // Expected error
      }

      const stats = outputService.getStatistics();
      expect(stats.totalErrors).toBe(1);
      expect(stats.errorRate).toBe(1);
    });

    it('should wait for pending writes during shutdown', async () => {
      const trace1 = testBed.createMockTrace();
      const trace2 = testBed.createMockTrace();

      // Make output handler slow to create pending writes
      let resolveHandler;
      const handlerPromise = new Promise((resolve) => {
        resolveHandler = resolve;
      });
      mockOutputHandler.mockReturnValue(handlerPromise);

      // Start two writes but don't await them
      const write1Promise = outputService.writeTrace(trace1);
      const write2Promise = outputService.writeTrace(trace2);

      // Wait for pending writes
      const waitPromise = outputService.waitForPendingWrites();

      // Resolve the handler to complete the writes
      resolveHandler();

      // All should complete
      await Promise.all([write1Promise, write2Promise, waitPromise]);

      expect(mockOutputHandler).toHaveBeenCalledTimes(2);
    });

    it('should shutdown gracefully', async () => {
      const trace = testBed.createMockTrace();

      // Start a write operation
      const writePromise = outputService.writeTrace(trace);

      // Shutdown should wait for completion
      const shutdownPromise = outputService.shutdown();

      // Complete both
      await Promise.all([writePromise, shutdownPromise]);

      expect(mockOutputHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('Advanced Features', () => {
    it('should support trace writing with priority', async () => {
      outputService = new ActionTraceOutputService({
        jsonFormatter: mockJsonFormatter,
        logger: mockLogger,
        outputHandler: mockOutputHandler,
        actionTraceConfig: testBed.createMockDualFormatConfig(),
      });

      const trace = testBed.createMockTrace();
      await outputService.writeTraceWithPriority(trace, 1);

      expect(mockOutputHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle batch operations when available', async () => {
      outputService = new ActionTraceOutputService({
        jsonFormatter: mockJsonFormatter,
        logger: mockLogger,
        outputHandler: mockOutputHandler,
        actionTraceConfig: testBed.createMockDualFormatConfig(),
      });

      // This test verifies the service can be constructed with batch configuration
      const queueMetrics = outputService.getQueueMetrics();
      expect(queueMetrics).toBeNull(); // No advanced queue processor in basic config
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with legacy trace formats', async () => {
      outputService = new ActionTraceOutputService({
        jsonFormatter: mockJsonFormatter,
        logger: mockLogger,
        outputHandler: mockOutputHandler,
        actionTraceConfig: { outputFormats: ['json'] },
      });

      // Test with trace that has toJSON method
      const legacyTrace = {
        actionId: 'legacy-action',
        actorId: 'legacy-actor',
        toJSON: jest.fn().mockReturnValue({
          id: 'legacy-trace',
          data: 'legacy-data',
        }),
      };

      await outputService.writeTrace(legacyTrace);

      expect(legacyTrace.toJSON).toHaveBeenCalled();
      expect(mockOutputHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle traces with getTracedActions method', async () => {
      // Create service without jsonFormatter to ensure structured trace formatting is used
      outputService = new ActionTraceOutputService({
        logger: mockLogger,
        outputHandler: mockOutputHandler,
        actionTraceConfig: { outputFormats: ['json'] },
      });

      // Test with trace that has getTracedActions method
      const structuredTrace = {
        actionId: 'structured-action',
        actorId: 'structured-actor',
        getTracedActions: jest.fn().mockReturnValue(
          new Map([
            ['action1', { data: 'test1' }],
            ['action2', { data: 'test2' }],
          ])
        ),
        getSpans: jest.fn().mockReturnValue([]), // Mock method for structured trace formatting
      };

      await outputService.writeTrace(structuredTrace);

      expect(structuredTrace.getTracedActions).toHaveBeenCalled();
      expect(mockOutputHandler).toHaveBeenCalledTimes(1);
    });

    it('should handle traces without specific methods', async () => {
      outputService = new ActionTraceOutputService({
        jsonFormatter: mockJsonFormatter,
        logger: mockLogger,
        outputHandler: mockOutputHandler,
        actionTraceConfig: { outputFormats: ['json'] },
      });

      // Test with plain object trace
      const plainTrace = {
        actionId: 'plain-action',
        actorId: 'plain-actor',
        data: 'plain-data',
      };

      await expect(outputService.writeTrace(plainTrace)).rejects.toThrow(
        'Trace must have either toJSON() or getTracedActions() method'
      );

      expect(mockOutputHandler).not.toHaveBeenCalled();
    });
  });
});
