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
/** @typedef {import('../../loaders/registryCacheAdapter.js').default} ILoadCache */
/** @typedef {import('../../data/textDataFetcher.js').default} TextDataFetcher */

// --- Core Service Imports ---
import StaticConfiguration from '../../configuration/staticConfiguration.js';
import DefaultPathResolver from '../../pathing/defaultPathResolver.js';
import AjvSchemaValidator from '../../validation/ajvSchemaValidator.js';
import InMemoryDataRegistry from '../../data/inMemoryDataRegistry.js';
import WorkspaceDataFetcher from '../../data/workspaceDataFetcher.js';
import TextDataFetcher from '../../data/textDataFetcher.js';
import {
  LLM_TURN_ACTION_RESPONSE_SCHEMA,
  LLM_TURN_ACTION_RESPONSE_SCHEMA_ID,
} from '../../turns/schemas/llmOutputSchemas.js';
// Browser-compatible placeholder schemas - actual schemas loaded at runtime
// These are minimal schemas that satisfy the type requirements
const CHARACTER_CONCEPT_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "additionalProperties": true
};
const THEMATIC_DIRECTION_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "additionalProperties": true
};


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
import ModsLoadSession from '../../loaders/ModsLoadSession.js';
import PromptTextLoader from '../../loaders/promptTextLoader.js';
import RuleLoader from '../../loaders/ruleLoader.js';
import SchemaLoader from '../../loaders/schemaLoader.js';
import ScopeLoader from '../../loaders/scopeLoader.js';
import WorldLoader from '../../loaders/worldLoader.js';
import AnatomyRecipeLoader from '../../loaders/anatomyRecipeLoader.js';
import AnatomyBlueprintLoader from '../../loaders/anatomyBlueprintLoader.js';
import AnatomyBlueprintPartLoader from '../../loaders/anatomyBlueprintPartLoader.js';
import AnatomySlotLibraryLoader from '../../loaders/anatomySlotLibraryLoader.js';
import AnatomyFormattingLoader from '../../loaders/anatomyFormattingLoader.js';
import { SCOPES_KEY } from '../../constants/dataRegistryKeys.js';

// --- Modding Service Imports ---
import ModDependencyValidator from '../../modding/modDependencyValidator.js';
import validateModEngineVersions from '../../modding/modVersionValidator.js';
import ModLoadOrderResolver from '../../modding/modLoadOrderResolver.js';
import FnLoadOrderResolverAdapter from '../../adapters/fnLoadOrderResolverAdapter.js';

// --- Phase Imports ---
import SchemaPhase from '../../loaders/phases/SchemaPhase.js';
import GameConfigPhase from '../../loaders/phases/GameConfigPhase.js';
import ManifestPhase from '../../loaders/phases/ManifestPhase.js';
import ContentPhase from '../../loaders/phases/contentPhase.js';
import WorldPhase from '../../loaders/phases/worldPhase.js';
import SummaryPhase from '../../loaders/phases/summaryPhase.js';
import ModManifestProcessor from '../../loaders/ModManifestProcessor.js';
import ContentLoadManager from '../../loaders/ContentLoadManager.js';
import WorldLoadSummaryLogger from '../../loaders/WorldLoadSummaryLogger.js';
import LoadResultAggregator from '../../loaders/LoadResultAggregator.js';

// --- DI & Helper Imports ---
import { tokens } from '../tokens.js';
import { Registrar } from '../../utils/registrarHelpers.js';
import { makeRegistryCache } from '../../loaders/registryCacheAdapter.js';
import { BaseManifestItemLoader } from '../../loaders/baseManifestItemLoader.js';
import { createDefaultContentLoadersConfig } from '../../loaders/defaultLoaderConfig.js';
// Validation imports moved to conditional block to avoid browser bundling

/**
 * Registers core data infrastructure services, data loaders, and the phase-based mod loading system.
 *
 * @export
 * @param {AppContainer} container - The application's DI container.
 */
