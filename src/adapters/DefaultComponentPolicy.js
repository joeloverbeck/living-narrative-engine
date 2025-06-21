import { cloneDeep } from 'lodash';
import { IDefaultComponentPolicy } from '../ports/IDefaultComponentPolicy.js';
import {
  ACTOR_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  NOTES_COMPONENT_ID,
  GOALS_COMPONENT_ID,
} from '../constants/componentIds.js';

/**
 * Determine if a validation result is successful.
 *
 * @param {any} rawResult
 * @returns {boolean}
 */
function validationSucceeded(rawResult) {
  if (rawResult === undefined || rawResult === null) return true;
  if (typeof rawResult === 'boolean') return rawResult;
  return !!rawResult.isValid;
}

/**
 * Format validation errors for logging.
 *
 * @param {any} rawResult
 * @returns {string}
 */
function formatValidationErrors(rawResult) {
  if (rawResult && typeof rawResult === 'object' && rawResult.errors) {
    return JSON.stringify(rawResult.errors, null, 2);
  }
  return '(validator returned false)';
}

/**
 * Policy that injects engine-required default components into actor entities.
 *
 * @implements {IDefaultComponentPolicy}
 */
class DefaultComponentPolicy extends IDefaultComponentPolicy {
  /**
   * Apply the policy to the given entity.
   *
   * @param {import('../entities/entity.js').default} entity
   * @param {{ validator: { validate: Function }, logger: { debug: Function, error: Function } }} deps
   */
  apply(entity, { validator, logger }) {
    if (!entity.hasComponent(ACTOR_COMPONENT_ID)) {
      return;
    }

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
      if (entity.hasComponent(comp.id)) continue;

      logger.debug(
        `Injecting ${comp.name} for ${entity.id} (def: ${entity.definitionId})`
      );
      try {
        const clone = cloneDeep(comp.data);
        const result = validator.validate(comp.id, clone);
        if (!validationSucceeded(result)) {
          const details = formatValidationErrors(result);
          const msg = `Default ${comp.name} component injection for entity ${entity.id} Errors:\n${details}`;
          logger.error(msg);
          throw new Error(msg);
        }
        entity.addComponent(comp.id, clone);
      } catch (e) {
        logger.error(
          `Failed to inject default component ${comp.id} for entity ${entity.id}: ${e.message}`
        );
      }
    }
  }
}

export default DefaultComponentPolicy;
