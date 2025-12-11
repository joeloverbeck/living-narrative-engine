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
    this.traceOutputDirectory = './test-execution-traces';

    // Error tracking
    this.loggedErrors = [];

    // Test configuration
    this.executionDelay = 0;
    this.failingActions = new Map();
    this.actionTimeouts = new Map();
    this.eventDispatchDelay = 0;

    this.commandProcessor = null;
  }

  /**
   * Initialize test bed with async setup
   */
  async initialize() {
    // Capture logged errors
    this.logger.error.mockImplementation((message, error) => {
      this.loggedErrors.push(message);
      if (error) {
        this.loggedErrors.push(error.message);
      }
    });

    // Default configuration
    this.configureTracing({ enabled: true, tracedActions: ['*'] });
  }

  /**
   * Configure tracing with full options
   *
   * @param {object|string[]} options - Tracing configuration options or array of traced actions
   * @param {boolean} [options.enabled] - Enable/disable tracing
   * @param {string[]} [options.tracedActions] - Actions to trace
   * @param {string} [options.outputDirectory] - Output directory for traces
   * @param {string} [options.verbosity] - Verbosity level
   */
  configureTracing(options = {}) {
    // Handle backward compatibility: if options is an array, treat it as tracedActions
    let resolvedOptions;
    if (Array.isArray(options)) {
      resolvedOptions = { tracedActions: options };
    } else {
      resolvedOptions = options;
    }

    const {
      enabled = true,
      tracedActions = ['*'],
      outputDirectory = this.traceOutputDirectory,
      verbosity = 'detailed',
    } = resolvedOptions;

    this.traceOutputDirectory = outputDirectory;

    this.actionTraceFilter = new ActionTraceFilter({
      enabled,
      tracedActions,
      excludedActions: [],
      verbosityLevel: verbosity,
      logger: this.logger,
    });

    this.actionExecutionTraceFactory = new ActionExecutionTraceFactory({
      logger: this.logger,
    });

    // Custom output handler to capture traces
    this.actionTraceOutputService = new ActionTraceOutputService({
      logger: this.logger,
      outputHandler: async (writeData, trace) => {
        // Simulate file writing
        const timestamp = Date.now();
        const actionId = trace.actionId.replace(':', '-');
        const fileName = `${actionId}-${timestamp}`;

        this.writtenTraces.push({
          fileName,
          writeData,
          trace: {
            actionId: trace.actionId,
            actorId: trace.actorId,
            isComplete: trace.isComplete,
            hasError: trace.hasError,
            duration: trace.duration,
            phases: trace.getExecutionPhases(),
            // Store the full trace for getLatestTrace
            fullTrace: trace,
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
   * Create test actor with components and data
   *
   * @param {string} id - Actor ID
   * @param {object} [options] - Actor configuration
   * @param {string[]} [options.components] - Component IDs
   * @param {object} [options.data] - Component data
   * @returns {object} Actor object
   */
  createActor(id, options = {}) {
    const { components = [], data = {} } = options;

    const actor = {
      id,
      name: `Actor ${id}`,
      components: {},
    };

    // Add requested components
    components.forEach((componentId) => {
      actor.components[componentId] = data[componentId] || {};
    });

    return actor;
  }

  /**
   * Create turn action for testing
   *
   * @param {string} actionId - Action definition ID
   * @param {object} [options] - Action configuration
   * @param {string} [options.commandString] - Command string
   * @param {object} [options.parameters] - Action parameters
   * @param {object} [options.resolvedParameters] - Resolved parameters
   * @returns {object} Turn action object
   */
  createTurnAction(actionId, options = {}) {
    const {
      commandString = `execute ${actionId}`,
      parameters = {},
      ...rest
    } = options;

    return {
      actionDefinitionId: actionId,
      commandString,
      parameters,
      ...rest,
    };
  }

  /**
   * Dispatch action through CommandProcessor
   *
   * @param {object} actor - Actor object
   * @param {object} turnAction - Turn action object
   * @returns {Promise<object>} Dispatch result
   */
  async dispatchAction(actor, turnAction) {
    // Check if action is configured to fail
    if (this.failingActions.has(turnAction.actionDefinitionId)) {
      const error = this.failingActions.get(turnAction.actionDefinitionId);
      this.eventDispatchService.dispatchWithErrorHandling.mockRejectedValueOnce(
        error
      );
    }

    // Apply action timeout if configured
    if (this.actionTimeouts.has(turnAction.actionDefinitionId)) {
      const timeout = this.actionTimeouts.get(turnAction.actionDefinitionId);
      // Simulate timeout by delaying the dispatch beyond the timeout
      this.eventDispatchService.dispatchWithErrorHandling.mockImplementationOnce(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, timeout + 1000));
          throw new Error(`Action timeout after ${timeout}ms`);
        }
      );
    }

    // Apply event dispatch delay if configured (including execution delay)
    const totalDelay = this.eventDispatchDelay + this.executionDelay;
    if (
      totalDelay > 0 &&
      !this.failingActions.has(turnAction.actionDefinitionId) &&
      !this.actionTimeouts.has(turnAction.actionDefinitionId)
    ) {
      this.eventDispatchService.dispatchWithErrorHandling.mockImplementationOnce(
        async (eventName, payload, description) => {
          await new Promise((resolve) => setTimeout(resolve, totalDelay));
          return true;
        }
      );
    }

    return this.commandProcessor.dispatchAction(actor, turnAction);
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
   * Wait for trace output to complete
   *
   * @param {number} [timeout] - Optional additional wait time in ms (default 0)
   * @returns {Promise<void>}
   */
  async waitForTraceOutput(timeout = 0) {
    // Wait for async writes to complete
    await this.actionTraceOutputService?.waitForPendingWrites();
    // Only add delay if explicitly requested (for timing-sensitive tests)
    if (timeout > 0) {
      await new Promise((resolve) => setTimeout(resolve, timeout));
    }
  }

  /**
   * Get latest trace for a specific action.
   * Note: Caller should call waitForTraceOutput() first if needed.
   *
   * @param {string} actionId - Action ID to find
   * @returns {object|null} Latest trace data
   */
  getLatestTrace(actionId) {
    const traces = this.writtenTraces.filter(
      (t) => t.trace.actionId === actionId
    );

    if (traces.length === 0) {
      return null;
    }

    // Return the most recent trace
    const latestTrace = traces[traces.length - 1];
    return latestTrace.trace.fullTrace?.toJSON() || latestTrace.writeData;
  }

  /**
   * Create large inventory for performance testing
   *
   * @param {number} count - Number of items to create
   * @returns {Array} Array of inventory items
   */
  createLargeInventory(count) {
    const items = [];
    for (let i = 0; i < count; i++) {
      items.push({
        id: `item-${i}`,
        name: `Item ${i}`,
        type: ['weapon', 'armor', 'consumable'][i % 3],
        quantity: Math.floor(Math.random() * 10) + 1,
        properties: {
          weight: Math.random() * 10,
          value: Math.floor(Math.random() * 1000),
          durability: Math.random(),
        },
      });
    }
    return items;
  }

  /**
   * Create complex stats for testing
   *
   * @returns {object} Complex stats object
   */
  createComplexStats() {
    return {
      health: { current: 100, max: 100, regen: 1.5 },
      mana: { current: 50, max: 50, regen: 0.5 },
      stamina: { current: 75, max: 100, regen: 2.0 },
      attributes: {
        strength: 15,
        dexterity: 12,
        intelligence: 18,
        wisdom: 14,
        constitution: 16,
        charisma: 10,
      },
      skills: {
        combat: { level: 5, experience: 2500 },
        magic: { level: 8, experience: 6400 },
        stealth: { level: 3, experience: 900 },
        crafting: { level: 6, experience: 3600 },
      },
      resistances: {
        physical: 0.1,
        fire: 0.2,
        ice: 0.15,
        poison: 0.3,
      },
    };
  }

  /**
   * Create complex parameters for testing
   *
   * @returns {object} Complex parameters object
   */
  createComplexParameters() {
    return {
      targets: ['entity-1', 'entity-2', 'entity-3'],
      options: {
        mode: 'aggressive',
        priority: 'high',
        filters: ['active', 'visible', 'hostile'],
      },
      metadata: {
        timestamp: Date.now(),
        source: 'test',
        version: '1.0.0',
      },
      calculations: {
        damage: { min: 10, max: 50, type: 'physical' },
        cost: { mana: 25, stamina: 10 },
        duration: 5000,
      },
    };
  }

  /**
   * Configure action to fail
   *
   * @param {string} actionId - Action ID
   * @param {Error} error - Error to throw
   */
  configureActionToFail(actionId, error) {
    this.failingActions.set(actionId, error);
  }

  /**
   * Configure EventDispatchService to fail
   *
   * @param {Error} error - Error to throw
   */
  configureEventDispatchToFail(error) {
    this.eventDispatchService.dispatchWithErrorHandling.mockRejectedValue(
      error
    );
  }

  /**
   * Configure action timeout
   *
   * @param {string} actionId - Action ID
   * @param {number} timeout - Timeout in ms
   */
  configureActionTimeout(actionId, timeout) {
    this.actionTimeouts.set(actionId, timeout);
  }

  /**
   * Configure event dispatch delay
   *
   * @param {number} delay - Delay in ms
   */
  configureEventDispatchDelay(delay) {
    this.eventDispatchDelay = delay;
  }

  /**
   * Add execution delay for timing tests
   *
   * @param {number} ms - Delay in milliseconds
   */
  addExecutionDelay(ms) {
    this.executionDelay = ms;
  }

  /**
   * Get logged error messages
   *
   * @returns {Array<string>} Array of error messages
   */
  getLoggedErrors() {
    return this.loggedErrors;
  }

  /**
   * Cleanup test bed
   */
  cleanup() {
    this.writtenTraces = [];
    this.loggedErrors = [];
    this.executionDelay = 0;
    this.failingActions.clear();
    this.actionTimeouts.clear();
    this.eventDispatchDelay = 0;
    this.actionTraceOutputService?.resetStatistics();
  }
}

export default CommandProcessorTracingTestBed;
