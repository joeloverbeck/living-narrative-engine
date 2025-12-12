/**
 * @file Central source of truth for perception type metadata
 * @description Provides type definitions, category information, and validation utilities
 *              for the perceptible event system.
 * @see specs/perceptionType-consolidation.md
 */

// ============================================================================
// TYPE REGISTRY - All valid perception types with metadata
// ============================================================================

/**
 * @typedef {Object} PerceptionTypeMetadata
 * @property {string} type - The canonical type identifier (e.g., 'communication.speech')
 * @property {string} category - The category this type belongs to
 * @property {string} displayLabel - Human-readable label
 * @property {string} cssClass - CSS class for styling (e.g., 'log-type-speech')
 * @property {string[]} legacyTypes - Legacy type names that map to this type
 * @property {boolean} isFailure - Whether this type represents a failure/error
 */

/**
 * Registry of all valid perception types with their metadata.
 * New types use dotted notation: category.type
 * @type {Object<string, PerceptionTypeMetadata>}
 */
export const PERCEPTION_TYPE_REGISTRY = {
  // Communication category
  'communication.speech': {
    type: 'communication.speech',
    category: 'communication',
    displayLabel: 'Speech',
    cssClass: 'log-type-speech',
    legacyTypes: ['speech_local'],
    isFailure: false,
  },
  'communication.thought': {
    type: 'communication.thought',
    category: 'communication',
    displayLabel: 'Thought',
    cssClass: 'log-type-thought',
    legacyTypes: ['thought_internal'],
    isFailure: false,
  },
  'communication.notes': {
    type: 'communication.notes',
    category: 'communication',
    displayLabel: 'Notes',
    cssClass: 'log-type-notes',
    legacyTypes: ['notes_jotted'],
    isFailure: false,
  },

  // Movement category
  'movement.arrival': {
    type: 'movement.arrival',
    category: 'movement',
    displayLabel: 'Arrival',
    cssClass: 'log-type-arrival',
    legacyTypes: ['character_enter', 'dimensional_arrival'],
    isFailure: false,
  },
  'movement.departure': {
    type: 'movement.departure',
    category: 'movement',
    displayLabel: 'Departure',
    cssClass: 'log-type-departure',
    legacyTypes: ['character_exit', 'dimensional_departure'],
    isFailure: false,
  },

  // Combat category
  'combat.attack': {
    type: 'combat.attack',
    category: 'combat',
    displayLabel: 'Attack',
    cssClass: 'log-type-attack',
    legacyTypes: ['combat_attack'],
    isFailure: false,
  },
  'combat.damage': {
    type: 'combat.damage',
    category: 'combat',
    displayLabel: 'Damage',
    cssClass: 'log-type-damage',
    legacyTypes: ['damage_received', 'combat_effect'],
    isFailure: false,
  },
  'combat.death': {
    type: 'combat.death',
    category: 'combat',
    displayLabel: 'Death',
    cssClass: 'log-type-death',
    legacyTypes: ['entity_died'],
    isFailure: false,
  },
  'combat.violence': {
    type: 'combat.violence',
    category: 'combat',
    displayLabel: 'Violence',
    cssClass: 'log-type-violence',
    legacyTypes: [],
    isFailure: false,
  },

  // Item category
  'item.pickup': {
    type: 'item.pickup',
    category: 'item',
    displayLabel: 'Item Pickup',
    cssClass: 'log-type-pickup',
    legacyTypes: ['item_pickup', 'item_picked_up'],
    isFailure: false,
  },
  'item.drop': {
    type: 'item.drop',
    category: 'item',
    displayLabel: 'Item Drop',
    cssClass: 'log-type-drop',
    legacyTypes: ['item_drop', 'item_dropped'],
    isFailure: false,
  },
  'item.transfer': {
    type: 'item.transfer',
    category: 'item',
    displayLabel: 'Item Transfer',
    cssClass: 'log-type-transfer',
    legacyTypes: ['item_transfer'],
    isFailure: false,
  },
  'item.use': {
    type: 'item.use',
    category: 'item',
    displayLabel: 'Item Use',
    cssClass: 'log-type-use',
    legacyTypes: ['item_use'],
    isFailure: false,
  },
  'item.examine': {
    type: 'item.examine',
    category: 'item',
    displayLabel: 'Item Examine',
    cssClass: 'log-type-examine',
    legacyTypes: ['item_examined', 'item_read'],
    isFailure: false,
  },

  // Container category
  'container.open': {
    type: 'container.open',
    category: 'container',
    displayLabel: 'Container Open',
    cssClass: 'log-type-container-open',
    legacyTypes: ['container_opened'],
    isFailure: false,
  },
  'container.take': {
    type: 'container.take',
    category: 'container',
    displayLabel: 'Take from Container',
    cssClass: 'log-type-container-take',
    legacyTypes: ['item_taken_from_container', 'item_taken_from_nearby_surface'],
    isFailure: false,
  },
  'container.put': {
    type: 'container.put',
    category: 'container',
    displayLabel: 'Put in Container',
    cssClass: 'log-type-container-put',
    legacyTypes: ['item_put_in_container', 'item_put_on_nearby_surface'],
    isFailure: false,
  },

  // Connection category
  'connection.lock': {
    type: 'connection.lock',
    category: 'connection',
    displayLabel: 'Lock',
    cssClass: 'log-type-lock',
    legacyTypes: ['connection_locked'],
    isFailure: false,
  },
  'connection.unlock': {
    type: 'connection.unlock',
    category: 'connection',
    displayLabel: 'Unlock',
    cssClass: 'log-type-unlock',
    legacyTypes: ['connection_unlocked'],
    isFailure: false,
  },

  // Consumption category
  'consumption.consume': {
    type: 'consumption.consume',
    category: 'consumption',
    displayLabel: 'Consume',
    cssClass: 'log-type-consume',
    legacyTypes: [
      'drink_consumed',
      'food_consumed',
      'liquid_consumed',
      'liquid_consumed_entirely',
    ],
    isFailure: false,
  },

  // State category
  'state.observable_change': {
    type: 'state.observable_change',
    category: 'state',
    displayLabel: 'State Change',
    cssClass: 'log-type-state-change',
    legacyTypes: ['state_change_observable'],
    isFailure: false,
  },

  // Social category
  'social.gesture': {
    type: 'social.gesture',
    category: 'social',
    displayLabel: 'Gesture',
    cssClass: 'log-type-gesture',
    legacyTypes: [],
    isFailure: false,
  },
  'social.affection': {
    type: 'social.affection',
    category: 'social',
    displayLabel: 'Affection',
    cssClass: 'log-type-affection',
    legacyTypes: [],
    isFailure: false,
  },
  'social.interaction': {
    type: 'social.interaction',
    category: 'social',
    displayLabel: 'Interaction',
    cssClass: 'log-type-interaction',
    legacyTypes: [],
    isFailure: false,
  },

  // Physical category
  'physical.self_action': {
    type: 'physical.self_action',
    category: 'physical',
    displayLabel: 'Self Action',
    cssClass: 'log-type-self-action',
    legacyTypes: ['rest_action'],
    isFailure: false,
  },
  'physical.target_action': {
    type: 'physical.target_action',
    category: 'physical',
    displayLabel: 'Target Action',
    cssClass: 'log-type-target-action',
    legacyTypes: [],
    isFailure: false,
  },

  // Intimacy category
  'intimacy.sexual': {
    type: 'intimacy.sexual',
    category: 'intimacy',
    displayLabel: 'Sexual',
    cssClass: 'log-type-sexual',
    legacyTypes: [],
    isFailure: false,
  },
  'intimacy.sensual': {
    type: 'intimacy.sensual',
    category: 'intimacy',
    displayLabel: 'Sensual',
    cssClass: 'log-type-sensual',
    legacyTypes: [],
    isFailure: false,
  },

  // Performance category
  'performance.music': {
    type: 'performance.music',
    category: 'performance',
    displayLabel: 'Music',
    cssClass: 'log-type-music',
    legacyTypes: [],
    isFailure: false,
  },
  'performance.dance': {
    type: 'performance.dance',
    category: 'performance',
    displayLabel: 'Dance',
    cssClass: 'log-type-dance',
    legacyTypes: [],
    isFailure: false,
  },

  // Magic category
  'magic.spell': {
    type: 'magic.spell',
    category: 'magic',
    displayLabel: 'Spell',
    cssClass: 'log-type-spell',
    legacyTypes: [],
    isFailure: false,
  },
  'magic.ritual': {
    type: 'magic.ritual',
    category: 'magic',
    displayLabel: 'Ritual',
    cssClass: 'log-type-ritual',
    legacyTypes: [],
    isFailure: false,
  },

  // Error category
  'error.system_error': {
    type: 'error.system_error',
    category: 'error',
    displayLabel: 'System Error',
    cssClass: 'log-type-system-error',
    legacyTypes: ['error'],
    isFailure: true,
  },
  'error.action_failed': {
    type: 'error.action_failed',
    category: 'error',
    displayLabel: 'Action Failed',
    cssClass: 'log-type-action-failed',
    legacyTypes: [
      'connection_lock_failed',
      'connection_unlock_failed',
      'container_open_failed',
      'item_pickup_failed',
      'item_transfer_failed',
      'put_in_container_failed',
      'put_on_nearby_surface_failed',
      'take_from_container_failed',
      'take_from_nearby_surface_failed',
    ],
    isFailure: true,
  },
};

