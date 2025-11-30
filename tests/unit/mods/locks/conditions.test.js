import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import { createMinimalTestContainer } from '../../../common/scopeDsl/minimalTestContainer.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import { HasComponentOperator } from '../../../../src/logic/operators/hasComponentOperator.js';

const CONDITIONS_DIR = path.resolve(
  process.cwd(),
  'data/mods/locks/conditions',
);

function loadConditions(dataRegistry) {
  const files = fs
    .readdirSync(CONDITIONS_DIR)
    .filter((file) => file.endsWith('.condition.json'));

  files.forEach((file) => {
    const condition = JSON.parse(
      fs.readFileSync(path.join(CONDITIONS_DIR, file), 'utf8'),
    );
    dataRegistry.store('conditions', condition.id, condition);
  });
}

async function createConditionEnv() {
  const { services, cleanup } = await createMinimalTestContainer();
  const jsonLogicEval = new JsonLogicEvaluationService({
    logger: services.logger,
    gameDataRepository: services.dataRegistry,
  });

  const hasComponent = new HasComponentOperator({
    entityManager: services.entityManager,
    logger: services.logger,
  });
  jsonLogicEval.addOperation('has_component', (entityPath, componentId, ctx) =>
    hasComponent.evaluate([entityPath, componentId], ctx),
  );
  jsonLogicEval.addOperation(
    'get_component_value',
    (entityRef, componentId, propertyPath = null) => {
      const entityId =
        entityRef && typeof entityRef === 'object' && 'id' in entityRef
          ? entityRef.id
          : entityRef;
      const data = services.entityManager.getComponentData(entityId, componentId);
      if (!data || typeof data !== 'object') {
        return null;
      }
      if (!propertyPath || typeof propertyPath !== 'string') {
        return data;
      }
      return propertyPath
        .split('.')
        .reduce(
          (value, key) =>
            value && Object.prototype.hasOwnProperty.call(value, key)
              ? value[key]
              : null,
          data
        );
    }
  );

  loadConditions(services.dataRegistry);

  return { services, jsonLogicEval, cleanup };
}

describe('Locks conditions', () => {
  let services;
  let jsonLogicEval;
  let cleanup;

  beforeAll(async () => {
    const env = await createConditionEnv();
    services = env.services;
    jsonLogicEval = env.jsonLogicEval;
    cleanup = env.cleanup;
  });

  afterAll(async () => {
    await cleanup?.();
  });

  beforeEach(() => {
    for (const id of services.entityManager.getEntityIds()) {
      services.entityManager.deleteEntity(id);
    }
  });

  function evaluateCondition(id, context) {
    const condition = services.dataRegistry.getConditionDefinition(id);
    return jsonLogicEval.evaluate(condition.logic, context);
  }

  function addBlocker({ isLocked }) {
    const blocker = {
      id: 'locks:test_blocker',
      components: {
        'locks:openable': {
          isLocked,
          requiredKeyId: 'items:test_key',
        },
      },
    };
    services.entityManager.addEntity(blocker);
    return blocker;
  }

  function addActor(inventoryItems, id = 'actor:locks_condition_tester') {
    const actor = {
      id,
      components: {
        'core:actor': {},
        'core:position': { locationId: 'room1' },
        'items:inventory': {
          items: inventoryItems,
          capacity: { maxWeight: 10, maxItems: 5 },
        },
      },
    };
    services.entityManager.addEntity(actor);
    return actor;
  }

  it('detects blockers with the locks:openable component', () => {
    const blocker = addBlocker({ isLocked: true });
    const hasOpenable = evaluateCondition('locks:blocker-has-openable', {
      entity: { blocker: services.entityManager.getEntityInstance(blocker.id) },
    });
    const missingOpenable = evaluateCondition('locks:blocker-has-openable', {
      entity: { blocker: 'locks:missing_blocker' },
    });

    expect(hasOpenable).toBe(true);
    expect(missingOpenable).toBe(false);
  });

  it('identifies locked vs unlocked blockers', () => {
    const blocker = addBlocker({ isLocked: true });
    const locked = evaluateCondition('locks:blocker-is-locked', {
      entity: { blocker: services.entityManager.getEntityInstance(blocker.id) },
    });
    const unlocked = evaluateCondition('locks:blocker-is-unlocked', {
      entity: { blocker: services.entityManager.getEntityInstance(blocker.id) },
    });

    expect(locked).toBe(true);
    expect(unlocked).toBe(false);
  });

  it('requires the actor to hold the required key', () => {
    const blocker = addBlocker({ isLocked: true });
    const actorWithKey = addActor(['items:test_key'], 'actor:with_key');
    const actorWithoutKey = addActor([], 'actor:without_key');

    const hasKey = evaluateCondition('locks:actor-has-key-for-blocker', {
      entity: { blocker: services.entityManager.getEntityInstance(blocker.id) },
      actor: actorWithKey,
    });
    const missingKey = evaluateCondition('locks:actor-has-key-for-blocker', {
      entity: { blocker: services.entityManager.getEntityInstance(blocker.id) },
      actor: actorWithoutKey,
    });

    expect(hasKey).toBe(true);
    expect(missingKey).toBe(false);
  });

  it('matches lock/unlock action events', () => {
    const lockEvent = evaluateCondition('locks:event-is-action-lock-connection', {
      event: { payload: { actionId: 'locks:lock_connection' } },
    });
    const unlockEvent = evaluateCondition('locks:event-is-action-unlock-connection', {
      event: { payload: { actionId: 'locks:unlock_connection' } },
    });
    const unrelated = evaluateCondition('locks:event-is-action-lock-connection', {
      event: { payload: { actionId: 'locks:unlock_connection' } },
    });

    expect(lockEvent).toBe(true);
    expect(unlockEvent).toBe(true);
    expect(unrelated).toBe(false);
  });
});
