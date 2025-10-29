// src/anatomy/bodyBlueprintFactory.js

/**
 * @file Factory service that combines anatomy blueprints with recipes to create entity graphs
 */

import { InvalidArgumentError } from '../errors/invalidArgumentError.js';
import { ValidationError } from '../errors/index.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../constants/systemEventIds.js';
import { AnatomyGraphContext } from './anatomyGraphContext.js';
import { assertNonBlankString } from '../utils/dependencyUtils.js';

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
/** @typedef {import('./socketGenerator.js').default} SocketGenerator */
/** @typedef {import('./slotGenerator.js').default} SlotGenerator */

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
  /** @type {SocketGenerator} */
  #socketGenerator;
  /** @type {SlotGenerator} */
  #slotGenerator;
  /** @type {import('./recipePatternResolver.js').default} */
  #recipePatternResolver;

  /**
   * Creates a new BodyBlueprintFactory instance
   *
   * @param {object} deps - Dependency injection container
   * @param {IEntityManager} deps.entityManager - Entity manager
   * @param {IDataRegistry} deps.dataRegistry - Data registry
   * @param {ILogger} deps.logger - Logger
   * @param {ISafeEventDispatcher} deps.eventDispatcher - Event dispatcher
   * @param {EventDispatchService} deps.eventDispatchService - Event dispatch service
   * @param {RecipeProcessor} deps.recipeProcessor - Recipe processor
   * @param {PartSelectionService} deps.partSelectionService - Part selection service
   * @param {SocketManager} deps.socketManager - Socket manager
   * @param {EntityGraphBuilder} deps.entityGraphBuilder - Entity graph builder
   * @param {RecipeConstraintEvaluator} deps.constraintEvaluator - Constraint evaluator
   * @param {GraphIntegrityValidator} deps.validator - Graph integrity validator
   * @param {SocketGenerator} deps.socketGenerator - Socket generator
   * @param {SlotGenerator} deps.slotGenerator - Slot generator
   * @param {import('./recipePatternResolver.js').default} deps.recipePatternResolver - Recipe pattern resolver
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
    socketGenerator,
    slotGenerator,
    recipePatternResolver,
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
    if (!socketGenerator)
      throw new InvalidArgumentError('socketGenerator is required');
    if (!slotGenerator)
      throw new InvalidArgumentError('slotGenerator is required');
    if (!recipePatternResolver)
      throw new InvalidArgumentError('recipePatternResolver is required');

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
    this.#socketGenerator = socketGenerator;
    this.#slotGenerator = slotGenerator;
    this.#recipePatternResolver = recipePatternResolver;
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
    assertNonBlankString(blueprintId, 'Blueprint ID', 'createAnatomyGraph');
    assertNonBlankString(recipeId, 'Recipe ID', 'createAnatomyGraph');

    try {
      // Load and validate blueprint
      const blueprint = this.#loadBlueprint(blueprintId);

      // Load and process recipe
      const recipe = this.#recipeProcessor.loadRecipe(recipeId);
      let resolvedRecipe = this.#recipeProcessor.processRecipe(recipe);

      // Resolve V2 patterns if blueprint uses V2 schema
      if (blueprint.schemaVersion === '2.0') {
        resolvedRecipe = this.#recipePatternResolver.resolveRecipePatterns(
          resolvedRecipe,
          blueprint
        );
      }

      // Validate recipe slots against blueprint
      this.#validateRecipeSlots(resolvedRecipe, blueprint);

      // Initialize creation context
      const context = new AnatomyGraphContext(options.seed);

      // Phase 1: Create root entity
      const rootId = await this.#entityGraphBuilder.createRootEntity(
        blueprint.root,
        resolvedRecipe,
        options.ownerId
      );
      context.setRootId(rootId);

      // Phase 1.5: Add generated sockets to root entity (V2 blueprints)
      if (blueprint._generatedSockets && blueprint._generatedSockets.length > 0) {
        this.#logger.debug(
          `BodyBlueprintFactory: Adding ${blueprint._generatedSockets.length} generated sockets to root entity`
        );
        await this.#entityGraphBuilder.addSocketsToEntity(
          rootId,
          blueprint._generatedSockets
        );
      }

      // Phase 2: Process blueprint slots if defined
      if (blueprint.slots) {
        this.#logger.debug(
          `BodyBlueprintFactory: Processing ${Object.keys(blueprint.slots).length} blueprint slots`
        );
        await this.#processBlueprintSlots(blueprint, resolvedRecipe, context, options.ownerId);
      }

      // Phase 3: Validate constraints
      const constraintResult = this.#constraintEvaluator.evaluateConstraints(
        context.getCreatedEntities(),
        resolvedRecipe
      );

      if (!constraintResult.valid) {
        this.#logger.warn(
          `BodyBlueprintFactory: Constraint validation failed for blueprint '${blueprintId}': ${constraintResult.errors.join(', ')}`
        );
        await this.#entityGraphBuilder.cleanupEntities(
          context.getCreatedEntities()
        );
        throw new ValidationError(
          `Constraint validation failed: ${constraintResult.errors.join(', ')}`
        );
      }

      // Phase 4: Final validation
      const validationResult = await this.#validator.validateGraph(
        context.getCreatedEntities(),
        resolvedRecipe,
        context.getSocketOccupancy()
      );

      if (!validationResult.valid) {
        this.#logger.warn(
          `BodyBlueprintFactory: Graph validation failed for blueprint '${blueprintId}': ${validationResult.errors.join(', ')}`
        );
        await this.#entityGraphBuilder.cleanupEntities(
          context.getCreatedEntities()
        );
        throw new ValidationError(
          `Graph validation failed: ${validationResult.errors.join(', ')}`
        );
      }

      // Log warnings if any
      if (validationResult.warnings && validationResult.warnings.length > 0) {
        this.#logger.warn(
          `BodyBlueprintFactory: Graph validation warnings for blueprint '${blueprintId}': ${validationResult.warnings.join(', ')}`
        );
      }

      this.#logger.info(
        `BodyBlueprintFactory: Successfully created anatomy graph for blueprint '${blueprintId}' with ${context.getCreatedEntities().length} entities`
      );

      return {
        rootId,
        entities: context.getCreatedEntities(),
      };
    } catch (err) {
      this.#logger.error(
        `BodyBlueprintFactory: Failed to create anatomy graph for blueprint '${blueprintId}': ${err.message}`,
        err
      );

      await this.#eventDispatcher.dispatch(SYSTEM_ERROR_OCCURRED_ID, {
        message: err.message,
        details: {
          raw: 'BodyBlueprintFactory.createAnatomyGraph',
        },
      });

      throw err;
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

    // Route v2 blueprints through template processor
    if (blueprint.schemaVersion === '2.0' && blueprint.structureTemplate) {
      return this.#processV2Blueprint(blueprint);
    }

    // V1 blueprints pass through unchanged
    return blueprint;
  }

  /**
   * Processes a v2 blueprint by generating slots and sockets from structure template
   *
   * @param {AnatomyBlueprint} blueprint - The v2 blueprint with structureTemplate
   * @private
   * @returns {AnatomyBlueprint} Blueprint with generated slots merged with additionalSlots
   * @throws {ValidationError} If structure template not found
   */
  #processV2Blueprint(blueprint) {
    this.#logger.debug(
      `BodyBlueprintFactory: Processing v2 blueprint with template '${blueprint.structureTemplate}'`
    );

    // Load structure template from DataRegistry
    const template = this.#dataRegistry.get(
      'anatomyStructureTemplates',
      blueprint.structureTemplate
    );

    if (!template) {
      throw new ValidationError(
        `Structure template not found: ${blueprint.structureTemplate}`
      );
    }

    // Generate sockets and slots from template
    const generatedSockets =
      this.#socketGenerator.generateSockets(template) || [];
    const generatedSlots =
      this.#slotGenerator.generateBlueprintSlots(template) || {};
    const additionalSlots = blueprint.additionalSlots || {};

    const conflictingSlots = Object.keys(additionalSlots).filter(slotKey =>
      Object.prototype.hasOwnProperty.call(generatedSlots, slotKey)
    );

    if (conflictingSlots.length > 0) {
      this.#logger.warn(
        `BodyBlueprintFactory: Blueprint '${
          blueprint.id || 'unknown blueprint'
        }' additionalSlots overriding generated slots: ${conflictingSlots.join(
          ', '
        )}`
      );
    }

    this.#logger.info(
      `BodyBlueprintFactory: Generated ${generatedSockets.length} sockets and ${Object.keys(generatedSlots).length} slots from template`
    );

    // Merge generated slots with additionalSlots (additionalSlots take precedence)
    return {
      ...blueprint,
      slots: {
        ...generatedSlots,
        ...additionalSlots,
      },
      _generatedSockets: generatedSockets,
    };
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