// ============================================================================
// CATEGORY REGISTRY - Category metadata for theming
// ============================================================================

/**
 * @typedef {Object} PerceptionCategoryMetadata
 * @property {string} displayLabel - Human-readable category name
 * @property {string} cssClassPrefix - CSS class prefix for category styling
 * @property {string} themeColor - Hex color for theming (WCAG AA compliant)
 */

/**
 * Registry of perception categories with theming metadata.
 * Colors are WCAG AA compliant on parchment background (#fff8e6).
 * @type {Object<string, PerceptionCategoryMetadata>}
 */
export const PERCEPTION_CATEGORIES = {
  communication: {
    displayLabel: 'Communication',
    cssClassPrefix: 'log-cat-communication',
    themeColor: '#6a1b9a',
  },
  movement: {
    displayLabel: 'Movement',
    cssClassPrefix: 'log-cat-movement',
    themeColor: '#1565c0',
  },
  combat: {
    displayLabel: 'Combat',
    cssClassPrefix: 'log-cat-combat',
    themeColor: '#c62828',
  },
  item: {
    displayLabel: 'Item',
    cssClassPrefix: 'log-cat-item',
    themeColor: '#e65100',
  },
  container: {
    displayLabel: 'Container',
    cssClassPrefix: 'log-cat-container',
    themeColor: '#795548',
  },
  connection: {
    displayLabel: 'Connection',
    cssClassPrefix: 'log-cat-connection',
    themeColor: '#546e7a',
  },
  consumption: {
    displayLabel: 'Consumption',
    cssClassPrefix: 'log-cat-consumption',
    themeColor: '#2e7d32',
  },
  state: {
    displayLabel: 'State',
    cssClassPrefix: 'log-cat-state',
    themeColor: '#00838f',
  },
  social: {
    displayLabel: 'Social',
    cssClassPrefix: 'log-cat-social',
    themeColor: '#ad1457',
  },
  physical: {
    displayLabel: 'Physical',
    cssClassPrefix: 'log-cat-physical',
    themeColor: '#8d6e63',
  },
  intimacy: {
    displayLabel: 'Intimacy',
    cssClassPrefix: 'log-cat-intimacy',
    themeColor: '#c2185b',
  },
  performance: {
    displayLabel: 'Performance',
    cssClassPrefix: 'log-cat-performance',
    themeColor: '#f9a825',
  },
  magic: {
    displayLabel: 'Magic',
    cssClassPrefix: 'log-cat-magic',
    themeColor: '#5c6bc0',
  },
  error: {
    displayLabel: 'Error',
    cssClassPrefix: 'log-cat-error',
    themeColor: '#b71c1c',
  },
};

