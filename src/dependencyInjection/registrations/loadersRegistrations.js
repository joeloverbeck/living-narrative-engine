// Filename: src/dependencyInjection/registrations/loaderRegistrations.js

/**
 * @file Registers data loading services and their core dependencies.
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../loaders/schemaLoader.js').default} SchemaLoader */
/** @typedef {import('../../loaders/ruleLoader.js').default} RuleLoader */
/** @typedef {import('../../loaders/componentLoader.js').default} ComponentDefinitionLoader */
/** @typedef {import('../../loaders/gameConfigLoader.js').default} GameConfigLoader */ // <<< ADDED
/** @typedef {import('../../modding/modManifestLoader.js').default} ModManifestLoader */ // <<< ADDED: MODLOADER-005 A
/** @typedef {import('../../loaders/actionLoader.js').default} ActionLoader */ // <<< ADDED: LOADER-001
/** @typedef {import('../../loaders/eventLoader.js').default} EventLoader */ // <<< ADDED: LOADER-003
/** @typedef {import('../../loaders/entityLoader.js').default} EntityLoader */ // <<< ADDED: LOADER-004-F
/** @typedef {import('../../configuration/staticConfiguration.js').default} StaticConfiguration */
/** @typedef {import('../../pathing/defaultPathResolver.js').default} DefaultPathResolver */
/** @typedef {import('../../validation/ajvSchemaValidator.js').default} AjvSchemaValidator */
/** @typedef {import('../../data/inMemoryDataRegistry.js').default} InMemoryDataRegistry */
/** @typedef {import('../../data/workspaceDataFetcher.js').default} WorkspaceDataFetcher */

// --- Core Service Imports ---
import StaticConfiguration from '../../configuration/staticConfiguration.js';
import DefaultPathResolver from '../../pathing/defaultPathResolver.js';
import AjvSchemaValidator from '../../validation/ajvSchemaValidator.js';
import InMemoryDataRegistry from '../../data/inMemoryDataRegistry.js';
import WorkspaceDataFetcher from '../../data/workspaceDataFetcher.js';

// --- Loader Imports ---
import SchemaLoader from '../../loaders/schemaLoader.js';
import RuleLoader from '../../loaders/ruleLoader.js';
import ComponentLoader from '../../loaders/componentLoader.js';
import GameConfigLoader from '../../loaders/gameConfigLoader.js';
import ModManifestLoader from '../../modding/modManifestLoader.js';
import ActionLoader from '../../loaders/actionLoader.js';
import EventLoader from '../../loaders/eventLoader.js';
import EntityLoader from '../../loaders/entityLoader.js';

// --- DI & Helper Imports ---
import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';

