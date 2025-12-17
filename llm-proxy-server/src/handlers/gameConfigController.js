/**
 * @file Controller for game configuration save/load operations
 * @see ../routes/gameConfigRoutes.js
 * @see ../services/gameConfigService.js
 */

/**
 * Controller handling HTTP requests for game configuration operations.
 * Validates input and delegates persistence to GameConfigService.
 */
export class GameConfigController {
  #logger;
  #gameConfigService;

  /**
   * Creates a new GameConfigController instance.
   * @param {object} logger - Logger instance for info and error logging
   * @param {object} gameConfigService - Service for config persistence
   */
  constructor(logger, gameConfigService) {
    if (!logger) {
      throw new Error('GameConfigController: logger is required');
    }
    if (!gameConfigService) {
      throw new Error('GameConfigController: gameConfigService is required');
    }
    this.#logger = logger;
    this.#gameConfigService = gameConfigService;
    this.#logger.debug('GameConfigController: Instance created');
  }

  /**
   * Handles POST requests to save game configuration.
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @returns {Promise<void>}
   */
  async handleSave(req, res) {
    try {
      const { mods, startWorld } = req.body;

      // Validate required fields
      const validationError = this.#validatePayload(mods, startWorld);
      if (validationError) {
        return res.status(400).json({
          error: true,
          message: validationError,
        });
      }

      const config = { mods, startWorld };
      await this.#gameConfigService.saveConfig(config);

      this.#logger.info('GameConfigController: Game config saved successfully', {
        modCount: mods.length,
        startWorld,
      });

      return res.status(200).json({
        success: true,
        message: 'Configuration saved successfully',
        config,
      });
    } catch (error) {
      this.#logger.error('GameConfigController: Failed to save game config', error);
      return res.status(500).json({
        error: true,
        message: 'Failed to save configuration',
        details: error.message,
      });
    }
  }

  /**
   * Handles GET requests to retrieve current game configuration.
   * @param {object} req - Express request object
   * @param {object} res - Express response object
   * @returns {Promise<void>}
   */
  async handleGetCurrent(req, res) {
    try {
      const config = await this.#gameConfigService.loadConfig();
      return res.status(200).json({
        success: true,
        config,
      });
    } catch (error) {
      this.#logger.error('GameConfigController: Failed to load game config', error);
      return res.status(500).json({
        error: true,
        message: 'Failed to load configuration',
        details: error.message,
      });
    }
  }

  /**
   * Validates the save payload for required fields and types.
   * @param {unknown} mods - The mods field from request body
   * @param {unknown} startWorld - The startWorld field from request body
   * @returns {string|null} Error message or null if valid
   * @private
   */
  #validatePayload(mods, startWorld) {
    if (!mods) {
      return 'Missing required field: mods';
    }
    if (!Array.isArray(mods)) {
      return 'Field mods must be an array';
    }
    if (mods.length === 0) {
      return 'Field mods cannot be empty';
    }
    if (!mods.every((mod) => typeof mod === 'string' && mod.length > 0)) {
      return 'All mods must be non-empty strings';
    }
    if (!startWorld) {
      return 'Missing required field: startWorld';
    }
    if (typeof startWorld !== 'string' || startWorld.trim() === '') {
      return 'Field startWorld must be a non-empty string';
    }
    return null;
  }
}
