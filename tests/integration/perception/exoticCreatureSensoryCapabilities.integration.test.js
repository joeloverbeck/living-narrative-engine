/**
 * @jest-environment node
 */

import { describe, test, expect, jest } from '@jest/globals';
import SensoryCapabilityService from '../../../src/perception/services/sensoryCapabilityService.js';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

import eldritchBalefulEyeDefinition from '../../../data/mods/anatomy-creatures/entities/definitions/eldritch_baleful_eye.entity.json' assert { type: 'json' };
import eldritchCompoundEyeStalkDefinition from '../../../data/mods/anatomy-creatures/entities/definitions/eldritch_compound_eye_stalk.entity.json' assert { type: 'json' };
import eldritchTentacleSensoryDefinition from '../../../data/mods/anatomy-creatures/entities/definitions/eldritch_tentacle_sensory.entity.json' assert { type: 'json' };
import tortoiseEyeDefinition from '../../../data/mods/anatomy-creatures/entities/definitions/tortoise_eye.entity.json' assert { type: 'json' };

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockEventDispatcher = () => ({
  dispatch: jest.fn(),
});

const deepClone = (value) => JSON.parse(JSON.stringify(value));

const createPartEntityFromDefinition = (definition, instanceId, overrides = {}) => {
  return {
    id: instanceId,
    components: {
      ...deepClone(definition.components),
      ...deepClone(overrides),
    },
  };
};

const createActorEntity = (actorId, { withAnatomy = true, override = null } = {}) => {
  const components = {};

  if (withAnatomy) {
    components['anatomy:body'] = {
      body: { root: actorId },
      recipeId: 'test-recipe',
    };
  }

  if (override) {
    components['perception:sensory_capability'] = override;
  }

  return { id: actorId, components };
};

const attachChildPart = (partEntity, parentId) => ({
  ...partEntity,
  components: {
    ...partEntity.components,
    'anatomy:joint': {
      parentId,
      socketId: 'test-socket',
    },
  },
});

const createEnvironment = (entities) => {
  const entityManager = new SimpleEntityManager(entities);
  const logger = createMockLogger();
  const eventDispatcher = createMockEventDispatcher();

  const bodyGraphService = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher,
  });

  const sensoryCapabilityService = new SensoryCapabilityService({
    entityManager,
    bodyGraphService,
    logger,
  });

  return { entityManager, bodyGraphService, sensoryCapabilityService };
};

