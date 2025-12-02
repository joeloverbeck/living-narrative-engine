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
/** @typedef {import('../socketGenerator.js').default} SocketGenerator */
/** @typedef {import('../slotGenerator.js').default} SlotGenerator */

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
 * Loads a blueprint from the registry
 *
 * @param {string} blueprintId - The blueprint ID to load
 * @param {object} dependencies - Required dependencies
 * @param {IDataRegistry} dependencies.dataRegistry - Data registry instance
 * @param {ILogger} dependencies.logger - Logger instance
 * @param {SocketGenerator} dependencies.socketGenerator - Socket generator instance
 * @param {SlotGenerator} dependencies.slotGenerator - Slot generator instance
 * @returns {AnatomyBlueprint} The loaded blueprint
 * @throws {InvalidArgumentError} If blueprint not found
 */
export function loadBlueprint(blueprintId, { dataRegistry, logger, socketGenerator, slotGenerator }) {
  const blueprint = dataRegistry.get('anatomyBlueprints', blueprintId);
  if (!blueprint) {
    throw new InvalidArgumentError(
      `Blueprint '${blueprintId}' not found in registry`
    );
  }

  // Route v2 blueprints through template processor
  if (blueprint.schemaVersion === '2.0' && blueprint.structureTemplate) {
    return processV2Blueprint(blueprint, { dataRegistry, logger, socketGenerator, slotGenerator });
  }

  // V1 blueprints pass through unchanged
  return blueprint;
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

/**
 * Processes a v2 blueprint by generating slots and sockets from structure template
 *
 * @param {AnatomyBlueprint} blueprint - The v2 blueprint with structureTemplate
 * @param {object} dependencies - Required dependencies
 * @param {IDataRegistry} dependencies.dataRegistry - Data registry instance
 * @param {ILogger} dependencies.logger - Logger instance
 * @param {SocketGenerator} dependencies.socketGenerator - Socket generator instance
 * @param {SlotGenerator} dependencies.slotGenerator - Slot generator instance
 * @returns {AnatomyBlueprint} Blueprint with generated slots merged with additionalSlots
 * @throws {ValidationError} If structure template not found
 * @private
 */
function processV2Blueprint(blueprint, { dataRegistry, logger, socketGenerator, slotGenerator }) {
  logger.debug(
    `BlueprintLoader: Processing v2 blueprint with template '${blueprint.structureTemplate}'`
  );

  // Load structure template from DataRegistry
  const template = loadStructureTemplate(blueprint.structureTemplate, dataRegistry, logger);

  // Generate sockets and slots from template
  const generatedSockets = socketGenerator.generateSockets(template) || [];
  const generatedSlots = slotGenerator.generateBlueprintSlots(template) || {};
  const additionalSlots = blueprint.additionalSlots || {};

  const conflictingSlots = Object.keys(additionalSlots).filter(slotKey =>
    Object.prototype.hasOwnProperty.call(generatedSlots, slotKey)
  );

  // Separate intentional overrides (parent relationship changes) from accidental duplicates
  const intentionalOverrides = conflictingSlots.filter(
    slotKey => additionalSlots[slotKey]?.parent !== undefined
  );
  const unintentionalOverrides = conflictingSlots.filter(
    slotKey => additionalSlots[slotKey]?.parent === undefined
  );

  // Warn only about unintentional duplicates (potential mistakes)
  if (unintentionalOverrides.length > 0) {
    logger.warn(
      `BlueprintLoader: Blueprint '${
        blueprint.id || 'unknown blueprint'
      }' additionalSlots duplicating generated slots without parent override: ${unintentionalOverrides.join(', ')}`
    );
  }

  // Debug log for intentional parent relationship overrides (expected pattern)
  if (intentionalOverrides.length > 0) {
    logger.debug(
      `BlueprintLoader: Blueprint '${
        blueprint.id || 'unknown blueprint'
      }' additionalSlots overriding parent relationships for: ${intentionalOverrides.join(', ')}`
    );
  }

  logger.info(
    `BlueprintLoader: Generated ${generatedSockets.length} sockets and ${Object.keys(generatedSlots).length} slots from template`
  );

  // Merge generated slots with additionalSlots (additionalSlots take precedence)
  return {
    ...blueprint,
    slots: {
      ...generatedSlots,
      ...additionalSlots,
    },
    _generatedSockets: generatedSockets,
    _generatedSlots: generatedSlots,
  };
}

export default {
  loadBlueprint,
  detectBlueprintVersion,
  loadStructureTemplate,
};
