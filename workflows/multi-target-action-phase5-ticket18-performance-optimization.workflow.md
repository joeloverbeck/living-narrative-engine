# Ticket: Performance Optimization

## Ticket ID: PHASE5-TICKET18

## Priority: Low

## Estimated Time: 8-10 hours

## Dependencies: PHASE5-TICKET17

## Blocks: None (Final ticket)

## Overview

Optimize the multi-target action system for production performance. This includes caching strategies, algorithm optimization, memory management, and monitoring tools to ensure the system performs well under real-world conditions.

## Goals

1. **Target Resolution Performance**: Optimize target discovery and validation
2. **Memory Efficiency**: Reduce memory footprint and prevent leaks
3. **Caching Strategy**: Implement intelligent caching for expensive operations
4. **Algorithm Optimization**: Improve combination generation and filtering
5. **Monitoring Tools**: Provide performance monitoring and profiling capabilities

## Performance Targets

- **Target Resolution**: <100ms for complex actions with 20+ targets
- **Memory Usage**: <50MB additional memory for multi-target processing
- **Combination Generation**: Handle 1000+ potential combinations efficiently
- **Cache Hit Rate**: >80% for repeated scope evaluations
- **Garbage Collection**: Minimal GC pressure during action processing

## Implementation Steps

### Step 1: Performance Analysis and Baseline

Create file: `tools/performance/multi-target-profiler.js`

```javascript
/**
 * Multi-Target Action Performance Profiler
 * Measures and analyzes performance characteristics of the multi-target system
 */

import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';

export class MultiTargetProfiler {
  constructor() {
    this.metrics = {
      targetResolution: [],
      combinationGeneration: [],
      validation: [],
      scopeEvaluation: [],
      memoryUsage: [],
      cachePerformance: { hits: 0, misses: 0 },
    };
    this.isProfilingActive = false;
  }

  startProfiling() {
    this.isProfilingActive = true;
    this.metrics = {
      targetResolution: [],
      combinationGeneration: [],
      validation: [],
      scopeEvaluation: [],
      memoryUsage: [],
      cachePerformance: { hits: 0, misses: 0 },
    };
  }

  stopProfiling() {
    this.isProfilingActive = false;
    return this.generateReport();
  }

  measureTargetResolution(actionId, targetDefinitions, callback) {
    if (!this.isProfilingActive) return callback();

    const start = performance.now();
    const memBefore = process.memoryUsage();

    const result = callback();

    const end = performance.now();
    const memAfter = process.memoryUsage();

    this.metrics.targetResolution.push({
      actionId,
      targetCount: Object.keys(targetDefinitions).length,
      duration: end - start,
      memoryDelta: memAfter.heapUsed - memBefore.heapUsed,
      timestamp: Date.now(),
    });

    return result;
  }

  measureCombinationGeneration(actionId, targetCombinations, callback) {
    if (!this.isProfilingActive) return callback();

    const start = performance.now();
    const memBefore = process.memoryUsage();

    const result = callback();

    const end = performance.now();
    const memAfter = process.memoryUsage();

    this.metrics.combinationGeneration.push({
      actionId,
      combinationCount: targetCombinations,
      duration: end - start,
      memoryDelta: memAfter.heapUsed - memBefore.heapUsed,
      timestamp: Date.now(),
    });

    return result;
  }

  measureValidation(actionId, validationCount, callback) {
    if (!this.isProfilingActive) return callback();

    const start = performance.now();
    const result = callback();
    const end = performance.now();

    this.metrics.validation.push({
      actionId,
      validationCount,
      duration: end - start,
      timestamp: Date.now(),
    });

    return result;
  }

  measureScopeEvaluation(scopeExpression, resultCount, callback) {
    if (!this.isProfilingActive) return callback();

    const start = performance.now();
    const result = callback();
    const end = performance.now();

    this.metrics.scopeEvaluation.push({
      scopeExpression: scopeExpression.substring(0, 50), // Truncate for logging
      resultCount,
      duration: end - start,
      timestamp: Date.now(),
    });

    return result;
  }

  recordCacheHit() {
    if (this.isProfilingActive) {
      this.metrics.cachePerformance.hits++;
    }
  }

  recordCacheMiss() {
    if (this.isProfilingActive) {
      this.metrics.cachePerformance.misses++;
    }
  }

  recordMemoryUsage() {
    if (this.isProfilingActive) {
      const usage = process.memoryUsage();
      this.metrics.memoryUsage.push({
        ...usage,
        timestamp: Date.now(),
      });
    }
  }

  generateReport() {
    const report = {
      summary: this.generateSummary(),
      detailed: this.metrics,
      recommendations: this.generateRecommendations(),
      timestamp: Date.now(),
    };

    return report;
  }

  generateSummary() {
    const {
      targetResolution,
      combinationGeneration,
      validation,
      scopeEvaluation,
      cachePerformance,
    } = this.metrics;

    return {
      targetResolution: {
        count: targetResolution.length,
        avgDuration: this.average(targetResolution.map((m) => m.duration)),
        maxDuration: Math.max(...targetResolution.map((m) => m.duration), 0),
        avgMemoryDelta: this.average(
          targetResolution.map((m) => m.memoryDelta)
        ),
      },
      combinationGeneration: {
        count: combinationGeneration.length,
        avgDuration: this.average(combinationGeneration.map((m) => m.duration)),
        maxDuration: Math.max(
          ...combinationGeneration.map((m) => m.duration),
          0
        ),
        avgCombinations: this.average(
          combinationGeneration.map((m) => m.combinationCount)
        ),
      },
      validation: {
        count: validation.length,
        avgDuration: this.average(validation.map((m) => m.duration)),
        avgValidationCount: this.average(
          validation.map((m) => m.validationCount)
        ),
      },
      scopeEvaluation: {
        count: scopeEvaluation.length,
        avgDuration: this.average(scopeEvaluation.map((m) => m.duration)),
        avgResultCount: this.average(scopeEvaluation.map((m) => m.resultCount)),
      },
      cache: {
        hitRate:
          cachePerformance.hits /
            (cachePerformance.hits + cachePerformance.misses) || 0,
        totalRequests: cachePerformance.hits + cachePerformance.misses,
      },
    };
  }

  generateRecommendations() {
    const summary = this.generateSummary();
    const recommendations = [];

    // Performance recommendations
    if (summary.targetResolution.avgDuration > 100) {
      recommendations.push({
        type: 'performance',
        severity: 'high',
        message:
          'Target resolution is slow. Consider adding more specific scopes or reducing target sets.',
        metric: `Avg duration: ${summary.targetResolution.avgDuration.toFixed(2)}ms`,
      });
    }

    if (summary.combinationGeneration.avgCombinations > 100) {
      recommendations.push({
        type: 'performance',
        severity: 'medium',
        message:
          'High combination count detected. Consider adding maxCombinations limits.',
        metric: `Avg combinations: ${summary.combinationGeneration.avgCombinations.toFixed(0)}`,
      });
    }

    // Memory recommendations
    if (summary.targetResolution.avgMemoryDelta > 1024 * 1024) {
      // 1MB
      recommendations.push({
        type: 'memory',
        severity: 'medium',
        message:
          'High memory usage during target resolution. Check for memory leaks.',
        metric: `Avg memory delta: ${(summary.targetResolution.avgMemoryDelta / 1024 / 1024).toFixed(2)}MB`,
      });
    }

    // Cache recommendations
    if (summary.cache.hitRate < 0.8) {
      recommendations.push({
        type: 'cache',
        severity: 'low',
        message:
          'Cache hit rate is low. Consider improving cache key strategies.',
        metric: `Hit rate: ${(summary.cache.hitRate * 100).toFixed(1)}%`,
      });
    }

    return recommendations;
  }

  average(numbers) {
    return numbers.length > 0
      ? numbers.reduce((a, b) => a + b, 0) / numbers.length
      : 0;
  }

  saveReport(report, filename) {
    const outputPath = path.join(
      process.cwd(),
      'performance-reports',
      filename
    );
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    return outputPath;
  }
}

// Global profiler instance
export const globalProfiler = new MultiTargetProfiler();
```

