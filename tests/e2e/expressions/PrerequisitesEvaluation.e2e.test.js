/**
 * @file PrerequisitesEvaluation.e2e.test.js
 * @description Comprehensive E2E tests for expression prerequisites evaluation.
 * Tests context variable access, threshold operators, logical combinators, delta calculations,
 * and complex real-world scenarios.
 */

import { afterEach, describe, expect, it } from '@jest/globals';
import { createE2ETestEnvironment } from '../common/e2eTestContainer.js';
import { createEntityDefinition } from '../../common/entities/entityFactories.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';

// ============================================================================
// Test Helper Factories
// ============================================================================

/**
 * Create mood data with all 11 axes initialized to defaults.
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
  ...overrides,
});

/**
 * Create sexual state data with all required fields.
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
 * Create affect traits data with all 4 properties.
 * Default values are 50 representing "average human" baseline.
 * @param {object} overrides - Values to override
 * @returns {object} Complete affect traits data object
 */
const createAffectTraitsData = (overrides = {}) => ({
  affective_empathy: 50,
  cognitive_empathy: 50,
  harm_aversion: 50,
  self_control: 50,
  ...overrides,
});

/**
 * Create a test expression with inline prerequisites (NO external file imports).
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

describe('Expression Prerequisites Evaluation E2E', () => {
  let activeEnv;

  afterEach(async () => {
    if (activeEnv) {
      await activeEnv.env.cleanup();
      activeEnv = null;
    }
  });

  // ==========================================================================
  // Category 1: Basic Context Variable Access (CTX-001 to CTX-008)
  // ==========================================================================

  describe('Category 1: Basic Context Variable Access', () => {
    it('CTX-001: should access emotions.frustration threshold check', async () => {
      const expression = createTestExpression('test:emotions_frustration', [
        {
          logic: { '>=': [{ var: 'emotions.frustration' }, 0.5] },
          failure_message: 'frustration below threshold',
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } =
        activeEnv;

      // Create actor with high frustration-inducing mood state
      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({
          valence: -50,
          arousal: 60,
          agency_control: -40,
        }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexualStateData = await entityManager.getComponentData(actor.id, 'core:sexual_state');

      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexualStateData);

      // Verify context has emotions
      expect(context.emotions).toBeDefined();
      expect(typeof context.emotions.frustration).toBe('number');

      // Evaluate all to get diagnostics
      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);

      // The expression should be evaluated (passed or failed based on emotion value)
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:emotions_frustration');
      expect(testEval).toBeDefined();
    });

    it('CTX-002: should access moodAxes.arousal threshold check', async () => {
      const expression = createTestExpression('test:moodAxes_arousal', [
        {
          logic: { '>=': [{ var: 'moodAxes.arousal' }, 20] },
          failure_message: 'arousal below threshold',
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ arousal: 50 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexualStateData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexualStateData);

      expect(context.moodAxes.arousal).toBe(50);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:moodAxes_arousal');
      expect(testEval?.passed).toBe(true);
    });

    it('CTX-003: should access sexualStates values', async () => {
      const expression = createTestExpression('test:sexualStates_access', [
        { logic: { '==': [1, 1] } }, // Always true - just verify context access
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        sexualStateData: createSexualStateData({
          sex_excitation: 40,
          sex_inhibition: 10,
        }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexualStateData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexualStateData);

      expect(context.sexualStates).toBeDefined();
      expect(typeof context.sexualStates).toBe('object');
    });

    it('CTX-004: should access sexualArousal scalar', async () => {
      const expression = createTestExpression('test:sexualArousal_scalar', [
        {
          logic: { '>=': [{ var: 'sexualArousal' }, 0.3] },
          failure_message: 'sexualArousal below threshold',
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        sexualStateData: createSexualStateData({
          sex_excitation: 60,
          sex_inhibition: 10,
          baseline_libido: 20,
        }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexualStateData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexualStateData);

      expect(typeof context.sexualArousal).toBe('number');
    });

    it('CTX-005: should access affectTraits.self_control (BUG TEST)', async () => {
      // This test documents the expected behavior once affectTraits is fixed
      const expression = createTestExpression('test:affectTraits_self_control', [
        {
          logic: { '<=': [{ var: 'affectTraits.self_control' }, 45] },
          failure_message: 'self_control above threshold',
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        affectTraitsData: createAffectTraitsData({ self_control: 30 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexualStateData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexualStateData);

      // Verify affectTraits is included in context
      expect(context.affectTraits).toBeDefined();
      expect(context.affectTraits.self_control).toBe(30);

      // Verify expression evaluation passes
      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:affectTraits_self_control');
      expect(testEval?.passed).toBe(true);
    });

    it('CTX-006: should access previousEmotions values', async () => {
      const expression = createTestExpression('test:previousEmotions', [
        {
          logic: { '<': [{ var: 'previousEmotions.frustration' }, 0.8] },
          failure_message: 'previousEmotions check failed',
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionContextBuilder, emotionCalculatorService } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager);

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexualStateData = await entityManager.getComponentData(actor.id, 'core:sexual_state');

      // Get emotion keys from service
      const emotionKeys = emotionCalculatorService.getEmotionPrototypeKeys();
      const previousEmotions = {};
      for (const key of emotionKeys) {
        previousEmotions[key] = 0.2;
      }

      const previousState = {
        emotions: previousEmotions,
        sexualStates: null,
        moodAxes: null,
      };

      const context = expressionContextBuilder.buildContext(
        actor.id,
        moodData,
        sexualStateData,
        previousState
      );

      expect(context.previousEmotions).toBeDefined();
      expect(typeof context.previousEmotions.frustration).toBe('number');
    });

    it('CTX-007: should access previousMoodAxes values', async () => {
      const expression = createTestExpression('test:previousMoodAxes', [
        {
          logic: {
            '>=': [
              { '-': [{ var: 'moodAxes.arousal' }, { var: 'previousMoodAxes.arousal' }] },
              10,
            ],
          },
          failure_message: 'arousal increase check failed',
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ arousal: 60 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexualStateData = await entityManager.getComponentData(actor.id, 'core:sexual_state');

      const previousState = {
        emotions: null,
        sexualStates: null,
        moodAxes: createMoodData({ arousal: 40 }),
      };

      const context = expressionContextBuilder.buildContext(
        actor.id,
        moodData,
        sexualStateData,
        previousState
      );

      expect(context.previousMoodAxes.arousal).toBe(40);
      expect(context.moodAxes.arousal).toBe(60);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:previousMoodAxes');
      expect(testEval?.passed).toBe(true);
    });

    it('CTX-008: should initialize previousEmotions to zero when null', async () => {
      activeEnv = await setupExpressionEnv([]);
      const { entityManager, expressionContextBuilder, emotionCalculatorService } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager);

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexualStateData = await entityManager.getComponentData(actor.id, 'core:sexual_state');

      // Pass null previousState - should initialize to zeros
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexualStateData, null);

      const emotionKeys = emotionCalculatorService.getEmotionPrototypeKeys();
      for (const key of emotionKeys) {
        expect(context.previousEmotions[key]).toBe(0);
      }
    });
  });

  // ==========================================================================
  // Category 2: Threshold Operators (OPR-001 to OPR-006)
  // ==========================================================================

  describe('Category 2: Threshold Operators', () => {
    it('OPR-001: should evaluate >= (greater than or equal) correctly', async () => {
      const expression = createTestExpression('test:gte_operator', [
        { logic: { '>=': [{ var: 'moodAxes.valence' }, 50] } },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      // Test at threshold - should pass
      const { actor: actorAtThreshold } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ valence: 50 }),
      });

      const moodData1 = await entityManager.getComponentData(actorAtThreshold.id, 'core:mood');
      const sexData1 = await entityManager.getComponentData(actorAtThreshold.id, 'core:sexual_state');
      const context1 = expressionContextBuilder.buildContext(actorAtThreshold.id, moodData1, sexData1);

      const result1 = expressionEvaluatorService.evaluateAllWithDiagnostics(context1);
      const eval1 = result1.evaluations.find((e) => e.expression.id === 'test:gte_operator');
      expect(eval1?.passed).toBe(true);
    });

    it('OPR-002: should evaluate <= (less than or equal) correctly', async () => {
      const expression = createTestExpression('test:lte_operator', [
        { logic: { '<=': [{ var: 'moodAxes.agency_control' }, 10] } },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ agency_control: 5 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:lte_operator');
      expect(testEval?.passed).toBe(true);
    });

    it('OPR-003: should evaluate > (greater than) correctly', async () => {
      const expression = createTestExpression('test:gt_operator', [
        { logic: { '>': [{ var: 'moodAxes.engagement' }, 20] } },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      // At threshold - should NOT pass (need greater, not equal)
      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ engagement: 20 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:gt_operator');
      expect(testEval?.passed).toBe(false);
    });

    it('OPR-004: should evaluate < (less than) correctly', async () => {
      const expression = createTestExpression('test:lt_operator', [
        { logic: { '<': [{ var: 'moodAxes.threat' }, 0] } },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ threat: -30 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:lt_operator');
      expect(testEval?.passed).toBe(true);
    });

    it('OPR-005: should evaluate == (equal) correctly', async () => {
      const expression = createTestExpression('test:eq_operator', [
        { logic: { '==': [{ var: 'moodAxes.affiliation' }, 0] } },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ affiliation: 0 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:eq_operator');
      expect(testEval?.passed).toBe(true);
    });

    it('OPR-006: should evaluate != (not equal) correctly', async () => {
      const expression = createTestExpression('test:neq_operator', [
        { logic: { '!=': [{ var: 'moodAxes.self_evaluation' }, 0] } },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ self_evaluation: 25 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:neq_operator');
      expect(testEval?.passed).toBe(true);
    });
  });

  // ==========================================================================
  // Category 3: Logical Combinators (COMB-001 to COMB-006)
  // ==========================================================================

  describe('Category 3: Logical Combinators', () => {
    it('COMB-001: should evaluate simple AND (2 conditions)', async () => {
      const expression = createTestExpression('test:simple_and', [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.arousal' }, 30] },
              { '<=': [{ var: 'moodAxes.threat' }, 20] },
            ],
          },
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ arousal: 50, threat: 10 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:simple_and');
      expect(testEval?.passed).toBe(true);
    });

    it('COMB-002: should evaluate simple OR (2 conditions)', async () => {
      const expression = createTestExpression('test:simple_or', [
        {
          logic: {
            or: [
              { '>=': [{ var: 'moodAxes.arousal' }, 80] }, // Not met
              { '<=': [{ var: 'moodAxes.threat' }, 0] }, // Met
            ],
          },
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ arousal: 30, threat: -20 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:simple_or');
      expect(testEval?.passed).toBe(true);
    });

    it('COMB-003: should evaluate nested AND with OR', async () => {
      const expression = createTestExpression('test:nested_and_or', [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.engagement' }, 20] },
              {
                or: [
                  { '>=': [{ var: 'moodAxes.arousal' }, 50] },
                  { '<=': [{ var: 'moodAxes.threat' }, -30] },
                ],
              },
            ],
          },
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ engagement: 30, arousal: 60, threat: 0 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:nested_and_or');
      expect(testEval?.passed).toBe(true);
    });

    it('COMB-004: should evaluate nested OR with AND', async () => {
      const expression = createTestExpression('test:nested_or_and', [
        {
          logic: {
            or: [
              {
                and: [
                  { '>=': [{ var: 'moodAxes.valence' }, 50] },
                  { '>=': [{ var: 'moodAxes.arousal' }, 50] },
                ],
              },
              {
                and: [
                  { '<=': [{ var: 'moodAxes.valence' }, -50] },
                  { '>=': [{ var: 'moodAxes.threat' }, 50] },
                ],
              },
            ],
          },
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      // First OR branch passes
      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ valence: 60, arousal: 70, threat: 0 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:nested_or_and');
      expect(testEval?.passed).toBe(true);
    });

    it('COMB-005: should evaluate deep nesting (3 levels)', async () => {
      const expression = createTestExpression('test:deep_nesting', [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.engagement' }, 10] },
              {
                or: [
                  {
                    and: [
                      { '>=': [{ var: 'moodAxes.arousal' }, 30] },
                      { '<=': [{ var: 'moodAxes.inhibitory_control' }, 50] },
                    ],
                  },
                  { '>=': [{ var: 'moodAxes.valence' }, 80] },
                ],
              },
            ],
          },
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ engagement: 20, arousal: 40, inhibitory_control: 30, valence: 0 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:deep_nesting');
      expect(testEval?.passed).toBe(true);
    });

    it('COMB-006: should evaluate multiple prerequisites array (all must pass)', async () => {
      const expression = createTestExpression('test:multiple_prereqs', [
        { logic: { '>=': [{ var: 'moodAxes.arousal' }, 20] } },
        { logic: { '<=': [{ var: 'moodAxes.threat' }, 30] } },
        { logic: { '>=': [{ var: 'moodAxes.engagement' }, 10] } },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ arousal: 40, threat: 10, engagement: 30 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:multiple_prereqs');
      expect(testEval?.passed).toBe(true);
      expect(testEval?.prerequisites).toHaveLength(3);
      expect(testEval?.prerequisites.every((p) => p.status === 'passed')).toBe(true);
    });
  });

  // ==========================================================================
  // Category 4: Delta Calculations (DELTA-001 to DELTA-004)
  // ==========================================================================

  describe('Category 4: Delta Calculations', () => {
    it('DELTA-001: should detect emotion increase (current - previous >= threshold)', async () => {
      const expression = createTestExpression('test:emotion_increase', [
        {
          logic: {
            '>=': [
              { '-': [{ var: 'emotions.frustration' }, { var: 'previousEmotions.frustration' }] },
              0.12,
            ],
          },
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder, emotionCalculatorService } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ valence: -60, arousal: 50, agency_control: -50 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');

      // Set up previous emotions with lower frustration
      const emotionKeys = emotionCalculatorService.getEmotionPrototypeKeys();
      const previousEmotions = {};
      for (const key of emotionKeys) {
        previousEmotions[key] = 0.1;
      }

      const previousState = { emotions: previousEmotions, sexualStates: null, moodAxes: null };
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData, previousState);

      // Verify previousEmotions context is properly set
      expect(context.previousEmotions.frustration).toBe(0.1);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:emotion_increase');
      // Pass depends on whether frustration increased by 0.12 or more
      expect(testEval).toBeDefined();
    });

    it('DELTA-002: should detect mood axis decrease (current - previous <= -threshold)', async () => {
      const expression = createTestExpression('test:mood_decrease', [
        {
          logic: {
            '<=': [
              { '-': [{ var: 'moodAxes.inhibitory_control' }, { var: 'previousMoodAxes.inhibitory_control' }] },
              -25,
            ],
          },
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ inhibitory_control: 20 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');

      const previousState = {
        emotions: null,
        sexualStates: null,
        moodAxes: createMoodData({ inhibitory_control: 50 }),
      };

      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData, previousState);

      // Delta should be 20 - 50 = -30, which is <= -25
      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:mood_decrease');
      expect(testEval?.passed).toBe(true);
    });

    it('DELTA-003: should evaluate combined delta with threshold', async () => {
      const expression = createTestExpression('test:combined_delta_threshold', [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.arousal' }, 40] }, // Current threshold
              {
                '>=': [
                  { '-': [{ var: 'moodAxes.arousal' }, { var: 'previousMoodAxes.arousal' }] },
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
        moodData: createMoodData({ arousal: 60 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');

      const previousState = {
        emotions: null,
        sexualStates: null,
        moodAxes: createMoodData({ arousal: 40 }),
      };

      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData, previousState);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:combined_delta_threshold');
      expect(testEval?.passed).toBe(true);
    });

    it('DELTA-004: should detect transition (from < X to >= X)', async () => {
      const expression = createTestExpression('test:transition_detection', [
        {
          logic: {
            and: [
              { '<': [{ var: 'previousMoodAxes.arousal' }, 50] }, // Was below threshold
              { '>=': [{ var: 'moodAxes.arousal' }, 50] }, // Now at or above threshold
            ],
          },
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ arousal: 60 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');

      const previousState = {
        emotions: null,
        sexualStates: null,
        moodAxes: createMoodData({ arousal: 40 }), // Was below 50
      };

      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData, previousState);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:transition_detection');
      expect(testEval?.passed).toBe(true);
    });
  });

  // ==========================================================================
  // Category 5: Complex Real-World Scenarios (COMPLEX-001 to COMPLEX-003)
  // ==========================================================================

  describe('Category 5: Complex Real-World Scenarios', () => {
    it('COMPLEX-001: should evaluate frustration_spiral-style pattern', async () => {
      // Simplified frustration_spiral pattern (without affectTraits for now)
      const expression = createTestExpression('test:frustration_spiral_style', [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.arousal' }, 20] },
              { '>=': [{ var: 'moodAxes.engagement' }, 10] },
              { '<=': [{ var: 'moodAxes.agency_control' }, 10] },
              {
                or: [
                  { '<=': [{ var: 'moodAxes.inhibitory_control' }, 35] },
                  {
                    '<=': [
                      { '-': [{ var: 'moodAxes.inhibitory_control' }, { var: 'previousMoodAxes.inhibitory_control' }] },
                      -25,
                    ],
                  },
                ],
              },
            ],
          },
          failure_message: 'Baseline state not met',
        },
        {
          logic: {
            or: [
              {
                '>=': [
                  { '-': [{ var: 'moodAxes.arousal' }, { var: 'previousMoodAxes.arousal' }] },
                  12,
                ],
              },
              {
                '<=': [
                  { '-': [{ var: 'moodAxes.agency_control' }, { var: 'previousMoodAxes.agency_control' }] },
                  -12,
                ],
              },
              {
                and: [
                  { '<': [{ var: 'previousMoodAxes.arousal' }, 50] },
                  { '>=': [{ var: 'moodAxes.arousal' }, 50] },
                ],
              },
            ],
          },
          failure_message: 'No state change detected',
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      // Set up frustration-inducing state
      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({
          arousal: 55,
          engagement: 30,
          agency_control: -20,
          inhibitory_control: 25,
        }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');

      const previousState = {
        emotions: null,
        sexualStates: null,
        moodAxes: createMoodData({
          arousal: 40, // Transition: was < 50, now >= 50
          engagement: 30,
          agency_control: 5, // Dropped by 25
          inhibitory_control: 55, // Dropped by 30
        }),
      };

      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData, previousState);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:frustration_spiral_style');
      expect(testEval?.passed).toBe(true);
    });

    it('COMPLEX-002: should handle multiple prerequisites array with OR blocks', async () => {
      const expression = createTestExpression('test:multiple_prereqs_or', [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.valence' }, -20] },
              { '<=': [{ var: 'moodAxes.threat' }, 40] },
            ],
          },
        },
        {
          logic: {
            or: [
              { '>=': [{ var: 'moodAxes.arousal' }, 30] },
              { '>=': [{ var: 'moodAxes.engagement' }, 40] },
            ],
          },
        },
        {
          logic: {
            or: [
              { '>=': [{ var: 'moodAxes.affiliation' }, 20] },
              { '<=': [{ var: 'moodAxes.threat' }, 0] },
            ],
          },
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({
          valence: 10,
          threat: -10, // Satisfies third prereq OR
          arousal: 50, // Satisfies second prereq OR
          engagement: 20,
          affiliation: 10,
        }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:multiple_prereqs_or');
      expect(testEval?.passed).toBe(true);
      expect(testEval?.prerequisites.length).toBe(3);
    });

    it('COMPLEX-003: should handle mixed scales (0-1 emotions vs -100/+100 moodAxes)', async () => {
      // This tests that the system correctly handles different scales
      // emotions are normalized 0-1, moodAxes are -100 to +100
      const expression = createTestExpression('test:mixed_scales', [
        {
          logic: {
            and: [
              { '>=': [{ var: 'moodAxes.arousal' }, 50] }, // -100 to +100 scale
              { '<=': [{ var: 'moodAxes.valence' }, 20] }, // -100 to +100 scale
            ],
          },
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ arousal: 60, valence: 10 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData);

      // Verify scale handling
      expect(context.moodAxes.arousal).toBe(60);
      expect(context.moodAxes.valence).toBe(10);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:mixed_scales');
      expect(testEval?.passed).toBe(true);
    });
  });

  // ==========================================================================
  // Category 6: Edge Cases (EDGE-001 to EDGE-005)
  // ==========================================================================

  describe('Category 6: Edge Cases', () => {
    it('EDGE-001: should return false for missing context variable', async () => {
      // Expression references a variable that doesn't exist in context
      const expression = createTestExpression('test:missing_var', [
        {
          logic: { '>=': [{ var: 'nonexistent.path' }, 0.5] },
        },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager);
      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:missing_var');
      expect(testEval?.passed).toBe(false);
    });

    it('EDGE-002: should match expression with empty prerequisites array', async () => {
      const expression = createTestExpression('test:empty_prereqs', [], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager);
      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:empty_prereqs');
      expect(testEval?.passed).toBe(true);
    });

    it('EDGE-003: should handle null/undefined logic gracefully', async () => {
      // Expression with prerequisite that has no logic
      const expression = createTestExpression('test:null_logic', [
        { failure_message: 'Missing logic' }, // No logic property
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      const { actor } = await createActorAndLocation(entityManager);
      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData);

      // Should not throw, but should skip or handle gracefully
      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:null_logic');
      expect(testEval).toBeDefined();
    });

    it('EDGE-004: should handle boundary values (exactly at threshold)', async () => {
      const expression = createTestExpression('test:boundary_gte', [
        { logic: { '>=': [{ var: 'moodAxes.arousal' }, 50] } },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      // Exactly at threshold
      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ arousal: 50 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData);

      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:boundary_gte');
      expect(testEval?.passed).toBe(true); // >= 50 should pass at exactly 50
    });

    it('EDGE-005: should handle float precision issues with emotions (0-1 scale)', async () => {
      // Testing with decimal values that could have precision issues
      // Emotions use 0-1 float scale, unlike mood axes which are integers
      const expression = createTestExpression('test:float_precision', [
        { logic: { '>=': [{ var: 'emotions.frustration' }, 0.5] } },
      ], 999);

      activeEnv = await setupExpressionEnv([expression]);
      const { entityManager, expressionEvaluatorService, expressionContextBuilder } = activeEnv;

      // Create actor with default mood data (emotions are calculated from mood/sexual state)
      // Using high arousal and negative valence to generate frustration
      const { actor } = await createActorAndLocation(entityManager, {
        moodData: createMoodData({ arousal: 60, valence: -50, agency_control: -30 }),
      });

      const moodData = await entityManager.getComponentData(actor.id, 'core:mood');
      const sexData = await entityManager.getComponentData(actor.id, 'core:sexual_state');
      const context = expressionContextBuilder.buildContext(actor.id, moodData, sexData);

      // The test verifies that float comparison works correctly
      // Emotion values are computed, so we test that the comparison logic handles floats
      const result = expressionEvaluatorService.evaluateAllWithDiagnostics(context);
      const testEval = result.evaluations.find((e) => e.expression.id === 'test:float_precision');
      // The result depends on calculated emotion value - we mainly verify no precision errors
      expect(testEval).toBeDefined();
      expect(typeof testEval.passed).toBe('boolean');
    });
  });
});
