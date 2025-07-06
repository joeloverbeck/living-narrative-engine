/**
 * @file Constants for anatomy-related functionality
 */

/**
 * Event dispatched when a body part is detached
 */
export const LIMB_DETACHED_EVENT_ID = 'anatomy:limb_detached';

/**
 * Maximum depth for recursive operations to prevent stack overflow
 */
export const MAX_RECURSION_DEPTH = 100;

/**
 * Default maximum length for path finding operations
 */
export const DEFAULT_MAX_PATH_LENGTH = 50;

/**
 * Export all constants as a single object for convenient access
 */
export const ANATOMY_CONSTANTS = {
  LIMB_DETACHED_EVENT_ID,
  MAX_RECURSION_DEPTH,
  DEFAULT_MAX_PATH_LENGTH,
};