### Step 2: Optimize Target Resolution with Caching

Create file: `src/actions/optimization/targetResolutionCache.js`

```javascript
/**
 * Target Resolution Cache
 * Caches expensive target resolution operations
 */

export class TargetResolutionCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || 300000; // 5 minutes default TTL
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }

  generateKey(scopeExpression, context, validationSchema) {
    // Create a stable cache key from scope, context, and validation
    const contextKey = this.serializeContext(context);
    const validationKey = validationSchema
      ? JSON.stringify(validationSchema)
      : '';

    return `${scopeExpression}|${contextKey}|${validationKey}`;
  }

  serializeContext(context) {
    // Create a stable, lightweight representation of context for caching
    const simplified = {
      actor: context.actor?.id,
      location: context.location?.id,
      game: {
        turnNumber: context.game?.turnNumber,
        // Don't include timestamp as it changes constantly
      },
      target: context.target?.id,
      targets: context.targets ? Object.keys(context.targets) : undefined,
    };

    return JSON.stringify(simplified);
  }

  get(scopeExpression, context, validationSchema) {
    const key = this.generateKey(scopeExpression, context, validationSchema);
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    this.stats.hits++;
    return entry.result;
  }

  set(scopeExpression, context, validationSchema, result) {
    const key = this.generateKey(scopeExpression, context, validationSchema);

    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }

    this.cache.set(key, {
      result: this.cloneResult(result),
      timestamp: Date.now(),
    });
  }

  cloneResult(result) {
    // Create a deep clone to prevent cache pollution
    return Array.isArray(result) ? [...result] : result;
  }

  clear() {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      size: this.cache.size,
      maxSize: this.maxSize,
    };
  }

  // Invalidate cache entries that might be affected by entity changes
  invalidateEntity(entityId) {
    const keysToDelete = [];

    for (const [key, entry] of this.cache.entries()) {
      // Simple check - if entity ID appears in the key, invalidate
      if (key.includes(entityId)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
    return keysToDelete.length;
  }

  // Invalidate cache entries for a specific location
  invalidateLocation(locationId) {
    const keysToDelete = [];

    for (const [key, entry] of this.cache.entries()) {
      if (key.includes(`"location":"${locationId}"`)) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
    return keysToDelete.length;
  }
}
```

