/**
 * @file Utility functions for calculating furniture spot adjacency and proximity relationships
 * Note: The sitting closeness handlers will be created in subsequent workflows
 */

import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
import { assertPresent } from './dependencyUtils.js';

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
  assertPresent(
    furnitureComponent.spots,
    'furnitureComponent.spots is required'
  );

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
 * Validate parameters for proximity operations with comprehensive validation
 *
 * @param {string} furnitureId - ID of the furniture entity (must be in modId:identifier format)
 * @param {string} actorId - ID of the actor entity (must be in modId:identifier format)
 * @param {number} spotIndex - Spot index being operated on (0-9 range)
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger instance with required methods
 * @returns {boolean} True if all parameters are valid
 * @throws {InvalidArgumentError} If any parameter is invalid
 */
export function validateProximityParameters(
  furnitureId,
  actorId,
  spotIndex,
  logger
) {
  const errors = [];

  try {
    // Enhanced furniture ID validation
    if (furnitureId === null || furnitureId === undefined) {
      errors.push('Furniture ID is required');
    } else if (typeof furnitureId !== 'string') {
      errors.push('Furniture ID must be a string');
    } else if (furnitureId.trim().length === 0) {
      errors.push('Furniture ID cannot be empty or whitespace only');
    } else if (!furnitureId.includes(':')) {
      errors.push(
        'Furniture ID must be in namespaced format (modId:identifier)'
      );
    } else {
      const parts = furnitureId.split(':');
      if (parts.length !== 2) {
        errors.push(
          'Furniture ID must have exactly one colon separating mod ID and identifier'
        );
      } else {
        const [modId, identifier] = parts;
        if (!modId || modId.trim().length === 0) {
          errors.push('Furniture ID must have a valid mod ID before the colon');
        } else if (!/^[a-zA-Z0-9_-]+$/.test(modId)) {
          errors.push(
            'Mod ID must contain only alphanumeric characters, underscores, and hyphens'
          );
        }
        if (!identifier || identifier.trim().length === 0) {
          errors.push(
            'Furniture ID must have a valid identifier after the colon'
          );
        } else if (!/^[a-zA-Z0-9_-]+$/.test(identifier)) {
          errors.push(
            'Identifier must contain only alphanumeric characters, underscores, and hyphens'
          );
        }
      }
    }

    // Enhanced actor ID validation (same rules as furniture ID)
    if (actorId === null || actorId === undefined) {
      errors.push('Actor ID is required');
    } else if (typeof actorId !== 'string') {
      errors.push('Actor ID must be a string');
    } else if (actorId.trim().length === 0) {
      errors.push('Actor ID cannot be empty or whitespace only');
    } else if (!actorId.includes(':')) {
      errors.push('Actor ID must be in namespaced format (modId:identifier)');
    } else {
      const parts = actorId.split(':');
      if (parts.length !== 2) {
        errors.push(
          'Actor ID must have exactly one colon separating mod ID and identifier'
        );
      } else {
        const [modId, identifier] = parts;
        if (!modId || modId.trim().length === 0) {
          errors.push('Actor ID must have a valid mod ID before the colon');
        } else if (!/^[a-zA-Z0-9_-]+$/.test(modId)) {
          errors.push(
            'Actor ID mod ID must contain only alphanumeric characters, underscores, and hyphens'
          );
        }
        if (!identifier || identifier.trim().length === 0) {
          errors.push('Actor ID must have a valid identifier after the colon');
        } else if (!/^[a-zA-Z0-9_-]+$/.test(identifier)) {
          errors.push(
            'Actor ID identifier must contain only alphanumeric characters, underscores, and hyphens'
          );
        }
      }
    }

    // Enhanced spot index validation
    if (spotIndex === null || spotIndex === undefined) {
      errors.push('Spot index is required');
    } else if (typeof spotIndex !== 'number') {
      errors.push('Spot index must be a number');
    } else if (!Number.isInteger(spotIndex)) {
      errors.push('Spot index must be an integer');
    } else if (spotIndex < 0) {
      errors.push('Spot index must be non-negative');
    } else if (spotIndex > 9) {
      errors.push(
        'Spot index must be between 0 and 9 (maximum furniture capacity)'
      );
    }

    // Enhanced logger validation
    if (!logger) {
      errors.push('Logger is required');
    } else if (typeof logger !== 'object') {
      errors.push('Logger must be an object');
    } else {
      const requiredMethods = ['info', 'warn', 'error', 'debug'];
      for (const method of requiredMethods) {
        if (!(method in logger) || logger[method] === undefined) {
          errors.push(`Logger must have ${method} method`);
        } else if (typeof logger[method] !== 'function') {
          errors.push(`Logger ${method} must be a function`);
        }
      }
    }

    // Report all accumulated errors
    if (errors.length > 0) {
      const errorMessage = `Parameter validation failed: ${errors.join(', ')}`;
      if (logger && typeof logger.error === 'function') {
        try {
          logger.error('Proximity parameter validation failed', {
            furnitureId,
            actorId,
            spotIndex,
            errors,
            timestamp: new Date().toISOString(),
          });
        } catch {
          // Ignore logger failures, proceed with throwing validation error
        }
      }
      throw new InvalidArgumentError(errorMessage);
    }

    // Log successful validation at debug level
    if (logger && typeof logger.debug === 'function') {
      try {
        logger.debug('Proximity parameters validated successfully', {
          furnitureId,
          actorId,
          spotIndex,
        });
      } catch {
        // Ignore debug logging failures
      }
    }

    return true;
  } catch (error) {
    if (error instanceof InvalidArgumentError) {
      throw error; // Re-throw validation errors
    }

    // Handle unexpected validation errors
    const unexpectedError = new Error(
      `Unexpected error during parameter validation: ${error.message}`
    );
    if (logger && typeof logger.error === 'function') {
      logger.error('Unexpected validation error', {
        originalError: error.message,
        stack: error.stack,
      });
    }
    throw unexpectedError;
  }
}

// Default export for convenience
export default {
  getAdjacentSpots,
  findAdjacentOccupants,
  validateProximityParameters,
};
