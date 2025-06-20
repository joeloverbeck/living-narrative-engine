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
/** @typedef {import('../../loaders/conditionLoader.js').default} ConditionLoader */
/** @typedef {import('../../loaders/gameConfigLoader.js').default} GameConfigLoader */
/** @typedef {import('../../modding/modManifestLoader.js').default} ModManifestLoader */
/** @typedef {import('../../loaders/actionLoader.js').default} ActionLoader */
/** @typedef {import('../../loaders/eventLoader.js').default} EventLoader */
/** @typedef {import('../../loaders/entityDefinitionLoader.js').default} EntityLoader */
/** @typedef {import('../../loaders/entityInstanceLoader.js').default} EntityInstanceLoader */
/** @typedef {import('../../loaders/worldLoader.js').default} WorldLoader */
/** @typedef {import('../../modding/modLoader.js').default} ModsLoader */
/** @typedef {import('../../configuration/staticConfiguration.js').default} StaticConfiguration */
/** @typedef {import('../../pathing/defaultPathResolver.js').default} DefaultPathResolver */
/** @typedef {import('../../validation/ajvSchemaValidator.js').default} AjvSchemaValidator */
/** @typedef {import('../../data/inMemoryDataRegistry.js').default} InMemoryDataRegistry */
/** @typedef {import('../../data/workspaceDataFetcher.js').default} WorkspaceDataFetcher */
/** @typedef {import('../../modding/modDependencyValidator.js').default} ModDependencyValidator */
/** @typedef {import('../../modding/modVersionValidator.js').default} ModVersionValidator */
/** @typedef {import('../../modding/modLoadOrderResolver.js').default} ModLoadOrderResolver */
/** @typedef {import('../../loaders/promptTextLoader.js').default} PromptTextLoader */

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
import ConditionLoader from '../../loaders/conditionLoader.js';
import GameConfigLoader from '../../loaders/gameConfigLoader.js';
import ModManifestLoader from '../../modding/modManifestLoader.js';
import ActionLoader from '../../loaders/actionLoader.js';
import EventLoader from '../../loaders/eventLoader.js';
import MacroLoader from '../../loaders/macroLoader.js';
import EntityDefinitionLoader from '../../loaders/entityDefinitionLoader.js';
import EntityInstanceLoader from '../../loaders/entityInstanceLoader.js';
import WorldLoader from '../../loaders/worldLoader.js';
import ModsLoader from '../../loaders/modsLoader.js';
import PromptTextLoader from '../../loaders/promptTextLoader.js';

// --- Modding Service Imports ---
import ModDependencyValidator from '../../modding/modDependencyValidator.js';
import ModVersionValidator from '../../modding/modVersionValidator.js';
import ModLoadOrderResolver from '../../modding/modLoadOrderResolver.js';

// --- DI & Helper Imports ---
import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';

