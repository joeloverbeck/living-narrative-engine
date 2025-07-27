# Ticket 13: Add Rules Testing Framework

## Overview

Create a comprehensive testing framework specifically designed for validating multi-target rule functionality, performance, and backward compatibility. This framework will provide automated testing capabilities for both legacy and enhanced rules, ensuring the rules system works correctly across all scenarios.

## Dependencies

- Ticket 12: Update Core Rules for Multi-Target Support (must be completed)
- Ticket 11: Create Multi-Target Rule Examples (must be completed)

## Blocks

- Ticket 14: Comprehensive Integration Testing

## Priority: High

## Estimated Time: 10-12 hours

## Background

With the enhanced rules system supporting multi-target events, a specialized testing framework is needed to validate rule functionality, performance, and compatibility. This framework will automate testing of rule logic, event processing, and ensure both legacy and enhanced formats work correctly.

## Implementation Details

### 1. Create Rules Testing Framework Core

**File**: `tests/frameworks/rulesTestingFramework.js`

```javascript
/**
 * @file Comprehensive testing framework for rules validation
 */

import { ensureValidLogger } from '../../src/utils/loggerUtils.js';
import { TestBedClass } from '../common/testbed.js';

/**
 * Testing framework for validating rules with multi-target support
 */
export class RulesTestingFramework {
  #logger;
  #testBed;
  #rulesEngine;
  #eventBus;
  #testResults;

  constructor({ logger, rulesEngine, eventBus }) {
    this.#logger = ensureValidLogger(logger);
    this.#rulesEngine = rulesEngine;
    this.#eventBus = eventBus;
    this.#testBed = new TestBedClass();
    this.#testResults = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: []
    };
  }

  /**
   * Runs a comprehensive rule test suite
   * @param {Object} testSuite - Test suite configuration
   * @returns {Object} Test results
   */
  async runTestSuite(testSuite) {
    this.#logger.info('Starting rule test suite', {
      suiteName: testSuite.name,
      testCount: testSuite.tests.length
    });

    this.#resetTestResults();

    for (const test of testSuite.tests) {
      await this.#runSingleTest(test, testSuite.name);
    }

    const summary = this.#generateTestSummary(testSuite.name);
    this.#logger.info('Rule test suite completed', summary);

    return summary;
  }

  /**
   * Tests a single rule against multiple event scenarios
   * @param {Object} rule - Rule to test
   * @param {Array} testEvents - Array of test events
   * @returns {Object} Test results
   */
  async testRuleWithEvents(rule, testEvents) {
    const results = {
      ruleId: rule.id,
      totalTests: testEvents.length,
      passed: 0,
      failed: 0,
      details: []
    };

    for (const testEvent of testEvents) {
      const result = await this.#testRuleWithSingleEvent(rule, testEvent);
      results.details.push(result);
      
      if (result.passed) {
        results.passed++;
      } else {
        results.failed++;
      }
    }

    return results;
  }

  /**
   * Validates rule performance under load
   * @param {Object} rule - Rule to test
   * @param {Object} loadConfig - Load test configuration
   * @returns {Object} Performance test results
   */
  async validateRulePerformance(rule, loadConfig) {
    const results = {
      ruleId: rule.id,
      loadConfig,
      metrics: {
        totalExecutions: 0,
        totalTime: 0,
        averageTime: 0,
        minTime: Infinity,
        maxTime: 0,
        timeoutCount: 0,
        errorCount: 0
      },
      executionDetails: []
    };

    const testEvent = this.#createStandardTestEvent();
    const iterations = loadConfig.iterations || 100;
    const timeout = loadConfig.timeout || 1000;

    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      try {
        const executionPromise = this.#executeRuleWithEvent(rule, testEvent);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        );

        await Promise.race([executionPromise, timeoutPromise]);
        
        const duration = performance.now() - startTime;
        results.metrics.totalExecutions++;
        results.metrics.totalTime += duration;
        results.metrics.minTime = Math.min(results.metrics.minTime, duration);
        results.metrics.maxTime = Math.max(results.metrics.maxTime, duration);

        if (i % 10 === 0) { // Sample every 10th execution
          results.executionDetails.push({
            iteration: i,
            duration: duration.toFixed(2),
            status: 'success'
          });
        }

      } catch (error) {
        if (error.message === 'Timeout') {
          results.metrics.timeoutCount++;
        } else {
          results.metrics.errorCount++;
        }

        results.executionDetails.push({
          iteration: i,
          status: 'error',
          error: error.message
        });
      }
    }

    if (results.metrics.totalExecutions > 0) {
      results.metrics.averageTime = results.metrics.totalTime / results.metrics.totalExecutions;
    }

    return results;
  }

  /**
   * Tests backward compatibility of enhanced rules
   * @param {Object} originalRule - Original rule
   * @param {Object} enhancedRule - Enhanced rule
   * @returns {Object} Compatibility test results
   */
  async testBackwardCompatibility(originalRule, enhancedRule) {
    const results = {
      originalRuleId: originalRule.id,
      enhancedRuleId: enhancedRule.id,
      compatibilityTests: [],
      isCompatible: true,
      issues: []
    };

    // Test with legacy events
    const legacyEvents = this.#generateLegacyTestEvents();
    
    for (const event of legacyEvents) {
      const originalResult = await this.#executeRuleWithEvent(originalRule, event);
      const enhancedResult = await this.#executeRuleWithEvent(enhancedRule, event);

      const compatibilityTest = {
        eventType: event.actionId,
        originalPassed: originalResult.success,
        enhancedPassed: enhancedResult.success,
        outputsMatch: this.#compareRuleOutputs(originalResult, enhancedResult),
        details: {
          original: originalResult,
          enhanced: enhancedResult
        }
      };

      results.compatibilityTests.push(compatibilityTest);

      if (!compatibilityTest.outputsMatch) {
        results.isCompatible = false;
        results.issues.push(`Output mismatch for event ${event.actionId}`);
      }
    }

    return results;
  }

  /**
   * Validates rule JSON Logic syntax and structure
   * @param {Object} rule - Rule to validate
   * @returns {Object} Validation results
   */
  validateRuleStructure(rule) {
    const validation = {
      ruleId: rule.id,
      isValid: true,
      errors: [],
      warnings: [],
      structure: {
        hasConditions: false,
        hasOperations: false,
        conditionCount: 0,
        operationCount: 0,
        complexity: 'low'
      }
    };

    try {
      // Validate basic structure
      if (!rule.id || typeof rule.id !== 'string') {
        validation.errors.push('Rule must have a valid string ID');
        validation.isValid = false;
      }

      if (!rule.name || typeof rule.name !== 'string') {
        validation.warnings.push('Rule should have a descriptive name');
      }

      // Validate conditions
      if (rule.conditions && Array.isArray(rule.conditions)) {
        validation.structure.hasConditions = true;
        validation.structure.conditionCount = rule.conditions.length;
        
        for (const condition of rule.conditions) {
          this.#validateCondition(condition, validation);
        }
      }

      // Validate operations
      if (rule.operations && Array.isArray(rule.operations)) {
        validation.structure.hasOperations = true;
        validation.structure.operationCount = rule.operations.length;
        
        for (const operation of rule.operations) {
          this.#validateOperation(operation, validation);
        }
      }

      // Assess complexity
      validation.structure.complexity = this.#assessRuleComplexity(rule);

      if (!validation.structure.hasConditions) {
        validation.warnings.push('Rule has no conditions - will always execute');
      }

      if (!validation.structure.hasOperations) {
        validation.warnings.push('Rule has no operations - will not perform any actions');
      }

    } catch (error) {
      validation.errors.push(`Rule validation error: ${error.message}`);
      validation.isValid = false;
    }

    return validation;
  }

  /**
   * Generates test events for rule testing
   * @param {Object} config - Event generation configuration
   * @returns {Array} Array of test events
   */
  generateTestEvents(config = {}) {
    const events = [];

    // Generate multi-target events
    if (config.includeMultiTarget !== false) {
      events.push(...this.#generateMultiTargetTestEvents(config));
    }

    // Generate legacy events
    if (config.includeLegacy !== false) {
      events.push(...this.#generateLegacyTestEvents(config));
    }

    // Generate edge case events
    if (config.includeEdgeCases !== false) {
      events.push(...this.#generateEdgeCaseEvents(config));
    }

    return events;
  }

  /**
   * Runs a single test case
   * @param {Object} test - Test case
   * @param {string} suiteName - Test suite name
   */
  async #runSingleTest(test, suiteName) {
    const testResult = {
      name: test.name,
      suiteName,
      passed: false,
      duration: 0,
      errors: [],
      warnings: [],
      details: null
    };

    const startTime = performance.now();

    try {
      // Execute the test based on its type
      switch (test.type) {
        case 'rule_execution':
          testResult.details = await this.#testRuleExecution(test);
          break;
        case 'performance':
          testResult.details = await this.validateRulePerformance(test.rule, test.loadConfig);
          break;
        case 'compatibility':
          testResult.details = await this.testBackwardCompatibility(test.originalRule, test.enhancedRule);
          break;
        case 'structure':
          testResult.details = this.validateRuleStructure(test.rule);
          break;
        default:
          throw new Error(`Unknown test type: ${test.type}`);
      }

      // Evaluate test results
      testResult.passed = this.#evaluateTestResult(test, testResult.details);

    } catch (error) {
      testResult.errors.push(error.message);
      testResult.passed = false;
    }

    testResult.duration = performance.now() - startTime;
    this.#recordTestResult(testResult);
  }

  /**
   * Tests rule execution with specific events
   * @param {Object} test - Test configuration
   * @returns {Object} Execution test results
   */
  async #testRuleExecution(test) {
    const results = {
      ruleId: test.rule.id,
      eventTests: [],
      totalPassed: 0,
      totalFailed: 0
    };

    for (const eventTest of test.events) {
      const executionResult = await this.#executeRuleWithEvent(test.rule, eventTest.event);
      
      const eventTestResult = {
        eventDescription: eventTest.description,
        event: eventTest.event,
        execution: executionResult,
        passed: this.#validateExpectedOutcome(executionResult, eventTest.expected),
        expected: eventTest.expected
      };

      results.eventTests.push(eventTestResult);
      
      if (eventTestResult.passed) {
        results.totalPassed++;
      } else {
        results.totalFailed++;
      }
    }

    return results;
  }

  /**
   * Executes a rule with a given event
   * @param {Object} rule - Rule to execute
   * @param {Object} event - Event to process
   * @returns {Object} Execution result
   */
  async #executeRuleWithEvent(rule, event) {
    const result = {
      success: false,
      conditionsMet: false,
      operationsExecuted: [],
      errors: [],
      executionTime: 0
    };

    const startTime = performance.now();

    try {
      // Check conditions
      result.conditionsMet = await this.#evaluateRuleConditions(rule, event);
      
      if (result.conditionsMet) {
        // Execute operations
        result.operationsExecuted = await this.#executeRuleOperations(rule, event);
        result.success = true;
      }

    } catch (error) {
      result.errors.push(error.message);
    }

    result.executionTime = performance.now() - startTime;
    return result;
  }

  /**
   * Evaluates rule conditions against an event
   * @param {Object} rule - Rule with conditions
   * @param {Object} event - Event to evaluate
   * @returns {boolean} True if conditions are met
   */
  async #evaluateRuleConditions(rule, event) {
    if (!rule.conditions || rule.conditions.length === 0) {
      return true; // No conditions means always true
    }

    for (const condition of rule.conditions) {
      if (condition.type === 'json_logic' && condition.logic) {
        const result = await this.#evaluateJsonLogic(condition.logic, { event });
        if (!result) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Executes rule operations
   * @param {Object} rule - Rule with operations
   * @param {Object} event - Event context
   * @returns {Array} Executed operations
   */
  async #executeRuleOperations(rule, event) {
    const executed = [];

    if (!rule.operations || rule.operations.length === 0) {
      return executed;
    }

    for (const operation of rule.operations) {
      try {
        const operationResult = await this.#executeOperation(operation, { event });
        executed.push({
          type: operation.type,
          success: true,
          result: operationResult
        });
      } catch (error) {
        executed.push({
          type: operation.type,
          success: false,
          error: error.message
        });
      }
    }

    return executed;
  }

  /**
   * Evaluates JSON Logic expression
   * @param {Object} logic - JSON Logic expression
   * @param {Object} data - Data context
   * @returns {*} Evaluation result
   */
  async #evaluateJsonLogic(logic, data) {
    // Mock implementation - in practice would use actual JSON Logic library
    try {
      // Simple variable access simulation
      if (logic.var) {
        return this.#resolveVariable(logic.var, data);
      }

      // Simple equality check simulation
      if (logic['==']) {
        const [left, right] = logic['=='];
        const leftValue = await this.#evaluateJsonLogic(left, data);
        const rightValue = await this.#evaluateJsonLogic(right, data);
        return leftValue === rightValue;
      }

      // Simple and logic simulation
      if (logic.and) {
        for (const condition of logic.and) {
          const result = await this.#evaluateJsonLogic(condition, data);
          if (!result) return false;
        }
        return true;
      }

      // Return primitive values
      if (typeof logic === 'string' || typeof logic === 'number' || typeof logic === 'boolean') {
        return logic;
      }

      return true; // Default for unhandled logic

    } catch (error) {
      this.#logger.warn('JSON Logic evaluation error', {
        logic,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Resolves variable access in data context
   * @param {string} varPath - Variable path (e.g., "event.actorId")
   * @param {Object} data - Data context
   * @returns {*} Variable value
   */
  #resolveVariable(varPath, data) {
    const parts = varPath.split('.');
    let current = data;

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  /**
   * Executes a single operation
   * @param {Object} operation - Operation to execute
   * @param {Object} context - Execution context
   * @returns {Object} Operation result
   */
  async #executeOperation(operation, context) {
    // Mock operation execution - in practice would integrate with actual operation handlers
    return {
      type: operation.type,
      executed: true,
      data: operation.data,
      timestamp: Date.now()
    };
  }

  /**
   * Generates multi-target test events
   * @param {Object} config - Generation configuration
   * @returns {Array} Multi-target test events
   */
  #generateMultiTargetTestEvents(config = {}) {
    return [
      {
        eventName: 'core:attempt_action',
        actorId: 'test_actor',
        actionId: 'combat:throw',
        targets: {
          item: 'test_knife',
          target: 'test_goblin'
        },
        targetId: 'test_knife',
        originalInput: 'throw knife at goblin',
        timestamp: Date.now()
      },
      {
        eventName: 'core:attempt_action',
        actorId: 'test_actor',
        actionId: 'interaction:use_item_on',
        targets: {
          item: 'test_potion',
          target: 'test_ally'
        },
        targetId: 'test_potion',
        originalInput: 'use potion on ally',
        timestamp: Date.now()
      },
      {
        eventName: 'core:attempt_action',
        actorId: 'test_actor',
        actionId: 'crafting:craft',
        targets: {
          tool: 'test_hammer',
          ingredient: 'test_iron',
          location: 'test_forge'
        },
        targetId: 'test_hammer',
        originalInput: 'craft at forge with hammer using iron',
        timestamp: Date.now()
      }
    ];
  }

  /**
   * Generates legacy test events
   * @param {Object} config - Generation configuration
   * @returns {Array} Legacy test events
   */
  #generateLegacyTestEvents(config = {}) {
    return [
      {
        eventName: 'core:attempt_action',
        actorId: 'test_actor',
        actionId: 'core:follow',
        targetId: 'test_target',
        originalInput: 'follow target',
        timestamp: Date.now()
      },
      {
        eventName: 'core:attempt_action',
        actorId: 'test_actor',
        actionId: 'core:attack',
        targetId: 'test_enemy',
        originalInput: 'attack enemy',
        timestamp: Date.now()
      },
      {
        eventName: 'core:attempt_action',
        actorId: 'test_actor',
        actionId: 'core:emote',
        targetId: null,
        originalInput: 'smile',
        timestamp: Date.now()
      }
    ];
  }

  /**
   * Generates edge case test events
   * @param {Object} config - Generation configuration
   * @returns {Array} Edge case test events
   */
  #generateEdgeCaseEvents(config = {}) {
    return [
      // Malformed events
      {
        eventName: 'core:attempt_action',
        actorId: null,
        actionId: 'test:action',
        targetId: 'test_target',
        originalInput: 'malformed actor',
        timestamp: Date.now()
      },
      // Empty targets object
      {
        eventName: 'core:attempt_action',
        actorId: 'test_actor',
        actionId: 'test:action',
        targets: {},
        targetId: 'test_target',
        originalInput: 'empty targets',
        timestamp: Date.now()
      },
      // Large targets object
      {
        eventName: 'core:attempt_action',
        actorId: 'test_actor',
        actionId: 'test:complex',
        targets: Object.fromEntries(
          Array.from({ length: 20 }, (_, i) => [`target${i}`, `value${i}`])
        ),
        targetId: 'target0',
        originalInput: 'many targets',
        timestamp: Date.now()
      }
    ];
  }

  /**
   * Creates a standard test event for performance testing
   * @returns {Object} Standard test event
   */
  #createStandardTestEvent() {
    return {
      eventName: 'core:attempt_action',
      actorId: 'perf_test_actor',
      actionId: 'test:performance',
      targets: {
        item: 'perf_item',
        target: 'perf_target'
      },
      targetId: 'perf_target',
      originalInput: 'performance test',
      timestamp: Date.now()
    };
  }

  /**
   * Additional helper methods would continue here...
   * Including validation methods, comparison methods, etc.
   */

  /**
   * Resets test results for new test run
   */
  #resetTestResults() {
    this.#testResults = {
      passed: 0,
      failed: 0,
      warnings: 0,
      tests: []
    };
  }

  /**
   * Records a test result
   * @param {Object} testResult - Test result to record
   */
  #recordTestResult(testResult) {
    this.#testResults.tests.push(testResult);
    
    if (testResult.passed) {
      this.#testResults.passed++;
    } else {
      this.#testResults.failed++;
    }

    if (testResult.warnings.length > 0) {
      this.#testResults.warnings += testResult.warnings.length;
    }
  }

  /**
   * Generates test summary
   * @param {string} suiteName - Test suite name
   * @returns {Object} Test summary
   */
  #generateTestSummary(suiteName) {
    const total = this.#testResults.passed + this.#testResults.failed;
    
    return {
      suiteName,
      total,
      passed: this.#testResults.passed,
      failed: this.#testResults.failed,
      warnings: this.#testResults.warnings,
      passRate: total > 0 ? (this.#testResults.passed / total) * 100 : 0,
      details: this.#testResults.tests
    };
  }

  /**
   * Cleanup method
   */
  cleanup() {
    if (this.#testBed) {
      this.#testBed.cleanup();
    }
  }
}

export default RulesTestingFramework;
```

