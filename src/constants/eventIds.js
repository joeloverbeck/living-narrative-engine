// Existing Event IDs
export {
  SYSTEM_ERROR_OCCURRED_ID,
  SYSTEM_WARNING_OCCURRED_ID,
} from './systemEventIds.js';
export const GAME_SAVED_ID = 'core:game_saved';
export const TURN_STARTED_ID = 'core:turn_started';
export const TURN_ENDED_ID = 'core:turn_ended';
export const PLAYER_TURN_PROMPT_ID = 'core:player_turn_prompt';
export const PLAYER_TURN_SUBMITTED_ID = 'core:player_turn_submitted';
export const DISPLAY_ERROR_ID = 'core:display_error';
export const DISPLAY_WARNING_ID = 'core:display_warning';

// **New, canonical event** fired for both AI and human turns:
export const ACTION_DECIDED_ID = 'core:action_decided';

export const ATTEMPT_ACTION_ID = 'core:attempt_action';
export const ENTITY_SPOKE_ID = 'core:entity_spoke';
export const ENTITY_THOUGHT_ID = 'core:entity_thought';

/**
 * @typedef {object} DisplaySpeechPayload
 * @property {string} entityId The ID of the entity that spoke. Used to fetch the portrait.
 * @property {string} speechContent The text content of what the entity said.
 * @property {boolean} [allowHtml=false] If true, the speechContent will be treated as HTML.
 * @property {string} [thoughts] Internal monologue.
 * @property {string} [notes] Private notes.
 */

/**
 * Fired when an entity's speech should be displayed in the UI.
 *
 * @type {string}
 * @constant
 * @see {DisplaySpeechPayload}
 */
export const DISPLAY_SPEECH_ID = 'core:display_speech';

/**
 * @typedef {object} DisplayThoughtPayload
 * @property {string} entityId The ID of the entity that had thoughts. Used to fetch the portrait.
 * @property {string} thoughts Internal monologue or thoughts.
 * @property {*} [notes] Private notes or annotations (optional).
 */

/**
 * Fired when an entity's thoughts should be displayed in the UI (without speech).
 *
 * @type {string}
 * @constant
 * @see {DisplayThoughtPayload}
 */
export const DISPLAY_THOUGHT_ID = 'core:display_thought';

/**
 * @typedef {object} PortraitClickedPayload
 * @property {string} portraitPath The path to the portrait image that was clicked.
 * @property {string} speakerName The name of the character whose portrait was clicked.
 * @property {HTMLElement} originalElement The portrait element that was clicked.
 */

/**
 * Fired when a portrait image is clicked in the speech bubble.
 * Used to trigger the portrait modal display.
 *
 * @type {string}
 * @constant
 * @see {PortraitClickedPayload}
 */
export const PORTRAIT_CLICKED = 'core:portrait_clicked';

// Generic turn processing events fired for **any** actor type
export const TURN_PROCESSING_STARTED = 'core:turn_processing_started';
export const TURN_PROCESSING_ENDED = 'core:turn_processing_ended';

// New Event IDs for GameEngine to UI communication (GE-REFAC-006)

/**
 * Signals the engine is starting to initialize a world.
 * The UI can use this to display an initial loading message.
 *
 * @event ENGINE_INITIALIZING_UI
 * @type {string}
 * @constant
 * @example
 * // Payload structure:
 * // {
 * //   worldName: string // The name of the world being initialized.
 * // }
 */
export const ENGINE_INITIALIZING_UI = 'core:ui_initializing';

/**
 * Signals the engine has initialized (or loaded) and is ready for user input.
 * The UI can use this to update its state, set the game title, and enable input.
 *
 * @event ENGINE_READY_UI
 * @type {string}
 * @constant
 * @example
 * // Payload structure:
 * // {
 * //   activeWorld: string | null, // The name of the currently active world, or null if none.
 * //   message: string           // A message to display, e.g., to enable input prompt.
 * // }
 */
export const ENGINE_READY_UI = 'core:ui_ready';

