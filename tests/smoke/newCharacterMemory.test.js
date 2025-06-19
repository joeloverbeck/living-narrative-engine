// tests/smoke/NewCharacterMemory.test.js
// -----------------------------------------------------------------------------
// Smoke Test – Short-Term Memory Initialization
// -----------------------------------------------------------------------------
// Verifies that EntityManager injects a default `core:short_term_memory`
// component (thoughts = [], maxEntries = 10) whenever it instantiates an
// entity definition that contains `core:actor` but is missing
// `core:short_term_memory`.
// -----------------------------------------------------------------------------

import EntityManager from '../../src/entities/entityManager.js';
import EntityDefinition from '../../src/entities/EntityDefinition.js';
import {
  ACTOR_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
} from '../../src/constants/componentIds.js';
import { describe, expect, test, jest } from '@jest/globals';

/**
 * Create minimalist stub implementations for the services EntityManager depends
 * on so we can exercise `createEntityInstance` exactly as production does,
 * without pulling in the entire engine stack.
 */
const makeStubs = () => {
  // IDataRegistry stub returns a definition with an `actor` component and NO
  // short-term memory so we can verify that EntityManager injects it.
  const registry = {
    getEntityDefinition: jest.fn().mockImplementation((definitionId) => {
      if (definitionId === 'test:alice') {
        const definitionData = {
          components: {
            [ACTOR_COMPONENT_ID]: {}, // minimal actor component payload
          },
        };
        return new EntityDefinition(definitionId, definitionData);
      }
      return null;
    }),
  };

  // ISchemaValidator stub – always succeeds.
  const validator = {
    validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
  };

  // ILogger stub – swallow logs.
  const logger = {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  // ISpatialIndexManager stub – no-op implementations.
  const spatialIndexManager = {
    addEntity: jest.fn(),
    removeEntity: jest.fn(),
    updateEntityLocation: jest.fn(),
    getEntitiesInLocation: jest.fn().mockReturnValue([]),
    clearIndex: jest.fn(),
  };

  return { registry, validator, logger, spatialIndexManager };
};

const createMockSafeEventDispatcher = () => ({
  dispatch: jest.fn(),
});

describe('Smoke › New Character › Short-Term Memory bootstrap', () => {
  let mockEventDispatcher;

  test('EntityManager injects default short-term memory', () => {
    mockEventDispatcher = createMockSafeEventDispatcher()

    const { registry, validator, logger, spatialIndexManager } = makeStubs();

    // Arrange – instantiate EntityManager exactly as production would
    const em = new EntityManager(
      registry,
      validator,
      logger,
      mockEventDispatcher
    );

    // Act – create a new entity using the real method under test
    const character = em.createEntityInstance('test:alice');

    // Assert – entity exists and has the injected component
    expect(character).toBeDefined();
    expect(character.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)).toBe(true);

    const stm = character.getComponentData(SHORT_TERM_MEMORY_COMPONENT_ID);
    expect(stm).toEqual({ thoughts: [], maxEntries: 10 });
  });
});
