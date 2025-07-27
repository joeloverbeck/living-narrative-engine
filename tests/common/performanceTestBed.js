/**
 * @file Performance test bed utilities
 */

/**
 * Determines timing multiplier based on test environment
 * CI/automated environments can use minimal delays for faster execution
 *
 * @returns {number} Timing multiplier (0.1 for CI, 1.0 for local)
 */
function getTestTimingMultiplier() {
  // Check for CI environment variables
  const isCI = !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.JENKINS_URL
  );

  // Use minimal delays in CI for faster test execution
  return isCI ? 0.1 : 1.0;
}

/**
 * Determines if running in CI environment
 *
 * @returns {boolean} True if running in CI
 */
function isRunningInCI() {
  return !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.JENKINS_URL
  );
}

/**
 * Forces garbage collection and establishes memory baseline
 *
 * @returns {number} Baseline memory usage in bytes
 */
async function forceGCAndGetBaseline() {
  // Force garbage collection if available (Node.js with --expose-gc flag)
  if (global.gc) {
    global.gc();
    // Allow some time for GC to complete
    await new Promise(resolve => setTimeout(resolve, 10));
    global.gc();
  }
  
  return process.memoryUsage().heapUsed;
}

/**
 * Get memory usage with multiple samples for stability
 *
 * @param {number} samples - Number of samples to take (default: 3)
 * @returns {Promise<number>} Average memory usage in bytes
 */
async function getStableMemoryUsage(samples = 3) {
  const measurements = [];
  
  for (let i = 0; i < samples; i++) {
    if (i > 0) {
      // Small delay between measurements
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    measurements.push(process.memoryUsage().heapUsed);
  }
  
  // Return median to avoid outliers
  measurements.sort((a, b) => a - b);
  const mid = Math.floor(measurements.length / 2);
  return measurements.length % 2 === 0 
    ? (measurements[mid - 1] + measurements[mid]) / 2
    : measurements[mid];
}

/**
 *
 */
export function createPerformanceTestBed() {
  return {
    createPerformanceTracker() {
      return {
        startBenchmark(name, options = {}) {
          const startTime = process.hrtime.bigint();
          let baselineMemory = null;
          let startMemoryPromise = null;

          if (options.trackMemory) {
            startMemoryPromise = forceGCAndGetBaseline().then(baseline => {
              baselineMemory = baseline;
              return getStableMemoryUsage();
            });
          }

          return {
            end() {
              const endTime = process.hrtime.bigint();
              const endMemory = options.trackMemory
                ? process.memoryUsage()
                : null;

              const totalTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

              const metrics = {
                name,
                totalTime,
              };

              if (options.trackMemory && endMemory) {
                // Simple synchronous memory tracking for backward compatibility
                metrics.memoryUsage = {
                  initial: process.memoryUsage().heapUsed,
                  peak: endMemory.heapUsed,
                  final: process.memoryUsage().heapUsed,
                };
              }

              return metrics;
            },

            async endWithAdvancedMemoryTracking() {
              const endTime = process.hrtime.bigint();
              const totalTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds

              const metrics = {
                name,
                totalTime,
              };

              if (options.trackMemory && startMemoryPromise) {
                const startMemory = await startMemoryPromise;
                const peakMemory = await getStableMemoryUsage();
                
                // Force GC before final measurement
                if (global.gc) {
                  global.gc();
                  await new Promise(resolve => setTimeout(resolve, 10));
                }
                
                const finalMemory = await getStableMemoryUsage();
                
                // Calculate memory delta from baseline
                const memoryGrowth = Math.max(0, peakMemory - baselineMemory);
                
                metrics.memoryUsage = {
                  baseline: baselineMemory,
                  initial: startMemory,
                  peak: peakMemory,
                  final: finalMemory,
                  growth: memoryGrowth,
                  // Environment-aware thresholds
                  isCI: isRunningInCI(),
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
        instances: Array(size)
          .fill(0)
          .map((_, i) => ({
            instanceId: `perf_entity_${i}`,
          })),
      };
    },

    createMockEntityManager(options = {}) {
      const timingMultiplier = getTestTimingMultiplier();
      const {
        enableBatchOperations = true,
        hasBatchSupport = true,
        batchProcessingTimeMs = Math.max(1, Math.ceil(10 * timingMultiplier)), // Environment-aware timing
        sequentialProcessingTimeMs = Math.max(
          1,
          Math.ceil(2 * timingMultiplier)
        ), // Environment-aware timing
        trackMemoryUsage = false,
        simulateMemoryPressure = false,
      } = options;

      return {
        hasBatchSupport: jest.fn().mockReturnValue(hasBatchSupport),

        batchCreateEntities: jest
          .fn()
          .mockImplementation(async (entitySpecs, batchOptions) => {
            // Simulate realistic processing time with environment-aware delays
            await new Promise((resolve) =>
              setTimeout(resolve, batchProcessingTimeMs)
            );

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

        createEntityInstance: jest
          .fn()
          .mockImplementation(async (definitionId, opts) => {
            // Simulate realistic sequential processing time with environment-aware delays
            await new Promise((resolve) =>
              setTimeout(resolve, sequentialProcessingTimeMs)
            );

            return {
              id: `entity_${opts.instanceId}`,
              instanceId: opts.instanceId,
              definitionId,
            };
          }),
      };
    },

    setupEntityDefinitions(count) {
      this.mockRepository.getEntityInstanceDefinition.mockImplementation(
        (instanceId) => ({
          definitionId: 'core:perf_test_actor',
          componentOverrides: {},
        })
      );
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
