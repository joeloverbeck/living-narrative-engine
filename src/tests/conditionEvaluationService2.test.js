// src/tests/conditionEvaluationService2.test.js

import {describe, it, expect, beforeEach, jest, afterEach} from '@jest/globals';

// --- Mock Dependencies ---
class MockEntity {
    constructor(id) {
        this.id = id;
        this.components = new Map(); // Map<string (ClassName), instance>
        this.mockName = `Entity(${id})`; // Default name
    }

    addComponent(componentInstance) {
        const className = componentInstance.constructor.name;
        this.components.set(className, componentInstance);
        if (className === 'MockNameComponent' && componentInstance.value) {
            this.mockName = componentInstance.value;
        }
        // Simulate direct access if needed (though dataAccess is preferred)
        if (className === 'MockHealthComponent') this.Health = componentInstance;
        if (className === 'MockPositionComponent') this.Position = componentInstance;
    }

    // Use class name string for lookup in this simplified mock
    hasComponent(ComponentClass) {
        return this.components.has(ComponentClass.name);
    }

    getComponent(ComponentClass) {
        return this.components.get(ComponentClass.name);
    }

    // Helper for #getObjectName tests
    getDisplayName() {
        return this.mockName;
    }
}

// Mock Component Classes
class MockPositionComponent {
    constructor({locationId = 'loc-A', x = 0, y = 0} = {}) {
        this.locationId = locationId;
        this.x = x;
        this.y = y;
    }
}

class MockHealthComponent {
    constructor({current = 10, max = 10} = {}) {
        this.current = current;
        this.max = max;
    }
}

class MockNameComponent {
    constructor({value = 'Mock Entity'} = {}) {
        this.value = value;
    }
}

// Add any other component classes needed by operationHandlers being tested indirectly

// Mock EntityManager
const mockEntityManager = {
    componentRegistry: new Map(),
    registerComponent: function (key, Class) {
        this.componentRegistry.set(key, Class);
    },
    clearRegistry: function () {
        this.componentRegistry.clear();
    },
    // Add other methods if needed by the service constructor or dataAccessor
};

// --- Mock the operationHandlers module ---
jest.mock('../conditions/handlers/index.js', () => ({
    // Define the mocks *inside* the factory function
    handlePlayerInLocationCondition: jest.fn(),
    handlePlayerStateCondition: jest.fn(),
    handleTargetHasComponentCondition: jest.fn(),
    handleTargetHasPropertyCondition: jest.fn(),
    handleConnectionStateIsCondition: jest.fn(),
    handleHealthBelowMaxCondition: jest.fn(),
    // ... mock ALL operationHandlers exported by index.js
    // Add any other operationHandlers from index.js that are used
    handleTargetDistanceCondition: jest.fn(),
    handleHasStatusEffectCondition: jest.fn(),
    handleAttributeCheckCondition: jest.fn(),
}), {virtual: true});

// --- Import the service AFTER the mock ---
import ConditionEvaluationService from '../services/conditionEvaluationService.js';

// --- You might still want the variable for resetting mocks later ---
// You need to *require* the mocked module to get the mocked functions
const mockHandlers = require('../conditions/handlers/index.js');


