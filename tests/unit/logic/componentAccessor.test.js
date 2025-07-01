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
});
