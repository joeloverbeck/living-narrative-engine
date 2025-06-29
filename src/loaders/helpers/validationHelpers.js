/**
 * @file Helper functions for validating parameters passed to loaders.
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

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
  if (typeof modId !== 'string' || modId.trim() === '') {
    const msg = `${className}: Programming Error - Invalid 'modId' provided for loading content. Must be a non-empty string. Received: ${modId}`;
    logger.error(msg);
    throw new TypeError(msg);
  }
  const trimmedModId = modId.trim();

  if (!modManifest || typeof modManifest !== 'object') {
    const msg = `${className}: Programming Error - Invalid 'modManifest' provided for loading content for mod '${trimmedModId}'. Must be a non-null object. Received: ${modManifest}`;
    logger.error(msg);
    throw new TypeError(msg);
  }

  if (typeof contentKey !== 'string' || contentKey.trim() === '') {
    const msg = `${className}: Programming Error - Invalid 'contentKey' provided for loading ${registryKey} for mod '${trimmedModId}'. Must be a non-empty string. Received: ${contentKey}`;
    logger.error(msg);
    throw new TypeError(msg);
  }
  const trimmedContentKey = contentKey.trim();

  if (typeof diskFolder !== 'string' || diskFolder.trim() === '') {
    const msg = `${className}: Programming Error - Invalid 'diskFolder' provided for loading ${registryKey} for mod '${trimmedModId}'. Must be a non-empty string. Received: ${diskFolder}`;
    logger.error(msg);
    throw new TypeError(msg);
  }
  const trimmedDiskFolder = diskFolder.trim();

  if (typeof registryKey !== 'string' || registryKey.trim() === '') {
    const msg = `${className}: Programming Error - Invalid 'registryKey' provided for loading content for mod '${trimmedModId}'. Must be a non-empty string. Received: ${registryKey}`;
    logger.error(msg);
    throw new TypeError(msg);
  }
  const trimmedRegistryKey = registryKey.trim();

  return {
    modId: trimmedModId,
    contentKey: trimmedContentKey,
    diskFolder: trimmedDiskFolder,
    registryKey: trimmedRegistryKey,
  };
}

export default { validateLoadItemsParams };
