/**
 * @file Dependency injection registrations for GOAP system services.
 */

import { tokens } from '../tokens.js';
import ContextAssemblyService from '../../goap/services/contextAssemblyService.js';
import ParameterResolutionService from '../../goap/services/parameterResolutionService.js';
import RefinementStateManager from '../../goap/refinement/refinementStateManager.js';
import MethodSelectionService from '../../goap/refinement/methodSelectionService.js';
import PrimitiveActionStepExecutor from '../../goap/refinement/steps/primitiveActionStepExecutor.js';
import ConditionalStepExecutor from '../../goap/refinement/steps/conditionalStepExecutor.js';

/**
 * Registers GOAP system services with the dependency injection container.
 *
 * @param {import('../containerBase.js').default} container - DI container
 */
export function registerGoapServices(container) {
  // Context Assembly Service
  container.register(tokens.IContextAssemblyService, ContextAssemblyService, {
    dependencies: [
      tokens.IEntityManager,
      tokens.ILogger,
      { optional: true, parameter: 'enableKnowledgeLimitation', defaultValue: false },
    ],
  });

  // Parameter Resolution Service
  container.register(tokens.IParameterResolutionService, ParameterResolutionService, {
    dependencies: [tokens.IEntityManager, tokens.ILogger],
  });

  // Refinement State Manager
  // IMPORTANT: transient lifecycle required to prevent shared state across concurrent actor refinements
  // Each refinement execution needs isolated state (#state, #initialized fields are mutable)
  container.register(tokens.IRefinementStateManager, RefinementStateManager, {
    dependencies: [tokens.ILogger],
    lifecycle: 'transient',
  });

  // Method Selection Service
  container.register(tokens.IMethodSelectionService, MethodSelectionService, {
    dependencies: [
      tokens.GameDataRepository,
      tokens.IContextAssemblyService,
      tokens.JsonLogicEvaluationService,
      tokens.ILogger,
    ],
  });

  // Primitive Action Step Executor
  container.register(tokens.IPrimitiveActionStepExecutor, PrimitiveActionStepExecutor, {
    dependencies: [
      tokens.IParameterResolutionService,
      tokens.IRefinementStateManager,
      tokens.OperationInterpreter,
      tokens.ActionIndex,
      tokens.GameDataRepository,
      tokens.ILogger,
    ],
  });

  // Conditional Step Executor
  // IMPORTANT: singleton lifecycle required for self-reference to work properly
  // Self-reference enables recursive handling of nested conditionals
  container.register(tokens.IConditionalStepExecutor, ConditionalStepExecutor, {
    dependencies: [
      tokens.IContextAssemblyService,
      tokens.IPrimitiveActionStepExecutor,
      tokens.IConditionalStepExecutor, // Self-reference for nested conditionals
      tokens.JsonLogicEvaluationService,
      tokens.ILogger,
    ],
    lifecycle: 'singleton',
  });
}
