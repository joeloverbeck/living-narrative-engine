/**
 * @file Helper for validating serialized component data during entity reconstruction.
 */

/**
 * Validate a serialized component for reconstruction.
 *
 * @description
 * Used by EntityFactory to validate each component when rebuilding an entity
 * from saved data.
 * @param {string} typeId - Component type ID.
 * @param {object|null} data - Serialized component data or null.
 * @param {import('../../interfaces/coreServices.js').ISchemaValidator} validator - Schema validator.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger instance.
 * @param {string} instanceId - Entity instance ID for context.
 * @param {string} definitionId - Definition ID for context.
 * @returns {object|null} Validated and cloned component data, or null when data is null.
 * @throws {Error} When validation fails.
 */
export function validateSerializedComponent(
  typeId,
  data,
  validator,
  logger,
  instanceId,
  definitionId
) {
  logger.debug(
    `[EntityFactory] [RECONSTRUCT_ENTITY_LOG] Validating component '${typeId}' for entity '${instanceId}'. Data: ${JSON.stringify(
      data
    )}`
  );
  if (data === null) {
    return null;
  }
  const context = `Reconstruction component ${typeId} for entity ${instanceId} (definition ${definitionId})`;
  const result = validator.validate(typeId, data, context);
  if (result.isValid) {
    return JSON.parse(JSON.stringify(data));
  }
  const errorMsg = `${context} Errors: ${JSON.stringify(result.errors)}`;
  logger.error(`[EntityFactory] ${errorMsg}`);
  throw new Error(errorMsg);
}

export default validateSerializedComponent;
