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
import { BodyBlueprintFactory } from '../../anatomy/bodyBlueprintFactory.js';
import { GraphIntegrityValidator } from '../../anatomy/graphIntegrityValidator.js';
import { BodyGraphService } from '../../anatomy/bodyGraphService.js';
import { AnatomyGenerationService } from '../../anatomy/anatomyGenerationService.js';
import { AnatomyInitializationService } from '../../anatomy/anatomyInitializationService.js';
import { DescriptorFormatter } from '../../anatomy/descriptorFormatter.js';
import { BodyPartDescriptionBuilder } from '../../anatomy/bodyPartDescriptionBuilder.js';
import { BodyDescriptionComposer } from '../../anatomy/bodyDescriptionComposer.js';
import { AnatomyDescriptionService } from '../../anatomy/anatomyDescriptionService.js';
import { AnatomyFormattingService } from '../../services/anatomyFormattingService.js';
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

  registrar.single(
    tokens.JsonLogicEvaluationService,
    JsonLogicEvaluationService,
    [tokens.ILogger, tokens.IGameDataRepository, tokens.ServiceSetup]
  );
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.JsonLogicEvaluationService
    )}.`
  );

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

  registrar.singletonFactory(tokens.BodyBlueprintFactory, (c) => {
    return new BodyBlueprintFactory({
      entityManager: c.resolve(tokens.IEntityManager),
      dataRegistry: c.resolve(tokens.IDataRegistry),
      logger: c.resolve(tokens.ILogger),
      eventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      eventDispatchService: c.resolve(tokens.EventDispatchService),
      idGenerator: UuidGenerator,
      validator: c.resolve(tokens.GraphIntegrityValidator),
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
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.BodyGraphService
    )}.`
  );

  // --- Anatomy Description Services ---
  registrar.singletonFactory(tokens.AnatomyFormattingService, (c) => {
    // Get mod load order from game config
    const gameConfig = c
      .resolve(tokens.IDataRegistry)
      .get('gameConfig', 'game');
    const modLoadOrder = gameConfig?.mods || [];

    return new AnatomyFormattingService({
      dataRegistry: c.resolve(tokens.IDataRegistry),
      logger: c.resolve(tokens.ILogger),
      modLoadOrder: modLoadOrder,
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.AnatomyFormattingService
    )}.`
  );

  registrar.singletonFactory(tokens.DescriptorFormatter, (c) => {
    const anatomyFormattingService = c.resolve(tokens.AnatomyFormattingService);
    anatomyFormattingService.initialize(); // Initialize before use
    return new DescriptorFormatter({
      anatomyFormattingService: anatomyFormattingService,
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
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.BodyDescriptionComposer
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
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.AnatomyGenerationService
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
