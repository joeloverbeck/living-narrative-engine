/**
 * @file Controller for expression diagnostic status operations
 * @description Handles HTTP requests for updating and scanning expression diagnostic statuses
 * @see ../routes/expressionRoutes.js
 * @see ../services/expressionFileService.js
 */

/**
 * Valid diagnostic status values accepted by the API
 * @type {readonly string[]}
 */
const VALID_STATUSES = Object.freeze([
  'unknown',
  'impossible',
  'extremely_rare',
  'rare',
  'normal',
  'frequent',
]);

/**
 * Controller handling HTTP requests for expression diagnostic status operations.
 * Validates input and delegates file operations to ExpressionFileService.
 */
export class ExpressionStatusController {
  #logger;
  #expressionFileService;

  /**
   * Creates a new ExpressionStatusController instance.
   * @param {object} logger - Logger instance for info and error logging
   * @param {object} expressionFileService - Service for expression file operations
   */
  constructor(logger, expressionFileService) {
    if (!logger) {
      throw new Error('ExpressionStatusController: logger is required');
    }
    if (!expressionFileService) {
      throw new Error('ExpressionStatusController: expressionFileService is required');
    }
    this.#logger = logger;
    this.#expressionFileService = expressionFileService;
    this.#logger.debug('ExpressionStatusController: Instance created');
  }

  /**
   * Handles POST requests to update an expression's diagnostic status.
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @returns {Promise<void>}
   */
  async handleUpdateStatus(req, res) {
    try {
      const { filePath, status } = req.body;

      // Validate required fields
      const validationError = this.#validateUpdatePayload(filePath, status);
      if (validationError) {
        return res.status(400).json({
          error: true,
          message: validationError,
        });
      }

      const result = await this.#expressionFileService.updateExpressionStatus(filePath, status);

      if (!result.success) {
        this.#logger.warn('ExpressionStatusController: Update failed', {
          filePath,
          status,
          message: result.message,
        });
        return res.status(400).json({
          error: true,
          message: result.message,
        });
      }

      this.#logger.info('ExpressionStatusController: Status updated', {
        filePath,
        expressionId: result.expressionId,
        status,
      });

      return res.status(200).json({
        success: true,
        message: result.message,
        expressionId: result.expressionId,
      });
    } catch (error) {
      this.#logger.error('ExpressionStatusController: Failed to update status', error);
      return res.status(500).json({
        error: true,
        message: 'Failed to update expression status',
        details: error.message,
      });
    }
  }

  /**
   * Handles GET requests to scan all expression diagnostic statuses.
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @returns {Promise<void>}
   */
  async handleScanStatuses(req, res) {
    try {
      const expressions = await this.#expressionFileService.scanAllExpressionStatuses();

      this.#logger.info('ExpressionStatusController: Scan completed', {
        expressionCount: expressions.length,
      });

      return res.status(200).json({
        success: true,
        expressions,
      });
    } catch (error) {
      this.#logger.error('ExpressionStatusController: Failed to scan statuses', error);
      return res.status(500).json({
        error: true,
        message: 'Failed to scan expression statuses',
        details: error.message,
      });
    }
  }

  /**
   * Validates the update status payload for required fields and types.
   * @param {unknown} filePath - The filePath field from request body
   * @param {unknown} status - The status field from request body
   * @returns {string|null} Error message or null if valid
   * @private
   */
  #validateUpdatePayload(filePath, status) {
    if (!filePath) {
      return 'Missing required field: filePath';
    }
    if (typeof filePath !== 'string' || filePath.trim() === '') {
      return 'Field filePath must be a non-empty string';
    }
    if (!filePath.endsWith('.expression.json')) {
      return 'Field filePath must end with .expression.json';
    }
    if (!status) {
      return 'Missing required field: status';
    }
    if (typeof status !== 'string') {
      return 'Field status must be a string';
    }
    if (!VALID_STATUSES.includes(status)) {
      return `Invalid status: ${status}. Valid values: ${VALID_STATUSES.join(', ')}`;
    }
    return null;
  }
}

export default ExpressionStatusController;
