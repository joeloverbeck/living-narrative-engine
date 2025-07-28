/**
 * @file Test Configuration and Utilities for Multi-Target Action Integration Tests
 * @description Provides utilities, helpers, and configuration for comprehensive testing
 */

import { EntityManagerTestBed } from '../../common/entities/entityManagerTestBed.js';
import { createMockFacades } from '../../common/facades/testingFacadeRegistrations.js';
import { performance } from 'perf_hooks';

/**
 * Configuration class for multi-target action integration tests
 */
export class MultiTargetTestConfiguration {
  constructor() {
    this.entityTestBed = null;
    this.facades = null;
    this.logger = null;
    this.performanceMetrics = [];
  }

  /**
   * Initialize test environment
   *
   * @returns {Promise<object>} Test environment configuration
   */
  async initialize() {
    this.entityTestBed = new EntityManagerTestBed();
    this.facades = createMockFacades({}, jest.fn);
    this.logger = this.facades.mockDeps.logger;

    return {
      entityTestBed: this.entityTestBed,
      facades: this.facades,
      logger: this.logger,
    };
  }

  /**
   * Clean up test environment
   */
  async cleanup() {
    if (this.entityTestBed) {
      this.entityTestBed.cleanup();
    }
    if (this.facades?.actionService) {
      this.facades.actionService.clearMockData();
    }
    this.performanceMetrics = [];
  }

  /**
   * Create a performance test scenario with large datasets
   *
   * @param {number} entityCount - Number of entities to create
   * @returns {Promise<object>} Performance test scenario
   */
  async createPerformanceTestScenario(entityCount = 100) {
    const entities = [];
    const startTime = performance.now();

    // Create large number of entities for performance testing
    for (let i = 0; i < entityCount; i++) {
      const entityId = `perf_entity_${i}`;
      const entity = await this.entityTestBed.createEntity('basic', {
        instanceId: entityId,
        overrides: {
          'core:item': {
            name: `Performance Item ${i}`,
            value: i * 10,
            category: ['weapon', 'armor', 'consumable'][i % 3],
          },
          'core:material': {
            type: ['metal', 'wood', 'cloth'][i % 3],
            quality: 50 + (i % 50),
          },
        },
      });
      entities.push(entity);
    }

    const endTime = performance.now();
    const creationTime = endTime - startTime;

    return {
      entities,
      entityCount,
      creationTime,
      averageCreationTime: creationTime / entityCount,
    };
  }

  /**
   * Create a complex context dependency scenario
   *
   * @returns {Promise<object>} Complex context scenario
   */
  async createComplexContextScenario() {
    // Create interconnected entities for context testing
    const player = await this.entityTestBed.createEntity('actor', {
      instanceId: 'context_player',
      overrides: {
        'core:inventory': {
          items: ['tool_001', 'material_001', 'material_002'],
        },
      },
    });

    const tool = await this.entityTestBed.createEntity('basic', {
      instanceId: 'tool_001',
      overrides: {
        'core:item': { name: 'Complex Tool' },
        'core:tool': {
          craft_types: ['advanced'],
          compatible_materials: ['rare_metal', 'crystal'],
        },
        associated_recipes: ['complex_recipe_001'],
      },
    });

    const material1 = await this.entityTestBed.createEntity('basic', {
      instanceId: 'material_001',
      overrides: {
        'core:item': { name: 'Rare Metal' },
        'core:material': { type: 'rare_metal', quality: 90 },
      },
    });

    const material2 = await this.entityTestBed.createEntity('basic', {
      instanceId: 'material_002',
      overrides: {
        'core:item': { name: 'Crystal Shard' },
        'core:material': { type: 'crystal', quality: 85 },
      },
    });

    const recipe = {
      id: 'complex_recipe_001',
      name: 'Complex Crafting Recipe',
      required_tool_types: ['advanced'],
      required_materials: [
        { type: 'rare_metal', minimum_quality: 80 },
        { type: 'crystal', minimum_quality: 75 },
      ],
      result_item: 'masterwork_item',
    };

    return {
      player,
      tool,
      materials: [material1, material2],
      recipe,
      contextChain: ['recipe', 'tool', 'materials'],
    };
  }

