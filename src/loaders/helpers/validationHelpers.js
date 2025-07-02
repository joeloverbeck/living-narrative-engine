/**
 * @file Helper functions for validating parameters passed to loaders.
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
import { validateNonEmptyString } from '../../utils/stringValidation.js';

/**
 * Validates parameters for {@link BaseManifestItemLoader.loadItemsForMod}.
 *
 * @param {ILogger} logger - Logger instance used for error messages.
 * @param {string} className - Name of the calling class for logs.
 * @param {string} modId - The mod identifier to validate.
 * @param {object} modManifest - Parsed mod manifest object.
 * @param {string} contentKey - Manifest content key.
 * @param {string} diskFolder - Folder on disk containing content files.
 * @param {string} registryKey - Registry key for storing items.
 * @returns {{modId:string,contentKey:string,diskFolder:string,registryKey:string}}
 *   Trimmed parameter values.
 * @throws {TypeError} When any required parameter is invalid.
 */
export function validateLoadItemsParams(
  logger,
  className,
  modId,
  modManifest,
  contentKey,
  diskFolder,
  registryKey
) {
  const trimmedModId = validateNonEmptyString('modId', modId);
  if (trimmedModId === null) {
    const msg = `${className}: Programming Error - Invalid 'modId' provided for loading content. Must be a non-empty string. Received: ${modId}`;
    logger.error(msg);
    throw new TypeError(msg);
  }

  if (!modManifest || typeof modManifest !== 'object') {
    const msg = `${className}: Programming Error - Invalid 'modManifest' provided for loading content for mod '${trimmedModId}'. Must be a non-null object. Received: ${modManifest}`;
    logger.error(msg);
    throw new TypeError(msg);
  }

  const trimmedContentKey = validateNonEmptyString('contentKey', contentKey);
  if (trimmedContentKey === null) {
    const msg = `${className}: Programming Error - Invalid 'contentKey' provided for loading ${registryKey} for mod '${trimmedModId}'. Must be a non-empty string. Received: ${contentKey}`;
    logger.error(msg);
    throw new TypeError(msg);
  }

  const trimmedDiskFolder = validateNonEmptyString('diskFolder', diskFolder);
  if (trimmedDiskFolder === null) {
    const msg = `${className}: Programming Error - Invalid 'diskFolder' provided for loading ${registryKey} for mod '${trimmedModId}'. Must be a non-empty string. Received: ${diskFolder}`;
    logger.error(msg);
    throw new TypeError(msg);
  }

  const trimmedRegistryKey = validateNonEmptyString('registryKey', registryKey);
  if (trimmedRegistryKey === null) {
    const msg = `${className}: Programming Error - Invalid 'registryKey' provided for loading content for mod '${trimmedModId}'. Must be a non-empty string. Received: ${registryKey}`;
    logger.error(msg);
    throw new TypeError(msg);
  }

  return {
    modId: trimmedModId,
    contentKey: trimmedContentKey,
    diskFolder: trimmedDiskFolder,
    registryKey: trimmedRegistryKey,
  };
}

export default { validateLoadItemsParams };
