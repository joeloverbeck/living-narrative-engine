// src/turns/ports/ILLMChooser.js
/**
 * @interface ILLMChooser
 * @description Given a prompt, returns which action index the LLM chose.
 * Note: moodUpdate/sexualUpdate are handled separately by MoodResponseProcessor
 * in Phase 1 of the two-phase emotional state update flow.
 * @function choose
 * @param {{ actor: Entity, context: ITurnContext, actions: ActionComposite[], abortSignal: AbortSignal }} params
 * @returns {{ index: number, speech: string|null, thoughts: string|null, notes: Array<{text: string, subject: string, context?: string, timestamp?: string}>|null, cognitiveLedger?: { settled_conclusions: string[], open_questions: string[] }|null }}
 */
export class ILLMChooser {
  /**
   * Chooses an action based on the provided parameters.
   * Note: moodUpdate/sexualUpdate are handled separately by MoodResponseProcessor
   * in Phase 1 of the two-phase emotional state update flow.
   *
   * @param {{ actor: Entity, context: ITurnContext, actions: ActionComposite[], abortSignal: AbortSignal }} params
   * @returns {{ index: number, speech: string|null, thoughts: string|null, notes: Array<{text: string, subject: string, context?: string, timestamp?: string}>|null, cognitiveLedger?: { settled_conclusions: string[], open_questions: string[] }|null }}
   */
  choose(params) {
    throw new Error('Interface method');
  }
}
