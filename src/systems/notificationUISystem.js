// src/systems/notificationUISystem.js

/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../core/dataManager.js').default} DataManager */
// Optional: Import Localization Service if you have one
// /** @typedef {import('../../services/localizationService.js').default} LocalizationService */
/** @typedef {import('../types/questTypes.js').RewardSummary} RewardSummary */

// --- Event Payload Type Imports (Expected based on eventTypes.js and OPEN-4/OPEN-7) ---
/** @typedef {import('../types/eventTypes.js').EntityOpenedEventPayload} EntityOpenedEventPayload */
/** @typedef {import('../types/eventTypes.js').OpenFailedEventPayload} OpenFailedEventPayload */
// Import specific payload types used by existing handlers if needed
/** @typedef {import('../types/eventTypes.js').ActionMoveFailedPayload} ActionMoveFailedPayload */


// Ensure TARGET_MESSAGES is imported (already present in provided code)
// Assumes OPEN-8 will add the required 'OPEN_*' templates to this utility.
import {TARGET_MESSAGES} from '../utils/messages.js';

/**
 * Listens for semantic game events (quests, actions, etc.)
 * and dispatches formatted UI messages to the player.
 */
class NotificationUISystem {
    /** @type {EventBus} */
    eventBus;
    /** @type {DataManager} */
    dataManager;
    // /** @type {LocalizationService} */ // Optional
    // localizationService;             // Optional

    /**
     * @param {object} dependencies
     * @param {EventBus} dependencies.eventBus
     * @param {DataManager} dependencies.dataManager
     * // @param {LocalizationService} [dependencies.localizationService] // Optional
     */
    constructor({eventBus, dataManager /*, localizationService */}) {
        if (!eventBus) throw new Error("NotificationUISystem requires EventBus.");
        if (!dataManager) throw new Error("NotificationUISystem requires DataManager.");
        // if (localizationService) this.localizationService = localizationService; // Optional

        this.eventBus = eventBus;
        this.dataManager = dataManager;

        console.log("NotificationUISystem: Instantiated.");
    }

    /**
     * Subscribes to semantic game events.
     */
    initialize() {
        console.log("NotificationUISystem: Initializing and subscribing to events...");
        // Quest Events
        this.eventBus.subscribe('quest:started', this._handleQuestStarted.bind(this));
        this.eventBus.subscribe('quest:completed', this._handleQuestCompleted.bind(this));
        this.eventBus.subscribe('quest:failed', this._handleQuestFailed.bind(this));
        this.eventBus.subscribe('quest:prerequisites_not_met', this._handlePrerequisitesNotMet.bind(this));

        // Action Validation/Failure Events
        this.eventBus.subscribe('action:validation_failed', this._handleValidationFailed.bind(this));
        this.eventBus.subscribe('action:take_failed', this._handleTakeFailed.bind(this));
        this.eventBus.subscribe('action:move_failed', this._handleMoveFailed.bind(this));
        this.eventBus.subscribe('item:use_condition_failed', this._handleItemUseConditionFailed.bind(this));
        // Add subscriptions for other action failures (drop, use, attack, etc.) here...

        // AC 2: Subscribe to open action events
        this.eventBus.subscribe('event:entity_opened', this._handleEntityOpened.bind(this));
        this.eventBus.subscribe('event:open_failed', this._handleOpenFailed.bind(this));

        // Action Success/Attempt Events (that generate immediate feedback)
        this.eventBus.subscribe('action:take_succeeded', this._handleTakeSucceeded.bind(this));
        this.eventBus.subscribe('event:move_attempted', this._handleMoveAttempted.bind(this)); // Listens to attempt, might display "You move..."
        // Add subscriptions for other action successes here...

        console.log("NotificationUISystem: Initialization complete.");
    }

