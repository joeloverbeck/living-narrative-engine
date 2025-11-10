/**
 * @file Dependency injection registrations for GOAP system
 */

/**
 * Registers GOAP services in the DI container
 *
 * @param {object} _container - DI container
 */
export function registerGoapServices(_container) {
  // Analysis (to be implemented in later tickets)
  // container.register(goapTokens.IEffectsAnalyzer, EffectsAnalyzer);
  // container.register(goapTokens.IEffectsGenerator, EffectsGenerator);
  // container.register(goapTokens.IEffectsValidator, EffectsValidator);

  // Goals (to be implemented in later tickets)
  // container.register(goapTokens.IGoalManager, GoalManager);
  // container.register(goapTokens.IGoalStateEvaluator, GoalStateEvaluator);

  // Selection (to be implemented in later tickets)
  // container.register(goapTokens.IActionSelector, ActionSelector);

  // Planning (to be implemented in later tickets)
  // container.register(goapTokens.ISimplePlanner, SimplePlanner);
  // container.register(goapTokens.IPlanCache, PlanCache);
}
