/**
 * @file MultiTargetTestBuilder - Builder for multi-target action test scenarios
 * @description Provides a fluent interface for setting up complex multi-target action tests
 */

import { EntityManagerTestBed } from '../../../common/entities/entityManagerTestBed.js';
import { createMockFacades } from '../../../common/facades/testingFacadeRegistrations.js';
import {
  createScenarioEntities,
  TEST_ENTITY_IDS,
} from '../fixtures/testEntities.js';
import {
  multiTargetActions,
  TEST_ACTION_IDS,
} from '../fixtures/multiTargetActions.js';
import EntityDefinition from '../../../../src/entities/entityDefinition.js';

/**
 * Builder class for creating multi-target action test scenarios
 */
export class MultiTargetTestBuilder {
  /**
   * @param {object} jest - Jest object with fn and spyOn methods
   */
  constructor(jest) {
    this.jest = jest;
    this.entityTestBed = new EntityManagerTestBed();
    this.facades = null;
    this.entities = new Map();
    this.locations = new Map();
    this.scenario = null;
    this.actionDefinition = null;
    this.mockDiscoveryResults = [];
    this.mockValidationResults = new Map();
    this.mockExecutionResults = new Map();
  }

  /**
   * Initialize facades and services
   *
   * @returns {MultiTargetTestBuilder} This builder for chaining
   */
  initialize() {
    this.facades = createMockFacades({}, this.jest.fn);
    return this;
  }

  /**
   * Build a specific scenario type
   *
   * @param {string} scenarioType - Type of scenario (throw, unlock, enchant, etc.)
   * @returns {MultiTargetTestBuilder} This builder for chaining
   */
  buildScenario(scenarioType) {
    this.scenario = { type: scenarioType };
    return this;
  }

  /**
   * Set the action definition to test
   *
   * @param {string} actionId - ID of the action from fixtures
   * @returns {MultiTargetTestBuilder} This builder for chaining
   */
  withAction(actionId) {
    this.actionDefinition =
      multiTargetActions[
        Object.keys(multiTargetActions).find(
          (key) => multiTargetActions[key].id === actionId
        )
      ];
    if (!this.actionDefinition) {
      throw new Error(`Action not found: ${actionId}`);
    }
    return this;
  }

  /**
   * Create entities for the current scenario
   *
   * @returns {Promise<MultiTargetTestBuilder>} This builder for chaining
   */
  async createEntities() {
    if (!this.scenario) {
      throw new Error('Scenario must be set before creating entities');
    }

    const entityConfigs = createScenarioEntities(this.scenario);

    // Create entities based on scenario
    for (const [role, config] of Object.entries(entityConfigs)) {
      if (Array.isArray(config)) {
        // Handle arrays of entities (e.g., multiple targets)
        const createdEntities = [];
        for (let i = 0; i < config.length; i++) {
          const instanceId = `${role}_${i}`;
          const entity = await this.createEntity(config[i], instanceId);
          createdEntities.push(entity);
        }
        this.entities.set(role, createdEntities);
      } else {
        const instanceId = this.getInstanceIdForRole(role);
        const entity = await this.createEntity(config, instanceId);
        this.entities.set(role, entity);
      }
    }

    return this;
  }

  /**
   * Create a single entity
   *
   * @private
   * @param {object} config - Entity configuration
   * @param {string} instanceId - Instance ID for the entity
   * @returns {Promise<object>} Created entity
   */
  async createEntity(config, instanceId) {
    // Create a proper EntityDefinition instance
    const definition = new EntityDefinition(config.definitionId, {
      description: `Test entity definition for ${config.definitionId}`,
      components: config.components,
    });

    this.entityTestBed.setupDefinitions(definition);

    const entity = await this.entityTestBed.entityManager.createEntityInstance(
      config.definitionId,
      {
        instanceId,
        componentOverrides: config.components,
      }
    );

    // Add test helper methods to the entity if they don't exist
    if (!entity.modifyComponent && entity.updateComponent) {
      entity.modifyComponent = (componentId, data) => {
        return entity.updateComponent(componentId, data);
      };
    }

    // Store entity with both instanceId and role for easier retrieval
    return entity;
  }

