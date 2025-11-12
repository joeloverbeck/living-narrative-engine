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
    // Note: Mods are loaded during base container configuration
    // This is a placeholder for explicit mod loading if needed
    // In practice, mods should be loaded via modsLoader during container setup
  }

  /**
   * Creates a mock GOAP actor entity for testing
   * @param {Object} options - Actor options
   * @param {string} options.name - Actor name
   * @param {string} [options.type='goap'] - Player type
   * @param {Object} [options.components={}] - Additional components
   * @param {string} [options.location] - Location ID
   * @returns {Object} Actor entity instance
   */
  async createActor({ name, type = 'goap', components = {}, location }) {
    const entityId = `actor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create base actor definition with required components
    const baseComponents = {
      'core:actor': { name },
      'core:player_type': { type },
      ...components,
    };

    // Create a simple mock object that implements the Entity interface
    const mockEntity = {
      id: entityId,
      name,
      location: location || 'default_location',
      getAllComponents: () => baseComponents,
    };

    // Store for cleanup
    this.entities.set(entityId, mockEntity);

    // Mock entityManager to return this entity when requested
    const originalGetEntityInstance = this.entityManager.getEntityInstance;
    this.entityManager.getEntityInstance = (id) => {
      if (id === entityId) {
        return mockEntity;
      }
      // Fallback to original method for other entities
      if (this.entities.has(id)) {
        return this.entities.get(id);
      }
      return originalGetEntityInstance.call(this.entityManager, id);
    };

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
   * Gets available actions for an actor (mock for E2E tests)
   * @param {Object} actor - Actor object
   * @returns {Promise<Array>} Mock available actions
   */
  async getAvailableActions(actor) {
    // Return mock actions for testing
    // In real implementation, this would use actionDiscoveryService
    return [
      {
        index: 1,
        actionId: 'core:wait',
        params: { targetId: null },
        planningEffects: {
          effects: [
            {
              operation: 'ADD_COMPONENT',
              entity: 'actor',
              component: 'core:waited',
              data: {},
            },
          ],
        },
      },
    ];
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
   * Executes an action (simplified for E2E tests)
   * @param {string} actorId - Actor ID
   * @param {Object} action - Action to execute
   * @returns {Promise<void>}
   */
  async executeAction(actorId, action) {
    // Simplified execution for E2E tests
    // In real implementation, this would use ruleProcessor
    this.logger.info(`Executed action ${action.actionId} for actor ${actorId}`);
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
