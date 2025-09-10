/**
 * @file Test fixtures for Action Execution Tracing E2E tests
 * Provides test data, mock actions, and scenarios for comprehensive tracing testing
 */

import { expect } from '@jest/globals';

/**
 * Standard test actions that should be traced
 */
export const TEST_ACTIONS = {
  // Simple movement action for basic tracing
  GO: 'core:go',

  // More complex action for detailed tracing
  ATTACK: 'core:attack',

  // Action that typically fails for error testing
  INVALID_ACTION: 'test:invalid',

  // Long-running action for performance testing
  LONG_OPERATION: 'test:longOperation',

  // Action with complex parameters
  COMPLEX_ACTION: 'test:complexAction',
};

/**
 * Test actors with different configurations
 */
export const TEST_ACTORS = {
  BASIC_PLAYER: {
    id: 'test-player-1',
    name: 'Test Player',
    components: {
      'core:position': {
        x: 0,
        y: 0,
        z: 0,
        location: 'test-room',
      },
      'core:movement': {
        speed: 1.0,
        canMove: true,
      },
      'core:stats': {
        health: 100,
        mana: 50,
        stamina: 75,
      },
    },
  },

  COMPLEX_ACTOR: {
    id: 'test-actor-complex',
    name: 'Complex Test Actor',
    components: {
      'core:position': {
        x: 10,
        y: 5,
        z: 0,
        location: 'complex-room',
        facing: 'north',
      },
      'core:movement': {
        speed: 2.0,
        canMove: true,
        restrictions: ['no-water', 'no-air'],
      },
      'core:stats': {
        health: 150,
        mana: 100,
        stamina: 120,
        attributes: {
          strength: 15,
          dexterity: 12,
          intelligence: 18,
        },
      },
      'core:inventory': {
        items: [
          { id: 'sword-1', type: 'weapon', equipped: true },
          { id: 'potion-1', type: 'consumable', quantity: 5 },
        ],
        maxWeight: 100,
        currentWeight: 25,
      },
      'core:combat': {
        attackPower: 20,
        defense: 15,
        accuracy: 0.85,
      },
    },
  },

  MINIMAL_ACTOR: {
    id: 'test-actor-minimal',
    name: 'Minimal Actor',
    components: {
      'core:stats': {
        health: 1,
      },
    },
  },
};

/**
 * Test turn actions for different scenarios
 */
export const TEST_TURN_ACTIONS = {
  SIMPLE_GO: {
    actionDefinitionId: TEST_ACTIONS.GO,
    commandString: 'go north',
    parameters: {
      direction: 'north',
    },
    timestamp: Date.now(),
  },

  COMPLEX_ATTACK: {
    actionDefinitionId: TEST_ACTIONS.ATTACK,
    commandString: 'attack goblin with sword',
    parameters: {
      target: 'goblin-1',
      weapon: 'sword-1',
      attackType: 'slash',
      power: 0.8,
    },
    resolvedParameters: {
      targetEntity: 'goblin-1',
      weaponEntity: 'sword-1',
    },
    timestamp: Date.now(),
  },

  INVALID_ACTION: {
    actionDefinitionId: TEST_ACTIONS.INVALID_ACTION,
    commandString: 'do something impossible',
    parameters: {
      impossibleThing: true,
    },
    timestamp: Date.now(),
  },

  LONG_OPERATION: {
    actionDefinitionId: TEST_ACTIONS.LONG_OPERATION,
    commandString: 'perform long calculation',
    parameters: {
      iterations: 1000,
      complexity: 'high',
    },
    timestamp: Date.now(),
  },

  COMPLEX_PARAMETERS: {
    actionDefinitionId: TEST_ACTIONS.COMPLEX_ACTION,
    commandString: 'execute complex action',
    parameters: {
      targets: ['entity-1', 'entity-2', 'entity-3'],
      options: {
        mode: 'aggressive',
        priority: 'high',
        filters: ['active', 'visible', 'hostile'],
      },
      metadata: {
        source: 'test',
        version: '1.0.0',
      },
      calculations: {
        damage: { min: 10, max: 50, type: 'physical' },
        cost: { mana: 25, stamina: 10 },
        duration: 5000,
      },
      nestedData: {
        level1: {
          level2: {
            level3: {
              deepValue: 'test-deep-value',
              array: [1, 2, 3, 4, 5],
            },
          },
        },
      },
    },
    timestamp: Date.now(),
  },
};

/**
 * Expected trace data structures for validation
 */
export const EXPECTED_TRACE_STRUCTURES = {
  BASIC_TRACE: {
    actionId: expect.any(String),
    actorId: expect.any(String),
    isComplete: expect.any(Boolean),
    hasError: expect.any(Boolean),
    duration: expect.any(Number),
    phases: expect.any(Array),
  },

  DETAILED_TRACE: {
    actionId: expect.any(String),
    actorId: expect.any(String),
    isComplete: true,
    hasError: false,
    duration: expect.any(Number),
    phases: expect.arrayContaining([
      expect.objectContaining({
        phase: expect.any(String),
        timestamp: expect.any(Number),
        description: expect.any(String),
      }),
    ]),
  },

  ERROR_TRACE: {
    actionId: expect.any(String),
    actorId: expect.any(String),
    isComplete: true,
    hasError: true,
    duration: expect.any(Number),
    // Note: errorData is accessed through trace.getError() method, not directly
  },
};

/**
 * Tracing configuration presets for different test scenarios
 */
