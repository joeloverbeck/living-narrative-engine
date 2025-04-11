// src/tests/services/conditionEvaluationService.test.js

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import ConditionEvaluationService from '../services/conditionEvaluationService.js'; // Adjust path - Assuming relative path is correct

// --- Mock Dependencies ---

// Mock Entity Class
class MockEntity {
    constructor(id) {
        this.id = id;
        this.components = new Map();
        // Simplified name handling for getObjectName test verification
        this.mockName = `Entity(${id})`;
    }

    addComponent(componentInstance) {
        // Use constructor as key, matching Entity implementation detail
        this.components.set(componentInstance.constructor, componentInstance);
        // Update mockName if NameComponent is added
        if (componentInstance.constructor.name === 'MockNameComponent' && componentInstance.value) {
            this.mockName = componentInstance.value;
        }
        // Add direct property access for simplified component access in target_has_property
        if (componentInstance.constructor.name === 'MockHealthComponent') {
            this.Health = componentInstance; // e.g., for path 'Health.current'
        }
        // Add more direct properties for other mock components if needed by tests
    }

    hasComponent(ComponentClass) {
        return this.components.has(ComponentClass);
    }

    getComponent(ComponentClass) {
        return this.components.get(ComponentClass);
    }

    // Helper for getObjectName test verification (simpler than original getComponentByName)
    getDisplayName() {
        return this.mockName;
    }
}

// Mock Component Classes (minimal implementations)
class MockPositionComponent {
    constructor({locationId = 'default-loc', x = 0, y = 0}) {
        this.locationId = locationId;
        this.x = x;
        this.y = y;
    }
}

class MockHealthComponent {
    constructor({current = 10, max = 10}) {
        this.current = current;
        this.max = max;
    }
}

class MockSomeOtherComponent {
    constructor(data = {}) {
        this.someData = data.someData || 'default';
    }
}

class MockNameComponent {
    constructor({value = 'Mock Entity'}) {
        this.value = value;
    }
}


// Mock EntityManager
const mockEntityManager = {
    componentRegistry: new Map(),
    registerComponent: (name, Class) => {
        mockEntityManager.componentRegistry.set(name, Class);
    },
    clearRegistry: () => {
        mockEntityManager.componentRegistry.clear();
    }
};

// --- Test Suite ---

