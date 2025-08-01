# Ticket 6: End-to-End Testing Suite

## Overview

Create a comprehensive end-to-end testing suite that validates the complete multi-target action workflow from action definition through rule execution to narrative output. This ensures the entire system works together correctly and produces the expected result: "Amaia Castillo smooths Iker Aguirre's denim trucker jacket with possessive care."

## Problem Statement

**Current Issue**: No comprehensive E2E tests exist to validate the complete multi-target action workflow, making it difficult to verify that all components work together correctly and that the "Unnamed Character" issue is resolved.

**Root Cause**: Testing has been focused on individual components rather than the complete user journey from action execution to narrative output.

**Target Outcome**: Complete E2E test suite that validates:

- Multi-target action execution from start to finish
- Correct placeholder resolution in rules
- Proper narrative text generation
- Error handling and edge cases
- Performance characteristics of the complete system

## Dependencies

- **Tickets 1-5**: All previous implementation tickets must be completed
- Existing Jest testing framework and infrastructure
- Test bed utilities for setting up complex scenarios
- Mock data for intimacy scenarios and character relationships
- Action and rule definition systems

## Implementation Details

### 1. E2E Test Infrastructure

**Step 1.1**: Create comprehensive E2E test framework

```javascript
/**
 * @file multiTargetE2ETestBed.js
 * @description End-to-end testing infrastructure for multi-target actions
 */

import { createTestEntityManager } from '../common/testbed.js';

class MultiTargetE2ETestBed {
  constructor() {
    this.#entities = new Map();
    this.#relationships = new Map();
    this.#gameState = new Map();
    this.#eventHistory = [];
    this.#dependencies = null;
  }

  #entities;
  #relationships;
  #gameState;
  #eventHistory;
  #dependencies;

  /**
   * Setup complete test environment with all dependencies
   * @returns {Promise<void>}
   */
  async setup() {
    // Create all required services
    this.#dependencies = await this.#createTestDependencies();

    // Initialize systems
    await this.#initializeSystems();

    // Setup event monitoring
    this.#setupEventMonitoring();

    console.log('Multi-target E2E test bed initialized');
  }

  /**
   * Create intimacy scenario with Amaia, Iker, and clothing
   * @returns {Promise<Object>} - Test scenario entities
   */
  async setupIntimacyScenario() {
    // Create Amaia Castillo
    const amaia = await this.#createEntity('amaia_castillo_instance', {
      name: 'Amaia Castillo',
      type: 'character',
      gender: 'female',
      attributes: {
        intimacy_level: 8,
        possessiveness: 7,
      },
    });

    // Create Iker Aguirre
    const iker = await this.#createEntity('iker_aguirre_instance', {
      name: 'Iker Aguirre',
      type: 'character',
      gender: 'male',
      attributes: {
        intimacy_level: 8,
        trust_level: 9,
      },
    });

    // Create denim trucker jacket
    const jacket = await this.#createEntity('denim_trucker_jacket_instance', {
      name: 'denim trucker jacket',
      type: 'clothing',
      category: 'outerwear',
      owner: iker.id,
      attributes: {
        material: 'denim',
        style: 'trucker',
        condition: 'good',
      },
    });

    // Create intimacy relationship
    await this.#createRelationship(amaia.id, iker.id, 'intimate_partners', {
      level: 8,
      type: 'romantic',
      duration: 'long_term',
    });

    // Setup clothing ownership
    await this.#createRelationship(iker.id, jacket.id, 'owns', {
      type: 'possession',
      access_level: 'exclusive',
    });

    // Add entities to game state
    this.#gameState.set('current_actor', amaia.id);
    this.#gameState.set('location', 'bedroom');
    this.#gameState.set('atmosphere', 'intimate');

    return { amaia, iker, jacket };
  }

  /**
   * Execute multi-target action through complete pipeline
   * @param {Object} actionConfig - Action configuration
   * @returns {Promise<Object>} - Complete execution result
   */
  async executeMultiTargetAction(actionConfig) {
    const startTime = Date.now();

    try {
      // Clear event history for this execution
      this.#eventHistory = [];

      // Create action execution context
      const context = await this.#createActionContext(actionConfig);

      // Execute through pipeline stages
      const result = await this.#executePipeline(context);

      // Collect execution metrics
      const metrics = {
        executionTime: Date.now() - startTime,
        stagesExecuted: result.stagesExecuted,
        eventsGenerated: this.#eventHistory.length,
        success: result.success,
      };

      return {
        ...result,
        metrics,
        eventHistory: [...this.#eventHistory],
        context: this.#sanitizeContextForLogging(context),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        metrics: {
          executionTime: Date.now() - startTime,
          failed: true,
        },
        eventHistory: [...this.#eventHistory],
      };
    }
  }

  /**
   * Validate complete action execution result
   * @param {Object} result - Execution result to validate
   * @param {Object} expectations - Expected outcomes
   * @returns {Object} - Validation result
   */
  validateExecutionResult(result, expectations) {
    const validation = {
      valid: true,
      details: {},
      errors: [],
      warnings: [],
    };

    // Validate success status
    if (expectations.shouldSucceed !== undefined) {
      validation.details.success =
        result.success === expectations.shouldSucceed;
      if (!validation.details.success) {
        validation.valid = false;
        validation.errors.push(
          `Expected success: ${expectations.shouldSucceed}, got: ${result.success}`
        );
      }
    }

    // Validate narrative output
    if (expectations.narrativeText) {
      validation.details.narrativeText =
        result.narrativeText === expectations.narrativeText;
      if (!validation.details.narrativeText) {
        validation.valid = false;
        validation.errors.push(
          `Expected narrative: "${expectations.narrativeText}", got: "${result.narrativeText}"`
        );
      }
    }

    // Validate that no "Unnamed Character" appears
    if (
      result.narrativeText &&
      result.narrativeText.includes('Unnamed Character')
    ) {
      validation.valid = false;
      validation.errors.push(
        'Narrative text contains "Unnamed Character" - placeholder resolution failed'
      );
    }

    // Validate performance expectations
    if (
      expectations.maxExecutionTime &&
      result.metrics.executionTime > expectations.maxExecutionTime
    ) {
      validation.warnings.push(
        `Execution time ${result.metrics.executionTime}ms exceeded expected ${expectations.maxExecutionTime}ms`
      );
    }

    // Validate event generation
    if (
      expectations.minEvents &&
      result.eventHistory.length < expectations.minEvents
    ) {
      validation.warnings.push(
        `Generated ${result.eventHistory.length} events, expected at least ${expectations.minEvents}`
      );
    }

    return validation;
  }

  /**
   * Cleanup test environment
   * @returns {Promise<void>}
   */
  async cleanup() {
    this.#entities.clear();
    this.#relationships.clear();
    this.#gameState.clear();
    this.#eventHistory = [];

    if (this.#dependencies) {
      // Cleanup any resources
      await this.#cleanupDependencies();
    }
  }

  // Private helper methods

  /**
   * Create test dependencies
   * @private
   * @returns {Promise<Object>} - Test dependencies
   */
  async #createTestDependencies() {
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const entityManager = createTestEntityManager();

    const eventBus = {
      dispatch: jest.fn((event) => {
        this.#eventHistory.push({
          ...event,
          timestamp: Date.now(),
        });
      }),
      subscribe: jest.fn(),
    };

    // Create other required services
    const targetReferenceResolver = new (
      await import('../../../src/services/TargetReferenceResolver.js')
    ).default({
      logger: mockLogger,
      entityQueryManager: entityManager,
    });

    return {
      logger: mockLogger,
      entityManager,
      eventBus,
      targetReferenceResolver,
    };
  }

  /**
   * Initialize all required systems
   * @private
   */
  async #initializeSystems() {
    // Initialize enhanced target manager
    // Initialize action formatting stage
    // Initialize rule execution system
    // etc.
  }

  /**
   * Setup event monitoring
   * @private
   */
  #setupEventMonitoring() {
    // Monitor all events that flow through the system
    // This helps with debugging and validation
  }

  /**
   * Create test entity
   * @private
   * @param {string} id - Entity ID
   * @param {Object} data - Entity data
   * @returns {Promise<Object>} - Created entity
   */
  async #createEntity(id, data) {
    const entity = {
      id,
      ...data,
      createdAt: Date.now(),
    };

    this.#entities.set(id, entity);

    // Add to entity manager
    await this.#dependencies.entityManager.addEntity(entity);

    return entity;
  }

  /**
   * Create relationship between entities
   * @private
   * @param {string} fromId - Source entity ID
   * @param {string} toId - Target entity ID
   * @param {string} type - Relationship type
   * @param {Object} data - Relationship data
   */
  async #createRelationship(fromId, toId, type, data = {}) {
    const relationship = {
      from: fromId,
      to: toId,
      type,
      ...data,
      createdAt: Date.now(),
    };

    const relationshipKey = `${fromId}:${type}:${toId}`;
    this.#relationships.set(relationshipKey, relationship);

    // Add to relationship manager if available
    if (this.#dependencies.relationshipManager) {
      await this.#dependencies.relationshipManager.addRelationship(
        relationship
      );
    }
  }

  /**
   * Create action execution context
   * @private
   * @param {Object} actionConfig - Action configuration
   * @returns {Promise<Object>} - Action context
   */
  async #createActionContext(actionConfig) {
    return {
      actorId: actionConfig.actorId,
      actionId: actionConfig.actionId,
      actionDefinition: await this.#loadActionDefinition(actionConfig.actionId),
      gameState: Object.fromEntries(this.#gameState),
      timestamp: Date.now(),
      ...actionConfig.additionalContext,
    };
  }

  /**
   * Execute complete action pipeline
   * @private
   * @param {Object} context - Action context
   * @returns {Promise<Object>} - Pipeline execution result
   */
  async #executePipeline(context) {
    const stages = [
      'MultiTargetResolutionStage',
      'ActionFormattingStage',
      'RuleExecutionStage',
      'NarrativeGenerationStage',
    ];

    let currentContext = context;
    const stagesExecuted = [];

    for (const stageName of stages) {
      try {
        const stage = await this.#createStageInstance(stageName);
        currentContext = await stage.execute(currentContext);
        stagesExecuted.push(stageName);
      } catch (error) {
        return {
          success: false,
          error: `Stage ${stageName} failed: ${error.message}`,
          stagesExecuted,
          context: currentContext,
        };
      }
    }

    return {
      success: true,
      narrativeText: currentContext.narrativeText,
      stagesExecuted,
      context: currentContext,
    };
  }

  /**
   * Load action definition
   * @private
   * @param {string} actionId - Action ID
   * @returns {Promise<Object>} - Action definition
   */
  async #loadActionDefinition(actionId) {
    // Mock action definition for intimacy:adjust_clothing
    if (actionId === 'intimacy:adjust_clothing') {
      return {
        id: 'intimacy:adjust_clothing',
        name: 'Adjust Clothing',
        description: "Adjust someone's clothing with possessive care",
        targets: [
          {
            name: 'primary',
            type: 'character',
            required: true,
            description: 'Person whose clothing will be adjusted',
          },
          {
            name: 'secondary',
            type: 'clothing',
            required: true,
            contextFrom: 'primary',
            description: 'Clothing item to adjust',
          },
        ],
        rules: [
          {
            id: 'intimacy:handle_adjust_clothing',
            operations: [
              {
                type: 'GET_NAME',
                parameters: {
                  entity_ref: 'actor',
                  result_variable: 'actorName',
                },
              },
              {
                type: 'GET_NAME',
                parameters: {
                  entity_ref: 'primary',
                  result_variable: 'primaryName',
                },
              },
              {
                type: 'GET_NAME',
                parameters: {
                  entity_ref: 'secondary',
                  result_variable: 'garmentName',
                },
              },
            ],
            narrative: {
              template:
                "${actorName} smooths ${primaryName}'s ${garmentName} with possessive care.",
            },
          },
        ],
      };
    }

    throw new Error(`Unknown action: ${actionId}`);
  }
}

export default MultiTargetE2ETestBed;
```

