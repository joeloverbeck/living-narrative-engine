/**
 * @jest-environment node
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { BaseBodyPartOperator } from '../../../../../src/logic/operators/base/BaseBodyPartOperator.js';

// Mock the utility functions
jest.mock('../../../../../src/logic/utils/entityPathResolver.js');
jest.mock('../../../../../src/logic/utils/bodyComponentUtils.js');

import {
  resolveEntityPath,
  hasValidEntityId,
} from '../../../../../src/logic/utils/entityPathResolver.js';
import {
  getBodyComponent,
  extractRootId,
} from '../../../../../src/logic/utils/bodyComponentUtils.js';

// Create a concrete implementation for testing the abstract base class
class TestBodyPartOperator extends BaseBodyPartOperator {
  constructor(dependencies) {
    super(dependencies, 'testBodyPartOperator');
  }

  evaluateInternal(entityId, rootId, params, context, bodyComponent) {
    // Simple test implementation
    return params[0] === 'test-value';
  }
}

describe('BaseBodyPartOperator', () => {
  let operator;
  let mockDependencies;
  let mockContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockDependencies = {
      entityManager: {
        getComponentData: jest.fn(),
      },
      bodyGraphService: {
        buildAdjacencyCache: jest.fn(),
        findPartsByType: jest.fn(),
      },
      logger: {
        debug: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };

    operator = new TestBodyPartOperator(mockDependencies);
    mockContext = {};

    // Reset mocked functions
    resolveEntityPath.mockClear();
    hasValidEntityId.mockClear();
    getBodyComponent.mockClear();
    extractRootId.mockClear();

    hasValidEntityId.mockImplementation((entity) =>
      entity !== undefined &&
      entity !== null &&
      entity.id !== undefined &&
      entity.id !== null
    );
  });

  describe('constructor', () => {
    test('should initialize successfully with valid dependencies', () => {
      expect(operator).toBeDefined();
      expect(operator.operatorName).toBe('testBodyPartOperator');
      expect(operator.entityManager).toBe(mockDependencies.entityManager);
      expect(operator.bodyGraphService).toBe(mockDependencies.bodyGraphService);
      expect(operator.logger).toBe(mockDependencies.logger);
    });

    test('should throw error when entityManager is missing', () => {
      expect(() => {
        new TestBodyPartOperator({
          bodyGraphService: mockDependencies.bodyGraphService,
          logger: mockDependencies.logger,
        });
      }).toThrow('BaseBodyPartOperator: Missing required dependencies');
    });

    test('should throw error when bodyGraphService is missing', () => {
      expect(() => {
        new TestBodyPartOperator({
          entityManager: mockDependencies.entityManager,
          logger: mockDependencies.logger,
        });
      }).toThrow('BaseBodyPartOperator: Missing required dependencies');
    });

    test('should throw error when logger is missing', () => {
      expect(() => {
        new TestBodyPartOperator({
          entityManager: mockDependencies.entityManager,
          bodyGraphService: mockDependencies.bodyGraphService,
        });
      }).toThrow('BaseBodyPartOperator: Missing required dependencies');
    });

    test('should throw error when all dependencies are missing', () => {
      expect(() => {
        new TestBodyPartOperator({});
      }).toThrow('BaseBodyPartOperator: Missing required dependencies');
    });
  });

  describe('evaluate', () => {
    test('should evaluate successfully with valid entity and body component', () => {
      const mockEntity = { id: 'actor123' };
      const mockBodyComponent = { root: 'root123' };

      resolveEntityPath.mockReturnValue({
        entity: mockEntity,
        isValid: true,
      });
      getBodyComponent.mockReturnValue(mockBodyComponent);
      extractRootId.mockReturnValue('root123');

      const result = operator.evaluate(['actor', 'test-value'], mockContext);

      expect(resolveEntityPath).toHaveBeenCalledWith(mockContext, 'actor');
      expect(getBodyComponent).toHaveBeenCalledWith(
        mockDependencies.entityManager,
        'actor123'
      );
      expect(extractRootId).toHaveBeenCalledWith(mockBodyComponent);
      expect(mockContext._currentPath).toBe('actor');
      expect(result).toBe(true);
    });

    test('should evaluate successfully when entity ID is zero', () => {
      const mockEntity = { id: 0 };
      const mockBodyComponent = { root: 'rootZero' };

      resolveEntityPath.mockReturnValue({
        entity: mockEntity,
        isValid: true,
      });
      getBodyComponent.mockReturnValue(mockBodyComponent);
      extractRootId.mockReturnValue('rootZero');

      const result = operator.evaluate(['actor', 'test-value'], mockContext);

      expect(getBodyComponent).toHaveBeenCalledWith(
        mockDependencies.entityManager,
        0
      );
      expect(result).toBe(true);
    });

    test('should evaluate successfully with direct entity ID', () => {
      const mockBodyComponent = { root: 'root456' };

      resolveEntityPath.mockReturnValue({
        entity: 'direct123',
        isValid: true,
      });
      getBodyComponent.mockReturnValue(mockBodyComponent);
      extractRootId.mockReturnValue('root456');

      const result = operator.evaluate(['.', 'test-value'], mockContext);

      expect(getBodyComponent).toHaveBeenCalledWith(
        mockDependencies.entityManager,
        'direct123'
      );
      expect(result).toBe(true);
    });

    test('should evaluate successfully with dot path', () => {
      const mockEntity = { id: 'entity789' };
      const mockBodyComponent = { root: 'root789' };

      resolveEntityPath.mockReturnValue({
        entity: mockEntity,
        isValid: true,
      });
      getBodyComponent.mockReturnValue(mockBodyComponent);
      extractRootId.mockReturnValue('root789');

      const result = operator.evaluate(['.', 'test-value'], mockContext);

      expect(resolveEntityPath).toHaveBeenCalledWith(mockContext, '.');
      expect(result).toBe(true);
    });

    test('should return false with invalid parameters - null', () => {
      const result = operator.evaluate(null, mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testBodyPartOperator: Invalid parameters'
      );
    });

    test('should return false with invalid parameters - empty array', () => {
      const result = operator.evaluate([], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testBodyPartOperator: Invalid parameters'
      );
    });

    test('should return false with invalid parameters - single parameter', () => {
      const result = operator.evaluate(['actor'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testBodyPartOperator: Invalid parameters'
      );
    });

    test('should return false with invalid parameters - not array', () => {
      const result = operator.evaluate('not-array', mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testBodyPartOperator: Invalid parameters'
      );
    });

    test('should return false when entity path resolution fails', () => {
      resolveEntityPath.mockReturnValue({
        entity: null,
        isValid: false,
      });

      const result = operator.evaluate(
        ['nonexistent', 'test-value'],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testBodyPartOperator: No entity found at path nonexistent'
      );
      expect(mockContext._currentPath).toBe('nonexistent');
    });

    test('should return false when resolved entity is null', () => {
      resolveEntityPath.mockReturnValue({
        entity: null,
        isValid: false,
      });

      const result = operator.evaluate(['actor', 'test-value'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testBodyPartOperator: No entity found at path actor'
      );
    });

    test('should return false when entity has no ID and is falsy', () => {
      resolveEntityPath.mockReturnValue({
        entity: '', // Empty string is falsy
        isValid: true,
      });

      const result = operator.evaluate(['actor', 'test-value'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testBodyPartOperator: Invalid entity at path actor'
      );
    });

    test('should handle entity with undefined ID by using entity as ID', () => {
      const entityObject = { id: undefined, someProperty: 'value' };
      resolveEntityPath.mockReturnValue({
        entity: entityObject,
        isValid: true,
      });
      getBodyComponent.mockReturnValue({ root: 'root123' });
      extractRootId.mockReturnValue('root123');

      const result = operator.evaluate(['actor', 'test-value'], mockContext);

      // Should use the entity object itself as the ID
      expect(getBodyComponent).toHaveBeenCalledWith(
        mockDependencies.entityManager,
        entityObject
      );
      expect(result).toBe(true);
    });

    test('should handle entity with null ID by using entity as ID', () => {
      const entityObject = { id: null, someProperty: 'value' };
      resolveEntityPath.mockReturnValue({
        entity: entityObject,
        isValid: true,
      });
      getBodyComponent.mockReturnValue({ root: 'root123' });
      extractRootId.mockReturnValue('root123');

      const result = operator.evaluate(['actor', 'test-value'], mockContext);

      // Should use the entity object itself as the ID
      expect(getBodyComponent).toHaveBeenCalledWith(
        mockDependencies.entityManager,
        entityObject
      );
      expect(result).toBe(true);
    });

    test('should return false when entity is NaN after ID extraction', () => {
      resolveEntityPath.mockReturnValue({
        entity: Number.NaN,
        isValid: true,
      });

      const result = operator.evaluate(['actor', 'test-value'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testBodyPartOperator: Invalid entity at path actor'
      );
      expect(getBodyComponent).not.toHaveBeenCalled();
    });

    test('should return false when entity is false', () => {
      resolveEntityPath.mockReturnValue({
        entity: false, // Falsy entity
        isValid: true,
      });

      const result = operator.evaluate(['actor', 'test-value'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.warn).toHaveBeenCalledWith(
        'testBodyPartOperator: Invalid entity at path actor'
      );
    });

    test('should return false when entity has no body component', () => {
      resolveEntityPath.mockReturnValue({
        entity: { id: 'actor123' },
        isValid: true,
      });
      getBodyComponent.mockReturnValue(null);

      const result = operator.evaluate(['actor', 'test-value'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'testBodyPartOperator: Entity actor123 has no anatomy:body component'
      );
    });

    test('should return false when body component has no root', () => {
      const mockBodyComponent = { otherProp: 'value' };

      resolveEntityPath.mockReturnValue({
        entity: { id: 'actor123' },
        isValid: true,
      });
      getBodyComponent.mockReturnValue(mockBodyComponent);
      extractRootId.mockReturnValue(null);

      const result = operator.evaluate(['actor', 'test-value'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'testBodyPartOperator: Entity actor123 has no root in anatomy:body component'
      );
    });

    test('should return false when root ID is undefined', () => {
      const mockBodyComponent = { root: undefined };

      resolveEntityPath.mockReturnValue({
        entity: { id: 'actor123' },
        isValid: true,
      });
      getBodyComponent.mockReturnValue(mockBodyComponent);
      extractRootId.mockReturnValue(undefined);

      const result = operator.evaluate(['actor', 'test-value'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.debug).toHaveBeenCalledWith(
        'testBodyPartOperator: Entity actor123 has no root in anatomy:body component'
      );
    });

    test('should handle errors gracefully', () => {
      const errorOperator = new (class extends BaseBodyPartOperator {
        constructor(deps) {
          super(deps, 'errorOperator');
        }
        evaluateInternal() {
          throw new Error('Test error');
        }
      })(mockDependencies);

      resolveEntityPath.mockReturnValue({
        entity: { id: 'actor123' },
        isValid: true,
      });
      getBodyComponent.mockReturnValue({ root: 'root123' });
      extractRootId.mockReturnValue('root123');

      const result = errorOperator.evaluate(
        ['actor', 'test-value'],
        mockContext
      );

      expect(result).toBe(false);
      expect(mockDependencies.logger.error).toHaveBeenCalledWith(
        'errorOperator: Error during evaluation',
        expect.any(Error)
      );
    });

    test('should handle error in resolveEntityPath', () => {
      resolveEntityPath.mockImplementation(() => {
        throw new Error('Path resolution error');
      });

      const result = operator.evaluate(['actor', 'test-value'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.error).toHaveBeenCalledWith(
        'testBodyPartOperator: Error during evaluation',
        expect.any(Error)
      );
    });

    test('should handle error in getBodyComponent', () => {
      resolveEntityPath.mockReturnValue({
        entity: { id: 'actor123' },
        isValid: true,
      });
      getBodyComponent.mockImplementation(() => {
        throw new Error('Body component error');
      });

      const result = operator.evaluate(['actor', 'test-value'], mockContext);

      expect(result).toBe(false);
      expect(mockDependencies.logger.error).toHaveBeenCalledWith(
        'testBodyPartOperator: Error during evaluation',
        expect.any(Error)
      );
    });

    test('should pass correct parameters to evaluateInternal', () => {
      const mockEntity = { id: 'actor123' };
      const mockBodyComponent = { root: 'root123' };
      const testOperator = jest.fn().mockReturnValue(true);

      // Create operator with spy on evaluateInternal
      const spyOperator = new TestBodyPartOperator(mockDependencies);
      spyOperator.evaluateInternal = testOperator;

      resolveEntityPath.mockReturnValue({
        entity: mockEntity,
        isValid: true,
      });
      getBodyComponent.mockReturnValue(mockBodyComponent);
      extractRootId.mockReturnValue('root123');

      const result = spyOperator.evaluate(
        ['actor', 'param1', 'param2'],
        mockContext
      );

      expect(testOperator).toHaveBeenCalledWith(
        'actor123',
        'root123',
        ['param1', 'param2'],
        mockContext,
        mockBodyComponent
      );
      expect(result).toBe(true);
    });
  });

  describe('evaluateInternal - abstract method', () => {
    test('should throw error when not implemented', () => {
      const abstractOperator = new BaseBodyPartOperator(
        mockDependencies,
        'abstract'
      );

      expect(() => {
        abstractOperator.evaluateInternal('entity123', 'root123', [], {}, {});
      }).toThrow('evaluateInternal must be implemented by subclass');
    });
  });
});
