// src/dependencyInjection/registrations/infrastructureRegistrations.js

import EventBus from '../../events/eventBus.js';
import SpatialIndexManager from '../../entities/spatialIndexManager.js';
// REMOVED: Unused loader imports
// import ModsLoader from '../../loaders/modsLoader.js';
// import PromptTextLoader from '../../loaders/promptTextLoader.js';
import { GameDataRepository } from '../../data/gameDataRepository.js'; // Concrete class
import ValidatedEventDispatcher from '../../events/validatedEventDispatcher.js'; // Concrete Class Import
import { SafeEventDispatcher } from '../../events/safeEventDispatcher.js';
import ModDependencyValidator from '../../modding/modDependencyValidator.js';
import validateModEngineVersions from '../../modding/modVersionValidator.js';
import * as ModLoadOrderResolver from '../../modding/modLoadOrderResolver.js';
import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';
import { ActionIndexingService } from '../../turns/services/actionIndexingService';
import ScopeRegistry from '../../scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../scopeDsl/engine.js';
import ScopeCache, { LRUCache } from '../../scopeDsl/cache.js';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../../interfaces/coreServices.js').ISpatialIndexManager} ISpatialIndexManager
 * @typedef {import('../../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../../loaders/schemaLoader.js').default} SchemaLoader
 * @typedef {import('../../loaders/componentLoader.js').default} ComponentLoader
 * @typedef {import('../../loaders/ruleLoader.js').default} RuleLoader
 * @typedef {import('../../loaders/actionLoader.js').default} ActionLoader
 * @typedef {import('../../loaders/eventLoader.js').default} EventLoader
 * @typedef {import('../../loaders/macroLoader.js').default} MacroLoader
 * @typedef {import('../../loaders/entityDefinitionLoader.js').default} EntityLoader
 * @typedef {import('../../loaders/gameConfigLoader.js').default} GameConfigLoader
 * @typedef {import('../../loaders/promptTextLoader.js').default} PromptTextLoader
 * @typedef {import('../../modding/modManifestLoader.js').default} ModManifestLoader
 * @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher
 * @typedef {import('../../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository
 * @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 */

/**
 * Registers foundational infrastructure services.
 *
 * @param container
 */
export function registerInfrastructure(container) {
  const r = new Registrar(container);
  /** @type {ILogger} */
  const log = container.resolve(tokens.ILogger);

  log.debug('Infrastructure Registration: starting…');

  // ─── Shared ActionIndexingService ─────────────────────────────
  r.singletonFactory(
    tokens.ActionIndexingService,
    // ActionIndexingService needs { logger }
    (c) =>
      new ActionIndexingService({
        logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
      })
  );
  log.debug(
    `Infrastructure Registration: Registered ${String(tokens.ActionIndexingService)}.`
  );

  r.single(tokens.EventBus, EventBus);
  log.debug(
    `Infrastructure Registration: Registered ${String(tokens.EventBus)}.`
  );

  container.register(
    tokens.ISpatialIndexManager,
    (c) => new SpatialIndexManager({ logger: c.resolve(tokens.ILogger) }),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Infrastructure Registration: Registered ${String(tokens.ISpatialIndexManager)}.`
  );

  // --- FIXED: Removed duplicate loader registrations ---
  // `PromptTextLoader` is now correctly registered only in `loadersRegistrations.js`.
  // `ModsLoader` is now correctly registered only in `loadersRegistrations.js`.

  container.register(
    tokens.IGameDataRepository,
    (c) =>
      new GameDataRepository(
        /** @type {IDataRegistry} */(c.resolve(tokens.IDataRegistry)),
        /** @type {ILogger} */(c.resolve(tokens.ILogger))
      ),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Infrastructure Registration: Registered ${String(tokens.IGameDataRepository)}.`
  );

  // DELETED: Duplicate IEntityManager registration removed as per Ticket 8.
  // The canonical registration is now in worldAndEntityRegistrations.js.

  container.register(
    tokens.IValidatedEventDispatcher,
    (c) =>
      new ValidatedEventDispatcher({
        eventBus: c.resolve(tokens.EventBus),
        gameDataRepository: c.resolve(tokens.IGameDataRepository),
        schemaValidator: /** @type {ISchemaValidator} */ (
          c.resolve(tokens.ISchemaValidator)
        ),
        logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
      }),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Infrastructure Registration: Registered ${String(tokens.IValidatedEventDispatcher)}.`
  );

  r.singletonFactory(
    tokens.ISafeEventDispatcher,
    (c) =>
      new SafeEventDispatcher({
        validatedEventDispatcher: /** @type {IValidatedEventDispatcher} */ (
          c.resolve(tokens.IValidatedEventDispatcher)
        ),
        logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
      })
  );
  log.debug(
    `Infrastructure Registration: Registered ${String(tokens.ISafeEventDispatcher)}.`
  );

  // Scope DSL Engine
  r.single(tokens.ScopeEngine, ScopeEngine);
  log.debug(
    `Infrastructure Registration: Registered ${String(tokens.ScopeEngine)}.`
  );

  // Scope DSL Cache (wraps ScopeEngine with caching)
  r.singletonFactory(
    tokens.ScopeCache,
    (c) => new ScopeCache({
      cache: new LRUCache(256),
      scopeEngine: c.resolve(tokens.ScopeEngine),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      logger: c.resolve(tokens.ILogger)
    })
  );
  log.debug(
    `Infrastructure Registration: Registered ${String(tokens.ScopeCache)}.`
  );

  // Register ScopeCache as the preferred IScopeEngine implementation
  container.register(
    tokens.IScopeEngine,
    (c) => c.resolve(tokens.ScopeCache),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Infrastructure Registration: Registered ${String(tokens.IScopeEngine)} -> ScopeCache.`
  );

  log.debug('Infrastructure Registration: complete.');
}
