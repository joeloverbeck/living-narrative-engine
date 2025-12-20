import { describe, it, expect } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

const MOVEMENT_CONDITIONS_DIR = path.resolve(
  process.cwd(),
  'data/mods/movement/conditions'
);
const MOVEMENT_SCOPES_DIR = path.resolve(
  process.cwd(),
  'data/mods/movement/scopes'
);

// Helper to load conditions/scopes
/**
 *
 */
function loadConditions() {
  const entries = fs
    .readdirSync(MOVEMENT_CONDITIONS_DIR)
    .filter((f) => f.endsWith('.condition.json'))
    .map((f) => {
      const content = JSON.parse(
        fs.readFileSync(path.join(MOVEMENT_CONDITIONS_DIR, f), 'utf8')
      );
      return [content.id, content];
    });
  return Object.fromEntries(entries);
}

/**
 *
 */
function loadScopes() {
  const scopeDefs = {};
  const files = fs
    .readdirSync(MOVEMENT_SCOPES_DIR)
    .filter((f) => f.endsWith('.scope'));
  for (const f of files) {
    const p = path.join(MOVEMENT_SCOPES_DIR, f);
    const parsed = parseScopeDefinitions(fs.readFileSync(p, 'utf8'), p);
    for (const [name, data] of parsed.entries()) {
      scopeDefs[name] = { id: name, ...data };
    }
  }
  return scopeDefs;
}

/**
 *
 * @param root0
 * @param root0.isLocked
 * @param root0.hasOpenable
 */
function buildEntityManager({ isLocked, hasOpenable }) {
  const blocker = {
    id: 'blocker1',
    components: {
      'core:name': { text: 'Door' },
    },
  };

  if (hasOpenable) {
    blocker.components['mechanisms:openable'] = {
      isLocked,
      requiredKeyId: 'key1',
    };
  }

  const location = {
    id: 'room1',
    components: {
      'core:location': {},
      'locations:exits': [
        { direction: 'north', target: 'room2', blocker: blocker.id },
      ],
    },
  };

  // Need target room too? Scope just returns the ID, doesn't check target room existence usually unless specified.
  // But let's add it just in case.
  const room2 = {
    id: 'room2',
    components: { 'core:location': {} },
  };

  const actor = {
    id: 'actor1',
    components: {
      'core:actor': {},
      'core:position': { locationId: 'room1' },
    },
  };

  return new SimpleEntityManager([actor, blocker, location, room2]);
}

describe('Movement visibility integration', () => {
  const logger = new ConsoleLogger('ERROR');
  const conditions = loadConditions();
  const scopes = loadScopes();

  /**
   *
   * @param root0
   * @param root0.isLocked
   * @param root0.hasOpenable
   */
  function createHarness({ isLocked, hasOpenable }) {
    const entityManager = buildEntityManager({ isLocked, hasOpenable });
    const jsonLogicEval = new JsonLogicEvaluationService({
      logger,
      gameDataRepository: { getConditionDefinition: (id) => conditions[id] },
    });

    // Register get_component_value
    jsonLogicEval.addOperation(
      'get_component_value',
      (entityRef, componentId, propertyPath = null) => {
        const entityId =
          typeof entityRef === 'string' ? entityRef : entityRef?.id;
        if (!entityId) return null;
        const data = entityManager.getComponentData(entityId, componentId);
        if (!data || typeof data !== 'object') return null;
        if (!propertyPath) return data;
        return propertyPath.split('.').reduce((v, k) => v && v[k], data);
      }
    );

    // Register has_component
    jsonLogicEval.addOperation('has_component', (entityRef, componentId) => {
      const entityId =
        typeof entityRef === 'string' ? entityRef : entityRef?.id;
      return !!entityManager.getComponentData(entityId, componentId);
    });

    const scopeRegistry = new ScopeRegistry({ logger });
    scopeRegistry.initialize(scopes);
    const scopeEngine = new ScopeEngine({ scopeRegistry });

    const actor = entityManager.getEntityInstance('actor1');
    const runtimeCtx = {
      entityManager,
      logger,
      actor,
      jsonLogicEval,
      location: entityManager.getEntityInstance('room1'),
    };

    /**
     *
     * @param scopeName
     */
    function resolve(scopeName) {
      return scopeEngine.resolve(
        scopeRegistry.getScope(scopeName).ast,
        actor,
        runtimeCtx
      );
    }

    return { resolve };
  }

  it('shows exit when blocker is not openable (legacy behavior)', async () => {
    const { resolve } = createHarness({ hasOpenable: false });
    const results = await resolve('movement:clear_directions');
    const dirs = Array.from(results);
    expect(dirs).toContain('room2');
  });

  it('shows exit when blocker is openable and unlocked', async () => {
    const { resolve } = createHarness({ hasOpenable: true, isLocked: false });
    const results = await resolve('movement:clear_directions');
    const dirs = Array.from(results);
    expect(dirs).toContain('room2');
  });

  it('hides exit when blocker is openable and locked', async () => {
    const { resolve } = createHarness({ hasOpenable: true, isLocked: true });
    const results = await resolve('movement:clear_directions');
    const dirs = Array.from(results);
    expect(dirs).not.toContain('room2');
  });
});
