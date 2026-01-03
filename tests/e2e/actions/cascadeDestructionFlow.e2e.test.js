/**
 * @file cascadeDestructionFlow.e2e.test.js
 * @description End-to-end coverage for cascade destruction and narrative flow.
 */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';

import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import {
  ANATOMY_BODY_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID,
  ANATOMY_PART_HEALTH_COMPONENT_ID,
  ANATOMY_VITAL_ORGAN_COMPONENT_ID,
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import {
  CASCADE_DESTRUCTION_EVENT_ID,
  PART_DESTROYED_EVENT_ID,
} from '../../../src/anatomy/constants/anatomyConstants.js';

const JOINT_COMPONENT_ID = 'anatomy:joint';
const GENDER_COMPONENT_ID = 'core:gender';
const DAMAGE_APPLIED_EVENT_ID = 'anatomy:damage_applied';
const ENTITY_DIED_EVENT_ID = 'anatomy:entity_died';
const PERCEPTIBLE_EVENT_ID = 'core:perceptible_event';

const HEALTHY_STATE = 'healthy';
const DESTROYED_STATE = 'destroyed';

describe('cascade destruction flow e2e', () => {
  let testBed;
  let entityManager;
  let bodyGraphService;
  let applyDamageHandler;
  let eventBus;
  let schemaValidator;
  let dataRegistry;
  let dispatchedEvents;
  let unsubscribe;

  beforeEach(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();

    entityManager = testBed.get(tokens.IEntityManager);
    bodyGraphService = testBed.get(tokens.BodyGraphService);
    applyDamageHandler = testBed.get(tokens.ApplyDamageHandler);
    eventBus = testBed.get(tokens.ISafeEventDispatcher);
    schemaValidator = testBed.get(tokens.ISchemaValidator);
    dataRegistry = testBed.get(tokens.IDataRegistry);

    await registerAnatomySchemas(schemaValidator);
    registerEntityDefinitions(dataRegistry);

    dispatchedEvents = [];
    unsubscribe = eventBus.subscribe('*', (event) => {
      dispatchedEvents.push(event);
    });
  });

  afterEach(async () => {
    if (typeof unsubscribe === 'function') {
      unsubscribe();
    }
    await testBed.cleanup();
  });

  it('executes full damage -> cascade -> death flow', async () => {
    const { actorId, parts } = await createActorWithTorsoOrgans({
      vitalOrgans: {
        [partsByName().heart]: 'heart',
      },
    });
    await bodyGraphService.buildAdjacencyCache(parts.torso);

    await applyDamageHandler.execute(
      {
        entity_ref: actorId,
        part_ref: parts.torso,
        amount: 200,
        damage_type: 'blunt',
      },
      buildExecutionContext()
    );

    expectPartHealth(parts.torso, 0);
    expectPartHealth(parts.heart, 0);
    expectPartHealth(parts.spine, 0);
    expectPartHealth(parts.leftLung, 0);
    expectPartHealth(parts.rightLung, 0);

    const cascadeEvent = findEvent(CASCADE_DESTRUCTION_EVENT_ID);
    expect(cascadeEvent).toBeTruthy();
    expect(findEvent(ENTITY_DIED_EVENT_ID)).toBeTruthy();

    const narrativeEvent = findEvent(PERCEPTIBLE_EVENT_ID, (event) =>
      event?.payload?.perceptionType === 'damage_received'
    );
    expect(narrativeEvent).toBeTruthy();
    expect(narrativeEvent.payload.descriptionText).toContain(
      'As their torso collapses'
    );
    expect(narrativeEvent.payload.descriptionText).toContain('heart');
    expect(narrativeEvent.payload.descriptionText).toContain('spine');
    expect(narrativeEvent.payload.descriptionText).toContain('left lung');
    expect(narrativeEvent.payload.descriptionText).toContain('right lung');
  });

  it('dispatches cascade events in the expected order', async () => {
    const { actorId, parts } = await createActorWithTorsoOrgans({
      vitalOrgans: {
        [partsByName().heart]: 'heart',
      },
    });
    await bodyGraphService.buildAdjacencyCache(parts.torso);

    await applyDamageHandler.execute(
      {
        entity_ref: actorId,
        part_ref: parts.torso,
        amount: 200,
        damage_type: 'blunt',
      },
      buildExecutionContext()
    );

    const parentDestroyedIndex = findEventIndex(
      PART_DESTROYED_EVENT_ID,
      parts.torso
    );
    const childDestroyedIndices = [
      parts.heart,
      parts.spine,
      parts.leftLung,
      parts.rightLung,
    ].map((partId) => findEventIndex(PART_DESTROYED_EVENT_ID, partId));
    const cascadeIndex = findEventIndex(CASCADE_DESTRUCTION_EVENT_ID);
    const damageAppliedIndex = findEventIndex(DAMAGE_APPLIED_EVENT_ID);
    const deathIndex = findEventIndex(ENTITY_DIED_EVENT_ID);

    expect(Math.min(...childDestroyedIndices)).toBeGreaterThan(
      parentDestroyedIndex
    );
    expect(cascadeIndex).toBeGreaterThan(Math.max(...childDestroyedIndices));
    expect(damageAppliedIndex).toBeGreaterThan(cascadeIndex);
    expect(deathIndex).toBeGreaterThan(damageAppliedIndex);
  });

  it('includes cascade destruction in the narrative', async () => {
    const { actorId, parts } = await createActorWithTorsoOrgans();
    await bodyGraphService.buildAdjacencyCache(parts.torso);

    await applyDamageHandler.execute(
      {
        entity_ref: actorId,
        part_ref: parts.torso,
        amount: 200,
        damage_type: 'blunt',
      },
      buildExecutionContext()
    );

    const narrativeEvent = findEvent(PERCEPTIBLE_EVENT_ID, (event) =>
      event?.payload?.perceptionType === 'damage_received'
    );

    expect(narrativeEvent).toBeTruthy();
    expect(narrativeEvent.payload.descriptionText).toContain(
      'As their torso collapses'
    );
  });

  function findEvent(type, predicate) {
    return dispatchedEvents.find((event) => {
      if (event.type !== type) return false;
      if (typeof predicate === 'function') {
        return predicate(event);
      }
      return true;
    });
  }

  function findEventIndex(type, partId = null) {
    return dispatchedEvents.findIndex((event) => {
      if (event.type !== type) return false;
      if (!partId) return true;
      return event.payload?.partId === partId;
    });
  }

  function expectPartHealth(partId, expectedHealth) {
    const health = entityManager.getComponentData(
      partId,
      ANATOMY_PART_HEALTH_COMPONENT_ID
    );
    expect(health.currentHealth).toBe(expectedHealth);
  }

  function buildExecutionContext() {
    return {
      evaluationContext: { context: {} },
      actorId: 'attacker-1',
    };
  }

  function registerEntityDefinitions(registry) {
    if (!registry.get('entityDefinitions', 'test:actor')) {
      registry.store(
        'entityDefinitions',
        'test:actor',
        new EntityDefinition('test:actor', {
          description: 'Test actor entity',
          components: {},
        })
      );
    }
    if (!registry.get('entityDefinitions', 'test:part')) {
      registry.store(
        'entityDefinitions',
        'test:part',
        new EntityDefinition('test:part', {
          description: 'Test part entity',
          components: {},
        })
      );
    }
  }

  async function registerAnatomySchemas(validator) {
    const schemaIds = [
      ANATOMY_BODY_COMPONENT_ID,
      ANATOMY_PART_COMPONENT_ID,
      ANATOMY_PART_HEALTH_COMPONENT_ID,
      ANATOMY_VITAL_ORGAN_COMPONENT_ID,
      JOINT_COMPONENT_ID,
      GENDER_COMPONENT_ID,
      'anatomy:dying',
      'anatomy:dead',
    ];

    for (const schemaId of schemaIds) {
      if (
        typeof validator.isSchemaLoaded === 'function' &&
        validator.isSchemaLoaded(schemaId)
      ) {
        continue;
      }
      if (typeof validator.addSchema === 'function') {
        await validator.addSchema(
          { type: 'object', additionalProperties: true },
          schemaId
        );
      }
    }
  }

  async function createActorWithTorsoOrgans(options = {}) {
    const { healthOverrides = {}, vitalOrgans = {} } = options;
    const ids = partsByName();

    const actorId = await createActorEntity('actor-torso');
    const torsoId = await createPartEntity(ids.torso);
    const heartId = await createPartEntity(ids.heart);
    const spineId = await createPartEntity(ids.spine);
    const leftLungId = await createPartEntity(ids.leftLung);
    const rightLungId = await createPartEntity(ids.rightLung);

    await addActorMetadata(actorId, torsoId, {
      torso: torsoId,
      heart: heartId,
      spine: spineId,
      leftLung: leftLungId,
      rightLung: rightLungId,
    });

    await addPart(torsoId, {
      subType: 'torso',
      ownerEntityId: actorId,
      health: healthOverrides[ids.torso],
    });
    await addPart(heartId, {
      subType: 'heart',
      ownerEntityId: actorId,
      parentId: torsoId,
      socketId: 'heart-slot',
      health: healthOverrides[ids.heart],
      vitalOrganType: vitalOrgans[ids.heart],
    });
    await addPart(spineId, {
      subType: 'spine',
      ownerEntityId: actorId,
      parentId: torsoId,
      socketId: 'spine-slot',
      health: healthOverrides[ids.spine],
      vitalOrganType: vitalOrgans[ids.spine],
    });
    await addPart(leftLungId, {
      subType: 'lung',
      orientation: 'left',
      ownerEntityId: actorId,
      parentId: torsoId,
      socketId: 'left-lung-slot',
      health: healthOverrides[ids.leftLung],
    });
    await addPart(rightLungId, {
      subType: 'lung',
      orientation: 'right',
      ownerEntityId: actorId,
      parentId: torsoId,
      socketId: 'right-lung-slot',
      health: healthOverrides[ids.rightLung],
    });

    return {
      actorId,
      parts: {
        torso: torsoId,
        heart: heartId,
        spine: spineId,
        leftLung: leftLungId,
        rightLung: rightLungId,
      },
    };
  }

  async function createActorEntity(instanceId) {
    const actor = await entityManager.createEntityInstance('test:actor', {
      instanceId,
    });
    return actor.id;
  }

  async function createPartEntity(instanceId) {
    const part = await entityManager.createEntityInstance('test:part', {
      instanceId,
    });
    return part.id;
  }

  async function addActorMetadata(actorId, rootPartId, partsMap) {
    await entityManager.addComponent(actorId, NAME_COMPONENT_ID, {
      text: 'Test Actor',
    });
    await entityManager.addComponent(actorId, GENDER_COMPONENT_ID, {
      value: 'neutral',
    });
    await entityManager.addComponent(actorId, POSITION_COMPONENT_ID, {
      locationId: 'test-location',
    });
    await entityManager.addComponent(actorId, ANATOMY_BODY_COMPONENT_ID, {
      body: {
        root: rootPartId,
        parts: partsMap,
      },
    });
  }

  async function addPart(partId, options) {
    const {
      subType,
      orientation = null,
      ownerEntityId,
      parentId = null,
      socketId = null,
      health,
      vitalOrganType,
    } = options;
    const healthData = buildHealthData(health);

    await entityManager.addComponent(partId, ANATOMY_PART_COMPONENT_ID, {
      subType,
      orientation,
      ownerEntityId,
    });
    await entityManager.addComponent(
      partId,
      ANATOMY_PART_HEALTH_COMPONENT_ID,
      healthData
    );
    if (parentId && socketId) {
      await entityManager.addComponent(partId, JOINT_COMPONENT_ID, {
        parentId,
        socketId,
      });
    }
    if (vitalOrganType) {
      await entityManager.addComponent(partId, ANATOMY_VITAL_ORGAN_COMPONENT_ID, {
        organType: vitalOrganType,
      });
    }
  }

  function buildHealthData(currentHealthOverride) {
    const maxHealth = 100;
    const currentHealth =
      typeof currentHealthOverride === 'number'
        ? currentHealthOverride
        : maxHealth;
    return {
      currentHealth,
      maxHealth,
      state: currentHealth <= 0 ? DESTROYED_STATE : HEALTHY_STATE,
      turnsInState: 0,
    };
  }

  function partsByName() {
    return {
      torso: 'part-torso',
      heart: 'part-heart',
      spine: 'part-spine',
      leftLung: 'part-left-lung',
      rightLung: 'part-right-lung',
    };
  }
});
