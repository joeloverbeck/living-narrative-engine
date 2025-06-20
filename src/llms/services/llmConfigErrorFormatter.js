/**
 * @file Utility functions for formatting LLM configuration
 * validation errors into a standardized structure.
 */

/**
 * @typedef {object} StandardizedValidationError
 * @description Defines a common structure for validation error objects/messages.
 * @property {string} errorType - The type of error (e.g., "SCHEMA_VALIDATION", "SEMANTIC_VALIDATION_MISSING_ASSEMBLY_KEY").
 * @property {string} configId - The configId of the configuration object where the error occurred. Can be "N/A (root property)" or the actual configId.
 * @property {string} path - A JSON path-like string indicating the location of the error (e.g., "configs.myConfig.promptElements[0].prefix", "defaultConfigId").
 * @property {string} message - A human-readable description of the error.
 * @property {any} [expected] - What was expected (optional, typically for schema errors, derived from params).
 * @property {any} [actual] - What was found (optional, typically for schema errors, e.g. type errors).
 * @property {object} [details] - Original error details from Ajv (ErrorObject) or the semantic validator (OriginalSemanticValidationError).
 */

/**
 * Converts an Ajv validation error into a standardized format.
 *
 * @param {import('ajv').ErrorObject} ajvError - The Ajv error to format.
 * @param {any} parsedRootData - Parsed LLM configuration root data.
 * @returns {StandardizedValidationError} The standardized error object.
 */
export function formatAjvErrorToStandardizedError(ajvError, parsedRootData) {
  let standardizedConfigId = 'N/A';
  let standardizedPath = ajvError.instancePath || '';

  const instancePathStr = ajvError.instancePath || '';
  const parts = instancePathStr.split('/').filter((p) => p.length > 0);

  if (instancePathStr === '') {
    standardizedConfigId = 'N/A (root data)';
    standardizedPath = '(root)';
  } else if (parts[0] === 'configs') {
    if (parts.length === 1) {
      standardizedConfigId = 'N/A (configs property)';
      standardizedPath = 'configs';
    } else if (parts.length > 1) {
      standardizedConfigId = parts[1];
      const relativePathParts = parts.slice(2);
      standardizedPath =
        `configs.${parts[1]}${relativePathParts.length > 0 ? '.' : ''}${relativePathParts.join('.')}`.replace(
          /\.(\d+)(?=\.|$)/g,
          '[$1]'
        );
    }
  } else if (
    parts.length > 0 &&
    (parts[0] === 'defaultConfigId' ||
      !parsedRootData ||
      !parsedRootData.configs ||
      parts[0] !== 'configs')
  ) {
    standardizedConfigId = 'N/A (root property)';
    standardizedPath = parts.join('.').replace(/\.(\d+)(?=\.|$)/g, '[$1]');
  } else {
    standardizedConfigId = 'N/A (unknown path structure)';
    standardizedPath = instancePathStr
      .substring(1)
      .replace(/\//g, '.')
      .replace(/\.(\d+)(?=\.|$)/g, '[$1]');
  }

  standardizedPath = standardizedPath.replace(/^\.+|\.+$/g, '');

  const standardizedError = {
    errorType: 'SCHEMA_VALIDATION',
    configId: standardizedConfigId,
    path:
      standardizedPath ||
      (instancePathStr === '/' ? '(root)' : instancePathStr),
    message: ajvError.message || 'Unknown schema validation error',
    details: { ...ajvError },
  };

  if (ajvError.params) {
    if (ajvError.params.allowedValues) {
      standardizedError.expected = ajvError.params.allowedValues;
    }
    // @ts-ignore
    if (ajvError.keyword === 'type' && ajvError.params.type) {
      // @ts-ignore
      standardizedError.expected = ajvError.params.type;
    }
    if (ajvError.keyword === 'additionalProperties') {
      standardizedError.message =
        `Object has an unexpected property: '${ajvError.params.additionalProperty}'. ${ajvError.message || ''}`.trim();
    }
  }
  return standardizedError;
}

/**
 * Converts a semantic validation error into a standardized format.
 *
 * @param {import('../../validation/llmConfigSemanticValidator.js').SemanticValidationError} semanticError
 *   The raw semantic validation error.
 * @returns {StandardizedValidationError} The standardized error object.
 */
export function formatSemanticErrorToStandardizedError(semanticError) {
  let standardizedConfigId = semanticError.configId;
  let standardizedPath = '';

  const relativeSemanticPath = semanticError.path || '';

  if (
    semanticError.errorType === 'SEMANTIC_VALIDATION_INVALID_CONFIGS_STRUCTURE'
  ) {
    standardizedConfigId = 'N/A (root property)';
    standardizedPath = 'configs';
  } else if (
    standardizedConfigId &&
    !standardizedConfigId.startsWith('N/A') &&
    standardizedConfigId !== 'N/A - Root "configs" property'
  ) {
    standardizedPath = `configs.${standardizedConfigId}`;
    if (
      relativeSemanticPath &&
      relativeSemanticPath !== '(dependencyInjection object root)'
    ) {
      standardizedPath += `.${relativeSemanticPath}`;
    }
  } else {
    standardizedConfigId = semanticError.configId || 'N/A';
    standardizedPath = relativeSemanticPath || '(path not specified)';
  }

  standardizedPath = standardizedPath
    .replace(/\.{2,}/g, '.')
    .replace(/^\.+|\.+$/g, '');

  return {
    errorType: semanticError.errorType || 'SEMANTIC_VALIDATION',
    configId: standardizedConfigId,
    path: standardizedPath,
    message: semanticError.message,
    details: { ...semanticError },
  };
}
