/**
 * @jest-environment node
 * @file Integration test for lighting when dropping a lit lantern.
 * @description Ensures lit inventory items keep rooms lit after drop via spatial index updates.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import EntityManager from '../../../../src/entities/entityManager.js';
import EntityDefinition from '../../../../src/entities/entityDefinition.js';
import SpatialIndexManager from '../../../../src/entities/spatialIndexManager.js';
import { SpatialIndexSynchronizer } from '../../../../src/entities/spatialIndexSynchronizer.js';
import { LocationQueryService } from '../../../../src/entities/locationQueryService.js';
import { LightingStateService } from '../../../../src/locations/services/lightingStateService.js';
import DropItemAtLocationHandler from '../../../../src/logic/operationHandlers/dropItemAtLocationHandler.js';
import {
  createEventBus,
  createMockLogger,
  createMockSchemaValidator,
} from '../../../common/mockFactories/index.js';

describe('lighting: drop lit lantern keeps location lit', () => {
  let registry;
  let validator;
  let logger;
  let eventBus;
  let entityManager;
  let spatialIndexManager;
  let spatialIndexSynchronizer;
  let locationQueryService;
  let lightingStateService;
  let dropHandler;

  beforeEach(async () => {
    logger = createMockLogger();
    validator = createMockSchemaValidator({ isValid: true });
    registry = new InMemoryDataRegistry({ logger });
    eventBus = createEventBus({ captureEvents: true });

    const registerDefinition = (id, components) => {
      const definition = new EntityDefinition(id, { components });
      registry.store('entityDefinitions', id, definition);
    };

    registerDefinition('test:dark_room', {
      'core:name': { text: 'Dark Room' },
      'locations:naturally_dark': {},
    });

    registerDefinition('test:actor', {
      'core:name': { text: 'Saffi' },
    });

    registerDefinition('test:lantern', {
      'core:name': { text: 'Lantern' },
      'lighting:is_lit': {},
      'items-core:item': {},
      'items-core:portable': {},
      'core:weight': { weight: 1 },
    });

    // Create spatial infrastructure first
    spatialIndexManager = new SpatialIndexManager({ logger });
    locationQueryService = new LocationQueryService({
      spatialIndexManager,
      logger,
    });

    // Create EntityManager with locationQueryService injected
    entityManager = new EntityManager({
      registry,
      validator,
      logger,
      dispatcher: eventBus,
      locationQueryService,
    });

    await entityManager.createEntityInstance('test:dark_room', {
      instanceId: 'room1',
    });

    await entityManager.createEntityInstance('test:lantern', {
      instanceId: 'lantern1',
    });

    await entityManager.createEntityInstance('test:actor', {
      instanceId: 'saffi',
      componentOverrides: {
        'core:position': { locationId: 'room1' },
        'inventory:inventory': {
          items: ['lantern1'],
          capacity: { maxWeight: 10, maxItems: 5 },
        },
      },
    });

    // Connect synchronizer after EntityManager is created
    spatialIndexSynchronizer = new SpatialIndexSynchronizer({
      spatialIndexManager,
      safeEventDispatcher: eventBus,
      logger,
      entityManager,
    });

    lightingStateService = new LightingStateService({
      entityManager,
      logger,
    });

    dropHandler = new DropItemAtLocationHandler({
      logger,
      entityManager,
      safeEventDispatcher: eventBus,
    });
  });

  afterEach(() => {
    spatialIndexSynchronizer = null;
  });

  it('keeps the room lit after a lit lantern is dropped from inventory', async () => {
    const beforeDrop = lightingStateService.getLocationLightingState('room1');
    expect(beforeDrop.isLit).toBe(true);
    expect(beforeDrop.lightSources).toContain('lantern1');

    const dropResult = await dropHandler.execute({
      actorEntity: 'saffi',
      itemEntity: 'lantern1',
      locationId: 'room1',
    });

    expect(dropResult).toEqual({ success: true });
    expect(
      entityManager.getComponentData('lantern1', 'core:position')
    ).toEqual({ locationId: 'room1' });
    expect(
      entityManager.getComponentData('saffi', 'inventory:inventory').items
    ).not.toContain('lantern1');

    const entitiesInRoom = entityManager.getEntitiesInLocation('room1');
    expect(entitiesInRoom.has('lantern1')).toBe(true);

    const afterDrop = lightingStateService.getLocationLightingState('room1');
    expect(afterDrop.isLit).toBe(true);
    expect(afterDrop.lightSources).toContain('lantern1');
  });
});
