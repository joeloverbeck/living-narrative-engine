// src/core/config/registrations/infrastructureRegistrations.js
import EventBus from '../../eventBus.js';
import SpatialIndexManager from '../../spatialIndexManager.js';
import WorldLoader from '../../services/worldLoader.js';
import {GameDataRepository} from '../../services/gameDataRepository.js';
import EntityManager from '../../../entities/entityManager.js';
import ValidatedEventDispatcher from '../../../services/validatedEventDispatcher.js';
import {tokens} from '../../tokens.js';
import {Registrar} from '../../dependencyInjection/registrarHelpers.js';

// Assuming ActionLoader and EventLoader tokens exist and loaders are registered elsewhere
// (e.g., in loaderRegistrations.js)
// Example: import ActionLoader from '../../services/actionLoader.js';
// Example: import EventLoader from '../../services/eventLoader.js';

export function registerInfrastructure(container) {
    const r = new Registrar(container);
    const log = container.resolve(tokens.ILogger);

    log.debug('Infrastructure Registration: starting…');

    r.single(tokens.EventBus, EventBus);
    container.register(tokens.ISpatialIndexManager, () => new SpatialIndexManager(), {lifecycle: 'singleton'});

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
        c.resolve(tokens.ISchemaValidator),         // 8th: validator
        c.resolve(tokens.IConfiguration),           // 9th: configuration
        c.resolve(tokens.GameConfigLoader),         // 10th: gameConfigLoader
        c.resolve(tokens.ModManifestLoader)         // 11th: modManifestLoader
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