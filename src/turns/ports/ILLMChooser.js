// src/turns/ports/ILLMChooser.js
/**
 * @interface ILLMChooser
 * @description Given a prompt, returns which action index the LLM chose.
 * @function choose
 * @param {{ actor: Entity, context: ITurnContext, actions: ActionComposite[], abortSignal: AbortSignal }} params
 * @returns {{ index: number, speech: string|null, thoughts: string|null, notes: Array<{text: string, subject: string, context?: string, timestamp?: string}>|null }}
 */
export class ILLMChooser {
  /**
   * Chooses an action based on the provided parameters.
   *
   * @param {{ actor: Entity, context: ITurnContext, actions: ActionComposite[], abortSignal: AbortSignal }} params
   * @returns {{ index: number, speech: string|null, thoughts: string|null, notes: Array<{text: string, subject: string, context?: string, timestamp?: string}>|null }}
   */
  choose(params) {
    throw new Error('Interface method');
  }
}
