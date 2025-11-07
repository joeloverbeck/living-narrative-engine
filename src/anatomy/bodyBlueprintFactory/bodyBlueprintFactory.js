// src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js

/**
 * @file Main facade for anatomy graph creation from blueprints + recipes
 * Orchestrates blueprint loading, validation, and slot resolution via modular components
 */

import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { ValidationError } from '../../errors/index.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../constants/systemEventIds.js';
import { AnatomyGraphContext } from '../anatomyGraphContext.js';
import { assertNonBlankString } from '../../utils/dependencyUtils.js';

// Import extracted modules
import { loadBlueprint } from './blueprintLoader.js';
import { validateRecipeSlots } from './blueprintValidator.js';
import { processBlueprintSlots } from './slotResolutionOrchestrator.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../utils/eventDispatchService.js').EventDispatchService} EventDispatchService */
/** @typedef {import('../recipeProcessor.js').RecipeProcessor} RecipeProcessor */
/** @typedef {import('../partSelectionService.js').PartSelectionService} PartSelectionService */
/** @typedef {import('../socketManager.js').SocketManager} SocketManager */
/** @typedef {import('../entityGraphBuilder.js').EntityGraphBuilder} EntityGraphBuilder */
/** @typedef {import('../recipeConstraintEvaluator.js').RecipeConstraintEvaluator} RecipeConstraintEvaluator */
/** @typedef {import('../graphIntegrityValidator.js').GraphIntegrityValidator} GraphIntegrityValidator */
/** @typedef {import('../socketGenerator.js').default} SocketGenerator */
/** @typedef {import('../slotGenerator.js').default} SlotGenerator */

/**
 * @typedef {object} AnatomyBlueprint
 * @property {string} root
 * @property {object} slots
 */

/**
 * Factory service that orchestrates anatomy entity graph creation
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
  /** @type {import('../recipePatternResolver.js').default} */
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
   * @param {import('../recipePatternResolver.js').default} deps.recipePatternResolver - Recipe pattern resolver
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

    this.#entityManager = entityManager;
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
      // Phase 1: Load and validate blueprint (uses blueprintLoader module)
      const blueprint = loadBlueprint(blueprintId, {
        dataRegistry: this.#dataRegistry,
        logger: this.#logger,
        socketGenerator: this.#socketGenerator,
        slotGenerator: this.#slotGenerator,
      });

      // Phase 2: Load and process recipe
      const recipe = this.#recipeProcessor.loadRecipe(recipeId);
      let resolvedRecipe = this.#recipeProcessor.processRecipe(recipe);

      // Resolve V2 patterns if blueprint uses V2 schema
      if (blueprint.schemaVersion === '2.0') {
        resolvedRecipe = this.#recipePatternResolver.resolveRecipePatterns(
          resolvedRecipe,
          blueprint
        );
      }

      // Validate recipe slots against blueprint (uses blueprintValidator module)
      validateRecipeSlots(resolvedRecipe, blueprint, this.#eventDispatcher);

      // Phase 3: Initialize creation context
      const context = new AnatomyGraphContext(options.seed);

      // Phase 4: Create root entity
      // Extract componentOverrides from recipe's root slot if present
      const rootComponentOverrides = resolvedRecipe.slots?.root?.properties || {};

      const rootId = await this.#entityGraphBuilder.createRootEntity(
        blueprint.root,
        resolvedRecipe,
        options.ownerId,
        rootComponentOverrides
      );
      context.setRootId(rootId);

      // Phase 5: Add generated sockets to root entity (V2 blueprints)
      if (blueprint._generatedSockets && blueprint._generatedSockets.length > 0) {
        // Get existing sockets from entity definition (if any)
        const existingSockets = this.#entityManager.getComponentData(rootId, 'anatomy:sockets');
        const existingSocketList = existingSockets?.sockets || [];

        // Merge template sockets with entity definition sockets
        // Template sockets take precedence for duplicate IDs
        const socketMap = new Map();

        // Add entity definition sockets first
        for (const socket of existingSocketList) {
          socketMap.set(socket.id, socket);
        }

        // Add/override with template-generated sockets
        for (const socket of blueprint._generatedSockets) {
          socketMap.set(socket.id, socket);
        }

        const mergedSockets = Array.from(socketMap.values());

        this.#logger.debug(
          `BodyBlueprintFactory: Merging ${blueprint._generatedSockets.length} template sockets with ${existingSocketList.length} entity sockets (total: ${mergedSockets.length})`
        );
        await this.#entityGraphBuilder.addSocketsToEntity(
          rootId,
          mergedSockets
        );
      }

      // Phase 6: Process blueprint slots (uses slotResolutionOrchestrator module)
      if (blueprint.slots) {
        console.log('[DEBUG] BodyBlueprintFactory: Phase 2 - Processing blueprint slots');
        console.log('[DEBUG]   blueprint.slots keys:', Object.keys(blueprint.slots));
        console.log('[DEBUG]   resolvedRecipe.slots keys:', Object.keys(resolvedRecipe.slots || {}));
        this.#logger.debug(
          `BodyBlueprintFactory: Processing ${Object.keys(blueprint.slots).length} blueprint slots`
        );

        await processBlueprintSlots(blueprint, resolvedRecipe, context, options.ownerId, {
          entityGraphBuilder: this.#entityGraphBuilder,
          partSelectionService: this.#partSelectionService,
          socketManager: this.#socketManager,
          recipeProcessor: this.#recipeProcessor,
          eventDispatchService: this.#eventDispatchService,
          logger: this.#logger,
        });
      } else {
        console.log('[DEBUG] BodyBlueprintFactory: Phase 2 - SKIPPED (blueprint.slots is falsy)', blueprint.slots);
      }

      // Phase 7: Validate constraints
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

      // Phase 8: Final validation
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
}

export default BodyBlueprintFactory;