### Step 3: Optimize Combination Generation Algorithm

Create file: `src/actions/optimization/combinationOptimizer.js`

```javascript
/**
 * Combination Generation Optimizer
 * Optimizes the generation of target combinations for better performance
 */

export class CombinationOptimizer {
  constructor() {
    this.maxCombinations = 100;
    this.earlyTermination = true;
    this.prioritizeCommonTargets = true;
  }

  generateOptimizedCombinations(targetSets, limits = {}) {
    const globalLimit = limits.global || this.maxCombinations;
    const combinations = [];

    // Calculate total possible combinations
    const totalPossible = targetSets.reduce(
      (total, set) => total * set.length,
      1
    );

    if (totalPossible <= globalLimit) {
      // Generate all combinations if within limits
      return this.generateAllCombinations(targetSets);
    }

    // Use optimized generation for large combination spaces
    return this.generateLimitedCombinations(targetSets, globalLimit, limits);
  }

  generateAllCombinations(targetSets) {
    if (targetSets.length === 0) return [];
    if (targetSets.length === 1) return targetSets[0].map((target) => [target]);

    const [first, ...rest] = targetSets;
    const restCombinations = this.generateAllCombinations(rest);

    const combinations = [];
    for (const target of first) {
      for (const restCombination of restCombinations) {
        combinations.push([target, ...restCombination]);
      }
    }

    return combinations;
  }

  generateLimitedCombinations(targetSets, globalLimit, perTargetLimits) {
    // Apply per-target limits first
    const limitedSets = targetSets.map((set, index) => {
      const limit = perTargetLimits[index];
      if (limit && set.length > limit) {
        // Use intelligent sampling instead of just taking first N
        return this.sampleTargets(set, limit);
      }
      return set;
    });

    // Generate combinations up to global limit
    const combinations = [];
    const indices = new Array(limitedSets.length).fill(0);

    while (combinations.length < globalLimit) {
      // Create combination from current indices
      const combination = indices.map(
        (index, setIndex) => limitedSets[setIndex][index]
      );
      combinations.push(combination);

      // Advance to next combination
      if (!this.advanceIndices(indices, limitedSets)) {
        break; // No more combinations
      }
    }

    return combinations;
  }

  sampleTargets(targets, limit) {
    if (targets.length <= limit) return targets;

    // Intelligent sampling: prioritize by some criteria
    const sampled = [];
    const step = Math.max(1, Math.floor(targets.length / limit));

    // Take evenly distributed samples
    for (let i = 0; i < targets.length && sampled.length < limit; i += step) {
      sampled.push(targets[i]);
    }

    // Fill remaining slots with random selection
    while (sampled.length < limit && sampled.length < targets.length) {
      const remaining = targets.filter((t) => !sampled.includes(t));
      if (remaining.length === 0) break;

      const randomIndex = Math.floor(Math.random() * remaining.length);
      sampled.push(remaining[randomIndex]);
    }

    return sampled;
  }

  advanceIndices(indices, targetSets) {
    // Advance indices like an odometer
    for (let i = indices.length - 1; i >= 0; i--) {
      indices[i]++;
      if (indices[i] < targetSets[i].length) {
        return true; // Successfully advanced
      }
      indices[i] = 0; // Reset this position and carry to next
    }
    return false; // All combinations exhausted
  }

  estimateCombinationCount(targetSets, limits = {}) {
    let estimate = 1;

    for (let i = 0; i < targetSets.length; i++) {
      const setSize = targetSets[i].length;
      const limit = limits[i];
      const effectiveSize = limit ? Math.min(setSize, limit) : setSize;
      estimate *= effectiveSize;
    }

    const globalLimit = limits.global || this.maxCombinations;
    return Math.min(estimate, globalLimit);
  }

  // Prefilter target sets to reduce combination space
  prefilterTargets(targetSets, filters = []) {
    return targetSets.map((targets, setIndex) => {
      const filter = filters[setIndex];
      if (!filter) return targets;

      return targets.filter((target) => {
        try {
          return filter(target);
        } catch (error) {
          console.warn('Filter error:', error);
          return true; // Include target if filter fails
        }
      });
    });
  }
}
```

### Step 4: Memory Management Optimizations

Create file: `src/actions/optimization/memoryManager.js`

