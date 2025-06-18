import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EntityManager from '../../src/entities/entityManager.js';
import { POSITION_COMPONENT_ID } from '../../src/constants/componentIds.js';
import { deepClone } from '../../src/utils/objectUtils.js';

const makeStubs = () => {
  const registry = {
    getEntityDefinition: jest.fn((definitionId) => {
      if (definitionId === 'core:item') {
        return {
          id: 'core:item',
          description: 'A test item',
          components: {
            [POSITION_COMPONENT_ID]: { x: 0, y: 0, locationId: 'default' }, // Changed to locationId
            'core:tag': {}, // Default tag component
          },
        };
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

describe('EntityManager.reconstructEntity', () => {
  let stubs;
  let manager;

  beforeEach(() => {
    stubs = makeStubs();
    manager = new EntityManager(
      stubs.registry,
      stubs.validator,
      stubs.logger,
      stubs.spatial
    );
  });

  it('reconstructs entity and indexes position', () => {
    const data = {
      instanceId: 'e1',
      definitionId: 'core:item',
      overrides: {
        [POSITION_COMPONENT_ID]: { x: 1, y: 2, locationId: 'loc1' }, // Changed to locationId
        'core:tag': { tag: 'a' },
      },
    };

    const entity = manager.reconstructEntity(data);

    expect(entity).not.toBeNull();
    expect(manager.activeEntities.get('e1')).toBe(entity);
    expect(stubs.spatial.addEntity).toHaveBeenCalledWith('e1', 'loc1');
  });

  it('returns null on validation failure', () => {
    stubs.validator.validate.mockImplementation((componentTypeId, dataToValidate) => {
      if (componentTypeId === 'core:tag' && dataToValidate && dataToValidate.tag === 'b') {
        return { isValid: false, errors: { detail: 'Specifically failed core:tag with tag b' } };
      }
      // For all other calls, assume validation passes and provide cloned data.
      return { isValid: true, validatedData: deepClone(dataToValidate) }; 
    });

    const data = {
      instanceId: 'e2',
      definitionId: 'core:item',
      overrides: { 'core:tag': { tag: 'b' } },
    };

    const entity = manager.reconstructEntity(data);

    expect(entity).toBe(null);
    expect(manager.activeEntities.has('e2')).toBe(false);
    expect(stubs.spatial.addEntity).not.toHaveBeenCalled();
    expect(stubs.logger.error).toHaveBeenCalled();
  });
});
