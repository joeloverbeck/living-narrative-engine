/**
 * @file Test fixtures for Pipeline Tracing Integration E2E tests
 * Provides test data, mock actions, and scenarios for comprehensive pipeline tracing testing
 */

import { expect } from '@jest/globals';

/**
 * Pipeline-specific test actions that should be traced
 */
export const PIPELINE_TEST_ACTIONS = {
  // Simple movement action for basic pipeline tracing
  SIMPLE_MOVEMENT: {
    id: 'core:go',
    name: 'Go',
    type: 'movement',
    targets: ['direction'],
    prerequisites: ['can_move', 'has_position'],
  },
  
  // Complex action with multiple components for detailed tracing
  COMPLEX_INTERACTION: {
    id: 'core:interact',
    name: 'Interact',
    type: 'interaction',
    targets: ['target_entity'],
    prerequisites: ['has_position', 'within_range', 'can_interact'],
  },
  
  // Action that typically fails for error testing
  INVALID_ACTION: {
    id: 'test:invalid',
    name: 'Invalid Action',
    type: 'invalid',
    malformed: true,
  },
  
  // Multi-target action for complex pipeline testing
  MULTI_TARGET_ACTION: {
    id: 'core:examine_area',
    name: 'Examine Area',
    type: 'observation',
    targets: ['nearby_items', 'adjacent_actors', 'accessible_exits'],
    prerequisites: ['has_perception'],
    multiTarget: true,
  },
  
  // Legacy format action for compatibility testing
  LEGACY_ACTION: {
    id: 'legacy:old_format',
    name: 'Legacy Action',
    format: 'legacy_v1',
    conversionRequired: true,
  },
};

/**
 * Test actors with different pipeline complexity configurations
 */
export const PIPELINE_TEST_ACTORS = {
  BASIC_PLAYER: {
    id: 'test-player-basic',
    name: 'Basic Test Player',
    components: {
      'core:position': {
        x: 0,
        y: 0,
        z: 0,
        location: 'test-room',
      },
      'core:movement': {
        speed: 1.0,
        canMove: true,
      },
      'core:stats': {
        health: 100,
        mana: 50,
        stamina: 75,
      },
    },
  },
  
  COMPLEX_ACTOR: {
    id: 'test-actor-complex',
    name: 'Complex Test Actor',
    components: {
      'core:position': {
        x: 10,
        y: 5,
        z: 0,
        location: 'complex-room',
        facing: 'north',
      },
      'core:movement': {
        speed: 2.0,
        canMove: true,
        restrictions: ['no-water', 'no-air'],
      },
      'core:stats': {
        health: 150,
        mana: 100,
        stamina: 120,
        attributes: {
          strength: 15,
          dexterity: 12,
          intelligence: 18,
        },
      },
      'core:inventory': {
        items: [
          { id: 'sword-1', type: 'weapon', equipped: true },
          { id: 'potion-1', type: 'consumable', quantity: 5 },
          { id: 'scroll-1', type: 'magic', uses: 3 },
        ],
        maxWeight: 100,
        currentWeight: 35,
      },
      'core:combat': {
        attackPower: 20,
        defense: 15,
        accuracy: 0.85,
      },
      'core:perception': {
        sightRange: 10,
        hearingRange: 8,
        detectHidden: 0.3,
      },
      'core:skills': {
        lockpicking: 5,
        stealth: 7,
        negotiation: 8,
      },
    },
  },
  
  MINIMAL_ACTOR: {
    id: 'test-actor-minimal',
    name: 'Minimal Actor',
    components: {
      'core:stats': {
        health: 50,
      },
    },
  },
  
  MULTI_COMPONENT_ACTOR: {
    id: 'test-actor-multi',
    name: 'Multi-Component Actor',
    components: {
      'core:position': { x: 0, y: 0, z: 0 },
      'core:movement': { speed: 1.5, canMove: true },
      'core:stats': { health: 100, mana: 100 },
      'core:inventory': { items: [], maxWeight: 50 },
      'core:combat': { attackPower: 10, defense: 10 },
      'core:perception': { sightRange: 5 },
      'core:social': { charisma: 12, reputation: 'neutral' },
      'core:magic': { spellSlots: 3, magicResistance: 0.2 },
    },
  },
};

/**
 * Pipeline test scenarios for load and performance testing
 */
