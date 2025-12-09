/**
 * @file Entity path validation for modifier conditions
 * @description Validates that entity paths in modifier conditions follow the
 * correct format: entity.[role].[optional.path.segments]
 * @see specs/modifier-entity-path-validation.md
 */

/**
 * Valid entity roles in modifier context
 *
 * @type {Set<string>}
 */
const VALID_ENTITY_ROLES = new Set([
  'actor',
  'primary',
  'secondary',
  'tertiary',
  'location',
]);

/**
 * Required prefix for all entity paths in modifier conditions
 *
 * @type {string}
 */
const ENTITY_PREFIX = 'entity.';

/**
 * Validates a modifier entity path string
 *
 * @param {string} pathString - The entity path to validate
 * @returns {{isValid: boolean, error: string|null, normalizedPath: string|null}} Validation result
 */
function validateModifierEntityPath(pathString) {
  // Handle null/undefined/non-string
  if (pathString === null || pathString === undefined || typeof pathString !== 'string') {
    return {
      isValid: false,
      error: 'Entity path must be a non-null string',
      normalizedPath: null,
    };
  }

  // Trim whitespace
  const trimmed = pathString.trim();

  // Handle empty string
  if (trimmed === '') {
    return {
      isValid: false,
      error: 'Entity path cannot be empty',
      normalizedPath: null,
    };
  }

  // Check for entity. prefix
  if (!trimmed.startsWith(ENTITY_PREFIX)) {
    return {
      isValid: false,
      error: `Entity path must start with "${ENTITY_PREFIX}" but got "${trimmed}"`,
      normalizedPath: null,
    };
  }

  // Split and validate role
  const segments = trimmed.split('.');

  // Must have at least 2 segments: "entity" and role
  if (segments.length < 2) {
    return {
      isValid: false,
      error: `Entity path must have at least two segments (entity.role), got "${trimmed}"`,
      normalizedPath: null,
    };
  }

  const role = segments[1];

  // Check for empty role (e.g., "entity.")
  if (role === '') {
    return {
      isValid: false,
      error: 'Entity path has empty role segment',
      normalizedPath: null,
    };
  }

  // Validate role is one of the allowed values
  if (!VALID_ENTITY_ROLES.has(role)) {
    return {
      isValid: false,
      error: `Invalid entity role "${role}". Valid roles are: ${[...VALID_ENTITY_ROLES].join(', ')}`,
      normalizedPath: null,
    };
  }

  // Check for malformed paths like "entity..actor"
  if (segments.some((s, i) => i > 0 && s === '')) {
    return {
      isValid: false,
      error: `Entity path contains empty segment: "${trimmed}"`,
      normalizedPath: null,
    };
  }

  return {
    isValid: true,
    error: null,
    normalizedPath: trimmed,
  };
}

/**
 * @typedef {object} PathExtractionResult
 * @property {string} path - The extracted path string
 * @property {string} operatorName - Name of the operator
 * @property {string} location - Location in the logic tree
 */

/**
 * Extracts all entity path strings from a JSON Logic condition object
 *
 * @param {object} logicObject - JSON Logic condition object
 * @param {Set<string>} operatorNames - Names of operators that take entity paths as first arg
 * @returns {PathExtractionResult[]} Extracted paths
 */
function extractEntityPathsFromLogic(
  logicObject,
  operatorNames = new Set(['isSlotExposed', 'isSocketCovered'])
) {
  /** @type {PathExtractionResult[]} */
  const results = [];

  /**
   * Recursively traverses the logic object to find operator calls
   *
   * @param {any} obj - Current object being traversed
   * @param {string} location - Current location path for error reporting
   */
  function traverse(obj, location = 'root') {
    if (obj === null || obj === undefined || typeof obj !== 'object') {
      return;
    }

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => traverse(item, `${location}[${index}]`));
      return;
    }

    for (const [key, value] of Object.entries(obj)) {
      if (operatorNames.has(key)) {
        // This is an operator call - first argument should be entity path
        if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
          results.push({
            path: value[0],
            operatorName: key,
            location: `${location}.${key}`,
          });
        }
      }
      traverse(value, `${location}.${key}`);
    }
  }

  traverse(logicObject);
  return results;
}

/**
 * @typedef {object} ValidationError
 * @property {string} path - The invalid path
 * @property {string} error - The error message
 * @property {string} location - Location in the logic tree
 * @property {string} operatorName - Name of the operator
 */

/**
 * @typedef {object} ModifierCondition
 * @property {object} [logic] - The JSON Logic condition object
 */

/**
 * Validates all entity paths in a modifier's condition logic
 *
 * @param {ModifierCondition|null|undefined} condition - Modifier condition object with .logic property
 * @param {Set<string>} operatorNames - Names of operators that take entity paths
 * @returns {{isValid: boolean, errors: ValidationError[]}} Validation result
 */
function validateModifierCondition(
  condition,
  operatorNames = new Set(['isSlotExposed', 'isSocketCovered'])
) {
  if (!condition || !condition.logic) {
    return { isValid: true, errors: [] };
  }

  const paths = extractEntityPathsFromLogic(condition.logic, operatorNames);
  /** @type {ValidationError[]} */
  const errors = [];

  for (const { path, operatorName, location } of paths) {
    const result = validateModifierEntityPath(path);
    if (!result.isValid) {
      errors.push({
        path,
        error: /** @type {string} */ (result.error),
        location,
        operatorName,
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export {
  VALID_ENTITY_ROLES,
  ENTITY_PREFIX,
  validateModifierEntityPath,
  extractEntityPathsFromLogic,
  validateModifierCondition,
};
