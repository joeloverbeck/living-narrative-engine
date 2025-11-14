/**
 * @file Test utilities for MultiTargetResolutionStage
 * Provides factory functions for creating properly configured stage instances with all required services
 */

import { MultiTargetResolutionStage } from '../../../src/actions/pipeline/stages/MultiTargetResolutionStage.js';
import { ActionPipelineOrchestrator } from '../../../src/actions/actionPipelineOrchestrator.js';
import TargetContextBuilder from '../../../src/scopeDsl/utils/targetContextBuilder.js';
import { TargetDependencyResolver } from '../../../src/actions/pipeline/services/implementations/TargetDependencyResolver.js';
import { LegacyTargetCompatibilityLayer } from '../../../src/actions/pipeline/services/implementations/LegacyTargetCompatibilityLayer.js';
import { ScopeContextBuilder } from '../../../src/actions/pipeline/services/implementations/ScopeContextBuilder.js';
import { TargetDisplayNameResolver } from '../../../src/actions/pipeline/services/implementations/TargetDisplayNameResolver.js';
import TargetResolutionTracingOrchestrator from '../../../src/actions/pipeline/services/implementations/TargetResolutionTracingOrchestrator.js';

/**
 * Creates a fully configured MultiTargetResolutionStage for testing
 *
 * @param {object} options - Configuration options
 * @param {object} options.entityManager - Entity manager instance
 * @param {object} options.logger - Logger instance
 * @param {object} [options.unifiedScopeResolver] - Unified scope resolver (defaults to mock)
 * @param {object} [options.targetResolver] - Target resolver (defaults to mock)
 * @param {object} [options.gameStateManager] - Game state manager (defaults to mock)
 * @param {object} [options.overrides] - Service overrides for specific testing scenarios
 * @returns {MultiTargetResolutionStage} Configured stage instance
 */
export function createMultiTargetResolutionStage({
  entityManager,
  logger,
  unifiedScopeResolver,
  targetResolver,
  gameStateManager,
  overrides = {},
}) {
  // Create default mocks if not provided
  const defaultUnifiedScopeResolver = unifiedScopeResolver || {
    resolve: jest.fn(),
  };

  const defaultTargetResolver = targetResolver || {
    resolveTargets: jest.fn(),
  };

  const defaultGameStateManager = gameStateManager || {
    getCurrentTurn: jest.fn().mockReturnValue(1),
    getTimeOfDay: jest.fn().mockReturnValue('morning'),
    getWeather: jest.fn().mockReturnValue('sunny'),
  };

  // Create required service instances
  const targetContextBuilder =
    overrides.targetContextBuilder ||
    new TargetContextBuilder({
      entityManager,
      gameStateManager: defaultGameStateManager,
      logger,
    });

  const targetDependencyResolver =
    overrides.targetDependencyResolver ||
    new TargetDependencyResolver({
      logger,
    });

  const legacyTargetCompatibilityLayer =
    overrides.legacyTargetCompatibilityLayer ||
    new LegacyTargetCompatibilityLayer({
      logger,
    });

  const scopeContextBuilder =
    overrides.scopeContextBuilder ||
    new ScopeContextBuilder({
      targetContextBuilder,
      entityManager,
      logger,
    });

  const targetDisplayNameResolver =
    overrides.targetDisplayNameResolver ||
    new TargetDisplayNameResolver({
      entityManager,
      logger,
    });

  const tracingOrchestrator =
    overrides.tracingOrchestrator ||
    new TargetResolutionTracingOrchestrator({
      logger,
    });

  // Create and return the stage with all required dependencies
  return new MultiTargetResolutionStage({
    targetDependencyResolver,
    legacyTargetCompatibilityLayer,
    scopeContextBuilder,
    targetDisplayNameResolver,
    unifiedScopeResolver: defaultUnifiedScopeResolver,
    entityManager,
    targetResolver: defaultTargetResolver,
    targetContextBuilder,
    logger,
    tracingOrchestrator,
  });
}

/**
 * Creates mock services for MultiTargetResolutionStage testing
 *
 * @param {object} logger - Logger instance
 * @returns {object} Mock services object
 */
export function createMockMultiTargetServices(logger) {
  return {
    targetDependencyResolver: {
      getResolutionOrder: jest.fn(),
    },
    legacyTargetCompatibilityLayer: {
      isLegacyAction: jest.fn(),
      convertLegacyFormat: jest.fn(),
      getMigrationSuggestion: jest.fn(),
    },
    scopeContextBuilder: {
      buildScopeContext: jest.fn(),
      buildScopeContextForSpecificPrimary: jest.fn(),
    },
    targetDisplayNameResolver: {
      getEntityDisplayName: jest.fn(),
    },
  };
}

/**
 * Creates a simple test action definition for multi-target testing
 *
 * @param {object} [overrides] - Override specific properties
 * @returns {object} Action definition
 */
export function createTestMultiTargetAction(overrides = {}) {
  return {
    id: 'test:multi_target_action',
    name: 'Test Multi Target Action',
    template: 'test {primary} with {secondary}',
    targets: {
      primary: {
        scope: 'test:primary_scope',
        placeholder: 'primary',
        description: 'Primary target',
      },
      secondary: {
        scope: 'test:secondary_scope',
        placeholder: 'secondary',
        description: 'Secondary target',
      },
    },
    ...overrides,
  };
}

/**
 * Creates a test action definition with contextFrom dependency
 *
 * @param {object} [overrides] - Override specific properties
 * @returns {object} Action definition with contextFrom
 */
