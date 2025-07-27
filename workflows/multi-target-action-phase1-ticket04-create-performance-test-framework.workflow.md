# Ticket 04: Create Performance Test Framework

## Overview

Establish comprehensive performance testing infrastructure specifically for multi-target action processing. This framework will monitor validation performance, event processing speed, memory usage, and system throughput to ensure the multi-target enhancements do not degrade system performance.

## Dependencies

- Ticket 01: Update Event Schema (must be completed)
- Ticket 02: Create Schema Validation Tests (must be completed)
- Ticket 03: Add Multi-Target Validation Rules (must be completed)

## Blocks

- Ticket 07: Implement Multi-Target Data Extraction
- All performance-critical Phase 2 and 3 tickets

## Priority: High

## Estimated Time: 8-10 hours

## Background

Performance is critical for the multi-target action system since it processes user input in real-time. We need to establish baseline measurements and continuous monitoring to ensure:
1. No performance regression for single-target actions
2. Multi-target processing meets performance targets
3. Memory usage remains within acceptable bounds
4. System can handle realistic game session loads

## Implementation Details

### 1. Create Performance Test Base Class

**File**: `tests/common/performanceTestBase.js`

```javascript
/**
 * @file Base class for performance testing with comprehensive metrics
 */

import { performance } from 'perf_hooks';

/**
 * Base class for performance testing with detailed metrics collection
 */
export class PerformanceTestBase {
  #metrics;
  #testName;
  #startTime;
  #initialMemory;

  constructor(testName = 'Unknown Test') {
    this.#testName = testName;
    this.#metrics = {
      testName,
      samples: [],
      memory: [],
      timestamps: [],
      errors: 0,
      startTime: Date.now()
    };
  }

  /**
   * Starts performance measurement for a test iteration
   */
  startMeasurement() {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    this.#initialMemory = process.memoryUsage();
    this.#startTime = performance.now();
  }

  /**
   * Ends performance measurement and records results
   * @param {boolean} hasError - Whether the operation had errors
   * @returns {Object} Measurement result
   */
  endMeasurement(hasError = false) {
    const endTime = performance.now();
    const finalMemory = process.memoryUsage();
    
    const duration = endTime - this.#startTime;
    const memoryDelta = {
      heapUsed: finalMemory.heapUsed - this.#initialMemory.heapUsed,
      heapTotal: finalMemory.heapTotal - this.#initialMemory.heapTotal,
      external: finalMemory.external - this.#initialMemory.external,
      rss: finalMemory.rss - this.#initialMemory.rss
    };

    const measurement = {
      duration,
      memoryDelta,
      timestamp: Date.now(),
      hasError
    };

    this.#metrics.samples.push(duration);
    this.#metrics.memory.push(memoryDelta);
    this.#metrics.timestamps.push(measurement.timestamp);
    
    if (hasError) {
      this.#metrics.errors++;
    }

    return measurement;
  }

  /**
   * Measures the performance of a function
   * @param {Function} fn - Function to measure
   * @param {Array} args - Arguments to pass to function
   * @returns {Object} Result and measurement
   */
  async measureFunction(fn, ...args) {
    this.startMeasurement();
    
    let result;
    let error = null;
    
    try {
      result = await fn(...args);
    } catch (err) {
      error = err;
      result = null;
    }

    const measurement = this.endMeasurement(error !== null);

    return {
      result,
      error,
      measurement
    };
  }

  /**
   * Runs a performance benchmark with multiple iterations
   * @param {Function} fn - Function to benchmark
   * @param {Object} options - Benchmark options
   * @returns {Object} Benchmark results
   */
  async runBenchmark(fn, options = {}) {
    const {
      iterations = 100,
      warmupIterations = 10,
      args = [],
      description = 'Benchmark'
    } = options;

    console.log(`Running ${description} - ${warmupIterations} warmup + ${iterations} iterations`);

    // Warmup phase
    for (let i = 0; i < warmupIterations; i++) {
      try {
        await fn(...args);
      } catch (error) {
        // Ignore warmup errors
      }
    }

    // Reset metrics after warmup
    this.resetMetrics();

    // Actual benchmark
    const results = [];
    for (let i = 0; i < iterations; i++) {
      const result = await this.measureFunction(fn, ...args);
      results.push(result);

      // Progress indicator for long benchmarks
      if (iterations > 50 && i % 25 === 0) {
        console.log(`  Progress: ${i}/${iterations} (${((i/iterations)*100).toFixed(1)}%)`);
      }
    }

    return this.getDetailedMetrics();
  }

  /**
   * Gets comprehensive performance metrics
   * @returns {Object} Detailed metrics
   */
  getDetailedMetrics() {
    const samples = this.#metrics.samples;
    const memory = this.#metrics.memory;
    
    if (samples.length === 0) {
      return {
        testName: this.#testName,
        error: 'No samples collected',
        sampleCount: 0
      };
    }

    // Calculate timing statistics
    const sortedSamples = [...samples].sort((a, b) => a - b);
    const timingStats = {
      count: samples.length,
      min: Math.min(...samples),
      max: Math.max(...samples),
      mean: samples.reduce((sum, val) => sum + val, 0) / samples.length,
      median: this.#getPercentile(sortedSamples, 50),
      p75: this.#getPercentile(sortedSamples, 75),
      p90: this.#getPercentile(sortedSamples, 90),
      p95: this.#getPercentile(sortedSamples, 95),
      p99: this.#getPercentile(sortedSamples, 99),
      stdDev: this.#calculateStdDev(samples)
    };

    // Calculate memory statistics
    const heapUsedDeltas = memory.map(m => m.heapUsed);
    const memoryStats = {
      heapUsed: {
        min: Math.min(...heapUsedDeltas),
        max: Math.max(...heapUsedDeltas),
        mean: heapUsedDeltas.reduce((sum, val) => sum + val, 0) / heapUsedDeltas.length,
        total: heapUsedDeltas.reduce((sum, val) => sum + val, 0)
      },
      totalAllocated: memory.reduce((sum, m) => sum + Math.max(0, m.heapTotal), 0)
    };

    return {
      testName: this.#testName,
      timing: timingStats,
      memory: memoryStats,
      errorRate: this.#metrics.errors / samples.length,
      totalErrors: this.#metrics.errors,
      throughput: {
        operationsPerSecond: samples.length / ((Date.now() - this.#metrics.startTime) / 1000),
        averageLatency: timingStats.mean
      }
    };
  }

  /**
   * Calculates percentile from sorted array
   * @param {Array} sortedArray - Sorted array of values
   * @param {number} percentile - Percentile to calculate (0-100)
   * @returns {number} Percentile value
   */
  #getPercentile(sortedArray, percentile) {
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (lower === upper) {
      return sortedArray[lower];
    }

    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Calculates standard deviation
   * @param {Array} values - Array of values
   * @returns {number} Standard deviation
   */
  #calculateStdDev(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Validates performance against targets
   * @param {Object} targets - Performance targets
   * @returns {Object} Validation result
   */
  validatePerformance(targets) {
    const metrics = this.getDetailedMetrics();
    const issues = [];
    const warnings = [];

    // Check timing targets
    if (targets.maxMeanTime && metrics.timing.mean > targets.maxMeanTime) {
      issues.push(`Mean time ${metrics.timing.mean.toFixed(2)}ms exceeds target ${targets.maxMeanTime}ms`);
    }

    if (targets.maxP95Time && metrics.timing.p95 > targets.maxP95Time) {
      issues.push(`P95 time ${metrics.timing.p95.toFixed(2)}ms exceeds target ${targets.maxP95Time}ms`);
    }

    if (targets.maxP99Time && metrics.timing.p99 > targets.maxP99Time) {
      issues.push(`P99 time ${metrics.timing.p99.toFixed(2)}ms exceeds target ${targets.maxP99Time}ms`);
    }

    // Check memory targets
    if (targets.maxMemoryPerOp && metrics.memory.heapUsed.mean > targets.maxMemoryPerOp) {
      issues.push(`Mean memory usage ${(metrics.memory.heapUsed.mean / 1024).toFixed(2)}KB exceeds target ${(targets.maxMemoryPerOp / 1024).toFixed(2)}KB`);
    }

    // Check error rate
    if (targets.maxErrorRate && metrics.errorRate > targets.maxErrorRate) {
      issues.push(`Error rate ${(metrics.errorRate * 100).toFixed(2)}% exceeds target ${(targets.maxErrorRate * 100).toFixed(2)}%`);
    }

    // Check throughput
    if (targets.minThroughput && metrics.throughput.operationsPerSecond < targets.minThroughput) {
      warnings.push(`Throughput ${metrics.throughput.operationsPerSecond.toFixed(2)} ops/sec below target ${targets.minThroughput} ops/sec`);
    }

    return {
      passed: issues.length === 0,
      issues,
      warnings,
      metrics
    };
  }

  /**
   * Resets metrics collection
   */
  resetMetrics() {
    this.#metrics = {
      testName: this.#testName,
      samples: [],
      memory: [],
      timestamps: [],
      errors: 0,
      startTime: Date.now()
    };
  }

  /**
   * Exports metrics in various formats
   * @param {string} format - Export format ('json', 'csv', 'summary')
   * @returns {string} Formatted metrics
   */
  exportMetrics(format = 'json') {
    const metrics = this.getDetailedMetrics();

    switch (format) {
      case 'json':
        return JSON.stringify(metrics, null, 2);
      
      case 'csv':
        return this.#exportAsCsv();
      
      case 'summary':
        return this.#exportAsSummary(metrics);
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Exports metrics as CSV
   * @returns {string} CSV formatted metrics
   */
  #exportAsCsv() {
    const headers = ['iteration', 'duration_ms', 'heap_used_delta', 'timestamp'];
    const rows = this.#metrics.samples.map((duration, index) => [
      index + 1,
      duration.toFixed(3),
      this.#metrics.memory[index]?.heapUsed || 0,
      this.#metrics.timestamps[index]
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Exports metrics as summary
   * @param {Object} metrics - Metrics object
   * @returns {string} Summary formatted metrics
   */
  #exportAsSummary(metrics) {
    return `
