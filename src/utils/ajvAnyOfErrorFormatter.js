/**
 * @file ajvAnyOfErrorFormatter.js
 * @description Enhanced AJV error formatter that handles anyOf/oneOf validation errors more intelligently
 * with early pattern detection for common issues
 */

/**
 * Formats entity_id typo error with correction guidance
 *
 * @param {import('ajv').ErrorObject[]} errors - AJV validation errors
 * @param {any} data - The data being validated
 * @returns {string} Formatted error message
 */
function formatEntityIdTypo(errors, data) {
  const operationType = data?.type || 'UNKNOWN';

  const lines = [`Operation type '${operationType}' has invalid parameters:`];
  lines.push(`  - /parameters: Unexpected property 'entity_id'`);
  lines.push('');
  lines.push('Common issue detected: "entity_id" should be "entity_ref"');
  lines.push(
    `The ${operationType} operation expects "entity_ref", not "entity_id"`
  );

  return lines.join('\n');
}

/**
 * Formats missing type field error with helpful examples
 *
 * @param {import('ajv').ErrorObject[]} _errors - AJV validation errors (unused)
 * @param {any} _data - The data being validated (unused)
 * @returns {string} Formatted error message
 */
function formatMissingTypeField(_errors, _data) {
  const commonTypes = [
    'QUERY_COMPONENT',
    'MODIFY_COMPONENT',
    'ADD_COMPONENT',
    'REMOVE_COMPONENT',
    'DISPATCH_EVENT',
    'IF',
    'FOR_EACH',
    'LOG',
    'SET_VARIABLE',
    'QUERY_ENTITIES',
    'HAS_COMPONENT',
    'GET_NAME',
  ];

  const lines = [
    'Missing operation type - this operation needs a "type" field.',
    '',
    'For regular operations, use:',
    '  {"type": "OPERATION_NAME", "parameters": {...}}',
    '',
    'For macro references, use:',
    '  {"macro": "namespace:macroId"}',
    '',
    'Common operation types:',
  ];

  commonTypes.forEach((type) => lines.push(`  - ${type}`));
  lines.push('  ... and more');

  return lines.join('\n');
}

/**
 * Formats invalid enum error with schema fix guidance
 *
 * @param {import('ajv').ErrorObject} error - Single enum error
 * @param {any} data - The data being validated
 * @returns {string} Formatted error message
 */
function formatEnumError(error, data) {
  const fieldPath = error.instancePath || '';
  const field = fieldPath.split('/').pop() || 'field';
  const allowedValues = error.params?.allowedValues || [];
  const invalidValue = error.data;

  // Infer schema file from operation type
  const operationType = data?.type || 'UNKNOWN';
  let schemaFile = 'the relevant schema file';

  if (operationType !== 'UNKNOWN') {
    // Convert operation type to schema file name
    // e.g., DISPATCH_PERCEPTIBLE_EVENT -> dispatchPerceptibleEvent.schema.json
    const schemaName = operationType
      .toLowerCase()
      .split('_')
      .map((word, index) =>
        index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)
      )
      .join('');
    schemaFile = `data/schemas/operations/${schemaName}.schema.json`;
  }

  const lines = [
    `Invalid enum value '${invalidValue}'. Allowed values: [${allowedValues.join(', ')}]`,
    '',
    `💡 FIX: Add "${invalidValue}" to the enum in:`,
    `  ${schemaFile}`,
    `  Look for the "${field}" enum array and add your value.`,
  ];

  return lines.join('\n');
}

/**
 * Detects common error patterns and returns specialized error messages
 *
 * Extracts the actual failing data object using the instance path from an error
 *
 * @param {any} rootData - The root data object being validated
 * @param {import('ajv').ErrorObject} error - An AJV error with instancePath
 * @returns {any} The extracted data at the error's instance path, or rootData if path is empty
 */
