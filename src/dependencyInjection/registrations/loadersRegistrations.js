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
/** @typedef {import('../../loaders/componentLoader.js').default} ComponentLoader */
/** @typedef {import('../../loaders/conditionLoader.js').default} ConditionLoader */
/** @typedef {import('../../loaders/gameConfigLoader.js').default} GameConfigLoader */
/** @typedef {import('../../modding/modManifestLoader.js').default} ModManifestLoader */
/** @typedef {import('../../loaders/actionLoader.js').default} ActionLoader */
/** @typedef {import('../../loaders/eventLoader.js').default} EventLoader */
/** @typedef {import('../../loaders/entityDefinitionLoader.js').default} EntityLoader */
/** @typedef {import('../../loaders/entityInstanceLoader.js').default} EntityInstanceLoader */
/** @typedef {import('../../loaders/worldLoader.js').default} WorldLoader */
/** @typedef {import('../../loaders/modsLoader.js').default} ModsLoader */
/** @typedef {import('../../configuration/staticConfiguration.js').default} StaticConfiguration */
/** @typedef {import('../../pathing/defaultPathResolver.js').default} DefaultPathResolver */
/** @typedef {import('../../validation/ajvSchemaValidator.js').default} AjvSchemaValidator */
/** @typedef {import('../../data/inMemoryDataRegistry.js').default} InMemoryDataRegistry */
/** @typedef {import('../../data/workspaceDataFetcher.js').default} WorkspaceDataFetcher */
/** @typedef {import('../../modding/modDependencyValidator.js').default} ModDependencyValidator */
/** @typedef {import('../../modding/modVersionValidator.js').default} ModVersionValidator */
/** @typedef {import('../../modding/modLoadOrderResolver.js').default} ModLoadOrderResolver */
/** @typedef {import('../../loaders/promptTextLoader.js').default} PromptTextLoader */
/** @typedef {import('../../loaders/goalLoader.js').default} GoalLoader */

// --- Core Service Imports ---
import StaticConfiguration from '../../configuration/staticConfiguration.js';
import DefaultPathResolver from '../../pathing/defaultPathResolver.js';
import AjvSchemaValidator from '../../validation/ajvSchemaValidator.js';
import InMemoryDataRegistry from '../../data/inMemoryDataRegistry.js';
import WorkspaceDataFetcher from '../../data/workspaceDataFetcher.js';

// --- Loader Imports ---
import ActionLoader from '../../loaders/actionLoader.js';
import ComponentLoader from '../../loaders/componentLoader.js';
import ConditionLoader from '../../loaders/conditionLoader.js';
import EntityDefinitionLoader from '../../loaders/entityDefinitionLoader.js';
import EntityInstanceLoader from '../../loaders/entityInstanceLoader.js';
import EventLoader from '../../loaders/eventLoader.js';
import GameConfigLoader from '../../loaders/gameConfigLoader.js';
import GoalLoader from '../../loaders/goalLoader.js';
import MacroLoader from '../../loaders/macroLoader.js';
import ModManifestLoader from '../../modding/modManifestLoader.js';
import ModsLoader from '../../loaders/modsLoader.js';
import PromptTextLoader from '../../loaders/promptTextLoader.js';
import RuleLoader from '../../loaders/ruleLoader.js';
import SchemaLoader from '../../loaders/schemaLoader.js';
import WorldLoader from '../../loaders/worldLoader.js';

// --- Modding Service Imports ---
import ModDependencyValidator from '../../modding/modDependencyValidator.js';
import validateModEngineVersions from '../../modding/modVersionValidator.js';
import ModLoadOrderResolver from '../../modding/modLoadOrderResolver.js';
import FnLoadOrderResolverAdapter from '../../adapters/fnLoadOrderResolverAdapter.js';

// --- Phase Imports ---
import SchemaPhase from '../../loaders/phases/SchemaPhase.js';
import ManifestPhase from '../../loaders/phases/ManifestPhase.js';
import ContentPhase from '../../loaders/phases/contentPhase.js';
import WorldPhase from '../../loaders/phases/worldPhase.js';
import SummaryPhase from '../../loaders/phases/summaryPhase.js';
import ModManifestProcessor from '../../loaders/ModManifestProcessor.js';
import ContentLoadManager from '../../loaders/ContentLoadManager.js';
import WorldLoadSummaryLogger from '../../loaders/WorldLoadSummaryLogger.js';

// --- DI & Helper Imports ---
import { tokens } from '../tokens.js';
import { Registrar } from '../registrarHelpers.js';

