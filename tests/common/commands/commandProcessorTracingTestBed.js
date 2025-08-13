/**
 * @file Reusable test bed for CommandProcessor tracing integration tests
 */

import CommandProcessor from '../../../src/commands/commandProcessor.js';
import ActionTraceFilter from '../../../src/actions/tracing/actionTraceFilter.js';
import { ActionExecutionTraceFactory } from '../../../src/actions/tracing/actionExecutionTraceFactory.js';
import { ActionTraceOutputService } from '../../../src/actions/tracing/actionTraceOutputService.js';
import {
  createMockEventDispatchService,
  createMockLogger,
  createMockSafeEventDispatcher,
} from '../mockFactories/index.js';

/**
 * Test bed for CommandProcessor tracing integration tests
 */
class CommandProcessorTracingTestBed {
  constructor() {
    this.logger = createMockLogger();
    this.safeEventDispatcher = createMockSafeEventDispatcher();
    this.eventDispatchService = createMockEventDispatchService();

    // Real tracing components
    this.actionTraceFilter = null;
    this.actionExecutionTraceFactory = null;
    this.actionTraceOutputService = null;

    // Track written traces
    this.writtenTraces = [];

    this.commandProcessor = null;
  }

  /**
   * Configure tracing for specific actions
   *
   * @param {string[]} tracedActions - Actions to trace
   */
  configureTracing(tracedActions = ['*']) {
    this.actionTraceFilter = new ActionTraceFilter({
      enabled: true,
      tracedActions,
      excludedActions: [],
      verbosityLevel: 'detailed',
      logger: this.logger,
    });

    this.actionExecutionTraceFactory = new ActionExecutionTraceFactory({
      logger: this.logger,
    });

    // Custom output handler to capture traces
    this.actionTraceOutputService = new ActionTraceOutputService({
      logger: this.logger,
      outputHandler: async (writeData, trace) => {
        this.writtenTraces.push({
          writeData,
          trace: {
            actionId: trace.actionId,
            actorId: trace.actorId,
            isComplete: trace.isComplete,
            hasError: trace.hasError,
            duration: trace.duration,
            phases: trace.getExecutionPhases(),
          },
        });
      },
    });

    this.commandProcessor = new CommandProcessor({
      logger: this.logger,
      safeEventDispatcher: this.safeEventDispatcher,
      eventDispatchService: this.eventDispatchService,
      actionTraceFilter: this.actionTraceFilter,
      actionExecutionTraceFactory: this.actionExecutionTraceFactory,
      actionTraceOutputService: this.actionTraceOutputService,
    });
  }

  /**
   * Disable tracing
   */
  disableTracing() {
    this.actionTraceFilter = new ActionTraceFilter({
      enabled: false,
      logger: this.logger,
    });

    this.commandProcessor = new CommandProcessor({
      logger: this.logger,
      safeEventDispatcher: this.safeEventDispatcher,
      eventDispatchService: this.eventDispatchService,
      actionTraceFilter: this.actionTraceFilter,
      actionExecutionTraceFactory: this.actionExecutionTraceFactory,
      actionTraceOutputService: this.actionTraceOutputService,
    });
  }

  /**
   * Setup real EventDispatchService (mock for now)
   */
  setupRealEventDispatchService() {
    // In a real test, this would use the actual EventDispatchService
    // For now, we'll configure the mock to behave more realistically
    this.eventDispatchService.dispatchWithErrorHandling.mockImplementation(
      async (eventName, payload, description) => {
        // Simulate some processing time
        await new Promise((resolve) => setTimeout(resolve, 5));

        // Validate payload structure
        if (!payload.eventName || !payload.actorId || !payload.actionId) {
          throw new Error('Invalid payload structure');
        }

        return true;
      }
    );
  }

  /**
   * Create test actor
   *
   * @param {string} id - Actor ID
   * @returns {object} Actor object
   */
  createActor(id) {
    return {
      id,
      name: `Actor ${id}`,
      components: {},
    };
  }

  /**
   * Create turn action for testing
   *
   * @param {string} actionId - Action definition ID
   * @param {string} commandString - Command string
   * @param {object} [parameters] - Optional parameters
   * @returns {object} Turn action object
   */
  createTurnAction(actionId, commandString, parameters = {}) {
    return {
      actionDefinitionId: actionId,
      commandString,
      parameters,
      ...(parameters.resolvedParameters && {
        resolvedParameters: parameters.resolvedParameters,
      }),
    };
  }

  /**
   * Get written traces
   *
   * @returns {Promise<Array>} Written traces
   */
  async getWrittenTraces() {
    // Wait for async writes to complete
    await this.actionTraceOutputService.waitForPendingWrites();
    return this.writtenTraces.map((t) => t.writeData);
  }

  /**
   * Get raw trace objects
   *
   * @returns {Array} Raw trace objects
   */
  getRawTraces() {
    return this.writtenTraces.map((t) => t.trace);
  }

  /**
   * Clear written traces
   */
  clearTraces() {
    this.writtenTraces = [];
  }

  /**
   * Cleanup test bed
   */
  cleanup() {
    this.writtenTraces = [];
    this.actionTraceOutputService?.resetStatistics();
  }
}

export default CommandProcessorTracingTestBed;