function extractFailingData(rootData, error) {
  if (!error.instancePath || error.instancePath === '') {
    return rootData;
  }

  // instancePath format: "/operations/5" or "/rules/0/actions/1" or "/type"
  const pathParts = error.instancePath.split('/').filter((p) => p !== '');

  // Special case: if the path points to a field like "/type" or "/parameters/type",
  // we want the parent object, not the field value
  // Check if the last part is a common operation field we're validating
  const lastPart = pathParts[pathParts.length - 1];
  const isFieldPath =
    lastPart === 'type' ||
    lastPart === 'macro' ||
    lastPart === 'parameters';

  // Navigate to parent object if this is a field path
  const navigationParts = isFieldPath
    ? pathParts.slice(0, -1)
    : pathParts;

  // If navigation parts is empty, return root
  if (navigationParts.length === 0) {
    return rootData;
  }

  let current = rootData;
  for (const part of navigationParts) {
    if (current === null || current === undefined) {
      return rootData; // Fallback to root if we can't navigate
    }
    current = current[part];
  }

  return current !== undefined ? current : rootData;
}

/**
 * This function provides early detection for frequent validation issues,
 * returning targeted error messages before the complex anyOf processing begins.
 *
 * @param {import('ajv').ErrorObject[]} errors - AJV validation errors
 * @param {any} data - The data being validated
 * @returns {string|null} Formatted error message if pattern detected, null otherwise
 */
function detectCommonPatterns(errors, data) {
  // Pattern 1: entity_id vs entity_ref typo (UNCONDITIONAL - no error count threshold)
  if (errors.some((e) => e.params?.additionalProperty === 'entity_id')) {
    return formatEntityIdTypo(errors, data);
  }

  // Pattern 2: Missing type field (BEFORE anyOf processing)
  // Only trigger if we have many errors AND no type/macro field
  // Extract the actual failing object using instancePath from first error
  if (errors.length > 50) {
    const firstError = errors[0];
    const failingData = extractFailingData(data, firstError);

    // Check if the failing data (not the root data) is missing type and macro
    // IMPORTANT: Check that type field is actually missing (undefined), not just falsy
    // (e.g., type: 42 should NOT trigger this pattern)
    if (
      !Object.prototype.hasOwnProperty.call(failingData, 'type') &&
      !Object.prototype.hasOwnProperty.call(failingData, 'macro')
    ) {
      return formatMissingTypeField(errors, failingData);
    }
  }

  // Pattern 3: Invalid enum value (GENERALIZED for all enums)
  const enumError = errors.find((e) => e.keyword === 'enum');
  if (enumError) {
    return formatEnumError(enumError, data);
  }

  // No pattern detected, use default formatting
  return null;
}

/**
 * Groups AJV errors by the operation type they were attempting to validate against
 *
 * @param {import('ajv').ErrorObject[]} errors - AJV validation errors
 * @returns {Map<string, import('ajv').ErrorObject[]>} Map of operation type to errors
 */
function groupErrorsByOperationType(errors) {
  const grouped = new Map();

  // Find anyOf branch indices and their corresponding operation types
  errors.forEach((error) => {
    // Look for const validation in anyOf branches (e.g., #/anyOf/0/properties/type/const)
    const anyOfMatch = error.schemaPath.match(
      /#\/anyOf\/([0-9]+)\/properties\/type\/const/
    );
    if (anyOfMatch && error.params?.allowedValue) {
      const branchIndex = parseInt(anyOfMatch[1]);
      const operationType = error.params.allowedValue;

      // Collect all errors from this anyOf branch
      const branchErrors = errors.filter((e) =>
        e.schemaPath.startsWith(`#/anyOf/${branchIndex}/`)
      );

      grouped.set(operationType, branchErrors);
    }
  });

  return grouped;
}

/**
 * Extracts the specific failing data item from the full data using error paths
 *
 * @param {any} data - The full data being validated
 * @param {import('ajv').ErrorObject[]} errors - AJV validation errors
 * @returns {any} The specific data item that failed validation
 */
function extractFailingDataItem(data, errors) {
  if (!errors || errors.length === 0) return data;

  // PRIORITY 1: If root data has a type field, it's the operation - return immediately
  // This prevents over-navigation into nested properties like 'parameters'
  if (data?.type && typeof data.type === 'string') {
    return data;
  }

  // PRIORITY 2: Find the first error with a non-empty instancePath
  // Note: empty string "" is root level and should be treated as "no path"
  const errorWithPath = errors.find(
    (e) => e.instancePath && e.instancePath !== ''
  );
  if (!errorWithPath) return data;

  // Parse the instance path (e.g., "/actions/0" => ["actions", "0"])
  const pathSegments = errorWithPath.instancePath
    .split('/')
    .filter((seg) => seg !== '');

  // Navigate to the failing item
  let current = data;
  for (const segment of pathSegments) {
    if (current === null || current === undefined) break;
    // Handle array indices
    const index = parseInt(segment, 10);
    current = isNaN(index) ? current[segment] : current[index];
  }

  // If the extracted item doesn't have type context, fall back to root data
  return current || data;
}

