/**
 * Integration tests for Damage Message Accumulation feature.
 * Validates that damage messages are accumulated and composed into unified narratives.
 * @see specs/injury-reporting-and-user-interface.md
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  test,
} from '@jest/globals';

import ApplyDamageHandler from '../../../src/logic/operationHandlers/applyDamageHandler.js';
import BodyGraphService from '../../../src/anatomy/bodyGraphService.js';
import DamagePropagationService from '../../../src/anatomy/services/damagePropagationService.js';
import DamageAccumulator from '../../../src/anatomy/services/damageAccumulator.js';
import DamageNarrativeComposer from '../../../src/anatomy/services/damageNarrativeComposer.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

const PART_COMPONENT_ID = 'anatomy:part';
const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const BODY_COMPONENT_ID = 'anatomy:body';
const DAMAGE_PROPAGATION_COMPONENT_ID = 'anatomy:damage_propagation';
const NAME_COMPONENT_ID = 'core:name';
const GENDER_COMPONENT_ID = 'core:gender';
const POSITION_COMPONENT_ID = 'core:position';

const PERCEPTIBLE_EVENT = 'core:perceptible_event';

const ids = {
  actor: 'actor-1',
  torso: 'torso-1',
  head: 'head-1',
  brain: 'brain-1',
  leftEye: 'left-eye-1',
  rightEye: 'right-eye-1',
  arm: 'arm-1',
};

describe('Damage Message Accumulation', () => {
  /** @type {SimpleEntityManager} */
  let entityManager;
  /** @type {import('../../../src/interfaces/coreServices.js').ILogger} */
  let logger;
  /** @type {{ dispatch: jest.Mock }} */
  let dispatcher;
  /** @type {JsonLogicEvaluationService} */
  let jsonLogicService;
  /** @type {BodyGraphService} */
  let bodyGraphService;
  /** @type {DamageAccumulator} */
  let damageAccumulator;
  /** @type {DamageNarrativeComposer} */
  let damageNarrativeComposer;
  /** @type {ApplyDamageHandler} */
  let handler;
  /** @type {object} */
  let executionContext;

  beforeEach(async () => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    dispatcher = { dispatch: jest.fn().mockResolvedValue(true) };
    entityManager = new SimpleEntityManager();
    jsonLogicService = new JsonLogicEvaluationService({ logger });
    bodyGraphService = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
    });

    // Real instances for integration testing
    damageAccumulator = new DamageAccumulator({ logger });
    damageNarrativeComposer = new DamageNarrativeComposer({ logger });

    // Mock damageTypeEffectsService
    const damageTypeEffectsService = {
      applyEffectsForDamage: jest.fn().mockResolvedValue(undefined),
    };

    // Use real DamagePropagationService
    const damagePropagationService = new DamagePropagationService({
      logger,
      entityManager,
      eventBus: dispatcher,
    });

    // Mock deathCheckService - synchronous return, not async
    const deathCheckService = {
      checkDeathConditions: jest.fn().mockReturnValue({
        isDead: false,
        isDying: false,
        deathInfo: null,
      }),
      evaluateDeathConditions: jest.fn().mockReturnValue({
        isDead: false,
        isDying: false,
        shouldFinalize: false,
        finalizationParams: null,
        deathInfo: null,
      }),
      finalizeDeathFromEvaluation: jest.fn(),
    };

    handler = new ApplyDamageHandler({
      logger,
      entityManager,
      safeEventDispatcher: dispatcher,
      jsonLogicService,
      bodyGraphService,
      damageTypeEffectsService,
      damagePropagationService,
      deathCheckService,
      damageAccumulator,
      damageNarrativeComposer,
    });

    executionContext = {
      evaluationContext: { context: {} },
      logger,
    };

    await seedAnatomy();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  /**
   * Seeds the entity manager with test anatomy data.
   */
  async function seedAnatomy() {
    // Actor entity with name, gender, and location (using correct component data formats)
    entityManager.addComponent(ids.actor, NAME_COMPONENT_ID, { text: 'Rill' });
    entityManager.addComponent(ids.actor, GENDER_COMPONENT_ID, {
      value: 'female',
    });
    entityManager.addComponent(ids.actor, POSITION_COMPONENT_ID, {
      locationId: 'test-location-1',
    });

    // Body component
    entityManager.addComponent(ids.actor, BODY_COMPONENT_ID, {
      rootPartId: ids.torso,
      partIds: [
        ids.torso,
        ids.head,
        ids.brain,
        ids.leftEye,
        ids.rightEye,
        ids.arm,
      ],
    });

    // Head with propagation to brain and eyes
    entityManager.addComponent(ids.head, PART_COMPONENT_ID, {
      subType: 'head',
      orientation: null,
      parentId: ids.torso,
      parentEntityId: ids.actor,
    });
    entityManager.addComponent(ids.head, PART_HEALTH_COMPONENT_ID, {
      currentHealth: 100,
      maxHealth: 100,
    });
    entityManager.addComponent(ids.head, DAMAGE_PROPAGATION_COMPONENT_ID, {
      rules: [
        { childPartId: ids.brain, baseProbability: 1, damageFraction: 0.5 },
        { childPartId: ids.leftEye, baseProbability: 1, damageFraction: 0.5 },
        { childPartId: ids.rightEye, baseProbability: 1, damageFraction: 0.5 },
      ],
    });

    // Brain (internal part)
    entityManager.addComponent(ids.brain, PART_COMPONENT_ID, {
      subType: 'brain',
      orientation: null,
      parentId: ids.head,
      parentEntityId: ids.actor,
    });
    entityManager.addComponent(ids.brain, PART_HEALTH_COMPONENT_ID, {
      currentHealth: 50,
      maxHealth: 50,
    });
    entityManager.addComponent(ids.brain, 'anatomy:joint', {
      parentId: ids.head,
      socketId: 'brain-socket',
    });

    // Left Eye
    entityManager.addComponent(ids.leftEye, PART_COMPONENT_ID, {
      subType: 'eye',
      orientation: 'left',
      parentId: ids.head,
      parentEntityId: ids.actor,
    });
    entityManager.addComponent(ids.leftEye, PART_HEALTH_COMPONENT_ID, {
      currentHealth: 30,
      maxHealth: 30,
    });
    entityManager.addComponent(ids.leftEye, 'anatomy:joint', {
      parentId: ids.head,
      socketId: 'left-eye-socket',
    });

    // Right Eye
    entityManager.addComponent(ids.rightEye, PART_COMPONENT_ID, {
      subType: 'eye',
      orientation: 'right',
      parentId: ids.head,
      parentEntityId: ids.actor,
    });
    entityManager.addComponent(ids.rightEye, PART_HEALTH_COMPONENT_ID, {
      currentHealth: 30,
      maxHealth: 30,
    });
    entityManager.addComponent(ids.rightEye, 'anatomy:joint', {
      parentId: ids.head,
      socketId: 'right-eye-socket',
    });

    // Arm (simple part without propagation)
    entityManager.addComponent(ids.arm, PART_COMPONENT_ID, {
      subType: 'arm',
      orientation: 'left',
      parentId: ids.torso,
      parentEntityId: ids.actor,
    });
    entityManager.addComponent(ids.arm, PART_HEALTH_COMPONENT_ID, {
      currentHealth: 80,
      maxHealth: 80,
    });

    // Torso (root)
    entityManager.addComponent(ids.torso, PART_COMPONENT_ID, {
      subType: 'torso',
      orientation: null,
      parentId: null,
      parentEntityId: ids.actor,
    });
    entityManager.addComponent(ids.torso, PART_HEALTH_COMPONENT_ID, {
      currentHealth: 200,
      maxHealth: 200,
    });
  }

  describe('composed perceptible event dispatch', () => {
    test('should dispatch core:perceptible_event with damage_received type for simple damage', async () => {
      const params = {
        entity_ref: ids.actor,
        part_ref: ids.arm,
        damage_type: 'slashing',
        amount: 15,
      };

      await handler.execute(params, executionContext);

      // Find the perceptible event dispatch
      const perceptibleDispatch = dispatcher.dispatch.mock.calls.find(
        (call) => call[0] === PERCEPTIBLE_EVENT
      );

      expect(perceptibleDispatch).toBeDefined();
      expect(perceptibleDispatch[1]).toMatchObject({
        perceptionType: 'damage_received',
      });
      expect(perceptibleDispatch[1].descriptionText).toContain(
        "Rill's left arm"
      );
      expect(perceptibleDispatch[1].descriptionText).toContain(
        'slashing damage'
      );
    });

    test('should compose primary and propagated damage into unified narrative', async () => {
      const params = {
        entity_ref: ids.actor,
        part_ref: ids.head,
        damage_type: 'piercing',
        amount: 30,
      };

      await handler.execute(params, executionContext);

      // Find the perceptible event dispatch
      const perceptibleDispatch = dispatcher.dispatch.mock.calls.find(
        (call) => call[0] === PERCEPTIBLE_EVENT
      );

      expect(perceptibleDispatch).toBeDefined();

      const narrative = perceptibleDispatch[1].descriptionText;

      // Primary damage should be in narrative
      expect(narrative).toContain("Rill's head suffers piercing damage");

      // Propagated damage should be mentioned (brain and eyes)
      expect(narrative).toContain('As a result');
      expect(narrative).toContain('her');
    });

    test('should include possessive pronoun for female entity in propagation', async () => {
      const params = {
        entity_ref: ids.actor,
        part_ref: ids.head,
        damage_type: 'piercing',
        amount: 20,
      };

      await handler.execute(params, executionContext);

      const perceptibleDispatch = dispatcher.dispatch.mock.calls.find(
        (call) => call[0] === PERCEPTIBLE_EVENT
      );

      expect(perceptibleDispatch[1].descriptionText).toContain('her brain');
    });

    test('should include totalDamage in perceptible event payload', async () => {
      const params = {
        entity_ref: ids.actor,
        part_ref: ids.arm,
        damage_type: 'slashing',
        amount: 25,
      };

      await handler.execute(params, executionContext);

      const perceptibleDispatch = dispatcher.dispatch.mock.calls.find(
        (call) => call[0] === PERCEPTIBLE_EVENT
      );

      expect(perceptibleDispatch[1].contextualData.totalDamage).toBe(25);
    });
  });

  describe('backwards compatibility', () => {
    test('should still dispatch individual anatomy:damage_applied events', async () => {
      const params = {
        entity_ref: ids.actor,
        part_ref: ids.arm,
        damage_type: 'slashing',
        amount: 10,
      };

      await handler.execute(params, executionContext);

      // Find individual damage_applied event
      const damageAppliedDispatches = dispatcher.dispatch.mock.calls.filter(
        (call) => call[0] === 'anatomy:damage_applied'
      );

      expect(damageAppliedDispatches.length).toBeGreaterThanOrEqual(1);
    });

    test('should dispatch perceptible event before individual events', async () => {
      const params = {
        entity_ref: ids.actor,
        part_ref: ids.arm,
        damage_type: 'slashing',
        amount: 10,
      };

      await handler.execute(params, executionContext);

      // Get indices of dispatches
      const perceptibleIndex = dispatcher.dispatch.mock.calls.findIndex(
        (call) => call[0] === PERCEPTIBLE_EVENT
      );
      const damageAppliedIndex = dispatcher.dispatch.mock.calls.findIndex(
        (call) => call[0] === 'anatomy:damage_applied'
      );

      // Perceptible event should come before individual events
      expect(perceptibleIndex).toBeLessThan(damageAppliedIndex);
    });
  });

  describe('session lifecycle', () => {
    test('should clean up damage session after execution', async () => {
      const params = {
        entity_ref: ids.actor,
        part_ref: ids.arm,
        damage_type: 'slashing',
        amount: 10,
      };

      await handler.execute(params, executionContext);

      // Session should be cleaned up (deleted from context)
      expect(executionContext.damageSession).toBeUndefined();
    });

    test('should not dispatch perceptible event for propagated calls', async () => {
      // Simulate a propagated damage call (with propagatedFrom set)
      const params = {
        entity_ref: ids.actor,
        part_ref: ids.brain,
        damage_type: 'piercing',
        amount: 10,
        propagatedFrom: ids.head,
      };
      // Pre-existing session indicates this is a recursive call
      const contextWithSession = {
        ...executionContext,
        damageSession: damageAccumulator.createSession(ids.actor),
      };

      await handler.execute(params, contextWithSession);

      // Should not dispatch perceptible event for propagated calls
      // because we passed a pre-existing session (not top-level)
      const perceptibleDispatch = dispatcher.dispatch.mock.calls.find(
        (call) => call[0] === PERCEPTIBLE_EVENT
      );

      // Since we're simulating a non-top-level call, no perceptible event
      expect(perceptibleDispatch).toBeUndefined();
    });
  });

  describe('narrative composition integration', () => {
    test('should handle damage without effects', async () => {
      const params = {
        entity_ref: ids.actor,
        part_ref: ids.arm,
        damage_type: 'bludgeoning',
        amount: 5,
      };

      await handler.execute(params, executionContext);

      const perceptibleDispatch = dispatcher.dispatch.mock.calls.find(
        (call) => call[0] === PERCEPTIBLE_EVENT
      );

      expect(perceptibleDispatch[1].descriptionText).toBe(
        "Rill's left arm suffers bludgeoning damage."
      );
    });

    test('should include orientation in part names', async () => {
      const params = {
        entity_ref: ids.actor,
        part_ref: ids.arm,
        damage_type: 'slashing',
        amount: 10,
      };

      await handler.execute(params, executionContext);

      const perceptibleDispatch = dispatcher.dispatch.mock.calls.find(
        (call) => call[0] === PERCEPTIBLE_EVENT
      );

      expect(perceptibleDispatch[1].descriptionText).toContain('left arm');
    });

    test('should omit orientation for parts without orientation', async () => {
      const params = {
        entity_ref: ids.actor,
        part_ref: ids.torso,
        damage_type: 'piercing',
        amount: 20,
      };

      await handler.execute(params, executionContext);

      const perceptibleDispatch = dispatcher.dispatch.mock.calls.find(
        (call) => call[0] === PERCEPTIBLE_EVENT
      );

      // Should say "torso" not "null torso"
      expect(perceptibleDispatch[1].descriptionText).toContain('torso suffers');
      expect(perceptibleDispatch[1].descriptionText).not.toContain(
        'null torso'
      );
    });
  });

  describe('male entity possessive pronouns', () => {
    beforeEach(() => {
      // Change entity to male (using correct component data formats)
      entityManager.addComponent(ids.actor, GENDER_COMPONENT_ID, {
        value: 'male',
      });
      entityManager.addComponent(ids.actor, NAME_COMPONENT_ID, {
        text: 'Marcus',
      });
    });

    test('should use "his" for male entity in propagation', async () => {
      const params = {
        entity_ref: ids.actor,
        part_ref: ids.head,
        damage_type: 'piercing',
        amount: 20,
      };

      await handler.execute(params, executionContext);

      const perceptibleDispatch = dispatcher.dispatch.mock.calls.find(
        (call) => call[0] === PERCEPTIBLE_EVENT
      );

      expect(perceptibleDispatch[1].descriptionText).toContain("Marcus's head");
      expect(perceptibleDispatch[1].descriptionText).toContain('his brain');
    });
  });

  describe('neutral entity possessive pronouns', () => {
    beforeEach(() => {
      // Change entity to neutral
      entityManager.addComponent(ids.actor, GENDER_COMPONENT_ID, {
        value: 'neutral',
      });
      entityManager.addComponent(ids.actor, NAME_COMPONENT_ID, {
        text: 'Entity',
      });
    });

    test('should use "their" for neutral entity in propagation', async () => {
      const params = {
        entity_ref: ids.actor,
        part_ref: ids.head,
        damage_type: 'piercing',
        amount: 20,
      };

      await handler.execute(params, executionContext);

      const perceptibleDispatch = dispatcher.dispatch.mock.calls.find(
        (call) => call[0] === PERCEPTIBLE_EVENT
      );

      expect(perceptibleDispatch[1].descriptionText).toContain("Entity's head");
      expect(perceptibleDispatch[1].descriptionText).toContain('their brain');
    });
  });
});
