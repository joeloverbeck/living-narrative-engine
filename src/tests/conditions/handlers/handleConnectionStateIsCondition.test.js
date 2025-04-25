// src/tests/conditions/operationHandlers/handleConnectionStateIsCondition.test.js

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { handleConnectionStateIsCondition } from '../../../conditions/handlers'; // Adjust path as needed
// Mock PassageDetailsComponent - we only need its existence and a getState method for this handler
import { PassageDetailsComponent } from '../../../components/passageDetailsComponent.js';

// Mock Entity - Needs getComponent method
class MockEntity {
  constructor(id = 'mock-entity') {
    this.id = id;
    this._components = new Map();
  }
  addComponent(componentInstance, ComponentClass) {
    // Ensure ComponentClass is the actual class object used as the key
    this._components.set(ComponentClass, componentInstance);
  }
  getComponent(ComponentClass) {
    return this._components.get(ComponentClass);
  }
  isEntity = true;
}

// Helper function to create a minimal valid PassageDetailsComponent for tests
const createTestPassageComponent = (state) => {
  return new PassageDetailsComponent({
    locationAId: 'loc-a',
    locationBId: 'loc-b',
    directionAtoB: 'north',
    directionBtoA: 'south',
    state: state // Pass the desired state
    // Add other properties if needed by the component's logic, but state is key here
  });
};


