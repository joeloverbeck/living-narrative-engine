/**
 * @module IsBodyPartWoundedOperator
 * @description JSON Logic operator that checks if a specific body part is wounded
 */

import { BaseBodyPartOperator } from './base/BaseBodyPartOperator.js';
import { hasValidEntityId } from '../utils/entityPathResolver.js';

/**
 * @class IsBodyPartWoundedOperator
 * @augments BaseBodyPartOperator
 * @description Returns true when the referenced part's currentHealth is below maxHealth and optional filters pass
 */
export class IsBodyPartWoundedOperator extends BaseBodyPartOperator {
  /**
   * @param {object} dependencies
   * @param {import('../../interfaces/IEntityManager.js').IEntityManager} dependencies.entityManager
   * @param {import('../../anatomy/bodyGraphService.js').BodyGraphService} dependencies.bodyGraphService
   * @param {import('../../interfaces/coreServices.js').ILogger} dependencies.logger
   */
  constructor(dependencies) {
    super(dependencies, 'isBodyPartWounded');
  }

  /**
   * @protected
   * @param {string} entityId - Owner entity ID (unused beyond logging)
   * @param {string} rootId - Root anatomy ID (unused; parity with BaseBodyPartOperator)
   * @param {Array} params - [partEntityRef, options]
   * @param {object} context - Evaluation context
   * @param {object} bodyComponent - The owner's body component
   * @returns {boolean}
   */
  evaluateInternal(entityId, rootId, params, context, bodyComponent) {
    const [partEntityRef, options] = params;
    const partEntityId = this.#resolvePartEntityId(partEntityRef);

    if (!partEntityId) {
      this.logger.warn(
        `${this.operatorName}: Invalid part reference for entity '${entityId}'`
      );
      return false;
    }

    const { excludeVitalOrgans, requireComponents } =
      this.#normalizeOptions(options);

    if (!this.#isHealthBelowMax(partEntityRef, partEntityId)) {
      return false;
    }

    if (
      excludeVitalOrgans &&
      this.#getComponentSafe(partEntityRef, partEntityId, 'anatomy:vital_organ')
    ) {
      return false;
    }

    for (const componentId of requireComponents) {
      if (
        !this.#getComponentSafe(partEntityRef, partEntityId, componentId, {
          allowEmptyObject: true,
        })
      ) {
        return false;
      }
    }

    return true;
  }

  #resolvePartEntityId(partEntityRef) {
    if (hasValidEntityId(partEntityRef)) {
      return partEntityRef.id;
    }

    if (typeof partEntityRef === 'string' || typeof partEntityRef === 'number') {
      return partEntityRef;
    }

    if (partEntityRef && typeof partEntityRef === 'object') {
      if (typeof partEntityRef.getComponentData === 'function') {
         
        return partEntityRef.id ?? partEntityRef._id ?? null;
      }
    }

    return null;
  }

  #normalizeOptions(options) {
    const opts =
      typeof options === 'boolean'
        ? { excludeVitalOrgans: options }
        : options && typeof options === 'object'
          ? options
          : {};
    const requireComponents = Array.isArray(opts.requireComponents)
      ? opts.requireComponents.filter(
          (componentId) => typeof componentId === 'string' && componentId.trim()
        )
      : [];

    return {
      excludeVitalOrgans: Boolean(opts.excludeVitalOrgans),
      requireComponents,
    };
  }

  #isHealthBelowMax(partEntityRef, partEntityId) {
    const health = this.#getComponentSafe(
      partEntityRef,
      partEntityId,
      'anatomy:part_health',
      { allowEmptyObject: false }
    );

    if (!health || typeof health !== 'object') {
      return false;
    }

    const { currentHealth, maxHealth } = health;
    if (typeof currentHealth !== 'number' || typeof maxHealth !== 'number') {
      return false;
    }

    if (maxHealth <= 0) {
      return false;
    }

    return currentHealth < maxHealth;
  }

  #getComponentSafe(partEntityRef, partEntityId, componentId, options = {}) {
    const { allowEmptyObject = false } = options;

    try {
      const data = this.entityManager.getComponentData(partEntityId, componentId);
      if (data !== undefined) {
        if (!allowEmptyObject && this.#isEmptyObject(data)) {
          return null;
        }
        return data;
      }
    } catch (error) {
      this.logger.debug(
        `${this.operatorName}: Failed to read ${componentId} for part '${partEntityId}' via entityManager`,
        error
      );
    }

    if (partEntityRef && typeof partEntityRef.getComponentData === 'function') {
      try {
        const data = partEntityRef.getComponentData(componentId);
        if (data !== undefined) {
          if (!allowEmptyObject && this.#isEmptyObject(data)) {
            return null;
          }
          return data;
        }
      } catch (error) {
        this.logger.debug(
          `${this.operatorName}: Failed to read ${componentId} from part reference`,
          error
        );
      }
    }

    if (partEntityRef && partEntityRef.components) {
      const data = partEntityRef.components[componentId];
      if (data !== undefined) {
        if (!allowEmptyObject && this.#isEmptyObject(data)) {
          return null;
        }
        return data;
      }
    }

    return null;
  }

  #isEmptyObject(value) {
    return typeof value === 'object' && value !== null && !Object.keys(value).length;
  }
}
