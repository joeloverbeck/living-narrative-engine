/**
 * @file Utility functions for calculating furniture spot adjacency and proximity relationships
 * Note: The sitting closeness handlers will be created in subsequent workflows
 */

import { assertPresent, assertNonBlankString } from './dependencyUtils.js';
import { InvalidArgumentError } from '../errors/invalidArgumentError.js';

/**
 * Validate that a value is a non-negative integer
 *
 * @param {*} value - Value to validate
 * @param {string} name - Parameter name for error messages
 * @param {string} context - Context for error messages
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger instance
 * @throws {InvalidArgumentError} If value is not a non-negative integer
 * @private
 */
function validateNonNegativeInteger(value, name, context, logger) {
  if (!Number.isInteger(value) || value < 0) {
    const message = `${context}: ${name} must be a non-negative integer, got ${value}`;
    logger.error(message);
    throw new InvalidArgumentError(message, name, value);
  }
}

/**
 * Calculate adjacent spot indices for a given furniture position
 *
 * @param {number} spotIndex - Current spot index (0-based)
 * @param {number} totalSpots - Total number of spots in furniture
 * @returns {number[]} Array of adjacent spot indices
 */
export function getAdjacentSpots(spotIndex, totalSpots) {
  // Validate inputs
  if (!Number.isInteger(spotIndex) || spotIndex < 0) {
    throw new InvalidArgumentError(
      `spotIndex must be a non-negative integer, got ${spotIndex}`,
      'spotIndex',
      spotIndex
    );
  }
  
  if (!Number.isInteger(totalSpots) || totalSpots <= 0) {
    throw new InvalidArgumentError(
      `totalSpots must be a positive integer, got ${totalSpots}`,
      'totalSpots',
      totalSpots
    );
  }
  
  if (spotIndex >= totalSpots) {
    throw new InvalidArgumentError(
      `spotIndex ${spotIndex} is out of bounds for totalSpots ${totalSpots}`,
      'spotIndex',
      spotIndex
    );
  }

  // Single spot furniture has no adjacent spots
  if (totalSpots === 1) {
    return [];
  }

  const adjacentSpots = [];

  // Add left adjacent spot if not at the beginning
  if (spotIndex > 0) {
    adjacentSpots.push(spotIndex - 1);
  }

  // Add right adjacent spot if not at the end
  if (spotIndex < totalSpots - 1) {
    adjacentSpots.push(spotIndex + 1);
  }

  return adjacentSpots;
}

/**
 * Find entity IDs occupying adjacent spots in furniture
 *
 * @param {object} furnitureComponent - Furniture's allows_sitting component data
 * @param {(string|null)[]} furnitureComponent.spots - Array of entity IDs or null for empty spots
 * @param {number} spotIndex - Target spot index to find adjacent occupants for
 * @returns {string[]} Array of entity IDs occupying adjacent spots (excludes null values)
 */
export function findAdjacentOccupants(furnitureComponent, spotIndex) {
  // Validate furniture component
  assertPresent(furnitureComponent, 'furnitureComponent is required');
  assertPresent(furnitureComponent.spots, 'furnitureComponent.spots is required');
  
  if (!Array.isArray(furnitureComponent.spots)) {
    throw new InvalidArgumentError(
      'furnitureComponent.spots must be an array',
      'furnitureComponent.spots',
      furnitureComponent.spots
    );
  }

  const totalSpots = furnitureComponent.spots.length;
  
  if (totalSpots === 0) {
    throw new InvalidArgumentError(
      'furnitureComponent.spots cannot be empty',
      'furnitureComponent.spots',
      furnitureComponent.spots
    );
  }

  // Get adjacent spot indices
  const adjacentIndices = getAdjacentSpots(spotIndex, totalSpots);
  
  // Collect non-null entity IDs from adjacent spots
  const adjacentOccupants = [];
  
  for (const index of adjacentIndices) {
    const occupant = furnitureComponent.spots[index];
    if (occupant !== null && occupant !== undefined) {
      adjacentOccupants.push(occupant);
    }
  }
  
  return adjacentOccupants;
}

/**
 * Validate parameters for proximity operations
 *
 * @param {string} furnitureId - ID of the furniture entity
 * @param {string} actorId - ID of the actor entity
 * @param {number} spotIndex - Spot index being operated on
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger instance
 * @returns {boolean} True if all parameters are valid
 * @throws {InvalidArgumentError} If any parameter is invalid
 */
export function validateProximityParameters(furnitureId, actorId, spotIndex, logger) {
  assertPresent(logger, 'logger is required');
  
  // Validate string IDs
  assertNonBlankString(furnitureId, 'furnitureId', 'validateProximityParameters', logger);
  assertNonBlankString(actorId, 'actorId', 'validateProximityParameters', logger);
  
  // Validate spot index is a non-negative integer
  validateNonNegativeInteger(spotIndex, 'spotIndex', 'validateProximityParameters', logger);
  
  return true;
}

// Default export for convenience
export default {
  getAdjacentSpots,
  findAdjacentOccupants,
  validateProximityParameters
};