// --- Test Suite ---
describe('handleConnectionStateIsCondition', () => {
  let mockContext;
  let mockDataAccess;
  let mockEntity;
  let consoleWarnSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    // Spy setup (keep as is)
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Reset mocks for each test
    mockEntity = new MockEntity('conn-entity-1');
    mockDataAccess = {
      getComponentForEntity: jest.fn((entity, ComponentClass) => {
        if (entity && typeof entity.getComponent === 'function') {
          // This simulation now correctly uses the ComponentClass passed in
          return entity.getComponent(ComponentClass);
        }
        return undefined;
      }),
    };
    mockContext = { dataAccess: mockDataAccess };
  });

  afterEach(() => {
    // Restore spies (keep as is)
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    jest.clearAllMocks();
  });

  // --- AC1: Entity Inputs ---
  describe('When objectToCheck is an Entity', () => {
    it('AC1: should return true if Entity has PassageDetailsComponent and state matches', () => {
      // Instantiate the REAL component
      const component = createTestPassageComponent('open');
      // Add using the REAL component class as the key
      mockEntity.addComponent(component, PassageDetailsComponent);
      const conditionData = { type: 'connection_state_is', state: 'open' };

      const result = handleConnectionStateIsCondition(mockEntity, mockContext, conditionData);

      expect(result).toBe(true);
      // Expect lookup using the REAL component class
      expect(mockDataAccess.getComponentForEntity).toHaveBeenCalledWith(mockEntity, PassageDetailsComponent);
    });

    it('AC1: should return false if Entity has PassageDetailsComponent but state does NOT match', () => {
      const component = createTestPassageComponent('closed');
      mockEntity.addComponent(component, PassageDetailsComponent); // Use REAL class
      const conditionData = { type: 'connection_state_is', state: 'open' };

      const result = handleConnectionStateIsCondition(mockEntity, mockContext, conditionData);

      expect(result).toBe(false);
      expect(mockDataAccess.getComponentForEntity).toHaveBeenCalledWith(mockEntity, PassageDetailsComponent); // Use REAL class
    });

    it('AC1: should return true if Entity state is undefined and required state is undefined', () => {
      const component = createTestPassageComponent(undefined); // Explicitly undefined state
      mockEntity.addComponent(component, PassageDetailsComponent); // Use REAL class
      const conditionData = { type: 'connection_state_is', state: undefined };

      const result = handleConnectionStateIsCondition(mockEntity, mockContext, conditionData);

      expect(result).toBe(true); // undefined === undefined should now work
      expect(mockDataAccess.getComponentForEntity).toHaveBeenCalledWith(mockEntity, PassageDetailsComponent); // Use REAL class
    });

    it('AC1: should return false if Entity state is undefined and required state is a string', () => {
      const component = createTestPassageComponent(undefined);
      mockEntity.addComponent(component, PassageDetailsComponent); // Use REAL class
      const conditionData = { type: 'connection_state_is', state: 'open' };

      const result = handleConnectionStateIsCondition(mockEntity, mockContext, conditionData);

      expect(result).toBe(false); // undefined !== 'open'
      expect(mockDataAccess.getComponentForEntity).toHaveBeenCalledWith(mockEntity, PassageDetailsComponent); // Use REAL class
    });


    it('AC1: should return false if Entity does NOT have PassageDetailsComponent', () => {
      // Entity exists but component is not added
      const conditionData = { type: 'connection_state_is', state: 'open' };

      const result = handleConnectionStateIsCondition(mockEntity, mockContext, conditionData);

      expect(result).toBe(false);
      // The handler WILL call getComponentForEntity, looking for the REAL component
      expect(mockDataAccess.getComponentForEntity).toHaveBeenCalledWith(mockEntity, PassageDetailsComponent); // Use REAL class
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('lacks the required PassageDetailsComponent'));
    });

    it('AC1: should return false if PassageDetailsComponent lacks getState method (should not happen)', () => {
      const component = createTestPassageComponent('open');
      // Manually break the instance for this test
      component.getState = undefined;
      mockEntity.addComponent(component, PassageDetailsComponent); // Use REAL class
      const conditionData = { type: 'connection_state_is', state: 'open' };

      const result = handleConnectionStateIsCondition(mockEntity, mockContext, conditionData);

      expect(result).toBe(false);
      // It will find the component instance
      expect(mockDataAccess.getComponentForEntity).toHaveBeenCalledWith(mockEntity, PassageDetailsComponent); // Use REAL class
      // But then fail when trying to call .getState()
      expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('lacks a getState() method'));
    });
  });

  // --- AC1: Non-Entity Inputs (Backward Compatibility) ---
  describe('When objectToCheck is NOT an Entity (Backward Compatibility)', () => {
    it('AC1: should return true if object has matching state property', () => {
      const plainObject = { state: 'locked', other: 'data' };
      const conditionData = { type: 'connection_state_is', state: 'locked' };

      const result = handleConnectionStateIsCondition(plainObject, mockContext, conditionData);

      expect(result).toBe(true);
      expect(mockDataAccess.getComponentForEntity).not.toHaveBeenCalled(); // Should not attempt entity lookup
    });

    it('AC1: should return false if object has non-matching state property', () => {
      const plainObject = { state: 'unlocked' };
      const conditionData = { type: 'connection_state_is', state: 'locked' };

      const result = handleConnectionStateIsCondition(plainObject, mockContext, conditionData);

      expect(result).toBe(false);
    });

    it('AC1: should return false if object does NOT have state property', () => {
      const plainObject = { name: 'door', type: 'wood' }; // No 'state' key
      const conditionData = { type: 'connection_state_is', state: 'locked' };

      const result = handleConnectionStateIsCondition(plainObject, mockContext, conditionData);

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("lacks a 'state' property"),
        plainObject // Expect the object as the second argument
      );
    });
  });

  // --- AC1: Invalid Inputs ---
  describe('Invalid Inputs', () => {
    it('AC1: should return false if conditionData is missing the "state" parameter', () => {
      // Use the real component via the helper
      const component = createTestPassageComponent('open');
      // Use the real component class as the key
      mockEntity.addComponent(component, PassageDetailsComponent);
      const conditionData = { type: 'connection_state_is' }; // Missing 'state'
      const result = handleConnectionStateIsCondition(mockEntity, mockContext, conditionData);

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("missing required 'state' parameter"),
        conditionData // Expect the object as the second argument
      );
    });

    it('AC1: should return false if required state in conditionData is explicitly null (and entity state is not null)', () => {
      // Use the real component via the helper
      const component = createTestPassageComponent('open'); // Entity state is 'open'
      // Use the real component class as the key
      mockEntity.addComponent(component, PassageDetailsComponent);
      const conditionData = { type: 'connection_state_is', state: null }; // Required state is null

      const result = handleConnectionStateIsCondition(mockEntity, mockContext, conditionData);

      expect(result).toBe(false); // 'open' !== null
      expect(mockDataAccess.getComponentForEntity).toHaveBeenCalledWith(mockEntity, PassageDetailsComponent); // Ensure component lookup happened
    });

    it('AC1: should return false if objectToCheck is null', () => {
      const conditionData = { type: 'connection_state_is', state: 'open' };

      const result = handleConnectionStateIsCondition(null, mockContext, conditionData);

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Received null or undefined objectToCheck'));
    });

    it('AC1: should return false if objectToCheck is undefined', () => {
      const conditionData = { type: 'connection_state_is', state: 'open' };

      const result = handleConnectionStateIsCondition(undefined, mockContext, conditionData);

      expect(result).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Received null or undefined objectToCheck'));
    });
  });
});