/**
 * Signals a potentially blocking engine operation is underway.
 * The UI should indicate this status and typically disable user input.
 *
 * @event ENGINE_OPERATION_IN_PROGRESS_UI
 * @type {string}
 * @constant
 * @example
 * // Payload structure:
 * // {
 * //   titleMessage: string,         // Message to display as a title or primary status.
 * //   inputDisabledMessage: string  // Message to show when disabling input, explaining why.
 * // }
 */
export const ENGINE_OPERATION_IN_PROGRESS_UI = 'core:ui_operation_in_progress';

/**
 * Signals a significant engine operation has failed.
 * The UI should display the error and ensure input remains disabled or is re-disabled.
 *
 * @event ENGINE_OPERATION_FAILED_UI
 * @type {string}
 * @constant
 * @example
 * // Payload structure:
 * // {
 * //   errorMessage: string, // Detailed error message for the user.
 * //   errorTitle: string    // A concise title for the error dialog or message area.
 * // }
 */
export const ENGINE_OPERATION_FAILED_UI = 'core:ui_operation_failed';

/**
 * Signals the engine has been stopped.
 * The UI should update its status accordingly and disable input.
 *
 * @event ENGINE_STOPPED_UI
 * @type {string}
 * @constant
 * @example
 * // Payload structure:
 * // {
 * //   inputDisabledMessage: string // Message to show when disabling input.
 * // }
 */
export const ENGINE_STOPPED_UI = 'core:ui_stopped';

/**
 /**
 * Signals a request from the engine to show the save game interface.
 * The UI manager should handle the presentation of the save game UI.
 *
 * @event REQUEST_SHOW_SAVE_GAME_UI
 * @type {string}
 * @constant
 * @example
 * // Payload structure: {} (empty object)
 * // No specific data is sent with this event; its occurrence is the signal.
 */
export const REQUEST_SHOW_SAVE_GAME_UI = 'core:ui_request_show_save_game';

/**
 * Signals a request from the engine to show the load game interface.
 * The UI manager should handle the presentation of the load game UI.
 *
 * @event REQUEST_SHOW_LOAD_GAME_UI
 * @type {string}
 * @constant
 * @example
 * // Payload structure: {} (empty object)
 * // No specific data is sent with this event; its occurrence is the signal.
 */
export const REQUEST_SHOW_LOAD_GAME_UI = 'core:ui_request_show_load_game';

/**
 * Signals that saving the game is currently not allowed.
 * The UI should inform the user why saving is disabled (e.g., game not initialized, critical state).
 * The specific message can be static or determined by the UI manager based on this event.
 *
 * @event CANNOT_SAVE_GAME_INFO
 * @type {string}
 * @constant
 * @example
 * // Payload structure: {} (empty object)
 * // No specific data is sent with this event; its occurrence is the signal.
 * // The UI manager is expected to provide the appropriate user feedback.
 */
export const CANNOT_SAVE_GAME_INFO = 'core:ui_cannot_save_game_info';

// --- Initialization & Error UI Event IDs ---
export const INITIALIZATION_SERVICE_FAILED_ID =
  'initialization:initialization_service:failed';
export const UI_SHOW_FATAL_ERROR_ID = 'ui:show_fatal_error';

// --- EntityManager Event IDs (Ticket 8) ---
/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * @typedef {object} EntityCreatedPayload
 * @property {Entity} entity - The full entity instance that was created.
 * @property {boolean} wasReconstructed - True if the entity was reconstructed from save data.
 * @property {string} instanceId - Unique ID for the created entity instance.
 * @property {string} definitionId - Definition ID the entity was created from.
 */

/**
 * Fired when a new entity instance is successfully created or reconstructed.
 *
 * @type {string}
 */
export const ENTITY_CREATED_ID = 'core:entity_created';

/**
 * @typedef {object} EntityRemovedPayload
 * @property {string} instanceId - The unique instance ID of the entity being removed.
 */

/**
 * Fired just before an entity instance is removed from the EntityManager.
 *
 * @type {string}
 */
export const ENTITY_REMOVED_ID = 'core:entity_removed';

