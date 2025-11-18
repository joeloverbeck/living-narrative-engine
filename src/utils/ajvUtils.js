/**
 * @module AjvUtils
 * @description Helper utilities for formatting Ajv validation errors.
 */

/**
 * Formats an array of Ajv error objects into a readable string. If the array is
 * empty or undefined, a placeholder message is returned.
 *
 * @param {import('ajv').ErrorObject[] | null | undefined} errors
 * @param data
 * @returns {string} Formatted error details.
 */
export function formatAjvErrors(errors, data = null) {
  if (!errors || errors.length === 0) {
    return 'No specific error details provided.';
  }

  // Check if we're dealing with a large number of errors (likely from anyOf/oneOf)
  // These cascading errors are misleading and need special handling
  if (errors.length > 50 && data) {
    // Try to extract the actual operation type from the data
    const operationType = data?.type || data?.parameters?.type;

    if (operationType) {
      // Find errors specifically related to this operation type
      const relevantErrors = errors.filter((error) => {
        // Look for errors that match after the type was identified
        return (
          !error.schemaPath.includes('/anyOf/') ||
          error.schemaPath.includes(`/${operationType}`)
        );
      });

      if (
        relevantErrors.length > 0 &&
        relevantErrors.length < errors.length / 2
      ) {
        // We found more specific errors, use those instead
        return `Validation failed for operation type '${operationType}':\\n${JSON.stringify(relevantErrors, null, 2)}`;
      }
    }

    // Try to provide a more helpful summary for anyOf validations
    const typeErrors = errors.filter(
      (e) => e.keyword === 'const' && e.schemaPath.includes('/type/const')
    );

    if (typeErrors.length > 0) {
      // This is definitely an anyOf validation issue
      const actualType = data?.type;
      const validTypes = typeErrors
        .map((e) => e.params?.allowedValue)
        .filter(Boolean);

      if (actualType && !validTypes.includes(actualType)) {
        return `Invalid operation type '${actualType}'. Valid types are: ${validTypes.slice(0, 10).join(', ')}${validTypes.length > 10 ? '...' : ''}`;
      }

      // The type might be valid but the structure is wrong
      if (actualType) {
        // Find the errors for this specific type
        const typeIndex = typeErrors.findIndex(
          (e) => e.params?.allowedValue === actualType
        );
        if (typeIndex >= 0 && typeIndex < typeErrors.length - 1) {
          // Extract errors between this type check and the next
          const nextTypeIndex = typeErrors.findIndex((e, i) => i > typeIndex);
          const relevantSlice =
            nextTypeIndex > 0
              ? errors.slice(typeIndex, nextTypeIndex)
              : errors.slice(typeIndex, typeIndex + 20); // Take next 20 errors as a sample

          return `Validation failed for '${actualType}' operation:\\n${JSON.stringify(relevantSlice, null, 2)}`;
        }
      }
    }

    // Last resort: warn about cascading errors and show a sample
    return (
      `Warning: ${errors.length} validation errors detected (likely cascading from anyOf validation).\\n` +
      `Showing first 10 errors:\\n${JSON.stringify(errors.slice(0, 10), null, 2)}\\n\\n` +
      `This usually indicates a structural issue with the operation. Check that:\\n` +
      `1. The operation type is valid\\n` +
      `2. The parameters are at the correct nesting level\\n` +
      `3. Required fields are present for the operation type`
    );
  }

  // Standard formatting for reasonable error counts
  return JSON.stringify(errors, null, 2);
}
