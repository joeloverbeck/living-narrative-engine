// src/tests/utils/conditionContextUtils.test.js

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { getContextValue } from '../../src/utils/conditionContextUtils.js'; // Adjust path if needed
// We rely on the actual getObjectPropertyByPath, assuming it's tested separately.
// import { getObjectPropertyByPath } from '../../utils/objectUtils.js'; // Not mocking this dependency

// ==================================
// Mocks based on Ticket Requirements
// ==================================

// --- Mock Component Classes ---
class MockComponent {
  constructor() {
    // Base component, might have shared logic if needed
  }
}

class MockHealthComponent extends MockComponent {
  constructor(current = 100, max = 100) {
    super();
    this.current = current;
    this.max = max;
  }
}

class MockPositionComponent extends MockComponent {
  constructor(x = 0, y = 0) {
    super();
    this.coords = { x, y };
    this.location = 'default_zone';
  }
}

// --- Mock Entity Class/Factory ---
// Using a class for easier instantiation in tests
class MockEntity {
  constructor(id, customPropValue = 'defaultCustom') {
    this.id = id;
    this.components = new Map();
    this.customProp = customPropValue; // For testing direct fallback access
    // Add a property that shares name with a component key to test fallback precedence
    this.Health = 'direct health value';
  }

  // Method to add components for test setup
  addComponent(componentInstance, ComponentClass) {
    this.components.set(ComponentClass, componentInstance);
    return this; // Allow chaining
  }

  // Mock getComponent method
  getComponent(ComponentClass) {
    return this.components.get(ComponentClass);
  }
}

// --- Mock Connection Objects ---
const mockConnection1 = {
  id: 'conn1',
  type: 'Door',
  details: {
    material: 'copper',
    state: 'locked',
  },
};

const mockConnection2 = {
  id: 'conn2',
  type: 'Pipe',
  details: {
    material: 'steel',
    state: 'flowing',
  },
};

// --- Mock ConditionDataAccess ---
const mockDataAccess = {
  // Use jest.fn() to allow spying on calls and defining mock implementations
  getComponentClassByKey: jest.fn((key) => {
    switch (key) {
      case 'Health':
        return MockHealthComponent; // Return the class constructor
      case 'Position':
        return MockPositionComponent;
      default:
        return undefined; // Simulate key not found
    }
  }),
};

// ==================================
// Test Suite
// ==================================

