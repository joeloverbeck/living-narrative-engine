/**
 * @module turnActionFactory
 */

import { freeze } from '../../../tests/utils/objectUtils.js';
import { ITurnActionFactory } from '../ports/ITurnActionFactory.js';

/**
 * @class TurnActionFactory
 * @extends {ITurnActionFactory}
 * @description Centralises creation of immutable {@link ITurnAction} objects.
 */
export class TurnActionFactory extends ITurnActionFactory {
  /**
   * Creates an {@link ITurnAction} instance from the provided action composite and optional speech.
   *
   * @param {import('../dtos/actionComposite.js').ActionComposite} composite - The action composite.
   * @param {string|null} speech - Optional speech text.
   * @returns {import('../interfaces/IActorTurnStrategy.js').ITurnAction} The frozen turn action object.
   */
  create(composite, speech = null) {
    const obj = {
      actionDefinitionId: composite.actionId,
      resolvedParameters: composite.params,
      commandString: composite.commandString,
      ...(speech ? { speech: speech.trim() } : {}),
    };
    return freeze(obj);
  }
}