/**
 * Registers core data infrastructure services, data loaders, and the phase-based mod loading system.
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 */
export function registerLoaders(container) {
  const registrar = new Registrar(container);
  const logger = container.resolve(tokens.ILogger);
  logger.debug('Loaders Registration: Starting...');

  // === Core Infrastructure (unchanged) ===
  registrar.singletonFactory(
    tokens.IConfiguration,
    () => new StaticConfiguration()
  );
  registrar.singletonFactory(
    tokens.IPathResolver,
    (c) => new DefaultPathResolver(c.resolve(tokens.IConfiguration))
  );
  registrar.singletonFactory(
    tokens.ISchemaValidator,
    (c) => new AjvSchemaValidator(c.resolve(tokens.ILogger))
  );
  registrar.singletonFactory(
    tokens.IDataRegistry,
    () => new InMemoryDataRegistry()
  );
  registrar.singletonFactory(
    tokens.IDataFetcher,
    () => new WorkspaceDataFetcher()
  );

  // === Individual Content & Data Loaders (unchanged) ===
  const registerLoader = (token, LoaderClass) => {
    if (!token) {
      console.log(
        'registerLoader called with undefined token:',
        token,
        'LoaderClass:',
        LoaderClass && LoaderClass.name
      );
      throw new Error(
        `registerLoader called with undefined token for LoaderClass: ${LoaderClass && LoaderClass.name}`
      );
    }
    registrar.singletonFactory(
      token,
      (c) =>
        new LoaderClass(
          c.resolve(tokens.IConfiguration),
          c.resolve(tokens.IPathResolver),
          c.resolve(tokens.IDataFetcher),
          c.resolve(tokens.ISchemaValidator),
          c.resolve(tokens.IDataRegistry),
          c.resolve(tokens.ILogger)
        )
    );
  };

  registerLoader(tokens.RuleLoader, RuleLoader);
  registerLoader(tokens.ComponentLoader, ComponentLoader);
  registerLoader(tokens.ConditionLoader, ConditionLoader);
  registerLoader(tokens.ActionLoader, ActionLoader);
  registerLoader(tokens.EventLoader, EventLoader);
  registerLoader(tokens.MacroLoader, MacroLoader);
  registerLoader(tokens.EntityLoader, EntityDefinitionLoader);
  registerLoader(tokens.EntityInstanceLoader, EntityInstanceLoader);
  registerLoader(tokens.WorldLoader, WorldLoader);
  registerLoader(tokens.GoalLoader, GoalLoader);
  registerLoader(tokens.ModManifestLoader, ModManifestLoader);

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
  registrar.singletonFactory(
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

  // === New: Phase-related Services & Processors ===
  // These services were previously created inside ModsLoader.
  registrar.singletonFactory(
    tokens.ModLoadOrderResolver,
    (c) => new ModLoadOrderResolver(c.resolve(tokens.ILogger))
  );

  registrar.singletonFactory(tokens.ModManifestProcessor, (c) => {
    const resolver = c.resolve(tokens.ModLoadOrderResolver); // Expects an object

    return new ModManifestProcessor({
      logger: c.resolve(tokens.ILogger),
      modManifestLoader: c.resolve(tokens.ModManifestLoader),
      registry: c.resolve(tokens.IDataRegistry),
      validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
      modDependencyValidator: new ModDependencyValidator(
        c.resolve(tokens.ILogger)
      ),
      modVersionValidator: validateModEngineVersions, // Use the function directly
      modLoadOrderResolver: resolver,
      configuration: c.resolve(tokens.IConfiguration),
    });
  });

  registrar.singletonFactory(
    tokens.ContentLoadManager,
    (c) =>
      new ContentLoadManager({
        logger: c.resolve(tokens.ILogger),
        validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
        contentLoadersConfig: null, // Will be generated from individual loaders
      })
  );

  registrar.singletonFactory(
    tokens.WorldLoadSummaryLogger,
    () => new WorldLoadSummaryLogger()
  );

  // === New: Loading Phases ===
  registrar.singletonFactory(
    tokens.SchemaPhase,
    (c) =>
      new SchemaPhase({
        schemaLoader: c.resolve(tokens.SchemaLoader),
        config: c.resolve(tokens.IConfiguration),
        validator: c.resolve(tokens.ISchemaValidator),
        logger: c.resolve(tokens.ILogger),
      })
  );

  registrar.singletonFactory(
    tokens.ManifestPhase,
    (c) =>
      new ManifestPhase({
        processor: c.resolve(tokens.ModManifestProcessor),
        logger: c.resolve(tokens.ILogger),
      })
  );

  registrar.singletonFactory(
    tokens.ContentPhase,
    (c) =>
      new ContentPhase({
        manager: c.resolve(tokens.ContentLoadManager),
        logger: c.resolve(tokens.ILogger),
      })
  );

  registrar.singletonFactory(
    tokens.WorldPhase,
    (c) =>
      new WorldPhase({
        worldLoader: c.resolve(tokens.WorldLoader),
        logger: c.resolve(tokens.ILogger),
      })
  );

  registrar.singletonFactory(
    tokens.SummaryPhase,
    (c) =>
      new SummaryPhase({
        summaryLogger: c.resolve(tokens.WorldLoadSummaryLogger),
        logger: c.resolve(tokens.ILogger),
      })
  );

  // === Refactored ModsLoader Registration ===
  registrar.singletonFactory(tokens.ModsLoader, (c) => {
    const phases = [
      c.resolve(tokens.SchemaPhase),
      c.resolve(tokens.ManifestPhase),
      c.resolve(tokens.ContentPhase),
      c.resolve(tokens.WorldPhase),
      c.resolve(tokens.SummaryPhase),
    ];

    return new ModsLoader({
      logger: c.resolve(tokens.ILogger),
      registry: c.resolve(tokens.IDataRegistry),
      phases: phases,
    });
  });

  // Register SchemaLoader directly with correct dependencies
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

  logger.info(
    'Loaders Registration: All core services, loaders, and phases registered.'
  );
}
