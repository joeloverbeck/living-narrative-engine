/**
 * @file Utility for storing items in the registry with standardized metadata and override checks.
 */

/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Stores an item in the registry, augmenting it with metadata and logging overrides.
 *
 * @param {ILogger} logger - Logger for output.
 * @param {IDataRegistry} registry - Data registry instance.
 * @param {string} loaderName - Name of the loader for logging.
 * @param {string} category - Registry category.
 * @param {string} modId - ID of the mod providing the item.
 * @param {string} baseItemId - The item's unqualified ID.
 * @param {object} dataToStore - Data object to store.
 * @param {string} sourceFilename - Original filename for logging.
 * @returns {{qualifiedId: string|null, didOverride: boolean, error?: boolean}} Result info.
 */
export function storeItemInRegistry(
  logger,
  registry,
  loaderName,
  category,
  modId,
  baseItemId,
  dataToStore,
  sourceFilename
) {
  if (!category || typeof category !== 'string') {
    logger.error(
      `${loaderName} [_storeItemInRegistry]: Category must be a non-empty string. Received: ${category}`
    );
    return { qualifiedId: null, didOverride: false, error: true };
  }
  if (!modId || typeof modId !== 'string') {
    logger.error(
      `${loaderName} [_storeItemInRegistry]: ModId must be a non-empty string for category '${category}'. Received: ${modId}`
    );
    return { qualifiedId: null, didOverride: false, error: true };
  }
  if (!baseItemId || typeof baseItemId !== 'string') {
    logger.error(
      `${loaderName} [_storeItemInRegistry]: BaseItemId must be a non-empty string for category '${category}', mod '${modId}'. Received: ${baseItemId}`
    );
    return { qualifiedId: null, didOverride: false, error: true };
  }
  if (!dataToStore || typeof dataToStore !== 'object') {
    logger.error(
      `${loaderName} [_storeItemInRegistry]: Data for '${modId}:${baseItemId}' (category: ${category}) must be an object. Received: ${typeof dataToStore}`
    );
    return { qualifiedId: null, didOverride: false, error: true };
  }

  const qualifiedId = `${modId}:${baseItemId}`;

  const isClassInstance = dataToStore.constructor !== Object;
  const isEntityDefinition = category === 'entityDefinitions';
  const isEntityInstance = category === 'entityInstances';

  let dataWithMetadata;
  let finalId = baseItemId;
  if (isEntityDefinition || isEntityInstance) {
    finalId = qualifiedId;
  }

  if (isClassInstance) {
    dataWithMetadata = dataToStore;
    Object.defineProperties(dataWithMetadata, {
      _modId: { value: modId, writable: false, enumerable: true },
      _sourceFile: { value: sourceFilename, writable: false, enumerable: true },
      _fullId: { value: qualifiedId, writable: false, enumerable: true },
      id: { value: finalId, writable: false, enumerable: true },
    });
  } else {
    dataWithMetadata = Object.assign({}, dataToStore, {
      _modId: modId,
      _sourceFile: sourceFilename,
      _fullId: qualifiedId,
      id: finalId,
    });
  }

  logger.debug(
    `${loaderName} [${modId}]: Storing item in registry. Category: '${category}', Qualified ID: '${qualifiedId}', Base ID: '${baseItemId}', Filename: '${sourceFilename}'`
  );

  const didOverride = registry.store(category, qualifiedId, dataWithMetadata);

  if (didOverride) {
    logger.warn(
      `${loaderName} [${modId}]: Item '${qualifiedId}' (Base: '${baseItemId}') in category '${category}' from file '${sourceFilename}' overwrote an existing entry.`
    );
  } else {
    logger.debug(
      `${loaderName} [${modId}]: Item '${qualifiedId}' (Base: '${baseItemId}') stored successfully in category '${category}'.`
    );
  }

  return { qualifiedId, didOverride };
}

export default storeItemInRegistry;
