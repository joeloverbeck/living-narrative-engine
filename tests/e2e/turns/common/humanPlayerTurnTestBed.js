/**
 * @file humanPlayerTurnTestBed.js
 * @description Test bed for human player turn workflow E2E tests
 *
 * Extends the full turn execution test bed with specialized functionality
 * for testing human player interactions, UI events, and input validation.
 */

import { jest } from '@jest/globals';
import { FullTurnExecutionTestBed } from './fullTurnExecutionTestBed.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';
import { createEntityDefinition } from '../../../common/entities/entityFactories.js';

/**
 * Test bed for human player turn testing
 *
 * This test bed extends the full turn execution test bed to provide:
 * - Human player entity creation with proper configuration
 * - UI event simulation and monitoring
 * - Player input simulation (action selection and speech)
 * - Turn state tracking for human turns
 * - Mixed actor scenario support (AI and human)
 */
export class HumanPlayerTurnTestBed extends FullTurnExecutionTestBed {
  constructor() {
    super();

    // Additional properties for human player testing
    this.promptCoordinator = null;
    this.humanDecisionProvider = null;
    this.uiEvents = [];
    this.playerInputHandlers = new Map();
  }

  /**
   * Initialize the test bed with human player support
   */
  async initialize() {
    await super.initialize();

    // Resolve human player specific services
    this.promptCoordinator = this.container.resolve(tokens.IPromptCoordinator);
    this.humanDecisionProvider = this.container.resolve(
      tokens.IHumanDecisionProvider
    );
    this.promptOutputPort = this.container.resolve(tokens.IPromptOutputPort);

    // Set up UI event monitoring
    this.setupUIEventMonitoring();
    
    // Ensure services are properly initialized
    await this.waitForServicesReady();
  }

  /**
   * Wait for all services to be ready for testing
   */
  async waitForServicesReady() {
    // Give a small delay to ensure all dependency injection and service initialization is complete
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Verify critical services are available
    if (!this.promptCoordinator) {
      throw new Error('PromptCoordinator not available after initialization');
    }
    if (!this.humanDecisionProvider) {
      throw new Error('HumanDecisionProvider not available after initialization');
    }
    if (!this.turnManager) {
      throw new Error('TurnManager not available after initialization');
    }
  }

  /**
   * Set up monitoring of UI-specific events
   */
  setupUIEventMonitoring() {
    // Subscribe to all events and filter UI events
    // Also monitor through ISafeEventDispatcher if available
    const safeDispatcher = this.container.resolve(tokens.ISafeEventDispatcher);

    // Monitor at the raw event bus level
    this.eventBus.subscribe('*', (event) => {
      const uiEventTypes = [
        'core:player_turn_prompt',
        'core:update_available_actions',
        'core:enable_input',
        'core:disable_input',
        'core:player_turn_submitted',
        'core:player_turn_error',
      ];

      if (uiEventTypes.includes(event.type)) {
        this.uiEvents.push({
          timestamp: Date.now(),
          type: event.type,
          payload: event.payload,
        });
      }
    });

    // Also monitor through SafeEventDispatcher
    if (safeDispatcher) {
      safeDispatcher.subscribe('*', (event) => {});
    }
  }

  /**
   * Create a human player entity
   *
   * @param {string} id - Entity ID
   * @param {string} locationId - Starting location
   * @param {object} [additionalComponents] - Additional components to add
   * @returns {Promise<object>} Created entity
   */
  async createHumanPlayer(id, locationId, additionalComponents = {}) {
    const components = {
      'core:name': { text: 'Human Player' },
      'core:position': { locationId },
      'core:actor': { isPlayer: true, isAI: false },
      'core:player_type': { type: 'human' },
      'core:closeness': { relationships: {} },
      'core:following': { following: null, followers: [] },
      'core:movement': { locked: false },
      ...additionalComponents,
    };

    const definition = createEntityDefinition(id, components);
    this.registry.store('entityDefinitions', id, definition);
    await this.entityManager.createEntityInstance(id, {
      instanceId: id,
      definitionId: id,
    });

    return await this.entityManager.getEntityInstance(id);
  }

