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
    if (!entityManager) throw new InvalidArgumentError('entityManager is required');
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

    this.#logger.debug(`GraphIntegrityValidator: Validating graph with ${entityIds.length} entities`);

    try {
      // 1. Validate socket occupancy limits
      this.#validateSocketLimits(entityIds, socketOccupancy, errors);

      // 2. Validate recipe constraints
      await this.#validateRecipeConstraints(entityIds, recipe, errors, warnings);

      // 3. Check for cycles
      this.#validateNoCycles(entityIds, errors);

      // 4. Validate joint consistency
      this.#validateJointConsistency(entityIds, errors);

      // 5. Check for orphaned parts
      this.#validateNoOrphans(entityIds, errors, warnings);

      // 6. Validate part type compatibility with sockets
      this.#validatePartTypeCompatibility(entityIds, errors);

    } catch (error) {
      this.#logger.error('GraphIntegrityValidator: Unexpected error during validation', { error });
      errors.push(`Validation error: ${error.message}`);
    }

    const valid = errors.length === 0;
    
    if (!valid) {
      this.#logger.error(`GraphIntegrityValidator: Validation failed with ${errors.length} errors`);
    } else if (warnings.length > 0) {
      this.#logger.warn(`GraphIntegrityValidator: Validation passed with ${warnings.length} warnings`);
    } else {
      this.#logger.debug('GraphIntegrityValidator: Validation passed without issues');
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
      const socketsComponent = this.#entityManager.getComponentData(parentId, 'anatomy:sockets');
      const socket = socketsComponent?.sockets?.find(s => s.id === socketId);
      
      if (!socket) {
        errors.push(`Socket '${socketId}' not found on entity '${parentId}'`);
        continue;
      }

      const maxCount = socket.maxCount || 1;
      if (occupancy > maxCount) {
        errors.push(`Socket '${socketId}' on entity '${parentId}' exceeds maxCount: ${occupancy} > ${maxCount}`);
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
    if (!recipe.constraints) return;

    // Build a set of all part types in the graph
    const presentPartTypes = new Set();
    const presentComponents = new Set();

    for (const entityId of entityIds) {
      const entity = this.#entityManager.getEntityInstance(entityId);
      
      // Add part type
      const anatomyPart = this.#entityManager.getComponentData(entityId, 'anatomy:part');
      if (anatomyPart?.subType) {
        presentPartTypes.add(anatomyPart.subType);
      }

      // Add all components (for tag checking)
      const components = this.#entityManager.getComponentsForEntity(entityId);
      for (const componentId of Object.keys(components)) {
        presentComponents.add(componentId);
      }
    }

    // Check 'requires' constraints
    if (recipe.constraints.requires) {
      for (const group of recipe.constraints.requires) {
        const present = group.filter(id => presentComponents.has(id) || presentPartTypes.has(id));
        
        if (present.length > 0 && present.length < group.length) {
          const missing = group.filter(id => !presentComponents.has(id) && !presentPartTypes.has(id));
          errors.push(`Co-presence constraint violated: have [${present.join(', ')}] but missing [${missing.join(', ')}]`);
        }
      }
    }

    // Check 'excludes' constraints
    if (recipe.constraints.excludes) {
      for (const group of recipe.constraints.excludes) {
        const present = group.filter(id => presentComponents.has(id) || presentPartTypes.has(id));
        
        if (present.length > 1) {
          errors.push(`Mutual exclusion constraint violated: cannot have both [${present.join(', ')}]`);
        }
      }
    }

    // Check soft count constraints
    if (recipe.slots) {
      for (const [slotKey, slot] of Object.entries(recipe.slots)) {
        const actualCount = [...presentPartTypes].filter(type => type === slot.partType).length;
        
        if (slot.count) {
          if (slot.count.exact !== undefined && actualCount !== slot.count.exact) {
            warnings.push(`Slot '${slotKey}' wanted exactly ${slot.count.exact} '${slot.partType}' parts but got ${actualCount}`);
          } else if (slot.count.min !== undefined && actualCount < slot.count.min) {
            warnings.push(`Slot '${slotKey}' wanted at least ${slot.count.min} '${slot.partType}' parts but got ${actualCount}`);
          } else if (slot.count.max !== undefined && actualCount > slot.count.max) {
            warnings.push(`Slot '${slotKey}' wanted at most ${slot.count.max} '${slot.partType}' parts but got ${actualCount}`);
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
      const children = entityIds.filter(id => {
        const joint = this.#entityManager.getComponentData(id, 'anatomy:joint');
        return joint?.parentId === entityId;
      });

      for (const childId of children) {
        if (!visited.has(childId)) {
          if (hasCycle(childId)) {
            return true;
          }
        } else if (recursionStack.has(childId)) {
          errors.push(`Cycle detected: ${entityId} -> ${childId}`);
          return true;
        }
      }

      recursionStack.delete(entityId);
      return false;
    };

    // Check each entity that could be a root (no joint component)
    for (const entityId of entityIds) {
      const joint = this.#entityManager.getComponentData(entityId, 'anatomy:joint');
      if (!joint && !visited.has(entityId)) {
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
      const joint = this.#entityManager.getComponentData(entityId, 'anatomy:joint');
      if (!joint) continue;

      // Check parent exists
      if (!entityIds.includes(joint.parentId)) {
        errors.push(`Entity '${entityId}' has joint referencing non-existent parent '${joint.parentId}'`);
        continue;
      }

      // Check socket exists on parent
      const parentSockets = this.#entityManager.getComponentData(joint.parentId, 'anatomy:sockets');
      const socket = parentSockets?.sockets?.find(s => s.id === joint.socketId);
      
      if (!socket) {
        errors.push(`Entity '${entityId}' attached to non-existent socket '${joint.socketId}' on parent '${joint.parentId}'`);
      }

      // Validate joint type matches socket
      if (socket && joint.jointType !== socket.jointType) {
        errors.push(`Joint type mismatch: entity '${entityId}' has '${joint.jointType}' but socket specifies '${socket.jointType}'`);
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
    
    for (const entityId of entityIds) {
      const joint = this.#entityManager.getComponentData(entityId, 'anatomy:joint');
      if (joint && !entityIdSet.has(joint.parentId)) {
        warnings.push(`Entity '${entityId}' is orphaned - parent '${joint.parentId}' not in graph`);
      }
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
      const joint = this.#entityManager.getComponentData(entityId, 'anatomy:joint');
      if (!joint) continue;

      // Get part type
      const anatomyPart = this.#entityManager.getComponentData(entityId, 'anatomy:part');
      if (!anatomyPart?.subType) continue;

      // Get parent socket
      const parentSockets = this.#entityManager.getComponentData(joint.parentId, 'anatomy:sockets');
      const socket = parentSockets?.sockets?.find(s => s.id === joint.socketId);
      
      if (!socket) continue;

      // Check if part type is allowed
      if (!socket.allowedTypes.includes(anatomyPart.subType)) {
        errors.push(
          `Part type '${anatomyPart.subType}' on entity '${entityId}' not allowed in socket '${joint.socketId}' ` +
          `(allowed: [${socket.allowedTypes.join(', ')}])`
        );
      }
    }
  }
}

export default GraphIntegrityValidator;