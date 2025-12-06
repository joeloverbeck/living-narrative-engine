/**
 * @file Integration tests for BlueprintSlotStrategy using production collaborators
 *       wherever feasible.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BlueprintSlotStrategy from '../../../../src/anatomy/integration/strategies/BlueprintSlotStrategy.js';
import AnatomyBlueprintRepository from '../../../../src/anatomy/repositories/anatomyBlueprintRepository.js';
import InMemoryDataRegistry from '../../../../src/data/inMemoryDataRegistry.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';
import { createMockLogger } from '../../../common/mockFactories/index.js';

/**
 * Helper to build a lightweight body graph representation for tests.
 *
 * @param {Record<string, string[]>} adjacency - Map of entity IDs to their children.
 * @returns {{getConnectedParts: (id: string) => string[], getAllPartIds: () => string[]}}
 */
const createBodyGraph = (adjacency = {}) => ({
  getConnectedParts: (entityId) => adjacency[entityId] || [],
  getAllPartIds: () =>
    Object.values(adjacency).reduce((parts, list) => parts.concat(list), []),
});

describe('BlueprintSlotStrategy (integration)', () => {
  let logger;
  let entityManager;
  let dataRegistry;
  let blueprintRepository;
  let bodyGraphService;
  let anatomySocketIndex;

  /**
   * Stores blueprint and recipe data in the in-memory registry.
   *
   * @param {string} recipeId
   * @param {string} blueprintId
   * @param {object} blueprintData
   */
  const storeBlueprint = (recipeId, blueprintId, blueprintData) => {
    dataRegistry.store('anatomyRecipes', recipeId, {
      id: recipeId,
      blueprintId,
    });

    dataRegistry.store('anatomyBlueprints', blueprintId, {
      id: blueprintId,
      slots: {},
      ...blueprintData,
    });
  };

  /**
   * Creates a BlueprintSlotStrategy with the current dependencies.
   *
   * @param {object} [overrides]
   * @returns {BlueprintSlotStrategy}
   */
  const createStrategy = (overrides = {}) =>
    new BlueprintSlotStrategy({
      logger,
      entityManager,
      bodyGraphService,
      anatomyBlueprintRepository: blueprintRepository,
      anatomySocketIndex,
      ...overrides,
    });

  beforeEach(() => {
    logger = createMockLogger();
    entityManager = new SimpleEntityManager();
    dataRegistry = new InMemoryDataRegistry({ logger });
    blueprintRepository = new AnatomyBlueprintRepository({
      logger,
      dataRegistry,
    });

    bodyGraphService = {
      getBodyGraph: jest.fn().mockResolvedValue(createBodyGraph()),
    };

    anatomySocketIndex = {
      findEntityWithSocket: jest.fn().mockResolvedValue(null),
    };
  });

  it('determines resolvability based on blueprintSlots array', () => {
    const strategy = createStrategy();

    expect(strategy.canResolve(null)).toBe(false);
    expect(strategy.canResolve({ blueprintSlots: 'not-an-array' })).toBe(false);
    expect(strategy.canResolve({ blueprintSlots: [] })).toBe(true);
  });

  it('returns an empty array when mapping cannot be resolved', async () => {
    const strategy = createStrategy();

    const result = await strategy.resolve('any-entity', { foo: 'bar' });
    expect(result).toEqual([]);
    expect(bodyGraphService.getBodyGraph).not.toHaveBeenCalled();
  });

  it('warns when an entity has no associated blueprint recipe', async () => {
    const strategy = createStrategy();

    entityManager.setEntities([
      {
        id: 'actor-no-recipe',
        components: {
          'anatomy:body': {
            recipeId: undefined,
          },
        },
      },
    ]);

    const result = await strategy.resolve('actor-no-recipe', {
      blueprintSlots: ['missing-slot'],
    });

    expect(result).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('No blueprint found for entity actor-no-recipe')
    );
  });

  it('logs when a blueprint slot is missing from the definition', async () => {
    storeBlueprint('recipe-slot-missing', 'blueprint-slot-missing', {
      slots: {
        torso_slot: { socket: 'torso_socket' },
      },
    });

    entityManager.setEntities([
      {
        id: 'actor-slot-missing',
        components: {
          'anatomy:body': {
            recipeId: 'recipe-slot-missing',
          },
        },
      },
    ]);

    const strategy = createStrategy();

    await strategy.resolve('actor-slot-missing', {
      blueprintSlots: ['arm_slot'],
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Blueprint slot 'arm_slot' not found")
    );
  });

  it('logs when a blueprint slot has no socket defined', async () => {
    storeBlueprint('recipe-no-socket', 'blueprint-no-socket', {
      slots: {
        floating_slot: {},
      },
    });

    entityManager.setEntities([
      {
        id: 'actor-no-socket',
        components: {
          'anatomy:body': {
            recipeId: 'recipe-no-socket',
          },
        },
      },
    ]);

    const strategy = createStrategy();

    const result = await strategy.resolve('actor-no-socket', {
      blueprintSlots: ['floating_slot'],
    });

    expect(result).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "BlueprintSlotStrategy: Blueprint slot 'floating_slot' has no socket defined"
      )
    );
    expect(anatomySocketIndex.findEntityWithSocket).not.toHaveBeenCalled();
  });

  it('resolves slots directly using preconfigured mappings', async () => {
    storeBlueprint('recipe-direct', 'blueprint-direct', {
      slots: {
        mapped_slot: { socket: 'shoulder_socket' },
      },
    });

    entityManager.setEntities([
      {
        id: 'actor-direct',
        components: {
          'anatomy:body': {
            recipeId: 'recipe-direct',
          },
        },
      },
      {
        id: 'mapped-entity',
        components: {
          'anatomy:sockets': {
            sockets: [{ id: 'shoulder_socket', orientation: 'forward' }],
          },
        },
      },
    ]);

    const strategy = createStrategy();

    const result = await strategy.resolve(
      'actor-direct',
      {
        blueprintSlots: ['mapped_slot'],
      },
      new Map([['mapped_slot', 'mapped-entity']])
    );

    expect(result).toEqual([
      {
        entityId: 'mapped-entity',
        socketId: 'shoulder_socket',
        slotPath: 'mapped_slot',
        orientation: 'forward',
      },
    ]);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        "BlueprintSlotStrategy: Found direct slot mapping for 'mapped_slot'"
      )
    );
  });

  it('traverses blueprint slot paths using body graph relationships', async () => {
    const adjacency = {
      'actor-hierarchy': ['torso-entity'],
      'torso-entity': ['arm-entity'],
      'arm-entity': ['hand-entity'],
    };

    storeBlueprint('recipe-hierarchy', 'blueprint-hierarchy', {
      slots: {
        torso_root: { socket: 'torso_socket', type: 'torso' },
        torso_left_arm: {
          parent: 'torso_root',
          socket: 'left_shoulder',
          type: 'arm',
        },
        torso_left_hand: {
          parent: 'torso_left_arm',
          socket: 'left_hand_socket',
          type: 'hand',
        },
      },
    });

    entityManager.setEntities([
      {
        id: 'actor-hierarchy',
        components: {
          'anatomy:body': {
            recipeId: 'recipe-hierarchy',
          },
        },
      },
      {
        id: 'torso-entity',
        components: {
          'anatomy:joint': {
            parentEntityId: 'actor-hierarchy',
            socketId: 'torso_socket',
          },
        },
      },
      {
        id: 'arm-entity',
        components: {
          'anatomy:joint': {
            parentEntityId: 'torso-entity',
            socketId: 'left_shoulder',
          },
        },
      },
      {
        id: 'hand-entity',
        components: {
          'anatomy:joint': {
            parentEntityId: 'arm-entity',
            socketId: 'left_hand_socket',
          },
          'anatomy:sockets': {
            sockets: [{ id: 'left_hand_socket', orientation: null }],
          },
        },
      },
    ]);

    const originalGetComponentData =
      entityManager.getComponentData.bind(entityManager);
    entityManager.getComponentData = jest.fn((entityId, componentId) => {
      if (entityId === 'arm-entity' && componentId === 'anatomy:joint') {
        return Promise.resolve({
          parentEntityId: 'torso-entity',
          socketId: 'left_shoulder',
        });
      }
      return originalGetComponentData(entityId, componentId);
    });

    bodyGraphService.getBodyGraph = jest
      .fn()
      .mockResolvedValue(createBodyGraph(adjacency));

    const strategy = createStrategy();

    const result = await strategy.resolve('actor-hierarchy', {
      blueprintSlots: ['torso_left_hand'],
    });

    expect(result).toEqual([
      {
        entityId: 'hand-entity',
        socketId: 'left_hand_socket',
        slotPath: 'torso_left_hand',
        orientation: 'left',
      },
    ]);
    expect(bodyGraphService.getBodyGraph).toHaveBeenCalledWith(
      'actor-hierarchy'
    );
    expect(anatomySocketIndex.findEntityWithSocket).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        "BlueprintSlotStrategy: Found slot mapping for 'torso_left_hand'"
      )
    );
  });

  it('falls back to the socket index when slot types are unspecified', async () => {
    storeBlueprint('recipe-socket-fallback', 'blueprint-socket-fallback', {
      slots: {
        socket_only_slot: { socket: 'simple_socket' },
      },
    });

    entityManager.setEntities([
      {
        id: 'actor-socket-fallback',
        components: {
          'anatomy:body': {
            recipeId: 'recipe-socket-fallback',
          },
        },
      },
      {
        id: 'socket-owner',
        components: {
          'anatomy:sockets': {
            sockets: [{ id: 'simple_socket', orientation: 'neutral' }],
          },
        },
      },
    ]);

    anatomySocketIndex.findEntityWithSocket.mockResolvedValue('socket-owner');

    const strategy = createStrategy();

    const result = await strategy.resolve('actor-socket-fallback', {
      blueprintSlots: ['socket_only_slot'],
    });

    expect(anatomySocketIndex.findEntityWithSocket).toHaveBeenCalledWith(
      'actor-socket-fallback',
      'simple_socket'
    );
    expect(result).toEqual([
      {
        entityId: 'socket-owner',
        socketId: 'simple_socket',
        slotPath: 'socket_only_slot',
        orientation: 'neutral',
      },
    ]);
  });
});
