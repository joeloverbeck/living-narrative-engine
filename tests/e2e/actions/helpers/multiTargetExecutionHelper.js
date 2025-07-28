/**
 * @file MultiTargetExecutionHelper - Helper for tracking multi-target action execution
 * @description Tracks operations, events, and state changes during action execution
 */

/**
 * Helper class for tracking and analyzing multi-target action execution
 */
export class MultiTargetExecutionHelper {
  /**
   * @param {object} actionService - Action service facade instance
   * @param {object} eventBus - Event bus for tracking events
   * @param {object} entityManager - Entity manager for state tracking
   */
  constructor(actionService, eventBus, entityManager) {
    this.actionService = actionService;
    this.eventBus = eventBus;
    this.entityManager = entityManager;

    // Tracking arrays
    this.operationLog = [];
    this.eventLog = [];
    this.stateSnapshots = [];

    // Operation handler spies
    this.operationSpies = new Map();

    // Event listener
    this.eventListener = null;

    // Unsubscribe function for production EventBus
    this.unsubscribeFunction = null;
  }

  /**
   * Setup tracking for the test
   *
   * @param {object} options - Tracking options
   * @returns {MultiTargetExecutionHelper} This helper for chaining
   */
  setupTracking(options = {}) {
    const {
      trackOperations = true,
      trackEvents = true,
      trackStateChanges = true,
    } = options;

    if (trackOperations) {
      this.setupOperationTracking();
    }

    if (trackEvents) {
      this.setupEventTracking();
    }

    if (trackStateChanges) {
      this.captureInitialState();
    }

    return this;
  }

  /**
   * Setup operation tracking by spying on handlers
   *
   * @private
   */
  setupOperationTracking() {
    // This would typically spy on actual operation handlers
    // For testing, we'll track through the mock execution
    this.operationLog = [];
  }

  /**
   * Setup event tracking on the event bus
   *
   * @private
   */
  setupEventTracking() {
    this.eventLog = [];

    // Listen to all events
    this.eventListener = (event) => {
      this.eventLog.push({
        type: event.type,
        payload: JSON.parse(JSON.stringify(event.payload || {})),
        timestamp: Date.now(),
      });
    };

    // Subscribe to all events using production EventBus interface
    if (this.eventBus && typeof this.eventBus.subscribe === 'function') {
      // Production EventBus interface - subscribe to wildcard '*' for all events
      this.unsubscribeFunction = this.eventBus.subscribe(
        '*',
        this.eventListener
      );
    } else if (this.eventBus && this.eventBus.on) {
      // Mock EventBus with 'on' method
      this.eventBus.on('*', this.eventListener);
    } else if (this.eventBus && this.eventBus.addEventListener) {
      // DOM-style event listener fallback
      const eventTypes = [
        'ACTION_INITIATED',
        'ACTION_COMPLETED',
        'ACTION_FAILED',
        'INVENTORY_ITEM_REMOVED',
        'ITEM_THROWN_AT_TARGET',
        'ENTITY_DAMAGED',
        'CONTAINER_UNLOCKED',
        'ITEM_ENCHANTED',
        'HEALING_PERFORMED',
        'EXPLOSIVE_THROWN',
        'EXPLOSION_TRIGGERED',
        'AREA_DAMAGE_APPLIED',
        'FORMATION_ORDERED',
        'ENTITY_POSITION_CHANGED',
        'FORMATION_ESTABLISHED',
      ];

      eventTypes.forEach((type) => {
        this.eventBus.addEventListener(type, this.eventListener);
      });
    }
  }

  /**
   * Capture initial state of all entities
   *
   * @private
   */
  captureInitialState() {
    this.stateSnapshots.push({
      timestamp: Date.now(),
      phase: 'initial',
      state: this.captureCurrentState(),
    });
  }

