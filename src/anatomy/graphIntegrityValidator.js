// src/anatomy/graphIntegrityValidator.js

/**
 * @file Validates anatomy graphs against recipe constraints and socket limits
 */

import { InvalidArgumentError } from '../errors/invalidArgumentError.js';

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} ValidationResult
 * @property {boolean} valid
 * @property {string[]} errors
 * @property {string[]} warnings
 */

/**
 * Service that validates assembled anatomy graphs
 */
export class GraphIntegrityValidator {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {ILogger} deps.logger
   */
  constructor({ entityManager, logger }) {
    if (!entityManager)
      throw new InvalidArgumentError('entityManager is required');
    if (!logger) throw new InvalidArgumentError('logger is required');

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Validates an assembled anatomy graph
   *
   * @param {string[]} entityIds - All entity IDs in the graph
   * @param {object} recipe - The recipe used to assemble the graph
   * @param {Map<string, number>} socketOccupancy - Socket usage tracking
   * @returns {Promise<ValidationResult>}
   */
  async validateGraph(entityIds, recipe, socketOccupancy) {
    const errors = [];
    const warnings = [];

    this.#logger.debug(
      `GraphIntegrityValidator: Validating graph with ${entityIds.length} entities`
    );

    try {
      // 1. Validate socket occupancy limits
      this.#validateSocketLimits(entityIds, socketOccupancy, errors);

      // 2. Validate recipe constraints
      await this.#validateRecipeConstraints(
        entityIds,
        recipe,
        errors,
        warnings
      );

      // 3. Check for cycles
      this.#validateNoCycles(entityIds, errors);

      // 4. Validate joint consistency
      this.#validateJointConsistency(entityIds, errors);

      // 5. Check for orphaned parts
      this.#validateNoOrphans(entityIds, errors, warnings);

      // 6. Validate part type compatibility with sockets
      this.#validatePartTypeCompatibility(entityIds, errors);
    } catch (error) {
      this.#logger.error(
        'GraphIntegrityValidator: Unexpected error during validation',
        { error }
      );
      errors.push(`Validation error: ${error.message}`);
    }

    const valid = errors.length === 0;

    if (!valid) {
      this.#logger.error(
        `GraphIntegrityValidator: Validation failed with ${errors.length} errors`
      );
    } else if (warnings.length > 0) {
      this.#logger.warn(
        `GraphIntegrityValidator: Validation passed with ${warnings.length} warnings`
      );
    } else {
      this.#logger.debug(
        'GraphIntegrityValidator: Validation passed without issues'
      );
    }

    return { valid, errors, warnings };
  }

  /**
   * Validates that socket occupancy doesn't exceed maxCount
   *
   * @param entityIds
   * @param socketOccupancy
   * @param errors
   * @private
   */
  #validateSocketLimits(entityIds, socketOccupancy, errors) {
    for (const [socketKey, occupancy] of socketOccupancy.entries()) {
      const [parentId, socketId] = socketKey.split(':');

      // Get socket definition
      const socketsComponent = this.#entityManager.getComponentData(
        parentId,
        'anatomy:sockets'
      );
      const socket = socketsComponent?.sockets?.find((s) => s.id === socketId);

      if (!socket) {
        errors.push(`Socket '${socketId}' not found on entity '${parentId}'`);
        continue;
      }

      const maxCount = socket.maxCount !== undefined ? socket.maxCount : 1;
      if (occupancy > maxCount) {
        errors.push(
          `Socket '${socketId}' on entity '${parentId}' exceeds maxCount: ${occupancy} > ${maxCount}`
        );
      }
    }
  }

  /**
   * Validates recipe requires/excludes constraints
   *
   * @param entityIds
   * @param recipe
   * @param errors
   * @param warnings
   * @private
   */
  async #validateRecipeConstraints(entityIds, recipe, errors, warnings) {
    // Build a set of all part types in the graph
    const presentPartTypes = new Set();
    const presentComponents = new Set();
    const partTypeCounts = new Map(); // Track counts of each part type

    for (const entityId of entityIds) {
      const entity = this.#entityManager.getEntityInstance(entityId);

      // Add part type
      const anatomyPart = this.#entityManager.getComponentData(
        entityId,
        'anatomy:part'
      );
      if (anatomyPart?.subType) {
        presentPartTypes.add(anatomyPart.subType);
        // Count occurrences of each part type
        partTypeCounts.set(
          anatomyPart.subType,
          (partTypeCounts.get(anatomyPart.subType) || 0) + 1
        );
      }

      // Add all components (for tag checking)
      const componentTypes =
        this.#entityManager.getAllComponentTypesForEntity(entityId);
      if (componentTypes) {
        for (const componentId of componentTypes) {
          presentComponents.add(componentId);
        }
      }
    }

    // Check 'requires' constraints
    if (recipe.constraints?.requires) {
      for (const constraint of recipe.constraints.requires) {
        // Handle nested format with components and partTypes
        const requiredComponents = constraint.components || [];
        const requiredPartTypes = constraint.partTypes || [];

        // Check if any required part types are present
        const presentPartTypesFromConstraint = requiredPartTypes.filter((pt) =>
          presentPartTypes.has(pt)
        );
        const hasRequiredPartType = presentPartTypesFromConstraint.length > 0;

        // If we have the required part type, check for required components
        if (hasRequiredPartType && requiredComponents.length > 0) {
          const missingComponents = requiredComponents.filter(
            (c) => !presentComponents.has(c)
          );
          if (missingComponents.length > 0) {
            errors.push(`Required constraint group not fully satisfied`);
          }
        }
      }
    }

    // Check 'excludes' constraints
    if (recipe.constraints?.excludes) {
      for (const constraint of recipe.constraints.excludes) {
        // Handle nested format with components array
        const excludedComponents = constraint.components || constraint;
        const presentExcluded = Array.isArray(excludedComponents)
          ? excludedComponents.filter((c) => presentComponents.has(c))
          : [];

        if (presentExcluded.length > 1) {
          errors.push(`Exclusion constraint violated`);
        }
      }
    }

    // Check slot count constraints
    if (recipe.slots) {
      for (const [slotKey, slot] of Object.entries(recipe.slots)) {
        const partType = slot.type || slot.partType;
        const actualCount = partTypeCounts.get(partType) || 0;

        if (slot.count !== undefined) {
          // Handle both number and object formats
          if (typeof slot.count === 'number') {
            if (actualCount !== slot.count) {
              errors.push(
                `Expected ${slot.count} parts of type '${partType}' but found ${actualCount}`
              );
            }
          } else if (typeof slot.count === 'object') {
            if (
              slot.count.exact !== undefined &&
              actualCount !== slot.count.exact
            ) {
              errors.push(
                `Expected ${slot.count.exact} parts of type '${partType}' but found ${actualCount}`
              );
            } else if (
              slot.count.min !== undefined &&
              actualCount < slot.count.min
            ) {
              errors.push(
                `Expected at least ${slot.count.min} parts of type '${partType}' but found ${actualCount}`
              );
            } else if (
              slot.count.max !== undefined &&
              actualCount > slot.count.max
            ) {
              errors.push(
                `Expected at most ${slot.count.max} parts of type '${partType}' but found ${actualCount}`
              );
            }
          }
        }
      }
    }
  }

  /**
   * Validates that the graph has no cycles
   *
   * @param entityIds
   * @param errors
   * @private
   */
  #validateNoCycles(entityIds, errors) {
    const visited = new Set();
    const recursionStack = new Set();

    const hasCycle = (entityId) => {
      visited.add(entityId);
      recursionStack.add(entityId);

      // Find children (entities that have this as parent in their joint)
      const children = entityIds.filter((id) => {
        const joint = this.#entityManager.getComponentData(id, 'anatomy:joint');
        return joint?.parentId === entityId;
      });

      for (const childId of children) {
        if (!visited.has(childId)) {
          if (hasCycle(childId)) {
            return true;
          }
        } else if (recursionStack.has(childId)) {
          errors.push(`Cycle detected in anatomy graph`);
          return true;
        }
      }

      recursionStack.delete(entityId);
      return false;
    };

    // Check each entity that could be a root (no joint component)
    for (const entityId of entityIds) {
      const joint = this.#entityManager.getComponentData(
        entityId,
        'anatomy:joint'
      );
      if (!joint && !visited.has(entityId)) {
        hasCycle(entityId);
      }
    }

    // Also check any unvisited entities (important for detecting cycles with no roots)
    for (const entityId of entityIds) {
      if (!visited.has(entityId)) {
        hasCycle(entityId);
      }
    }
  }

  /**
   * Validates joint consistency
   *
   * @param entityIds
   * @param errors
   * @private
   */
  #validateJointConsistency(entityIds, errors) {
    for (const entityId of entityIds) {
      const joint = this.#entityManager.getComponentData(
        entityId,
        'anatomy:joint'
      );
      if (!joint) continue;

      // Check for incomplete joint data
      if (!joint.parentId || !joint.socketId) {
        errors.push(`Entity '${entityId}' has incomplete joint data`);
        continue;
      }

      // Check parent exists
      if (!entityIds.includes(joint.parentId)) {
        errors.push(
          `Entity '${entityId}' has joint referencing non-existent parent '${joint.parentId}'`
        );
        continue;
      }

      // Check socket exists on parent
      const parentSockets = this.#entityManager.getComponentData(
        joint.parentId,
        'anatomy:sockets'
      );
      const socket = parentSockets?.sockets?.find(
        (s) => s.id === joint.socketId
      );

      if (!socket) {
        errors.push(
          `Entity '${entityId}' attached to non-existent socket '${joint.socketId}' on parent '${joint.parentId}'`
        );
      }
    }
  }

  /**
   * Checks for orphaned parts (parts with joints to entities not in the graph)
   *
   * @param entityIds
   * @param errors
   * @param warnings
   * @private
   */
  #validateNoOrphans(entityIds, errors, warnings) {
    const entityIdSet = new Set(entityIds);
    const rootEntities = [];

    for (const entityId of entityIds) {
      const joint = this.#entityManager.getComponentData(
        entityId,
        'anatomy:joint'
      );
      if (joint && !entityIdSet.has(joint.parentId)) {
        errors.push(
          `Orphaned part '${entityId}' has parent '${joint.parentId}' not in graph`
        );
      }

      // Track root entities (no joint component)
      if (!joint) {
        rootEntities.push(entityId);
      }
    }

    // Check for multiple roots
    if (rootEntities.length > 1) {
      warnings.push(`Multiple root entities found: ${rootEntities.join(', ')}`);
    }
  }

  /**
   * Validates that attached parts match socket allowed types
   *
   * @param entityIds
   * @param errors
   * @private
   */
  #validatePartTypeCompatibility(entityIds, errors) {
    for (const entityId of entityIds) {
      const joint = this.#entityManager.getComponentData(
        entityId,
        'anatomy:joint'
      );
      if (!joint) continue;

      // Get part type
      const anatomyPart = this.#entityManager.getComponentData(
        entityId,
        'anatomy:part'
      );
      if (!anatomyPart?.subType) continue;

      // Get parent socket
      const parentSockets = this.#entityManager.getComponentData(
        joint.parentId,
        'anatomy:sockets'
      );
      const socket = parentSockets?.sockets?.find(
        (s) => s.id === joint.socketId
      );

      if (!socket) continue;

      // Check if part type is allowed (handle wildcard '*')
      if (
        !socket.allowedTypes.includes('*') &&
        !socket.allowedTypes.includes(anatomyPart.subType)
      ) {
        errors.push(
          `Part type '${anatomyPart.subType}' not allowed in socket '${joint.socketId}' on entity '${joint.parentId}'`
        );
      }
    }
  }
}

export default GraphIntegrityValidator;
