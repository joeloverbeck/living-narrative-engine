# Ticket 17: Performance Optimization and Monitoring

## Overview

Implement comprehensive performance optimization and monitoring systems for the multi-target action event system. This includes performance profiling, bottleneck identification, optimization implementations, and real-time monitoring with alerting capabilities to ensure the enhanced system maintains optimal performance characteristics.

## Dependencies

- Ticket 16: Create Migration Utilities and Scripts (must be completed)
- Ticket 14: Comprehensive Integration Testing (must be completed)

## Blocks

- Ticket 18: Final System Deployment and Validation

## Priority: High

## Estimated Time: 10-12 hours

## Background

The multi-target action event system introduces additional complexity in event processing, schema validation, and rule evaluation. To ensure this enhanced functionality doesn't negatively impact system performance, comprehensive optimization and monitoring is essential. This includes profiling tools, performance benchmarks, optimization strategies, and real-time monitoring infrastructure.

## Implementation Details

### 1. Performance Profiling System

**File**: `src/performance/multiTargetProfiler.js`

Create comprehensive profiling system for multi-target operations:

```javascript
/**
 * @file Performance profiling system for multi-target action events
 */

import { ensureValidLogger } from '../utils/loggerUtils.js';
import { assertPresent } from '../utils/validationUtils.js';

/**
 * Performance profiler for multi-target action event system
 */
export class MultiTargetProfiler {
  #logger;
  #metrics;
  #activeProfiles;
  #thresholds;
  #isEnabled;

  constructor({ logger, performanceThresholds = {} }) {
    this.#logger = ensureValidLogger(logger);
    this.#metrics = new Map();
    this.#activeProfiles = new Map();
    this.#isEnabled = true;
    
    // Default performance thresholds (in milliseconds)
    this.#thresholds = {
      eventProcessing: 50,
      schemaValidation: 10,
      targetExtraction: 15,
      ruleEvaluation: 25,
      commandProcessing: 30,
      ...performanceThresholds
    };
  }

  /**
   * Starts profiling a multi-target operation
   * @param {string} operationId - Unique operation identifier
   * @param {string} operationType - Type of operation being profiled
   * @param {Object} metadata - Additional operation metadata
   * @returns {string} Profile session ID
   */
  startProfiling(operationId, operationType, metadata = {}) {
    if (!this.#isEnabled) return null;

    assertPresent(operationId, 'Operation ID is required');
    assertPresent(operationType, 'Operation type is required');

    const sessionId = `${operationType}_${operationId}_${Date.now()}`;
    const startTime = performance.now();

    this.#activeProfiles.set(sessionId, {
      operationId,
      operationType,
      startTime,
      checkpoints: [],
      metadata: {
        ...metadata,
        timestamp: new Date().toISOString(),
        memoryUsage: this.#getMemoryUsage()
      }
    });

    this.#logger.debug(`Performance profiling started for ${operationType}:${operationId}`, {
      sessionId,
      metadata
    });

    return sessionId;
  }

  /**
   * Adds a checkpoint to an active profiling session
   * @param {string} sessionId - Profile session ID
   * @param {string} checkpointName - Name of the checkpoint
   * @param {Object} data - Additional checkpoint data
   */
  addCheckpoint(sessionId, checkpointName, data = {}) {
    if (!this.#isEnabled || !sessionId) return;

    const profile = this.#activeProfiles.get(sessionId);
    if (!profile) {
      this.#logger.warn(`No active profile found for session: ${sessionId}`);
      return;
    }

    const currentTime = performance.now();
    const elapsedFromStart = currentTime - profile.startTime;
    const elapsedFromLast = profile.checkpoints.length > 0 
      ? currentTime - profile.checkpoints[profile.checkpoints.length - 1].timestamp
      : elapsedFromStart;

    profile.checkpoints.push({
      name: checkpointName,
      timestamp: currentTime,
      elapsedFromStart,
      elapsedFromLast,
      memoryUsage: this.#getMemoryUsage(),
      data
    });

    this.#logger.debug(`Checkpoint added: ${checkpointName}`, {
      sessionId,
      elapsedFromStart: `${elapsedFromStart.toFixed(2)}ms`,
      elapsedFromLast: `${elapsedFromLast.toFixed(2)}ms`
    });
  }

  /**
   * Completes profiling session and records metrics
   * @param {string} sessionId - Profile session ID
   * @param {Object} result - Operation result data
   * @returns {Object} Performance metrics
   */
  endProfiling(sessionId, result = {}) {
    if (!this.#isEnabled || !sessionId) return null;

    const profile = this.#activeProfiles.get(sessionId);
    if (!profile) {
      this.#logger.warn(`No active profile found for session: ${sessionId}`);
      return null;
    }

    const endTime = performance.now();
    const totalDuration = endTime - profile.startTime;
    const finalMemoryUsage = this.#getMemoryUsage();

    const metrics = {
      sessionId,
      operationId: profile.operationId,
      operationType: profile.operationType,
      totalDuration,
      checkpoints: profile.checkpoints,
      metadata: profile.metadata,
      result: {
        success: result.success !== false,
        ...result
      },
      memoryDelta: finalMemoryUsage - profile.metadata.memoryUsage,
      thresholdViolations: this.#checkThresholds(profile.operationType, totalDuration),
      timestamp: new Date().toISOString()
    };

    // Store metrics
    this.#storeMetrics(metrics);

    // Check for performance issues
    this.#analyzePerformance(metrics);

    // Cleanup active profile
    this.#activeProfiles.delete(sessionId);

    this.#logger.debug(`Performance profiling completed for ${profile.operationType}:${profile.operationId}`, {
      totalDuration: `${totalDuration.toFixed(2)}ms`,
      thresholdViolations: metrics.thresholdViolations
    });

    return metrics;
  }

  /**
   * Profiles a complete multi-target event processing cycle
   * @param {Object} event - Event being processed
   * @param {Function} processingFunction - Function that processes the event
   * @returns {Object} Processing result with performance metrics
   */
  async profileEventProcessing(event, processingFunction) {
    const sessionId = this.startProfiling(
      event.eventId || 'unknown',
      'eventProcessing',
      {
        eventName: event.eventName,
        hasTargets: !!event.targets,
        targetCount: event.targets ? Object.keys(event.targets).length : 0,
        eventSize: JSON.stringify(event).length
      }
    );

    try {
      this.addCheckpoint(sessionId, 'processingStart');
      
      const result = await processingFunction();
      
      this.addCheckpoint(sessionId, 'processingComplete', {
        resultType: typeof result,
        resultSize: JSON.stringify(result).length
      });

      const metrics = this.endProfiling(sessionId, { success: true, result });
      
      return {
        result,
        performance: metrics
      };
    } catch (error) {
      this.addCheckpoint(sessionId, 'processingError', {
        errorType: error.constructor.name,
        errorMessage: error.message
      });

      const metrics = this.endProfiling(sessionId, { 
        success: false, 
        error: error.message 
      });

      throw error; // Re-throw after recording metrics
    }
  }

  /**
   * Gets performance statistics for analysis
   * @param {string} operationType - Filter by operation type
   * @param {number} timeRangeMs - Time range in milliseconds (default: 1 hour)
   * @returns {Object} Performance statistics
   */
  getPerformanceStats(operationType = null, timeRangeMs = 3600000) {
    const cutoffTime = Date.now() - timeRangeMs;
    const relevantMetrics = Array.from(this.#metrics.values())
      .filter(metric => {
        const metricTime = new Date(metric.timestamp).getTime();
        return metricTime > cutoffTime && 
               (!operationType || metric.operationType === operationType);
      });

    if (relevantMetrics.length === 0) {
      return {
        operationType,
        timeRangeMs,
        sampleCount: 0,
        averageDuration: 0,
        medianDuration: 0,
        p95Duration: 0,
        thresholdViolationRate: 0
      };
    }

    const durations = relevantMetrics.map(m => m.totalDuration).sort((a, b) => a - b);
    const violations = relevantMetrics.filter(m => m.thresholdViolations.length > 0);

    return {
      operationType,
      timeRangeMs,
      sampleCount: relevantMetrics.length,
      averageDuration: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      medianDuration: durations[Math.floor(durations.length / 2)],
      p95Duration: durations[Math.floor(durations.length * 0.95)],
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      thresholdViolationRate: violations.length / relevantMetrics.length,
      memoryImpact: this.#calculateMemoryImpact(relevantMetrics),
      checkpointAnalysis: this.#analyzeCheckpoints(relevantMetrics)
    };
  }

  /**
   * Enables or disables profiling
   * @param {boolean} enabled - Whether profiling should be enabled
   */
  setEnabled(enabled) {
    this.#isEnabled = enabled;
    this.#logger.info(`Performance profiling ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Clears all stored metrics
   */
  clearMetrics() {
    this.#metrics.clear();
    this.#logger.info('Performance metrics cleared');
  }

  /**
   * Gets current memory usage
   * @returns {number} Memory usage in MB
   */
  #getMemoryUsage() {
    if (typeof performance !== 'undefined' && performance.memory) {
      return performance.memory.usedJSHeapSize / 1024 / 1024;
    }
    return 0;
  }

  /**
   * Stores performance metrics
   * @param {Object} metrics - Metrics to store
   */
  #storeMetrics(metrics) {
    // Keep only last 1000 metrics to prevent memory bloat
    if (this.#metrics.size >= 1000) {
      const oldestKey = this.#metrics.keys().next().value;
      this.#metrics.delete(oldestKey);
    }
    
    this.#metrics.set(metrics.sessionId, metrics);
  }

  /**
   * Checks if operation duration violates thresholds
   * @param {string} operationType - Type of operation
   * @param {number} duration - Operation duration in ms
   * @returns {Array} Array of threshold violations
   */
  #checkThresholds(operationType, duration) {
    const violations = [];
    const threshold = this.#thresholds[operationType];
    
    if (threshold && duration > threshold) {
      violations.push({
        type: 'duration',
        operationType,
        threshold,
        actual: duration,
        severity: duration > threshold * 2 ? 'high' : 'medium'
      });
    }

    return violations;
  }

  /**
   * Analyzes performance metrics for issues
   * @param {Object} metrics - Performance metrics
   */
  #analyzePerformance(metrics) {
    // Log threshold violations
    if (metrics.thresholdViolations.length > 0) {
      this.#logger.warn('Performance threshold violations detected', {
        operationId: metrics.operationId,
        operationType: metrics.operationType,
        violations: metrics.thresholdViolations
      });
    }

    // Check for memory issues
    if (metrics.memoryDelta > 10) { // More than 10MB increase
      this.#logger.warn('Significant memory usage increase detected', {
        operationId: metrics.operationId,
        operationType: metrics.operationType,
        memoryDelta: `${metrics.memoryDelta.toFixed(2)}MB`
      });
    }

    // Analyze checkpoint performance
    const slowCheckpoints = metrics.checkpoints.filter(cp => cp.elapsedFromLast > 20);
    if (slowCheckpoints.length > 0) {
      this.#logger.warn('Slow checkpoints detected', {
        operationId: metrics.operationId,
        slowCheckpoints: slowCheckpoints.map(cp => ({
          name: cp.name,
          duration: `${cp.elapsedFromLast.toFixed(2)}ms`
        }))
      });
    }
  }

  /**
   * Calculates memory impact statistics
   * @param {Array} metrics - Array of metrics
   * @returns {Object} Memory impact analysis
   */
  #calculateMemoryImpact(metrics) {
    const memoryDeltas = metrics.map(m => m.memoryDelta);
    const positiveDeltas = memoryDeltas.filter(d => d > 0);
    
    return {
      averageDelta: memoryDeltas.reduce((sum, d) => sum + d, 0) / memoryDeltas.length,
      maxIncrease: Math.max(...memoryDeltas),
      memoryLeakIndicators: positiveDeltas.length / memoryDeltas.length
    };
  }

  /**
   * Analyzes checkpoint performance patterns
   * @param {Array} metrics - Array of metrics
   * @returns {Object} Checkpoint analysis
   */
  #analyzeCheckpoints(metrics) {
    const checkpointStats = {};
    
    metrics.forEach(metric => {
      metric.checkpoints.forEach(checkpoint => {
        if (!checkpointStats[checkpoint.name]) {
          checkpointStats[checkpoint.name] = [];
        }
        checkpointStats[checkpoint.name].push(checkpoint.elapsedFromLast);
      });
    });

    const analysis = {};
    Object.entries(checkpointStats).forEach(([name, durations]) => {
      durations.sort((a, b) => a - b);
      analysis[name] = {
        count: durations.length,
        average: durations.reduce((sum, d) => sum + d, 0) / durations.length,
        median: durations[Math.floor(durations.length / 2)],
        p95: durations[Math.floor(durations.length * 0.95)]
      };
    });

    return analysis;
  }
}

