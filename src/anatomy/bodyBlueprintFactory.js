// src/anatomy/bodyBlueprintFactory.js

/**
 * @file Factory service that combines anatomy blueprints with recipes to create entity graphs
 */

import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
import { ValidationError } from '../errors/validationError.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/systemEventIds.js';

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
 * @property {string} [jointType]
 * @property {number} [breakThreshold]
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

      // Phase 2: Process static attachments from blueprint
      if (blueprint.attachments) {
        await this.#processStaticAttachments(
          blueprint.attachments,
          mergedRecipe,
          createdEntities,
          socketOccupancy,
          rng
        );
      }

      // Phase 3: Fill remaining sockets depth-first
      await this.#fillSockets(
        rootId,
        mergedRecipe,
        createdEntities,
        partCounts,
        socketOccupancy,
        rng
      );

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
      this.#eventDispatcher.dispatch({
        type: SYSTEM_ERROR_OCCURRED_ID,
        payload: {
          error: error.message,
          context: 'BodyBlueprintFactory.createAnatomyGraph',
        },
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
      { originalSlots: Object.keys(recipe.slots), mergedSlots: Object.keys(mergedRecipe.slots) }
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
      this.#entityManager.addComponent(rootEntity.id, 'anatomy:owned_by', {
        ownerId,
      });
    }

    return rootEntity.id;
  }

  /**
   * Processes static attachments defined in the blueprint
   *
   * @param attachments
   * @param recipe
   * @param createdEntities
   * @param socketOccupancy
   * @param rng
   * @private
   */
  async #processStaticAttachments(
    attachments,
    recipe,
    createdEntities,
    socketOccupancy,
    rng
  ) {
    for (const attachment of attachments) {
      const parentEntity = createdEntities.find((id) => {
        const entity = this.#entityManager.getEntityInstance(id);
        return entity.definitionId === attachment.parent;
      });

      if (!parentEntity) {
        this.#logger.warn(
          `Static attachment parent '${attachment.parent}' not found in created entities`
        );
        continue;
      }

      let childDefinitionId;

      // Handle old format (direct child reference)
      if (attachment.child) {
        childDefinitionId = attachment.child;
      }
      // Handle new format (component-based requirements)
      else if (attachment.requirements) {
        childDefinitionId = await this.#selectPartByRequirements(
          attachment.requirements,
          attachment.socket,
          recipe,
          rng
        );

        if (!childDefinitionId) {
          this.#logger.warn(
            `No part found matching requirements for socket '${attachment.socket}'`
          );
          continue;
        }
      } else {
        this.#logger.warn(
          `Attachment for socket '${attachment.socket}' has neither child nor requirements`
        );
        continue;
      }

      // Create child entity and attach
      const childId = await this.#createAndAttachPart(
        parentEntity,
        attachment.socket,
        childDefinitionId,
        recipe,
        socketOccupancy,
        rng
      );

      if (childId) {
        createdEntities.push(childId);

        // Process childSlots if specified in the attachment
        if (attachment.childSlots) {
          await this.#processChildSlots(
            childId,
            attachment.childSlots,
            recipe,
            createdEntities,
            new Map(), // partCounts not tracked for static attachments
            socketOccupancy,
            rng
          );
        }
      }
    }
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
    const allParts = this.#dataRegistry.getAll('anatomyParts');

    for (const [partId, partRef] of Object.entries(allParts)) {
      if (!partRef.isAnatomyPart) continue;

      const entityDef = this.#dataRegistry.get('entityDefinitions', partId);
      if (!entityDef) continue;

      // Check if this part meets the requirements
      if (this.#meetsRequirements(entityDef, requirements)) {
        candidates.push(partId);
      }
    }

    if (candidates.length === 0) {
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
        if (!this.#matchesPropertyRequirements(entityDef, recipeSlot.properties)) {
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
    for (const [componentId, requiredProps] of Object.entries(propertyRequirements)) {
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
   * Fills remaining sockets using depth-first traversal
   *
   * @param entityId
   * @param recipe
   * @param createdEntities
   * @param partCounts
   * @param socketOccupancy
   * @param rng
   * @private
   */
  async #fillSockets(
    entityId,
    recipe,
    createdEntities,
    partCounts,
    socketOccupancy,
    rng
  ) {
    const entity = this.#entityManager.getEntityInstance(entityId);
    const socketsComponent = this.#entityManager.getComponentData(
      entityId,
      'anatomy:sockets'
    );

    if (!socketsComponent || !socketsComponent.sockets) {
      return;
    }

    // Process each socket in deterministic order
    const sockets = [...socketsComponent.sockets].sort((a, b) =>
      a.id.localeCompare(b.id)
    );

    for (const socket of sockets) {
      const occupancyKey = `${entityId}:${socket.id}`;
      const currentOccupancy = socketOccupancy.get(occupancyKey) || 0;
      const maxCount = socket.maxCount || 1;

      // Skip if socket is full
      if (currentOccupancy >= maxCount) {
        continue;
      }

      // Find matching recipe slot
      const recipeSlot = this.#findMatchingRecipeSlot(socket, recipe);
      if (!recipeSlot) {
        this.#logger.debug(
          `No recipe slot matches socket '${socket.id}' with allowed types: ${socket.allowedTypes.join(', ')}`
        );
        continue;
      }

      // Determine how many parts to create
      const desiredCount = this.#calculateDesiredCount(
        recipeSlot,
        partCounts,
        socket.allowedTypes[0]
      );
      const availableSlots = maxCount - currentOccupancy;
      const toCreate = Math.min(desiredCount, availableSlots);

      // Create parts for this socket
      for (let i = 0; i < toCreate; i++) {
        const childId = await this.#createPartForSlot(
          entityId,
          socket,
          recipeSlot,
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

          // Recursively fill child's sockets
          await this.#fillSockets(
            childId,
            recipe,
            createdEntities,
            partCounts,
            socketOccupancy,
            rng
          );

          // Process childSlots if specified in the recipe slot
          if (recipeSlot.childSlots) {
            await this.#processChildSlots(
              childId,
              recipeSlot.childSlots,
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
      const desiredCount = this.#calculateDesiredCount(
        slotSpec,
        partCounts,
        slotSpec.partType
      );
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
    // Build candidate list
    const candidates = await this.#findCandidateParts(
      recipeSlot,
      socket.allowedTypes
    );

    if (candidates.length === 0) {
      this.#logger.warn(
        `No candidate parts found for slot with type '${recipeSlot.partType}'`
      );
      return null;
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
    const allParts = this.#dataRegistry.getAll('anatomyParts');

    for (const [partId, partRef] of Object.entries(allParts)) {
      if (!partRef.isAnatomyPart) continue;

      // Load the entity definition
      const entityDef = this.#dataRegistry.get('entityDefinitions', partId);
      if (!entityDef) continue;

      // Check if part type matches
      const anatomyPart = entityDef.components['anatomy:part'];
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
        if (!this.#matchesPropertyRequirements(entityDef, recipeSlot.properties)) {
          continue;
        }
      }

      candidates.push(partId);
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
        await this.#entityManager.createEntity(partDefinitionId);

      // Add joint component to establish the connection
      await this.#entityManager.addComponent(childEntity.id, 'anatomy:joint', {
        parentId: parentId,
        socketId: socketId,
        jointType: socket.jointType || 'fixed',
        breakThreshold: socket.breakThreshold || 0,
      });

      // Generate and set name if template provided
      if (socket.nameTpl) {
        const name = this.#generatePartName(socket, childEntity, parentId);
        await this.#entityManager.addComponent(childEntity.id, 'core:name', {
          value: name,
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