// ============================================================================
// LEGACY TYPE MAPPINGS - For backward compatibility
// ============================================================================

/**
 * Build legacy type lookup from registry.
 * Maps legacy snake_case types to new dotted types.
 * @type {Map<string, string>}
 */
const LEGACY_TYPE_MAP = new Map();

// Populate from registry
for (const [newType, metadata] of Object.entries(PERCEPTION_TYPE_REGISTRY)) {
  for (const legacyType of metadata.legacyTypes) {
    LEGACY_TYPE_MAP.set(legacyType, newType);
  }
}

// Add special mappings for generic types (not in registry legacyTypes)
// These require context-aware migration but we provide default fallbacks
LEGACY_TYPE_MAP.set('action_self_general', 'physical.self_action');
LEGACY_TYPE_MAP.set('action_target_general', 'physical.target_action');

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a perception type is valid (either new or legacy).
 * @param {string} type - The perception type to validate
 * @returns {boolean} True if the type is valid
 */
export function isValidPerceptionType(type) {
  if (!type || typeof type !== 'string') {
    return false;
  }
  return PERCEPTION_TYPE_REGISTRY.hasOwnProperty(type) || LEGACY_TYPE_MAP.has(type);
}

/**
 * Check if a perception type is a new-format type (dotted notation).
 * @param {string} type - The perception type to check
 * @returns {boolean} True if the type uses new dotted notation
 */
