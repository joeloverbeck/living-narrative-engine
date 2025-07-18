/**
 * @file Factory helpers for entity-related mocks used in tests.
 * @see tests/common/mockFactories/entities.js
 */

import { jest } from '@jest/globals';
import {
  ACTOR_COMPONENT_ID,
  PLAYER_COMPONENT_ID,
  PLAYER_TYPE_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

/**
 * Builds a base registry object with stubbed methods.
 *
 * @description Provides minimal jest.fn implementations for registry APIs used
 *   in tests.
 * @returns {{get: jest.Mock, getAll: jest.Mock, store: jest.Mock, clear: jest.Mock}}
 *   Base registry stub.
 */
function buildRegistryBase() {
  return {
    get: jest.fn(),
    getAll: jest.fn(() => []),
    store: jest.fn(),
    clear: jest.fn(),
  };
}

/**
 * Creates a simple mock data registry with jest.fn methods.
 *
 * @returns {{get: jest.Mock, store: jest.Mock, clear: jest.Mock}} Registry mock
 */
export const createSimpleMockDataRegistry = () => ({
  ...buildRegistryBase(),
  getEntityDefinition: jest.fn(),
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
    ...buildRegistryBase(),
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
 * Creates a simple data registry for rule integration tests.
 *
 * @description Provides basic register/get APIs for storing rule records.
 * @returns {{
 *   register: (id: string, record: any) => void,
 *   get: (id: string) => any,
 *   getAll: () => any[],
 *   clear: () => void
 * }} In-memory registry instance.
 */
export function createRuleTestDataRegistry() {
  const data = new Map();
  return {
    register(id, record) {
      data.set(id, record);
    },
    get(id) {
      return data.get(id);
    },
    getAll() {
      return Array.from(data.values());
    },
    clear() {
      data.clear();
    },
  };
}

/**
 * Creates a mock IEntityManager.
 *
 * @param root0
 * @param root0.returnArray
 * @returns {jest.Mocked<import('../../../src/interfaces/IEntityManager.js').IEntityManager>} Mocked service
 */
export function createMockEntityManager({ returnArray = false } = {}) {
  const activeEntities = new Map();
  const entityComponents = new Map();

  return {
    activeEntities,
    get entities() {
      return Array.from(activeEntities.values())[Symbol.iterator]();
    },
    getEntityIds: jest.fn(() => Array.from(activeEntities.keys())),
    clearAll: jest.fn(() => {
      activeEntities.clear();
      entityComponents.clear();
    }),
    getActiveEntities: jest.fn(() =>
      returnArray
        ? Array.from(activeEntities.values())
        : activeEntities.values()
    ),
    getEntityInstance: jest.fn((id) => activeEntities.get(id)),
    removeEntityInstance: jest.fn((id) => {
      activeEntities.delete(id);
      entityComponents.delete(id);
    }),
    reconstructEntity: jest.fn((data) => {
      const entity = { id: data.instanceId || data.id };
      activeEntities.set(entity.id, entity);
      return entity;
    }),
    // Required by ActionErrorContextBuilder
    getEntity: jest.fn((id) => {
      const entity = activeEntities.get(id);
      return entity || { id, type: 'unknown' };
    }),
    getAllComponents: jest.fn((id) => {
      return entityComponents.get(id) || {};
    }),
    // Helper for tests to set up entity components
    setEntityComponents: jest.fn((id, components) => {
      entityComponents.set(id, components);
    }),
    // Required by ActionErrorContextBuilder
    getAllComponentTypesForEntity: jest.fn((id) => {
      return Object.keys(entityComponents.get(id) || {});
    }),
    getComponentData: jest.fn((id, componentType) => {
      const components = entityComponents.get(id) || {};
      return components[componentType];
    }),
  };
}

/**
 * Creates a simple mock entity with component checks.
 *
 * @param {string} id - Unique entity ID.
 * @param {{isActor?: boolean, isPlayer?: boolean, playerType?: string}} [options] - Component flags.
 * @returns {{id: string, hasComponent: jest.Mock, getComponentData: jest.Mock, components: object}} Mock entity
 */
export const createMockEntity = (
  id,
  { isActor = false, isPlayer = false, playerType = null } = {}
) => {
  const components = {};

  if (isActor) {
    components[ACTOR_COMPONENT_ID] = {};
  }

  if (isPlayer) {
    // Add legacy player component for backward compatibility
    components[PLAYER_COMPONENT_ID] = {};
    // Also add new player_type component
    components[PLAYER_TYPE_COMPONENT_ID] = { type: 'human' };
  } else if (playerType) {
    // Add player_type component with specified type
    components[PLAYER_TYPE_COMPONENT_ID] = { type: playerType };
  }

  return {
    id,
    components,
    get componentTypeIds() {
      return Object.keys(components);
    },
    hasComponent: jest.fn((compId) => {
      if (compId === ACTOR_COMPONENT_ID) return isActor;
      if (compId === PLAYER_COMPONENT_ID) return isPlayer;
      if (compId === PLAYER_TYPE_COMPONENT_ID) return isPlayer || !!playerType;
      return false;
    }),
    getComponentData: jest.fn((compId) => components[compId] || null),
  };
};

/**
 * Creates a mock actor entity with component access helpers.
 *
 * @param {string} id - Actor ID.
 * @param {{
 *   isPlayer?: boolean,
 *   playerType?: string,
 *   name?: string,
 *   components?: Array<string | { componentId: string, data?: any }>
 * }} [options] - Configuration options.
 * @returns {{
 *   id: string,
 *   name: string,
 *   components: object,
 *   getComponent: jest.Mock,
 *   hasComponent: jest.Mock,
 *   getComponentData: jest.Mock
 * }} Mock actor entity.
 */
export const createMockActor = (
  id,
  { isPlayer = false, playerType = null, name = id, components = [] } = {}
) => {
  const base = createMockEntity(id, { isActor: true, isPlayer, playerType });

  // Merge provided components with base components
  const allComponents = { ...base.components };
  components.forEach((c) => {
    const componentId = c.componentId ?? c;
    const data = c.data ?? {};
    allComponents[componentId] = data;
  });

  // Create Map for backward compatibility but also keep object format
  const compMap = new Map(Object.entries(allComponents));

  return {
    ...base,
    name,
    components: allComponents, // Keep as object for direct access
    get componentTypeIds() {
      return Object.keys(allComponents);
    },
    getComponent: jest.fn((compId) => compMap.get(compId)),
    getComponentData: base.getComponentData, // Already defined in base
  };
};

/**
 * Creates a minimal test entity with component map access.
 *
 * @description Provides an object with `id`, `components` and
 *   `getComponentData` for simple unit tests.
 * @param {string} instanceId - Entity instance ID.
 * @param {Record<string, any>} [components] - Components keyed by id.
 * @returns {{id: string, components: Record<string, any>, getComponentData: (id: string) => any}}
 *   Minimal entity stub.
 */
export const createTestEntity = (instanceId, components = {}) => ({
  id: instanceId,
  components,
  get componentTypeIds() {
    return Object.keys(components);
  },
  getComponentData: (id) => components[id] ?? null,
});

/**
 * Creates a mock DefinitionCache with Jest mocks.
 *
 * @param {object} [options] - Configuration options
 * @param {Map<string, any>} [options.initialCache] - Initial cache entries
 * @param {boolean} [options.enableStats] - Whether to enable statistics tracking
 * @returns {{get: jest.Mock, set: jest.Mock, has: jest.Mock, clear: jest.Mock, size: number}} Mock cache
 */
export const createMockDefinitionCache = ({
  initialCache = new Map(),
  enableStats = false,
} = {}) => {
  const cache = new Map(initialCache);
  let hits = 0;
  let misses = 0;

  const mockCache = {
    get: jest.fn((id) => {
      if (cache.has(id)) {
        hits++;
        return cache.get(id);
      }
      misses++;
      return undefined;
    }),
    set: jest.fn((id, definition) => {
      cache.set(id, definition);
    }),
    has: jest.fn((id) => cache.has(id)),
    clear: jest.fn(() => {
      cache.clear();
      hits = 0;
      misses = 0;
    }),
    get size() {
      return cache.size;
    },
    keys: jest.fn(() => cache.keys()),
  };

  if (enableStats) {
    mockCache.getStats = jest.fn(() => ({
      size: cache.size,
      hits,
      misses,
    }));
  }

  return mockCache;
};

/**
 * Creates a mock entity definition for testing.
 *
 * @param {string} id - Definition ID
 * @param {object} [options] - Configuration options
 * @param {Record<string, any>} [options.components] - Component definitions
 * @param {string} [options.name] - Entity name
 * @param {string} [options.description] - Entity description
 * @returns {{id: string, components: Record<string, any>, name?: string, description?: string}} Mock definition
 */
export const createMockEntityDefinition = (
  id,
  { components = {}, name, description } = {}
) => {
  const definition = {
    id,
    components,
  };

  if (name) definition.name = name;
  if (description) definition.description = description;

  return definition;
};

/**
 * Creates a mock IIdGenerator function.
 *
 * @param {string} [prefix] - Optional prefix for generated IDs
 * @returns {jest.Mock} Mock ID generator function
 */
export const createMockIdGenerator = (prefix = 'id') => {
  let counter = 0;
  return jest.fn(() => `${prefix}-${++counter}`);
};

/**
 * Creates a mock IComponentCloner function.
 *
 * @returns {jest.Mock} Mock component cloner function
 */
export const createMockComponentCloner = () => {
  return jest.fn((obj) => JSON.parse(JSON.stringify(obj)));
};

/**
 * Creates a mock IDefaultComponentPolicy.
 *
 * @returns {{apply: jest.Mock}} Mock default component policy
 */
export const createMockDefaultComponentPolicy = () => {
  return {
    apply: jest.fn((entity) => {
      // Mock implementation - does nothing by default
      return entity;
    }),
  };
};