/**
 * Registers core data infrastructure services (Configuration, PathResolver, Validator, Registry, Fetcher)
 * and specific data loaders (Schema, Manifest, Rules, Generic Content, Component Definitions, Game Config, Mod Manifests). // <<< UPDATED Description
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 */
export function registerLoaders(container) {
  const registrar = new Registrar(container);
  // Resolve logger early for use within this registration bundle
  /** @type {ILogger} */
  const logger = container.resolve(tokens.ILogger);
  logger.debug(
    'Loaders Registration: Starting core services and data loaders...'
  );

  // === Core Infrastructure Interfaces ===
  // These are fundamental services needed by the loaders and other parts of the app.
  registrar.singletonFactory(
    tokens.IConfiguration,
    () => new StaticConfiguration()
  );
  logger.debug(`Loaders Registration: Registered ${tokens.IConfiguration}.`);

  // DefaultPathResolver depends on IConfiguration
  registrar.singletonFactory(
    tokens.IPathResolver,
    (c) => new DefaultPathResolver(c.resolve(tokens.IConfiguration))
  );
  logger.debug(`Loaders Registration: Registered ${tokens.IPathResolver}.`);

  // AjvSchemaValidator depends on ILogger
  // Corrected registration: Pass the resolved logger
  registrar.singletonFactory(
    tokens.ISchemaValidator,
    (c) =>
      new AjvSchemaValidator(
        c.resolve(tokens.ILogger) // <-- Resolve and pass ILogger here
      )
  );
  logger.debug(`Loaders Registration: Registered ${tokens.ISchemaValidator}.`);

  registrar.singletonFactory(
    tokens.IDataRegistry,
    () => new InMemoryDataRegistry()
  );
  logger.debug(`Loaders Registration: Registered ${tokens.IDataRegistry}.`);

  registrar.singletonFactory(
    tokens.IDataFetcher,
    () => new WorkspaceDataFetcher()
  );
  logger.debug(`Loaders Registration: Registered ${tokens.IDataFetcher}.`);

  // === Data Loaders ===
  // These services are responsible for fetching, validating, and potentially processing
  // specific types of game data files.

  // SchemaLoader depends on IConfiguration, IPathResolver, IDataFetcher, ISchemaValidator, ILogger
  registrar.singletonFactory(
    tokens.SchemaLoader,
    (c) =>
      new SchemaLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.ILogger) // Pass logger here too
      )
  );
  logger.debug(`Loaders Registration: Registered ${tokens.SchemaLoader}.`);

  // RuleLoader depends on IPathResolver, IDataFetcher, ISchemaValidator, IDataRegistry, ILogger
  registrar.singletonFactory(
    tokens.RuleLoader,
    (c) =>
      new RuleLoader(
        c.resolve(tokens.IConfiguration), // <<< FIXED: RuleLoader needs dependencyInjection too
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger) // Pass logger here too
      )
  );
  logger.debug(`Loaders Registration: Registered ${tokens.RuleLoader}.`);

  // ComponentDefinitionLoader depends on IConfiguration, IPathResolver, IDataFetcher, ISchemaValidator, IDataRegistry, ILogger
  registrar.singletonFactory(
    tokens.ComponentDefinitionLoader,
    (c) =>
      new ComponentLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger) // Pass logger here too
      )
  );
  logger.debug(
    `Loaders Registration: Registered ${tokens.ComponentDefinitionLoader}.`
  );

  // GameConfigLoader depends on IConfiguration, IPathResolver, IDataFetcher, ISchemaValidator, ILogger
  registrar.singletonFactory(
    tokens.GameConfigLoader,
    (c) =>
      new GameConfigLoader({
        configuration: c.resolve(tokens.IConfiguration),
        pathResolver: c.resolve(tokens.IPathResolver),
        dataFetcher: c.resolve(tokens.IDataFetcher),
        schemaValidator: c.resolve(tokens.ISchemaValidator),
        logger: c.resolve(tokens.ILogger), // Correctly passing logger via object destructuring
      })
  );
  logger.debug(`Loaders Registration: Registered ${tokens.GameConfigLoader}.`);

  registrar.singletonFactory(
    tokens.ModManifestLoader,
    (c) =>
      new ModManifestLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger) // Pass logger here too
      )
  );
  logger.debug(`Loaders Registration: Registered ${tokens.ModManifestLoader}.`);
  // === ADDED: MODLOADER-005 A END ===

  // === ADDED: LOADER-001 ===
  registrar.singletonFactory(
    tokens.ActionLoader,
    (c) =>
      new ActionLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger)
      )
  );
  logger.debug(`Loaders Registration: Registered ${tokens.ActionLoader}.`);
  // === END LOADER-001 ===

  // === ADDED: LOADER-003 ===
  registrar.singletonFactory(
    tokens.EventLoader,
    (c) =>
      new EventLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger)
      )
  );
  logger.debug(`Loaders Registration: Registered ${tokens.EventLoader}.`);
  // === END LOADER-003 ===

  // === ADDED: LOADER-004-F ===
  registrar.singletonFactory(
    tokens.EntityLoader,
    (c) =>
      new EntityLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger)
      )
  );
  logger.debug(`Loaders Registration: Registered ${tokens.EntityLoader}.`);
  // === END LOADER-004-F ===

  logger.debug('Loaders Registration: Completed.');
}