### 2. Create Rules Test Suites

**File**: `tests/suites/multiTargetRulesTestSuite.js`

```javascript
/**
 * @file Test suite for multi-target rules functionality
 */

import RulesTestingFramework from '../frameworks/rulesTestingFramework.js';

/**
 * Multi-target rules test suite configuration
 */
export const multiTargetRulesTestSuite = {
  name: 'Multi-Target Rules Test Suite',
  description: 'Comprehensive testing of multi-target rule functionality',
  tests: [
    {
      name: 'Combat Rule Multi-Target Support',
      type: 'rule_execution',
      rule: {
        id: 'test:combat_multi_target',
        conditions: [
          {
            type: 'json_logic',
            logic: {
              and: [
                { '==': [{ var: 'event.eventName' }, 'core:attempt_action'] },
                { '==': [{ var: 'event.actionId' }, 'combat:throw'] },
                { var: 'event.targets' }
              ]
            }
          }
        ],
        operations: [
          {
            type: 'validate_throw_targets',
            data: {
              thrower: { var: 'event.actorId' },
              item: { var: 'event.targets.item' },
              target: { var: 'event.targets.target' }
            }
          }
        ]
      },
      events: [
        {
          description: 'Valid multi-target throw',
          event: {
            eventName: 'core:attempt_action',
            actorId: 'test_actor',
            actionId: 'combat:throw',
            targets: {
              item: 'test_knife',
              target: 'test_goblin'
            },
            targetId: 'test_knife',
            originalInput: 'throw knife at goblin',
            timestamp: Date.now()
          },
          expected: {
            conditionsMet: true,
            operationsExecuted: 1,
            success: true
          }
        },
        {
          description: 'Missing targets object',
          event: {
            eventName: 'core:attempt_action',
            actorId: 'test_actor',
            actionId: 'combat:throw',
            targetId: 'test_knife',
            originalInput: 'throw knife',
            timestamp: Date.now()
          },
          expected: {
            conditionsMet: false,
            operationsExecuted: 0,
            success: false
          }
        }
      ]
    },
    {
      name: 'Interaction Rule Backward Compatibility',
      type: 'rule_execution',
      rule: {
        id: 'test:interaction_compatible',
        conditions: [
          {
            type: 'json_logic',
            logic: {
              and: [
                { '==': [{ var: 'event.eventName' }, 'core:attempt_action'] },
                { '==': [{ var: 'event.actionId' }, 'core:use'] }
              ]
            }
          }
        ],
        operations: [
          {
            type: 'use_item',
            data: {
              user: { var: 'event.actorId' },
              item: {
                if: [
                  { var: 'event.targets.item' },
                  { var: 'event.targets.item' },
                  { var: 'event.targetId' }
                ]
              }
            }
          }
        ]
      },
      events: [
        {
          description: 'Legacy format event',
          event: {
            eventName: 'core:attempt_action',
            actorId: 'test_actor',
            actionId: 'core:use',
            targetId: 'test_item',
            originalInput: 'use item',
            timestamp: Date.now()
          },
          expected: {
            conditionsMet: true,
            operationsExecuted: 1,
            success: true
          }
        },
        {
          description: 'Enhanced format event',
          event: {
            eventName: 'core:attempt_action',
            actorId: 'test_actor',
            actionId: 'core:use',
            targets: {
              item: 'test_item',
              target: 'test_surface'
            },
            targetId: 'test_item',
            originalInput: 'use item on surface',
            timestamp: Date.now()
          },
          expected: {
            conditionsMet: true,
            operationsExecuted: 1,
            success: true
          }
        }
      ]
    },
    {
      name: 'Complex Multi-Target Rule Performance',
      type: 'performance',
      rule: {
        id: 'test:complex_multi_target',
        conditions: [
          {
            type: 'json_logic',
            logic: {
              and: [
                { var: 'event.targets' },
                { '>': [{ var: 'event.targets | keys | length' }, 3] }
              ]
            }
          }
        ],
        operations: [
          {
            type: 'process_multiple_targets',
            data: {
              actor: { var: 'event.actorId' },
              targets: { var: 'event.targets' },
              count: { var: 'event.targets | keys | length' }
            }
          }
        ]
      },
      loadConfig: {
        iterations: 200,
        timeout: 500
      }
    }
  ]
};

/**
 * Backward compatibility test suite
 */
export const backwardCompatibilityTestSuite = {
  name: 'Backward Compatibility Test Suite',
  description: 'Ensures enhanced rules maintain compatibility with legacy events',
  tests: [
    {
      name: 'Enhanced Combat Rule Compatibility',
      type: 'compatibility',
      originalRule: {
        id: 'core:attack_original',
        conditions: [
          {
            type: 'json_logic',
            logic: {
              and: [
                { '==': [{ var: 'event.eventName' }, 'core:attempt_action'] },
                { '==': [{ var: 'event.actionId' }, 'core:attack'] }
              ]
            }
          }
        ],
        operations: [
          {
            type: 'execute_attack',
            data: {
              attacker: { var: 'event.actorId' },
              target: { var: 'event.targetId' }
            }
          }
        ]
      },
      enhancedRule: {
        id: 'core:attack_enhanced',
        conditions: [
          {
            type: 'json_logic',
            logic: {
              and: [
                { '==': [{ var: 'event.eventName' }, 'core:attempt_action'] },
                { '==': [{ var: 'event.actionId' }, 'core:attack'] }
              ]
            }
          }
        ],
        operations: [
          {
            type: 'execute_attack',
            data: {
              attacker: { var: 'event.actorId' },
              target: {
                if: [
                  { var: 'event.targets.target' },
                  { var: 'event.targets.target' },
                  { var: 'event.targetId' }
                ]
              },
              weapon: { var: 'event.targets.weapon' }
            }
          }
        ]
      }
    }
  ]
};

/**
 * Rule structure validation test suite
 */
export const ruleStructureTestSuite = {
  name: 'Rule Structure Validation Test Suite',
  description: 'Validates rule JSON structure and syntax',
  tests: [
    {
      name: 'Valid Rule Structure',
      type: 'structure',
      rule: {
        id: 'test:valid_rule',
        name: 'Valid Test Rule',
        description: 'A properly structured rule for testing',
        conditions: [
          {
            type: 'json_logic',
            logic: { '==': [{ var: 'event.eventName' }, 'core:attempt_action'] }
          }
        ],
        operations: [
          {
            type: 'test_operation',
            data: { test: 'value' }
          }
        ]
      }
    },
    {
      name: 'Invalid Rule Structure',
      type: 'structure',
      rule: {
        // Missing required fields
        conditions: 'invalid_conditions',
        operations: null
      }
    }
  ]
};

export default {
  multiTargetRulesTestSuite,
  backwardCompatibilityTestSuite,
  ruleStructureTestSuite
};
```