export default MultiTargetProfiler;
```

### 2. Performance Optimization Engine

**File**: `src/performance/performanceOptimizer.js`

Create optimization engine for multi-target operations:

```javascript
/**
 * @file Performance optimization engine for multi-target system
 */

import { ensureValidLogger } from '../utils/loggerUtils.js';
import { assertPresent } from '../utils/validationUtils.js';

/**
 * Performance optimization engine for multi-target action events
 */
export class PerformanceOptimizer {
  #logger;
  #cacheManager;
  #optimizationStrategies;
  #metrics;
  #isEnabled;

  constructor({ logger, cacheManager }) {
    this.#logger = ensureValidLogger(logger);
    this.#cacheManager = cacheManager;
    this.#metrics = new Map();
    this.#isEnabled = true;
    
    this.#optimizationStrategies = new Map([
      ['schema_validation', this.#optimizeSchemaValidation.bind(this)],
      ['target_extraction', this.#optimizeTargetExtraction.bind(this)],
      ['rule_evaluation', this.#optimizeRuleEvaluation.bind(this)],
      ['event_processing', this.#optimizeEventProcessing.bind(this)]
    ]);
  }

  /**
   * Optimizes multi-target event processing pipeline
   * @param {Object} event - Event to process
   * @param {Object} context - Processing context
   * @returns {Object} Optimized processing result
   */
  async optimizeEventProcessing(event, context) {
    if (!this.#isEnabled) {
      return { event, context, optimizations: [] };
    }

    const optimizations = [];
    let optimizedEvent = { ...event };
    let optimizedContext = { ...context };

    // Apply optimization strategies
    for (const [strategyName, strategy] of this.#optimizationStrategies) {
      try {
        const result = await strategy(optimizedEvent, optimizedContext);
        if (result.optimized) {
          optimizations.push({
            strategy: strategyName,
            improvement: result.improvement,
            details: result.details
          });
          optimizedEvent = result.event || optimizedEvent;
          optimizedContext = result.context || optimizedContext;
        }
      } catch (error) {
        this.#logger.warn(`Optimization strategy '${strategyName}' failed`, {
          error: error.message,
          eventId: event.eventId
        });
      }
    }

    // Record optimization metrics
    this.#recordOptimizationMetrics(event, optimizations);

    return {
      event: optimizedEvent,
      context: optimizedContext,
      optimizations
    };
  }

