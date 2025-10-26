// tests/unit/logic/systemLogicInterpreter.eventHandling.test.js

import { jest } from '@jest/globals';
import { describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import { ATTEMPT_ACTION_ID } from '../../../src/constants/eventIds.js';
import { REQUIRED_ENTITY_MANAGER_METHODS } from '../../../src/constants/entityManager.js';

// Mock the context assembler module
jest.mock('../../../src/logic/contextAssembler.js', () => ({
  createNestedExecutionContext: jest.fn(),
}));

// Mock the action sequence module
jest.mock('../../../src/logic/actionSequence.js', () => ({
  executeActionSequence: jest.fn(),
}));

import { createNestedExecutionContext } from '../../../src/logic/contextAssembler.js';
import { executeActionSequence } from '../../../src/logic/actionSequence.js';

describe('SystemLogicInterpreter - Event Handling', () => {
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

    // Mock context assembler
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

    // Mock action sequence
    executeActionSequence.mockResolvedValue();
  });

  afterEach(() => {
    if (interpreter) {
      interpreter.shutdown();
    }
  });

  describe('Event Reception and Processing', () => {
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

    it('should handle events when no rules are found for event type', async () => {
      const testRules = [
        {
          rule_id: 'other-rule',
          event_type: 'other:event',
          actions: [{ type: 'LOG', parameters: { message: 'test' } }],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();

      // Get the event handler
      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      // Send event that has no matching rules
      await eventHandler({
        type: 'test:no-rules',
        payload: { data: 'test' },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'SystemLogicInterpreter: 🎯 [SystemLogicInterpreter] No rules found for event type: test:no-rules'
        )
      );
    });

    it('should process events with basic rules', async () => {
      const testRules = [
        {
          rule_id: 'test-rule',
          event_type: 'test:event',
          actions: [{ type: 'LOG', parameters: { message: 'test' } }],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();

      // Verify event handler was subscribed
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        '*',
        expect.any(Function)
      );

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: { actorId: 'test-actor', targetId: 'test-target' },
      });

      // Check that the event received log exists
      const eventReceivedCalls = mockLogger.debug.mock.calls.filter(
        (call) =>
          call[0] &&
          call[0].includes(
            '🎯 [SystemLogicInterpreter] Event received: test:event'
          )
      );
      expect(eventReceivedCalls.length).toBeGreaterThan(0);

      // Check that the rule count log exists with correct payload
      const ruleCountCalls = mockLogger.debug.mock.calls.filter(
        (call) =>
          call[0] &&
          call[0].includes(
            'Received event: test:event. Found 1 potential rule(s).'
          )
      );
      expect(ruleCountCalls.length).toBeGreaterThan(0);
      expect(ruleCountCalls[0][1]).toEqual({
        payload: { actorId: 'test-actor', targetId: 'test-target' },
      });
    });

    it('derives target identifiers from targets.primary and logs trace detection', async () => {
      const trace = { captureOperationStart: jest.fn() };
      const testRules = [
        {
          rule_id: 'trace-rule',
          event_type: 'test:event',
          condition: null,
          actions: [],
        },
      ];

      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();

      createNestedExecutionContext.mockClear();

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];
      await eventHandler({
        type: 'test:event',
        payload: {
          actorId: 'actor-1',
          targets: { primary: { entityId: 'target-9' } },
          trace,
        },
      });

      expect(createNestedExecutionContext).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'test:event' }),
        'actor-1',
        'target-9',
        mockEntityManager,
        expect.objectContaining({
          debug: expect.any(Function),
          error: expect.any(Function),
          info: expect.any(Function),
          warn: expect.any(Function),
        }),
        trace
      );

      const traceLogFound = mockLogger.debug.mock.calls.some(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes(
            'SystemLogicInterpreter: 🔍 [SystemLogicInterpreter] Trace object found in event payload, passing to execution context'
          )
      );

      expect(traceLogFound).toBe(true);
    });

    it('should handle ATTEMPT_ACTION_ID events with specific action rules', async () => {
      const testRules = [
        {
          rule_id: 'specific-action-rule',
          event_type: ATTEMPT_ACTION_ID,
          event_payload_filters: { actionId: 'specific-action' },
          actions: [{ type: 'LOG', parameters: { message: 'specific' } }],
        },
        {
          rule_id: 'catch-all-rule',
          event_type: ATTEMPT_ACTION_ID,
          actions: [{ type: 'LOG', parameters: { message: 'catch-all' } }],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      // Test with specific action ID
      await eventHandler({
        type: ATTEMPT_ACTION_ID,
        payload: { actionId: 'specific-action', actorId: 'test-actor' },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'SystemLogicInterpreter: Received event: core:attempt_action. Found 2 potential rule(s).'
        ),
        expect.any(Object)
      );
    });

    it('should handle ATTEMPT_ACTION_ID events with no specific action ID', async () => {
      const testRules = [
        {
          rule_id: 'catch-all-rule',
          event_type: ATTEMPT_ACTION_ID,
          actions: [{ type: 'LOG', parameters: { message: 'catch-all' } }],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      // Test with no action ID
      await eventHandler({
        type: ATTEMPT_ACTION_ID,
        payload: { actorId: 'test-actor' },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'SystemLogicInterpreter: Received event: core:attempt_action. Found 1 potential rule(s).'
        ),
        expect.any(Object)
      );
    });

    it('should handle events with no matching rules after action ID filtering', async () => {
      const testRules = [
        {
          rule_id: 'specific-action-rule',
          event_type: ATTEMPT_ACTION_ID,
          condition: {
            '==': [{ var: 'event.payload.actionId' }, 'other-action'],
          },
          actions: [{ type: 'LOG', parameters: { message: 'other' } }],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: ATTEMPT_ACTION_ID,
        payload: { actionId: 'different-action', actorId: 'test-actor' },
      });

      // Check that the "no matching rules" log exists
      const noMatchingRulesCalls = mockLogger.debug.mock.calls.filter(
        (call) =>
          call[0] &&
          call[0].includes(
            '🎯 [SystemLogicInterpreter] No matching rules for event: core:attempt_action'
          )
      );
      expect(noMatchingRulesCalls.length).toBeGreaterThan(0);
    });
  });

  describe('Context Assembly', () => {
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

      const testRules = [
        {
          rule_id: 'test-rule',
          event_type: 'test:event',
          actions: [{ type: 'LOG', parameters: { message: 'test' } }],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();
    });

    it('should assemble context with actorId and targetId from payload', async () => {
      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: {
          actorId: 'test-actor',
          targetId: 'test-target',
          data: 'test',
        },
      });

      expect(createNestedExecutionContext).toHaveBeenCalledWith(
        {
          type: 'test:event',
          payload: {
            actorId: 'test-actor',
            targetId: 'test-target',
            data: 'test',
          },
        },
        'test-actor',
        'test-target',
        mockEntityManager,
        expect.objectContaining({
          debug: expect.any(Function),
          error: expect.any(Function),
          info: expect.any(Function),
          warn: expect.any(Function),
        }),
        undefined
      );

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'SystemLogicInterpreter: [Event: test:event] Assembling execution context via createNestedExecutionContext... (ActorID: test-actor, TargetID: test-target)'
        )
      );
    });

    it('should handle missing actorId and use entityId as fallback', async () => {
      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: { entityId: 'fallback-entity', targetId: 'test-target' },
      });

      expect(createNestedExecutionContext).toHaveBeenCalledWith(
        expect.any(Object),
        'fallback-entity',
        'test-target',
        mockEntityManager,
        expect.objectContaining({
          debug: expect.any(Function),
          error: expect.any(Function),
          info: expect.any(Function),
          warn: expect.any(Function),
        }),
        undefined
      );
    });

    it('should handle missing IDs gracefully', async () => {
      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: { data: 'test' },
      });

      expect(createNestedExecutionContext).toHaveBeenCalledWith(
        expect.any(Object),
        null,
        null,
        mockEntityManager,
        expect.objectContaining({
          debug: expect.any(Function),
          error: expect.any(Function),
          info: expect.any(Function),
          warn: expect.any(Function),
        }),
        undefined
      );
    });

    it('should handle context assembly errors', async () => {
      createNestedExecutionContext.mockImplementation(() => {
        throw new Error('Context assembly failed');
      });

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: { actorId: 'test-actor' },
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'SystemLogicInterpreter: ❌ [SystemLogicInterpreter] Failed to build JsonLogic context for event'
        ),
        expect.any(Object),
        expect.any(Error)
      );
    });

    it('should log successful context assembly', async () => {
      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: { actorId: 'test-actor' },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'SystemLogicInterpreter: [Event: test:event] createNestedExecutionContext returned a valid ExecutionContext.'
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'SystemLogicInterpreter: [Event: test:event] Final ExecutionContext (nested structure) assembled successfully.'
        )
      );
    });
  });

  describe('Rule Processing Workflow', () => {
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

    it('should process multiple rules sequentially', async () => {
      const testRules = [
        {
          rule_id: 'rule-1',
          event_type: 'test:event',
          actions: [{ type: 'LOG', parameters: { message: 'rule1' } }],
        },
        {
          rule_id: 'rule-2',
          event_type: 'test:event',
          actions: [{ type: 'LOG', parameters: { message: 'rule2' } }],
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
        expect.stringContaining(
          'SystemLogicInterpreter: 🚀 [SystemLogicInterpreter] Starting rule processing for event: test:event (2 rules)'
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'SystemLogicInterpreter: 📋 [SystemLogicInterpreter] Processing rule 1/2: rule-1'
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'SystemLogicInterpreter: 📋 [SystemLogicInterpreter] Processing rule 2/2: rule-2'
        )
      );
    });

    it('should handle rule processing errors and continue with next rules', async () => {
      const testRules = [
        {
          rule_id: 'failing-rule',
          event_type: 'test:event',
          condition: { '==': [true, true] },
          actions: [{ type: 'LOG', parameters: { message: 'failing' } }],
        },
        {
          rule_id: 'success-rule',
          event_type: 'test:event',
          actions: [{ type: 'LOG', parameters: { message: 'success' } }],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();

      // Mock the first rule to throw an error
      mockJsonLogic.evaluate
        .mockReturnValueOnce(true) // First call for condition evaluation
        .mockReturnValueOnce(true); // Second call for second rule

      executeActionSequence
        .mockRejectedValueOnce(new Error('Action failed')) // First rule fails
        .mockResolvedValueOnce(); // Second rule succeeds

      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: { actorId: 'test-actor' },
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "SystemLogicInterpreter: ❌ [SystemLogicInterpreter] Rule 'failing-rule' threw error:"
        ),
        expect.any(Error)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'SystemLogicInterpreter: ✅ [SystemLogicInterpreter] Rule success-rule completed successfully'
        )
      );
    });

    it('should log timing information for event processing', async () => {
      const testRules = [
        {
          rule_id: 'test-rule',
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
          /SystemLogicInterpreter: 🏁 \[SystemLogicInterpreter\] Finished processing event: test:event \(\d+ms total\)/
        )
      );
    });

    it('should handle rules with missing rule_id', async () => {
      const testRules = [
        {
          // Missing rule_id
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
        expect.stringContaining(
          'SystemLogicInterpreter: 📋 [SystemLogicInterpreter] Processing rule 1/1: NO_ID'
        )
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'SystemLogicInterpreter: ✅ [SystemLogicInterpreter] Rule NO_ID completed successfully'
        )
      );
    });
  });

  describe('Performance and Timing', () => {
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

      const testRules = [
        {
          rule_id: 'test-rule',
          event_type: 'test:event',
          actions: [{ type: 'LOG', parameters: { message: 'test' } }],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);
      interpreter.initialize();
    });

    it('should include timing information in event processing logs', async () => {
      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: { actorId: 'test-actor' },
      });

      // Check for timing logs
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'SystemLogicInterpreter: 🎯 [SystemLogicInterpreter] Event received: test:event'
        ),
        expect.objectContaining({
          timestamp: expect.any(Number),
          isAsync: true,
        })
      );
    });

    it('should include payload and rule information in debug logs', async () => {
      const testPayload = { actorId: 'test-actor', data: 'test-data' };
      const eventHandler = mockEventBus.subscribe.mock.calls[0][1];

      await eventHandler({
        type: 'test:event',
        payload: testPayload,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(
          'SystemLogicInterpreter: 🎯 [SystemLogicInterpreter] Processing event: test:event. Found 1 potential rule(s).'
        ),
        expect.objectContaining({
          payload: testPayload,
          ruleIds: ['test-rule'],
        })
      );
    });
  });
});