### 3. Create Performance Testing Utilities

**File**: `tests/utils/performanceTestingUtils.js`

```javascript
/**
 * @file Performance testing utilities for rules
 */

/**
 * Performance testing utilities for rule execution
 */
export class PerformanceTestingUtils {
  /**
   * Measures rule execution performance
   * @param {Function} ruleExecutor - Function that executes the rule
   * @param {Object} config - Performance test configuration
   * @returns {Object} Performance metrics
   */
  static async measureRulePerformance(ruleExecutor, config = {}) {
    const {
      iterations = 100,
      warmupIterations = 10,
      timeout = 1000,
      measureMemory = true
    } = config;

    const metrics = {
      iterations: {
        total: iterations,
        completed: 0,
        failed: 0,
        timeouts: 0
      },
      timing: {
        total: 0,
        average: 0,
        min: Infinity,
        max: 0,
        percentiles: {}
      },
      memory: measureMemory ? {
        initialUsage: 0,
        peakUsage: 0,
        finalUsage: 0,
        leaked: 0
      } : null,
      errors: []
    };

    // Record initial memory
    if (measureMemory && performance.memory) {
      metrics.memory.initialUsage = performance.memory.usedJSHeapSize;
    }

    const executionTimes = [];

    // Warmup phase
    for (let i = 0; i < warmupIterations; i++) {
      try {
        await this.#executeWithTimeout(ruleExecutor, timeout);
      } catch (error) {
        // Ignore warmup errors
      }
    }

    // Actual performance measurement
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      
      try {
        await this.#executeWithTimeout(ruleExecutor, timeout);
        
        const duration = performance.now() - startTime;
        executionTimes.push(duration);
        
        metrics.iterations.completed++;
        metrics.timing.total += duration;
        metrics.timing.min = Math.min(metrics.timing.min, duration);
        metrics.timing.max = Math.max(metrics.timing.max, duration);

        // Track peak memory usage
        if (measureMemory && performance.memory) {
          metrics.memory.peakUsage = Math.max(
            metrics.memory.peakUsage,
            performance.memory.usedJSHeapSize
          );
        }

      } catch (error) {
        if (error.message === 'Timeout') {
          metrics.iterations.timeouts++;
        } else {
          metrics.iterations.failed++;
          metrics.errors.push({
            iteration: i,
            error: error.message,
            timestamp: Date.now()
          });
        }
      }
    }

    // Calculate final metrics
    if (metrics.iterations.completed > 0) {
      metrics.timing.average = metrics.timing.total / metrics.iterations.completed;
      metrics.timing.percentiles = this.#calculatePercentiles(executionTimes);
    }

    // Record final memory
    if (measureMemory && performance.memory) {
      metrics.memory.finalUsage = performance.memory.usedJSHeapSize;
      metrics.memory.leaked = metrics.memory.finalUsage - metrics.memory.initialUsage;
    }

    return metrics;
  }

  /**
   * Executes a function with timeout
   * @param {Function} fn - Function to execute
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise} Execution promise
   */
  static async #executeWithTimeout(fn, timeout) {
    const executionPromise = fn();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeout)
    );

    return Promise.race([executionPromise, timeoutPromise]);
  }

  /**
   * Calculates performance percentiles
   * @param {Array} times - Array of execution times
   * @returns {Object} Percentile values
   */
  static #calculatePercentiles(times) {
    if (times.length === 0) return {};

    const sorted = [...times].sort((a, b) => a - b);
    const percentiles = [50, 75, 90, 95, 99];
    const result = {};

    for (const p of percentiles) {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      result[`p${p}`] = sorted[Math.max(0, index)];
    }

    return result;
  }

  /**
   * Generates performance report
   * @param {Object} metrics - Performance metrics
   * @returns {string} Formatted performance report
   */
  static generatePerformanceReport(metrics) {
    const report = [];
    
    report.push('=== Performance Test Report ===');
    report.push(`Total iterations: ${metrics.iterations.total}`);
    report.push(`Completed: ${metrics.iterations.completed}`);
    report.push(`Failed: ${metrics.iterations.failed}`);
    report.push(`Timeouts: ${metrics.iterations.timeouts}`);
    report.push('');
    
    if (metrics.iterations.completed > 0) {
      report.push('=== Timing Metrics ===');
      report.push(`Average: ${metrics.timing.average.toFixed(2)}ms`);
      report.push(`Min: ${metrics.timing.min.toFixed(2)}ms`);
      report.push(`Max: ${metrics.timing.max.toFixed(2)}ms`);
      
      if (metrics.timing.percentiles) {
        report.push('');
        report.push('=== Percentiles ===');
        Object.entries(metrics.timing.percentiles).forEach(([p, value]) => {
          report.push(`${p}: ${value.toFixed(2)}ms`);
        });
      }
    }

    if (metrics.memory) {
      report.push('');
      report.push('=== Memory Usage ===');
      report.push(`Initial: ${(metrics.memory.initialUsage / 1024 / 1024).toFixed(2)}MB`);
      report.push(`Peak: ${(metrics.memory.peakUsage / 1024 / 1024).toFixed(2)}MB`);
      report.push(`Final: ${(metrics.memory.finalUsage / 1024 / 1024).toFixed(2)}MB`);
      report.push(`Leaked: ${(metrics.memory.leaked / 1024 / 1024).toFixed(2)}MB`);
    }

    if (metrics.errors.length > 0) {
      report.push('');
      report.push('=== Errors ===');
      metrics.errors.slice(0, 5).forEach((error, index) => {
        report.push(`${index + 1}. Iteration ${error.iteration}: ${error.error}`);
      });
      if (metrics.errors.length > 5) {
        report.push(`... and ${metrics.errors.length - 5} more errors`);
      }
    }

    return report.join('\n');
  }
}

export default PerformanceTestingUtils;
```

