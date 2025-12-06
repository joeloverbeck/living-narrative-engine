/**
 * @file HttpAgentService - Manages HTTP agents with connection pooling
 * @description Provides connection pooling for HTTP/HTTPS requests to improve performance
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';

import {
  HTTP_AGENT_KEEP_ALIVE,
  HTTP_AGENT_MAX_SOCKETS,
  HTTP_AGENT_MAX_FREE_SOCKETS,
  HTTP_AGENT_TIMEOUT,
  HTTP_AGENT_FREE_SOCKET_TIMEOUT,
  HTTP_AGENT_MAX_TOTAL_SOCKETS,
} from '../config/constants.js';

/**
 * @typedef {object} AgentConfig
 * @property {boolean} keepAlive - Whether to keep sockets alive between requests
 * @property {number} maxSockets - Maximum number of sockets per host
 * @property {number} maxFreeSockets - Maximum number of free sockets to keep open
 * @property {number} timeout - Socket timeout in milliseconds
 * @property {number} freeSocketTimeout - Timeout for free sockets in milliseconds
 * @property {number} maxTotalSockets - Maximum total sockets across all hosts
 */

/**
 * Service for managing HTTP agents with connection pooling
 */
class HttpAgentService {
  #logger;
  #agents;
  #config;
  #stats;
  #cleanupIntervalId;
  #adaptiveCleanupConfig;
  #lastCleanupTime;
  #requestFrequencyTracker;

  /**
   * Creates an instance of HttpAgentService
   * @param {object} logger - Logger instance
   * @param {AgentConfig} config - Agent configuration
   */
  constructor(logger, config = {}) {
    if (!logger) {
      throw new Error('Logger is required');
    }

    this.#logger = logger;
    this.#agents = new Map();
    this.#cleanupIntervalId = null;
    this.#lastCleanupTime = Date.now();

    // Default configuration for agents
    this.#config = {
      keepAlive:
        config.keepAlive !== undefined
          ? config.keepAlive
          : HTTP_AGENT_KEEP_ALIVE,
      maxSockets: config.maxSockets || HTTP_AGENT_MAX_SOCKETS,
      maxFreeSockets: config.maxFreeSockets || HTTP_AGENT_MAX_FREE_SOCKETS,
      timeout: config.timeout || HTTP_AGENT_TIMEOUT, // 120 seconds default
      freeSocketTimeout:
        config.freeSocketTimeout || HTTP_AGENT_FREE_SOCKET_TIMEOUT, // 30 seconds
      maxTotalSockets: config.maxTotalSockets || HTTP_AGENT_MAX_TOTAL_SOCKETS,
      ...config,
    };

