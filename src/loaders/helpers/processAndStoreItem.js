/**
 * @file Helper for loaders that parses an item's ID, optionally registers
 * an inline schema, and stores the item in the data registry.
 */

import { parseAndValidateId } from '../../utils/idUtils.js';

/**
 * @typedef {object} ProcessOptions
 * @property {object} data - Raw item data containing the ID property.
 * @property {string} idProp - Property name holding the ID.
 * @property {string} category - Registry category for storage.
 * @property {string} modId - ID of the mod providing the item.
 * @property {string} filename - Source filename used for logging.
 * @property {string} [schemaProp] - Name of property containing an inline schema.
 * @property {string} [schemaSuffix] - Suffix to append to the full ID when
 *   constructing the schema ID.
 * @property {object} [schemaMessages] - Optional messages for schema
 *   registration logging.
 * @property {object} [parseOptions] - Options forwarded to
 *   {@link parseAndValidateId}.
 */

/**
 * Parses the item ID, registers an inline schema if configured, and stores the
 * item using the provided loader's registry helper.
 *
 * @param {object} loader - Loader instance providing `_logger`,
 *   `_registerItemSchema`, and `_storeItemInRegistry`.
 * @param {ProcessOptions} options - Options controlling the process.
 * @returns {Promise<{qualifiedId: string, didOverride: boolean, fullId: string, baseId: string}>}
 *   Parsed IDs and registry result information.
 */
export async function processAndStoreItem(loader, options) {
  const {
    data,
    idProp,
    category,
    modId,
    filename,
    schemaProp,
    schemaSuffix = '',
    schemaMessages = {},
    parseOptions = {},
  } = options;

  // Special handling for EntityDefinition instances - preserve their original id
  const isEntityDefinition =
    data && data.constructor && data.constructor.name === 'EntityDefinition';

  let fullId, baseId;
  if (isEntityDefinition) {
    // For EntityDefinition instances, use the existing id as fullId and extract baseId
    fullId = data[idProp];
    baseId = fullId.split(':').slice(1).join(':') || fullId;
  } else {
    // For other data types, use the normal parsing
    const parsed = parseAndValidateId(
      data,
      idProp,
      modId,
      filename,
      loader._logger,
      parseOptions
    );
    fullId = parsed.fullId;
    baseId = parsed.baseId;
  }

  if (
    schemaProp &&
    typeof loader._registerItemSchema === 'function' &&
    data &&
    typeof data[schemaProp] === 'object' &&
    data[schemaProp] !== null &&
    Object.keys(data[schemaProp]).length > 0
  ) {
    const messages =
      typeof schemaMessages === 'function'
        ? schemaMessages(fullId)
        : schemaMessages;
    await loader._registerItemSchema(
      data,
      schemaProp,
      `${fullId}${schemaSuffix}`,
      messages
    );
  }

  const { qualifiedId, didOverride } = loader._storeItemInRegistry(
    category,
    modId,
    baseId,
    data,
    filename
  );

  return { qualifiedId, didOverride, fullId, baseId };
}

export default processAndStoreItem;
