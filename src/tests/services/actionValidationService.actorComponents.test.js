// src/tests/services/actionValidationService.actorComponents.test.js

/**
 * @jest-environment node
 */

import {afterAll, beforeAll, beforeEach, describe, expect, jest, test} from "@jest/globals";

// --- Mock JsonLogicEvaluationService --- V3.3 Add
// --- Service Under Test ---
import {ActionValidationService} from '../../services/actionValidationService.js';

// --- Models/Types ---
import {ActionTargetContext} from '../../models/actionTargetContext.js';
// Assuming Entity is a class or you have a way to create mock entities
// import { Entity } from '../../entities/entity.js'; // Optional: if needed for typing or complex mocks

// --- Mocks Needed ---
// No need to import the actual checker classes if we mock their interface directly

// --- Test Suite ---
describe('ActionValidationService: Actor Component Checks', () => {

    // --- Mock Variables ---
    // Declare variables in the describe scope to be accessible in all tests
    let mockEntityManager;
    let mockLogger;
    let mockComponentRequirementChecker;
    let mockDomainContextCompatibilityChecker;
    let mockPrerequisiteChecker;
    let actionValidationService; // Instance of the service under test

    // --- Mock Entity Helper ---
    // Helper to create a basic mock entity for tests
    const createMockEntity = (id, components = []) => {
        const componentSet = new Set(components);
        return {
            id: id,
            hasComponent: jest.fn((componentId) => componentSet.has(componentId)),
            // Add other methods/properties if ActionValidationService or its dependencies need them
            // getComponent: jest.fn((componentId) => componentSet.has(componentId) ? { /* mock component data */ } : undefined),
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
        mockEntityManager = {
            getEntityInstance: jest.fn(),
            // Define default behavior if needed, e.g., return a mock entity
            // getEntityInstance: jest.fn(id => createMockEntity(id)),
        };

        // Mock ComponentRequirementChecker
        mockComponentRequirementChecker = {
            // Default to success; individual tests can override this mock
            check: jest.fn().mockReturnValue(true),
        };

        // Mock DomainContextCompatibilityChecker
        mockDomainContextCompatibilityChecker = {
            // Default to success; tests focusing on this step would override
            check: jest.fn().mockReturnValue(true),
        };

        // Mock PrerequisiteChecker
        mockPrerequisiteChecker = {
            // Default to success; tests focusing on this step would override
            check: jest.fn().mockReturnValue(true),
        };

        // --- Instantiate the Service Under Test ---
        // This is where the dependencies are injected
        actionValidationService = new ActionValidationService({
            entityManager: mockEntityManager,
            logger: mockLogger,
            componentRequirementChecker: mockComponentRequirementChecker,
            domainContextCompatibilityChecker: mockDomainContextCompatibilityChecker,
            prerequisiteChecker: mockPrerequisiteChecker,
        });
    });

    // --- Test Cases ---

    it('should return true when actor has all required components and none of the forbidden ones', () => {
        // Arrange
        const actor = createMockEntity('actor1', ['requiredComp1', 'otherComp']);
        const actionDefinition = {
            id: 'action:requiresOk',
            actor_required_components: ['requiredComp1'],
            actor_forbidden_components: ['forbiddenComp'],
            // Other properties needed for later checks can be minimal here
            target_domain: 'none',
            prerequisites: [],
        };
        const targetContext = new ActionTargetContext('none');

        // Configure the mock specifically for the actor check in this test
        // Simulate the component checker succeeding for the actor
        mockComponentRequirementChecker.check.mockImplementation((entity, required, forbidden, entityRole) => {
            if (entity.id === 'actor1' && entityRole === 'actor') {
                // You could add detailed checks here if needed, but often just returning true/false is enough
                // For this test, we expect it to pass for the actor
                return true;
            }
            return true; // Assume other checks (like target) pass by default
        });

        // Act
        const isValid = actionValidationService.isValid(actionDefinition, actor, targetContext);

        // Assert
        expect(isValid).toBe(true);
        // Verify that the component checker was called correctly for the actor
        expect(mockComponentRequirementChecker.check).toHaveBeenCalledWith(
            actor, // The entity instance
            actionDefinition.actor_required_components, // Required list
            actionDefinition.actor_forbidden_components, // Forbidden list
            'actor', // The role being checked
            expect.stringContaining(`action '${actionDefinition.id}' actor requirements`) // Context description
        );
        // Check that subsequent checkers were also called (since the first step passed)
        expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalled();
        expect(mockPrerequisiteChecker.check).toHaveBeenCalled(); // Called even if targetEntity is null
        // Verify logger was called appropriately (optional, but good practice)
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('START Validation'));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('STEP 1 PASSED'));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('END Validation: PASSED'));
    });

    it('should return false when actor is missing a required component', () => {
        // Arrange
        const actor = createMockEntity('actor1', ['otherComp']); // Missing 'requiredComp1'
        const actionDefinition = {
            id: 'action:missingRequired',
            actor_required_components: ['requiredComp1'],
            actor_forbidden_components: [],
            target_domain: 'none',
            prerequisites: [],
        };
        const targetContext = new ActionTargetContext('none');

        // Configure the mock: simulate the component checker failing for the actor
        mockComponentRequirementChecker.check.mockImplementation((entity, required, forbidden, entityRole) => {
            if (entity.id === 'actor1' && entityRole === 'actor') {
                return false; // Simulate failure for the actor check
            }
            return true; // Should not be reached if actor check fails first
        });

        // Act
        const isValid = actionValidationService.isValid(actionDefinition, actor, targetContext);

        // Assert
        expect(isValid).toBe(false);
        // Verify the component checker was called for the actor
        expect(mockComponentRequirementChecker.check).toHaveBeenCalledWith(
            actor,
            actionDefinition.actor_required_components,
            actionDefinition.actor_forbidden_components,
            'actor',
            expect.stringContaining(`action '${actionDefinition.id}' actor requirements`)
        );
        // Verify subsequent checks were *not* called because the first one failed
        expect(mockDomainContextCompatibilityChecker.check).not.toHaveBeenCalled();
        expect(mockPrerequisiteChecker.check).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('START Validation'));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('STEP 1 FAILED: Actor Component Check'));
        // Ensure no PASS message was logged
        expect(mockLogger.debug).not.toHaveBeenCalledWith(expect.stringContaining('END Validation: PASSED'));
    });

    it('should return false when actor has a forbidden component', () => {
        // Arrange
        const actor = createMockEntity('actor1', ['requiredComp1', 'forbiddenComp']); // Has 'forbiddenComp'
        const actionDefinition = {
            id: 'action:hasForbidden',
            actor_required_components: ['requiredComp1'],
            actor_forbidden_components: ['forbiddenComp'],
            target_domain: 'none',
            prerequisites: [],
        };
        const targetContext = new ActionTargetContext('none');

        // Configure the mock: simulate the component checker failing for the actor
        mockComponentRequirementChecker.check.mockImplementation((entity, required, forbidden, entityRole) => {
            if (entity.id === 'actor1' && entityRole === 'actor') {
                return false; // Simulate failure for the actor check
            }
            return true;
        });

        // Act
        const isValid = actionValidationService.isValid(actionDefinition, actor, targetContext);

        // Assert
        expect(isValid).toBe(false);
        expect(mockComponentRequirementChecker.check).toHaveBeenCalledWith(
            actor,
            actionDefinition.actor_required_components,
            actionDefinition.actor_forbidden_components,
            'actor',
            expect.stringContaining(`action '${actionDefinition.id}' actor requirements`)
        );
        expect(mockDomainContextCompatibilityChecker.check).not.toHaveBeenCalled();
        expect(mockPrerequisiteChecker.check).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('STEP 1 FAILED: Actor Component Check'));
    });

    it('should return true when there are no actor component requirements', () => {
        // Arrange
        const actor = createMockEntity('actor1', ['anyComp']);
        const actionDefinition = {
            id: 'action:noActorReqs',
            // actor_required_components: undefined, // Or [] or null
            // actor_forbidden_components: undefined, // Or [] or null
            target_domain: 'none',
            prerequisites: [],
        };
        const targetContext = new ActionTargetContext('none');

        // Simulate component checker success (it should pass if lists are empty/null)
        mockComponentRequirementChecker.check.mockImplementation((entity, required, forbidden, entityRole) => {
            if (entity.id === 'actor1' && entityRole === 'actor') {
                // Check if the actual componentRequirementChecker handles null/undefined correctly
                // Assuming it does, it should return true here.
                return true;
            }
            return true;
        });


        // Act
        const isValid = actionValidationService.isValid(actionDefinition, actor, targetContext);

        // Assert
        expect(isValid).toBe(true);
        expect(mockComponentRequirementChecker.check).toHaveBeenCalledWith(
            actor,
            undefined, // How your checker receives empty lists (undefined, null, or [])
            undefined, // Adjust based on actionDefinition and checker implementation
            'actor',
            expect.stringContaining(`action '${actionDefinition.id}' actor requirements`)
        );
        expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalled();
        expect(mockPrerequisiteChecker.check).toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('STEP 1 PASSED'));
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('END Validation: PASSED'));
    });

    // --- Add more tests as needed ---
    // - Tests for target component checks (Step 3) -> might go in a separate file like `.targetComponents.test.js`
    // - Tests for domain/context compatibility (Step 2) -> might go in `.domainContext.test.js`
    // - Tests for prerequisites (Step 4) -> might go in `.prerequisites.test.js`
    // - Tests for edge cases (invalid inputs - already partially handled by service constructor/method checks)
    // - Tests where target resolution fails (Step 3a)

});