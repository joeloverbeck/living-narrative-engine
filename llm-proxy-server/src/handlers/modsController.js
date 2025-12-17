/**
 * @file Controller for mod scanning and listing API
 * @see ../services/modScannerService.js
 */

/**
 * @typedef {import('../interfaces/coreServices.js').ILogger} ILogger
 */
/**
 * @typedef {import('../services/modScannerService.js').ModScannerService} ModScannerService
 */
/**
 * @typedef {import('express').Request} ExpressRequest
 */
/**
 * @typedef {import('express').Response} ExpressResponse
 */

/**
 * Controller for handling mod list and discovery requests
 */
export class ModsController {
  /** @type {ILogger} */
  #logger;

  /** @type {ModScannerService} */
  #modScannerService;

  /**
   * Constructs a ModsController instance
   * @param {ILogger} logger - Logger instance
   * @param {ModScannerService} modScannerService - Mod scanner service instance
   */
  constructor(logger, modScannerService) {
    if (!logger) {
      throw new Error('ModsController: logger is required');
    }
    if (!modScannerService) {
      throw new Error('ModsController: modScannerService is required');
    }

    this.#logger = logger;
    this.#modScannerService = modScannerService;

    this.#logger.debug('ModsController: Instance created');
  }

  /**
   * Handles GET /api/mods requests
   * @param {ExpressRequest} req - Express request object
   * @param {ExpressResponse} res - Express response object
   * @returns {Promise<object>} Express response with mod list
   */
  async handleGetMods(req, res) {
    try {
      const mods = await this.#modScannerService.scanMods();

      this.#logger.debug('ModsController: Returning mod list', {
        count: mods.length,
      });

      return res.status(200).json({
        success: true,
        mods,
        count: mods.length,
        scannedAt: new Date().toISOString(),
      });
    } catch (error) {
      this.#logger.error('ModsController: Failed to scan mods', error);

      return res.status(500).json({
        error: true,
        message: 'Failed to scan mods directory',
        details: error.message,
      });
    }
  }
}

export default ModsController;
