// src/dependencyInjection/registrations/infrastructureRegistrations.js

import EventBus from '../../events/eventBus.js';
import SpatialIndexManager from '../../entities/spatialIndexManager.js';
import WorldLoader from '../../loaders/worldLoader.js';
import PromptTextLoader from '../../loaders/promptTextLoader.js';
import { GameDataRepository } from '../../data/gameDataRepository.js'; // Concrete class
import ValidatedEventDispatcher from '../../events/validatedEventDispatcher.js'; // Concrete Class Import
import { SafeEventDispatcher } from '../../events/safeEventDispatcher.js';
import ModDependencyValidator from '../../modding/modDependencyValidator.js';
import validateModEngineVersions from '../../modding/modVersionValidator.js';
import * as ModLoadOrderResolver from '../../modding/modLoadOrderResolver.js';
import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';
import { ActionIndexingService } from '../../turns/services/actionIndexingService';

/**
 * @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger
 * @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry
 * @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator
 * @typedef {import('../../interfaces/coreServices.js').ISpatialIndexManager} ISpatialIndexManager
 * @typedef {import('../../interfaces/coreServices.js').IConfiguration} IConfiguration
 * @typedef {import('../../loaders/schemaLoader.js').default} SchemaLoader
 * @typedef {import('../../loaders/componentLoader.js').default} ComponentDefinitionLoader
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
  log.debug(`Infrastructure Registration: Registered ${String(tokens.EventBus)}.`);

  container.register(
    tokens.ISpatialIndexManager,
    () => new SpatialIndexManager(),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Infrastructure Registration: Registered ${String(tokens.ISpatialIndexManager)}.`
  );

  r.singletonFactory(
    tokens.PromptTextLoader,
    (c) =>
      new PromptTextLoader({
        configuration: c.resolve(tokens.IConfiguration),
        pathResolver: c.resolve(tokens.IPathResolver),
        dataFetcher: c.resolve(tokens.IDataFetcher),
        schemaValidator: c.resolve(tokens.ISchemaValidator),
        dataRegistry: c.resolve(tokens.IDataRegistry),
        logger: c.resolve(tokens.ILogger),
      })
  );
  log.debug(
    `Infrastructure Registration: Registered ${String(tokens.PromptTextLoader)}.`
  );

  container.register(
    tokens.WorldLoader,
    (c) => {
      const dependencies = {
        registry: c.resolve(tokens.IDataRegistry),
        logger: c.resolve(tokens.ILogger),
        schemaLoader: c.resolve(tokens.SchemaLoader),
        conditionLoader: c.resolve(tokens.ConditionLoader),
        componentLoader: c.resolve(tokens.ComponentDefinitionLoader),
        macroLoader: c.resolve(tokens.MacroLoader),
        ruleLoader: c.resolve(tokens.RuleLoader),
        actionLoader: c.resolve(tokens.ActionLoader),
        eventLoader: c.resolve(tokens.EventLoader),
        entityLoader: c.resolve(tokens.EntityLoader),
        validator: c.resolve(tokens.ISchemaValidator),
        configuration: c.resolve(tokens.IConfiguration),
        gameConfigLoader: c.resolve(tokens.GameConfigLoader),
        promptTextLoader: c.resolve(tokens.PromptTextLoader),
        modManifestLoader: c.resolve(tokens.ModManifestLoader),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        modDependencyValidator: ModDependencyValidator,
        modVersionValidator: validateModEngineVersions,
        modLoadOrderResolver: ModLoadOrderResolver,
      };
      return new WorldLoader(dependencies);
    },
    { lifecycle: 'singleton' }
  );
  log.debug(`Infrastructure Registration: Registered ${String(tokens.WorldLoader)}.`);

  container.register(
    tokens.IGameDataRepository,
    (c) =>
      new GameDataRepository(
        /** @type {IDataRegistry} */ (c.resolve(tokens.IDataRegistry)),
        /** @type {ILogger} */ (c.resolve(tokens.ILogger))
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

  log.debug('Infrastructure Registration: complete.');
}