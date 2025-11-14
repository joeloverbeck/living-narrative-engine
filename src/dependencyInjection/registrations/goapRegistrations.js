/**
 * @file Dependency injection registrations for GOAP system services.
 */

import { tokens } from '../tokens.js';
import ContextAssemblyService from '../../goap/services/contextAssemblyService.js';
import ParameterResolutionService from '../../goap/services/parameterResolutionService.js';
import PlanningEffectsSimulator from '../../goap/planner/planningEffectsSimulator.js';
import RefinementStateManager from '../../goap/refinement/refinementStateManager.js';
import MethodSelectionService from '../../goap/refinement/methodSelectionService.js';
import PrimitiveActionStepExecutor from '../../goap/refinement/steps/primitiveActionStepExecutor.js';
import ConditionalStepExecutor from '../../goap/refinement/steps/conditionalStepExecutor.js';
import RefinementEngine from '../../goap/refinement/refinementEngine.js';
import GoalDistanceHeuristic from '../../goap/planner/goalDistanceHeuristic.js';
import RelaxedPlanningGraphHeuristic from '../../goap/planner/relaxedPlanningGraphHeuristic.js';
import HeuristicRegistry from '../../goap/planner/heuristicRegistry.js';

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

  // Planning Effects Simulator
  // Pure state transformation service for GOAP planning
  // Predicts task effects without executing handlers or triggering side effects
  container.register(tokens.IPlanningEffectsSimulator, PlanningEffectsSimulator, {
    dependencies: [
      tokens.IParameterResolutionService,
      tokens.IContextAssemblyService,
      tokens.ILogger,
    ],
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
  // IMPORTANT: Injects container for lazy resolution of IRefinementStateManager
  // State manager is transient, so each execute() call resolves a fresh instance
  // to prevent state leakage between concurrent actor refinements
  container.register(tokens.IPrimitiveActionStepExecutor, PrimitiveActionStepExecutor, {
    dependencies: [
      tokens.IParameterResolutionService,
      tokens.AppContainer, // Lazy resolution for transient state manager
      tokens.OperationInterpreter,
      tokens.ActionIndex,
      tokens.GameDataRepository,
      tokens.ILogger,
    ],
  });

  // Conditional Step Executor
  // IMPORTANT: Self-reference pattern for recursive nested conditional handling
  // This is SAFE because singleton lifecycle prevents stack overflow:
  // - First resolution creates instance and stores in container cache
  // - Self-reference resolves from cache, NOT recursive instantiation
  // - The single instance can recursively call its own execute() method
  // This pattern enables deep conditional nesting without separate executor instances
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

  // Refinement Engine
  // Main orchestration service for task-to-action refinement
  // Coordinates method selection, step execution, state management, and event dispatching
  container.register(tokens.IRefinementEngine, RefinementEngine, {
    dependencies: [
      tokens.IMethodSelectionService,
      tokens.IRefinementStateManager,
      tokens.IPrimitiveActionStepExecutor,
      tokens.IConditionalStepExecutor,
      tokens.IContextAssemblyService,
      tokens.GameDataRepository,
      tokens.IEventBus,
      tokens.ILogger,
    ],
    lifecycle: 'singleton',
  });

  // GOAP Heuristics (GOAPIMPL-017)
  // A* search heuristics for GOAP planning

  // Goal Distance Heuristic
  // Simple, fast heuristic that counts unsatisfied goal conditions
  // Admissible: each condition requires at least 1 action
  container.register(tokens.IGoalDistanceHeuristic, GoalDistanceHeuristic, {
    dependencies: [tokens.JsonLogicEvaluationService, tokens.ILogger],
    lifecycle: 'singleton',
  });

  // Relaxed Planning Graph Heuristic
  // Advanced heuristic that builds planning graph ignoring negative effects
  // Admissible: relaxed problem is easier than real problem
  // Requires planning effects simulator for state transformation
  container.register(
    tokens.IRelaxedPlanningGraphHeuristic,
    RelaxedPlanningGraphHeuristic,
    {
      dependencies: [
        tokens.IPlanningEffectsSimulator,
        tokens.JsonLogicEvaluationService,
        tokens.ILogger,
      ],
      lifecycle: 'singleton',
    }
  );

  // Heuristic Registry
  // Central registry for heuristic selection and delegation
  // Supports 'goal-distance', 'rpg', and 'zero' (Dijkstra fallback)
  container.register(tokens.IHeuristicRegistry, HeuristicRegistry, {
    dependencies: [
      tokens.IGoalDistanceHeuristic,
      tokens.IRelaxedPlanningGraphHeuristic,
      tokens.ILogger,
    ],
    lifecycle: 'singleton',
  });
}