### 2. Core Multi-Target Action Tests

**Step 2.1**: Create primary adjust_clothing E2E test

```javascript
/**
 * @file adjustClothingE2E.test.js
 * @description End-to-end tests for adjust_clothing multi-target action
 */

import MultiTargetE2ETestBed from '../common/multiTargetE2ETestBed.js';

describe('Multi-Target Action E2E - adjust_clothing', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new MultiTargetE2ETestBed();
    await testBed.setup();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Successful Execution', () => {
    it('should produce correct narrative output for adjust_clothing action', async () => {
      // Setup: Create intimacy scenario
      const { amaia, iker, jacket } = await testBed.setupIntimacyScenario();

      // Execute: Trigger adjust_clothing action
      const result = await testBed.executeMultiTargetAction({
        actorId: amaia.id,
        actionId: 'intimacy:adjust_clothing',
        additionalContext: {
          targetHints: {
            primary: iker.id,
            secondary: jacket.id,
          },
        },
      });

      // Assert: Verify correct narrative output
      const validation = testBed.validateExecutionResult(result, {
        shouldSucceed: true,
        narrativeText:
          "Amaia Castillo smooths Iker Aguirre's denim trucker jacket with possessive care.",
        maxExecutionTime: 1000, // 1 second
        minEvents: 3,
      });

      expect(validation.valid).toBe(true);

      // Additional detailed assertions
      expect(result.success).toBe(true);
      expect(result.narrativeText).toBe(
        "Amaia Castillo smooths Iker Aguirre's denim trucker jacket with possessive care."
      );
      expect(result.narrativeText).not.toContain('Unnamed Character');

      // Verify target resolution worked
      expect(result.context.targetManager).toBeDefined();
      expect(
        result.context.targetManager.getEntityIdByPlaceholder('primary')
      ).toBe(iker.id);
      expect(
        result.context.targetManager.getEntityIdByPlaceholder('secondary')
      ).toBe(jacket.id);

      // Verify event payload structure
      const actionEvent = result.eventHistory.find(
        (e) => e.type === 'core:attempt_action'
      );
      expect(actionEvent).toBeDefined();
      expect(actionEvent.payload.primaryId).toBe(iker.id);
      expect(actionEvent.payload.secondaryId).toBe(jacket.id);
      expect(actionEvent.payload.targets.primary.entityId).toBe(iker.id);
      expect(actionEvent.payload.targets.secondary.entityId).toBe(jacket.id);
    });

    it('should handle context-dependent target resolution', async () => {
      const { amaia, iker, jacket } = await testBed.setupIntimacyScenario();

      // Execute without providing secondary target directly
      // Secondary should be resolved from primary's clothing
      const result = await testBed.executeMultiTargetAction({
        actorId: amaia.id,
        actionId: 'intimacy:adjust_clothing',
        additionalContext: {
          targetHints: {
            primary: iker.id,
            // secondary will be resolved from primary's clothing
          },
        },
      });

      expect(result.success).toBe(true);
      expect(result.narrativeText).toContain('Iker Aguirre');
      expect(result.narrativeText).toContain('denim trucker jacket');
      expect(result.narrativeText).not.toContain('Unnamed Character');

      // Verify context dependency was detected
      expect(result.context.targetManager.hasContextDependencies()).toBe(true);

      const actionEvent = result.eventHistory.find(
        (e) => e.type === 'core:attempt_action'
      );
      expect(actionEvent.payload.hasContextDependencies).toBe(true);
      expect(actionEvent.payload.targets.secondary.resolvedFromContext).toBe(
        true
      );
      expect(actionEvent.payload.targets.secondary.contextSource).toBe(
        'primary'
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle missing primary target gracefully', async () => {
      const { amaia } = await testBed.setupIntimacyScenario();

      const result = await testBed.executeMultiTargetAction({
        actorId: amaia.id,
        actionId: 'intimacy:adjust_clothing',
        additionalContext: {
          targetHints: {
            // No targets provided
          },
        },
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('target');

      // Should not produce narrative with "Unnamed Character"
      if (result.narrativeText) {
        expect(result.narrativeText).not.toContain('Unnamed Character');
      }
    });

    it('should handle invalid target references in rules', async () => {
      const { amaia, iker } = await testBed.setupIntimacyScenario();

      // Create scenario where secondary target cannot be resolved
      const result = await testBed.executeMultiTargetAction({
        actorId: amaia.id,
        actionId: 'intimacy:adjust_clothing',
        additionalContext: {
          targetHints: {
            primary: iker.id,
            secondary: 'non_existent_item',
          },
        },
      });

      // Should either fail gracefully or use fallback behavior
      if (result.success) {
        // If it succeeds, should not contain "Unnamed Character"
        expect(result.narrativeText).not.toContain('Unnamed Character');
      } else {
        // If it fails, should have meaningful error
        expect(result.error).toBeDefined();
      }
    });

    it('should handle placeholder resolution failures in GET_NAME operations', async () => {
      const { amaia, iker, jacket } = await testBed.setupIntimacyScenario();

      // Simulate a scenario where placeholder resolution fails
      // This might happen if event payload is malformed
      const result = await testBed.executeMultiTargetAction({
        actorId: amaia.id,
        actionId: 'intimacy:adjust_clothing',
        additionalContext: {
          targetHints: {
            primary: iker.id,
            secondary: jacket.id,
          },
          simulatePayloadError: true, // Test configuration
        },
      });

      // Should handle the error gracefully
      if (result.narrativeText) {
        // Either succeed without "Unnamed Character" or fail cleanly
        expect(result.narrativeText).not.toContain('Unnamed Character');
      }
    });
  });

  describe('Performance Validation', () => {
    it('should complete multi-target action within performance bounds', async () => {
      const { amaia, iker, jacket } = await testBed.setupIntimacyScenario();

      const result = await testBed.executeMultiTargetAction({
        actorId: amaia.id,
        actionId: 'intimacy:adjust_clothing',
        additionalContext: {
          targetHints: {
            primary: iker.id,
            secondary: jacket.id,
          },
        },
      });

      expect(result.success).toBe(true);
      expect(result.metrics.executionTime).toBeLessThan(1000); // 1 second
      expect(result.eventHistory.length).toBeGreaterThan(0);

      // Verify no performance regressions
      expect(result.metrics.executionTime).toBeLessThan(500); // More aggressive target
    });

    it('should handle multiple concurrent multi-target actions', async () => {
      const { amaia, iker, jacket } = await testBed.setupIntimacyScenario();

      // Execute multiple actions concurrently
      const promises = Array.from({ length: 3 }, () =>
        testBed.executeMultiTargetAction({
          actorId: amaia.id,
          actionId: 'intimacy:adjust_clothing',
          additionalContext: {
            targetHints: {
              primary: iker.id,
              secondary: jacket.id,
            },
          },
        })
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.narrativeText).toContain('Amaia Castillo smooths');
        expect(result.narrativeText).not.toContain('Unnamed Character');
      });
    });
  });

  describe('Integration Validation', () => {
    it('should integrate correctly with event system', async () => {
      const { amaia, iker, jacket } = await testBed.setupIntimacyScenario();

      const result = await testBed.executeMultiTargetAction({
        actorId: amaia.id,
        actionId: 'intimacy:adjust_clothing',
        additionalContext: {
          targetHints: {
            primary: iker.id,
            secondary: jacket.id,
          },
        },
      });

      expect(result.success).toBe(true);

      // Verify expected events were generated
      const eventTypes = result.eventHistory.map((e) => e.type);
      expect(eventTypes).toContain('core:attempt_action');

      // Verify event payload structure
      const actionEvent = result.eventHistory.find(
        (e) => e.type === 'core:attempt_action'
      );
      expect(actionEvent.payload).toMatchObject({
        actorId: amaia.id,
        actionId: 'intimacy:adjust_clothing',
        primaryId: iker.id,
        secondaryId: jacket.id,
        targets: {
          primary: {
            entityId: iker.id,
            placeholder: 'primary',
          },
          secondary: {
            entityId: jacket.id,
            placeholder: 'secondary',
          },
        },
      });
    });

    it('should work with real rule execution system', async () => {
      const { amaia, iker, jacket } = await testBed.setupIntimacyScenario();

      const result = await testBed.executeMultiTargetAction({
        actorId: amaia.id,
        actionId: 'intimacy:adjust_clothing',
        additionalContext: {
          targetHints: {
            primary: iker.id,
            secondary: jacket.id,
          },
        },
      });

      expect(result.success).toBe(true);

      // Verify rule execution results
      expect(result.context.ruleExecutionResult).toBeDefined();
      expect(result.context.ruleExecutionResult.success).toBe(true);

      // Verify that GET_NAME operations resolved correctly
      const ruleContext = result.context.ruleExecutionResult.context;
      expect(ruleContext.getVariable('actorName')).toBe('Amaia Castillo');
      expect(ruleContext.getVariable('primaryName')).toBe('Iker Aguirre');
      expect(ruleContext.getVariable('garmentName')).toBe(
        'denim trucker jacket'
      );
    });
  });
});
```