  /**
   * Creates optimized schema validation function
   * @param {Object} validator - AJV validator instance
   * @returns {Function} Optimized validation function
   */
  createOptimizedValidator(validator) {
    const validationCache = new Map();
    const cacheSize = 100; // Maximum cache entries
    
    return (data, schemaId) => {
      // Generate cache key based on data structure and schema
      const cacheKey = this.#generateValidationCacheKey(data, schemaId);
      
      // Check cache first
      if (validationCache.has(cacheKey)) {
        const cached = validationCache.get(cacheKey);
        this.#recordCacheHit('validation', schemaId);
        return cached;
      }

      // Perform validation
      const startTime = performance.now();
      const result = validator.validate(data, schemaId);
      const duration = performance.now() - startTime;

      // Cache result if validation was successful and not too large
      const dataSize = JSON.stringify(data).length;
      if (result.valid && dataSize < 10000) { // Cache only small, valid data
        if (validationCache.size >= cacheSize) {
          // Remove oldest entry
          const firstKey = validationCache.keys().next().value;
          validationCache.delete(firstKey);
        }
        validationCache.set(cacheKey, result);
        this.#recordCacheStore('validation', schemaId, duration);
      }

      return result;
    };
  }

  /**
   * Creates optimized target extraction function
   * @param {Object} targetExtractor - Target extraction service
   * @returns {Function} Optimized extraction function
   */
  createOptimizedTargetExtractor(targetExtractor) {
    const extractionCache = new Map();
    const cacheSize = 50;

    return (actionText, actionId, context) => {
      // Generate cache key for target extraction
      const cacheKey = this.#generateExtractionCacheKey(actionText, actionId, context);
      
      if (extractionCache.has(cacheKey)) {
        const cached = extractionCache.get(cacheKey);
        this.#recordCacheHit('target_extraction', actionId);
        return cached;
      }

      // Perform extraction
      const startTime = performance.now();
      const result = targetExtractor.extractTargets(actionText, actionId, context);
      const duration = performance.now() - startTime;

      // Cache successful extractions
      if (result && Object.keys(result).length > 0) {
        if (extractionCache.size >= cacheSize) {
          const firstKey = extractionCache.keys().next().value;
          extractionCache.delete(firstKey);
        }
        extractionCache.set(cacheKey, result);
        this.#recordCacheStore('target_extraction', actionId, duration);
      }

      return result;
    };
  }

