import EntityManager from '../../src/entities/entityManager.js';
import EntityDefinition from '../../src/entities/entityDefinition.js';
import {
  ACTOR_COMPONENT_ID,
  NOTES_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
} from '../../src/constants/componentIds.js';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';

/**
 * Create minimal stubs for EntityManager dependencies.
 *
 * @param validator
 */
const makeStubs = (validator) => {
  const registry = {
    getEntityDefinition: jest.fn().mockReturnValue({
      components: {
        [ACTOR_COMPONENT_ID]: {},
      },
    }),
    getEntityDefinition: jest.fn().mockImplementation((definitionId) => {
      if (definitionId === 'test:actor') {
        const definitionData = {
          components: {
            [ACTOR_COMPONENT_ID]: {},
          },
        };
        return new EntityDefinition(definitionId, definitionData);
      }
      return null; // Or throw an error, depending on desired mock behavior for other IDs
    }),
  };

  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const spatialIndexManager = {
    addEntity: jest.fn(),
    removeEntity: jest.fn(),
    updateEntityLocation: jest.fn(),
    getEntitiesInLocation: jest.fn(() => new Set()),
    clearIndex: jest.fn(),
  };

  return {
    registry,
    validator,
    logger,
    spatialIndexManager,
  };
};

const createMockSafeEventDispatcher = () => ({
  dispatch: jest.fn(),
});


describe('EntityManager default component injection uses validated data', () => {
  let validator;
  let manager;
  let mockEventDispatcher;

  beforeEach(() => {
    validator = {
      validate: jest.fn((type, data) => {
        if (type === SHORT_TERM_MEMORY_COMPONENT_ID) {
          data.thoughts.push('validated');
        }
        if (type === NOTES_COMPONENT_ID) {
          data.notes.push({ text: 'note', timestamp: '2025-01-01T00:00:00Z' });
        }
        if (type === 'core:goals') {
          data.goals.push({ text: 'goal', timestamp: '2025-01-01T00:00:00Z' });
        }
        return { isValid: true };
      }),
    };

    const stubs = makeStubs(validator);

    mockEventDispatcher = createMockSafeEventDispatcher();

    manager = new EntityManager(
      stubs.registry,
      stubs.validator,
      stubs.logger,
      mockEventDispatcher
    );
  });

  test('injected components store mutated validator output', () => {
    const entity = manager.createEntityInstance('test:actor');
    expect(entity).not.toBeNull();

    const stm = entity.getComponentData(SHORT_TERM_MEMORY_COMPONENT_ID);
    const notes = entity.getComponentData(NOTES_COMPONENT_ID);
    const goals = entity.getComponentData('core:goals');

    expect(stm.thoughts).toContain('validated');
    expect(notes.notes).toEqual([
      { text: 'note', timestamp: '2025-01-01T00:00:00Z' },
    ]);
    expect(goals.goals).toEqual([
      { text: 'goal', timestamp: '2025-01-01T00:00:00Z' },
    ]);
  });
});
