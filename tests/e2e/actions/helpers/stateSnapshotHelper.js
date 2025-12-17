/**
 * @file State Snapshot Helper for E2E Tests
 * @description Utilities for capturing, comparing, and validating game state
 * during action execution for failure recovery and persistence testing
 */

/**
 * Deep clones an object using JSON serialization.
 * @param {*} value - The value to clone
 * @returns {*} A deep clone of the value
 */
function deepClone(value) {
  if (value === null || value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value));
}

/**
 * Captures a comprehensive snapshot of the current game state
 *
 * @param {object} services - Object containing required services
 * @param {object} services.entityService - Entity service facade
 * @param {object} services.turnExecutionFacade - Turn execution facade
 * @param {object} services.actionService - Action service facade
 * @returns {object} Complete state snapshot
 */
export function captureGameState({
  entityService,
  turnExecutionFacade,
  actionService,
}) {
  if (!entityService || !turnExecutionFacade) {
    throw new Error('captureGameState: Missing required services');
  }

  const entities = {};

  // For mock testing, we'll use a simplified approach
  // In a real implementation, this would use getAllEntityIds
  const testEntityIds = [];

  // Try to get entities from test environment if available
  if (entityService.getTestEntities) {
    const testEntities = entityService.getTestEntities();
    for (const [id, entity] of testEntities) {
      // Create shallow copies to avoid deep references
      entities[id] = {
        id,
        components: entity.components
          ? deepClone(entity.components)
          : {},
      };
      testEntityIds.push(id);
    }
  } else {
    // Fallback for basic mocks - just return empty state
    // In real tests, entities would be properly tracked
  }

  // Capture turn state if available
  let turnState = null;
  try {
    turnState = turnExecutionFacade.getCurrentTurnState();
  } catch (error) {
    // Turn might not be active, which is ok
    turnState = { active: false };
  }

  // Capture available actions if action service provided
  let availableActions = null;
  if (actionService) {
    try {
      // Get available actions for actors
      const actorIds = testEntityIds.filter((id) => {
        const entity = entities[id];
        return entity && entity.components && entity.components['core:actor'];
      });

      availableActions = {};
      for (const actorId of actorIds) {
        if (actionService.getAvailableActions) {
          availableActions[actorId] =
            actionService.getAvailableActions(actorId);
        }
      }
    } catch (error) {
      // Actions might not be discoverable yet
      availableActions = {};
    }
  }

  return {
    timestamp: Date.now(),
    entities,
    turnState: deepClone(turnState),
    availableActions: deepClone(availableActions),
    entityCount: testEntityIds.length,
  };
}

/**
 * Compares two game state snapshots and returns differences
 *
 * @param {object} beforeState - State captured before action
 * @param {object} afterState - State captured after action
 * @returns {object} Detailed comparison results
 */
export function compareStates(beforeState, afterState) {
  if (!beforeState || !afterState) {
    throw new Error('compareStates: Both states must be provided');
  }

  const differences = {
    entities: {
      added: [],
      removed: [],
      modified: {},
    },
    turnState: {
      changed: false,
      before: beforeState.turnState,
      after: afterState.turnState,
    },
    availableActions: {
      changed: false,
      differences: {},
    },
    summary: {
      hasChanges: false,
      entityChanges: 0,
      componentChanges: 0,
    },
  };

  // Check for added/removed entities
  const beforeIds = new Set(Object.keys(beforeState.entities));
  const afterIds = new Set(Object.keys(afterState.entities));

  for (const id of afterIds) {
    if (!beforeIds.has(id)) {
      differences.entities.added.push(id);
    }
  }

  for (const id of beforeIds) {
    if (!afterIds.has(id)) {
      differences.entities.removed.push(id);
    }
  }

  // Check for modified entities
  for (const entityId of beforeIds) {
    if (afterIds.has(entityId)) {
      const beforeEntity = beforeState.entities[entityId];
      const afterEntity = afterState.entities[entityId];

      const componentDiffs = compareComponents(
        beforeEntity.components,
        afterEntity.components
      );

      if (componentDiffs.hasChanges) {
        differences.entities.modified[entityId] = componentDiffs;
        differences.summary.componentChanges += componentDiffs.totalChanges;
      }
    }
  }

  // Check turn state changes
  if (
    JSON.stringify(beforeState.turnState) !==
    JSON.stringify(afterState.turnState)
  ) {
    differences.turnState.changed = true;
  }

  // Check available actions changes
  if (beforeState.availableActions && afterState.availableActions) {
    const actorIds = new Set([
      ...Object.keys(beforeState.availableActions),
      ...Object.keys(afterState.availableActions),
    ]);

    for (const actorId of actorIds) {
      const beforeActions = beforeState.availableActions[actorId] || [];
      const afterActions = afterState.availableActions[actorId] || [];

      if (JSON.stringify(beforeActions) !== JSON.stringify(afterActions)) {
        differences.availableActions.changed = true;
        differences.availableActions.differences[actorId] = {
          before: beforeActions.length,
          after: afterActions.length,
        };
      }
    }
  }

  // Update summary
  differences.summary.entityChanges =
    differences.entities.added.length +
    differences.entities.removed.length +
    Object.keys(differences.entities.modified).length;

  differences.summary.hasChanges =
    differences.summary.entityChanges > 0 ||
    differences.turnState.changed ||
    differences.availableActions.changed;

  return differences;
}