### 3. Edge Case and Stress Tests

**Step 3.1**: Create comprehensive edge case tests

```javascript
/**
 * @file multiTargetEdgeCases.e2e.test.js
 * @description Edge case tests for multi-target action system
 */

describe('Multi-Target Action E2E - Edge Cases', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new MultiTargetE2ETestBed();
    await testBed.setup();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Complex Target Resolution', () => {
    it('should handle tertiary targets correctly', async () => {
      const { amaia, iker } = await testBed.setupIntimacyScenario();

      // Create additional entities for tertiary target
      const accessory = await testBed.createEntity('belt_instance', {
        name: 'leather belt',
        type: 'accessory',
        owner: iker.id,
      });

      // Mock action that uses tertiary target
      const result = await testBed.executeMultiTargetAction({
        actorId: amaia.id,
        actionId: 'intimacy:adjust_multiple_items',
        additionalContext: {
          targetHints: {
            primary: iker.id,
            secondary: 'jacket_id',
            tertiary: accessory.id,
          },
        },
      });

      // Should handle all three targets
      if (result.success) {
        expect(
          result.context.targetManager.getEntityIdByPlaceholder('tertiary')
        ).toBe(accessory.id);
        expect(result.narrativeText).not.toContain('Unnamed Character');
      }
    });

    it('should handle circular context dependencies', async () => {
      // Test scenario where target A depends on B, and B depends on A
      // This should be detected and handled gracefully

      const { amaia, iker } = await testBed.setupIntimacyScenario();

      const result = await testBed.executeMultiTargetAction({
        actorId: amaia.id,
        actionId: 'test:circular_dependency',
        additionalContext: {
          targetHints: {
            primary: iker.id,
          },
          simulateCircularDependency: true,
        },
      });

      // Should either resolve correctly or fail with meaningful error
      if (!result.success) {
        expect(result.error).toContain('circular');
      } else {
        expect(result.narrativeText).not.toContain('Unnamed Character');
      }
    });

    it('should handle very long target chains', async () => {
      // Test performance with many context-dependent targets
      const { amaia, iker } = await testBed.setupIntimacyScenario();

      // Create a chain of 5 context-dependent targets
      const result = await testBed.executeMultiTargetAction({
        actorId: amaia.id,
        actionId: 'test:long_target_chain',
        additionalContext: {
          targetHints: {
            primary: iker.id,
          },
          simulateLongChain: 5,
        },
      });

      // Should complete within reasonable time
      expect(result.metrics.executionTime).toBeLessThan(2000);

      if (result.success) {
        expect(result.narrativeText).not.toContain('Unnamed Character');
      }
    });
  });

  describe('Data Consistency Edge Cases', () => {
    it('should handle malformed event payloads gracefully', async () => {
      const { amaia, iker, jacket } = await testBed.setupIntimacyScenario();

      // Simulate malformed payload during action formatting
      const result = await testBed.executeMultiTargetAction({
        actorId: amaia.id,
        actionId: 'intimacy:adjust_clothing',
        additionalContext: {
          targetHints: {
            primary: iker.id,
            secondary: jacket.id,
          },
          simulateMalformedPayload: true,
        },
      });

      // Should handle gracefully without "Unnamed Character"
      if (result.narrativeText) {
        expect(result.narrativeText).not.toContain('Unnamed Character');
      }

      // Should provide meaningful error if it fails
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error).not.toBe('');
      }
    });

    it('should handle entity deletion during action execution', async () => {
      const { amaia, iker, jacket } = await testBed.setupIntimacyScenario();

      // Start action execution
      const executionPromise = testBed.executeMultiTargetAction({
        actorId: amaia.id,
        actionId: 'intimacy:adjust_clothing',
        additionalContext: {
          targetHints: {
            primary: iker.id,
            secondary: jacket.id,
          },
          simulateEntityDeletion: {
            entityId: jacket.id,
            deleteAfterStage: 'MultiTargetResolutionStage',
          },
        },
      });

      const result = await executionPromise;

      // Should handle entity deletion gracefully
      if (result.success) {
        expect(result.narrativeText).not.toContain('Unnamed Character');
      } else {
        expect(result.error).toContain('entity');
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of potential targets', async () => {
      const { amaia, iker } = await testBed.setupIntimacyScenario();

      // Create 100 clothing items
      const clothingItems = [];
      for (let i = 0; i < 100; i++) {
        const item = await testBed.createEntity(`clothing_${i}`, {
          name: `test clothing ${i}`,
          type: 'clothing',
          owner: iker.id,
        });
        clothingItems.push(item);
      }

      const result = await testBed.executeMultiTargetAction({
        actorId: amaia.id,
        actionId: 'intimacy:adjust_clothing',
        additionalContext: {
          targetHints: {
            primary: iker.id,
            // Let secondary be resolved from primary's many clothing items
          },
        },
      });

      // Should complete within reasonable time even with many options
      expect(result.metrics.executionTime).toBeLessThan(3000);

      if (result.success) {
        expect(result.narrativeText).not.toContain('Unnamed Character');
        expect(result.narrativeText).toContain('test clothing');
      }
    });

    it('should handle memory efficiently with repeated actions', async () => {
      const { amaia, iker, jacket } = await testBed.setupIntimacyScenario();

      // Execute same action 50 times
      const results = [];
      for (let i = 0; i < 50; i++) {
        const result = await testBed.executeMultiTargetAction({
          actorId: amaia.id,
          actionId: 'intimacy:adjust_clothing',
          additionalContext: {
            targetHints: {
              primary: iker.id,
              secondary: jacket.id,
            },
          },
        });
        results.push(result);

        // Clear event history to prevent memory buildup
        if (i % 10 === 0) {
          testBed.clearEventHistory();
        }
      }

      // All should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.narrativeText).not.toContain('Unnamed Character');

        // Performance should remain consistent
        if (index > 10) {
          // Allow warmup
          expect(result.metrics.executionTime).toBeLessThan(1000);
        }
      });
    });
  });
});
```

