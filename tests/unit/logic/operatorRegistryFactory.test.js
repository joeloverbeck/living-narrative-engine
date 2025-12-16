// tests/unit/logic/operatorRegistryFactory.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { OperatorRegistryFactory } from '../../../src/logic/operatorRegistryFactory.js';

describe('OperatorRegistryFactory', () => {
  let mockEntityManager;
  let mockLogger;
  let mockBodyGraphService;
  let mockLightingStateService;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
      findPartsByType: jest.fn(),
      getAllParts: jest.fn(),
      buildAdjacencyCache: jest.fn(),
    };

    mockLightingStateService = {
      isLocationLit: jest.fn(),
    };
  });

  describe('constructor', () => {
    it('should throw error when entityManager is missing', () => {
      expect(() => {
        new OperatorRegistryFactory({
          logger: mockLogger,
        });
      }).toThrow('OperatorRegistryFactory requires entityManager');
    });

    it('should throw error when logger is missing', () => {
      expect(() => {
        new OperatorRegistryFactory({
          entityManager: mockEntityManager,
        });
      }).toThrow('OperatorRegistryFactory requires logger');
    });

    it('should create instance with required dependencies', () => {
      const factory = new OperatorRegistryFactory({
        entityManager: mockEntityManager,
        logger: mockLogger,
      });
      expect(factory).toBeInstanceOf(OperatorRegistryFactory);
    });

    it('should create instance with all dependencies', () => {
      const factory = new OperatorRegistryFactory({
        entityManager: mockEntityManager,
        logger: mockLogger,
        bodyGraphService: mockBodyGraphService,
        lightingStateService: mockLightingStateService,
      });
      expect(factory).toBeInstanceOf(OperatorRegistryFactory);
    });
  });

  describe('createOperators', () => {
    let factory;

    beforeEach(() => {
      factory = new OperatorRegistryFactory({
        entityManager: mockEntityManager,
        logger: mockLogger,
        bodyGraphService: mockBodyGraphService,
        lightingStateService: mockLightingStateService,
      });
    });

    it('should return an object with operators Map', () => {
      const result = factory.createOperators();
      expect(result).toHaveProperty('operators');
      expect(result.operators).toBeInstanceOf(Map);
    });

    it('should create exactly 27 operators', () => {
      const { operators } = factory.createOperators();
      expect(operators.size).toBe(27);
    });

    it('should return isSocketCoveredOp for external access', () => {
      const { isSocketCoveredOp } = factory.createOperators();
      expect(isSocketCoveredOp).toBeDefined();
      expect(typeof isSocketCoveredOp.evaluate).toBe('function');
    });

    it('should return socketExposureOp for external access', () => {
      const { socketExposureOp } = factory.createOperators();
      expect(socketExposureOp).toBeDefined();
      expect(typeof socketExposureOp.evaluate).toBe('function');
    });

    it('should return operatorsWithCaches array', () => {
      const { operatorsWithCaches } = factory.createOperators();
      expect(Array.isArray(operatorsWithCaches)).toBe(true);
      expect(operatorsWithCaches.length).toBeGreaterThan(0);
    });

    it('should include isSocketCoveredOp in operatorsWithCaches', () => {
      const { isSocketCoveredOp, operatorsWithCaches } = factory.createOperators();
      expect(operatorsWithCaches).toContain(isSocketCoveredOp);
    });

    describe('operator names', () => {
      it('should create all body part operators', () => {
        const { operators } = factory.createOperators();
        const bodyOperators = [
          'hasPartWithComponentValue',
          'hasPartOfType',
          'hasPartOfTypeWithComponentValue',
          'hasPartWithStatusEffect',
          'hasWoundedPart',
          'isBodyPartWounded',
          'hasPartSubTypeContaining',
        ];
        bodyOperators.forEach((name) => {
          expect(operators.has(name)).toBe(true);
        });
      });

      it('should create all equipment operators', () => {
        const { operators } = factory.createOperators();
        const equipmentOperators = [
          'isSlotExposed',
          'isSocketCovered',
          'socketExposure',
          'isRemovalBlocked',
        ];
        equipmentOperators.forEach((name) => {
          expect(operators.has(name)).toBe(true);
        });
      });

      it('should create accessibility operator', () => {
        const { operators } = factory.createOperators();
        expect(operators.has('isBodyPartAccessible')).toBe(true);
      });

      it('should create all furniture operators', () => {
        const { operators } = factory.createOperators();
        const furnitureOperators = [
          'hasSittingSpaceToRight',
          'canScootCloser',
          'isClosestLeftOccupant',
          'isClosestRightOccupant',
          'isNearbyFurniture',
          'hasOtherActorsAtLocation',
        ];
        furnitureOperators.forEach((name) => {
          expect(operators.has(name)).toBe(true);
        });
      });

      it('should create component operators', () => {
        const { operators } = factory.createOperators();
        expect(operators.has('has_component')).toBe(true);
        expect(operators.has('get_component_value')).toBe(true);
      });

      it('should create grabbing operators', () => {
        const { operators } = factory.createOperators();
        const grabbingOperators = [
          'hasFreeGrabbingAppendages',
          'canActorGrabItem',
          'isItemBeingGrabbed',
        ];
        grabbingOperators.forEach((name) => {
          expect(operators.has(name)).toBe(true);
        });
      });

      it('should create skill operator', () => {
        const { operators } = factory.createOperators();
        expect(operators.has('getSkillValue')).toBe(true);
      });

      it('should create damage operator', () => {
        const { operators } = factory.createOperators();
        expect(operators.has('has_damage_capability')).toBe(true);
      });

      it('should create lighting operators', () => {
        const { operators } = factory.createOperators();
        expect(operators.has('isActorLocationLit')).toBe(true);
        expect(operators.has('locationHasExits')).toBe(true);
      });
    });

    describe('operator types', () => {
      it('should create get_component_value as a function (inline operator)', () => {
        const { operators } = factory.createOperators();
        const getComponentValueOp = operators.get('get_component_value');
        expect(typeof getComponentValueOp).toBe('function');
      });

      it('should create class-based operators with evaluate method', () => {
        const { operators } = factory.createOperators();
        const classBasedOperators = [
          'hasPartWithComponentValue',
          'isSlotExposed',
          'isSocketCovered',
          'has_component',
        ];
        classBasedOperators.forEach((name) => {
          const op = operators.get(name);
          expect(typeof op.evaluate).toBe('function');
        });
      });
    });

    describe('get_component_value inline function', () => {
      it('should return null for invalid entity reference', () => {
        const { operators } = factory.createOperators();
        const getComponentValue = operators.get('get_component_value');
        expect(getComponentValue(null, 'some:component')).toBeNull();
        expect(getComponentValue(undefined, 'some:component')).toBeNull();
      });

      it('should handle entity reference with id property', () => {
        mockEntityManager.getComponentData.mockReturnValue({ value: 42 });
        const { operators } = factory.createOperators();
        const getComponentValue = operators.get('get_component_value');

        const result = getComponentValue({ id: 'entity1' }, 'test:component');
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          'entity1',
          'test:component'
        );
        expect(result).toEqual({ value: 42 });
      });

      it('should handle string entity reference', () => {
        mockEntityManager.getComponentData.mockReturnValue({ nested: { prop: 'test' } });
        const { operators } = factory.createOperators();
        const getComponentValue = operators.get('get_component_value');

        const result = getComponentValue('entity1', 'test:component');
        expect(mockEntityManager.getComponentData).toHaveBeenCalledWith(
          'entity1',
          'test:component'
        );
        expect(result).toEqual({ nested: { prop: 'test' } });
      });

      it('should handle property path navigation', () => {
        mockEntityManager.getComponentData.mockReturnValue({
          nested: { deeply: { value: 'found' } },
        });
        const { operators } = factory.createOperators();
        const getComponentValue = operators.get('get_component_value');

        const result = getComponentValue('entity1', 'test:component', 'nested.deeply.value');
        expect(result).toBe('found');
      });

      it('should return null for missing nested property', () => {
        mockEntityManager.getComponentData.mockReturnValue({ other: 'value' });
        const { operators } = factory.createOperators();
        const getComponentValue = operators.get('get_component_value');

        const result = getComponentValue('entity1', 'test:component', 'nested.missing');
        expect(result).toBeNull();
      });

      it('should return null when component data is not an object', () => {
        mockEntityManager.getComponentData.mockReturnValue('not an object');
        const { operators } = factory.createOperators();
        const getComponentValue = operators.get('get_component_value');

        const result = getComponentValue('entity1', 'test:component');
        expect(result).toBeNull();
      });

      it('should return null when component data is null', () => {
        mockEntityManager.getComponentData.mockReturnValue(null);
        const { operators } = factory.createOperators();
        const getComponentValue = operators.get('get_component_value');

        const result = getComponentValue('entity1', 'test:component');
        expect(result).toBeNull();
      });
    });
  });

  describe('getOperatorNames (static)', () => {
    it('should return array of 27 operator names', () => {
      const names = OperatorRegistryFactory.getOperatorNames();
      expect(Array.isArray(names)).toBe(true);
      expect(names.length).toBe(27);
    });

    it('should include all expected operator names', () => {
      const names = OperatorRegistryFactory.getOperatorNames();
      const expectedNames = [
        'hasPartWithComponentValue',
        'hasPartOfType',
        'hasPartOfTypeWithComponentValue',
        'hasPartWithStatusEffect',
        'hasWoundedPart',
        'isBodyPartWounded',
        'hasPartSubTypeContaining',
        'isSlotExposed',
        'isSocketCovered',
        'socketExposure',
        'isRemovalBlocked',
        'isBodyPartAccessible',
        'hasSittingSpaceToRight',
        'canScootCloser',
        'isClosestLeftOccupant',
        'isClosestRightOccupant',
        'isNearbyFurniture',
        'hasOtherActorsAtLocation',
        'has_component',
        'get_component_value',
        'hasFreeGrabbingAppendages',
        'canActorGrabItem',
        'isItemBeingGrabbed',
        'getSkillValue',
        'has_damage_capability',
        'isActorLocationLit',
        'locationHasExits',
      ];
      expectedNames.forEach((name) => {
        expect(names).toContain(name);
      });
    });

    it('should match the operators created by createOperators', () => {
      const factory = new OperatorRegistryFactory({
        entityManager: mockEntityManager,
        logger: mockLogger,
        bodyGraphService: mockBodyGraphService,
        lightingStateService: mockLightingStateService,
      });
      const { operators } = factory.createOperators();
      const staticNames = OperatorRegistryFactory.getOperatorNames();

      expect(operators.size).toBe(staticNames.length);
      staticNames.forEach((name) => {
        expect(operators.has(name)).toBe(true);
      });
    });
  });

  describe('dependency injection', () => {
    it('should pass entityManager to operators', () => {
      const factory = new OperatorRegistryFactory({
        entityManager: mockEntityManager,
        logger: mockLogger,
        bodyGraphService: mockBodyGraphService,
        lightingStateService: mockLightingStateService,
      });

      // The factory creates operators with dependencies
      // We verify this by checking the get_component_value function uses entityManager
      const { operators } = factory.createOperators();
      const getComponentValue = operators.get('get_component_value');

      mockEntityManager.getComponentData.mockReturnValue({ test: true });
      getComponentValue('entity1', 'test:component');

      expect(mockEntityManager.getComponentData).toHaveBeenCalled();
    });

    it('should throw when bodyGraphService is missing (required by body operators)', () => {
      const factory = new OperatorRegistryFactory({
        entityManager: mockEntityManager,
        logger: mockLogger,
        // bodyGraphService not provided - body operators require it
        lightingStateService: mockLightingStateService,
      });

      // Body operators require bodyGraphService, so this should throw
      expect(() => factory.createOperators()).toThrow();
    });

    it('should throw when lightingStateService is missing (required by lighting operators)', () => {
      const factory = new OperatorRegistryFactory({
        entityManager: mockEntityManager,
        logger: mockLogger,
        bodyGraphService: mockBodyGraphService,
        // lightingStateService not provided - lighting operators require it
      });

      // Lighting operators require lightingStateService, so this should throw
      expect(() => factory.createOperators()).toThrow();
    });
  });
});
