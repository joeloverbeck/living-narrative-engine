/**
 * @file Minimal Test Container Utility
 * @description Lightweight container setup for ScopeDSL E2E tests
 * Optimized for performance by avoiding heavy service initialization
 */

import { tokens } from '../../../src/dependencyInjection/tokens.js';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';

// Lightweight service implementations for testing
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';
import DataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import TestEntityManagerAdapter from '../entities/TestEntityManagerAdapter.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import DslParser from '../../../src/scopeDsl/parser/defaultDslParser.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';

/**
 * Creates a minimal container setup optimized for ScopeDSL E2E testing
 *
 * This utility provides a lightweight alternative to the full configureContainer()
 * setup, focusing only on services needed for scope resolution testing.
 *
 * Performance benefits:
 * - Skips heavy debug configuration loading
 * - Uses simple console logger instead of LoggerStrategy
 * - Avoids unnecessary service registrations
 * - Minimal DOM element requirements
 *
 * @param {object} [options] - Configuration options
 * @param {boolean} [options.enableTracing] - Enable scope resolution tracing
 * @param {LogLevel} [options.logLevel] - Logger level for tests
 * @returns {Promise<object>} Configured container with core services
 */
export async function createMinimalTestContainer(options = {}) {
  const {
    enableTracing = false,
    logLevel = LogLevel.WARN, // Reduced verbosity for tests
  } = options;

  const container = new AppContainer();

  // Create minimal UI elements for services that require them
  const minimalUIElements = {
    outputDiv: document.createElement('div'),
    inputElement: document.createElement('input'),
    titleElement: document.createElement('h1'),
    document: document,
  };

  // Register core services only
  const logger = new ConsoleLogger(logLevel);
  container.register(tokens.ILogger, logger);

  // Data registry for entity definitions and conditions
  const dataRegistry = new DataRegistry(logger);
  container.register(tokens.IDataRegistry, dataRegistry);

  // Entity manager for entity lifecycle - using TestEntityManagerAdapter for test flexibility
  // TestEntityManagerAdapter wraps SimpleEntityManager and provides addEntity/deleteEntity methods
  // Pass registry so createEntityInstance can look up entity definitions
  const entityManager = new TestEntityManagerAdapter({ logger, registry: dataRegistry });
  container.register(tokens.IEntityManager, entityManager);

  // JSON Logic evaluation service for filters
  const jsonLogicEval = new JsonLogicEvaluationService({ logger });
  container.register(tokens.JsonLogicEvaluationService, jsonLogicEval);

  // DSL parser for scope expressions
  const dslParser = new DslParser({ logger });
  container.register(tokens.DslParser, dslParser);

  // Scope registry for scope definitions
  const scopeRegistry = new ScopeRegistry({ logger, dslParser });
  container.register(tokens.IScopeRegistry, scopeRegistry);

  // Create minimal spatial index manager mock (if needed for some tests)
  const spatialIndexManager = {
    getEntitiesInLocation: (locationId) => [],
    updateEntityPosition: () => {},
    removeEntity: () => {},
  };
  container.register(tokens.ISpatialIndexManager, spatialIndexManager);

  // Scope engine for resolution - matching production constructor signature
  const scopeEngine = new ScopeEngine({
    scopeRegistry,
    errorHandler: null, // Use null for minimal testing setup
  });
  container.register(tokens.IScopeEngine, scopeEngine);

  // Optional: Enable tracing if requested
  if (enableTracing) {
    // Register tracing-related services if needed
    logger.debug('[MinimalTestContainer] Tracing enabled for scope resolution');
  }

  logger.debug(
    '[MinimalTestContainer] Minimal container configuration complete'
  );

  return {
    container,
    services: {
      entityManager,
      scopeRegistry,
      scopeEngine,
      dslParser,
      logger,
      dataRegistry,
      jsonLogicEval,
      spatialIndexManager,
    },
    cleanup: async () => {
      // Cleanup resources if needed
      logger.debug('[MinimalTestContainer] Cleaning up test container');
      // EntityManager and other services don't require explicit cleanup
    },
  };
}

/**
 * Creates a game context optimized for testing
 *
 * @param {object} services - Services from minimal container
 * @param {string} [locationId] - Current location ID
 * @returns {Promise<object>} Minimal game context
 */
export async function createMinimalGameContext(
  services,
  locationId = 'test-location-1'
) {
  const { entityManager, jsonLogicEval, logger, spatialIndexManager } =
    services;

  let currentLocation = null;
  try {
    currentLocation = await entityManager.getEntityInstance(locationId);
  } catch (error) {
    // Location doesn't exist yet - will be created by test setup
    logger.debug(
      `[MinimalTestContainer] Location ${locationId} not found, using null`
    );
  }

  return {
    currentLocation,
    entityManager,
    allEntities: Array.from(entityManager.entities || []),
    jsonLogicEval,
    logger,
    spatialIndexManager,
  };
}

/**
 * Validates that all required services for scope resolution are available
 *
 * @param {object} container - Container to validate
 * @param {object} logger - Logger for validation messages
 * @returns {boolean} True if all services are properly registered
 */
export function validateMinimalContainer(container, logger) {
  const requiredTokens = [
    tokens.ILogger,
    tokens.IDataRegistry,
    tokens.IEntityManager,
    tokens.JsonLogicEvaluationService,
    tokens.DslParser,
    tokens.IScopeRegistry,
    tokens.IScopeEngine,
    tokens.ISpatialIndexManager,
  ];

  const missingServices = [];

  for (const token of requiredTokens) {
    if (!container.isRegistered(token)) {
      missingServices.push(token);
    }
  }

  if (missingServices.length > 0) {
    logger.error(
      `[MinimalTestContainer] Missing required services: ${missingServices.join(', ')}`
    );
    return false;
  }

  logger.debug(
    '[MinimalTestContainer] All required services validated successfully'
  );
  return true;
}

export default createMinimalTestContainer;