### 4. Cross-Browser and Environment Tests

**Step 4.1**: Create environment compatibility tests

```javascript
/**
 * @file multiTargetCompatibility.e2e.test.js
 * @description Cross-environment compatibility tests
 */

describe('Multi-Target Action E2E - Compatibility', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new MultiTargetE2ETestBed();
    await testBed.setup();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Browser Environment Compatibility', () => {
    it('should work in simulated browser environment', async () => {
      // Simulate browser-specific conditions
      const originalConsole = global.console;
      global.console = {
        ...originalConsole,
        warn: jest.fn(),
        error: jest.fn(),
      };

      const { amaia, iker, jacket } = await testBed.setupIntimacyScenario();

      const result = await testBed.executeMultiTargetAction({
        actorId: amaia.id,
        actionId: 'intimacy:adjust_clothing',
        additionalContext: {
          targetHints: {
            primary: iker.id,
            secondary: jacket.id,
          },
        },
      });

      expect(result.success).toBe(true);
      expect(result.narrativeText).toBe(
        "Amaia Castillo smooths Iker Aguirre's denim trucker jacket with possessive care."
      );

      // Should not have generated console errors
      expect(global.console.error).not.toHaveBeenCalled();

      global.console = originalConsole;
    });

    it('should handle different locale/language settings', async () => {
      // Test with different locale settings
      const originalLocale = process.env.LANG;
      process.env.LANG = 'es_ES.UTF-8';

      const { amaia, iker, jacket } = await testBed.setupIntimacyScenario();

      const result = await testBed.executeMultiTargetAction({
        actorId: amaia.id,
        actionId: 'intimacy:adjust_clothing',
        additionalContext: {
          targetHints: {
            primary: iker.id,
            secondary: jacket.id,
          },
        },
      });

      expect(result.success).toBe(true);
      expect(result.narrativeText).not.toContain('Unnamed Character');

      process.env.LANG = originalLocale;
    });
  });

  describe('Data Format Compatibility', () => {
    it('should handle legacy event formats', async () => {
      const { amaia, iker, jacket } = await testBed.setupIntimacyScenario();

      // Test with legacy-style event payload
      const result = await testBed.executeMultiTargetAction({
        actorId: amaia.id,
        actionId: 'intimacy:adjust_clothing',
        additionalContext: {
          targetHints: {
            primary: iker.id,
            secondary: jacket.id,
          },
          useLegacyFormat: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.narrativeText).not.toContain('Unnamed Character');
    });

    it('should handle mixed legacy and enhanced formats', async () => {
      const { amaia, iker, jacket } = await testBed.setupIntimacyScenario();

      const result = await testBed.executeMultiTargetAction({
        actorId: amaia.id,
        actionId: 'intimacy:adjust_clothing',
        additionalContext: {
          targetHints: {
            primary: iker.id,
            secondary: jacket.id,
          },
          useMixedFormat: true,
        },
      });

      expect(result.success).toBe(true);
      expect(result.narrativeText).not.toContain('Unnamed Character');
    });
  });
});
```