/**
 * Finds the most likely intended operation type based on the actual data
 *
 * @param {any} data - The data being validated
 * @param {Map<string, import('ajv').ErrorObject[]>} groupedErrors - Grouped errors
 * @param {import('ajv').ErrorObject[]} errors - AJV validation errors
 * @returns {string|null} The most likely operation type
 */
function findIntendedOperationType(data, groupedErrors, errors) {
  // Extract the actual failing operation from the data
  const failingItem = extractFailingDataItem(data, errors);

  // If the failing item has a type field, that's definitely the intended type
  if (failingItem?.type && typeof failingItem.type === 'string') {
    return failingItem.type;
  }

  // Otherwise, find the operation type with the fewest/most specific errors
  let bestMatch = null;
  let fewestErrors = Infinity;

  for (const [operationType, errors] of groupedErrors) {
    // Skip if this operation type has a const mismatch (wrong type)
    const hasTypeMismatch = errors.some(
      (e) => e.keyword === 'const' && e.schemaPath.includes('/type/const')
    );
    if (hasTypeMismatch) continue;

    if (errors.length < fewestErrors) {
      fewestErrors = errors.length;
      bestMatch = operationType;
    }
  }

  return bestMatch;
}

/**
 * Formats anyOf/oneOf validation errors intelligently
 *
 * @param {import('ajv').ErrorObject[]} errors - AJV validation errors
 * @param {any} data - The data being validated
 * @returns {string} Formatted error message
 */
export function formatAnyOfErrors(errors, data) {
  if (!errors || errors.length === 0) {
    return 'No validation errors';
  }

  // Check if this is an anyOf/oneOf validation with operation types
  const isOperationValidation = errors.some(
    (e) =>
      e.schemaPath.includes('anyOf') &&
      (e.schemaPath.includes('/properties/type/const') ||
        e.keyword === 'anyOf')
  );

  if (!isOperationValidation) {
    // Fall back to standard formatting for non-operation validations
    return formatStandardErrors(errors);
  }

  // Group errors by operation type
  const groupedErrors = groupErrorsByOperationType(errors);

  // Find the most likely intended operation
  const intendedType = findIntendedOperationType(data, groupedErrors, errors);

  // Special case: if we have a valid type but many errors, it's likely a parameter issue
  if (data?.type && errors.length > 100) {
    const lines = [`Operation type '${data.type}' has invalid parameters:`];

    // Find parameter-specific errors
    const paramErrors = errors.filter(
      (e) =>
        e.instancePath &&
        (e.instancePath.includes('/parameters') ||
          e.instancePath.includes('entity_id'))
    );

    if (paramErrors.length > 0) {
      // Show the first few parameter errors
      paramErrors.slice(0, 5).forEach((error) => {
        const path = error.instancePath || 'root';
        const message = formatSingleError(error);
        lines.push(`  - ${path}: ${message}`);
      });

      // Note: entity_id pattern should be caught by early detection now
      // This is a fallback in case pattern detection was bypassed
      if (errors.some((e) => e.params?.additionalProperty === 'entity_id')) {
        lines.push('');
        lines.push(
          'Common issue detected: "entity_id" should be "entity_ref"'
        );
        lines.push(
          'The GET_NAME operation expects "entity_ref", not "entity_id"'
        );
      }

      return lines.join('\n');
    }
  }

  if (intendedType) {
    // For a known type, find errors from the matching anyOf branch
    // First, check if we have it in grouped errors
    const relevantErrors = groupedErrors.get(intendedType) || [];

    if (relevantErrors.length > 0) {
      const lines = [`Operation type '${intendedType}' validation failed:`];

      // Filter out the type const error itself
      const paramErrors = relevantErrors.filter(
        (e) => !(e.keyword === 'const' && e.schemaPath.includes('/type/const'))
      );

      paramErrors.forEach((error) => {
        const path = error.instancePath || 'root';
        const message = formatSingleError(error);
        lines.push(`  - ${path}: ${message}`);
      });

      return lines.join('\n');
    }

    // If the type is valid but we have other errors, find errors from the correct branch
    // by looking for the branch index that doesn't have a type mismatch
    for (let i = 0; i < 100; i++) {
      // Assume max 100 anyOf branches
      const branchPath = `#/anyOf/${i}/`;
      const branchErrors = errors.filter((e) =>
        e.schemaPath.startsWith(branchPath)
      );

      if (branchErrors.length > 0) {
        // Check if this branch has a type mismatch
        const hasTypeMismatch = branchErrors.some(
          (e) =>
            e.keyword === 'const' &&
            e.schemaPath.includes('/type/const') &&
            e.params?.allowedValue !== intendedType
        );

        if (!hasTypeMismatch) {
          // This is likely the correct branch for our type
          const lines = [`Operation type '${intendedType}' validation failed:`];

          branchErrors.forEach((error) => {
            const path = error.instancePath || 'root';
            const message = formatSingleError(error);
            lines.push(`  - ${path}: ${message}`);
          });

          return lines.join('\n');
        }
      }
    }
  }

  // If we can't determine the intended type, show a summary
  return formatOperationTypeSummary(groupedErrors, data, errors);
}

