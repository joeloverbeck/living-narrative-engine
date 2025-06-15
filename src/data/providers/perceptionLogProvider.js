/**
 * @file This module provides the perception log data for an actor.
 * @see src/data/providers/perceptionLogProvider.js
 */

import { IPerceptionLogProvider } from '../../interfaces/IPerceptionLogProvider.js';
import { PERCEPTION_LOG_COMPONENT_ID } from '../../constants/componentIds.js';
import { DEFAULT_FALLBACK_EVENT_DESCRIPTION_RAW } from '../../constants/textDefaults.js';
import { DISPLAY_ERROR_ID } from '../../constants/eventIds.js';

/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../turns/dtos/AIGameStateDTO.js').AIPerceptionLogEntryDTO} AIPerceptionLogEntryDTO */

export class PerceptionLogProvider extends IPerceptionLogProvider {
  /**
   * @override
   * @param {Entity} actor
   * @param {ILogger} logger
   * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dispatcher
   */
  async get(actor, logger, dispatcher) {
    logger.debug(
      `PerceptionLogProvider: Retrieving perception log for actor ${actor.id}`
    );
    /** @type {AIPerceptionLogEntryDTO[]} */
    let perceptionLogDto = [];
    try {
      if (actor.hasComponent(PERCEPTION_LOG_COMPONENT_ID)) {
        const perceptionData = actor.getComponentData(
          PERCEPTION_LOG_COMPONENT_ID
        );
        if (perceptionData && Array.isArray(perceptionData.logEntries)) {
          perceptionLogDto = perceptionData.logEntries.map((entry) => ({
            descriptionText:
              entry.descriptionText || DEFAULT_FALLBACK_EVENT_DESCRIPTION_RAW,
            timestamp: entry.timestamp || Date.now(),
            perceptionType: entry.perceptionType || 'unknown',
          }));
          logger.debug(
            `PerceptionLogProvider: Retrieved ${perceptionLogDto.length} entries for actor ${actor.id}.`
          );
        }
      }
    } catch (perceptionError) {
      dispatcher?.dispatch(DISPLAY_ERROR_ID, {
        message: `PerceptionLogProvider: Error retrieving perception log for ${actor.id}: ${perceptionError.message}`,
        details: { error: perceptionError },
      });
    }
    return perceptionLogDto;
  }
}
