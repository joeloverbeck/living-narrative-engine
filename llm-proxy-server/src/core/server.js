// llm-proxy-server/src/core/server.js

// Import necessary modules
import express from 'express';
import cors from 'cors';

import { getAppConfigService } from '../config/appConfig.js';

import { NodeFileSystemReader } from '../nodeFileSystemReader.js';
import { ConsoleLogger } from '../consoleLogger.js';

import { LlmConfigService } from '../config/llmConfigService.js';
import { ApiKeyService } from '../services/apiKeyService.js';
import { LlmRequestService } from '../services/llmRequestService.js';
import { LlmRequestController } from '../handlers/llmRequestController.js';
// Import sendProxyError utility
import { sendProxyError } from '../utils/responseUtils.js';
import {
  HTTP_HEADER_CONTENT_TYPE,
  HTTP_METHOD_POST,
  HTTP_METHOD_OPTIONS,
  LOG_LLM_ID_UNHANDLED_ERROR,
  LOG_LLM_ID_PROXY_NOT_OPERATIONAL,
} from '../config/constants.js';

// Initialize Logger
const proxyLogger = new ConsoleLogger();

// Initialize AppConfigService
// This will log AppConfigService's own initialization messages.
const appConfigService = getAppConfigService(proxyLogger);

// Initialize the Express application
const app = express();

// CORS Configuration - This initial log is now covered by the summary log.
// const PROXY_ALLOWED_ORIGIN_CONFIG = appConfigService.getProxyAllowedOrigin();
const allowedOriginsArray = appConfigService.getAllowedOriginsArray();

if (allowedOriginsArray.length > 0) {
  // proxyLogger.info(`LLM Proxy Server: CORS will be enabled for origin(s): ${PROXY_ALLOWED_ORIGIN_CONFIG}`); // Removed, will be in summary
  const corsOptions = {
    origin: allowedOriginsArray,
    methods: [HTTP_METHOD_POST, HTTP_METHOD_OPTIONS],
    allowedHeaders: [HTTP_HEADER_CONTENT_TYPE, 'X-Title', 'HTTP-Referer'],
  };
  app.use(cors(corsOptions));
} else {
  // proxyLogger.warn('LLM Proxy Server: PROXY_ALLOWED_ORIGIN environment variable not set or empty. CORS will not be specifically configured.'); // Removed, will be in summary
}

// Middleware to parse JSON bodies
app.use(express.json());

// Define the port for the server using AppConfigService
const PORT = appConfigService.getProxyPort();

const fileSystemReader = new NodeFileSystemReader();

// Initialize LlmConfigService
// LlmConfigService's initialize() method will log its own progress.
const llmConfigService = new LlmConfigService(
  fileSystemReader,
  proxyLogger,
  appConfigService
);

// Initialize ApiKeyService
const apiKeyService = new ApiKeyService(
  proxyLogger,
  fileSystemReader,
  appConfigService
);

// Initialize LlmRequestService
const llmRequestService = new LlmRequestService(proxyLogger);

// PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES logging - Removed initial log, will be in summary
// const PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES = appConfigService.getProxyProjectRootPathForApiKeyFiles();
// if (PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES) {
//     proxyLogger.info(`LLM Proxy Server: Using PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES: '${PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES}'. This will be used by ApiKeyService for API key file retrieval.`);
// } else {
//     proxyLogger.warn('LLM Proxy Server: PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES is not set. API key retrieval from files will not be possible if configured for any LLM (ApiKeyService will handle errors if attempted).');
// }

// Instantiate LlmRequestController
const llmRequestController = new LlmRequestController(
  proxyLogger,
  llmConfigService,
  apiKeyService,
  llmRequestService
);

app.get('/', (req, res) => {
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
  res.status(200).send('LLM Proxy Server is running and operational!');
});

// Updated route to use LlmRequestController's handleLlmRequest method
app.post('/api/llm-request', (req, res) =>
  llmRequestController.handleLlmRequest(req, res)
);

