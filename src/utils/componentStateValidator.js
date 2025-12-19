/**
 * @file Validates component state consistency for proximity operations
 */

import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
import { EntityNotFoundError } from '../errors/entityNotFoundError.js';
import { validateDependency } from './dependencyUtils.js';
import { string } from './validationCore.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

export class ComponentStateValidator {
  #logger;

  /**
   * Creates a new ComponentStateValidator instance for validating component state consistency.
   *
   * @param {object} dependencies - The dependencies object
   * @param {ILogger} dependencies.logger - Logger instance for debugging and error logging
   */
  constructor({ logger }) {
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });
    this.#logger = logger;
  }

  /**
   * Validates furniture component state for allows_sitting components.
   *
   * @param {string} furnitureId - ID of the furniture entity
   * @param {object} component - Furniture's allows_sitting component
   * @param {string} context - Validation context for error messages
   * @throws {EntityNotFoundError} If component is missing
   * @throws {InvalidArgumentError} If component is invalid
   */
  validateFurnitureComponent(
    furnitureId,
    component,
    context = 'furniture validation'
  ) {
    try {
      string.assertNonBlank(
        furnitureId,
        'furnitureId',
        'validateFurnitureComponent',
        this.#logger
      );
      string.assertNonBlank(
        context,
        'context',
        'validateFurnitureComponent',
        this.#logger
      );

      if (!component) {
        throw new EntityNotFoundError(
          `Furniture ${furnitureId} missing allows_sitting component`
        );
      }

      if (!component.spots || !Array.isArray(component.spots)) {
        throw new InvalidArgumentError(
          `Furniture ${furnitureId} has invalid spots array`
        );
      }

      if (component.spots.length === 0) {
        throw new InvalidArgumentError(
          `Furniture ${furnitureId} has empty spots array`
        );
      }

      if (component.spots.length > 10) {
        throw new InvalidArgumentError(
          `Furniture ${furnitureId} exceeds maximum spots (10)`
        );
      }

      // Validate each spot
      component.spots.forEach((spot, index) => {
        if (
          spot !== null &&
          (typeof spot !== 'string' || !spot.includes(':'))
        ) {
          throw new InvalidArgumentError(
            `Furniture ${furnitureId} spot ${index} has invalid occupant ID: ${spot}`
          );
        }
      });

      this.#logger.debug('Furniture component validated', {
        furnitureId,
        spotsCount: component.spots.length,
        context,
      });
    } catch (error) {
      this.#logger.error(`Furniture validation failed for ${furnitureId}`, {
        error: error.message,
        context,
      });
      throw error;
    }
  }

  /**
   * Validates closeness component state for actor relationship validation.
   *
   * @param {string} actorId - ID of the actor entity
   * @param {object|null} component - Actor's closeness component
   * @param {string} context - Validation context for error messages
   * @throws {InvalidArgumentError} If component is invalid
   */
  validateClosenessComponent(
    actorId,
    component,
    context = 'closeness validation'
  ) {
    try {
      string.assertNonBlank(
        actorId,
        'actorId',
        'validateClosenessComponent',
        this.#logger
      );
      string.assertNonBlank(
        context,
        'context',
        'validateClosenessComponent',
        this.#logger
      );

      if (!component) {
        return; // Null closeness component is valid (no relationships)
      }

      if (!component.partners || !Array.isArray(component.partners)) {
        throw new InvalidArgumentError(
          `Actor ${actorId} has invalid closeness partners array`
        );
      }

      // Validate partner IDs
      component.partners.forEach((partnerId, index) => {
        if (typeof partnerId !== 'string' || !partnerId.includes(':')) {
          throw new InvalidArgumentError(
            `Actor ${actorId} has invalid partner ID at index ${index}: ${partnerId}`
          );
        }
      });

      // Check for duplicates
      const uniquePartners = new Set(component.partners);
      if (uniquePartners.size !== component.partners.length) {
        throw new InvalidArgumentError(
          `Actor ${actorId} has duplicate partners in closeness component`
        );
      }

      // Check for self-reference
      if (component.partners.includes(actorId)) {
        throw new InvalidArgumentError(
          `Actor ${actorId} cannot be partner with themselves`
        );
      }

      this.#logger.debug('Closeness component validated', {
        actorId,
        partnerCount: component.partners.length,
        context,
      });
    } catch (error) {
      this.#logger.error(`Closeness validation failed for ${actorId}`, {
        error: error.message,
        context,
      });
      throw error;
    }
  }

  /**
   * Validates bidirectional closeness consistency between two actors.
   *
   * @param {object} entityManager - Entity manager instance
   * @param {string} actorId - First actor ID
   * @param {string} partnerId - Second actor ID
   * @throws {InvalidArgumentError} If relationship is unidirectional
   */
  validateBidirectionalCloseness(entityManager, actorId, partnerId) {
    try {
      string.assertNonBlank(
        actorId,
        'actorId',
        'validateBidirectionalCloseness',
        this.#logger
      );
      string.assertNonBlank(
        partnerId,
        'partnerId',
        'validateBidirectionalCloseness',
        this.#logger
      );

      if (!entityManager) {
        throw new InvalidArgumentError(
          'Entity manager is required for bidirectional validation'
        );
      }

      const actorCloseness = entityManager.getComponentData(
        actorId,
        'personal-space-states:closeness'
      );
      const partnerCloseness = entityManager.getComponentData(
        partnerId,
        'personal-space-states:closeness'
      );

      const actorHasPartner =
        actorCloseness?.partners?.includes(partnerId) || false;
      const partnerHasActor =
        partnerCloseness?.partners?.includes(actorId) || false;

      if (actorHasPartner && !partnerHasActor) {
        throw new InvalidArgumentError(
          `Unidirectional closeness detected: ${actorId} → ${partnerId} but not reverse`
        );
      }

      if (!actorHasPartner && partnerHasActor) {
        throw new InvalidArgumentError(
          `Unidirectional closeness detected: ${partnerId} → ${actorId} but not reverse`
        );
      }

      this.#logger.debug('Bidirectional closeness validated', {
        actorId,
        partnerId,
      });
    } catch (error) {
      this.#logger.error(
        `Bidirectional validation failed for ${actorId} and ${partnerId}`,
        { error: error.message }
      );
      throw error;
    }
  }
}
