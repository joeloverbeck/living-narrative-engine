// src/anatomy/bodyBlueprintFactory.js

/**
 * @file Factory service that combines anatomy blueprints with recipes to create entity graphs
 */

import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
import { ValidationError } from '../errors/index.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/systemEventIds.js';
import { AnatomyGraphContext } from './anatomyGraphContext.js';

/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../utils/eventDispatchService.js').EventDispatchService} EventDispatchService */
/** @typedef {import('./recipeProcessor.js').RecipeProcessor} RecipeProcessor */
/** @typedef {import('./partSelectionService.js').PartSelectionService} PartSelectionService */
/** @typedef {import('./socketManager.js').SocketManager} SocketManager */
/** @typedef {import('./entityGraphBuilder.js').EntityGraphBuilder} EntityGraphBuilder */
/** @typedef {import('./recipeConstraintEvaluator.js').RecipeConstraintEvaluator} RecipeConstraintEvaluator */
/** @typedef {import('./graphIntegrityValidator.js').GraphIntegrityValidator} GraphIntegrityValidator */

/**
 * @typedef {object} AnatomyBlueprint
 * @property {string} root
 * @property {object} slots
 */

/**
 * Factory service that orchestrates anatomy entity graph creation
 */
export class BodyBlueprintFactory {
  /** @type {IDataRegistry} */
  #dataRegistry;
  /** @type {ILogger} */
  #logger;
  /** @type {ISafeEventDispatcher} */
  #eventDispatcher;
  /** @type {EventDispatchService} */
  #eventDispatchService;
  /** @type {RecipeProcessor} */
  #recipeProcessor;
  /** @type {PartSelectionService} */
  #partSelectionService;
  /** @type {SocketManager} */
  #socketManager;
  /** @type {EntityGraphBuilder} */
  #entityGraphBuilder;
  /** @type {RecipeConstraintEvaluator} */
  #constraintEvaluator;
  /** @type {GraphIntegrityValidator} */
  #validator;

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {IDataRegistry} deps.dataRegistry
   * @param {ILogger} deps.logger
   * @param {ISafeEventDispatcher} deps.eventDispatcher
   * @param {EventDispatchService} deps.eventDispatchService
   * @param {RecipeProcessor} deps.recipeProcessor
   * @param {PartSelectionService} deps.partSelectionService
   * @param {SocketManager} deps.socketManager
   * @param {EntityGraphBuilder} deps.entityGraphBuilder
   * @param {RecipeConstraintEvaluator} deps.constraintEvaluator
   * @param {GraphIntegrityValidator} deps.validator
   */
  constructor({
    entityManager,
    dataRegistry,
    logger,
    eventDispatcher,
    eventDispatchService,
    recipeProcessor,
    partSelectionService,
    socketManager,
    entityGraphBuilder,
    constraintEvaluator,
    validator,
  }) {
    if (!dataRegistry)
      throw new InvalidArgumentError('dataRegistry is required');
    if (!logger) throw new InvalidArgumentError('logger is required');
    if (!eventDispatcher)
      throw new InvalidArgumentError('eventDispatcher is required');
    if (!eventDispatchService)
      throw new InvalidArgumentError('eventDispatchService is required');
    if (!recipeProcessor)
      throw new InvalidArgumentError('recipeProcessor is required');
    if (!partSelectionService)
      throw new InvalidArgumentError('partSelectionService is required');
    if (!socketManager)
      throw new InvalidArgumentError('socketManager is required');
    if (!entityGraphBuilder)
      throw new InvalidArgumentError('entityGraphBuilder is required');
    if (!constraintEvaluator)
      throw new InvalidArgumentError('constraintEvaluator is required');
    if (!validator) throw new InvalidArgumentError('validator is required');

    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
    this.#eventDispatcher = eventDispatcher;
    this.#eventDispatchService = eventDispatchService;
    this.#recipeProcessor = recipeProcessor;
    this.#partSelectionService = partSelectionService;
    this.#socketManager = socketManager;
    this.#entityGraphBuilder = entityGraphBuilder;
    this.#constraintEvaluator = constraintEvaluator;
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
    let context = null;

    try {
      this.#logger.debug(
        `BodyBlueprintFactory: Creating anatomy graph from blueprint '${blueprintId}' and recipe '${recipeId}'`
      );

      // Load blueprint and recipe
      const blueprint = this.#loadBlueprint(blueprintId);
      const recipe = this.#recipeProcessor.loadRecipe(recipeId);
      const processedRecipe = this.#recipeProcessor.processRecipe(recipe);

      // Validate recipe slots against blueprint
      this.#validateRecipeSlots(processedRecipe, blueprint);

      // Initialize context
      context = new AnatomyGraphContext(options.seed);

      // Phase 1: Create root entity
      const rootId = await this.#entityGraphBuilder.createRootEntity(
        blueprint.root,
        processedRecipe,
        options.ownerId
      );
      context.setRootId(rootId);

