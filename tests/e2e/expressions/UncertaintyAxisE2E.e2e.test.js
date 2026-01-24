/**
 * @file UncertaintyAxisE2E.e2e.test.js
 * @description E2E tests for uncertainty mood axis integration in expressions.
 * Tests full pipeline from entity state to expression evaluation, including:
 * - Direct moodAxes.uncertainty context access
 * - Expression evaluation with uncertainty thresholds
 * - Emotion prototype uncertainty gating
 * - Temporal delta calculations with uncertainty
 * - Complex multi-axis scenarios with uncertainty
 */

import { afterEach, describe, expect, it } from '@jest/globals';
import { createE2ETestEnvironment } from '../common/e2eTestContainer.js';
import { createEntityDefinition } from '../../common/entities/entityFactories.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

// ============================================================================
// Test Helper Factories
// ============================================================================

/**
 * Create mood data with all 14 axes initialized to defaults.
 *
 * @param {object} overrides - Values to override
 * @returns {object} Complete mood data object
 */
const createMoodData = (overrides = {}) => ({
  valence: 0,
  arousal: 0,
  agency_control: 0,
  threat: 0,
  engagement: 0,
  future_expectancy: 0,
  temporal_orientation: 0,
  self_evaluation: 0,
  affiliation: 0,
  inhibitory_control: 0,
  uncertainty: 0,
  contamination_salience: 0,
  rumination: 0,
  evaluation_pressure: 0,
  ...overrides,
});

/**
 * Create sexual state data with all required fields.
 *
 * @param {object} overrides - Values to override
 * @returns {object} Complete sexual state data object
 */
const createSexualStateData = (overrides = {}) => ({
  sex_excitation: 0,
  sex_inhibition: 0,
  baseline_libido: 0,
  ...overrides,
});

/**
 * Create affect traits data with all 7 properties.
 * Default values are 50 representing "average human" baseline.
 *
 * @param {object} overrides - Values to override
 * @returns {object} Complete affect traits data object
 */
const createAffectTraitsData = (overrides = {}) => ({
  affective_empathy: 50,
  cognitive_empathy: 50,
  harm_aversion: 50,
  self_control: 50,
  disgust_sensitivity: 50,
  ruminative_tendency: 50,
  evaluation_sensitivity: 50,
  ...overrides,
});

/**
 * Create a test expression with inline prerequisites (NO external file imports).
 *
 * @param {string} id - Expression ID
 * @param {Array} prerequisites - Array of prerequisite objects with logic
 * @param {number} priority - Expression priority
 * @returns {object} Complete expression definition
 */
const createTestExpression = (id, prerequisites, priority = 100) => ({
  id,
  priority,
  prerequisites,
  description_text: `Test expression: ${id}`,
  actor_description: `Test actor description for ${id}`,
  category: 'test',
});

/**
 * Register test entity definitions in the registry.
 *
 * @param {object} registry - Data registry instance
 */
const registerTestEntityDefinitions = (registry) => {
  const locationDef = createEntityDefinition('test:location', {
    'core:name': { text: 'Test Location' },
  });
  registry.store('entityDefinitions', 'test:location', locationDef);

  const actorDef = createEntityDefinition('test:actor', {
    'core:name': { text: 'Test Actor' },
    'core:actor': {},
  });
  registry.store('entityDefinitions', 'test:actor', actorDef);
};

/**
 * Create actor and location entities for testing.
 *
 * @param {object} entityManager - Entity manager instance
 * @param {object} options - Component overrides
 * @returns {Promise<{actor: object, location: object}>}
 */
const createActorAndLocation = async (entityManager, options = {}) => {
  const {
    moodData = createMoodData(),
    sexualStateData = createSexualStateData(),
    affectTraitsData = createAffectTraitsData(),
  } = options;

  const location = await entityManager.createEntityInstance('test:location', {
    instanceId: `test-location-${Date.now()}`,
    componentOverrides: {
      'core:name': { text: 'Test Location' },
    },
  });

  const actor = await entityManager.createEntityInstance('test:actor', {
    instanceId: `test-actor-${Date.now()}`,
    componentOverrides: {
      'core:name': { text: 'Test Actor' },
      'core:position': { locationId: location.id },
      'core:actor': {},
      'core:mood': moodData,
      'core:sexual_state': sexualStateData,
      'core:affect_traits': affectTraitsData,
    },
  });

  return { actor, location };
};

