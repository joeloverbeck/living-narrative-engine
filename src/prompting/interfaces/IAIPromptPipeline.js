/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../turns/interfaces/ITurnContext.js').ITurnContext} ITurnContext */

export class IAIPromptPipeline {
  async generatePrompt(actor, context) {
    throw new Error(
      'Method "generatePrompt" must be implemented by concrete classes.'
    );
  }
}
