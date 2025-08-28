/**
 * @file Minimal Container Factory for ScopeDSL Performance Tests
 * 
 * Creates a lightweight container with only the essential services needed
 * for scope resolution, avoiding the heavy initialization overhead of the
 * full application container.
 */

import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import EntityManager from '../../../src/entities/entityManager.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import DefaultDslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import ComponentRegistry from '../../../src/components/componentRegistry.js';
import SpatialIndexManager from '../../../src/spatial/spatialIndexManager.js';
import EventBus from '../../../src/events/eventBus.js';
import IdGenerator from '../../../src/utils/idGenerator.js';
import ComponentManager from '../../../src/entities/componentManager.js';
import { scopeDslErrorHandlerRegistrations } from '../../../src/dependencyInjection/registrations/scopeDslErrorHandlerRegistrations.js';

/**
 * Creates a minimal container optimized for ScopeDSL performance testing.
 * This factory avoids the overhead of:
 * - Full game system initialization
 * - UI component setup
 * - Mod loading
 * - Schema validation setup
 * - Prompt loading
 * - Complex event wiring
 * 
 * @returns {Promise<AppContainer>} Configured minimal container
 */
export async function createMinimalScopeContainer() {
  const container = new AppContainer();
  
  // Register minimal logger (silent for performance)
  const logger = new ConsoleLogger();
  logger.setLevel(LogLevel.ERROR); // Only log errors to reduce overhead
  container.register(tokens.ILogger, logger);
  
  // Register core data registry
  const dataRegistry = new InMemoryDataRegistry({ logger });
  container.register(tokens.IDataRegistry, dataRegistry);
  
  // Register event bus (required by EntityManager)
  const eventBus = new EventBus({ logger });
  container.register(tokens.IEventBus, eventBus);
  
  // Register ID generator
  const idGenerator = new IdGenerator();
  container.register(tokens.IIdGenerator, idGenerator);
  
  // Register component registry (minimal setup)
  const componentRegistry = new ComponentRegistry();
  container.register(tokens.IComponentRegistry, componentRegistry);
  
  // Register component manager
  const componentManager = new ComponentManager({
    componentRegistry,
    logger,
    eventBus,
  });
  container.register(tokens.IComponentManager, componentManager);
  
  // Register spatial index manager
  const spatialIndexManager = new SpatialIndexManager();
  container.register(tokens.ISpatialIndexManager, spatialIndexManager);
  
  // Register entity manager with minimal dependencies
  const entityManager = new EntityManager({
    componentRegistry,
    componentManager,
    logger,
    eventBus,
    dataRegistry,
    idGenerator,
  });
  container.register(tokens.IEntityManager, entityManager);
  
  // Register JSON Logic evaluation service
  const jsonLogicService = new JsonLogicEvaluationService({
    dataRegistry,
    logger,
  });
  container.register(tokens.JsonLogicEvaluationService, jsonLogicService);
  
  // Register DSL parser
  const dslParser = new DefaultDslParser();
  container.register(tokens.DslParser, dslParser);
  
  // Register scope error handler if needed
  scopeDslErrorHandlerRegistrations(container);
  
  // Register scope registry
  const scopeRegistry = new ScopeRegistry();
  container.register(tokens.IScopeRegistry, scopeRegistry);
  
  // Register scope engine
  const scopeErrorHandler = container.resolve(tokens.IScopeDslErrorHandler);
  const scopeEngine = new ScopeEngine({ 
    scopeRegistry,
    errorHandler: scopeErrorHandler,
  });
  container.register(tokens.IScopeEngine, scopeEngine);
  
  // Initialize entity manager with minimal setup
  await entityManager.initialize();
  
  return container;
}

/**
 * Creates a pre-warmed minimal container with caches primed.
 * This further reduces test variability by ensuring JIT optimizations
 * and caches are warm before actual tests run.
 * 
 * @returns {Promise<AppContainer>} Warmed minimal container
 */
export async function createWarmedMinimalScopeContainer() {
  const container = await createMinimalScopeContainer();
  
  // Warm up the JSON Logic evaluator with sample operations
  const jsonLogicService = container.resolve(tokens.JsonLogicEvaluationService);
  const warmupLogic = {
    and: [
      { '>': [{ var: 'a' }, 5] },
      { '<': [{ var: 'b' }, 10] },
    ],
  };
  const warmupData = { a: 7, b: 8 };
  
  // Run a few warmup evaluations to prime JIT
  for (let i = 0; i < 10; i++) {
    jsonLogicService.evaluate(warmupLogic, warmupData);
  }
  
  // Warm up the DSL parser with sample expressions
  const dslParser = container.resolve(tokens.DslParser);
  const warmupExpressions = [
    'actor',
    'entities(core:actor)',
    'entities(core:actor)[{">": [{"var": "entity.components.core:stats.level"}, 5]}]',
  ];
  
  for (const expr of warmupExpressions) {
    dslParser.parse(expr);
  }
  
  return container;
}

/**
 * Cleanup function for minimal containers.
 * Properly disposes of resources without the overhead of full cleanup.
 * 
 * @param {AppContainer} container - Container to cleanup
 */
export function cleanupMinimalContainer(container) {
  if (!container) return;
  
  // Clear entity manager
  const entityManager = container.resolve(tokens.IEntityManager);
  if (entityManager?.cleanup) {
    entityManager.cleanup();
  }
  
  // Clear data registry
  const dataRegistry = container.resolve(tokens.IDataRegistry);
  if (dataRegistry?.clear) {
    dataRegistry.clear();
  }
  
  // Clear scope registry
  const scopeRegistry = container.resolve(tokens.IScopeRegistry);
  if (scopeRegistry?.clear) {
    scopeRegistry.clear();
  }
  
  // Clear container
  if (container.cleanup) {
    container.cleanup();
  }
}