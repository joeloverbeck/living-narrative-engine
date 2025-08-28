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
    store: function(collection, key, value) {
      if (!this.data.has(collection)) {
        this.data.set(collection, new Map());
      }
      this.data.get(collection).set(key, value);
    },
    get: function(collection, key) {
      return this.data.get(collection)?.get(key);
    },
    clear: function() {
      this.data.clear();
    },
  };
  
  // Minimal entity storage
  const entities = new Map();
  
  // Simple entity manager
  const entityManager = {
    entities: entities,
    clear: function() { 
      entities.clear(); 
    },
    getEntities: function() {
      return Array.from(entities.values());
    },
    createEntityInstance: async function(id, config) {
      if (entities.has(id)) {
        throw new Error(`Entity ${id} already exists`);
      }
      const entity = {
        id: id,
        ...config,
        components: new Map(),
        getComponentData: function(componentId) {
          return this.components.get(componentId);
        },
      };
      entities.set(id, entity);
      return entity;
    },
    getEntityInstance: function(id) {
      return entities.get(id);
    },
    getEntity: function(id) {
      return entities.get(id);
    },
    hasComponent: function(entityId, componentId) {
      const entity = entities.get(entityId);
      return entity?.components?.has(componentId) || false;
    },
    getComponentData: function(entityId, componentId) {
      const entity = entities.get(entityId);
      return entity?.components?.get(componentId);
    },
    getEntitiesWithComponent: function(componentId) {
      const result = [];
      for (const entity of entities.values()) {
        if (entity.components?.has(componentId)) {
          result.push(entity);
        }
      }
      return result;
    },
    initialize: async function() {
      // No-op for minimal container
    },
  };
  
  // Simple JSON Logic evaluator
  const jsonLogicService = {
    evaluate: function(logic, data) {
      // For performance tests, just do simple comparisons
      if (logic?.condition_ref) {
        // Skip condition references in minimal mode
        return Math.random() > 0.5;
      }
      if (logic && logic['>']) {
        const [varPath, value] = logic['>'];
        if (varPath?.var) {
          // Simple evaluation - just return random for performance testing
          return Math.random() > 0.5;
        }
      }
      if (logic?.and) {
        // Simple AND logic
        return Math.random() > 0.7;
      }
      if (logic?.or) {
        // Simple OR logic
        return Math.random() > 0.3;
      }
      return true;
    },
  };
  
  // Simple DSL parser
  const dslParser = {
    parse: function(expr) {
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
    initialize: function(scopeList) {
      for (const scope of scopeList) {
        scopes.set(scope.id, scope);
      }
    },
    getScopeAst: function(id) {
      const scope = scopes.get(id);
      return scope?.ast || scope;
    },
    clear: function() {
      scopes.clear();
    },
  };
  
  // Simple scope engine
  const scopeEngine = {
    resolve: async function(ast, context) {
      // Simple resolution for performance testing
      const entityCount = context?.gameContext?.entityManager?.getEntities()?.length || 0;
      const result = new Set();
      
      // Add some entities based on the filter complexity
      const passRate = Math.random() * 0.5 + 0.1; // 10-60% pass rate
      const entitiesToAdd = Math.floor(entityCount * passRate);
      
      const entities = context?.gameContext?.entityManager?.getEntities() || [];
      for (let i = 0; i < Math.min(entitiesToAdd, entities.length); i++) {
        result.add(entities[i]?.id || entities[i]);
      }
      
      return result;
    },
  };
  
  // Minimal container
  const container = {
    services: new Map(),
    register: function(token, service) {
      this.services.set(token, service);
    },
    resolve: function(token) {
      return this.services.get(token);
    },
    cleanup: function() {
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