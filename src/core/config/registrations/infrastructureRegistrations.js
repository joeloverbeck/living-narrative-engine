// src/core/config/registrations/infrastructureRegistrations.js
import EventBus from '../../eventBus.js';
import SpatialIndexManager from '../../spatialIndexManager.js';
import WorldLoader from '../../loaders/worldLoader.js';
import {GameDataRepository} from '../../services/gameDataRepository.js';
import EntityManager from '../../../entities/entityManager.js';
import ValidatedEventDispatcher from '../../../services/validatedEventDispatcher.js';
import {tokens} from '../tokens.js';
import {Registrar} from '../../dependencyInjection/registrarHelpers.js';
import {SystemServiceRegistry} from "../../services/systemServiceRegistry.js";
import {SystemDataRegistry} from "../../services/systemDataRegistry.js";

// Assuming ActionLoader and EventLoader tokens exist and loaders are registered elsewhere
// (e.g., in loaderRegistrations.js)
// Example: import ActionLoader from '../../services/actionLoader.js';
// Example: import EventLoader from '../../services/eventLoader.js';

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
 */

export function registerInfrastructure(container) {
    const r = new Registrar(container);
    /** @type {ILogger} */
    const log = container.resolve(tokens.ILogger);

    log.debug('Infrastructure Registration: starting…');

    r.single(tokens.EventBus, EventBus);
    log.debug(`Infrastructure Registration: Registered ${tokens.EventBus}.`);

    container.register(tokens.ISpatialIndexManager, () => new SpatialIndexManager(), {lifecycle: 'singleton'});
    log.debug(`Infrastructure Registration: Registered ${tokens.ISpatialIndexManager}.`);

    // UPDATED WorldLoader factory function for REFACTOR-LOADER-3
    container.register(tokens.WorldLoader, c => new WorldLoader(
        // Arguments must match the WorldLoader constructor order exactly:
        c.resolve(tokens.IDataRegistry),             // 1st: registry
        c.resolve(tokens.ILogger),                  // 2nd: logger
        c.resolve(tokens.SchemaLoader),             // 3rd: schemaLoader
        c.resolve(tokens.ComponentDefinitionLoader), // 4th: componentDefinitionLoader
        c.resolve(tokens.RuleLoader),               // 5th: ruleLoader
        c.resolve(tokens.ActionLoader),             // 6th: actionLoader <<< ADDED
        c.resolve(tokens.EventLoader),              // 7th: eventLoader <<< ADDED
        c.resolve(tokens.EntityLoader),             // 8th: entityLoader <<< ADDED
        c.resolve(tokens.ISchemaValidator),         // 9th: validator
        c.resolve(tokens.IConfiguration),           // 10th: configuration
        c.resolve(tokens.GameConfigLoader),         // 11th: gameConfigLoader
        c.resolve(tokens.ModManifestLoader)         // 12th: modManifestLoader
    ), {lifecycle: 'singleton'});
    log.debug(`Infrastructure Registration: Registered ${tokens.WorldLoader}.`);

    container.register(tokens.GameDataRepository,
        c => new GameDataRepository(
            /** @type {IDataRegistry} */ (c.resolve(tokens.IDataRegistry)),
            /** @type {ILogger} */ (c.resolve(tokens.ILogger))
        ),
        {lifecycle: 'singleton'}
    );
    log.debug(`Infrastructure Registration: Registered ${tokens.GameDataRepository}.`);


    container.register(tokens.EntityManager, c => new EntityManager(
        /** @type {IDataRegistry} */ (c.resolve(tokens.IDataRegistry)),
        /** @type {ISchemaValidator} */ (c.resolve(tokens.ISchemaValidator)),
        /** @type {ILogger} */ (c.resolve(tokens.ILogger)),
        /** @type {ISpatialIndexManager} */ (c.resolve(tokens.ISpatialIndexManager))
    ), {lifecycle: 'singleton'});
    log.debug(`Infrastructure Registration: Registered ${tokens.EntityManager}.`);


    container.register(tokens.ValidatedEventDispatcher, c => new ValidatedEventDispatcher({
        eventBus: c.resolve(tokens.EventBus),
        gameDataRepository: c.resolve(tokens.GameDataRepository),
        schemaValidator: /** @type {ISchemaValidator} */ (c.resolve(tokens.ISchemaValidator)),
        logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger))
    }), {lifecycle: 'singleton'});
    log.debug(`Infrastructure Registration: Registered ${tokens.ValidatedEventDispatcher}.`);


    r.singletonFactory(tokens.SystemServiceRegistry, c => new SystemServiceRegistry(
        /** @type {ILogger} */ (c.resolve(tokens.ILogger)) // Resolve the logger dependency
    ));
    log.debug(`Infrastructure Registration: Registered ${tokens.SystemServiceRegistry}.`);


    // Register SystemDataRegistry (depends on ILogger)
    r.singletonFactory(tokens.SystemDataRegistry, c => new SystemDataRegistry(
        /** @type {ILogger} */ (c.resolve(tokens.ILogger))
    ));
    log.debug(`Infrastructure Registration: Registered ${tokens.SystemDataRegistry}.`);

    log.info('Infrastructure Registration: complete.');
}