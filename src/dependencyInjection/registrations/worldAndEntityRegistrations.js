/**
 * @file Registers world, entity, and context-related services.
 * @see src/dependencyInjection/registrations/worldAndEntityRegistrations.js
 */

/* eslint-env node */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */

// --- DI & Helper Imports ---
import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';
import { INITIALIZABLE } from '../tags.js';

// --- Service Imports ---
import EntityManager from '../../entities/entityManager.js';
import { EntityManagerAdapter } from '../../entities/entityManagerAdapter.js';
import WorldContext from '../../context/worldContext.js';
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js';
import JsonLogicCustomOperators from '../../logic/jsonLogicCustomOperators.js';
import * as closenessCircleService from '../../logic/services/closenessCircleService.js';
import { EntityDisplayDataProvider } from '../../entities/entityDisplayDataProvider.js';
import { SpatialIndexSynchronizer } from '../../entities/spatialIndexSynchronizer.js';
import { LocationQueryService } from '../../entities/locationQueryService.js';
import {
  resolveEntity,
  getComponent,
  setComponent,
} from '../../entities/entityAccessService.js';
import ComponentAccessService from '../../entities/componentAccessService.js';
import LocationDisplayService from '../../entities/services/locationDisplayService.js';
import { BodyBlueprintFactory } from '../../anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js';
import { GraphIntegrityValidator } from '../../anatomy/graphIntegrityValidator.js';
import { BodyGraphService } from '../../anatomy/bodyGraphService.js';
import { AnatomyGenerationService } from '../../anatomy/anatomyGenerationService.js';
import { AnatomyInitializationService } from '../../anatomy/anatomyInitializationService.js';
import { DescriptorFormatter } from '../../anatomy/descriptorFormatter.js';
import { BodyPartDescriptionBuilder } from '../../anatomy/bodyPartDescriptionBuilder.js';
import { BodyDescriptionComposer } from '../../anatomy/bodyDescriptionComposer.js';
import { AnatomyDescriptionService } from '../../anatomy/anatomyDescriptionService.js';
import { AnatomyFormattingService } from '../../services/anatomyFormattingService.js';
import EquipmentDescriptionService from '../../clothing/services/equipmentDescriptionService.js';
import ActivityDescriptionService from '../../anatomy/services/activityDescriptionService.js';
import ActivityDescriptionFacade from '../../anatomy/services/activityDescriptionFacade.js';
import ActivityGroupingSystem from '../../anatomy/services/grouping/activityGroupingSystem.js';
import ActivityIndexManager from '../../anatomy/services/activityIndexManager.js';
import ActivityCacheManager from '../../anatomy/cache/activityCacheManager.js';
import ActivityMetadataCollectionSystem from '../../anatomy/services/activityMetadataCollectionSystem.js';
import ActivityNLGSystem from '../../anatomy/services/activityNLGSystem.js';
import ActivityConditionValidator from '../../anatomy/services/validation/activityConditionValidator.js';
import ActivityFilteringSystem from '../../anatomy/services/filtering/activityFilteringSystem.js';
import ActivityContextBuildingSystem from '../../anatomy/services/context/activityContextBuildingSystem.js';
import { RecipeProcessor } from '../../anatomy/recipeProcessor.js';
import PartSelectionService from '../../anatomy/partSelectionService.js';
import { SocketManager } from '../../anatomy/socketManager.js';
import { EntityGraphBuilder } from '../../anatomy/entityGraphBuilder.js';
import { RecipeConstraintEvaluator } from '../../anatomy/recipeConstraintEvaluator.js';
import { PartDescriptionGenerator } from '../../anatomy/PartDescriptionGenerator.js';
import { BodyDescriptionOrchestrator } from '../../anatomy/BodyDescriptionOrchestrator.js';
import DescriptionPersistenceService from '../../anatomy/DescriptionPersistenceService.js';
import { AnatomyQueryCache } from '../../anatomy/cache/AnatomyQueryCache.js';
import { AnatomyClothingCache } from '../../anatomy/cache/AnatomyClothingCache.js';
import { ANATOMY_CLOTHING_CACHE_CONFIG } from '../../anatomy/constants/anatomyConstants.js';
import { ClothingInstantiationService } from '../../clothing/services/clothingInstantiationService.js';
import { LayerCompatibilityService } from '../../clothing/validation/layerCompatibilityService.js';
import { ClothingSlotValidator } from '../../clothing/validation/clothingSlotValidator.js';
import { EquipmentOrchestrator } from '../../clothing/orchestration/equipmentOrchestrator.js';
import { ClothingManagementService } from '../../clothing/services/clothingManagementService.js';
import { ClothingAccessibilityService } from '../../clothing/services/clothingAccessibilityService.js';
import AnatomyBlueprintRepository from '../../anatomy/repositories/anatomyBlueprintRepository.js';
import RecipePreflightValidator from '../../anatomy/validation/RecipePreflightValidator.js';
import AnatomySocketIndex from '../../anatomy/services/anatomySocketIndex.js';
import { AnatomyCacheCoordinator } from '../../anatomy/cache/anatomyCacheCoordinator.js';
import SlotResolver from '../../anatomy/integration/SlotResolver.js';
import LayerResolutionService from '../../clothing/services/layerResolutionService.js';
import SocketGenerator from '../../anatomy/socketGenerator.js';
// Note: SlotGenerator and RecipePatternResolver imports removed - registered in loadersRegistrations.js
import UuidGenerator from '../../adapters/UuidGenerator.js';

