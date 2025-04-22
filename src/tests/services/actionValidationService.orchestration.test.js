// src/tests/services/actionValidationService.orchestration.test.js

/**
 * @jest-environment node
 */
import {ActionValidationService} from '../../services/actionValidationService.js';
// Correctly import the class
import {ActionTargetContext} from '../../models/actionTargetContext.js';
import {jest} from '@jest/globals'; // Ensure jest functions are available
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    test
} from '@jest/globals';

// --- Mock Dependencies ---
jest.mock('../../validation/componentRequirementChecker.js');
jest.mock('../../validation/domainContextCompatibilityChecker.js');
jest.mock('../../validation/prerequisiteChecker.js');

import {ComponentRequirementChecker} from '../../validation/componentRequirementChecker.js';
import {DomainContextCompatibilityChecker} from '../../validation/domainContextCompatibilityChecker.js';
import {PrerequisiteChecker} from '../../validation/prerequisiteChecker.js';


// --- Mock Logger ---
const mockLogger = { /* ... (same as before) ... */
    log: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn()
};

// --- Mock EntityManager ---
const mockEntityManager = { /* ... (same as before) ... */
    getEntityInstance: jest.fn(),
};

// --- Mock Entity Factory ---
const createMockEntity = (id, components = {}) => { /* ... (same as before) ... */
    const entity = {
        id: id,
        hasComponent: jest.fn((componentId) => components[componentId] === true),
    };
    mockEntityManager.getEntityInstance.mockImplementation((entityId) => {
        if (entityId === id) {
            return entity;
        }
        const existingMock = mockEntityManager.getEntityInstance.mock.results.find(
            result => result.value && result.value.id === entityId
        );
        return existingMock ? existingMock.value : undefined;
    });
    return entity;
};