  /**
   * Create an AI actor entity
   *
   * @param {string} id - Entity ID
   * @param {string} locationId - Starting location
   * @param {object} [aiConfig] - AI configuration
   * @returns {Promise<object>} Created entity
   */
  async createAIActor(id, locationId, aiConfig = {}) {
    const components = {
      'core:name': { text: 'AI Actor' },
      'core:position': { locationId },
      'core:actor': { isPlayer: false, isAI: true },
      'core:ai': {
        personality: 'A helpful AI companion',
        goals: ['Assist the player'],
        memories: [],
        ...aiConfig,
      },
      'core:closeness': { relationships: {} },
      'core:following': { following: null, followers: [] },
      'core:movement': { locked: false },
      'core:perception_log': { logEntries: [], maxEntries: 50 },
      'core:short_term_memory': { thoughts: [], maxEntries: 10 },
      'core:notes': { notes: [] },
    };

    const definition = createEntityDefinition(id, components);
    this.registry.store('entityDefinitions', id, definition);
    await this.entityManager.createEntityInstance(id, {
      instanceId: id,
      definitionId: id,
    });

    return await this.entityManager.getEntityInstance(id);
  }

  /**
   * Mock the prompt coordinator to simulate player input with proper timing
   *
   * @param {number} actionIndex - Selected action index
   * @param {string} [speech] - Optional speech text
   * @param {object} [options] - Additional options
   */
  mockPlayerInput(actionIndex, speech = '', options = {}) {
    const {
      delay = 0,
      shouldThrow = false,
      errorMessage = 'Input error',
    } = options;

    if (!this.promptCoordinator) {
      throw new Error('PromptCoordinator not available for mocking');
    }

    // Store original method for cleanup
    if (!this.promptCoordinator._originalPrompt) {
      this.promptCoordinator._originalPrompt = this.promptCoordinator.prompt.bind(this.promptCoordinator);
    }
    
    // Also mock the prompt output port to simulate UI events
    if (!this.promptOutputPort._originalPrompt) {
      this.promptOutputPort._originalPrompt = this.promptOutputPort.prompt.bind(this.promptOutputPort);
    }
    
    this.promptOutputPort.prompt = jest.fn().mockImplementation(async (entityId, availableActions, error) => {
      console.log(`Mock prompt output port called for actor ${entityId}`);
      
      // Dispatch UI events to simulate the real prompt output port
      await this.eventBus.dispatch('core:player_turn_prompt', {
        entityId: entityId,
        availableActions: availableActions,
      });

      await this.eventBus.dispatch('core:update_available_actions', {
        actorId: entityId,
        actions: availableActions,
      });

      await this.eventBus.dispatch('core:enable_input', {});
      
      // Wait a bit for event processing
      await new Promise(resolve => setTimeout(resolve, 10));
    });
    
    this.promptCoordinator.prompt = jest.fn().mockImplementation(async (actor, { indexedComposites, cancellationSignal } = {}) => {
      console.log(`Mock prompt called for actor ${actor.id} with ${indexedComposites?.length || 0} actions`);
      
      // Check for abort signal
      if (cancellationSignal?.aborted) {
        throw new DOMException('Prompt operation was aborted.', 'AbortError');
      }

      // Validate we have actions
      if (!Array.isArray(indexedComposites) || indexedComposites.length === 0) {
        throw new Error('No actions available for prompting');
      }

      // The prompt coordinator calls the prompt output port first
      const actionsForPrompt = indexedComposites.map((c) => ({
        index: c.index,
        actionId: c.actionId,
        commandString: c.commandString,
        params: c.params,
        description: c.description,
      }));
      await this.promptOutputPort.prompt(actor.id, actionsForPrompt);

      // Simulate delay if specified
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }

      // Check for abort after delay
      if (cancellationSignal?.aborted) {
        throw new DOMException('Prompt operation was aborted.', 'AbortError');
      }

      // Simulate error if requested
      if (shouldThrow) {
        throw new Error(errorMessage);
      }

      // Validate action index against available actions (1-based indexing)
      if (actionIndex < 1 || actionIndex > indexedComposites.length) {
        throw new Error(`Invalid action index ${actionIndex}. Available actions: 1-${indexedComposites.length}`);
      }

      // Simulate the user submitting their choice
      await this.eventBus.dispatch('core:player_turn_submitted', {
        chosenIndex: actionIndex,
        speech: speech || '',
        thoughts: null,
        notes: null,
        submittedByActorId: actor.id,
      });
      
      // Wait a bit and then disable input
      await new Promise(resolve => setTimeout(resolve, 10));
      await this.eventBus.dispatch('core:disable_input', {});

      console.log(`Mock prompt completed for actor ${actor.id}, returning result`);
      
      // Return the expected prompt resolution format
      return {
        chosenIndex: actionIndex,
        speech: speech || '',
        thoughts: null,
        notes: null,
      };
    });
  }

  /**
   * Simulate player action selection
   *
   * @param {string} actorId - Actor ID
   * @param {number} actionIndex - Selected action index
   * @param {string} [speech] - Optional speech text
   */
  async simulatePlayerAction(actorId, actionIndex, speech = '') {
    // Dispatch the player turn submitted event
    this.eventBus.dispatch({
      type: 'core:player_turn_submitted',
      payload: {
        actorId,
        actionIndex,
        speech,
      },
    });
  }

  /**
   * Wait for a specific UI event with better debugging
   *
   * @param {string} eventType - Event type to wait for
   * @param {number} [timeout] - Timeout in milliseconds
   * @returns {Promise<object>} The event that was received
   */
  async waitForUIEvent(eventType, timeout = 5000) {
    const startTime = Date.now();
    console.log(`Waiting for UI event: ${eventType}`);

    while (Date.now() - startTime < timeout) {
      const event = this.uiEvents.find(
        (e) => e.type === eventType && e.timestamp >= startTime
      );
      if (event) {
        console.log(`Found UI event: ${eventType}`);
        return event;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    const diagnostics = this.generateTimeoutDiagnostics();
    throw new Error(`Timeout waiting for UI event: ${eventType}. Diagnostics: ${diagnostics}`);
  }

  /**
   * Verify the current UI state
   *
   * @param {object} expectedState - Expected UI state
   */
  verifyUIState(expectedState) {
    const { inputEnabled, availableActions, currentActor } = expectedState;

    if (inputEnabled !== undefined) {
      const lastInputEvent = [...this.uiEvents]
        .reverse()
        .find(
          (e) =>
            e.type === 'core:enable_input' || e.type === 'core:disable_input'
        );

      const isEnabled = lastInputEvent?.type === 'core:enable_input';
      expect(isEnabled).toBe(inputEnabled);
    }

    if (availableActions !== undefined) {
      const lastActionsEvent = [...this.uiEvents]
        .reverse()
        .find((e) => e.type === 'core:update_available_actions');

      if (availableActions === null) {
        expect(lastActionsEvent).toBeUndefined();
      } else {
        expect(lastActionsEvent?.payload?.actions).toHaveLength(
          availableActions.length
        );
      }
    }

    if (currentActor !== undefined) {
      const lastPromptEvent = [...this.uiEvents]
        .reverse()
        .find((e) => e.type === 'core:player_turn_prompt');

      expect(lastPromptEvent?.payload?.actorId).toBe(currentActor);
    }
  }

  /**
   * Start a human player turn with proper synchronization
   *
   * @param {string} actorId - Actor ID
   * @returns {Promise<void>}
   */
  async startHumanTurn(actorId) {
    // Ensure the turn manager is ready
    if (!this.turnManager) {
      throw new Error('TurnManager not initialized');
    }

    // Wait for turn manager to be fully ready
    await new Promise(resolve => setTimeout(resolve, 10));
    
    await this.turnManager.start();

    // Find the actor in the turn order
    const actor = await this.entityManager.getEntityInstance(actorId);
    if (!actor) {
      throw new Error(`Actor ${actorId} not found`);
    }

    // Advance turns until we reach the human player
    let currentActor;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      currentActor = this.turnManager.getCurrentActorId();
      if (currentActor === actorId) {
        break;
      }

      // Skip non-human turns
      await this.turnManager.advanceTurn();
      attempts++;
    }

    if (currentActor !== actorId) {
      throw new Error(
        `Failed to reach human player turn after ${maxAttempts} attempts`
      );
    }
  }

  /**
   * Wait for turn to complete with proper timeout handling
   * 
   * @param {string} expectedEvent - Event type to wait for
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<object>} The event that was received
   */
  async waitForTurnCompletion(expectedEvent = 'core:turn_ended', timeout = 10000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const events = this.getEventsByType(expectedEvent);
      if (events.length > 0) {
        return events[events.length - 1]; // Return the most recent event
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // If we get here, we timed out
    const errorInfo = this.generateTimeoutDiagnostics();
    throw new Error(`Timeout waiting for ${expectedEvent} after ${timeout}ms. ${errorInfo}`);
  }

  /**
   * Generate diagnostic information for timeout scenarios
   */
  generateTimeoutDiagnostics() {
    const recentEvents = this.events.slice(-10).map(e => e.type);
    const systemErrors = this.getEventsByType('core:system_error_occurred');
    const turnStarted = this.getEventsByType('core:turn_started');
    const actionDecided = this.getEventsByType('core:action_decided');
    const turnEnded = this.getEventsByType('core:turn_ended');
    const promptEvents = this.getUIEventsByType('core:player_turn_prompt');
    const inputEvents = this.getUIEventsByType('core:enable_input');
    const submitEvents = this.getEventsByType('core:player_turn_submitted');
    
    const diagnostics = {
      recentEvents: recentEvents,
      turnStarted: turnStarted.length,
      actionDecided: actionDecided.length,
      turnEnded: turnEnded.length,
      systemErrors: systemErrors.length,
      promptEvents: promptEvents.length,
      inputEvents: inputEvents.length,
      submitEvents: submitEvents.length,
      totalEvents: this.events.length,
      totalUIEvents: this.uiEvents.length
    };
    
    // Add error details if there are system errors
    if (systemErrors.length > 0) {
      diagnostics.errorMessages = systemErrors.map(e => e.payload.message || e.payload.error);
    }
    
    return JSON.stringify(diagnostics, null, 2);
  }

  /**
   * Enable debug logging for turn workflow
   */
  enableDebugLogging() {
    console.log('Enabling debug logging for HumanPlayerTurnTestBed');
    
    // Log all events as they happen
    this.eventBus.subscribe('*', (event) => {
      console.log(`[EVENT] ${event.type}:`, event.payload);
    });
    
    // Log UI events separately
    const originalUIEventsPush = this.uiEvents.push.bind(this.uiEvents);
    this.uiEvents.push = (...events) => {
      events.forEach(event => {
        console.log(`[UI_EVENT] ${event.type}:`, event.payload);
      });
      return originalUIEventsPush(...events);
    };
  }

  /**
   * Get a summary of the current test state
   */
  getTestStateSummary() {
    return {
      turnManagerRunning: this.turnManager?._isRunning || false,
      currentActor: this.turnManager?.getCurrentActorId?.() || null,
      totalEvents: this.events.length,
      totalUIEvents: this.uiEvents.length,
      recentEvents: this.events.slice(-5).map(e => e.type),
      systemErrors: this.getEventsByType('core:system_error_occurred').length,
      promptCoordinatorMocked: !!(this.promptCoordinator?.prompt?.mockImplementation),
    };
  }

  /**
   * Get UI events of a specific type
   *
   * @param {string} eventType - Event type to filter
   * @returns {Array} Filtered events
   */
  getUIEventsByType(eventType) {
    return this.uiEvents.filter((e) => e.type === eventType);
  }

  /**
   * Clear recorded UI events
   */
  clearUIEvents() {
    this.uiEvents = [];
  }

  /**
   * Create a mixed actor scenario with both AI and human players
   *
   * @param {number} humanCount - Number of human players
   * @param {number} aiCount - Number of AI actors
   * @param {string} locationId - Starting location
   * @returns {Promise<object>} Object with actors arrays
   */
  async createMixedActorScenario(
    humanCount = 1,
    aiCount = 1,
    locationId = 'test-tavern'
  ) {
    const humanActors = [];
    const aiActors = [];

    // Create human players
    for (let i = 0; i < humanCount; i++) {
      const actor = await this.createHumanPlayer(
        `human-player-${i}`,
        locationId
      );
      humanActors.push(actor);
    }

    // Create AI actors
    for (let i = 0; i < aiCount; i++) {
      const actor = await this.createAIActor(`ai-actor-${i}`, locationId);
      aiActors.push(actor);
    }

    return { humanActors, aiActors };
  }

  /**
   * Execute a complete human turn through the pipeline
   *
   * @param {string} actorId - ID of the human actor
   * @param {object} turnContext - Turn context
   * @param {Array} availableActions - Available action composites
   * @param {AbortSignal} [abortSignal] - Optional abort signal
   * @returns {Promise<object>} Turn execution result
   */
  async executeFullHumanTurn(
    actorId,
    turnContext,
    availableActions,
    abortSignal
  ) {
    const actor = await this.entityManager.getEntityInstance(actorId);
    if (!actor) {
      throw new Error(`Actor ${actorId} not found`);
    }

    // Dispatch UI events that would normally happen during a turn
    this.eventBus.dispatch({
      type: 'core:turn_started',
      payload: { entityId: actorId, entityType: 'player' },
    });

    this.eventBus.dispatch({
      type: 'core:player_turn_prompt',
      payload: { entityId: actorId },
    });

    this.eventBus.dispatch({
      type: 'core:update_available_actions',
      payload: { actions: availableActions },
    });

    this.eventBus.dispatch({
      type: 'core:enable_input',
      payload: {},
    });

    // Use the human decision provider to make a decision
    const decision = await this.humanDecisionProvider.decide(
      actor,
      turnContext || this.createTestTurnContext(),
      availableActions || this.createTestActionComposites(),
      abortSignal
    );

    // Dispatch post-decision events
    this.eventBus.dispatch({
      type: 'ACTION_DECIDED_ID',
      payload: {
        actorId: actor.id,
        chosenIndex: decision.chosenIndex,
        thoughts: decision.thoughts,
        notes: decision.notes,
      },
    });

    if (decision.speech) {
      this.eventBus.dispatch({
        type: 'ENTITY_SPOKE_ID',
        payload: {
          entityId: actor.id,
          text: decision.speech,
        },
      });
    }

    // Simulate processing
    this.eventBus.dispatch({
      type: 'TURN_PROCESSING_STARTED',
      payload: { entityId: actor.id },
    });

    // Simulate success
    this.eventBus.dispatch({
      type: 'TURN_PROCESSING_ENDED',
      payload: { entityId: actor.id, success: true },
    });

    this.eventBus.dispatch({
      type: 'core:disable_input',
      payload: {},
    });

    this.eventBus.dispatch({
      type: 'core:turn_ended',
      payload: { entityId: actorId, success: true },
    });

    return {
      actorId: actor.id,
      action: {
        chosenIndex: decision.chosenIndex,
        speech: decision.speech,
      },
      thoughts: decision.thoughts,
      notes: decision.notes,
      success: true,
    };
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    // Restore original prompt coordinator if it was mocked
    if (this.promptCoordinator) {
      if (this.promptCoordinator.prompt && this.promptCoordinator.prompt.mockRestore) {
        this.promptCoordinator.prompt.mockRestore();
      } else if (this.promptCoordinator._originalPrompt) {
        this.promptCoordinator.prompt = this.promptCoordinator._originalPrompt;
        delete this.promptCoordinator._originalPrompt;
      }
    }
    
    // Restore original prompt output port if it was mocked
    if (this.promptOutputPort) {
      if (this.promptOutputPort.prompt && this.promptOutputPort.prompt.mockRestore) {
        this.promptOutputPort.prompt.mockRestore();
      } else if (this.promptOutputPort._originalPrompt) {
        this.promptOutputPort.prompt = this.promptOutputPort._originalPrompt;
        delete this.promptOutputPort._originalPrompt;
      }
    }
    
    await super.cleanup();
    this.uiEvents = [];
    this.playerInputHandlers.clear();
  }
}

export default HumanPlayerTurnTestBed;