export function createTestContextFromAction(overrides = {}) {
  return {
    id: 'test:context_from_action',
    name: 'Test Context From Action',
    template: 'test {primary} with their {secondary}',
    targets: {
      primary: {
        scope: 'test:primary_scope',
        placeholder: 'primary',
        description: 'Primary target',
      },
      secondary: {
        scope: 'test:secondary_scope',
        placeholder: 'secondary',
        description: 'Secondary target dependent on primary',
        contextFrom: 'primary',
      },
    },
    ...overrides,
  };
}

/**
 * Creates a legacy-style action definition for backward compatibility testing
 *
 * @param {object} [overrides] - Override specific properties
 * @returns {object} Legacy action definition
 */
export function createTestLegacyAction(overrides = {}) {
  return {
    id: 'test:legacy_action',
    name: 'Test Legacy Action',
    template: 'test with {target}',
    scope: 'test:legacy_scope',
    ...overrides,
  };
}

/**
 * Creates a complete ActionPipelineOrchestrator with all dependencies for testing
 *
 * @param {object} options - Configuration options
 * @param {object} options.entityManager - Entity manager instance
 * @param {object} options.logger - Logger instance
 * @param {object} [options.actionIndex] - Action index (defaults to mock)
 * @param {object} [options.prerequisiteService] - Prerequisite service (defaults to mock)
 * @param {object} [options.targetService] - Target service (defaults to mock)
 * @param {object} [options.formatter] - Action command formatter (defaults to mock)
 * @param {object} [options.safeEventDispatcher] - Event dispatcher (defaults to mock)
 * @param {Function} [options.getEntityDisplayNameFn] - Display name function (defaults to mock)
 * @param {object} [options.errorBuilder] - Error context builder (defaults to mock)
 * @param {object} [options.unifiedScopeResolver] - Unified scope resolver (defaults to mock)
 * @param {object} [options.targetContextBuilder] - Target context builder (defaults to mock)
 * @param {object} [options.multiTargetResolutionStage] - Multi target stage (defaults to created instance)
 * @param {object} [options.targetComponentValidator] - Target component validator (defaults to mock)
 * @param {object} [options.targetRequiredComponentsValidator] - Target required components validator (defaults to mock)
 * @returns {ActionPipelineOrchestrator} Configured orchestrator instance
 */
export function createActionPipelineOrchestrator({
  entityManager,
  logger,
  actionIndex,
  prerequisiteService,
  targetService,
  formatter,
  safeEventDispatcher,
  getEntityDisplayNameFn,
  errorBuilder,
  unifiedScopeResolver,
  targetContextBuilder,
  multiTargetResolutionStage,
  targetComponentValidator,
  targetRequiredComponentsValidator,
}) {
  // Create default mocks if not provided
  const defaultActionIndex = actionIndex || {
    getCandidateActions: jest.fn().mockReturnValue([]),
  };

  const defaultPrerequisiteService = prerequisiteService || {
    evaluateActionConditions: jest.fn().mockResolvedValue({
      success: true,
      errors: [],
    }),
  };

  const defaultTargetService = targetService || {
    resolveTargets: jest.fn(),
  };

  const defaultFormatter = formatter || {
    formatActionCommand: jest.fn().mockReturnValue('test command'),
  };

  const defaultSafeEventDispatcher = safeEventDispatcher || {
    dispatch: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  };

  const defaultGetEntityDisplayNameFn =
    getEntityDisplayNameFn || jest.fn().mockReturnValue('Test Entity');

  const defaultErrorBuilder = errorBuilder || {
    buildErrorContext: jest.fn().mockReturnValue({}),
  };

  const defaultUnifiedScopeResolver = unifiedScopeResolver || {
    resolve: jest.fn(),
  };

  const defaultTargetContextBuilder =
    targetContextBuilder ||
    new TargetContextBuilder({
      entityManager,
      gameStateManager: {
        getCurrentTurn: jest.fn().mockReturnValue(1),
        getTimeOfDay: jest.fn().mockReturnValue('morning'),
        getWeather: jest.fn().mockReturnValue('sunny'),
      },
      logger,
    });

  const defaultMultiTargetResolutionStage =
    multiTargetResolutionStage ||
    createMultiTargetResolutionStage({
      entityManager,
      logger,
      unifiedScopeResolver: defaultUnifiedScopeResolver,
      targetResolver: defaultTargetService,
      gameStateManager: {
        getCurrentTurn: jest.fn().mockReturnValue(1),
        getTimeOfDay: jest.fn().mockReturnValue('morning'),
        getWeather: jest.fn().mockReturnValue('sunny'),
      },
    });

  const defaultTargetComponentValidator = targetComponentValidator || {
    validateTargetComponents: jest.fn().mockReturnValue({ valid: true }),
    validateEntityComponents: jest.fn().mockReturnValue({ valid: true }),
  };

  const defaultTargetRequiredComponentsValidator =
    targetRequiredComponentsValidator || {
      validateTargetRequirements: jest.fn().mockReturnValue({
        valid: true,
        missingComponents: [],
      }),
    };

  return new ActionPipelineOrchestrator({
    actionIndex: defaultActionIndex,
    prerequisiteService: defaultPrerequisiteService,
    targetService: defaultTargetService,
    formatter: defaultFormatter,
    entityManager,
    safeEventDispatcher: defaultSafeEventDispatcher,
    getEntityDisplayNameFn: defaultGetEntityDisplayNameFn,
    errorBuilder: defaultErrorBuilder,
    logger,
    unifiedScopeResolver: defaultUnifiedScopeResolver,
    targetContextBuilder: defaultTargetContextBuilder,
    multiTargetResolutionStage: defaultMultiTargetResolutionStage,
    targetComponentValidator: defaultTargetComponentValidator,
    targetRequiredComponentsValidator: defaultTargetRequiredComponentsValidator,
  });
}