describe('Exotic Creature Sensory Capabilities - Integration', () => {
  describe('Eldritch Creatures with Exotic Eyes', () => {
    test('detects sight capability for eldritch_baleful_eye', () => {
      const actorId = 'actor:eldritch';
      const eye = attachChildPart(
        createPartEntityFromDefinition(
          eldritchBalefulEyeDefinition,
          'part:eldritch_baleful_eye_1'
        ),
        actorId
      );

      const env = createEnvironment([createActorEntity(actorId), eye]);
      const capabilities = env.sensoryCapabilityService.getSensoryCapabilities(actorId);

      expect(capabilities.canSee).toBe(true);
      expect(capabilities.canHear).toBe(false);
      expect(capabilities.canSmell).toBe(false);
    });

    test('detects sight for creatures with multiple exotic eye types', () => {
      const actorId = 'actor:eldritch_many';
      const eyeA = attachChildPart(
        createPartEntityFromDefinition(
          eldritchBalefulEyeDefinition,
          'part:eldritch_baleful_eye_1'
        ),
        actorId
      );
      const eyeB = attachChildPart(
        createPartEntityFromDefinition(
          eldritchCompoundEyeStalkDefinition,
          'part:eldritch_compound_eye_stalk_1'
        ),
        actorId
      );

      const env = createEnvironment([createActorEntity(actorId), eyeA, eyeB]);
      const capabilities = env.sensoryCapabilityService.getSensoryCapabilities(actorId);

      expect(capabilities.canSee).toBe(true);
    });
  });

  describe('Tortoise with Non-Standard Eye SubType', () => {
    test('detects sight capability for tortoise_eye', () => {
      const actorId = 'actor:tortoise';
      const eye = attachChildPart(
        createPartEntityFromDefinition(tortoiseEyeDefinition, 'part:tortoise_eye_1'),
        actorId
      );

      const env = createEnvironment([createActorEntity(actorId), eye]);
      const capabilities = env.sensoryCapabilityService.getSensoryCapabilities(actorId);

      expect(capabilities.canSee).toBe(true);
    });
  });

  describe('Multi-Sense Organs', () => {
    test('detects smell capability for sensory tentacle (and not sight)', () => {
      const actorId = 'actor:eldritch_tentacles';
      const tentacle = attachChildPart(
        createPartEntityFromDefinition(
          eldritchTentacleSensoryDefinition,
          'part:eldritch_tentacle_sensory_1'
        ),
        actorId
      );

      const env = createEnvironment([createActorEntity(actorId), tentacle]);
      const capabilities = env.sensoryCapabilityService.getSensoryCapabilities(actorId);

      expect(capabilities.canSmell).toBe(true);
      expect(capabilities.canSee).toBe(false);
      expect(capabilities.canHear).toBe(false);
    });
  });

  describe('Backward Compatibility', () => {
    test('returns all senses for entities without anatomy', () => {
      const actorId = 'actor:no_anatomy';
      const env = createEnvironment([createActorEntity(actorId, { withAnatomy: false })]);
      const capabilities = env.sensoryCapabilityService.getSensoryCapabilities(actorId);

      expect(capabilities.canSee).toBe(true);
      expect(capabilities.canHear).toBe(true);
      expect(capabilities.canSmell).toBe(true);
      expect(capabilities.canFeel).toBe(true);
    });

    test('respects manual override component', () => {
      const actorId = 'actor:manual_override';
      const override = {
        overrideMode: 'manual',
        canSee: false,
        canHear: true,
        canSmell: false,
        canFeel: false,
      };

      const eye = attachChildPart(
        createPartEntityFromDefinition(
          eldritchBalefulEyeDefinition,
          'part:eldritch_baleful_eye_1'
        ),
        actorId
      );

      const env = createEnvironment([
        createActorEntity(actorId, { override }),
        eye,
      ]);
      const capabilities = env.sensoryCapabilityService.getSensoryCapabilities(actorId);

      expect(capabilities.canSee).toBe(false);
      expect(capabilities.canHear).toBe(true);
      expect(capabilities.canSmell).toBe(false);
      expect(capabilities.canFeel).toBe(true);
      expect(capabilities.availableSenses).toEqual(
        expect.arrayContaining(['auditory', 'tactile', 'proprioceptive'])
      );
      expect(capabilities.availableSenses).not.toEqual(
        expect.arrayContaining(['visual', 'olfactory'])
      );
    });
  });

  describe('Damaged Sensory Organs', () => {
    test('returns false when all visual organs are destroyed', () => {
      const actorId = 'actor:blind';
      const destroyedHealth = { currentHealth: 0, maxHealth: 15, state: 'destroyed' };

      const eyeA = attachChildPart(
        createPartEntityFromDefinition(
          eldritchBalefulEyeDefinition,
          'part:eldritch_baleful_eye_1',
          { 'anatomy:part_health': destroyedHealth }
        ),
        actorId
      );
      const eyeB = attachChildPart(
        createPartEntityFromDefinition(
          eldritchCompoundEyeStalkDefinition,
          'part:eldritch_compound_eye_stalk_1',
          { 'anatomy:part_health': destroyedHealth }
        ),
        actorId
      );

      const env = createEnvironment([createActorEntity(actorId), eyeA, eyeB]);
      const capabilities = env.sensoryCapabilityService.getSensoryCapabilities(actorId);

      expect(capabilities.canSee).toBe(false);
    });

    test('returns true when at least one visual organ functions', () => {
      const actorId = 'actor:partially_sighted';
      const destroyedHealth = { currentHealth: 0, maxHealth: 15, state: 'destroyed' };

      const destroyedEye = attachChildPart(
        createPartEntityFromDefinition(
          eldritchBalefulEyeDefinition,
          'part:eldritch_baleful_eye_1',
          { 'anatomy:part_health': destroyedHealth }
        ),
        actorId
      );
      const functioningEye = attachChildPart(
        createPartEntityFromDefinition(
          eldritchCompoundEyeStalkDefinition,
          'part:eldritch_compound_eye_stalk_1'
        ),
        actorId
      );

      const env = createEnvironment([
        createActorEntity(actorId),
        destroyedEye,
        functioningEye,
      ]);
      const capabilities = env.sensoryCapabilityService.getSensoryCapabilities(actorId);

      expect(capabilities.canSee).toBe(true);
    });
  });
});

