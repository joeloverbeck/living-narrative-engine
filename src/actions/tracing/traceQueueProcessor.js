/**
 * @file Advanced queue processor for trace output with priority handling and batch processing
 * @see actionTraceOutputService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ensureValidLogger } from '../../utils/loggerUtils.js';
import {
  TracePriority,
  normalizePriority,
  inferPriority,
  getPriorityLevels,
} from './tracePriority.js';
import { QUEUE_CONSTANTS, QUEUE_EVENTS } from './actionTraceTypes.js';
import { defaultTimerService } from './timerService.js';
import { TraceIdGenerator } from './traceIdGenerator.js';

/**
 * Advanced queue processor for trace output
 * Provides priority-based queuing, batch processing, and resource management
 */
export class TraceQueueProcessor {
  #storageAdapter;
  #logger;
  #eventBus;
  #config;
  #timerService;
  #idGenerator;

  // Priority queue system
  #priorityQueues;

  // Processing state
  #isProcessing;
  #processingBatch;
  #batchTimer;
  #processedTraceIds;

  // Resource management
  #currentMemoryUsage;
  #maxMemoryLimit;
  #errorCount;
  #consecutiveFailures;
  #circuitBreakerOpen;
  #shuttingDown;

  // Metrics tracking
  #metrics;
  #startTime;

  /**
   * Constructor
   *
   * @param {object} dependencies - Dependency injection object
   * @param {object} dependencies.storageAdapter - Storage interface for IndexedDB
   * @param {object} dependencies.logger - Logger interface
   * @param {object} [dependencies.eventBus] - Event bus for notifications
   * @param {object} [dependencies.config] - Configuration options
   * @param {object} [dependencies.timerService] - Timer service for scheduling (defaults to real timers)
   * @param {object} [dependencies.namingOptions] - Options for trace ID generation
   */
  constructor({
    storageAdapter,
    logger,
    eventBus,
    config = {},
    timerService,
    namingOptions,
  }) {
    // Validate required dependencies
    validateDependency(storageAdapter, 'IStorageAdapter', null, {
      requiredMethods: ['getItem', 'setItem', 'removeItem', 'getAllKeys'],
    });

    this.#storageAdapter = storageAdapter;
    this.#logger = ensureValidLogger(logger, 'TraceQueueProcessor');
    this.#eventBus = eventBus;
    this.#timerService = timerService || defaultTimerService;

    // Initialize ID generator with naming options
    this.#idGenerator = new TraceIdGenerator(namingOptions || {});

    // Initialize configuration
    this.#config = {
      maxQueueSize:
        config.maxQueueSize || QUEUE_CONSTANTS.DEFAULT_MAX_QUEUE_SIZE,
      batchSize: Math.min(
        config.batchSize || QUEUE_CONSTANTS.DEFAULT_BATCH_SIZE,
        QUEUE_CONSTANTS.MAX_BATCH_SIZE
      ),
      batchTimeout:
        config.batchTimeout || QUEUE_CONSTANTS.DEFAULT_BATCH_TIMEOUT,
      maxRetries: config.maxRetries || QUEUE_CONSTANTS.DEFAULT_MAX_RETRIES,
      memoryLimit: config.memoryLimit || QUEUE_CONSTANTS.DEFAULT_MEMORY_LIMIT,
      enableParallelProcessing: config.enableParallelProcessing !== false,
      storageKey: config.storageKey || 'actionTraces',
      maxStoredTraces: config.maxStoredTraces || 100,
    };

    // Initialize priority queue system
    this.#initializePriorityQueues();

    // Initialize processing state
    this.#isProcessing = false;
    this.#processingBatch = new Set();
    this.#batchTimer = null;
    this.#processedTraceIds = new Set();

    // Initialize resource management
    this.#currentMemoryUsage = 0;
    this.#maxMemoryLimit = this.#config.memoryLimit;
    this.#errorCount = 0;
    this.#consecutiveFailures = 0;
    this.#circuitBreakerOpen = false;
    this.#shuttingDown = false;