export const TRACING_CONFIGS = {
  BASIC: {
    enabled: true,
    tracedActions: ['*'],
    verbosity: 'standard',
    outputDirectory: './test-traces-basic',
    enablePerformanceMonitoring: false,
    enableQueueProcessing: false,
  },

  DETAILED: {
    enabled: true,
    tracedActions: ['*'],
    verbosity: 'detailed',
    outputDirectory: './test-traces-detailed',
    enablePerformanceMonitoring: true,
    enableQueueProcessing: true,
  },

  SELECTIVE: {
    enabled: true,
    tracedActions: [TEST_ACTIONS.GO, TEST_ACTIONS.ATTACK],
    excludedActions: [TEST_ACTIONS.INVALID_ACTION],
    verbosity: 'verbose',
    outputDirectory: './test-traces-selective',
    enablePerformanceMonitoring: true,
    enableQueueProcessing: true,
  },

  PERFORMANCE: {
    enabled: true,
    tracedActions: ['*'],
    verbosity: 'minimal',
    outputDirectory: './test-traces-performance',
    enablePerformanceMonitoring: true,
    enableQueueProcessing: true,
    thresholds: {
      actionExecution: 100, // 100ms
      traceCapture: 1, // 1ms
      queueProcessing: 50, // 50ms
    },
  },

  DISABLED: {
    enabled: false,
    tracedActions: [],
    verbosity: 'minimal',
    outputDirectory: './test-traces-disabled',
    enablePerformanceMonitoring: false,
    enableQueueProcessing: false,
  },
};

/**
 * Load testing scenarios for queue and performance testing
 */
export const LOAD_SCENARIOS = {
  LIGHT_LOAD: {
    actionCount: 5,
    concurrency: 1,
    actionDelay: 10, // 10ms between actions
    actions: [TEST_ACTIONS.GO],
  },

  MODERATE_LOAD: {
    actionCount: 20,
    concurrency: 2,
    actionDelay: 50, // 50ms between actions
    actions: [TEST_ACTIONS.GO, TEST_ACTIONS.ATTACK],
  },

  HEAVY_LOAD: {
    actionCount: 50,
    concurrency: 5,
    actionDelay: 5, // 5ms between actions
    actions: [
      TEST_ACTIONS.GO,
      TEST_ACTIONS.ATTACK,
      TEST_ACTIONS.COMPLEX_ACTION,
    ],
  },

  BURST_LOAD: {
    actionCount: 100,
    concurrency: 10,
    actionDelay: 0, // No delay - maximum burst
    actions: [TEST_ACTIONS.GO],
  },
};

/**
 * Error scenarios for error handling and recovery testing
 */
export const ERROR_SCENARIOS = {
  INVALID_ACTION: {
    error: new Error('Action not found'),
    recoverable: false,
    expectedErrorType: 'ActionNotFoundError',
  },

  EXECUTION_FAILURE: {
    error: new Error('Action execution failed'),
    recoverable: true,
    expectedErrorType: 'ActionExecutionError',
  },

  TIMEOUT_ERROR: {
    error: new Error('Action timeout'),
    recoverable: true,
    expectedErrorType: 'ActionTimeoutError',
    timeout: 1000,
  },

  SYSTEM_ERROR: {
    error: new Error('System error occurred'),
    recoverable: false,
    expectedErrorType: 'SystemError',
  },

  VALIDATION_ERROR: {
    error: new Error('Parameter validation failed'),
    recoverable: false,
    expectedErrorType: 'ValidationError',
  },
};

/**
 * Performance thresholds and expectations
 */
export const PERFORMANCE_EXPECTATIONS = {
  TRACE_CAPTURE_OVERHEAD: {
    max: 1, // 1ms maximum overhead for trace capture
    typical: 0.5, // Typical overhead should be under 0.5ms
  },

  QUEUE_PROCESSING: {
    max: 100, // 100ms maximum for queue processing
    typical: 20, // Typical processing should be under 20ms
  },

  FILE_WRITE: {
    max: 500, // 500ms maximum for file write operations
    typical: 50, // Typical file writes should be under 50ms
  },

  MEMORY_USAGE: {
    maxIncrease: 10 * 1024 * 1024, // 10MB maximum increase during tests
    maxTotal: 100 * 1024 * 1024, // 100MB maximum total usage
  },
};

// Note: FILE_FORMAT_PATTERNS removed as file output functionality is not implemented
// Tests focus on in-memory trace data validation instead

/**
 * Utility function to create test action with timestamp
 *
 * @param {string} actionId - Action ID
 * @param {object} options - Action options
 * @returns {object} Test turn action
 */
export function createTestAction(actionId, options = {}) {
  return {
    actionDefinitionId: actionId,
    commandString: options.commandString || `execute ${actionId}`,
    parameters: options.parameters || {},
    timestamp: Date.now(),
    ...options,
  };
}

/**
 * Utility function to create test actor with components
 *
 * @param {string} id - Actor ID
 * @param {object} components - Component data
 * @returns {object} Test actor
 */
export function createTestActor(id, components = {}) {
  return {
    id,
    name: `Test Actor ${id}`,
    components: {
      'core:stats': { health: 100 },
      ...components,
    },
  };
}

/**
 * Generate load test scenario
 *
 * @param {object} scenario - Load scenario configuration
 * @returns {Array} Array of test actions for load testing
 */
export function generateLoadTestActions(scenario) {
  const actions = [];

  for (let i = 0; i < scenario.actionCount; i++) {
    const actionId = scenario.actions[i % scenario.actions.length];
    actions.push(
      createTestAction(actionId, {
        commandString: `load-test-${i} ${actionId}`,
        parameters: { testIndex: i, timestamp: Date.now() },
      })
    );
  }

  return actions;
}
