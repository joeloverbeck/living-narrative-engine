/**
 * @file Body descriptor utility functions
 * Helper functions for working with body descriptors
 */

import { DESCRIPTOR_METADATA } from '../constants/bodyDescriptorConstants.js';

/**
 * Formats a descriptor value for display
 *
 * @param {string} property - The descriptor property
 * @param {string} value - The descriptor value
 * @returns {string} Formatted display string
 */
export function formatDescriptorForDisplay(property, value) {
  const metadata = DESCRIPTOR_METADATA[property];
  const label = metadata ? metadata.label : property;
  return `${label}: ${value}`;
}

/**
 * Filters out empty or null descriptor values
 *
 * @param {object} bodyDescriptors - The descriptors object
 * @returns {object} Filtered descriptors with only truthy values
 */
export function filterValidDescriptors(bodyDescriptors) {
  if (!bodyDescriptors) return {};

  const filtered = {};
  for (const [key, value] of Object.entries(bodyDescriptors)) {
    if (value && typeof value === 'string' && value.trim()) {
      filtered[key] = value.trim();
    }
  }
  return filtered;
}

/**
 * Merges descriptor objects with override precedence
 *
 * @param {object} baseDescriptors - Base descriptors
 * @param {object} overrideDescriptors - Override descriptors
 * @returns {object} Merged descriptors
 */
export function mergeDescriptors(baseDescriptors, overrideDescriptors) {
  return {
    ...filterValidDescriptors(baseDescriptors),
    ...filterValidDescriptors(overrideDescriptors),
  };
}

/**
 * Gets all descriptor properties that have values
 *
 * @param {object} bodyDescriptors - The descriptors object
 * @returns {string[]} Array of property names with values
 */
export function getActiveDescriptorProperties(bodyDescriptors) {
  const filtered = filterValidDescriptors(bodyDescriptors);
  return Object.keys(filtered);
}

/**
 * Converts descriptors to display format array
 *
 * @param {object} bodyDescriptors - The descriptors object
 * @returns {string[]} Array of formatted display strings
 */
export function descriptorsToDisplayArray(bodyDescriptors) {
  const filtered = filterValidDescriptors(bodyDescriptors);
  return Object.entries(filtered).map(([property, value]) =>
    formatDescriptorForDisplay(property, value)
  );
}
