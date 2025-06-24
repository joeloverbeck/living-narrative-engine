/**
 * @jest-environment node
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';

// --- Service Under Test ---
import { ActionValidationService } from '../../../src/actions/validation/actionValidationService.js';

// --- Models/Types ---
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { DomainContextIncompatibilityError } from '../../../src/errors/domainContextIncompatibilityError.js';

// --- Dependencies to Mock ---
import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
jest.mock('../../../src/actions/validation/prerequisiteEvaluationService.js');

// --- Test Suite ---
describe('ActionValidationService: Orchestration Logic', () => {
  // --- Mock Variables ---
  let mockEntityManager;
  let mockLogger;
  let mockDomainContextCompatibilityChecker;
  let mockPrerequisiteEvaluationService; // Mock for the delegated service
  let actionValidationService; // Service instance under test

  // --- Mock Entity Helper ---
  const createMockEntity = (id, components = [], customProps = {}) => {
    const componentSet = new Set(components);
    const mockEntity = {
      id: id,
      hasComponent: jest.fn((componentId) => componentSet.has(componentId)),
      getComponent: jest.fn((componentId) =>
        componentSet.has(componentId) ? { id: componentId } : undefined
      ),
      getAllComponentsData: jest.fn(() => {
        const data = {};
        componentSet.forEach((compId) => {
          data[compId] = { id: compId };
        });
        return data;
      }),
      name: `Mock Entity ${id}`,
      locationId: 'location1',
      level: 5, // Example property that might be used in rules
      ...customProps,
    };
    return mockEntity;
  };

  // --- Test Setup ---
  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      info: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    const mockEntities = new Map();
    mockEntityManager = {
      getEntityInstance: jest.fn((id) => mockEntities.get(id)),
      _addEntity: (entity) => mockEntities.set(entity.id, entity),
    };
    mockDomainContextCompatibilityChecker = {
      check: jest.fn().mockReturnValue(true),
    };

    mockPrerequisiteEvaluationService = new PrerequisiteEvaluationService();
    mockPrerequisiteEvaluationService.evaluate = jest.fn();
    Object.defineProperty(
      mockPrerequisiteEvaluationService.evaluate,
      'length',
      {
        value: 4,
        writable: false,
      }
    );
    mockPrerequisiteEvaluationService.evaluate.mockReturnValue(true);

    actionValidationService = new ActionValidationService({
      entityManager: mockEntityManager,
      logger: mockLogger,
      domainContextCompatibilityChecker: mockDomainContextCompatibilityChecker,
      prerequisiteEvaluationService: mockPrerequisiteEvaluationService,
    });
  });

  // --- Test Cases ---

  it('should return true when scope compatible, target exists (or not required), and prerequisites pass via PES', () => {
    const actor = createMockEntity('actor1');
    const target = createMockEntity('target1');
    mockEntityManager._addEntity(actor);
    mockEntityManager._addEntity(target);
    const prerequisites = [{ logic: { '==': [1, 1] } }];
    const actionDefinition = {
      id: 'action:success',
      scope: 'entity', // FIXED
      prerequisites: prerequisites,
    };
    const targetContext = ActionTargetContext.forEntity('target1');

    const isValid = actionValidationService.isValid(
      actionDefinition,
      actor,
      targetContext
    );

    expect(isValid).toBe(true);
    expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalledWith(
      actionDefinition,
      targetContext
    );
    expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith('target1');
    expect(mockPrerequisiteEvaluationService.evaluate).toHaveBeenCalledTimes(1);
    expect(mockPrerequisiteEvaluationService.evaluate).toHaveBeenCalledWith(
      prerequisites,
      actionDefinition,
      actor,
      targetContext
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `START Validation: action='${actionDefinition.id}'`
      )
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('→ STEP 4 PASSED')
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `END Validation: PASSED for action '${actionDefinition.id}'`
      )
    );
  });

  it('should throw DomainContextIncompatibilityError when scope/context compatibility check fails (Step 1)', () => {
    const actor = createMockEntity('actor1');
    const actionDefinition = {
      id: 'action:domainFail',
      name: 'Domain Fail',
      scope: 'entity', // FIXED: Requires an entity target
      prerequisites: [],
    };
    const targetContext = ActionTargetContext.noTarget(); // Mismatch
    mockDomainContextCompatibilityChecker.check.mockReturnValue(false);

    // FIXED: Updated expected error message
    const expectedErrorMsg = `Action 'action:domainFail' (scope 'entity') requires an entity target, but context type is 'none'.`;
    expect(() => {
      actionValidationService.isValid(actionDefinition, actor, targetContext);
    }).toThrow(DomainContextIncompatibilityError);
    expect(() => {
      actionValidationService.isValid(actionDefinition, actor, targetContext);
    }).toThrow(expectedErrorMsg);

    expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalledWith(
      actionDefinition,
      targetContext
    );
    expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
    expect(mockPrerequisiteEvaluationService.evaluate).not.toHaveBeenCalled();
  });

  it('should throw DomainContextIncompatibilityError for a "self" scope when target context is a different entity (Step 1)', () => {
    const actor = createMockEntity('actor1');
    const otherEntity = createMockEntity('actor2');
    mockEntityManager._addEntity(actor);
    mockEntityManager._addEntity(otherEntity);
    const actionDefinition = {
      id: 'action:selfTargetFail',
      name: 'Self Target Fail',
      scope: 'self', // FIXED
      prerequisites: [],
    };
    const targetContext = ActionTargetContext.forEntity('actor2');
    mockDomainContextCompatibilityChecker.check.mockReturnValue(true);

    const expectedErrorMsg = `Action 'action:selfTargetFail' requires a 'self' target, but target was 'actor2'.`;
    expect(() => {
      actionValidationService.isValid(actionDefinition, actor, targetContext);
    }).toThrow(DomainContextIncompatibilityError);
    expect(() => {
      actionValidationService.isValid(actionDefinition, actor, targetContext);
    }).toThrow(expectedErrorMsg);

    expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalledWith(
      actionDefinition,
      targetContext
    );
    expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
    expect(mockPrerequisiteEvaluationService.evaluate).not.toHaveBeenCalled();
  });

  it('should log a warning for missing target entity (Step 2) but proceed and pass if PES passes', () => {
    const actor = createMockEntity('actor1');
    mockEntityManager._addEntity(actor);
    const prerequisites = [{ logic: { '==': [1, 1] } }];
    const actionDefinition = {
      id: 'action:targetMissingButPass',
      scope: 'entity', // FIXED
      prerequisites: prerequisites,
    };
    const targetContext = ActionTargetContext.forEntity('target_missing');

    const isValid = actionValidationService.isValid(
      actionDefinition,
      actor,
      targetContext
    );

    expect(isValid).toBe(true);
    expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalled();
    expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
      'target_missing'
    );
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Target entity 'target_missing' not found during validation"
      )
    );
    expect(mockPrerequisiteEvaluationService.evaluate).toHaveBeenCalledTimes(1);
    expect(mockPrerequisiteEvaluationService.evaluate).toHaveBeenCalledWith(
      prerequisites,
      actionDefinition,
      actor,
      targetContext
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `END Validation: PASSED for action '${actionDefinition.id}'`
      )
    );
  });

  it('should return false when prerequisite evaluation fails via PES (Step 4)', () => {
    const actor = createMockEntity('actor1');
    mockEntityManager._addEntity(actor);
    const prerequisites = [
      {
        logic: { '<': [{ var: 'actor.level' }, 5] },
        failure_message: 'Level too low',
      },
    ];
    const actionDefinition = {
      id: 'action:prereqFail',
      scope: 'none', // FIXED
      prerequisites: prerequisites,
    };
    const targetContext = ActionTargetContext.noTarget();
    mockPrerequisiteEvaluationService.evaluate.mockReturnValueOnce(false);

    const isValid = actionValidationService.isValid(
      actionDefinition,
      actor,
      targetContext
    );

    expect(isValid).toBe(false);
    expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalled();
    expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
    expect(mockPrerequisiteEvaluationService.evaluate).toHaveBeenCalledTimes(1);
    expect(mockPrerequisiteEvaluationService.evaluate).toHaveBeenCalledWith(
      prerequisites,
      actionDefinition,
      actor,
      targetContext
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'END Validation: FAILED (Prerequisite Not Met or Error during evaluation)'
      )
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('should return true and skip PES evaluation when there are no prerequisites defined (empty array)', () => {
    const actor = createMockEntity('actor1');
    mockEntityManager._addEntity(actor);
    const actionDefinition = {
      id: 'action:noPrereqs',
      scope: 'none', // FIXED
      prerequisites: [],
    };
    const targetContext = ActionTargetContext.noTarget();

    const isValid = actionValidationService.isValid(
      actionDefinition,
      actor,
      targetContext
    );

    expect(isValid).toBe(true);
    expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalled();
    expect(mockEntityManager.getEntityInstance).not.toHaveBeenCalled();
    expect(mockPrerequisiteEvaluationService.evaluate).not.toHaveBeenCalled();
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('→ STEP 4 SKIPPED (No prerequisites to evaluate)')
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `END Validation: PASSED for action '${actionDefinition.id}'`
      )
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it('should return true and skip PES evaluation when prerequisites property is null or undefined', () => {
    const actor = createMockEntity('actor1');
    mockEntityManager._addEntity(actor);
    const actionDefNull = {
      id: 'action:nullPrereqs',
      scope: 'none',
      prerequisites: null,
    };
    const actionDefUndefined = { id: 'action:undefPrereqs', scope: 'none' };
    const targetContext = ActionTargetContext.noTarget();

    const isValidNull = actionValidationService.isValid(
      actionDefNull,
      actor,
      targetContext
    );
    const isValidUndefined = actionValidationService.isValid(
      actionDefUndefined,
      actor,
      targetContext
    );

    expect(isValidNull).toBe(true);
    expect(isValidUndefined).toBe(true);
    expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalledTimes(
      2
    );
    expect(mockPrerequisiteEvaluationService.evaluate).not.toHaveBeenCalled();
  });

  it('should return false and log error if prerequisite evaluation (PES) throws an unexpected error', () => {
    const actor = createMockEntity('actor1');
    mockEntityManager._addEntity(actor);
    const prerequisites = [{ logic: { '==': [1, 1] } }];
    const actionDefinition = {
      id: 'action:pesError',
      scope: 'none', // FIXED
      prerequisites: prerequisites,
    };
    const targetContext = ActionTargetContext.noTarget();
    const evaluationError = new Error('PES exploded unexpectedly!');
    mockPrerequisiteEvaluationService.evaluate.mockImplementation(() => {
      throw evaluationError;
    });

    const isValid = actionValidationService.isValid(
      actionDefinition,
      actor,
      targetContext
    );

    expect(isValid).toBe(false);
    expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalled();
    expect(mockPrerequisiteEvaluationService.evaluate).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(`UNEXPECTED ERROR`),
      expect.objectContaining({ error: evaluationError })
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(`END Validation: FAILED (Unexpected Error)`)
    );
  });

  it('should return false and log error (then throw) if structural sanity check fails (Step 0)', () => {
    const actor = createMockEntity('actor1');
    const actionDefinition = { id: 'action:structuralFail' };
    const invalidTargetContext = { type: 'invalid' };

    expect(() => {
      actionValidationService.isValid(
        actionDefinition,
        actor,
        invalidTargetContext
      );
    }).toThrow('ActionValidationService.isValid: invalid ActionTargetContext');
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining('Validation: STRUCTURAL ERROR:'),
      expect.any(Object)
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'END Validation: FAILED (Structural Sanity - Throwing)'
      )
    );
    expect(mockDomainContextCompatibilityChecker.check).not.toHaveBeenCalled();
    expect(mockPrerequisiteEvaluationService.evaluate).not.toHaveBeenCalled();
  });

  it('should log warning and treat as empty if prerequisites property is not an array (Step 3)', () => {
    const actor = createMockEntity('actor1');
    mockEntityManager._addEntity(actor);
    const actionDefinition = {
      id: 'action:invalidPrereqs',
      scope: 'none', // FIXED
      prerequisites: { invalid: 'not an array' },
    };
    const targetContext = ActionTargetContext.noTarget();

    const isValid = actionValidationService.isValid(
      actionDefinition,
      actor,
      targetContext
    );

    expect(isValid).toBe(true);
    expect(mockDomainContextCompatibilityChecker.check).toHaveBeenCalled();
    expect(mockPrerequisiteEvaluationService.evaluate).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        `Action '${actionDefinition.id}' has a 'prerequisites' property, but it's not an array`
      )
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining('→ STEP 4 SKIPPED')
    );
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        `END Validation: PASSED for action '${actionDefinition.id}'`
      )
    );
    expect(mockLogger.error).not.toHaveBeenCalled();
  });
});
