/**
 * @file Utilities for testing rules through the event-driven system
 */
/* eslint-env jest */
/* global jest */

import { ensureValidLogger } from '../../../src/utils/loggerUtils.js';
import SimpleEntityManager from '../entities/simpleEntityManager.js';
import AjvSchemaValidator from '../../../src/validation/ajvSchemaValidator.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import EventBus from '../../../src/events/eventBus.js';
import ValidatedEventDispatcher from '../../../src/events/validatedEventDispatcher.js';
import { SafeEventDispatcher } from '../../../src/events/safeEventDispatcher.js';
import SystemLogicInterpreter from '../../../src/logic/systemLogicInterpreter.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';

/**
 * Creates a standardized test environment for rule testing
 *
 * @param {object} config - Configuration options
 * @returns {object} Test environment with all necessary services
 */
export function createRuleTestEnvironment(config = {}) {
  const {
    entities = [],
    rules = [],
    macros = {},
    conditions = {},
    logger = new ConsoleLogger('DEBUG'),
  } = config;

  // Create entity manager
  const entityManager = new SimpleEntityManager(entities);

  // Create event bus
  const eventBus = new EventBus();

  // Create schema validator
  const schemaValidator = new AjvSchemaValidator({ logger });

  // Create data registry mock
  const dataRegistry = {
    getAllSystemRules: jest.fn().mockReturnValue(rules),
    getConditionDefinition: jest.fn((id) => conditions[id]),
    getMacroDefinition: jest.fn((id) => macros[id]),
    getEventDefinition: jest.fn((eventName) => {
      const commonEvents = {
        'core:turn_ended': { payloadSchema: null },
        'core:perceptible_event': { payloadSchema: null },
        'core:display_successful_action_result': { payloadSchema: null },
        'core:display_failed_action_result': { payloadSchema: null },
        'core:system_error_occurred': { payloadSchema: null },
      };
      return commonEvents[eventName] || null;
    }),
  };

  // Create event dispatchers
  const validatedEventDispatcher = new ValidatedEventDispatcher({
    eventBus,
    gameDataRepository: dataRegistry,
    schemaValidator,
    logger,
  });

  const safeEventDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher,
    logger,
  });

  // Create JSON logic evaluator
  const jsonLogic = new JsonLogicEvaluationService({
    logger,
    gameDataRepository: dataRegistry,
  });

  // Event capture mechanism
  const capturedEvents = [];
  const eventsToCapture = [
    'core:perceptible_event',
    'core:display_successful_action_result',
    'core:display_failed_action_result',
    'core:turn_ended',
    'core:system_error_occurred',
  ];

  // Track unsubscribe functions
  const unsubscribeFunctions = [];

  eventsToCapture.forEach((eventType) => {
    const unsubscribe = eventBus.subscribe(eventType, (event) => {
      capturedEvents.push({ eventType: event.type, payload: event.payload });
    });
    if (unsubscribe) {
      unsubscribeFunctions.push(unsubscribe);
    }
  });

  return {
    entityManager,
    eventBus,
    dataRegistry,
    validatedEventDispatcher,
    safeEventDispatcher,
    jsonLogic,
    logger,
    capturedEvents,
    schemaValidator,
    cleanup: () => {
      // Call all unsubscribe functions
      unsubscribeFunctions.forEach((fn) => fn());
    },
  };
}

/**
 * Creates a SystemLogicInterpreter with registered operation handlers
 *
 * @param {object} environment - Test environment from createRuleTestEnvironment
 * @param {object} handlers - Operation handlers to register
 * @returns {object} Configured SystemLogicInterpreter
 */
export function createSystemLogicInterpreterWithHandlers(
  environment,
  handlers
) {
  const { entityManager, eventBus, dataRegistry, logger, jsonLogic } =
    environment;

  // Create operation registry
  const operationRegistry = new OperationRegistry({ logger });

  // Register all handlers
  Object.entries(handlers).forEach(([type, handler]) => {
    operationRegistry.register(type, handler.execute.bind(handler));
  });

  // Create operation interpreter
  const operationInterpreter = new OperationInterpreter({
    logger,
    operationRegistry,
  });

  // Create mock body graph service
  const mockBodyGraphService = {
    hasPartWithComponentValue: jest.fn().mockReturnValue({ found: false }),
  };

  // Create SystemLogicInterpreter
  const interpreter = new SystemLogicInterpreter({
    logger,
    eventBus,
    dataRegistry,
    jsonLogicEvaluationService: jsonLogic,
    entityManager,
    operationInterpreter,
    bodyGraphService: mockBodyGraphService,
  });

  interpreter.initialize();

  return {
    interpreter,
    operationRegistry,
    operationInterpreter,
    cleanup: () => {
      interpreter.shutdown();
    },
  };
}

/**
 * Validates rule structure against the schema
 *
 * @param {object} rule - Rule to validate
 * @param {object} ruleSchema - Rule schema
 * @returns {object} Validation results
 */
