/**
 * @file knowledgeUpdateWorkflow.js
 * Updates actor knowledge before action decision in turn lifecycle
 *
 * This workflow integrates the GOAP knowledge system into the turn state machine,
 * ensuring actors have up-to-date knowledge of visible entities before making
 * action decisions. Knowledge updates are performed gracefully - failures are
 * logged but don't break turn flow.
 * @see src/goap/services/knowledgeManager.js
 * @see src/turns/states/awaitingActorDecisionState.js
 */

/**
 * Workflow for updating actor knowledge during turn lifecycle.
 *
 * This workflow is executed in AwaitingActorDecisionState before the action
 * decision workflow runs. It calls KnowledgeManager to update the actor's
 * knowledge of visible entities in their current location.
 *
 * Error Handling Strategy:
 * - Catches all errors to prevent breaking turn flow
 * - Logs errors for monitoring and debugging
 * - Allows turn to continue with stale knowledge rather than failing
 * - Rationale: Better to plan with old knowledge than crash the game
 */
export class KnowledgeUpdateWorkflow {
  /**
   * @param {object} state - Owning AwaitingActorDecisionState instance
   * @param {object} turnContext - Turn context providing logger and game state access
   * @param {object} actor - Actor entity for which to update knowledge
   * @param {object} knowledgeManager - KnowledgeManager service instance
   */
  constructor(state, turnContext, actor, knowledgeManager) {
    this._state = state;
    this._turnContext = turnContext;
    this._actor = actor;
    this._knowledgeManager = knowledgeManager;
  }

  /**
   * Execute knowledge update workflow
   *
   * Updates the actor's knowledge of visible entities in their current location.
   * This ensures GOAP planning operates on current visibility information rather
   * than stale knowledge.
   *
   * Timing: Called AFTER context/actor validation, BEFORE action decision
   *
   * @returns {Promise<void>}
   */
  async run() {
    const logger = this._turnContext.getLogger();

    try {
      // Update actor's knowledge of visible entities in current location
      await this._knowledgeManager.updateKnowledge(
        this._actor.id,
        this._turnContext
      );

      logger.debug(
        `${this._state.getStateName()}: Knowledge updated successfully for actor`,
        {
          actorId: this._actor.id,
        }
      );
    } catch (err) {
      // GRACEFUL ERROR HANDLING
      // Knowledge update failures should NOT break turn flow
      // Actor proceeds with stale knowledge rather than crashing
      logger.error(
        `${this._state.getStateName()}: Knowledge update failed for actor`,
        {
          error: err.message,
          actorId: this._actor.id,
          stack: err.stack,
        }
      );

      // Don't throw - allow turn to continue
      // Better to plan with old knowledge than to crash the turn
    }
  }
}

export default KnowledgeUpdateWorkflow;