  /**
   * Optimizes rule evaluation with intelligent caching
   * @param {Array} rules - Rules to evaluate
   * @param {Object} event - Event data
   * @param {Object} gameState - Current game state
   * @returns {Array} Matching rules with optimization metadata
   */
  optimizeRuleEvaluation(rules, event, gameState) {
    const optimizedResults = [];
    const evaluationCache = this.#cacheManager.getCache('rule_evaluation');
    
    for (const rule of rules) {
      // Check if rule can be short-circuited
      const shortCircuit = this.#checkRuleShortCircuit(rule, event);
      if (shortCircuit.canSkip) {
        optimizedResults.push({
          rule,
          matches: false,
          optimized: true,
          optimization: 'short_circuit',
          reason: shortCircuit.reason
        });
        continue;
      }

      // Check cache for recent evaluation
      const cacheKey = this.#generateRuleCacheKey(rule, event, gameState);
      const cached = evaluationCache.get(cacheKey);
      
      if (cached && this.#isCacheValid(cached)) {
        optimizedResults.push({
          ...cached.result,
          optimized: true,
          optimization: 'cache_hit'
        });
        this.#recordCacheHit('rule_evaluation', rule.id);
        continue;
      }

      // Perform full evaluation
      const startTime = performance.now();
      const matches = this.#evaluateRule(rule, event, gameState);
      const duration = performance.now() - startTime;
      
      const result = {
        rule,
        matches,
        evaluationTime: duration,
        optimized: false
      };

      optimizedResults.push(result);

      // Cache result if it's beneficial
      if (this.#shouldCacheRuleResult(rule, duration)) {
        evaluationCache.set(cacheKey, {
          result,
          timestamp: Date.now(),
          ttl: this.#calculateRuleCacheTTL(rule)
        });
        this.#recordCacheStore('rule_evaluation', rule.id, duration);
      }
    }

    return optimizedResults;
  }

  /**
   * Gets performance optimization statistics
   * @returns {Object} Optimization statistics
   */
  getOptimizationStats() {
    const stats = {
      cacheHits: {},
      cacheStores: {},
      optimizationImpact: {},
      recommendations: []
    };

    // Calculate cache hit rates
    for (const [type, metrics] of this.#metrics) {
      const hits = metrics.hits || 0;
      const stores = metrics.stores || 0;
      const total = hits + stores;
      
      stats.cacheHits[type] = {
        hits,
        stores,
        total,
        hitRate: total > 0 ? hits / total : 0
      };
    }

    // Generate optimization recommendations
    stats.recommendations = this.#generateOptimizationRecommendations(stats);

    return stats;
  }

  /**
   * Schema validation optimization strategy
   * @param {Object} event - Event to optimize
   * @param {Object} context - Processing context
   * @returns {Object} Optimization result
   */
  async #optimizeSchemaValidation(event, context) {
    // Skip validation for events that have been recently validated with same structure
    const structureHash = this.#generateStructureHash(event);
    const recentValidation = this.#cacheManager.get(`validation_${structureHash}`);
    
    if (recentValidation && Date.now() - recentValidation.timestamp < 30000) {
      return {
        optimized: true,
        improvement: { type: 'validation_skip', timeSaved: recentValidation.avgTime },
        details: 'Skipped validation for recently validated structure'
      };
    }

