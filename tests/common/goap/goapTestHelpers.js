/**
 * @file Test helpers for GOAP (Goal-Oriented Action Planning) integration testing
 * Provides utilities for creating test beds with GOAP services configured
 */

import { jest } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureBaseContainer } from '../../../src/dependencyInjection/baseContainerConfig.js';
import { registerGoapServices } from '../../../src/dependencyInjection/registrations/goapRegistrations.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { goapTokens } from '../../../src/dependencyInjection/tokens/tokens-goap.js';

/**
 * Creates a test bed with GOAP services configured
 * @returns {Promise<GoapTestBed>} Test bed instance
 */
export async function createGoapTestBed() {
  const testBed = new GoapTestBed();
  await testBed.initialize();
  return testBed;
}

/**
 * Test bed for GOAP integration testing
 * Provides access to GOAP services and utilities for testing
 */
export class GoapTestBed {
  constructor() {
    this.container = null;
    this.logger = null;
    this.entityManager = null;
    this.goalManager = null;
    this.simplePlanner = null;
    this.planCache = null;
    this.goapDecisionProvider = null;
    this.availableActionsProvider = null;
    this.actionDiscoveryService = null;
    this.entities = new Map();
    this.cleanupHandlers = [];
  }

  /**
   * Initializes the test bed with GOAP services
   * @returns {Promise<void>}
   */
  async initialize() {
    // Create container
    this.container = new AppContainer();

    // Create mock logger
    this.logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      log: jest.fn(),
    };

    // Register logger
    this.container.register(tokens.ILogger, this.logger);

    // Create mock UI elements
    const outputDiv = document.createElement('div');
    outputDiv.id = 'outputDiv';
    document.body.appendChild(outputDiv);

    const mockUIElements = {
      outputDiv,
      inputElement: document.createElement('input'),
      titleElement: document.createElement('h1'),
      document,
    };

    // Configure base container
    await configureBaseContainer(this.container, {
      includeGameSystems: true,
      includeUI: false,
      includeCharacterBuilder: false,
      uiElements: mockUIElements,
      logger: this.logger,
    });

    // Register GOAP services
    registerGoapServices(this.container);

    // Resolve services
    this.entityManager = this.container.resolve(tokens.IEntityManager);
    this.goalManager = this.container.resolve(goapTokens.IGoalManager);
    this.simplePlanner = this.container.resolve(goapTokens.ISimplePlanner);
    this.planCache = this.container.resolve(goapTokens.IPlanCache);
    // IGoapDecisionProvider uses an async factory, so we need to await it
    const goapDecisionProviderPromise = this.container.resolve(tokens.IGoapDecisionProvider);
    this.goapDecisionProvider = goapDecisionProviderPromise instanceof Promise
      ? await goapDecisionProviderPromise
      : goapDecisionProviderPromise;
    this.availableActionsProvider = this.container.resolve(tokens.IAvailableActionsProvider);
    this.actionDiscoveryService = this.container.resolve(tokens.IActionDiscoveryService);