### 4. Create Integration Test Runner

**File**: `tests/runners/rulesTestRunner.js`

```javascript
/**
 * @file Test runner for executing rule test suites
 */

import RulesTestingFramework from '../frameworks/rulesTestingFramework.js';
import testSuites from '../suites/multiTargetRulesTestSuite.js';
import { TestBedClass } from '../common/testbed.js';

/**
 * Main test runner for rules testing
 */
export class RulesTestRunner {
  #testBed;
  #framework;
  #results;

  constructor() {
    this.#testBed = new TestBedClass();
    this.#results = [];
  }

  /**
   * Runs all rule test suites
   * @returns {Object} Combined test results
   */
  async runAllTestSuites() {
    console.log('Starting comprehensive rules testing...');

    // Initialize framework
    const logger = this.#testBed.createMockLogger();
    const rulesEngine = this.#testBed.createMockRulesEngine();
    const eventBus = this.#testBed.createMockEventBus();

    this.#framework = new RulesTestingFramework({
      logger,
      rulesEngine,
      eventBus
    });

    try {
      // Run each test suite
      for (const [suiteName, suite] of Object.entries(testSuites)) {
        console.log(`Running ${suite.name}...`);
        const result = await this.#framework.runTestSuite(suite);
        this.#results.push(result);
        console.log(`Completed ${suite.name}: ${result.passed}/${result.total} passed`);
      }

      return this.#generateOverallResults();

    } finally {
      this.#cleanup();
    }
  }

  /**
   * Runs specific test suite
   * @param {string} suiteName - Name of test suite to run
   * @returns {Object} Test results
   */
  async runTestSuite(suiteName) {
    const suite = testSuites[suiteName];
    if (!suite) {
      throw new Error(`Test suite '${suiteName}' not found`);
    }

    const logger = this.#testBed.createMockLogger();
    const rulesEngine = this.#testBed.createMockRulesEngine();
    const eventBus = this.#testBed.createMockEventBus();

    this.#framework = new RulesTestingFramework({
      logger,
      rulesEngine,
      eventBus
    });

    try {
      return await this.#framework.runTestSuite(suite);
    } finally {
      this.#cleanup();
    }
  }

  /**
   * Generates overall test results summary
   * @returns {Object} Overall results
   */
  #generateOverallResults() {
    const overall = {
      suites: this.#results.length,
      totalTests: 0,
      totalPassed: 0,
      totalFailed: 0,
      totalWarnings: 0,
      overallPassRate: 0,
      suiteResults: this.#results
    };

    for (const result of this.#results) {
      overall.totalTests += result.total;
      overall.totalPassed += result.passed;
      overall.totalFailed += result.failed;
      overall.totalWarnings += result.warnings;
    }

    if (overall.totalTests > 0) {
      overall.overallPassRate = (overall.totalPassed / overall.totalTests) * 100;
    }

    return overall;
  }

  /**
   * Cleanup resources
   */
  #cleanup() {
    if (this.#framework) {
      this.#framework.cleanup();
    }
    if (this.#testBed) {
      this.#testBed.cleanup();
    }
  }
}

export default RulesTestRunner;
```

