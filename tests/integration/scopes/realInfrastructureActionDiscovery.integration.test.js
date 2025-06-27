/**
 * @file Integration test demonstrating the spatial index synchronization timing bug.
 * @description This test demonstrates that SpatialIndexSynchronizer must be connected
 * BEFORE entities are created, otherwise it misses entity creation events.
 */

import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import { SimpleEntityManager } from '../../common/entities/index.js';
import SpatialIndexManager from '../../../src/entities/spatialIndexManager.js';
import { LocationQueryService } from '../../../src/entities/locationQueryService.js';
import { EntityManagerAdapter } from '../../../src/entities/entityManagerAdapter.js';
import EntityManager from '../../../src/entities/entityManager.js';
import { SpatialIndexSynchronizer } from '../../../src/entities/spatialIndexSynchronizer.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import EventBus from '../../../src/events/eventBus.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import {
  POSITION_COMPONENT_ID,
  ACTOR_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('Spatial Index Synchronization Timing Bug', () => {
  let logger;
  let registry;
  let eventBus;
  let schemaValidator;
  let gameDataRepository;
  let validatedEventDispatcher;
  let safeEventDispatcher;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Set up shared infrastructure
    registry = new InMemoryDataRegistry();
    eventBus = new EventBus();
    // Use a mock validator that always passes to avoid component schema issues
    schemaValidator = {
      validate: jest.fn(() => true),
      addSchema: jest.fn(() => Promise.resolve()),
      removeSchema: jest.fn(() => true),
      getValidator: jest.fn(() => () => true),
      isSchemaLoaded: jest.fn(() => true),
    };
    gameDataRepository = new GameDataRepository(registry, logger);
    validatedEventDispatcher = new ValidatedEventDispatcher({
      eventBus,
      gameDataRepository,
      schemaValidator,
      logger,
    });
    safeEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher,
      logger,
    });

    // Add entity definitions to registry
    const actorDefinition = new EntityDefinition('test:actor', {
      components: {
        [POSITION_COMPONENT_ID]: {}, // Remove the default locationId: null
        [ACTOR_COMPONENT_ID]: {},
      },
    });
    const locationDefinition = new EntityDefinition('test:location', {
      components: {},
    });

    registry.store('entityDefinitions', 'test:actor', actorDefinition);
    registry.store('entityDefinitions', 'test:location', locationDefinition);
  });

  it('SimpleEntityManager works correctly (baseline)', () => {
    const simpleEntityManager = new SimpleEntityManager();
    const actorId = 'isekai:hero_instance';
    const targetId = 'isekai:ninja_instance';
    const locationId = 'isekai:adventurers_guild_instance';

    const entities = [
      {
        id: actorId,
        components: { [POSITION_COMPONENT_ID]: { locationId } },
      },
      {
        id: targetId,
        components: {
          [POSITION_COMPONENT_ID]: { locationId },
          [ACTOR_COMPONENT_ID]: {},
        },
      },
      { id: locationId, components: {} },
    ];

    simpleEntityManager.setEntities(entities);

    // This SHOULD work because SimpleEntityManager implements getEntitiesInLocation correctly
    const entitiesInLocation =
      simpleEntityManager.getEntitiesInLocation(locationId);
    console.log(
      'SimpleEntityManager entities found in location:',
      Array.from(entitiesInLocation)
    );

    expect(entitiesInLocation.size).toBe(2); // Should find both entities
    expect(entitiesInLocation.has(actorId)).toBe(true);
    expect(entitiesInLocation.has(targetId)).toBe(true);
  });

  it('DEMONSTRATES THE BUG: SpatialIndexSynchronizer initialized AFTER entities are created', () => {
    // Create real infrastructure
    const spatialIndexManager = new SpatialIndexManager({ logger });
    const locationQueryService = new LocationQueryService({
      spatialIndexManager,
      logger,
    });

    // Create REAL EntityManager
    const entityManager = new EntityManager({
      registry,
      validator: schemaValidator,
      logger,
      dispatcher: safeEventDispatcher,
    });

    const realEntityManagerAdapter = new EntityManagerAdapter({
      entityManager,
      locationQueryService,
    });

    const locationId = 'isekai:adventurers_guild_instance';
    const actorId = 'isekai:hero_instance';
    const targetId = 'isekai:ninja_instance';

    // CREATE ENTITIES FIRST (this is what happens during world initialization)
    console.log('Creating location entity...');
    entityManager.createEntityInstance('test:location', {
      instanceId: locationId,
      componentOverrides: {},
    });

    console.log('Creating actor entity...');
    entityManager.createEntityInstance('test:actor', {
      instanceId: actorId,
      componentOverrides: {
        [POSITION_COMPONENT_ID]: { locationId },
      },
    });

    console.log('Creating target entity...');
    entityManager.createEntityInstance('test:actor', {
      instanceId: targetId,
      componentOverrides: {
        [POSITION_COMPONENT_ID]: { locationId },
      },
    });

    console.log('Total entities created:', entityManager.entities.length);
    for (const entity of entityManager.entities) {
      console.log(
        `Entity ${entity.id} has position:`,
        entity.getComponentData(POSITION_COMPONENT_ID)
      );
    }

    // THEN initialize SpatialIndexSynchronizer (this is what happens in system initialization)
    // This simulates the bug where SpatialIndexSynchronizer is initialized after world entities
    new SpatialIndexSynchronizer({
      spatialIndexManager,
      safeEventDispatcher,
      logger,
    });

    // The spatial index should be empty because SpatialIndexSynchronizer
    // was connected AFTER the entity creation events were already fired
    const entitiesInLocation =
      realEntityManagerAdapter.getEntitiesInLocation(locationId);
    console.log(
      'TIMING BUG: entities found in location:',
      Array.from(entitiesInLocation)
    );

    // This demonstrates the timing bug: spatial index is empty because
    // SpatialIndexSynchronizer missed the entity creation events
    expect(entitiesInLocation.size).toBe(0);
  });

  it('Works correctly when SpatialIndexSynchronizer is initialized BEFORE entities', async () => {
    // Create real infrastructure
    const spatialIndexManager = new SpatialIndexManager({ logger });
    const locationQueryService = new LocationQueryService({
      spatialIndexManager,
      logger,
    });

    // Create a SINGLE SafeEventDispatcher instance to be shared
    const sharedEventDispatcher = new SafeEventDispatcher({
      validatedEventDispatcher: new ValidatedEventDispatcher({
        eventBus,
        gameDataRepository,
        schemaValidator,
        logger,
      }),
      logger,
    });

    // Create REAL EntityManager
    const entityManager = new EntityManager({
      registry,
      validator: schemaValidator,
      logger,
      dispatcher: sharedEventDispatcher,
    });

    // CONNECT SpatialIndexSynchronizer FIRST (this is the correct order)
    const synchronizer = new SpatialIndexSynchronizer({
      spatialIndexManager,
      safeEventDispatcher: sharedEventDispatcher,
      logger,
    });

    const realEntityManagerAdapter = new EntityManagerAdapter({
      entityManager,
      locationQueryService,
    });

    const locationId = 'isekai:adventurers_guild_instance';
    const actorId = 'isekai:hero_instance';
    const targetId = 'isekai:ninja_instance';

    // NOW create entities - SpatialIndexSynchronizer will listen to the events
    entityManager.createEntityInstance('test:location', {
      instanceId: locationId,
      componentOverrides: {},
    });

    entityManager.createEntityInstance('test:actor', {
      instanceId: actorId,
      componentOverrides: {
        [POSITION_COMPONENT_ID]: { locationId },
      },
    });

    entityManager.createEntityInstance('test:actor', {
      instanceId: targetId,
      componentOverrides: {
        [POSITION_COMPONENT_ID]: { locationId },
      },
    });

    // Wait for async event dispatching to complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    // With correct timing, the spatial index should be populated
    const entitiesInLocation =
      realEntityManagerAdapter.getEntitiesInLocation(locationId);

    // This should work because SpatialIndexSynchronizer was listening from the start
    expect(entitiesInLocation.size).toBe(2);
    expect(entitiesInLocation.has(actorId)).toBe(true);
    expect(entitiesInLocation.has(targetId)).toBe(true);
  });

  it('Fix: Use spatialIndexManager.buildIndex() to populate index from existing entities', () => {
    // Create real infrastructure
    const spatialIndexManager = new SpatialIndexManager({ logger });
    const locationQueryService = new LocationQueryService({
      spatialIndexManager,
      logger,
    });

    // Create REAL EntityManager
    const entityManager = new EntityManager({
      registry,
      validator: schemaValidator,
      logger,
      dispatcher: safeEventDispatcher,
    });

    const realEntityManagerAdapter = new EntityManagerAdapter({
      entityManager,
      locationQueryService,
    });

    const locationId = 'isekai:adventurers_guild_instance';
    const actorId = 'isekai:hero_instance';
    const targetId = 'isekai:ninja_instance';

    // Create entities first (simulating world initialization)
    entityManager.createEntityInstance('test:location', {
      instanceId: locationId,
      componentOverrides: {},
    });

    entityManager.createEntityInstance('test:actor', {
      instanceId: actorId,
      componentOverrides: {
        [POSITION_COMPONENT_ID]: { locationId },
      },
    });

    entityManager.createEntityInstance('test:actor', {
      instanceId: targetId,
      componentOverrides: {
        [POSITION_COMPONENT_ID]: { locationId },
      },
    });

    // At this point, spatial index is empty because no synchronizer was listening
    const entitiesBeforeBuild =
      realEntityManagerAdapter.getEntitiesInLocation(locationId);
    expect(entitiesBeforeBuild.size).toBe(0);

    // FIX: Build the spatial index from existing entities
    console.log(
      'About to call buildIndex with entityManager.entities:',
      entityManager.entities.length || 'not an array'
    );
    spatialIndexManager.buildIndex(entityManager);
    console.log('buildIndex completed');

    // NOW it should work because we built the index from existing entities
    const entitiesAfterBuild =
      realEntityManagerAdapter.getEntitiesInLocation(locationId);
    console.log(
      'AFTER buildIndex(): entities found in location:',
      Array.from(entitiesAfterBuild)
    );

    expect(entitiesAfterBuild.size).toBe(2);
    expect(entitiesAfterBuild.has(actorId)).toBe(true);
    expect(entitiesAfterBuild.has(targetId)).toBe(true);

    // And now connect SpatialIndexSynchronizer for future updates
    new SpatialIndexSynchronizer({
      spatialIndexManager,
      safeEventDispatcher,
      logger,
    });
  });
});