/**
 * Setup test environment with expressions.
 *
 * @param {Array} expressions - Test expressions to register
 * @returns {Promise<object>} Test environment
 */
const setupExpressionEnv = async (expressions = []) => {
  const env = await createE2ETestEnvironment({
    loadMods: true,
    mods: ['core'],
    stubLLM: true,
  });

  const registry = env.container.resolve(tokens.IDataRegistry);
  registerTestEntityDefinitions(registry);

  // Register test expressions
  for (const expression of expressions) {
    registry.store('expressions', expression.id, expression);
  }

  return {
    env,
    registry,
    entityManager: env.services.entityManager,
    expressionEvaluatorService: env.container.resolve(tokens.IExpressionEvaluatorService),
    expressionContextBuilder: env.container.resolve(tokens.IExpressionContextBuilder),
    emotionCalculatorService: env.container.resolve(tokens.IEmotionCalculatorService),
  };
};

// ============================================================================
// Test Suites
// ============================================================================

describe('Uncertainty Axis E2E Tests', () => {
  let activeEnv;

  afterEach(async () => {
    if (activeEnv) {
      await activeEnv.env.cleanup();
      activeEnv = null;
    }
  });

  // ==========================================================================
  // Category 1: Direct moodAxes.uncertainty Context Access
  // ==========================================================================

  describe('Category 1: Direct moodAxes.uncertainty Context Access', () => {
    it('UNC-CTX-001: should include uncertainty in context moodAxes', async () => {
      activeEnv = await setupExpressionEnv([]);
      const { entityManager, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ uncertainty: 75 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexualStateData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexualStateData);

      expect(context.moodAxes).toBeDefined();
      expect(context.moodAxes.uncertainty).toBe(75);
    });

    it('UNC-CTX-002: should include uncertainty in previousMoodAxes when provided', async () => {
      activeEnv = await setupExpressionEnv([]);
      const { entityManager, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ uncertainty: 60 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexualStateData = await entityManager.getComponentData(actor.id, 'core:sexual_state');

      const previousState = {
        emotions: null,
        sexualStates: null,
        moodAxes: createMoodData({ uncertainty: 20 }),
      };

      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexualStateData, previousState);

      expect(context.moodAxes.uncertainty).toBe(60);
      expect(context.previousMoodAxes.uncertainty).toBe(20);
    });

    it('UNC-CTX-003: should handle extreme uncertainty values (-100, +100)', async () => {
      activeEnv = await setupExpressionEnv([]);
      const { entityManager, expressionContextBuilder } = activeEnv;

      // Test positive extreme
      const { actor: actorHigh } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ uncertainty: 100 }),
      });

      const moodDataHigh = await entityManager.getComponentData(actorHigh.id, 'core:mood');
      const sexDataHigh = await entityManager.getComponentData(actorHigh.id, 'core:sexual_state');
      const contextHigh = expressionContextBuilder.buildContext(actorHigh.id, moodDataHigh, sexDataHigh);

      expect(contextHigh.moodAxes.uncertainty).toBe(100);

      // Test negative extreme
      const { actor: actorLow } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ uncertainty: -100 }),
      });

      const moodDataLow = await entityManager.getComponentData(actorLow.id, 'core:mood');
      const sexDataLow = await entityManager.getComponentData(actorLow.id, 'core:sexual_state');
      const contextLow = expressionContextBuilder.buildContext(actorLow.id, moodDataLow, sexDataLow);

      expect(contextLow.moodAxes.uncertainty).toBe(-100);
    });
  });

  // ==========================================================================
  // Category 2: Expression Evaluation with Uncertainty Thresholds
  // ==========================================================================

  describe('Category 2: Expression Evaluation with Uncertainty Thresholds', () => {
    it('UNC-EXPR-001: should pass uncertainty >= threshold', async () => {
      const expression = createTestExpression('test:uncertainty_gte', [
        {
          logic: { '>=': [{ var: 'moodAxes.uncertainty' }, 50] },
          failure_message: 'uncertainty below threshold',
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ uncertainty: 80 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexualStateData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexualStateData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:uncertainty_gte');

      expect(testEval).toBeDefined();
      expect(testEval.passed).toBe(true);
    });

    it('UNC-EXPR-002: should pass uncertainty <= threshold (low certainty requirement)', async () => {
      const expression = createTestExpression('test:uncertainty_lte', [
        {
          logic: { '<=': [{ var: 'moodAxes.uncertainty' }, 0] },
          failure_message: 'uncertainty above threshold (too uncertain)',
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ uncertainty: -50 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexualStateData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexualStateData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:uncertainty_lte');

      expect(testEval).toBeDefined();
      expect(testEval.passed).toBe(true);
    });

    it('UNC-EXPR-003: should fail uncertainty threshold when not met', async () => {
      const expression = createTestExpression('test:uncertainty_fail', [
        {
          logic: { '>=': [{ var: 'moodAxes.uncertainty' }, 70] },
          failure_message: 'uncertainty below threshold',
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ uncertainty: 30 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexualStateData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexualStateData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:uncertainty_fail');

      expect(testEval).toBeDefined();
      expect(testEval.passed).toBe(false);
    });

    it('UNC-EXPR-004: should handle exact threshold boundary (>= 50 with value 50)', async () => {
      const expression = createTestExpression('test:uncertainty_boundary', [
        {
          logic: { '>=': [{ var: 'moodAxes.uncertainty' }, 50] },
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ uncertainty: 50 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexualStateData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexualStateData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:uncertainty_boundary');

      expect(testEval?.passed).toBe(true);
    });
  });

  // ==========================================================================
  // Category 3: Emotion Prototype Uncertainty Gating
  // ==========================================================================

  describe('Category 3: Emotion Prototype Uncertainty Gating', () => {
    it('UNC-EMO-001: should reflect uncertainty in emotion calculations (confusion)', async () => {
      activeEnv = await setupExpressionEnv([]);
      const { entityManager, expressionContextBuilder, emotionCalculatorService } = activeEnv;

      // High uncertainty should boost confusion-related emotions
      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ uncertainty: 80, arousal: 30 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexualStateData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexualStateData);

      // Verify confusion emotion is calculated (presence of uncertainty influence)
      expect(context.emotions).toBeDefined();
      expect(typeof context.emotions.confusion).toBe('number');

      // Get emotion prototype keys to verify confusion exists
      const emotionKeys = emotionCalculatorService.getEmotionPrototypeKeys();
      expect(emotionKeys).toContain('confusion');
    });

    it('UNC-EMO-002: should reflect low uncertainty in confidence-related emotions', async () => {
      activeEnv = await setupExpressionEnv([]);
      const { entityManager, expressionContextBuilder, emotionCalculatorService } = activeEnv;

      // Low uncertainty (high certainty) should boost confidence
      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ uncertainty: -70, self_evaluation: 50, agency_control: 50 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexualStateData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexualStateData);

      expect(context.emotions).toBeDefined();
      expect(typeof context.emotions.confidence).toBe('number');

      const emotionKeys = emotionCalculatorService.getEmotionPrototypeKeys();
      expect(emotionKeys).toContain('confidence');
    });

    it('UNC-EMO-003: should gate emotions when uncertainty threshold not met', async () => {
      // Test expression that requires a specific emotion level gated by uncertainty
      const expression = createTestExpression('test:uncertainty_gated_emotion', [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.uncertainty' }, 30] },
              { '>=': [{ var: 'emotions.confusion' }, 0.1] },
            ],
          },
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      // With low uncertainty, confusion should be gated
      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ uncertainty: -50, arousal: 30 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexualStateData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexualStateData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:uncertainty_gated_emotion');

      // Should fail because uncertainty < 30
      expect(testEval?.passed).toBe(false);
    });
  });

  // ==========================================================================
  // Category 4: Temporal Delta Calculations with Uncertainty
  // ==========================================================================

  describe('Category 4: Temporal Delta Calculations with Uncertainty', () => {
    it('UNC-DELTA-001: should detect uncertainty increase (current - previous >= threshold)', async () => {
      const expression = createTestExpression('test:uncertainty_increase', [
        {
          logic: {
            '>=': [
              { '-': [{ var: 'moodAxes.uncertainty' }, { var: 'previousMoodAxes.uncertainty' }] },
              30,
            ],
          },
          failure_message: 'uncertainty did not increase enough',
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ uncertainty: 60 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');

      const previousState = {
        emotions: null,
        sexualStates: null,
        moodAxes: createMoodData({ uncertainty: 20 }),
      };

      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData, previousState);

      // Delta: 60 - 20 = 40 >= 30, should pass
      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:uncertainty_increase');

      expect(testEval?.passed).toBe(true);
    });

    it('UNC-DELTA-002: should detect uncertainty decrease (current - previous <= -threshold)', async () => {
      const expression = createTestExpression('test:uncertainty_decrease', [
        {
          logic: {
            '<=': [
              { '-': [{ var: 'moodAxes.uncertainty' }, { var: 'previousMoodAxes.uncertainty' }] },
              -25,
            ],
          },
          failure_message: 'uncertainty did not decrease enough',
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ uncertainty: 10 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');

      const previousState = {
        emotions: null,
        sexualStates: null,
        moodAxes: createMoodData({ uncertainty: 50 }),
      };

      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData, previousState);

      // Delta: 10 - 50 = -40 <= -25, should pass
      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:uncertainty_decrease');

      expect(testEval?.passed).toBe(true);
    });

    it('UNC-DELTA-003: should detect transition from certain to uncertain', async () => {
      const expression = createTestExpression('test:uncertainty_transition', [
        {
          logic: {
            and: [
              { '<': [{ var: 'previousMoodAxes.uncertainty' }, 0] }, // Was certain (negative)
              { '>=': [{ var: 'moodAxes.uncertainty' }, 30] }, // Now uncertain (positive high)
            ],
          },
          failure_message: 'no transition from certain to uncertain',
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ uncertainty: 50 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');

      const previousState = {
        emotions: null,
        sexualStates: null,
        moodAxes: createMoodData({ uncertainty: -40 }),
      };

      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData, previousState);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:uncertainty_transition');

      expect(testEval?.passed).toBe(true);
    });
  });

  // ==========================================================================
  // Category 5: Complex Multi-Axis Scenarios with Uncertainty
  // ==========================================================================

  describe('Category 5: Complex Multi-Axis Scenarios with Uncertainty', () => {
    it('UNC-COMPLEX-001: should evaluate multi-prerequisite combining uncertainty with other axes', async () => {
      const expression = createTestExpression('test:uncertainty_multi_axis', [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.uncertainty' }, 40] },
              { '>=': [{ var: 'moodAxes.arousal' }, 30] },
              { '<=': [{ var: 'moodAxes.agency_control' }, 20] },
            ],
          },
          failure_message: 'baseline conditions not met',
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({
          uncertainty: 60,
          arousal: 50,
          agency_control: 10,
        }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:uncertainty_multi_axis');

      expect(testEval?.passed).toBe(true);
    });

    it('UNC-COMPLEX-002: should evaluate nested AND/OR with uncertainty', async () => {
      const expression = createTestExpression('test:uncertainty_nested', [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.engagement' }, 20] },
              {
                or: [
                  { '>=': [{ var: 'moodAxes.uncertainty' }, 50] },
                  { '<=': [{ var: 'moodAxes.threat' }, -30] },
                ],
              },
            ],
          },
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      // High uncertainty path (first OR branch)
      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({
          engagement: 40,
          uncertainty: 70,
          threat: 0,
        }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:uncertainty_nested');

      expect(testEval?.passed).toBe(true);
    });

    it('UNC-COMPLEX-003: should evaluate uncertainty with temporal delta AND current threshold', async () => {
      const expression = createTestExpression('test:uncertainty_delta_threshold', [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.uncertainty' }, 40] }, // Current threshold
              {
                '>=': [
                  { '-': [{ var: 'moodAxes.uncertainty' }, { var: 'previousMoodAxes.uncertainty' }] },
                  15,
                ],
              }, // Delta threshold
            ],
          },
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ uncertainty: 60 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');

      const previousState = {
        emotions: null,
        sexualStates: null,
        moodAxes: createMoodData({ uncertainty: 40 }),
      };

      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData, previousState);

      // uncertainty: 60 >= 40, delta: 60 - 40 = 20 >= 15
      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:uncertainty_delta_threshold');

      expect(testEval?.passed).toBe(true);
    });

    it('UNC-COMPLEX-004: should handle real-world anxious_uncertainty pattern', async () => {
      // Pattern: high uncertainty + high threat + moderate arousal
      const expression = createTestExpression('test:anxious_uncertainty', [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.uncertainty' }, 50] },
              { '>=': [{ var: 'moodAxes.threat' }, 40] },
              { '>=': [{ var: 'moodAxes.arousal' }, 30] },
            ],
          },
          failure_message: 'anxiety conditions not met',
        },
        {
          logic: {
            or: [
              {
                '>=': [
                  { '-': [{ var: 'moodAxes.uncertainty' }, { var: 'previousMoodAxes.uncertainty' }] },
                  20,
                ],
              },
              {
                '>=': [
                  { '-': [{ var: 'moodAxes.threat' }, { var: 'previousMoodAxes.threat' }] },
                  20,
                ],
              },
            ],
          },
          failure_message: 'no recent escalation detected',
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({
          uncertainty: 70,
          threat: 60,
          arousal: 50,
        }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');

      const previousState = {
        emotions: null,
        sexualStates: null,
        moodAxes: createMoodData({
          uncertainty: 40,
          threat: 30,
          arousal: 40,
        }),
      };

      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData, previousState);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:anxious_uncertainty');

      expect(testEval?.passed).toBe(true);
      expect(testEval?.prerequisites).toHaveLength(2);
      expect(testEval?.prerequisites.every((p) => p.status === 'passed')).toBe(true);
    });
  });

  // ==========================================================================
  // Category 6: Edge Cases
  // ==========================================================================

  describe('Category 6: Edge Cases', () => {
    it('UNC-EDGE-001: should handle zero uncertainty (neutral state)', async () => {
      const expression = createTestExpression('test:uncertainty_zero', [
        {
          logic: { '==': [{ var: 'moodAxes.uncertainty' }, 0] },
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ uncertainty: 0 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:uncertainty_zero');

      expect(testEval?.passed).toBe(true);
    });

    it('UNC-EDGE-002: should initialize previousMoodAxes.uncertainty to zero when null', async () => {
      activeEnv = await setupExpressionEnv([]);
      const { entityManager, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ uncertainty: 50 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');

      // Pass null previousState - should initialize to zeros
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData, null);

      expect(context.previousMoodAxes.uncertainty).toBe(0);
    });

    it('UNC-EDGE-003: should handle delta calculation with zero previous value', async () => {
      const expression = createTestExpression('test:uncertainty_delta_from_zero', [
        {
          logic: {
            '>=': [
              { '-': [{ var: 'moodAxes.uncertainty' }, { var: 'previousMoodAxes.uncertainty' }] },
              50,
            ],
          },
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ uncertainty: 60 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');

      // No previous state - should use zeros
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData, null);

      // Delta: 60 - 0 = 60 >= 50
      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:uncertainty_delta_from_zero');

      expect(testEval?.passed).toBe(true);
    });
  });
});
