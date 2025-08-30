/**
 * @file Health check routes for server availability verification
 * @description Provides endpoints for health checks, readiness checks, and server status
 */

import express from 'express';
import { getAppConfigService } from '../config/appConfig.js';
import { ConsoleLogger } from '../consoleLogger.js';

const router = express.Router();
const logger = new ConsoleLogger();

/**
 * GET /health
 * Basic health check endpoint - returns 200 if server is running
 */
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'llm-proxy-server',
  });
});

/**
 * GET /health/ready
 * Readiness check endpoint - returns 200 if server is ready to accept requests
 * Performs more comprehensive checks than basic health
 */
router.get('/ready', async (req, res) => {
  try {
    const appConfigService = getAppConfigService(logger);
    const checks = {
      server: 'ok',
      config: 'unknown',
      debug_logging: 'unknown',
    };

    // Check configuration service
    try {
      const port = appConfigService.getProxyPort();
      const corsOrigins = appConfigService.getProxyAllowedOrigin();

      checks.config = port && corsOrigins ? 'ok' : 'degraded';
    } catch (configError) {
      checks.config = 'error';
    }

    // Check debug logging availability
    checks.debug_logging = appConfigService.isDebugLoggingEnabled()
      ? 'ok'
      : 'disabled';

    const allHealthy = Object.values(checks).every(
      (status) => status === 'ok' || status === 'disabled'
    );

    const statusCode = allHealthy ? 200 : 503;

    res.status(statusCode).json({
      status: allHealthy ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      service: 'llm-proxy-server',
      checks,
    });
  } catch (error) {
    logger.error('Health check error:', error.message);

    res.status(503).json({
      status: 'not_ready',
      timestamp: new Date().toISOString(),
      service: 'llm-proxy-server',
      error: 'Health check failed',
      checks: {
        server: 'error',
      },
    });
  }
});

/**
 * GET /health/live
 * Liveness check endpoint - returns 200 if server is alive (not crashed)
 * This is the most basic check, just verifies the process is running
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    pid: process.pid,
    service: 'llm-proxy-server',
  });
});

/**
 * GET /health/detailed
 * Detailed health information including system metrics
 */
router.get('/detailed', (req, res) => {
  const memUsage = process.memoryUsage();

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: 'llm-proxy-server',
    system: {
      node_version: process.version,
      platform: process.platform,
      arch: process.arch,
      memory: {
        rss: memUsage.rss,
        heap_used: memUsage.heapUsed,
        heap_total: memUsage.heapTotal,
        external: memUsage.external,
      },
      load_average: require('os').loadavg(),
    },
    environment: {
      node_env: process.env.NODE_ENV,
      proxy_port: process.env.PROXY_PORT,
    },
  });
});

export default router;