```javascript
/**
 * Memory Management for Multi-Target Actions
 * Provides memory pooling and cleanup for action processing
 */

export class ActionMemoryManager {
  constructor() {
    this.objectPools = new Map();
    this.cleanupTasks = [];
    this.memoryThreshold = 100 * 1024 * 1024; // 100MB threshold
    this.gcInterval = 30000; // 30 seconds
    this.lastGC = Date.now();
  }

  // Object pooling for frequently created objects
  getPooledArray(key = 'default') {
    if (!this.objectPools.has(key)) {
      this.objectPools.set(key, []);
    }

    const pool = this.objectPools.get(key);
    return pool.length > 0 ? pool.pop() : [];
  }

  returnPooledArray(array, key = 'default') {
    if (!this.objectPools.has(key)) {
      this.objectPools.set(key, []);
    }

    // Clear and return to pool
    array.length = 0;
    const pool = this.objectPools.get(key);

    // Limit pool size to prevent memory bloat
    if (pool.length < 50) {
      pool.push(array);
    }
  }

  // Weak reference tracking for cleanup
  trackForCleanup(object, cleanupFn) {
    this.cleanupTasks.push({
      ref: new WeakRef(object),
      cleanup: cleanupFn,
      timestamp: Date.now(),
    });
  }

  // Periodic cleanup of weak references
  performCleanup() {
    const now = Date.now();
    const threshold = 5 * 60 * 1000; // 5 minutes

    this.cleanupTasks = this.cleanupTasks.filter((task) => {
      const object = task.ref.deref();

      // If object is GC'd or task is old, clean up
      if (!object || now - task.timestamp > threshold) {
        try {
          task.cleanup();
        } catch (error) {
          console.warn('Cleanup error:', error);
        }
        return false; // Remove from list
      }

      return true; // Keep in list
    });
  }

  // Check memory usage and trigger GC if needed
  checkMemoryPressure() {
    const now = Date.now();
    if (now - this.lastGC < this.gcInterval) {
      return false;
    }

    const usage = process.memoryUsage();
    if (usage.heapUsed > this.memoryThreshold) {
      this.forceGarbageCollection();
      this.lastGC = now;
      return true;
    }

    return false;
  }

  forceGarbageCollection() {
    // Perform cleanup tasks first
    this.performCleanup();

    // Clear object pools if they're getting large
    for (const [key, pool] of this.objectPools.entries()) {
      if (pool.length > 20) {
        pool.splice(0, pool.length - 10); // Keep only 10 objects
      }
    }

    // Force GC if available
    if (global.gc) {
      global.gc();
    }
  }

  // Optimize action processing for memory efficiency
  withMemoryManagement(actionProcessingFn) {
    return async (...args) => {
      const memBefore = process.memoryUsage();

      try {
        // Check memory pressure before processing
        this.checkMemoryPressure();

        // Execute action processing
        const result = await actionProcessingFn(...args);

        return result;
      } finally {
        // Check memory after processing
        const memAfter = process.memoryUsage();
        const deltaHeap = memAfter.heapUsed - memBefore.heapUsed;

        // If processing used a lot of memory, trigger cleanup
        if (deltaHeap > 10 * 1024 * 1024) {
          // 10MB
          this.performCleanup();
        }
      }
    };
  }

  getMemoryStats() {
    const usage = process.memoryUsage();
    return {
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
      poolSizes: Object.fromEntries(
        Array.from(this.objectPools.entries()).map(([key, pool]) => [
          key,
          pool.length,
        ])
      ),
      cleanupTasks: this.cleanupTasks.length,
      memoryPressure: usage.heapUsed > this.memoryThreshold,
    };
  }
}

// Global memory manager instance
export const globalMemoryManager = new ActionMemoryManager();
```

### Step 5: Performance Monitoring Integration

Create file: `src/actions/optimization/performanceMonitor.js`