/**
 * Registers core data infrastructure services (Configuration, PathResolver, Validator, Registry, Fetcher)
 * and specific data loaders (Schema, Manifest, Rules, Generic Content, Component Definitions, Game Config, Mod Manifests).
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
  registrar.singletonFactory(
    tokens.ISchemaValidator,
    (c) => new AjvSchemaValidator(c.resolve(tokens.ILogger))
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
  // SchemaLoader
  registrar.singletonFactory(
    tokens.SchemaLoader,
    (c) =>
      new SchemaLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.ILogger)
      )
  );
  logger.debug(`Loaders Registration: Registered ${tokens.SchemaLoader}.`);

  // RuleLoader
  registrar.singletonFactory(
    tokens.RuleLoader,
    (c) =>
      new RuleLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger)
      )
  );
  logger.debug(`Loaders Registration: Registered ${tokens.RuleLoader}.`);

  // ComponentDefinitionLoader (ComponentLoader)
  registrar.singletonFactory(
    tokens.ComponentDefinitionLoader,
    (c) =>
      new ComponentLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger)
      )
  );
  logger.debug(
    `Loaders Registration: Registered ${tokens.ComponentDefinitionLoader}.`
  );

  // ConditionLoader
  registrar.singletonFactory(
    tokens.ConditionLoader,
    (c) =>
      new ConditionLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger)
      )
  );
  logger.debug(`Loaders Registration: Registered ${tokens.ConditionLoader}.`);

  // GameConfigLoader
  registrar.singletonFactory(
    tokens.GameConfigLoader,
    (c) =>
      new GameConfigLoader({
        configuration: c.resolve(tokens.IConfiguration),
        pathResolver: c.resolve(tokens.IPathResolver),
        dataFetcher: c.resolve(tokens.IDataFetcher),
        schemaValidator: c.resolve(tokens.ISchemaValidator),
        logger: c.resolve(tokens.ILogger),
      })
  );
  logger.debug(`Loaders Registration: Registered ${tokens.GameConfigLoader}.`);

  // ModManifestLoader
  registrar.singletonFactory(
    tokens.ModManifestLoader,
    (c) =>
      new ModManifestLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger)
      )
  );
  logger.debug(`Loaders Registration: Registered ${tokens.ModManifestLoader}.`);

  // ActionLoader
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

  // EventLoader
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

  // MacroLoader
  registrar.singletonFactory(
    tokens.MacroLoader,
    (c) =>
      new MacroLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger)
      )
  );
  logger.debug(`Loaders Registration: Registered ${tokens.MacroLoader}.`);

  // EntityLoader (EntityDefinitionLoader)
  registrar.singletonFactory(
    tokens.EntityLoader,
    (c) =>
      new EntityDefinitionLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger)
      )
  );
  logger.debug(`Loaders Registration: Registered ${tokens.EntityLoader}.`);

  // PromptTextLoader
  registrar.singletonFactory(
    tokens.PromptTextLoader,
    (c) =>
      new PromptTextLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger)
      )
  );
  logger.debug(`Loaders Registration: Registered ${tokens.PromptTextLoader}.`);

  // WorldLoader
  registrar.singletonFactory(
    tokens.WorldLoader,
    (c) =>
      new WorldLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger)
      )
  );
  logger.debug(`Loaders Registration: Registered ${tokens.WorldLoader}.`);

  // EntityInstanceLoader
  registrar.singletonFactory(
    tokens.EntityInstanceLoader,
    (c) =>
      new EntityInstanceLoader( // Assuming constructor matches EntityDefinitionLoader for now
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger)
      )
  );
  logger.debug(
    `Loaders Registration: Registered ${tokens.EntityInstanceLoader}.`
  );

  registrar.singletonFactory(
    tokens.GoalLoader,
    (c) =>
      new GoalLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger),
      ),
  );
  logger.debug(`Loaders Registration: Registered ${tokens.GoalLoader}.`);

  // ModsLoader depends on a multitude of services
  registrar.singletonFactory(tokens.ModsLoader, (c) => {
    const loggerDep = c.resolve(tokens.ILogger);
    return new ModsLoader({
      registry: c.resolve(tokens.IDataRegistry),
      logger: loggerDep,
      schemaLoader: c.resolve(tokens.SchemaLoader),
      componentLoader: c.resolve(tokens.ComponentDefinitionLoader),
      conditionLoader: c.resolve(tokens.ConditionLoader),
      ruleLoader: c.resolve(tokens.RuleLoader),
      macroLoader: c.resolve(tokens.MacroLoader),
      actionLoader: c.resolve(tokens.ActionLoader),
      eventLoader: c.resolve(tokens.EventLoader),
      entityLoader: c.resolve(tokens.EntityLoader),
      entityInstanceLoader: c.resolve(tokens.EntityInstanceLoader),
      goalLoader: c.resolve(tokens.GoalLoader),
      validator: c.resolve(tokens.ISchemaValidator),
      configuration: c.resolve(tokens.IConfiguration),
      gameConfigLoader: c.resolve(tokens.GameConfigLoader),
      promptTextLoader: c.resolve(tokens.PromptTextLoader),
      modManifestLoader: c.resolve(tokens.ModManifestLoader),
      validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
      modDependencyValidator: new ModDependencyValidator(loggerDep),
      modVersionValidator: new ModVersionValidator(loggerDep),
      modLoadOrderResolver: new ModLoadOrderResolver(loggerDep),
      worldLoader: c.resolve(tokens.WorldLoader),
    });
  });
  logger.debug(`Loaders Registration: Registered ${tokens.ModsLoader}.`);

  logger.info(
    'Loaders Registration: All core services and data loaders registered.'
  );
}