  /**
   * Create event monitoring setup
   *
   * @param {object} eventBus - Event bus to monitor
   * @returns {object} Event monitoring utilities
   */
  createEventMonitor(eventBus) {
    const capturedEvents = [];
    const eventHandlers = new Map();

    const monitor = {
      capturedEvents,

      startCapture(eventTypes = ['*']) {
        eventTypes.forEach((eventType) => {
          const handler = (event) => {
            capturedEvents.push({
              timestamp: Date.now(),
              type: event.type,
              payload: event.payload,
              metadata: event.metadata,
            });
          };

          eventHandlers.set(eventType, handler);
          if (eventBus.subscribe) {
            eventBus.subscribe(eventType, handler);
          }
        });
      },

      stopCapture() {
        eventHandlers.forEach((handler, eventType) => {
          if (eventBus.unsubscribe) {
            eventBus.unsubscribe(eventType, handler);
          }
        });
        eventHandlers.clear();
      },

      getEventsByType(eventType) {
        return capturedEvents.filter((e) => e.type === eventType);
      },

      getEventChain(startEventType) {
        const chain = [];
        const startEvent = capturedEvents.find(
          (e) => e.type === startEventType
        );

        if (startEvent) {
          chain.push(startEvent);
          // Find events triggered by this event
          const findTriggeredEvents = (triggerEvent) => {
            const triggered = capturedEvents.filter(
              (e) =>
                e.metadata?.triggeredBy === triggerEvent.type &&
                e.timestamp > triggerEvent.timestamp
            );
            triggered.forEach((e) => {
              chain.push(e);
              findTriggeredEvents(e);
            });
          };
          findTriggeredEvents(startEvent);
        }

        return chain;
      },

      clear() {
        capturedEvents.length = 0;
      },
    };

    return monitor;
  }

  /**
   * Verify performance metrics meet requirements
   *
   * @param {object} metrics - Performance metrics to verify
   * @param {object} requirements - Performance requirements
   * @returns {object} Verification results
   */
  verifyPerformanceMetrics(metrics, requirements = {}) {
    const defaultRequirements = {
      maxProcessingTime: 500, // ms
      maxMemoryIncrease: 50 * 1024 * 1024, // 50MB
      maxCombinations: 100,
      minSuccessRate: 0.95,
    };

    const finalRequirements = { ...defaultRequirements, ...requirements };

    const results = {
      processingTime:
        metrics.processingTime <= finalRequirements.maxProcessingTime,
      memoryUsage:
        metrics.memoryIncrease <= finalRequirements.maxMemoryIncrease,
      combinationLimit:
        metrics.combinationsGenerated <= finalRequirements.maxCombinations,
      successRate: metrics.successRate >= finalRequirements.minSuccessRate,
    };

    const allPassed = Object.values(results).every((result) => result);

    return {
      passed: allPassed,
      results,
      metrics,
      requirements: finalRequirements,
    };
  }

  /**
   * Create stress test scenario
   *
   * @param {string} complexity - Complexity level (low, medium, high, extreme)
   * @returns {object} Stress test configuration
   */
  createStressTestScenario(complexity = 'medium') {
    const scenarios = {
      low: {
        entityCount: 50,
        maxCombinations: 20,
        contextDepth: 2,
        concurrentActions: 3,
      },
      medium: {
        entityCount: 100,
        maxCombinations: 50,
        contextDepth: 3,
        concurrentActions: 5,
      },
      high: {
        entityCount: 200,
        maxCombinations: 100,
        contextDepth: 4,
        concurrentActions: 10,
      },
      extreme: {
        entityCount: 500,
        maxCombinations: 200,
        contextDepth: 5,
        concurrentActions: 20,
      },
    };

    return scenarios[complexity] || scenarios.medium;
  }

