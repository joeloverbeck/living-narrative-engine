/**
 * @file Health check middleware for production readiness monitoring
 * @see https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
 */

import { performance } from 'perf_hooks';

/**
 * Health check response structure
 * @typedef {object} HealthCheckResponse
 * @property {string} status - Health status (UP, DOWN, OUT_OF_SERVICE)
 * @property {number} timestamp - ISO timestamp of check
 * @property {string} version - Application version
 * @property {object} details - Additional health information
 */

/**
 * Dependency check result
 * @typedef {object} DependencyCheck
 * @property {string} name - Dependency name
 * @property {string} status - Dependency status
 * @property {object} details - Additional dependency information
 */

/**
 * Creates basic liveness health check endpoint
 * @param {object} dependencies - Service dependencies
 * @param {object} dependencies.logger - Logger instance
 * @returns {Function} Express middleware for /health endpoint
 */
export const createLivenessCheck = ({ logger }) => {
  return (req, res) => {
    const startTime = performance.now();

    try {
      const response = {
        status: 'UP',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        details: {
          uptime: Math.floor(process.uptime()),
          memory: {
            used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
            total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
            external: Math.round(process.memoryUsage().external / 1024 / 1024),
          },
          responseTime: Math.round((performance.now() - startTime) * 100) / 100,
        },
      };

      logger.debug('Health check (liveness) completed', {
        status: response.status,
        responseTime: response.details.responseTime,
        memoryUsed: response.details.memory.used,
      });

      res.status(200).json(response);
    } catch (error) {
      logger.error('Health check (liveness) failed', error);

      res.status(503).json({
        status: 'DOWN',
        timestamp: new Date().toISOString(),
        error: {
          message: 'Health check failed',
          details: error.message,
        },
      });
    }
  };
};

/**
 * Creates comprehensive readiness health check endpoint with dependency validation
 * @param {object} dependencies - Service dependencies
 * @param {object} dependencies.logger - Logger instance
 * @param {object} dependencies.llmConfigService - LLM configuration service
 * @param {object} dependencies.cacheService - Cache service (optional)
 * @param {object} dependencies.httpAgentService - HTTP agent service (optional)
 * @returns {Function} Express middleware for /health/ready endpoint
 */
export const createReadinessCheck = ({
  logger,
  llmConfigService,
  cacheService = null,
  httpAgentService = null,
}) => {
  return async (req, res) => {
    const startTime = performance.now();
    let overallStatus = 'UP';
    const checks = [];

    try {
      // Check LLM Configuration Service
      const llmConfigCheck = await checkLlmConfigService(llmConfigService);
      checks.push(llmConfigCheck);
      if (llmConfigCheck.status === 'DOWN') {
        overallStatus = 'DOWN';
      }

      // Check Cache Service if available
      if (cacheService) {
        const cacheCheck = await checkCacheService(cacheService);
        checks.push(cacheCheck);
        if (cacheCheck.status === 'DOWN' && overallStatus !== 'DOWN') {
          overallStatus = 'OUT_OF_SERVICE'; // Non-critical but degraded
        }
      }

      // Check HTTP Agent Service if available
      if (httpAgentService) {
        const httpAgentCheck = await checkHttpAgentService(httpAgentService);
        checks.push(httpAgentCheck);
        if (httpAgentCheck.status === 'DOWN' && overallStatus !== 'DOWN') {
          overallStatus = 'OUT_OF_SERVICE'; // Non-critical but degraded
        }
      }

      // Check Node.js process health
      const processCheck = checkProcessHealth();
      checks.push(processCheck);
      if (processCheck.status === 'DOWN') {
        overallStatus = 'DOWN';
      }

      const responseTime =
        Math.round((performance.now() - startTime) * 100) / 100;

      const response = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        details: {
          responseTime,
          dependencies: checks,
          summary: {
            total: checks.length,
            up: checks.filter((c) => c.status === 'UP').length,
            down: checks.filter((c) => c.status === 'DOWN').length,
          },
        },
      };

      const statusCode = overallStatus === 'UP' ? 200 : 503;

      logger.info('Health check (readiness) completed', {
        status: overallStatus,
        statusCode,
        responseTime,
        dependenciesChecked: checks.length,
        upDependencies: response.details.summary.up,
        downDependencies: response.details.summary.down,
      });

      res.status(statusCode).json(response);
    } catch (error) {
      logger.error('Health check (readiness) failed with exception', error);

      res.status(503).json({
        status: 'DOWN',
        timestamp: new Date().toISOString(),
        error: {
          message: 'Readiness check failed',
          details: error.message,
        },
        details: {
          responseTime: Math.round((performance.now() - startTime) * 100) / 100,
        },
      });
    }
  };
};

