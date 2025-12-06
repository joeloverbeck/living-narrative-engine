/**
 * @file Body descriptor constants - Exports registry-based constants
 * @deprecated Import directly from bodyDescriptorRegistry instead
 * This file maintained for backward compatibility
 *
 * All constants are now derived from the centralized registry at:
 * @see ../registries/bodyDescriptorRegistry.js
 *
 * Migration note: This file will be removed in a future major version.
 * Please update imports to use the registry directly where possible.
 */

import { BODY_DESCRIPTOR_REGISTRY } from '../registries/bodyDescriptorRegistry.js';

/**
 * Convert array of values to object with UPPER_CASE keys
 * Converts hyphenated values to UPPER_SNAKE_CASE
 *
 * @private
 * @param {string[]|null} values - Array of values to convert
 * @returns {object} Object with uppercase keys mapping to original values
 * @example
 * arrayToConstantObject(['athletic', 'very-tall'])
 * // Returns { ATHLETIC: 'athletic', VERY_TALL: 'very-tall' }
 */
function arrayToConstantObject(values) {
  if (!values) return {};
  return values.reduce((acc, value) => {
    const key = value.toUpperCase().replace(/-/g, '_');
    acc[key] = value;
    return acc;
  }, {});
}

/**
 * Valid body build types
 *
 * @deprecated Import BODY_DESCRIPTOR_REGISTRY.build.validValues instead
 */
export const BODY_BUILD_TYPES = arrayToConstantObject(
  BODY_DESCRIPTOR_REGISTRY.build?.validValues
);

/**
 * Valid body hair density levels
 *
 * @deprecated Import BODY_DESCRIPTOR_REGISTRY.hairDensity.validValues instead
 */
export const BODY_HAIR_DENSITY = arrayToConstantObject(
  BODY_DESCRIPTOR_REGISTRY.hairDensity?.validValues
);

/**
 * Valid body composition types
 *
 * @deprecated Import BODY_DESCRIPTOR_REGISTRY.composition.validValues instead
 */
export const BODY_COMPOSITION_TYPES = arrayToConstantObject(
  BODY_DESCRIPTOR_REGISTRY.composition?.validValues
);

/**
 * Valid height categories
 *
 * @deprecated Import BODY_DESCRIPTOR_REGISTRY.height.validValues instead
 */
export const HEIGHT_CATEGORIES = arrayToConstantObject(
  BODY_DESCRIPTOR_REGISTRY.height?.validValues
);

/**
 * Descriptor metadata including display labels and validation info
 *
 * @deprecated Import BODY_DESCRIPTOR_REGISTRY directly instead
 */
export const DESCRIPTOR_METADATA = Object.entries(
  BODY_DESCRIPTOR_REGISTRY
).reduce((acc, [key, metadata]) => {
  acc[key] = {
    label: metadata.displayLabel,
    validValues: metadata.validValues,
    description: `${metadata.displayLabel} descriptor`,
  };
  return acc;
}, {});

/**
 * All supported descriptor property names
 *
 * @deprecated Import from bodyDescriptorRegistry.getAllDescriptorNames() instead
 */
export const SUPPORTED_DESCRIPTOR_PROPERTIES = Object.keys(DESCRIPTOR_METADATA);

/**
 * Re-export registry for convenience
 * This is the recommended import for new code
 */
export { BODY_DESCRIPTOR_REGISTRY } from '../registries/bodyDescriptorRegistry.js';
