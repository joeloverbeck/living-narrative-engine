/**
 * @file Strategy interface for resolving clothing slots to anatomy attachment points
 * @see src/anatomy/integration/strategies/BlueprintSlotStrategy.js
 * @see src/anatomy/integration/strategies/DirectSocketStrategy.js
 */

/**
 * @typedef {object} ResolvedAttachmentPoint
 * @property {string} entityId - The entity ID of the body part
 * @property {string} socketId - The socket ID on that part
 * @property {string} slotPath - The blueprint slot path (e.g., "left_arm.left_hand")
 * @property {string} orientation - The resolved orientation
 */

/**
 * Strategy interface for resolving clothing slots to anatomy attachment points
 *
 * @interface ISlotResolutionStrategy
 */

/**
 * Determines if this strategy can handle the given mapping
 *
 * @function canResolve
 * @param {object} mapping - The clothing slot mapping configuration
 * @returns {boolean} True if this strategy can resolve the mapping
 */

/**
 * Resolves the mapping to actual attachment points
 *
 * @function resolve
 * @param {string} entityId - Entity to resolve attachment points for
 * @param {object} mapping - The clothing slot mapping configuration
 * @returns {Promise<ResolvedAttachmentPoint[]>} Array of resolved attachment points
 */

export default 'ISlotResolutionStrategy';