export function isNewFormatType(type) {
  return PERCEPTION_TYPE_REGISTRY.hasOwnProperty(type);
}

/**
 * Check if a perception type is a legacy type.
 * @param {string} type - The perception type to check
 * @returns {boolean} True if the type is a legacy format
 */
export function isLegacyType(type) {
  return LEGACY_TYPE_MAP.has(type) && !PERCEPTION_TYPE_REGISTRY.hasOwnProperty(type);
}

/**
 * Get metadata for a perception type.
 * Automatically resolves legacy types to their new equivalents.
 * @param {string} type - The perception type
 * @returns {PerceptionTypeMetadata|null} The metadata or null if not found
 */
export function getPerceptionTypeMetadata(type) {
  if (!type) return null;

  // Try direct lookup
  if (PERCEPTION_TYPE_REGISTRY[type]) {
    return PERCEPTION_TYPE_REGISTRY[type];
  }

  // Try legacy mapping
  const newType = LEGACY_TYPE_MAP.get(type);
  if (newType && PERCEPTION_TYPE_REGISTRY[newType]) {
    return PERCEPTION_TYPE_REGISTRY[newType];
  }

  return null;
}

/**
 * Get metadata for a perception category.
 * @param {string} category - The category name
 * @returns {PerceptionCategoryMetadata|null} The metadata or null if not found
 */
export function getCategoryMetadata(category) {
  return PERCEPTION_CATEGORIES[category] || null;
}

/**
 * Get the new type mapping for a legacy type.
 * @param {string} legacyType - The legacy type name
 * @returns {string|null} The new type name or null if not a legacy type
 */
export function getLegacyTypeMapping(legacyType) {
  if (!legacyType) return null;

  // Return null if it's already a new type
  if (PERCEPTION_TYPE_REGISTRY.hasOwnProperty(legacyType)) {
    return null;
  }

  return LEGACY_TYPE_MAP.get(legacyType) || null;
}

/**
 * Get all valid new-format perception types.
 * @returns {string[]} Array of all valid type identifiers
 */