  /**
   * Get instance ID for a role based on scenario
   *
   * @private
   * @param {string} role - Entity role
   * @returns {string} Instance ID
   */
  getInstanceIdForRole(role) {
    const roleToIdMap = {
      actor: TEST_ENTITY_IDS.PLAYER,
      player: TEST_ENTITY_IDS.PLAYER,
      healer: 'healer',
      leader: 'leader',
      target: TEST_ENTITY_IDS.GUARD,
      item: TEST_ENTITY_IDS.ROCK,
      container: TEST_ENTITY_IDS.CHEST,
      chest: TEST_ENTITY_IDS.CHEST,
      brassKey: TEST_ENTITY_IDS.BRASS_KEY,
      ironKey: TEST_ENTITY_IDS.IRON_KEY,
      weapon: TEST_ENTITY_IDS.SWORD,
      catalyst: TEST_ENTITY_IDS.CRYSTAL,
      explosive: TEST_ENTITY_IDS.BOMB,
      merchant: TEST_ENTITY_IDS.MERCHANT,
      location: TEST_ENTITY_IDS.ROOM,
      wounded1: 'alice_001', // Updated to match test expectations
      wounded2: 'wounded_ally_2',
      healthy: 'healthy_ally',
    };

    return roleToIdMap[role] || role;
  }

  /**
   * Setup mock action discovery results
   *
   * @param {object} discoveryConfig - Discovery configuration
   * @returns {MultiTargetTestBuilder} This builder for chaining
   */
  withMockDiscovery(discoveryConfig) {
    const {
      targets,
      command,
      available = true,
      contextDependencies,
    } = discoveryConfig;

    this.mockDiscoveryResults.push({
      actionId: this.actionDefinition.id,
      targets,
      command,
      available,
      contextDependencies,
    });

    return this;
  }

  /**
   * Setup mock validation result
   *
   * @param {boolean} success - Whether validation should succeed
   * @param {object} details - Additional validation details
   * @returns {MultiTargetTestBuilder} This builder for chaining
   */
  withMockValidation(success, details = {}) {
    const actorId = this.getActorId();

    if (!this.mockValidationResults.has(actorId)) {
      this.mockValidationResults.set(actorId, new Map());
    }

    this.mockValidationResults.get(actorId).set(this.actionDefinition.id, {
      success,
      ...details,
      validatedAction: success
        ? {
            actionId: this.actionDefinition.id,
            actorId,
            targets: details.targets || this.mockDiscoveryResults[0]?.targets,
          }
        : undefined,
    });

    return this;
  }

  /**
   * Setup mock execution result
   *
   * @param {object} executionResult - Execution result configuration
   * @returns {MultiTargetTestBuilder} This builder for chaining
   */
  withMockExecution(executionResult) {
    const actorId = this.getActorId();

    if (!this.mockExecutionResults.has(actorId)) {
      this.mockExecutionResults.set(actorId, new Map());
    }

    this.mockExecutionResults.get(actorId).set(this.actionDefinition.id, {
      success: true,
      ...executionResult,
    });

    return this;
  }

