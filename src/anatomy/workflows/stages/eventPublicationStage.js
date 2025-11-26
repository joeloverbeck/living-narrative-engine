/**
 * @file Stage for publishing anatomy:anatomy_generated event
 */

/**
 * Publishes anatomy:anatomy_generated event if eventBus and socketIndex available
 *
 * @param {object} context - Generation context
 * @param {string} context.ownerId - Owner entity ID
 * @param {string} context.blueprintId - Blueprint ID
 * @param {object} context.graphResult - Graph generation result
 * @param {Map<string, string>} context.partsMap - Parts map
 * @param {Map<string, string>} context.slotEntityMappings - Slot entity mappings
 * @param {object} dependencies - Required services
 * @param {import('../../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} [dependencies.eventBus] - Event bus
 * @param {import('../../services/anatomySocketIndex.js').default} [dependencies.socketIndex] - Socket index
 * @param {import('../../../interfaces/coreServices.js').IDataRegistry} dependencies.dataRegistry - Data registry
 * @param {import('../../../interfaces/coreServices.js').ILogger} dependencies.logger - Logger
 * @returns {Promise<void>}
 */
export async function executeEventPublication(context, dependencies) {
  const { ownerId, blueprintId, graphResult, partsMap, slotEntityMappings } =
    context;
  const { eventBus, socketIndex, dataRegistry, logger } = dependencies;

  // Only execute if eventBus and socketIndex are available
  if (!eventBus || !socketIndex) {
    logger.debug(
      `EventPublicationStage: Skipping event publication (eventBus: ${!!eventBus}, socketIndex: ${!!socketIndex})`
    );
    return;
  }

  logger.debug(
    `EventPublicationStage: Publishing anatomy:anatomy_generated event for entity '${ownerId}'`
  );

  try {
    // Get sockets for the owner entity
    const sockets = await socketIndex.getEntitySockets(ownerId);

    // Build and dispatch event
    eventBus.dispatch('anatomy:anatomy_generated', {
      entityId: ownerId,
      blueprintId: blueprintId,
      sockets: sockets,
      timestamp: Date.now(),
      bodyParts: graphResult.entities,
      partsMap:
        partsMap instanceof Map ? Object.fromEntries(partsMap) : partsMap,
      slotEntityMappings:
        slotEntityMappings instanceof Map
          ? Object.fromEntries(slotEntityMappings)
          : slotEntityMappings,
    });

    logger.debug(
      `EventPublicationStage: Successfully published anatomy:anatomy_generated event for entity '${ownerId}'`
    );
  } catch (error) {
    // Don't fail the generation if event publication fails
    logger.error(
      `EventPublicationStage: Failed to publish anatomy:anatomy_generated event for entity '${ownerId}'`,
      error
    );
  }
}