```javascript
/**
 * Performance Monitor for Multi-Target Actions
 * Real-time monitoring and alerting for performance issues
 */

import { EventEmitter } from 'events';

export class PerformanceMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.thresholds = {
      targetResolution: options.targetResolutionThreshold || 100, // ms
      combinationGeneration: options.combinationThreshold || 50, // ms
      memoryUsage: options.memoryThreshold || 100 * 1024 * 1024, // 100MB
      cacheHitRate: options.cacheHitThreshold || 0.8,
      ...options.thresholds,
    };

    this.metrics = {
      operations: 0,
      slowOperations: 0,
      averageTime: 0,
      peakMemory: 0,
      cacheStats: { hits: 0, misses: 0 },
    };

    this.isMonitoring = false;
    this.alertCooldown = new Set();
  }

  startMonitoring() {
    this.isMonitoring = true;
    this.resetMetrics();

    // Set up periodic reporting
    this.reportInterval = setInterval(() => {
      this.generatePeriodicReport();
    }, 60000); // Every minute

    this.emit('monitoring:started');
  }

  stopMonitoring() {
    this.isMonitoring = false;

    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }

    this.emit('monitoring:stopped', this.getMetrics());
  }

  recordOperation(operationType, duration, metadata = {}) {
    if (!this.isMonitoring) return;

    this.metrics.operations++;

    // Update average time (running average)
    this.metrics.averageTime =
      (this.metrics.averageTime * (this.metrics.operations - 1) + duration) /
      this.metrics.operations;

    // Check for slow operations
    const threshold =
      this.thresholds[operationType] || this.thresholds.targetResolution;
    if (duration > threshold) {
      this.metrics.slowOperations++;
      this.handleSlowOperation(operationType, duration, metadata);
    }

    // Record peak memory usage
    const currentMemory = process.memoryUsage().heapUsed;
    if (currentMemory > this.metrics.peakMemory) {
      this.metrics.peakMemory = currentMemory;

      if (currentMemory > this.thresholds.memoryUsage) {
        this.handleHighMemoryUsage(currentMemory);
      }
    }

    this.emit('operation:recorded', {
      type: operationType,
      duration,
      metadata,
      slow: duration > threshold,
    });
  }

  recordCacheOperation(hit) {
    if (!this.isMonitoring) return;

    if (hit) {
      this.metrics.cacheStats.hits++;
    } else {
      this.metrics.cacheStats.misses++;
    }

    // Check cache hit rate
    const total = this.metrics.cacheStats.hits + this.metrics.cacheStats.misses;
    const hitRate = this.metrics.cacheStats.hits / total;

    if (total > 100 && hitRate < this.thresholds.cacheHitRate) {
      this.handleLowCacheHitRate(hitRate);
    }
  }

  handleSlowOperation(operationType, duration, metadata) {
    const alertKey = `slow:${operationType}`;

    if (this.alertCooldown.has(alertKey)) return;

    this.emit('alert:slow_operation', {
      type: operationType,
      duration,
      threshold: this.thresholds[operationType],
      metadata,
    });

    // Cooldown to prevent spam
    this.alertCooldown.add(alertKey);
    setTimeout(() => {
      this.alertCooldown.delete(alertKey);
    }, 30000); // 30 second cooldown
  }

  handleHighMemoryUsage(currentMemory) {
    const alertKey = 'memory:high';

    if (this.alertCooldown.has(alertKey)) return;

    this.emit('alert:high_memory', {
      current: currentMemory,
      threshold: this.thresholds.memoryUsage,
      usage: process.memoryUsage(),
    });

    this.alertCooldown.add(alertKey);
    setTimeout(() => {
      this.alertCooldown.delete(alertKey);
    }, 60000); // 1 minute cooldown
  }

  handleLowCacheHitRate(hitRate) {
    const alertKey = 'cache:low_hit_rate';

    if (this.alertCooldown.has(alertKey)) return;

    this.emit('alert:low_cache_hit_rate', {
      currentRate: hitRate,
      threshold: this.thresholds.cacheHitRate,
      stats: this.metrics.cacheStats,
    });

    this.alertCooldown.add(alertKey);
    setTimeout(() => {
      this.alertCooldown.delete(alertKey);
    }, 300000); // 5 minute cooldown
  }

  generatePeriodicReport() {
    const report = {
      timestamp: Date.now(),
      metrics: this.getMetrics(),
      system: {
        memory: process.memoryUsage(),
        uptime: process.uptime(),
      },
    };

    this.emit('report:periodic', report);
    return report;
  }

  getMetrics() {
    const total = this.metrics.cacheStats.hits + this.metrics.cacheStats.misses;

    return {
      ...this.metrics,
      slowOperationRate:
        this.metrics.operations > 0
          ? this.metrics.slowOperations / this.metrics.operations
          : 0,
      cacheHitRate: total > 0 ? this.metrics.cacheStats.hits / total : 0,
    };
  }

  resetMetrics() {
    this.metrics = {
      operations: 0,
      slowOperations: 0,
      averageTime: 0,
      peakMemory: process.memoryUsage().heapUsed,
      cacheStats: { hits: 0, misses: 0 },
    };
  }

  // Integration with action processing
  wrapActionProcessor(actionProcessor) {
    const monitor = this;

    return {
      async processAction(actionId, actorId, context) {
        const start = performance.now();

        try {
          const result = await actionProcessor.processAction(
            actionId,
            actorId,
            context
          );

          const duration = performance.now() - start;
          monitor.recordOperation('actionProcessing', duration, {
            actionId,
            actorId,
            success: result.success,
          });

          return result;
        } catch (error) {
          const duration = performance.now() - start;
          monitor.recordOperation('actionProcessing', duration, {
            actionId,
            actorId,
            error: error.message,
          });
          throw error;
        }
      },
    };
  }
}

// Global performance monitor instance
export const globalPerformanceMonitor = new PerformanceMonitor();
```

### Step 6: Optimized Multi-Target Resolution Stage

Create file: `src/actions/stages/optimizedMultiTargetResolutionStage.js`

