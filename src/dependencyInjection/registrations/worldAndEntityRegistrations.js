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

/**
 * Registers world, entity, and context-related services.
 *
 * @param {AppContainer} container - The DI container.
 */
export function registerWorldAndEntity(container) {
  const r = new Registrar(container);
  /** @type {ILogger} */
  const logger = container.resolve(tokens.ILogger);
  logger.debug('World and Entity Registration: Starting...');

  // --- IEntityManager (EntityManager implementation) ---
  r.singletonFactory(tokens.IEntityManager, (c) => {
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

  r.singletonFactory(
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

  r.single(tokens.JsonLogicEvaluationService, JsonLogicEvaluationService, [
    tokens.ILogger,
    tokens.IGameDataRepository,
  ]);
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.JsonLogicEvaluationService
    )}.`
  );

  r.single(tokens.ClosenessCircleService, closenessCircleService, []);
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.ClosenessCircleService
    )}.`
  );

  r.singletonFactory(tokens.EntityDisplayDataProvider, (c) => {
    return new EntityDisplayDataProvider({
      entityManager: /** @type {IEntityManager} */ (
        c.resolve(tokens.IEntityManager)
      ),
      logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
      safeEventDispatcher: /** @type {ISafeEventDispatcher} */ (
        c.resolve(tokens.ISafeEventDispatcher)
      ),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.EntityDisplayDataProvider
    )}.`
  );

  // --- SpatialIndexSynchronizer ---
  r.tagged(INITIALIZABLE).singletonFactory(
    tokens.SpatialIndexSynchronizer,
    (c) => {
      return new SpatialIndexSynchronizer({
        spatialIndexManager: c.resolve(tokens.ISpatialIndexManager),
        safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
        logger: c.resolve(tokens.ILogger),
      });
    }
  );
  logger.debug(
    `World and Entity Registration: Registered ${String(
      tokens.SpatialIndexSynchronizer
    )} tagged ${INITIALIZABLE.join(', ')}.`
  );

  // --- LocationQueryService ---
  r.singletonFactory(tokens.LocationQueryService, (c) => {
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

  logger.debug('World and Entity Registration: Completed.');
}