    return { optimized: false };
  }

  /**
   * Target extraction optimization strategy
   * @param {Object} event - Event to optimize
   * @param {Object} context - Processing context
   * @returns {Object} Optimization result
   */
  async #optimizeTargetExtraction(event, context) {
    // Pre-extract common target patterns
    if (event.targets && Object.keys(event.targets).length > 0) {
      return {
        optimized: true,
        improvement: { type: 'extraction_skip', reason: 'targets_already_present' },
        details: 'Targets already extracted, skipping re-extraction'
      };
    }

    return { optimized: false };
  }

  /**
   * Rule evaluation optimization strategy
   * @param {Object} event - Event to optimize
   * @param {Object} context - Processing context
   * @returns {Object} Optimization result
   */
  async #optimizeRuleEvaluation(event, context) {
    // Optimize rule ordering based on match probability
    if (context.rules && context.rules.length > 1) {
      const optimizedOrder = this.#optimizeRuleOrder(context.rules, event);
      if (optimizedOrder.reordered) {
        return {
          optimized: true,
          improvement: { 
            type: 'rule_reorder', 
            originalOrder: context.rules.map(r => r.id),
            optimizedOrder: optimizedOrder.rules.map(r => r.id)
          },
          context: { ...context, rules: optimizedOrder.rules },
          details: 'Reordered rules for optimal evaluation sequence'
        };
      }
    }

    return { optimized: false };
  }

  /**
   * Event processing optimization strategy
   * @param {Object} event - Event to optimize
   * @param {Object} context - Processing context
   * @returns {Object} Optimization result
   */
  async #optimizeEventProcessing(event, context) {
    let optimizations = [];

    // Optimize event payload size
    const compressedEvent = this.#compressEventPayload(event);
    if (compressedEvent.compressed) {
      optimizations.push({
        type: 'payload_compression',
        originalSize: JSON.stringify(event).length,
        compressedSize: JSON.stringify(compressedEvent.event).length,
        compressionRatio: compressedEvent.compressionRatio
      });
      event = compressedEvent.event;
    }

    return optimizations.length > 0 ? {
      optimized: true,
      improvement: { type: 'event_optimization', optimizations },
      event,
      details: `Applied ${optimizations.length} event optimizations`
    } : { optimized: false };
  }

  /**
   * Generates cache key for validation
   * @param {Object} data - Data to validate
   * @param {string} schemaId - Schema identifier
   * @returns {string} Cache key
   */
  #generateValidationCacheKey(data, schemaId) {
    const dataHash = this.#generateStructureHash(data);
    return `validation_${schemaId}_${dataHash}`;
  }

  /**
   * Generates cache key for target extraction
   * @param {string} actionText - Action text
   * @param {string} actionId - Action identifier
   * @param {Object} context - Extraction context
   * @returns {string} Cache key
   */
  #generateExtractionCacheKey(actionText, actionId, context) {
    const contextHash = this.#generateStructureHash(context);
    return `extraction_${actionId}_${this.#hashString(actionText)}_${contextHash}`;
  }

  /**
   * Generates cache key for rule evaluation
   * @param {Object} rule - Rule being evaluated
   * @param {Object} event - Event data
   * @param {Object} gameState - Game state
   * @returns {string} Cache key
   */
  #generateRuleCacheKey(rule, event, gameState) {
    const eventHash = this.#generateStructureHash(event);
    const stateHash = this.#generateStructureHash(gameState);
    return `rule_${rule.id}_${eventHash}_${stateHash}`;
  }

  /**
   * Generates hash for object structure
   * @param {Object} obj - Object to hash
   * @returns {string} Structure hash
   */
  #generateStructureHash(obj) {
    const structure = this.#getObjectStructure(obj);
    return this.#hashString(JSON.stringify(structure));
  }

  /**
   * Gets object structure without values
   * @param {Object} obj - Object to analyze
   * @returns {Object} Object structure
   */
  #getObjectStructure(obj) {
    if (typeof obj !== 'object' || obj === null) {
      return typeof obj;
    }

    if (Array.isArray(obj)) {
      return ['array', obj.length > 0 ? this.#getObjectStructure(obj[0]) : null];
    }

    const structure = {};
    for (const key in obj) {
      structure[key] = this.#getObjectStructure(obj[key]);
    }
    return structure;
  }

  /**
   * Simple string hashing function
   * @param {string} str - String to hash
   * @returns {string} Hash value
   */
  #hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Records cache hit metrics
   * @param {string} type - Cache type
   * @param {string} key - Cache key
   */
  #recordCacheHit(type, key) {
    if (!this.#metrics.has(type)) {
      this.#metrics.set(type, { hits: 0, stores: 0, keys: new Set() });
    }
    
    const metrics = this.#metrics.get(type);
    metrics.hits++;
    metrics.keys.add(key);
  }

  /**
   * Records cache store metrics
   * @param {string} type - Cache type
   * @param {string} key - Cache key
   * @param {number} duration - Operation duration
   */
  #recordCacheStore(type, key, duration) {
    if (!this.#metrics.has(type)) {
      this.#metrics.set(type, { hits: 0, stores: 0, keys: new Set(), totalDuration: 0 });
    }
    
    const metrics = this.#metrics.get(type);
    metrics.stores++;
    metrics.keys.add(key);
    metrics.totalDuration = (metrics.totalDuration || 0) + duration;
  }

  /**
   * Records optimization metrics
   * @param {Object} event - Original event
   * @param {Array} optimizations - Applied optimizations
   */
  #recordOptimizationMetrics(event, optimizations) {
    const eventType = event.eventName || 'unknown';
    
    if (!this.#metrics.has(`optimization_${eventType}`)) {
      this.#metrics.set(`optimization_${eventType}`, {
        totalEvents: 0,
        optimizedEvents: 0,
        optimizations: {}
      });
    }

    const metrics = this.#metrics.get(`optimization_${eventType}`);
    metrics.totalEvents++;
    
    if (optimizations.length > 0) {
      metrics.optimizedEvents++;
      
      optimizations.forEach(opt => {
        if (!metrics.optimizations[opt.strategy]) {
          metrics.optimizations[opt.strategy] = 0;
        }
        metrics.optimizations[opt.strategy]++;
      });
    }
  }

  /**
   * Additional helper methods for optimization strategies...
   */
  
  #checkRuleShortCircuit(rule, event) {
    // Implementation for rule short-circuiting logic
    return { canSkip: false };
  }

  #evaluateRule(rule, event, gameState) {
    // Implementation for rule evaluation
    return false;
  }

  #isCacheValid(cached) {
    return Date.now() - cached.timestamp < cached.ttl;
  }

  #shouldCacheRuleResult(rule, duration) {
    return duration > 5; // Cache rules that take more than 5ms to evaluate
  }

  #calculateRuleCacheTTL(rule) {
    return 60000; // 1 minute default TTL
  }

  #optimizeRuleOrder(rules, event) {
    // Implementation for rule ordering optimization
    return { reordered: false, rules };
  }

  #compressEventPayload(event) {
    // Implementation for event payload compression
    return { compressed: false, event };
  }

  #generateOptimizationRecommendations(stats) {
    const recommendations = [];
    
    // Analyze cache hit rates and recommend improvements
    Object.entries(stats.cacheHits).forEach(([type, data]) => {
      if (data.hitRate < 0.3 && data.total > 10) {
        recommendations.push({
          type: 'low_cache_hit_rate',
          category: type,
          hitRate: data.hitRate,
          recommendation: `Consider tuning cache strategy for ${type} - current hit rate is ${(data.hitRate * 100).toFixed(1)}%`
        });
      }
    });

    return recommendations;
  }
}