    // Track cleanup
    this.cleanupHandlers.push(() => {
      if (outputDiv.parentNode) {
        outputDiv.parentNode.removeChild(outputDiv);
      }
    });
  }

  /**
   * Loads mods for testing
   * @param {Array<string>} modIds - Mod IDs to load
   * @returns {Promise<void>}
   */
  async loadMods(modIds) {
    // Note: In the test environment, mods are loaded during base container configuration
    // via the registerLoaders phase. We don't need to explicitly load them again here.
    // This method is kept for API compatibility and logging purposes.

    this.logger.info(`Test environment: Mods (${modIds.join(', ')}) available via base container setup`);

    // Store requested mods for reference
    this.requestedMods = modIds;
  }

  /**
   * Creates a mock GOAP actor entity for testing
   * @param {Object} options - Actor options
   * @param {string} options.name - Actor name
   * @param {string} [options.type='goap'] - Player type
   * @param {Object} [options.components={}] - Additional components
   * @param {string} [options.location] - Location ID
   * @returns {Object} Actor entity instance (mock object with required interface)
   */
  async createActor({ name, type = 'goap', components = {}, location }) {
    const entityId = `actor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create base actor definition with required components
    const allComponents = {
      'core:actor': { name },
      'core:player_type': { type },
      ...components,
    };

    // Create a mock entity object that implements the required interface
    const mockEntity = {
      id: entityId,
      name,
      location: location || 'default_location',
      getAllComponents: () => allComponents,
      getComponent: (componentId) => allComponents[componentId] || null,
      hasComponent: (componentId) => componentId in allComponents,
      addComponent: (componentId, data) => {
        allComponents[componentId] = data;
      },
      removeComponent: (componentId) => {
        delete allComponents[componentId];
      },
      // Additional methods that might be needed
      components: allComponents,
    };

    // Store for tracking and cleanup
    this.entities.set(entityId, mockEntity);

    // Mock entityManager to return this entity when requested
    const originalGetEntityInstance = this.entityManager.getEntityInstance;
    this.entityManager.getEntityInstance = (id) => {
      if (id === entityId) {
        return mockEntity;
      }
      // Check our local entity map
      if (this.entities.has(id)) {
        return this.entities.get(id);
      }
      // Fallback to original method
      if (originalGetEntityInstance && typeof originalGetEntityInstance === 'function') {
        return originalGetEntityInstance.call(this.entityManager, id);
      }
      return null;
    };

    this.logger.debug(`Created mock actor entity: ${entityId} (${name})`);

    return mockEntity;
  }

  /**
   * Creates a mock entity for testing
   * @param {Object} options - Entity options
   * @param {string} options.name - Entity name
   * @param {Object} options.components - Components
   * @returns {Object} Entity mock object
   */
  async createEntity({ name, components = {} }) {
    const entityId = `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // For now, return a simple mock object
    const mockEntity = {
      id: entityId,
      name,
      getAllComponents: () => components,
    };

    // Store for cleanup
    this.entities.set(entityId, mockEntity);

    return mockEntity;
  }

  /**
   * Creates a turn context for testing
   * @param {Object} options - Context options
   * @param {string} options.actorId - Actor ID
   * @returns {Object} Turn context
   */
  createContext({ actorId }) {
    return {
      actorId,
      game: {},
      turn: 1,
    };
  }

  /**
   * Gets available actions for an actor using real action discovery
   * @param {Object} actor - Actor object (must have id property)
   * @param {Object} [context] - Optional turn context
   * @returns {Promise<Array>} Real available actions with planning effects
   */
  async getAvailableActions(actor, context) {
    // Get the real entity instance
    const actorEntity = this.entityManager.getEntityInstance(actor.id);

    if (!actorEntity) {
      this.logger.warn(`Actor entity not found: ${actor.id}`);
      return [];
    }

    // Create default context if not provided
    const discoveryContext = context || this.createContext({ actorId: actor.id });

    // Ensure required context properties
    discoveryContext.game = discoveryContext.game || {};
    discoveryContext.turn = discoveryContext.turn || 1;

    try {
      const actions = await this.actionDiscoveryService.discoverActions(
        actorEntity,
        discoveryContext
      );

      this.logger.debug(
        `Discovered ${actions.length} actions for actor ${actor.id}`
      );

      // Filter to actions with planning effects (GOAP requirement)
      const plannableActions = actions.filter(
        (action) => action.planningEffects && action.planningEffects.effects
      );

      this.logger.debug(
        `${plannableActions.length} actions have planning effects`
      );

      return plannableActions;
    } catch (error) {
      this.logger.error(
        `Error discovering actions for actor ${actor.id}:`,
        error
      );
      return [];
    }
  }

  /**
   * Makes a GOAP decision for an actor
   * @param {Object} actor - Actor object (must have id and getAllComponents method)
   * @param {Object} context - Turn context
   * @param {Array} actions - Available actions
   * @returns {Promise<Object>} Decision result
   */
  async makeGoapDecision(actor, context, actions) {
    return await this.goapDecisionProvider.decide(actor, context, actions);
  }

  /**
   * Executes an action using the real rule system
   * @param {string} actorId - Actor ID
   * @param {Object} action - Action to execute (must have actionId, params with targetId and optionally tertiaryTargetId)
   * @returns {Promise<Object>} Execution result with state changes
   */
  async executeAction(actorId, action) {
    // Get the operation interpreter for executing rule operations
    const operationInterpreter = this.container.resolve(
      tokens.IOperationInterpreter
    );
    const eventBus = this.container.resolve(tokens.IEventBus);

    this.logger.info(
      `Executing action ${action.actionId} for actor ${actorId}`
    );

    // Capture state before execution
    const stateBefore = this.captureEntityState(actorId);

    // Dispatch the attempt_action event which will trigger the rule
    const actionEvent = {
      type: 'core:attempt_action',
      payload: {
        actorId,
        actionId: action.actionId,
        targetId: action.params?.targetId || action.targetId || null,
        tertiaryTargetId:
          action.params?.tertiaryTargetId || action.tertiaryTargetId || null,
        turn: 1,
      },
    };

    // The event bus will trigger the appropriate rule
    await eventBus.dispatch(actionEvent);

    // Allow async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Capture state after execution
    const stateAfter = this.captureEntityState(actorId);

    // Compare states
    const stateChanges = this.compareStates(stateBefore, stateAfter);

    this.logger.info(`Action execution complete. State changes detected:`, {
      added: stateChanges.added.length,
      removed: stateChanges.removed.length,
      modified: stateChanges.modified.length,
    });

    return {
      success: true,
      stateBefore,
      stateAfter,
      stateChanges,
    };
  }

  /**
   * Captures the current state of an entity
   * @param {string} entityId - Entity ID
   * @returns {Object} State snapshot
   */
  captureEntityState(entityId) {
    const entity = this.entities.get(entityId);
    if (!entity || !entity.getAllComponents) {
      return { components: {} };
    }

    const components = entity.getAllComponents();

    // Deep clone to avoid reference issues
    return {
      components: JSON.parse(JSON.stringify(components)),
    };
  }

  /**
   * Compares two entity states and identifies changes
   * @param {Object} before - State before
   * @param {Object} after - State after
   * @returns {Object} State changes
   */
  compareStates(before, after) {
    const changes = {
      added: [],
      removed: [],
      modified: [],
    };

    const beforeComponents = before.components || {};
    const afterComponents = after.components || {};

    // Find added and modified components
    for (const [componentId, afterData] of Object.entries(afterComponents)) {
      if (!beforeComponents[componentId]) {
        changes.added.push({
          component: componentId,
          data: afterData,
        });
      } else {
        // Check if modified
        const beforeData = beforeComponents[componentId];
        if (JSON.stringify(beforeData) !== JSON.stringify(afterData)) {
          changes.modified.push({
            component: componentId,
            before: beforeData,
            after: afterData,
          });
        }
      }
    }

    // Find removed components
    for (const componentId of Object.keys(beforeComponents)) {
      if (!afterComponents[componentId]) {
        changes.removed.push({
          component: componentId,
          data: beforeComponents[componentId],
        });
      }
    }

    return changes;
  }

  /**
   * Verifies that planning effects match actual state changes
   * @param {Object} action - Action with planningEffects
   * @param {Object} stateChanges - Actual state changes from execution
   * @returns {Object} Verification result
   */
  verifyPlanningEffects(action, stateChanges) {
    if (!action.planningEffects || !action.planningEffects.effects) {
      return {
        verified: false,
        reason: 'No planning effects to verify',
      };
    }

    const effects = action.planningEffects.effects;
    const mismatches = [];

    for (const effect of effects) {
      if (effect.operation === 'ADD_COMPONENT') {
        const component = effect.component;
        const wasAdded = stateChanges.added.some(
          (change) => change.component === component
        );

        if (!wasAdded) {
          mismatches.push({
            effect,
            issue: `Expected component ${component} to be added but it wasn't`,
          });
        }
      } else if (effect.operation === 'REMOVE_COMPONENT') {
        const component = effect.component;
        const wasRemoved = stateChanges.removed.some(
          (change) => change.component === component
        );

        if (!wasRemoved) {
          mismatches.push({
            effect,
            issue: `Expected component ${component} to be removed but it wasn't`,
          });
        }
      } else if (effect.operation === 'MODIFY_COMPONENT') {
        const component = effect.component;
        const wasModified = stateChanges.modified.some(
          (change) => change.component === component
        );

        if (!wasModified) {
          mismatches.push({
            effect,
            issue: `Expected component ${component} to be modified but it wasn't`,
          });
        }
      }
    }

    return {
      verified: mismatches.length === 0,
      mismatches,
      effectsCount: effects.length,
      changesCount:
        stateChanges.added.length +
        stateChanges.removed.length +
        stateChanges.modified.length,
    };
  }

  /**
   * Checks if entity has component (mock for E2E tests)
   * @param {string} entityId - Entity ID
   * @param {string} componentId - Component ID
   * @returns {boolean} True if entity has component
   */
  hasComponent(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (!entity || !entity.getAllComponents) {
      return false;
    }
    const components = entity.getAllComponents();
    return components && componentId in components;
  }

  /**
   * Gets component data (mock for E2E tests)
   * @param {string} entityId - Entity ID
   * @param {string} componentId - Component ID
   * @returns {Object|null} Component data
   */
  getComponent(entityId, componentId) {
    const entity = this.entities.get(entityId);
    if (!entity || !entity.getAllComponents) {
      return null;
    }
    const components = entity.getAllComponents();
    return components[componentId] || null;
  }

  /**
   * Cleans up test bed resources
   */
  cleanup() {
    // Clear plan cache
    if (this.planCache) {
      this.planCache.clear();
    }

    // Clear entities
    this.entities.clear();

    // Run cleanup handlers
    for (const handler of this.cleanupHandlers) {
      try {
        handler();
      } catch (err) {
        // Ignore errors during cleanup
      }
    }
    this.cleanupHandlers = [];
  }
}

export default createGoapTestBed;
