/**
 * @file Event test helpers for multi-target action testing
 * @description Provides utilities for creating valid legacy and multi-target events
 * for testing performance and validation scenarios.
 */

/**
 * Creates a valid legacy attempt_action event for testing
 *
 * @param {object} overrides - Property overrides
 * @returns {object} Valid legacy event
 */
export function createValidLegacyEvent(overrides = {}) {
  return {
    eventName: 'core:attempt_action',
    actorId: 'test_actor_123',
    actionId: 'core:action',
    targetId: 'test_target_456',
    originalInput: 'perform test action',
    timestamp: Date.now(),
    ...overrides,
  };
}

/**
 * Creates a valid multi-target attempt_action event for testing
 *
 * @param {object} targets - Target definitions
 * @param {object} overrides - Property overrides  
 * @returns {object} Valid multi-target event
 */
export function createValidMultiTargetEvent(targets = {}, overrides = {}) {
  const defaultTargets = {
    primary: 'test_primary_789',
    ...targets,
  };
  
  // Determine primary target for targetId (backward compatibility)
  const primaryTarget = targets.primary || targets.target || targets.item || Object.values(targets)[0] || 'test_target_456';

  return {
    eventName: 'core:attempt_action',
    actorId: 'test_actor_123', 
    actionId: 'core:action',
    targets: defaultTargets,
    targetId: primaryTarget,
    originalInput: 'perform multi-target test action',
    timestamp: Date.now(),
    ...overrides,
  };
}

/**
 * Creates a complex multi-target event with multiple targets for stress testing
 *
 * @param {number} targetCount - Number of targets to create
 * @param {object} overrides - Property overrides
 * @returns {object} Complex multi-target event
 */
export function createComplexMultiTargetEvent(targetCount = 8, overrides = {}) {
  const targets = {};
  for (let i = 1; i <= targetCount; i++) {
    targets[`target_${i}`] = `entity_${i}`;
  }
  
  return createValidMultiTargetEvent(targets, overrides);
}

/**
 * Creates a batch of diverse events for testing
 *
 * @param {number} count - Number of events to create
 * @param {object} options - Configuration options
 * @param {number} [options.legacyRatio] - Ratio of legacy events (0-1)
 * @param {number} [options.maxTargets] - Maximum targets for multi-target events
 * @returns {Array<object>} Array of diverse events
 */
export function createEventBatch(count = 100, options = {}) {
  const { legacyRatio = 0.3, maxTargets = 8 } = options;
  const events = [];
  
  for (let i = 0; i < count; i++) {
    const isLegacy = Math.random() < legacyRatio;
    
    if (isLegacy) {
      events.push(createValidLegacyEvent({ 
        actorId: `actor_${i}`,
        targetId: `target_${i}`,
        originalInput: `legacy action ${i}`,
      }));
    } else {
      const targetCount = Math.floor(Math.random() * maxTargets) + 1;
      const targets = {};
      
      for (let j = 1; j <= targetCount; j++) {
        targets[`target_${j}`] = `entity_${i}_${j}`;
      }
      
      events.push(createValidMultiTargetEvent(targets, {
        actorId: `actor_${i}`,
        originalInput: `multi-target action ${i}`,
      }));
    }
  }
  
  return events;
}

/**
 * Creates events with specific performance characteristics for testing
 *
 * @param {string} type - Event type: 'simple', 'complex', 'mixed'
 * @param {number} count - Number of events to create
 * @returns {Array<object>} Events optimized for performance testing
 */
export function createPerformanceTestEvents(type = 'mixed', count = 1000) {
  const events = [];
  
  switch (type) {
    case 'simple':
      // Simple legacy events for baseline performance
      for (let i = 0; i < count; i++) {
        events.push(createValidLegacyEvent({
          actorId: `perf_actor_${i}`,
          targetId: `perf_target_${i}`,
          originalInput: `simple action ${i}`,
        }));
      }
      break;
      
    case 'complex':
      // Complex multi-target events for stress testing
      for (let i = 0; i < count; i++) {
        events.push(createComplexMultiTargetEvent(8, {
          actorId: `perf_actor_${i}`,
          originalInput: `complex action ${i}`,
        }));
      }
      break;
      
    case 'mixed':
    default:
      // Mixed events for realistic testing
      events.push(...createEventBatch(count));
      break;
  }
  
  return events;
}