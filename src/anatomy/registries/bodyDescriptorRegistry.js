/**
 * @file Centralized registry for body descriptor configuration
 * Single source of truth for all descriptor metadata
 *
 * This registry eliminates the need for manual synchronization across multiple files
 * and provides a foundation for automatic validation of body descriptors.
 * @see data/schemas/anatomy.recipe.schema.json
 * @see src/anatomy/constants/bodyDescriptorConstants.js
 * @see data/mods/anatomy/anatomy-formatting/default.json
 */

/**
 * @typedef {object} BodyDescriptorMetadata
 * @property {string} schemaProperty - Property name in anatomy.recipe.schema.json (camelCase)
 * @property {string} displayLabel - Human-readable label for UI display
 * @property {string} displayKey - Key used in descriptionOrder config (snake_case)
 * @property {string} dataPath - Path to access data in body component
 * @property {string[]|null} validValues - Allowed values or null for free-form
 * @property {number} displayOrder - Numeric priority for display ordering
 * @property {(bodyComponent: object) => (string|undefined)} extractor - Function to extract value from body component
 * @property {(value: string) => string} formatter - Function to format value for display
 * @property {boolean} required - Whether the descriptor is required
 */

/**
 * Centralized registry of all body descriptor metadata.
 *
 * Each descriptor entry contains:
 * - schemaProperty: Matches the property name in anatomy.recipe.schema.json
 * - displayLabel: Human-readable name for display
 * - displayKey: Key used in anatomy-formatting/default.json descriptionOrder
 * - dataPath: Path for accessing data (body.descriptors.{schemaProperty})
 * - validValues: Array of valid values or null for free-form strings
 * - displayOrder: Numeric priority for sorting (lower = earlier)
 * - extractor: Function to extract value from body component
 * - formatter: Function to format value for display
 * - required: Boolean indicating if descriptor is required
 *
 * @type {{[key: string]: BodyDescriptorMetadata}}
 */
export const BODY_DESCRIPTOR_REGISTRY = {
  height: {
    schemaProperty: 'height',
    displayLabel: 'Height',
    displayKey: 'height', // Matches schema property (no conversion needed)
    dataPath: 'body.descriptors.height',
    validValues: [
      'microscopic',
      'minuscule',
      'tiny',
      'petite',
      'short',
      'average',
      'tall',
      'very-tall',
      'gigantic',
      'colossal',
      'titanic',
    ],
    displayOrder: 10,
    extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.height,
    formatter: (value) => `Height: ${value}`,
    required: false,
  },
  skinColor: {
    schemaProperty: 'skinColor', // camelCase in schema and data
    displayLabel: 'Skin color',
    displayKey: 'skin_color', // snake_case in formatting config (descriptionOrder)
    dataPath: 'body.descriptors.skinColor', // Uses schema property name
    validValues: null, // Free-form string
    displayOrder: 20,
    extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.skinColor,
    formatter: (value) => `Skin color: ${value}`,
    required: false,
  },
  build: {
    schemaProperty: 'build',
    displayLabel: 'Build',
    displayKey: 'build',
    dataPath: 'body.descriptors.build',
    validValues: [
      'skinny',
      'slim',
      'lissom',
      'toned',
      'athletic',
      'shapely',
      'hourglass',
      'thick',
      'muscular',
      'hulking',
      'stocky',
      'frail',
      'gaunt',
      'skeletal',
      'atrophied',
      'cadaverous',
      'massive',
      'willowy',
      'barrel-chested',
      'lanky',
    ],
    displayOrder: 30,
    extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.build,
    formatter: (value) => `Build: ${value}`,
    required: false,
  },
  composition: {
    schemaProperty: 'composition', // Note: NOT 'body_composition'
    displayLabel: 'Body composition',
    displayKey: 'body_composition', // snake_case in formatting config
    dataPath: 'body.descriptors.composition',
    validValues: [
      'underweight',
      'lean',
      'dense',
      'average',
      'soft',
      'bumpy',
      'chubby',
      'overweight',
      'obese',
      'atrophied',
      'emaciated',
      'skeletal',
      'malnourished',
      'dehydrated',
      'wasted',
      'desiccated',
      'bloated',
      'rotting',
    ],
    displayOrder: 40,
    extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.composition,
    formatter: (value) => `Body composition: ${value}`,
    required: false,
  },
  hairDensity: {
    schemaProperty: 'hairDensity', // camelCase in schema
    displayLabel: 'Body hair density',
    displayKey: 'body_hair', // snake_case in formatting config
    dataPath: 'body.descriptors.hairDensity',
    validValues: [
      'hairless',
      'sparse',
      'light',
      'moderate',
      'hairy',
      'very-hairy',
      'furred',
    ],
    displayOrder: 50,
    extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.hairDensity,
    formatter: (value) => `Body hair: ${value}`,
    required: false,
  },
  smell: {
    schemaProperty: 'smell',
    displayLabel: 'Smell',
    displayKey: 'smell',
    dataPath: 'body.descriptors.smell',
    validValues: null, // Free-form string
    displayOrder: 60,
    extractor: (bodyComponent) => bodyComponent?.body?.descriptors?.smell,
    formatter: (value) => `Smell: ${value}`,
    required: false,
  },
};