    // Initialize metrics tracking
    this.#initializeMetrics();

    this.#logger.debug('TraceQueueProcessor initialized', {
      maxQueueSize: this.#config.maxQueueSize,
      batchSize: this.#config.batchSize,
      batchTimeout: this.#config.batchTimeout,
      memoryLimit: this.#config.memoryLimit,
    });
  }

  /**
   * Initialize priority queue system
   *
   * @private
   */
  #initializePriorityQueues() {
    this.#priorityQueues = new Map();

    for (const priority of getPriorityLevels()) {
      this.#priorityQueues.set(priority, []);
    }
  }

  /**
   * Initialize metrics tracking
   *
   * @private
   */
  #initializeMetrics() {
    this.#startTime = Date.now();
    this.#metrics = {
      totalEnqueued: 0,
      totalProcessed: 0,
      totalErrors: 0,
      totalDropped: 0,
      totalBatches: 0,
      fullBatches: 0,
      totalLatency: 0,
      minLatency: Infinity,
      maxLatency: 0,
      avgLatency: 0,
      throughput: 0,
      batchEfficiency: 0,
      dropRate: 0,
      memoryUsage: 0,
      queueSize: 0,
      priorityDistribution: {
        [TracePriority.CRITICAL]: 0,
        [TracePriority.HIGH]: 0,
        [TracePriority.NORMAL]: 0,
        [TracePriority.LOW]: 0,
      },
    };
  }

  /**
   * Enqueue trace for processing with priority
   *
   * @param {object} trace - Trace object to enqueue
   * @param {number} [priority] - Priority level (auto-inferred if not provided)
   * @returns {boolean} True if enqueued successfully, false if dropped
   */
  enqueue(trace, priority) {
    if (!trace) {
      this.#logger.warn('TraceQueueProcessor: Null trace provided');
      return false;
    }

    // Circuit breaker check
    if (this.#circuitBreakerOpen || this.#shuttingDown) {
      this.#logger.warn(
        'TraceQueueProcessor: Circuit breaker open or shutting down, dropping trace'
      );
      this.#metrics.totalDropped++;
      return false;
    }

    // Determine priority
    let normalizedPriority;
    if (priority !== undefined) {
      normalizedPriority = normalizePriority(priority);
    } else {
      normalizedPriority = inferPriority(trace);
    }

    // Check memory limits before enqueueing
    const traceSize = this.#estimateTraceSize(trace);
    if (!this.#checkMemoryLimit(traceSize)) {
      // First attempt: handle backpressure to free memory
      this.#handleBackpressure();

      // Second check: if still over limit, drop the trace
      if (!this.#checkMemoryLimit(traceSize)) {
        this.#logger.warn(
          'TraceQueueProcessor: Memory limit still exceeded after backpressure, dropping trace',
          {
            requestedSize: traceSize,
            currentUsage: this.#currentMemoryUsage,
            limit: this.#maxMemoryLimit,
          }
        );
        this.#metrics.totalDropped++;
        return false;
      }
    }

    // Check total queue size
    const totalQueueSize = this.#getTotalQueueSize();
    if (totalQueueSize >= this.#config.maxQueueSize) {
      this.#handleBackpressure();
      // Check again after backpressure handling
      if (this.#getTotalQueueSize() >= this.#config.maxQueueSize) {
        this.#logger.warn('TraceQueueProcessor: Queue full, dropping trace');
        this.#metrics.totalDropped++;
        return false;
      }
    }

    // Create queue item
    const queueItem = {
      id: this.#generateItemId(trace),
      trace,
      priority: normalizedPriority,
      timestamp: Date.now(),
      retryCount: 0,
      size: traceSize,
    };

    // Add to appropriate priority queue
    const priorityQueue = this.#priorityQueues.get(normalizedPriority);
    priorityQueue.push(queueItem);

    // Update metrics
    this.#metrics.totalEnqueued++;
    this.#metrics.priorityDistribution[normalizedPriority]++;
    this.#currentMemoryUsage += traceSize;

    this.#updateDerivedMetrics();

    // Start processing if not already running
    if (!this.#isProcessing) {
      this.#scheduleBatchProcessing();
    }

    this.#logger.debug('TraceQueueProcessor: Enqueued trace', {
      traceId: queueItem.id,
      priority: normalizedPriority,
      queueSize: totalQueueSize + 1,
      memoryUsage: this.#currentMemoryUsage,
    });

    return true;
  }

  /**
   * Estimate memory size of trace object
   *
   * @private
   * @param {object} trace - Trace object
   * @returns {number} Estimated size in bytes
   */
  #estimateTraceSize(trace) {
    try {
      // Use JSON serialization for size estimation
      const jsonStr = JSON.stringify(trace);
      return new Blob([jsonStr]).size;
    } catch (error) {
      this.#logger.warn(
        'TraceQueueProcessor: Failed to estimate trace size',
        error
      );
      // Return conservative estimate
      return 1024; // 1KB default
    }
  }

  /**
   * Check if memory limit would be exceeded
   *
   * @private
   * @param {number} additionalSize - Size to add
   * @returns {boolean} True if within limits
   */
  #checkMemoryLimit(additionalSize) {
    const projectedUsage = this.#currentMemoryUsage + additionalSize;

    // Check configured limit
    if (projectedUsage > this.#maxMemoryLimit) {
      return false;
    }

    // Check browser memory if available
    if (typeof performance !== 'undefined' && performance.memory) {
      const heapUsed = performance.memory.usedJSHeapSize;
      const heapLimit = performance.memory.jsHeapSizeLimit;
      const threshold = heapLimit * QUEUE_CONSTANTS.MEMORY_THRESHOLD;

      if (heapUsed + additionalSize > threshold) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get total size across all queues
   *
   * @private
   * @returns {number} Total queue size
   */
  #getTotalQueueSize() {
    let total = 0;
    for (const queue of this.#priorityQueues.values()) {
      total += queue.length;
    }
    return total;
  }

  /**
   * Generate unique ID for queue item
   *
   * @private
   * @param {object} trace - Trace object
   * @returns {string} Unique item ID
   */
  #generateItemId(trace) {
    // Use the shared ID generator for consistent naming
    return this.#idGenerator.generateId(trace);
  }

  /**
   * Schedule batch processing
   *
   * @private
   */
  #scheduleBatchProcessing() {
    if (this.#batchTimer) {
      return; // Already scheduled
    }

    // Process immediately if we have enough items or critical priority items
    const criticalQueue = this.#priorityQueues.get(TracePriority.CRITICAL);
    const totalSize = this.#getTotalQueueSize();

    if (criticalQueue.length > 0 || totalSize >= this.#config.batchSize) {
      // Process immediately - use setImmediate-like behavior for Jest compatibility
      this.#batchTimer = this.#timerService.setTimeout(() => {
        this.#batchTimer = null;
        // Call #processBatch directly - it's already async
        this.#processBatch().catch((error) => {
          this.#logger.error(
            'TraceQueueProcessor: Batch processing error',
            error
          );
        });
      }, 0);
    } else {
      // Schedule with timeout
      this.#batchTimer = this.#timerService.setTimeout(() => {
        this.#batchTimer = null;
        // Call #processBatch directly - it's already async
        this.#processBatch().catch((error) => {
          this.#logger.error(
            'TraceQueueProcessor: Batch processing error',
            error
          );
        });
      }, this.#config.batchTimeout);
    }
  }

  /**
   * Track failure and check circuit breaker threshold
   *
   * @private
   */
  #trackFailure() {
    this.#consecutiveFailures++;
    this.#errorCount++;

    if (
      this.#consecutiveFailures >= QUEUE_CONSTANTS.CIRCUIT_BREAKER_THRESHOLD
    ) {
      this.#circuitBreakerOpen = true;
      this.#logger.error(
        'TraceQueueProcessor: Circuit breaker opened due to consecutive failures'
      );

      if (this.#eventBus) {
        this.#eventBus.dispatch(QUEUE_EVENTS.CIRCUIT_BREAKER, {
          errorCount: this.#errorCount,
          consecutiveFailures: this.#consecutiveFailures,
          reason: 'consecutive_failures',
        });
      }
    }
  }

  /**
   * Reset failure tracking on successful operation
   *
   * @private
   */
  #resetFailureTracking() {
    this.#consecutiveFailures = 0;
    if (this.#circuitBreakerOpen) {
      this.#circuitBreakerOpen = false;
      this.#logger.info('TraceQueueProcessor: Circuit breaker closed');
    }
  }

  /**
   * Update derived metrics
   *
   * @private
   */
  #updateDerivedMetrics() {
    const elapsed = (Date.now() - this.#startTime) / 1000; // seconds

    // Calculate throughput
    if (elapsed > 0) {
      this.#metrics.throughput = this.#metrics.totalProcessed / elapsed;
    }

    // Calculate batch efficiency
    if (this.#metrics.totalBatches > 0) {
      this.#metrics.batchEfficiency =
        this.#metrics.fullBatches / this.#metrics.totalBatches;
    }

    // Calculate drop rate
    if (this.#metrics.totalEnqueued > 0) {
      this.#metrics.dropRate =
        this.#metrics.totalDropped / this.#metrics.totalEnqueued;
    }

    // Calculate average latency
    if (this.#metrics.totalProcessed > 0) {
      this.#metrics.avgLatency =
        this.#metrics.totalLatency / this.#metrics.totalProcessed;
    }

    // Update current state
    this.#metrics.memoryUsage = this.#currentMemoryUsage;
    this.#metrics.queueSize = this.#getTotalQueueSize();
  }

  /**
   * Handle backpressure situation
   *
   * @private
   */
  #handleBackpressure() {
    this.#logger.warn(
      'TraceQueueProcessor: Backpressure detected, applying mitigation'
    );

    let totalDropped = 0;

    // Priority order for dropping: LOW -> NORMAL -> HIGH (never drop CRITICAL)
    const dropPriorities = [
      TracePriority.LOW,
      TracePriority.NORMAL,
      TracePriority.HIGH,
    ];

    for (const priority of dropPriorities) {
      const queue = this.#priorityQueues.get(priority);
      const dropCount = Math.floor(queue.length / 2);

      for (let i = 0; i < dropCount && i < queue.length; i++) {
        const item = queue.shift();
        if (item) {
          this.#currentMemoryUsage -= item.size;
          this.#metrics.totalDropped++;
          totalDropped++;
        }
      }

      // Stop dropping if we've freed enough memory (25% of limit)
      if (this.#currentMemoryUsage < this.#maxMemoryLimit * 0.75) {
        break;
      }
    }

    // Notify via event bus
    if (this.#eventBus) {
      this.#eventBus.dispatch(QUEUE_EVENTS.BACKPRESSURE, {
        queueSize: this.#getTotalQueueSize(),
        memoryUsage: this.#currentMemoryUsage,
        droppedCount: totalDropped,
      });
    }

    this.#updateDerivedMetrics();

    this.#logger.debug(
      'TraceQueueProcessor: Backpressure mitigation complete',
      {
        droppedItems: totalDropped,
        newMemoryUsage: this.#currentMemoryUsage,
        newQueueSize: this.#getTotalQueueSize(),
      }
    );
  }

  /**
   * Get processor metrics
   *
   * @returns {object} Current metrics
   */
  getMetrics() {
    this.#updateDerivedMetrics();
    return { ...this.#metrics };
  }

  /**
   * Get current queue statistics
   *
   * @returns {object} Queue statistics
   */
  getQueueStats() {
    const stats = {
      totalSize: this.#getTotalQueueSize(),
      isProcessing: this.#isProcessing,
      memoryUsage: this.#currentMemoryUsage,
      circuitBreakerOpen: this.#circuitBreakerOpen,
      priorities: {},
    };

    // Add per-priority statistics
    for (const [priority, queue] of this.#priorityQueues.entries()) {
      stats.priorities[priority] = {
        size: queue.length,
        oldestTimestamp: queue.length > 0 ? queue[0].timestamp : null,
      };
    }

    return stats;
  }

  /**
   * @description Manually reset the circuit breaker after handling failure scenarios.
   * @returns {boolean} True if the circuit breaker was open before the reset.
   */
  resetCircuitBreaker() {
    const wasOpen = this.#circuitBreakerOpen;
    this.#resetFailureTracking();
    return wasOpen;
  }

  /**
   * @description Process the next available batch immediately for manual control scenarios.
   * @returns {Promise<void>} Resolves when the batch handling finishes.
   */
  async processNextBatch() {
    await this.#processBatch();
  }

  /**
   * Process batch of items from queues
   *
   * @private
   * @returns {Promise<void>}
   */
  async #processBatch() {
    if (this.#isProcessing || this.#circuitBreakerOpen) {
      return;
    }

    // Don't process if shutting down unless forced
    if (this.#shuttingDown && this.#getTotalQueueSize() === 0) {
      return;
    }

    this.#isProcessing = true;
    const batch = this.#collectBatch();

    if (batch.length === 0) {
      this.#isProcessing = false;
      return;
    }

    this.#logger.debug('TraceQueueProcessor: Processing batch', {
      batchSize: batch.length,
      priorities: this.#getBatchPriorities(batch),
    });

    const startTime = Date.now();

    try {
      // Process batch items
      await this.#processBatchItems(batch);

      // Update success metrics
      this.#metrics.totalBatches++;
      if (batch.length >= this.#config.batchSize) {
        this.#metrics.fullBatches++;
      }

      // Reset failure tracking on successful batch
      this.#resetFailureTracking();
    } catch (error) {
      this.#logger.error('TraceQueueProcessor: Batch processing failed', error);

      // Only handle batch failure for sequential processing
      // In parallel mode, items have already handled their own failures
      if (!this.#config.enableParallelProcessing || batch.length === 1) {
        await this.#handleBatchFailure(batch, error);
      } else {
        // For parallel processing, just track the batch failure without re-queuing
        this.#metrics.totalErrors++;
        this.#trackFailure();
      }
    }

    // Update latency metrics
    const batchLatency = Date.now() - startTime;
    this.#updateLatencyMetrics(batchLatency, batch.length);

    this.#isProcessing = false;

    // Schedule next batch if items remain
    if (this.#getTotalQueueSize() > 0) {
      this.#scheduleBatchProcessing();
    }

    // Notify batch completion
    if (this.#eventBus) {
      this.#eventBus.dispatch(QUEUE_EVENTS.BATCH_PROCESSED, {
        batchSize: batch.length,
        processingTime: batchLatency,
        remainingItems: this.#getTotalQueueSize(),
      });
    }
  }

  /**
   * Collect batch items from priority queues
   *
   * @private
   * @returns {Array} Batch items to process
   */
  #collectBatch() {
    const batch = [];
    const maxBatchSize = this.#config.batchSize;

    // Collect items by priority (highest first)
    for (const priority of getPriorityLevels()) {
      const queue = this.#priorityQueues.get(priority);

      while (queue.length > 0 && batch.length < maxBatchSize) {
        const item = queue.shift();
        if (item) {
          batch.push(item);
          this.#currentMemoryUsage -= item.size;
        }
      }

      // Break if batch is full
      if (batch.length >= maxBatchSize) {
        break;
      }
    }

    return batch;
  }

  /**
   * Get priority distribution of batch
   *
   * @private
   * @param {Array} batch - Batch items
   * @returns {object} Priority distribution
   */
  #getBatchPriorities(batch) {
    const distribution = {};
    for (const item of batch) {
      distribution[item.priority] = (distribution[item.priority] || 0) + 1;
    }
    return distribution;
  }

  /**
   * Process batch items with parallel execution
   *
   * @private
   * @param {Array} batch - Batch items to process
   * @returns {Promise<void>}
   */
  async #processBatchItems(batch) {
    if (this.#config.enableParallelProcessing && batch.length > 1) {
      // Process items in parallel with concurrency limit
      const concurrencyLimit = Math.min(batch.length, 5);
      const allResults = [];
      let hasFailures = false;

      for (let i = 0; i < batch.length; i += concurrencyLimit) {
        const chunk = batch.slice(i, i + concurrencyLimit);
        // Use Promise.allSettled to ensure all items are processed even if some fail
        const chunkResults = await Promise.allSettled(
          chunk.map((item) => this.#processItem(item, true)) // Pass flag for parallel mode
        );

        // Track results and check for failures
        chunkResults.forEach((result) => {
          allResults.push(result);
          if (result.status === 'rejected') {
            hasFailures = true;
          }
        });
      }

      // If any items failed, throw error to trigger batch failure handling
      // Note: Individual item failures and retries are already handled by #processItem
      if (hasFailures) {
        const failureCount = allResults.filter(
          (r) => r.status === 'rejected'
        ).length;
        throw new Error(
          `Batch processing failed: ${failureCount}/${allResults.length} items failed`
        );
      }
    } else {
      // Process items sequentially
      for (const item of batch) {
        await this.#processItem(item, false); // Pass flag for sequential mode
      }
    }
  }

  /**
   * Process individual queue item
   *
   * @private
   * @param {object} item - Queue item to process
   * @param isParallel
   * @returns {Promise<void>}
   */
  async #processItem(item, isParallel = false) {
    const itemStartTime = Date.now();

    // Check if this item is already being processed or has been processed
    if (
      this.#processedTraceIds.has(item.id) ||
      this.#processingBatch.has(item.id)
    ) {
      this.#logger.debug(
        'TraceQueueProcessor: Item already processed or processing',
        {
          itemId: item.id,
        }
      );
      return;
    }

    // Mark as being processed
    this.#processingBatch.add(item.id);

    try {
      // Get existing traces from storage
      const existingTraces =
        (await this.#storageAdapter.getItem(this.#config.storageKey)) || [];

      // Format trace data using existing logic
      const traceData = this.#formatTraceData(item.trace);

      // Create trace record
      const traceRecord = {
        id: item.id,
        timestamp: Date.now(),
        priority: item.priority,
        data: traceData,
      };

      // Add to storage array
      existingTraces.push(traceRecord);

      // Implement rotation if needed
      if (existingTraces.length > this.#config.maxStoredTraces) {
        existingTraces.splice(
          0,
          existingTraces.length - this.#config.maxStoredTraces
        );
      }

      // Save to storage
      await this.#storageAdapter.setItem(
        this.#config.storageKey,
        existingTraces
      );

      // Update success metrics
      this.#metrics.totalProcessed++;

      // Mark as successfully processed
      this.#processedTraceIds.add(item.id);

      // Track latency for critical items
      if (item.priority === TracePriority.CRITICAL) {
        const itemLatency = Date.now() - item.timestamp;
        this.#updateLatencyMetrics(itemLatency, 1);
      }

      this.#logger.debug('TraceQueueProcessor: Item processed successfully', {
        itemId: item.id,
        priority: item.priority,
        processingTime: Date.now() - itemStartTime,
      });
    } catch (error) {
      this.#logger.error('TraceQueueProcessor: Failed to process item', error);

      // Track failure for circuit breaker
      this.#trackFailure();

      // Handle item failure (retry scheduling)
      // In parallel mode, always handle retry here
      // In sequential mode, let batch handler do it to avoid double retry
      if (isParallel) {
        await this.#handleItemFailure(item, error);
      }

      // Always re-throw for batch handling
      throw error;
    } finally {
      // Always remove from processing batch
      this.#processingBatch.delete(item.id);
    }
  }

  /**
   * Format trace data for storage (reusing existing logic)
   *
   * @private
   * @param {object} trace - Raw trace object
   * @returns {object} Formatted trace data
   */
  #formatTraceData(trace) {
    // Handle ActionExecutionTrace
    if (trace.toJSON && typeof trace.toJSON === 'function') {
      return trace.toJSON();
    }

    // Handle ActionAwareStructuredTrace
    if (
      trace.getTracedActions &&
      typeof trace.getTracedActions === 'function'
    ) {
      return this.#formatStructuredTrace(trace);
    }

    // Fallback for unknown trace types
    return {
      timestamp: new Date().toISOString(),
      type: 'unknown',
      data: trace,
    };
  }

  /**
   * Format structured trace for output (reusing existing logic)
   *
   * @private
   * @param {object} trace - Structured trace
   * @returns {object} Formatted data
   */
  #formatStructuredTrace(trace) {
    const tracedActions = trace.getTracedActions();
    const result = {
      timestamp: new Date().toISOString(),
      traceType: 'pipeline',
      spans: trace.getSpans ? trace.getSpans() : [],
      actions: {},
    };

    // Convert Map to object for JSON serialization
    for (const [actionId, data] of tracedActions) {
      result.actions[actionId] = {
        ...data,
        stageOrder: Object.keys(data.stages || {}),
        totalDuration: this.#calculateTotalDuration(data),
      };
    }

    return result;
  }

  /**
   * Calculate total duration from stage data (reusing existing logic)
   *
   * @private
   * @param {object} actionData - Action trace data
   * @returns {number} Total duration in ms
   */
  #calculateTotalDuration(actionData) {
    if (!actionData.stages) return 0;

    const timestamps = Object.values(actionData.stages)
      .map((stage) => stage.timestamp)
      .filter((ts) => ts);

    if (timestamps.length < 2) return 0;

    // Use reduce to avoid stack overflow with large arrays
    const maxTimestamp = timestamps.reduce((max, ts) => Math.max(max, ts), -Infinity);
    const minTimestamp = timestamps.reduce((min, ts) => Math.min(min, ts), Infinity);
    return maxTimestamp - minTimestamp;
  }

  /**
   * Handle batch processing failure
   *
   * @private
   * @param {Array} batch - Failed batch items
   * @param {Error} error - Batch error
   * @returns {Promise<void>}
   */
  async #handleBatchFailure(batch, error) {
    this.#metrics.totalErrors++;
    this.#trackFailure();

    // If circuit breaker is now open, return early
    if (this.#circuitBreakerOpen) {
      return;
    }

    // Retry items individually with exponential backoff
    for (const item of batch) {
      await this.#handleItemFailure(item, error);
    }
  }

  /**
   * Handle individual item failure
   *
   * @private
   * @param {object} item - Failed queue item
   * @param {Error} error - Item error
   * @returns {Promise<void>}
   */
  async #handleItemFailure(item, error) {
    item.retryCount = (item.retryCount || 0) + 1;

    if (item.retryCount <= this.#config.maxRetries) {
      // Calculate exponential backoff delay
      const delay = Math.min(
        QUEUE_CONSTANTS.RETRY_BASE_DELAY * Math.pow(2, item.retryCount),
        QUEUE_CONSTANTS.RETRY_MAX_DELAY
      );

      // Don't re-queue if shutting down
      if (this.#shuttingDown) {
        this.#logger.debug(
          'TraceQueueProcessor: Not retrying item during shutdown',
          {
            itemId: item.id,
          }
        );
        return;
      }

      // Re-queue item with delay
      this.#timerService.setTimeout(() => {
        // Double-check shutdown status in case it changed during delay
        if (this.#shuttingDown) {
          return;
        }

        const priorityQueue = this.#priorityQueues.get(item.priority);
        priorityQueue.unshift(item); // Add to front for retry
        this.#currentMemoryUsage += item.size;

        // Schedule processing if needed
        if (!this.#isProcessing) {
          this.#scheduleBatchProcessing();
        }
      }, delay);

      this.#logger.debug('TraceQueueProcessor: Item scheduled for retry', {
        itemId: item.id,
        retryCount: item.retryCount,
        delay,
      });
    } else {
      // Permanently failed
      this.#metrics.totalDropped++;

      if (this.#eventBus) {
        this.#eventBus.dispatch(QUEUE_EVENTS.ITEM_DROPPED, {
          itemId: item.id,
          priority: item.priority,
          retryCount: item.retryCount,
          reason: 'max_retries_exceeded',
        });
      }

      this.#logger.error('TraceQueueProcessor: Item permanently failed', {
        itemId: item.id,
        retryCount: item.retryCount,
        error: error.message,
      });
    }
  }

  /**
   * Update latency metrics
   *
   * @private
   * @param {number} latency - Latency in milliseconds
   * @param {number} _itemCount - Number of items processed (unused)
   */
  #updateLatencyMetrics(latency, _itemCount) {
    this.#metrics.totalLatency += latency;
    this.#metrics.minLatency = Math.min(this.#metrics.minLatency, latency);
    this.#metrics.maxLatency = Math.max(this.#metrics.maxLatency, latency);
  }

  /**
   * Flush all queued items and shutdown
   *
   * @returns {Promise<void>}
   */
  async shutdown() {
    this.#logger.info('TraceQueueProcessor: Shutting down...');

    // Mark as shutting down to prevent new enqueuing and retries
    this.#shuttingDown = true;

    // Clear batch timer to prevent new scheduling
    if (this.#batchTimer) {
      this.#timerService.clearTimeout(this.#batchTimer);
      this.#batchTimer = null;
    }

    // Wait for any currently running operations to complete if using TestTimerService
    if (this.#timerService.waitForCompletion) {
      try {
        await this.#timerService.waitForCompletion();
      } catch (error) {
        this.#logger.warn(
          'TraceQueueProcessor: Error waiting for timer completion',
          error
        );
      }
    }

    // Force stop processing by clearing the processing flag
    this.#isProcessing = false;

    // During shutdown, we'll process items directly without going through
    // the normal batch processing which has timer dependencies
    const remainingItems = [];

    // Collect all remaining items from priority queues
    for (const queue of this.#priorityQueues.values()) {
      while (queue.length > 0) {
        remainingItems.push(queue.shift());
      }
    }

    // Try to save remaining items directly if storage is available
    if (remainingItems.length > 0) {
      try {
        // Attempt a direct storage write without the complex processing logic
        const traces = remainingItems.map((item) => ({
          id: item.id,
          timestamp: Date.now(),
          priority: item.priority,
          data: this.#formatTraceData(item.trace),
        }));

        // Try to get existing traces and append
        let existingTraces = [];
        try {
          existingTraces =
            (await this.#storageAdapter.getItem(this.#config.storageKey)) || [];
        } catch (_error) {
          // If we can't read, start fresh
          this.#logger.debug(
            'TraceQueueProcessor: Could not read existing traces during shutdown'
          );
        }

        existingTraces.push(...traces);

        // Implement rotation if needed
        if (existingTraces.length > this.#config.maxStoredTraces) {
          existingTraces.splice(
            0,
            existingTraces.length - this.#config.maxStoredTraces
          );
        }

        // Attempt to save
        await this.#storageAdapter.setItem(
          this.#config.storageKey,
          existingTraces
        );
        this.#metrics.totalProcessed += remainingItems.length;

        this.#logger.info(
          'TraceQueueProcessor: Saved remaining items during shutdown',
          {
            itemCount: remainingItems.length,
          }
        );
      } catch (error) {
        this.#logger.warn(
          'TraceQueueProcessor: Could not save remaining items during shutdown',
          {
            itemCount: remainingItems.length,
            error: error.message,
          }
        );
      }
    }

    // Clear memory usage tracking
    this.#currentMemoryUsage = 0;

    // Log final shutdown status
    this.#logger.info('TraceQueueProcessor: Shutdown complete', {
      processedItems: this.#metrics.totalProcessed,
      remainingItems: 0,
    });
  }
}