```javascript
/**
 * Optimized Multi-Target Resolution Stage
 * Performance-optimized version of the multi-target resolution stage
 */

import { TargetResolutionCache } from '../optimization/targetResolutionCache.js';
import { CombinationOptimizer } from '../optimization/combinationOptimizer.js';
import { globalMemoryManager } from '../optimization/memoryManager.js';
import { globalPerformanceMonitor } from '../optimization/performanceMonitor.js';

export class OptimizedMultiTargetResolutionStage {
  constructor({ scopeInterpreter, ajvValidator, logger }) {
    this.scopeInterpreter = scopeInterpreter;
    this.ajvValidator = ajvValidator;
    this.logger = logger;

    this.cache = new TargetResolutionCache({
      maxSize: 2000,
      ttl: 300000, // 5 minutes
    });

    this.optimizer = new CombinationOptimizer();
    this.performanceThresholds = {
      targetResolution: 100, // ms
      combinationGeneration: 50, // ms
    };
  }

  async process(actionData, context) {
    const start = performance.now();

    try {
      if (!actionData.targetDefinitions) {
        return this.handleLegacyAction(actionData, context);
      }

      const targetSets = await this.resolveAllTargets(actionData, context);
      const combinations = this.generateOptimizedCombinations(
        actionData,
        targetSets
      );

      const duration = performance.now() - start;
      globalPerformanceMonitor.recordOperation(
        'multiTargetResolution',
        duration,
        {
          actionId: actionData.id,
          targetCount: Object.keys(actionData.targetDefinitions).length,
          combinationCount: combinations.length,
        }
      );

      return {
        success: true,
        value: {
          targetCombinations: combinations,
          metadata: {
            targetCount: Object.keys(actionData.targetDefinitions).length,
            combinationCount: combinations.length,
            processingTime: duration,
            cacheStats: this.cache.getStats(),
          },
        },
      };
    } catch (error) {
      this.logger.error('Optimized multi-target resolution failed', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async resolveAllTargets(actionData, context) {
    const targetSets = globalMemoryManager.getPooledArray('targetSets');
    const targetNames = Object.keys(actionData.targetDefinitions);

    try {
      for (const targetName of targetNames) {
        const targetDef = actionData.targetDefinitions[targetName];
        const targets = await this.resolveSingleTarget(
          targetDef,
          context,
          actionData.id
        );
        targetSets.push(targets);
      }

      return targetSets;
    } catch (error) {
      globalMemoryManager.returnPooledArray(targetSets, 'targetSets');
      throw error;
    }
  }

  async resolveSingleTarget(targetDef, context, actionId) {
    const start = performance.now();

    // Check cache first
    const cacheKey = this.cache.generateKey(
      targetDef.scope,
      context,
      targetDef.validation
    );
    let targets = this.cache.get(
      targetDef.scope,
      context,
      targetDef.validation
    );

    if (targets !== null) {
      globalPerformanceMonitor.recordCacheOperation(true);
      return targets;
    }

    globalPerformanceMonitor.recordCacheOperation(false);

    try {
      // Resolve scope with performance monitoring
      targets = await globalPerformanceMonitor.recordOperation(
        'scopeResolution',
        performance.now(),
        () => this.scopeInterpreter.evaluate(targetDef.scope, context)
      );

      // Apply validation if present
      if (targetDef.validation && Array.isArray(targets)) {
        targets = targets.filter((target) => {
          try {
            return this.ajvValidator.validate(targetDef.validation, target);
          } catch (error) {
            this.logger.warn('Validation error for target', { target, error });
            return false;
          }
        });
      }

      // Apply target-specific combination limits
      if (
        targetDef.maxCombinations &&
        targets.length > targetDef.maxCombinations
      ) {
        targets = this.optimizer.sampleTargets(
          targets,
          targetDef.maxCombinations
        );
      }

      // Cache the result
      this.cache.set(targetDef.scope, context, targetDef.validation, targets);

      const duration = performance.now() - start;
      globalPerformanceMonitor.recordOperation('targetResolution', duration, {
        actionId,
        targetCount: targets.length,
        cached: false,
      });

      return targets || [];
    } catch (error) {
      this.logger.error('Target resolution failed', {
        scope: targetDef.scope,
        error: error.message,
      });
      return [];
    }
  }

  generateOptimizedCombinations(actionData, targetSets) {
    const start = performance.now();

    // Calculate limits
    const globalLimit = actionData.maxCombinations || 100;
    const perTargetLimits = Object.values(actionData.targetDefinitions).map(
      (def) => def.maxCombinations
    );

    // Generate combinations with optimization
    const combinations = this.optimizer.generateOptimizedCombinations(
      targetSets,
      { global: globalLimit, ...perTargetLimits }
    );

    const duration = performance.now() - start;
    globalPerformanceMonitor.recordOperation(
      'combinationGeneration',
      duration,
      {
        actionId: actionData.id,
        combinationCount: combinations.length,
        targetSetSizes: targetSets.map((set) => set.length),
      }
    );

    // Return pooled arrays to memory manager
    targetSets.forEach((set) => {
      if (Array.isArray(set)) {
        globalMemoryManager.returnPooledArray(set, 'targets');
      }
    });
    globalMemoryManager.returnPooledArray(targetSets, 'targetSets');

    return combinations;
  }

  handleLegacyAction(actionData, context) {
    // Handle single-target actions for backward compatibility
    if (!actionData.target) {
      return {
        success: true,
        value: { targetCombinations: [] },
      };
    }

    // Convert to multi-target format temporarily
    const legacyTargetDef = {
      scope: actionData.target.scope,
      validation: actionData.target.validation,
    };

    return this.resolveSingleTarget(legacyTargetDef, context, actionData.id)
      .then((targets) => ({
        success: true,
        value: {
          targetCombinations: targets.map((target) => [target]),
          metadata: { legacy: true },
        },
      }))
      .catch((error) => ({
        success: false,
        error: error.message,
      }));
  }

  // Cache management methods
  clearCache() {
    this.cache.clear();
  }

  invalidateEntityCache(entityId) {
    return this.cache.invalidateEntity(entityId);
  }

  invalidateLocationCache(locationId) {
    return this.cache.invalidateLocation(locationId);
  }

  getPerformanceStats() {
    return {
      cache: this.cache.getStats(),
      memory: globalMemoryManager.getMemoryStats(),
      performance: globalPerformanceMonitor.getMetrics(),
    };
  }
}
```

