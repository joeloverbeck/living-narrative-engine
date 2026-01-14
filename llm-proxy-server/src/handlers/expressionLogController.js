/**
 * @file Controller for expression evaluation log operations
 * @description Handles HTTP requests for appending expression evaluation logs
 * @see ../routes/expressionRoutes.js
 * @see ../services/expressionLogService.js
 */

/**
 * Controller handling HTTP requests for expression evaluation log operations.
 * Validates input and delegates file operations to ExpressionLogService.
 */
export class ExpressionLogController {
  #logger;
  #expressionLogService;

  /**
   * Creates a new ExpressionLogController instance.
   * @param {object} logger - Logger instance for info and error logging
   * @param {object} expressionLogService - Service for expression log operations
   */
  constructor(logger, expressionLogService) {
    if (!logger) {
      throw new Error('ExpressionLogController: logger is required');
    }
    if (!expressionLogService) {
      throw new Error('ExpressionLogController: expressionLogService is required');
    }
    this.#logger = logger;
    this.#expressionLogService = expressionLogService;
    this.#logger.debug('ExpressionLogController: Instance created');
  }

  /**
   * Handles POST requests to append a log entry.
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @returns {Promise<void>}
   */
  async handleLogEntry(req, res) {
    try {
      const { entry } = req.body || {};

      const validationError = this.#validateLogPayload(entry);
      if (validationError) {
        return res.status(400).json({
          error: true,
          message: validationError,
        });
      }

      const result = await this.#expressionLogService.appendEntry(entry);

      return res.status(200).json({
        success: true,
        path: result.path,
        bytesWritten: result.bytesWritten,
      });
    } catch (error) {
      this.#logger.error('ExpressionLogController: Failed to append log entry', {
        error: error.message,
      });
      return res.status(500).json({
        error: true,
        message: 'Failed to append expression log entry',
        details: error.message,
      });
    }
  }

  /**
   * Validates the log entry payload for required fields and types.
   * @param {unknown} entry - The entry field from request body
   * @returns {string|null} Error message or null if valid
   * @private
   */
  #validateLogPayload(entry) {
    if (!entry) {
      return 'Missing required field: entry';
    }
    if (typeof entry !== 'object' || Array.isArray(entry)) {
      return 'Field entry must be an object';
    }
    return null;
  }
}

export default ExpressionLogController;