/**
 * Checks LLM Configuration Service health
 * @param {object} llmConfigService - LLM configuration service instance
 * @returns {Promise<DependencyCheck>} Check result
 */
async function checkLlmConfigService(llmConfigService) {
  try {
    const isOperational = llmConfigService.isOperational();
    const llmConfigs = llmConfigService.getLlmConfigs();

    if (!isOperational) {
      const errorDetails = llmConfigService.getInitializationErrorDetails();
      return {
        name: 'llmConfigService',
        status: 'DOWN',
        details: {
          operational: false,
          error: errorDetails?.message || 'Service not operational',
          stage: errorDetails?.stage || 'unknown',
        },
      };
    }

    const configCount = llmConfigs?.llms
      ? Object.keys(llmConfigs.llms).length
      : 0;

    return {
      name: 'llmConfigService',
      status: 'UP',
      details: {
        operational: true,
        configuredLlms: configCount,
        defaultLlm: llmConfigs?.defaultLlmId || null,
        configPath: llmConfigService.getResolvedConfigPath(),
      },
    };
  } catch (error) {
    return {
      name: 'llmConfigService',
      status: 'DOWN',
      details: {
        error: error.message,
        operational: false,
      },
    };
  }
}

/**
 * Checks Cache Service health
 * @param {object} cacheService - Cache service instance
 * @returns {Promise<DependencyCheck>} Check result
 */
async function checkCacheService(cacheService) {
  try {
    // Attempt a basic cache operation
    const testKey = '__health_check_test__';
    const testValue = { timestamp: Date.now() };

    cacheService.set(testKey, testValue, 1000); // 1 second TTL
    const retrieved = cacheService.get(testKey);
    cacheService.delete(testKey); // Clean up

    const isWorking = retrieved && retrieved.timestamp === testValue.timestamp;

    return {
      name: 'cacheService',
      status: isWorking ? 'UP' : 'DOWN',
      details: {
        working: isWorking,
        size: cacheService.size(),
        memoryUsage: cacheService.getMemoryUsage
          ? cacheService.getMemoryUsage()
          : null,
      },
    };
  } catch (error) {
    return {
      name: 'cacheService',
      status: 'DOWN',
      details: {
        error: error.message,
        working: false,
      },
    };
  }
}

/**
 * Checks HTTP Agent Service health
 * @param {object} httpAgentService - HTTP agent service instance
 * @returns {Promise<DependencyCheck>} Check result
 */
async function checkHttpAgentService(httpAgentService) {
  try {
    // Check if service has required methods and is functioning
    const hasRequiredMethods =
      typeof httpAgentService.getAgent === 'function' &&
      typeof httpAgentService.cleanup === 'function';

    if (!hasRequiredMethods) {
      return {
        name: 'httpAgentService',
        status: 'DOWN',
        details: {
          error: 'Missing required methods',
          working: false,
        },
      };
    }

    // Get basic service statistics if available
    const stats = httpAgentService.getStats
      ? httpAgentService.getStats()
      : null;

    return {
      name: 'httpAgentService',
      status: 'UP',
      details: {
        working: true,
        agentCount: stats?.activeAgents || null,
        totalRequests: stats?.totalRequests || null,
        memoryUsage: stats?.memoryUsage || null,
      },
    };
  } catch (error) {
    return {
      name: 'httpAgentService',
      status: 'DOWN',
      details: {
        error: error.message,
        working: false,
      },
    };
  }
}

/**
 * Checks Node.js process health indicators
 * @returns {DependencyCheck} Check result
 */
function checkProcessHealth() {
  try {
    const memoryUsage = process.memoryUsage();
    const memoryUsedMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    const memoryTotalMB = Math.round(memoryUsage.heapTotal / 1024 / 1024);
    const memoryUsagePercent = Math.round((memoryUsedMB / memoryTotalMB) * 100);

    // Consider process unhealthy if memory usage is > 90%
    const isHealthy = memoryUsagePercent < 90;

    return {
      name: 'nodeProcess',
      status: isHealthy ? 'UP' : 'DOWN',
      details: {
        uptime: Math.floor(process.uptime()),
        memoryUsage: {
          used: memoryUsedMB,
          total: memoryTotalMB,
          percentage: memoryUsagePercent,
          external: Math.round(memoryUsage.external / 1024 / 1024),
          rss: Math.round(memoryUsage.rss / 1024 / 1024),
        },
        nodeVersion: process.version,
        platform: process.platform,
        cpuUsage: process.cpuUsage(),
      },
    };
  } catch (error) {
    return {
      name: 'nodeProcess',
      status: 'DOWN',
      details: {
        error: error.message,
      },
    };
  }
}
