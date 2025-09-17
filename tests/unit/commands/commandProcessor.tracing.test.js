import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import CommandProcessor from '../../../src/commands/commandProcessor.js';
import {
  createMockActionTraceFilter,
  createMockActionExecutionTraceFactory,
  createMockActionTraceOutputService,
  createMockActionExecutionTrace,
  createMockEventDispatchService,
  createMockLogger,
  createMockSafeEventDispatcher,
} from '../../common/mockFactories/index.js';

describe('CommandProcessor - Execution Tracing', () => {
  let commandProcessor;
  let mockEventDispatchService;
  let mockLogger;
  let mockSafeEventDispatcher;
  let mockActionTraceFilter;
  let mockActionExecutionTraceFactory;
  let mockActionTraceOutputService;
  let mockTrace;

  beforeEach(() => {
    mockEventDispatchService = createMockEventDispatchService();
    mockLogger = createMockLogger();
    mockSafeEventDispatcher = createMockSafeEventDispatcher();
    mockActionTraceFilter = createMockActionTraceFilter();
    mockActionExecutionTraceFactory = createMockActionExecutionTraceFactory();
    mockActionTraceOutputService = createMockActionTraceOutputService();
    mockTrace = createMockActionExecutionTrace();

    // Set up default mocks
    mockActionTraceFilter.isEnabled.mockReturnValue(true);
    mockActionTraceFilter.shouldTrace.mockReturnValue(false); // Default to no tracing
    mockActionExecutionTraceFactory.createFromTurnAction.mockReturnValue(
      mockTrace
    );
    mockEventDispatchService.dispatchWithErrorHandling.mockResolvedValue(true);

    commandProcessor = new CommandProcessor({
      eventDispatchService: mockEventDispatchService,
      logger: mockLogger,
      safeEventDispatcher: mockSafeEventDispatcher,
      actionTraceFilter: mockActionTraceFilter,
      actionExecutionTraceFactory: mockActionExecutionTraceFactory,
      actionTraceOutputService: mockActionTraceOutputService,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Trace Creation Logic', () => {
    it('should not create trace when tracing is disabled globally', async () => {
      mockActionTraceFilter.isEnabled.mockReturnValue(false);

      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'movement:go',
        commandString: 'go north',
      };

      await commandProcessor.dispatchAction(actor, turnAction);

      expect(
        mockActionExecutionTraceFactory.createFromTurnAction
      ).not.toHaveBeenCalled();
      expect(mockActionTraceOutputService.writeTrace).not.toHaveBeenCalled();
    });

    it('should not create trace when action is not marked for tracing', async () => {
      mockActionTraceFilter.shouldTrace.mockReturnValue(false);

      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'movement:go',
        commandString: 'go north',
      };

      await commandProcessor.dispatchAction(actor, turnAction);

      expect(
        mockActionExecutionTraceFactory.createFromTurnAction
      ).not.toHaveBeenCalled();
      expect(mockActionTraceOutputService.writeTrace).not.toHaveBeenCalled();
    });

    it('should create and capture trace when action is marked for tracing', async () => {
      mockActionTraceFilter.shouldTrace.mockReturnValue(true);

      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'movement:go',
        commandString: 'go north',
        parameters: { direction: 'north' },
      };

      await commandProcessor.dispatchAction(actor, turnAction);

      expect(
        mockActionExecutionTraceFactory.createFromTurnAction
      ).toHaveBeenCalledWith(turnAction, 'player-1');
      expect(mockTrace.captureDispatchStart).toHaveBeenCalled();
      expect(mockTrace.captureEventPayload).toHaveBeenCalled();
      expect(mockTrace.captureDispatchResult).toHaveBeenCalled();
      expect(mockActionTraceOutputService.writeTrace).toHaveBeenCalledWith(
        mockTrace
      );
    });

    it('should work without tracing infrastructure', async () => {
      // Create processor without tracing
      const processorNoTracing = new CommandProcessor({
        eventDispatchService: mockEventDispatchService,
        logger: mockLogger,
        safeEventDispatcher: mockSafeEventDispatcher,
      });

      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'movement:go',
        commandString: 'go north',
      };

      const result = await processorNoTracing.dispatchAction(actor, turnAction);

      expect(result.success).toBe(true);
      expect(mockActionTraceOutputService.writeTrace).not.toHaveBeenCalled();
    });
  });

  describe('Trace Lifecycle', () => {
    beforeEach(() => {
      mockActionTraceFilter.shouldTrace.mockReturnValue(true);
    });

    it('should capture all execution phases in correct order', async () => {
      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'movement:go',
        commandString: 'go north',
      };

      await commandProcessor.dispatchAction(actor, turnAction);

      // Verify call order
      const captureStart = mockTrace.captureDispatchStart;
      const capturePayload = mockTrace.captureEventPayload;
      const captureResult = mockTrace.captureDispatchResult;

      expect(captureStart).toHaveBeenCalled();
      expect(capturePayload).toHaveBeenCalled();
      expect(captureResult).toHaveBeenCalled();

      // Verify they were called in order
      const startOrder = captureStart.mock.invocationCallOrder[0];
      const payloadOrder = capturePayload.mock.invocationCallOrder[0];
      const resultOrder = captureResult.mock.invocationCallOrder[0];

      expect(startOrder).toBeLessThan(payloadOrder);
      expect(payloadOrder).toBeLessThan(resultOrder);
    });

    it('should capture event payload with correct data', async () => {
      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'movement:go',
        commandString: 'go north',
        resolvedParameters: {
          targetId: 'location-1',
          direction: 'north',
        },
      };

      await commandProcessor.dispatchAction(actor, turnAction);

      expect(mockTrace.captureEventPayload).toHaveBeenCalledWith(
        expect.objectContaining({
          eventName: 'core:attempt_action',
          actorId: 'player-1',
          actionId: 'movement:go',
          targetId: 'location-1',
          originalInput: 'go north',
          timestamp: expect.any(Number),
        })
      );
    });

    it('should capture dispatch result with success status', async () => {
      mockEventDispatchService.dispatchWithErrorHandling.mockResolvedValue(
        true
      );

      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'movement:go',
        commandString: 'go north',
      };

      await commandProcessor.dispatchAction(actor, turnAction);

      expect(mockTrace.captureDispatchResult).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          timestamp: expect.any(Number),
          metadata: expect.objectContaining({
            actionId: 'movement:go',
            actorId: 'player-1',
            eventType: 'core:attempt_action',
          }),
        })
      );
    });

    it('should capture dispatch result with failure status', async () => {
      mockEventDispatchService.dispatchWithErrorHandling.mockResolvedValue(
        false
      );

      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'movement:go',
        commandString: 'go north',
      };

      const result = await commandProcessor.dispatchAction(actor, turnAction);

      expect(result.success).toBe(false);
      expect(mockTrace.captureDispatchResult).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
        })
      );
      expect(mockActionTraceOutputService.writeTrace).toHaveBeenCalledWith(
        mockTrace
      );
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockActionTraceFilter.shouldTrace.mockReturnValue(true);
    });

    it('should continue execution when trace creation fails', async () => {
      mockActionExecutionTraceFactory.createFromTurnAction.mockImplementation(
        () => {
          throw new Error('Trace creation failed');
        }
      );

      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'movement:go',
        commandString: 'go north',
      };

      const result = await commandProcessor.dispatchAction(actor, turnAction);

      expect(result.success).toBe(true); // Execution should continue
      expect(
        mockEventDispatchService.dispatchWithErrorHandling
      ).toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to create execution trace',
        expect.any(Object)
      );
    });

    it('should continue execution when payload capture fails', async () => {
      mockTrace.captureEventPayload.mockImplementation(() => {
        throw new Error('Payload capture failed');
      });

      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'movement:go',
        commandString: 'go north',
      };

      const result = await commandProcessor.dispatchAction(actor, turnAction);

      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to capture event payload in trace',
        expect.any(Object)
      );
    });

    it('should capture execution error in trace', async () => {
      const executionError = new Error('Dispatch failed');
      mockEventDispatchService.dispatchWithErrorHandling.mockRejectedValue(
        executionError
      );

      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'movement:go',
        commandString: 'go north',
      };

      const result = await commandProcessor.dispatchAction(actor, turnAction);

      expect(result.success).toBe(false);
      expect(mockTrace.captureError).toHaveBeenCalledWith(executionError);
      expect(mockActionTraceOutputService.writeTrace).toHaveBeenCalledWith(
        mockTrace
      );
    });

    it('should handle trace write failures gracefully', async () => {
      mockActionTraceOutputService.writeTrace.mockRejectedValue(
        new Error('Write failed')
      );

      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'movement:go',
        commandString: 'go north',
      };

      const result = await commandProcessor.dispatchAction(actor, turnAction);

      expect(result.success).toBe(true); // Action execution should succeed

      // Wait for async trace write to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to write execution trace',
        expect.any(Object)
      );
    });

    it('should continue when result capture fails', async () => {
      mockTrace.captureDispatchResult.mockImplementation(() => {
        throw new Error('Result capture failed');
      });

      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'movement:go',
        commandString: 'go north',
      };

      const result = await commandProcessor.dispatchAction(actor, turnAction);

      expect(result.success).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to capture dispatch result in trace',
        expect.any(Object)
      );
      // Trace should still be written even with partial data
      expect(mockActionTraceOutputService.writeTrace).toHaveBeenCalledWith(
        mockTrace
      );
    });

    it('should continue when error capture fails', async () => {
      const executionError = new Error('Dispatch failed');
      mockEventDispatchService.dispatchWithErrorHandling.mockRejectedValue(
        executionError
      );
      mockTrace.captureError.mockImplementation(() => {
        throw new Error('Error capture failed');
      });

      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'movement:go',
        commandString: 'go north',
      };

      const result = await commandProcessor.dispatchAction(actor, turnAction);

      expect(result.success).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to capture error in trace',
        expect.objectContaining({
          originalError: 'Dispatch failed',
          traceError: 'Error capture failed',
        })
      );
      // Trace should still be written
      expect(mockActionTraceOutputService.writeTrace).toHaveBeenCalledWith(
        mockTrace
      );
    });
  });

  describe('Performance Optimization', () => {
    it('should have zero overhead when tracing is disabled', async () => {
      mockActionTraceFilter.isEnabled.mockReturnValue(false);

      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'movement:go',
        commandString: 'go north',
      };

      const start = performance.now();
      await commandProcessor.dispatchAction(actor, turnAction);
      const duration = performance.now() - start;

      // No tracing-related method calls
      expect(
        mockActionExecutionTraceFactory.createFromTurnAction
      ).not.toHaveBeenCalled();
      expect(mockActionTraceOutputService.writeTrace).not.toHaveBeenCalled();

      // Duration should be minimal (just action execution)
      expect(duration).toBeLessThan(50); // Very liberal threshold for CI
    });

    it('should have minimal overhead when action not traced', async () => {
      mockActionTraceFilter.shouldTrace.mockReturnValue(false);

      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'movement:go',
        commandString: 'go north',
      };

      await commandProcessor.dispatchAction(actor, turnAction);

      // Should only check if tracing enabled/should trace
      expect(mockActionTraceFilter.isEnabled).toHaveBeenCalled();
      expect(mockActionTraceFilter.shouldTrace).toHaveBeenCalled();
      expect(
        mockActionExecutionTraceFactory.createFromTurnAction
      ).not.toHaveBeenCalled();
    });

    it('should write trace asynchronously without blocking', async () => {
      mockActionTraceFilter.shouldTrace.mockReturnValue(true);

      // Make writeTrace take some time
      let writeCompleted = false;
      mockActionTraceOutputService.writeTrace.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
        writeCompleted = true;
      });

      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'movement:go',
        commandString: 'go north',
      };

      const result = await commandProcessor.dispatchAction(actor, turnAction);

      // Action should complete before trace write
      expect(result.success).toBe(true);
      expect(writeCompleted).toBe(false);

      // Wait for write to complete
      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(writeCompleted).toBe(true);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle multi-target actions correctly', async () => {
      mockActionTraceFilter.shouldTrace.mockReturnValue(true);

      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'core:give',
        commandString: 'give sword to guard',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            primary: ['item-1'],
            secondary: ['npc-1'],
          },
        },
      };

      await commandProcessor.dispatchAction(actor, turnAction);

      expect(mockTrace.captureEventPayload).toHaveBeenCalledWith(
        expect.objectContaining({
          targets: expect.objectContaining({
            primary: expect.objectContaining({
              entityId: 'item-1',
            }),
            secondary: expect.objectContaining({
              entityId: 'npc-1',
            }),
          }),
        })
      );
    });

    it('should handle missing optional fields gracefully', async () => {
      mockActionTraceFilter.shouldTrace.mockReturnValue(true);

      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'core:look',
        // No commandString
        // No parameters
      };

      const result = await commandProcessor.dispatchAction(actor, turnAction);

      expect(result.success).toBe(true);
      expect(mockTrace.captureEventPayload).toHaveBeenCalledWith(
        expect.objectContaining({
          actionId: 'core:look',
          originalInput: 'core:look', // Falls back to actionId
        })
      );
    });

    it('should handle partial tracing infrastructure', async () => {
      // Create processor with filter but no output service
      const partialProcessor = new CommandProcessor({
        eventDispatchService: mockEventDispatchService,
        logger: mockLogger,
        safeEventDispatcher: mockSafeEventDispatcher,
        actionTraceFilter: mockActionTraceFilter,
        actionExecutionTraceFactory: mockActionExecutionTraceFactory,
        // No output service
      });

      mockActionTraceFilter.shouldTrace.mockReturnValue(true);

      const actor = { id: 'player-1' };
      const turnAction = {
        actionDefinitionId: 'movement:go',
        commandString: 'go north',
      };

      const result = await partialProcessor.dispatchAction(actor, turnAction);

      expect(result.success).toBe(true);
      // Trace should be created but not written
      expect(
        mockActionExecutionTraceFactory.createFromTurnAction
      ).toHaveBeenCalled();
      expect(mockActionTraceOutputService.writeTrace).not.toHaveBeenCalled();
    });
  });
});
