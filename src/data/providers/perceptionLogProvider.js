/**
 * @file This module provides the perception log data for an actor.
 * @see src/data/providers/perceptionLogProvider.js
 */

import { IPerceptionLogProvider } from '../../interfaces/IPerceptionLogProvider.js';
import { PERCEPTION_LOG_COMPONENT_ID } from '../../constants/componentIds.js';
import { DEFAULT_FALLBACK_EVENT_DESCRIPTION_RAW } from '../../constants/textDefaults.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';

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
      if (dispatcher) {
        safeDispatchError(
          dispatcher,
          `PerceptionLogProvider: Error retrieving perception log for ${actor.id}: ${perceptionError.message}`,
          { error: perceptionError }
        );
      }
    }
    return perceptionLogDto;
  }

  /**
   * @override
   * @param {Entity} actor
   * @param {ILogger} logger
   * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} dispatcher
   */
  async isEmpty(actor, logger, dispatcher) {
    logger.debug(
      `PerceptionLogProvider.isEmpty: Checking perception log for actor ${actor.id}`
    );
    try {
      if (!actor.hasComponent(PERCEPTION_LOG_COMPONENT_ID)) {
        logger.debug(
          `PerceptionLogProvider.isEmpty: Actor ${actor.id} has no perception log component`
        );
        return true;
      }
      const perceptionData = actor.getComponentData(PERCEPTION_LOG_COMPONENT_ID);
      if (
        !perceptionData ||
        !Array.isArray(perceptionData.logEntries) ||
        perceptionData.logEntries.length === 0
      ) {
        logger.debug(
          `PerceptionLogProvider.isEmpty: Actor ${actor.id} perception log is empty`
        );
        return true;
      }
      logger.debug(
        `PerceptionLogProvider.isEmpty: Actor ${actor.id} has ${perceptionData.logEntries.length} entries`
      );
      return false;
    } catch (error) {
      // Fail safe: treat errors as empty to avoid blocking gameplay
      if (dispatcher) {
        safeDispatchError(
          dispatcher,
          `PerceptionLogProvider.isEmpty: Error checking perception log for ${actor.id}: ${error.message}`,
          { error }
        );
      }
      logger.debug(
        `PerceptionLogProvider.isEmpty: Error occurred, treating as empty for safety`
      );
      return true;
    }
  }
}
