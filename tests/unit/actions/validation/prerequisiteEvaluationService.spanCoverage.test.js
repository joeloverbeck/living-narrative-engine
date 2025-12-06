import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../../src/actions/validation/prerequisiteEvaluationService.js';

describe('PrerequisiteEvaluationService span-aware coverage', () => {
  let mockLogger;
  let mockJsonLogicEvaluationService;
  let mockActionValidationContextBuilder;
  let mockGameDataRepository;
  let service;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockJsonLogicEvaluationService = {
      evaluate: jest.fn().mockReturnValue(true),
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

  it('logs a debug message when the evaluation context components cannot be serialised', () => {
    const problematicComponents = {
      _attempted: false,
      toJSON() {
        if (!this._attempted) {
          this._attempted = true;
          throw new Error('serialization failure');
        }

        return { safe: true };
      },
    };

    mockActionValidationContextBuilder.buildContext.mockReturnValue({
      actor: {
        id: 'actor:circular',
        components: problematicComponents,
      },
    });

    const prerequisites = [{ logic: { '==': [1, 1] } }];

    const result = service.evaluate(
      prerequisites,
      { id: 'action:circular' },
      { id: 'actor:circular' }
    );

    expect(result).toBe(true);
    expect(mockLogger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Could not serialize components for validation logging'
      ),
      expect.any(Error)
    );
  });

  it('logs an error when the evaluation context actor lacks a components property', () => {
    mockActionValidationContextBuilder.buildContext.mockReturnValue({
      actor: { id: 'actor:missingComponents' },
    });

    const prerequisites = [{ logic: { '==': [1, 1] } }];

    const result = service.evaluate(
      prerequisites,
      { id: 'action:missingComponents' },
      { id: 'actor:missingComponents' }
    );

    expect(result).toBe(true);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        'ERROR - Actor context is missing components property entirely!'
      )
    );
  });

  it('wraps prerequisite evaluation in tracing spans when provided', () => {
    mockActionValidationContextBuilder.buildContext.mockReturnValue({
      actor: {
        id: 'actor:trace',
        components: {
          inventory: { items: ['token'] },
        },
      },
    });

    const trace = {
      withSpan: jest.fn((name, fn, metadata) => {
        const executionResult = fn();
        return executionResult;
      }),
      step: jest.fn(),
      data: jest.fn(),
      success: jest.fn(),
      failure: jest.fn(),
      error: jest.fn(),
    };

    const prerequisites = [{ logic: { '==': [1, 1] } }];

    const result = service.evaluate(
      prerequisites,
      { id: 'action:trace' },
      { id: 'actor:trace' },
      trace
    );

    expect(result).toBe(true);

    expect(trace.withSpan).toHaveBeenCalledWith(
      'prerequisite.evaluate',
      expect.any(Function),
      expect.objectContaining({
        actionId: 'action:trace',
        actorId: 'actor:trace',
        ruleCount: 1,
      })
    );
    expect(trace.withSpan).toHaveBeenCalledWith(
      'prerequisite.evaluateRules',
      expect.any(Function),
      expect.objectContaining({
        actionId: 'action:trace',
        ruleCount: 1,
      })
    );
    expect(trace.withSpan).toHaveBeenCalledWith(
      'prerequisite.rule.1',
      expect.any(Function),
      expect.objectContaining({
        actionId: 'action:trace',
        ruleNumber: 1,
        totalRules: 1,
      })
    );
  });
});
