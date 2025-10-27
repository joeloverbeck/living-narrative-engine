// llm-proxy-server/src/core/server.js

import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { pathToFileURL } from 'node:url';

import { getAppConfigService } from '../config/appConfig.js';
import { createSecurityMiddleware } from '../middleware/security.js';
import {
  createApiRateLimiter,
  createLlmRateLimiter,
} from '../middleware/rateLimiting.js';
import {
  validateLlmRequest,
  validateRequestHeaders,
  handleValidationErrors,
} from '../middleware/validation.js';
import {
  createTimeoutMiddleware,
  createSizeLimitConfig,
} from '../middleware/timeout.js';
import MetricsService from '../services/metricsService.js';
import {
  createMetricsMiddleware,
  createLlmMetricsMiddleware,
} from '../middleware/metrics.js';
import { createRequestTrackingMiddleware } from '../middleware/requestTracking.js';
import { NodeFileSystemReader } from '../nodeFileSystemReader.js';
import { ConsoleLogger } from '../consoleLogger.js';
import { LlmConfigService } from '../config/llmConfigService.js';
import { ApiKeyService } from '../services/apiKeyService.js';
import { LlmRequestService } from '../services/llmRequestService.js';
import { LlmRequestController } from '../handlers/llmRequestController.js';
import CacheService from '../services/cacheService.js';
import HttpAgentService from '../services/httpAgentService.js';
import { RetryManager } from '../utils/proxyApiUtils.js';
import ResponseSalvageService from '../services/responseSalvageService.js';
import SalvageRequestController from '../handlers/salvageRequestController.js';
import createSalvageRoutes from '../routes/salvageRoutes.js';
import { sendProxyError } from '../utils/responseUtils.js';
import {
  HTTP_HEADER_CONTENT_TYPE,
  HTTP_METHOD_POST,
  HTTP_METHOD_OPTIONS,
  LOG_LLM_ID_UNHANDLED_ERROR,
  LOG_LLM_ID_PROXY_NOT_OPERATIONAL,
} from '../config/constants.js';
import traceRoutes from '../routes/traceRoutes.js';
import createHealthRoutes from '../routes/healthRoutes.js';

const shutdownSignals = ['SIGTERM', 'SIGINT', 'SIGHUP'];

/**
 * @typedef {object} ProxyServerOptions
 * @description Configuration options for creating a proxy server instance.
 * @property {import('../consoleLogger.js').ConsoleLogger} [logger] - Optional custom logger instance.
 * @property {boolean} [metricsEnabled] - Forces metrics collection on/off regardless of environment variables.
 * @property {boolean} [collectDefaultMetrics] - Forces collection of default Node metrics on/off.
 * @property {boolean} [rateLimitingEnabled] - Forces rate limiting middleware on/off.
 */

/**
 * @typedef {object} ProxyServerController
 * @description Controller object returned by {@link createProxyServer}.
 * @property {import('express').Express} app - Express application instance.
 * @property {() => Promise<void>} start - Starts the HTTP server.
 * @property {() => Promise<void>} stop - Stops the HTTP server and cleans up resources.
 * @property {number} port - Port number configured for the proxy.
 * @property {ConsoleLogger} logger - Logger instance used by the server.
 */

/**
 * Creates a configurable proxy server instance for use in production or tests.
 * @param {ProxyServerOptions} [options] - Optional configuration overrides.
 * @returns {ProxyServerController} Proxy server controller with lifecycle helpers.
 */