export function getAllValidTypes() {
  return Object.keys(PERCEPTION_TYPE_REGISTRY);
}

/**
 * Get all types in a specific category.
 * @param {string} category - The category name
 * @returns {string[]} Array of type identifiers in the category
 */
export function getTypesByCategory(category) {
  return Object.entries(PERCEPTION_TYPE_REGISTRY)
    .filter(([, metadata]) => metadata.category === category)
    .map(([type]) => type);
}

/**
 * Get all category names.
 * @returns {string[]} Array of category names
 */
export function getAllCategories() {
  return Object.keys(PERCEPTION_CATEGORIES);
}

/**
 * Suggest the nearest valid type for an invalid type.
 * Uses simple string matching heuristics.
 * @param {string} invalidType - The invalid type to find suggestions for
 * @returns {string|null} The suggested type or null if no good match
 */
export function suggestNearestType(invalidType) {
  if (!invalidType || typeof invalidType !== 'string') {
    return null;
  }

  const normalizedInput = invalidType.toLowerCase().replace(/[_.-]/g, '');
  let bestMatch = null;
  let bestScore = 0;

  // Check all valid types
  for (const type of getAllValidTypes()) {
    const normalizedType = type.toLowerCase().replace(/[_.-]/g, '');

    // Exact substring match
    if (normalizedType.includes(normalizedInput) || normalizedInput.includes(normalizedType)) {
      const score = Math.min(normalizedInput.length, normalizedType.length) /
        Math.max(normalizedInput.length, normalizedType.length);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = type;
      }
    }

    // Check category match
    const [category] = type.split('.');
    if (normalizedInput.includes(category)) {
      const score = 0.5;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = type;
      }
    }
  }

  // Also check legacy types
  for (const [legacyType, newType] of LEGACY_TYPE_MAP.entries()) {
    const normalizedLegacy = legacyType.toLowerCase().replace(/[_.-]/g, '');
    if (
      normalizedLegacy.includes(normalizedInput) ||
      normalizedInput.includes(normalizedLegacy)
    ) {
      const score = Math.min(normalizedInput.length, normalizedLegacy.length) /
        Math.max(normalizedInput.length, normalizedLegacy.length);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = newType;
      }
    }
  }

  // Only return if we have a reasonable match
  return bestScore >= 0.3 ? bestMatch : null;
}

/**
 * Normalize a perception type to its canonical new-format form.
 * Converts legacy types to new format; returns new types unchanged.
 * @param {string} type - The perception type
 * @returns {string|null} The normalized type or null if invalid
 */
export function normalizePerceptionType(type) {
  if (!type) return null;

  // Already new format
  if (PERCEPTION_TYPE_REGISTRY.hasOwnProperty(type)) {
    return type;
  }

  // Legacy type
  const mapped = LEGACY_TYPE_MAP.get(type);
  return mapped || null;
}

/**
 * Get CSS classes for a perception type (both type and category classes).
 * @param {string} type - The perception type
 * @returns {{typeClass: string|null, categoryClass: string|null}} CSS class names
 */
export function getCssClasses(type) {
  const metadata = getPerceptionTypeMetadata(type);
  if (!metadata) {
    return { typeClass: null, categoryClass: null };
  }

  const categoryMetadata = getCategoryMetadata(metadata.category);
  return {
    typeClass: metadata.cssClass,
    categoryClass: categoryMetadata?.cssClassPrefix || null,
  };
}

export default {
  PERCEPTION_TYPE_REGISTRY,
  PERCEPTION_CATEGORIES,
  isValidPerceptionType,
  isNewFormatType,
  isLegacyType,
  getPerceptionTypeMetadata,
  getCategoryMetadata,
  getLegacyTypeMapping,
  getAllValidTypes,
  getTypesByCategory,
  getAllCategories,
  suggestNearestType,
  normalizePerceptionType,
  getCssClasses,
};
