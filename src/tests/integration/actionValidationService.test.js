// src/tests/integration/actionValidationService.test.js

/**
 * @jest-environment node
 */
import {describe, expect, test, jest, beforeEach, afterEach} from '@jest/globals';

// --- System Under Test (SUT) ---
import {ActionValidationService} from '../../services/ActionValidationService.js'; // Adjust path if needed

// --- Test Data/Types ---
import Entity from '../../entities/entity.js'; // Needed for test inputs
import {ActionTargetContext} from '../../models/actionTargetContext.js'; // Needed for test inputs
/** @typedef {import('../../types/actionDefinition.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */

// --- Mock Dependencies ---

// Mock EntityManager
const mockEntityManager = {
    getEntityInstance: jest.fn(),
    // Add other methods if ActionValidationService directly uses them (currently doesn't seem likely for the tested paths)
    // Note: getComponentData/hasComponent are used *internally* by createActionValidationContext,
    // but we are mocking the *result* of createActionValidationContextFunction, so we don't need
    // complex mocking of getComponentData/hasComponent on mockEntityManager *for these tests*.
    // However, it's good practice to mock getEntityInstance as it's used for target resolution.
};

// Mock ILogger
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
};

// Mock DomainContextCompatibilityChecker
const mockDomainChecker = {
    check: jest.fn(),
};

// Mock JsonLogicEvaluationService
const mockJsonLogicEvaluator = {
    evaluate: jest.fn(),
    // Add other methods if needed
};

// Mock createActionValidationContextFunction (passed via dependency injection)
const mockContextCreatorFn = jest.fn(); // AC: Must be a mock function

// --- Test Suite ---

