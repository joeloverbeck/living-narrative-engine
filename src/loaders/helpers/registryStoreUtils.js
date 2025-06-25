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
 * @returns {{qualifiedId: string, didOverride: boolean}} Result info.
 * @throws {TypeError} If any argument is of an unexpected type.
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
    const message = `${loaderName} [_storeItemInRegistry]: Category must be a non-empty string. Received: ${category}`;
    logger.error(message);
    throw new TypeError(message);
  }
  if (!modId || typeof modId !== 'string') {
    const message = `${loaderName} [_storeItemInRegistry]: ModId must be a non-empty string for category '${category}'. Received: ${modId}`;
    logger.error(message);
    throw new TypeError(message);
  }
  if (!baseItemId || typeof baseItemId !== 'string') {
    const message = `${loaderName} [_storeItemInRegistry]: BaseItemId must be a non-empty string for category '${category}', mod '${modId}'. Received: ${baseItemId}`;
    logger.error(message);
    throw new TypeError(message);
  }
  if (!dataToStore || typeof dataToStore !== 'object') {
    const message = `${loaderName} [_storeItemInRegistry]: Data for '${modId}:${baseItemId}' (category: ${category}) must be an object. Received: ${typeof dataToStore}`;
    logger.error(message);
    throw new TypeError(message);
  }

  const qualifiedId = `${modId}:${baseItemId}`;

  const isClassInstance = dataToStore.constructor !== Object;
  const isEntityDefinition = category === 'entityDefinitions';
  const isEntityInstance = category === 'entityInstances';
  const isScope = category === 'scopes';

  let dataWithMetadata;
  let finalId = baseItemId;
  if (isEntityDefinition || isEntityInstance || isScope) {
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
