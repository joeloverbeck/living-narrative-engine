/**
 * @jest-environment node
 * @file Integration tests for breaching-states mod scopes
 * @description Tests the breached_blockers_at_location scope
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import { parseScopeDefinitions } from '../../../../src/scopeDsl/scopeDefinitionParser.js';
import { clearEntityCache } from '../../../../src/scopeDsl/core/entityHelpers.js';

describe('Breaching-States Mod Scopes', () => {
  let scopeEngine;
  let scopeRegistry;
  let mockLogger;
  let mockEntityManager;

  const createEntityInstance = (id, components) => ({
    id,
    components: components || {},
  });

  const normalizeScopeResults = (resultSet) => {
    return Array.from(resultSet)
      .map((entry) => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object' && typeof entry.id === 'string')
          return entry.id;
        return null;
      })
      .filter((id) => typeof id === 'string' && id.length > 0);
  };

  beforeEach(() => {
    clearEntityCache();
    mockLogger = {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };

    const entities = new Map();

    mockEntityManager = {
      getComponentData: (entityId, componentId) => {
        const entity = entities.get(entityId);
        if (entity && entity.components) {
          return entity.components[componentId] || null;
        }
        return null;
      },
      getEntityInstance: (entityId) => entities.get(entityId) || null,
      _addEntity: (entity) => entities.set(entity.id, entity),
      _clear: () => entities.clear(),
      getEntities: () => Array.from(entities.values()),
    };

    scopeRegistry = new ScopeRegistry();

    // Load breaching-states scopes
    const breachedScopePath = new URL(
      '../../../../data/mods/breaching-states/scopes/breached_blockers_at_location.scope',
      import.meta.url
    );

    const breachedScopes = parseScopeDefinitions(
      readFileSync(breachedScopePath, 'utf8'),
      breachedScopePath.pathname
    );

    const scopeDefinitions = {
      ...Object.fromEntries(breachedScopes),
    };

    const parsedScopes = {};
    for (const [scopeId, scopeDef] of Object.entries(scopeDefinitions)) {
      const [modId] = scopeId.split(':');
      parsedScopes[scopeId] = {
        expr: scopeDef.expr,
        definition: { id: scopeId },
        modId: modId || 'core',
        ast: scopeDef.ast,
      };
    }

    scopeRegistry.initialize(parsedScopes);

    scopeEngine = new ScopeEngine({
      scopeRegistry,
      logger: mockLogger,
    });
  });

  const createJsonLogicEvalMock = (runtimeCtx) => ({
    evaluate: (logic, context) => {
      const data = context;
      let result;

      if (logic['!!']) {
        const operand = Array.isArray(logic['!!']) ? logic['!!'][0] : logic['!!'];
        result = !!runtimeCtx.jsonLogicEval.evaluate(operand, context);
      } else if (logic['not']) {
        result = !runtimeCtx.jsonLogicEval.evaluate(logic['not'], context);
      } else if (logic['!']) {
        result = !runtimeCtx.jsonLogicEval.evaluate(logic['!'][0], context);
      } else if (logic['and']) {
        result = logic['and'].every((l) =>
          runtimeCtx.jsonLogicEval.evaluate(l, context)
        );
      } else if (logic['or']) {
        result = logic['or'].some((l) =>
          runtimeCtx.jsonLogicEval.evaluate(l, context)
        );
      } else if (logic['==']) {
        const a = runtimeCtx.jsonLogicEval.evaluate(logic['=='][0], context);
        const b = logic['=='][1];
        result = a == b;
      } else if (logic['var']) {
        const path = logic['var'];
        if (path.includes('.')) {
          const parts = path.split('.');
          let current = data;
          for (const part of parts) {
            if (current === undefined || current === null) {
              current = null;
              break;
            }
            current = current[part];
          }
          result = current;
        } else {
          result = data[path] !== undefined ? data[path] : null;
        }
      } else {
        result = logic;
      }

      return result;
    },
  });

  describe('breaching-states:breached_blockers_at_location', () => {
    test('should return breached blockers from location exits', () => {
      const breachedBlocker = createEntityInstance('blocker-1', {
        'breaching-states:breached': {},
      });
      const intactBlocker = createEntityInstance('blocker-2', {});

      const location = createEntityInstance('location-1', {
        'locations:exits': [
          { blocker: 'blocker-1' },
          { blocker: 'blocker-2' },
        ],
      });

      const actor = createEntityInstance('actor-1', {
        'core:actor': { name: 'Test Actor' },
      });

      mockEntityManager._addEntity(breachedBlocker);
      mockEntityManager._addEntity(intactBlocker);
      mockEntityManager._addEntity(location);
      mockEntityManager._addEntity(actor);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
        location,
      };
      runtimeCtx.jsonLogicEval = createJsonLogicEvalMock(runtimeCtx);

      const scopeDef = scopeRegistry.getScope(
        'breaching-states:breached_blockers_at_location'
      );
      const result = scopeEngine.resolve(scopeDef.ast, actor, runtimeCtx);

      const normalized = normalizeScopeResults(result);
      expect(normalized).toContain('blocker-1');
      expect(normalized).not.toContain('blocker-2');
    });

    test('should return empty set when no blockers are breached', () => {
      const intactBlocker1 = createEntityInstance('blocker-1', {});
      const intactBlocker2 = createEntityInstance('blocker-2', {});

      const location = createEntityInstance('location-1', {
        'locations:exits': [
          { blocker: 'blocker-1' },
          { blocker: 'blocker-2' },
        ],
      });

      const actor = createEntityInstance('actor-1', {
        'core:actor': { name: 'Test Actor' },
      });

      mockEntityManager._addEntity(intactBlocker1);
      mockEntityManager._addEntity(intactBlocker2);
      mockEntityManager._addEntity(location);
      mockEntityManager._addEntity(actor);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
        location,
      };
      runtimeCtx.jsonLogicEval = createJsonLogicEvalMock(runtimeCtx);

      const scopeDef = scopeRegistry.getScope(
        'breaching-states:breached_blockers_at_location'
      );
      const result = scopeEngine.resolve(scopeDef.ast, actor, runtimeCtx);

      const normalized = normalizeScopeResults(result);
      expect(normalized).toHaveLength(0);
    });
  });
});