/**
 * Registers world, entity, and context-related services.
 *
 * @param {AppContainer} container - The DI container.
 */
export function registerWorldAndEntity(container) {
  const registrar = new Registrar(container);
  /** @type {ILogger} */
  const logger = container.resolve(tokens.ILogger);
  logger.debug('World and Entity Registration: Starting...');

  // --- IEntityManager (EntityManager implementation) ---
  registrar.singletonFactory(tokens.IEntityManager, (c) => {
    const entityManager = new EntityManager({
      registry: /** @type {IDataRegistry} */ (c.resolve(tokens.IDataRegistry)),
      validator: /** @type {ISchemaValidator} */ (
        c.resolve(tokens.ISchemaValidator)
      ),
      logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
      dispatcher: /** @type {ISafeEventDispatcher} */ (
        c.resolve(tokens.ISafeEventDispatcher)
      ),
    });

    const locationQueryService = /** @type {LocationQueryService} */ (
      c.resolve(tokens.LocationQueryService)
    );

    return new EntityManagerAdapter({
      entityManager,
      locationQueryService,
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(tokens.IEntityManager)}.`
  );

  registrar.singletonFactory(
    tokens.IWorldContext,
    (c) =>
      new WorldContext(
        /** @type {IEntityManager} */ (c.resolve(tokens.IEntityManager)),
        /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
        /** @type {ISafeEventDispatcher} */ (
          c.resolve(tokens.ISafeEventDispatcher)
        )
      )
  );
  logger.debug(
    `World and Entity Registration: Registered ${String(tokens.IWorldContext)}.`
  );

  // Note: JsonLogicEvaluationService registration moved after its dependencies
  // to ensure JsonLogicCustomOperators is available when needed

  registrar.single(tokens.ClosenessCircleService, closenessCircleService, []);
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.ClosenessCircleService
    )}.`
  );

  registrar.singletonFactory(tokens.EntityDisplayDataProvider, (c) => {
    return new EntityDisplayDataProvider({
      entityManager: /** @type {IEntityManager} */ (
        c.resolve(tokens.IEntityManager)
      ),
      logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
      safeEventDispatcher: /** @type {ISafeEventDispatcher} */ (
        c.resolve(tokens.ISafeEventDispatcher)
      ),
      locationDisplayService: c.resolve(tokens.LocationDisplayService),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.EntityDisplayDataProvider
    )}.`
  );

  // --- SpatialIndexSynchronizer ---
  registrar
    .tagged(INITIALIZABLE)
    .singletonFactory(tokens.SpatialIndexSynchronizer, (c) => {
      return new SpatialIndexSynchronizer({
        spatialIndexManager: c.resolve(tokens.ISpatialIndexManager),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        logger: c.resolve(tokens.ILogger),
        entityManager:
          /** @type {import('../../interfaces/IEntityManager.js').IEntityManager} */ (
            c.resolve(tokens.IEntityManager)
          ),
      });
    });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.SpatialIndexSynchronizer
    )} tagged ${INITIALIZABLE.join(', ')}.`
  );

  // --- LocationQueryService ---
  registrar.singletonFactory(tokens.LocationQueryService, (c) => {
    return new LocationQueryService({
      spatialIndexManager: /** @type {ISpatialIndexManager} */ (
        c.resolve(tokens.ISpatialIndexManager)
      ),
      logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.LocationQueryService
    )}.`
  );

  registrar.singletonFactory(tokens.EntityAccessService, (c) => {
    return {
      resolveEntity: (entityOrId) =>
        resolveEntity(
          entityOrId,
          c.resolve(tokens.IEntityManager),
          c.resolve(tokens.ILogger)
        ),
      getComponent: (entityOrId, componentId, options = {}) =>
        getComponent(entityOrId, componentId, {
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          ...options,
        }),
      setComponent: (entityOrId, componentId, data, options = {}) =>
        setComponent(entityOrId, componentId, data, {
          entityManager: c.resolve(tokens.IEntityManager),
          logger: c.resolve(tokens.ILogger),
          ...options,
        }),
    };
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.EntityAccessService
    )}.`
  );

  registrar.singletonFactory(tokens.ComponentAccessService, () => {
    return new ComponentAccessService();
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.ComponentAccessService
    )}.`
  );

  registrar.singletonFactory(tokens.LocationDisplayService, (c) => {
    return new LocationDisplayService({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.LocationDisplayService
    )}.`
  );

  // --- Anatomy Services ---
  registrar.singletonFactory(tokens.GraphIntegrityValidator, (c) => {
    return new GraphIntegrityValidator({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.GraphIntegrityValidator
    )}.`
  );

  // Register AnatomyQueryCache early since BodyGraphService depends on it
  registrar.singletonFactory(tokens.AnatomyQueryCache, (c) => {
    return new AnatomyQueryCache({
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.AnatomyQueryCache
    )}.`
  );

  // --- New Anatomy Services ---
  registrar.singletonFactory(tokens.RecipeProcessor, (c) => {
    return new RecipeProcessor({
      dataRegistry: c.resolve(tokens.IDataRegistry),
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.RecipeProcessor
    )}.`
  );

  registrar.singletonFactory(tokens.PartSelectionService, (c) => {
    return new PartSelectionService({
      dataRegistry: c.resolve(tokens.IDataRegistry),
      logger: c.resolve(tokens.ILogger),
      eventDispatchService: c.resolve(tokens.EventDispatchService),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.PartSelectionService
    )}.`
  );

  registrar.singletonFactory(tokens.SocketManager, (c) => {
    return new SocketManager({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(tokens.SocketManager)}.`
  );

  registrar.singletonFactory(tokens.EntityGraphBuilder, (c) => {
    return new EntityGraphBuilder({
      entityManager: c.resolve(tokens.IEntityManager),
      dataRegistry: c.resolve(tokens.IDataRegistry),
      logger: c.resolve(tokens.ILogger),
      partSelectionService: c.resolve(tokens.PartSelectionService),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.EntityGraphBuilder
    )}.`
  );

  registrar.singletonFactory(tokens.RecipeConstraintEvaluator, (c) => {
    return new RecipeConstraintEvaluator({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.RecipeConstraintEvaluator
    )}.`
  );

  registrar.singletonFactory(tokens.ISocketGenerator, (c) => {
    return new SocketGenerator({
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.ISocketGenerator
    )}.`
  );

  // Note: ISlotGenerator and IRecipePatternResolver are now registered in loadersRegistrations.js
  // since they're required by BlueprintRecipeValidationRule during the loading phase

  registrar.singletonFactory(tokens.BodyBlueprintFactory, (c) => {
    return new BodyBlueprintFactory({
      entityManager: c.resolve(tokens.IEntityManager),
      dataRegistry: c.resolve(tokens.IDataRegistry),
      logger: c.resolve(tokens.ILogger),
      eventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      eventDispatchService: c.resolve(tokens.EventDispatchService),
      recipeProcessor: c.resolve(tokens.RecipeProcessor),
      partSelectionService: c.resolve(tokens.PartSelectionService),
      socketManager: c.resolve(tokens.SocketManager),
      entityGraphBuilder: c.resolve(tokens.EntityGraphBuilder),
      constraintEvaluator: c.resolve(tokens.RecipeConstraintEvaluator),
      validator: c.resolve(tokens.GraphIntegrityValidator),
      socketGenerator: c.resolve(tokens.ISocketGenerator),
      slotGenerator: c.resolve(tokens.ISlotGenerator),
      recipePatternResolver: c.resolve(tokens.IRecipePatternResolver),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.BodyBlueprintFactory
    )}.`
  );

  registrar.singletonFactory(tokens.BodyGraphService, (c) => {
    return new BodyGraphService({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
      eventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      queryCache: c.resolve(tokens.AnatomyQueryCache),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.BodyGraphService
    )}.`
  );

  registrar.singletonFactory(tokens.JsonLogicCustomOperators, (c) => {
    return new JsonLogicCustomOperators({
      logger: c.resolve(tokens.ILogger),
      bodyGraphService: c.resolve(tokens.BodyGraphService),
      entityManager: c.resolve(tokens.IEntityManager),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.JsonLogicCustomOperators
    )}.`
  );

  // Register JsonLogicEvaluationService after JsonLogicCustomOperators
  registrar.singletonFactory(tokens.JsonLogicEvaluationService, (c) => {
    const jsonLogicService = new JsonLogicEvaluationService({
      logger: c.resolve(tokens.ILogger),
      gameDataRepository: c.resolve(tokens.IGameDataRepository),
      serviceSetup: c.resolve(tokens.ServiceSetup),
    });

    // Register custom operators
    const customOperators = c.resolve(tokens.JsonLogicCustomOperators);
    customOperators.registerOperators(jsonLogicService);

    logger.debug(
      `JsonLogicEvaluationService: Registered custom operators from ${String(
        tokens.JsonLogicCustomOperators
      )}`
    );

    return jsonLogicService;
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.JsonLogicEvaluationService
    )}.`
  );

  // --- Anatomy Description Services ---
  registrar.singletonFactory(tokens.AnatomyFormattingService, (c) => {
    const anatomyFormattingService = new AnatomyFormattingService({
      dataRegistry: c.resolve(tokens.IDataRegistry),
      logger: c.resolve(tokens.ILogger),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
    });

    return anatomyFormattingService;
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.AnatomyFormattingService
    )}.`
  );

  // Activity System Components (ACTDESSERREF-001 through ACTDESSERREF-007)
  registrar.singletonFactory('IActivityCacheManager', (c) => {
    return new ActivityCacheManager({
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    'World and Entity Registration: Registered IActivityCacheManager.'
  );

  registrar.singletonFactory('IActivityIndexManager', (c) => {
    return new ActivityIndexManager({
      logger: c.resolve(tokens.ILogger),
      cacheManager: c.resolve('IActivityCacheManager'),
    });
  });
  logger.debug(
    'World and Entity Registration: Registered IActivityIndexManager.'
  );

  registrar.singletonFactory('IActivityMetadataCollectionSystem', (c) => {
    return new ActivityMetadataCollectionSystem({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
      indexManager: c.resolve('IActivityIndexManager'),
    });
  });
  logger.debug(
    'World and Entity Registration: Registered IActivityMetadataCollectionSystem.'
  );

  registrar.singletonFactory('IActivityGroupingSystem', (c) => {
    return new ActivityGroupingSystem({
      indexManager: c.resolve('IActivityIndexManager'),
      logger: c.resolve(tokens.ILogger),
      config: {
        simultaneousPriorityThreshold: 10,
      },
    });
  });
  logger.debug(
    'World and Entity Registration: Registered IActivityGroupingSystem.'
  );

  registrar.singletonFactory('IActivityNLGSystem', (c) => {
    return new ActivityNLGSystem({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
      cacheManager: c.resolve('IActivityCacheManager'),
    });
  });
  logger.debug(
    'World and Entity Registration: Registered IActivityNLGSystem.'
  );

  // Activity System: Condition Validator (ACTDESSERREF-004)
  registrar.singletonFactory('IActivityConditionValidator', (c) => {
    return new ActivityConditionValidator({
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    'World and Entity Registration: Registered IActivityConditionValidator.'
  );

  // Activity System: Filtering System (ACTDESSERREF-004)
  registrar.singletonFactory('IActivityFilteringSystem', (c) => {
    return new ActivityFilteringSystem({
      logger: c.resolve(tokens.ILogger),
      conditionValidator: c.resolve('IActivityConditionValidator'),
      jsonLogicEvaluationService: c.resolve(
        tokens.JsonLogicEvaluationService
      ),
      entityManager: c.resolve(tokens.IEntityManager),
    });
  });
  logger.debug(
    'World and Entity Registration: Registered IActivityFilteringSystem.'
  );

  // Activity System: Context Building System (ACTDESSERREF-004)
  registrar.singletonFactory('IActivityContextBuildingSystem', (c) => {
    return new ActivityContextBuildingSystem({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
      nlgSystem: c.resolve('IActivityNLGSystem'),
    });
  });
  logger.debug(
    'World and Entity Registration: Registered IActivityContextBuildingSystem.'
  );

  registrar.singletonFactory(tokens.ActivityDescriptionService, (c) => {
    return new ActivityDescriptionService({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
      anatomyFormattingService: c.resolve(tokens.AnatomyFormattingService),
      jsonLogicEvaluationService: c.resolve(
        tokens.JsonLogicEvaluationService
      ),
      cacheManager: c.resolve('IActivityCacheManager'),
      indexManager: c.resolve('IActivityIndexManager'),
      metadataCollectionSystem: c.resolve('IActivityMetadataCollectionSystem'),
      groupingSystem: c.resolve('IActivityGroupingSystem'),
      nlgSystem: c.resolve('IActivityNLGSystem'),
      filteringSystem: c.resolve('IActivityFilteringSystem'),
      contextBuildingSystem: c.resolve('IActivityContextBuildingSystem'),
      eventBus: c.isRegistered(tokens.IEventBus) ? c.resolve(tokens.IEventBus) : null,
      // activityIndex will be added in Phase 3 (ACTDESC-020)
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.ActivityDescriptionService
    )}.`
  );

  // Activity Description Facade (ACTDESSERREF-009) - Clean facade pattern
  registrar.singletonFactory('IActivityDescriptionFacade', (c) => {
    return new ActivityDescriptionFacade({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
      anatomyFormattingService: c.resolve(tokens.AnatomyFormattingService),
      cacheManager: c.resolve('IActivityCacheManager'),
      indexManager: c.resolve('IActivityIndexManager'),
      metadataCollectionSystem: c.resolve('IActivityMetadataCollectionSystem'),
      nlgSystem: c.resolve('IActivityNLGSystem'),
      groupingSystem: c.resolve('IActivityGroupingSystem'),
      contextBuildingSystem: c.resolve('IActivityContextBuildingSystem'),
      filteringSystem: c.resolve('IActivityFilteringSystem'),
      eventBus: c.isRegistered(tokens.IEventBus) ? c.resolve(tokens.IEventBus) : null,
    });
  });
  logger.debug(
    'World and Entity Registration: Registered IActivityDescriptionFacade.'
  );

  registrar.singletonFactory(tokens.DescriptorFormatter, (c) => {
    return new DescriptorFormatter({
      anatomyFormattingService: c.resolve(tokens.AnatomyFormattingService),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.DescriptorFormatter
    )}.`
  );

  registrar.singletonFactory(tokens.BodyPartDescriptionBuilder, (c) => {
    return new BodyPartDescriptionBuilder({
      descriptorFormatter: c.resolve(tokens.DescriptorFormatter),
      anatomyFormattingService: c.resolve(tokens.AnatomyFormattingService),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.BodyPartDescriptionBuilder
    )}.`
  );

  registrar.singletonFactory(tokens.BodyDescriptionComposer, (c) => {
    return new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: c.resolve(tokens.BodyPartDescriptionBuilder),
      bodyGraphService: c.resolve(tokens.BodyGraphService),
      entityFinder: c.resolve(tokens.IEntityManager),
      anatomyFormattingService: c.resolve(tokens.AnatomyFormattingService),
      partDescriptionGenerator: c.resolve(tokens.PartDescriptionGenerator),
      equipmentDescriptionService: c.resolve(
        tokens.EquipmentDescriptionService
      ),
      activityDescriptionService: c.resolve(tokens.ActivityDescriptionService),
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.BodyDescriptionComposer
    )}.`
  );

  // Register new anatomy services
  registrar.singletonFactory(tokens.PartDescriptionGenerator, (c) => {
    return new PartDescriptionGenerator({
      logger: c.resolve(tokens.ILogger),
      bodyPartDescriptionBuilder: c.resolve(tokens.BodyPartDescriptionBuilder),
      entityManager: c.resolve(tokens.IEntityManager),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.PartDescriptionGenerator
    )}.`
  );

  registrar.singletonFactory(tokens.DescriptionPersistenceService, (c) => {
    return new DescriptionPersistenceService({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
      eventBus: c.resolve(tokens.ISafeEventDispatcher),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.DescriptionPersistenceService
    )}.`
  );

  registrar.singletonFactory(tokens.BodyDescriptionOrchestrator, (c) => {
    return new BodyDescriptionOrchestrator({
      logger: c.resolve(tokens.ILogger),
      bodyDescriptionComposer: c.resolve(tokens.BodyDescriptionComposer),
      bodyGraphService: c.resolve(tokens.BodyGraphService),
      eventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      entityManager: c.resolve(tokens.IEntityManager),
      partDescriptionGenerator: c.resolve(tokens.PartDescriptionGenerator),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.BodyDescriptionOrchestrator
    )}.`
  );

  registrar.singletonFactory(tokens.AnatomyDescriptionService, (c) => {
    return new AnatomyDescriptionService({
      bodyPartDescriptionBuilder: c.resolve(tokens.BodyPartDescriptionBuilder),
      bodyDescriptionComposer: c.resolve(tokens.BodyDescriptionComposer),
      bodyGraphService: c.resolve(tokens.BodyGraphService),
      entityFinder: c.resolve(tokens.IEntityManager),
      componentManager: c.resolve(tokens.IEntityManager),
      eventDispatchService: c.resolve(tokens.EventDispatchService),
      partDescriptionGenerator: c.resolve(tokens.PartDescriptionGenerator),
      bodyDescriptionOrchestrator: c.resolve(
        tokens.BodyDescriptionOrchestrator
      ),
      descriptionPersistenceService: c.resolve(
        tokens.DescriptionPersistenceService
      ),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.AnatomyDescriptionService
    )}.`
  );

  registrar.singletonFactory(tokens.AnatomyGenerationService, (c) => {
    return new AnatomyGenerationService({
      entityManager: c.resolve(tokens.IEntityManager),
      dataRegistry: c.resolve(tokens.IDataRegistry),
      logger: c.resolve(tokens.ILogger),
      bodyBlueprintFactory: c.resolve(tokens.BodyBlueprintFactory),
      anatomyDescriptionService: c.resolve(tokens.AnatomyDescriptionService),
      bodyGraphService: c.resolve(tokens.BodyGraphService),
      clothingInstantiationService: c.resolve(
        tokens.ClothingInstantiationService
      ),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.AnatomyGenerationService
    )}.`
  );

  // Register clothing validation services
  registrar.singletonFactory(tokens.LayerCompatibilityService, (c) => {
    return new LayerCompatibilityService({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.LayerCompatibilityService
    )}.`
  );

  // Register ClothingSlotValidator
  registrar.singletonFactory(tokens.ClothingSlotValidator, (c) => {
    return new ClothingSlotValidator({
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.ClothingSlotValidator
    )}.`
  );

  // Register EquipmentOrchestrator
  registrar.singletonFactory(tokens.EquipmentOrchestrator, (c) => {
    return new EquipmentOrchestrator({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
      eventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      layerCompatibilityService: c.resolve(tokens.LayerCompatibilityService),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.EquipmentOrchestrator
    )}.`
  );

  // Register LayerResolutionService
  registrar.singletonFactory(tokens.LayerResolutionService, (c) => {
    return new LayerResolutionService({
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.LayerResolutionService
    )}.`
  );

  // Register AnatomyCacheCoordinator
  registrar.singletonFactory(tokens.IAnatomyCacheCoordinator, (c) => {
    return new AnatomyCacheCoordinator({
      eventBus: c.resolve(tokens.IEventBus),
      logger: c.resolve(tokens.ILogger),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.IAnatomyCacheCoordinator
    )}.`
  );

  // Register AnatomySocketIndex
  registrar.singletonFactory(tokens.IAnatomySocketIndex, (c) => {
    return new AnatomySocketIndex({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
      bodyGraphService: c.resolve(tokens.BodyGraphService),
      cacheCoordinator: c.resolve(tokens.IAnatomyCacheCoordinator),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.IAnatomySocketIndex
    )}.`
  );

  // Register AnatomyBlueprintRepository
  registrar.singletonFactory(tokens.IAnatomyBlueprintRepository, (c) => {
    return new AnatomyBlueprintRepository({
      logger: c.resolve(tokens.ILogger),
      dataRegistry: c.resolve(tokens.IDataRegistry),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.IAnatomyBlueprintRepository
    )}.`
  );

  // Register RecipePreflightValidator
  registrar.singletonFactory(tokens.IRecipePreflightValidator, (c) => {
    return new RecipePreflightValidator({
      logger: c.resolve(tokens.ILogger),
      dataRegistry: c.resolve(tokens.IDataRegistry),
      anatomyBlueprintRepository: c.resolve(tokens.IAnatomyBlueprintRepository),
      schemaValidator: c.resolve(tokens.ISchemaValidator),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.IRecipePreflightValidator
    )}.`
  );

  // Register AnatomyClothingCache
  registrar.singletonFactory(tokens.AnatomyClothingCache, (c) => {
    return new AnatomyClothingCache(
      {
        logger: c.resolve(tokens.ILogger),
      },
      ANATOMY_CLOTHING_CACHE_CONFIG
    );
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.AnatomyClothingCache
    )}.`
  );

  // Register SlotResolver
  registrar.singletonFactory(tokens.SlotResolver, (c) => {
    return new SlotResolver({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
      bodyGraphService: c.resolve(tokens.BodyGraphService),
      anatomyBlueprintRepository: c.resolve(tokens.IAnatomyBlueprintRepository),
      anatomySocketIndex: c.resolve(tokens.IAnatomySocketIndex),
      cache: c.resolve(tokens.AnatomyClothingCache),
      cacheCoordinator: c.resolve(tokens.IAnatomyCacheCoordinator),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(tokens.SlotResolver)}.`
  );

  // Register ClothingManagementService using decomposed services
  registrar.singletonFactory(tokens.ClothingManagementService, (c) => {
    return new ClothingManagementService({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
      eventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      equipmentOrchestrator: c.resolve(tokens.EquipmentOrchestrator),
      anatomyBlueprintRepository: c.resolve(tokens.IAnatomyBlueprintRepository),
      clothingSlotValidator: c.resolve(tokens.ClothingSlotValidator),
      bodyGraphService: c.resolve(tokens.BodyGraphService),
      anatomyClothingCache: c.resolve(tokens.AnatomyClothingCache),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.ClothingManagementService
    )}.`
  );

  // Register ClothingAccessibilityService
  registrar.singletonFactory(tokens.ClothingAccessibilityService, (c) => {
    const entityManager = c.resolve(tokens.IEntityManager);
    const logger = c.resolve(tokens.ILogger);

    return new ClothingAccessibilityService({
      logger,
      entityManager,
      entitiesGateway: entityManager, // Use EntityManager directly as gateway
    });
  });

  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.ClothingAccessibilityService
    )}.`
  );

  // Register EquipmentDescriptionService after ClothingManagementService
  registrar.singletonFactory(tokens.EquipmentDescriptionService, (c) => {
    return new EquipmentDescriptionService({
      logger: c.resolve(tokens.ILogger),
      entityManager: c.resolve(tokens.IEntityManager),
      descriptorFormatter: c.resolve(tokens.DescriptorFormatter),
      clothingManagementService: c.resolve(tokens.ClothingManagementService),
      anatomyFormattingService: c.resolve(tokens.AnatomyFormattingService),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.EquipmentDescriptionService
    )}.`
  );

  // Register ClothingInstantiationService
  registrar.singletonFactory(tokens.ClothingInstantiationService, (c) => {
    return new ClothingInstantiationService({
      entityManager: c.resolve(tokens.IEntityManager),
      dataRegistry: c.resolve(tokens.IDataRegistry),
      equipmentOrchestrator: c.resolve(tokens.EquipmentOrchestrator),
      slotResolver: c.resolve(tokens.SlotResolver),
      clothingSlotValidator: c.resolve(tokens.ClothingSlotValidator),
      anatomyBlueprintRepository: c.resolve(tokens.IAnatomyBlueprintRepository),
      bodyGraphService: c.resolve(tokens.BodyGraphService),
      anatomyClothingCache: c.resolve(tokens.AnatomyClothingCache),
      layerResolutionService: c.resolve(tokens.LayerResolutionService),
      logger: c.resolve(tokens.ILogger),
      eventBus: c.resolve(tokens.ISafeEventDispatcher),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.ClothingInstantiationService
    )}.`
  );

  // Register ClothingInstantiationServiceV2 with decomposed dependencies
  registrar.singletonFactory(tokens.ClothingInstantiationServiceV2, (c) => {
    return new ClothingInstantiationService({
      entityManager: c.resolve(tokens.IEntityManager),
      dataRegistry: c.resolve(tokens.IDataRegistry),
      equipmentOrchestrator: c.resolve(tokens.EquipmentOrchestrator),
      slotResolver: c.resolve(tokens.SlotResolver),
      clothingSlotValidator: c.resolve(tokens.ClothingSlotValidator),
      anatomyBlueprintRepository: c.resolve(tokens.IAnatomyBlueprintRepository),
      bodyGraphService: c.resolve(tokens.BodyGraphService),
      anatomyClothingCache: c.resolve(tokens.AnatomyClothingCache),
      layerResolutionService: c.resolve(tokens.LayerResolutionService),
      logger: c.resolve(tokens.ILogger),
      eventBus: c.resolve(tokens.ISafeEventDispatcher),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.ClothingInstantiationServiceV2
    )}.`
  );

  registrar
    .tagged(INITIALIZABLE)
    .singletonFactory(tokens.AnatomyInitializationService, (c) => {
      return new AnatomyInitializationService({
        eventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        logger: c.resolve(tokens.ILogger),
        anatomyGenerationService: c.resolve(tokens.AnatomyGenerationService),
      });
    });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.AnatomyInitializationService
    )}.`
  );

  logger.debug('World and Entity Registration: Completed.');
}
