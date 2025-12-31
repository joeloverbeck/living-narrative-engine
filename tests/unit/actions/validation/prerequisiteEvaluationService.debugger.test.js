// tests/unit/actions/validation/prerequisiteEvaluationService.debugger.test.js
/**
 * @file Tests for the debugger code path in PrerequisiteEvaluationService
 * Covers lines 490-509 which are the debugger-enabled evaluation branch.
 *
 * This file tests the service with an entityManager provided, which activates
 * the PrerequisiteDebugger code path. We use a real debugger (not mocked)
 * because the private #debugger field is difficult to mock effectively.
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';

describe('PrerequisiteEvaluationService - Debugger Path', () => {
  let service;
  let mockLogger;
  let mockJsonLogicEvaluationService;
  let mockActionValidationContextBuilder;
  let mockGameDataRepository;
  let mockEntityManager;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockJsonLogicEvaluationService = {
      evaluate: jest.fn(),
    };

    mockActionValidationContextBuilder = {
      buildContext: jest.fn(),
    };

    mockGameDataRepository = {
      getConditionDefinition: jest.fn(),
    };

    // Entity manager mock with methods required by PrerequisiteDebugger
    // This triggers debugger creation in the constructor
    mockEntityManager = {
      getEntity: jest.fn().mockReturnValue(null),
      getComponent: jest.fn().mockReturnValue(null),
      getComponentData: jest.fn().mockReturnValue(null),
      hasComponent: jest.fn().mockReturnValue(false),
      getAllComponents: jest.fn().mockReturnValue({}),
      getEntityIds: jest.fn().mockReturnValue([]),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor with entityManager', () => {
    it('should initialize service when entityManager is provided', () => {
      service = new PrerequisiteEvaluationService({
        logger: mockLogger,
        jsonLogicEvaluationService: mockJsonLogicEvaluationService,
        actionValidationContextBuilder: mockActionValidationContextBuilder,
        gameDataRepository: mockGameDataRepository,
        entityManager: mockEntityManager,
      });

      expect(service).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('PrerequisiteEvaluationService initialised')
      );
    });

    it('should initialize with debugMode true', () => {
      service = new PrerequisiteEvaluationService({
        logger: mockLogger,
        jsonLogicEvaluationService: mockJsonLogicEvaluationService,
        actionValidationContextBuilder: mockActionValidationContextBuilder,
        gameDataRepository: mockGameDataRepository,
        entityManager: mockEntityManager,
        debugMode: true,
      });

      expect(service).toBeDefined();
    });
  });

  describe('_evaluatePrerequisite with debugger path', () => {
    const mockActionDefinition = { id: 'test:action' };
    const mockActor = { id: 'test:actor' };
    const mockContext = {
      actor: {
        id: 'test:actor',
        components: {},
      },
    };

    beforeEach(() => {
      mockActionValidationContextBuilder.buildContext.mockReturnValue(
        mockContext
      );

      service = new PrerequisiteEvaluationService({
        logger: mockLogger,
        jsonLogicEvaluationService: mockJsonLogicEvaluationService,
        actionValidationContextBuilder: mockActionValidationContextBuilder,
        gameDataRepository: mockGameDataRepository,
        entityManager: mockEntityManager,
      });
    });

    it('should return true when prerequisite evaluation succeeds with true result via debugger', () => {
      // jsonLogicEvaluationService.evaluate is called by the evaluator callback
      // which is invoked by the debugger
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      const result = service.evaluate(
        [{ logic: { '==': [1, 1] }, failure_message: 'test' }],
        mockActionDefinition,
        mockActor
      );

      expect(result).toBe(true);
      expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
        { '==': [1, 1] },
        mockContext
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('PASSED')
      );
    });

    it('should return false when prerequisite evaluation returns false result via debugger', () => {
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(false);

      const result = service.evaluate(
        [{ logic: { '==': [1, 2] }, failure_message: 'Prerequisite failed' }],
        mockActionDefinition,
        mockActor
      );

      expect(result).toBe(false);
      expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('FAILED')
      );
    });

    it('should return false when evaluation throws an error - debugger captures it', () => {
      // Simulate an error in the JSON logic evaluation
      mockJsonLogicEvaluationService.evaluate.mockImplementation(() => {
        throw new Error('Evaluation error');
      });

      const result = service.evaluate(
        [{ logic: { '==': [1, 1] }, failure_message: 'Should fail' }],
        mockActionDefinition,
        mockActor
      );

      expect(result).toBe(false);
      // The debugger enriches the error and logs it
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should use debugger for all prerequisite rules', () => {
      mockJsonLogicEvaluationService.evaluate
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true);

      const prerequisites = [
        { logic: { '==': [1, 1] }, failure_message: 'First check' },
        { logic: { '!=': [1, 2] }, failure_message: 'Second check' },
      ];

      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor
      );

      expect(result).toBe(true);
      expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(2);
    });

    it('should stop evaluation early when first rule fails via debugger path', () => {
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(false);

      const prerequisites = [
        { logic: { '==': [1, 2] }, failure_message: 'First check' },
        { logic: { '==': [1, 1] }, failure_message: 'Second check' },
      ];

      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor
      );

      expect(result).toBe(false);
      // Only first rule should be evaluated before early exit
      expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
    });

    it('should stop evaluation early when rule throws error via debugger', () => {
      mockJsonLogicEvaluationService.evaluate.mockImplementation(() => {
        throw new Error('Evaluation error');
      });

      const prerequisites = [
        { logic: { '==': [1, 2] }, failure_message: 'First check' },
        { logic: { '==': [1, 1] }, failure_message: 'Second check' },
      ];

      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor
      );

      expect(result).toBe(false);
      expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(1);
    });

    it('should work with trace parameter via debugger path', () => {
      const mockTrace = {
        step: jest.fn(),
        span: jest.fn((name, fn) => fn()),
        debug: jest.fn(),
        error: jest.fn(),
        data: jest.fn(),
        info: jest.fn(),
        success: jest.fn(),
        failure: jest.fn(),
        withSpan: jest.fn((name, fn) => fn()),
      };

      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      const result = service.evaluate(
        [{ logic: { '==': [1, 1] }, failure_message: 'test' }],
        mockActionDefinition,
        mockActor,
        mockTrace
      );

      expect(result).toBe(true);
      expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalled();
    });
  });

  describe('debugMode variations', () => {
    const mockActionDefinition = { id: 'test:action' };
    const mockActor = { id: 'test:actor' };
    const mockContext = { actor: { id: 'test:actor', components: {} } };

    beforeEach(() => {
      mockActionValidationContextBuilder.buildContext.mockReturnValue(
        mockContext
      );
    });

    it('should work with debugMode=true and successful evaluation', () => {
      service = new PrerequisiteEvaluationService({
        logger: mockLogger,
        jsonLogicEvaluationService: mockJsonLogicEvaluationService,
        actionValidationContextBuilder: mockActionValidationContextBuilder,
        gameDataRepository: mockGameDataRepository,
        entityManager: mockEntityManager,
        debugMode: true, // DEBUG level logging
      });

      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      const result = service.evaluate(
        [{ logic: { '==': [1, 1] }, failure_message: 'test' }],
        mockActionDefinition,
        mockActor
      );

      expect(result).toBe(true);
    });

    it('should work with debugMode=true and error during evaluation', () => {
      service = new PrerequisiteEvaluationService({
        logger: mockLogger,
        jsonLogicEvaluationService: mockJsonLogicEvaluationService,
        actionValidationContextBuilder: mockActionValidationContextBuilder,
        gameDataRepository: mockGameDataRepository,
        entityManager: mockEntityManager,
        debugMode: true,
      });

      mockJsonLogicEvaluationService.evaluate.mockImplementation(() => {
        throw new Error('Debug mode error test');
      });

      const result = service.evaluate(
        [{ logic: { '==': [1, 1] }, failure_message: 'test' }],
        mockActionDefinition,
        mockActor
      );

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
