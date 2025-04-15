// src/tests/conditions/handlers/handleTargetHasPropertyCondition.test.js

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { handleTargetHasPropertyCondition } from '../../../conditions/handlers'; // Adjust path as needed

// Mock PassageDetailsComponent - Needs direct properties for getNestedProperty
class MockPassageDetailsComponent {
    constructor({ state = undefined, blockerEntityId = null, isHidden = false, type = 'passage' } = {}) {
        this.state = state;
        this.blockerEntityId = blockerEntityId;
        this.isHidden = isHidden; // Direct property matching AC2 path
        this.type = type;
        // Mock potentially other relevant properties if needed
        this.locationAId = 'loc-a';
    }
    // Add methods if needed by other tests, but not strictly by this handler using getNestedProperty
}

// Mock Entity - Needs getComponent and addComponent
class MockEntity {
    constructor(id = 'mock-entity') {
        this.id = id;
        this._components = new Map();
        this.directEntityProp = 'entityValue'; // For testing direct entity access
    }
    addComponent(componentInstance, ComponentClass) {
        this._components.set(ComponentClass, componentInstance);
    }
    getComponent(ComponentClass) {
        return this._components.get(ComponentClass);
    }
    // Helper to check if it's an entity
    isEntity = true;
}

// --- Test Suite ---
describe('handleTargetHasPropertyCondition', () => {
    let mockContext;
    let mockDataAccess;
    let mockEntity;
    let mockPassageDetailsComponent;
    let consoleWarnSpy;

    beforeEach(() => {
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

        // Reset mocks
        mockEntity = new MockEntity('conn-entity-1');
        // Instantiate the component with default values for setup
        mockPassageDetailsComponent = new MockPassageDetailsComponent();
        mockEntity.addComponent(mockPassageDetailsComponent, MockPassageDetailsComponent);

        mockDataAccess = {
            // getNestedProperty uses getComponentClassByKey implicitly to find the class
            getComponentClassByKey: jest.fn((key) => {
                if (key === 'PassageDetailsComponent') {
                    return MockPassageDetailsComponent;
                }
                // Return null or undefined for unknown component keys
                return null;
            }),
            // getComponentForEntity is used by entity.getComponent within getNestedProperty logic
            // We simulate this via the MockEntity's getComponent directly.
            // If getNestedProperty *directly* called dataAccess.getComponentForEntity, we'd mock it here.
        };
        mockContext = {
            dataAccess: mockDataAccess,
        };
    });

    afterEach(() => {
        consoleWarnSpy.mockRestore();
        jest.clearAllMocks();
    });

    // --- AC2: Evaluation against Connection Entity via PassageDetailsComponent ---
    describe('Evaluating against Connection Entity (via PassageDetailsComponent)', () => {

        it('AC2: Path "PassageDetailsComponent.state", value matches', () => {
            mockPassageDetailsComponent.state = 'open';
            const conditionData = { property_path: 'PassageDetailsComponent.state', expected_value: 'open' };
            const result = handleTargetHasPropertyCondition(mockEntity, mockContext, conditionData);
            expect(result).toBe(true);
            // Verify getComponentClassByKey was likely called by getNestedProperty internally
            expect(mockDataAccess.getComponentClassByKey).toHaveBeenCalledWith('PassageDetailsComponent');
        });

        it('AC2: Path "PassageDetailsComponent.state", value does NOT match', () => {
            mockPassageDetailsComponent.state = 'closed';
            const conditionData = { property_path: 'PassageDetailsComponent.state', expected_value: 'open' };
            const result = handleTargetHasPropertyCondition(mockEntity, mockContext, conditionData);
            expect(result).toBe(false);
        });

        it('AC2: Path "PassageDetailsComponent.state", actual is undefined, expected is undefined', () => {
            mockPassageDetailsComponent.state = undefined;
            const conditionData = { property_path: 'PassageDetailsComponent.state', expected_value: undefined };
            const result = handleTargetHasPropertyCondition(mockEntity, mockContext, conditionData);
            expect(result).toBe(true); // undefined === undefined
        });

        it('AC2: Path "PassageDetailsComponent.state", actual is undefined, expected is defined', () => {
            mockPassageDetailsComponent.state = undefined;
            const conditionData = { property_path: 'PassageDetailsComponent.state', expected_value: 'open' };
            const result = handleTargetHasPropertyCondition(mockEntity, mockContext, conditionData);
            expect(result).toBe(false); // undefined !== 'open'
        });

        it('AC2: Path "PassageDetailsComponent.blockerEntityId", value matches (string)', () => {
            mockPassageDetailsComponent.blockerEntityId = 'blocker-orc-1';
            const conditionData = { property_path: 'PassageDetailsComponent.blockerEntityId', expected_value: 'blocker-orc-1' };
            const result = handleTargetHasPropertyCondition(mockEntity, mockContext, conditionData);
            expect(result).toBe(true);
        });

        it('AC2: Path "PassageDetailsComponent.blockerEntityId", value matches (null)', () => {
            mockPassageDetailsComponent.blockerEntityId = null;
            const conditionData = { property_path: 'PassageDetailsComponent.blockerEntityId', expected_value: null };
            const result = handleTargetHasPropertyCondition(mockEntity, mockContext, conditionData);
            expect(result).toBe(true);
        });

        it('AC2: Path "PassageDetailsComponent.blockerEntityId", value does NOT match (string vs null)', () => {
            mockPassageDetailsComponent.blockerEntityId = 'blocker-goblin-1';
            const conditionData = { property_path: 'PassageDetailsComponent.blockerEntityId', expected_value: null };
            const result = handleTargetHasPropertyCondition(mockEntity, mockContext, conditionData);
            expect(result).toBe(false);
        });

        it('AC2: Path "PassageDetailsComponent.blockerEntityId", value does NOT match (null vs string)', () => {
            mockPassageDetailsComponent.blockerEntityId = null;
            const conditionData = { property_path: 'PassageDetailsComponent.blockerEntityId', expected_value: 'blocker-none' };
            const result = handleTargetHasPropertyCondition(mockEntity, mockContext, conditionData);
            expect(result).toBe(false);
        });

        it('AC2: Path "PassageDetailsComponent.isHidden", value matches (true)', () => {
            mockPassageDetailsComponent.isHidden = true;
            const conditionData = { property_path: 'PassageDetailsComponent.isHidden', expected_value: true };
            const result = handleTargetHasPropertyCondition(mockEntity, mockContext, conditionData);
            expect(result).toBe(true);
        });

        it('AC2: Path "PassageDetailsComponent.isHidden", value matches (false)', () => {
            mockPassageDetailsComponent.isHidden = false;
            const conditionData = { property_path: 'PassageDetailsComponent.isHidden', expected_value: false };
            const result = handleTargetHasPropertyCondition(mockEntity, mockContext, conditionData);
            expect(result).toBe(true);
        });

        it('AC2: Path "PassageDetailsComponent.type", value matches', () => {
            mockPassageDetailsComponent.type = 'doorway';
            const conditionData = { property_path: 'PassageDetailsComponent.type', expected_value: 'doorway' };
            const result = handleTargetHasPropertyCondition(mockEntity, mockContext, conditionData);
            expect(result).toBe(true);
        });

        it('AC2: Path "PassageDetailsComponent.type", value does NOT match', () => {
            mockPassageDetailsComponent.type = 'archway';
            const conditionData = { property_path: 'PassageDetailsComponent.type', expected_value: 'doorway' };
            const result = handleTargetHasPropertyCondition(mockEntity, mockContext, conditionData);
            expect(result).toBe(false);
        });

        it('AC2: Path with invalid component name returns false', () => {
            const conditionData = { property_path: 'WrongComponent.state', expected_value: 'any' };
            const result = handleTargetHasPropertyCondition(mockEntity, mockContext, conditionData);
            expect(result).toBe(false);
            expect(mockDataAccess.getComponentClassByKey).toHaveBeenCalledWith('WrongComponent');
        });

        it('AC2: Path with invalid property name returns false', () => {
            const conditionData = { property_path: 'PassageDetailsComponent.invalidProp', expected_value: 'any' };
            const result = handleTargetHasPropertyCondition(mockEntity, mockContext, conditionData);
            expect(result).toBe(false);
            // getComponentClassByKey would still be called to find PassageDetailsComponent
            expect(mockDataAccess.getComponentClassByKey).toHaveBeenCalledWith('PassageDetailsComponent');
        });

        it('AC2: Path accessing direct entity property works', () => {
            mockEntity.directEntityProp = 'found_me';
            const conditionData = { property_path: 'directEntityProp', expected_value: 'found_me' };
            const result = handleTargetHasPropertyCondition(mockEntity, mockContext, conditionData);
            expect(result).toBe(true);
            // getComponentClassByKey should NOT be called for direct properties
            expect(mockDataAccess.getComponentClassByKey).toHaveBeenCalledWith('directEntityProp');
        });
    });

    // --- Tests with Non-Entity objectToCheck ---
    describe('Evaluating against Non-Entity objectToCheck', () => {
        it('should return true for direct property match on plain object', () => {
            const plainObject = { status: 'active', details: { nested: true } };
            const conditionData = { property_path: 'status', expected_value: 'active' };
            // No context/dataAccess needed for direct props on plain objects
            const result = handleTargetHasPropertyCondition(plainObject, {}, conditionData);
            expect(result).toBe(true);
        });

        it('should return true for nested property match on plain object', () => {
            const plainObject = { status: 'active', details: { nested: true } };
            const conditionData = { property_path: 'details.nested', expected_value: true };
            const result = handleTargetHasPropertyCondition(plainObject, {}, conditionData);
            expect(result).toBe(true);
        });

        it('should return false for non-matching property on plain object', () => {
            const plainObject = { status: 'inactive' };
            const conditionData = { property_path: 'status', expected_value: 'active' };
            const result = handleTargetHasPropertyCondition(plainObject, {}, conditionData);
            expect(result).toBe(false);
        });

        it('should return false for missing property on plain object', () => {
            const plainObject = { other: 'data' };
            const conditionData = { property_path: 'status', expected_value: 'active' };
            const result = handleTargetHasPropertyCondition(plainObject, {}, conditionData);
            expect(result).toBe(false);
        });
    });


    // --- AC2: Invalid Inputs ---
    describe('Invalid Inputs', () => {
        it('AC2: should return false if conditionData is missing "property_path"', () => {
            const conditionData = { expected_value: 'any' };
            const result = handleTargetHasPropertyCondition(mockEntity, mockContext, conditionData);
            expect(result).toBe(false);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("[ConditionHandler] Missing property_path or expected_value in conditionData for target_has_property."));
        });

        it('AC2: should return false if conditionData has null "property_path"', () => {
            const conditionData = { property_path: null, expected_value: 'any' };
            const result = handleTargetHasPropertyCondition(mockEntity, mockContext, conditionData);
            expect(result).toBe(false);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("[ConditionHandler] Missing property_path or expected_value in conditionData for target_has_property."));
        });


        it('AC2: should return false if conditionData is missing "expected_value"', () => {
            // getValueParam returns undefined if missing, which might be a valid value to check against.
            // The handler checks specifically for `typeof expectedValue === 'undefined'`.
            const conditionData = { property_path: 'PassageDetailsComponent.state' }; // expected_value is missing
            const result = handleTargetHasPropertyCondition(mockEntity, mockContext, conditionData);
            expect(result).toBe(false);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("Missing property_path or expected_value"));
        });

        it('should return false if objectToCheck is null', () => {
            const conditionData = { property_path: 'PassageDetailsComponent.state', expected_value: 'open' };
            // getNestedProperty should handle null input gracefully and return undefined
            const result = handleTargetHasPropertyCondition(null, mockContext, conditionData);
            // undefined === 'open' is false
            expect(result).toBe(false);
            // No specific console warning expected from the handler itself for null object,
            // unless getNestedProperty logs one. Assuming it doesn't based on utils tests.
        });

        it('should return false if objectToCheck is undefined', () => {
            const conditionData = { property_path: 'PassageDetailsComponent.state', expected_value: 'open' };
            const result = handleTargetHasPropertyCondition(undefined, mockContext, conditionData);
            expect(result).toBe(false);
        });
    });
});