/**
 * Formats a single AJV error into a readable message
 *
 * @param {import('ajv').ErrorObject} error - Single AJV error
 * @returns {string} Formatted error message
 */
function formatSingleError(error) {
  switch (error.keyword) {
    case 'required':
      return `Missing required property '${error.params?.missingProperty}'`;
    case 'additionalProperties':
      return `Unexpected property '${error.params?.additionalProperty}'`;
    case 'type':
      return `Expected type '${error.params?.type}' but got '${typeof error.data}'`;
    case 'const':
      return `Must be equal to '${error.params?.allowedValue}'`;
    case 'enum': {
      const allowedValues = error.params?.allowedValues || [];
      const providedValue = error.data;
      const fieldPath = error.instancePath || '';

      // Basic enum error message
      let message = `Invalid enum value '${providedValue}'. Allowed values: [${allowedValues.join(', ')}]`;

      // Special handling for perception_type enum errors (backward compatibility)
      if (fieldPath.includes('perception_type')) {
        message += `\n\n⚠️  ENUM VALIDATION ERROR for 'perception_type' field`;
        message += `\n  Provided value: "${providedValue}"`;
        message += `\n  Allowed values: ${allowedValues.join(', ')}`;
        message += `\n\n💡 FIX: Add "${providedValue}" to the enum in:`;
        message += `\n  data/schemas/operations/dispatchPerceptibleEvent.schema.json`;
        message += `\n  Look for the "perception_type" enum array and add your value.`;
      }

      return message;
    }
    default:
      return error.message || 'Validation failed';
  }
}

/**
 * Formats standard (non-anyOf) errors
 *
 * @param {import('ajv').ErrorObject[]} errors - AJV validation errors
 * @returns {string} Formatted error message
 */
function formatStandardErrors(errors) {
  const lines = ['Validation errors:'];

  errors.forEach((error) => {
    const path = error.instancePath || 'root';
    const message = formatSingleError(error);
    lines.push(`  - ${path}: ${message}`);
  });

  return lines.join('\\n');
}

/**
 * Formats a summary when we can't determine the intended operation type
 *
 * @param {Map<string, import('ajv').ErrorObject[]>} groupedErrors - Grouped errors
 * @param {any} data - The data being validated
 * @param {import('ajv').ErrorObject[]} errors - AJV validation errors for extraction
 * @returns {string} Formatted summary
 */
