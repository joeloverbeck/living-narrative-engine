// tests/unit/logic/systemLogicInterpreter.ruleProcessing.test.js

import { jest } from '@jest/globals';
import { describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import { REQUIRED_ENTITY_MANAGER_METHODS } from '../../../src/constants/entityManager.js';

// Mock the evaluateConditionWithLogging function
jest.mock('../../../src/logic/jsonLogicEvaluationService.js', () => ({
  evaluateConditionWithLogging: jest.fn(),
}));

// Mock the action sequence module
jest.mock('../../../src/logic/actionSequence.js', () => ({
  executeActionSequence: jest.fn(),
}));

// Mock the context assembler module
jest.mock('../../../src/logic/contextAssembler.js', () => ({
  createNestedExecutionContext: jest.fn(),
}));

// Mock the JSON logic utils
jest.mock('../../../src/utils/jsonLogicUtils.js', () => ({
  isEmptyCondition: jest.fn(),
}));

import { evaluateConditionWithLogging } from '../../../src/logic/jsonLogicEvaluationService.js';
import { executeActionSequence } from '../../../src/logic/actionSequence.js';
import { createNestedExecutionContext } from '../../../src/logic/contextAssembler.js';
import { isEmptyCondition } from '../../../src/utils/jsonLogicUtils.js';

describe('SystemLogicInterpreter - Rule Processing', () => {
  let interpreter;
  let mockLogger;
  let mockEventBus;
  let mockDataRegistry;
  let mockJsonLogic;
  let mockEntityManager;
  let mockOperationInterpreter;
  let mockBodyGraphService;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock logger
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Mock event bus
    mockEventBus = {
      subscribe: jest.fn(),
      unsubscribe: jest.fn().mockReturnValue(true),
    };

    // Mock data registry
    mockDataRegistry = {
      getAllSystemRules: jest.fn().mockReturnValue([]),
    };

    // Mock JSON logic
    mockJsonLogic = {
      evaluate: jest.fn(),
      addOperation: jest.fn(),
    };

    // Mock entity manager with all required methods
    mockEntityManager = {};
    REQUIRED_ENTITY_MANAGER_METHODS.forEach((method) => {
      mockEntityManager[method] = jest.fn();
    });

    // Mock operation interpreter
    mockOperationInterpreter = {
      execute: jest.fn(),
    };

    // Mock body graph service
    mockBodyGraphService = {
      hasPartWithComponentValue: jest.fn(),
    };

    // Default mock implementations
    createNestedExecutionContext.mockReturnValue({
      evaluationContext: {
        actor: { id: 'test-actor' },
        target: { id: 'test-target' },
        event: { type: 'test:event', payload: {} },
      },
      entityManager: mockEntityManager,
      validatedEventDispatcher: null,
      logger: mockLogger,
    });

    executeActionSequence.mockResolvedValue();
    isEmptyCondition.mockReturnValue(false);
    evaluateConditionWithLogging.mockReturnValue({
      result: true,
      errored: false,
    });
  });

  afterEach(() => {
    if (interpreter) {
      interpreter.shutdown();
    }
  });

  describe('Rule Condition Evaluation', () => {
    beforeEach(() => {
      interpreter = new SystemLogicInterpreter({
        logger: mockLogger,
        eventBus: mockEventBus,
        dataRegistry: mockDataRegistry,
        jsonLogicEvaluationService: mockJsonLogic,
        entityManager: mockEntityManager,
        operationInterpreter: mockOperationInterpreter,
        bodyGraphService: mockBodyGraphService,
      });
    });

    it('should auto-pass rules with no condition', async () => {
      const testRules = [
        {
          rule_id: 'no-condition-rule',
          event_type: 'test:event',
          // No condition property
          actions: [{ type: 'LOG', parameters: { message: 'test' } }],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: { actorId: 'test-actor' },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[Rule no-condition-rule] No condition defined or condition is empty. Defaulting to passed.')
      );
      expect(executeActionSequence).toHaveBeenCalled();
    });

    it('should auto-pass rules with empty condition', async () => {
      isEmptyCondition.mockReturnValue(true);

      const testRules = [
        {
          rule_id: 'empty-condition-rule',
          event_type: 'test:event',
          condition: {},
          actions: [{ type: 'LOG', parameters: { message: 'test' } }],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: { actorId: 'test-actor' },
      });

      expect(isEmptyCondition).toHaveBeenCalledWith({});
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[Rule empty-condition-rule] No condition defined or condition is empty. Defaulting to passed.')
      );
      expect(executeActionSequence).toHaveBeenCalled();
    });

    it('should evaluate non-empty conditions and pass when true', async () => {
      evaluateConditionWithLogging.mockReturnValue({
        result: true,
        errored: false,
      });

      const testRules = [
        {
          rule_id: 'condition-true-rule',
          event_type: 'test:event',
          condition: { '==': [true, true] },
          actions: [{ type: 'LOG', parameters: { message: 'test' } }],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: { actorId: 'test-actor' },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[Rule condition-true-rule] Condition found. Evaluating using jsonLogicDataForEval...')
      );
      expect(evaluateConditionWithLogging).toHaveBeenCalledWith(
        mockJsonLogic,
        { '==': [true, true] },
        expect.any(Object),
        expect.objectContaining({
          debug: expect.any(Function),
          error: expect.any(Function),
          info: expect.any(Function),
          warn: expect.any(Function),
        }),
        '[Rule condition-true-rule]'
      );
      expect(executeActionSequence).toHaveBeenCalled();
    });

    it('should skip actions when condition evaluates to false', async () => {
      evaluateConditionWithLogging.mockReturnValue({
        result: false,
        errored: false,
      });

      const testRules = [
        {
          rule_id: 'condition-false-rule',
          event_type: 'test:event',
          condition: { '==': [true, false] },
          actions: [{ type: 'LOG', parameters: { message: 'test' } }],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: { actorId: 'test-actor' },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Rule 'condition-false-rule' actions skipped for event 'test:event' due to condition evaluating to false.")
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("⏭️ [SystemLogicInterpreter] Rule 'condition-false-rule' actions skipped for event 'test:event' due to condition evaluating to false.")
      );
      expect(executeActionSequence).not.toHaveBeenCalled();
    });

    it('should skip actions when condition evaluation errors', async () => {
      evaluateConditionWithLogging.mockReturnValue({
        result: false,
        errored: true,
      });

      const testRules = [
        {
          rule_id: 'condition-error-rule',
          event_type: 'test:event',
          condition: { 'invalid-op': ['test'] },
          actions: [{ type: 'LOG', parameters: { message: 'test' } }],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: { actorId: 'test-actor' },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("Rule 'condition-error-rule' actions skipped for event 'test:event' due to error during condition evaluation.")
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("⏭️ [SystemLogicInterpreter] Rule 'condition-error-rule' actions skipped for event 'test:event' due to error during condition evaluation.")
      );
      expect(executeActionSequence).not.toHaveBeenCalled();
    });

    it('should handle rules with missing rule_id in condition evaluation', async () => {
      const testRules = [
        {
          // Missing rule_id
          event_type: 'test:event',
          condition: { '==': [true, true] },
          actions: [{ type: 'LOG', parameters: { message: 'test' } }],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: { actorId: 'test-actor' },
      });

      expect(evaluateConditionWithLogging).toHaveBeenCalledWith(
        mockJsonLogic,
        { '==': [true, true] },
        expect.any(Object),
        expect.objectContaining({
          debug: expect.any(Function),
          error: expect.any(Function),
          info: expect.any(Function),
          warn: expect.any(Function),
        }),
        '[Rule NO_ID]'
      );
    });
  });

  describe('Action Execution', () => {
    beforeEach(() => {
      interpreter = new SystemLogicInterpreter({
        logger: mockLogger,
        eventBus: mockEventBus,
        dataRegistry: mockDataRegistry,
        jsonLogicEvaluationService: mockJsonLogic,
        entityManager: mockEntityManager,
        operationInterpreter: mockOperationInterpreter,
        bodyGraphService: mockBodyGraphService,
      });
    });

    it('should execute actions when condition passes', async () => {
      const testActions = [
        { type: 'LOG', parameters: { message: 'action1' } },
        { type: 'DISPATCH_EVENT', parameters: { event: 'test:dispatched' } },
      ];

      const testRules = [
        {
          rule_id: 'action-rule',
          event_type: 'test:event',
          condition: { '==': [true, true] },
          actions: testActions,
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: { actorId: 'test-actor' },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('✅ [SystemLogicInterpreter] Rule action-rule: Condition passed, proceeding to actions')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('🎬 [SystemLogicInterpreter] Rule action-rule: Starting action sequence (2 actions)')
      );

      expect(executeActionSequence).toHaveBeenCalledWith(
        testActions,
        expect.objectContaining({
          scopeLabel: "Rule 'action-rule'",
          jsonLogic: mockJsonLogic,
        }),
        expect.objectContaining({
          debug: expect.any(Function),
          error: expect.any(Function),
          info: expect.any(Function),
          warn: expect.any(Function),
        }),
        mockOperationInterpreter
      );
    });

    it('should handle rules with no actions', async () => {
      const testRules = [
        {
          rule_id: 'no-actions-rule',
          event_type: 'test:event',
          condition: { '==': [true, true] },
          actions: [],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: { actorId: 'test-actor' },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ [SystemLogicInterpreter] Rule no-actions-rule: No actions to execute')
      );
      expect(executeActionSequence).not.toHaveBeenCalled();
    });

    it('should handle rules with null actions', async () => {
      const testRules = [
        {
          rule_id: 'null-actions-rule',
          event_type: 'test:event',
          condition: { '==': [true, true] },
          actions: null,
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: { actorId: 'test-actor' },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ [SystemLogicInterpreter] Rule null-actions-rule: No actions to execute')
      );
      expect(executeActionSequence).not.toHaveBeenCalled();
    });

    it('should handle action execution errors', async () => {
      executeActionSequence.mockRejectedValue(
        new Error('Action execution failed')
      );

      const testRules = [
        {
          rule_id: 'failing-action-rule',
          event_type: 'test:event',
          actions: [{ type: 'LOG', parameters: { message: 'test' } }],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: { actorId: 'test-actor' },
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ [SystemLogicInterpreter] Rule failing-action-rule: Error during action sequence:'),
        expect.any(Error)
      );
    });

    it('should log timing information for action execution', async () => {
      const testRules = [
        {
          rule_id: 'timed-rule',
          event_type: 'test:event',
          actions: [{ type: 'LOG', parameters: { message: 'test' } }],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: { actorId: 'test-actor' },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(
          /🎉 \[SystemLogicInterpreter\] Rule timed-rule: Action sequence completed \(\d+ms\)/
        )
      );
    });
  });

  describe('_executeActions Method', () => {
    beforeEach(() => {
      interpreter = new SystemLogicInterpreter({
        logger: mockLogger,
        eventBus: mockEventBus,
        dataRegistry: mockDataRegistry,
        jsonLogicEvaluationService: mockJsonLogic,
        entityManager: mockEntityManager,
        operationInterpreter: mockOperationInterpreter,
        bodyGraphService: mockBodyGraphService,
      });
      interpreter.initialize();
    });

    it('should execute action sequence with proper context', async () => {
      const testActions = [
        { type: 'LOG', parameters: { message: 'test1' } },
        { type: 'LOG', parameters: { message: 'test2' } },
      ];

      const mockContext = {
        evaluationContext: { actor: { id: 'test-actor' } },
        entityManager: mockEntityManager,
        logger: mockLogger,
      };

      await interpreter._executeActions(testActions, mockContext, 'Test Scope');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('🎬 [SystemLogicInterpreter] _executeActions: Starting action sequence for Test Scope (2 actions)')
      );

      expect(executeActionSequence).toHaveBeenCalledWith(
        testActions,
        expect.objectContaining({
          ...mockContext,
          scopeLabel: 'Test Scope',
          jsonLogic: mockJsonLogic,
        }),
        expect.objectContaining({
          debug: expect.any(Function),
          error: expect.any(Function),
          info: expect.any(Function),
          warn: expect.any(Function),
        }),
        mockOperationInterpreter
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(
          /🎉 \[SystemLogicInterpreter\] _executeActions: Action sequence completed for Test Scope \(\d+ms\)/
        )
      );
    });

    it('should handle action sequence execution errors', async () => {
      executeActionSequence.mockRejectedValue(
        new Error('Action sequence failed')
      );

      const testActions = [{ type: 'LOG', parameters: { message: 'test' } }];
      const mockContext = {
        evaluationContext: { actor: { id: 'test-actor' } },
        entityManager: mockEntityManager,
        logger: mockLogger,
      };

      await expect(
        interpreter._executeActions(testActions, mockContext, 'Failing Scope')
      ).rejects.toThrow('Action sequence failed');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('❌ [SystemLogicInterpreter] _executeActions: Error in action sequence for Failing Scope:'),
        expect.any(Error)
      );
    });

    it('should include timing information in logs', async () => {
      const testActions = [{ type: 'LOG', parameters: { message: 'test' } }];
      const mockContext = {
        evaluationContext: { actor: { id: 'test-actor' } },
        entityManager: mockEntityManager,
        logger: mockLogger,
      };

      await interpreter._executeActions(
        testActions,
        mockContext,
        'Timed Scope'
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('🎬 [SystemLogicInterpreter] _executeActions: Starting action sequence for Timed Scope (1 actions)')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringMatching(
          /🎉 \[SystemLogicInterpreter\] _executeActions: Action sequence completed for Timed Scope \(\d+ms\)/
        )
      );
    });
  });

  describe('Rule Processing Edge Cases', () => {
    beforeEach(() => {
      interpreter = new SystemLogicInterpreter({
        logger: mockLogger,
        eventBus: mockEventBus,
        dataRegistry: mockDataRegistry,
        jsonLogicEvaluationService: mockJsonLogic,
        entityManager: mockEntityManager,
        operationInterpreter: mockOperationInterpreter,
        bodyGraphService: mockBodyGraphService,
      });
    });

    it('should handle rule with undefined condition property', async () => {
      const testRules = [
        {
          rule_id: 'undefined-condition-rule',
          event_type: 'test:event',
          condition: undefined,
          actions: [{ type: 'LOG', parameters: { message: 'test' } }],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: { actorId: 'test-actor' },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[Rule undefined-condition-rule] No condition defined or condition is empty. Defaulting to passed.')
      );
      expect(executeActionSequence).toHaveBeenCalled();
    });

    it('should handle rule with non-array actions', async () => {
      const testRules = [
        {
          rule_id: 'non-array-actions-rule',
          event_type: 'test:event',
          actions: 'not-an-array',
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: { actorId: 'test-actor' },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('⚠️ [SystemLogicInterpreter] Rule non-array-actions-rule: No actions to execute')
      );
      expect(executeActionSequence).not.toHaveBeenCalled();
    });

    it('should log rule processing start and completion', async () => {
      const testRules = [
        {
          rule_id: 'complete-rule',
          event_type: 'test:event',
          actions: [{ type: 'LOG', parameters: { message: 'test' } }],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: { actorId: 'test-actor' },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('🔍 [SystemLogicInterpreter] Rule complete-rule: Starting condition evaluation')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('✅ [SystemLogicInterpreter] Rule complete-rule completed successfully')
      );
    });
  });
});
