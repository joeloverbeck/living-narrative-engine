/**
 * @file Defines dataset attribute keys used across DOM UI components.
 */

/**
 * Dataset key storing the numeric ID for save slots.
 * Used by save-related modals.
 *
 * @type {string}
 */
export const DATASET_SLOT_ID = 'slotId';

/**
 * Dataset key storing the unique identifier string for save slots.
 * Used by load-related modals.
 *
 * @type {string}
 */
export const DATASET_SLOT_IDENTIFIER = 'slotIdentifier';

/**
 * Dataset key storing the ID of an LLM option.
 * Used by the LLM selection modal.
 *
 * @type {string}
 */
export const DATASET_LLM_ID = 'llmId';

/**
 * Dataset key storing the index for an action button.
 * Used by the action buttons renderer.
 *
 * @type {string}
 */
export const DATASET_ACTION_INDEX = 'actionIndex';