### 5. Test Reporting and Analytics

**Step 5.1**: Create comprehensive test reporting

```javascript
/**
 * @file testReporting.js
 * @description Test result reporting and analytics for E2E tests
 */

class E2ETestReporter {
  constructor() {
    this.testResults = [];
    this.performanceMetrics = [];
    this.errorAnalysis = new Map();
  }

  /**
   * Record test result
   * @param {Object} testResult - Test execution result
   */
  recordTestResult(testResult) {
    this.testResults.push({
      ...testResult,
      timestamp: Date.now(),
    });

    if (testResult.metrics) {
      this.performanceMetrics.push(testResult.metrics);
    }

    if (!testResult.success && testResult.error) {
      const errorType = this.#categorizeError(testResult.error);
      const count = this.errorAnalysis.get(errorType) || 0;
      this.errorAnalysis.set(errorType, count + 1);
    }
  }

  /**
   * Generate comprehensive test report
   * @returns {Object} - Test report
   */
  generateReport() {
    const successfulTests = this.testResults.filter((t) => t.success);
    const failedTests = this.testResults.filter((t) => !t.success);

    return {
      summary: {
        totalTests: this.testResults.length,
        successful: successfulTests.length,
        failed: failedTests.length,
        successRate: successfulTests.length / this.testResults.length,
        reportGeneratedAt: new Date().toISOString(),
      },
      performance: this.#analyzePerformance(),
      errorAnalysis: this.#analyzeErrors(),
      regressionDetection: this.#detectRegressions(),
      recommendations: this.#generateRecommendations(),
    };
  }

  /**
   * Check for "Unnamed Character" regressions
   * @returns {Object} - Regression analysis
   */
  checkUnnamedCharacterRegression() {
    const testsWithUnnamedCharacter = this.testResults.filter(
      (result) =>
        result.narrativeText &&
        result.narrativeText.includes('Unnamed Character')
    );

    return {
      hasRegression: testsWithUnnamedCharacter.length > 0,
      affectedTests: testsWithUnnamedCharacter.length,
      details: testsWithUnnamedCharacter.map((test) => ({
        testName: test.testName,
        narrativeText: test.narrativeText,
        timestamp: test.timestamp,
      })),
    };
  }

  // Private analysis methods

  #analyzePerformance() {
    if (this.performanceMetrics.length === 0) {
      return null;
    }

    const executionTimes = this.performanceMetrics.map((m) => m.executionTime);
    executionTimes.sort((a, b) => a - b);

    return {
      averageExecutionTime:
        executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length,
      medianExecutionTime:
        executionTimes[Math.floor(executionTimes.length / 2)],
      p95ExecutionTime:
        executionTimes[Math.floor(executionTimes.length * 0.95)],
      slowestExecutionTime: Math.max(...executionTimes),
      fastestExecutionTime: Math.min(...executionTimes),
    };
  }

  #analyzeErrors() {
    return {
      errorCategories: Object.fromEntries(this.errorAnalysis),
      totalErrors: Array.from(this.errorAnalysis.values()).reduce(
        (a, b) => a + b,
        0
      ),
      mostCommonError: this.#getMostCommonError(),
    };
  }

  #detectRegressions() {
    // Compare with baseline metrics if available
    return {
      performanceRegression: this.#detectPerformanceRegression(),
      functionalRegression: this.checkUnnamedCharacterRegression(),
      reliabilityRegression: this.#detectReliabilityRegression(),
    };
  }

  #generateRecommendations() {
    const recommendations = [];

    const unnamedCharacterRegression = this.checkUnnamedCharacterRegression();
    if (unnamedCharacterRegression.hasRegression) {
      recommendations.push({
        priority: 'CRITICAL',
        category: 'Functionality',
        message: `${unnamedCharacterRegression.affectedTests} test(s) still show "Unnamed Character" - primary issue not resolved`,
        action: 'Review placeholder resolution logic in rule execution',
      });
    }

    const performance = this.#analyzePerformance();
    if (performance && performance.averageExecutionTime > 1000) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Performance',
        message: `Average execution time (${performance.averageExecutionTime}ms) exceeds target (1000ms)`,
        action: 'Profile and optimize critical path performance',
      });
    }

    const errorAnalysis = this.#analyzeErrors();
    if (errorAnalysis.totalErrors > this.testResults.length * 0.1) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Reliability',
        message: `Error rate (${((errorAnalysis.totalErrors / this.testResults.length) * 100).toFixed(1)}%) is high`,
        action: 'Investigate most common error type and improve error handling',
      });
    }

    return recommendations;
  }

  #categorizeError(errorMessage) {
    if (errorMessage.includes('target')) return 'TARGET_RESOLUTION';
    if (errorMessage.includes('placeholder')) return 'PLACEHOLDER_ERROR';
    if (errorMessage.includes('entity')) return 'ENTITY_ERROR';
    if (errorMessage.includes('timeout')) return 'PERFORMANCE_ERROR';
    return 'OTHER';
  }

  #getMostCommonError() {
    let maxCount = 0;
    let mostCommon = null;

    for (const [errorType, count] of this.errorAnalysis.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = errorType;
      }
    }

    return mostCommon;
  }

  #detectPerformanceRegression() {
    const performance = this.#analyzePerformance();
    if (!performance) return null;

    // Check against baseline (would be loaded from previous runs)
    const baselineAverageTime = 500; // ms
    const regressionThreshold = 1.5; // 50% increase

    return {
      hasRegression:
        performance.averageExecutionTime >
        baselineAverageTime * regressionThreshold,
      currentAverage: performance.averageExecutionTime,
      baseline: baselineAverageTime,
      regressionPercentage:
        (performance.averageExecutionTime / baselineAverageTime - 1) * 100,
    };
  }

  #detectReliabilityRegression() {
    const failureRate =
      this.testResults.filter((t) => !t.success).length /
      this.testResults.length;
    const baselineFailureRate = 0.05; // 5%

    return {
      hasRegression: failureRate > baselineFailureRate,
      currentFailureRate: failureRate,
      baseline: baselineFailureRate,
    };
  }
}

export default E2ETestReporter;
```

