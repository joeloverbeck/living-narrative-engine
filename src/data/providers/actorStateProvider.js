/**
 * @file This module provides data about actor states.
 * @see src/data/providers/actorStateProvider.js
 */

import { IActorStateProvider } from '../../interfaces/IActorStateProvider.js';
import {
  NAME_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
  PERSONALITY_COMPONENT_ID,
  PROFILE_COMPONENT_ID,
  LIKES_COMPONENT_ID,
  DISLIKES_COMPONENT_ID,
  STRENGTHS_COMPONENT_ID,
  WEAKNESSES_COMPONENT_ID,
  SECRETS_COMPONENT_ID,
  FEARS_COMPONENT_ID,
  MOTIVATIONS_COMPONENT_ID,
  INTERNAL_TENSIONS_COMPONENT_ID,
  DILEMMAS_COMPONENT_ID,
  SPEECH_PATTERNS_COMPONENT_ID,
  APPARENT_AGE_COMPONENT_ID,
} from '../../constants/componentIds.js';
import {
  DEFAULT_FALLBACK_CHARACTER_NAME,
  DEFAULT_FALLBACK_DESCRIPTION_RAW,
} from '../../constants/textDefaults.js';
import { isNonBlankString } from '../../utils/textUtils.js';
import { deepClone } from '../../utils/cloneUtils.js';

/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../turns/dtos/AIGameStateDTO.js').AIActorStateDTO} AIActorStateDTO */

export class ActorStateProvider extends IActorStateProvider {
  /**
   * @override
   * @param {Entity} actor
   * @param {ILogger} logger
   * @returns {AIActorStateDTO & {components: Record<string, any>}}
   */
  build(actor, logger) {
    logger.debug(`ActorStateProvider: Building actor state for ${actor.id}`);
    /** @type {AIActorStateDTO & {components: Record<string, any>}} */
    const actorState = { id: actor.id, components: {} };

    for (const [compId, compData] of actor.componentEntries) {
      actorState.components[compId] = deepClone(compData);
    }

    const extractSurfaceText = (compId, fallback = '') => {
      const component = actorState.components[compId];
      const text = component?.text;

      actorState[compId] = isNonBlankString(text)
        ? { text: text.trim() }
        : { text: fallback };
    };

    extractSurfaceText(NAME_COMPONENT_ID, DEFAULT_FALLBACK_CHARACTER_NAME);
    extractSurfaceText(
      DESCRIPTION_COMPONENT_ID,
      DEFAULT_FALLBACK_DESCRIPTION_RAW
    );

    [
      PERSONALITY_COMPONENT_ID,
      PROFILE_COMPONENT_ID,
      LIKES_COMPONENT_ID,
      DISLIKES_COMPONENT_ID,
      STRENGTHS_COMPONENT_ID,
      WEAKNESSES_COMPONENT_ID,
      SECRETS_COMPONENT_ID,
      FEARS_COMPONENT_ID,
      MOTIVATIONS_COMPONENT_ID,
      INTERNAL_TENSIONS_COMPONENT_ID,
      DILEMMAS_COMPONENT_ID,
    ].forEach((id) => {
      const text = actorState.components[id]?.text;
      if (isNonBlankString(text)) {
        actorState[id] = { text: text.trim() };
      }
    });

    if (actor.hasComponent(SPEECH_PATTERNS_COMPONENT_ID)) {
      const speechData = actorState.components[SPEECH_PATTERNS_COMPONENT_ID];
      const patterns = Array.isArray(speechData?.patterns)
        ? speechData.patterns.filter((p) => isNonBlankString(p))
        : [];
      if (patterns.length) {
        actorState[SPEECH_PATTERNS_COMPONENT_ID] = { ...speechData, patterns };
      }
    }

    // Extract apparent age component if present
    if (actor.hasComponent(APPARENT_AGE_COMPONENT_ID)) {
      const ageData = actorState.components[APPARENT_AGE_COMPONENT_ID];
      if (
        ageData &&
        typeof ageData.minAge === 'number' &&
        typeof ageData.maxAge === 'number'
      ) {
        actorState[APPARENT_AGE_COMPONENT_ID] = { ...ageData };
      }
    }

    return actorState;
  }
}