  /**
   * Validate system integrity
   *
   * @param {object} facades - Facade instances
   * @returns {object} Validation results
   */
  validateSystemIntegrity(facades) {
    const services = [
      'actionService',
      'entityService',
      'llmService',
      'turnExecutionFacade',
    ];

    const serviceStatus = {};
    services.forEach((serviceName) => {
      try {
        const service = facades[serviceName];
        serviceStatus[serviceName] = service !== null && service !== undefined;
      } catch (error) {
        serviceStatus[serviceName] = false;
      }
    });

    const allServicesAvailable = Object.values(serviceStatus).every(
      (status) => status
    );

    return {
      healthy: allServicesAvailable,
      services: serviceStatus,
    };
  }

  /**
   * Measure performance of an async operation
   *
   * @param {Function} operation - Async operation to measure
   * @returns {Promise<object>} Performance measurement results
   */
  async measurePerformance(operation) {
    const memBefore = process.memoryUsage();
    const startTime = performance.now();

    let result;
    let error;

    try {
      result = await operation();
    } catch (err) {
      error = err;
    }

    const endTime = performance.now();
    const memAfter = process.memoryUsage();

    const metrics = {
      success: !error,
      result,
      error,
      processingTime: endTime - startTime,
      memoryIncrease: memAfter.heapUsed - memBefore.heapUsed,
      memoryUsageMB: memAfter.heapUsed / (1024 * 1024),
      timestamp: Date.now(),
    };

    this.performanceMetrics.push(metrics);

    return metrics;
  }

  /**
   * Get aggregated performance statistics
   *
   * @returns {object} Aggregated performance stats
   */
  getPerformanceStats() {
    if (this.performanceMetrics.length === 0) {
      return null;
    }

    const times = this.performanceMetrics.map((m) => m.processingTime);
    const memories = this.performanceMetrics.map((m) => m.memoryIncrease);
    const successes = this.performanceMetrics.filter((m) => m.success).length;

    return {
      totalOperations: this.performanceMetrics.length,
      successRate: successes / this.performanceMetrics.length,
      processingTime: {
        min: Math.min(...times),
        max: Math.max(...times),
        average: times.reduce((a, b) => a + b, 0) / times.length,
        median: this.calculateMedian(times),
      },
      memoryUsage: {
        min: Math.min(...memories),
        max: Math.max(...memories),
        average: memories.reduce((a, b) => a + b, 0) / memories.length,
        median: this.calculateMedian(memories),
      },
    };
  }

  /**
   * Calculate median value
   *
   * @private
   * @param {number[]} values - Array of numbers
   * @returns {number} Median value
   */
  calculateMedian(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }
}

/**
 * Integration test utilities
 */
export class IntegrationTestUtils {
  /**
   * Create a mock action definition
   *
   * @param {object} config - Action configuration
   * @returns {object} Mock action definition
   */
  static createMockAction(config = {}) {
    const defaults = {
      id: 'test:mock_action',
      name: 'mock action',
      targets: {},
      operations: [],
      template: 'perform mock action',
    };

    return { ...defaults, ...config };
  }

  /**
   * Create a batch of test entities
   *
   * @param {EntityManagerTestBed} entityTestBed - Entity test bed
   * @param {string} prefix - Entity ID prefix
   * @param {number} count - Number of entities to create
   * @param {Function} overridesFn - Function to generate overrides
   * @returns {Promise<Array>} Created entities
   */
  static async createBatchEntities(entityTestBed, prefix, count, overridesFn) {
    const entities = [];

    for (let i = 0; i < count; i++) {
      const entityId = `${prefix}_${i}`;
      const overrides = overridesFn ? overridesFn(i) : {};

      const entity = await entityTestBed.createEntity('basic', {
        instanceId: entityId,
        overrides,
      });

      entities.push(entity);
    }

    return entities;
  }