    /**
     * Gets a displayable name, preferring a looked-up title from DataManager/Localization,
     * falling back to the provided ID.
     * @param {string} id - The localization key or fallback ID (e.g., titleId, itemId).
     * @param {'quest'|'item'|'currency'|'default'} type - The type of ID for context.
     * @returns {string} The displayable name.
     * @private
     */
    _getDisplayName(id, type = 'default') {
        // Basic fallback implementation. Replace with actual localization lookup if available.
        // Example: if (this.localizationService) return this.localizationService.get(id);
        // Example: if (type === 'item' && this.dataManager) return this.dataManager.getItemDefinition(id)?.name || id;
        // Example: if (type === 'quest' && this.dataManager) return this.dataManager.getQuestDefinition(id)?.title || id; // Requires quest def has title prop

        // Simple fallback: capitalize and replace underscores
        if (!id) return 'something'; // Fallback for undefined/null id
        return id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    /**
     * Handles the 'quest:started' event and dispatches a UI message.
     * @param {object} payload
     * @param {string} payload.questId
     * @param {string} payload.titleId
     * @private
     */
    _handleQuestStarted({questId, titleId}) {
        // TODO: Filter messages based on player context if needed
        const questTitle = this._getDisplayName(titleId, 'quest');
        this.eventBus.dispatch('ui:message_display', {
            text: `Quest Started: ${questTitle}`,
            type: 'quest' // Use a specific type for quest messages
        });
    }

    /**
     * Handles the 'quest:completed' event and dispatches UI messages for completion and rewards.
     * @param {object} payload
     * @param {string} payload.questId
     * @param {string} payload.titleId
     * @param {RewardSummary | null} payload.rewardSummary
     * @private
     */
    _handleQuestCompleted({questId, titleId, rewardSummary}) {
        // TODO: Filter messages based on player context if needed
        const questTitle = this._getDisplayName(titleId, 'quest');

        // 1. Quest Completion Message
        this.eventBus.dispatch('ui:message_display', {
            text: `Quest Completed: ${questTitle}`,
            type: 'quest_complete' // Specific type for completion
        });

        // 2. Reward Summary Messages (if any)
        if (rewardSummary) {
            // Experience
            if (rewardSummary.experience) {
                this.eventBus.dispatch('ui:message_display', {
                    text: `Gained ${rewardSummary.experience} XP.`,
                    type: 'reward' // General type for rewards
                });
            }
            // Items
            if (rewardSummary.items?.length > 0) {
                rewardSummary.items.forEach(item => {
                    const itemName = this._getDisplayName(item.itemId, 'item');
                    this.eventBus.dispatch('ui:message_display', {
                        text: `Received: ${itemName} x ${item.quantity}`,
                        type: 'reward'
                    });
                });
            }
            // Currency
            if (rewardSummary.currency) {
                for (const type in rewardSummary.currency) {
                    const currencyName = this._getDisplayName(type, 'currency');
                    this.eventBus.dispatch('ui:message_display', {
                        text: `Received: ${rewardSummary.currency[type]} ${currencyName}`,
                        type: 'reward'
                    });
                }
            }
            // Optional: Notify about flags set? Probably not needed for UI.
            // if (rewardSummary.gameStateFlagsSet?.length > 0) { ... }
        }
    }

    /**
     * Handles the 'quest:failed' event and dispatches a UI message.
     * @param {object} payload
     * @param {string} payload.questId
     * @param {string} payload.titleId
     * @param {string | null} payload.reason
     * @private
     */
    _handleQuestFailed({questId, titleId, reason}) {
        // TODO: Filter messages based on player context if needed
        const questTitle = this._getDisplayName(titleId, 'quest');
        const reasonText = reason ? `: ${reason}` : ''; // Add reason if provided
        this.eventBus.dispatch('ui:message_display', {
            text: `Quest Failed${reasonText}: ${questTitle}`,
            type: 'quest_fail' // Specific type for failure
        });
    }

    /**
     * Handles the 'quest:prerequisites_not_met' event and dispatches a UI message.
     * @param {object} payload
     * @param {string} payload.questId
     * @param {string} payload.titleId
     * @private
     */
    _handlePrerequisitesNotMet({questId, titleId}) {
        // TODO: Filter messages based on player context if needed
        const questTitle = this._getDisplayName(titleId, 'quest');
        this.eventBus.dispatch('ui:message_display', {
            text: `Cannot start quest "${questTitle}" yet. (Prerequisites not met)`,
            type: 'info' // Use a general info type
        });
    }

    // --- Action Handlers ---

    /**
     * Handles 'action:validation_failed' event.
     * @param {object} payload
     * @param {string} payload.actorId - ID of the entity performing the action
     * @param {string} payload.actionVerb - The verb of the action (e.g., 'move', 'take')
     * @param {string} payload.reasonCode - Why validation failed
     * @private
     */
    _handleValidationFailed({actorId, actionVerb, reasonCode}) {
        // TODO: Check if the actor is the player before displaying
        // Example: if (actorId !== this.dataManager.getPlayerId()) return;
        let messageText = `Validation failed for action: ${actionVerb}`; // Generic fallback
        let messageType = 'error'; // Usually an error or notice

        if (reasonCode === 'MISSING_TARGET') {
            // Use the standard prompt message
            messageText = TARGET_MESSAGES.PROMPT_WHAT(actionVerb);
            messageType = 'notice'; // A prompt isn't strictly an error
        }
        // Add more reason codes as needed

        this.eventBus.dispatch('ui:message_display', {
            text: messageText,
            type: messageType
        });
    }

    /**
     * Handles 'event:move_attempted' event for initial feedback.
     * NOTE: This might be redundant if the move succeeds, as the UI might update location anyway.
     * It's primarily useful for immediate feedback before potential failure messages.
     * Consider if this is needed alongside the location display update.
     * @param {object} payload
     * @param {string} payload.entityId - ID of the entity moving
     * @param {string} payload.direction - Direction of movement
     * @private
     */
    _handleMoveAttempted({entityId, direction}) {
        // TODO: Check if the entityId is the player before displaying
        // Example: if (entityId !== this.dataManager.getPlayerId()) return;
        // This message might conflict with failure messages if the move attempt
        // is immediately followed by an action:move_failed.
        // Let's comment it out for now, as the failure handler provides more specific feedback.
        // this.eventBus.dispatch('ui:message_display', {
        //     text: `You attempt to move ${direction}.`,
        //     type: 'info'
        // });
    }

    /**
     * Handles 'action:move_failed' event.
     * @param {ActionMoveFailedPayload} payload - The event payload.
     * @private
     */
    _handleMoveFailed(payload) {
        // Destructure relevant properties from the payload
        const {
            actorId,
            reasonCode,
            direction,
            locationId, // Note: locationId is not used in the switch, but previousLocationId from the payload definition might be useful for logging
            details,
            blockerDisplayName,
            blockerEntityId /*, lockMessageOverride - likely obsolete */,
            previousLocationId, // Added from payload type definition
            attemptedTargetLocationId // Added from payload type definition
        } = payload;

        // TODO: Check if the actor is the player before displaying message
        // Example: if (actorId !== this.dataManager.getPlayerId()) return;

        let messageText = "You cannot move."; // Generic fallback message
        let messageType = 'warning';      // Default type for failure

        switch (reasonCode) {
            // -- Standard Move System Reason Codes --
            case 'SETUP_ERROR':
                messageText = details === 'Player position unknown'
                    ? TARGET_MESSAGES.MOVE_POSITION_UNKNOWN
                    : TARGET_MESSAGES.MOVE_LOCATION_UNKNOWN;
                messageType = 'error';
                console.error(`NotificationUISystem: Move setup error for actor ${actorId} - Reason: ${reasonCode}, Details: ${details}`);
                break;
            case 'NO_EXITS':
                messageText = TARGET_MESSAGES.MOVE_NO_EXITS;
                messageType = 'info'; // It's informational, not an error
                break;
            case 'INVALID_DIRECTION':
                messageText = TARGET_MESSAGES.MOVE_CANNOT_GO_WAY;
                messageType = 'info'; // Standard feedback for wrong direction
                break;
            case 'DATA_ERROR':
                messageText = details === 'Invalid connection: missing target'
                    ? TARGET_MESSAGES.MOVE_INVALID_CONNECTION(direction || 'that way')
                    : TARGET_MESSAGES.MOVE_BAD_TARGET_DEF(direction || 'that way');
                messageType = 'error';
                console.error(`NotificationUISystem: Move data error for actor ${actorId} - Reason: ${reasonCode}, Direction: ${direction}, Details: ${details}`);
                break;
            case 'INTERNAL_DISPATCH_ERROR': // May not be used if MoveCoordinator handles errors better now
                messageText = TARGET_MESSAGES.INTERNAL_ERROR; // Generic internal error
                messageType = 'error';
                console.error(`NotificationUISystem: Internal move dispatch error for actor ${actorId} - Reason: ${reasonCode}, Details: ${details}`);
                break;

            // -- MoveCoordinator / Blocker System Reason Codes --
            case 'TARGET_LOCATION_NOT_FOUND':
                messageText = TARGET_MESSAGES.MOVE_BAD_TARGET_DEF(direction || 'that way'); // Reuse message for now
                messageType = 'error';
                console.warn(`NotificationUISystem: Move failed for actor ${actorId} - Target location ${attemptedTargetLocationId} not found.`);
                break;
            case 'DIRECTION_LOCKED':
                if (blockerDisplayName && blockerDisplayName.trim() !== '') {
                    messageText = TARGET_MESSAGES.MOVE_BLOCKED_LOCKED(blockerDisplayName);
                } else {
                    messageText = TARGET_MESSAGES.MOVE_LOCKED(direction || 'that way'); // Fallback if blocker name missing
                    console.warn(`NotificationUISystem: Received 'DIRECTION_LOCKED' for actor ${actorId} without a valid blockerDisplayName.`);
                }
                messageType = 'notice'; // Changed from info to notice as 'locked' implies interaction needed
                break;
            case 'DIRECTION_BLOCKED':
                if (blockerDisplayName && blockerDisplayName.trim() !== '') {
                    messageText = TARGET_MESSAGES.MOVE_BLOCKED_GENERIC(blockerDisplayName);
                } else {
                    messageText = "Something blocks the way."; // Generic fallback
                    console.warn(`NotificationUISystem: Received 'DIRECTION_BLOCKED' for actor ${actorId} without a valid blockerDisplayName.`);
                }
                messageType = 'info';
                break;
            case 'BLOCKER_NOT_FOUND':
                messageType = 'warning'; // Data inconsistency
                if (details && typeof details === 'string' && details.trim() !== '') {
                    messageText = details;
                } else {
                    messageText = TARGET_MESSAGES.MOVE_BLOCKER_NOT_FOUND();
                }
                console.error(`NotificationUISystem: Echoing BlockerSystem error - Blocker entity ID "${blockerEntityId}" not found for actor ${actorId} at location ${previousLocationId}.`);
                break;
            case 'MOVE_EXECUTION_ERROR': // Error within MovementSystem.executeMove (caught exception)
            case 'MOVEMENT_EXECUTION_FAILED': // executeMove returned false
                messageText = details || TARGET_MESSAGES.INTERNAL_ERROR; // Use details if provided
                messageType = 'error';
                console.error(`NotificationUISystem: Move execution failed for actor ${actorId}. Reason: ${reasonCode}, Details: ${details}`);
                break;
            case 'COORDINATOR_INTERNAL_ERROR': // Error within MoveCoordinatorSystem itself
                messageText = details || TARGET_MESSAGES.INTERNAL_ERROR;
                messageType = 'error';
                console.error(`NotificationUISystem: Move coordination failed for actor ${actorId}. Reason: ${reasonCode}, Details: ${details}`);
                break;


            // -- Default Case for Unhandled Reasons --
            default:
                messageText = `You failed to move. (${reasonCode})`; // Generic fallback including the reason code
                messageType = 'warning';
                console.warn(`NotificationUISystem: Unhandled move failure reasonCode: ${reasonCode} for actor ${actorId}`);
        }

        // Dispatch the final UI message (handled consistently for all cases)
        this.eventBus.dispatch('ui:message_display', {
            text: messageText,
            type: messageType
        });
    }

    /**
     * Handles 'action:take_succeeded' event.
     * @param {object} payload
     * @param {string} payload.actorId - ID of the entity performing the action
     * @param {string} payload.itemId - ID of the item taken
     * @param {string} payload.itemName - Display name of the item taken
     * @param {string} payload.locationId - Location where it happened
     * @private
     */
    _handleTakeSucceeded({actorId, itemId, itemName, locationId}) {
        // TODO: Check if the actor is the player before displaying
        // Example: if (actorId !== this.dataManager.getPlayerId()) return;
        const displayItemName = this._getDisplayName(itemName || itemId, 'item');
        this.eventBus.dispatch('ui:message_display', {
            text: `You take the ${displayItemName}.`,
            type: 'success'
        });
    }

    /**
     * Handles 'action:take_failed' event.
     * @param {object} payload
     * @param {string} payload.actorId - ID of the entity performing the action
     * @param {string} payload.targetName - The name the player tried to take
     * @param {string} payload.reasonCode - Why the action failed
     * @param {string} payload.locationId - Location where it happened
     * @param {any} [payload.details] - Optional extra info
     * @private
     */
    _handleTakeFailed({actorId, targetName, reasonCode, locationId, details}) {
        // TODO: Check if the actor is the player before displaying
        // Example: if (actorId !== this.dataManager.getPlayerId()) return;
        let messageText;
        let messageType = 'warning'; // Default type for failure

        switch (reasonCode) {
            case 'SETUP_ERROR':
            case 'INTERNAL_PICKUP_ERROR':
                messageText = TARGET_MESSAGES.INTERNAL_ERROR;
                messageType = 'error';
                console.error(`NotificationUISystem: Internal take error - Reason: ${reasonCode}, Target: ${targetName}, Details:`, details);
                break;
            // Note: MISSING_TARGET is handled by _handleValidationFailed now
            case 'TARGET_NOT_FOUND':
                messageText = TARGET_MESSAGES.NOT_FOUND_TAKEABLE(targetName || 'that');
                messageType = 'notice';
                break;
            case 'SCOPE_EMPTY': // This might come from TargetResolutionService failure within takeActionHandler
                messageText = TARGET_MESSAGES.TAKE_EMPTY_LOCATION; // Use the specific message
                messageType = 'notice';
                break;
            case 'TARGET_NOT_TAKEABLE':
                // Assuming targetName here is the display name resolved by the Take action
                messageText = `You can't take the ${targetName || 'item'}.`;
                messageType = 'notice';
                break;
            default:
                messageText = `You failed to take the ${targetName || 'item'}. (${reasonCode})`; // Generic fallback with reason code
                messageType = 'warning';
                console.warn(`NotificationUISystem: Unhandled take failure reasonCode: ${reasonCode}`);
        }

        this.eventBus.dispatch('ui:message_display', {
            text: messageText,
            type: messageType
        });
    }

    /**
     * Handles 'item:use_condition_failed' event.
     * @param {object} payload
     * @param {string} payload.actorId - ID of the entity attempting to use the item
     * @param {string} payload.failureMessage - The reason why usability failed
     * @private
     */
    _handleItemUseConditionFailed({actorId, failureMessage}) {
        // TODO: Check if the actor is the player before displaying, if necessary
        // Example: if (actorId !== this.dataManager.getPlayerId()) return;

        // Directly use the failure message provided by the ItemUsageSystem/ConditionEvaluationService
        this.eventBus.dispatch('ui:message_display', {
            text: failureMessage, // Use the message from the event payload
            type: 'warning'       // Or 'notice'/'info' depending on desired severity
        });
    }

    // --- NEW HANDLERS for OPEN-7 ---

    /**
     * Handles the 'event:entity_opened' event and displays a success message.
     * @param {EntityOpenedEventPayload} payload - The event payload.
     * @private
     */
    _handleEntityOpened(payload) {
        // AC 3: Check if the actor is the player before displaying
        // TODO: Replace with actual player ID check mechanism
        // Example: if (payload.actorId !== this.dataManager?.getPlayerId?.()) return;
        const isPlayerAction = true; // Placeholder assumption
        if (!isPlayerAction) return;

        const {targetDisplayName = 'something'} = payload || {}; // Default fallback

        // AC 3: Dispatch success UI message using TARGET_MESSAGES (assumed to exist)
        this.eventBus.dispatch('ui:message_display', {
            text: TARGET_MESSAGES.OPEN_SUCCESS(targetDisplayName),
            type: 'success'
        });
    }

    /**
     * Handles the 'event:open_failed' event and displays a failure message based on the reason.
     * @param {OpenFailedEventPayload} payload - The event payload.
     * @private
     */
    _handleOpenFailed(payload) {
        // AC 6: Check if the actor is the player before displaying
        // TODO: Replace with actual player ID check mechanism
        // Example: if (payload.actorId !== this.dataManager?.getPlayerId?.()) return;
        const isPlayerAction = true; // Placeholder assumption
        if (!isPlayerAction) return;

        // AC 4 & 5: Extract data and use switch
        // Note: Assumes payload conforms to eventTypes.js definition, including targetDisplayName
        const {
            reasonCode,
            targetDisplayName = 'something' // Default fallback
        } = payload || {};

        let messageText;
        let messageType = 'warning'; // Default type

        // AC 5: Switch on reasonCode and dispatch appropriate messages
        switch (reasonCode) {
            case 'ALREADY_OPEN':
                messageText = TARGET_MESSAGES.OPEN_FAILED_ALREADY_OPEN(targetDisplayName);
                messageType = 'info';
                break;
            case 'LOCKED':
                messageText = TARGET_MESSAGES.OPEN_FAILED_LOCKED(targetDisplayName);
                messageType = 'notice';
                break;
            case 'TARGET_NOT_OPENABLE':
                // Note: OpenableSystem might not dispatch this yet, but handle it defensively.
                messageText = TARGET_MESSAGES.OPEN_FAILED_NOT_OPENABLE(targetDisplayName);
                messageType = 'warning';
                break;
            case 'OTHER': // Explicitly handle 'OTHER' if defined
            default:
                // Note: Includes fallback for unexpected/undefined reason codes
                messageText = TARGET_MESSAGES.OPEN_FAILED_DEFAULT(targetDisplayName);
                messageType = 'warning';
                console.warn(`NotificationUISystem: Unhandled or default open failure reasonCode: ${reasonCode} for target "${targetDisplayName}"`);
                break;
        }

        this.eventBus.dispatch('ui:message_display', {
            text: messageText,
            type: messageType
        });
    }
}

export {NotificationUISystem};