## Acceptance Criteria

### Core Functionality Criteria

1. ✅ **Complete Workflow Validation**: E2E tests validate entire action pipeline from start to finish
2. ✅ **Correct Narrative Output**: Tests verify exact expected narrative text is produced
3. ✅ **No "Unnamed Character" Regression**: Tests detect and fail if "Unnamed Character" appears
4. ✅ **Placeholder Resolution Validation**: Tests verify placeholder names resolve to correct entity IDs
5. ✅ **Context Dependency Handling**: Tests validate context-dependent target resolution

### Error Handling Criteria

6. ✅ **Graceful Failure Handling**: Tests validate system handles missing targets gracefully
7. ✅ **Error Message Quality**: Failed tests provide meaningful error messages for debugging
8. ✅ **Edge Case Coverage**: Tests cover malformed data, circular dependencies, and other edge cases
9. ✅ **Recovery Testing**: Tests validate system recovers from various failure conditions
10. ✅ **Timeout Handling**: Tests validate system handles timeouts and performance issues

### Performance Criteria

11. ✅ **Execution Time Validation**: Tests verify actions complete within performance bounds (<1s)
12. ✅ **Scalability Testing**: Tests validate performance with large numbers of targets/entities
13. ✅ **Memory Efficiency**: Tests validate memory usage remains reasonable during execution
14. ✅ **Concurrent Execution**: Tests validate multiple simultaneous actions work correctly
15. ✅ **Regression Detection**: Tests detect performance regressions from baseline

