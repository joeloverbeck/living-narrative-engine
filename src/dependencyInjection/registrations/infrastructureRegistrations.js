// src/dependencyInjection/registrations/infrastructureRegistrations.js

import EventBus from '../../events/eventBus.js';
import SpatialIndexManager from '../../entities/spatialIndexManager.js';
import WorldLoader from '../../loaders/worldLoader.js';
import { GameDataRepository } from '../../data/gameDataRepository.js'; // Concrete class
import EntityManager from '../../entities/entityManager.js'; // Concrete class
import ValidatedEventDispatcher from '../../events/validatedEventDispatcher.js'; // Concrete Class Import
import { SafeEventDispatcher } from '../../events/safeEventDispatcher.js';
import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';
import { SystemServiceRegistry } from '../../registry/systemServiceRegistry.js';
import { SystemDataRegistry } from '../../data/systemDataRegistry.js';

// --- ADDED IMPORT FOR SaveLoadService ---
import SaveLoadService from '../../persistence/saveLoadService.js';
import { BrowserStorageProvider } from '../../storage/browserStorageProvider.js';

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
 * @typedef {import('../../loaders/entityLoader.js').default} EntityLoader
 * @typedef {import('../../loaders/gameConfigLoader.js').default} GameConfigLoader
 * @typedef {import('../../modding/modManifestLoader.js').default} ModManifestLoader
 * @typedef {import('../../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher // For WorldLoader & Self
 * @typedef {import('../../events/safeEventDispatcher.js').default} SafeEventDispatcher
 * @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher // For SafeEventDispatcher
 * @typedef {import('../../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository
 * @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager
 * @typedef {import('../../interfaces/IStorageProvider.js').IStorageProvider} IStorageProvider // For SaveLoadService type hint
 * @typedef {import('../../interfaces/ISaveLoadService.js').ISaveLoadService} ISaveLoadService_Interface // For type hint
 */

/**
 *
 * @param container
 */
export function registerInfrastructure(container) {
  const r = new Registrar(container);
  /** @type {ILogger} */
  const log = container.resolve(tokens.ILogger);

  log.debug('Infrastructure Registration: starting…');

  r.single(tokens.EventBus, EventBus);
  log.debug(`Infrastructure Registration: Registered ${tokens.EventBus}.`);

  container.register(
    tokens.ISpatialIndexManager,
    () => new SpatialIndexManager(),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Infrastructure Registration: Registered ${tokens.ISpatialIndexManager}.`
  );

  // --- UPDATED WorldLoader Factory (Ticket 15) ---
  // Now uses a dependency object constructor.
  container.register(
    tokens.WorldLoader,
    (c) => {
      // Create the dependency object required by the constructor
      const dependencies = {
        registry: c.resolve(tokens.IDataRegistry),
        logger: c.resolve(tokens.ILogger),
        schemaLoader: c.resolve(tokens.SchemaLoader),
        componentLoader: c.resolve(tokens.ComponentDefinitionLoader),
        ruleLoader: c.resolve(tokens.RuleLoader),
        actionLoader: c.resolve(tokens.ActionLoader),
        eventLoader: c.resolve(tokens.EventLoader),
        entityLoader: c.resolve(tokens.EntityLoader),
        validator: c.resolve(tokens.ISchemaValidator),
        configuration: c.resolve(tokens.IConfiguration),
        gameConfigLoader: c.resolve(tokens.GameConfigLoader),
        modManifestLoader: c.resolve(tokens.ModManifestLoader),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
      };
      // Pass the single dependency object to the constructor
      return new WorldLoader(dependencies);
    },
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Infrastructure Registration: Registered ${tokens.WorldLoader} (with VED dependency).`
  );

  // Register GameDataRepository against IGameDataRepository token
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
    `Infrastructure Registration: Registered ${tokens.IGameDataRepository}.`
  );

  // Register EntityManager against IEntityManager token
  container.register(
    tokens.IEntityManager,
    (c) =>
      new EntityManager(
        /** @type {IDataRegistry} */ (c.resolve(tokens.IDataRegistry)),
        /** @type {ISchemaValidator} */ (c.resolve(tokens.ISchemaValidator)),
        /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
        /** @type {ISpatialIndexManager} */ (
          c.resolve(tokens.ISpatialIndexManager)
        )
      ),
    { lifecycle: 'singleton' }
  );
  log.debug(
    `Infrastructure Registration: Registered ${tokens.IEntityManager}.`
  );

  // --- Register ValidatedEventDispatcher against its Interface Token ---
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
    `Infrastructure Registration: Registered ${tokens.IValidatedEventDispatcher}.`
  );

  // Register SafeEventDispatcher
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
    `Infrastructure Registration: Registered ${tokens.ISafeEventDispatcher}.`
  );

  r.singletonFactory(
    tokens.SystemServiceRegistry,
    (c) =>
      new SystemServiceRegistry(
        /** @type {ILogger} */ (c.resolve(tokens.ILogger))
      )
  );
  log.debug(
    `Infrastructure Registration: Registered ${tokens.SystemServiceRegistry}.`
  );

  // Register SystemDataRegistry (depends on ILogger)
  r.singletonFactory(
    tokens.SystemDataRegistry,
    (c) =>
      new SystemDataRegistry(/** @type {ILogger} */ (c.resolve(tokens.ILogger)))
  );
  log.debug(
    `Infrastructure Registration: Registered ${tokens.SystemDataRegistry}.`
  );

  r.single(tokens.IStorageProvider, BrowserStorageProvider, [
    tokens.ILogger /*, other dependencies */,
  ]);
  log.debug(
    `Infrastructure Registration: Registered ${String(tokens.IStorageProvider)} implemented by BrowserStorageProvider.`
  );

  // --- ADDED REGISTRATION FOR SaveLoadService ---
  // Assumes tokens.IStorageProvider is a valid, registered token.
  // If IStorageProvider is not yet registered, its registration would be a prerequisite,
  // typically also within this infrastructure bundle.
  r.single(tokens.ISaveLoadService, SaveLoadService, [
    tokens.ILogger,
    tokens.IStorageProvider, // SaveLoadService constructor expects 'logger' and 'storageProvider'
    // Registrar.single will map tokens.ILogger to 'logger' and
    // tokens.IStorageProvider to 'storageProvider' in the dependency object.
  ]);
  log.debug(
    `Infrastructure Registration: Registered ${String(tokens.ISaveLoadService)} implemented by SaveLoadService.`
  );
  // --- END ADDED REGISTRATION ---

  log.debug('Infrastructure Registration: complete.');
}

// --- FILE END ---