describe('Integration Test: ActionValidationService - Prerequisite Validation Step', () => {

    /** @type {ActionValidationService} */
    let service;
    /** @type {Entity} */
    let mockActorEntity;
    /** @type {ActionTargetContext} */
    let mockTargetContext;
    /** @type {ActionDefinition} */
    let mockActionDefWithPrereqs;
    /** @type {ActionDefinition} */
    let mockActionDefWithoutPrereqs;
    /** @type {JsonLogicEvaluationContext} */
    let mockEvaluationContext;

    // --- Test Setup ---
    beforeEach(() => {
        // AC: Reset mocks before each test
        jest.clearAllMocks();

        // AC: Instantiate ActionValidationService with mocked dependencies
        service = new ActionValidationService({
            entityManager: mockEntityManager,
            logger: mockLogger,
            domainContextCompatibilityChecker: mockDomainChecker,
            jsonLogicEvaluationService: mockJsonLogicEvaluator,
            createActionValidationContextFunction: mockContextCreatorFn // AC: Inject the mock function
        });

        // Define Mock Data
        mockActorEntity = new Entity('player-1');
        mockTargetContext = ActionTargetContext.forEntity('target-1'); // Default, can be changed per test

        // Mock Action Definition with Prerequisites
        mockActionDefWithPrereqs = {
            id: 'core:test_action_with_prereqs',
            commandVerb: 'testprereq',
            target_domain: 'environment', // Example domain
            template: 'test {target}',
            prerequisites: [
                {logic: {var: 'actor.components.health.current'}, failure_message: 'Needs health'},
                {logic: {"==": [{var: 'target.id'}, "target-1"]}}
                // More complex rules can be added if needed, but the structure is key here
            ],
            // Other properties omitted for brevity unless needed by tests
        };

        // Mock Action Definition without Prerequisites
        mockActionDefWithoutPrereqs = {
            id: 'core:test_action_no_prereqs',
            commandVerb: 'testnoprereq',
            target_domain: 'none',
            template: 'test',
            prerequisites: [], // Empty array
        };

        // Define the standard mock context object to be returned by the creator function
        mockEvaluationContext = {
            actor: {id: mockActorEntity.id, components: {health: {current: 10}, mock: true}}, // Simplified mock
            target: {id: 'target-1', components: {state: 'idle', mock: true}}, // Simplified mock
            event: null,
            context: {},
            globals: {},
            entities: {}
        };

        // --- Default Mock Behaviors ---
        // Assume domain compatibility passes by default unless a test overrides it
        mockDomainChecker.check.mockReturnValue(true);
        // Assume JSON logic evaluates to true by default unless overridden
        mockJsonLogicEvaluator.evaluate.mockReturnValue(true);
        // Assume context creation succeeds and returns the mock context unless overridden
        mockContextCreatorFn.mockReturnValue(mockEvaluationContext);
        // Assume target entity resolution works if needed (only relevant if prereqs use target)
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
            if (id === 'target-1') {
                return new Entity('target-1'); // Return a mock entity if target ID matches
            }
            return undefined; // Not found otherwise
        });

    });

    // --- Test Cases ---

    // AC-4.1: Prerequisite Check - Context Creator Called
    test('AC-4.1: should call createActionValidationContextFn with correct args when prerequisites exist', () => {
        // Arrange
        // Using mockActionDefWithPrereqs from beforeEach
        // Default mocks: domain check passes, context creator returns mockContext, evaluator passes

        // Act
        service.isValid(mockActionDefWithPrereqs, mockActorEntity, mockTargetContext);

        // Assert
        expect(mockContextCreatorFn).toHaveBeenCalledTimes(1);
        expect(mockContextCreatorFn).toHaveBeenCalledWith(
            mockActorEntity,     // Exact actor entity instance
            mockTargetContext,   // Exact target context instance
            mockEntityManager,   // Exact mock entity manager instance
            mockLogger           // Exact mock logger instance
        );
        // Also check that the evaluator was called (part of the prerequisite path)
        expect(mockJsonLogicEvaluator.evaluate).toHaveBeenCalled();
    });

    // AC-4.2: Prerequisite Check - Evaluator Called with Correct Context
    test('AC-4.2: should call JsonLogicEvaluator.evaluate with rules and the context from createActionValidationContextFn', () => {
        // Arrange
        // Using mockActionDefWithPrereqs and mockEvaluationContext from beforeEach
        // Default mocks: domain check passes, context creator returns mockContext, evaluator passes

        // Act
        service.isValid(mockActionDefWithPrereqs, mockActorEntity, mockTargetContext);

        // Assert
        // Verify context creator was called (precondition for this test)
        expect(mockContextCreatorFn).toHaveBeenCalledTimes(1);
        expect(mockContextCreatorFn).toHaveReturnedWith(mockEvaluationContext);

        // Verify evaluator was called for each prerequisite rule
        expect(mockJsonLogicEvaluator.evaluate).toHaveBeenCalledTimes(mockActionDefWithPrereqs.prerequisites.length);

        // Verify evaluator was called with the correct arguments for the first rule
        expect(mockJsonLogicEvaluator.evaluate).toHaveBeenNthCalledWith(
            1,
            mockActionDefWithPrereqs.prerequisites[0].logic, // The first rule object
            mockEvaluationContext // The exact context object returned by the creator function
        );
        // Verify evaluator was called with the correct arguments for the second rule
        expect(mockJsonLogicEvaluator.evaluate).toHaveBeenNthCalledWith(
            2,
            mockActionDefWithPrereqs.prerequisites[1].logic, // The second rule object
            mockEvaluationContext // The exact context object returned by the creator function
        );
    });

    // AC-4.3: Prerequisite Check - Passes
    test('AC-4.3: should return true when prerequisites exist, context creation succeeds, and evaluation passes', () => {
        // Arrange
        // Using mockActionDefWithPrereqs from beforeEach
        // Default mocks: domain check passes, context creator succeeds, evaluator returns true
        mockJsonLogicEvaluator.evaluate.mockReturnValue(true); // Explicitly set for clarity

        // Act
        const result = service.isValid(mockActionDefWithPrereqs, mockActorEntity, mockTargetContext);

        // Assert
        expect(result).toBe(true);
        // Verify the collaborators were involved
        expect(mockDomainChecker.check).toHaveBeenCalledTimes(1);
        expect(mockContextCreatorFn).toHaveBeenCalledTimes(1);
        expect(mockJsonLogicEvaluator.evaluate).toHaveBeenCalledTimes(mockActionDefWithPrereqs.prerequisites.length);
    });

    // AC-4.4: Prerequisite Check - Fails
    test('AC-4.4: should return false when prerequisite evaluation fails, but still calls collaborators', () => {
        // Arrange
        // Using mockActionDefWithPrereqs from beforeEach
        // Default mocks: domain check passes, context creator succeeds
        mockJsonLogicEvaluator.evaluate.mockReturnValue(false); // AC: Make evaluation fail

        // Act
        const result = service.isValid(mockActionDefWithPrereqs, mockActorEntity, mockTargetContext);

        // Assert
        expect(result).toBe(false);

        // AC: Verify collaborators were still called correctly *before* the failure return
        expect(mockDomainChecker.check).toHaveBeenCalledTimes(1); // Domain checked first
        expect(mockContextCreatorFn).toHaveBeenCalledTimes(1); // Context was created
        expect(mockContextCreatorFn).toHaveBeenCalledWith(mockActorEntity, mockTargetContext, mockEntityManager, mockLogger);
        expect(mockJsonLogicEvaluator.evaluate).toHaveBeenCalledTimes(1); // Evaluation was attempted (stops after first failure)
        expect(mockJsonLogicEvaluator.evaluate).toHaveBeenCalledWith(
            mockActionDefWithPrereqs.prerequisites[0].logic, // Called with the first rule
            mockEvaluationContext // Called with the created context
        );
    });

    // AC-4.5: No Prerequisites - Context Creator NOT Called
    test('AC-4.5: should return true and NOT call context creator or evaluator if action has no prerequisites', () => {
        // Arrange
        // Using mockActionDefWithoutPrereqs from beforeEach
        // Default mocks: domain check passes
        mockActionDefWithoutPrereqs.prerequisites = []; // Ensure it's empty

        // Act
        const result = service.isValid(mockActionDefWithoutPrereqs, mockActorEntity, ActionTargetContext.noTarget()); // Use matching target context

        // Assert
        expect(result).toBe(true); // Should pass assuming domain check passes

        // AC: Assert collaborators NOT called for prerequisite step
        expect(mockContextCreatorFn).not.toHaveBeenCalled();
        expect(mockJsonLogicEvaluator.evaluate).not.toHaveBeenCalled();

        // Verify domain check *was* still called
        expect(mockDomainChecker.check).toHaveBeenCalledTimes(1);
    });

    test('AC-4.5 variation: should NOT call context creator or evaluator if prerequisites property is missing', () => {
        // Arrange
        const actionDefMissingPrereqs = {...mockActionDefWithoutPrereqs};
        delete actionDefMissingPrereqs.prerequisites; // Remove the property entirely
        mockDomainChecker.check.mockReturnValue(true); // Ensure domain check passes

        // Act
        const result = service.isValid(actionDefMissingPrereqs, mockActorEntity, ActionTargetContext.noTarget());

        // Assert
        expect(result).toBe(true);
        expect(mockContextCreatorFn).not.toHaveBeenCalled();
        expect(mockJsonLogicEvaluator.evaluate).not.toHaveBeenCalled();
        expect(mockDomainChecker.check).toHaveBeenCalledTimes(1);
    });

    test('AC-4.5 variation: should return true and NOT call evaluator if prerequisites is not an array (logs warning)', () => { // Updated description slightly
        // Arrange
        const actionDefInvalidPrereqs = {
            ...mockActionDefWithPrereqs, // Start with definition that normally *would* have prereqs
            prerequisites: {logic: "this is not an array"} // Set to non-array
        };
        // @ts-ignore // Ignore type error for testing invalid data shape
        mockDomainChecker.check.mockReturnValue(true); // Ensure domain check passes
        mockContextCreatorFn.mockReturnValue(mockEvaluationContext); // Assume context creation would succeed if called

        // Act
        // @ts-ignore
        const result = service.isValid(actionDefInvalidPrereqs, mockActorEntity, mockTargetContext); // mockTargetContext is type 'entity'

        // Assert
        expect(result).toBe(true); // << Should still pass (service logs warning and skips evaluation)

        // Context *is* created because targetContext.type !== 'none'
        expect(mockContextCreatorFn).toHaveBeenCalledTimes(1); // << CORRECTED: It IS called

        // Evaluation is *not* called because the effective prerequisite list is empty
        expect(mockJsonLogicEvaluator.evaluate).not.toHaveBeenCalled(); // << CORRECT: Evaluation is skipped

        expect(mockDomainChecker.check).toHaveBeenCalledTimes(1);
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("property, but it's not an array"));
    });


    // AC-4.6: Error During Context Creation
    test('AC-4.6: should return false and log error if createActionValidationContextFn throws', () => {
        // Arrange
        // Using mockActionDefWithPrereqs
        const contextError = new Error('Context Creation Failed');
        // AC: Configure mockContextCreatorFn to throw
        mockContextCreatorFn.mockImplementation(() => {
            throw contextError;
        });
        mockDomainChecker.check.mockReturnValue(true); // Ensure domain check passes first

        // Act
        const result = service.isValid(mockActionDefWithPrereqs, mockActorEntity, mockTargetContext);

        // Assert
        expect(result).toBe(false); // AC: service.isValid returns false

        // Verify interaction attempts
        expect(mockDomainChecker.check).toHaveBeenCalledTimes(1);
        expect(mockContextCreatorFn).toHaveBeenCalledTimes(1); // Attempted to create context
        expect(mockContextCreatorFn).toHaveBeenCalledWith(mockActorEntity, mockTargetContext, mockEntityManager, mockLogger);
        expect(mockJsonLogicEvaluator.evaluate).not.toHaveBeenCalled(); // Should not be called if context creation failed

        // AC: Assert mockLogger.error was called
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining('Error assembling evaluation context'), // Check for descriptive message
            expect.objectContaining({ // Check for context object with error details
                error: contextError.message,
                stack: contextError.stack,
            })
        );
    });

    // Optional: Test edge case where prerequisite logic is invalid (not an object)
    test('should return false if a prerequisite has invalid logic structure', () => {
        // Arrange
        const invalidPrereqAction = {
            ...mockActionDefWithPrereqs,
            prerequisites: [
                {logic: "not-an-object"} // Invalid logic structure
            ]
        };
        // @ts-ignore
        mockDomainChecker.check.mockReturnValue(true);
        mockContextCreatorFn.mockReturnValue(mockEvaluationContext); // Context creation succeeds

        // Act
        // @ts-ignore
        const result = service.isValid(invalidPrereqAction, mockActorEntity, mockTargetContext);

        // Assert
        expect(result).toBe(false);
        expect(mockContextCreatorFn).toHaveBeenCalledTimes(1); // Context created
        expect(mockJsonLogicEvaluator.evaluate).not.toHaveBeenCalled(); // Evaluator not called with invalid rule
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining("Prerequisite on action "));
    });

    // Optional: Test edge case where target entity resolution fails *during* prerequisite check
    test('should return false if target entity required by prereqs cannot be resolved', () => {
        // Arrange
        const actionRequiresTarget = {
            ...mockActionDefWithPrereqs,
            prerequisites: [{logic: {var: 'target.components.some_component'}}] // Example prereq using target
        };
        const targetId = 'nonexistent-target';
        mockTargetContext = ActionTargetContext.forEntity(targetId);
        mockDomainChecker.check.mockReturnValue(true); // Domain check passes

        // AC: Target Resolution Fails for the specific target ID
        mockEntityManager.getEntityInstance.mockImplementation((id) => {
            if (id === mockActorEntity.id) {
                // Assume actor *is* found for this test case, otherwise context creation might fail earlier if needed
                return mockActorEntity;
            }
            if (id === targetId) {
                return undefined; // Simulate target not found
            }
            return undefined; // Default undefined
        });


        // Act
        const result = service.isValid(actionRequiresTarget, mockActorEntity, mockTargetContext);

        // Assert
        // 1. Check the final result
        expect(result).toBe(false);

        // 2. Verify expected calls leading up to the failure point
        expect(mockDomainChecker.check).toHaveBeenCalledTimes(1);

        // It's called for the actor AND the target before failing
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledTimes(2); // << CORRECTED EXPECTATION
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockActorEntity.id); // Called for actor
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(targetId); // Called for target

        // 3. Verify the specific error log for target resolution failure occurred
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Required target entity '${targetId}' could not be resolved for action '${actionRequiresTarget.id}'.`) // Use action ID
        );
        expect(mockLogger.error).toHaveBeenCalledTimes(1); // Ensure only this error was logged

        // 4. Verify that subsequent steps (context creation, evaluation) were NOT reached due to early return
        expect(mockContextCreatorFn).not.toHaveBeenCalled();
        expect(mockJsonLogicEvaluator.evaluate).not.toHaveBeenCalled(); // Ensure correct variable name is used

    });

}); // End describe ActionValidationService Integration Test