function formatOperationTypeSummary(groupedErrors, data, errors) {
  const lines = [];

  // Extract the actual failing item from the full data
  const failingItem = extractFailingDataItem(data, errors);

  // Check if this might be a macro reference formatted incorrectly
  if (failingItem?.macro && typeof failingItem.macro === 'string') {
    lines.push('Invalid macro reference format detected.');
    lines.push('For macro references, use this format:');
    lines.push('  {"macro": "namespace:macroId"}');
    lines.push('Do NOT include a "type" field with macro references.');
    return lines.join('\n');
  }

  if (failingItem?.type) {
    lines.push(`Unknown or invalid operation type: '${failingItem.type}'`);
    lines.push('Valid operation types include:');
    const types = Array.from(groupedErrors.keys());
    // Show more types for better debugging
    const displayTypes = types.slice(0, 15);
    displayTypes.forEach((type) => lines.push(`  - ${type}`));
    if (types.length > 15) {
      lines.push(`  ... and ${types.length - 15} more`);
    }
    lines.push('');
    lines.push('If this should be a macro reference, use:');
    lines.push('  {"macro": "namespace:macroId"}');
  } else {
    // Note: This fallback exists for when pattern detection doesn't trigger
    // (e.g., error count < 50). Pattern detection should handle most cases.
    lines.push('Missing operation type - this operation needs a "type" field.');
    lines.push('');
    lines.push('For regular operations, use:');
    lines.push('  {"type": "OPERATION_NAME", "parameters": {...}}');
    lines.push('');
    lines.push('For macro references, use:');
    lines.push('  {"macro": "namespace:macroId"}');
    lines.push('');
    lines.push('Common operation types:');
    const types = Array.from(groupedErrors.keys()).slice(0, 12);
    types.forEach((type) => lines.push(`  - ${type}`));
    if (groupedErrors.size > 12) {
      lines.push(`  ... and ${groupedErrors.size - 12} more`);
    }
  }

  return lines.join('\n');
}

/**
 * Enhances the existing formatAjvErrors function with anyOf intelligence
 * and early pattern detection for common issues
 *
 * @param {import('ajv').ErrorObject[]} errors - AJV validation errors
 * @param {any} [data] - The data being validated (optional)
 * @returns {string} Formatted error message
 */
export function formatAjvErrorsEnhanced(errors, data) {
  if (!errors || errors.length === 0) {
    return 'No validation errors';
  }

  // NEW: Pattern detection layer (BEFORE anyOf processing)
  // This provides fast, targeted error messages for common issues
  const patternResult = detectCommonPatterns(errors, data);
  if (patternResult) {
    return patternResult;
  }

  // Early detection for common issues that should have been caught by pre-validation
  // This serves as a fallback in case pre-validation was skipped
  if (errors.length > 100) {
    // Large number of errors usually indicates a missing type field or similar structural issue
    const hasOperationErrors = errors.some(
      (e) =>
        e.schemaPath &&
        e.schemaPath.includes('/anyOf/') &&
        e.schemaPath.includes('/properties/type/const')
    );

    if (hasOperationErrors) {
      // Extract the actual failing object using instancePath
      const firstError = errors[0];
      const failingData = extractFailingData(data, firstError);

      // This looks like operation validation with missing/invalid type
      // IMPORTANT: Check if type/macro fields are actually missing (undefined), not just falsy
      // (e.g., type: 'operation5' should NOT trigger missing type pattern)
      if (
        !Object.prototype.hasOwnProperty.call(failingData, 'type') &&
        !Object.prototype.hasOwnProperty.call(failingData, 'macro')
      ) {
        return 'Critical structural issue: Missing "type" field in operation.\n\nThis operation is missing the required "type" field. Add a "type" field with a valid operation type, or use {"macro": "namespace:id"} for macro references.\n\nNote: Pre-validation should have caught this - consider checking pre-validation configuration.';
      } else if (
        Object.prototype.hasOwnProperty.call(failingData, 'type') &&
        typeof failingData.type !== 'string'
      ) {
        return `Critical structural issue: Invalid "type" field value.\n\nThe "type" field must be a string, but got ${typeof failingData.type}. Use a valid operation type like "QUERY_COMPONENT" or "DISPATCH_EVENT".\n\nNote: Pre-validation should have caught this - consider checking pre-validation configuration.`;
      }
    }
  }

  // Check if this appears to be an anyOf validation (even with smaller error counts)
  const hasAnyOfErrors = errors.some(
    (e) =>
      e.keyword === 'anyOf' ||
      (e.schemaPath && e.schemaPath.includes('/anyOf/'))
  );

  if (hasAnyOfErrors || errors.length > 50) {
    // Try the intelligent anyOf formatter
    return formatAnyOfErrors(errors, data);
  }

  // For standard errors, use standard formatting
  return formatStandardErrors(errors);
}
