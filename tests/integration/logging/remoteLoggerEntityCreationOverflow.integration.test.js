/**
 * @file Integration test reproducing RemoteLogger buffer overflow during entity creation
 * @description Reproduces the specific buffer overflow issue seen in error_logs.txt during
 * anatomy generation and entity creation workflows
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import RemoteLogger from '../../../src/logging/remoteLogger.js';

describe('RemoteLogger - Entity Creation Buffer Overflow Integration', () => {
  let remoteLogger;
  let mockEventBus;
  let mockFallbackLogger;
  let requests;

  beforeEach(() => {
    requests = [];
    mockEventBus = {
      dispatch: jest.fn(),
    };
    mockFallbackLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      setLogLevel: jest.fn(),
    };

    // Mock fetch to simulate LLM proxy server with payload size limits
    global.fetch = jest.fn((url, options) => {
      const request = {
        url,
        method: options.method,
        body: JSON.parse(options.body),
        headers: options.headers,
      };
      requests.push(request);

      const payloadSize = JSON.stringify(request.body).length;
      const logCount = request.body.logs?.length || 0;

      // Simulate the HTTP 413 error from error logs when payload is too large
      if (payloadSize > 500000 || logCount > 1983) {
        // Threshold from error logs
        return Promise.resolve({
          ok: false,
          status: 413,
          statusText: 'Payload Too Large',
          json: () =>
            Promise.resolve({
              error: 'Request entity too large',
            }),
        });
      } else {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              success: true,
              processed: logCount,
              timestamp: new Date().toISOString(),
            }),
        });
      }
    });
  });

  afterEach(async () => {
    if (remoteLogger) {
      await remoteLogger.destroy();
    }
    jest.restoreAllMocks();
    delete global.fetch;
  });

  describe('Entity Creation Workflow Buffer Overflow', () => {
    it('should reproduce buffer overflow during anatomy generation', async () => {
      // Configure RemoteLogger with settings that match production
      remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://localhost:3001/api/debug-log',
          batchSize: 100,
          flushInterval: 1000,
          maxBufferSize: 2000, // Same as production
          retryAttempts: 3,
        },
        dependencies: {
          consoleLogger: mockFallbackLogger,
          eventBus: mockEventBus,
        },
      });

      // Simulate rapid logging during entity creation workflow
      // This pattern matches the anatomy generation process from error logs
      const simulateAnatomyGeneration = () => {
        const entityId = `entity_${Math.random().toString(36).substr(2, 9)}`;

        // Debug logs from body blueprint factory
        remoteLogger.debug(`[DEBUG] Creating anatomy graph for ${entityId}`);
        remoteLogger.debug(
          `[DEBUG] Processing blueprint slots for ${entityId}`
        );
        remoteLogger.debug(
          `[DEBUG] Creating and attaching parts for ${entityId}`
        );

        // Component addition logs
        for (let i = 0; i < 10; i++) {
          remoteLogger.debug(`[DEBUG] Adding component ${i} to ${entityId}`);
          remoteLogger.debug(`[DEBUG] Indexing component add for ${entityId}`);
          remoteLogger.debug(
            `[DEBUG] Entity repository adapter processing ${entityId}`
          );
        }

        // Body description composer debug logs (matches error patterns)
        remoteLogger.debug(
          `[DEBUG] bodyComponent.body.descriptors.height: undefined`
        );
        remoteLogger.debug(`[DEBUG] Entity-level height component: undefined`);
        remoteLogger.debug(`[DEBUG] Height in final descriptors: undefined`);
        remoteLogger.debug(
          `[DEBUG] composeDescription: bodyLevelDescriptors[descriptorType]: undefined`
        );

        // Performance monitoring logs
        remoteLogger.debug(`[DEBUG] Performance monitoring for ${entityId}`);
        remoteLogger.debug(`[DEBUG] Circuit breaker execute for ${entityId}`);
        remoteLogger.debug(
          `[DEBUG] Monitoring coordinator wrapping ${entityId}`
        );

        // Event bus dispatch logs
        remoteLogger.debug(
          `[DEBUG] Event bus dispatch for entity created: ${entityId}`
        );
        remoteLogger.debug(
          `[DEBUG] Safe event dispatcher executing for ${entityId}`
        );
        remoteLogger.debug(
          `[DEBUG] Validated event dispatcher processing ${entityId}`
        );
      };

      // Simulate multiple entity creations happening rapidly
      // This mimics world initialization with many entities
      for (let entityCount = 0; entityCount < 150; entityCount++) {
        simulateAnatomyGeneration();

        // Small delay to simulate processing time
        if (entityCount % 20 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
      }

      // Wait for initial batch processing
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Continue adding logs to trigger buffer overflow
      for (let i = 0; i < 500; i++) {
        remoteLogger.debug(`[DEBUG] Additional anatomy processing log ${i}`);
        remoteLogger.debug(`[DEBUG] Body composition analysis log ${i}`);
        remoteLogger.debug(`[DEBUG] Entity lifecycle management log ${i}`);
      }

      // Force flush to trigger network requests
      await remoteLogger.flush();
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Verify buffer overflow warning was logged
      expect(mockFallbackLogger.warn).toHaveBeenCalledWith(
        '[RemoteLogger] Buffer overflow - discarded oldest log entries',
        expect.objectContaining({
          removedCount: expect.any(Number),
          currentBufferSize: expect.any(Number),
          maxBufferSize: 2000,
        })
      );

      // Verify HTTP 413 error handling
      expect(mockFallbackLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to send batch to server, falling back to console'
        ),
        expect.objectContaining({
          error: expect.stringContaining('HTTP 413: Payload Too Large'),
          logCount: expect.any(Number),
          circuitBreakerState: 'closed',
        })
      );

      // Verify batch discard message
      expect(mockFallbackLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Discarding batch due to client error'),
        expect.objectContaining({
          error: expect.stringContaining('HTTP 413: Payload Too Large'),
          logCount: expect.any(Number),
        })
      );

      // Should have made at least one request that failed with 413
      expect(requests.length).toBeGreaterThan(0);
      const largeRequests = requests.filter(
        (req) =>
          JSON.stringify(req.body).length > 500000 ||
          req.body.logs?.length > 1983
      );
      expect(largeRequests.length).toBeGreaterThan(0);
    });

    it('should demonstrate performance impact of excessive logging during entity creation', async () => {
      const startTime = Date.now();

      remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://localhost:3001/api/debug-log',
          batchSize: 500, // Larger batches to show impact
          flushInterval: 500,
          maxBufferSize: 2000,
        },
        dependencies: {
          consoleLogger: mockFallbackLogger,
          eventBus: mockEventBus,
        },
      });

      // Simulate the rapid logging that causes performance issues
      const logIntensively = () => {
        // Pattern from error logs - anatomy system generates many debug messages
        for (let i = 0; i < 100; i++) {
          remoteLogger.debug(`[DEBUG] Entity repository adapter index: ${i}`);
          remoteLogger.debug(
            `[DEBUG] Component mutation service processing: ${i}`
          );
          remoteLogger.debug(`[DEBUG] Body blueprint factory operation: ${i}`);
          remoteLogger.debug(`[DEBUG] Anatomy generation workflow step: ${i}`);
          remoteLogger.debug(
            `[DEBUG] Entity lifecycle manager construct: ${i}`
          );
        }
      };

      // Rapid fire logging similar to entity creation burst
      for (let batch = 0; batch < 25; batch++) {
        logIntensively();
      }

      const loggingDuration = Date.now() - startTime;

      // Wait for processing
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Verify performance impact
      expect(loggingDuration).toBeLessThan(1000); // Should complete quickly

      // Buffer should have overflowed
      expect(mockFallbackLogger.warn).toHaveBeenCalledWith(
        '[RemoteLogger] Buffer overflow - discarded oldest log entries',
        expect.any(Object)
      );

      // Should have stats showing buffer management
      const stats = remoteLogger.getStats();
      expect(stats.buffer.size).toBeGreaterThanOrEqual(0);
      expect(stats.buffer.overflows).toBeGreaterThan(0);
    });
  });

  describe('World Initialization Logging Burst', () => {
    it('should handle logging burst during world entity instantiation', async () => {
      remoteLogger = new RemoteLogger({
        config: {
          endpoint: 'http://localhost:3001/api/debug-log',
          batchSize: 200,
          flushInterval: 200,
          maxBufferSize: 2000,
        },
        dependencies: {
          consoleLogger: mockFallbackLogger,
          eventBus: mockEventBus,
        },
      });

      // Simulate world initialization creating many entities in sequence
      const simulateWorldInit = async () => {
        // This mirrors the call stack from error logs
        for (let entityIndex = 0; entityIndex < 50; entityIndex++) {
          const entityId = `world_entity_${entityIndex}`;

          // worldInitializer.js logging pattern
          remoteLogger.debug(`[DEBUG] createInstance_fn for ${entityId}`);
          remoteLogger.debug(`[DEBUG] instantiateInstance_fn for ${entityId}`);
          remoteLogger.debug(`[DEBUG] processInstance_fn for ${entityId}`);

          // Entity lifecycle logging
          remoteLogger.debug(`[DEBUG] createEntityInstance for ${entityId}`);
          remoteLogger.debug(`[DEBUG] constructEntity_fn for ${entityId}`);
          remoteLogger.debug(
            `[DEBUG] createEntityInstanceCore_fn for ${entityId}`
          );

          // Anatomy initialization burst
          remoteLogger.debug(`[DEBUG] handleEntityCreated_fn for ${entityId}`);
          remoteLogger.debug(`[DEBUG] generateAnatomyIfNeeded for ${entityId}`);
          remoteLogger.debug(`[DEBUG] orchestrateGeneration for ${entityId}`);
          remoteLogger.debug(
            `[DEBUG] anatomyUnitOfWork execute for ${entityId}`
          );

          // Body description issues
          remoteLogger.debug(
            `[DEBUG] bodyDescriptionComposer processing ${entityId}`
          );
          remoteLogger.debug(
            `[DEBUG] bodyComponent.body.descriptors.height: undefined`
          );
          remoteLogger.debug(
            `[DEBUG] Entity-level height component: undefined`
          );

          // Short pause between entities
          if (entityIndex % 10 === 0) {
            await new Promise((resolve) => setTimeout(resolve, 1));
          }
        }
      };

      await simulateWorldInit();

      // Wait for batch processing and potential overflow
      await new Promise((resolve) => setTimeout(resolve, 600));

      // Should have logged buffer overflow
      expect(mockFallbackLogger.warn).toHaveBeenCalledWith(
        '[RemoteLogger] Buffer overflow - discarded oldest log entries',
        expect.any(Object)
      );

      // Should have made multiple requests
      expect(requests.length).toBeGreaterThan(0);

      const totalLogsRequested = requests.reduce(
        (sum, req) => sum + (req.body.logs?.length || 0),
        0
      );
      expect(totalLogsRequested).toBeGreaterThan(500);
    });
  });
});
