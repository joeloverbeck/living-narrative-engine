import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import DataRegistryError from '../../../src/errors/dataRegistryError.js';

describe('InMemoryDataRegistry integration', () => {
  let logger;
  let registry;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    registry = new InMemoryDataRegistry({ logger });
  });

  it('validates inputs when storing data and logs errors', () => {
    expect(registry.store('', 'id', {})).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      'InMemoryDataRegistry.store: Invalid or empty type provided.'
    );

    logger.error.mockClear();
    expect(registry.store('actions', '', {})).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      "InMemoryDataRegistry.store: Invalid or empty id provided for type 'actions'."
    );

    logger.error.mockClear();
    expect(registry.store('actions', 'action-1', null)).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      "InMemoryDataRegistry.store: Invalid data provided for type 'actions', id 'action-1'. Must be an object."
    );

    expect(registry.getAll('actions')).toEqual([]);
  });

  it('stores, overrides, and retrieves data including content origins', () => {
    const firstStoreResult = registry.store('actions', 'action-1', {
      id: 'action-1',
      description: 'First action',
      modId: 'core',
    });
    expect(firstStoreResult).toBe(false);

    const secondStoreResult = registry.store('actions', 'action-1', {
      id: 'action-1',
      description: 'Updated action',
      modId: 'core',
    });
    expect(secondStoreResult).toBe(true);

    expect(registry.getActionDefinition('action-1')).toEqual({
      id: 'action-1',
      description: 'Updated action',
      modId: 'core',
    });
    expect(registry.getAllActionDefinitions()).toEqual([
      {
        id: 'action-1',
        description: 'Updated action',
        modId: 'core',
      },
    ]);

    expect(registry.getContentSource('actions', 'action-1')).toBe('core');
    expect(registry.listContentByMod('core')).toEqual({
      actions: ['action-1'],
    });
  });

  it('throws DataRegistryError when fetching with invalid identifiers', () => {
    expect(() => registry.get('', 'id')).toThrow(DataRegistryError);
    expect(() => registry.get('actions', '')).toThrow(DataRegistryError);
    expect(() => registry.getAll('')).toThrow(DataRegistryError);
    expect(() => registry.getContentSource('', 'id')).toThrow(DataRegistryError);
    expect(() => registry.getContentSource('actions', '')).toThrow(DataRegistryError);
  });

  it('returns expected collections for domain-specific getters', () => {
    const definitions = {
      worlds: { id: 'world-1', name: 'World One' },
      rules: { id: 'rule-1', description: 'Rule' },
      entityDefinitions: { id: 'entity-1', components: {} },
      components: { id: 'component-1', type: 'core:test' },
      conditions: { id: 'condition-1' },
      events: { id: 'event-1' },
      entityInstances: { id: 'instance-1' },
      goals: { id: 'goal-1' },
    };

    for (const [type, definition] of Object.entries(definitions)) {
      registry.store(type, definition.id, definition);
    }

    expect(registry.getWorldDefinition('world-1')).toEqual(definitions.worlds);
    expect(registry.getAllWorldDefinitions()).toEqual([definitions.worlds]);
    expect(registry.getAllSystemRules()).toEqual([definitions.rules]);
    expect(registry.getEntityDefinition('entity-1')).toEqual(
      definitions.entityDefinitions
    );
    expect(registry.getAllEntityDefinitions()).toEqual([
      definitions.entityDefinitions,
    ]);
    expect(registry.getEventDefinition('event-1')).toEqual(definitions.events);
    expect(registry.getAllEventDefinitions()).toEqual([definitions.events]);
    expect(registry.getComponentDefinition('component-1')).toEqual(
      definitions.components
    );
    expect(registry.getAllComponentDefinitions()).toEqual([
      definitions.components,
    ]);
    expect(registry.getConditionDefinition('condition-1')).toEqual(
      definitions.conditions
    );
    expect(registry.getAllConditionDefinitions()).toEqual([
      definitions.conditions,
    ]);
    expect(registry.getEntityInstanceDefinition('instance-1')).toEqual(
      definitions.entityInstances
    );
    expect(registry.getAllEntityInstanceDefinitions()).toEqual([
      definitions.entityInstances,
    ]);
    expect(registry.getGoalDefinition('goal-1')).toEqual(definitions.goals);
    expect(registry.getAllGoalDefinitions()).toEqual([definitions.goals]);
  });

  it('lists content origins for specific mods and clears correctly', () => {
    registry.store('actions', 'action-1', {
      id: 'action-1',
      modId: 'mod-a',
    });
    registry.store('components', 'component-1', {
      id: 'component-1',
      modId: 'mod-a',
    });
    registry.store('components', 'component-2', {
      id: 'component-2',
      modId: 'mod-b',
    });

    expect(registry.listContentByMod('mod-a')).toEqual({
      actions: ['action-1'],
      components: ['component-1'],
    });
    expect(registry.listContentByMod('mod-b')).toEqual({
      components: ['component-2'],
    });
    expect(registry.listContentByMod('missing-mod')).toEqual({});

    registry.clear();

    expect(registry.getAllActionDefinitions()).toEqual([]);
    expect(registry.listContentByMod('mod-a')).toEqual({});
  });

  it('derives starting player and location information with fallbacks', () => {
    registry.store('entityDefinitions', 'player-1', {
      id: 'player-1',
      components: {
        'core:player': {},
        'core:position': {
          locationId: 'location-42',
        },
      },
    });

    registry.store('entityDefinitions', 'npc-1', {
      id: 'npc-1',
      components: {},
    });

    expect(registry.getStartingPlayerId()).toBe('player-1');
    expect(registry.getStartingLocationId()).toBe('location-42');

    registry.store('entityDefinitions', 'player-1', {
      id: 'player-1',
      components: {
        'core:player': {},
      },
    });

    expect(registry.getStartingLocationId()).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      "Starting player 'player-1' has no valid locationId in core:position component."
    );

    registry.clear();
    expect(registry.getStartingPlayerId()).toBeNull();
    expect(registry.getStartingLocationId()).toBeNull();
  });
});
