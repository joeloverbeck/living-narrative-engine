/**
 * @file Health monitoring system for clothing services
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Health monitoring system for all clothing services
 * Provides health checks and status reporting
 */
export class ClothingHealthMonitor {
  #services;
  #healthChecks;
  #lastChecks;
  #logger;
  #checkInterval;
  #intervalId;

  /**
   * @param {object} services - Map of services to monitor
   * @param {object} logger - Logger instance
   * @param {number} checkInterval - Interval for automatic health checks (ms)
   */
  constructor(services, logger, checkInterval = 60000) {
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['info', 'warn', 'error', 'debug']
    });

    this.#services = services;
    this.#healthChecks = new Map();
    this.#lastChecks = new Map();
    this.#logger = logger;
    this.#checkInterval = checkInterval;
    this.#intervalId = null;
    
    this.#initializeHealthChecks();
  }

  /**
   * Perform health check for all clothing services
   * @returns {Promise<Map>} Health check results
   */
  async performHealthCheck() {
    const results = new Map();
    
    for (const [serviceName, healthCheck] of this.#healthChecks) {
      try {
        const startTime = performance.now();
        const result = await this.#performSingleHealthCheck(serviceName, healthCheck);
        const duration = performance.now() - startTime;
        
        const healthResult = {
          ...result,
          duration: `${duration.toFixed(2)}ms`,
          timestamp: new Date().toISOString()
        };
        
        results.set(serviceName, healthResult);
        this.#lastChecks.set(serviceName, healthResult);
        
        this.#logger.debug('Health check completed', {
          service: serviceName,
          healthy: result.healthy,
          duration: healthResult.duration
        });
      } catch (error) {
        const failureResult = {
          healthy: false,
          error: error.message,
          timestamp: new Date().toISOString()
        };
        results.set(serviceName, failureResult);
        this.#lastChecks.set(serviceName, failureResult);
        
        this.#logger.warn('Health check failed', {
          service: serviceName,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Get health status for specific service
   * @param {string} serviceName - Service name
   * @returns {object} Health status
   */
  getServiceHealth(serviceName) {
    return this.#lastChecks.get(serviceName) || { 
      healthy: false, 
      error: 'No health check performed',
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get overall system health
   * @returns {object} Overall health status
   */
  getOverallHealth() {
    const allChecks = Array.from(this.#lastChecks.values());
    const healthyServices = allChecks.filter(check => check.healthy);
    const unhealthyServices = allChecks.filter(check => !check.healthy);
    
    return {
      healthy: healthyServices.length === allChecks.length && allChecks.length > 0,
      totalServices: allChecks.length,
      healthyServices: healthyServices.length,
      unhealthyServices: unhealthyServices.length,
      services: {
        healthy: healthyServices.map((_, index) => 
          Array.from(this.#lastChecks.keys())[index]
        ),
        unhealthy: unhealthyServices.map((_, index) => 
          Array.from(this.#lastChecks.keys())[
            healthyServices.length + index
          ]
        )
      },
      lastCheck: new Date().toISOString()
    };
  }

  /**
   * Start automatic health checks
   */
  startMonitoring() {
    if (this.#intervalId) {
      this.#logger.warn('Health monitoring already started');
      return;
    }

    this.#intervalId = setInterval(async () => {
      await this.performHealthCheck();
    }, this.#checkInterval);

    this.#logger.info('Health monitoring started', {
      interval: `${this.#checkInterval}ms`
    });

    // Perform initial check
    this.performHealthCheck();
  }

  /**
   * Stop automatic health checks
   */
  stopMonitoring() {
    if (this.#intervalId) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
      this.#logger.info('Health monitoring stopped');
    }
  }

  /**
   * Get health report
   * @returns {object} Detailed health report
   */
  getHealthReport() {
    const overall = this.getOverallHealth();
    const services = {};

    for (const [serviceName, health] of this.#lastChecks) {
      services[serviceName] = health;
    }

    return {
      overall,
      services,
      monitoringActive: this.#intervalId !== null,
      checkInterval: this.#checkInterval,
      reportGeneratedAt: new Date().toISOString()
    };
  }

  /**
   * @description Register a custom health check
   * @param {string} serviceName - Identifier for the service
   * @param {Function} healthCheck - Async function returning health status
   * @returns {void}
   */
  registerHealthCheck(serviceName, healthCheck) {
    if (typeof serviceName !== 'string' || serviceName.trim() === '') {
      throw new TypeError('serviceName must be a non-empty string');
    }

    if (typeof healthCheck !== 'function') {
      throw new TypeError('healthCheck must be a function');
    }

    this.#healthChecks.set(serviceName, async () => healthCheck());
  }

  /**
   * Initialize health checks for services
   * @private
   */
  #initializeHealthChecks() {
    // Health check for clothing accessibility service
    if (this.#services.clothingAccessibilityService) {
      this.#healthChecks.set('ClothingAccessibilityService', async () => {
        try {
          // Try a simple operation
          const testEntityId = 'health_check_entity_' + Date.now();
          const result = this.#services.clothingAccessibilityService.getAccessibleItems(
            testEntityId, 
            { mode: 'topmost' }
          );
          
          return { 
            healthy: true, 
            response: 'OK',
            testOperation: 'getAccessibleItems'
          };
        } catch (error) {
          return {
            healthy: false,
            error: error.message
          };
        }
      });
    }

    // Health check for priority manager if available
    if (this.#services.priorityManager) {
      this.#healthChecks.set('ClothingPriorityManager', async () => {
        try {
          const priority = this.#services.priorityManager.calculatePriority(
            'base', 
            'removal'
          );
          return { 
            healthy: typeof priority === 'number',
            response: 'OK',
            samplePriority: priority
          };
        } catch (error) {
          return {
            healthy: false,
            error: error.message
          };
        }
      });
    }

    // Health check for coverage analyzer if available
    if (this.#services.coverageAnalyzer) {
      this.#healthChecks.set('CoverageAnalyzer', async () => {
        try {
          const testEntityId = 'health_check_entity_' + Date.now();
          const analysis = this.#services.coverageAnalyzer.analyzeCoverageBlocking(
            {}, 
            testEntityId
          );
          return { 
            healthy: true,
            response: 'OK',
            testOperation: 'analyzeCoverageBlocking'
          };
        } catch (error) {
          return {
            healthy: false,
            error: error.message
          };
        }
      });
    }

    // Health check for error handler if available
    if (this.#services.errorHandler) {
      this.#healthChecks.set('ClothingErrorHandler', async () => {
        try {
          const metrics = this.#services.errorHandler.getErrorMetrics();
          return { 
            healthy: true,
            response: 'OK',
            errorCount: Object.values(metrics).reduce((sum, m) => sum + (m.count || 0), 0)
          };
        } catch (error) {
          return {
            healthy: false,
            error: error.message
          };
        }
      });
    }
  }

  /**
   * Perform single health check
   * @private
   */
  async #performSingleHealthCheck(serviceName, healthCheck) {
    const result = await healthCheck();
    return {
      serviceName,
      ...result
    };
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.stopMonitoring();
    this.#healthChecks.clear();
    this.#lastChecks.clear();
  }
}

export default ClothingHealthMonitor;