### Step 7: Performance Testing Suite

Create file: `tests/performance/multiTargetPerformance.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { PerformanceTestBed } from '../common/performanceTestBed.js';
import { OptimizedMultiTargetResolutionStage } from '../../src/actions/stages/optimizedMultiTargetResolutionStage.js';
import { globalPerformanceMonitor } from '../../src/actions/optimization/performanceMonitor.js';

describe('Multi-Target Action Performance', () => {
  let testBed;
  let resolutionStage;

  beforeEach(() => {
    testBed = new PerformanceTestBed();
    resolutionStage = new OptimizedMultiTargetResolutionStage({
      scopeInterpreter: testBed.getService('scopeInterpreter'),
      ajvValidator: testBed.getService('ajvValidator'),
      logger: testBed.getService('logger'),
    });

    globalPerformanceMonitor.startMonitoring();
  });

  afterEach(() => {
    const metrics = globalPerformanceMonitor.stopMonitoring();
    console.log('Performance metrics:', metrics);
    testBed.cleanup();
  });

  describe('Target Resolution Performance', () => {
    it('should resolve targets quickly with small datasets', async () => {
      // Create test scenario with small dataset
      const entities = testBed.createTestEntities(10, 5); // 10 actors, 5 items
      const action = testBed.createMultiTargetAction({
        targetDefinitions: {
          item: { scope: 'actor.core:inventory.items[]' },
          person: { scope: 'location.core:actors[]' },
        },
      });

      const start = performance.now();
      const result = await resolutionStage.process(action, entities.context);
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(50); // Should be very fast for small datasets
      expect(result.value.targetCombinations.length).toBeGreaterThan(0);
    });

    it('should handle large datasets efficiently', async () => {
      // Create test scenario with large dataset
      const entities = testBed.createTestEntities(100, 50); // 100 actors, 50 items
      const action = testBed.createMultiTargetAction({
        maxCombinations: 100,
        targetDefinitions: {
          item: {
            scope: 'actor.core:inventory.items[]',
            maxCombinations: 10,
          },
          person: {
            scope: 'location.core:actors[]',
            maxCombinations: 10,
          },
        },
      });

      const start = performance.now();
      const result = await resolutionStage.process(action, entities.context);
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(200); // Should handle large datasets reasonably
      expect(result.value.targetCombinations.length).toBeLessThanOrEqual(100);
    });

    it('should benefit from caching on repeated resolutions', async () => {
      const entities = testBed.createTestEntities(20, 10);
      const action = testBed.createMultiTargetAction({
        targetDefinitions: {
          item: { scope: 'actor.core:inventory.items[]' },
          person: { scope: 'location.core:actors[]' },
        },
      });

      // First resolution (cold cache)
      const start1 = performance.now();
      const result1 = await resolutionStage.process(action, entities.context);
      const duration1 = performance.now() - start1;

      // Second resolution (warm cache)
      const start2 = performance.now();
      const result2 = await resolutionStage.process(action, entities.context);
      const duration2 = performance.now() - start2;

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(duration2).toBeLessThan(duration1 * 0.5); // Should be significantly faster with cache

      const cacheStats = resolutionStage.getPerformanceStats().cache;
      expect(cacheStats.hitRate).toBeGreaterThan(0.5);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not leak memory during repeated processing', async () => {
      const entities = testBed.createTestEntities(30, 20);
      const action = testBed.createMultiTargetAction({
        targetDefinitions: {
          item: { scope: 'actor.core:inventory.items[]' },
          person: { scope: 'location.core:actors[]' },
        },
      });

      const initialMemory = process.memoryUsage().heapUsed;

      // Process action many times
      for (let i = 0; i < 50; i++) {
        await resolutionStage.process(action, entities.context);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryGrowth = finalMemory - initialMemory;

      // Memory growth should be minimal (less than 10MB)
      expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
    });

    it('should maintain reasonable memory usage with large combination counts', async () => {
      const entities = testBed.createTestEntities(50, 100);
      const action = testBed.createMultiTargetAction({
        maxCombinations: 500,
        targetDefinitions: {
          item: { scope: 'actor.core:inventory.items[]' },
          person: { scope: 'location.core:actors[]' },
          location: { scope: 'game.locations[]' },
        },
      });

      const memBefore = process.memoryUsage();
      const result = await resolutionStage.process(action, entities.context);
      const memAfter = process.memoryUsage();

      const memoryDelta = memAfter.heapUsed - memBefore.heapUsed;

      expect(result.success).toBe(true);
      expect(memoryDelta).toBeLessThan(50 * 1024 * 1024); // Less than 50MB for processing
    });
  });

  describe('Combination Generation Performance', () => {
    it('should generate combinations efficiently', async () => {
      // Test with various combination counts
      const testCases = [
        { actors: 5, items: 5, expected: 25 },
        { actors: 10, items: 10, expected: 100 },
        { actors: 20, items: 20, expected: 100 }, // Should be limited by maxCombinations
      ];

      for (const testCase of testCases) {
        const entities = testBed.createTestEntities(
          testCase.actors,
          testCase.items
        );
        const action = testBed.createMultiTargetAction({
          maxCombinations: 100,
          targetDefinitions: {
            item: { scope: 'actor.core:inventory.items[]' },
            person: { scope: 'location.core:actors[]' },
          },
        });

        const start = performance.now();
        const result = await resolutionStage.process(action, entities.context);
        const duration = performance.now() - start;

        expect(result.success).toBe(true);
        expect(result.value.targetCombinations.length).toBeLessThanOrEqual(
          testCase.expected
        );
        expect(duration).toBeLessThan(100); // Should be fast regardless of dataset size
      }
    });
  });

  describe('Context-Dependent Performance', () => {
    it('should handle context dependencies efficiently', async () => {
      const entities = testBed.createTestEntities(20, 30);

      // Add containers and keys for context testing
      testBed.addContainers(10, ['brass', 'silver', 'gold']);
      testBed.addKeys(15, ['brass', 'silver', 'gold']);

      const action = testBed.createContextDependentAction({
        targetDefinitions: {
          container: {
            scope: 'location.core:objects[]',
            validation: { locked: true },
          },
          key: {
            scope: 'actor.core:inventory.items[]',
            contextFrom: 'container',
            validation: { matchesLock: true },
          },
        },
      });

      const start = performance.now();
      const result = await resolutionStage.process(action, entities.context);
      const duration = performance.now() - start;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(150); // Context dependencies add some overhead
      expect(result.value.targetCombinations.length).toBeGreaterThan(0);
    });
  });

  describe('Performance Regression Detection', () => {
    it('should maintain performance within acceptable bounds', async () => {
      const baselineScenarios = [
        { name: 'small', actors: 5, items: 5, maxTime: 25 },
        { name: 'medium', actors: 20, items: 20, maxTime: 75 },
        { name: 'large', actors: 50, items: 50, maxTime: 150 },
      ];

      const results = [];

      for (const scenario of baselineScenarios) {
        const entities = testBed.createTestEntities(
          scenario.actors,
          scenario.items
        );
        const action = testBed.createMultiTargetAction({
          maxCombinations: 100,
          targetDefinitions: {
            item: { scope: 'actor.core:inventory.items[]' },
            person: { scope: 'location.core:actors[]' },
          },
        });

        const times = [];

        // Run multiple times to get stable measurements
        for (let i = 0; i < 5; i++) {
          const start = performance.now();
          await resolutionStage.process(action, entities.context);
          const duration = performance.now() - start;
          times.push(duration);
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        results.push({
          scenario: scenario.name,
          avgTime,
          maxTime: scenario.maxTime,
        });

        expect(avgTime).toBeLessThan(scenario.maxTime);
      }

      console.log('Performance benchmarks:', results);
    });
  });
});
```

## Acceptance Criteria

1.  Performance profiling and analysis tools implemented
2.  Target resolution caching with intelligent invalidation
3.  Optimized combination generation algorithm
4.  Memory management with object pooling and cleanup
5.  Real-time performance monitoring with alerting
6.  Optimized multi-target resolution stage
7.  Comprehensive performance test suite
8.  Performance targets met: <100ms resolution, <50MB memory
9.  Cache hit rate >80% for repeated operations
10.  Memory leak prevention and garbage collection optimization

## Documentation Requirements

### For Developers

- Performance optimization techniques and algorithms
- Caching strategies and invalidation patterns
- Memory management best practices
- Monitoring and alerting configuration
- Performance testing methodologies

### For Operations

- Performance monitoring dashboard setup
- Alert configuration and response procedures
- Capacity planning guidelines
- Performance tuning recommendations

## Future Enhancements

1. **Machine Learning Optimization**: AI-powered cache preloading and target prediction
2. **Distributed Caching**: Multi-instance cache sharing for scalability
3. **Real-time Analytics**: Live performance dashboards and analytics
4. **Adaptive Algorithms**: Self-tuning performance based on usage patterns
5. **WebAssembly Acceleration**: Critical path optimization using WebAssembly
