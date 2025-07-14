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
 * Cache configuration for anatomy-clothing integration
 */
export const ANATOMY_CLOTHING_CACHE_CONFIG = {
  // Maximum items per cache type
  MAX_SIZE: 500,
  // Time to live in milliseconds (5 minutes)
  TTL: 300000,
  // Reset TTL on access
  UPDATE_AGE_ON_GET: true,
  // Maximum memory usage in bytes (100MB)
  MAX_MEMORY_USAGE: 104857600,
  // Cache type specific overrides
  TYPE_CONFIGS: {
    // Blueprints are accessed frequently and change rarely
    BLUEPRINT: {
      MAX_SIZE_MULTIPLIER: 2,
      TTL_MULTIPLIER: 2,
    },
    // Available slots change when equipment changes
    AVAILABLE_SLOTS: {
      MAX_SIZE_MULTIPLIER: 1,
      TTL_MULTIPLIER: 0.5,
    },
  },
};

/**
 * Export all constants as a single object for convenient access
 */
export const ANATOMY_CONSTANTS = {
  LIMB_DETACHED_EVENT_ID,
  MAX_RECURSION_DEPTH,
  DEFAULT_MAX_PATH_LENGTH,
  ANATOMY_CLOTHING_CACHE_CONFIG,
};
