/**
 * @file This module contains the interface for providing data about an entity.
 * @see src/interfaces/IEntitySummaryProvider.js
 */

/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * @typedef {object} EntitySummaryDTO
 * @property {string} id - The entity's unique instance ID.
 * @property {string} name - The entity's display name, with a fallback.
 * @property {string} description - The entity's description, with a fallback.
 */

/**
 * @interface IEntitySummaryProvider
 * @description Defines the contract for a service that extracts a basic name/description summary from an entity.
 */
export class IEntitySummaryProvider {
  /**
   * Generates a summary DTO for a given entity.
   *
   * @param {Entity} entity - The entity to summarize.
   * @returns {EntitySummaryDTO} A DTO with the entity's core display info.
   */
  getSummary(entity) {
    throw new Error("Method 'getSummary(entity)' must be implemented.");
  }
}