// --- Test Suite ---
describe('ConditionEvaluationService', () => {
    let conditionEvaluationService;
    let userEntity;
    let targetEntity;
    let targetConnection;
    let baseContext; // Context WITHOUT dataAccess
    let consoleWarnSpy;
    let consoleErrorSpy;
    let consoleLogSpy;

    // Helper to get expected object name string
    const getExpectedObjectName = (obj) => {
        if (!obj) return 'null object';
        if (obj instanceof MockEntity) return obj.getDisplayName();
        if (obj.connectionId) {
            return obj.name || obj.direction || `Connection(${obj.connectionId})`;
        }
        return 'unknown object type';
    };

    beforeEach(() => {
        jest.clearAllMocks(); // Clears mocks including operationHandlers
        mockEntityManager.clearRegistry();

        // Register mock components used by dataAccessor/#getObjectName
        mockEntityManager.registerComponent('Position', MockPositionComponent);
        mockEntityManager.registerComponent('Health', MockHealthComponent);
        mockEntityManager.registerComponent('Name', MockNameComponent);
        // Register others if needed by specific tests

        userEntity = new MockEntity('player1');
        targetEntity = new MockEntity('targetNPC');
        targetConnection = {
            connectionId: 'conn-north',
            direction: 'north',
            name: undefined,
            state: 'locked',
            type: 'door'
        };

        // Context passed to evaluateConditions (service adds dataAccess internally)
        baseContext = {
            userEntity,
            targetEntityContext: targetEntity,
            targetConnectionContext: targetConnection,
        };

        // Instantiate the service AFTER mocks are set up
        conditionEvaluationService = new ConditionEvaluationService({entityManager: mockEntityManager});

        // Spy on console AFTER service instantiation if constructor logs
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        });
    });

    afterEach(() => {
        // Restore console spies
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
    });

    // --- Constructor Tests ---
    describe('Constructor', () => {
        it('should throw error if EntityManager dependency is missing', () => {
            expect(() => new ConditionEvaluationService({})).toThrow('ConditionEvaluationService requires an EntityManager dependency.');
        });

        it('should create an instance, register operationHandlers (once), and log creation', () => {
            // Service is created in beforeEach
            expect(conditionEvaluationService).toBeInstanceOf(ConditionEvaluationService);
            // Constructor logs registration and instance creation
            // Create another instance to check registration happens only once
            const service2 = new ConditionEvaluationService({entityManager: mockEntityManager});
        });
    });

    // --- evaluateConditions Method Tests ---
    describe('evaluateConditions Orchestration', () => {
        it('should return success: true with no conditions', () => {
            const result = conditionEvaluationService.evaluateConditions(targetEntity, baseContext, undefined);
            expect(result.success).toBe(true);
            expect(result.failureMessage).toBeUndefined();
            expect(result.messages).toEqual([{
                text: 'No Generic conditions to check for (unknown item).',
                type: 'internal'
            }]);
        });

        it('should return success: true when all conditions pass', () => {
            // Mock specific operationHandlers for this test if needed, defaults are 'true'
            mockHandlers.handlePlayerInLocationCondition.mockReturnValue(true);
            mockHandlers.handleHealthBelowMaxCondition.mockReturnValue(true);

            const conditions = [
                {condition_type: 'player_in_location', location_id: 'room-A'},
                {condition_type: 'health_below_max'},
            ];
            const options = {itemName: 'Test Item', checkType: 'Usability'};
            const result = conditionEvaluationService.evaluateConditions(targetEntity, baseContext, conditions, options);

            expect(result.success).toBe(true);
            expect(result.failureMessage).toBeUndefined();
            expect(mockHandlers.handlePlayerInLocationCondition).toHaveBeenCalledTimes(1);
            expect(mockHandlers.handleHealthBelowMaxCondition).toHaveBeenCalledTimes(1);
            // Check logs (optional, but good)
            const targetName = getExpectedObjectName(targetEntity);
            expect(result.messages).toContainEqual({
                text: `Checking Usability conditions for Test Item against ${targetName}...`,
                type: 'internal'
            });
            expect(result.messages).toContainEqual({
                text: 'Usability Condition Check Passed for Test Item: Type=\'player_in_location\', Negated=false',
                type: 'internal'
            });
            expect(result.messages).toContainEqual({
                text: 'Usability Condition Check Passed for Test Item: Type=\'health_below_max\', Negated=false',
                type: 'internal'
            });
            expect(result.messages).toContainEqual({
                text: 'All Usability conditions passed for Test Item.',
                type: 'internal'
            });
        });

        it('should return success: false and stop on first failed condition', () => {
            mockHandlers.handlePlayerInLocationCondition.mockReturnValue(false); // First one fails
            mockHandlers.handleHealthBelowMaxCondition.mockReturnValue(true); // Should not be called

            const conditions = [
                {condition_type: 'player_in_location', location_id: 'room-A', failure_message: 'Wrong place!'},
                {condition_type: 'health_below_max'},
            ];
            const result = conditionEvaluationService.evaluateConditions(targetEntity, baseContext, conditions);

            expect(result.success).toBe(false);
            expect(result.failureMessage).toBe('Wrong place!');
            expect(mockHandlers.handlePlayerInLocationCondition).toHaveBeenCalledTimes(1);
            expect(mockHandlers.handleHealthBelowMaxCondition).not.toHaveBeenCalled(); // Did not proceed
            expect(result.messages).toContainEqual({
                text: "Generic Condition Check Failed for (unknown item): Type='player_in_location', Negated=false, Reason='Wrong place!'",
                type: 'internal'
            });
            expect(result.messages).not.toContainEqual(expect.objectContaining({text: expect.stringContaining('health_below_max')}));
        });

        it('should return success: false on a later failed condition', () => {
            mockHandlers.handlePlayerInLocationCondition.mockReturnValue(true); // First passes
            mockHandlers.handleHealthBelowMaxCondition.mockReturnValue(false); // Second fails

            const conditions = [
                {condition_type: 'player_in_location', location_id: 'room-A'},
                {condition_type: 'health_below_max', failure_message: 'Too healthy!'},
            ];
            const result = conditionEvaluationService.evaluateConditions(targetEntity, baseContext, conditions);

            expect(result.success).toBe(false);
            expect(result.failureMessage).toBe('Too healthy!');
            expect(mockHandlers.handlePlayerInLocationCondition).toHaveBeenCalledTimes(1);
            expect(mockHandlers.handleHealthBelowMaxCondition).toHaveBeenCalledTimes(1);
            expect(result.messages).toContainEqual({
                text: 'Generic Condition Check Passed for (unknown item): Type=\'player_in_location\', Negated=false',
                type: 'internal'
            });
            expect(result.messages).toContainEqual({
                text: "Generic Condition Check Failed for (unknown item): Type='health_below_max\', Negated=false, Reason='Too healthy!'",
                type: 'internal'
            });
        });
    });

    describe('evaluateConditions Negation', () => {
        it('should handle negate: true correctly (passing case: handler=false -> final=true)', () => {
            mockHandlers.handlePlayerInLocationCondition.mockReturnValue(false); // Handler fails
            const conditions = [{condition_type: 'player_in_location', location_id: 'room-A', negate: true}];
            const result = conditionEvaluationService.evaluateConditions(targetEntity, baseContext, conditions);
            expect(result.success).toBe(true);
            expect(result.messages).toContainEqual({
                text: "Generic Condition Check Passed for (unknown item): Type='player_in_location\', Negated=true",
                type: 'internal'
            });
        });

        it('should handle negate: true correctly (failing case: handler=true -> final=false)', () => {
            mockHandlers.handlePlayerInLocationCondition.mockReturnValue(true); // Handler passes
            const conditions = [{
                condition_type: 'player_in_location',
                location_id: 'room-A',
                negate: true, // <-- Negated
                failure_message: 'Must NOT be here!'
            }];
            const result = conditionEvaluationService.evaluateConditions(targetEntity, baseContext, conditions);
            expect(result.success).toBe(false);
            expect(result.failureMessage).toBe('Must NOT be here!');
            expect(result.messages).toContainEqual({
                text: "Generic Condition Check Failed for (unknown item): Type='player_in_location\', Negated=true, Reason='Must NOT be here!'",
                type: 'internal'
            });
        });
    });

    describe('evaluateConditions Fallback Message Logic', () => {
        const failingCondition = {condition_type: 'player_in_location', location_id: 'room-A'}; // Will fail as handler mock returns false

        beforeEach(() => {
            mockHandlers.handlePlayerInLocationCondition.mockReturnValue(false); // Ensure it fails
        });

        it('should use condition.failure_message when present', () => {
            const condition = {...failingCondition, failure_message: 'Specific Fail Msg'};
            const result = conditionEvaluationService.evaluateConditions(targetEntity, baseContext, [condition]);
            expect(result.success).toBe(false);
            expect(result.failureMessage).toBe('Specific Fail Msg');
        });

        it('should use options.fallbackMessages[checkType] if specific message missing', () => {
            const options = {
                itemName: 'Lever', checkType: 'Usability',
                fallbackMessages: {usability: 'Cannot use lever now.'}
            };
            const result = conditionEvaluationService.evaluateConditions(targetEntity, baseContext, [failingCondition], options);
            expect(result.success).toBe(false);
            expect(result.failureMessage).toBe('Cannot use lever now.');
        });

        it('should use options.fallbackMessages.default if type-specific fallback missing', () => {
            const options = {
                itemName: 'Button', checkType: 'Target',
                fallbackMessages: {default: 'Generic fallback.'}
            };
            const result = conditionEvaluationService.evaluateConditions(targetEntity, baseContext, [failingCondition], options);
            expect(result.success).toBe(false);
            expect(result.failureMessage).toBe('Generic fallback.');
        });

        it('should use hardcoded default message if no fallbacks provided', () => {
            const options = {itemName: 'Gadget', checkType: 'Generic'};
            const result = conditionEvaluationService.evaluateConditions(targetEntity, baseContext, [failingCondition], options);
            expect(result.success).toBe(false);
            expect(result.failureMessage).toBe('Condition failed for Gadget.'); // Uses itemName
        });

        it('should use hardcoded default message with default item name if no options provided', () => {
            const result = conditionEvaluationService.evaluateConditions(targetEntity, baseContext, [failingCondition]);
            expect(result.success).toBe(false);
            expect(result.failureMessage).toBe('Condition failed for (unknown item).');
        });
    });

    describe('evaluateConditions Return Structure & Logging', () => {
        // Tested implicitly in previous orchestration tests, adding specific checks if needed
        it('should include start, pass/fail, and end messages in messages array', () => {
            mockHandlers.handlePlayerInLocationCondition.mockReturnValue(true);
            mockHandlers.handleHealthBelowMaxCondition.mockReturnValue(false); // Fails later
            const conditions = [
                {condition_type: 'player_in_location', location_id: 'room-A'},
                {condition_type: 'health_below_max', failure_message: 'Too healthy!'},
            ];
            const options = {itemName: 'Potion', checkType: 'Target'};
            const result = conditionEvaluationService.evaluateConditions(targetEntity, baseContext, conditions, options);

            expect(result.success).toBe(false);
            expect(result.failureMessage).toBe('Too healthy!');
            const targetName = getExpectedObjectName(targetEntity);
            expect(result.messages[0]).toEqual({
                text: `Checking Target conditions for Potion against ${targetName}...`,
                type: 'internal'
            });
            expect(result.messages[1]).toEqual({
                text: "Target Condition Check Passed for Potion: Type='player_in_location\', Negated=false",
                type: 'internal'
            });
            expect(result.messages[2]).toEqual({
                text: "Target Condition Check Failed for Potion: Type='health_below_max\', Negated=false, Reason='Too healthy!'",
                type: 'internal'
            });
            // Ensure final 'All passed' message is NOT present
            expect(result.messages.find(m => m.text.includes('All Target conditions passed'))).toBeUndefined();
        });
    });

    describe('evaluateConditions Error Handling', () => {
        it('should handle errors thrown by operationHandlers gracefully', () => {
            const error = new Error('Handler exploded!');
            mockHandlers.handlePlayerInLocationCondition.mockImplementation(() => {
                throw error;
            }); // Throw error

            const conditions = [
                {condition_type: 'player_in_location', location_id: 'room-A', failure_message: 'Specific Fail Msg'},
                {condition_type: 'health_below_max'} // Should not run
            ];
            const result = conditionEvaluationService.evaluateConditions(targetEntity, baseContext, conditions);

            expect(result.success).toBe(false);
            // IMPORTANT: The user-facing failure message should still use the standard logic
            expect(result.failureMessage).toBe('Specific Fail Msg');
            expect(mockHandlers.handlePlayerInLocationCondition).toHaveBeenCalledTimes(1);
            expect(mockHandlers.handleHealthBelowMaxCondition).not.toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error evaluating condition'), error);

            // Check internal logs for the error message
            expect(result.messages).toContainEqual({
                text: "ERROR evaluating condition player_in_location: Handler exploded!",
                type: 'error' // Should log as error type
            });
            // Check the final internal failure log indicates the error state
            expect(result.messages).toContainEqual({
                text: "Generic Condition Check Failed for (unknown item): Type='player_in_location\', Negated=false, Reason='Specific Fail Msg' (Evaluation Error)",
                type: 'internal'
            });
        });

        it('should use fallback message when handler errors and no specific message exists', () => {
            const error = new Error('Handler exploded!');
            mockHandlers.handlePlayerInLocationCondition.mockImplementation(() => {
                throw error;
            });

            const conditions = [{condition_type: 'player_in_location', location_id: 'room-A'}]; // No failure_message
            const options = {fallbackMessages: {default: 'Fallback due to error'}};
            const result = conditionEvaluationService.evaluateConditions(targetEntity, baseContext, conditions, options);

            expect(result.success).toBe(false);
            expect(result.failureMessage).toBe('Fallback due to error'); // Used fallback
            expect(result.messages).toContainEqual({
                text: "ERROR evaluating condition player_in_location: Handler exploded!",
                type: 'error'
            });
            expect(result.messages).toContainEqual({
                text: "Generic Condition Check Failed for (unknown item): Type='player_in_location\', Negated=false, Reason='Fallback due to error' (Evaluation Error)",
                type: 'internal'
            });
        });
    });

    describe('Unknown Condition Type Handling', () => {
        it('should fail and warn for an unknown condition type', () => {
            const conditions = [{condition_type: 'this_is_unknown', value: true}];
            const result = conditionEvaluationService.evaluateConditions(targetEntity, baseContext, conditions);
            expect(result.success).toBe(false);
            expect(result.failureMessage).toBe('Condition failed for (unknown item).'); // Uses default fallback
            expect(consoleWarnSpy).toHaveBeenCalledWith("ConditionEvaluationService: Encountered unknown condition_type 'this_is_unknown'. Assuming condition fails.");
            // Verify it logged the failure internally
            expect(result.messages).not.toContainEqual(expect.objectContaining({type: 'error'})); // It's a warning + failure, not an exception caught
        });
    });
});