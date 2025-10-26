// tests/unit/logic/systemLogicInterpreter.test.js

import { jest } from '@jest/globals';
import { describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import { REQUIRED_ENTITY_MANAGER_METHODS } from '../../../src/constants/entityManager.js';
import * as ruleCacheUtils from '../../../src/utils/ruleCacheUtils.js';

describe('SystemLogicInterpreter - Core Functionality', () => {
  let interpreter;
  let mockLogger;
  let mockEventBus;
  let mockDataRegistry;
  let mockJsonLogic;
  let mockEntityManager;
  let mockOperationInterpreter;
  let mockBodyGraphService;

  beforeEach(() => {
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
      getConditionDefinition: jest.fn(),
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
  });

  afterEach(() => {
    if (interpreter) {
      interpreter.shutdown();
    }
  });

  describe('Constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(() => {
        interpreter = new SystemLogicInterpreter({
          logger: mockLogger,
          eventBus: mockEventBus,
          dataRegistry: mockDataRegistry,
          jsonLogicEvaluationService: mockJsonLogic,
          entityManager: mockEntityManager,
          operationInterpreter: mockOperationInterpreter,
          bodyGraphService: mockBodyGraphService,
        });
      }).not.toThrow();

      expect(interpreter).toBeInstanceOf(SystemLogicInterpreter);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SystemLogicInterpreter: SystemLogicInterpreter: created'
      );
    });

    it('should validate required dependencies', () => {
      expect(() => {
        new SystemLogicInterpreter({
          logger: mockLogger,
          eventBus: null, // Invalid
          dataRegistry: mockDataRegistry,
          jsonLogicEvaluationService: mockJsonLogic,
          entityManager: mockEntityManager,
          operationInterpreter: mockOperationInterpreter,
          bodyGraphService: mockBodyGraphService,
        });
      }).toThrow();
    });

    it('should validate entity manager has required methods', () => {
      const incompleteEntityManager = {
        getEntity: jest.fn(),
        // Missing other required methods
      };

      expect(() => {
        new SystemLogicInterpreter({
          logger: mockLogger,
          eventBus: mockEventBus,
          dataRegistry: mockDataRegistry,
          jsonLogicEvaluationService: mockJsonLogic,
          entityManager: incompleteEntityManager,
          operationInterpreter: mockOperationInterpreter,
          bodyGraphService: mockBodyGraphService,
        });
      }).toThrow();
    });
  });

  describe('Initialization', () => {
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

    it('should initialize successfully with rules', () => {
      const testRules = [
        {
          rule_id: 'test-rule-1',
          event_type: 'test:event',
          condition: { '==': [true, true] },
          actions: [{ type: 'LOG', parameters: { message: 'test' } }],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);

      interpreter.initialize();

      expect(mockJsonLogic.addOperation).toHaveBeenCalledWith(
        'hasBodyPartWithComponentValue',
        expect.any(Function)
      );
      expect(mockDataRegistry.getAllSystemRules).toHaveBeenCalled();
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        '*',
        expect.any(Function)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "SystemLogicInterpreter: SystemLogicInterpreter: initialized & subscribed to '*'."
      );
    });

    it('should handle already initialized warning (lines 114-115)', () => {
      interpreter.initialize();
      mockLogger.warn.mockClear();

      // Initialize again
      interpreter.initialize();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'SystemLogicInterpreter: SystemLogicInterpreter already initialized.'
      );
    });

    it('should initialize with no rules and warn (lines 128-130)', () => {
      mockDataRegistry.getAllSystemRules.mockReturnValue([]);

      interpreter.initialize();

      expect(mockEventBus.subscribe).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'SystemLogicInterpreter: No system rules loaded – interpreter will remain idle.'
      );
    });

    it('should register custom JsonLogic operations', () => {
      interpreter.initialize();

      expect(mockJsonLogic.addOperation).toHaveBeenCalledWith(
        'hasBodyPartWithComponentValue',
        expect.any(Function)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SystemLogicInterpreter: Custom JsonLogic operations registered'
      );
    });

    it('should subscribe to events when rules exist (lines 123-124)', () => {
      const testRules = [
        {
          rule_id: 'test-rule',
          event_type: 'test:event',
          actions: [],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);

      interpreter.initialize();

      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        '*',
        expect.any(Function)
      );
    });
  });

  describe('Shutdown', () => {
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

    it('should shutdown properly and unsubscribe from events', () => {
      interpreter.shutdown();

      expect(mockEventBus.unsubscribe).toHaveBeenCalledWith(
        '*',
        expect.any(Function)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "SystemLogicInterpreter: SystemLogicInterpreter: removed '*' subscription: true."
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SystemLogicInterpreter: SystemLogicInterpreter: shut down.'
      );
    });

    it('should handle shutdown when not subscribed', () => {
      // Create instance but don't initialize with rules
      mockDataRegistry.getAllSystemRules.mockReturnValue([]);
      const uninitializedInterpreter = new SystemLogicInterpreter({
        logger: mockLogger,
        eventBus: mockEventBus,
        dataRegistry: mockDataRegistry,
        jsonLogicEvaluationService: mockJsonLogic,
        entityManager: mockEntityManager,
        operationInterpreter: mockOperationInterpreter,
        bodyGraphService: mockBodyGraphService,
      });
      uninitializedInterpreter.initialize();

      uninitializedInterpreter.shutdown();

      // Should still call unsubscribe but event handler should exist
      expect(mockEventBus.unsubscribe).toHaveBeenCalledWith(
        '*',
        expect.any(Function)
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SystemLogicInterpreter: SystemLogicInterpreter: shut down.'
      );
    });

    it('should clear internal state on shutdown', () => {
      interpreter.shutdown();

      // Try to initialize again to verify state was cleared
      expect(() => {
        interpreter.initialize();
      }).not.toThrow();
    });
  });

  describe('Rule Loading and Caching', () => {
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

    it('should load and cache rules from data registry', () => {
      const testRules = [
        {
          rule_id: 'test-rule-1',
          event_type: 'test:event1',
          actions: [{ type: 'LOG', parameters: { message: 'test1' } }],
        },
        {
          rule_id: 'test-rule-2',
          event_type: 'test:event2',
          actions: [{ type: 'LOG', parameters: { message: 'test2' } }],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);

      interpreter.initialize();

      expect(mockDataRegistry.getAllSystemRules).toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SystemLogicInterpreter: Finished caching rules. 2 event types have associated rules.'
      );
    });

    it('should handle empty rules array', () => {
      mockDataRegistry.getAllSystemRules.mockReturnValue([]);

      interpreter.initialize();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SystemLogicInterpreter: Finished caching rules. 0 event types have associated rules.'
      );
    });

    it('should handle null rules from data registry', () => {
      mockDataRegistry.getAllSystemRules.mockReturnValue(null);

      interpreter.initialize();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SystemLogicInterpreter: Finished caching rules. 0 event types have associated rules.'
      );
    });

    it('should cache ATTEMPT_ACTION_ID rules by action ID', () => {
      const testRules = [
        {
          rule_id: 'attempt-rule-1',
          event_type: 'ATTEMPT_ACTION',
          event_payload_filters: { actionId: 'specific-action' },
          actions: [
            { type: 'LOG', parameters: { message: 'specific action' } },
          ],
        },
        {
          rule_id: 'attempt-rule-2',
          event_type: 'ATTEMPT_ACTION',
          actions: [{ type: 'LOG', parameters: { message: 'any action' } }],
        },
      ];
      mockDataRegistry.getAllSystemRules.mockReturnValue(testRules);

      interpreter.initialize();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'SystemLogicInterpreter: Finished caching rules. 1 event types have associated rules.'
      );
    });

    it('logs detailed diagnostics for handle_sit_down_at_distance rules', () => {
      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      try {
        const specialRule = {
          rule_id: 'handle_sit_down_at_distance',
          event_type: 'special:event',
          condition: null,
          actions: [{ type: 'NO_OP' }],
        };

        mockDataRegistry.getAllSystemRules.mockReturnValue([specialRule]);

        interpreter.initialize();

        expect(consoleLogSpy).toHaveBeenCalledWith(
          '  - actions is Array: true'
        );
        expect(consoleLogSpy).toHaveBeenCalledWith('  - actions.length: 1');
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "SystemLogicInterpreter: [DEBUG] #loadAndCacheRules - RAW rule 'handle_sit_down_at_distance'"
          )
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            "SystemLogicInterpreter: [DEBUG] #loadAndCacheRules - RESOLVED rule 'handle_sit_down_at_distance'"
          )
        );
      } finally {
        consoleLogSpy.mockRestore();
      }
    });

    it('falls back to an always-false condition when condition resolution fails', () => {
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const buildRuleCacheSpy = jest.spyOn(
        ruleCacheUtils,
        'buildRuleCache'
      );

      try {
        const failingRule = {
          rule_id: 'failing-rule',
          event_type: 'error:event',
          condition: { condition_ref: 'missing-condition' },
          actions: [{ type: 'NO_OP' }],
        };

        mockDataRegistry.getAllSystemRules.mockReturnValue([failingRule]);
        mockDataRegistry.getConditionDefinition.mockReturnValue(null);

        interpreter.initialize();

        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining(
            "SystemLogicInterpreter: Failed to resolve condition references in rule 'failing-rule'"
          ),
          expect.any(Error)
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "[SystemLogicInterpreter] ERROR resolving condition for rule 'failing-rule':"
          ),
          expect.stringContaining('Could not resolve condition_ref')
        );

        const cachedRules = buildRuleCacheSpy.mock.calls[0][0];
        expect(cachedRules).toHaveLength(1);
        expect(cachedRules[0].condition).toEqual({ '==': [true, false] });
      } finally {
        consoleErrorSpy.mockRestore();
        buildRuleCacheSpy.mockRestore();
      }
    });
  });

  describe('processEvent', () => {
    it('converts event payloads before forwarding to the internal handler', async () => {
      interpreter = new SystemLogicInterpreter({
        logger: mockLogger,
        eventBus: mockEventBus,
        dataRegistry: mockDataRegistry,
        jsonLogicEvaluationService: mockJsonLogic,
        entityManager: mockEntityManager,
        operationInterpreter: mockOperationInterpreter,
        bodyGraphService: mockBodyGraphService,
      });

      const eventPayload = {
        eventType: 'test:event',
        payload: { key: 'value' },
      };

      await interpreter.processEvent(eventPayload);

      const eventLog = mockLogger.debug.mock.calls.find(
        (call) =>
          call[0] &&
          call[0].includes(
            'SystemLogicInterpreter: 🎯 [SystemLogicInterpreter] Event received: test:event'
          )
      );

      expect(eventLog).toBeDefined();
      expect(eventLog[1]).toEqual({
        payload: { key: 'value' },
        timestamp: expect.any(Number),
        isAsync: true,
      });
    });
  });

  describe('Custom JsonLogic Operation - hasBodyPartWithComponentValue', () => {
    let customOperation;

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

      // Capture the custom operation that was registered
      expect(mockJsonLogic.addOperation).toHaveBeenCalledWith(
        'hasBodyPartWithComponentValue',
        expect.any(Function)
      );
      customOperation = mockJsonLogic.addOperation.mock.calls[0][1];
    });

    it('should create proper execution context for operation', () => {
      const args = ['actor', 'core:movement', 'locked', false];
      const data = { actor: { id: 'test-actor-id' } };

      mockOperationInterpreter.execute.mockReturnValue(true);

      const result = customOperation(args, data);

      expect(mockOperationInterpreter.execute).toHaveBeenCalledWith(
        {
          type: 'HAS_BODY_PART_WITH_COMPONENT_VALUE',
          parameters: args,
        },
        expect.objectContaining({
          evaluationContext: data,
          entityManager: mockEntityManager,
          validatedEventDispatcher: null,
          logger: expect.objectContaining({
            debug: expect.any(Function),
            error: expect.any(Function),
            info: expect.any(Function),
            warn: expect.any(Function),
          }),
        })
      );

      expect(result).toBe(true);
    });

    it('should propagate operation interpreter result', () => {
      const args = ['target', 'core:health', 'value', 100];
      const data = { target: { id: 'target-id' } };

      mockOperationInterpreter.execute.mockReturnValue(false);

      const result = customOperation(args, data);

      expect(result).toBe(false);
    });

    it('should handle operation interpreter errors', () => {
      const args = ['actor', 'core:movement', 'locked', false];
      const data = { actor: { id: 'test-actor-id' } };

      mockOperationInterpreter.execute.mockImplementation(() => {
        throw new Error('Operation error');
      });

      expect(() => {
        customOperation(args, data);
      }).toThrow('Operation error');
    });
  });
});
