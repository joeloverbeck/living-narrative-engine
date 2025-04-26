/**
 * @fileoverview Registers data loading services and their core dependencies.
 */

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../../appContainer.js').default} AppContainer */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').IConfiguration} IConfiguration */
/** @typedef {import('../../interfaces/coreServices.js').IPathResolver} IPathResolver */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/coreServices.js').IDataFetcher} IDataFetcher */
/** @typedef {import('../../services/schemaLoader.js').default} SchemaLoader */
/** @typedef {import('../../services/manifestLoader.js').default} ManifestLoader */
/** @typedef {import('../../services/ruleLoader.js').default} RuleLoader */
/** @typedef {import('../../services/genericContentLoader.js').default} GenericContentLoader */
/** @typedef {import('../../services/componentDefinitionLoader.js').default} ComponentDefinitionLoader */
/** @typedef {import('../../services/gameConfigLoader.js').default} GameConfigLoader */ // <<< ADDED
/** @typedef {import('../../services/modManifestLoader.js').default} ModManifestLoader */ // <<< ADDED: MODLOADER-005 A
/** @typedef {import('../../services/staticConfiguration.js').default} StaticConfiguration */
/** @typedef {import('../../services/defaultPathResolver.js').default} DefaultPathResolver */
/** @typedef {import('../../services/ajvSchemaValidator.js').default} AjvSchemaValidator */
/** @typedef {import('../../services/inMemoryDataRegistry.js').default} InMemoryDataRegistry */
/** @typedef {import('../../services/workspaceDataFetcher.js').default} WorkspaceDataFetcher */


// --- Core Service Imports ---
import StaticConfiguration from '../../services/staticConfiguration.js';
import DefaultPathResolver from '../../services/defaultPathResolver.js';
import AjvSchemaValidator from '../../services/ajvSchemaValidator.js';
import InMemoryDataRegistry from '../../services/inMemoryDataRegistry.js';
import WorkspaceDataFetcher from '../../services/workspaceDataFetcher.js';

// --- Loader Imports ---
import SchemaLoader from '../../services/schemaLoader.js';
import ManifestLoader from '../../services/manifestLoader.js';
import RuleLoader from '../../services/ruleLoader.js';
import GenericContentLoader from '../../services/genericContentLoader.js';
import ComponentDefinitionLoader from '../../services/componentDefinitionLoader.js';
import GameConfigLoader from '../../services/gameConfigLoader.js'; // <<< ADDED
import ModManifestLoader from '../../services/modManifestLoader.js'; // <<< ADDED: MODLOADER-005 A


// --- DI & Helper Imports ---
import {tokens} from '../../tokens.js';
import {Registrar} from '../../dependencyInjection/registrarHelpers.js';

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
    logger.debug('Loaders Registration: Starting core services and data loaders...');

    // === Core Infrastructure Interfaces ===
    // These are fundamental services needed by the loaders and other parts of the app.
    registrar.singletonFactory(tokens.IConfiguration, () => new StaticConfiguration());
    logger.debug(`Loaders Registration: Registered ${tokens.IConfiguration}.`);

    // DefaultPathResolver depends on IConfiguration
    registrar.singletonFactory(tokens.IPathResolver, (c) => new DefaultPathResolver(c.resolve(tokens.IConfiguration)));
    logger.debug(`Loaders Registration: Registered ${tokens.IPathResolver}.`);

    registrar.singletonFactory(tokens.ISchemaValidator, () => new AjvSchemaValidator());
    logger.debug(`Loaders Registration: Registered ${tokens.ISchemaValidator}.`);

    registrar.singletonFactory(tokens.IDataRegistry, () => new InMemoryDataRegistry());
    logger.debug(`Loaders Registration: Registered ${tokens.IDataRegistry}.`);

    registrar.singletonFactory(tokens.IDataFetcher, () => new WorkspaceDataFetcher());
    logger.debug(`Loaders Registration: Registered ${tokens.IDataFetcher}.`);

    // === Data Loaders ===
    // These services are responsible for fetching, validating, and potentially processing
    // specific types of game data files.

    // SchemaLoader depends on IConfiguration, IPathResolver, IDataFetcher, ISchemaValidator, ILogger
    registrar.singletonFactory(tokens.SchemaLoader, (c) => new SchemaLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.ILogger)
    ));
    logger.debug(`Loaders Registration: Registered ${tokens.SchemaLoader}.`);

    // ManifestLoader depends on IConfiguration, IPathResolver, IDataFetcher, ISchemaValidator, ILogger
    // NOTE: This might become deprecated or change with modding system.
    registrar.singletonFactory(tokens.ManifestLoader, (c) => new ManifestLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.ILogger)
    ));
    logger.debug(`Loaders Registration: Registered ${tokens.ManifestLoader}.`);

    // RuleLoader depends on IPathResolver, IDataFetcher, ISchemaValidator, IDataRegistry, ILogger
    registrar.singletonFactory(tokens.RuleLoader, (c) => new RuleLoader(
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger)
    ));
    logger.debug(`Loaders Registration: Registered ${tokens.RuleLoader}.`);

    // GenericContentLoader depends on IConfiguration, IPathResolver, IDataFetcher, ISchemaValidator, IDataRegistry, ILogger
    // NOTE: This might become deprecated or change with modding system.
    registrar.singletonFactory(tokens.GenericContentLoader, (c) => new GenericContentLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger)
    ));
    logger.debug(`Loaders Registration: Registered ${tokens.GenericContentLoader}.`);

    // ComponentDefinitionLoader depends on IConfiguration, IPathResolver, IDataFetcher, ISchemaValidator, IDataRegistry, ILogger
    registrar.singletonFactory(tokens.ComponentDefinitionLoader, (c) => new ComponentDefinitionLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger)
    ));
    logger.debug(`Loaders Registration: Registered ${tokens.ComponentDefinitionLoader}.`);

    // GameConfigLoader depends on IConfiguration, IPathResolver, IDataFetcher, ISchemaValidator, ILogger
    registrar.singletonFactory(tokens.GameConfigLoader, (c) => new GameConfigLoader({
        configuration: c.resolve(tokens.IConfiguration),
        pathResolver: c.resolve(tokens.IPathResolver),
        dataFetcher: c.resolve(tokens.IDataFetcher),
        schemaValidator: c.resolve(tokens.ISchemaValidator),
        logger: c.resolve(tokens.ILogger)
    }));
    logger.debug(`Loaders Registration: Registered ${tokens.GameConfigLoader}.`);

    // === ADDED: MODLOADER-005 A START ===
    // ModManifestLoader depends on IConfiguration, IPathResolver, IDataFetcher, ISchemaValidator, IDataRegistry, ILogger
    // NOTE: Assuming tokens.ModManifestLoader exists in src/core/tokens.js
    // If src/core/tokens.js was not provided, you would need to add:
    // ModManifestLoader: Symbol('ModManifestLoader')
    // to the tokens object definition in that file.
    registrar.singletonFactory(tokens.ModManifestLoader, c => new ModManifestLoader(
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.IPathResolver),
        c.resolve(tokens.IDataFetcher),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger)
    ));
    logger.debug(`Loaders Registration: Registered ${tokens.ModManifestLoader}.`);
    // === ADDED: MODLOADER-005 A END ===


    logger.info('Loaders Registration: Completed.');
}