## Testing Requirements

### 1. Framework Functionality Tests

- **Test execution**: Framework correctly executes rules with events
- **Performance measurement**: Accurate timing and memory measurement
- **Compatibility testing**: Reliable backward compatibility validation
- **Structure validation**: Comprehensive rule structure checking

### 2. Test Suite Coverage

- **Multi-target scenarios**: All multi-target patterns tested
- **Legacy compatibility**: All legacy formats validated
- **Edge cases**: Malformed events and error conditions
- **Performance**: Load testing under realistic conditions

### 3. Integration Testing

- **Real rules**: Framework works with actual game rules
- **Live events**: Framework processes actual game events
- **Performance validation**: Framework meets performance requirements

## Success Criteria

1. **Comprehensive Testing**: Framework tests all multi-target scenarios
2. **Performance Validation**: Performance requirements consistently met
3. **Compatibility Assurance**: Backward compatibility validated
4. **Ease of Use**: Framework is easy to use for ongoing rule development
5. **Automation**: Tests can be run automatically in CI/CD pipeline

## Files Created

- `tests/frameworks/rulesTestingFramework.js`
- `tests/suites/multiTargetRulesTestSuite.js`
- `tests/utils/performanceTestingUtils.js`
- `tests/runners/rulesTestRunner.js`

## Files Modified

None (new testing framework only)

## Validation Steps

1. Test framework functionality with sample rules
2. Validate performance measurement accuracy
3. Test backward compatibility validation
4. Run comprehensive test suites on actual rules
5. Validate automation and CI/CD integration

## Notes

- Framework provides comprehensive rule testing capabilities
- Performance testing ensures rules meet operational requirements
- Backward compatibility testing prevents regression
- Automation enables continuous validation during development

## Risk Assessment

**Low Risk**: New testing framework with no impact on production code. Framework is isolated and can be easily modified or removed if issues arise.

## Next Steps

After this ticket completion:
1. Move to Ticket 14: Comprehensive Integration Testing
2. Use framework to test entire multi-target action system
3. Validate end-to-end functionality with comprehensive test scenarios