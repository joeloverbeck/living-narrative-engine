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
import { Registrar } from '../registrarHelpers.js';
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
import LocationDisplayService from '../../entities/services/locationDisplayService.js';
import { BodyBlueprintFactory } from '../../anatomy/bodyBlueprintFactory.js';
import { GraphIntegrityValidator } from '../../anatomy/graphIntegrityValidator.js';
import { BodyGraphService } from '../../anatomy/bodyGraphService.js';

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
    [tokens.ILogger, tokens.IGameDataRepository]
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
      idGenerator: c.resolve(tokens.IIdGenerator),
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

  logger.debug('World and Entity Registration: Completed.');
}
