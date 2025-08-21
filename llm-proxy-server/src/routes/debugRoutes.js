/**
 * @file Debug routes for handling debug log endpoints
 * @description Provides REST endpoints for debug log collection from browser clients
 * @see traceRoutes.js
 */

import express from 'express';
import DebugLogController from '../handlers/debugLogController.js';
import { ConsoleLogger } from '../consoleLogger.js';
import {
  validateDebugLogRequest,
  validateRequestHeaders,
  handleValidationErrors,
} from '../middleware/validation.js';
import { createApiRateLimiter } from '../middleware/rateLimiting.js';

const router = express.Router();
const logger = new ConsoleLogger();

// Initialize debug log controller
const debugLogController = new DebugLogController(logger);

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
