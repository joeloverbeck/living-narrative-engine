import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import { createMinimalTestContainer } from '../../../common/scopeDsl/minimalTestContainer.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import { HasComponentOperator } from '../../../../src/logic/operators/hasComponentOperator.js';
import { UnifiedScopeResolver } from '../../../../src/actions/scopes/unifiedScopeResolver.js';
import { parseScopeDefinitions } from '../../../../src/scopeDsl/scopeDefinitionParser.js';

const SCOPES_DIR = path.resolve(
  process.cwd(),
  'data/mods/locks/scopes',
);
const CONDITIONS_DIR = path.resolve(
  process.cwd(),
  'data/mods/locks/conditions',
);

function loadScopeDefinition(scopeName) {
  const filename = scopeName.replace('locks:', '') + '.scope';
  const scopePath = path.join(SCOPES_DIR, filename);
  const parsed = parseScopeDefinitions(
    fs.readFileSync(scopePath, 'utf8'),
    scopePath,
  );
  return parsed.get(scopeName);
}

function loadConditionDefinitions(dataRegistry) {
  const conditionFiles = [
    'blocker-has-openable.condition.json',
    'blocker-is-locked.condition.json',
    'blocker-is-unlocked.condition.json',
    'actor-has-key-for-blocker.condition.json',
  ];

  conditionFiles.forEach((file) => {
    const condition = JSON.parse(
      fs.readFileSync(path.join(CONDITIONS_DIR, file), 'utf8'),
    );
    dataRegistry.store('conditions', condition.id, condition);
  });
}

async function createResolver() {
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

  loadConditionDefinitions(services.dataRegistry);

  services.scopeRegistry.initialize({
    'locks:blockers_actor_can_unlock': loadScopeDefinition(
      'locks:blockers_actor_can_unlock'
    ),
    'locks:blockers_actor_can_lock': loadScopeDefinition(
      'locks:blockers_actor_can_lock'
    ),
    'locks:keys_for_blocker': loadScopeDefinition(
      'locks:keys_for_blocker'
    ),
  });

  const resolver = new UnifiedScopeResolver({
    scopeRegistry: services.scopeRegistry,
    scopeEngine: services.scopeEngine,
    entityManager: services.entityManager,
    jsonLogicEvaluationService: jsonLogicEval,
    dslParser: services.dslParser,
    logger: services.logger,
    actionErrorContextBuilder: {
      buildErrorContext: (data) => data,
    },
  });

  return { services: { ...services, jsonLogicEval }, resolver, cleanup };
}

describe('Locks scopes', () => {
  let resolver;
  let services;
  let cleanup;

  beforeAll(async () => {
    const setup = await createResolver();
    resolver = setup.resolver;
    services = setup.services;
    cleanup = setup.cleanup;
  });

  afterAll(async () => {
    await cleanup?.();
  });

  beforeEach(() => {
    // Clear entities between tests
    for (const id of services.entityManager.getEntityIds()) {
      services.entityManager.deleteEntity(id);
    }
  });

  function addCommonEntities() {
    const location = {
      id: 'room1',
      components: {
        'movement:exits': [
          {
            direction: 'north',
            target: 'room2',
            blocker: 'locks:blocker_locked',
          },
          {
            direction: 'east',
            target: 'room3',
            blocker: 'locks:blocker_unlocked',
          },
        ],
      },
    };

    const lockedBlocker = {
      id: 'locks:blocker_locked',
      components: {
        'mechanisms:openable': {
          isLocked: true,
          requiredKeyId: 'items:keycard_alpha',
        },
      },
    };

    const unlockedBlocker = {
      id: 'locks:blocker_unlocked',
      components: {
        'mechanisms:openable': {
          isLocked: false,
          requiredKeyId: 'items:keycard_alpha',
        },
      },
    };

    const keyItem = {
      id: 'items:keycard_alpha',
      components: {
        'items:item': {},
        'items:portable': {},
        'items:weight': { weight: 0.1 },
      },
    };

    services.entityManager.addEntity(location);
    services.entityManager.addEntity(lockedBlocker);
    services.entityManager.addEntity(unlockedBlocker);
    services.entityManager.addEntity(keyItem);
  }

  function createActor(withKey = true) {
    const inventoryItems = withKey ? ['items:keycard_alpha'] : [];
    const actor = {
      id: 'actor:locks_tester',
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

  it('exposes locked blockers the actor can unlock', () => {
    addCommonEntities();
    const actor = createActor(true);

    const actorHasKeyCondition = services.dataRegistry.getConditionDefinition(
      'locks:actor-has-key-for-blocker',
    );
    const resultWithId = services.jsonLogicEval.evaluate(
      actorHasKeyCondition.logic,
      { actor, entity: { blocker: 'locks:blocker_locked' } },
    );
    const resultWithEntity = services.jsonLogicEval.evaluate(
      actorHasKeyCondition.logic,
      {
        actor,
        entity: {
          blocker: services.entityManager.getEntityInstance('locks:blocker_locked'),
        },
      },
    );
    expect(resultWithId).toBe(true);
    expect(resultWithEntity).toBe(true);

    const result = resolver.resolveSync('locks:blockers_actor_can_unlock', {
      actor,
      actorLocation: actor.components['core:position'].locationId,
    });

    expect(Array.from(result)).toContain('locks:blocker_locked');
    expect(Array.from(result)).not.toContain('locks:blocker_unlocked');
  });

  it('exposes unlocked blockers the actor can lock', () => {
    addCommonEntities();
    const actor = createActor(true);

    const result = resolver.resolveSync('locks:blockers_actor_can_lock', {
      actor,
      actorLocation: actor.components['core:position'].locationId,
    });

    expect(Array.from(result)).toContain('locks:blocker_unlocked');
    expect(Array.from(result)).not.toContain('locks:blocker_locked');
  });

  it('returns no blockers when the actor lacks the required key', () => {
    addCommonEntities();
    const actor = createActor(false);

    const unlockable = resolver.resolveSync('locks:blockers_actor_can_unlock', {
      actor,
      actorLocation: actor.components['core:position'].locationId,
    });
    const lockable = resolver.resolveSync('locks:blockers_actor_can_lock', {
      actor,
      actorLocation: actor.components['core:position'].locationId,
    });

    expect(unlockable.size).toBe(0);
    expect(lockable.size).toBe(0);
  });

  it('resolves keys for the selected blocker via contextFrom target', () => {
    addCommonEntities();
    const actor = createActor(true);
    const targetBlocker = services.entityManager.getEntityInstance(
      'locks:blocker_locked',
    );

    const keys = resolver.resolveSync('locks:keys_for_blocker', {
      actor,
      actorLocation: actor.components['core:position'].locationId,
      target: targetBlocker,
    });

    expect(Array.from(keys)).toEqual(['items:keycard_alpha']);
  });
});
