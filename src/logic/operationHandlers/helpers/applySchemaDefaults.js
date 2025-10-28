// src/logic/operationHandlers/helpers/applySchemaDefaults.js

/**
 * @file Utility for applying JSON Schema default values to component data
 */

/**
 * Apply schema defaults to component value data
 *
 * @param {object} value - The component value data provided by the operation
 * @param {object|null} componentDefinition - The full component definition from registry
 * @param {import('../../../interfaces/coreServices.js').ILogger} logger - Logger for warnings
 * @returns {object} Component value with defaults applied
 */
export function applySchemaDefaults(value, componentDefinition, logger) {
  // If no component definition or no dataSchema, return value as-is
  if (
    !componentDefinition ||
    !componentDefinition.dataSchema ||
    !componentDefinition.dataSchema.properties
  ) {
    return value;
  }

  const { properties } = componentDefinition.dataSchema;
  const result = { ...value };

  // For each property in the schema
  for (const [propName, propSchema] of Object.entries(properties)) {
    // If property is missing from value and has a default in schema
    if (
      result[propName] === undefined &&
      propSchema.default !== undefined
    ) {
      result[propName] = propSchema.default;
      logger?.debug?.(
        `applySchemaDefaults: Applied default for '${propName}'`,
        { default: propSchema.default }
      );
    }

    // Handle nested objects with defaults
    if (propSchema.type === 'object' && propSchema.properties) {
      // If the property is undefined but has nested properties with defaults,
      // create the object and apply nested defaults
      if (result[propName] === undefined) {
        const hasNestedDefaults = Object.values(propSchema.properties).some(
          (nestedProp) => nestedProp.default !== undefined
        );

        if (hasNestedDefaults) {
          result[propName] = {};
          logger?.debug?.(
            `applySchemaDefaults: Created object for '${propName}' to apply nested defaults`
          );
        }
      }

      // Apply nested defaults if object exists
      if (result[propName] !== undefined) {
        result[propName] = applyNestedDefaults(
          result[propName],
          propSchema,
          logger
        );
      }
    }
  }

  return result;
}

/**
 * Recursively apply defaults to nested object properties
 *
 * @param {object} value - The nested object value
 * @param {object} schema - The schema for this nested object
 * @param {import('../../../interfaces/coreServices.js').ILogger} logger - Logger for warnings
 * @returns {object} Value with nested defaults applied
 * @private
 */
function applyNestedDefaults(value, schema, logger) {
  if (!schema.properties) {
    return value;
  }

  const result = { ...value };

  for (const [propName, propSchema] of Object.entries(schema.properties)) {
    if (
      result[propName] === undefined &&
      propSchema.default !== undefined
    ) {
      result[propName] = propSchema.default;
      logger?.debug?.(
        `applySchemaDefaults: Applied nested default for '${propName}'`,
        { default: propSchema.default }
      );
    }

    // Recurse for deeper nesting
    if (propSchema.type === 'object' && propSchema.properties) {
      // If the property is undefined but has nested properties with defaults,
      // create the object and recurse
      if (result[propName] === undefined) {
        const hasNestedDefaults = Object.values(propSchema.properties).some(
          (nestedProp) => nestedProp.default !== undefined
        );

        if (hasNestedDefaults) {
          result[propName] = {};
          logger?.debug?.(
            `applySchemaDefaults: Created nested object for '${propName}' to apply defaults`
          );
        }
      }

      // Recurse if object exists
      if (result[propName] !== undefined) {
        result[propName] = applyNestedDefaults(result[propName], propSchema, logger);
      }
    }
  }

  return result;
}
