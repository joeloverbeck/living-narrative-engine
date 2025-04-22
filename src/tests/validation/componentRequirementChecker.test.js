// src/validation/componentRequirementChecker.test.js
/**
 * @jest-environment node
 */
import {describe, test, expect, jest, beforeEach, beforeAll, afterAll} from '@jest/globals';
import {ComponentRequirementChecker} from '../../validation/componentRequirementChecker.js';
import Entity from '../../entities/entity.js'; // Import the actual Entity class for test doubles

// --- Mock ILogger ---
// Create a fully functional mock logger implementing the ILogger interface
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// --- Helper to create Test Entities ---
// Uses the actual Entity class to ensure the `hasComponent` method works as expected
const createTestEntity = (id, componentIds = []) => {
    const entity = new Entity(id);
    componentIds.forEach(compId => {
        // Add empty object as data, the checker only cares about presence via hasComponent
        entity.addComponent(compId, {});
    });
    // Spy on the actual hasComponent method for potential assertion, though usually we just check the result
    jest.spyOn(entity, 'hasComponent');
    return entity;
};


// --- Test Suite ---
describe('ComponentRequirementChecker', () => {
    let checker;

    // Reset mocks before each test
    beforeEach(() => {
        jest.clearAllMocks(); // Clears call counts and implementations for all mocks
        // Re-create the checker instance for each test to ensure isolation
        checker = new ComponentRequirementChecker({logger: mockLogger});
        // Clear the initial info log call from the constructor to simplify assertions in tests
        mockLogger.info.mockClear();
    });

    // --- Constructor Tests ---
    describe('Constructor', () => {
        test('should initialize successfully with a valid logger', () => {
            // Clear mocks again specifically for this constructor test
            jest.clearAllMocks();
            const instance = new ComponentRequirementChecker({logger: mockLogger});
            expect(instance).toBeInstanceOf(ComponentRequirementChecker);
            expect(mockLogger.info).toHaveBeenCalledTimes(1);
            expect(mockLogger.info).toHaveBeenCalledWith("ComponentRequirementChecker initialized.");
        });

        test('should throw error if logger dependency is missing', () => {
            expect(() => new ComponentRequirementChecker({})).toThrow(
                "ComponentRequirementChecker requires a valid ILogger instance."
            );
            expect(() => new ComponentRequirementChecker({logger: null})).toThrow(
                "ComponentRequirementChecker requires a valid ILogger instance."
            );
        });

        test('should throw error if logger dependency is invalid (missing methods)', () => {
            const invalidLogger = {info: jest.fn()}; // Missing other methods
            expect(() => new ComponentRequirementChecker({logger: invalidLogger})).toThrow(
                "ComponentRequirementChecker requires a valid ILogger instance."
            );
            const invalidLogger2 = {debug: 'not a function'};
            expect(() => new ComponentRequirementChecker({logger: invalidLogger2})).toThrow(
                "ComponentRequirementChecker requires a valid ILogger instance."
            );
        });
    });

    // --- Check Method Tests ---
    describe('check method', () => {
        const context = "action 'test:action'";
        const role = 'actor';
        let entity;

        // --- Success Cases ---
        describe('Success Scenarios', () => {
            test('should return true when entity meets all required components and has no forbidden ones', () => {
                entity = createTestEntity('player1', ['core:health', 'core:position']);
                const required = ['core:health', 'core:position'];
                const forbidden = ['status:stunned'];
                const result = checker.check(entity, required, forbidden, role, context);

                expect(result).toBe(true);
                expect(mockLogger.debug).toHaveBeenCalledTimes(1);
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Requirement Check Passed: Actor player1 meets component requirements for context '${context}'`)
                );
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
            });

            test('should return true with empty required list and no forbidden components present', () => {
                entity = createTestEntity('player2', ['core:mana']);
                const required = [];
                const forbidden = ['status:frozen'];
                const result = checker.check(entity, required, forbidden, role, context);

                expect(result).toBe(true);
                expect(mockLogger.debug).toHaveBeenCalledTimes(1);
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Requirement Check Passed: Actor player2 meets component requirements for context '${context}'`)
                );
            });

            test('should return true with empty forbidden list and all required components present', () => {
                entity = createTestEntity('player3', ['core:inventory', 'skill:mining']);
                const required = ['core:inventory'];
                const forbidden = [];
                const result = checker.check(entity, required, forbidden, 'target', context); // Changed role for variety

                expect(result).toBe(true);
                expect(mockLogger.debug).toHaveBeenCalledTimes(1);
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Requirement Check Passed: Target player3 meets component requirements for context '${context}'`)
                );
            });

            test('should return true with both required and forbidden lists empty', () => {
                entity = createTestEntity('npc1', ['ai:wander']);
                const required = [];
                const forbidden = [];
                const result = checker.check(entity, required, forbidden, role, context);

                expect(result).toBe(true);
                expect(mockLogger.debug).toHaveBeenCalledTimes(1);
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Requirement Check Passed: Actor npc1 meets component requirements for context '${context}'`)
                );
            });

            test('should return true with null/undefined required list and no forbidden components present', () => {
                entity = createTestEntity('player4', ['core:mana']);
                const required = null; // Test null
                const forbidden = ['status:frozen'];
                const result = checker.check(entity, required, forbidden, role, context);
                expect(result).toBe(true);
                expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Logged once

                const requiredUndef = undefined; // Test undefined
                const result2 = checker.check(entity, requiredUndef, forbidden, role, context);
                expect(result2).toBe(true);
                expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Logged again
            });

            test('should return true with null/undefined forbidden list and all required components present', () => {
                entity = createTestEntity('player5', ['core:inventory']);
                const required = ['core:inventory'];
                const forbidden = null; // Test null
                const result = checker.check(entity, required, forbidden, role, context);
                expect(result).toBe(true);
                expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Logged once

                const forbiddenUndef = undefined; // Test undefined
                const result2 = checker.check(entity, required, forbiddenUndef, role, context);
                expect(result2).toBe(true);
                expect(mockLogger.debug).toHaveBeenCalledTimes(2); // Logged again
            });

            test('should return true with both lists null/undefined', () => {
                entity = createTestEntity('npc2');
                const required = null;
                const forbidden = undefined;
                const result = checker.check(entity, required, forbidden, role, context);
                expect(result).toBe(true);
                expect(mockLogger.debug).toHaveBeenCalledTimes(1);
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Requirement Check Passed: Actor npc2 meets component requirements for context '${context}'`)
                );
            });
        });

        // --- Failure Cases ---
        describe('Failure Scenarios', () => {
            test('should return false if entity is missing one required component', () => {
                entity = createTestEntity('mob1', ['core:health']); // Missing 'aggro:target'
                const required = ['core:health', 'aggro:target'];
                const forbidden = [];
                const result = checker.check(entity, required, forbidden, 'target', context);

                expect(result).toBe(false);
                expect(mockLogger.debug).toHaveBeenCalledTimes(1);
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Requirement Check Failed: Target mob1 is missing required component 'aggro:target' for context '${context}'`)
                );
                expect(mockLogger.warn).not.toHaveBeenCalled();
                expect(mockLogger.error).not.toHaveBeenCalled();
            });

            test('should return false if entity is missing multiple required components', () => {
                entity = createTestEntity('mob2', ['core:position']); // Missing 'core:health', 'aggro:target'
                const required = ['core:health', 'aggro:target', 'core:position'];
                const forbidden = [];
                const result = checker.check(entity, required, forbidden, role, context);

                expect(result).toBe(false);
                // Check stops on the first missing required component
                expect(mockLogger.debug).toHaveBeenCalledTimes(1);
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Requirement Check Failed: Actor mob2 is missing required component 'core:health' for context '${context}'`)
                );
            });

            test('should return false if entity has one forbidden component', () => {
                entity = createTestEntity('player_stunned', ['core:health', 'status:stunned']);
                const required = ['core:health'];
                const forbidden = ['status:stunned', 'status:frozen'];
                const result = checker.check(entity, required, forbidden, role, context);

                expect(result).toBe(false);
                expect(mockLogger.debug).toHaveBeenCalledTimes(1);
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Requirement Check Failed: Actor player_stunned has forbidden component 'status:stunned' for context '${context}'`)
                );
            });

            test('should return false if entity has multiple forbidden components', () => {
                entity = createTestEntity('player_debuffed', ['core:health', 'status:stunned', 'status:poisoned']);
                const required = ['core:health'];
                const forbidden = ['status:poisoned', 'status:stunned']; // Order matters for which log appears first
                const result = checker.check(entity, required, forbidden, role, context);

                expect(result).toBe(false);
                // Check stops on the first forbidden component found
                expect(mockLogger.debug).toHaveBeenCalledTimes(1);
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Requirement Check Failed: Actor player_debuffed has forbidden component 'status:poisoned' for context '${context}'`)
                );
            });

            test('should return false if entity meets required but also has forbidden components', () => {
                entity = createTestEntity('mixed_status', ['core:health', 'core:position', 'status:frozen']);
                const required = ['core:health', 'core:position'];
                const forbidden = ['status:frozen'];
                const result = checker.check(entity, required, forbidden, role, context);

                expect(result).toBe(false);
                expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Should log failure due to forbidden
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Requirement Check Failed: Actor mixed_status has forbidden component 'status:frozen' for context '${context}'`)
                );
            });
        });

        // --- Invalid Input Cases ---
        describe('Invalid Inputs', () => {
            test('should return false and log error if entity is null', () => {
                const result = checker.check(null, ['req1'], [], role, context);
                expect(result).toBe(false);
                expect(mockLogger.error).toHaveBeenCalledTimes(1);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`ComponentRequirementChecker.check: Called with invalid entity object for role '${role}' in context '${context}'`)
                );
                expect(mockLogger.debug).not.toHaveBeenCalled(); // No success/fail check logs
            });

            test('should return false and log error if entity is undefined', () => {
                const result = checker.check(undefined, ['req1'], [], role, context);
                expect(result).toBe(false);
                expect(mockLogger.error).toHaveBeenCalledTimes(1);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`ComponentRequirementChecker.check: Called with invalid entity object for role '${role}' in context '${context}'`)
                );
                expect(mockLogger.debug).not.toHaveBeenCalled();
            });

            test('should return false and log error if entity is not an object with id/hasComponent', () => {
                const invalidEntity = {someProp: 'value'}; // Missing id and hasComponent
                const result = checker.check(invalidEntity, ['req1'], [], role, context);
                expect(result).toBe(false);
                expect(mockLogger.error).toHaveBeenCalledTimes(1);
                expect(mockLogger.error).toHaveBeenCalledWith(
                    expect.stringContaining(`ComponentRequirementChecker.check: Called with invalid entity object for role '${role}' in context '${context}'`)
                );
                expect(mockLogger.debug).not.toHaveBeenCalled();
            });

            test('should log warning and skip invalid component ID in required list', () => {
                entity = createTestEntity('entity_inv_req', ['core:health']);
                const required = ['core:health', '', ' ', null, 'valid:comp']; // Add various invalid IDs
                const forbidden = [];
                // It should fail because 'valid:comp' is missing, but *after* logging warnings
                const result = checker.check(entity, required, forbidden, role, context);

                expect(result).toBe(false); // Fails on missing 'valid:comp'
                expect(mockLogger.warn).toHaveBeenCalledTimes(3); // Warn for '', ' ', null
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    expect.stringContaining(`Warning: Invalid component ID found in required list for ${role} (entity ${entity.id}) in context '${context}'. Skipping check for this ID: ""`));
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    expect.stringContaining(`Warning: Invalid component ID found in required list for ${role} (entity ${entity.id}) in context '${context}'. Skipping check for this ID: " "`)
                );
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    expect.stringContaining(`Warning: Invalid component ID found in required list for ${role} (entity ${entity.id}) in context '${context}'. Skipping check for this ID: "null"`)
                );
                expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Logs the failure for 'valid:comp'
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Requirement Check Failed: Actor ${entity.id} is missing required component 'valid:comp' for context '${context}'`)
                );
                expect(mockLogger.error).not.toHaveBeenCalled();
            });

            test('should log warning and skip invalid component ID in forbidden list', () => {
                entity = createTestEntity('entity_inv_forbid', ['core:health', 'valid:forbidden']);
                const required = ['core:health'];
                const forbidden = [' ', '', undefined, 'valid:forbidden']; // Add various invalid IDs
                // It should fail because 'valid:forbidden' is present, but *after* logging warnings
                const result = checker.check(entity, required, forbidden, role, context);

                expect(result).toBe(false); // Fails on present 'valid:forbidden'
                expect(mockLogger.warn).toHaveBeenCalledTimes(3); // Warn for ' ', '', undefined
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    expect.stringContaining(`Warning: Invalid component ID found in forbidden list for ${role} (entity ${entity.id}) in context '${context}'. Skipping check for this ID: " "`)
                );
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    expect.stringContaining(`Warning: Invalid component ID found in forbidden list for ${role} (entity ${entity.id}) in context '${context}'. Skipping check for this ID: ""`)
                );
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    expect.stringContaining(`Warning: Invalid component ID found in forbidden list for ${role} (entity ${entity.id}) in context '${context}'. Skipping check for this ID: "undefined"`)
                );
                expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Logs the failure for 'valid:forbidden'
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Requirement Check Failed: Actor ${entity.id} has forbidden component 'valid:forbidden' for context '${context}'`)
                );
                expect(mockLogger.error).not.toHaveBeenCalled();
            });

            test('should pass if only invalid component IDs are in lists', () => {
                entity = createTestEntity('entity_only_invalid', ['core:health']);
                const required = ['', null];
                const forbidden = [undefined, ' '];
                const result = checker.check(entity, required, forbidden, role, context);

                expect(result).toBe(true); // Passes because no *valid* requirements failed
                expect(mockLogger.warn).toHaveBeenCalledTimes(4); // 2 for required, 2 for forbidden
                expect(mockLogger.debug).toHaveBeenCalledTimes(1); // Logs success at the end
                expect(mockLogger.debug).toHaveBeenCalledWith(
                    expect.stringContaining(`Requirement Check Passed: Actor ${entity.id} meets component requirements for context '${context}'.`)
                );
                expect(mockLogger.error).not.toHaveBeenCalled();
            });
        });
    });
});