export function validateRuleStructure(rule, ruleSchema) {
  const validation = {
    ruleId: rule.rule_id,
    isValid: true,
    errors: [],
    warnings: [],
    structure: {
      hasEventType: false,
      hasCondition: false,
      hasActions: false,
      actionCount: 0,
      complexity: 'low',
    },
  };

  try {
    // Validate basic structure
    if (!rule.rule_id || typeof rule.rule_id !== 'string') {
      validation.warnings.push('Rule should have a rule_id for debugging');
    }

    // Validate required event_type
    if (!rule.event_type || typeof rule.event_type !== 'string') {
      validation.errors.push('Rule must have a valid event_type');
      validation.isValid = false;
    } else {
      validation.structure.hasEventType = true;
      if (!rule.event_type.includes(':')) {
        validation.warnings.push(
          'event_type should be namespaced (e.g., "core:attempt_action")'
        );
      }
    }

    // Validate optional condition
    if (rule.condition) {
      validation.structure.hasCondition = true;

      if (rule.condition.condition_ref) {
        if (typeof rule.condition.condition_ref !== 'string') {
          validation.errors.push('condition_ref must be a string');
          validation.isValid = false;
        } else if (!rule.condition.condition_ref.includes(':')) {
          validation.warnings.push('condition_ref should be namespaced');
        }
      }
    }

    // Validate required actions
    if (!rule.actions || !Array.isArray(rule.actions)) {
      validation.errors.push('Rule must have an actions array');
      validation.isValid = false;
    } else if (rule.actions.length === 0) {
      validation.errors.push('Rule must have at least one action');
      validation.isValid = false;
    } else {
      validation.structure.hasActions = true;
      validation.structure.actionCount = rule.actions.length;
    }

    // Assess complexity
    validation.structure.complexity = assessRuleComplexity(rule);
  } catch (error) {
    validation.errors.push(`Rule validation error: ${error.message}`);
    validation.isValid = false;
  }

  return validation;
}

/**
 * Assesses rule complexity
 *
 * @param {object} rule - Rule to assess
 * @returns {string} Complexity level (low, medium, high)
 */
function assessRuleComplexity(rule) {
  let score = 0;

  // Check condition complexity
  if (rule.condition) {
    if (rule.condition.condition_ref) {
      score += 1;
    } else {
      // Inline JSON Logic
      const conditionStr = JSON.stringify(rule.condition);
      if (conditionStr.includes('and') || conditionStr.includes('or')) {
        score += 2;
      }
      if (conditionStr.includes('if')) {
        score += 2;
      }
    }
  }

  // Check action complexity
  if (rule.actions) {
    score += Math.min(rule.actions.length * 0.5, 3);

    // Check for complex operations
    const hasComplexOps = rule.actions.some(
      (a) =>
        a.type === 'IF' || a.type === 'FOR_EACH' || a.type === 'IF_CO_LOCATED'
    );

    if (hasComplexOps) {
      score += 2;
    }
  }

  if (score <= 2) return 'low';
  if (score <= 5) return 'medium';
  return 'high';
}

/**
 * Generates test events for rule testing
 *
 * @param {object} config - Event generation configuration
 * @returns {Array} Array of test events
 */
export function generateTestEvents(config = {}) {
  const events = [];

  // Generate standard action events
  if (config.includeActions !== false) {
    events.push(...generateActionTestEvents(config));
  }

  // Generate system events
  if (config.includeSystemEvents !== false) {
    events.push(...generateSystemTestEvents(config));
  }

  // Generate edge case events
  if (config.includeEdgeCases !== false) {
    events.push(...generateEdgeCaseEvents(config));
  }

  return events;
}

/**
 * Generates action test events
 *
 * @param {object} config - Generation configuration
 * @returns {Array} Action test events in proper format
 */
function generateActionTestEvents(config = {}) {
  return [
    {
      type: 'core:attempt_action',
      payload: {
        actorId: config.actorId || 'test_actor',
        actionId: 'core:follow',
        targetId: config.targetId || 'test_target',
        originalInput: 'follow target',
        timestamp: Date.now(),
      },
    },
    {
      type: 'core:attempt_action',
      payload: {
        actorId: config.actorId || 'test_actor',
        actionId: 'movement:go',
        targetId: 'north',
        originalInput: 'go north',
        timestamp: Date.now(),
      },
    },
    {
      type: 'core:attempt_action',
      payload: {
        actorId: config.actorId || 'test_actor',
        actionId: 'core:wait',
        targetId: null,
        originalInput: 'wait',
        timestamp: Date.now(),
      },
    },
  ];
}

/**
 * Generates system test events
 *
 * @param {object} config - Generation configuration
 * @returns {Array} System events
 */
function generateSystemTestEvents(config = {}) {
  return [
    {
      type: 'core:turn_started',
      payload: {
        entityId: config.entityId || 'test_actor',
        turnNumber: 1,
        timestamp: Date.now(),
      },
    },
    {
      type: 'core:turn_ended',
      payload: {
        entityId: config.entityId || 'test_actor',
        turnNumber: 1,
        timestamp: Date.now(),
      },
    },
    {
      type: 'core:entity_speech',
      payload: {
        speakerId: config.entityId || 'test_actor',
        message: 'Test speech',
        locationId: config.locationId || 'test_location',
        timestamp: Date.now(),
      },
    },
  ];
}

/**
 * Generates edge case test events
 *
 * @param {object} config - Generation configuration
 * @returns {Array} Edge case test events
 */
function generateEdgeCaseEvents(config = {}) {
  return [
    // Missing required fields
    {
      type: 'core:attempt_action',
      payload: {
        // Missing actorId
        actionId: 'test:action',
        targetId: 'test_target',
        originalInput: 'missing actor',
        timestamp: Date.now(),
      },
    },
    // Null values
    {
      type: 'core:attempt_action',
      payload: {
        actorId: 'test_actor',
        actionId: 'test:action',
        targetId: null,
        originalInput: 'null target',
        timestamp: Date.now(),
      },
    },
    // Complex payload
    {
      type: 'core:attempt_action',
      payload: {
        actorId: 'test_actor',
        actionId: 'test:complex',
        targetId: 'primary_target',
        item: 'test_item',
        location: 'test_location',
        amount: 10,
        metadata: {
          source: 'test',
          priority: 'high',
        },
        originalInput: 'complex action',
        timestamp: Date.now(),
      },
    },
  ];
}

export default {
  createRuleTestEnvironment,
  createSystemLogicInterpreterWithHandlers,
  validateRuleStructure,
  generateTestEvents,
};
