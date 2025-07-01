// src/anatomy/bodyBlueprintFactory.js

/**
 * @file Factory service that combines anatomy blueprints with recipes to create entity graphs
 */

import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
import { ValidationError } from '../errors/validationError.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/systemEventIds.js';
import { safeDispatchEvent } from '../utils/safeDispatchEvent.js';

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../ports/IIdGenerator.js').IIdGenerator} IIdGenerator */

/**
 * @typedef {object} AnatomyRecipe
 * @property {string} recipeId
 * @property {Object<string, SlotDefinition>} slots
 * @property {object} [constraints]
 * @property {Array<Array<string>>} [constraints.requires]
 * @property {Array<Array<string>>} [constraints.excludes]
 */

/**
 * @typedef {object} SlotDefinition
 * @property {string} partType
 * @property {string} [preferId]
 * @property {string[]} [tags]
 * @property {string[]} [notTags]
 * @property {{min?: number, max?: number, exact?: number}} [count]
 */

/**
 * @typedef {object} AnatomyBlueprint
 * @property {string} root
 * @property {Array<{parent: string, socket: string, child: string}>} [attachments]
 */

/**
 * @typedef {object} Socket
 * @property {string} id
 * @property {string[]} allowedTypes
 * @property {number} [maxCount]
 * @property {string} [orientation]
 * @property {string} [nameTpl]
 */

/**
 * Factory service that assembles anatomy entity graphs from blueprints and recipes
 */
export class BodyBlueprintFactory {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {IDataRegistry} */
  #dataRegistry;
  /** @type {ILogger} */
  #logger;
  /** @type {ISafeEventDispatcher} */
  #eventDispatcher;
  /** @type {IIdGenerator} */
  #idGenerator;
  /** @type {import('./graphIntegrityValidator.js').GraphIntegrityValidator} */
  #validator;

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {IDataRegistry} deps.dataRegistry
   * @param {ILogger} deps.logger
   * @param {ISafeEventDispatcher} deps.eventDispatcher
   * @param {IIdGenerator} deps.idGenerator
   * @param {import('./graphIntegrityValidator.js').GraphIntegrityValidator} deps.validator
   */
  constructor({
    entityManager,
    dataRegistry,
    logger,
    eventDispatcher,
    idGenerator,
    validator,
  }) {
    if (!entityManager)
      throw new InvalidArgumentError('entityManager is required');
    if (!dataRegistry)
      throw new InvalidArgumentError('dataRegistry is required');
    if (!logger) throw new InvalidArgumentError('logger is required');
    if (!eventDispatcher)
      throw new InvalidArgumentError('eventDispatcher is required');
    if (!idGenerator) throw new InvalidArgumentError('idGenerator is required');
    if (!validator) throw new InvalidArgumentError('validator is required');

    this.#entityManager = entityManager;
    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
    this.#eventDispatcher = eventDispatcher;
    this.#idGenerator = idGenerator;
    this.#validator = validator;
  }

  /**
   * Creates an anatomy entity graph from a blueprint and recipe
   *
   * @param {string} blueprintId - Namespaced ID of the blueprint
   * @param {string} recipeId - Namespaced ID of the recipe
   * @param {object} [options]
   * @param {number} [options.seed] - Random seed for reproducible generation
   * @param {string} [options.ownerId] - Entity ID that will own this anatomy
   * @returns {Promise<{rootId: string, entities: string[]}>} Root entity ID and all created entity IDs
   */
  async createAnatomyGraph(blueprintId, recipeId, options = {}) {
    try {
      this.#logger.debug(
        `BodyBlueprintFactory: Creating anatomy graph from blueprint '${blueprintId}' and recipe '${recipeId}'`
      );

      // Load blueprint and recipe
      const blueprint = this.#loadBlueprint(blueprintId);
      const recipe = this.#loadRecipe(recipeId);

      // Merge blueprint defaults with recipe overrides
      const mergedRecipe = this.#mergeRecipeWithBlueprintDefaults(
        recipe,
        blueprint
      );

      // Initialize tracking structures
      const createdEntities = [];
      const partCounts = new Map(); // Track counts per part type
      const socketOccupancy = new Map(); // Track socket usage
      const rng = this.#createRNG(options.seed);