      // Phase 2: Process blueprint slots if defined
      if (blueprint.slots) {
        await this.#processBlueprintSlots(
          blueprint,
          processedRecipe,
          context,
          options.ownerId
        );
      }

      // Phase 3: Validate constraints
      const constraintResult = this.#constraintEvaluator.evaluateConstraints(
        context.getCreatedEntities(),
        processedRecipe
      );

      if (!constraintResult.valid) {
        await this.#entityGraphBuilder.cleanupEntities(
          context.getCreatedEntities()
        );
        throw new ValidationError(
          `Recipe constraints failed: ${constraintResult.errors.join(', ')}`
        );
      }

      // Phase 4: Validate graph integrity
      const validationResult = await this.#validator.validateGraph(
        context.getCreatedEntities(),
        processedRecipe,
        context.getSocketOccupancy()
      );

      if (!validationResult.valid) {
        await this.#entityGraphBuilder.cleanupEntities(
          context.getCreatedEntities()
        );
        throw new ValidationError(
          `Anatomy graph validation failed: ${validationResult.errors.join(', ')}`
        );
      }

      this.#logger.info(
        `BodyBlueprintFactory: Successfully created anatomy graph with ${context.getCreatedEntities().length} entities`
      );

      return {
        rootId: context.getRootId(),
        entities: context.getCreatedEntities(),
      };
    } catch (error) {
      this.#logger.error(
        `BodyBlueprintFactory: Failed to create anatomy graph`,
        { error }
      );

      // Clean up any created entities on error
      if (context) {
        await this.#entityGraphBuilder.cleanupEntities(
          context.getCreatedEntities()
        );
      }

      this.#eventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: error.message,
        details: {
          raw: 'BodyBlueprintFactory.createAnatomyGraph',
        },
      });

      throw error;
    }
  }

  /**
   * Validates that all recipe slot keys exist in the blueprint
   *
   * @param {object} recipe - The processed recipe with slots
   * @param {AnatomyBlueprint} blueprint - The blueprint to validate against
   * @private
   * @throws {ValidationError} If recipe contains invalid slot keys
   */
  #validateRecipeSlots(recipe, blueprint) {
    // Skip validation if recipe has no slots
    if (!recipe.slots || Object.keys(recipe.slots).length === 0) {
      return;
    }

    // Collect slot keys that don't exist in blueprint
    // Note: 'torso' is a special slot used to override the root entity
    const invalidSlotKeys = [];
    for (const slotKey of Object.keys(recipe.slots)) {
      // Skip 'torso' slot as it's used for root entity override
      if (slotKey === 'torso') {
        continue;
      }

      if (!blueprint.slots || !blueprint.slots[slotKey]) {
        invalidSlotKeys.push(slotKey);
      }
    }

    // If any invalid keys found, dispatch error and throw
    if (invalidSlotKeys.length > 0) {
      const blueprintId = blueprint.id || 'unknown';
      const errorMessage = `Recipe '${recipe.recipeId}' contains invalid slot keys that don't exist in blueprint '${blueprintId}': ${invalidSlotKeys.join(', ')}`;

      // Dispatch system error with full context
      this.#eventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: errorMessage,
        details: {
          raw: JSON.stringify({
            recipeId: recipe.recipeId,
            blueprintId: blueprintId,
            invalidSlotKeys,
            validSlotKeys: Object.keys(blueprint.slots || {}),
            context: 'BodyBlueprintFactory.validateRecipeSlots',
          }),
        },
      });

      throw new ValidationError(errorMessage);
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
   * Processes blueprint slots to create the anatomy structure
   *
   * @param {AnatomyBlueprint} blueprint - The blueprint with slots
   * @param {object} recipe - The processed recipe
   * @param {AnatomyGraphContext} context - The graph building context
   * @param ownerId
   * @private
   */
  async #processBlueprintSlots(blueprint, recipe, context, ownerId) {
    // Sort slots by dependency order
    const sortedSlots = this.#sortSlotsByDependency(blueprint.slots);

    for (const [slotKey, slot] of sortedSlots) {
      try {
        // Determine parent entity
        let parentEntityId;
        if (slot.parent === null || slot.parent === undefined) {
          // If no parent specified, attach to root
          parentEntityId = context.getRootId();
        } else {
          // Otherwise, find the entity for the parent slot
          parentEntityId = context.getEntityForSlot(slot.parent);
          if (!parentEntityId) {
            throw new ValidationError(
              `Parent slot '${slot.parent}' not found for slot '${slotKey}'`
            );
          }
        }

        // Validate socket availability
        const socketValidation = this.#socketManager.validateSocketAvailability(
          parentEntityId,
          slot.socket,
          context.getSocketOccupancy(),
          !slot.optional
        );

        if (!socketValidation.valid) {
          if (socketValidation.error) {
            throw new ValidationError(socketValidation.error);
          }
          // Skip optional slots if socket not available
          continue;
        }

        const socket = socketValidation.socket;

        // Check if this is an equipment slot (not an anatomy part slot)
        // Equipment slots typically have requirements like strength, dexterity, etc.
        // and use sockets like 'grip' which should not create anatomy parts
        if (this.#isEquipmentSlot(slot, socket)) {
          this.#logger.debug(
            `BodyBlueprintFactory: Skipping equipment slot '${slotKey}' (socket: ${socket.id})`
          );
          continue;
        }

        // Merge requirements and select part
        const mergedRequirements = this.#recipeProcessor.mergeSlotRequirements(
          slot.requirements,
          recipe.slots?.[slotKey]
        );

        const partDefinitionId = await this.#partSelectionService.selectPart(
          mergedRequirements,
          socket.allowedTypes,
          recipe.slots?.[slotKey],
          context.getRNG()
        );

        if (!partDefinitionId && slot.optional) {
          continue; // Skip optional slots if no part found
        }

        if (!partDefinitionId) {
          throw new ValidationError(
            `No part found for required slot '${slotKey}' with requirements: ${JSON.stringify(mergedRequirements)}`
          );
        }

        // Use socket orientation if available, otherwise extract from slot key
        // For slots like "left_hand", "right_foot", extract "left" or "right"
        let orientation = socket.orientation;
        if (!orientation && slotKey) {
          // Check if slot key starts with a known orientation prefix
          const orientationPrefixes = [
            'left',
            'right',
            'upper',
            'lower',
            'front',
            'back',
          ];
          for (const prefix of orientationPrefixes) {
            if (slotKey.startsWith(prefix + '_')) {
              orientation = prefix;
              break;
            }
          }
        }

        // Debug logging for orientation issues
        this.#logger.debug(
          `BodyBlueprintFactory: Creating part for slot '${slotKey}' - socket.orientation: ${socket.orientation}, extracted orientation: ${orientation}, socket.nameTpl: ${socket.nameTpl}`
        );

        // Create and attach the part
        const childId = await this.#entityGraphBuilder.createAndAttachPart(
          parentEntityId,
          socket.id,
          partDefinitionId,
          ownerId,
          orientation
        );

        if (childId) {
          context.addCreatedEntity(childId);
          context.mapSlotToEntity(slotKey, childId);

          // Update part count
          const partType = this.#entityGraphBuilder.getPartType(childId);
          context.incrementPartCount(partType);

          // Mark socket as occupied
          this.#socketManager.occupySocket(
            parentEntityId,
            socket.id,
            context.getSocketOccupancy()
          );

          // Generate and set name if template provided
          const name = this.#socketManager.generatePartName(
            socket,
            childId,
            parentEntityId
          );
          this.#logger.debug(
            `BodyBlueprintFactory: Generated name '${name}' for child '${childId}' using socket '${socket.id}' with template '${socket.nameTpl}'`
          );
          if (name) {
            await this.#entityGraphBuilder.setEntityName(childId, name);
          }
        }
      } catch (error) {
        const errorContext = {
          slotKey,
          slot,
          blueprintId: blueprint.id,
          recipeId: recipe.recipeId,
        };

        const errorMessage = `Failed to process blueprint slot '${slotKey}': ${error.message}`;

        await this.#eventDispatchService.safeDispatchEvent(
          SYSTEM_ERROR_OCCURRED_ID,
          {
            message: errorMessage,
            details: {
              raw: JSON.stringify({
                ...errorContext,
                context: 'BodyBlueprintFactory.processBlueprintSlots',
              }),
            },
          }
        );

        throw new ValidationError(errorMessage);
      }
    }
  }

  /**
   * Checks if a slot is an equipment slot (not an anatomy part slot)
   * Equipment slots should not create anatomy parts
   *
   * @param {object} slot - The slot definition
   * @param {object} socket - The socket definition
   * @returns {boolean} True if this is an equipment slot
   * @private
   */
  #isEquipmentSlot(slot, socket) {
    // Equipment slots typically use sockets like 'grip' for weapons/tools
    const equipmentSocketTypes = ['grip', 'weapon', 'tool', 'accessory'];

    if (equipmentSocketTypes.includes(socket.id)) {
      return true;
    }

    // Equipment slots typically have requirements like strength, dexterity, etc.
    // that are not typical anatomy part requirements
    const equipmentRequirements = [
      'strength',
      'dexterity',
      'intelligence',
      'level',
    ];

    if (slot.requirements) {
      const hasEquipmentRequirements = equipmentRequirements.some((req) =>
        Object.prototype.hasOwnProperty.call(slot.requirements, req)
      );

      if (hasEquipmentRequirements) {
        return true;
      }
    }

    return false;
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
        throw new ValidationError(
          `Circular dependency detected in blueprint slots involving '${key}'`
        );
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
}

export default BodyBlueprintFactory;