/**
 * Compares two component sets and returns differences
 *
 * @param {object} beforeComponents - Components before change
 * @param {object} afterComponents - Components after change
 * @returns {object} Component comparison results
 */
function compareComponents(beforeComponents, afterComponents) {
  const result = {
    hasChanges: false,
    added: [],
    removed: [],
    modified: {},
    totalChanges: 0,
  };

  const beforeKeys = new Set(Object.keys(beforeComponents));
  const afterKeys = new Set(Object.keys(afterComponents));

  // Check for added components
  for (const key of afterKeys) {
    if (!beforeKeys.has(key)) {
      result.added.push(key);
      result.totalChanges++;
    }
  }

  // Check for removed components
  for (const key of beforeKeys) {
    if (!afterKeys.has(key)) {
      result.removed.push(key);
      result.totalChanges++;
    }
  }

  // Check for modified components
  for (const componentId of beforeKeys) {
    if (afterKeys.has(componentId)) {
      const before = beforeComponents[componentId];
      const after = afterComponents[componentId];

      if (JSON.stringify(before) !== JSON.stringify(after)) {
        result.modified[componentId] = {
          before: deepClone(before),
          after: deepClone(after),
        };
        result.totalChanges++;
      }
    }
  }

  result.hasChanges = result.totalChanges > 0;
  return result;
}

/**
 * Validates that a state has been properly restored after a rollback
 *
 * @param {object} originalState - The original state before changes
 * @param {object} restoredState - The state after rollback
 * @returns {object} Validation results
 */
export function validateStateRestoration(originalState, restoredState) {
  const comparison = compareStates(originalState, restoredState);

  const validation = {
    isValid: !comparison.summary.hasChanges,
    errors: [],
    warnings: [],
  };

  // Check for any remaining differences
  if (comparison.entities.added.length > 0) {
    validation.errors.push(
      `Entities still exist after rollback: ${comparison.entities.added.join(', ')}`
    );
  }

  if (comparison.entities.removed.length > 0) {
    validation.errors.push(
      `Entities missing after rollback: ${comparison.entities.removed.join(', ')}`
    );
  }

  if (Object.keys(comparison.entities.modified).length > 0) {
    validation.errors.push(
      `Entities have modified components after rollback: ${Object.keys(comparison.entities.modified).join(', ')}`
    );
  }

  if (comparison.turnState.changed) {
    validation.warnings.push('Turn state differs after rollback');
  }

  if (comparison.availableActions.changed) {
    validation.warnings.push('Available actions differ after rollback');
  }

  return validation;
}

/**
 * Creates a performance monitor for state operations
 *
 * @returns {object} Performance monitor instance
 */
export function createStatePerformanceMonitor() {
  const metrics = new Map();

  return {
    startOperation(name) {
      metrics.set(name, {
        startTime: performance.now(),
        endTime: null,
        duration: null,
      });
    },

    endOperation(name) {
      const metric = metrics.get(name);
      if (metric && !metric.endTime) {
        metric.endTime = performance.now();
        metric.duration = metric.endTime - metric.startTime;
      }
    },

    getDuration(name) {
      const metric = metrics.get(name);
      return metric ? metric.duration : null;
    },

    assertPerformance(name, maxMs) {
      const duration = this.getDuration(name);
      if (duration === null) {
        throw new Error(`No metrics found for operation: ${name}`);
      }
      if (duration > maxMs) {
        throw new Error(
          `Operation '${name}' took ${duration.toFixed(2)}ms, exceeding limit of ${maxMs}ms`
        );
      }
    },

    getReport() {
      const report = {};
      for (const [name, metric] of metrics) {
        if (metric.duration !== null) {
          report[name] = {
            duration: metric.duration,
            durationMs: `${metric.duration.toFixed(2)}ms`,
          };
        }
      }
      return report;
    },

    reset() {
      metrics.clear();
    },

    destroy() {
      // Clear all metrics and ensure no references are retained
      metrics.clear();
      // Explicitly set metrics to null to break any potential circular references
      Object.defineProperty(this, 'metrics', {
        value: null,
        writable: false,
        configurable: false,
      });
    },
  };
}
