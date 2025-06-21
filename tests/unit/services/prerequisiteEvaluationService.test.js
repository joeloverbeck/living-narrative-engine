// src/tests/services/prerequisiteEvaluationService.test.js

import { beforeEach, describe, expect, jest, test } from '@jest/globals';

import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
// Import the default export
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
// Import the named export
import { ActionValidationContextBuilder } from '../../../src/actions/validation/actionValidationContextBuilder.js';

// --- Mocking Dependencies ---

// Mock the ILogger interface
const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// --- FIX: Mock factory for DEFAULT export ---
jest.mock('../../../src/logic/jsonLogicEvaluationService.js', () => ({
  __esModule: true, // Indicate ES Module
  // The 'default' key maps to the default export
  default: jest.fn().mockImplementation(() => ({
    evaluate: jest.fn(),
    addOperation: jest.fn(),
  })),
}));
// --- END FIX ---

// --- FIX: Mock factory for NAMED export ---
jest.mock(
  '../../../src/actions/validation/actionValidationContextBuilder.js',
  () => ({
    __esModule: true, // Indicate ES Module
    // The 'ActionValidationContextBuilder' key maps to the named export
    ActionValidationContextBuilder: jest.fn().mockImplementation(() => ({
      buildContext: jest.fn(),
    })),
  })
);
// --- END FIX ---

// --- Test Suite ---