export function createProxyServer(options = {}) {
  const {
    logger: providedLogger,
    metricsEnabled,
    collectDefaultMetrics,
    rateLimitingEnabled,
  } = options;

  const proxyLogger = providedLogger ?? new ConsoleLogger();
  const appConfigService = getAppConfigService(proxyLogger);

  const resolvedMetricsEnabled =
    metricsEnabled ?? process.env.METRICS_ENABLED !== 'false';
  const resolvedCollectDefaultMetrics =
    collectDefaultMetrics ?? process.env.METRICS_COLLECT_DEFAULT !== 'false';
  const resolvedRateLimitingEnabled =
    rateLimitingEnabled ?? process.env.RATE_LIMITING_ENABLED !== 'false';

  const metricsService = new MetricsService({
    logger: proxyLogger,
    enabled: resolvedMetricsEnabled,
    collectDefaultMetrics: resolvedCollectDefaultMetrics,
  });

  const app = express();

  app.use(createSecurityMiddleware());
  app.use(createRequestTrackingMiddleware({ logger: proxyLogger }));

  app.use(
    createMetricsMiddleware({
      metricsService,
      logger: proxyLogger,
      enabled: metricsService.isEnabled(),
    })
  );

  app.use(compression());

  if (resolvedRateLimitingEnabled) {
    app.use(createApiRateLimiter());
  }

  app.use((req, res, next) => {
    if (
      req.path === '/api/llm-request' ||
      req.path.startsWith('/api/llm-request/salvage')
    ) {
      return next();
    }
    return createTimeoutMiddleware(30000, { logger: proxyLogger })(
      req,
      res,
      next
    );
  });

  const allowedOriginsArray = appConfigService.getAllowedOriginsArray();

  const resolvedNodeEnv = (() => {
    const envFromService =
      typeof appConfigService.getNodeEnv === 'function'
        ? appConfigService.getNodeEnv()
        : process.env.NODE_ENV;
    if (typeof envFromService !== 'string') {
      return 'production';
    }
    const trimmed = envFromService.trim().toLowerCase();
    return trimmed === '' ? 'production' : trimmed;
  })();

  const isDevelopmentLikeEnv =
    resolvedNodeEnv === 'development' || resolvedNodeEnv === 'test';

  if (allowedOriginsArray.length > 0) {
    proxyLogger.info(
      `LLM Proxy Server: Configuring CORS for ${allowedOriginsArray.length} origin(s)`
    );
    proxyLogger.debug('CORS allowed origins:', { origins: allowedOriginsArray });

    const corsOptions = {
      origin: allowedOriginsArray,
      methods: [HTTP_METHOD_POST, HTTP_METHOD_OPTIONS],
      allowedHeaders: [HTTP_HEADER_CONTENT_TYPE, 'X-Title', 'HTTP-Referer'],
    };
    app.use(cors(corsOptions));
    proxyLogger.debug('CORS middleware applied successfully');
  } else if (isDevelopmentLikeEnv) {
    proxyLogger.warn(
      `LLM Proxy Server: CORS not configured in development mode (current environment: ${resolvedNodeEnv}). ` +
        'To enable browser access, set PROXY_ALLOWED_ORIGIN environment variable. ' +
        'Example: PROXY_ALLOWED_ORIGIN="http://localhost:8080,http://127.0.0.1:8080"'
    );
  } else {
    proxyLogger.warn(
      'LLM Proxy Server: PROXY_ALLOWED_ORIGIN environment variable not set or empty. ' +
        'CORS will not be configured. This may cause issues with browser-based clients.'
    );
  }

  const sizeLimits = createSizeLimitConfig();
  app.use(express.json(sizeLimits.json));

  const PORT = appConfigService.getProxyPort();

  const fileSystemReader = new NodeFileSystemReader();
  const llmConfigService = new LlmConfigService(
    fileSystemReader,
    proxyLogger,
    appConfigService
  );

  const cacheConfig = appConfigService.getCacheConfig();
  const cacheService = new CacheService(proxyLogger, {
    maxSize: cacheConfig.maxSize,
    defaultTtl: cacheConfig.defaultTtl,
  });

  const httpAgentConfig = appConfigService.getHttpAgentConfig();
  const httpAgentService = new HttpAgentService(proxyLogger, httpAgentConfig);

  const apiKeyService = new ApiKeyService(
    proxyLogger,
    fileSystemReader,
    appConfigService,
    cacheService
  );

  const llmRequestService = new LlmRequestService(
    proxyLogger,
    httpAgentService,
    appConfigService,
    RetryManager
  );

  const salvageConfig = appConfigService.getSalvageConfig();
  const salvageService = new ResponseSalvageService(proxyLogger, salvageConfig);

  const llmRequestController = new LlmRequestController(
    proxyLogger,
    llmConfigService,
    apiKeyService,
    llmRequestService,
    salvageService
  );

  const salvageController = new SalvageRequestController(
    proxyLogger,
    salvageService
  );

  app.get('/metrics', async (req, res) => {
    try {
      const metrics = await metricsService.getMetrics();
      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.status(200).send(metrics);
    } catch (error) {
      proxyLogger.error('Error serving metrics endpoint', error);
      res.status(500).send('Error retrieving metrics');
    }
  });

  app.get('/', (req, res) => {
    proxyLogger.warn(
      'Deprecated root endpoint accessed. Use /health or /health/ready instead.'
    );
    if (!llmConfigService.isOperational()) {
      const initErrorDetails = llmConfigService.getInitializationErrorDetails();
      if (initErrorDetails) {
        sendProxyError(
          res,
          503,
          initErrorDetails.stage || 'initialization_failure',
          `LLM Proxy Server is NOT OPERATIONAL. Failed to initialize LLM configurations. Error stage: ${initErrorDetails.stage}. Message: ${initErrorDetails.message}. Path attempted: ${initErrorDetails.pathAttempted}`,
          initErrorDetails,
          LOG_LLM_ID_PROXY_NOT_OPERATIONAL,
          proxyLogger
        );
      } else {
        sendProxyError(
          res,
          503,
          'initialization_failure_unknown',
          'LLM Proxy Server is NOT OPERATIONAL due to unknown configuration issues.',
          {},
          LOG_LLM_ID_PROXY_NOT_OPERATIONAL,
          proxyLogger
        );
      }
      return;
    }
    res
      .status(200)
      .send(
        'LLM Proxy Server is running and operational! Use /health or /health/ready for detailed health checks.'
      );
  });

  app.post(
    '/api/llm-request',
    createTimeoutMiddleware(120000, { logger: proxyLogger, gracePeriod: 10000 }),
    resolvedRateLimitingEnabled ? createLlmRateLimiter() : (_req, _res, next) => next(),
    createLlmMetricsMiddleware({ metricsService, logger: proxyLogger }),
    validateRequestHeaders(),
    validateLlmRequest(),
    handleValidationErrors,
    (req, res) => llmRequestController.handleLlmRequest(req, res)
  );

  app.use('/api/llm-request', createSalvageRoutes(salvageController));
  app.use('/api/traces', traceRoutes);
  app.use(
    '/health',
    createHealthRoutes({
      logger: proxyLogger,
      llmConfigService,
      cacheService,
      httpAgentService,
      appConfigService,
    })
  );

  let server = null;
  let isShuttingDown = false;
  const registeredSignalHandlers = new Map();
  let beforeExitHandler = null;

  const cleanupServices = () => {
    if (salvageService && typeof salvageService.cleanup === 'function') {
      salvageService.cleanup();
      proxyLogger.info('LLM Proxy Server: Response salvage service cleaned up');
    }

    if (httpAgentService && typeof httpAgentService.cleanup === 'function') {
      httpAgentService.cleanup();
      proxyLogger.info('LLM Proxy Server: HTTP agent service cleaned up');
    }

    if (cacheService && typeof cacheService.cleanup === 'function') {
      cacheService.cleanup();
      proxyLogger.info('LLM Proxy Server: Cache service cleaned up');
    }

    if (metricsService && typeof metricsService.clear === 'function') {
      metricsService.clear();
      proxyLogger.info('LLM Proxy Server: Metrics service cleaned up');
    }
  };

  const removeShutdownHandlers = () => {
    for (const [signal, handler] of registeredSignalHandlers.entries()) {
      process.off(signal, handler);
    }
    registeredSignalHandlers.clear();

    if (beforeExitHandler) {
      process.off('beforeExit', beforeExitHandler);
      beforeExitHandler = null;
    }
  };

  const stop = async () => {
    if (!server) {
      return;
    }

    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });

    cleanupServices();
    removeShutdownHandlers();
    server = null;
    isShuttingDown = false;
  };

  const gracefulShutdown = async (signal) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    proxyLogger.info(
      `LLM Proxy Server: Received ${signal}, starting graceful shutdown...`
    );

    try {
      await stop();
      proxyLogger.info('LLM Proxy Server: Graceful shutdown complete');
      if (process.env.NODE_ENV !== 'test') {
        process.exit(0);
      }
    } catch (error) {
      proxyLogger.error('LLM Proxy Server: Error during shutdown', error);
      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
    }
  };

  const registerShutdownHandlers = () => {
    for (const signal of shutdownSignals) {
      const handler = () => {
        void gracefulShutdown(signal);
      };
      registeredSignalHandlers.set(signal, handler);
      process.on(signal, handler);
    }

    beforeExitHandler = () => {
      proxyLogger.debug(
        'LLM Proxy Server: Graceful beforeExit handler completed'
      );
    };
    process.on('beforeExit', beforeExitHandler);
  };

  const start = async () => {
    if (server) {
      return;
    }

    await llmConfigService.initialize();

    await new Promise((resolve, reject) => {
      server = app
        .listen(PORT, '0.0.0.0', () => {
          proxyLogger.info('--- LLM Proxy Server Startup Summary ---');
          proxyLogger.info(`LLM Proxy Server listening on port ${PORT}`);
          proxyLogger.info(
            `LLM Proxy Server: Binding to 0.0.0.0:${PORT} (accessible via localhost:${PORT} and 127.0.0.1:${PORT})`
          );

          if (appConfigService.isProxyPortDefaulted()) {
            proxyLogger.info(
              `(Note: PROXY_PORT environment variable was not set or invalid, using default.)`
            );
          }

          const resolvedLlmConfigPath =
            llmConfigService.getResolvedConfigPath();
          if (resolvedLlmConfigPath) {
            proxyLogger.info(
              `LLM configurations loaded from: ${resolvedLlmConfigPath}`
            );
          } else {
            proxyLogger.warn(
              `LLM configurations path could not be determined.`
            );
          }

          if (llmConfigService.isOperational()) {
            const llmConfigs = llmConfigService.getLlmConfigs();
            let numLlmConfigs = 0;
            if (llmConfigs && llmConfigs.configs) {
              numLlmConfigs = Object.keys(llmConfigs.configs).length;
            }
            proxyLogger.info(
              `LLM Proxy Server: Successfully loaded ${numLlmConfigs} LLM configurations. Proxy is OPERATIONAL.`
            );
          } else {
            const errorDetails =
              llmConfigService.getInitializationErrorDetails();
            proxyLogger.error(
              `LLM Proxy Server: CRITICAL - Failed to initialize LLM configurations. Proxy is NOT OPERATIONAL.`
            );
            if (errorDetails && errorDetails.message) {
              proxyLogger.error(`   Reason: ${errorDetails.message}`);
            } else {
              proxyLogger.error(`   Reason: Unknown initialization error.`);
            }
          }

          const proxyAllowedOrigin = appConfigService.getProxyAllowedOrigin();
          if (proxyAllowedOrigin && proxyAllowedOrigin.trim() !== '') {
            proxyLogger.info(
              `LLM Proxy Server: CORS enabled for origin(s): ${proxyAllowedOrigin}`
            );
          } else {
            proxyLogger.info(
              `LLM Proxy Server: PROXY_ALLOWED_ORIGIN not set, CORS is not specifically configured (default browser policies apply).`
            );
          }

          const apiKeyFileRootPath =
            appConfigService.getProxyProjectRootPathForApiKeyFiles();
          if (apiKeyFileRootPath && apiKeyFileRootPath.trim() !== '') {
            proxyLogger.info(
              `LLM Proxy Server: API Key file root path set to: '${apiKeyFileRootPath}'.`
            );
          } else if (
            llmConfigService.isOperational() &&
            llmConfigService.hasFileBasedApiKeys()
          ) {
            proxyLogger.warn(
              `LLM Proxy Server: WARNING - PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES is NOT SET. File-based API key retrieval WILL FAIL for configured LLMs that use apiKeyFileName.`
            );
          } else {
            proxyLogger.info(
              `LLM Proxy Server: PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES is not set (this may be fine if no LLMs use file-based API keys or if config failed to load).`
            );
          }

          if (appConfigService.isCacheEnabled()) {
            const cacheConfiguration = appConfigService.getCacheConfig();
            proxyLogger.info(
              `LLM Proxy Server: Cache ENABLED - TTL: ${cacheConfiguration.defaultTtl}ms, Max Size: ${cacheConfiguration.maxSize} entries, API Key TTL: ${cacheConfiguration.apiKeyCacheTtl}ms`
            );
          } else {
            proxyLogger.info(
              `LLM Proxy Server: Cache DISABLED - API keys will be read from source on every request`
            );
          }

          const salvageSummary = appConfigService.getSalvageConfig();
          proxyLogger.info(
            `LLM Proxy Server: Response Salvage ENABLED - TTL: ${salvageSummary.defaultTtl}ms, Max Entries: ${salvageSummary.maxEntries}`
          );

          if (appConfigService.isHttpAgentEnabled()) {
            const httpAgentSummary = appConfigService.getHttpAgentConfig();
            proxyLogger.info(
              `LLM Proxy Server: HTTP Agent Pooling ENABLED - Keep-Alive: ${httpAgentSummary.keepAlive}, Max Sockets: ${httpAgentSummary.maxSockets}, Timeout: ${httpAgentSummary.timeout}ms`
            );
          } else {
            proxyLogger.info(
              `LLM Proxy Server: HTTP Agent Pooling DISABLED - New connections will be created for each request`
            );
          }

          if (metricsService.isEnabled()) {
            const metricsStats = metricsService.getStats();
            proxyLogger.info(
              `LLM Proxy Server: Metrics Collection ENABLED - Total metrics: ${metricsStats.totalMetrics}, Custom metrics: ${metricsStats.customMetrics}, Default metrics: ${metricsStats.defaultMetrics}. Prometheus endpoint available at /metrics`
            );
          } else {
            proxyLogger.info(
              `LLM Proxy Server: Metrics Collection DISABLED - Set METRICS_ENABLED=true to enable observability metrics`
            );
          }

          const reason =
            process.env.NODE_ENV === 'test'
              ? 'test environment'
              : 'debug logging disabled';
          proxyLogger.info(
            `LLM Proxy Server: Log Maintenance Scheduler NOT INITIALIZED (${reason})`
          );

          proxyLogger.info('--- End of Startup Summary ---');
          resolve();
        })
        .on('error', (error) => {
          proxyLogger.error(
            'LLM Proxy Server: A critical error occurred during asynchronous server startup sequence PRIOR to app.listen.',
            error
          );
          proxyLogger.error(
            'LLM Proxy Server: CRITICAL - Proxy will NOT be operational due to a severe error during startup initialization steps.'
          );
          reject(error);
        });
    });

    registerShutdownHandlers();
  };

  app.use((err, req, res, next) => {
    proxyLogger.error('Global Error Handler: Unhandled error caught!', {
      errorMessage: err.message,
      errorStack: err.stack,
      requestOriginalUrl: req.originalUrl,
      requestMethod: req.method,
      caughtErrorObject: err,
    });

    if (res.headersSent) {
      proxyLogger.warn(
        "Global Error Handler: Headers already sent for this request. Delegating to Express's default error handler.",
        {
          originalErrorMessage: err.message,
          requestOriginalUrl: req.originalUrl,
          requestMethod: req.method,
        }
      );
      return next(err);
    }

    let httpStatusCodeToSend = 500;
    const errorDefinedStatusCode = err.status || err.statusCode;

    if (
      errorDefinedStatusCode &&
      Number.isInteger(errorDefinedStatusCode) &&
      errorDefinedStatusCode >= 400 &&
      errorDefinedStatusCode < 600
    ) {
      httpStatusCodeToSend = errorDefinedStatusCode;
    }

    sendProxyError(
      res,
      httpStatusCodeToSend,
      'internal_proxy_unhandled_error',
      'An unexpected internal server error occurred in the proxy.',
      { originalErrorMessage: err.message },
      LOG_LLM_ID_UNHANDLED_ERROR,
      proxyLogger
    );
  });

  return {
    app,
    start,
    stop,
    port: PORT,
    logger: proxyLogger,
  };
}

export default createProxyServer;

const isMainModule =
  process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) {
  const run = async () => {
    const serverController = createProxyServer();
    await serverController.start();
  };

  run().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('LLM Proxy Server failed to start', error);
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
  });
}
