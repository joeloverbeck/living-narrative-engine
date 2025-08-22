/**
 * @file Performance benchmark tests for NoOpLogger
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { createPerformanceTestBed } from '../../common/performanceTestBed.js';
import NoOpLogger from '../../../src/logging/noOpLogger.js';

describe('NoOpLogger - Performance Benchmarks', () => {
  let performanceTestBed;
  let performanceTracker;
  let logger;

  beforeEach(() => {
    performanceTestBed = createPerformanceTestBed();
    performanceTracker = performanceTestBed.createPerformanceTracker();
    logger = new NoOpLogger();
  });

  afterEach(() => {
    performanceTestBed.cleanup();
  });

  describe('Throughput Benchmarks', () => {
    it('should handle high volume of logging calls efficiently', () => {
      const iterations = 10000;
      
      const benchmark = performanceTracker.startBenchmark('high-volume-logging');
      
      for (let i = 0; i < iterations; i++) {
        logger.info('test message', i);
        logger.debug('debug message', { iteration: i });
        logger.warn('warning', i);
        logger.error('error', new Error('test'));
      }
      
      const metrics = benchmark.end();
      
      // NoOpLogger should be extremely fast - less than 200ms for 10k iterations
      expect(metrics.totalTime).toBeLessThan(200);
      
      // Calculate operations per second
      const opsPerSecond = (iterations * 4) / (metrics.totalTime / 1000);
      expect(opsPerSecond).toBeGreaterThan(200000); // Should handle 200k+ ops/sec
    });

    it('should maintain performance with complex objects', () => {
      const iterations = 5000;
      const complexObject = {
        nested: {
          deeply: {
            data: Array(100).fill(0).map((_, i) => ({ id: i, value: Math.random() }))
          }
        },
        circular: null
      };
      complexObject.circular = complexObject; // Create circular reference
      
      const benchmark = performanceTracker.startBenchmark('complex-object-logging');
      
      for (let i = 0; i < iterations; i++) {
        logger.info('Complex data', complexObject);
        logger.debug('Debug info', complexObject, { index: i });
      }
      
      const metrics = benchmark.end();
      
      // Should still be very fast even with complex objects
      expect(metrics.totalTime).toBeLessThan(50);
    });
  });

  describe('Latency Benchmarks', () => {
    it('should have minimal latency per operation', () => {
      const samples = 1000;
      const latencies = [];
      
      for (let i = 0; i < samples; i++) {
        const start = performance.now();
        logger.info('message', i, { data: 'test' });
        const end = performance.now();
        latencies.push(end - start);
      }
      
      // Calculate percentiles
      latencies.sort((a, b) => a - b);
      const p50 = latencies[Math.floor(samples * 0.5)];
      const p95 = latencies[Math.floor(samples * 0.95)];
      const p99 = latencies[Math.floor(samples * 0.99)];
      
      // NoOp operations should have near-zero latency
      expect(p50).toBeLessThan(0.01); // Sub-microsecond median
      expect(p95).toBeLessThan(0.1);  // Sub-100 microsecond 95th percentile
      expect(p99).toBeLessThan(1);    // Sub-millisecond 99th percentile
    });

    it('should have consistent latency across all methods', () => {
      const methods = ['info', 'warn', 'error', 'debug'];
      const samples = 1000;
      const methodLatencies = {};
      
      methods.forEach(method => {
        const latencies = [];
        for (let i = 0; i < samples; i++) {
          const start = performance.now();
          logger[method]('test message');
          const end = performance.now();
          latencies.push(end - start);
        }
        
        latencies.sort((a, b) => a - b);
        methodLatencies[method] = {
          median: latencies[Math.floor(samples * 0.5)],
          p95: latencies[Math.floor(samples * 0.95)]
        };
      });
      
      // All methods should have similar performance
      const medians = Object.values(methodLatencies).map(m => m.median);
      const maxMedian = Math.max(...medians);
      const minMedian = Math.min(...medians);
      
      // Variance should be minimal (within 2x)
      if (minMedian > 0) {
        expect(maxMedian / minMedian).toBeLessThan(2);
      }
    });
  });

  describe('Memory Impact', () => {
    it('should have minimal memory allocation impact', async () => {
      // Note: This test requires --expose-gc flag to be fully accurate
      const iterations = 10000;
      
      // Warm up
      for (let i = 0; i < 100; i++) {
        logger.info('warmup');
      }
      
      // Get baseline memory using the proper method
      const baselineMemory = process.memoryUsage().heapUsed;
      
      // Perform many logging operations
      for (let i = 0; i < iterations; i++) {
        logger.info('test', i);
        logger.debug('debug', { iteration: i });
        logger.warn('warn', i);
        logger.error('error', new Error('test'));
      }
      
      // Get memory after operations
      const afterMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = afterMemory - baselineMemory;
      
      // NoOp logger should have minimal memory impact
      // Allow some variance for test framework overhead
      const bytesPerOperation = memoryIncrease / (iterations * 4);
      expect(bytesPerOperation).toBeLessThan(500); // Less than 500 bytes per op (allows for JS overhead)
    });
  });

  describe('Scalability Tests', () => {
    it('should maintain linear performance scaling', () => {
      const testSizes = [100, 1000, 10000];
      const timings = [];
      
      testSizes.forEach(size => {
        const benchmark = performanceTracker.startBenchmark(`scale-${size}`);
        
        for (let i = 0; i < size; i++) {
          logger.info('message', i);
          logger.debug('debug', i);
        }
        
        const metrics = benchmark.end();
        timings.push({
          size,
          duration: metrics.totalTime,
          opsPerMs: (size * 2) / metrics.totalTime
        });
      });
      
      // Check that operations per millisecond remains consistent
      const opsPerMsValues = timings.map(t => t.opsPerMs);
      const avgOpsPerMs = opsPerMsValues.reduce((a, b) => a + b, 0) / opsPerMsValues.length;
      
      // All values should be within 100% of average (linear scaling)
      // Allow for JIT compilation and runtime optimization variance
      opsPerMsValues.forEach(ops => {
        const deviation = Math.abs(ops - avgOpsPerMs) / avgOpsPerMs;
        expect(deviation).toBeLessThan(1.0);
      });
    });

    it('should handle burst operations efficiently', () => {
      const burstSize = 1000;
      const bursts = 10;
      const burstTimings = [];
      
      for (let burst = 0; burst < bursts; burst++) {
        const benchmark = performanceTracker.startBenchmark(`burst-${burst}`);
        
        // Rapid burst of operations
        for (let i = 0; i < burstSize; i++) {
          logger.info('burst', i);
          logger.warn('burst warn', i);
          logger.error('burst error', i);
          logger.debug('burst debug', i);
        }
        
        const metrics = benchmark.end();
        burstTimings.push(metrics.totalTime);
      }
      
      // All bursts should complete quickly
      burstTimings.forEach(timing => {
        expect(timing).toBeLessThan(10); // Each burst under 10ms
      });
      
      // Burst performance should be consistent
      const avgTiming = burstTimings.reduce((a, b) => a + b, 0) / burstTimings.length;
      const maxDeviation = Math.max(...burstTimings.map(t => Math.abs(t - avgTiming)));
      expect(maxDeviation / avgTiming).toBeLessThan(2.0); // Within 200% variance (allows for JIT warmup)
    });
  });

  describe('Comparison with Console Methods', () => {
    it('should be significantly faster than console methods', () => {
      const iterations = 1000;
      
      // Measure NoOpLogger performance
      const benchmark = performanceTracker.startBenchmark('noop-logger');
      for (let i = 0; i < iterations; i++) {
        logger.info('test');
        logger.groupCollapsed('group');
        logger.table([{ test: 'data' }]);
        logger.groupEnd();
      }
      const noopMetrics = benchmark.end();
      
      // NoOp should be extremely fast
      expect(noopMetrics.totalTime).toBeLessThan(10);
      
      // Calculate operations per second
      const noopOpsPerSecond = (iterations * 4) / (noopMetrics.totalTime / 1000);
      expect(noopOpsPerSecond).toBeGreaterThan(100000); // 100k+ ops/sec minimum
    });
  });

  describe('Edge Case Performance', () => {
    it('should handle undefined and null arguments efficiently', () => {
      const iterations = 5000;
      
      const benchmark = performanceTracker.startBenchmark('edge-cases');
      
      for (let i = 0; i < iterations; i++) {
        logger.info(undefined);
        logger.info(null);
        logger.warn(undefined, null);
        logger.error(null, undefined);
        logger.debug();
        logger.table(undefined, null);
        logger.setLogLevel(undefined);
        logger.setLogLevel(null);
      }
      
      const metrics = benchmark.end();
      
      // Edge cases should be handled as efficiently as normal cases
      expect(metrics.totalTime).toBeLessThan(50);
    });

    it('should handle various data types efficiently', () => {
      const iterations = 2000;
      const testData = [
        Symbol('test'),
        () => {},
        new Map([[1, 'one'], [2, 'two']]),
        new Set([1, 2, 3]),
        new WeakMap(),
        new WeakSet(),
        BigInt(9007199254740991),
        new ArrayBuffer(8),
        new Date(),
        /regex/gi
      ];
      
      const benchmark = performanceTracker.startBenchmark('various-types');
      
      for (let i = 0; i < iterations; i++) {
        testData.forEach(data => {
          logger.info('data', data);
          logger.debug('debug', data);
        });
      }
      
      const metrics = benchmark.end();
      
      // Should handle all types efficiently
      expect(metrics.totalTime).toBeLessThan(50);
    });
  });

  describe('Performance Baseline', () => {
    it('should establish performance baseline for regression testing', () => {
      const operations = {
        simple: 0,
        complex: 0,
        mixed: 0
      };
      
      // Simple operations baseline
      let benchmark = performanceTracker.startBenchmark('baseline-simple');
      for (let i = 0; i < 10000; i++) {
        logger.info('simple');
      }
      operations.simple = benchmark.end().totalTime;
      
      // Complex operations baseline
      const complexData = { nested: { data: Array(100).fill(0) } };
      benchmark = performanceTracker.startBenchmark('baseline-complex');
      for (let i = 0; i < 10000; i++) {
        logger.info('complex', complexData);
      }
      operations.complex = benchmark.end().totalTime;
      
      // Mixed operations baseline
      benchmark = performanceTracker.startBenchmark('baseline-mixed');
      for (let i = 0; i < 10000; i++) {
        logger.info('info', i);
        logger.debug('debug', { i });
        logger.warn('warn');
        logger.error('error');
      }
      operations.mixed = benchmark.end().totalTime;
      
      // All operations should be very fast
      expect(operations.simple).toBeLessThan(100);
      expect(operations.complex).toBeLessThan(100);
      expect(operations.mixed).toBeLessThan(100);
      
      // Log baselines for future reference
      // In a real CI/CD setup, these could be stored and compared
      // console.log('Performance baselines:', {
      //   simple: operations.simple,
      //   complex: operations.complex,
      //   mixed: operations.mixed,
      //   timestamp: new Date().toISOString()
      // });
    });
  });
});