/**
 * @file Performance test bed utilities
 */

/**
 *
 */
export function createPerformanceTestBed() {
  return {
    createPerformanceTracker() {
      return {
        startBenchmark(name, options = {}) {
          const startTime = process.hrtime.bigint();
          const startMemory = options.trackMemory ? process.memoryUsage() : null;

          return {
            end() {
              const endTime = process.hrtime.bigint();
              const endMemory = options.trackMemory ? process.memoryUsage() : null;
              
              const totalTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

              const metrics = {
                name,
                totalTime,
              };

              if (startMemory && endMemory) {
                metrics.memoryUsage = {
                  initial: startMemory.heapUsed,
                  peak: endMemory.heapUsed,
                  final: process.memoryUsage().heapUsed,
                };
              }

              return metrics;
            },
          };
        },
      };
    },

    createLargeWorldData(size) {
      return {
        instances: Array(size).fill(0).map((_, i) => ({
          instanceId: `perf_entity_${i}`,
        })),
      };
    },

    createMockEntityManager(options = {}) {
      const {
        enableBatchOperations = true,
        hasBatchSupport = true,
        batchProcessingTimeMs = 100,
        sequentialProcessingTimeMs = 20,
        trackMemoryUsage = false,
        simulateMemoryPressure = false,
      } = options;

      return {
        hasBatchSupport: jest.fn().mockReturnValue(hasBatchSupport),
        
        batchCreateEntities: jest.fn().mockImplementation(async (entitySpecs, batchOptions) => {
          // Simulate realistic processing time
          await new Promise(resolve => setTimeout(resolve, batchProcessingTimeMs));

          const successes = entitySpecs.map((spec, i) => ({
            id: `entity_${i}`,
            instanceId: spec.opts.instanceId,
            definitionId: spec.definitionId,
          }));

          return {
            successes,
            failures: [],
            successCount: successes.length,
            failureCount: 0,
            totalProcessed: successes.length,
            processingTime: batchProcessingTimeMs,
          };
        }),

        createEntityInstance: jest.fn().mockImplementation(async (definitionId, opts) => {
          // Simulate realistic sequential processing time
          await new Promise(resolve => setTimeout(resolve, sequentialProcessingTimeMs));

          return {
            id: `entity_${opts.instanceId}`,
            instanceId: opts.instanceId,
            definitionId,
          };
        }),
      };
    },

    setupEntityDefinitions(count) {
      this.mockRepository.getEntityInstanceDefinition.mockImplementation((instanceId) => ({
        definitionId: 'core:perf_test_actor',
        componentOverrides: {},
      }));
    },

    cleanup() {
      jest.clearAllMocks();
    },

    // Mock objects
    mockWorldContext: {},
    mockRepository: {
      getWorld: jest.fn(),
      getEntityInstanceDefinition: jest.fn(),
      get: jest.fn(),
    },
    mockValidatedEventDispatcher: {
      dispatch: jest.fn(),
    },
    mockEventDispatchService: {
      dispatchWithLogging: jest.fn(),
    },
    mockLogger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    mockScopeRegistry: {
      initialize: jest.fn(),
    },
  };
}