Performance Summary: ${metrics.testName}
=====================================
Samples: ${metrics.timing.count}
Duration (ms):
  Mean: ${metrics.timing.mean.toFixed(2)}
  Median: ${metrics.timing.median.toFixed(2)}
  P95: ${metrics.timing.p95.toFixed(2)}
  P99: ${metrics.timing.p99.toFixed(2)}
  Min/Max: ${metrics.timing.min.toFixed(2)} / ${metrics.timing.max.toFixed(2)}

Memory (KB):
  Mean heap delta: ${(metrics.memory.heapUsed.mean / 1024).toFixed(2)}
  Max heap delta: ${(metrics.memory.heapUsed.max / 1024).toFixed(2)}

Throughput: ${metrics.throughput.operationsPerSecond.toFixed(2)} ops/sec
Error Rate: ${(metrics.errorRate * 100).toFixed(2)}%
    `.trim();
  }
}

export default PerformanceTestBase;
```

### 2. Create Multi-Target Performance Tests

**File**: `tests/performance/multiTargetActionPerformance.test.js`

```javascript
/**
 * @file Performance tests for multi-target action processing
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedClass } from '../common/testbed.js';
import { PerformanceTestBase } from '../common/performanceTestBase.js';
import { createValidLegacyEvent, createValidMultiTargetEvent } from '../common/schemaTestHelpers.js';

describe('Multi-Target Action Performance Tests', () => {
  let testBed;
  let performanceTest;

  beforeEach(() => {
    testBed = new TestBedClass();
    performanceTest = new PerformanceTestBase('Multi-Target Action Performance');
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Schema Validation Performance', () => {
    it('should validate legacy events within performance targets', async () => {
      const validator = testBed.get('IAjvSchemaValidator');
      const schemaId = 'core:attempt_action';
      const event = createValidLegacyEvent();

      const result = await performanceTest.runBenchmark(
        () => validator.validate(schemaId, event),
        {
          iterations: 1000,
          warmupIterations: 100,
          description: 'Legacy Event Validation'
        }
      );

      const validation = performanceTest.validatePerformance({
        maxMeanTime: 5,    // 5ms mean
        maxP95Time: 10,    // 10ms P95
        maxP99Time: 20,    // 20ms P99
        maxErrorRate: 0.01, // 1% error rate
        maxMemoryPerOp: 1024 // 1KB per operation
      });

      expect(validation.passed).toBe(true);
      if (!validation.passed) {
        console.log('Performance issues:', validation.issues);
        console.log('Performance warnings:', validation.warnings);
      }

      // Log summary for monitoring
      console.log(performanceTest.exportMetrics('summary'));
    });

    it('should validate multi-target events within performance targets', async () => {
      const validator = testBed.get('IAjvSchemaValidator');
      const schemaId = 'core:attempt_action';
      const event = createValidMultiTargetEvent({
        item: 'knife_123',
        target: 'goblin_456'
      });

      const result = await performanceTest.runBenchmark(
        () => validator.validate(schemaId, event),
        {
          iterations: 1000,
          warmupIterations: 100,
          description: 'Multi-Target Event Validation'
        }
      );

      const validation = performanceTest.validatePerformance({
        maxMeanTime: 5,    // 5ms mean
        maxP95Time: 10,    // 10ms P95
        maxP99Time: 20,    // 20ms P99
        maxErrorRate: 0.01, // 1% error rate
        maxMemoryPerOp: 1024 // 1KB per operation
      });

      expect(validation.passed).toBe(true);
      console.log(performanceTest.exportMetrics('summary'));
    });

    it('should handle complex multi-target events efficiently', async () => {
      const validator = testBed.get('IAjvSchemaValidator');
      const schemaId = 'core:attempt_action';
      
      // Create event with many targets
      const complexTargets = {};
      for (let i = 1; i <= 8; i++) {
        complexTargets[`target_${i}`] = `entity_${i}`;
      }
      const event = createValidMultiTargetEvent(complexTargets);

      const result = await performanceTest.runBenchmark(
        () => validator.validate(schemaId, event),
        {
          iterations: 500,
          warmupIterations: 50,
          description: 'Complex Multi-Target Event Validation'
        }
      );

      const validation = performanceTest.validatePerformance({
        maxMeanTime: 10,   // 10ms mean for complex events
        maxP95Time: 20,    // 20ms P95
        maxP99Time: 40,    // 40ms P99
        maxErrorRate: 0.01,
        maxMemoryPerOp: 2048 // 2KB for complex events
      });

      expect(validation.passed).toBe(true);
      console.log(performanceTest.exportMetrics('summary'));
    });
  });

  describe('Business Rule Validation Performance', () => {
    it('should perform business rule validation within targets', async () => {
      const MultiTargetEventValidator = testBed.get('MultiTargetEventValidator');
      const validator = new MultiTargetEventValidator({ logger: testBed.createMockLogger() });
      const event = createValidMultiTargetEvent({
        item: 'knife_123',
        target: 'goblin_456'
      });

      const result = await performanceTest.runBenchmark(
        () => validator.validateEvent(event),
        {
          iterations: 1000,
          warmupIterations: 100,
          description: 'Business Rule Validation'
        }
      );

      const validation = performanceTest.validatePerformance({
        maxMeanTime: 10,   // 10ms mean
        maxP95Time: 20,    // 20ms P95
        maxP99Time: 40,    // 40ms P99
        maxErrorRate: 0.01,
        maxMemoryPerOp: 1024
      });

      expect(validation.passed).toBe(true);
      console.log(performanceTest.exportMetrics('summary'));
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not leak memory during validation cycles', async () => {
      const validator = testBed.get('IAjvSchemaValidator');
      const schemaId = 'core:attempt_action';
      
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Run many validation cycles
      for (let cycle = 0; cycle < 10; cycle++) {
        for (let i = 0; i < 100; i++) {
          const event = createValidMultiTargetEvent({
            item: `item_${cycle}_${i}`,
            target: `target_${cycle}_${i}`
          });
          
          validator.validate(schemaId, event);
        }
        
        // Force garbage collection
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Should not increase memory by more than 1MB
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
      
      console.log(`Memory usage: ${(memoryIncrease / 1024).toFixed(2)}KB increase over 1000 validations`);
    });

    it('should handle large event batches efficiently', async () => {
      const validator = testBed.get('IAjvSchemaValidator');
      const schemaId = 'core:attempt_action';
      
      // Create batch of diverse events
      const events = [];
      for (let i = 0; i < 100; i++) {
        if (i % 3 === 0) {
          events.push(createValidLegacyEvent({ actorId: `actor_${i}` }));
        } else {
          events.push(createValidMultiTargetEvent({
            item: `item_${i}`,
            target: `target_${i}`
          }));
        }
      }

      const batchValidation = async () => {
        const results = [];
        for (const event of events) {
          results.push(validator.validate(schemaId, event));
        }
        return results;
      };

      const result = await performanceTest.runBenchmark(batchValidation, {
        iterations: 10,
        warmupIterations: 2,
        description: 'Batch Event Validation (100 events)'
      });

      const validation = performanceTest.validatePerformance({
        maxMeanTime: 500,  // 500ms for 100 events
        maxP95Time: 800,   // 800ms P95
        maxMemoryPerOp: 50 * 1024, // 50KB per batch
        maxErrorRate: 0.01
      });

      expect(validation.passed).toBe(true);
      console.log(performanceTest.exportMetrics('summary'));
    });
  });

  describe('Regression Tests', () => {
    it('should maintain performance parity with legacy validation', async () => {
      const validator = testBed.get('IAjvSchemaValidator');
      const schemaId = 'core:attempt_action';
      
      // Test legacy events
      const legacyEvent = createValidLegacyEvent();
      const legacyTest = new PerformanceTestBase('Legacy Event Performance');
      
      await legacyTest.runBenchmark(
        () => validator.validate(schemaId, legacyEvent),
        { iterations: 1000, description: 'Legacy Performance' }
      );
      
      const legacyMetrics = legacyTest.getDetailedMetrics();
      
      // Test same events with enhanced schema
      const enhancedTest = new PerformanceTestBase('Enhanced Schema Performance');
      
      await enhancedTest.runBenchmark(
        () => validator.validate(schemaId, legacyEvent),
        { iterations: 1000, description: 'Enhanced Performance' }
      );
      
      const enhancedMetrics = enhancedTest.getDetailedMetrics();
      
      // Enhanced schema should not be more than 10% slower
      const performanceRatio = enhancedMetrics.timing.mean / legacyMetrics.timing.mean;
      expect(performanceRatio).toBeLessThan(1.1);
      
      console.log(`Performance ratio: ${performanceRatio.toFixed(3)} (enhanced/legacy)`);
      console.log(`Legacy mean: ${legacyMetrics.timing.mean.toFixed(2)}ms`);
      console.log(`Enhanced mean: ${enhancedMetrics.timing.mean.toFixed(2)}ms`);
    });
  });

  describe('Stress Tests', () => {
    it('should handle sustained load without degradation', async () => {
      const validator = testBed.get('IAjvSchemaValidator');
      const schemaId = 'core:attempt_action';
      
      const sustainedTest = new PerformanceTestBase('Sustained Load Test');
      
      // Simulate 5 minutes of sustained validation load
      const testDuration = 5 * 1000; // 5 seconds for testing (would be 5 minutes in real scenario)
      const startTime = Date.now();
      let operationCount = 0;
      
      while (Date.now() - startTime < testDuration) {
        const event = operationCount % 2 === 0 
          ? createValidLegacyEvent({ actorId: `actor_${operationCount}` })
          : createValidMultiTargetEvent({ item: `item_${operationCount}`, target: `target_${operationCount}` });
        
        await sustainedTest.measureFunction(() => validator.validate(schemaId, event));
        operationCount++;
      }
      
      const metrics = sustainedTest.getDetailedMetrics();
      
      // Check for performance degradation over time
      const samples = sustainedTest._metrics?.samples || [];
      if (samples.length > 100) {
        const firstQuarter = samples.slice(0, Math.floor(samples.length / 4));
        const lastQuarter = samples.slice(-Math.floor(samples.length / 4));
        
        const firstQuarterMean = firstQuarter.reduce((sum, val) => sum + val, 0) / firstQuarter.length;
        const lastQuarterMean = lastQuarter.reduce((sum, val) => sum + val, 0) / lastQuarter.length;
        
        const degradationRatio = lastQuarterMean / firstQuarterMean;
        
        // Performance should not degrade by more than 20%
        expect(degradationRatio).toBeLessThan(1.2);
        
        console.log(`Operations completed: ${operationCount}`);
        console.log(`Performance degradation: ${((degradationRatio - 1) * 100).toFixed(1)}%`);
      }
    });
  });
});
```

