// src/services/exitResolver.js
//
// Replaces the legacy connectionResolver.
// Resolves exits stored directly on the location’s `core:exits` component.

import { EXITS_COMPONENT_ID } from '../constants/componentIds.js';
import { NAME_COMPONENT_ID } from '../constants/componentIds.js';
import { getDisplayName, TARGET_MESSAGES } from '../utils/messages.js';

/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../events/validatedEventDispatcher.js').default} ValidatedEventDispatcher */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * @typedef {object} FetchedExitData
 * @property {string} direction
 * @property {import('../entities/entity.js').default|null} targetLocationEntity
 * @property {import('../entities/entity.js').default|null} blockerEntity
 */

/**
 * Find exits whose direction or display-name matches the user’s phrase.
 * Returns two buckets: exact‐direction matches and name/alias matches.
 *
 * @param {ActionContext} context
 * @param {string} rawPhrase
 * @param {ILogger} logger
 */
function findPotentialExitMatches(context, rawPhrase, logger) {
  const results = { directionMatches: [], nameMatches: [] };

  const { currentLocation, entityManager } = context;
  if (!currentLocation || !entityManager) {
    logger.error(
      'exitResolver: context missing currentLocation or entityManager'
    );
    return results;
  }

  const exitsData = currentLocation.getComponentData(EXITS_COMPONENT_ID);
  if (!Array.isArray(exitsData)) {
    logger.warn(
      `exitResolver: location '${currentLocation.id}' lacks core:exits data`
    );
    return results;
  }

  const phrase = rawPhrase.trim().toLowerCase();
  const seen = new Set(); // guard against dupes when dir==name

  for (const exit of exitsData) {
    if (
      !exit ||
      typeof exit.direction !== 'string' ||
      typeof exit.target !== 'string'
    )
      continue;

    const dir = exit.direction.toLowerCase();
    const targetLoc = entityManager.getEntityInstance(exit.target);
    const blockerEnt =
      exit.blocker && typeof exit.blocker === 'string'
        ? entityManager.getEntityInstance(exit.blocker)
        : null;

    /** @type {FetchedExitData} */
    const data = {
      direction: dir,
      targetLocationEntity: targetLoc,
      blockerEntity: blockerEnt,
    };

    // 1. direction exact match
    if (dir === phrase) {
      results.directionMatches.push(data);
      seen.add(dir);
      continue;
    }

    // 2. name / alias match against target location OR blocker entity
    const targetName = targetLoc
      ? targetLoc.getComponentData(NAME_COMPONENT_ID)?.value?.toLowerCase()
      : null;
    const blockerName = blockerEnt
      ? blockerEnt.getComponentData(NAME_COMPONENT_ID)?.value?.toLowerCase()
      : null;

    if (
      (targetName && targetName.includes(phrase)) ||
      (blockerName && blockerName.includes(phrase))
    ) {
      // prevent double-push when direction == name
      const key = `${dir}->${exit.target}`;
      if (!seen.has(key)) {
        results.nameMatches.push(data);
        seen.add(key);
      }
    }
  }

  return results;
}

/**
 * Public resolver: keeps the same contract used by TargetResolutionService.
 *
 * Returns **the exit object itself** (so callers have direction, target, blocker),
 * or `null` if not found / ambiguous. Callers that previously expected a
 * connection-entity ID now read `resolvedExit.target`.
 *
 * @param {ActionContext & { validatedEventDispatcher: ValidatedEventDispatcher, logger: ILogger }} context
 * @param {string}   rawPhrase
 * @param {string}   actionVerb           – verb for ambiguity prompts (“go”, “enter”, …)
 * @param {Function} findFn               – injected for unit tests
 * @returns {Promise<null|FetchedExitData>}
 */
export async function resolveTargetExit(
  context,
  rawPhrase,
  actionVerb = 'go',
  findFn = findPotentialExitMatches
) {
  const { validatedEventDispatcher: bus, logger } = context;

  if (!bus || !logger) {
    console.error(
      'exitResolver: context missing validatedEventDispatcher or logger'
    );
    return null;
  }
  const phrase = rawPhrase?.trim();
  if (!phrase) return null;

  const { directionMatches, nameMatches } = findFn(context, phrase, logger);

  // 1. unique direction
  if (directionMatches.length === 1) return directionMatches[0];

  // 2. ambiguous direction
  if (directionMatches.length > 1) {
    const list = directionMatches.map((d) => d.direction).join(', ');
    await bus.dispatchValidated('textUI:display_message', {
      text: TARGET_MESSAGES.AMBIGUOUS_DIRECTION
        ? TARGET_MESSAGES.AMBIGUOUS_DIRECTION(
            phrase,
            directionMatches.map((d) => d.direction)
          )
        : `There are multiple ways to go “${phrase}”: ${list}`,
      type: 'warning',
    });
    return null;
  }

  // 3. unique name
  if (nameMatches.length === 1) return nameMatches[0];

  // 4. ambiguous name
  if (nameMatches.length > 1) {
    const disp = nameMatches
      .map((m) => getDisplayName(m.targetLocationEntity) || m.direction)
      .join(', ');
    await bus.dispatchValidated('textUI:display_message', {
      text: TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT
        ? TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT(
            actionVerb,
            phrase,
            nameMatches.map((m) => m.targetLocationEntity)
          )
        : `Which “${phrase}” did you mean to ${actionVerb}? (${disp})`,
      type: 'warning',
    });
    return null;
  }

  // 5. not found
  await bus.dispatchValidated('textUI:display_message', {
    text: TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT
      ? TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(phrase)
      : `You don’t see any way to “${phrase}”.`,
    type: 'info',
  });
  return null;
}
