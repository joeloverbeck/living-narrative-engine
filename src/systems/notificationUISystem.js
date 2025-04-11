// src/systems/notificationUISystem.js

/** @typedef {import('../../eventBus.js').default} EventBus */
/** @typedef {import('../../dataManager.js').default} DataManager */
// Optional: Import Localization Service if you have one
// /** @typedef {import('../../services/localizationService.js').default} LocalizationService */
/** @typedef {import('../types/questTypes.js').RewardSummary} RewardSummary */
import {TARGET_MESSAGES} from '../utils/messages.js'; // Import for standard messages

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

        // Action Success/Attempt Events (that generate immediate feedback)
        this.eventBus.subscribe('action:take_succeeded', this._handleTakeSucceeded.bind(this));
        this.eventBus.subscribe('event:move_attempted', this._handleMoveAttempted.bind(this));
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
     * @param {object} payload
     * @param {string} payload.entityId - ID of the entity moving
     * @param {string} payload.direction - Direction of movement
     * @private
     */
    _handleMoveAttempted({entityId, direction}) {
        // TODO: Check if the entityId is the player before displaying
        this.eventBus.dispatch('ui:message_display', {
            text: `You move ${direction}.`, // The simple confirmation
            type: 'info'
        });
    }

    /**
     * Handles 'action:move_failed' event.
     * @param {object} payload
     * @param {string} payload.actorId - ID of the entity attempting to move
     * @param {string} payload.reasonCode - Why the move failed
     * @param {string} [payload.direction] - Direction attempted (if relevant)
     * @param {string} [payload.locationId] - Location where it happened (if relevant)
     * @param {string} [payload.details] - Optional extra info
     * @param {string} [payload.lockMessageOverride] - Optional override message for locked exits
     * @private
     */
    _handleMoveFailed({actorId, reasonCode, direction, locationId, details, lockMessageOverride}) {
        // TODO: Check if the actor is the player before displaying
        let messageText = "You cannot move."; // Generic fallback
        let messageType = 'warning'; // Default type for failure

        switch (reasonCode) {
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
            case 'DIRECTION_LOCKED':
                messageText = lockMessageOverride || TARGET_MESSAGES.MOVE_LOCKED(direction || 'that way');
                messageType = 'info'; // Locked isn't necessarily an error state
                break;
            case 'DATA_ERROR':
                messageText = details === 'Invalid connection: missing target'
                    ? TARGET_MESSAGES.MOVE_INVALID_CONNECTION(direction || 'that way')
                    : TARGET_MESSAGES.MOVE_BAD_TARGET_DEF(direction || 'that way');
                messageType = 'error';
                console.error(`NotificationUISystem: Move data error for actor ${actorId} - Reason: ${reasonCode}, Direction: ${direction}, Details: ${details}`);
                break;
            case 'INTERNAL_DISPATCH_ERROR':
                messageText = TARGET_MESSAGES.INTERNAL_ERROR; // Generic internal error
                messageType = 'error';
                console.error(`NotificationUISystem: Internal move dispatch error for actor ${actorId} - Reason: ${reasonCode}, Details: ${details}`);
                break;
            case 'INVALID_DIRECTION':
                messageText = TARGET_MESSAGES.MOVE_CANNOT_GO_WAY;
                messageType = 'info'; // Standard feedback for wrong direction
                break;
            default:
                messageText = `You failed to move. (${reasonCode})`; // Generic fallback with reason code
                messageType = 'warning';
                console.warn(`NotificationUISystem: Unhandled move failure reasonCode: ${reasonCode}`);
        }

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
            // case 'VALIDATION_FAILED':
            //     messageText = `You can't take that right now.`;
            //     messageType = 'notice';
            //     break;
            case 'TARGET_NOT_FOUND':
                messageText = TARGET_MESSAGES.NOT_FOUND_TAKEABLE(targetName || 'that');
                messageType = 'notice';
                break;
            case 'SCOPE_EMPTY': // This might come from TargetResolutionService failure within takeActionHandler
                messageText = TARGET_MESSAGES.TAKE_EMPTY_LOCATION; // Use the specific message
                messageType = 'notice';
                break;
            case 'TARGET_NOT_TAKEABLE':
                messageText = `You can't take the ${targetName || 'item'}.`;
                messageType = 'notice';
                break;
            default:
                messageText = `You failed to take the ${targetName || 'item'}.`; // Generic fallback
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
        // e.g., if (actorId !== playerEntityId) return;

        // Directly use the failure message provided by the ItemUsageSystem/ConditionEvaluationService
        this.eventBus.dispatch('ui:message_display', {
            text: failureMessage, // Use the message from the event payload
            type: 'warning'       // Or 'notice'/'info' depending on desired severity
        });
    }
}

export {NotificationUISystem};