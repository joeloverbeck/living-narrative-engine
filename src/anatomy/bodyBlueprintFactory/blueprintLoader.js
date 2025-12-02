// src/anatomy/bodyBlueprintFactory/blueprintLoader.js

/**
 * @file Blueprint loading and caching logic
 * Handles loading blueprints from registry, detecting schema versions,
 * and processing V2 blueprints with structure templates
 */

import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { ValidationError } from '../../errors/index.js';

/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../services/blueprintProcessorService.js').default} BlueprintProcessorService */

/**
 * @typedef {object} AnatomyBlueprint
 * @property {string} id
 * @property {string} root
 * @property {string} [schemaVersion]
 * @property {object} [slots]
 * @property {string} [structureTemplate]
 * @property {object} [additionalSlots]
 * @property {Array} [_generatedSockets]
 */

/**
 * Loads a blueprint from the registry and processes it through the centralized
 * BlueprintProcessorService (handles both V1 and V2 blueprints).
 *
 * @param {string} blueprintId - The blueprint ID to load
 * @param {object} dependencies - Required dependencies
 * @param {IDataRegistry} dependencies.dataRegistry - Data registry instance
 * @param {BlueprintProcessorService} dependencies.blueprintProcessorService - Blueprint processor service
 * @returns {AnatomyBlueprint} The loaded and processed blueprint
 * @throws {InvalidArgumentError} If blueprint not found
 */
export function loadBlueprint(blueprintId, { dataRegistry, blueprintProcessorService }) {
  const blueprint = dataRegistry.get('anatomyBlueprints', blueprintId);
  if (!blueprint) {
    throw new InvalidArgumentError(
      `Blueprint '${blueprintId}' not found in registry`
    );
  }

  // Delegate to centralized blueprint processor (handles V1/V2 routing)
  return blueprintProcessorService.processBlueprint(blueprint);
}

/**
 * Detects blueprint schema version (V1 or V2)
 *
 * @param {AnatomyBlueprint} blueprint - Blueprint to analyze
 * @returns {number} Schema version (1 or 2)
 */
export function detectBlueprintVersion(blueprint) {
  if (blueprint.schemaVersion === '2.0') {
    return 2;
  }
  return 1;
}

/**
 * Loads structure template for V2 blueprints (synchronous via DataRegistry)
 *
 * @param {string} templateId - Template identifier
 * @param {IDataRegistry} dataRegistry - DataRegistry instance
 * @param {ILogger} logger - Logger instance
 * @returns {object} Structure template
 * @throws {ValidationError} If template not found
 */
export function loadStructureTemplate(templateId, dataRegistry, logger) {
  const template = dataRegistry.get('anatomyStructureTemplates', templateId);
  if (!template) {
    throw new ValidationError(`Structure template not found: ${templateId}`);
  }

  logger.debug(`BlueprintLoader: Loaded structure template '${templateId}'`);
  return template;
}

export default {
  loadBlueprint,
  detectBlueprintVersion,
  loadStructureTemplate,
};