// Asynchronous IIFE for server startup
(async () => {
  // LlmConfigService.initialize() is called here.
  // It will produce its own logs regarding loading llm-configs.json (path, success/failure, counts, default ID etc.)
  // as per AC3.
  // proxyLogger.info('LLM Proxy Server: Initializing LlmConfigService...'); // This is redundant as LlmConfigService logs its own start.
  await llmConfigService.initialize();

  app.listen(PORT, () => {
    proxyLogger.info('--- LLM Proxy Server Startup Summary ---');
    // AC 4.a: Message: LLM Proxy Server listening on port [PORT]
    proxyLogger.info(`LLM Proxy Server listening on port ${PORT}`);

    // AC 4.a: Default Port Usage Note
    // Using appConfigService.isProxyPortDefaulted() which was added in appConfig.js
    if (appConfigService.isProxyPortDefaulted()) {
      proxyLogger.info(
        `(Note: PROXY_PORT environment variable was not set or invalid, using default.)`
      );
    }

    // AC 4.b: Message: LLM configurations loaded from: [resolved_path_to_llm-configs.json]
    const resolvedLlmConfigPath = llmConfigService.getResolvedConfigPath();
    if (resolvedLlmConfigPath) {
      proxyLogger.info(
        `LLM configurations loaded from: ${resolvedLlmConfigPath}`
      );
    } else {
      proxyLogger.warn(`LLM configurations path could not be determined.`); // Should not happen if initialize was called
    }

    // AC 4.c: Operational Status
    if (llmConfigService.isOperational()) {
      const llmConfigs = llmConfigService.getLlmConfigs(); // llmConfigs will not be null if operational
      let numLlmConfigs = 0;
      if (llmConfigs && llmConfigs.llms) {
        numLlmConfigs = Object.keys(llmConfigs.llms).length;
      }
      proxyLogger.info(
        `LLM Proxy Server: Successfully loaded ${numLlmConfigs} LLM configurations. Proxy is OPERATIONAL.`
      );
      // Note: LlmConfigService itself logs the default LLM ID as per AC 3.b, so not repeated here to avoid redundancy.
    } else {
      const errorDetails = llmConfigService.getInitializationErrorDetails();
      proxyLogger.error(
        `LLM Proxy Server: CRITICAL - Failed to initialize LLM configurations. Proxy is NOT OPERATIONAL.`
      );
      if (errorDetails && errorDetails.message) {
        proxyLogger.error(`   Reason: ${errorDetails.message}`);
      } else {
        proxyLogger.error(`   Reason: Unknown initialization error.`);
      }
      // Further details (stage, path) are logged by LlmConfigService itself.
    }

    // AC 4.d: CORS Configuration
    const proxyAllowedOrigin = appConfigService.getProxyAllowedOrigin(); // Get the raw env value
    if (proxyAllowedOrigin && proxyAllowedOrigin.trim() !== '') {
      proxyLogger.info(
        `LLM Proxy Server: CORS enabled for origin(s): ${proxyAllowedOrigin}`
      );
    } else {
      proxyLogger.info(
        `LLM Proxy Server: PROXY_ALLOWED_ORIGIN not set, CORS is not specifically configured (default browser policies apply).`
      );
    }

    // AC 4.e: PROXY_PROJECT_ROOT_PATH_FOR_API_KEY_FILES Status
    const apiKeyFileRootPath =
      appConfigService.getProxyProjectRootPathForApiKeyFiles();
    if (apiKeyFileRootPath && apiKeyFileRootPath.trim() !== '') {
      proxyLogger.info(
        `LLM Proxy Server: API Key file root path set to: '${apiKeyFileRootPath}'.`
      );
    } else {
      if (
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
    }
    proxyLogger.info('--- End of Startup Summary ---');
  });
})().catch((error) => {
  // This catch is for errors during the async IIFE itself (e.g. if llmConfigService.initialize() throws an unhandled error before app.listen)
  // LlmConfigService's initialize method is designed to catch its own errors and set operational status,
  // so a throw here would be unexpected unless there's a flaw in its error handling or some other async setup issue.
  proxyLogger.error(
    'LLM Proxy Server: A critical error occurred during asynchronous server startup sequence PRIOR to app.listen.',
    error
  );
  // AppConfigService and LlmConfigService should have logged their states.
  // The listen callback summary will not run if we get here.
  // We might want a minimal "Proxy NOT OPERATIONAL due to pre-listen critical failure" log here.
  proxyLogger.error(
    'LLM Proxy Server: CRITICAL - Proxy will NOT be operational due to a severe error during startup initialization steps.'
  );
  process.exit(1); // Ensure process exits on critical startup failure
});

// Global error handler
app.use((err, req, res, next) => {
  proxyLogger.error('Global Error Handler: Unhandled error caught!', {
    errorMessage: err.message,
    errorStack: err.stack,
    requestOriginalUrl: req.originalUrl,
    requestMethod: req.method,
    caughtErrorObject: err, // Be cautious logging the whole object in production
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
    { originalErrorMessage: err.message }, // Avoid sending full err object to client
    LOG_LLM_ID_UNHANDLED_ERROR,
    proxyLogger
  );
});
