/**
 * @file Type definitions for multi-target action system
 */

/**
 * @typedef {string} EntityId
 * Entity identifier, usually in format "entityType_id" or "namespace:entityType_id"
 */

/**
 * @typedef {string} TargetName
 * Target name identifier, used as key in targets object
 */

/**
 * @typedef {string} NamespacedId
 * Namespaced identifier in format "namespace:identifier"
 */

/**
 * @typedef {Object.<TargetName, EntityId>} TargetsObject
 * Object mapping target names to entity IDs
 */

/**
 * @typedef {object} AttemptActionPayload
 * @property {string} eventName - Event identifier
 * @property {EntityId} actorId - Actor performing the action
 * @property {NamespacedId} actionId - Action definition identifier
 * @property {string} originalInput - Original user input command
 * @property {EntityId} [targetId] - Primary target for backward compatibility
 * @property {TargetsObject} [targets] - Multi-target object (when multiple targets)
 * @property {number} timestamp - Event timestamp
 */

/**
 * @typedef {object} TargetExtractionResult
 * @property {TargetsObject} targets - Extracted targets
 * @property {EntityId|null} primaryTarget - Primary target entity ID
 * @property {boolean} hasMultipleTargets - Whether multiple targets exist
 * @property {number} targetCount - Number of targets
 * @property {object} extractionMetadata - Metadata about extraction process
 * @property {object} validationResult - Validation result
 */

/**
 * @typedef {object} ValidationResult
 * @property {boolean} isValid - Whether validation passed
 * @property {string[]} errors - Validation error messages
 * @property {string[]} warnings - Validation warning messages
 * @property {object} [details] - Additional validation details
 */

export {};