/**
 * Get descriptor metadata by schema property name
 *
 * @param {string} schemaProperty - Schema property name (e.g., 'height', 'skinColor')
 * @returns {BodyDescriptorMetadata|undefined} Descriptor metadata or undefined if not found
 * @example
 * const metadata = getDescriptorMetadata('height');
 * // Returns { schemaProperty: 'height', displayLabel: 'Height', ... }
 * @example
 * const unknown = getDescriptorMetadata('nonexistent');
 * // Returns undefined
 */
export function getDescriptorMetadata(schemaProperty) {
  return BODY_DESCRIPTOR_REGISTRY[schemaProperty];
}

/**
 * Get all registered descriptor names
 *
 * @returns {string[]} Array of descriptor schema property names
 * @example
 * const names = getAllDescriptorNames();
 * // Returns ['height', 'skinColor', 'build', 'composition', 'hairDensity', 'smell']
 */
export function getAllDescriptorNames() {
  return Object.keys(BODY_DESCRIPTOR_REGISTRY);
}

/**
 * Get descriptors sorted by display order
 *
 * Returns descriptor names sorted by their displayOrder property (ascending).
 * Lower displayOrder values appear first.
 *
 * @returns {string[]} Array of descriptor names sorted by displayOrder
 * @example
 * const ordered = getDescriptorsByDisplayOrder();
 * // Returns ['height', 'skinColor', 'build', 'composition', 'hairDensity', 'smell']
 * // Sorted by displayOrder: 10, 20, 30, 40, 50, 60
 */
export function getDescriptorsByDisplayOrder() {
  return Object.entries(BODY_DESCRIPTOR_REGISTRY)
    .sort(([, a], [, b]) => a.displayOrder - b.displayOrder)
    .map(([key]) => key);
}

/**
 * Validation result object
 *
 * @typedef {object} ValidationResult
 * @property {boolean} valid - Whether the validation passed
 * @property {string} [error] - Error message if validation failed (undefined if valid)
 */

/**
 * Validate descriptor value against registry
 *
 * Checks if a value is valid for a given descriptor:
 * - Unknown descriptor names fail validation
 * - Descriptors with validValues array must match one of the allowed values
 * - Descriptors with null validValues accept any value (free-form)
 *
 * @param {string} descriptorName - Descriptor name (schema property)
 * @param {string} value - Value to validate
 * @returns {ValidationResult} Validation result with valid flag and optional error message
 * @example
 * // Valid enumerated value
 * validateDescriptorValue('height', 'tall');
 * // Returns { valid: true }
 * @example
 * // Invalid enumerated value
 * validateDescriptorValue('height', 'super-tall');
 * // Returns { valid: false, error: "Invalid value 'super-tall' for height. Expected one of: gigantic, very-tall, tall, average, short, petite, tiny" }
 * @example
 * // Free-form descriptor
 * validateDescriptorValue('skinColor', 'olive');
 * // Returns { valid: true }
 * @example
 * // Unknown descriptor
 * validateDescriptorValue('unknown', 'value');
 * // Returns { valid: false, error: "Unknown descriptor: unknown" }
 */
export function validateDescriptorValue(descriptorName, value) {
  const metadata = BODY_DESCRIPTOR_REGISTRY[descriptorName];
  if (!metadata) {
    return { valid: false, error: `Unknown descriptor: ${descriptorName}` };
  }

  // Null validValues means free-form string - any value is valid
  if (metadata.validValues === null) {
    return { valid: true };
  }

  // Check if value is in the allowed list
  if (!metadata.validValues.includes(value)) {
    return {
      valid: false,
      error: `Invalid value '${value}' for ${descriptorName}. Expected one of: ${metadata.validValues.join(', ')}`,
    };
  }

  return { valid: true };
}
