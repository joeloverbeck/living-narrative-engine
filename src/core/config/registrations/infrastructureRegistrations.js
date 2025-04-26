// src/core/config/registrations/infrastructureRegistrations.js
import EventBus from '../../eventBus.js';
import SpatialIndexManager from '../../spatialIndexManager.js';
import WorldLoader from '../../services/worldLoader.js';
import {GameDataRepository} from '../../services/gameDataRepository.js';
import EntityManager from '../../../entities/entityManager.js';
import ValidatedEventDispatcher from '../../../services/validatedEventDispatcher.js';
import {tokens} from '../../tokens.js';
import {Registrar} from '../../dependencyInjection/registrarHelpers.js';

export function registerInfrastructure(container) {
    const r = new Registrar(container);
    const log = container.resolve(tokens.ILogger);

    log.debug('Infrastructure Registration: starting…');

    r.single(tokens.EventBus, EventBus);
    container.register(tokens.ISpatialIndexManager, () => new SpatialIndexManager(), {lifecycle: 'singleton'});

    // Updated WorldLoader factory function for Sub-Ticket MODLOADER-006-B
    container.register(tokens.WorldLoader, c => new WorldLoader(
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ILogger),
        c.resolve(tokens.SchemaLoader),
        c.resolve(tokens.ManifestLoader),         // Existing (Keep for now as per MODLOADER-006-B example)
        c.resolve(tokens.GenericContentLoader),
        c.resolve(tokens.ComponentDefinitionLoader),
        c.resolve(tokens.RuleLoader),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.IConfiguration),
        c.resolve(tokens.GameConfigLoader),       // Existing (Added in previous ticket)
        c.resolve(tokens.ModManifestLoader)       // <<< ADDED Injection (MODLOADER-006-B)
    ), {lifecycle: 'singleton'});

    container.register(tokens.GameDataRepository,
        c => new GameDataRepository(c.resolve(tokens.IDataRegistry), c.resolve(tokens.ILogger)),
        {lifecycle: 'singleton'});

    container.register(tokens.EntityManager, c => new EntityManager(
        c.resolve(tokens.IDataRegistry),
        c.resolve(tokens.ISchemaValidator),
        c.resolve(tokens.ILogger),
        c.resolve(tokens.ISpatialIndexManager)
    ), {lifecycle: 'singleton'});

    container.register(tokens.ValidatedEventDispatcher, c => new ValidatedEventDispatcher({
        eventBus: c.resolve(tokens.EventBus),
        gameDataRepository: c.resolve(tokens.GameDataRepository),
        schemaValidator: c.resolve(tokens.ISchemaValidator),
        logger: c.resolve(tokens.ILogger)
    }), {lifecycle: 'singleton'});

    log.info('Infrastructure Registration: complete.');
}
