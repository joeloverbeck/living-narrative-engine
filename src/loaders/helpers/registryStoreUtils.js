/**
 * @file Utility for storing items in the registry with standardized metadata and override checks.
 */

/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
import { SCOPES_KEY } from '../../constants/dataRegistryKeys.js';
import { DuplicateContentError } from '../../errors/duplicateContentError.js';

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
  const isScope = category === SCOPES_KEY;

  let dataWithMetadata;
  let finalId = baseItemId;
  if (isEntityDefinition || isEntityInstance || isScope || category === 'actions') {
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

  // Check if the item already exists
  const existingItem = registry.get(category, qualifiedId);
  if (existingItem) {
    // Get the mod ID of the existing item
    const existingModId = existingItem._modId || existingItem.modId || 'unknown';
    
    // Extract content type from category (remove trailing 's' if present)
    const contentType = category.endsWith('s') ? category.slice(0, -1) : category;
    
    throw new DuplicateContentError(
      contentType,
      qualifiedId,
      modId,
      existingModId,
      sourceFilename
    );
  }

  // Store the item since no duplicate exists
  const didOverride = registry.store(category, qualifiedId, dataWithMetadata);

  logger.debug(
    `${loaderName} [${modId}]: Item '${qualifiedId}' (Base: '${baseItemId}') stored successfully in category '${category}'.`
  );

  return { qualifiedId, didOverride };
}

export default storeItemInRegistry;
