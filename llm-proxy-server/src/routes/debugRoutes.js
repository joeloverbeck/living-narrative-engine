/**
 * @file Debug routes for handling debug log endpoints
 * @description Provides REST endpoints for debug log collection from browser clients
 * @see traceRoutes.js
 */

import express from 'express';
import DebugLogController from '../handlers/debugLogController.js';
import LogStorageService from '../services/logStorageService.js';
import { ConsoleLogger } from '../consoleLogger.js';
import { getAppConfigService } from '../config/appConfig.js';
import {
  validateDebugLogRequest,
  validateRequestHeaders,
  handleValidationErrors,
} from '../middleware/validation.js';
import { createApiRateLimiter } from '../middleware/rateLimiting.js';
import { createSizeLimitConfig } from '../middleware/timeout.js';

const router = express.Router();
const logger = new ConsoleLogger();

// Get AppConfigService singleton instance
const appConfigService = getAppConfigService(logger);

// Initialize log storage service with AppConfigService if debug logging is enabled
// Skip initialization in test environment to prevent timer issues
let logStorageService = null;
const isTestEnvironment = process.env.NODE_ENV === 'test';
if (appConfigService.isDebugLoggingEnabled() && !isTestEnvironment) {
  logStorageService = new LogStorageService(logger, appConfigService);
  logger.info(
    'Debug routes: Debug logging enabled, initialized storage service'
  );
} else {
  const reason = isTestEnvironment
    ? 'test environment'
    : 'debug logging disabled';
  logger.info(`Debug routes: Using console-only logging (${reason})`);
}

// Initialize debug log controller with optional storage service
const debugLogController = new DebugLogController(logger, logStorageService);

/**
 * POST /api/debug-log
 * Accept batched debug logs from browser clients
 * Request body contains:
 * - logs: Array of debug log entries
 * - logs[].level: Log level (debug|info|warn|error)
 * - logs[].message: Log message text
 * - logs[].timestamp: ISO 8601 datetime
 * - logs[].category: Optional log category
 * - logs[].source: Optional source location
 * - logs[].sessionId: Optional session UUID v4
 * - logs[].metadata: Optional additional context
 */
router.post(
  '/',
  // Apply increased size limit for debug logs (5MB instead of default 1MB)
  express.json(createSizeLimitConfig({ jsonLimit: '5mb' }).json),

  // Apply rate limiting (100 requests per 15 minutes)
  createApiRateLimiter(),

  // Validate headers
  validateRequestHeaders(),

  // Validate request body
  validateDebugLogRequest(),

  // Handle validation errors
  handleValidationErrors,

  // Handle the debug log request
  async (req, res) => {
    await debugLogController.handleDebugLog(req, res);
  }
);

export default router;
