// src/utils/targetingUtils.js

/** @typedef {import('../interfaces/ILogger.js').ILogger} ILogger */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./nameMatcher.js').NameMatchCandidate} NameMatchCandidate */
/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * @description Gathers and prepares a list of name match candidates from a given
 * source of entity IDs. Each ID is resolved to an Entity via the provided
 * EntityManager, then a display name is retrieved using the supplied
 * getDisplayNameUtil function. Invalid IDs, missing entities, or entities
 * without a valid name are skipped. An optional entity ID can be excluded from
 * the results (useful for filtering out the actor themselves).
 * @param {Iterable<string> | (() => Iterable<string>)} entityIdsIteratorOrFn -
 *  An iterable of entity IDs or a function returning one.
 * @param {EntityManager} entityManager - Manager used to resolve entity IDs.
 * @param {(entity: Entity, fallback: string, logger: ILogger) => string} getDisplayNameUtil -
 *  Utility used to obtain an entity's display name.
 * @param {ILogger} logger - Logger for debug/warn messages.
 * @param {{ entityIdToExclude?: string|null, domainContextForLogging?: string }} [options]
 *  - Optional settings.
 * @returns {Promise<NameMatchCandidate[]>} Array of {id, name} ready for
 *  name-matching utilities.
 */
export async function prepareNameMatchCandidates(
  entityIdsIteratorOrFn,
  entityManager,
  getDisplayNameUtil,
  logger,
  options = {}
) {
  const { entityIdToExclude = null, domainContextForLogging = 'unknown' } =
    options;

  logger.debug(
    `prepareNameMatchCandidates called for domain: ${domainContextForLogging}`
  );

  const entityIds =
    typeof entityIdsIteratorOrFn === 'function'
      ? entityIdsIteratorOrFn()
      : entityIdsIteratorOrFn;

  const size =
    entityIds && typeof entityIds.size === 'number'
      ? entityIds.size
      : Array.isArray(entityIds)
        ? entityIds.length
        : undefined;

  if (!entityIds || size === 0) {
    logger.debug(
      `prepareNameMatchCandidates: No entity IDs provided by source for ${domainContextForLogging}.`
    );
    return [];
  }

  const candidates = [];
  for (const itemId of entityIds) {
    if (entityIdToExclude && itemId === entityIdToExclude) {
      logger.debug(
        `prepareNameMatchCandidates: Excluding entity ID '${itemId}' (actor) from domain '${domainContextForLogging}'.`
      );
      continue;
    }

    if (typeof itemId !== 'string' || itemId === '') {
      logger.warn(
        `prepareNameMatchCandidates: Invalid (non-string or empty) entity ID encountered in ${domainContextForLogging}: ${JSON.stringify(
          itemId
        )}. Skipping.`
      );
      continue;
    }

    const itemEntity = entityManager.getEntityInstance(itemId);

    if (itemEntity) {
      const name = getDisplayNameUtil(itemEntity, itemEntity.id, logger);
      if (name && typeof name === 'string' && name.trim() !== '') {
        candidates.push({ id: itemEntity.id, name });
      } else {
        logger.warn(
          `prepareNameMatchCandidates: Entity '${itemId}' in ${domainContextForLogging} returned no valid name from getEntityDisplayName. Skipping. Name resolved to: ${name}`
        );
      }
    } else {
      logger.warn(
        `prepareNameMatchCandidates: Entity '${itemId}' from ${domainContextForLogging} not found via entityManager. Skipping.`
      );
    }
  }

  logger.debug(
    `prepareNameMatchCandidates: Produced ${candidates.length} candidates for domain: ${domainContextForLogging}.`
  );

  return candidates;
}