      // Phase 1: Create root entity
      const rootId = this.#createRootEntity(
        blueprint.root,
        mergedRecipe,
        options.ownerId
      );
      createdEntities.push(rootId);

      // Phase 2: Process blueprint slots if defined
      if (blueprint.slots) {
        await this.#processBlueprintSlots(
          blueprint,
          mergedRecipe,
          rootId,
          createdEntities,
          partCounts,
          socketOccupancy,
          rng
        );
      }

      // Phase 4: Validate the assembled graph
      const validationResult = await this.#validator.validateGraph(
        createdEntities,
        mergedRecipe,
        socketOccupancy
      );

      if (!validationResult.valid) {
        // Clean up created entities on validation failure
        await this.#cleanupEntities(createdEntities);
        throw new ValidationError(
          `Anatomy graph validation failed: ${validationResult.errors.join(', ')}`
        );
      }

      this.#logger.info(
        `BodyBlueprintFactory: Successfully created anatomy graph with ${createdEntities.length} entities`
      );

      return {
        rootId,
        entities: createdEntities,
      };
    } catch (error) {
      this.#logger.error(
        `BodyBlueprintFactory: Failed to create anatomy graph`,
        { error }
      );
      this.#eventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        error: error.message,
        context: 'BodyBlueprintFactory.createAnatomyGraph',
      });
      throw error;
    }
  }

  /**
   * Loads a blueprint from the registry
   *
   * @param {string} blueprintId - The blueprint ID to load
   * @private
   * @returns {AnatomyBlueprint} The loaded blueprint
   */
  #loadBlueprint(blueprintId) {
    const blueprint = this.#dataRegistry.get('anatomyBlueprints', blueprintId);
    if (!blueprint) {
      throw new InvalidArgumentError(
        `Blueprint '${blueprintId}' not found in registry`
      );
    }
    return blueprint;
  }

  /**
   * Loads a recipe from the registry
   *
   * @param {string} recipeId - The recipe ID to load
   * @private
   * @returns {AnatomyRecipe} The loaded recipe
   */
  #loadRecipe(recipeId) {
    const recipe = this.#dataRegistry.get('anatomyRecipes', recipeId);
    if (!recipe) {
      throw new InvalidArgumentError(
        `Recipe '${recipeId}' not found in registry`
      );
    }
    return recipe;
  }

  /**
   * Merges recipe with blueprint's default slots
   *
   * @param {AnatomyRecipe} recipe - The recipe to merge
   * @param {AnatomyBlueprint} blueprint - The blueprint with defaults
   * @private
   * @returns {AnatomyRecipe} The merged recipe
   */
  #mergeRecipeWithBlueprintDefaults(recipe, blueprint) {
    // If blueprint has no default slots, return recipe as-is
    if (!blueprint.defaultSlots) {
      return recipe;
    }

    // Create a deep copy of the recipe to avoid modifying the original
    const mergedRecipe = JSON.parse(JSON.stringify(recipe));

    // Merge blueprint defaults with recipe slots
    for (const [slotKey, defaultSlot] of Object.entries(
      blueprint.defaultSlots
    )) {
      if (!mergedRecipe.slots[slotKey]) {
        // Recipe doesn't define this slot, use blueprint default
        mergedRecipe.slots[slotKey] = defaultSlot;
      } else {
        // Recipe defines this slot, but we can still merge some defaults
        const recipeSlot = mergedRecipe.slots[slotKey];

        // If recipe doesn't specify count, use blueprint default
        if (!recipeSlot.count && defaultSlot.count) {
          recipeSlot.count = defaultSlot.count;
        }

        // If recipe doesn't specify tags, use blueprint default
        if (!recipeSlot.tags && defaultSlot.tags) {
          recipeSlot.tags = defaultSlot.tags;
        }

        // If recipe doesn't specify notTags, use blueprint default
        if (!recipeSlot.notTags && defaultSlot.notTags) {
          recipeSlot.notTags = defaultSlot.notTags;
        }

        // If recipe doesn't specify preferId, use blueprint default
        if (!recipeSlot.preferId && defaultSlot.preferId) {
          recipeSlot.preferId = defaultSlot.preferId;
        }
      }
    }

    this.#logger.debug(
      `Merged recipe '${recipe.recipeId}' with blueprint defaults`,
      {
        originalSlots: Object.keys(recipe.slots),
        mergedSlots: Object.keys(mergedRecipe.slots),
      }
    );

    return mergedRecipe;
  }

  /**
   * Creates a seeded random number generator
   *
   * @param {number} [seed] - Optional seed value
   * @private
   * @returns {function(): number} Random number generator function
   */
  #createRNG(seed) {
    // Simple seedable RNG using linear congruential generator
    let state = seed || Date.now();
    return () => {
      state = (state * 1664525 + 1013904223) % 4294967296;
      return state / 4294967296;
    };
  }

  /**
   * Creates the root entity of the anatomy
   *
   * @param {string} rootDefinitionId - Definition ID for the root entity
   * @param {AnatomyRecipe} recipe - The recipe being used
   * @param {string} [ownerId] - Optional owner entity ID
   * @private
   * @returns {string} The created root entity ID
   */
  #createRootEntity(rootDefinitionId, recipe, ownerId) {
    const rootEntity =
      this.#entityManager.createEntityInstance(rootDefinitionId);

    if (ownerId) {
      // Add ownership component if specified
      this.#entityManager.addComponent(rootEntity.id, 'core:owned_by', {
        ownerId,
      });
    }

    return rootEntity.id;
  }

  /**
   * Processes blueprint slots to create the anatomy structure
   *
   * @param {AnatomyBlueprint} blueprint - The blueprint with slots
   * @param {AnatomyRecipe} recipe - The recipe with overrides
   * @param {string} rootId - The root entity ID
   * @param {string[]} createdEntities - Array to track created entities
   * @param {Map} partCounts - Map to track part counts
   * @param {Map} socketOccupancy - Map to track socket usage
   * @param {Function} rng - Random number generator
   * @private
   */
  async #processBlueprintSlots(
    blueprint,
    recipe,
    rootId,
    createdEntities,
    partCounts,
    socketOccupancy,
    rng
  ) {
    // Track entities by slot key for parent references
    const slotToEntity = new Map();
    slotToEntity.set(null, rootId); // Root has no parent slot

    // Process slots in order (parents before children)
    const sortedSlots = this.#sortSlotsByDependency(blueprint.slots);

    for (const [slotKey, slot] of sortedSlots) {
      try {
        // Determine parent entity
        const parentSlotKey = slot.parent || null;
        const parentEntityId = slotToEntity.get(parentSlotKey);
        
        if (!parentEntityId) {
          throw new ValidationError(
            `Parent slot '${slot.parent}' not found for slot '${slotKey}'`
          );
        }

        // Check if socket exists on parent
        const parentSockets = this.#entityManager.getComponentData(
          parentEntityId,
          'anatomy:sockets'
        );
        const socket = parentSockets?.sockets?.find(s => s.id === slot.socket);
        
        if (!socket) {
          const parentEntity = this.#entityManager.getEntityInstance(parentEntityId);
          throw new ValidationError(
            `Socket '${slot.socket}' not found on parent entity '${parentEntity?.definitionId || parentEntityId}'`
          );
        }

        // Check socket occupancy
        const occupancyKey = `${parentEntityId}:${slot.socket}`;
        const currentOccupancy = socketOccupancy.get(occupancyKey) || 0;
        const maxCount = socket.maxCount || 1;
        
        if (currentOccupancy >= maxCount) {
          if (!slot.optional) {
            throw new ValidationError(
              `Required socket '${slot.socket}' is already full on parent '${parentEntityId}'`
            );
          }
          continue;
        }

        // Merge blueprint requirements with recipe overrides
        const mergedRequirements = this.#mergeSlotRequirements(
          slot.requirements,
          recipe.slots?.[slotKey]
        );

        // Find matching part
        const partEntityDef = await this.#findPartByRequirements(
          mergedRequirements,
          socket,
          slotKey,
          slot.optional,
          rng
        );

        if (!partEntityDef && slot.optional) {
          continue; // Skip optional slots if no part found
        }

        if (!partEntityDef) {
          throw new ValidationError(
            `No part found for required slot '${slotKey}' with requirements: ${JSON.stringify(mergedRequirements)}`
          );
        }

        // Create and attach the part
        const childId = await this.#createAndAttachPart(
          parentEntityId,
          slot.socket,
          partEntityDef,
          recipe,
          socketOccupancy,
          rng
        );

        if (childId) {
          createdEntities.push(childId);
          slotToEntity.set(slotKey, childId);
          
          // Update counts
          const partType = this.#getPartType(childId);
          partCounts.set(partType, (partCounts.get(partType) || 0) + 1);
          socketOccupancy.set(occupancyKey, currentOccupancy + 1);
        }
      } catch (error) {
        const errorContext = {
          slotKey,
          slot,
          blueprintId: blueprint.id,
          recipeId: recipe.recipeId,
        };

        const errorMessage = 
          `Failed to process blueprint slot '${slotKey}': ${error.message}`;

        await safeDispatchEvent(
          this.#eventDispatcher,
          SYSTEM_ERROR_OCCURRED_ID,
          {
            error: errorMessage,
            context: 'BodyBlueprintFactory.processBlueprintSlots',
            details: errorContext,
          },
          this.#logger
        );

        throw new ValidationError(errorMessage);
      }
    }
  }

  /**
   * Sorts slots by dependency order (parents before children)
   *
   * @param {object} slots - The slots object from blueprint
   * @returns {Array<[string, object]>} Sorted array of [key, slot] pairs
   * @private
   */
  #sortSlotsByDependency(slots) {
    const sorted = [];
    const visited = new Set();
    const visiting = new Set();

    const visit = (key, slot) => {
      if (visited.has(key)) return;
      if (visiting.has(key)) {
        throw new ValidationError(`Circular dependency detected in blueprint slots involving '${key}'`);
      }

      visiting.add(key);

      // Visit parent first if it exists
      if (slot.parent && slots[slot.parent]) {
        visit(slot.parent, slots[slot.parent]);
      }

      visiting.delete(key);
      visited.add(key);
      sorted.push([key, slot]);
    };

    // Process all slots
    for (const [key, slot] of Object.entries(slots)) {
      visit(key, slot);
    }

    return sorted;
  }

  /**
   * Merges blueprint slot requirements with recipe overrides
   *
   * @param {object} blueprintReqs - Requirements from blueprint
   * @param {object} recipeSlot - Recipe slot overrides
   * @returns {object} Merged requirements
   * @private
   */
  #mergeSlotRequirements(blueprintReqs, recipeSlot) {
    if (!recipeSlot) return blueprintReqs;

    const merged = { ...blueprintReqs };

    // Recipe can override entityId
    if (recipeSlot.preferId) {
      merged.entityId = recipeSlot.preferId;
    }

    // Recipe can add additional required components
    if (recipeSlot.tags) {
      merged.components = [
        ...(merged.components || []),
        ...recipeSlot.tags
      ];
    }

    // Recipe can add property requirements
    if (recipeSlot.properties) {
      merged.properties = {
        ...(merged.properties || {}),
        ...recipeSlot.properties
      };
    }

    return merged;
  }

  /**
   * Finds a part entity definition by requirements
   *
   * @param {object} requirements - The requirements to match
   * @param {object} socket - The socket being filled
   * @param {string} slotKey - The slot key for error context
   * @param {boolean} optional - Whether the slot is optional
   * @param {Function} rng - Random number generator
   * @returns {Promise<string|null>} The entity definition ID or null
   * @private
   */
  async #findPartByRequirements(requirements, socket, slotKey, optional, rng) {
    // If specific entity ID is required, validate and return it
    if (requirements.entityId) {
      const entityDef = this.#dataRegistry.get('entityDefinitions', requirements.entityId);
      if (!entityDef) {
        if (!optional) {
          throw new ValidationError(
            `Required entity '${requirements.entityId}' not found for slot '${slotKey}'`
          );
        }
        return null;
      }

      // Validate it matches other requirements
      if (!this.#matchesRequirements(entityDef, requirements, socket.allowedTypes)) {
        if (!optional) {
          throw new ValidationError(
            `Entity '${requirements.entityId}' does not match requirements for slot '${slotKey}'`
          );
        }
        return null;
      }

      return requirements.entityId;
    }

    // Find candidates by requirements
    const candidates = this.#findCandidatesByRequirements(
      requirements,
      socket.allowedTypes
    );

    if (candidates.length === 0) {
      return null;
    }

    // Random selection from candidates using provided RNG
    const index = Math.floor(rng() * candidates.length);
    return candidates[index];
  }

  /**
   * Checks if an entity definition matches requirements
   *
   * @param {object} entityDef - The entity definition
   * @param {object} requirements - The requirements to check
   * @param {string[]} allowedTypes - Allowed part types from socket
   * @returns {boolean}
   * @private
   */
  #matchesRequirements(entityDef, requirements, allowedTypes) {
    // Check part type
    const anatomyPart = entityDef.components?.['anatomy:part'];
    if (!anatomyPart) return false;

    if (requirements.partType && anatomyPart.subType !== requirements.partType) {
      return false;
    }

    if (!allowedTypes.includes(anatomyPart.subType)) {
      return false;
    }

    // Check required components
    if (requirements.components) {
      for (const comp of requirements.components) {
        if (!entityDef.components[comp]) {
          return false;
        }
      }
    }

    // Check property requirements
    if (requirements.properties) {
      for (const [compId, props] of Object.entries(requirements.properties)) {
        const component = entityDef.components[compId];
        if (!component) return false;

        for (const [key, value] of Object.entries(props)) {
          if (component[key] !== value) {
            return false;
          }
        }
      }
    }

    return true;
  }

  /**
   * Finds all candidate parts matching requirements
   *
   * @param {object} requirements - The requirements
   * @param {string[]} allowedTypes - Allowed part types
   * @returns {string[]} Array of entity definition IDs
   * @private
   */
  #findCandidatesByRequirements(requirements, allowedTypes) {
    const candidates = [];
    const allEntityDefs = this.#dataRegistry.getAll('entityDefinitions');

    for (const entityDef of allEntityDefs) {
      if (this.#matchesRequirements(entityDef, requirements, allowedTypes)) {
        candidates.push(entityDef.id);
      }
    }

    return candidates;
  }


  /**
   * Selects a part definition based on requirements
   *
   * @param requirements
   * @param socketId
   * @param recipe
   * @param rng
   * @private
   * @returns {Promise<string|null>} The selected part definition ID or null
   */
  async #selectPartByRequirements(requirements, socketId, recipe, rng) {
    // First check if there's a recipe override for this socket
    // Find recipe slot that matches this socket type
    for (const [slotKey, slot] of Object.entries(recipe.slots)) {
      if (slot.partType === requirements.partType) {
        // Recipe has a preference for this part type
        if (slot.preferId) {
          // Verify the preferred part meets the requirements
          const entityDef = this.#dataRegistry.get(
            'entityDefinitions',
            slot.preferId
          );
          if (
            entityDef &&
            this.#meetsRequirements(entityDef, requirements, slot)
          ) {
            return slot.preferId;
          }
        }
      }
    }

    // No recipe override or it didn't meet requirements, find candidates
    const candidates = [];

    // Get all entity definitions to find anatomy parts
    const allEntityDefs = this.#dataRegistry.getAll('entityDefinitions');

    for (const entityDef of allEntityDefs) {
      // Skip if not an anatomy part
      if (!entityDef.components || !entityDef.components['anatomy:part'])
        continue;

      // Check if this part meets the requirements
      if (this.#meetsRequirements(entityDef, requirements)) {
        candidates.push(entityDef.id);
      }
    }

    if (candidates.length === 0) {
      const errorContext = {
        socketId,
        requirements: {
          partType: requirements.partType,
          entityId: requirements.entityId,
          components: requirements.components || [],
        },
        checkedDefinitions: allEntityDefs.filter(
          (def) => def.components?.['anatomy:part']
        ).length,
        suggestion:
          `Create an entity definition with 'anatomy:part' component` +
          (requirements.partType
            ? ` where subType='${requirements.partType}'`
            : '') +
          (requirements.components?.length > 0
            ? ` and components: [${requirements.components.join(', ')}]`
            : ''),
      };

      const errorMessage =
        `No entity definitions found matching requirements for socket '${socketId}'. ` +
        (requirements.partType
          ? `Need part type: '${requirements.partType}'. `
          : '') +
        (requirements.entityId
          ? `Preferred entity: '${requirements.entityId}'. `
          : '') +
        (requirements.components?.length > 0
          ? `Required components: [${requirements.components.join(', ')}]. `
          : '') +
        `Checked ${errorContext.checkedDefinitions} anatomy part definitions.`;

      // Dispatch system error event
      await safeDispatchEvent(
        this.#eventDispatcher,
        SYSTEM_ERROR_OCCURRED_ID,
        {
          error: errorMessage,
          context: 'BodyBlueprintFactory.selectPartByRequirements',
          details: errorContext,
        },
        this.#logger
      );

      return null;
    }

    // Prefer specific entity ID if provided
    if (requirements.entityId && candidates.includes(requirements.entityId)) {
      return requirements.entityId;
    }

    // Random selection from candidates
    const index = Math.floor(rng() * candidates.length);
    return candidates[index];
  }

  /**
   * Checks if an entity definition meets the given requirements
   *
   * @param entityDef
   * @param requirements
   * @param recipeSlot
   * @private
   * @returns {boolean}
   */
  #meetsRequirements(entityDef, requirements, recipeSlot = null) {
    // Check part type if specified
    if (requirements.partType) {
      const anatomyPart = entityDef.components['anatomy:part'];
      if (!anatomyPart || anatomyPart.subType !== requirements.partType) {
        return false;
      }
    }

    // Check required components
    if (requirements.components && requirements.components.length > 0) {
      const hasAllComponents = requirements.components.every(
        (comp) => entityDef.components[comp] !== undefined
      );
      if (!hasAllComponents) {
        return false;
      }
    }

    // If recipe slot provided, check its additional constraints
    if (recipeSlot) {
      // Check recipe tags
      if (recipeSlot.tags && recipeSlot.tags.length > 0) {
        const hasAllTags = recipeSlot.tags.every(
          (tag) => entityDef.components[tag] !== undefined
        );
        if (!hasAllTags) return false;
      }

      // Check excluded tags
      if (recipeSlot.notTags && recipeSlot.notTags.length > 0) {
        const hasExcludedTag = recipeSlot.notTags.some(
          (tag) => entityDef.components[tag] !== undefined
        );
        if (hasExcludedTag) return false;
      }

      // Check property requirements
      if (recipeSlot.properties) {
        if (
          !this.#matchesPropertyRequirements(entityDef, recipeSlot.properties)
        ) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Checks if an entity definition's components match property requirements
   *
   * @param entityDef
   * @param propertyRequirements
   * @private
   * @returns {boolean}
   */
  #matchesPropertyRequirements(entityDef, propertyRequirements) {
    for (const [componentId, requiredProps] of Object.entries(
      propertyRequirements
    )) {
      const component = entityDef.components[componentId];
      if (!component) return false;

      // Check each required property
      for (const [propKey, propValue] of Object.entries(requiredProps)) {
        if (component[propKey] !== propValue) {
          return false;
        }
      }
    }
    return true;
  }


  /**
   * Processes child slot specifications for a created part
   *
   * @param parentId
   * @param childSlots
   * @param recipe
   * @param createdEntities
   * @param partCounts
   * @param socketOccupancy
   * @param rng
   * @private
   */
  async #processChildSlots(
    parentId,
    childSlots,
    recipe,
    createdEntities,
    partCounts,
    socketOccupancy,
    rng
  ) {
    const parentEntity = this.#entityManager.getEntityInstance(parentId);
    const socketsComponent = this.#entityManager.getComponentData(
      parentId,
      'anatomy:sockets'
    );

    if (!socketsComponent || !socketsComponent.sockets) {
      return;
    }

    // Process each specified child slot
    for (const [socketId, slotSpec] of Object.entries(childSlots)) {
      const socket = socketsComponent.sockets.find((s) => s.id === socketId);
      if (!socket) {
        this.#logger.warn(
          `Socket '${socketId}' not found on entity '${parentId}'`
        );
        continue;
      }

      const occupancyKey = `${parentId}:${socketId}`;
      const currentOccupancy = socketOccupancy.get(occupancyKey) || 0;
      const maxCount = socket.maxCount || 1;

      if (currentOccupancy >= maxCount) {
        continue;
      }

      // Determine how many parts to create
      // For childSlots, we ignore global part counts and just use the slot specification
      let desiredCount = 1; // Default
      if (slotSpec.count) {
        if (slotSpec.count.exact !== undefined) {
          desiredCount = slotSpec.count.exact;
        } else if (slotSpec.count.min !== undefined) {
          desiredCount = slotSpec.count.min;
        }
      }
      const availableSlots = maxCount - currentOccupancy;
      const toCreate = Math.min(desiredCount, availableSlots);

      // Create parts for this socket
      for (let i = 0; i < toCreate; i++) {
        const childId = await this.#createPartForSlot(
          parentId,
          socket,
          slotSpec,
          recipe,
          socketOccupancy,
          rng
        );

        if (childId) {
          createdEntities.push(childId);
          // Update counts
          const partType = this.#getPartType(childId);
          partCounts.set(partType, (partCounts.get(partType) || 0) + 1);
          socketOccupancy.set(
            occupancyKey,
            (socketOccupancy.get(occupancyKey) || 0) + 1
          );

          // Recursively process child slots of this new part
          if (slotSpec.childSlots) {
            await this.#processChildSlots(
              childId,
              slotSpec.childSlots,
              recipe,
              createdEntities,
              partCounts,
              socketOccupancy,
              rng
            );
          }
        }
      }
    }
  }

  /**
   * Finds a recipe slot that matches the socket's allowed types
   *
   * @param socket
   * @param recipe
   * @private
   */
  #findMatchingRecipeSlot(socket, recipe) {
    for (const [slotKey, slot] of Object.entries(recipe.slots)) {
      if (socket.allowedTypes.includes(slot.partType)) {
        return slot;
      }
    }
    return null;
  }

  /**
   * Calculates how many parts to create based on recipe slot configuration
   *
   * @param recipeSlot
   * @param partCounts
   * @param partType
   * @private
   */
  #calculateDesiredCount(recipeSlot, partCounts, partType) {
    const currentCount = partCounts.get(partType) || 0;

    if (recipeSlot.count) {
      if (recipeSlot.count.exact !== undefined) {
        return Math.max(0, recipeSlot.count.exact - currentCount);
      } else if (recipeSlot.count.min !== undefined) {
        return Math.max(0, recipeSlot.count.min - currentCount);
      }
    }

    // Default to 1 if no count specified
    return currentCount === 0 ? 1 : 0;
  }

  /**
   * Creates a part for a specific slot configuration
   *
   * @param parentId
   * @param socket
   * @param recipeSlot
   * @param recipe
   * @param socketOccupancy
   * @param rng
   * @private
   */
  async #createPartForSlot(
    parentId,
    socket,
    recipeSlot,
    recipe,
    socketOccupancy,
    rng
  ) {
    let candidates;

    try {
      // Build candidate list
      candidates = await this.#findCandidateParts(
        recipeSlot,
        socket.allowedTypes
      );

      // Note: findCandidateParts now throws if no candidates found,
      // so we don't need to check for empty array here
    } catch (error) {
      // Enhance error with parent/socket context
      const parentEntity = this.#entityManager.getEntityInstance(parentId);
      const enhancedContext = {
        parentEntityId: parentId,
        parentDefinitionId: parentEntity?.definitionId,
        socketId: socket.id,
        socketAllowedTypes: socket.allowedTypes,
        recipeId: recipe.recipeId,
        error: error.message,
      };

      const enhancedMessage =
        `Failed to find parts for socket '${socket.id}' on parent '${parentEntity?.definitionId || parentId}'. ` +
        `Recipe: '${recipe.recipeId}'. ${error.message}`;

      // Re-dispatch with enhanced context
      await safeDispatchEvent(
        this.#eventDispatcher,
        SYSTEM_ERROR_OCCURRED_ID,
        {
          error: enhancedMessage,
          context: 'BodyBlueprintFactory.createPartForSlot',
          details: enhancedContext,
        },
        this.#logger
      );

      throw new ValidationError(enhancedMessage);
    }

    // Select part (prefer preferId if available)
    let selectedPartId;
    if (recipeSlot.preferId && candidates.includes(recipeSlot.preferId)) {
      selectedPartId = recipeSlot.preferId;
    } else {
      // Random selection
      const index = Math.floor(rng() * candidates.length);
      selectedPartId = candidates[index];
    }

    // Create and attach the part
    return this.#createAndAttachPart(
      parentId,
      socket.id,
      selectedPartId,
      recipe,
      socketOccupancy,
      rng
    );
  }

  /**
   * Finds candidate parts that match slot requirements
   *
   * @param recipeSlot
   * @param allowedTypes
   * @private
   */
  async #findCandidateParts(recipeSlot, allowedTypes) {
    const candidates = [];

    // Get all entity definitions to find anatomy parts
    const allEntityDefs = this.#dataRegistry.getAll('entityDefinitions');

    for (const entityDef of allEntityDefs) {
      // Check if this is an anatomy part
      const anatomyPart = entityDef.components?.['anatomy:part'];
      if (!anatomyPart || !allowedTypes.includes(anatomyPart.subType)) continue;

      // Check required tags
      if (recipeSlot.tags && recipeSlot.tags.length > 0) {
        const hasAllTags = recipeSlot.tags.every(
          (tag) => entityDef.components[tag] !== undefined
        );
        if (!hasAllTags) continue;
      }

      // Check excluded tags
      if (recipeSlot.notTags && recipeSlot.notTags.length > 0) {
        const hasExcludedTag = recipeSlot.notTags.some(
          (tag) => entityDef.components[tag] !== undefined
        );
        if (hasExcludedTag) continue;
      }

      // Check property requirements
      if (recipeSlot.properties) {
        if (
          !this.#matchesPropertyRequirements(entityDef, recipeSlot.properties)
        ) {
          continue;
        }
      }

      candidates.push(entityDef.id);
    }

    // If no candidates found, this is a critical error that needs immediate attention
    if (candidates.length === 0) {
      const errorContext = {
        partType: recipeSlot.partType,
        allowedTypes: allowedTypes,
        requirements: {
          tags: recipeSlot.tags || [],
          notTags: recipeSlot.notTags || [],
          properties: recipeSlot.properties || {},
          preferId: recipeSlot.preferId || null,
        },
        checkedDefinitions: allEntityDefs.length,
        suggestion: `Create an entity definition with 'anatomy:part' component where subType is one of: [${allowedTypes.join(', ')}]`,
      };

      const errorMessage =
        `No entity definitions found matching anatomy requirements. ` +
        `Need part type '${recipeSlot.partType}' with allowed types: [${allowedTypes.join(', ')}]. ` +
        (recipeSlot.tags?.length > 0
          ? `Required tags: [${recipeSlot.tags.join(', ')}]. `
          : '') +
        (recipeSlot.notTags?.length > 0
          ? `Excluded tags: [${recipeSlot.notTags.join(', ')}]. `
          : '') +
        (recipeSlot.properties
          ? `Required properties: ${JSON.stringify(recipeSlot.properties)}. `
          : '') +
        `Checked ${allEntityDefs.length} entity definitions.`;

      // Dispatch system error event
      await safeDispatchEvent(
        this.#eventDispatcher,
        SYSTEM_ERROR_OCCURRED_ID,
        {
          error: errorMessage,
          context: 'BodyBlueprintFactory.findCandidateParts',
          details: errorContext,
        },
        this.#logger
      );

      // Throw error for caller to handle
      throw new ValidationError(errorMessage);
    }

    return candidates;
  }

  /**
   * Creates and attaches a part to a parent via a socket
   *
   * @param parentId
   * @param socketId
   * @param partDefinitionId
   * @param recipe
   * @param socketOccupancy
   * @param rng
   * @private
   */
  async #createAndAttachPart(
    parentId,
    socketId,
    partDefinitionId,
    recipe,
    socketOccupancy,
    rng
  ) {
    try {
      // Get socket details from parent
      const parentSockets = this.#entityManager.getComponentData(
        parentId,
        'anatomy:sockets'
      );
      const socket = parentSockets?.sockets?.find((s) => s.id === socketId);

      if (!socket) {
        this.#logger.error(
          `Socket '${socketId}' not found on parent entity '${parentId}'`
        );
        return null;
      }

      // Create the child entity
      const childEntity =
        this.#entityManager.createEntityInstance(partDefinitionId);

      // Add joint component to establish the connection
      this.#entityManager.addComponent(childEntity.id, 'anatomy:joint', {
        parentId: parentId,
        socketId: socketId,
      });

      // Generate and set name if template provided
      if (socket.nameTpl) {
        const name = this.#generatePartName(socket, childEntity, parentId);
        this.#entityManager.addComponent(childEntity.id, 'core:name', {
          text: name,
        });
      }

      return childEntity.id;
    } catch (error) {
      this.#logger.error(
        `Failed to create and attach part '${partDefinitionId}'`,
        { error }
      );
      return null;
    }
  }

  /**
   * Generates a name for a part based on socket template
   *
   * @param socket
   * @param childEntity
   * @param parentId
   * @private
   */
  #generatePartName(socket, childEntity, parentId) {
    let name = socket.nameTpl;

    // Get part info
    const anatomyPart = this.#entityManager.getComponentData(
      childEntity.id,
      'anatomy:part'
    );
    const parentName =
      this.#entityManager.getComponentData(parentId, 'core:name')?.value ||
      'parent';

    // Replace template tokens
    name = name.replace('{{orientation}}', socket.orientation || '');
    name = name.replace('{{type}}', anatomyPart?.subType || 'part');
    name = name.replace('{{parent.name}}', parentName);

    // TODO: Handle {{index}} for multiple parts of same type
    name = name.replace('{{index}}', '');

    return name.trim();
  }

  /**
   * Gets the part type from an entity
   *
   * @param entityId
   * @private
   */
  #getPartType(entityId) {
    const anatomyPart = this.#entityManager.getComponentData(
      entityId,
      'anatomy:part'
    );
    return anatomyPart?.subType || 'unknown';
  }

  /**
   * Cleans up entities if validation fails
   *
   * @param entityIds
   * @private
   */
  async #cleanupEntities(entityIds) {
    this.#logger.debug(
      `Cleaning up ${entityIds.length} entities after validation failure`
    );

    // Remove in reverse order to handle dependencies
    for (let i = entityIds.length - 1; i >= 0; i--) {
      try {
        await this.#entityManager.removeEntity(entityIds[i]);
      } catch (error) {
        this.#logger.error(`Failed to cleanup entity '${entityIds[i]}'`, {
          error,
        });
      }
    }
  }
}

export default BodyBlueprintFactory;
