// src/turns/ports/ITurnActionFactory.js
/**
 * @interface ITurnActionFactory
 * @description Factory to create a turn action from a composite.
 * @method create
 * @param {ActionComposite} composite - The action composite.
 * @param {string|null} speech - Optional speech text.
 * @returns {import('../interfaces/IActorTurnStrategy.js').ITurnAction}
 */
export class ITurnActionFactory {
  /**
   * Creates an ITurnAction instance from the composite and optional speech.
   * @param {ActionComposite} composite
   * @param {string|null} speech
   * @returns {import('../interfaces/IActorTurnStrategy.js').ITurnAction}
   */
  create(composite, speech) {
    throw new Error('Interface');
  }
}
