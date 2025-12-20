/**
 * @jest-environment node
 * @file Integration tests for breaching mod scopes
 * @description Tests the sawable_barred_blockers and abrasive_sawing_tools scopes
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { readFileSync } from 'fs';
import ScopeEngine from '../../../../src/scopeDsl/engine.js';
import ScopeRegistry from '../../../../src/scopeDsl/scopeRegistry.js';
import { parseScopeDefinitions } from '../../../../src/scopeDsl/scopeDefinitionParser.js';
import { clearEntityCache } from '../../../../src/scopeDsl/core/entityHelpers.js';

describe('Breaching Mod Scopes', () => {
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

    // Load scopes
    const sawableScopePath = new URL(
      '../../../../data/mods/blockers/scopes/sawable_barred_blockers.scope',
      import.meta.url
    );
    const abrasiveScopePath = new URL(
      '../../../../data/mods/breaching/scopes/abrasive_sawing_tools.scope',
      import.meta.url
    );

    const sawableScopes = parseScopeDefinitions(
      readFileSync(sawableScopePath, 'utf8'),
      sawableScopePath.pathname
    );
    const abrasiveScopes = parseScopeDefinitions(
      readFileSync(abrasiveScopePath, 'utf8'),
      abrasiveScopePath.pathname
    );

    const scopeDefinitions = {
      ...Object.fromEntries(sawableScopes),
      ...Object.fromEntries(abrasiveScopes),
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

      // Only log if specifically debugging
      return result;
    }
  });

  describe('blockers:sawable_barred_blockers', () => {
    test('should return barred blockers with structural resistance and no progress', () => {
      const blocker = createEntityInstance('blocker-1', {
        'blockers:is_barred': {},
        'blockers:structural_resistance': { value: 100 },
      });

      const location = createEntityInstance('location-1', {
        'locations:exits': [
          { blocker: 'blocker-1' }
        ]
      });

      const actor = createEntityInstance('actor-1', {
        'core:actor': { name: 'Test Actor' },
      });

      mockEntityManager._addEntity(blocker);
      mockEntityManager._addEntity(location);
      mockEntityManager._addEntity(actor);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
        location,
      };
      runtimeCtx.jsonLogicEval = createJsonLogicEvalMock(runtimeCtx);

      const scopeDef = scopeRegistry.getScope('blockers:sawable_barred_blockers');
      const result = scopeEngine.resolve(scopeDef.ast, actor, runtimeCtx);

      const normalized = normalizeScopeResults(result);
      expect(normalized).toContain('blocker-1');
    });

    test('should return barred blockers with structural resistance and progress 0', () => {
      const blocker = createEntityInstance('blocker-1', {
        'blockers:is_barred': {},
        'blockers:structural_resistance': { value: 100 },
        'core:progress_tracker': { value: 0 }
      });

      const location = createEntityInstance('location-1', {
        'locations:exits': [
          { blocker: 'blocker-1' }
        ]
      });

      const actor = createEntityInstance('actor-1', {
        'core:actor': { name: 'Test Actor' },
      });

      mockEntityManager._addEntity(blocker);
      mockEntityManager._addEntity(location);
      mockEntityManager._addEntity(actor);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
        location,
      };
      runtimeCtx.jsonLogicEval = createJsonLogicEvalMock(runtimeCtx);

      const scopeDef = scopeRegistry.getScope('blockers:sawable_barred_blockers');
      const result = scopeEngine.resolve(scopeDef.ast, actor, runtimeCtx);

      const normalized = normalizeScopeResults(result);
      expect(normalized).toContain('blocker-1');
    });

    test('should exclude blockers with progress > 0', () => {
      const blocker = createEntityInstance('blocker-1', {
        'blockers:is_barred': {},
        'blockers:structural_resistance': { value: 100 },
        'core:progress_tracker': { value: 1 }
      });

      const location = createEntityInstance('location-1', {
        'locations:exits': [
          { blocker: 'blocker-1' }
        ]
      });

      const actor = createEntityInstance('actor-1', {
        'core:actor': { name: 'Test Actor' },
      });

      mockEntityManager._addEntity(blocker);
      mockEntityManager._addEntity(location);
      mockEntityManager._addEntity(actor);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
        location,
      };
      runtimeCtx.jsonLogicEval = createJsonLogicEvalMock(runtimeCtx);

      const scopeDef = scopeRegistry.getScope('blockers:sawable_barred_blockers');
      const result = scopeEngine.resolve(scopeDef.ast, actor, runtimeCtx);

      const normalized = normalizeScopeResults(result);
      expect(normalized).not.toContain('blocker-1');
    });
  });

  describe('breaching:abrasive_sawing_tools', () => {
    test('should return inventory items with allowed abrasive sawing component', () => {
      const hacksaw = createEntityInstance('tools:hacksaw', {
        'breaching:allows_abrasive_sawing': {},
      });
      
      const hammer = createEntityInstance('tools:hammer', {
      });

      const actor = createEntityInstance('actor-1', {
        'core:actor': { name: 'Test Actor' },
        'items:inventory': {
          items: ['tools:hacksaw', 'tools:hammer']
        }
      });

      mockEntityManager._addEntity(hacksaw);
      mockEntityManager._addEntity(hammer);
      mockEntityManager._addEntity(actor);

      const runtimeCtx = {
        entityManager: mockEntityManager,
        logger: mockLogger,
        actor,
      };
      runtimeCtx.jsonLogicEval = createJsonLogicEvalMock(runtimeCtx);

      const scopeDef = scopeRegistry.getScope('breaching:abrasive_sawing_tools');
      const result = scopeEngine.resolve(scopeDef.ast, actor, runtimeCtx);

      const normalized = normalizeScopeResults(result);
      expect(normalized).toContain('tools:hacksaw');
      expect(normalized).not.toContain('tools:hammer');
    });
  });
});