  /**
   * Assert action discovery results
   *
   * @param {Array} actions - Discovered actions
   * @param {object} expectations - Expected properties
   */
  static assertActionDiscovery(actions, expectations) {
    expect(actions).toBeDefined();
    expect(Array.isArray(actions)).toBe(true);

    if (expectations.count !== undefined) {
      expect(actions).toHaveLength(expectations.count);
    }

    if (expectations.minCount !== undefined) {
      expect(actions.length).toBeGreaterThanOrEqual(expectations.minCount);
    }

    if (expectations.maxCount !== undefined) {
      expect(actions.length).toBeLessThanOrEqual(expectations.maxCount);
    }

    if (expectations.hasActionId) {
      const hasAction = actions.some(
        (a) => a.actionId === expectations.hasActionId
      );
      expect(hasAction).toBe(true);
    }

    if (expectations.allHaveTargets) {
      actions.forEach((action) => {
        expect(action.targets || action.target).toBeDefined();
      });
    }
  }

  /**
   * Wait for condition with timeout
   *
   * @param {Function} condition - Condition to check
   * @param {number} timeout - Timeout in milliseconds
   * @param {number} checkInterval - Check interval in milliseconds
   * @returns {Promise<boolean>} Whether condition was met
   */
  static async waitForCondition(condition, timeout = 1000, checkInterval = 50) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
    }

    return false;
  }

  /**
   * Create test action context
   *
   * @param {object} overrides - Context overrides
   * @returns {object} Action context
   */
  static createActionContext(overrides = {}) {
    const defaults = {
      actor: { id: 'test_actor' },
      location: { id: 'test_location' },
      game: {
        turnNumber: 1,
        config: {},
      },
    };

    return { ...defaults, ...overrides };
  }
}

/**
 * Test data generators
 */
export class TestDataGenerators {
  /**
   * Generate random item data
   *
   * @param {number} seed - Random seed
   * @returns {object} Item data
   */
  static generateItem(seed = 0) {
    const types = ['weapon', 'armor', 'consumable', 'material', 'tool'];
    const materials = ['metal', 'wood', 'cloth', 'crystal', 'stone'];

    return {
      'core:item': {
        name: `Generated Item ${seed}`,
        value: 10 + (seed % 90),
        weight: 1 + (seed % 10),
        type: types[seed % types.length],
      },
      'core:material': {
        type: materials[seed % materials.length],
        quality: 50 + (seed % 50),
      },
    };
  }

  /**
   * Generate random actor data
   *
   * @param {number} seed - Random seed
   * @returns {object} Actor data
   */
  static generateActor(seed = 0) {
    const names = ['Guard', 'Merchant', 'Scholar', 'Adventurer', 'Citizen'];
    const personalities = ['friendly', 'neutral', 'suspicious', 'helpful'];

    return {
      'core:actor': {
        name: `${names[seed % names.length]} ${seed}`,
        level: 1 + (seed % 10),
      },
      'core:stats': {
        health: 50 + (seed % 50),
        strength: 10 + (seed % 20),
        dexterity: 10 + (seed % 20),
        intelligence: 10 + (seed % 20),
      },
      'ai:personality': {
        type: personalities[seed % personalities.length],
        trust_level: seed % 10,
      },
    };
  }

  /**
   * Generate complex action definition
   *
   * @param {object} config - Configuration options
   * @returns {object} Action definition
   */
  static generateComplexAction(config = {}) {
    const {
      targetCount = 2,
      hasContext = true,
      hasPrerequisites = true,
      operationCount = 2,
    } = config;

    const targets = {};
    for (let i = 0; i < targetCount; i++) {
      const targetName = `target${i + 1}`;
      targets[targetName] = {
        name: targetName,
        scope:
          i === 0 ? 'actor.core:inventory.items[]' : 'location.core:objects[]',
        required: true,
        ...(hasContext && i > 0 ? { contextFrom: `target${i}` } : {}),
      };
    }

    const operations = [];
    for (let i = 0; i < operationCount; i++) {
      operations.push({
        operation: {
          type: 'dispatchEvent',
          eventType: `TEST_EVENT_${i}`,
          payload: {
            timestamp: 'game.turnNumber',
          },
        },
      });
    }

    return {
      id: 'test:generated_complex_action',
      name: 'perform complex action',
      targets,
      prerequisites: hasPrerequisites
        ? [
            {
              logic: {
                '>=': [{ var: 'actor.components.core:stats.strength' }, 10],
              },
            },
          ]
        : [],
      operations,
      template: 'perform complex action',
    };
  }
}