### 3. Create Performance Monitoring Utilities

**File**: `tests/common/performanceMonitor.js`

```javascript
/**
 * @file Performance monitoring utilities for continuous testing
 */

import fs from 'fs/promises';
import path from 'path';

/**
 * Performance monitor for tracking metrics over time
 */
export class PerformanceMonitor {
  #metricsHistory;
  #metricsFile;

  constructor(metricsFile = 'performance-metrics.json') {
    this.#metricsFile = path.resolve(process.cwd(), 'test-results', metricsFile);
    this.#metricsHistory = [];
  }

  /**
   * Records performance metrics for tracking
   * @param {string} testName - Name of the test
   * @param {Object} metrics - Performance metrics
   * @param {Object} metadata - Additional metadata
   */
  async recordMetrics(testName, metrics, metadata = {}) {
    const record = {
      testName,
      timestamp: Date.now(),
      date: new Date().toISOString(),
      metrics,
      metadata: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        ...metadata
      }
    };

    this.#metricsHistory.push(record);
    await this.#saveMetrics();
  }

  /**
   * Loads historical metrics from file
   */
  async loadMetrics() {
    try {
      const data = await fs.readFile(this.#metricsFile, 'utf8');
      this.#metricsHistory = JSON.parse(data);
    } catch (error) {
      // File doesn't exist or is invalid - start fresh
      this.#metricsHistory = [];
    }
  }

  /**
   * Saves metrics to file
   */
  async #saveMetrics() {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.#metricsFile), { recursive: true });
      
      // Keep only last 1000 records
      const recentMetrics = this.#metricsHistory.slice(-1000);
      
      await fs.writeFile(this.#metricsFile, JSON.stringify(recentMetrics, null, 2));
    } catch (error) {
      console.warn('Failed to save performance metrics:', error.message);
    }
  }

  /**
   * Analyzes performance trends
   * @param {string} testName - Test to analyze
   * @param {number} days - Number of days to analyze
   * @returns {Object} Trend analysis
   */
  analyzeTrends(testName, days = 7) {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const recentMetrics = this.#metricsHistory.filter(
      record => record.testName === testName && record.timestamp >= cutoffTime
    );

    if (recentMetrics.length < 2) {
      return {
        testName,
        trend: 'insufficient_data',
        message: 'Not enough data for trend analysis'
      };
    }

    const timings = recentMetrics.map(record => record.metrics.timing?.mean || 0);
    const memories = recentMetrics.map(record => record.metrics.memory?.heapUsed?.mean || 0);

    return {
      testName,
      period: `${days} days`,
      sampleCount: recentMetrics.length,
      timing: this.#calculateTrend(timings),
      memory: this.#calculateTrend(memories),
      latest: recentMetrics[recentMetrics.length - 1],
      baseline: recentMetrics[0]
    };
  }

  /**
   * Calculates trend for a series of values
   * @param {Array} values - Values to analyze
   * @returns {Object} Trend analysis
   */
  #calculateTrend(values) {
    if (values.length < 2) {
      return { trend: 'insufficient_data', change: 0 };
    }

    const first = values[0];
    const last = values[values.length - 1];
    const change = ((last - first) / first) * 100;

    let trend;
    if (Math.abs(change) < 5) {
      trend = 'stable';
    } else if (change > 0) {
      trend = 'degrading';
    } else {
      trend = 'improving';
    }

    return {
      trend,
      change: change.toFixed(2),
      first,
      last,
      min: Math.min(...values),
      max: Math.max(...values),
      mean: values.reduce((sum, val) => sum + val, 0) / values.length
    };
  }

  /**
   * Generates performance report
   * @returns {string} HTML report
   */
  generateReport() {
    const testNames = [...new Set(this.#metricsHistory.map(record => record.testName))];
    const reports = testNames.map(testName => this.analyzeTrends(testName));

    return `
