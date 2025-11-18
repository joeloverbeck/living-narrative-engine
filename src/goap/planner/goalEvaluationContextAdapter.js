import { createPlanningStateView } from './planningStateView.js';

const DEFAULT_ORIGIN = 'GoalEvaluationContextAdapter';

/**
 *
 */
export function isGoalEvaluationAdapterEnabled() {
  return process.env.GOAP_NUMERIC_ADAPTER === '1';
}

export class GoalEvaluationContextAdapter {
  #state;
  #goal;
  #logger;
  #metadata;
  #stateView;

  constructor({ state, goal, logger, origin } = {}) {
    this.#state = state || {};
    this.#goal = goal || null;
    this.#logger = logger || null;
    this.#metadata = {
      origin: origin || DEFAULT_ORIGIN,
      goalId: goal?.id || null,
    };
    this.#stateView = createPlanningStateView(this.#state, {
      logger: this.#logger,
      metadata: this.#metadata,
    });
  }

  getEvaluationContext() {
    return this.#stateView.getEvaluationContext();
  }

  getStateView() {
    return this.#stateView;
  }

  getMetadata() {
    return { ...this.#metadata };
  }

  getActorSnapshot() {
    return this.#stateView.getActorSnapshot();
  }

  getDiagnosticsPayload(extra = {}) {
    if (!isGoalEvaluationAdapterEnabled()) {
      return { ...extra };
    }
    return {
      actorId: this.#stateView.getActorId() || undefined,
      goalId: this.#metadata.goalId || undefined,
      origin: this.#metadata.origin || DEFAULT_ORIGIN,
      ...extra,
    };
  }
}

/**
 *
 * @param options
 */
export function createGoalEvaluationContextAdapter(options) {
  return new GoalEvaluationContextAdapter(options);
}