  /**
   * Execute a command and track everything
   *
   * @param {object} actor - Actor executing the command
   * @param {string} command - Command to execute
   * @returns {Promise<object>} Execution result with tracking data
   */
  async executeAndTrack(actor, command) {
    // Clear previous tracking data
    this.resetTracking();

    // Setup fresh tracking
    this.setupTracking();

    // Capture pre-execution state
    const preState = this.captureCurrentState();

    try {
      // Execute the command using the action service if available
      const startTime = Date.now();
      let result = {
        success: true,
        command,
        description: 'Command processed',
        result: { success: true },
      };

      // Try to call the action service execution with proper action object
      if (
        this.actionService &&
        typeof this.actionService.executeAction === 'function'
      ) {
        try {
          // We need to construct an action object from the command
          // For E2E tests, we'll look for mock actions that match this command
          const mockActions =
            this.actionService.getMockActions?.(actor.id) || [];
          const matchingAction = mockActions.find(
            (action) => action.command === command
          );

          if (matchingAction) {
            // Convert mock discovery result to proper action object
            // Filter out displayName fields from targets to match test expectations
            const cleanTargets = {};
            if (matchingAction.targets) {
              for (const [role, target] of Object.entries(
                matchingAction.targets
              )) {
                if (Array.isArray(target)) {
                  cleanTargets[role] = target.map((t) => ({ id: t.id }));
                } else {
                  cleanTargets[role] = { id: target.id };
                }
              }
            }

            const actionData = {
              actionId: matchingAction.actionId,
              actorId: actor.id,
              targets: cleanTargets,
            };

            // Call executeAction which will call orchestrator with proper interface
            const executionResult =
              await this.actionService.executeAction(actionData);

            if (executionResult) {
              result = {
                success: executionResult.success !== false,
                command,
                description: executionResult.description || 'Command processed',
                result: executionResult,
                mockExecutionResult: executionResult,
                // Copy important fields to top level for backward compatibility
                stateChanges: executionResult.stateChanges,
                events: executionResult.events,
                error: executionResult.error,
                rollback: executionResult.rollback,
                spatialUpdates: executionResult.spatialUpdates,
              };
            }
          } else {
            // Fallback: try direct orchestrator call for backward compatibility
            if (
              this.actionService.actionPipelineOrchestrator &&
              typeof this.actionService.actionPipelineOrchestrator.execute ===
                'function'
            ) {
              const executionResult =
                await this.actionService.actionPipelineOrchestrator.execute({
                  actorId: actor.id,
                  command: command,
                });

              if (executionResult) {
                result = {
                  success: executionResult.success !== false,
                  command,
                  description:
                    executionResult.description || 'Command processed',
                  result: executionResult,
                  mockExecutionResult: executionResult,
                  stateChanges: executionResult.stateChanges,
                  events: executionResult.events,
                  error: executionResult.error,
                  rollback: executionResult.rollback,
                  spatialUpdates: executionResult.spatialUpdates,
                };
              }
            }
          }
        } catch (error) {
          result = {
            success: false,
            command,
            error: error.message,
            result: { success: false, error: error.message },
          };
        }
      }

      const executionTime = Date.now() - startTime;

      // Capture post-execution state
      const postState = this.captureCurrentState();

      // Calculate state changes
      const stateChanges = this.calculateStateChanges(preState, postState);

      // Return comprehensive result
      return {
        result,
        executionTime,
        operations: [...this.operationLog],
        events: [...this.eventLog],
        stateChanges,
        preState,
        postState,
        snapshots: [...this.stateSnapshots],
      };
    } catch (error) {
      // Capture error state
      const errorState = this.captureCurrentState();

      return {
        result: { success: false, error: error.message },
        error,
        operations: [...this.operationLog],
        events: [...this.eventLog],
        stateChanges: this.calculateStateChanges(preState, errorState),
        preState,
        postState: errorState,
      };
    }
  }