<!DOCTYPE html>
<html>
<head>
    <title>Multi-Target Action Performance Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .test-section { margin-bottom: 30px; border: 1px solid #ddd; padding: 15px; }
        .metric { margin: 10px 0; }
        .trend-stable { color: green; }
        .trend-degrading { color: red; }
        .trend-improving { color: blue; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <h1>Multi-Target Action Performance Report</h1>
    <p>Generated: ${new Date().toISOString()}</p>
    
    ${reports.map(report => `
    <div class="test-section">
        <h2>${report.testName}</h2>
        <div class="metric">
            <strong>Timing Trend:</strong> 
            <span class="trend-${report.timing.trend}">${report.timing.trend}</span>
            (${report.timing.change}% change)
        </div>
        <div class="metric">
            <strong>Memory Trend:</strong> 
            <span class="trend-${report.memory.trend}">${report.memory.trend}</span>
            (${report.memory.change}% change)
        </div>
        <div class="metric">
            <strong>Sample Count:</strong> ${report.sampleCount} over ${report.period}
        </div>
        
        <table>
            <tr>
                <th>Metric</th>
                <th>Current</th>
                <th>Baseline</th>
                <th>Min</th>
                <th>Max</th>
                <th>Mean</th>
            </tr>
            <tr>
                <td>Timing (ms)</td>
                <td>${report.timing.last?.toFixed(2) || 'N/A'}</td>
                <td>${report.timing.first?.toFixed(2) || 'N/A'}</td>
                <td>${report.timing.min?.toFixed(2) || 'N/A'}</td>
                <td>${report.timing.max?.toFixed(2) || 'N/A'}</td>
                <td>${report.timing.mean?.toFixed(2) || 'N/A'}</td>
            </tr>
            <tr>
                <td>Memory (KB)</td>
                <td>${((report.memory.last || 0) / 1024).toFixed(2)}</td>
                <td>${((report.memory.first || 0) / 1024).toFixed(2)}</td>
                <td>${((report.memory.min || 0) / 1024).toFixed(2)}</td>
                <td>${((report.memory.max || 0) / 1024).toFixed(2)}</td>
                <td>${((report.memory.mean || 0) / 1024).toFixed(2)}</td>
            </tr>
        </table>
    </div>
    `).join('')}
</body>
</html>
    `;
  }
}

export default PerformanceMonitor;
```

## Testing Requirements

### 1. Performance Targets

- **Schema validation**: <5ms mean, <10ms P95
- **Business rule validation**: <10ms mean, <20ms P95
- **Memory usage**: <1KB per validation operation
- **Batch processing**: <500ms for 100 events
- **No regression**: <10% slower than legacy for single-target events

### 2. Stress Testing

- Sustained load testing for 5+ minutes
- Memory leak detection over 1000+ operations
- Performance degradation analysis
- Concurrent validation testing

### 3. Monitoring and Reporting

- Automated performance metric collection
- Trend analysis over time
- Performance regression detection
- HTML report generation

## Success Criteria

1. **Performance Targets**: All performance targets consistently met
2. **Regression Testing**: <10% performance impact on legacy operations
3. **Monitoring**: Automated performance tracking and alerting
4. **Documentation**: Clear performance benchmarks and expectations
5. **Continuous Testing**: Performance tests integrated into CI/CD pipeline

## Files Created

- `tests/common/performanceTestBase.js`
- `tests/performance/multiTargetActionPerformance.test.js`
- `tests/common/performanceMonitor.js`

## Files Modified

- None (new performance testing infrastructure)

## Validation Steps

1. Run all performance tests and verify targets are met
2. Test performance monitoring and metric collection
3. Validate trend analysis and reporting functionality
4. Test under various load conditions
5. Verify no memory leaks or performance degradation

## Notes

- Performance tests are separate from unit tests for better organization
- Metrics are automatically saved for historical tracking
- Tests include both positive and stress testing scenarios
- Framework is extensible for future performance requirements

## Risk Assessment

**Low Risk**: Testing infrastructure only, no production code changes. Establishes baseline for monitoring performance throughout development.

## Next Steps

After this ticket completion:
1. Establish performance baselines for current system
2. Move to Phase 2: Command Processor Enhancement
3. Use performance framework to validate Phase 2 implementation