/**
 * @file Priority constants for clothing coverage resolution system
 * @description Centralized constants for priority calculations in clothing resolution
 */

/**
 * Coverage priority constants - lower values indicate higher priority
 * Used to determine which coverage type takes precedence
 */
export const COVERAGE_PRIORITY = Object.freeze({
  outer: 100,
  armor: 150,
  base: 200,
  underwear: 300,
  direct: 400,
});

/**
 * Layer priority within coverage types - lower values indicate higher priority
 * Applied within each coverage category for fine-grained ordering
 */
export const LAYER_PRIORITY_WITHIN_COVERAGE = Object.freeze({
  outer: 10,
  armor: 15,
  base: 20,
  underwear: 30,
  accessories: 40,
});

/**
 * Valid coverage priority values for validation
 */
export const VALID_COVERAGE_PRIORITIES = Object.freeze([
  'outer',
  'armor',
  'base',
  'underwear',
  'direct',
]);

/**
 * Valid layer values for validation
 */
export const VALID_LAYERS = Object.freeze([
  'outer',
  'armor',
  'base',
  'underwear',
  'accessories',
]);

/**
 * Priority system configuration constants
 */
export const PRIORITY_CONFIG = Object.freeze({
  enableCaching: true,
  enableTieBreaking: true,
  enableContextualModifiers: false, // Future feature flag
  enableValidation: true,
  maxCacheSize: 1000,
  logInvalidPriorities: true,
  defaultCoveragePriority: 'direct',
  defaultLayer: 'base',
});
