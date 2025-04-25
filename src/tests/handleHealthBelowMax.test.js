import {describe, it, expect, jest} from '@jest/globals';
import {handleHealthBelowMaxCondition} from '../conditions/handlers'; // Adjust path

// --- Mocks ---
class MockHealthComponent {
  constructor({current = 10, max = 10}) {
    this.current = current;
    this.max = max;
  }
}

// Static mock for the class itself for type checks/lookups
const MockHealthComponentClass = MockHealthComponent;

class MockEntity {
  constructor(id) {
    this.id = id;
    this.components = new Map(); // Map<Class, instance>
  }

  addComponent(instance, Class) {
    this.components.set(Class, instance);
  }

  getComponent(Class) {
    return this.components.get(Class);
  }

  // Helper for tests to check if getComponent was called correctly
  hasComponent = jest.fn((Class) => this.components.has(Class));
  // Add .getComponent = jest.fn(...) if more detailed spying is needed
}

const mockDataAccess = {
  getComponentClassByKey: jest.fn(),
  // getComponentForEntity: jest.fn(), // Not directly used by this handler
};

const mockContext = {
  userEntity: new MockEntity('user1'), // User usually not relevant here, but part of context
  targetEntityContext: null,
  targetConnectionContext: null,
  dataAccess: mockDataAccess,
};

const mockConnection = { // Example of wrong object type
  connectionId: 'c1',
  state: 'locked'
};

// --- Test Suite ---
describe('Condition Handler: handleHealthBelowMaxCondition', () => {

  let targetEntity;
  let conditionData; // Base condition data (no params needed for this handler)

  beforeEach(() => {
    jest.clearAllMocks();
    targetEntity = new MockEntity('target1');
    conditionData = {condition_type: 'health_below_max'}; // No specific params needed

    // Default mock setup for dataAccess
    mockDataAccess.getComponentClassByKey.mockImplementation((key) => {
      if (key === 'Health') return MockHealthComponentClass;
      return null;
    });
  });

  it('should return true if entity health.current < health.max', () => {
    targetEntity.addComponent(new MockHealthComponent({current: 5, max: 10}), MockHealthComponentClass);
    const result = handleHealthBelowMaxCondition(targetEntity, mockContext, conditionData);
    expect(result).toBe(true);
    expect(mockDataAccess.getComponentClassByKey).toHaveBeenCalledWith('Health');
  });

  it('should return false if entity health.current == health.max', () => {
    targetEntity.addComponent(new MockHealthComponent({current: 10, max: 10}), MockHealthComponentClass);
    const result = handleHealthBelowMaxCondition(targetEntity, mockContext, conditionData);
    expect(result).toBe(false);
  });

  it('should return false if entity health.current > health.max (unlikely but test)', () => {
    targetEntity.addComponent(new MockHealthComponent({current: 11, max: 10}), MockHealthComponentClass);
    const result = handleHealthBelowMaxCondition(targetEntity, mockContext, conditionData);
    expect(result).toBe(false);
  });

  it('should return false if entity does not have HealthComponent', () => {
    // Entity exists but component is missing
    const result = handleHealthBelowMaxCondition(targetEntity, mockContext, conditionData);
    expect(result).toBe(false);
  });

  it('should return false if HealthComponent class is not found via dataAccess', () => {
    mockDataAccess.getComponentClassByKey.mockReturnValue(null); // Simulate component not registered/found
    targetEntity.addComponent(new MockHealthComponent({current: 5, max: 10}), MockHealthComponentClass); // Component *is* on entity
    const result = handleHealthBelowMaxCondition(targetEntity, mockContext, conditionData);
    expect(result).toBe(false);
    expect(mockDataAccess.getComponentClassByKey).toHaveBeenCalledWith('Health');
  });

  it('should return false if objectToCheck is not an Entity (e.g., a Connection)', () => {
    const result = handleHealthBelowMaxCondition(mockConnection, mockContext, conditionData);
    expect(result).toBe(false);
    // dataAccess shouldn't even be called if it's not an entity
    expect(mockDataAccess.getComponentClassByKey).not.toHaveBeenCalled();
  });

  it('should return false if objectToCheck is null or undefined', () => {
    expect(handleHealthBelowMaxCondition(null, mockContext, conditionData)).toBe(false);
    expect(handleHealthBelowMaxCondition(undefined, mockContext, conditionData)).toBe(false);
    expect(mockDataAccess.getComponentClassByKey).not.toHaveBeenCalled();
  });

  it('should return false if HealthComponent properties (current/max) are missing or not numbers', () => {
    const healthCompNoCurrent = new MockHealthComponent({current: 5, max: 10});
    delete healthCompNoCurrent.current;
    targetEntity.addComponent(healthCompNoCurrent, MockHealthComponentClass);
    expect(handleHealthBelowMaxCondition(targetEntity, mockContext, conditionData)).toBe(false);

    targetEntity = new MockEntity('target2'); // Reset entity
    const healthCompNoMax = new MockHealthComponent({current: 5, max: 10});
    delete healthCompNoMax.max;
    targetEntity.addComponent(healthCompNoMax, MockHealthComponentClass);
    expect(handleHealthBelowMaxCondition(targetEntity, mockContext, conditionData)).toBe(false);

    targetEntity = new MockEntity('target3'); // Reset entity
    const healthCompWrongType = new MockHealthComponent({current: 'low', max: 'high'});
    targetEntity.addComponent(healthCompWrongType, MockHealthComponentClass);
    expect(handleHealthBelowMaxCondition(targetEntity, mockContext, conditionData)).toBe(false);
  });
});