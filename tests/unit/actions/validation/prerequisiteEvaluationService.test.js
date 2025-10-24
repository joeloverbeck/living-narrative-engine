// tests/unit/actions/validation/prerequisiteEvaluationService.test.js

import { jest } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';

describe('PrerequisiteEvaluationService', () => {
  let service;
  let mockLogger;
  let mockJsonLogicEvaluationService;
  let mockActionValidationContextBuilder;
  let mockGameDataRepository;

  beforeEach(() => {
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

    service = new PrerequisiteEvaluationService({
      logger: mockLogger,
      jsonLogicEvaluationService: mockJsonLogicEvaluationService,
      actionValidationContextBuilder: mockActionValidationContextBuilder,
      gameDataRepository: mockGameDataRepository,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with proper dependencies', () => {
      expect(service).toBeDefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'PrerequisiteEvaluationService: PrerequisiteEvaluationService initialised (with ActionValidationContextBuilder and GameDataRepository).'
      );
    });

    it('should throw error when missing logger', () => {
      expect(
        () =>
          new PrerequisiteEvaluationService({
            jsonLogicEvaluationService: mockJsonLogicEvaluationService,
            actionValidationContextBuilder: mockActionValidationContextBuilder,
            gameDataRepository: mockGameDataRepository,
          })
      ).toThrow();
    });

    it('should throw error when jsonLogicEvaluationService missing evaluate method', () => {
      expect(
        () =>
          new PrerequisiteEvaluationService({
            logger: mockLogger,
            jsonLogicEvaluationService: {},
            actionValidationContextBuilder: mockActionValidationContextBuilder,
            gameDataRepository: mockGameDataRepository,
          })
      ).toThrow('evaluate');
    });
  });

  describe('evaluate', () => {
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
    });

    it('should return true when no prerequisites', () => {
      const result = service.evaluate([], mockActionDefinition, mockActor);

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'PrerequisiteEvaluationService: PrereqEval[test:action]: → PASSED (No prerequisites to evaluate).'
      );
      expect(
        mockActionValidationContextBuilder.buildContext
      ).not.toHaveBeenCalled();
    });

    it('should return true when all prerequisites pass', () => {
      const prerequisites = [
        {
          logic: { '==': [1, 1] },
          failure_message: 'Should not fail',
        },
      ];
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor
      );

      expect(result).toBe(true);
      expect(
        mockActionValidationContextBuilder.buildContext
      ).toHaveBeenCalledWith(mockActionDefinition, mockActor);
      expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
        { '==': [1, 1] },
        mockContext
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'PrerequisiteEvaluationService: PrereqEval[test:action]:   - Prerequisite Rule 1/1 PASSED.'
      );
    });

    it('should return false when any prerequisite fails', () => {
      const prerequisites = [
        {
          logic: { '==': [1, 1] },
          failure_message: 'First check',
        },
        {
          logic: { '==': [1, 2] },
          failure_message: 'Second check failed',
        },
      ];
      mockJsonLogicEvaluationService.evaluate
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor
      );

      expect(result).toBe(false);
      expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledTimes(2);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('← FAILED (Rule 2/2)')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'PrerequisiteEvaluationService:    Reason: Second check failed'
      );
    });

    it('should return false when context building fails', () => {
      const prerequisites = [
        {
          logic: { '==': [1, 1] },
        },
      ];
      mockActionValidationContextBuilder.buildContext.mockImplementation(() => {
        throw new Error('Context build failed');
      });

      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor
      );

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to build evaluation context'),
        expect.any(Object)
      );
    });

    it('should return false when evaluation context is not an object', () => {
      const prerequisites = [
        {
          logic: { '==': [1, 1] },
        },
      ];
      mockActionValidationContextBuilder.buildContext.mockReturnValue(null);

      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor
      );

      expect(result).toBe(false);
      expect(mockJsonLogicEvaluationService.evaluate).not.toHaveBeenCalled();
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Actor context resolved for entity')
      );
    });

    it('should handle evaluation context missing actor object', () => {
      const prerequisites = [
        {
          logic: { '==': [1, 1] },
        },
      ];
      const contextWithoutActor = {};
      mockActionValidationContextBuilder.buildContext.mockReturnValue(
        contextWithoutActor
      );
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor
      );

      expect(result).toBe(true);
      expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
        { '==': [1, 1] },
        contextWithoutActor
      );
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        expect.stringContaining('Actor context resolved for entity')
      );
    });

    it('should warn when actor components are missing or invalid', () => {
      const prerequisites = [
        {
          logic: { '==': [1, 1] },
        },
      ];
      const contextWithMissingComponents = {
        actor: {
          id: 'test:actor',
          components: null,
        },
      };
      mockActionValidationContextBuilder.buildContext.mockReturnValue(
        contextWithMissingComponents
      );
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor
      );

      expect(result).toBe(true);
      expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
        { '==': [1, 1] },
        contextWithMissingComponents
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'PrerequisiteEvaluationService: PrereqEval[test:action]: WARNING - Actor entity [test:actor] appears to have NO components. This may indicate a loading issue.'
      );
    });

    it('should handle invalid prerequisite objects', () => {
      const prerequisites = [
        {
          // Missing logic property
          failure_message: 'Invalid prereq',
        },
      ];

      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor
      );

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("missing 'logic' property")
      );
    });
  });

  describe('condition reference resolution', () => {
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
    });

    it('should resolve condition_ref in prerequisites', () => {
      const prerequisites = [
        {
          logic: { condition_ref: 'test:condition' },
        },
      ];
      mockGameDataRepository.getConditionDefinition.mockReturnValue({
        id: 'test:condition',
        logic: { '==': [1, 1] },
      });
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor
      );

      expect(result).toBe(true);
      expect(
        mockGameDataRepository.getConditionDefinition
      ).toHaveBeenCalledWith('test:condition');
      expect(mockJsonLogicEvaluationService.evaluate).toHaveBeenCalledWith(
        { '==': [1, 1] },
        mockContext
      );
    });

    it('should handle nested condition_ref', () => {
      const prerequisites = [
        {
          logic: { condition_ref: 'test:outer' },
        },
      ];
      mockGameDataRepository.getConditionDefinition.mockImplementation((id) => {
        if (id === 'test:outer') {
          return {
            id: 'test:outer',
            logic: { and: [{ condition_ref: 'test:inner' }, true] },
          };
        }
        if (id === 'test:inner') {
          return {
            id: 'test:inner',
            logic: { '==': [1, 1] },
          };
        }
        return null;
      });
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor
      );

      expect(result).toBe(true);
      expect(
        mockGameDataRepository.getConditionDefinition
      ).toHaveBeenCalledWith('test:outer');
      expect(
        mockGameDataRepository.getConditionDefinition
      ).toHaveBeenCalledWith('test:inner');
    });

    it('should detect circular references', () => {
      const prerequisites = [
        {
          logic: { condition_ref: 'test:circular1' },
        },
      ];
      mockGameDataRepository.getConditionDefinition.mockImplementation((id) => {
        if (id === 'test:circular1') {
          return {
            id: 'test:circular1',
            logic: { condition_ref: 'test:circular2' },
          };
        }
        if (id === 'test:circular2') {
          return {
            id: 'test:circular2',
            logic: { condition_ref: 'test:circular1' },
          };
        }
        return null;
      });

      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor
      );

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during rule resolution'),
        expect.any(Object)
      );
    });

    it('should handle missing condition definition', () => {
      const prerequisites = [
        {
          logic: { condition_ref: 'test:missing' },
        },
      ];
      mockGameDataRepository.getConditionDefinition.mockReturnValue(null);

      const result = service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor
      );

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during rule resolution'),
        expect.any(Object)
      );
    });
  });

  describe('tracing support', () => {
    const mockActionDefinition = { id: 'test:action' };
    const mockActor = { id: 'test:actor' };
    const mockContext = {
      actor: {
        id: 'test:actor',
        components: {},
      },
    };
    let mockTrace;

    beforeEach(() => {
      mockActionValidationContextBuilder.buildContext.mockReturnValue(
        mockContext
      );
      mockTrace = {
        step: jest.fn(),
        info: jest.fn(),
        data: jest.fn(),
        success: jest.fn(),
        failure: jest.fn(),
        error: jest.fn(),
      };
    });

    it('should call trace methods during evaluation', () => {
      const prerequisites = [
        {
          logic: { '==': [1, 1] },
        },
      ];
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor,
        mockTrace
      );

      expect(mockTrace.data).toHaveBeenCalledWith(
        'Built prerequisite evaluation context',
        'PrerequisiteEvaluationService.evaluate',
        expect.any(Object)
      );
      expect(mockTrace.step).toHaveBeenCalledWith(
        'Evaluating 1 prerequisite rules',
        'PrerequisiteEvaluationService.#evaluateRules'
      );
      expect(mockTrace.success).toHaveBeenCalledWith(
        'Rule 1 passed',
        'PrerequisiteEvaluationService.#evaluateRules',
        expect.any(Object)
      );
    });

    it('should trace failures', () => {
      const prerequisites = [
        {
          logic: { '==': [1, 2] },
        },
      ];
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(false);

      service.evaluate(
        prerequisites,
        mockActionDefinition,
        mockActor,
        mockTrace
      );

      expect(mockTrace.failure).toHaveBeenCalledWith(
        'Prerequisite failed',
        'PrerequisiteEvaluationService._evaluatePrerequisite',
        expect.any(Object)
      );
    });
  });

  describe('edge cases', () => {
    it('should handle null action definition gracefully', () => {
      const prerequisites = [{ logic: true }];
      mockActionValidationContextBuilder.buildContext.mockReturnValue({
        actor: { id: 'test:actor', components: {} },
      });
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      const result = service.evaluate(prerequisites, null, {
        id: 'test:actor',
      });

      expect(result).toBe(true);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('unknown_action')
      );
    });

    it('should handle null actor gracefully', () => {
      const prerequisites = [{ logic: true }];
      mockActionValidationContextBuilder.buildContext.mockReturnValue({
        actor: { id: 'unknown_actor', components: {} },
      });
      mockJsonLogicEvaluationService.evaluate.mockReturnValue(true);

      const result = service.evaluate(
        prerequisites,
        { id: 'test:action' },
        null
      );

      expect(result).toBe(true);
      // The unknown_actor appears in the context JSON log
      const debugCalls = mockLogger.debug.mock.calls;
      const hasUnknownActor = debugCalls.some((call) =>
        call.some(
          (arg) => typeof arg === 'string' && arg.includes('unknown_actor')
        )
      );
      expect(hasUnknownActor).toBe(true);
    });

    it('should handle evaluation errors gracefully', () => {
      const prerequisites = [
        {
          logic: { '==': [1, 1] },
        },
      ];
      mockActionValidationContextBuilder.buildContext.mockReturnValue({
        actor: { id: 'test:actor', components: {} },
      });
      mockJsonLogicEvaluationService.evaluate.mockImplementation(() => {
        throw new Error('Evaluation failed');
      });

      const result = service.evaluate(
        prerequisites,
        { id: 'test:action' },
        { id: 'test:actor' }
      );

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during rule resolution or evaluation'),
        expect.any(Object)
      );
    });
  });
});
