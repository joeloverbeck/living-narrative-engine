// src/core/config/registrations/infrastructureRegistrations.js
import EventBus from '../../eventBus.js';
import SpatialIndexManager from '../../spatialIndexManager.js';
import WorldLoader from '../../loaders/worldLoader.js';
import {GameDataRepository} from '../../services/gameDataRepository.js';
import EntityManager from '../../../entities/entityManager.js';
import ValidatedEventDispatcher from '../../../services/validatedEventDispatcher.js'; // Concrete Class Import
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
 * @typedef {import('../../../services/validatedEventDispatcher.js').default} ValidatedEventDispatcher // For WorldLoader & Self
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

    // --- UPDATED WorldLoader Factory (Ticket 15) ---
    // Now uses a dependency object constructor.
    container.register(tokens.WorldLoader, c => {
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
            validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher) // <<< Use interface token
        };
        // Pass the single dependency object to the constructor
        return new WorldLoader(dependencies);
    }, {lifecycle: 'singleton'});
    log.debug(`Infrastructure Registration: Registered ${tokens.WorldLoader} (with VED dependency).`);

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


    // --- Register ValidatedEventDispatcher against its Interface Token --- // MODIFIED
    container.register(tokens.IValidatedEventDispatcher, c => new ValidatedEventDispatcher({
        eventBus: c.resolve(tokens.EventBus),
        gameDataRepository: c.resolve(tokens.GameDataRepository),
        schemaValidator: /** @type {ISchemaValidator} */ (c.resolve(tokens.ISchemaValidator)),
        logger: /** @type {ILogger} */ (c.resolve(tokens.ILogger))
    }), {lifecycle: 'singleton'});
    log.debug(`Infrastructure Registration: Registered ${tokens.IValidatedEventDispatcher}.`);


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