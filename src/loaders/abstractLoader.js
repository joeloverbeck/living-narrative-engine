// src/loaders/abstractLoader.js

/**
 * Provides shared constructor logic for loader classes.
 * Validates dependencies and initializes a logger.
 *
 * @class AbstractLoader
 */

import { ensureValidLogger } from '../utils/loggerUtils.js';
import { validateLoaderDeps } from '../utils/validationUtils.js';

export class AbstractLoader {
  /** @protected */
  _logger;

  /**
   * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger instance.
   * @param {Array<{dependency: *, name: string, methods: string[]}>} checks - Dependencies to validate.
   */
  constructor(logger, checks = []) {
    validateLoaderDeps(logger, checks);
    this._logger = ensureValidLogger(logger, this.constructor.name);
    this._logger.debug(`${this.constructor.name}: Base loader initialized.`);
  }
}

export default AbstractLoader;
