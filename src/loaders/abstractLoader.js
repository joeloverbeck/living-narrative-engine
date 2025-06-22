// src/loaders/abstractLoader.js

/**
 * Provides shared constructor logic for loader classes.
 * Validates dependencies and initializes a logger.
 *
 * @class AbstractLoader
 */

import { ensureValidLogger } from '../utils';

export class AbstractLoader {
  /** @protected */
  _logger;

  /**
   * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger instance.
   */
  constructor(logger) {
    // Removed the unused 'checks' parameter
    this._logger = ensureValidLogger(logger, this.constructor.name);
    this._logger.debug(`${this.constructor.name}: Initialized.`);
  }
}

export default AbstractLoader;