    // Adaptive cleanup configuration
    this.#adaptiveCleanupConfig = {
      baseIntervalMs: config.baseCleanupIntervalMs || 300000, // 5 minutes default
      minIntervalMs: config.minCleanupIntervalMs || 60000, // 1 minute minimum
      maxIntervalMs: config.maxCleanupIntervalMs || 900000, // 15 minutes maximum
      idleThresholdMs: config.idleThresholdMs || 300000, // 5 minutes idle threshold
      memoryThresholdMB: config.memoryThresholdMB || 100, // 100MB memory threshold
      highLoadRequestsPerMin: config.highLoadRequestsPerMin || 60, // High load threshold
      adaptiveCleanupEnabled: config.adaptiveCleanupEnabled !== false, // Default true
    };

    // Initialize request frequency tracker (tracks requests per minute)
    this.#requestFrequencyTracker = {
      requests: [],
      windowSizeMs: 60000, // 1 minute window
    };

    // Initialize enhanced statistics
    this.#stats = {
      agentsCreated: 0,
      requestsServed: 0,
      socketsCreated: 0,
      socketsReused: 0,
      cleanupOperations: 0,
      adaptiveCleanupAdjustments: 0,
      lastCleanupDuration: 0,
      averageCleanupInterval: this.#adaptiveCleanupConfig.baseIntervalMs,
    };

    this.#logger.info(
      'HttpAgentService: Initialized with adaptive cleanup configuration',
      {
        ...this.#config,
        adaptiveCleanup: this.#adaptiveCleanupConfig,
      }
    );

    // Set up adaptive cleanup
    this.#scheduleAdaptiveCleanup();
  }

  /**
   * Gets or creates an HTTP agent for the given URL
   * @param {string} url - The target URL
   * @returns {http.Agent|https.Agent} The HTTP(S) agent
   */
  getAgent(url) {
    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol;
      const hostname = parsedUrl.hostname;
      const port = parsedUrl.port || (protocol === 'https:' ? 443 : 80);

      // Create agent key based on protocol, hostname, and port
      const agentKey = `${protocol}//${hostname}:${port}`;

      // Check if we already have an agent for this host
      let agentInfo = this.#agents.get(agentKey);

      if (!agentInfo) {
        // Create new agent
        const AgentClass = protocol === 'https:' ? https.Agent : http.Agent;
        const agent = new AgentClass({
          keepAlive: this.#config.keepAlive,
          maxSockets: this.#config.maxSockets,
          maxFreeSockets: this.#config.maxFreeSockets,
          timeout: this.#config.timeout,
          freeSocketTimeout: this.#config.freeSocketTimeout,
          scheduling: 'fifo', // First-in-first-out socket reuse
        });

        agentInfo = {
          agent,
          protocol,
          hostname,
          port,
          createdAt: Date.now(),
          lastUsed: Date.now(),
          requestCount: 0,
        };

        this.#agents.set(agentKey, agentInfo);
        this.#stats.agentsCreated++;

        this.#logger.info(
          `HttpAgentService: Created new agent for ${agentKey}`
        );

        // Monitor agent socket events for statistics
        this.#monitorAgent(agent, agentKey);
      }

      // Update usage statistics
      const now = Date.now();
      agentInfo.lastUsed = now;
      agentInfo.requestCount++;
      this.#stats.requestsServed++;

      // Track request frequency for adaptive cleanup
      this.#trackRequestFrequency(now);

      this.#logger.debug(
        `HttpAgentService: Reusing agent for ${agentKey} (${agentInfo.requestCount} requests)`
      );

      return agentInfo.agent;
    } catch (error) {
      this.#logger.error('HttpAgentService: Error getting agent for URL', {
        url,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Monitors agent socket events for statistics
   * @param {http.Agent|https.Agent} agent - The agent to monitor
   * @param {string} agentKey - The agent key for logging
   * @private
   */
  #monitorAgent(agent, agentKey) {
    // Track socket creation
    agent.on('socket', (socket) => {
      this.#stats.socketsCreated++;
      this.#logger.debug(`HttpAgentService: Socket created for ${agentKey}`);

      // Track socket reuse
      socket.on('agentRemove', () => {
        this.#stats.socketsReused++;
        this.#logger.debug(`HttpAgentService: Socket reused for ${agentKey}`);
      });
    });
  }

  /**
   * Gets an agent for specific fetch options
   * @param {string} url - The target URL
   * @returns {object} Fetch options with agent
   */
  getFetchOptions(url) {
    const agent = this.getAgent(url);
    return { agent };
  }

  /**
   * Destroys an agent and closes all its connections
   * @param {string} url - The URL whose agent to destroy
   * @returns {boolean} True if agent was found and destroyed
   */
  destroyAgent(url) {
    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol;
      const hostname = parsedUrl.hostname;
      const port = parsedUrl.port || (protocol === 'https:' ? 443 : 80);
      const agentKey = `${protocol}//${hostname}:${port}`;

      const agentInfo = this.#agents.get(agentKey);
      if (agentInfo) {
        agentInfo.agent.destroy();
        this.#agents.delete(agentKey);
        this.#logger.info(`HttpAgentService: Destroyed agent for ${agentKey}`);
        return true;
      }

      return false;
    } catch (error) {
      this.#logger.error('HttpAgentService: Error destroying agent', {
        url,
        error: error.message,
      });
      return false;
    }
  }

  /**
   * Destroys all agents and closes all connections
   */
  destroyAll() {
    let count = 0;
    for (const [, agentInfo] of this.#agents) {
      agentInfo.agent.destroy();
      count++;
    }

    this.#agents.clear();
    this.#logger.info(`HttpAgentService: Destroyed all ${count} agents`);
  }

  /**
   * Gets statistics about agent usage
   * @returns {object} Agent statistics
   */
  getStats() {
    const agentStats = [];

    for (const [agentKey, agentInfo] of this.#agents) {
      const agent = agentInfo.agent;
      agentStats.push({
        key: agentKey,
        protocol: agentInfo.protocol,
        hostname: agentInfo.hostname,
        port: agentInfo.port,
        requestCount: agentInfo.requestCount,
        createdAt: new Date(agentInfo.createdAt).toISOString(),
        lastUsed: new Date(agentInfo.lastUsed).toISOString(),
        activeSockets: agent.sockets
          ? Object.keys(agent.sockets).reduce(
              (sum, key) => sum + agent.sockets[key].length,
              0
            )
          : 0,
        freeSockets: agent.freeSockets
          ? Object.keys(agent.freeSockets).reduce(
              (sum, key) => sum + agent.freeSockets[key].length,
              0
            )
          : 0,
      });
    }

    return {
      ...this.#stats,
      activeAgents: this.#agents.size,
      agentDetails: agentStats,
    };
  }

  /**
   * Cleans up idle agents
   * @param {number} maxIdleTime - Maximum idle time in milliseconds
   * @returns {number} Number of agents cleaned up
   */
  cleanupIdleAgents(maxIdleTime = 300000) {
    // 5 minutes default
    const now = Date.now();
    let cleanedCount = 0;

    for (const [agentKey, agentInfo] of this.#agents) {
      if (now - agentInfo.lastUsed > maxIdleTime) {
        agentInfo.agent.destroy();
        this.#agents.delete(agentKey);
        cleanedCount++;
        this.#logger.info(
          `HttpAgentService: Cleaned up idle agent ${agentKey}`
        );
      }
    }

    if (cleanedCount > 0) {
      this.#logger.info(
        `HttpAgentService: Cleaned up ${cleanedCount} idle agents`
      );
    }

    return cleanedCount;
  }

  /**
   * Schedules adaptive cleanup of idle agents based on usage patterns
   * @private
   */
  #scheduleAdaptiveCleanup() {
    if (!this.#adaptiveCleanupConfig.adaptiveCleanupEnabled) {
      // Fallback to fixed interval cleanup
      this.#cleanupIntervalId = setInterval(() => {
        this.#performAdaptiveCleanup();
      }, this.#adaptiveCleanupConfig.baseIntervalMs);
      return;
    }

    // Start with base interval
    this.#scheduleNextCleanup(this.#adaptiveCleanupConfig.baseIntervalMs);
  }

  /**
   * Schedules the next cleanup operation with calculated interval
   * @param {number} intervalMs - Interval in milliseconds
   * @private
   */
  #scheduleNextCleanup(intervalMs) {
    if (this.#cleanupIntervalId) {
      clearTimeout(this.#cleanupIntervalId);
    }

    this.#cleanupIntervalId = setTimeout(() => {
      this.#performAdaptiveCleanup();

      // Calculate next interval based on current conditions
      const nextInterval = this.#calculateNextCleanupInterval();
      this.#scheduleNextCleanup(nextInterval);
    }, intervalMs);

    this.#logger.debug(
      `HttpAgentService: Scheduled next cleanup in ${intervalMs}ms`
    );
  }

  /**
   * Gets the number of active agents
   * @returns {number} Number of active agents
   */
  getActiveAgentCount() {
    return this.#agents.size;
  }

  /**
   * Checks if an agent exists for the given URL
   * @param {string} url - The URL to check
   * @returns {boolean} True if agent exists
   */
  hasAgent(url) {
    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol;
      const hostname = parsedUrl.hostname;
      const port = parsedUrl.port || (protocol === 'https:' ? 443 : 80);
      const agentKey = `${protocol}//${hostname}:${port}`;

      return this.#agents.has(agentKey);
    } catch (_error) {
      return false;
    }
  }

  /**
   * Updates agent configuration (affects new agents only)
   * @param {AgentConfig} newConfig - New configuration
   */
  updateConfig(newConfig) {
    this.#config = { ...this.#config, ...newConfig };
    this.#logger.info('HttpAgentService: Updated configuration', this.#config);
  }

  /**
   * Gets current configuration
   * @returns {AgentConfig} Current configuration
   */
  getConfig() {
    return { ...this.#config };
  }

  /**
   * @description Provides a diagnostic preview of the next cleanup interval without scheduling timers
   * @param {object} [options={}] - Optional overrides for the preview calculation
   * @param {boolean} [options.overrideAdaptiveCleanupEnabled] - Temporarily override adaptive cleanup mode for the preview
   * @returns {number} Next cleanup interval in milliseconds
   */
  getNextCleanupIntervalPreview(options = {}) {
    const { overrideAdaptiveCleanupEnabled } = options;

    if (typeof overrideAdaptiveCleanupEnabled === 'boolean') {
      const originalAdaptiveMode =
        this.#adaptiveCleanupConfig.adaptiveCleanupEnabled;

      this.#adaptiveCleanupConfig.adaptiveCleanupEnabled =
        overrideAdaptiveCleanupEnabled;

      try {
        return this.#calculateNextCleanupInterval();
      } finally {
        this.#adaptiveCleanupConfig.adaptiveCleanupEnabled =
          originalAdaptiveMode;
      }
    }

    return this.#calculateNextCleanupInterval();
  }

  /**
   * Cleans up all resources including timers and agents
   * Call this method when shutting down the service
   */
  cleanup() {
    // Clear the cleanup interval/timeout
    if (this.#cleanupIntervalId) {
      clearTimeout(this.#cleanupIntervalId);
      this.#cleanupIntervalId = null;
      this.#logger.info('HttpAgentService: Cleared adaptive cleanup timer');
    }

    // Destroy all agents
    this.destroyAll();
  }

  // Private helper methods for adaptive cleanup

  /**
   * Tracks request frequency for adaptive cleanup calculations
   * @param {number} timestamp - Request timestamp
   * @private
   */
  #trackRequestFrequency(timestamp) {
    // Add new request timestamp
    this.#requestFrequencyTracker.requests.push(timestamp);

    // Remove old requests outside the tracking window
    const cutoff = timestamp - this.#requestFrequencyTracker.windowSizeMs;
    this.#requestFrequencyTracker.requests =
      this.#requestFrequencyTracker.requests.filter((req) => req > cutoff);
  }

  /**
   * Calculates the current request rate (requests per minute)
   * @returns {number} Requests per minute
   * @private
   */
  #getCurrentRequestRate() {
    const now = Date.now();
    const cutoff = now - this.#requestFrequencyTracker.windowSizeMs;

    // Count requests in the last minute
    const recentRequests = this.#requestFrequencyTracker.requests.filter(
      (req) => req > cutoff
    );

    return recentRequests.length;
  }

  /**
   * Estimates current memory usage of all agents
   * @returns {number} Estimated memory usage in MB
   * @private
   */
  #estimateMemoryUsage() {
    // Rough estimation: each agent uses approximately 1KB base + socket overhead
    const baseMemoryPerAgent = 1; // KB
    const socketMemoryOverhead = 0.5; // KB per socket estimate

    let totalSockets = 0;
    for (const [, agentInfo] of this.#agents) {
      const agent = agentInfo.agent;
      if (agent.sockets) {
        totalSockets += Object.keys(agent.sockets).reduce(
          (sum, key) => sum + agent.sockets[key].length,
          0
        );
      }
      if (agent.freeSockets) {
        totalSockets += Object.keys(agent.freeSockets).reduce(
          (sum, key) => sum + agent.freeSockets[key].length,
          0
        );
      }
    }

    const totalMemoryKB =
      this.#agents.size * baseMemoryPerAgent +
      totalSockets * socketMemoryOverhead;
    return totalMemoryKB / 1024; // Convert to MB
  }

  /**
   * Calculates the next cleanup interval based on current conditions
   * @returns {number} Next cleanup interval in milliseconds
   * @private
   */
  #calculateNextCleanupInterval() {
    if (!this.#adaptiveCleanupConfig.adaptiveCleanupEnabled) {
      return this.#adaptiveCleanupConfig.baseIntervalMs;
    }

    const requestRate = this.#getCurrentRequestRate();
    const memoryUsageMB = this.#estimateMemoryUsage();
    const agentCount = this.#agents.size;
    const _timeSinceLastCleanup = Date.now() - this.#lastCleanupTime;

    let intervalMultiplier = 1.0;
    let adjustmentReason = 'base';

    // Adjust based on request rate
    if (requestRate > this.#adaptiveCleanupConfig.highLoadRequestsPerMin) {
      // High load: clean up more frequently
      intervalMultiplier *= 0.5;
      adjustmentReason = 'high-load';
    } else if (requestRate < 10) {
      // Low load: clean up less frequently
      intervalMultiplier *= 1.5;
      adjustmentReason = 'low-load';
    }

    // Adjust based on memory usage
    if (memoryUsageMB > this.#adaptiveCleanupConfig.memoryThresholdMB) {
      // High memory usage: clean up more frequently
      intervalMultiplier *= 0.7;
      adjustmentReason += '+high-memory';
    }

    // Adjust based on agent count
    if (agentCount > 50) {
      // Many agents: clean up more frequently
      intervalMultiplier *= 0.8;
      adjustmentReason += '+many-agents';
    } else if (agentCount < 10) {
      // Few agents: clean up less frequently
      intervalMultiplier *= 1.3;
      adjustmentReason += '+few-agents';
    }

    // Calculate final interval
    let nextInterval = Math.round(
      this.#adaptiveCleanupConfig.baseIntervalMs * intervalMultiplier
    );

    // Apply min/max bounds
    nextInterval = Math.max(
      nextInterval,
      this.#adaptiveCleanupConfig.minIntervalMs
    );
    nextInterval = Math.min(
      nextInterval,
      this.#adaptiveCleanupConfig.maxIntervalMs
    );

    // Update average for statistics
    this.#stats.averageCleanupInterval = Math.round(
      (this.#stats.averageCleanupInterval + nextInterval) / 2
    );

    if (nextInterval !== this.#adaptiveCleanupConfig.baseIntervalMs) {
      this.#stats.adaptiveCleanupAdjustments++;
      this.#logger.debug(
        `HttpAgentService: Adaptive cleanup interval adjusted to ${nextInterval}ms (${adjustmentReason})`,
        {
          requestRate,
          memoryUsageMB,
          agentCount,
          intervalMultiplier,
        }
      );
    }

    return nextInterval;
  }

  /**
   * Performs adaptive cleanup with enhanced logic
   * @private
   */
  #performAdaptiveCleanup() {
    const startTime = Date.now();
    const requestRate = this.#getCurrentRequestRate();
    const memoryUsageMB = this.#estimateMemoryUsage();

    // Determine cleanup aggressiveness based on conditions
    let idleThreshold = this.#adaptiveCleanupConfig.idleThresholdMs;

    if (requestRate > this.#adaptiveCleanupConfig.highLoadRequestsPerMin) {
      // High load: keep agents longer to avoid recreation overhead
      idleThreshold *= 2;
    } else if (memoryUsageMB > this.#adaptiveCleanupConfig.memoryThresholdMB) {
      // High memory: clean up more aggressively
      idleThreshold *= 0.5;
    }

    // Perform cleanup
    const cleanedCount = this.cleanupIdleAgents(idleThreshold);

    // Update statistics
    this.#stats.cleanupOperations++;
    this.#stats.lastCleanupDuration = Date.now() - startTime;
    this.#lastCleanupTime = startTime;

    if (cleanedCount > 0 || this.#logger.isDebugEnabled) {
      this.#logger.info(
        `HttpAgentService: Adaptive cleanup completed - cleaned ${cleanedCount} agents`,
        {
          requestRate,
          memoryUsageMB,
          agentCount: this.#agents.size,
          idleThreshold,
          duration: this.#stats.lastCleanupDuration,
        }
      );
    }
  }

  /**
   * Gets enhanced statistics including adaptive cleanup metrics
   * @returns {object} Agent statistics with adaptive metrics
   */
  getEnhancedStats() {
    const baseStats = this.getStats();
    const requestRate = this.#getCurrentRequestRate();
    const memoryUsageMB = this.#estimateMemoryUsage();

    return {
      ...baseStats,
      requestRate,
      estimatedMemoryUsageMB: memoryUsageMB,
      adaptiveCleanup: {
        enabled: this.#adaptiveCleanupConfig.adaptiveCleanupEnabled,
        adjustments: this.#stats.adaptiveCleanupAdjustments,
        averageInterval: this.#stats.averageCleanupInterval,
        lastCleanupDuration: this.#stats.lastCleanupDuration,
        cleanupOperations: this.#stats.cleanupOperations,
      },
    };
  }

  /**
   * Forces an immediate adaptive cleanup and returns results
   * @returns {object} Cleanup results
   */
  forceAdaptiveCleanup() {
    const beforeCount = this.#agents.size;
    const beforeMemory = this.#estimateMemoryUsage();

    this.#performAdaptiveCleanup();

    return {
      agentsRemoved: beforeCount - this.#agents.size,
      memoryFreedMB: beforeMemory - this.#estimateMemoryUsage(),
      currentAgentCount: this.#agents.size,
      currentMemoryMB: this.#estimateMemoryUsage(),
    };
  }
}

export default HttpAgentService;