export default PerformanceOptimizer;
```

### 3. Real-time Performance Monitor

**File**: `src/performance/performanceMonitor.js`

Create real-time monitoring system:

```javascript
/**
 * @file Real-time performance monitoring system
 */

import { ensureValidLogger } from '../utils/loggerUtils.js';

/**
 * Real-time performance monitoring for multi-target system
 */
export class PerformanceMonitor {
  #logger;
  #profiler;
  #metrics;
  #alerts;
  #thresholds;
  #monitoring;
  #subscribers;

  constructor({ logger, profiler, alertThresholds = {} }) {
    this.#logger = ensureValidLogger(logger);
    this.#profiler = profiler;
    this.#metrics = new Map();
    this.#alerts = [];
    this.#subscribers = [];
    this.#monitoring = false;
    
    this.#thresholds = {
      // Performance thresholds
      maxEventProcessingTime: 100, // ms
      maxMemoryIncrease: 50, // MB
      maxConcurrentOperations: 10,
      
      // Error rate thresholds
      maxErrorRate: 0.05, // 5%
      maxValidationFailureRate: 0.1, // 10%
      
      // Throughput thresholds
      minEventsPerSecond: 1,
      maxAverageResponseTime: 200, // ms
      
      ...alertThresholds
    };
  }

  /**
   * Starts performance monitoring
   */
  startMonitoring() {
    if (this.#monitoring) {
      this.#logger.warn('Performance monitoring already started');
      return;
    }

    this.#monitoring = true;
    
    // Start monitoring intervals
    this.#startMetricsCollection();
    this.#startAlertCheck();
    
    this.#logger.info('Performance monitoring started', {
      thresholds: this.#thresholds
    });
  }

  /**
   * Stops performance monitoring
   */
  stopMonitoring() {
    this.#monitoring = false;
    this.#logger.info('Performance monitoring stopped');
  }

  /**
   * Subscribes to performance alerts
   * @param {Function} callback - Alert callback function
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    this.#subscribers.push(callback);
    
    return () => {
      const index = this.#subscribers.indexOf(callback);
      if (index > -1) {
        this.#subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Gets current performance metrics
   * @returns {Object} Current metrics
   */
  getCurrentMetrics() {
    const now = Date.now();
    const timeWindow = 60000; // 1 minute
    const recentStats = this.#profiler.getPerformanceStats(null, timeWindow);
    
    return {
      timestamp: new Date().toISOString(),
      systemMetrics: {
        memoryUsage: this.#getCurrentMemoryUsage(),
        activeOperations: this.#getActiveOperationCount(),
        eventsPerSecond: this.#calculateEventsPerSecond(timeWindow),
        averageResponseTime: recentStats.averageDuration || 0
      },
      performanceStats: recentStats,
      alertStatus: this.#getAlertStatus(),
      thresholdCompliance: this.#checkThresholdCompliance(recentStats)
    };
  }

  /**
   * Records a performance event
   * @param {string} eventType - Type of event
   * @param {Object} eventData - Event data
   */
  recordEvent(eventType, eventData) {
    const timestamp = Date.now();
    const metricKey = `${eventType}_${Math.floor(timestamp / 1000)}`; // Group by second
    
    if (!this.#metrics.has(metricKey)) {
      this.#metrics.set(metricKey, {
        eventType,
        timestamp,
        count: 0,
        totalDuration: 0,
        errors: 0,
        successes: 0
      });
    }
    
    const metric = this.#metrics.get(metricKey);
    metric.count++;
    
    if (eventData.duration) {
      metric.totalDuration += eventData.duration;
    }
    
    if (eventData.error) {
      metric.errors++;
    } else {
      metric.successes++;
    }
  }

  /**
   * Creates performance dashboard data
   * @returns {Object} Dashboard data
   */
  getDashboardData() {
    const metrics = this.getCurrentMetrics();
    const alerts = this.#getRecentAlerts(3600000); // Last hour
    const trends = this.#calculateTrends();
    
    return {
      summary: {
        status: this.#getOverallStatus(metrics),
        activeAlerts: alerts.filter(a => a.active).length,
        performanceScore: this.#calculatePerformanceScore(metrics),
        uptime: this.#calculateUptime()
      },
      metrics,
      alerts: alerts.slice(0, 10), // Most recent 10 alerts
      trends,
      recommendations: this.#generateRecommendations(metrics, trends)
    };
  }

  /**
   * Starts metrics collection interval
   */
  #startMetricsCollection() {
    setInterval(() => {
      if (!this.#monitoring) return;
      
      try {
        const metrics = this.getCurrentMetrics();
        this.#cleanupOldMetrics();
        
        // Log metrics for debugging
        this.#logger.debug('Performance metrics collected', {
          eventsPerSecond: metrics.systemMetrics.eventsPerSecond,
          averageResponseTime: metrics.systemMetrics.averageResponseTime,
          memoryUsage: metrics.systemMetrics.memoryUsage
        });
      } catch (error) {
        this.#logger.error('Error collecting performance metrics', error);
      }
    }, 5000); // Collect every 5 seconds
  }

  /**
   * Starts alert checking interval
   */
  #startAlertCheck() {
    setInterval(() => {
      if (!this.#monitoring) return;
      
      try {
        this.#checkForAlerts();
      } catch (error) {
        this.#logger.error('Error checking for performance alerts', error);
      }
    }, 10000); // Check every 10 seconds
  }

  /**
   * Checks for performance alerts
   */
  #checkForAlerts() {
    const metrics = this.getCurrentMetrics();
    const violations = [];
    
    // Check response time
    if (metrics.systemMetrics.averageResponseTime > this.#thresholds.maxAverageResponseTime) {
      violations.push({
        type: 'high_response_time',
        severity: 'warning',
        value: metrics.systemMetrics.averageResponseTime,
        threshold: this.#thresholds.maxAverageResponseTime,
        message: `Average response time (${metrics.systemMetrics.averageResponseTime.toFixed(2)}ms) exceeds threshold`
      });
    }
    
    // Check memory usage
    if (metrics.systemMetrics.memoryUsage > this.#thresholds.maxMemoryIncrease) {
      violations.push({
        type: 'high_memory_usage',
        severity: 'critical',
        value: metrics.systemMetrics.memoryUsage,
        threshold: this.#thresholds.maxMemoryIncrease,
        message: `Memory usage (${metrics.systemMetrics.memoryUsage.toFixed(2)}MB) exceeds threshold`
      });
    }
    
    // Check error rates
    const errorRate = this.#calculateErrorRate();
    if (errorRate > this.#thresholds.maxErrorRate) {
      violations.push({
        type: 'high_error_rate',
        severity: 'critical',
        value: errorRate,
        threshold: this.#thresholds.maxErrorRate,
        message: `Error rate (${(errorRate * 100).toFixed(2)}%) exceeds threshold`
      });
    }
    
    // Check throughput
    if (metrics.systemMetrics.eventsPerSecond < this.#thresholds.minEventsPerSecond) {
      violations.push({
        type: 'low_throughput',
        severity: 'warning',
        value: metrics.systemMetrics.eventsPerSecond,
        threshold: this.#thresholds.minEventsPerSecond,
        message: `Throughput (${metrics.systemMetrics.eventsPerSecond.toFixed(2)} events/sec) below threshold`
      });
    }
    
    // Create alerts for violations
    violations.forEach(violation => {
      this.#createAlert(violation);
    });
  }

  /**
   * Creates a performance alert
   * @param {Object} violation - Performance violation
   */
  #createAlert(violation) {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      type: violation.type,
      severity: violation.severity,
      message: violation.message,
      value: violation.value,
      threshold: violation.threshold,
      active: true
    };
    
    this.#alerts.push(alert);
    
    // Notify subscribers
    this.#subscribers.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        this.#logger.error('Error notifying alert subscriber', error);
      }
    });
    
    // Log alert
    this.#logger.warn('Performance alert created', alert);
  }

  /**
   * Helper methods for metrics calculation
   */
  
  #getCurrentMemoryUsage() {
    if (typeof performance !== 'undefined' && performance.memory) {
      return performance.memory.usedJSHeapSize / 1024 / 1024;
    }
    return 0;
  }

  #getActiveOperationCount() {
    // Implementation would track active operations
    return 0;
  }

  #calculateEventsPerSecond(timeWindow) {
    const now = Date.now();
    const cutoff = now - timeWindow;
    
    let eventCount = 0;
    for (const [key, metric] of this.#metrics) {
      if (metric.timestamp > cutoff) {
        eventCount += metric.count;
      }
    }
    
    return eventCount / (timeWindow / 1000);
  }

  #calculateErrorRate() {
    const now = Date.now();
    const timeWindow = 300000; // 5 minutes
    const cutoff = now - timeWindow;
    
    let totalEvents = 0;
    let totalErrors = 0;
    
    for (const [key, metric] of this.#metrics) {
      if (metric.timestamp > cutoff) {
        totalEvents += metric.count;
        totalErrors += metric.errors;
      }
    }
    
    return totalEvents > 0 ? totalErrors / totalEvents : 0;
  }

  #getAlertStatus() {
    const activeAlerts = this.#alerts.filter(alert => alert.active);
    const criticalAlerts = activeAlerts.filter(alert => alert.severity === 'critical');
    
    return {
      total: activeAlerts.length,
      critical: criticalAlerts.length,
      warning: activeAlerts.filter(alert => alert.severity === 'warning').length
    };
  }

  #checkThresholdCompliance(stats) {
    const compliance = {};
    
    Object.entries(this.#thresholds).forEach(([key, threshold]) => {
      // Implementation would check each threshold
      compliance[key] = { compliant: true, value: 0, threshold };
    });
    
    return compliance;
  }

  #getRecentAlerts(timeWindow) {
    const cutoff = Date.now() - timeWindow;
    return this.#alerts
      .filter(alert => new Date(alert.timestamp).getTime() > cutoff)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  #calculateTrends() {
    // Implementation would calculate performance trends
    return {
      responseTime: { trend: 'stable', change: 0 },
      throughput: { trend: 'stable', change: 0 },
      errorRate: { trend: 'stable', change: 0 }
    };
  }

  #getOverallStatus(metrics) {
    const alerts = this.#getAlertStatus();
    if (alerts.critical > 0) return 'critical';
    if (alerts.warning > 0) return 'warning';
    return 'healthy';
  }

  #calculatePerformanceScore(metrics) {
    // Implementation would calculate a performance score (0-100)
    return 85;
  }

  #calculateUptime() {
    // Implementation would track system uptime
    return Date.now() - (this.startTime || Date.now());
  }

  #generateRecommendations(metrics, trends) {
    const recommendations = [];
    
    // Analyze metrics and generate actionable recommendations
    if (metrics.systemMetrics.averageResponseTime > 50) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        message: 'Consider optimizing event processing pipeline',
        action: 'Enable caching for frequently accessed operations'
      });
    }
    
    return recommendations;
  }

  #cleanupOldMetrics() {
    const cutoff = Date.now() - 3600000; // Keep 1 hour of metrics
    for (const [key, metric] of this.#metrics) {
      if (metric.timestamp < cutoff) {
        this.#metrics.delete(key);
      }
    }
  }
}

