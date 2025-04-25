// src/core/config/registrations/loadersRegistrations.js

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


// --- DI & Helper Imports ---
import {tokens} from '../../tokens.js';
import {Registrar} from '../../dependencyInjection/registrarHelpers.js';

/**
 * Registers core data infrastructure services (Configuration, PathResolver, Validator, Registry, Fetcher)
 * and specific data loaders (Schema, Manifest, Rules, Generic Content, Component Definitions).
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

    registrar.single(tokens.IPathResolver, DefaultPathResolver, [tokens.IConfiguration]);
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
    registrar.single(tokens.SchemaLoader, SchemaLoader, [
        tokens.IConfiguration,
        tokens.IPathResolver,
        tokens.IDataFetcher,
        tokens.ISchemaValidator,
        tokens.ILogger
    ]);
    logger.debug(`Loaders Registration: Registered ${tokens.SchemaLoader}.`);

    registrar.single(tokens.ManifestLoader, ManifestLoader, [
        tokens.IConfiguration,
        tokens.IPathResolver,
        tokens.IDataFetcher,
        tokens.ISchemaValidator,
        tokens.ILogger
    ]);
    logger.debug(`Loaders Registration: Registered ${tokens.ManifestLoader}.`);

    registrar.single(tokens.RuleLoader, RuleLoader, [
        tokens.IPathResolver,
        tokens.IDataFetcher,
        tokens.ISchemaValidator,
        tokens.IDataRegistry,
        tokens.ILogger
    ]);
    logger.debug(`Loaders Registration: Registered ${tokens.RuleLoader}.`);

    registrar.single(tokens.GenericContentLoader, GenericContentLoader, [
        tokens.IConfiguration,
        tokens.IPathResolver,
        tokens.IDataFetcher,
        tokens.ISchemaValidator,
        tokens.IDataRegistry,
        tokens.ILogger
    ]);
    logger.debug(`Loaders Registration: Registered ${tokens.GenericContentLoader}.`);

    registrar.single(tokens.ComponentDefinitionLoader, ComponentDefinitionLoader, [
        tokens.IConfiguration,
        tokens.IPathResolver,
        tokens.IDataFetcher,
        tokens.ISchemaValidator,
        tokens.IDataRegistry,
        tokens.ILogger
    ]);
    logger.debug(`Loaders Registration: Registered ${tokens.ComponentDefinitionLoader}.`);

    logger.debug('Loaders Registration: Completed.');
}