export const PIPELINE_SCENARIOS = {
  HIGH_LOAD_ACTIONS: [
    {
      id: 'perf:action-1',
      name: 'Performance Action 1',
      type: 'movement',
      complexity: 'low',
    },
    {
      id: 'perf:action-2',
      name: 'Performance Action 2',
      type: 'interaction',
      complexity: 'medium',
      multiTarget: true,
    },
    {
      id: 'perf:action-3',
      name: 'Performance Action 3',
      type: 'complex',
      complexity: 'high',
      dependencies: ['action-1', 'action-2'],
    },
    {
      id: 'perf:action-4',
      name: 'Performance Action 4',
      type: 'magic',
      complexity: 'high',
      prerequisites: ['has_mana', 'spell_known'],
    },
    {
      id: 'perf:action-5',
      name: 'Performance Action 5',
      type: 'combat',
      complexity: 'medium',
      targets: ['enemy_actors'],
    },
  ],
  
  MULTI_TARGET_SCENARIOS: [
    {
      targetType: 'inventory_items',
      scopeQuery: 'actor.inventory.items[{"var": "type"}, "weapon"]',
      expectedCount: 1,
    },
    {
      targetType: 'location_exits',
      scopeQuery: 'location.exits[{"var": "accessible"}, true]',
      expectedCount: 2,
    },
    {
      targetType: 'nearby_actors',
      scopeQuery: 'location.actors[{"var": "distance"}, {"<": [{"var": ""}, 5]}]',
      expectedCount: 1,
    },
  ],
  
  LEGACY_SCENARIOS: [
    {
      format: 'legacy_v1',
      conversionStrategy: 'automatic',
      expectedSuccess: true,
    },
    {
      format: 'legacy_v2',
      conversionStrategy: 'manual_mapping',
      expectedSuccess: true,
    },
    {
      format: 'unsupported_legacy',
      conversionStrategy: 'fallback',
      expectedSuccess: false,
    },
  ],
};

/**
 * Performance thresholds for pipeline stage validation
 */
export const PERFORMANCE_THRESHOLDS = {
  // Individual stage thresholds (ms)
  COMPONENT_FILTERING: 100,
  PREREQUISITE_EVALUATION: 200,
  MULTI_TARGET_RESOLUTION: 500,
  ACTION_FORMATTING: 150,
  TARGET_RESOLUTION: 300,
  SCOPE_EVALUATION: 250,
  
  // Overall pipeline thresholds (ms)
  PIPELINE_TOTAL: 1000,
  STAGE_OVERHEAD: 50,
  CAPTURE_OVERHEAD: 1,
  
  // Memory thresholds
  MAX_MEMORY_MB: 150,
  MEMORY_GROWTH_LIMIT_MB: 10,
  MEMORY_GROWTH_LIMIT_PERCENT: 50, // Maximum 50% growth allowed
  
  // Performance analysis thresholds
  ACCEPTABLE_SLOWDOWN_PERCENT: 10,
  CRITICAL_SLOWDOWN_PERCENT: 25,
};

/**
 * Expected trace data structures for validation
 */
export const EXPECTED_TRACE_STRUCTURES = {
  PIPELINE_TRACE: {
    type: 'pipeline',
    actionId: expect.any(String),
    timestamp: expect.any(Number),
    stages: expect.objectContaining({
      component_filtering: expect.objectContaining({
        timestamp: expect.any(Number),
        data: expect.objectContaining({
          filteredComponents: expect.any(Array),
          componentCount: expect.any(Number),
          filterCriteria: expect.any(String),
        }),
        stageCompletedAt: expect.any(Number),
      }),
      prerequisite_evaluation: expect.objectContaining({
        timestamp: expect.any(Number),
        data: expect.objectContaining({
          evaluatedPrerequisites: expect.any(Array),
          passedCount: expect.any(Number),
          failedCount: expect.any(Number),
        }),
        stageCompletedAt: expect.any(Number),
      }),
      target_resolution: expect.objectContaining({
        timestamp: expect.any(Number),
        data: expect.objectContaining({
          resolvedTargets: expect.any(Array),
          targetCount: expect.any(Number),
          resolutionMethod: expect.any(String),
        }),
        stageCompletedAt: expect.any(Number),
      }),
      action_formatting: expect.objectContaining({
        timestamp: expect.any(Number),
        data: expect.objectContaining({
          formattedActions: expect.any(Array),
          formatType: expect.any(String),
          formattedCount: expect.any(Number),
        }),
        stageCompletedAt: expect.any(Number),
      }),
    }),
  },
  
  SCOPE_EVALUATION_TRACE: {
    type: 'scope_evaluation',
    scopeQueries: expect.any(Array),
    resolvedEntities: expect.any(Array),
    evaluationMetrics: expect.objectContaining({
      queryTime: expect.any(Number),
      entityCount: expect.any(Number),
    }),
  },
  
  DEPENDENCY_RESOLUTION_TRACE: {
    type: 'dependency_resolution',
    dependencies: expect.any(Array),
    resolutionOrder: expect.any(Array),
    circularDependencyCheck: expect.any(String),
  },
  
  LEGACY_DETECTION_TRACE: {
    type: 'legacy_detection',
    detectedFormat: expect.any(String),
    conversionStrategy: expect.any(String),
  },
  
  COMPATIBILITY_LAYER_TRACE: {
    type: 'compatibility_layer',
    originalAction: expect.any(Object),
    convertedAction: expect.any(Object),
    conversionSteps: expect.any(Array),
  },
  
  PERFORMANCE_TRACE: {
    type: 'performance',
    totalDuration: expect.any(Number),
    stageBreakdown: expect.any(Object),
    captureOverhead: expect.any(Number),
  },
};

/**
 * Create a pipeline test action with specified configuration
 *
 * @param {object} config - Action configuration
 * @returns {object} Test action
 */