describe('ActionValidationService - Orchestration Logic', () => {
    let service;
    let mockActor;
    let mockTarget;
    let mockActionDef;
    let mockContext;

    // --- Mock Checker Instances ---
    let mockComponentReqChecker;
    let mockDomainCompatChecker;
    let mockPrereqChecker;

    beforeEach(() => {
        jest.clearAllMocks();

        // --- Instantiate Mocks ---
        mockComponentReqChecker = new ComponentRequirementChecker();
        mockDomainCompatChecker = new DomainContextCompatibilityChecker();
        mockPrereqChecker = new PrerequisiteChecker();

        // --- Instantiate Service with Mocks ---
        service = new ActionValidationService({
            entityManager: mockEntityManager,
            logger: mockLogger,
            componentRequirementChecker: mockComponentReqChecker,
            domainContextCompatibilityChecker: mockDomainCompatChecker,
            prerequisiteChecker: mockPrereqChecker
        });

        // --- Default Test Data ---
        mockActor = createMockEntity('actor-1');
        mockTarget = createMockEntity('target-1');
        mockActionDef = {
            id: 'test:action-basic',
            target_domain: 'entity',
            actor_required_components: ['CanAct'],
            actor_forbidden_components: [],
            target_required_components: ['IsTargetable'],
            target_forbidden_components: [],
            prerequisites: [{op: 'truthy', path: 'actor.canDo'}]
        };
        // ***** CORRECTED CALL *****
        mockContext = ActionTargetContext.forEntity(mockTarget.id);

        // --- Default Mock Return Values (Happy Path) ---
        mockComponentReqChecker.check.mockReturnValue(true);
        mockDomainCompatChecker.check.mockReturnValue(true);
        mockPrereqChecker.check.mockReturnValue(true);
        mockEntityManager.getEntityInstance.mockReturnValue(mockTarget);
    });

    // --- Test Cases ---

    test('AC1 & AC2: should call all checkers in order and return true on happy path (entity target)', () => {
        // ***** CONTEXT ALREADY CORRECTED IN beforeEach *****
        const result = service.isValid(mockActionDef, mockActor, mockContext);

        expect(result).toBe(true);

        // Assertions... (remain the same)
        const componentCheckMock = mockComponentReqChecker.check;
        const domainCheckMock = mockDomainCompatChecker.check;
        const prereqCheckMock = mockPrereqChecker.check;
        const getEntityMock = mockEntityManager.getEntityInstance;
        expect(componentCheckMock).toHaveBeenCalledWith(mockActor, expect.any(Array), expect.any(Array), 'actor', expect.any(String));
        expect(domainCheckMock).toHaveBeenCalledWith(mockActionDef, mockContext);
        expect(getEntityMock).toHaveBeenCalledWith(mockTarget.id);
        expect(componentCheckMock).toHaveBeenCalledWith(mockTarget, expect.any(Array), expect.any(Array), 'target', expect.any(String));
        expect(componentCheckMock).toHaveBeenCalledTimes(2);
        expect(prereqCheckMock).toHaveBeenCalledWith(mockActionDef, mockActor, mockTarget);
        const actorCompCallOrder = componentCheckMock.mock.invocationCallOrder[0];
        const domainCallOrder = domainCheckMock.mock.invocationCallOrder[0];
        const getEntityCallOrder = getEntityMock.mock.invocationCallOrder[0];
        const targetCompCallOrder = componentCheckMock.mock.invocationCallOrder[1];
        const prereqCallOrder = prereqCheckMock.mock.invocationCallOrder[0];
        expect(actorCompCallOrder).toBeLessThan(domainCallOrder);
        expect(domainCallOrder).toBeLessThan(getEntityCallOrder);
        expect(getEntityCallOrder).toBeLessThan(targetCompCallOrder);
        expect(targetCompCallOrder).toBeLessThan(prereqCallOrder);
    });

    test('AC2 & AC3: should return false immediately if actor component check fails', () => {
        mockComponentReqChecker.check.mockImplementation((entity, required, forbidden, type) => type !== 'actor');
        // ***** CONTEXT ALREADY CORRECTED IN beforeEach *****
        const result = service.isValid(mockActionDef, mockActor, mockContext);
        expect(result).toBe(false);
        expect(mockComponentReqChecker.check).toHaveBeenCalledTimes(1);
        // Assertions... (remain the same)
        expect(mockDomainCompatChecker.check).not.toHaveBeenCalled();
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        expect(mockPrereqChecker.check).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('STEP 1 FAILED: Actor Component Check'));
    });

    test('AC2 & AC3: should return false immediately if domain/context check fails', () => {
        mockDomainCompatChecker.check.mockReturnValue(false);
        // ***** CONTEXT ALREADY CORRECTED IN beforeEach *****
        const result = service.isValid(mockActionDef, mockActor, mockContext);
        expect(result).toBe(false);
        // Assertions... (remain the same)
        expect(mockComponentReqChecker.check).toHaveBeenCalledTimes(1);
        expect(mockDomainCompatChecker.check).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        expect(mockPrereqChecker.check).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('STEP 2 FAILED: Domain/Context Check'));
    });

    test('AC2: should handle "self" domain check correctly (fail if target != actor)', () => {
        mockActionDef.target_domain = 'self';
        const differentTarget = createMockEntity('other-target');
        // ***** CORRECTED CALL *****
        mockContext = ActionTargetContext.forEntity(differentTarget.id);
        mockEntityManager.getEntityInstance.mockReturnValue(differentTarget);

        const result = service.isValid(mockActionDef, mockActor, mockContext);
        expect(result).toBe(false);
        // Assertions... (remain the same)
        expect(mockComponentReqChecker.check).toHaveBeenCalledTimes(1);
        expect(mockDomainCompatChecker.check).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        expect(mockPrereqChecker.check).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("STEP 2 FAILED: Domain/Context Check ('self' target mismatch)"));
    });

    test('AC2: should handle "self" domain check correctly (pass if target == actor)', () => {
        mockActionDef.target_domain = 'self';
        // ***** CORRECTED CALL *****
        mockContext = ActionTargetContext.forEntity(mockActor.id);
        mockEntityManager.getEntityInstance.mockReturnValue(mockActor);

        const result = service.isValid(mockActionDef, mockActor, mockContext);
        expect(result).toBe(true);
        // Assertions... (remain the same)
        expect(mockComponentReqChecker.check).toHaveBeenCalledTimes(2);
        expect(mockDomainCompatChecker.check).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockActor.id);
        expect(mockPrereqChecker.check).toHaveBeenCalledWith(mockActionDef, mockActor, mockActor);
    });

    test('AC2 & AC3: should return false immediately if target entity resolution fails', () => {
        mockEntityManager.getEntityInstance.mockReturnValue(undefined);
        // ***** CORRECTED CALL *****
        mockContext = ActionTargetContext.forEntity('nonexistent-target');

        const result = service.isValid(mockActionDef, mockActor, mockContext);
        expect(result).toBe(false);
        // Assertions... (remain the same)
        expect(mockComponentReqChecker.check).toHaveBeenCalledTimes(1);
        expect(mockDomainCompatChecker.check).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('nonexistent-target');
        expect(mockPrereqChecker.check).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining("STEP 3a FAILED: Target entity 'nonexistent-target' not found"));
    });


    test('AC2 & AC3: should return false immediately if target component check fails', () => {
        mockComponentReqChecker.check.mockImplementation((entity, required, forbidden, type) => type === 'actor');
        // ***** CONTEXT ALREADY CORRECTED IN beforeEach *****
        const result = service.isValid(mockActionDef, mockActor, mockContext);
        expect(result).toBe(false);
        // Assertions... (remain the same)
        expect(mockComponentReqChecker.check).toHaveBeenCalledTimes(2);
        expect(mockDomainCompatChecker.check).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockTarget.id);
        expect(mockComponentReqChecker.check).toHaveBeenNthCalledWith(2, mockTarget, mockActionDef.target_required_components, mockActionDef.target_forbidden_components, 'target', expect.any(String));
        expect(mockPrereqChecker.check).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('STEP 3b FAILED: Target Component Check'));
    });

    test('AC2 & AC3: should return false immediately if prerequisite check fails', () => {
        mockPrereqChecker.check.mockReturnValue(false);
        // ***** CONTEXT ALREADY CORRECTED IN beforeEach *****
        const result = service.isValid(mockActionDef, mockActor, mockContext);
        expect(result).toBe(false);
        // Assertions... (remain the same)
        expect(mockComponentReqChecker.check).toHaveBeenCalledTimes(2);
        expect(mockDomainCompatChecker.check).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(mockTarget.id);
        expect(mockPrereqChecker.check).toHaveBeenCalledWith(mockActionDef, mockActor, mockTarget);
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('STEP 4 FAILED: Prerequisite Check'));
    });

    test('AC2: should handle "none" target domain correctly (no target resolution/component check)', () => {
        mockActionDef.target_domain = 'none';
        mockPrereqChecker.check.mockImplementation((action, actor, target) => {
            expect(target).toBeNull();
            return true;
        });
        // ***** CORRECTED CALL *****
        mockContext = ActionTargetContext.noTarget();


        const result = service.isValid(mockActionDef, mockActor, mockContext);
        expect(result).toBe(true);
        // Assertions... (remain the same)
        expect(mockComponentReqChecker.check).toHaveBeenCalledTimes(1);
        expect(mockDomainCompatChecker.check).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        expect(mockComponentReqChecker.check.mock.calls.filter(call => call[3] === 'target')).toHaveLength(0);
        expect(mockPrereqChecker.check).toHaveBeenCalledTimes(1);
        expect(mockPrereqChecker.check).toHaveBeenCalledWith(mockActionDef, mockActor, null);
    });

    test('AC2: should handle "direction" target domain correctly (no target resolution/component check)', () => {
        mockActionDef.target_domain = 'direction';
        // ***** CORRECTED CALL *****
        mockContext = ActionTargetContext.forDirection('north');
        mockPrereqChecker.check.mockImplementation((action, actor, target) => {
            expect(target).toBeNull();
            return true;
        });

        const result = service.isValid(mockActionDef, mockActor, mockContext);
        expect(result).toBe(true);
        // Assertions... (remain the same)
        expect(mockComponentReqChecker.check).toHaveBeenCalledTimes(1);
        expect(mockDomainCompatChecker.check).toHaveBeenCalledTimes(1);
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        expect(mockComponentReqChecker.check.mock.calls.filter(call => call[3] === 'target')).toHaveLength(0);
        expect(mockPrereqChecker.check).toHaveBeenCalledTimes(1);
        expect(mockPrereqChecker.check).toHaveBeenCalledWith(mockActionDef, mockActor, null);
    });

    test('AC2: should handle "environment" target domain correctly (no target resolution/component check)', () => {
        mockActionDef.target_domain = 'environment';
        // ***** CORRECTED CALL ***** (Using noTarget as there's no specific environment factory)
        mockContext = ActionTargetContext.noTarget();
        mockPrereqChecker.check.mockImplementation((action, actor, target) => {
            expect(target).toBeNull();
            return true;
        });

        const result = service.isValid(mockActionDef, mockActor, mockContext);
        expect(result).toBe(true);
        // Assertions...
        expect(mockComponentReqChecker.check).toHaveBeenCalledTimes(1); // Actor check runs

        // ***** CORRECTED ASSERTION *****
        // The domain check is intentionally skipped when context is 'none' but domain is specific (like 'environment')
        expect(mockDomainCompatChecker.check).not.toHaveBeenCalled(); // Domain check SKIPPED

        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        expect(mockComponentReqChecker.check.mock.calls.filter(call => call[3] === 'target')).toHaveLength(0);
        expect(mockPrereqChecker.check).toHaveBeenCalledTimes(1);
        expect(mockPrereqChecker.check).toHaveBeenCalledWith(mockActionDef, mockActor, null);
    });

    test('AC2: should skip domain check if context is none but action domain requires specific target', () => {
        mockActionDef.target_domain = 'entity';
        // ***** CORRECTED CALL *****
        mockContext = ActionTargetContext.noTarget();

        const result = service.isValid(mockActionDef, mockActor, mockContext);
        expect(result).toBe(true); // Assuming prereqs pass with null target
        // Assertions... (remain the same)
        expect(mockComponentReqChecker.check).toHaveBeenCalledTimes(1);
        expect(mockDomainCompatChecker.check).not.toHaveBeenCalled(); // Domain check SKIPPED
        expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
        expect(mockPrereqChecker.check).toHaveBeenCalledWith(mockActionDef, mockActor, null);
    });

}); // End describe block