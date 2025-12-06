/**
 * @file Salvage request controller for recovering cached LLM responses
 * @see ./llmRequestController.js
 */

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */
/**
 * @typedef {import('../services/responseSalvageService.js').ResponseSalvageService} ResponseSalvageService
 */
/**
 * @typedef {import('express').Request} ExpressRequest
 */
/**
 * @typedef {import('express').Response} ExpressResponse
 */

/**
 * Controller for handling salvaged response recovery
 */
export class SalvageRequestController {
  /** @type {ILogger} */
  #logger;

  /** @type {ResponseSalvageService} */
  #salvageService;

  /**
   * Constructs a SalvageRequestController instance
   * @param {ILogger} logger - Logger instance
   * @param {ResponseSalvageService} salvageService - Response salvage service
   */
  constructor(logger, salvageService) {
    if (!logger)
      throw new Error('SalvageRequestController: logger is required');
    if (!salvageService)
      throw new Error('SalvageRequestController: salvageService is required');

    this.#logger = logger;
    this.#salvageService = salvageService;

    this.#logger.debug('SalvageRequestController: Instance created');
  }

  /**
   * Handles salvage recovery requests by request ID
   * @param {ExpressRequest} req - Express request object
   * @param {ExpressResponse} res - Express response object
   * @returns {Promise<object>} Express response
   */
  async handleSalvageByRequestId(req, res) {
    const { requestId } = req.params;

    if (!requestId || typeof requestId !== 'string') {
      return res.status(400).json({
        error: true,
        message: 'Invalid request ID',
        stage: 'salvage_validation_failed',
        details: {
          reason: 'requestId parameter is required and must be a string',
        },
      });
    }

    this.#logger.debug(
      `SalvageRequestController: Attempting to retrieve salvaged response`,
      {
        requestId,
      }
    );

    const salvaged = this.#salvageService.retrieveByRequestId(requestId);

    if (!salvaged) {
      this.#logger.warn(
        `SalvageRequestController: No salvaged response found`,
        {
          requestId,
        }
      );

      return res.status(404).json({
        error: true,
        message: 'No salvaged response found for the provided request ID',
        stage: 'salvage_not_found',
        details: {
          requestId,
          reason:
            'Response may have expired, never existed, or was already retrieved',
        },
      });
    }

    this.#logger.info(
      `SalvageRequestController: Salvaged response retrieved successfully`,
      {
        requestId,
        llmId: salvaged.llmId,
        ageMs: Date.now() - salvaged.salvageTimestamp,
      }
    );

    // Return salvaged response with metadata
    return res.status(salvaged.statusCode).json({
      ...salvaged.responseData,
      _salvageMetadata: {
        originalRequestId: salvaged.requestId,
        llmId: salvaged.llmId,
        salvageTimestamp: salvaged.salvageTimestamp,
        ageMs: Date.now() - salvaged.salvageTimestamp,
        recovered: true,
      },
    });
  }

  /**
   * Handles salvage statistics requests
   * @param {ExpressRequest} req - Express request object
   * @param {ExpressResponse} res - Express response object
   * @returns {Promise<object>} Express response with salvage statistics
   */
  async handleSalvageStats(req, res) {
    const stats = this.#salvageService.getStats();

    this.#logger.debug(
      `SalvageRequestController: Salvage stats requested`,
      stats
    );

    return res.status(200).json({
      stats,
      message: 'Salvage service statistics',
    });
  }
}

export default SalvageRequestController;
