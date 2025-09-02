/**
 * @file Memory usage tests for LogMetadataEnricher
 * @see src/logging/logMetadataEnricher.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import LogMetadataEnricher from '../../../src/logging/logMetadataEnricher.js';

/**
 * Helper to determine environment-appropriate timing multipliers
 *
 * @returns {object} Timing multipliers for test environment
 */
function getTimingMultipliers() {
  const isCI = !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.JENKINS_URL
  );

  return {
    // CI environments are generally slower and less predictable
    timeoutMultiplier: isCI ? 3.0 : 1.5,
    // Allow more variance in CI for consistent operations
    opsVarianceMultiplier: isCI ? 0.5 : 0.8,
  };
}

// Mock browser APIs
const mockNavigator = {
  userAgent: 'Mozilla/5.0 (Test Browser)',
  language: 'en-US',
  platform: 'MacIntel',
  cookieEnabled: true,
  onLine: true,
  doNotTrack: '1',
};

const mockWindow = {
  location: {
    href: 'http://localhost:8080/test',
  },
  innerWidth: 1920,
  innerHeight: 1080,
};

const mockScreen = {
  width: 2560,
  height: 1440,
  availWidth: 2560,
  availHeight: 1400,
  colorDepth: 24,
  pixelDepth: 24,
};

const mockPerformance = {
  now: jest.fn(() => 1234.56),
  memory: {
    usedJSHeapSize: 10485760, // 10MB
    totalJSHeapSize: 20971520, // 20MB
    jsHeapSizeLimit: 2147483648, // 2GB
  },
  getEntriesByType: jest.fn((type) => {
    if (type === 'navigation') {
      return [
        {
          domContentLoadedEventEnd: 500,
          loadEventEnd: 800,
          responseEnd: 300,
          requestStart: 100,
        },
      ];
    }
    return [];
  }),
};

// Store original globals
const originalWindow = global.window;
const originalNavigator = global.navigator;
const originalScreen = global.screen;
const originalPerformance = global.performance;
const originalRequestIdleCallback = global.requestIdleCallback;

