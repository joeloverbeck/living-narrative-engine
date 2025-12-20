import { describe, it, expect, beforeAll } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

const CONDITIONS_DIR = path.resolve(
  process.cwd(),
  'data/mods/locks/conditions'
);
const SCOPES_DIR = path.resolve(process.cwd(), 'data/mods/locks/scopes');
const ACTIONS_DIR = path.resolve(process.cwd(), 'data/mods/locks/actions');

/**
 *
 */
function loadConditions() {
  const entries = fs
    .readdirSync(CONDITIONS_DIR)
    .filter((file) => file.endsWith('.condition.json'))
    .map((file) => {
      const condition = JSON.parse(
        fs.readFileSync(path.join(CONDITIONS_DIR, file), 'utf8')
      );
      return [condition.id, condition];
    });

  return Object.fromEntries(entries);
}

/**
 *
 */
function loadScopes() {
  const scopeDefs = {};
  const files = fs
    .readdirSync(SCOPES_DIR)
    .filter((file) => file.endsWith('.scope'));

  for (const file of files) {
    const scopePath = path.join(SCOPES_DIR, file);
    const parsed = parseScopeDefinitions(
      fs.readFileSync(scopePath, 'utf8'),
      scopePath
    );

    for (const [name, data] of parsed.entries()) {
      scopeDefs[name] = { id: name, ...data };
    }
  }

  return scopeDefs;
}

/**
 *
 * @param actionFile
 */
function loadAction(actionFile) {
  return JSON.parse(
    fs.readFileSync(path.join(ACTIONS_DIR, actionFile), 'utf8')
  );
}

/**
 *
 * @param root0
 * @param root0.isLocked
 * @param root0.actorHasKey
 */
function buildEntityManager({ isLocked, actorHasKey }) {
  const blocker = {
    id: 'locks:test_blocker',
    components: {
      'mechanisms:openable': {
        isLocked,
        requiredKeyId: 'items:test_key',
      },
      'core:name': { text: 'Test Blocker' },
    },
  };

  const location = {
    id: 'locks:test_room',
    components: {
      'core:location': {},
      'locations:exits': [
        {
          direction: 'north',
          target: 'locks:other_room',
          blocker: blocker.id,
        },
      ],
    },
  };

  const actor = {
    id: 'actor:lock_tester',
    components: {
      'core:actor': {},
      'core:position': { locationId: location.id },
      'items:inventory': {
        items: actorHasKey ? ['items:test_key'] : [],
        capacity: { maxWeight: 10, maxItems: 5 },
      },
    },
  };

  return new SimpleEntityManager([actor, blocker, location]);
}

/**
 *
 * @param jsonLogicEval
 * @param entityManager
 */
function addJsonLogicOperations(jsonLogicEval, entityManager) {
  jsonLogicEval.addOperation('has_component', (entityRef, componentId) => {
    const entityId = typeof entityRef === 'string' ? entityRef : entityRef?.id;
    if (!entityId) return false;
    return !!entityManager.getComponentData(entityId, componentId);
  });

  jsonLogicEval.addOperation(
    'get_component_value',
    (entityRef, componentId, propertyPath = null) => {
      const entityId =
        typeof entityRef === 'string' ? entityRef : entityRef?.id;
      if (!entityId) return null;
      const data = entityManager.getComponentData(entityId, componentId);
      if (!data || typeof data !== 'object') {
        return null;
      }

      if (!propertyPath) {
        return data;
      }

      return propertyPath.split('.').reduce((value, key) => {
        if (value && Object.prototype.hasOwnProperty.call(value, key)) {
          return value[key];
        }
        return null;
      }, data);
    }
  );
}

/**
 *
 * @param result
 */
function toArray(result) {
  if (!result) return [];
  const raw =
    result instanceof Set
      ? Array.from(result)
      : Array.isArray(result)
        ? result
        : [result];

  return raw.map((value) => {
    if (value && typeof value === 'object') {
      if ('id' in value) return value.id;
      if ('entityId' in value) return value.entityId;
    }
    return value;
  });
}