  /**
   * Apply all mocks to facades
   *
   * @returns {MultiTargetTestBuilder} This builder for chaining
   */
  applyMocks() {
    const actorId = this.getActorId();

    // Apply discovery mocks
    this.facades.actionService.setMockActions(
      actorId,
      this.mockDiscoveryResults
    );

    // Apply validation mocks
    for (const [actor, validations] of this.mockValidationResults) {
      for (const [actionId, result] of validations) {
        this.facades.actionService.setMockValidation(actor, actionId, result);
      }
    }

    // Apply execution mocks - ensure we have proper execution results
    let finalExecutionResult = null;
    let hasExecutionMocks = false;

    for (const [actor, executions] of this.mockExecutionResults) {
      for (const [actionId, result] of executions) {
        hasExecutionMocks = true;
        finalExecutionResult = {
          success: true,
          description: 'Test execution completed',
          ...result,
        };
      }
    }

    // If no execution mocks were set, create a default mock that preserves test structure
    if (!hasExecutionMocks && this.mockDiscoveryResults.length > 0) {
      // Create a default execution result based on discovery mock data
      const discoveryResult = this.mockDiscoveryResults[0];
      finalExecutionResult = {
        success: true,
        description: 'Test execution completed',
        resolvedTargets: discoveryResult.targets || {},
        contextResolution: discoveryResult.contextDependencies || {},
      };
    }

    // Always set up the mock with proper Jest tracking if we have any execution data
    if (finalExecutionResult) {
      // Check if there's already a Jest mock and update its resolved value
      const existingMock =
        this.facades.actionService.actionPipelineOrchestrator.execute;
      if (existingMock && existingMock.mockResolvedValue) {
        // Update the existing mock's resolved value instead of replacing it
        existingMock.mockResolvedValue(finalExecutionResult);
      } else {
        // Fallback: create a new mock function
        const mockFn = this.jest.fn().mockResolvedValue(finalExecutionResult);
        this.facades.actionService.actionPipelineOrchestrator.execute = mockFn;
      }
    }

    return this;
  }

  /**
   * Get the main actor ID
   *
   * @private
   * @returns {string} Actor ID
   */
  getActorId() {
    const actor =
      this.entities.get('actor') ||
      this.entities.get('player') ||
      this.entities.get('healer') ||
      this.entities.get('leader');
    return actor?.id || TEST_ENTITY_IDS.PLAYER;
  }

  /**
   * Build the complete test environment
   *
   * @returns {Promise<object>} Test environment with all necessary components
   */
  async build() {
    if (!this.facades) {
      this.initialize();
    }

    this.applyMocks();

    return {
      facades: this.facades,
      actionService: this.facades.actionService,
      entityService: this.facades.entityService,
      eventBus: this.facades.mockDeps.eventBus,
      entityTestBed: this.entityTestBed,
      entities: this.entities,
      actionDefinition: this.actionDefinition,
      scenario: this.scenario,

      // Helper methods
      getEntity: (role) => {
        const entity = this.entities.get(role);
        if (!entity) {
          // If direct role lookup fails, try to find by instance ID
          const instanceId = this.getInstanceIdForRole(role);
          const entityManager = this.entityTestBed.entityManager;
          if (entityManager && entityManager.getEntity) {
            return entityManager.getEntity(instanceId);
          }
        }
        return entity;
      },
      getEntityComponent: (role, componentId) => {
        const entity = this.entities.get(role);
        return (
          entity?.getComponent?.(componentId) ||
          entity?.getComponentData?.(componentId)
        );
      },
      captureGameState: () => this.captureCurrentState(),
      cleanup: () => this.cleanup(),
    };
  }

  /**
   * Capture current game state for comparison
   *
   * @private
   * @returns {object} Current state snapshot
   */
  captureCurrentState() {
    const state = {};

    for (const [role, entity] of this.entities) {
      if (Array.isArray(entity)) {
        // Handle entity arrays
        entity.forEach((e, index) => {
          state[e.id] = this.captureEntityState(e);
        });
      } else {
        state[entity.id] = this.captureEntityState(entity);
      }
    }

    return state;
  }

  /**
   * Capture state of a single entity
   *
   * @private
   * @param {object} entity - Entity to capture
   * @returns {object} Entity state
   */
  captureEntityState(entity) {
    const state = {};
    const components = entity.getAllComponents();

    for (const [componentId, component] of Object.entries(components)) {
      state[componentId] = JSON.parse(JSON.stringify(component));
    }

    return state;
  }

  /**
   * Clean up test resources
   */
  cleanup() {
    this.entityTestBed.cleanup();
    this.entities.clear();
    this.locations.clear();
    this.mockDiscoveryResults = [];
    this.mockValidationResults.clear();
    this.mockExecutionResults.clear();
  }
}

/**
 * Factory function to create a new test builder
 *
 * @param {object} jest - Jest object with fn and spyOn methods
 * @returns {MultiTargetTestBuilder} New test builder instance
 */
export function createMultiTargetTestBuilder(jest) {
  return new MultiTargetTestBuilder(jest);
}