  /**
   * Execute an action directly (bypassing command parsing)
   *
   * @param {object} actor - Actor executing the action
   * @param {object} actionData - Pre-resolved action data
   * @returns {Promise<object>} Execution result with tracking data
   */
  async executeActionAndTrack(actor, actionData) {
    // Clear previous tracking data
    this.resetTracking();

    // Setup fresh tracking
    this.setupTracking();

    // Capture pre-execution state
    const preState = this.captureCurrentState();

    try {
      // Execute the action using the action service
      const startTime = Date.now();
      const result = await this.actionService.executeAction({
        ...actionData,
        actorId: actor.id,
      });
      const executionTime = Date.now() - startTime;

      // Capture post-execution state
      const postState = this.captureCurrentState();

      // Calculate state changes
      const stateChanges = this.calculateStateChanges(preState, postState);

      return {
        result,
        executionTime,
        operations: [...this.operationLog],
        events: [...this.eventLog],
        stateChanges,
        preState,
        postState,
        resolvedTargets: actionData.targets,
        processedTargets: this.extractProcessedTargets(),
      };
    } catch (error) {
      const errorState = this.captureCurrentState();

      return {
        result: { success: false, error: error.message },
        error,
        operations: [...this.operationLog],
        events: [...this.eventLog],
        stateChanges: this.calculateStateChanges(preState, errorState),
        preState,
        postState: errorState,
      };
    }
  }

  /**
   * Capture current state of all entities
   *
   * @private
   * @returns {object} State snapshot
   */
  captureCurrentState() {
    const state = {};

    // Get all entities from the entity manager using the production interface
    if (this.entityManager && this.entityManager.entities) {
      // Production EntityManager has 'entities' property that returns iterator
      for (const entity of this.entityManager.entities) {
        state[entity.id] = {};

        // Get all component type IDs and their data
        const componentTypeIds = entity.componentTypeIds || [];

        for (const componentId of componentTypeIds) {
          const componentData = entity.getComponentData(componentId);
          if (componentData !== undefined) {
            state[entity.id][componentId] = JSON.parse(
              JSON.stringify(componentData)
            );
          }
        }
      }
    } else if (
      this.entityManager &&
      typeof this.entityManager.getAllEntities === 'function'
    ) {
      // Fallback for test mocks that implement getAllEntities
      const allEntities = this.entityManager.getAllEntities();

      for (const entity of allEntities) {
        state[entity.id] = {};

        // Try to get component data using available methods
        if (typeof entity.getAllComponents === 'function') {
          const components = entity.getAllComponents();
          for (const [componentId, componentData] of Object.entries(
            components
          )) {
            state[entity.id][componentId] = JSON.parse(
              JSON.stringify(componentData)
            );
          }
        } else if (entity.componentTypeIds) {
          // Use componentTypeIds property
          for (const componentId of entity.componentTypeIds) {
            const componentData = entity.getComponentData(componentId);
            if (componentData !== undefined) {
              state[entity.id][componentId] = JSON.parse(
                JSON.stringify(componentData)
              );
            }
          }
        }
      }
    }

    return state;
  }

  /**
   * Calculate state changes between two snapshots
   *
   * @private
   * @param {object} beforeState - State before execution
   * @param {object} afterState - State after execution
   * @returns {object} Map of changes by entity and component
   */
  calculateStateChanges(beforeState, afterState) {
    const changes = {};

    // Check all entities in the after state
    for (const [entityId, afterComponents] of Object.entries(afterState)) {
      const beforeComponents = beforeState[entityId] || {};

      for (const [componentId, afterData] of Object.entries(afterComponents)) {
        const beforeData = beforeComponents[componentId];

        if (JSON.stringify(beforeData) !== JSON.stringify(afterData)) {
          if (!changes[entityId]) {
            changes[entityId] = {};
          }

          changes[entityId][componentId] = {
            before: beforeData,
            after: afterData,
          };
        }
      }
    }

    // Check for removed entities
    for (const entityId of Object.keys(beforeState)) {
      if (!afterState[entityId]) {
        changes[entityId] = { removed: true };
      }
    }

    return changes;
  }

  /**
   * Extract processed targets from the operation log
   *
   * @private
   * @returns {object} Map of processed targets
   */
  extractProcessedTargets() {
    const targets = {};

    for (const operation of this.operationLog) {
      if (operation.targetId) {
        targets[operation.targetRole] = operation.targetId;
      }
    }

    return targets;
  }

