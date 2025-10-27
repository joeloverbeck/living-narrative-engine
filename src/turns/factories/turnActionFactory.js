/**
 * @module turnActionFactory
 */

import { freeze } from '../../utils/cloneUtils.js';
import { ITurnActionFactory } from '../ports/ITurnActionFactory.js';

/**
 * @class TurnActionFactory
 * @augments {ITurnActionFactory}
 * @description Centralises creation of immutable {@link ITurnAction} objects.
 */
export class TurnActionFactory extends ITurnActionFactory {
  /**
   * Creates an {@link ITurnAction} instance from the provided action composite and optional speech.
   * Now preserves visual properties from the composite.
   *
   * @param {import('../dtos/actionComposite.js').ActionComposite} composite - The action composite.
   * @param {string|null} speech - Optional speech text.
   * @returns {import('../interfaces/IActorTurnStrategy.js').ITurnAction} The frozen turn action object.
   */
  create(composite, speech = null) {
    const trimmedSpeech =
      typeof speech === 'string' ? speech.trim() : speech ?? null;

    const obj = {
      actionDefinitionId: composite.actionId,
      resolvedParameters: composite.params,
      commandString: composite.commandString,
      ...(composite.visual ? { visual: composite.visual } : {}),
      ...(trimmedSpeech ? { speech: trimmedSpeech } : {}),
    };
    return freeze(obj);
  }
}