describe('getContextValue Utility (conditionContextUtils.js)', () => {
  let entityWithComponents;
  let entityWithoutComponents;
  let healthComponentInstance;
  let positionComponentInstance;

  // Reset mocks and setup fresh instances before each test
  beforeEach(() => {
    // Clear any previous mock calls and reset implementations if necessary
    mockDataAccess.getComponentClassByKey.mockClear();

    // Reset mock implementation to default (already defined above)
    // If implementation was changed in a test, reset it here:
    // mockDataAccess.getComponentClassByKey.mockImplementation(key => { ... });

    healthComponentInstance = new MockHealthComponent(50, 100);
    positionComponentInstance = new MockPositionComponent(10, 20);

    entityWithComponents = new MockEntity('entity-1', 'customVal1')
      .addComponent(healthComponentInstance, MockHealthComponent)
      .addComponent(positionComponentInstance, MockPositionComponent);

    entityWithoutComponents = new MockEntity('entity-2', 'customVal2');
  });

  // --- Test Cases: Entity Targets ---
  describe('Entity Targets', () => {
    it('should access direct entity properties (id)', () => {
      expect(getContextValue(entityWithComponents, 'id', mockDataAccess)).toBe('entity-1');
    });

    it('should access direct entity properties (customProp)', () => {
      expect(getContextValue(entityWithComponents, 'customProp', mockDataAccess)).toBe('customVal1');
    });

    it('should access a component instance directly when path is just the component key', () => {
      const result = getContextValue(entityWithComponents, 'Health', mockDataAccess);
      expect(result).toBe(healthComponentInstance); // Should return the instance itself
      expect(mockDataAccess.getComponentClassByKey).toHaveBeenCalledWith('Health');
    });

    it('should access a direct property on a known component', () => {
      expect(getContextValue(entityWithComponents, 'Health.current', mockDataAccess)).toBe(50);
      expect(mockDataAccess.getComponentClassByKey).toHaveBeenCalledWith('Health');
    });

    it('should access a nested property within a known component', () => {
      expect(getContextValue(entityWithComponents, 'Position.coords.x', mockDataAccess)).toBe(10);
      expect(mockDataAccess.getComponentClassByKey).toHaveBeenCalledWith('Position');
    });

    it('should access an intermediate nested object within a known component', () => {
      expect(getContextValue(entityWithComponents, 'Position.coords', mockDataAccess)).toEqual({ x: 10, y: 20 });
      expect(mockDataAccess.getComponentClassByKey).toHaveBeenCalledWith('Position');
    });
  });

  // --- Test Cases: Entity Edge Cases ---
  describe('Entity Edge Cases', () => {
    it('should return undefined if component key is known but entity lacks the component instance', () => {
      expect(getContextValue(entityWithoutComponents, 'Health.current', mockDataAccess)).toBeUndefined();
      // Ensure dataAccess was still asked for the component class
      expect(mockDataAccess.getComponentClassByKey).toHaveBeenCalledWith('Health');
      // Ensure getComponent would have been called (implicitly tested by the undefined result)
    });

    it('should fallback to direct property access if component key is unknown to dataAccess', () => {
      // Entity does NOT have a direct 'UnknownComponent' property
      expect(getContextValue(entityWithComponents, 'UnknownComponent.value', mockDataAccess)).toBeUndefined();
      expect(mockDataAccess.getComponentClassByKey).toHaveBeenCalledWith('UnknownComponent');
      // Ensure it tried direct access after failing component lookup (implicitly tested)
    });

    it('should return direct property value if component key is unknown AND a direct property matches the key', () => {
      const entityWithDirectMatch = new MockEntity('e-direct');
      entityWithDirectMatch.UnknownComponent = { value: 'direct value' }; // Direct property

      expect(getContextValue(entityWithDirectMatch, 'UnknownComponent.value', mockDataAccess)).toBe('direct value');
      // dataAccess was still checked first
      expect(mockDataAccess.getComponentClassByKey).toHaveBeenCalledWith('UnknownComponent');
      expect(mockDataAccess.getComponentClassByKey).toHaveReturnedWith(undefined);
    });

    it('should return direct property value if path matches direct prop name that is also a KNOWN component key, but dataAccess is missing', () => {
      // entityWithComponents has a direct property `Health = 'direct health value'`
      // AND 'Health' is a known component key.
      // If dataAccess is missing, it should *only* do direct lookup.
      expect(getContextValue(entityWithComponents, 'Health', null)).toBe('direct health value');
      expect(mockDataAccess.getComponentClassByKey).not.toHaveBeenCalled(); // Because dataAccess was null
    });

    it('should return component value if path matches direct prop name that is also a KNOWN component key, AND dataAccess IS provided', () => {
      // entityWithComponents has a direct property `Health = 'direct health value'`
      // AND 'Health' is a known component key.
      // If dataAccess IS provided, component lookup takes precedence.
      expect(getContextValue(entityWithComponents, 'Health', mockDataAccess)).toBe(healthComponentInstance);
      expect(mockDataAccess.getComponentClassByKey).toHaveBeenCalledWith('Health');
    });


    it('should return undefined if component exists but the property path within the component is invalid', () => {
      expect(getContextValue(entityWithComponents, 'Health.nonExistentProp', mockDataAccess)).toBeUndefined();
      expect(mockDataAccess.getComponentClassByKey).toHaveBeenCalledWith('Health');
    });

    it('should return undefined if component exists but nested access fails (e.g., accessing prop on primitive)', () => {
      expect(getContextValue(entityWithComponents, 'Health.current.deeper', mockDataAccess)).toBeUndefined();
      expect(mockDataAccess.getComponentClassByKey).toHaveBeenCalledWith('Health');
    });

  });

  // --- Test Cases: Non-Entity Targets ---
  describe('Non-Entity Targets (e.g., Connection)', () => {
    it('should access direct properties on a plain object target', () => {
      expect(getContextValue(mockConnection1, 'id', mockDataAccess)).toBe('conn1');
      expect(getContextValue(mockConnection1, 'type', mockDataAccess)).toBe('Door');
      // dataAccess should not have been used for non-entity
      expect(mockDataAccess.getComponentClassByKey).not.toHaveBeenCalled();
    });

    it('should access nested properties on a plain object target', () => {
      expect(getContextValue(mockConnection1, 'details.material', mockDataAccess)).toBe('copper');
      expect(getContextValue(mockConnection2, 'details.state', mockDataAccess)).toBe('flowing');
      // dataAccess should not have been used
      expect(mockDataAccess.getComponentClassByKey).not.toHaveBeenCalled();
    });

    it('should return undefined for non-existent properties on a plain object target', () => {
      expect(getContextValue(mockConnection1, 'nonExistent', mockDataAccess)).toBeUndefined();
      expect(getContextValue(mockConnection1, 'details.nonExistent', mockDataAccess)).toBeUndefined();
      expect(mockDataAccess.getComponentClassByKey).not.toHaveBeenCalled();
    });

    it('should return undefined when accessing property on intermediate null/primitive value', () => {
      const obj = { a: 1, b: null };
      expect(getContextValue(obj, 'a.x', mockDataAccess)).toBeUndefined();
      expect(getContextValue(obj, 'b.x', mockDataAccess)).toBeUndefined();
      expect(mockDataAccess.getComponentClassByKey).not.toHaveBeenCalled();
    });
  });

  // --- Test Cases: Invalid Inputs ---
  describe('Invalid Inputs', () => {
    it('should return undefined if target is null', () => {
      expect(getContextValue(null, 'id', mockDataAccess)).toBeUndefined();
    });

    it('should return undefined if target is undefined', () => {
      expect(getContextValue(undefined, 'id', mockDataAccess)).toBeUndefined();
    });

    it('should return undefined if propertyPath is null', () => {
      expect(getContextValue(entityWithComponents, null, mockDataAccess)).toBeUndefined();
    });

    it('should return undefined if propertyPath is undefined', () => {
      expect(getContextValue(entityWithComponents, undefined, mockDataAccess)).toBeUndefined();
    });

    it('should return undefined if propertyPath is an empty string', () => {
      expect(getContextValue(entityWithComponents, '', mockDataAccess)).toBeUndefined();
    });

    it('should return undefined if propertyPath is not a string', () => {
      expect(getContextValue(entityWithComponents, 123, mockDataAccess)).toBeUndefined();
      expect(getContextValue(entityWithComponents, {path:'a'}, mockDataAccess)).toBeUndefined();
    });

    it('should return undefined when trying component access on Entity if dataAccess is null', () => {
      // This relies on fallback behavior. Entity has no direct 'Health' *object* property.
      // It *does* have a direct 'Health' string property 'direct health value'
      expect(getContextValue(entityWithComponents, 'Health.current', null)).toBeUndefined(); // Fallback to direct access fails here.
      // Ensure dataAccess mock was NOT called
      expect(mockDataAccess.getComponentClassByKey).not.toHaveBeenCalled();
    });

    it('should return direct property value when trying component access path on Entity if dataAccess is null AND direct prop exists', () => {
      // Test the direct fallback when dataAccess is null and a direct prop matches the *first* part
      expect(getContextValue(entityWithComponents, 'Health', null)).toBe('direct health value');
      expect(mockDataAccess.getComponentClassByKey).not.toHaveBeenCalled();
    });

    it('should return undefined when trying component access on non-Entity even if dataAccess is provided', () => {
      // Should not attempt component lookup on a connection object
      expect(getContextValue(mockConnection1, 'Health.current', mockDataAccess)).toBeUndefined();
      // Crucially, dataAccess should NOT have been called as target is not an entity
      expect(mockDataAccess.getComponentClassByKey).not.toHaveBeenCalled();
    });
  });

  // --- Test Cases: Target is Component Instance ---
  describe('Target is Component Instance', () => {
    it('should allow accessing properties if the target is a component instance itself', () => {
      expect(getContextValue(healthComponentInstance, 'current', mockDataAccess)).toBe(50);
      expect(getContextValue(positionComponentInstance, 'coords.y', mockDataAccess)).toBe(20);
      // DataAccess should not be needed or used when target isn't an entity
      expect(mockDataAccess.getComponentClassByKey).not.toHaveBeenCalled();
    });

    it('should return undefined for non-existent properties on a component instance target', () => {
      expect(getContextValue(healthComponentInstance, 'nonExistent', mockDataAccess)).toBeUndefined();
      expect(getContextValue(positionComponentInstance, 'coords.z', mockDataAccess)).toBeUndefined();
      expect(mockDataAccess.getComponentClassByKey).not.toHaveBeenCalled();
    });
  });

});