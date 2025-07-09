// tests/unit/scopeDsl/core/entityBuilder.test.js

import { jest } from '@jest/globals';
import EntityBuilder from '../../../../src/scopeDsl/core/entityBuilder.js';

// Mock the buildComponents function
jest.mock('../../../../src/scopeDsl/core/entityComponentUtils.js', () => ({
  buildComponents: jest.fn(),
}));

import { buildComponents } from '../../../../src/scopeDsl/core/entityComponentUtils.js';

describe('EntityBuilder', () => {
  let entityBuilder;
  let mockGateway;
  let mockTrace;
  let mockComponents;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock gateway
    mockGateway = {
      getEntityInstance: jest.fn(),
      getEntities: jest.fn(),
      getEntitiesWithComponent: jest.fn(),
      hasComponent: jest.fn(),
      getComponentData: jest.fn(),
    };

    // Create mock trace
    mockTrace = {
      addLog: jest.fn(),
    };

    // Create mock components
    mockComponents = {
      health: { value: 100 },
      inventory: { items: [] },
    };

    // Mock buildComponents
    buildComponents.mockReturnValue(mockComponents);

    // Create entity builder
    entityBuilder = new EntityBuilder(mockGateway, mockTrace);
  });

  describe('constructor', () => {
    it('should initialize with gateway and trace', () => {
      expect(entityBuilder.gateway).toBe(mockGateway);
      expect(entityBuilder.trace).toBe(mockTrace);
    });

    it('should initialize with gateway and default trace', () => {
      const builder = new EntityBuilder(mockGateway);
      expect(builder.gateway).toBe(mockGateway);
      expect(builder.trace).toBe(null);
    });
  });

  describe('createWithComponents', () => {
    it('should return null for null entity', () => {
      const result = entityBuilder.createWithComponents(null);
      expect(result).toBe(null);
    });

    it('should return null for undefined entity', () => {
      const result = entityBuilder.createWithComponents(undefined);
      expect(result).toBe(null);
    });

    it('should return entity as-is if components already exist', () => {
      const entity = {
        id: 'entity1',
        componentTypeIds: ['health', 'inventory'],
        components: { health: { value: 50 } },
      };

      const result = entityBuilder.createWithComponents(entity);
      expect(result).toBe(entity);
      expect(buildComponents).not.toHaveBeenCalled();
    });

    it('should return entity as-is if no componentTypeIds', () => {
      const entity = {
        id: 'entity1',
        name: 'Test Entity',
      };

      const result = entityBuilder.createWithComponents(entity);
      expect(result).toBe(entity);
      expect(buildComponents).not.toHaveBeenCalled();
    });

    it('should return entity as-is if componentTypeIds is not an array', () => {
      const entity = {
        id: 'entity1',
        componentTypeIds: 'not-an-array',
      };

      const result = entityBuilder.createWithComponents(entity);
      expect(result).toBe(entity);
      expect(buildComponents).not.toHaveBeenCalled();
    });

    it('should create enhanced entity with components for plain object', () => {
      const entity = {
        id: 'entity1',
        name: 'Test Entity',
        componentTypeIds: ['health', 'inventory'],
      };

      const result = entityBuilder.createWithComponents(entity);

      expect(buildComponents).toHaveBeenCalledWith(
        'entity1',
        entity,
        mockGateway
      );
      expect(result).toEqual({
        id: 'entity1',
        name: 'Test Entity',
        componentTypeIds: ['health', 'inventory'],
        components: mockComponents,
      });
      expect(result).not.toBe(entity); // Should be a new object
    });

    it('should create enhanced entity with components for Entity class instance', () => {
      // Create a mock Entity class instance
      class Entity {
        constructor(id, name) {
          this.id = id;
          this.name = name;
        }

        getName() {
          return this.name;
        }
      }

      const entity = new Entity('entity1', 'Test Entity');
      entity.componentTypeIds = ['health', 'inventory'];

      const result = entityBuilder.createWithComponents(entity);

      expect(buildComponents).toHaveBeenCalledWith(
        'entity1',
        entity,
        mockGateway
      );

      // Should preserve prototype chain
      expect(result).toBeInstanceOf(Entity);
      expect(result.getName()).toBe('Test Entity');
      expect(result.components).toBe(mockComponents);
      expect(result).not.toBe(entity); // Should be a new object
    });
  });

  describe('_createEnhancedEntity', () => {
    it('should create enhanced plain object', () => {
      const entity = { id: 'entity1', name: 'Test' };
      const components = { health: { value: 100 } };

      const result = entityBuilder._createEnhancedEntity(entity, components);

      expect(result).toEqual({
        id: 'entity1',
        name: 'Test',
        components: { health: { value: 100 } },
      });
      expect(result).not.toBe(entity);
    });

    it('should create enhanced Entity class instance', () => {
      class Entity {
        constructor(id, name) {
          this.id = id;
          this.name = name;
        }

        getName() {
          return this.name;
        }
      }

      const entity = new Entity('entity1', 'Test');
      const components = { health: { value: 100 } };

      const result = entityBuilder._createEnhancedEntity(entity, components);

      expect(result).toBeInstanceOf(Entity);
      expect(result.getName()).toBe('Test');
      expect(result.components).toBe(components);
      expect(result).not.toBe(entity);

      // Components should be immutable
      const descriptor = Object.getOwnPropertyDescriptor(result, 'components');
      expect(descriptor.writable).toBe(false);
      expect(descriptor.enumerable).toBe(true);
      expect(descriptor.configurable).toBe(false);
    });
  });

  describe('_isPlainObject', () => {
    it('should return false for null', () => {
      expect(entityBuilder._isPlainObject(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(entityBuilder._isPlainObject(undefined)).toBe(false);
    });

    it('should return false for non-object', () => {
      expect(entityBuilder._isPlainObject('string')).toBe(false);
      expect(entityBuilder._isPlainObject(123)).toBe(false);
      expect(entityBuilder._isPlainObject(true)).toBe(false);
    });

    it('should return true for plain object', () => {
      expect(entityBuilder._isPlainObject({})).toBe(true);
      expect(entityBuilder._isPlainObject({ id: 'test' })).toBe(true);
      expect(entityBuilder._isPlainObject(Object.create(null))).toBe(true);
    });

    it('should return false for class instance', () => {
      class TestClass {}
      const instance = new TestClass();
      expect(entityBuilder._isPlainObject(instance)).toBe(false);
    });

    it('should return false for array', () => {
      expect(entityBuilder._isPlainObject([])).toBe(false);
      expect(entityBuilder._isPlainObject([1, 2, 3])).toBe(false);
    });
  });

  describe('createEntityForEvaluation', () => {
    it('should create entity from string ID', () => {
      const mockEntity = {
        id: 'entity1',
        name: 'Test Entity',
        componentTypeIds: ['health'],
      };

      mockGateway.getEntityInstance.mockReturnValue(mockEntity);

      const result = entityBuilder.createEntityForEvaluation('entity1');

      expect(mockGateway.getEntityInstance).toHaveBeenCalledWith('entity1');
      expect(result).toEqual({
        id: 'entity1',
        name: 'Test Entity',
        componentTypeIds: ['health'],
        components: mockComponents,
      });
    });

    it('should create entity from string ID when gateway returns null', () => {
      mockGateway.getEntityInstance.mockReturnValue(null);

      const result = entityBuilder.createEntityForEvaluation('entity1');

      expect(mockGateway.getEntityInstance).toHaveBeenCalledWith('entity1');
      expect(result).toEqual({ id: 'entity1' });
    });

    it('should create entity from object', () => {
      const entityObj = {
        id: 'entity1',
        name: 'Test Entity',
        componentTypeIds: ['health'],
      };

      const result = entityBuilder.createEntityForEvaluation(entityObj);

      expect(result).toEqual({
        id: 'entity1',
        name: 'Test Entity',
        componentTypeIds: ['health'],
        components: mockComponents,
      });
    });

    it('should return null for invalid item', () => {
      expect(entityBuilder.createEntityForEvaluation(null)).toBe(null);
      expect(entityBuilder.createEntityForEvaluation(undefined)).toBe(null);
      expect(entityBuilder.createEntityForEvaluation(123)).toBe(null);
      expect(entityBuilder.createEntityForEvaluation(true)).toBe(null);
    });
  });

  describe('createActorForEvaluation', () => {
    it('should create actor with components', () => {
      const actorEntity = {
        id: 'actor1',
        name: 'Test Actor',
        componentTypeIds: ['health'],
      };

      const result = entityBuilder.createActorForEvaluation(actorEntity);

      expect(result).toEqual({
        id: 'actor1',
        name: 'Test Actor',
        componentTypeIds: ['health'],
        components: mockComponents,
      });
    });

    it('should throw error for null actor', () => {
      expect(() => {
        entityBuilder.createActorForEvaluation(null);
      }).toThrow(
        'createActorForEvaluation: actorEntity cannot be null or undefined'
      );
    });

    it('should throw error for undefined actor', () => {
      expect(() => {
        entityBuilder.createActorForEvaluation(undefined);
      }).toThrow(
        'createActorForEvaluation: actorEntity cannot be null or undefined'
      );
    });

    it('should throw error for actor without ID', () => {
      const actorEntity = { name: 'Test Actor' };

      expect(() => {
        entityBuilder.createActorForEvaluation(actorEntity);
      }).toThrow(
        'createActorForEvaluation: actorEntity must have a valid string ID'
      );
    });

    it('should throw error for actor with invalid ID', () => {
      const actorEntity = { id: 123, name: 'Test Actor' };

      expect(() => {
        entityBuilder.createActorForEvaluation(actorEntity);
      }).toThrow(
        'createActorForEvaluation: actorEntity must have a valid string ID'
      );
    });

    it('should throw error for actor with empty string ID', () => {
      const actorEntity = { id: '', name: 'Test Actor' };

      expect(() => {
        entityBuilder.createActorForEvaluation(actorEntity);
      }).toThrow(
        'createActorForEvaluation: actorEntity must have a valid string ID'
      );
    });
  });

  describe('withGateway', () => {
    it('should create new EntityBuilder with gateway', () => {
      const newBuilder = EntityBuilder.withGateway(mockGateway);

      expect(newBuilder).toBeInstanceOf(EntityBuilder);
      expect(newBuilder.gateway).toBe(mockGateway);
      expect(newBuilder.trace).toBe(null);
    });

    it('should create new EntityBuilder with gateway and trace', () => {
      const newBuilder = EntityBuilder.withGateway(mockGateway, mockTrace);

      expect(newBuilder).toBeInstanceOf(EntityBuilder);
      expect(newBuilder.gateway).toBe(mockGateway);
      expect(newBuilder.trace).toBe(mockTrace);
    });
  });

  describe('integration with buildComponents', () => {
    it('should pass correct parameters to buildComponents', () => {
      const entity = {
        id: 'entity1',
        name: 'Test Entity',
        componentTypeIds: ['health', 'inventory'],
      };

      entityBuilder.createWithComponents(entity);

      expect(buildComponents).toHaveBeenCalledWith(
        'entity1',
        entity,
        mockGateway
      );
    });

    it('should handle buildComponents returning null', () => {
      buildComponents.mockReturnValue(null);

      const entity = {
        id: 'entity1',
        componentTypeIds: ['health'],
      };

      const result = entityBuilder.createWithComponents(entity);

      expect(result).toEqual({
        id: 'entity1',
        componentTypeIds: ['health'],
        components: null,
      });
    });

    it('should handle buildComponents returning empty object', () => {
      buildComponents.mockReturnValue({});

      const entity = {
        id: 'entity1',
        componentTypeIds: ['health'],
      };

      const result = entityBuilder.createWithComponents(entity);

      expect(result).toEqual({
        id: 'entity1',
        componentTypeIds: ['health'],
        components: {},
      });
    });
  });

  describe('immutability', () => {
    it('should not mutate original entity', () => {
      const originalEntity = {
        id: 'entity1',
        name: 'Test Entity',
        componentTypeIds: ['health'],
      };

      const originalCopy = { ...originalEntity };
      const result = entityBuilder.createWithComponents(originalEntity);

      expect(originalEntity).toEqual(originalCopy);
      expect(result).not.toBe(originalEntity);
    });

    it('should create immutable components property for Entity instances', () => {
      // Create a mock Entity class instance
      class Entity {
        constructor(id, name) {
          this.id = id;
          this.name = name;
        }
      }

      const entity = new Entity('entity1', 'Test Entity');
      entity.componentTypeIds = ['health'];

      const result = entityBuilder.createWithComponents(entity);

      // Check that components property is non-writable for Entity instances
      const descriptor = Object.getOwnPropertyDescriptor(result, 'components');
      expect(descriptor.writable).toBe(false);
      expect(descriptor.configurable).toBe(false);
      expect(descriptor.enumerable).toBe(true);

      // Assignment should throw an error because the property is read-only
      expect(() => {
        result.components = { different: 'value' };
      }).toThrow('Cannot assign to read only property');
    });

    it('should create mutable components property for plain objects', () => {
      const entity = {
        id: 'entity1',
        componentTypeIds: ['health'],
      };

      const result = entityBuilder.createWithComponents(entity);

      // Check that components property is writable for plain objects (by design)
      const descriptor = Object.getOwnPropertyDescriptor(result, 'components');
      expect(descriptor.writable).toBe(true);
      expect(descriptor.configurable).toBe(true);
      expect(descriptor.enumerable).toBe(true);

      // Assignment should work for plain objects
      result.components = { different: 'value' };
      expect(result.components).toEqual({ different: 'value' });
    });
  });

  describe('error handling', () => {
    it('should propagate errors from buildComponents', () => {
      const error = new Error('Component build failed');
      buildComponents.mockImplementation(() => {
        throw error;
      });

      const entity = {
        id: 'entity1',
        componentTypeIds: ['health'],
      };

      expect(() => {
        entityBuilder.createWithComponents(entity);
      }).toThrow(error);
    });

    it('should handle gateway errors gracefully', () => {
      const error = new Error('Gateway error');
      mockGateway.getEntityInstance.mockImplementation(() => {
        throw error;
      });

      expect(() => {
        entityBuilder.createEntityForEvaluation('entity1');
      }).toThrow(error);
    });
  });
});