describe('PrerequisiteEvaluationService', () => {
  /** @type {PrerequisiteEvaluationService} */
  let service;
  /** @type {jest.Mocked<JsonLogicEvaluationService>} */
  let mockJsonLogicServiceInstance;
  /** @type {jest.Mocked<ActionValidationContextBuilder>} */
  let mockBuilderInstance;
  /** @type {{getConditionDefinition: jest.Mock}} */
  let mockGameDataRepository;

  // Reusable mock objects
  let mockActionDefinition;
  let mockActor;
  let mockTargetContext;
  let mockBuiltContext;

  beforeEach(() => {
    jest.clearAllMocks();

    // --- Instantiate using the original names ---
    // The imports now correctly resolve to the mock constructors
    // defined in the mock factories above.
    mockJsonLogicServiceInstance = new JsonLogicEvaluationService({
      logger: mockLogger,
    });
    mockBuilderInstance = new ActionValidationContextBuilder({
      logger: mockLogger,
    });
    mockGameDataRepository = {
      getConditionDefinition: jest.fn(),
    };

    // Define default mock inputs and builder output
    mockActionDefinition = { id: 'testActionGeneral' };
    mockActor = { id: 'actor1', getAllComponentsData: () => ({ health: 100 }) };
    mockTargetContext = { type: 'none' };
    mockBuiltContext = {
      actor: { id: 'actor1', components: { health: 100 } },
      target: { type: 'none', id: null, direction: null, entity: null },
      action: { id: 'testActionGeneral' },
    };

    // Configure default mock behavior on the INSTANCE's method
    mockBuilderInstance.buildContext.mockReturnValue(mockBuiltContext);

    // Instantiate the service under test with mock instances
    service = new PrerequisiteEvaluationService({
      logger: mockLogger,
      jsonLogicEvaluationService: mockJsonLogicServiceInstance,
      actionValidationContextBuilder: mockBuilderInstance,
      gameDataRepository: mockGameDataRepository,
    });
    mockLogger.debug.mockClear();
  });

  // --- Test Cases (Should remain the same as the previous correct version) ---

  /**
   * Test Case: Empty Prerequisites
   */
  test('should return true and log debug message when prerequisites array is empty', () => {
    const prerequisites = [];
    const result = service.evaluate(
      prerequisites,
      mockActionDefinition,
      mockActor,
      mockTargetContext
    );

    expect(result).toBe(true);
    expect(mockLogger.debug).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `PrerequisiteEvaluationService: PrereqEval[${mockActionDefinition.id}]: → PASSED (No prerequisites to evaluate).`
    );
    expect(mockBuilderInstance.buildContext).not.toHaveBeenCalled();
    expect(mockJsonLogicServiceInstance.evaluate).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
  });

  /**
   * Test Case: All Prerequisites Pass
   */
  test('should return true and log appropriately when all prerequisite rules pass', () => {
    const prerequisites = [
      { logic: { '==': [1, 1] } },
      { logic: { '!': false } },
      { logic: { var: 'actor.components.health' } },
    ];
    mockJsonLogicServiceInstance.evaluate.mockReturnValue(true);

    const result = service.evaluate(
      prerequisites,
      mockActionDefinition,
      mockActor,
      mockTargetContext
    );

    expect(result).toBe(true);
    expect(mockBuilderInstance.buildContext).toHaveBeenCalledTimes(1);
    expect(mockBuilderInstance.buildContext).toHaveBeenCalledWith(
      mockActionDefinition,
      mockActor,
      mockTargetContext
    );
    expect(mockJsonLogicServiceInstance.evaluate).toHaveBeenCalledTimes(
      prerequisites.length
    );
    expect(mockJsonLogicServiceInstance.evaluate).toHaveBeenNthCalledWith(
      1,
      prerequisites[0].logic,
      mockBuiltContext
    );
    // ... other evaluate calls
    expect(mockLogger.debug).toHaveBeenCalledWith(
      `PrerequisiteEvaluationService: PrereqEval[${mockActionDefinition.id}]: Evaluation Context Built Successfully.`
    );
    // ... other log checks ...
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  /**
   * Test Case: First Prerequisite Fails
   */
  test('should return false and log failure when the first prerequisite rule fails', () => {
    const prerequisites = [
      { logic: { '==': [1, 2] }, failure_message: 'Numbers must match' },
      { logic: { '!': false } },
    ];
    const specificActionDef = { id: 'testActionFirstFail' };
    mockJsonLogicServiceInstance.evaluate.mockReturnValueOnce(false);

    const result = service.evaluate(
      prerequisites,
      specificActionDef,
      mockActor,
      mockTargetContext
    );

    expect(result).toBe(false);
    expect(mockBuilderInstance.buildContext).toHaveBeenCalledTimes(1);
    expect(mockBuilderInstance.buildContext).toHaveBeenCalledWith(
      specificActionDef,
      mockActor,
      mockTargetContext
    );
    expect(mockJsonLogicServiceInstance.evaluate).toHaveBeenCalledTimes(1);
    expect(mockJsonLogicServiceInstance.evaluate).toHaveBeenCalledWith(
      prerequisites[0].logic,
      mockBuiltContext
    );
    // ... log checks ...
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  // --- Context Builder Error Handling Tests ---
  describe('Context Builder Error Handling', () => {
    test('should return false, log error, and not call JsonLogic when buildContext throws', () => {
      const prerequisites = [{ logic: { '==': [1, 1] } }];
      const builderError = new Error('Builder Test Error');
      const errorActionDef = { id: 'testActionBuilderFail' };

      mockBuilderInstance.buildContext.mockImplementationOnce(() => {
        throw builderError;
      });

      const result = service.evaluate(
        prerequisites,
        errorActionDef,
        mockActor,
        mockTargetContext
      );

      expect(result).toBe(false);
      expect(mockBuilderInstance.buildContext).toHaveBeenCalledTimes(1);
      expect(mockBuilderInstance.buildContext).toHaveBeenCalledWith(
        errorActionDef,
        mockActor,
        mockTargetContext
      );
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `PrereqEval[${errorActionDef.id}]: ← FAILED (Internal Error: Failed to build evaluation context`
        ),
        expect.objectContaining({ stack: builderError.stack })
      );
      expect(mockJsonLogicServiceInstance.evaluate).not.toHaveBeenCalled();
    });
  });

  /**
   * Test Case: Prerequisite Item Validation (Still relevant)
   */
  describe('Invalid Prerequisite Item Types (Non-Object)', () => {
    const invalidItemActionDef = { id: 'testActionInvalidItem' };

    test.each([
      { value: 123, description: 'number' },
      { value: null, description: 'null' },
      { value: true, description: 'boolean (true)' },
      { value: 'string', description: 'string' },
      { value: [], description: 'array' },
    ])(
      'should return false and log error if an item in prerequisites is a $description',
      ({ value }) => {
        const prerequisites = [value];
        const result = service.evaluate(
          prerequisites,
          invalidItemActionDef,
          mockActor,
          mockTargetContext
        );

        expect(result).toBe(false);
        expect(mockBuilderInstance.buildContext).toHaveBeenCalledTimes(1);
        expect(mockBuilderInstance.buildContext).toHaveBeenCalledWith(
          invalidItemActionDef,
          mockActor,
          mockTargetContext
        );
        expect(mockLogger.error).toHaveBeenCalledTimes(1);
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            `PrereqEval[${invalidItemActionDef.id}]: ← FAILED (Rule 1/1): Prerequisite item is invalid or missing 'logic' property: ${JSON.stringify(value)}`
          )
        );
        expect(mockJsonLogicServiceInstance.evaluate).not.toHaveBeenCalled();
      }
    );
  });

  /**
   * Test Case: Prerequisite Logic Property Validation (Still relevant)
   */
  describe("Invalid Prerequisite 'logic' Property", () => {
    const invalidLogicActionDef = { id: 'testActionInvalidLogic' };

    test.each([
      {
        prereq: { failure_message: 'No logic here' },
        description: "missing 'logic' property",
      },
      { prereq: { logic: null }, description: "'logic' property is null" },
    ])('should return false and log error if $description', ({ prereq }) => {
      const prerequisites = [prereq];
      const result = service.evaluate(
        prerequisites,
        invalidLogicActionDef,
        mockActor,
        mockTargetContext
      );

      expect(result).toBe(false);
      expect(mockBuilderInstance.buildContext).toHaveBeenCalledTimes(1);
      expect(mockBuilderInstance.buildContext).toHaveBeenCalledWith(
        invalidLogicActionDef,
        mockActor,
        mockTargetContext
      );
      expect(mockLogger.error).toHaveBeenCalledTimes(1);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          `PrereqEval[${invalidLogicActionDef.id}]: ← FAILED (Rule 1/1): Prerequisite item is invalid or missing 'logic' property: ${JSON.stringify(prereq)}`
        )
      );
      expect(mockJsonLogicServiceInstance.evaluate).not.toHaveBeenCalled();
    });

    test.each([
      { prereq: { logic: 'true' }, description: "'logic' property is string" },
      { prereq: { logic: true }, description: "'logic' property is boolean" },
      { prereq: { logic: 123 }, description: "'logic' property is number" },
    ])(
      'should return false and log failure when $description',
      ({ prereq }) => {
        const prerequisites = [prereq];
        const result = service.evaluate(
          prerequisites,
          invalidLogicActionDef,
          mockActor,
          mockTargetContext
        );

        expect(result).toBe(false);
        expect(mockBuilderInstance.buildContext).toHaveBeenCalledTimes(1);
        expect(mockBuilderInstance.buildContext).toHaveBeenCalledWith(
          invalidLogicActionDef,
          mockActor,
          mockTargetContext
        );
        expect(mockLogger.error).not.toHaveBeenCalled();
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            `PrereqEval[${invalidLogicActionDef.id}]: ← FAILED (Rule 1/1): Prerequisite check FAILED.`
          )
        );
        expect(mockJsonLogicServiceInstance.evaluate).toHaveBeenCalledTimes(1);
      }
    );
  });

  /**
   * Test Case: JsonLogic Evaluation Throws Error (Still relevant)
   */
  test('should return false and log error if jsonLogicEvaluationService.evaluate throws an error', () => {
    const prerequisites = [{ logic: { var: 'actor.id' } }];
    const jsonLogicErrorActionDef = { id: 'testActionJsonLogicError' };
    const mockError = new Error('Evaluation failed!');

    mockJsonLogicServiceInstance.evaluate.mockImplementationOnce(() => {
      throw mockError;
    });

    const result = service.evaluate(
      prerequisites,
      jsonLogicErrorActionDef,
      mockActor,
      mockTargetContext
    );

    expect(result).toBe(false);
    expect(mockBuilderInstance.buildContext).toHaveBeenCalledTimes(1);
    expect(mockBuilderInstance.buildContext).toHaveBeenCalledWith(
      jsonLogicErrorActionDef,
      mockActor,
      mockTargetContext
    );
    expect(mockJsonLogicServiceInstance.evaluate).toHaveBeenCalledTimes(1);
    expect(mockJsonLogicServiceInstance.evaluate).toHaveBeenCalledWith(
      prerequisites[0].logic,
      mockBuiltContext
    );
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        `PrereqEval[${jsonLogicErrorActionDef.id}]: ← FAILED (Rule 1/1): Error during rule resolution or evaluation. Rule: ${JSON.stringify(prerequisites[0])}`
      ),
      expect.objectContaining({
        error: mockError.message,
        stack: mockError.stack,
      })
    );
    expect(mockLogger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('Prerequisite Rule 1/1 PASSED')
    );
    expect(mockLogger.debug).not.toHaveBeenCalledWith(
      expect.stringContaining('→ PASSED (All')
    );
  });

  /**
   * Test Case: _resolveConditionReferences object and array resolution
   */
  test('_resolveConditionReferences should resolve condition_ref objects', () => {
    mockGameDataRepository.getConditionDefinition.mockReturnValueOnce({
      logic: { '==': [1, 1] },
    });

    const result = service._resolveConditionReferences(
      { condition_ref: 'condA' },
      'testAction'
    );

    expect(result).toEqual({ '==': [1, 1] });
    expect(mockGameDataRepository.getConditionDefinition).toHaveBeenCalledWith(
      'condA'
    );
  });

  test('_resolveConditionReferences should resolve arrays of logic blocks', () => {
    mockGameDataRepository.getConditionDefinition.mockImplementation((id) => {
      if (id === 'A') return { logic: { '!': false } };
      if (id === 'B') return { logic: { var: 'actor.components.health' } };
      return null;
    });

    const input = [
      { condition_ref: 'A' },
      { condition_ref: 'B' },
      { '==': [1, 1] },
    ];

    const result = service._resolveConditionReferences(input, 'testAction');

    expect(result).toEqual([
      { '!': false },
      { var: 'actor.components.health' },
      { '==': [1, 1] },
    ]);
  });

  /* --- Obsolete tests commented out --- */
}); // End describe('PrerequisiteEvaluationService')