describe('locks connection actions', () => {
  const logger = new ConsoleLogger('ERROR');
  const conditions = loadConditions();
  const scopeDefinitions = loadScopes();
  const lockAction = loadAction('lock_connection.action.json');
  const unlockAction = loadAction('unlock_connection.action.json');

  it('defines lock/unlock actions with the expected targets and prerequisites', () => {
    expect(lockAction.generateCombinations).toBe(true);
    expect(unlockAction.generateCombinations).toBe(true);

    expect(lockAction.required_components.actor).toEqual(
      expect.arrayContaining(['items:inventory', 'core:position'])
    );
    expect(unlockAction.required_components.actor).toEqual(
      expect.arrayContaining(['items:inventory', 'core:position'])
    );

    expect(lockAction.targets.primary.scope).toBe(
      'locks:blockers_actor_can_lock'
    );
    expect(unlockAction.targets.primary.scope).toBe(
      'locks:blockers_actor_can_unlock'
    );
    expect(lockAction.targets.secondary).toMatchObject({
      scope: 'locks:keys_for_blocker',
      contextFrom: 'primary',
    });
    expect(unlockAction.targets.secondary).toMatchObject({
      scope: 'locks:keys_for_blocker',
      contextFrom: 'primary',
    });

    expect(lockAction.template).toBe('lock {blocker} with {key}');
    expect(unlockAction.template).toBe('unlock {blocker} with {key}');
  });

  describe('scope-driven availability', () => {
    /**
     *
     * @param root0
     * @param root0.isLocked
     * @param root0.actorHasKey
     */
    function createScopeHarness({ isLocked, actorHasKey }) {
      const entityManager = buildEntityManager({ isLocked, actorHasKey });
      const jsonLogicEval = new JsonLogicEvaluationService({
        logger,
        gameDataRepository: {
          getConditionDefinition: (id) => conditions[id] || null,
        },
      });
      addJsonLogicOperations(jsonLogicEval, entityManager);

      const scopeRegistry = new ScopeRegistry({ logger });
      scopeRegistry.initialize(scopeDefinitions);
      const scopeEngine = new ScopeEngine({ scopeRegistry });

      const actor = entityManager.getEntityInstance('actor:lock_tester');
      const blocker = entityManager.getEntityInstance('locks:test_blocker');
      const runtimeCtx = {
        entityManager,
        logger,
        actor,
        jsonLogicEval,
        location: entityManager.getEntityInstance('locks:test_room'),
      };

      /**
       *
       * @param scopeName
       * @param extraCtx
       */
      function resolveScope(scopeName, extraCtx = {}) {
        const scope = scopeRegistry.getScope(scopeName);
        return scopeEngine.resolve(scope.ast, actor, {
          ...runtimeCtx,
          ...extraCtx,
        });
      }

      return { resolveScope, blocker };
    }

    it('surfaces unlock action targets when the blocker is locked and the actor has the key', async () => {
      const { resolveScope, blocker } = createScopeHarness({
        isLocked: true,
        actorHasKey: true,
      });

      const unlockTargets = await resolveScope(
        'locks:blockers_actor_can_unlock'
      );
      const lockTargets = await resolveScope('locks:blockers_actor_can_lock');
      const keyTargets = await resolveScope('locks:keys_for_blocker', {
        target: blocker,
      });

      expect(toArray(unlockTargets)).toContain('locks:test_blocker');
      expect(toArray(lockTargets)).toHaveLength(0);
      expect(toArray(keyTargets)).toEqual(['items:test_key']);
    });

    it('surfaces lock action targets when the blocker is unlocked and the actor has the key', async () => {
      const { resolveScope, blocker } = createScopeHarness({
        isLocked: false,
        actorHasKey: true,
      });

      const unlockTargets = await resolveScope(
        'locks:blockers_actor_can_unlock'
      );
      const lockTargets = await resolveScope('locks:blockers_actor_can_lock');
      const keyTargets = await resolveScope('locks:keys_for_blocker', {
        target: blocker,
      });

      expect(toArray(unlockTargets)).toHaveLength(0);
      expect(toArray(lockTargets)).toContain('locks:test_blocker');
      expect(toArray(keyTargets)).toEqual(['items:test_key']);
    });

    it('hides both actions when the actor lacks the matching key', async () => {
      const { resolveScope, blocker } = createScopeHarness({
        isLocked: true,
        actorHasKey: false,
      });

      const unlockTargets = await resolveScope(
        'locks:blockers_actor_can_unlock'
      );
      const lockTargets = await resolveScope('locks:blockers_actor_can_lock');
      const keyTargets = await resolveScope('locks:keys_for_blocker', {
        target: blocker,
      });

      expect(toArray(unlockTargets)).toHaveLength(0);
      expect(toArray(lockTargets)).toHaveLength(0);
      expect(toArray(keyTargets)).toHaveLength(0);
    });
  });
});