export default PerformanceMonitor;
```

## Testing Requirements

### 1. Performance Testing

- **Load testing**: System performance under various load conditions
- **Stress testing**: Performance degradation patterns under extreme load
- **Benchmarking**: Performance comparison before and after optimizations
- **Memory testing**: Memory leak detection and usage patterns

### 2. Optimization Testing

- **Cache efficiency**: Cache hit rates and performance improvements
- **Optimization impact**: Measurable improvements from optimization strategies
- **Regression testing**: Ensure optimizations don't break functionality

### 3. Monitoring Testing

- **Alert accuracy**: Alerts trigger correctly for threshold violations
- **Metrics accuracy**: Collected metrics accurately represent system state
- **Dashboard functionality**: Performance dashboard displays correct data

## Success Criteria

1. **Performance Benchmarks**: System meets all performance thresholds
2. **Optimization Effectiveness**: Demonstrable performance improvements
3. **Monitoring Coverage**: Complete monitoring of all system components
4. **Alert Reliability**: Accurate and timely performance alerts
5. **Documentation**: Performance characteristics and optimization strategies documented

## Files Created

- `src/performance/multiTargetProfiler.js`
- `src/performance/performanceOptimizer.js`
- `src/performance/performanceMonitor.js`

## Files Modified

None (new performance infrastructure)

## Validation Steps

1. Deploy performance monitoring system
2. Run comprehensive performance benchmarks
3. Test optimization strategies under load
4. Validate alert accuracy and timing
5. Verify monitoring dashboard functionality

## Notes

- Performance monitoring runs continuously with minimal impact
- Optimization strategies are applied automatically based on usage patterns
- All performance data is logged for analysis and trend identification
- System maintains detailed performance history for capacity planning

## Risk Assessment

**Low Risk**: Performance monitoring and optimization is additive functionality that doesn't modify core system behavior. Comprehensive testing ensures optimizations don't introduce regressions.

## Next Steps

After this ticket completion:
1. Move to Ticket 18: Final System Deployment and Validation
2. Complete end-to-end system validation and documentation
3. Finalize multi-target action event system implementation