  /**
   * Track an operation execution
   *
   * @param {object} operation - Operation details
   */
  trackOperation(operation) {
    this.operationLog.push({
      ...operation,
      timestamp: Date.now(),
    });
  }

  /**
   * Get events of a specific type
   *
   * @param {string} eventType - Type of events to filter
   * @returns {Array} Filtered events
   */
  getEventsByType(eventType) {
    return this.eventLog.filter((event) => event.type === eventType);
  }

  /**
   * Get operations of a specific type
   *
   * @param {string} operationType - Type of operations to filter
   * @returns {Array} Filtered operations
   */
  getOperationsByType(operationType) {
    return this.operationLog.filter((op) => op.type === operationType);
  }

  /**
   * Verify event sequence matches expected
   *
   * @param {Array} expectedTypes - Expected event types in order
   * @returns {boolean} True if sequence matches
   */
  verifyEventSequence(expectedTypes) {
    const actualTypes = this.eventLog.map((e) => e.type);

    if (actualTypes.length !== expectedTypes.length) {
      return false;
    }

    return actualTypes.every((type, index) => type === expectedTypes[index]);
  }

  /**
   * Verify operation sequence matches expected
   *
   * @param {Array} expectedOperations - Expected operations in order
   * @returns {boolean} True if sequence matches
   */
  verifyOperationSequence(expectedOperations) {
    if (this.operationLog.length !== expectedOperations.length) {
      return false;
    }

    return this.operationLog.every((op, index) => {
      const expected = expectedOperations[index];
      return (
        op.type === expected.type &&
        (!expected.entityId || op.entityId === expected.entityId) &&
        (!expected.componentId || op.componentId === expected.componentId)
      );
    });
  }

  /**
   * Reset all tracking data
   *
   * @private
   */
  resetTracking() {
    this.operationLog = [];
    this.eventLog = [];
    this.stateSnapshots = [];
  }

  /**
   * Clean up resources
   */
  cleanup() {
    // Remove event listeners
    if (this.eventListener) {
      if (
        this.unsubscribeFunction &&
        typeof this.unsubscribeFunction === 'function'
      ) {
        // Production EventBus - use the unsubscribe function returned by subscribe
        this.unsubscribeFunction();
        this.unsubscribeFunction = null;
      } else if (this.eventBus && this.eventBus.off) {
        // Mock EventBus with 'off' method
        this.eventBus.off('*', this.eventListener);
      } else if (this.eventBus && this.eventBus.unsubscribe) {
        // Production EventBus manual unsubscribe
        this.eventBus.unsubscribe('*', this.eventListener);
      } else if (this.eventBus && this.eventBus.removeEventListener) {
        // DOM-style event listener removal
        const eventTypes = [
          'ACTION_INITIATED',
          'ACTION_COMPLETED',
          'ACTION_FAILED',
          'INVENTORY_ITEM_REMOVED',
          'ITEM_THROWN_AT_TARGET',
          'ENTITY_DAMAGED',
          'CONTAINER_UNLOCKED',
          'ITEM_ENCHANTED',
          'HEALING_PERFORMED',
          'EXPLOSIVE_THROWN',
          'EXPLOSION_TRIGGERED',
          'AREA_DAMAGE_APPLIED',
          'FORMATION_ORDERED',
          'ENTITY_POSITION_CHANGED',
          'FORMATION_ESTABLISHED',
        ];

        eventTypes.forEach((type) => {
          this.eventBus.removeEventListener(type, this.eventListener);
        });
      }
    }

    // Clear tracking data
    this.resetTracking();

    // Clear spies
    this.operationSpies.clear();
  }
}

/**
 * Factory function to create execution helper
 *
 * @param {object} actionService - Action service facade
 * @param {object} eventBus - Event bus
 * @param {object} entityManager - Entity manager
 * @returns {MultiTargetExecutionHelper} New helper instance
 */
export function createExecutionHelper(actionService, eventBus, entityManager) {
  return new MultiTargetExecutionHelper(actionService, eventBus, entityManager);
}
