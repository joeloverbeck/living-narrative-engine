// tests/entities/entityManager.reconstructEntity.test.js
// --- FILE START ---
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EntityManager from '../../src/entities/entityManager.js';
import EntityDefinition from '../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../src/entities/entityInstanceData.js';
import { POSITION_COMPONENT_ID } from '../../src/constants/componentIds.js';
import { deepClone } from '../../src/utils';

const makeStubs = () => {
  const registry = {
    getEntityDefinition: jest.fn((definitionId) => {
      if (definitionId === 'core:item') {
        const defData = {
          description: 'A test item',
          components: {
            [POSITION_COMPONENT_ID]: { x: 0, y: 0, locationId: 'default' }, // Changed to locationId
            'core:tag': {}, // Default tag component
          },
        };
        return new EntityDefinition(definitionId, defData);
      }
      return undefined; // Or throw an error, depending on desired strictness
    }),
  };
  const validator = { validate: jest.fn(() => ({ isValid: true })) };
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  const spatial = {
    addEntity: jest.fn(),
    removeEntity: jest.fn(),
    updateEntityLocation: jest.fn(),
    getEntitiesInLocation: jest.fn(() => new Set()),
    buildIndex: jest.fn(),
    clearIndex: jest.fn(),
  };
  return { registry, validator, logger, spatial };
};

const createMockSafeEventDispatcher = () => ({
  dispatch: jest.fn(),
});

describe('EntityManager.reconstructEntity', () => {
  let stubs;
  let manager;
  let mockEventDispatcher;

  beforeEach(() => {
    stubs = makeStubs();
    mockEventDispatcher = createMockSafeEventDispatcher();
    manager = new EntityManager(
      stubs.registry,
      stubs.validator,
      stubs.logger,
      stubs.spatial,
      mockEventDispatcher
    );
  });

  it('reconstructs entity and indexes position', () => {
    const rawData = {
      instanceId: 'e1',
      definitionId: 'core:item',
      overrides: {
        [POSITION_COMPONENT_ID]: { x: 1, y: 2, locationId: 'loc1' }, // Changed to locationId
        'core:tag': { tag: 'a' },
      },
    };

    // This check confirms the mock registry is working as expected.
    const definition = stubs.registry.getEntityDefinition(rawData.definitionId);
    expect(definition).toBeInstanceOf(EntityDefinition);

    // FIXED: Pass the plain 'rawData' object to reconstructEntity, not an EntityInstanceData instance.
    const entity = manager.reconstructEntity(rawData);

    expect(entity).not.toBeNull();
    expect(manager.activeEntities.get('e1')).toBe(entity);
    expect(stubs.spatial.addEntity).toHaveBeenCalledWith('e1', 'loc1');
  });

  it('returns null on validation failure', () => {
    stubs.validator.validate.mockImplementation(
      (componentTypeId, dataToValidate) => {
        if (
          componentTypeId === 'core:tag' &&
          dataToValidate &&
          dataToValidate.tag === 'b'
        ) {
          return {
            isValid: false,
            errors: { detail: 'Specifically failed core:tag with tag b' },
          };
        }
        // For all other calls, assume validation passes and provide cloned data.
        return { isValid: true, validatedData: deepClone(dataToValidate) };
      }
    );

    const rawDataFail = {
      instanceId: 'e2',
      definitionId: 'core:item',
      overrides: { 'core:tag': { tag: 'b' } },
    };

    // This check confirms the mock registry is working as expected.
    const definitionFail = stubs.registry.getEntityDefinition(
      rawDataFail.definitionId
    );
    expect(definitionFail).toBeInstanceOf(EntityDefinition);

    // FIXED: Pass the plain 'rawDataFail' object. This allows the method to proceed
    // to the validation step, which is what this test is designed to check.
    // The method is expected to throw an error due to the mocked validation failure.
    expect(() => manager.reconstructEntity(rawDataFail)).toThrow();

    expect(manager.activeEntities.has('e2')).toBe(false);
    expect(stubs.spatial.addEntity).not.toHaveBeenCalled();
    expect(stubs.logger.error).toHaveBeenCalled();
  });
});
// --- FILE END ---