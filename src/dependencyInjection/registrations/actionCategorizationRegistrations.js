/**
 * @file Action Categorization Service Registrations
 * Registration bundle for action categorization services following project patterns
 */

import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';
import ActionCategorizationService from '../../entities/utils/ActionCategorizationService.js';
import { UI_CATEGORIZATION_CONFIG } from '../../entities/utils/actionCategorizationConfig.js';

/**
 * Register action categorization services
 *
 * @param {import('../appContainer.js').default} container - The DI container
 */
export function registerActionCategorization(container) {
  const registrar = new Registrar(container);

  // Register ActionCategorizationService as singleton with UI configuration
  registrar.singletonFactory(tokens.IActionCategorizationService, (c) => {
    const logger = c.resolve(tokens.ILogger);
    return new ActionCategorizationService({
      logger,
      config: UI_CATEGORIZATION_CONFIG,
    });
  });
}
