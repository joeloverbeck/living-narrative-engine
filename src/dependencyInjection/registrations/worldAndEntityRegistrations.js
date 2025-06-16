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

// --- DI & Helper Imports ---
import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';

// --- Service Imports ---
import WorldContext from '../../context/worldContext.js';
import JsonLogicEvaluationService from '../../logic/jsonLogicEvaluationService.js';
import { EntityDisplayDataProvider } from '../../entities/entityDisplayDataProvider.js';

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
    tokens.ILogger, tokens.IGameDataRepository
  ]);
  logger.debug(
    `World and Entity Registration: Registered ${String(tokens.JsonLogicEvaluationService)}.`
  );

  r.singletonFactory(tokens.EntityDisplayDataProvider, (c) => {
    return new EntityDisplayDataProvider({
      entityManager: /** @type {IEntityManager} */ (
        c.resolve(tokens.IEntityManager)
      ),
      logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
    });
  });
  logger.debug(
    `World and Entity Registration: Registered ${String(tokens.EntityDisplayDataProvider)}.`
  );

  logger.debug('World and Entity Registration: Completed.');
}