export async function registerLoaders(container) {
  const registrar = new Registrar(container);
  let logger;

  try {
    logger = container.resolve(tokens.ILogger);
    logger.debug('Loaders Registration: Starting...');
  } catch (error) {
    // ILogger not yet registered - use console fallback for debug messages
    console.debug(
      'Loaders Registration: Starting... (ILogger not yet available)'
    );
    logger = null;
  }

  // Helper function to safely log debug messages
  const safeDebug = (message) => {
    if (logger) {
      logger.debug(message);
    } else {
      console.debug(`[Loaders Registration] ${message}`);
    }
  };

  // Register proxy URL from environment variables (if provided)
  registrar.value(tokens.ProxyUrl, globalThis.process?.env?.PROXY_URL);

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
    (c) =>
      new AjvSchemaValidator({
        logger: c.resolve(tokens.ILogger),
        preloadSchemas: [
          {
            schema: LLM_TURN_ACTION_RESPONSE_SCHEMA,
            id: LLM_TURN_ACTION_RESPONSE_SCHEMA_ID,
          },
          // Register thematic-direction with full URI (matches $ref in character-concept schema)
          {
            schema: THEMATIC_DIRECTION_SCHEMA,
            id: 'schema://living-narrative-engine/thematic-direction.schema.json',
          },
          // Register character-concept with full URI for consistency
          {
            schema: CHARACTER_CONCEPT_SCHEMA,
            id: 'schema://living-narrative-engine/character-concept.schema.json',
          },
          // TEMPORARY DEBUG: Also register with short ID to see if this fixes the reference resolution
          {
            schema: CHARACTER_CONCEPT_SCHEMA,
            id: 'character-concept',
          },
        ],
      })
  );
  registrar.singletonFactory(
    tokens.IDataRegistry,
    () => new InMemoryDataRegistry({ logger })
  );
  registrar.singletonFactory(
    tokens.IDataFetcher,
    () => new WorkspaceDataFetcher()
  );

  registrar.singletonFactory(
    tokens.ITextDataFetcher,
    () => new TextDataFetcher()
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
  // EntityDefinitionLoader needs a custom registration to include SafeEventDispatcher
  registrar.singletonFactory(
    tokens.EntityLoader,
    (c) =>
      new EntityDefinitionLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger),
        c.resolve(tokens.ISafeEventDispatcher)
      )
  );
  registerLoader(tokens.EntityInstanceLoader, EntityInstanceLoader);
  registerLoader(tokens.WorldLoader, WorldLoader);
  registerLoader(tokens.GoalLoader, GoalLoader);
  registerLoader(tokens.AnatomyRecipeLoader, AnatomyRecipeLoader);
  registerLoader(tokens.AnatomyBlueprintLoader, AnatomyBlueprintLoader);
  registerLoader(tokens.AnatomyBlueprintPartLoader, AnatomyBlueprintPartLoader);
  registerLoader(tokens.AnatomySlotLibraryLoader, AnatomySlotLibraryLoader);
  registerLoader(tokens.AnatomyFormattingLoader, AnatomyFormattingLoader);

  // Register ScopeLoader with TextDataFetcher instead of regular IDataFetcher
  registrar.singletonFactory(
    tokens.ScopeLoader,
    (c) =>
      new ScopeLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.ITextDataFetcher), // Use TextDataFetcher for scope files
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger)
      )
  );

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
        pathConfiguration: c.resolve(tokens.IPathConfiguration),
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
      modDependencyValidator: ModDependencyValidator,
      modVersionValidator: validateModEngineVersions,
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
        contentLoadersConfig: createDefaultContentLoadersConfig({
          componentLoader: c.resolve(tokens.ComponentLoader),
          eventLoader: c.resolve(tokens.EventLoader),
          conditionLoader: c.resolve(tokens.ConditionLoader),
          macroLoader: c.resolve(tokens.MacroLoader),
          actionLoader: c.resolve(tokens.ActionLoader),
          ruleLoader: c.resolve(tokens.RuleLoader),
          goalLoader: c.resolve(tokens.GoalLoader),
          scopeLoader: c.resolve(tokens.ScopeLoader),
          entityDefinitionLoader: c.resolve(tokens.EntityLoader),
          entityInstanceLoader: c.resolve(tokens.EntityInstanceLoader),
          anatomySlotLibraryLoader: c.resolve(tokens.AnatomySlotLibraryLoader),
          anatomyBlueprintPartLoader: c.resolve(
            tokens.AnatomyBlueprintPartLoader
          ),
          anatomyBlueprintLoader: c.resolve(tokens.AnatomyBlueprintLoader),
          anatomyRecipeLoader: c.resolve(tokens.AnatomyRecipeLoader),
          anatomyFormattingLoader: c.resolve(tokens.AnatomyFormattingLoader),
        }),
        aggregatorFactory: (counts) => new LoadResultAggregator(counts),
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
    tokens.GameConfigPhase,
    (c) =>
      new GameConfigPhase({
        gameConfigLoader: c.resolve(tokens.GameConfigLoader),
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
  // Register ILoadCache using the registry cache adapter
  registrar.singletonFactory(tokens.ILoadCache, (c) => {
    const registry = c.resolve(tokens.IDataRegistry);
    return makeRegistryCache(registry);
  });

  registrar.singletonFactory(tokens.ModsLoader, (c) => {
    const logger = c.resolve(tokens.ILogger);
    logger.debug('ModsLoader: Starting phase resolution...');
    
    const phases = [];
    const phaseTokens = [
      { token: tokens.SchemaPhase, name: 'SchemaPhase' },
      { token: tokens.GameConfigPhase, name: 'GameConfigPhase' },
      { token: tokens.ManifestPhase, name: 'ManifestPhase' },
      { token: tokens.ContentPhase, name: 'ContentPhase' },
      { token: tokens.WorldPhase, name: 'WorldPhase' },
      { token: tokens.SummaryPhase, name: 'SummaryPhase' },
    ];
    
    for (const { token, name } of phaseTokens) {
      try {
        logger.debug(`ModsLoader: Resolving ${name}...`);
        const phase = c.resolve(token);
        logger.debug(`ModsLoader: Successfully resolved ${name} (${phase.name})`);
        phases.push(phase);
      } catch (error) {
        logger.error(`ModsLoader: Failed to resolve ${name}: ${error.message}`, error);
        throw error;
      }
    }
    
    logger.debug(`ModsLoader: All ${phases.length} phases resolved successfully`);
    
    return new ModsLoader({
      logger,
      cache: c.resolve(tokens.ILoadCache),
      session: new ModsLoadSession({
        phases,
        cache: c.resolve(tokens.ILoadCache),
        logger,
      }),
      registry: c.resolve(tokens.IDataRegistry),
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

  // === Mod Cross-Reference Validation Services ===
  // Note: These services use Node.js file system APIs and are only needed server-side
  // for build-time validation. Skip registration to prevent esbuild bundling failures.
  
  try {
    // Only attempt registration in Node.js environment
    if (typeof window === 'undefined' && typeof globalThis !== 'undefined' && globalThis.process) {
      // Server-side environment - register validation services
      // Dynamic imports with string concatenation to avoid esbuild static analysis
      const validationBasePath = '../../validation/';
      const modReferenceExtractorModule = await import(validationBasePath + 'modReferenceExtractor.js');
      const modCrossReferenceValidatorModule = await import(validationBasePath + 'modCrossReferenceValidator.js');
      
      const ModReferenceExtractor = modReferenceExtractorModule.default;
      const ModCrossReferenceValidator = modCrossReferenceValidatorModule.default;
      
      // Register reference extractor
      registrar.singletonFactory(
        tokens.IModReferenceExtractor,
        (c) => new ModReferenceExtractor({
          logger: c.resolve(tokens.ILogger),
          ajvValidator: c.resolve(tokens.ISchemaValidator)
        })
      );
      
      // Register cross-reference validator
      registrar.singletonFactory(
        tokens.IModCrossReferenceValidator,
        (c) => new ModCrossReferenceValidator({
          logger: c.resolve(tokens.ILogger),
          modDependencyValidator: ModDependencyValidator,
          referenceExtractor: c.resolve(tokens.IModReferenceExtractor)
        })
      );

      safeDebug('Registered mod cross-reference validation services (server-side only)');
    } else {
      // Browser environment - skip validation services
      safeDebug('Skipped mod cross-reference validation services (browser environment)');
    }
  } catch (error) {
    // Gracefully handle import failures (e.g., in browser builds where modules don't exist)
    safeDebug('Failed to register validation services (likely browser environment): ' + error.message);
  }

  logger.info(
    'Loaders Registration: All core services, loaders, and phases registered.'
  );
}
