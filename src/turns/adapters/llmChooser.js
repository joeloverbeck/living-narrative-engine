/**
 * @module LLMChooser
 * @description
 *  Delegates LLM decision-making to the two-phase orchestrator.
 */

import { ILLMChooser } from '../ports/ILLMChooser.js';

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../orchestrators/TwoPhaseDecisionOrchestrator.js').TwoPhaseDecisionOrchestrator} TwoPhaseDecisionOrchestrator */

export class LLMChooser extends ILLMChooser {
  /** @type {TwoPhaseDecisionOrchestrator} */ #twoPhaseOrchestrator;
  /** @type {ILogger}             */ #logger;

  /**
   * Create an orchestrator-backed LLM chooser.
   *
   * @param {{
   *   twoPhaseOrchestrator: TwoPhaseDecisionOrchestrator,
   *   logger: ILogger
   * }} deps - Constructor dependencies.
   */
  constructor({ twoPhaseOrchestrator, logger }) {
    super();

    if (!twoPhaseOrchestrator?.orchestrate)
      throw new Error('LLMChooser: twoPhaseOrchestrator invalid');
    if (!logger?.debug) throw new Error('LLMChooser: logger invalid');

    this.#twoPhaseOrchestrator = twoPhaseOrchestrator;
    this.#logger = logger;
  }

  /**
   * Generate a prompt, call the LLM and parse its answer.
   *
   * @param {object} options - Input for LLM choice.
   * @param {import('../../entities/entity.js').default} options.actor - Acting entity.
   * @param {import('../interfaces/ITurnContext.js').ITurnContext} options.context - Turn context.
   * @param {Array} options.actions - Indexed list of actions.
   * @param {AbortSignal} [options.abortSignal] - Optional abort signal.
   * @returns {Promise<{ index: number|null, speech: string|null, thoughts: string|null, notes: Array<{text: string, subject: string, context?: string, timestamp?: string}>|null, moodUpdate: { valence: number, arousal: number, agency_control: number, threat: number, engagement: number, future_expectancy: number, self_evaluation: number }|null, sexualUpdate: { sex_excitation: number, sex_inhibition: number }|null }>} Decision payload.
   */
  async choose({ actor, context, actions, abortSignal }) {
    this.#logger.debug(
      `LLMChooser: Delegating to two-phase orchestrator for ${actor.id}`
    );
    return this.#twoPhaseOrchestrator.orchestrate({
      actor,
      context,
      actions,
      abortSignal,
    });
  }
}