/**
 * @typedef {object} ComponentAddedPayload
 * @property {Entity} entity - The entity instance that received the component.
 * @property {string} componentTypeId - The ID of the component that was added/updated.
 * @property {object | null} componentData - The validated data of the added/updated component.
 * @property {object | null | undefined} oldComponentData - The data of the component before this change. `undefined` if component was not present before, `null` if it was explicitly null.
 */

/**
 * Fired when a component is successfully added to or updated on an entity instance.
 *
 * @type {string}
 */
export const COMPONENT_ADDED_ID = 'core:component_added';

/**
 * @typedef {object} ComponentsBatchAddedUpdate
 * @property {string} instanceId - Entity instance ID
 * @property {string} componentTypeId - Component type ID
 * @property {object} componentData - Validated component data
 * @property {object | null | undefined} oldComponentData - Previous component data
 * @property {boolean} isNewComponent - Whether this is a new component addition
 */

/**
 * @typedef {object} ComponentsBatchAddedPayload
 * @property {Array<ComponentsBatchAddedUpdate>} updates - Array of component updates
 * @property {number} updateCount - Number of updates in this batch
 */

/**
 * Fired when multiple components are added/updated in a batch operation.
 *
 * @type {string}
 */
export const COMPONENTS_BATCH_ADDED_ID = 'core:components_batch_added';

/**
 * @typedef {object} ComponentRemovedPayload
 * @property {Entity} entity - The entity instance from which the component was removed.
 * @property {string} componentTypeId - The ID of the component that was removed.
 * @property {object | null | undefined} oldComponentData - The data of the component before it was removed.
 */

/**
 * Fired when a component override is successfully removed from an entity instance.
 *
 * @type {string}
 */
export const COMPONENT_REMOVED_ID = 'core:component_removed';

// --- WorldInitializer Event IDs ---

/**
 * @typedef {object} WorldInitEntityInstantiatedPayload
 * @property {string} entityId - The ID of the entity that was instantiated.
 * @property {string} instanceId - The instance ID used for instantiation.
 * @property {string} definitionId - The definition ID used for instantiation.
 * @property {string} worldName - The name of the world where the entity was instantiated.
 * @property {string} reason - The reason for instantiation (e.g., "Initial World Load").
 */

/**
 * Fired when an entity is successfully instantiated during world initialization.
 *
 * @type {string}
 */
export const WORLDINIT_ENTITY_INSTANTIATED_ID = 'core:entity_instantiated';

/**
 * @typedef {object} WorldInitEntityInstantiationFailedPayload
 * @property {string} instanceId - The instance ID that failed to instantiate.
 * @property {string} definitionId - The definition ID that failed to instantiate.
 * @property {string} worldName - The name of the world where instantiation failed.
 * @property {string} error - The error message describing why instantiation failed.
 * @property {string} reason - The reason for the instantiation attempt (e.g., "Initial World Load").
 */

/**
 * Fired when an entity instantiation fails during world initialization.
 *
 * @type {string}
 */
export const WORLDINIT_ENTITY_INSTANTIATION_FAILED_ID =
  'worldinit:entity_instantiation_failed';

// --- AI Decision & Action Execution Event IDs ---

/**
 * Fired when an AI decision process is requested.
 *
 * @type {string}
 */
export const AI_DECISION_REQUESTED = 'core:ai_decision_requested';

/**
 * Fired when an AI decision is successfully received.
 *
 * @type {string}
 */
export const AI_DECISION_RECEIVED = 'core:ai_decision_received';

/**
 * Fired when an AI decision process fails.
 *
 * @type {string}
 */
export const AI_DECISION_FAILED = 'core:ai_decision_failed';

/**
 * Fired when action execution starts.
 *
 * @type {string}
 */
export const ACTION_EXECUTION_STARTED = 'core:action_execution_started';

/**
 * Fired when action execution completes successfully.
 *
 * @type {string}
 */
export const ACTION_EXECUTION_COMPLETED = 'core:action_execution_completed';

/**
 * Fired when action execution fails.
 *
 * @type {string}
 */
export const ACTION_EXECUTION_FAILED = 'core:action_execution_failed';

/**
 * Fired when action validation fails.
 *
 * @type {string}
 */
export const ACTION_VALIDATION_FAILED = 'core:action_validation_failed';
