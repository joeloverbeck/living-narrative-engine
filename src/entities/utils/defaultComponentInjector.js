// src/entities/utils/defaultComponentInjector.js

import {
  ACTOR_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  NOTES_COMPONENT_ID,
  GOALS_COMPONENT_ID,
  ANATOMY_BODY_COMPONENT_ID,
} from '../../constants/componentIds.js';

/**
 * Injects engine-level default components (STM, notes, goals) into an entity if needed.
 *
 * @description
 * Shared helper for EntityManager and EntityFactory to apply required default
 * components to actor entities. Validation and cloning is delegated to the
 * caller via the provided helper function.
 * @param {import('../entity.js').default} entity - The entity instance to modify.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger used for debug and error output.
 * @param {function(string, object, string): object} validateAndClone - Function that validates component data and returns a cloned payload. The third argument is an error context message.
 */
export function injectDefaultComponents(entity, logger, validateAndClone) {
  if (entity.hasComponent(ACTOR_COMPONENT_ID)) {
    const componentsToInject = [
      {
        id: SHORT_TERM_MEMORY_COMPONENT_ID,
        data: { thoughts: [], maxEntries: 10 },
        name: 'STM',
      },
      { id: NOTES_COMPONENT_ID, data: { notes: [] }, name: 'Notes' },
      { id: GOALS_COMPONENT_ID, data: { goals: [] }, name: 'Goals' },
    ];

    for (const comp of componentsToInject) {
      if (!entity.hasComponent(comp.id)) {
        logger.debug(
          `Injecting ${comp.name} for ${entity.id} (def: ${entity.definitionId})`
        );
        try {
          const validatedData = validateAndClone(
            comp.id,
            comp.data,
            `Default ${comp.name} component injection for entity ${entity.id}`
          );
          entity.addComponent(comp.id, validatedData);
        } catch (e) {
          logger.error(
            `Failed to inject default component ${comp.id} for entity ${entity.id}: ${e.message}`
          );
        }
      }
    }
  }
}