export function createPipelineTestAction(config = {}) {
  const baseAction = {
    id: config.id || `test:pipeline-action-${Date.now()}`,
    name: config.name || 'Test Pipeline Action',
    type: config.type || 'test',
    targets: config.targets || ['default_target'],
    prerequisites: config.prerequisites || ['can_act'],
    complexity: config.complexity || 'medium',
    artificialDelay: config.artificialDelay || 0,
    stage: config.stage || null,
  };

  // Add complexity-based features
  if (config.complexity === 'high') {
    baseAction.multiTarget = config.includeMultiTarget !== false;
    baseAction.dependencies = config.dependencies || ['dependency1'];
    baseAction.advancedFeatures = true;
  }

  // Add legacy components if requested
  if (config.includeLegacyComponents) {
    baseAction.legacyFormat = 'mixed';
    baseAction.requiresConversion = true;
  }

  return baseAction;
}

/**
 * Create a multi-target action for complex pipeline testing
 *
 * @param {object} config - Multi-target action configuration
 * @returns {object} Multi-target test action
 */
export function createMultiTargetAction(config = {}) {
  return {
    id: config.id || `test:multi-target-${Date.now()}`,
    name: config.name || 'Multi-Target Test Action',
    type: 'multi_target',
    targets: config.targets || ['target1', 'target2'],
    multiTarget: true,
    scopeComplexity: config.scopeComplexity || 'medium',
    dependencies: config.dependencies || [],
    parallelResolution: config.parallelResolution !== false,
    targetGroups: config.targetGroups || ['group1', 'group2'],
  };
}

/**
 * Create a legacy test action for compatibility testing
 *
 * @param {object} config - Legacy action configuration
 * @returns {object} Legacy test action
 */
export function createLegacyTestAction(config = {}) {
  return {
    id: config.id || `legacy:test-action-${Date.now()}`,
    name: config.name || 'Legacy Test Action',
    format: config.format || 'legacy_v1',
    conversionRequired: config.conversionRequired !== false,
    malformed: config.malformed || false,
    type: 'legacy',
    originalFormat: config.format,
    supportedConversion: !config.malformed,
  };
}

/**
 * Generate load test actions for performance scenarios
 *
 * @param {number} count - Number of actions to generate
 * @param {object} baseConfig - Base configuration for actions
 * @returns {Array} Array of load test actions
 */
export function generateLoadTestActions(count = 10, baseConfig = {}) {
  const actions = [];
  
  for (let i = 0; i < count; i++) {
    const action = createPipelineTestAction({
      id: `load:test-action-${i}`,
      name: `Load Test Action ${i + 1}`,
      complexity: i % 3 === 0 ? 'high' : 'medium',
      type: ['movement', 'interaction', 'observation', 'combat'][i % 4],
      ...baseConfig,
    });
    actions.push(action);
  }
  
  return actions;
}

/**
 * Validate trace data structure against expected patterns
 *
 * @param {object} trace - Trace data to validate
 * @param {string} traceType - Expected trace type
 * @returns {boolean} Validation result
 */
export function validateTraceStructure(trace, traceType) {
  const expectedStructure = EXPECTED_TRACE_STRUCTURES[traceType];
  if (!expectedStructure) {
    throw new Error(`Unknown trace type: ${traceType}`);
  }

  try {
    expect(trace).toMatchObject(expectedStructure);
    return true;
  } catch {
    // console.error(`Trace validation failed for ${traceType}:`, error);
    return false;
  }
}

/**
 * Create performance test scenario configurations
 *
 * @returns {object} Performance test scenarios
 */
export function createPerformanceTestScenarios() {
  return {
    lightLoad: {
      actionCount: 5,
      complexity: 'low',
      parallelism: false,
    },
    mediumLoad: {
      actionCount: 15,
      complexity: 'medium',
      parallelism: true,
    },
    heavyLoad: {
      actionCount: 30,
      complexity: 'high',
      parallelism: true,
      enableAllFeatures: true,
    },
  };
}

/**
 * Mock stage processing configurations
 */
export const STAGE_PROCESSING_CONFIGS = {
  component_filtering: {
    processingTime: 25,
    outputSize: 'medium',
    complexity: 'low',
  },
  prerequisite_evaluation: {
    processingTime: 50,
    outputSize: 'small',
    complexity: 'medium',
  },
  target_resolution: {
    processingTime: 75,
    outputSize: 'large',
    complexity: 'high',
  },
  multi_target_resolution: {
    processingTime: 150,
    outputSize: 'large',
    complexity: 'high',
  },
  action_formatting: {
    processingTime: 30,
    outputSize: 'medium',
    complexity: 'low',
  },
};

export default {
  PIPELINE_TEST_ACTIONS,
  PIPELINE_TEST_ACTORS,
  PIPELINE_SCENARIOS,
  PERFORMANCE_THRESHOLDS,
  EXPECTED_TRACE_STRUCTURES,
  createPipelineTestAction,
  createMultiTargetAction,
  createLegacyTestAction,
  generateLoadTestActions,
  validateTraceStructure,
  createPerformanceTestScenarios,
  STAGE_PROCESSING_CONFIGS,
};