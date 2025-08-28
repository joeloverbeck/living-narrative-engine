/**
 * @file Ultra-light Container for Performance Tests
 *
 * A truly minimal container that only has the bare essentials for scope resolution,
 * avoiding ALL heavy initialization.
 */

import { tokens } from '../../../src/dependencyInjection/tokens.js';

/**
 * Creates an ultra-lightweight mock container for performance testing
 *
 * @returns {object} Mock container with only essential services
 */
export function createUltraLightContainer() {
  // Simple mock logger
  const logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  };

  // Simple data registry
  const dataRegistry = {
    data: new Map(),
    store: function (collection, key, value) {
      if (!this.data.has(collection)) {
        this.data.set(collection, new Map());
      }
      this.data.get(collection).set(key, value);
    },
    get: function (collection, key) {
      return this.data.get(collection)?.get(key);
    },
    clear: function () {
      this.data.clear();
    },
  };

  // Minimal entity storage
  const entities = new Map();

  // Simple entity manager
  const entityManager = {
    entities: entities,
    clear: function () {
      entities.clear();
    },
    getEntities: function () {
      return Array.from(entities.values());
    },
    createEntityInstance: async function (id, config) {
      if (entities.has(id)) {
        throw new Error(`Entity ${id} already exists`);
      }

      // Get entity definition from registry
      const definition = dataRegistry.get('entityDefinitions', id);
      if (!definition) {
        throw new Error(`Entity definition not found: ${id}`);
      }

      const entity = {
        id: id,
        ...config,
        components: new Map(),
        getComponentData: function (componentId) {
          return this.components.get(componentId);
        },
        // Add support for component access patterns used by scope resolution
        hasComponent: function (componentId) {
          return this.components.has(componentId);
        },
      };

      // Copy components from definition to entity instance
      if (definition.components) {
        for (const [componentId, componentData] of Object.entries(
          definition.components
        )) {
          entity.components.set(componentId, componentData);
        }
      }

      entities.set(id, entity);
      return entity;
    },
    getEntityInstance: function (id) {
      return entities.get(id);
    },
    getEntity: function (id) {
      return entities.get(id);
    },
    hasComponent: function (entityId, componentId) {
      const entity = entities.get(entityId);
      return entity?.components?.has(componentId) || false;
    },
    getComponentData: function (entityId, componentId) {
      const entity = entities.get(entityId);
      return entity?.components?.get(componentId);
    },
    getEntitiesWithComponent: function (componentId) {
      const result = [];
      for (const entity of entities.values()) {
        if (entity.components?.has(componentId)) {
          result.push(entity);
        }
      }
      return result;
    },
    initialize: async function () {
      // No-op for minimal container
    },
  };

  // Simple JSON Logic evaluator
  const jsonLogicService = {
    evaluate: function (logic, data) {
      // For performance tests, evaluate basic logic patterns used in tests
      if (!logic || !data) {
        return false;
      }

      if (logic.condition_ref) {
        // Look up condition by reference from registry
        const condition = dataRegistry.get('conditions', logic.condition_ref);
        if (condition) {
          return this.evaluate(condition.logic, data);
        }
        return Math.random() > 0.5; // Fallback for missing conditions
      }

      // Handle comparison operators
      if (logic['>']) {
        const [varPath, value] = logic['>'];
        if (varPath?.var) {
          const actualValue = this._getNestedValue(data, varPath.var);
          return actualValue != null ? actualValue > value : false;
        }
      }

      if (logic['>=']) {
        const [varPath, value] = logic['>='];
        if (varPath?.var) {
          const actualValue = this._getNestedValue(data, varPath.var);
          return actualValue != null ? actualValue >= value : false;
        }
      }

      if (logic['<']) {
        const [varPath, value] = logic['<'];
        if (varPath?.var) {
          const actualValue = this._getNestedValue(data, varPath.var);
          return actualValue != null ? actualValue < value : false;
        }
      }

      if (logic['<=']) {
        const [varPath, value] = logic['<='];
        if (varPath?.var) {
          const actualValue = this._getNestedValue(data, varPath.var);
          return actualValue != null ? actualValue <= value : false;
        }
      }

      if (logic['==']) {
        const [varPath, value] = logic['=='];
        if (varPath?.var) {
          const actualValue = this._getNestedValue(data, varPath.var);
          return actualValue === value;
        }
      }

      if (logic['!=']) {
        const [varPath, value] = logic['!='];
        if (varPath?.var) {
          const actualValue = this._getNestedValue(data, varPath.var);
          return actualValue !== value;
        }
      }

      // Handle logical operators
      if (logic.and) {
        return logic.and.every((condition) => this.evaluate(condition, data));
      }

      if (logic.or) {
        return logic.or.some((condition) => this.evaluate(condition, data));
      }

      // Handle arithmetic operators
      if (logic['+']) {
        const values = logic['+'].map((operand) => {
          if (operand?.var) {
            return this._getNestedValue(data, operand.var) || 0;
          }
          return operand || 0;
        });
        return values.reduce((sum, val) => sum + val, 0);
      }

      if (logic['*']) {
        const values = logic['*'].map((operand) => {
          if (operand?.var) {
            return this._getNestedValue(data, operand.var) || 0;
          }
          return operand || 0;
        });
        return values.reduce((product, val) => product * val, 1);
      }

      if (logic['/']) {
        const [numerator, denominator] = logic['/'];
        const numValue = numerator?.var
          ? this._getNestedValue(data, numerator.var)
          : numerator;
        const denValue = denominator?.var
          ? this._getNestedValue(data, denominator.var)
          : denominator;
        return denValue !== 0 ? numValue / denValue : 0;
      }

      return false;
    },

    _getNestedValue: function (obj, path) {
      // Handle nested property access like 'entity.components.core:stats.level'
      const parts = path.split('.');
      let current = obj;

      for (const part of parts) {
        if (current == null) return null;
        current = current[part];
      }

      return current;
    },
  };

  // Simple DSL parser
  const dslParser = {
    parse: function (expr) {
      // Return minimal AST for testing
      if (expr === 'actor') {
        return { type: 'Source', kind: 'actor' };
      }
      if (expr.startsWith('entities')) {
        return { type: 'Source', kind: 'entities', param: 'core:actor' };
      }
      return { type: 'Source', kind: 'unknown' };
    },
  };

  // Simple scope registry
  const scopes = new Map();
  const scopeRegistry = {
    initialize: function (scopeList) {
      // Handle both array and object formats
      if (Array.isArray(scopeList)) {
        for (const scope of scopeList) {
          scopes.set(scope.id, scope);
        }
      } else if (scopeList && typeof scopeList === 'object') {
        // Handle object format: { scopeId: scopeDefinition, ... }
        for (const [key, scope] of Object.entries(scopeList)) {
          scopes.set(key, scope);
        }
      }
    },
    getScope: function (id) {
      return scopes.get(id);
    },
    getScopeAst: function (id) {
      const scope = scopes.get(id);
      return scope?.ast || scope;
    },
    hasScope: function (id) {
      return scopes.has(id);
    },
    getAllScopeNames: function () {
      return Array.from(scopes.keys());
    },
    getAllScopes: function () {
      return new Map(scopes);
    },
    getStats: function () {
      return {
        totalScopes: scopes.size,
        scopeIds: Array.from(scopes.keys()),
      };
    },
    clear: function () {
      scopes.clear();
    },
  };

  // Simple scope engine
  const scopeEngine = {
    resolve: async function (ast, actorEntity, runtimeCtx, trace = null) {
      // Simple resolution for performance testing
      // Match actual ScopeEngine.resolve(ast, actorEntity, runtimeCtx, trace) signature

      // Access entity manager from runtimeCtx (correct path)
      const entityManager = runtimeCtx?.entityManager;
      const entityCount = entityManager?.getEntities()?.length || 0;
      const result = new Set();

      // Add some entities based on the filter complexity
      const passRate = Math.random() * 0.5 + 0.1; // 10-60% pass rate
      const entitiesToAdd = Math.floor(entityCount * passRate);

      const entities = entityManager?.getEntities() || [];
      for (let i = 0; i < Math.min(entitiesToAdd, entities.length); i++) {
        result.add(entities[i]?.id || entities[i]);
      }

      return result;
    },
  };

  // Minimal container
  const container = {
    services: new Map(),
    register: function (token, service) {
      this.services.set(token, service);
    },
    resolve: function (token) {
      return this.services.get(token);
    },
    cleanup: function () {
      entityManager.clear();
      dataRegistry.clear();
      scopeRegistry.clear();
    },
  };

  // Register all services
  container.register(tokens.ILogger, logger);
  container.register(tokens.IDataRegistry, dataRegistry);
  container.register(tokens.IEntityManager, entityManager);
  container.register(tokens.JsonLogicEvaluationService, jsonLogicService);
  container.register(tokens.DslParser, dslParser);
  container.register(tokens.IScopeRegistry, scopeRegistry);
  container.register(tokens.IScopeEngine, scopeEngine);
  container.register(tokens.ISpatialIndexManager, {});

  return container;
}
