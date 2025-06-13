// src/turns/interfaces/IAIPromptPipeline.js
// --- FILE START ---

/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */
/** @typedef {import('../turns/dtos/actionComposite.js').ActionComposite} ActionComposite */

export class IAIPromptPipeline {
  /**
   * @param {Entity} actor
   * @param {ITurnContext} context
   * @param {ActionComposite[]} availableActions - The definitive, indexed list of actions.
   * @returns {Promise<string>}
   */
  async generatePrompt(actor, context, availableActions) {
    throw new Error(
      'Method "generatePrompt" must be implemented by concrete classes.'
    );
  }
}
// --- FILE END ---
