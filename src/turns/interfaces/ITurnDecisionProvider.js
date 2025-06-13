/**
 * @typedef {import('../../entities/entity.js').default} Entity
 * @typedef {import('./ITurnContext.js').ITurnContext} ITurnContext
 * @typedef {import('../dtos/actionComposite.js').ActionComposite} ActionComposite
 *
 * @typedef {object} ITurnDecisionResult
 * @property {number}        chosenIndex  - 1-based selection index
 * @property {string|null}   speech       - Optional speech the actor utters
 * @property {string|null}   thoughts     - Optional internal monologue
 * @property {string[]|null} notes        - Optional free-form notes
 */

/**
 * @abstract
 * @class ITurnDecisionProvider
 * @description
 * Defines the contract for any object that, given a list of available actions,
 * picks one (by index) and optionally returns speech, thoughts, or notes.
 */
export class ITurnDecisionProvider {
  /* eslint-disable no-unused-vars */
  /**
   * Decide which action to take.
   *
   * @param {Entity}               actor        - The acting entity
   * @param {ITurnContext}         context      - Turn context providing services
   * @param {ActionComposite[]}    actions      - Indexed list of possible actions
   * @param {AbortSignal}          [abortSignal]- Optional cancellation signal
   * @returns {Promise<ITurnDecisionResult>}
   */
  async decide(actor, context, actions, abortSignal) {
    throw new Error('interface');
  }

  /* eslint-enable no-unused-vars */
}