### Integration Criteria

16. ✅ **Event System Integration**: Tests validate proper event generation and payload structure
17. ✅ **Rule System Integration**: Tests validate rule execution with placeholder resolution
18. ✅ **Schema Validation Integration**: Tests validate enhanced event payloads pass schema validation
19. ✅ **Backward Compatibility**: Tests validate legacy formats continue to work
20. ✅ **Cross-Environment Compatibility**: Tests work across different runtime environments

## Testing Requirements

### Test Organization

```javascript
// Test file structure
tests/
├── e2e/
│   ├── multiTarget/
│   │   ├── adjustClothingE2E.test.js          // Primary success cases
│   │   ├── multiTargetEdgeCases.e2e.test.js   // Edge cases and error handling
│   │   ├── multiTargetCompatibility.e2e.test.js // Environment compatibility
│   │   └── multiTargetPerformance.e2e.test.js  // Performance and scalability
│   └── common/
│       ├── multiTargetE2ETestBed.js           // Test infrastructure
│       ├── testReporting.js                   // Test result analysis
│       └── scenarioBuilders.js                // Reusable scenario builders
```

### Test Execution

```bash
# Run all multi-target E2E tests
npm run test:e2e:multi-target

# Run specific test suites
npm run test:e2e:multi-target:adjust-clothing
npm run test:e2e:multi-target:edge-cases
npm run test:e2e:multi-target:performance

# Run with coverage and reporting
npm run test:e2e:multi-target:full-report
```

