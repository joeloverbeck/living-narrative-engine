import { describe, test, expect, jest } from '@jest/globals';
import { createComponentAccessor } from '../../../src/logic/componentAccessor.js';

/** @typedef {import('../../../src/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../../src/entities/entityManager.js').default} EntityManager */

describe('createComponentAccessor', () => {
  /** @type {jest.Mocked<EntityManager>} */
  const mockManager = {
    getComponentData: jest.fn(),
    hasComponent: jest.fn(),
    getEntityInstance: jest.fn(),
    createEntityInstance: jest.fn(),
    addComponent: jest.fn(),
    removeComponent: jest.fn(),
    removeEntityInstance: jest.fn(),
    getEntitiesInLocation: jest.fn(),
    buildInitialSpatialIndex: jest.fn(),
    clearAll: jest.fn(),
    getAllComponentTypesForEntity: jest.fn(),
    activeEntities: new Map(),
  };

  /** @type {jest.Mocked<ILogger>} */
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };

  const ENTITY_ID = 'e1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns component data via property access', () => {
    const componentData = { hp: 5 };
    mockManager.getComponentData.mockReturnValue(componentData);
    const accessor = createComponentAccessor(
      ENTITY_ID,
      mockManager,
      mockLogger
    );

    expect(accessor.health).toBe(componentData);
    expect(mockManager.getComponentData).toHaveBeenCalledWith(
      ENTITY_ID,
      'health'
    );
  });

  test('returns null for missing component', () => {
    mockManager.getComponentData.mockReturnValue(undefined);
    const accessor = createComponentAccessor(
      ENTITY_ID,
      mockManager,
      mockLogger
    );

    expect(accessor.missing).toBeNull();
  });

  test('ignores attempted writes', () => {
    const componentData = { hp: 10 };
    mockManager.getComponentData.mockReturnValue(componentData);
    const accessor = createComponentAccessor(
      ENTITY_ID,
      mockManager,
      mockLogger
    );

    accessor.health = { hp: 1 };

    expect(accessor.health).toBe(componentData);
    expect(mockManager.getComponentData).toHaveBeenLastCalledWith(
      ENTITY_ID,
      'health'
    );
  });

  test('`in` operator checks component existence', () => {
    mockManager.hasComponent.mockReturnValue(true);
    const accessor = createComponentAccessor(
      ENTITY_ID,
      mockManager,
      mockLogger
    );

    expect('health' in accessor).toBe(true);
    expect(mockManager.hasComponent).toHaveBeenCalledWith(ENTITY_ID, 'health');
  });

  test('wraps error when getComponentData throws', () => {
    const err = new Error('bad');
    mockManager.getComponentData.mockImplementation(() => {
      throw err;
    });
    const accessor = createComponentAccessor(
      ENTITY_ID,
      mockManager,
      mockLogger
    );

    const result = accessor.health;
    expect(result).toEqual({ error: expect.any(Object) });
    expect(result.error.originalError).toBe(err);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
  });

  describe('JSON serialization', () => {
    test('serializes all components via toJSON', () => {
      const componentTypes = ['core:name', 'core:position', 'core:health'];
      const componentData = {
        'core:name': { text: 'Test Entity' },
        'core:position': { x: 10, y: 20 },
        'core:health': { current: 100, max: 100 },
      };

      mockManager.getAllComponentTypesForEntity.mockReturnValue(componentTypes);
      mockManager.getComponentData.mockImplementation((id, type) => {
        return componentData[type];
      });

      const accessor = createComponentAccessor(ENTITY_ID, mockManager, mockLogger);
      const serialized = JSON.stringify(accessor);
      const parsed = JSON.parse(serialized);

      expect(parsed).toEqual(componentData);
      expect(mockManager.getAllComponentTypesForEntity).toHaveBeenCalledWith(ENTITY_ID);
      expect(mockManager.getComponentData).toHaveBeenCalledTimes(3);
    });

    test('skips undefined or null components during serialization', () => {
      const componentTypes = ['core:name', 'core:position', 'core:health'];
      
      mockManager.getAllComponentTypesForEntity.mockReturnValue(componentTypes);
      mockManager.getComponentData.mockImplementation((id, type) => {
        if (type === 'core:name') return { text: 'Test Entity' };
        if (type === 'core:position') return undefined;
        if (type === 'core:health') return null;
      });

      const accessor = createComponentAccessor(ENTITY_ID, mockManager, mockLogger);
      const serialized = JSON.stringify(accessor);
      const parsed = JSON.parse(serialized);

      expect(parsed).toEqual({ 'core:name': { text: 'Test Entity' } });
    });

    test('returns empty object when getAllComponentTypesForEntity throws', () => {
      mockManager.getAllComponentTypesForEntity.mockImplementation(() => {
        throw new Error('Entity not found');
      });

      const accessor = createComponentAccessor(ENTITY_ID, mockManager, mockLogger);
      const serialized = JSON.stringify(accessor);
      const parsed = JSON.parse(serialized);

      expect(parsed).toEqual({});
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    test('skips components that error during retrieval', () => {
      const componentTypes = ['core:name', 'core:error', 'core:health'];
      
      mockManager.getAllComponentTypesForEntity.mockReturnValue(componentTypes);
      mockManager.getComponentData.mockImplementation((id, type) => {
        if (type === 'core:name') return { text: 'Test Entity' };
        if (type === 'core:error') throw new Error('Component error');
        if (type === 'core:health') return { current: 100, max: 100 };
      });

      const accessor = createComponentAccessor(ENTITY_ID, mockManager, mockLogger);
      const serialized = JSON.stringify(accessor);
      const parsed = JSON.parse(serialized);

      expect(parsed).toEqual({
        'core:name': { text: 'Test Entity' },
        'core:health': { current: 100, max: 100 },
      });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Skipping component [core:error] during JSON serialization')
      );
    });

    test('handles entity with no components', () => {
      mockManager.getAllComponentTypesForEntity.mockReturnValue([]);
      mockManager.getComponentData.mockReturnValue(undefined);
      mockManager.hasComponent.mockReturnValue(false);

      const accessor = createComponentAccessor(ENTITY_ID, mockManager, mockLogger);
      
      expect(accessor['core:anything']).toBeNull();
      expect('core:anything' in accessor).toBe(false);
      expect(JSON.stringify(accessor)).toBe('{}');
    });
  });
});
