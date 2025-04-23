// src/tests/services/actionValidationService.actorComponents.test.js

/**
 * @jest-environment node
 */

import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from "@jest/globals";

// --- Service Under Test ---
import {ActionValidationService} from '../../services/actionValidationService.js';

// --- Models/Types ---
import {ActionTargetContext} from '../../models/actionTargetContext.js';
// Assuming Entity is a class or you have a way to create mock entities
// import { Entity } from '../../entities/entity.js'; // Optional: if needed for typing or complex mocks

// --- Mocks Needed ---
// Mocks are defined and instantiated in beforeEach

// --- Test Suite ---
// NOTE: The tests below have been rewritten to match the provided ActionValidationService.isValid implementation,
// which focuses on domain compatibility, entity resolution, and JsonLogic prerequisites,
// rather than the direct component checks implied by the original file name.
describe('ActionValidationService: Core Validation Logic', () => {

    // --- Mock Variables ---
    // Declare variables in the describe scope to be accessible in all tests
    let mockEntityManager;
    let mockLogger;
    let mockDomainContextCompatibilityChecker;
    let mockJsonLogicEvaluationService; // <-- Correct dependency
    let mockCreateActionValidationContext; // <-- Correct dependency
    let actionValidationService; // Instance of the service under test

    // --- Mock Entity Helper ---
    // Helper to create a basic mock entity for tests
    const createMockEntity = (id, components = []) => {
        const componentSet = new Set(components);
        return {
            id: id,
            hasComponent: jest.fn((componentId) => componentSet.has(componentId)),
            // Add other methods/properties if needed by createActionValidationContext or JsonLogic
            getComponent: jest.fn((componentId) => componentSet.has(componentId) ? {id: componentId, /* mock component data */} : undefined),
            // Example properties that might be used in JsonLogic context
            name: `Mock Entity ${id}`,
            locationId: 'location1',
        };
    };

    // --- Test Setup ---
    beforeEach(() => {
        // Reset mocks and create fresh instances for each test

        // Mock Logger
        mockLogger = {
            info: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        };

        // Mock EntityManager
        const mockEntities = new Map(); // Store mock entities for consistent resolution
        mockEntityManager = {
            getEntityInstance: jest.fn((id) => mockEntities.get(id)),
            // Helper to add entities for testing resolution
            _addEntity: (entity) => mockEntities.set(entity.id, entity),
        };

        // Mock DomainContextCompatibilityChecker (Required by constructor)
        mockDomainContextCompatibilityChecker = {
            check: jest.fn().mockReturnValue(true), // Default to success
        };

        // Mock JsonLogicEvaluationService (Required by constructor)
        mockJsonLogicEvaluationService = {
            evaluate: jest.fn().mockReturnValue(true), // Default to success
        };

        // Mock createActionValidationContext function (Required by constructor)
        mockCreateActionValidationContext = jest.fn().mockImplementation(
            (actor, targetCtx, entityManager, logger) => {
                // Create a realistic-looking context for JsonLogic evaluation
                let targetEntity = null;
                if (targetCtx.type === 'entity' && targetCtx.entityId) {
                    targetEntity = entityManager.getEntityInstance(targetCtx.entityId);
                }
                // Basic context structure - customize if your JsonLogic needs more
                return {
                    actor: {
                        id: actor.id,
                        // Include relevant actor props for rules
                        name: actor.name,
                        locationId: actor.locationId,
                        // Potentially add components if rules check them:
                        // components: Array.from(actor.componentSet || []), // Assuming componentSet exists
                    },
                    target: targetEntity ? {
                        id: targetEntity.id,
                        name: targetEntity.name,
                        locationId: targetEntity.locationId,
                        // components: Array.from(targetEntity.componentSet || []),
                    } : null,
                    // Add world state or other relevant data if needed by rules
                    world: {
                        timeOfDay: 'day',
                    },
                    // Include target context details if rules need them
                    targetContext: {
                        type: targetCtx.type,
                        entityId: targetCtx.entityId,
                        direction: targetCtx.direction,
                    }
                };
            }
        );

        // --- Instantiate the Service Under Test ---
        // Provide the correct dependencies based on the constructor signature
        actionValidationService = new ActionValidationService({
            entityManager: mockEntityManager,
            logger: mockLogger,
            domainContextCompatibilityChecker: mockDomainContextCompatibilityChecker,
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
            createActionValidationContextFunction: mockCreateActionValidationContext,
        });
    });

    // --- Test Cases ---

    it('should return true when domain is compatible, target resolves (if any), and prerequisites pass', () => {
        // Arrange
        const actor = createMockEntity('actor1');
        const target = createMockEntity('target1');
        mockEntityManager._addEntity(actor); // Ensure actor resolves if needed by context
        mockEntityManager._addEntity(target); // Ensure target resolves

        const actionDefinition = {
            id: 'action:success',
            target_domain: 'entity', // Expects an entity target
            prerequisites: [
                {logic: {'==': [{var: 'actor.id'}, 'actor1']}} // Example simple rule
            ],
        };
        const targetContext = ActionTargetContext.forEntity('target1');

        // Mocks are default success, no need to change for this case

        // Act
        const isValid = actionValidationService.isValid(actionDefinition, actor, targetContext);

        // Assert
        expect(isValid).toBe(true);
        // Verify mocks were called correctly
        expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalledWith(actionDefinition, targetContext);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('target1'); // Target resolution
        expect(mockCreateActionValidationContext).toHaveBeenCalled();
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            actionDefinition.prerequisites[0].logic, // The rule
            expect.any(Object) // The generated context
        );
        // Check logging
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('START Validation'));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('STEP 1 PASSED')); // Domain check
        // Note: The current service logs "END Validation: PASSED" even before prerequisite check if none exist,
        // or after they pass. It doesn't explicitly log "STEP 2 PASSED".
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`END Validation: PASSED for action '${actionDefinition.id}'`));
        expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should return false when domain/context compatibility check fails', () => {
        // Arrange
        const actor = createMockEntity('actor1');
        const actionDefinition = {
            id: 'action:domainFail',
            target_domain: 'entity', // Expects an entity
            prerequisites: [],
        };
        // Target context is 'direction', incompatible with 'entity' domain
        const targetContext = ActionTargetContext.forDirection('north');

        // Configure mock failure
        mockDomainContextCompatibilityChecker.check.mockReturnValue(false);

        // Act
        const isValid = actionValidationService.isValid(actionDefinition, actor, targetContext);

        // Assert
        expect(isValid).toBe(false);
        expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalledWith(actionDefinition, targetContext);
        // Subsequent steps should not be called
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        expect(mockCreateActionValidationContext).not.toHaveBeenCalled();
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('STEP 1 FAILED (domain/context)'));
    });

    it('should return false for a "self" target domain when target context is a different entity', () => {
        // Arrange
        const actor = createMockEntity('actor1');
        const otherEntity = createMockEntity('actor2');
        mockEntityManager._addEntity(actor);
        mockEntityManager._addEntity(otherEntity);

        const actionDefinition = {
            id: 'action:selfTargetFail',
            target_domain: 'self', // Action targets the actor itself
            prerequisites: [],
        };
        // Target context incorrectly points to another entity
        const targetContext = ActionTargetContext.forEntity('actor2');

        // Domain check might pass if targetContext 'entity' matches domain 'self' (implementation dependent)
        // But the specific self-check *within* isValid should fail.
        mockDomainContextCompatibilityChecker.check.mockReturnValue(true); // Assume basic domain check passes

        // Act
        const isValid = actionValidationService.isValid(actionDefinition, actor, targetContext);

        // Assert
        expect(isValid).toBe(false);
        expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalledWith(actionDefinition, targetContext); // Called before self-check
        // Subsequent steps should not be called after the self-check fails
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalledWith('actor2'); // Check if it resolves before the check (it doesn't in the provided code)
        expect(mockCreateActionValidationContext).not.toHaveBeenCalled();
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('STEP 1 FAILED (self mismatch)'));
    });


    it('should return false when a required target entity cannot be resolved', () => {
        // Arrange
        const actor = createMockEntity('actor1');
        mockEntityManager._addEntity(actor);
        // Do NOT add target 'target_missing' to entityManager

        const actionDefinition = {
            id: 'action:targetMissing',
            target_domain: 'entity',
            prerequisites: [{logic: {'==': [1, 1]}}], // Prerequisites exist but shouldn't be reached
        };
        const targetContext = ActionTargetContext.forEntity('target_missing');

        // Assume domain check passes
        mockDomainContextCompatibilityChecker.check.mockReturnValue(true);

        // Act
        const isValid = actionValidationService.isValid(actionDefinition, actor, targetContext);

        // Assert
        expect(isValid).toBe(false);
        expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalled();
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('target_missing'); // Attempt to resolve
        // Context creation and evaluation should not happen
        expect(mockCreateActionValidationContext).not.toHaveBeenCalled();
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
        // Check for specific error log
        expect(mockLogger.error).toHaveBeenCalledWith(
            expect.stringContaining(`Required target entity 'target_missing' could not be resolved`)
        );
    });


    it('should return false when a prerequisite evaluation fails', () => {
        // Arrange
        const actor = createMockEntity('actor1');
        mockEntityManager._addEntity(actor);
        const actionDefinition = {
            id: 'action:prereqFail',
            target_domain: 'none', // No target needed
            prerequisites: [
                {logic: {'<': [{var: 'actor.level'}, 5]}, failure_message: "Actor level too low"} // Example rule
            ],
        };
        const targetContext = ActionTargetContext.noTarget();

        // Configure prerequisite failure
        mockJsonLogicEvaluationService.evaluate.mockReturnValue(false); // Simulate rule failing

        // Act
        const isValid = actionValidationService.isValid(actionDefinition, actor, targetContext);

        // Assert
        expect(isValid).toBe(false);
        expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalled(); // Domain check should pass
        expect(mockCreateActionValidationContext).toHaveBeenCalled(); // Context needed for evaluation
        expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
            actionDefinition.prerequisites[0].logic,
            expect.any(Object)
        );
        // Check logging for prerequisite failure
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('STEP 2 FAILED: Prerequisite check FAILED'));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`Reason: ${actionDefinition.prerequisites[0].failure_message}`));
    });

    it('should return true when there are no prerequisites defined', () => {
        // Arrange
        const actor = createMockEntity('actor1');
        mockEntityManager._addEntity(actor);
        const actionDefinition = {
            id: 'action:noPrereqs',
            target_domain: 'none',
            prerequisites: [], // No prerequisites
            // or prerequisites: undefined / null (service handles this)
        };
        const targetContext = ActionTargetContext.noTarget();

        // Act
        const isValid = actionValidationService.isValid(actionDefinition, actor, targetContext);

        // Assert
        expect(isValid).toBe(true);
        expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalled();
        // Context might still be built if targetContext.type !== 'none', but not strictly needed if no prereqs
        // Based on current logic: context IS built if targetContext.type !== 'none' OR prerequisites.length > 0
        // So for target_domain 'none' and no prereqs, it might not be built. Let's test that edge case:
        // For this specific case ('none' target, empty prereqs), context creation might be skipped.
        // Let's refine the check based on the service's `mustBuildCtx` logic:
        // const mustBuildCtx = targetContext.type !== 'none' || prerequisites.length > 0;
        // In this case, mustBuildCtx is false.
        expect(mockCreateActionValidationContext).not.toHaveBeenCalled();
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('No prerequisites to evaluate. Skipping STEP 2.'));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining(`END Validation: PASSED for action '${actionDefinition.id}'`));
    });

    it('should return false and log error if context creation fails', () => {
        // Arrange
        const actor = createMockEntity('actor1');
        mockEntityManager._addEntity(actor);
        const actionDefinition = {
            id: 'action:contextFail',
            target_domain: 'direction', // Requires context
            prerequisites: [{logic: {'==': [1, 1]}}], // Requires context
        };
        const targetContext = ActionTargetContext.forDirection('east');

        // Configure context creation mock to throw an error
        const contextError = new Error('Failed to build context!');
        mockCreateActionValidationContext.mockImplementation(() => {
            throw contextError;
        });

        // Act
        const isValid = actionValidationService.isValid(actionDefinition, actor, targetContext);

        // Assert
        expect(isValid).toBe(false);
        expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalled();
        expect(mockCreateActionValidationContext).toHaveBeenCalled(); // It was attempted
        expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled(); // Should not be reached
        expect(mockLogger.error).toHaveBeenCalledWith(
            'Error assembling evaluation context',
            expect.objectContaining({error: contextError.message})
        );
    });

    // --- Add more tests for edge cases as needed ---
    // e.g., prerequisite with negate: true
    // e.g., prerequisites property exists but is not an array
    // e.g., invalid actionDefinition or actorEntity (should throw error)

});