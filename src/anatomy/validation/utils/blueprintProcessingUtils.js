/**
 * @file Blueprint processing utilities shared across validators.
 */

/**
 * @description Ensures a blueprint has generated slots when using structure templates.
 *
 * @param {object} params - Processing parameters.
 * @param {object} params.blueprint - Raw blueprint definition that may require processing.
 * @param {import('../../../interfaces/coreServices.js').IDataRegistry} params.dataRegistry - Registry for structure templates.
 * @param {import('../../slotGenerator.js').default} params.slotGenerator - Slot generator service.
 * @param {import('../../../interfaces/coreServices.js').ILogger} params.logger - Logger for diagnostics.
 * @returns {Promise<object|null>} Processed blueprint with `_generatedSockets` flag when applicable.
 */
export async function ensureBlueprintProcessed({
  blueprint,
  dataRegistry,
  slotGenerator,
  logger,
}) {
  if (!blueprint) {
    return null;
  }

  if (!blueprint.structureTemplate || blueprint._generatedSockets) {
    return blueprint;
  }

  logger.debug(
    `BlueprintProcessingUtils: Processing V2 blueprint '${
      blueprint.id || 'unknown'
    }' with structure template '${blueprint.structureTemplate}'`
  );

  const template = dataRegistry.get(
    'anatomyStructureTemplates',
    blueprint.structureTemplate
  );

  if (!template) {
    logger.warn(
      `BlueprintProcessingUtils: Structure template '${blueprint.structureTemplate}' not found, using raw blueprint`
    );
    return blueprint;
  }

  const generatedSlots = slotGenerator.generateBlueprintSlots(template);
  const additionalSlots = blueprint.additionalSlots || {};
  const mergedSlots = {
    ...generatedSlots,
    ...additionalSlots,
  };

  logger.debug(
    `BlueprintProcessingUtils: Generated ${Object.keys(generatedSlots).length} slots, merged with ${Object.keys(
      additionalSlots
    ).length} additionalSlots = ${Object.keys(mergedSlots).length} total`
  );

  return {
    ...blueprint,
    slots: mergedSlots,
    _generatedSockets: true,
  };
}