describe('LogMetadataEnricher - Memory Usage Tests', () => {
  let enricher;
  let timingMultipliers;

  const BASELINE_THRESHOLDS = {
    // Memory thresholds for memory-specific testing
    memoryPerOperation: 50000, // 50KB per operation (realistic for V8 heap behavior)
  };

  beforeEach(() => {
    // Get environment-specific timing multipliers
    timingMultipliers = getTimingMultipliers();

    // Setup global mocks
    global.window = mockWindow;
    global.navigator = mockNavigator;
    global.screen = mockScreen;
    global.performance = mockPerformance;
    global.requestIdleCallback = jest.fn((callback) => {
      setTimeout(() => callback({ timeRemaining: () => 50 }), 0);
      return 1;
    });

    // Reset mock function calls
    mockPerformance.now.mockClear();
    mockPerformance.getEntriesByType.mockClear();
  });

  afterEach(() => {
    // Restore original globals
    global.window = originalWindow;
    global.navigator = originalNavigator;
    global.screen = originalScreen;
    global.performance = originalPerformance;
    global.requestIdleCallback = originalRequestIdleCallback;
  });

  describe('Memory Leak Detection', () => {
    it('should not exhibit memory leaks during repeated enrichment', async () => {
      enricher = new LogMetadataEnricher({ level: 'full' });
      
      // Test memory growth pattern over multiple batches
      const batchSize = 500;
      const numBatches = 4;
      const memoryMeasurements = [];
      
      // Force initial GC and warmup
      if (global.gc) {
        global.gc();
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      for (let batch = 0; batch < numBatches; batch++) {
        const batchStart = process.memoryUsage().heapUsed;
        
        // Process a batch of log entries
        for (let i = 0; i < batchSize; i++) {
          const logEntry = {
            level: 'info',
            message: `Batch ${batch} entry ${i}`,
            timestamp: new Date().toISOString(),
          };
          enricher.enrichLogEntrySync(logEntry, [{ batchIndex: batch, index: i }]);
        }
        
        // Allow potential cleanup between batches
        if (global.gc) {
          global.gc();
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        
        const batchEnd = process.memoryUsage().heapUsed;
        const batchMemoryIncrease = batchEnd - batchStart;
        memoryMeasurements.push(batchMemoryIncrease);
      }
      
      // Memory growth should not increase significantly between batches
      // (indicating no memory leaks)
      const firstBatchMemory = memoryMeasurements[0];
      const lastBatchMemory = memoryMeasurements[memoryMeasurements.length - 1];
      
      // Allow some variance but memory shouldn't grow unboundedly
      const memoryGrowthFactor = lastBatchMemory / Math.max(firstBatchMemory, 1);
      const maxAcceptableGrowth = 3.0 * timingMultipliers.timeoutMultiplier;
      
      expect(memoryGrowthFactor).toBeLessThan(maxAcceptableGrowth);
      
      // Total memory usage should be reasonable
      const totalMemoryUsage = memoryMeasurements.reduce((sum, mem) => sum + mem, 0);
      const avgMemoryPerBatch = totalMemoryUsage / numBatches;
      const maxAcceptableBatchMemory = 50000000 * timingMultipliers.timeoutMultiplier; // 50MB per batch
      
      expect(avgMemoryPerBatch).toBeLessThan(maxAcceptableBatchMemory);
    });
  });

  describe('Memory Efficiency', () => {
    it('should maintain efficient memory usage during high volume enrichment', async () => {
      enricher = new LogMetadataEnricher({ level: 'full' });

      const iterations = 2000;

      // Warmup
      for (let i = 0; i < 100; i++) {
        enricher.enrichLogEntrySync({ level: 'info', message: 'warmup' });
      }

      // Force garbage collection before measurement if available
      if (global.gc) {
        global.gc();
        // Allow some time for cleanup
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      const baselineMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        const logEntry = {
          level: 'info',
          message: `Memory test ${i}`,
          timestamp: new Date().toISOString(),
        };

        enricher.enrichLogEntrySync(logEntry, [{ index: i }]);
      }
      
      // Force garbage collection after measurement if available
      if (global.gc) {
        global.gc();
        // Allow some time for cleanup
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      const afterMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = afterMemory - baselineMemory;

      // Should not consume excessive memory (allow more for test environment)
      const bytesPerOperation = memoryIncrease / iterations;
      const memoryThreshold = BASELINE_THRESHOLDS.memoryPerOperation * timingMultipliers.timeoutMultiplier;
      
      // Enhanced memory validation with statistical approach
      // Use a three-tier validation to handle V8 heap variance
      let finalBytesPerOperation = bytesPerOperation;
      
      if (bytesPerOperation > memoryThreshold) {
        // Take additional samples to confirm if this is consistent
        const additionalSamples = [];
        for (let sample = 0; sample < 3; sample++) {
          if (global.gc) {
            global.gc();
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          
          const sampleBaseline = process.memoryUsage().heapUsed;
          
          // Smaller sample size for verification
          for (let i = 0; i < 500; i++) {
            const sampleLogEntry = {
              level: 'info',
              message: `Sample test ${i}`,
              timestamp: new Date().toISOString(),
            };
            enricher.enrichLogEntrySync(sampleLogEntry, [{ index: i }]);
          }
          
          const sampleAfter = process.memoryUsage().heapUsed;
          const sampleBytesPerOp = (sampleAfter - sampleBaseline) / 500;
          additionalSamples.push(sampleBytesPerOp);
        }
        
        // Use median of samples for more stable measurement
        additionalSamples.sort((a, b) => a - b);
        finalBytesPerOperation = additionalSamples[1]; // middle value of 3 samples
      }
      
      // Single assertion point to avoid conditional expects
      expect(finalBytesPerOperation).toBeLessThan(memoryThreshold);
    });
  });
});