describe('ConditionEvaluationService', () => {
    let conditionEvaluationService;
    let userEntity;
    let targetEntity;
    let targetConnection;
    let context;
    let consoleWarnSpy;
    let consoleErrorSpy;
    let consoleLogSpy;

    beforeEach(() => {
        jest.clearAllMocks();
        mockEntityManager.clearRegistry();

        mockEntityManager.registerComponent('Position', MockPositionComponent);
        mockEntityManager.registerComponent('Health', MockHealthComponent);
        mockEntityManager.registerComponent('SomeOther', MockSomeOtherComponent);
        mockEntityManager.registerComponent('Name', MockNameComponent);

        userEntity = new MockEntity('player1');
        targetEntity = new MockEntity('targetNPC');
        targetConnection = {
            connectionId: 'conn-north',
            direction: 'north',
            name: undefined, // Ensure name starts undefined for tests
            target: 'loc-hallway',
            state: 'locked',
            type: 'door'
        };

        context = {
            userEntity,
            targetEntityContext: targetEntity,
            targetConnectionContext: targetConnection,
        };

        conditionEvaluationService = new ConditionEvaluationService({entityManager: mockEntityManager});

        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        });
    });

    // --- Constructor Tests ---
    describe('Constructor', () => {
        it('should throw error if EntityManager dependency is missing', () => {
            expect(() => new ConditionEvaluationService({})).toThrow('ConditionEvaluationService requires an EntityManager dependency.');
        });

        it('should create an instance successfully with EntityManager', () => {
            expect(conditionEvaluationService).toBeInstanceOf(ConditionEvaluationService);
            expect(consoleLogSpy).toHaveBeenCalledWith("ConditionEvaluationService: Instance created.");
        });
    });

    // --- evaluateConditions Method Tests ---
    describe('evaluateConditions', () => {
        // Helper to get simplified object name for logging verification
        const getExpectedObjectName = (obj) => {
            if (!obj) return 'null object';
            if (obj instanceof MockEntity) return obj.getDisplayName();
            if (obj.connectionId) return obj.name || obj.direction || `Connection(${obj.connectionId})`;
            return 'unknown object type';
        };

        it('should return success true with no conditions', () => {
            const result = conditionEvaluationService.evaluateConditions(targetEntity, context, undefined);
            const expectedName = getExpectedObjectName(targetEntity);
            expect(result.success).toBe(true);
            expect(result.failureMessage).toBeUndefined();
            expect(result.messages).toEqual([{
                text: `No Generic conditions to check for (unknown item).`, // Initial message doesn't use object name yet
                type: 'internal'
            }]);
        });

        it('should return success true when all conditions pass', () => {
            userEntity.addComponent(new MockPositionComponent({locationId: 'room-A'}));
            targetEntity.addComponent(new MockHealthComponent({current: 5, max: 10}));
            const conditions = [
                {condition_type: 'player_in_location', locationId: 'room-A'},
                {condition_type: 'health_below_max'},
            ];
            const options = {itemName: 'Healing Spell', checkType: 'Usability'};
            const expectedTargetName = getExpectedObjectName(targetEntity);


            const result = conditionEvaluationService.evaluateConditions(targetEntity, context, conditions, options);

            // --- Check for Test 2 Failure Point ---
            // If this fails, it indicates 'player_in_location' is still returning false unexpectedly.
            // Requires deeper debugging beyond this fix.
            expect(result.success).toBe(true);
            // --------------------------------------

            expect(result.failureMessage).toBeUndefined();
            expect(result.messages).toContainEqual({
                text: `Checking Usability conditions for Healing Spell against ${expectedTargetName}...`,
                type: 'internal'
            });
            expect(result.messages).toContainEqual({
                text: 'Usability Condition Check Passed for Healing Spell: Type=\'player_in_location\', Negated=false',
                type: 'internal'
            });
            expect(result.messages).toContainEqual({
                text: 'Usability Condition Check Passed for Healing Spell: Type=\'health_below_max\', Negated=false',
                type: 'internal'
            });
            expect(result.messages).toContainEqual({
                text: 'All Usability conditions passed for Healing Spell.',
                type: 'internal'
            });
        });

        it('should return success false and stop on first failed condition', () => {
            userEntity.addComponent(new MockPositionComponent({locationId: 'room-B'})); // Wrong location
            targetEntity.addComponent(new MockHealthComponent({current: 5, max: 10}));
            const conditions = [
                {condition_type: 'player_in_location', locationId: 'room-A', failure_message: 'Must be in Room A.'},
                {condition_type: 'health_below_max'}, // This won't be checked
            ];
            const options = {itemName: 'Chest', checkType: 'Target'};
            const expectedTargetName = getExpectedObjectName(targetEntity);

            const result = conditionEvaluationService.evaluateConditions(targetEntity, context, conditions, options);

            expect(result.success).toBe(false);
            expect(result.failureMessage).toBe('Must be in Room A.');
            expect(result.messages).toContainEqual({
                text: `Checking Target conditions for Chest against ${expectedTargetName}...`,
                type: 'internal'
            });
            expect(result.messages).toContainEqual({
                text: "Target Condition Check Failed for Chest: Type='player_in_location', Negated=false, Reason='Must be in Room A.'",
                type: 'internal'
            });
            expect(result.messages).not.toContainEqual(expect.objectContaining({text: expect.stringContaining('health_below_max')}));
            expect(result.messages).not.toContainEqual(expect.objectContaining({text: expect.stringContaining('All Target conditions passed')}));
        });

        it('should return success false on a later failed condition', () => {
            userEntity.addComponent(new MockPositionComponent({locationId: 'room-A'}));
            targetEntity.addComponent(new MockHealthComponent({current: 10, max: 10})); // Health NOT below max
            const conditions = [
                {condition_type: 'player_in_location', locationId: 'room-A'},
                {condition_type: 'health_below_max', failure_message: 'Target is already at full health.'},
            ];
            const options = {itemName: 'Potion', checkType: 'Target'};
            const expectedTargetName = getExpectedObjectName(targetEntity);

            const result = conditionEvaluationService.evaluateConditions(targetEntity, context, conditions, options);

            expect(result.success).toBe(false);
            expect(result.failureMessage).toBe('Target is already at full health.');
            expect(result.messages).toContainEqual({
                text: `Checking Target conditions for Potion against ${expectedTargetName}...`,
                type: 'internal'
            });
            expect(result.messages).toContainEqual({
                text: 'Target Condition Check Passed for Potion: Type=\'player_in_location\', Negated=false',
                type: 'internal'
            });
            expect(result.messages).toContainEqual({
                text: "Target Condition Check Failed for Potion: Type='health_below_max', Negated=false, Reason='Target is already at full health.'",
                type: 'internal'
            });
        });

        it('should use fallback message if condition failure message is missing', () => {
            userEntity.addComponent(new MockPositionComponent({locationId: 'room-B'})); // Fails
            const conditions = [{condition_type: 'player_in_location', locationId: 'room-A'}];
            const options = {
                itemName: 'Lever', checkType: 'Usability',
                fallbackMessages: {usability: 'Cannot use the lever right now.'}
            };
            const result = conditionEvaluationService.evaluateConditions(userEntity, context, conditions, options);
            expect(result.success).toBe(false);
            expect(result.failureMessage).toBe('Cannot use the lever right now.');
        });

        it('should use default fallback message if specific type fallback is missing', () => {
            userEntity.addComponent(new MockPositionComponent({locationId: 'room-B'})); // Fails
            const conditions = [{condition_type: 'player_in_location', locationId: 'room-A'}];
            const options = {
                itemName: 'Button', checkType: 'Target',
                fallbackMessages: {default: 'A generic condition failed.'}
            };
            const result = conditionEvaluationService.evaluateConditions(userEntity, context, conditions, options);
            expect(result.success).toBe(false);
            expect(result.failureMessage).toBe('A generic condition failed.');
        });

        it('should use hardcoded default message if no fallbacks provided', () => {
            userEntity.addComponent(new MockPositionComponent({locationId: 'room-B'})); // Fails
            const conditions = [{condition_type: 'player_in_location', locationId: 'room-A'}];
            const options = {itemName: 'Gadget', checkType: 'Generic'};
            const result = conditionEvaluationService.evaluateConditions(userEntity, context, conditions, options);
            expect(result.success).toBe(false);
            expect(result.failureMessage).toBe('Condition failed for Gadget.');
        });

        it('should handle negated conditions correctly (passing case)', () => {
            userEntity.addComponent(new MockPositionComponent({locationId: 'room-B'})); // Fails original check
            const conditions = [{condition_type: 'player_in_location', locationId: 'room-A', negate: true}];
            const result = conditionEvaluationService.evaluateConditions(userEntity, context, conditions);
            expect(result.success).toBe(true);
            expect(result.messages).toContainEqual({
                text: "Generic Condition Check Passed for (unknown item): Type='player_in_location', Negated=true",
                type: 'internal'
            });
        });

        it('should handle negated conditions correctly (failing case)', () => {
            userEntity.addComponent(new MockPositionComponent({locationId: 'room-A'})); // Passes original check
            const conditions = [{
                condition_type: 'player_in_location',
                locationId: 'room-A',
                negate: true,
                failure_message: "Must not be in Room A."
            }];
            const result = conditionEvaluationService.evaluateConditions(userEntity, context, conditions);
            expect(result.success).toBe(false);
            expect(result.failureMessage).toBe('Must not be in Room A.');
            expect(result.messages).toContainEqual({
                text: "Generic Condition Check Failed for (unknown item): Type='player_in_location', Negated=true, Reason='Must not be in Room A.'",
                type: 'internal'
            });
        });

        // --- Test 1 Fix ---
        it('should handle failure gracefully when component class is not registered (no exception)', () => {
            // Setup: 'ErrorProne' component is requested but not registered properly
            mockEntityManager.componentRegistry.delete('ErrorProne'); // Ensure it's not registered

            const conditions = [
                {
                    condition_type: 'target_has_component',
                    component_name: 'ErrorProne',
                    failure_message: 'Problem checking component.'
                }
            ];
            const options = {itemName: 'RiskyDevice', checkType: 'Target'};
            const expectedTargetName = getExpectedObjectName(targetEntity);

            const result = conditionEvaluationService.evaluateConditions(targetEntity, context, conditions, options);

            // Assertions for the *actual* behavior (normal failure, not exception)
            expect(result.success).toBe(false);
            expect(result.failureMessage).toBe('Problem checking component.');
            // Check console warning was logged by target_has_component check itself
            expect(consoleWarnSpy).toHaveBeenCalledWith('ConditionEvaluationService: No component class registered for name "ErrorProne". Cannot check \'target_has_component\'.');
            // Check the internal failure message generated by evaluateConditions
            expect(result.messages).toContainEqual({
                text: `Checking Target conditions for RiskyDevice against ${expectedTargetName}...`,
                type: 'internal'
            });
            expect(result.messages).toContainEqual({
                text: "Target Condition Check Failed for RiskyDevice: Type='target_has_component', Negated=false, Reason='Problem checking component.'",
                type: 'internal' // Normal failure log, not error type
            });
            // Ensure NO error message was pushed (because no exception was caught)
            expect(result.messages).not.toContainEqual(expect.objectContaining({type: 'error'}));
            // Ensure console.error was NOT called (no exception caught)
            expect(consoleErrorSpy).not.toHaveBeenCalled();
        });

        // --- Test getObjectName via logging ---
        it('should log the correct object name for an Entity with a Name component', () => {
            targetEntity.addComponent(new MockNameComponent({value: "Grumpy Goblin"}));
            const expectedName = targetEntity.getDisplayName(); // Use helper
            const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [{condition_type: 'health_below_max'}]); // Add a dummy condition
            expect(result.messages).toContainEqual({
                text: `Checking Generic conditions for (unknown item) against ${expectedName}...`,
                type: 'internal'
            });
        });

        it('should log the correct object name for an Entity without a Name component', () => {
            const expectedName = targetEntity.getDisplayName(); // Should be Entity(targetNPC)
            const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [{condition_type: 'health_below_max'}]); // Add dummy condition
            expect(result.messages).toContainEqual({
                text: `Checking Generic conditions for (unknown item) against ${expectedName}...`,
                type: 'internal'
            });
            expect(expectedName).toBe('Entity(targetNPC)'); // Verify default name
        });

        it('should log the correct object name for a Connection with a name', () => {
            targetConnection.name = "Ancient Stone Door";
            const expectedName = getExpectedObjectName(targetConnection);
            const result = conditionEvaluationService.evaluateConditions(targetConnection, context, [{
                condition_type: 'connection_state_is',
                state: 'locked'
            }]);
            expect(result.messages).toContainEqual({
                text: `Checking Generic conditions for (unknown item) against ${expectedName}...`,
                type: 'internal'
            });
            expect(expectedName).toBe('Ancient Stone Door');
        });

        it('should log the correct object name for a Connection without name (using direction)', () => {
            const expectedName = getExpectedObjectName(targetConnection); // name is undefined, should use direction
            const result = conditionEvaluationService.evaluateConditions(targetConnection, context, [{
                condition_type: 'connection_state_is',
                state: 'locked'
            }]);
            expect(result.messages).toContainEqual({
                text: `Checking Generic conditions for (unknown item) against ${expectedName}...`,
                type: 'internal'
            });
            expect(expectedName).toBe('north');
        });

        it('should log the correct object name for a Connection without name or direction (using ID)', () => {
            const unnamedConnection = {connectionId: 'conn-mysterious', target: 'loc-void', state: 'closed'};
            const expectedName = getExpectedObjectName(unnamedConnection);
            const result = conditionEvaluationService.evaluateConditions(unnamedConnection, context, [{
                condition_type: 'connection_state_is',
                state: 'closed'
            }]);
            expect(result.messages).toContainEqual({
                text: `Checking Generic conditions for (unknown item) against ${expectedName}...`,
                type: 'internal'
            });
            expect(expectedName).toBe('Connection(conn-mysterious)');
        });

        it('should log "null object" if objectToCheck is null', () => {
            const expectedName = getExpectedObjectName(null);
            const result = conditionEvaluationService.evaluateConditions(null, context, [{
                condition_type: 'player_in_location',
                locationId: 'any'
            }]); // Use condition applicable to user
            expect(result.messages).toContainEqual({
                text: `Checking Generic conditions for (unknown item) against ${expectedName}...`,
                type: 'internal'
            });
            expect(expectedName).toBe('null object');
        });

    });

    // --- #evaluateSingleCondition Tests (via evaluateConditions) ---
    describe('evaluateSingleCondition (via evaluateConditions)', () => {

        // --- player_in_location ---
        describe('player_in_location', () => {
            const condition = {condition_type: 'player_in_location', locationId: 'loc-correct'};

            // --- Test 2 Check ---
            it('should pass if user is in the specified location', () => {
                userEntity.addComponent(new MockPositionComponent({locationId: 'loc-correct'}));
                const result = conditionEvaluationService.evaluateConditions(userEntity, context, [condition]);
                // If this fails, it points to a deeper issue (potentially in getParam/getStringParam)
                expect(result.success).toBe(true);
            });
            // --- End Test 2 Check ---

            it('should fail if user is not in the specified location', () => {
                userEntity.addComponent(new MockPositionComponent({locationId: 'loc-wrong'}));
                const result = conditionEvaluationService.evaluateConditions(userEntity, context, [condition]);
                expect(result.success).toBe(false);
            });

            it('should fail if user is not in any location (locationId is null)', () => {
                userEntity.addComponent(new MockPositionComponent({locationId: null}));
                const result = conditionEvaluationService.evaluateConditions(userEntity, context, [condition]);
                expect(result.success).toBe(false);
            });

            it('should fail if user lacks Position component', () => {
                const result = conditionEvaluationService.evaluateConditions(userEntity, context, [condition]);
                expect(result.success).toBe(false);
            });

            it('should fail if locationId parameter is missing or invalid', () => {
                const result1 = conditionEvaluationService.evaluateConditions(userEntity, context, [{condition_type: 'player_in_location'}]); // Missing
                expect(result1.success).toBe(false);
                const result2 = conditionEvaluationService.evaluateConditions(userEntity, context, [{
                    condition_type: 'player_in_location',
                    locationId: null
                }]); // Null
                expect(result2.success).toBe(false);
                const result3 = conditionEvaluationService.evaluateConditions(userEntity, context, [{
                    condition_type: 'player_in_location',
                    locationId: 123
                }]); // Wrong type
                expect(result3.success).toBe(false);
            });

            // --- Test 3 Check ---
            it('should fail if Position component is not registered', () => {
                mockEntityManager.componentRegistry.delete('Position'); // Unregister
                userEntity.addComponent(new MockPositionComponent({locationId: 'loc-correct'}));
                const result = conditionEvaluationService.evaluateConditions(userEntity, context, [condition]);

                // Primary assertion: The condition must fail
                expect(result.success).toBe(false);

                // Secondary assertion: Check for the warning.
                // NOTE: This might not be reached if the condition fails *before* the registry check
                // (e.g., if getStringParam('locationId') returns null unexpectedly).
                // If this specific expect fails but result.success is false, it reinforces the
                // possibility of an early exit issue affecting Test 2 as well.
                expect(consoleWarnSpy).toHaveBeenCalledWith("ConditionEvaluationService: Position component class not registered.");
            });
            // --- End Test 3 Check ---
        });

        // --- player_state (Not Implemented) ---
        describe('player_state', () => {
            it('should fail and warn as it is not implemented', () => {
                const condition = {condition_type: 'player_state', state: 'sneaking'};
                const result = conditionEvaluationService.evaluateConditions(userEntity, context, [condition]);
                expect(result.success).toBe(false);
                expect(consoleWarnSpy).toHaveBeenCalledWith("ConditionEvaluationService: Condition type 'player_state' ('sneaking') not implemented. Assuming false.");
            });
            it('should fail if state parameter is missing or invalid', () => {
                const result1 = conditionEvaluationService.evaluateConditions(userEntity, context, [{condition_type: 'player_state'}]);
                expect(result1.success).toBe(false);
                const result2 = conditionEvaluationService.evaluateConditions(userEntity, context, [{
                    condition_type: 'player_state',
                    state: null
                }]);
                expect(result2.success).toBe(false);
                const result3 = conditionEvaluationService.evaluateConditions(userEntity, context, [{
                    condition_type: 'player_state',
                    state: 123
                }]);
                expect(result3.success).toBe(false);
            });
        });

        // --- target_has_component ---
        describe('target_has_component', () => {
            const condition = {condition_type: 'target_has_component', component_name: 'Health'};

            it('should pass if target entity has the component', () => {
                targetEntity.addComponent(new MockHealthComponent({}));
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(true);
            });

            it('should fail if target entity does not have the component', () => {
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(false);
            });

            it('should fail if target is not an entity (e.g., a connection)', () => {
                const result = conditionEvaluationService.evaluateConditions(targetConnection, context, [condition]);
                expect(result.success).toBe(false);
            });

            it('should fail if component_name parameter is missing or invalid', () => {
                const result1 = conditionEvaluationService.evaluateConditions(targetEntity, context, [{condition_type: 'target_has_component'}]);
                expect(result1.success).toBe(false);
                const result2 = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    condition_type: 'target_has_component',
                    component_name: null
                }]);
                expect(result2.success).toBe(false);
                const result3 = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    condition_type: 'target_has_component',
                    component_name: true
                }]);
                expect(result3.success).toBe(false);
            });

            it('should fail if component class is not registered', () => {
                mockEntityManager.componentRegistry.delete('Health'); // Unregister
                targetEntity.addComponent(new MockHealthComponent({}));
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(false);
                expect(consoleWarnSpy).toHaveBeenCalledWith('ConditionEvaluationService: No component class registered for name "Health". Cannot check \'target_has_component\'.');
            });
        });

        // --- target_has_property ---
        describe('target_has_property', () => {
            it('should pass if target entity has direct property with expected value', () => {
                targetEntity.customProp = 'testValue';
                const condition = {
                    condition_type: 'target_has_property',
                    property_path: 'customProp',
                    expected_value: 'testValue'
                };
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(true);
            });

            it('should fail if target entity has direct property with different value', () => {
                targetEntity.customProp = 'wrongValue';
                const condition = {
                    condition_type: 'target_has_property',
                    property_path: 'customProp',
                    expected_value: 'testValue'
                };
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(false);
            });

            it('should pass if target entity has nested component property with expected value', () => {
                targetEntity.addComponent(new MockHealthComponent({current: 5, max: 10}));
                const condition = {
                    condition_type: 'target_has_property',
                    property_path: 'Health.current',
                    expected_value: 5
                };
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(true);
            });

            it('should fail if target entity has nested component property with different value', () => {
                targetEntity.addComponent(new MockHealthComponent({current: 8, max: 10}));
                const condition = {
                    condition_type: 'target_has_property',
                    property_path: 'Health.current',
                    expected_value: 5
                };
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(false);
            });

            it('should fail if target entity lacks the component for nested property', () => {
                // MockEntity 'Health' property won't exist if component not added
                delete targetEntity.Health;
                const condition = {
                    condition_type: 'target_has_property',
                    property_path: 'Health.current',
                    expected_value: 5
                };
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(false);
            });

            it('should fail if target entity has component but lacks the specific nested property', () => {
                const healthComp = new MockHealthComponent({current: 8, max: 10});
                targetEntity.addComponent(healthComp);
                delete healthComp.current; // Remove property from the instance
                const condition = {
                    condition_type: 'target_has_property',
                    property_path: 'Health.current',
                    expected_value: 5
                };
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(false); // Actual value will be undefined
            });

            it('should pass if target connection has property with expected value', () => {
                const condition = {
                    condition_type: 'target_has_property',
                    property_path: 'state',
                    expected_value: 'locked'
                };
                const result = conditionEvaluationService.evaluateConditions(targetConnection, context, [condition]);
                expect(result.success).toBe(true);
            });

            it('should fail if target connection has property with different value', () => {
                const condition = {
                    condition_type: 'target_has_property',
                    property_path: 'state',
                    expected_value: 'unlocked'
                };
                const result = conditionEvaluationService.evaluateConditions(targetConnection, context, [condition]);
                expect(result.success).toBe(false);
            });

            it('should fail if target lacks the property path', () => {
                const condition = {
                    condition_type: 'target_has_property',
                    property_path: 'nonExistent.nested',
                    expected_value: 'any'
                };
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(false); // Actual value is undefined
            });

            it('should fail if property_path is missing or invalid', () => {
                const result1 = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    condition_type: 'target_has_property',
                    expected_value: 'any'
                }]);
                expect(result1.success).toBe(false);
                expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Missing property_path or expected_value'));
                const result2 = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    condition_type: 'target_has_property',
                    property_path: null,
                    expected_value: 'any'
                }]);
                expect(result2.success).toBe(false);
                const result3 = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    condition_type: 'target_has_property',
                    property_path: 123,
                    expected_value: 'any'
                }]);
                expect(result3.success).toBe(false); // property_path needs splitting
            });

            it('should fail if expected_value is missing (undefined)', () => {
                const condition = {condition_type: 'target_has_property', property_path: 'id'}; // No expected_value
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(false); // expected_value is undefined
            });

            it('should pass if expected_value is null and actual value is null', () => {
                targetEntity.nullableProp = null;
                const condition = {
                    condition_type: 'target_has_property',
                    property_path: 'nullableProp',
                    expected_value: null
                };
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(true);
            });
            it('should pass if expected_value is 0 and actual value is 0', () => {
                targetEntity.zeroProp = 0;
                const condition = {condition_type: 'target_has_property', property_path: 'zeroProp', expected_value: 0};
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(true);
            });
            it('should pass if expected_value is false and actual value is false', () => {
                targetEntity.falseProp = false;
                const condition = {
                    condition_type: 'target_has_property',
                    property_path: 'falseProp',
                    expected_value: false
                };
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(true);
            });
        });

        // --- target_distance ---
        describe('target_distance', () => {
            const conditionBase = {condition_type: 'target_distance'};

            beforeEach(() => {
                // Setup default positions for most tests
                userEntity.addComponent(new MockPositionComponent({locationId: 'loc-A', x: 1, y: 1}));
                targetEntity.addComponent(new MockPositionComponent({locationId: 'loc-A', x: 4, y: 5})); // Dist = 5
            });

            it('should pass if distance is within max_distance (inclusive)', () => {
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    ...conditionBase,
                    max_distance: 5.0
                }]);
                expect(result.success).toBe(true);
            });

            it('should pass if distance is within min_distance and max_distance', () => {
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    ...conditionBase,
                    min_distance: 4.9,
                    max_distance: 5.1
                }]);
                expect(result.success).toBe(true);
            });

            it('should pass if distance is 0 and range includes 0', () => {
                targetEntity.getComponent(MockPositionComponent).x = 1;
                targetEntity.getComponent(MockPositionComponent).y = 1; // Same pos
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    ...conditionBase,
                    min_distance: 0,
                    max_distance: 1
                }]);
                expect(result.success).toBe(true);
            });

            it('should fail if distance is greater than max_distance', () => {
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    ...conditionBase,
                    max_distance: 4.9
                }]);
                expect(result.success).toBe(false);
            });

            it('should fail if distance is less than min_distance', () => {
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    ...conditionBase,
                    min_distance: 5.1,
                    max_distance: 10
                }]);
                expect(result.success).toBe(false);
            });

            it('should fail if user and target are in different locations', () => {
                targetEntity.getComponent(MockPositionComponent).locationId = 'loc-B';
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    ...conditionBase,
                    max_distance: 10
                }]);
                expect(result.success).toBe(false);
            });

            it('should fail if user lacks Position component', () => {
                userEntity = new MockEntity('playerNoPos');
                context.userEntity = userEntity;
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    ...conditionBase,
                    max_distance: 10
                }]);
                expect(result.success).toBe(false);
            });

            it('should fail if target lacks Position component', () => {
                targetEntity = new MockEntity('targetNoPos');
                context.targetEntityContext = targetEntity;
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    ...conditionBase,
                    max_distance: 10
                }]);
                expect(result.success).toBe(false);
            });

            it('should fail if target is not an entity', () => {
                const result = conditionEvaluationService.evaluateConditions(targetConnection, context, [{
                    ...conditionBase,
                    max_distance: 10
                }]);
                expect(result.success).toBe(false);
                expect(consoleWarnSpy).toHaveBeenCalledWith("ConditionEvaluationService: Condition 'target_distance' used on non-entity target. Condition fails.");
            });

            it('should fail if max_distance is missing or invalid', () => {
                const result1 = conditionEvaluationService.evaluateConditions(targetEntity, context, [{condition_type: 'target_distance'}]); // Missing
                expect(result1.success).toBe(false);
                const result2 = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    condition_type: 'target_distance',
                    max_distance: null
                }]); // null
                expect(result2.success).toBe(false);
                const result3 = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    condition_type: 'target_distance',
                    max_distance: 'five'
                }]); // wrong type
                expect(result3.success).toBe(false);
            });

            it('should fail if max_distance is negative', () => {
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    ...conditionBase,
                    max_distance: -1
                }]);
                expect(result.success).toBe(false);
            });
            it('should fail if min_distance is negative', () => {
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    ...conditionBase,
                    max_distance: 5,
                    min_distance: -1
                }]);
                expect(result.success).toBe(false);
            });
            it('should fail if max_distance is less than min_distance', () => {
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    ...conditionBase,
                    min_distance: 6,
                    max_distance: 5
                }]);
                expect(result.success).toBe(false);
            });

            it('should fail if Position component is not registered', () => {
                mockEntityManager.componentRegistry.delete('Position');
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    ...conditionBase,
                    max_distance: 10
                }]);
                expect(result.success).toBe(false);
                expect(consoleWarnSpy).toHaveBeenCalledWith("ConditionEvaluationService: Position component class not registered.");
            });
        });

        // --- health_below_max ---
        describe('health_below_max', () => {
            const condition = {condition_type: 'health_below_max'};

            it('should pass if target entity current health is less than max', () => {
                targetEntity.addComponent(new MockHealthComponent({current: 5, max: 10}));
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(true);
            });

            it('should fail if target entity current health is equal to max', () => {
                targetEntity.addComponent(new MockHealthComponent({current: 10, max: 10}));
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(false);
            });

            it('should fail if target entity current health is above max', () => {
                const healthComp = new MockHealthComponent({current: 11, max: 10}); // Constructor doesn't clamp in mock
                targetEntity.addComponent(healthComp);
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(false);
            });

            it('should fail if target entity lacks Health component', () => {
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(false);
            });

            it('should fail if target is not an entity', () => {
                const result = conditionEvaluationService.evaluateConditions(targetConnection, context, [condition]);
                expect(result.success).toBe(false);
            });

            it('should fail if Health component is not registered', () => {
                mockEntityManager.componentRegistry.delete('Health');
                targetEntity.addComponent(new MockHealthComponent({current: 5, max: 10}));
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(false);
                expect(consoleWarnSpy).toHaveBeenCalledWith("ConditionEvaluationService: Health component class not registered.");
            });
            it('should fail if health component properties are missing', () => {
                targetEntity.addComponent(new MockHealthComponent({current: 5, max: 10}));
                delete targetEntity.getComponent(MockHealthComponent).current;
                const result1 = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result1.success).toBe(false);

                targetEntity.getComponent(MockHealthComponent).current = 5; // Restore current
                delete targetEntity.getComponent(MockHealthComponent).max;
                const result2 = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result2.success).toBe(false);
            });
        });

        // --- has_status_effect (Not Implemented) ---
        describe('has_status_effect', () => {
            const condition = {condition_type: 'has_status_effect', effect_id: 'poisoned'};
            it('should fail and warn as it is not implemented', () => {
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(false);
                expect(consoleWarnSpy).toHaveBeenCalledWith("ConditionEvaluationService: Condition type 'has_status_effect' ('poisoned') not implemented. Assuming false.");
            });
            it('should fail if effect_id is missing or invalid', () => {
                const result1 = conditionEvaluationService.evaluateConditions(targetEntity, context, [{condition_type: 'has_status_effect'}]);
                expect(result1.success).toBe(false);
                const result2 = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    condition_type: 'has_status_effect',
                    effect_id: null
                }]);
                expect(result2.success).toBe(false);
                const result3 = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    condition_type: 'has_status_effect',
                    effect_id: 123
                }]);
                expect(result3.success).toBe(false);
            });
            it('should fail if target is not an entity', () => {
                const result = conditionEvaluationService.evaluateConditions(targetConnection, context, [condition]);
                expect(result.success).toBe(false);
            });
        });

        // --- attribute_check (Not Implemented) ---
        describe('attribute_check', () => {
            const condition = {
                condition_type: 'attribute_check',
                attribute_id: 'strength',
                comparison: '>=',
                value: 15
            };
            it('should fail and warn as it is not implemented', () => {
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(false);
                expect(consoleWarnSpy).toHaveBeenCalledWith("ConditionEvaluationService: Condition type 'attribute_check' ('strength >= 15') not implemented. Assuming false.");
            });
            it('should fail if required parameters are missing or invalid', () => {
                const result1 = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    condition_type: 'attribute_check',
                    comparison: '>=',
                    value: 10
                }]);
                expect(result1.success).toBe(false);
                const result2 = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    condition_type: 'attribute_check',
                    attribute_id: 'str',
                    value: 10
                }]);
                expect(result2.success).toBe(false);
                const result3 = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    condition_type: 'attribute_check',
                    attribute_id: 'str',
                    comparison: '>='
                }]); // Missing value
                expect(result3.success).toBe(false);
                const result4 = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    condition_type: 'attribute_check',
                    attribute_id: 123,
                    comparison: '>=',
                    value: 10
                }]); // Invalid attribute_id
                expect(result4.success).toBe(false);
                const result5 = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    condition_type: 'attribute_check',
                    attribute_id: 'str',
                    comparison: 55,
                    value: 10
                }]); // Invalid comparison
                expect(result5.success).toBe(false);
                const result6 = conditionEvaluationService.evaluateConditions(targetEntity, context, [{
                    condition_type: 'attribute_check',
                    attribute_id: 'str',
                    comparison: '>=',
                    value: undefined
                }]); // Undefined value
                expect(result6.success).toBe(false);
            });
            it('should fail if target is not an entity', () => {
                const result = conditionEvaluationService.evaluateConditions(targetConnection, context, [condition]);
                expect(result.success).toBe(false);
            });
        });

        // --- connection_state_is ---
        describe('connection_state_is', () => {
            const condition = {condition_type: 'connection_state_is', state: 'locked'};

            it('should pass if connection state matches required state', () => {
                const result = conditionEvaluationService.evaluateConditions(targetConnection, context, [condition]);
                expect(result.success).toBe(true);
            });

            it('should fail if connection state does not match required state', () => {
                targetConnection.state = 'unlocked';
                const result = conditionEvaluationService.evaluateConditions(targetConnection, context, [condition]);
                expect(result.success).toBe(false);
            });

            it('should fail if target is not a connection', () => {
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(false);
            });

            it('should fail if target connection lacks a state property', () => {
                const connectionNoState = {connectionId: 'conn-no-state', direction: 'east'};
                const result = conditionEvaluationService.evaluateConditions(connectionNoState, context, [condition]);
                expect(result.success).toBe(false); // state is undefined, !== 'locked'
            });

            it('should fail if state parameter is missing or invalid', () => {
                const result1 = conditionEvaluationService.evaluateConditions(targetConnection, context, [{condition_type: 'connection_state_is'}]);
                expect(result1.success).toBe(false);
                const result2 = conditionEvaluationService.evaluateConditions(targetConnection, context, [{
                    condition_type: 'connection_state_is',
                    state: null
                }]);
                expect(result2.success).toBe(false);
                const result3 = conditionEvaluationService.evaluateConditions(targetConnection, context, [{
                    condition_type: 'connection_state_is',
                    state: false
                }]);
                expect(result3.success).toBe(false);
            });
        });

        // --- Unknown Condition Type ---
        describe('unknown condition type', () => {
            it('should fail and warn for an unknown condition type', () => {
                const condition = {condition_type: 'does_not_exist', value: true};
                const result = conditionEvaluationService.evaluateConditions(targetEntity, context, [condition]);
                expect(result.success).toBe(false);
                expect(consoleWarnSpy).toHaveBeenCalledWith("ConditionEvaluationService: Encountered unknown condition_type 'does_not_exist'. Assuming condition fails.");
            });
        });
    });
});