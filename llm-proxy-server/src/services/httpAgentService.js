/**
 * @file HttpAgentService - Manages HTTP agents with connection pooling
 * @description Provides connection pooling for HTTP/HTTPS requests to improve performance
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';

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

    // Default configuration for agents
    this.#config = {
      keepAlive: config.keepAlive !== undefined ? config.keepAlive : true,
      maxSockets: config.maxSockets || 50,
      maxFreeSockets: config.maxFreeSockets || 10,
      timeout: config.timeout || 60000, // 60 seconds
      freeSocketTimeout: config.freeSocketTimeout || 30000, // 30 seconds
      maxTotalSockets: config.maxTotalSockets || 500,
      ...config,
    };

    // Initialize statistics
    this.#stats = {
      agentsCreated: 0,
      requestsServed: 0,
      socketsCreated: 0,
      socketsReused: 0,
    };

    this.#logger.info(
      'HttpAgentService: Initialized with configuration',
      this.#config
    );

    // Set up periodic cleanup
    this.#scheduleCleanup();
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
      agentInfo.lastUsed = Date.now();
      agentInfo.requestCount++;
      this.#stats.requestsServed++;

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
   * Schedules periodic cleanup of idle agents
   * @private
   */
  #scheduleCleanup() {
    // Run cleanup every 5 minutes
    this.#cleanupIntervalId = setInterval(() => {
      this.cleanupIdleAgents();
    }, 300000); // 5 minutes
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
   * Cleans up all resources including timers and agents
   * Call this method when shutting down the service
   */
  cleanup() {
    // Clear the cleanup interval
    if (this.#cleanupIntervalId) {
      clearInterval(this.#cleanupIntervalId);
      this.#cleanupIntervalId = null;
      this.#logger.info('HttpAgentService: Cleared cleanup interval timer');
    }

    // Destroy all agents
    this.destroyAll();
  }
}

export default HttpAgentService;
