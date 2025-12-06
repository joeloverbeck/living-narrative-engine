/**
 * @file Cache metrics collection and monitoring service
 * @description Provides comprehensive cache monitoring and statistics collection
 */

import { BaseService } from '../utils/serviceBase.js';
import { validateDependency } from '../utils/dependencyUtils.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Cache metrics collection and monitoring service
 * Aggregates metrics from multiple cache instances and provides monitoring capabilities
 */
export class CacheMetrics extends BaseService {
  #logger;
  #registeredCaches = new Map();
  #globalStats = {
    totalHits: 0,
    totalMisses: 0,
    totalSets: 0,
    totalDeletes: 0,
    totalEvictions: 0,
    totalPrunings: 0,
    startTime: Date.now(),
  };
  #config;
  #collectionTimer = null;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {object} [config] - Metrics configuration
   * @param {number} [config.collectionInterval] - Metrics collection interval in ms
   * @param {boolean} [config.enableAutoCollection] - Enable automatic metrics collection
   * @param {number} [config.historyRetention] - Hours to retain metrics history
   */
  constructor({ logger }, config = {}) {
    super();

    this.#logger = this._init('CacheMetrics', logger);

    this.#config = {
      collectionInterval: config.collectionInterval || 60000, // 1 minute
      enableAutoCollection: config.enableAutoCollection !== false,
      historyRetention: config.historyRetention || 24, // 24 hours
    };

    this.#logger.info(
      `CacheMetrics initialized: collection interval=${this.#config.collectionInterval}ms, ` +
        `auto-collection=${this.#config.enableAutoCollection}`
    );
  }

  /**
   * Register a cache instance for metrics collection
   *
   * @param {string} cacheId - Unique identifier for the cache
   * @param {object} cache - Cache instance with getMetrics() method
   * @param {object} [metadata] - Additional metadata about the cache
   */
  registerCache(cacheId, cache, metadata = {}) {
    if (!cacheId || typeof cacheId !== 'string') {
      throw new Error('Cache ID must be a non-empty string');
    }

    if (!cache || typeof cache.getMetrics !== 'function') {
      throw new Error('Cache must implement getMetrics() method');
    }

    this.#registeredCaches.set(cacheId, {
      cache,
      metadata: {
        registeredAt: Date.now(),
        type: metadata.type || 'unknown',
        description: metadata.description || '',
        ...metadata,
      },
      lastMetrics: null,
      history: [],
    });

    this.#logger.info(
      `Cache registered for metrics: ${cacheId} (type: ${metadata.type || 'unknown'})`
    );
  }

  /**
   * Unregister a cache instance
   *
   * @param {string} cacheId - Cache identifier
   * @returns {boolean} True if cache was unregistered
   */
  unregisterCache(cacheId) {
    const removed = this.#registeredCaches.delete(cacheId);
    if (removed) {
      this.#logger.info(`Cache unregistered from metrics: ${cacheId}`);
    }
    return removed;
  }

  /**
   * Collect metrics from a specific cache
   *
   * @param {string} cacheId - Cache identifier
   * @returns {object|null} Current metrics or null if cache not found
   */
  collectCacheMetrics(cacheId) {
    const cacheInfo = this.#registeredCaches.get(cacheId);
    if (!cacheInfo) {
      return null;
    }

    try {
      const metrics = cacheInfo.cache.getMetrics();
      const timestamp = Date.now();

      const metricsSnapshot = {
        timestamp,
        cacheId,
        ...metrics,
        metadata: cacheInfo.metadata,
      };

      // Update cache info
      cacheInfo.lastMetrics = metricsSnapshot;

      // Add to history
      cacheInfo.history.push(metricsSnapshot);

      // Trim history based on retention policy
      const cutoff = timestamp - this.#config.historyRetention * 3600000; // hours to ms
      cacheInfo.history = cacheInfo.history.filter(
        (entry) => entry.timestamp > cutoff
      );

      return metricsSnapshot;
    } catch (error) {
      this.#logger.error(
        `Failed to collect metrics for cache: ${cacheId}`,
        error
      );
      return null;
    }
  }

  /**
   * Collect metrics from all registered caches
   *
   * @returns {object[]} Array of metrics snapshots
   */
  collectAllMetrics() {
    const allMetrics = [];

    for (const cacheId of this.#registeredCaches.keys()) {
      const metrics = this.collectCacheMetrics(cacheId);
      if (metrics) {
        allMetrics.push(metrics);
      }
    }

    // Update global stats
    this.#updateGlobalStats(allMetrics);

    return allMetrics;
  }

  /**
   * Update global statistics
   *
   * @param {object[]} allMetrics - Array of metrics snapshots
   * @private
   */
  #updateGlobalStats(allMetrics) {
    // Reset current totals (we'll recalculate from current metrics)
    let totalHits = 0;
    let totalMisses = 0;
    let totalSets = 0;
    let totalDeletes = 0;

    for (const metrics of allMetrics) {
      if (metrics.stats) {
        totalHits += metrics.stats.hits || 0;
        totalMisses += metrics.stats.misses || 0;
        totalSets += metrics.stats.sets || 0;
        totalDeletes += metrics.stats.deletes || 0;
      }
    }

    // Update global stats with current totals
    this.#globalStats.totalHits = totalHits;
    this.#globalStats.totalMisses = totalMisses;
    this.#globalStats.totalSets = totalSets;
    this.#globalStats.totalDeletes = totalDeletes;
  }

  /**
   * Get metrics for a specific cache
   *
   * @param {string} cacheId - Cache identifier
   * @returns {object|null} Cache metrics or null if not found
   */
  getCacheMetrics(cacheId) {
    const cacheInfo = this.#registeredCaches.get(cacheId);
    return cacheInfo ? cacheInfo.lastMetrics : null;
  }

  /**
   * Get metrics history for a specific cache
   *
   * @param {string} cacheId - Cache identifier
   * @param {number} [hours] - Number of hours of history to return
   * @returns {object[]|null} Array of historical metrics or null if cache not found
   */
  getCacheHistory(cacheId, hours = 1) {
    const cacheInfo = this.#registeredCaches.get(cacheId);
    if (!cacheInfo) {
      return null;
    }

    const cutoff = Date.now() - hours * 3600000; // hours to ms
    return cacheInfo.history.filter((entry) => entry.timestamp > cutoff);
  }

  /**
   * Get aggregated metrics across all caches
   *
   * @returns {object} Aggregated metrics
   */
  getAggregatedMetrics() {
    const allMetrics = this.collectAllMetrics();

    const aggregated = {
      timestamp: Date.now(),
      cacheCount: this.#registeredCaches.size,
      totalSize: 0,
      totalMaxSize: 0,
      totalMemoryUsage: 0,
      totalHits: 0,
      totalMisses: 0,
      totalSets: 0,
      totalDeletes: 0,
      overallHitRate: 0,
      caches: {},
      strategyDistribution: {},
      memoryUtilization: {
        totalBytes: 0,
        totalMB: 0,
        highestUtilization: 0,
        averageUtilization: 0,
      },
      globalStats: { ...this.#globalStats },
    };

    // Calculate aggregated values
    let hitRateSum = 0;
    let validHitRates = 0;
    const utilizationRates = [];

    for (const metrics of allMetrics) {
      // Size aggregation
      aggregated.totalSize += metrics.size || 0;
      aggregated.totalMaxSize += metrics.maxSize || 0;
      aggregated.totalMemoryUsage += metrics.memorySize || 0;

      // Stats aggregation
      if (metrics.stats) {
        aggregated.totalHits += metrics.stats.hits || 0;
        aggregated.totalMisses += metrics.stats.misses || 0;
        aggregated.totalSets += metrics.stats.sets || 0;
        aggregated.totalDeletes += metrics.stats.deletes || 0;
      }

      // Hit rate aggregation
      if (metrics.hitRate !== undefined && metrics.hitRate >= 0) {
        hitRateSum += metrics.hitRate;
        validHitRates++;
      }

      // Strategy distribution
      const strategy = metrics.strategyName || 'unknown';
      aggregated.strategyDistribution[strategy] =
        (aggregated.strategyDistribution[strategy] || 0) + 1;

      // Memory utilization
      if (metrics.memoryUsageMB) {
        aggregated.memoryUtilization.totalBytes += metrics.memorySize || 0;
        aggregated.memoryUtilization.totalMB += metrics.memoryUsageMB;

        if (metrics.utilizationPercent !== undefined) {
          utilizationRates.push(metrics.utilizationPercent);
        }
      }

      // Individual cache summary
      aggregated.caches[metrics.cacheId || 'unknown'] = {
        size: metrics.size,
        maxSize: metrics.maxSize,
        hitRate: metrics.hitRate,
        memoryMB: metrics.memoryUsageMB,
        strategy: metrics.strategyName,
        type: metrics.metadata?.type,
      };
    }

    // Calculate derived metrics
    if (aggregated.totalHits + aggregated.totalMisses > 0) {
      aggregated.overallHitRate =
        aggregated.totalHits / (aggregated.totalHits + aggregated.totalMisses);
    }

    if (utilizationRates.length > 0) {
      // Use reduce to avoid stack overflow with large arrays
      aggregated.memoryUtilization.highestUtilization = utilizationRates.reduce(
        (max, rate) => Math.max(max, rate),
        -Infinity
      );
      aggregated.memoryUtilization.averageUtilization =
        utilizationRates.reduce((sum, rate) => sum + rate, 0) /
        utilizationRates.length;
    }

    // Runtime information
    aggregated.runtime = {
      uptimeMs: Date.now() - this.#globalStats.startTime,
      uptimeHours: (Date.now() - this.#globalStats.startTime) / 3600000,
    };

    return aggregated;
  }

  /**
   * Get performance summary for all caches
   *
   * @returns {object} Performance summary
   */
  getPerformanceSummary() {
    const aggregated = this.getAggregatedMetrics();

    return {
      overview: {
        cacheCount: aggregated.cacheCount,
        overallHitRate: aggregated.overallHitRate,
        totalMemoryMB: aggregated.memoryUtilization.totalMB,
        averageUtilization: aggregated.memoryUtilization.averageUtilization,
      },
      performance: {
        highPerformingCaches: Object.entries(aggregated.caches)
          .filter(([, cache]) => cache.hitRate > 0.8)
          .map(([id]) => id),
        lowPerformingCaches: Object.entries(aggregated.caches)
          .filter(([, cache]) => cache.hitRate < 0.5)
          .map(([id]) => id),
        memoryIntensiveCaches: Object.entries(aggregated.caches)
          .filter(([, cache]) => cache.memoryMB > 10)
          .map(([id, cache]) => ({ id, memoryMB: cache.memoryMB })),
      },
      recommendations: this.#generateRecommendations(aggregated),
    };
  }

  /**
   * Generate performance recommendations
   *
   * @param {object} aggregated - Aggregated metrics
   * @returns {string[]} Array of recommendations
   * @private
   */
  #generateRecommendations(aggregated) {
    const recommendations = [];

    if (aggregated.overallHitRate < 0.6) {
      recommendations.push(
        'Overall hit rate is below 60%. Consider reviewing cache TTL settings or key strategies.'
      );
    }

    if (aggregated.memoryUtilization.averageUtilization > 85) {
      recommendations.push(
        'Memory utilization is high (>85%). Consider increasing memory limits or enabling more aggressive pruning.'
      );
    }

    const lruCount = aggregated.strategyDistribution.LRU || 0;
    const totalCaches = aggregated.cacheCount;

    if (lruCount / totalCaches < 0.7 && totalCaches > 1) {
      recommendations.push(
        'Consider using LRU strategy for most caches as it typically provides the best balance of performance and memory usage.'
      );
    }

    if (
      Object.values(aggregated.caches).some(
        (cache) => cache.size === cache.maxSize
      )
    ) {
      recommendations.push(
        'Some caches are at maximum capacity. Monitor eviction patterns and consider increasing cache sizes for frequently accessed data.'
      );
    }

    return recommendations;
  }

  /**
   * Get list of registered cache IDs
   *
   * @returns {string[]} Array of cache IDs
   */
  getRegisteredCaches() {
    return Array.from(this.#registeredCaches.keys());
  }

  /**
   * Check if a cache is registered
   *
   * @param {string} cacheId - Cache identifier
   * @returns {boolean} True if cache is registered
   */
  isCacheRegistered(cacheId) {
    return this.#registeredCaches.has(cacheId);
  }

  /**
   * Start automatic metrics collection
   *
   * @param {number} [interval] - Collection interval in milliseconds
   */
  startCollection(interval) {
    const collectionInterval = interval || this.#config.collectionInterval;

    if (this.#collectionTimer) {
      this.stopCollection();
    }

    this.#collectionTimer = setInterval(() => {
      this.collectAllMetrics();
    }, collectionInterval);

    this.#logger.info(
      `Started automatic metrics collection with interval: ${collectionInterval}ms`
    );
  }

  /**
   * Stop automatic metrics collection
   */
  stopCollection() {
    if (this.#collectionTimer) {
      clearInterval(this.#collectionTimer);
      this.#collectionTimer = null;
      this.#logger.info('Stopped automatic metrics collection');
    }
  }

  /**
   * Get historical data for all caches
   *
   * @returns {object[]} Array of historical metrics
   */
  getHistoricalData() {
    const history = [];

    for (const [cacheId, cacheInfo] of this.#registeredCaches.entries()) {
      history.push(
        ...cacheInfo.history.map((entry) => ({
          ...entry,
          cacheId,
        }))
      );
    }

    // Sort by timestamp
    history.sort((a, b) => a.timestamp - b.timestamp);
    return history;
  }

  /**
   * Analyze performance across all caches
   *
   * @returns {object} Performance analysis results
   */
  analyzePerformance() {
    const aggregated = this.getAggregatedMetrics();
    const caches = Array.from(this.#registeredCaches.entries());

    // Identify top performers
    const topPerformers = caches
      .filter(([, info]) => info.lastMetrics && info.lastMetrics.hitRate > 0.8)
      .map(([id, info]) => ({
        id,
        hitRate: info.lastMetrics.hitRate,
        strategy: info.lastMetrics.strategyName,
      }))
      .sort((a, b) => b.hitRate - a.hitRate)
      .slice(0, 5);

    // Identify poor performers
    const poorPerformers = caches
      .filter(([, info]) => info.lastMetrics && info.lastMetrics.hitRate < 0.5)
      .map(([id, info]) => ({
        id,
        hitRate: info.lastMetrics.hitRate,
        strategy: info.lastMetrics.strategyName,
      }))
      .sort((a, b) => a.hitRate - b.hitRate)
      .slice(0, 5);

    return {
      summary: {
        totalCaches: aggregated.cacheCount,
        overallHitRate: aggregated.overallHitRate,
        totalMemoryMB: aggregated.memoryUtilization.totalMB,
        averageUtilization: aggregated.memoryUtilization.averageUtilization,
      },
      topPerformers,
      poorPerformers,
      recommendations: this.#generateRecommendations(aggregated),
      strategyDistribution: aggregated.strategyDistribution,
    };
  }

  /**
   * Clean up resources and stop all timers
   */
  destroy() {
    this.stopCollection();
    this.#registeredCaches.clear();
    this.#logger.info('CacheMetrics service destroyed');
  }
}

export default CacheMetrics;
