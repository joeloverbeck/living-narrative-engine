/**
 * @file Factory helpers for entity-related mocks used in tests.
 * @see tests/common/mockFactories/entities.js
 */

import { jest } from '@jest/globals';
import {
  ACTOR_COMPONENT_ID,
  PLAYER_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

/**
 * Creates a simple mock data registry with jest.fn methods.
 *
 * @returns {{get: jest.Mock, store: jest.Mock, clear: jest.Mock}} Registry mock
 */
export const createSimpleMockDataRegistry = () => ({
  getEntityDefinition: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(() => []),
  store: jest.fn(),
  clear: jest.fn(),
});

/**
 * Creates a stateful mock data registry used in various unit tests.
 *
 * @returns {object} Stateful registry mock
 */
export const createStatefulMockDataRegistry = () => {
  const internalStore = {};

  const toPascalCase = (str) =>
    str
      .split(/[_-]/)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join('');

  const registry = {
    _internalStore: internalStore,
    store: jest.fn((type, id, data) => {
      if (!internalStore[type]) internalStore[type] = {};
      internalStore[type][id] = data;
    }),
    get: jest.fn((type, id) => internalStore[type]?.[id]),
    getAll: jest.fn((type) => Object.values(internalStore[type] || {})),
    clear: jest.fn(() => {
      Object.keys(internalStore).forEach((k) => delete internalStore[k]);
    }),
    // Convenience helpers frequently used in tests
    getAllSystemRules: jest.fn(() => []),
    getManifest: jest.fn(),
    setManifest: jest.fn(),
    getStartingPlayerId: jest.fn(() => null),
    getStartingLocationId: jest.fn(() => null),
  };

  const contentTypes = [
    'entity_definitions',
    'items',
    'locations',
    'connections',
    'blockers',
    'actions',
    'events',
    'components',
  ];

  for (const type of contentTypes) {
    const pascal = toPascalCase(type);
    registry[`get${pascal}Definition`] = jest.fn(
      (id) => internalStore[type]?.[id]
    );
    registry[`getAll${pascal}Definitions`] = jest.fn(() =>
      Object.values(internalStore[type] || {})
    );
  }

  return registry;
};

/**
 * Creates a mock IEntityManager.
 *
 * @returns {jest.Mocked<import('../../../src/interfaces/IEntityManager.js').IEntityManager>} Mocked service
 */
export const createMockEntityManager = () => {
  const activeEntities = new Map();
  return {
    activeEntities,
    clearAll: jest.fn(() => {
      activeEntities.clear();
    }),
    getActiveEntities: jest.fn(() => activeEntities),
    getEntityInstance: jest.fn((id) => activeEntities.get(id)),
    removeEntityInstance: jest.fn((id) => activeEntities.delete(id)),
    reconstructEntity: jest.fn((data) => {
      const entity = { id: data.instanceId || data.id };
      activeEntities.set(entity.id, entity);
      return entity;
    }),
  };
};

/**
 * Creates a simple mock entity with component checks.
 *
 * @param {string} id - Unique entity ID.
 * @param {{isActor?: boolean, isPlayer?: boolean}} [options] - Component flags.
 * @returns {{id: string, hasComponent: jest.Mock}} Mock entity
 */
export const createMockEntity = (
  id,
  { isActor = false, isPlayer = false } = {}
) => ({
  id,
  hasComponent: jest.fn((compId) => {
    if (compId === ACTOR_COMPONENT_ID) return isActor;
    if (compId === PLAYER_COMPONENT_ID) return isPlayer;
    return false;
  }),
});

/**
 * Creates a mock actor entity with component access helpers.
 *
 * @param {string} id - Actor ID.
 * @param {{
 *   isPlayer?: boolean,
 *   name?: string,
 *   components?: Array<string | { componentId: string, data?: any }>
 * }} [options] - Configuration options.
 * @returns {{
 *   id: string,
 *   name: string,
 *   components: Map<string, any>,
 *   getComponent: jest.Mock,
 *   hasComponent: jest.Mock
 * }} Mock actor entity.
 */
export const createMockActor = (
  id,
  { isPlayer = false, name = id, components = [] } = {}
) => {
  const base = createMockEntity(id, { isActor: true, isPlayer });
  const compMap = new Map(
    components.map((c) => [c.componentId ?? c, c.data ?? {}])
  );
  return {
    ...base,
    name,
    components: compMap,
    getComponent: jest.fn((compId) => compMap.get(compId)),
  };
};
