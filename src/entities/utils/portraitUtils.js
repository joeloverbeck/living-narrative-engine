// src/entities/utils/portraitUtils.js

import { isNonBlankString } from '../../utils/textUtils.js';
import { safeDispatchError } from '../../utils/safeDispatchErrorUtils.js';
import { extractModId } from '../../utils/idUtils.js';
import { PORTRAIT_COMPONENT_ID } from '../../constants/componentIds.js';

/**
 * Helper utilities for building entity portrait data.
 *
 * @module portraitUtils
 */

/**
 * Constructs the resolved portrait path using the mod ID and image path.
 *
 * @param {string} modId - The identifier of the mod.
 * @param {string} imagePath - Raw image path from the portrait component.
 * @returns {string} The resolved portrait image path.
 */
export function buildPortraitPath(modId, imagePath) {
  return `/data/mods/${modId}/${imagePath}`;
}

/**
 * Normalizes alternative text for portrait images.
 *
 * @param {string | undefined} rawAltText - Alt text from the portrait component.
 * @returns {string | null} Trimmed alt text or null if not provided.
 */
export function buildAltText(rawAltText) {
  return isNonBlankString(rawAltText) ? rawAltText.trim() : null;
}

/**
 * Builds portrait path and alt text for an entity.
 *
 * @param {import('../entity.js').default} entity - The entity instance to read portrait data from.
 * @param {string} contextMsg - The calling method name for log messages.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger for diagnostics.
 * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} safeEventDispatcher - Dispatcher for error events.
 * @param {string} logPrefix - Prefix for log messages.
 * @returns {{ path: string, altText: string | null } | null} Object with path and alt text, or null if portrait data is invalid.
 */
export function buildPortraitInfo(
  entity,
  contextMsg,
  logger,
  safeEventDispatcher,
  logPrefix
) {
  const isLocation = contextMsg === 'getLocationPortraitData';
  const label = isLocation ? 'Location entity' : 'Entity';
  const successSubject = isLocation
    ? `location '${entity.id}'`
    : `'${entity.id}'`;

  const portraitComponent = entity.getComponentData(PORTRAIT_COMPONENT_ID);
  if (
    !portraitComponent ||
    typeof portraitComponent.imagePath !== 'string' ||
    !portraitComponent.imagePath.trim()
  ) {
    logger.debug(
      `${logPrefix} ${contextMsg}: ${label} '${entity.id}' has no valid PORTRAIT_COMPONENT_ID data or imagePath.`
    );
    return null;
  }

  if (typeof entity.definitionId !== 'string' || !entity.definitionId) {
    logger.warn(
      `${logPrefix} ${contextMsg}: Invalid or missing definitionId. Expected string, got:`,
      entity.definitionId
    );
    return null;
  }

  const modId = extractModId(entity.definitionId);
  if (!modId) {
    safeDispatchError(
      safeEventDispatcher,
      `Entity definitionId '${entity.definitionId}' has invalid format. Expected format 'modId:entityName'.`,
      {
        raw: JSON.stringify({
          definitionId: entity.definitionId,
          expectedFormat: 'modId:entityName',
          functionName: 'extractModId',
        }),
        stack: new Error().stack,
      },
      logger
    );
    return null;
  }

  const imagePath = portraitComponent.imagePath.trim();
  const fullPath = buildPortraitPath(modId, imagePath);
  const altText = buildAltText(portraitComponent.altText);

  logger.debug(
    `${logPrefix} ${contextMsg}: Constructed portrait path for ${successSubject}: ${fullPath}`
  );

  return { path: fullPath, altText };
}