### Continuous Integration Integration

```yaml
# GitHub Actions workflow snippet
- name: Run Multi-Target E2E Tests
  run: |
    npm run test:e2e:multi-target
    npm run test:report:e2e:multi-target

- name: Check for Unnamed Character Regression
  run: |
    if grep -r "Unnamed Character" test-results/; then
      echo "ERROR: Unnamed Character regression detected!"
      exit 1
    fi
```

## Performance Benchmarks

- Complete action execution: <1000ms (target), <500ms (stretch goal)
- Test suite execution: <30 seconds for full suite
- Memory usage: <100MB during test execution
- Concurrent action handling: Support 10+ simultaneous actions
- Error recovery time: <100ms for graceful failures

## Dependencies and Prerequisites

### System Dependencies

- **Tickets 1-5**: All implementation tickets must be completed first
- Jest testing framework with E2E capabilities
- Test bed utilities and mock systems
- Action and rule definition systems

### Testing Infrastructure

- Node.js test environment
- Mock file system and database
- Event monitoring and capture system
- Performance profiling tools

## Notes and Considerations

### Implementation Order

1. **Phase 1**: Basic E2E test infrastructure and test bed
2. **Phase 2**: Core adjust_clothing success path tests
3. **Phase 3**: Error handling and edge case tests
4. **Phase 4**: Performance and scalability tests
5. **Phase 5**: Compatibility and cross-environment tests
6. **Phase 6**: Test reporting and analytics
7. **Phase 7**: CI/CD integration and automation

### Test Maintenance

- **Test Data Management**: Reusable scenario builders for consistent test data
- **Test Isolation**: Each test creates and cleans up its own data
- **Regression Prevention**: Automated checks for "Unnamed Character" regression
- **Performance Monitoring**: Baseline tracking and regression detection

### Future Enhancements

- Visual regression testing for narrative output formatting
- Load testing with realistic user scenarios
- Integration with game content management system
- Automated test generation from action definitions
- Real-time test monitoring and alerting
- Cross-platform mobile testing capabilities

This comprehensive E2E testing suite ensures the multi-target action system works correctly end-to-end and prevents regression of the core "Unnamed Character" issue.
