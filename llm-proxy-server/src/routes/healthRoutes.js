/**
 * @file Health check routes for server availability verification
 * @description Provides endpoints for health checks, readiness checks, and server status
 */

import express from 'express';
import os from 'node:os';

import {
  createLivenessCheck,
  createReadinessCheck,
} from '../middleware/healthCheck.js';
import { ConsoleLogger } from '../consoleLogger.js';

/**
 * Creates the health routes for the proxy server.
 * @description Exposes liveness, readiness, and diagnostic endpoints that reuse the core health check middleware.
 * @param {object} dependencies - Dependencies required to build the routes.
 * @param {import('../config/llmConfigService.js').LlmConfigService} dependencies.llmConfigService - Service tracking LLM configuration readiness.
 * @param {import('../services/cacheService.js').default | null} [dependencies.cacheService] - Cache service instance, if caching is enabled.
 * @param {import('../services/httpAgentService.js').default | null} [dependencies.httpAgentService] - HTTP agent service instance, if connection pooling is enabled.
 * @param {import('../config/appConfig.js').AppConfigService} [dependencies.appConfigService] - Application configuration service for environment metadata.
 * @param {import('../consoleLogger.js').ConsoleLogger} [dependencies.logger] - Logger instance for middleware diagnostics.
 * @returns {import('express').Router} Configured health routes router.
 */
const createHealthRoutes = ({
  llmConfigService,
  cacheService = null,
  httpAgentService = null,
  appConfigService = null,
  logger = null,
} = {}) => {
  if (!llmConfigService) {
    throw new Error('createHealthRoutes: llmConfigService is required');
  }

  const router = express.Router();
  const effectiveLogger = logger ?? new ConsoleLogger();

  router.get(
    '/',
    createLivenessCheck({
      logger: effectiveLogger,
    })
  );

  router.get(
    '/ready',
    createReadinessCheck({
      logger: effectiveLogger,
      llmConfigService,
      cacheService,
      httpAgentService,
    })
  );

  router.get('/live', (req, res) => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
      pid: process.pid,
      service: 'llm-proxy-server',
    });
  });

  router.get('/detailed', (req, res) => {
    const memUsage = process.memoryUsage();
    const environmentDetails = {
      node_env:
        (appConfigService && typeof appConfigService.getNodeEnv === 'function'
          ? appConfigService.getNodeEnv()
          : process.env.NODE_ENV) || 'production',
      proxy_port: String(
        (appConfigService && typeof appConfigService.getProxyPort === 'function'
          ? appConfigService.getProxyPort()
          : process.env.PROXY_PORT) ?? ''
      ),
    };

    res.status(200).json({
      status: 'UP',
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
        load_average: os.loadavg(),
      },
      environment: environmentDetails,
    });
  });

  return router;
};

export default createHealthRoutes;
