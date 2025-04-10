// src/systems/questSystem.js

/** @typedef {import('../../dataManager.js').default} DataManager */
/** @typedef {import('../../eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../gameStateManager.js').default} GameStateManager */
/** @typedef {import('../components/questLogComponent.js').QuestLogComponent} QuestLogComponent */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../services/questPrerequisiteService.js').QuestPrerequisiteService} QuestPrerequisiteService */
/** @typedef {import('../services/QuestRewardService.js').QuestRewardService} QuestRewardService */
/** @typedef {import('../services/ObjectiveEventListenerService.js').ObjectiveEventListenerService} ObjectiveEventListenerService */
/** @typedef {import('../services/objectiveStateCheckerService.js').ObjectiveStateCheckerService} ObjectiveStateCheckerService */
/** @typedef {import('../types/questTypes.js').QuestDefinition} QuestDefinition */
/** @typedef {import('../types/questTypes.js').RewardSummary} RewardSummary */

import { QuestLogComponent } from "../components/questLogComponent.js";

// Assuming component keys match class names for getComponent lookup
const QUEST_LOG_COMPONENT_KEY = QuestLogComponent; // Ensure this matches your component registration if not using class name

/**
 * Manages the lifecycle and state of quests within the game.
 * Delegates objective event listener management to ObjectiveEventListenerService.
 * Delegates objective state/location checking to ObjectiveStateCheckerService.
 */
class QuestSystem {
    /** @type {DataManager} */
    dataManager;
    /** @type {EventBus} */
    eventBus;
    /** @type {EntityManager} */
    entityManager;
    /** @type {GameStateManager} */
    gameStateManager;
    /** @type {QuestPrerequisiteService} */
    questPrerequisiteService;
    /** @type {QuestRewardService} */
    questRewardService;
    /** @type {ObjectiveEventListenerService} */
    objectiveEventListenerService;
    /** @type {ObjectiveStateCheckerService} */ // <-- ADDED Property
    objectiveStateCheckerService;          // <-- ADDED Property

    /**
     * @param {object} dependencies - The core dependencies required by the system.
     * @param {DataManager} dependencies.dataManager - For accessing quest/objective definitions.
     * @param {EventBus} dependencies.eventBus - For subscribing to and dispatching quest-related events.
     * @param {EntityManager} dependencies.entityManager - For accessing entity instances and components.
     * @param {GameStateManager} dependencies.gameStateManager - For accessing global game state.
     * @param {QuestPrerequisiteService} dependencies.questPrerequisiteService - Service for checking quest prerequisites.
     * @param {QuestRewardService} dependencies.questRewardService - Service for granting quest rewards.
     * @param {ObjectiveEventListenerService} dependencies.objectiveEventListenerService - Service for managing objective event listeners.
     * @param {ObjectiveStateCheckerService} dependencies.objectiveStateCheckerService - Service for managing objective state/location checks. // <-- ADDED Dependency
     */
    constructor({ dataManager, eventBus, entityManager, gameStateManager, questPrerequisiteService, questRewardService, objectiveEventListenerService, objectiveStateCheckerService }) { // <-- ADDED objectiveStateCheckerService param
        if (!dataManager) throw new Error("QuestSystem requires DataManager.");
        if (!eventBus) throw new Error("QuestSystem requires EventBus.");
        if (!entityManager) throw new Error("QuestSystem requires EntityManager.");
        if (!gameStateManager) throw new Error("QuestSystem requires GameStateManager.");
        if (!questPrerequisiteService) throw new Error("QuestSystem requires QuestPrerequisiteService.");
        if (!questRewardService) throw new Error("QuestSystem requires QuestRewardService.");
        if (!objectiveEventListenerService) throw new Error("QuestSystem requires ObjectiveEventListenerService.");
        if (!objectiveStateCheckerService) throw new Error("QuestSystem requires ObjectiveStateCheckerService."); // <-- ADDED check

        this.dataManager = dataManager;
        this.eventBus = eventBus;
        this.entityManager = entityManager;
        this.gameStateManager = gameStateManager;
        this.questPrerequisiteService = questPrerequisiteService;
        this.questRewardService = questRewardService;
        this.objectiveEventListenerService = objectiveEventListenerService;
        this.objectiveStateCheckerService = objectiveStateCheckerService; // <-- ADDED assignment

        console.log("QuestSystem: Instantiated.");
    }

    /**
     * Initializes the Quest System.
     * Subscribes to events that can trigger quest activation or require objective checking.
     * Also subscribes to quest completion/failure events for cleanup delegation.
     */
    initialize() {
        console.log("QuestSystem: Initializing...");
        this.eventBus.subscribe('event:quest_accepted', this._handleQuestAcceptance.bind(this));
        this.eventBus.subscribe('event:quest_trigger_met', this._handleQuestTriggerMet.bind(this));
        this.eventBus.subscribe('quest:started', this._handleQuestStarted.bind(this));
        this.eventBus.subscribe('quest:completed', this._handleQuestEnded.bind(this));
        this.eventBus.subscribe('quest:failed', this._handleQuestEnded.bind(this));
        console.log("QuestSystem: Initialization complete. Listening for events.");
    }

    // --- Event Handlers ---

    _handleQuestAcceptance({ questId }) {
        console.log(`QuestSystem: Received event:quest_accepted for quest "${questId}".`);
        if (!questId || typeof questId !== 'string') {
            console.warn("QuestSystem: Received event:quest_accepted with invalid or missing questId:", questId);
            return;
        }
        this.activateQuest(questId);
    }

    _handleQuestTriggerMet({ questId }) {
        console.log(`QuestSystem: Received event:quest_trigger_met for quest "${questId}".`);
        if (!questId || typeof questId !== 'string') {
            console.warn("QuestSystem: Received event:quest_trigger_met with invalid or missing questId:", questId);
            return;
        }
        this.activateQuest(questId);
    }

    /**
     * Handles the `event:quest_started` event.
     * Delegates the registration of objective event listeners AND state/location checks
     * to the respective services.
     * @param {object} eventData
     * @param {string} eventData.questId - The ID of the quest that just started.
     * @private
     */
    _handleQuestStarted({ questId }) {
        console.log(`QuestSystem: Handling event:quest_started for quest "${questId}". Delegating objective setup...`);

        if (!questId || typeof questId !== 'string') {
            console.error(`QuestSystem._handleQuestStarted: Invalid questId received: ${questId}`);
            return;
        }

        // 1. Retrieve Quest Definition
        const questDefinition = this.dataManager.getQuestDefinition(questId);
        if (!questDefinition) {
            console.error(`QuestSystem._handleQuestStarted: Quest definition not found for ID: ${questId}. Cannot process objectives.`);
            return;
        }

        // 2. Retrieve Player's Quest Log
        const player = this.gameStateManager.getPlayer();
        if (!player) {
            console.error(`QuestSystem._handleQuestStarted: Player entity not found. Cannot process objectives for quest "${questId}".`);
            return;
        }
        const questLogComponent = player.getComponent(QUEST_LOG_COMPONENT_KEY);
        if (!questLogComponent) {
            console.error(`QuestSystem._handleQuestStarted: Player ${player.id} missing QuestLogComponent. Cannot process objectives for quest "${questId}".`);
            return;
        }

        // 3. Delegate to ObjectiveEventListenerService
        // Pass the callback QuestSystem uses to process completion
        this.objectiveEventListenerService.registerListenersForQuest(
            questId,
            questDefinition,
            questLogComponent,
            this._processObjectiveCompletion.bind(this)
        );

        // 4. Delegate to ObjectiveStateCheckerService // <-- ADDED Delegation
        this.objectiveStateCheckerService.registerChecksForQuest(
            questId,
            questDefinition,
            questLogComponent,
            this._processObjectiveCompletion.bind(this) // Use the same callback
        );

        console.log(`QuestSystem: Objective setup delegation complete for started quest "${questId}".`);
    }

    /**
     * Handles the event:quest_completed or event:quest_failed events.
     * Delegates the cleanup of all remaining listeners AND checks for the ended quest
     * to the respective services.
     * @param {object} eventData
     * @param {string} eventData.questId - The ID of the quest that ended.
     * @private
     */
    _handleQuestEnded({ questId }) {
        if (!questId || typeof questId !== 'string') {
            console.error(`QuestSystem._handleQuestEnded: Received event with invalid or missing questId:`, questId);
            return;
        }
        console.log(`QuestSystem: Received quest ended event for quest "${questId}". Delegating objective cleanup.`);

        // Delegate cleanup of ALL listeners for this quest
        this.objectiveEventListenerService.unregisterAllListenersForQuest(questId);

        // Delegate cleanup of ALL state/location checks for this quest // <-- ADDED Delegation
        this.objectiveStateCheckerService.unregisterAllChecksForQuest(questId);
    }


    // --- Quest Activation & Lifecycle ---

    /**
     * Attempts to activate a quest for the player.
     * Checks prerequisites, updates QuestLogComponent, dispatches 'quest:started' or 'quest:prerequisites_not_met'.
     * @param {string} questId - The ID of the quest definition to attempt activating.
     * @returns {boolean} True if the quest was successfully activated, false otherwise.
     */
    activateQuest(questId) {
        if (!questId || typeof questId !== 'string') {
            console.error("QuestSystem.activateQuest: Invalid questId provided.");
            return false;
        }
        const player = this.gameStateManager.getPlayer();
        if (!player) {
            console.error(`QuestSystem.activateQuest: Cannot activate quest "${questId}". Player entity not found.`);
            return false;
        }
        const questLog = player.getComponent(QUEST_LOG_COMPONENT_KEY);
        if (!questLog) {
            console.error(`QuestSystem.activateQuest: Player ${player.id} missing QuestLogComponent.`);
            return false;
        }
        const currentStatus = questLog.getQuestStatus(questId);
        if (currentStatus) {
            console.warn(`QuestSystem.activateQuest: Quest "${questId}" already exists in log with status "${currentStatus}". Activation aborted.`);
            return false; // Quest already exists, don't reactivate
        }
        const questDefinition = this.dataManager.getQuestDefinition(questId);
        if (!questDefinition) {
            console.error(`QuestSystem.activateQuest: Quest definition not found for ID: ${questId}.`);
            return false;
        }
        const titleId = questDefinition.titleId || `quest_title_${questId}`; // Fallback titleId

        // --- Prerequisite Check ---
        const prerequisitesMet = this.questPrerequisiteService.check(questDefinition, player);

        if (prerequisitesMet) {
            const started = questLog.startQuest(questId);
            if (started) {
                console.log(`QuestSystem: Successfully activated quest "${questId}" for player ${player.id}.`);
                this.eventBus.dispatch('quest:started', {
                    questId: questId,
                    titleId: titleId
                });
                console.log(`QuestSystem: Dispatched quest:started for quest "${questId}".`);
                return true;
            } else {
                console.error(`QuestSystem.activateQuest: QuestLogComponent.startQuest failed for "${questId}".`);
                return false; // Should ideally not happen if status check passed
            }
        } else {
            console.warn(`QuestSystem.activateQuest: Prerequisites not met for quest "${questId}". Activation aborted.`);
            this.eventBus.dispatch('quest:prerequisites_not_met', {
                questId: questId,
                titleId: titleId
            });
            return false;
        }
    }

    /**
     * Processes the potential completion of an objective.
     * This method is now called EXTERNALLY by ObjectiveEventListenerService OR ObjectiveStateCheckerService
     * via callback when an objective's condition (event, state, or location) is met.
     * Updates QuestLogComponent, delegates listener/checker unsubscription for the completed objective,
     * fires completion events, and checks for overall quest completion.
     * @param {string} questId - The ID of the quest.
     * @param {string} objectiveId - The ID of the objective whose condition was met.
     * @protected // Keep protected/public, called by services
     */
    _processObjectiveCompletion(questId, objectiveId) {
        console.log(`QuestSystem: Received objective completion signal for Obj:"${objectiveId}" | Quest:"${questId}" from a service.`);
        const player = this.gameStateManager.getPlayer();
        if (!player) {
            console.error(`QuestSystem._processObjectiveCompletion: Player not found. Cannot complete objective "${objectiveId}" for quest "${questId}".`);
            return;
        }
        const questLogComponent = player.getComponent(QUEST_LOG_COMPONENT_KEY);
        if (!questLogComponent) {
            console.error(`QuestSystem._processObjectiveCompletion: Player ${player.id} missing QuestLogComponent. Cannot complete objective "${objectiveId}" for quest "${questId}".`);
            return;
        }

        // CRITICAL: Check if already complete *again* (race condition / double-event safety)
        if (questLogComponent.isObjectiveComplete(questId, objectiveId)) {
            // console.warn(`QuestSystem._processObjectiveCompletion: Objective "${objectiveId}" (Quest: "${questId}") was already completed. Ignoring redundant signal.`);
            // Still important to tell the services to clean up JUST IN CASE listeners/checks didn't get removed.
            this.objectiveEventListenerService.unregisterListenersForObjective(questId, objectiveId);
            this.objectiveStateCheckerService.unregisterChecksForObjective(questId, objectiveId); // <-- ADDED Cleanup Call
            return;
        }

        // Ensure quest is still active before completing objective
        const currentQuestStatus = questLogComponent.getQuestStatus(questId);
        if (currentQuestStatus !== 'active') {
            console.warn(`QuestSystem._processObjectiveCompletion: Quest "${questId}" is no longer active (status: ${currentQuestStatus}). Cannot complete objective "${objectiveId}".`);
            // Clean up listeners/checks for this objective via the services
            this.objectiveEventListenerService.unregisterListenersForObjective(questId, objectiveId);
            this.objectiveStateCheckerService.unregisterChecksForObjective(questId, objectiveId); // <-- ADDED Cleanup Call
            return;
        }

        const objectiveDefinition = this.dataManager.getObjectiveDefinition(objectiveId);
        if (!objectiveDefinition) {
            console.error(`QuestSystem._processObjectiveCompletion: Objective definition not found for ID: ${objectiveId}. Cannot fire completion events.`);
            // Proceed with marking complete, but log error.
        }

        // Mark objective as complete in the log
        try {
            const newlyCompleted = questLogComponent.completeObjective(questId, objectiveId);

            if (newlyCompleted) {
                console.log(`QuestSystem: Objective "${objectiveId}" successfully marked as complete for quest "${questId}".`);

                // Fire objective completion events
                if (objectiveDefinition?.eventsToFireOnCompletion?.length > 0) {
                    for (const eventDef of objectiveDefinition.eventsToFireOnCompletion) {
                        if (eventDef.eventName) {
                            console.log(`QuestSystem: Firing objective completion event: "${eventDef.eventName}"`);
                            this.eventBus.dispatch(eventDef.eventName, {
                                ...(eventDef.eventData || {}),
                                questId: questId,
                                objectiveId: objectiveId
                            });
                        }
                    }
                }

                // *** DELEGATE Listener AND Checker Unsubscription for this specific objective ***
                console.log(`QuestSystem: Delegating cleanup for completed objective "${objectiveId}"...`);
                this.objectiveEventListenerService.unregisterListenersForObjective(questId, objectiveId);
                this.objectiveStateCheckerService.unregisterChecksForObjective(questId, objectiveId); // <-- ADDED Cleanup Call

                // *** Check if the entire quest is now complete ***
                this._checkQuestCompletion(questId);

            }
            // else case (already complete) is handled by the check at the start.

        } catch (error) {
            console.error(`QuestSystem._processObjectiveCompletion: Error completing objective "${objectiveId}" for quest "${questId}":`, error);
            // Attempt cleanup via services even if completion failed
            this.objectiveEventListenerService.unregisterListenersForObjective(questId, objectiveId);
            this.objectiveStateCheckerService.unregisterChecksForObjective(questId, objectiveId); // <-- ADDED Cleanup Call
        }
    }


    /**
     * Checks if all objectives for a given quest are complete.
     * If so, marks the quest as completed.
     * Includes a safety check to ensure cleanup is delegated if quest is found ended.
     * @param {string} questId - The ID of the quest to check.
     * @private
     */
    _checkQuestCompletion(questId) {
        const player = this.gameStateManager.getPlayer();
        const questLogComponent = player?.getComponent(QUEST_LOG_COMPONENT_KEY);
        const questDefinition = this.dataManager.getQuestDefinition(questId);

        if (!player || !questLogComponent || !questDefinition) {
            console.error(`QuestSystem._checkQuestCompletion: Cannot check quest "${questId}" - missing player, quest log, or definition.`);
            return;
        }

        const currentStatus = questLogComponent.getQuestStatus(questId);
        if (currentStatus !== 'active') {
            // console.debug(`QuestSystem._checkQuestCompletion: Quest "${questId}" is not active (status: ${currentStatus}). No completion check needed.`);
            if (currentStatus === 'completed' || currentStatus === 'failed') {
                // Safety check: Ensure cleanup was delegated if we find the quest already ended.
                // This might happen in rare race conditions or if completion was triggered outside the normal flow.
                console.warn(`QuestSystem._checkQuestCompletion: Quest "${questId}" found in ended state (${currentStatus}) during check. Ensuring cleanup delegation.`);
                this.objectiveEventListenerService.unregisterAllListenersForQuest(questId);
                this.objectiveStateCheckerService.unregisterAllChecksForQuest(questId); // <-- ADDED Safety Cleanup Call
            }
            return;
        }

        let allObjectivesComplete = true;
        if (!questDefinition.objectiveIds?.length) {
            console.warn(`QuestSystem._checkQuestCompletion: Quest "${questId}" has no objectives defined. Assuming cannot be completed this way.`);
            allObjectivesComplete = false;
        } else {
            for (const objectiveId of questDefinition.objectiveIds) {
                if (!questLogComponent.isObjectiveComplete(questId, objectiveId)) {
                    allObjectivesComplete = false;
                    break;
                }
            }
        }

        if (allObjectivesComplete) {
            console.log(`QuestSystem: All objectives for quest "${questId}" are complete! Completing quest...`);
            this.completeQuest(questId);
        } else {
            console.log(`QuestSystem._checkQuestCompletion: Quest "${questId}" is not yet complete. Remaining objectives.`);
        }
    }

    /**
     * Marks a quest as completed, updates QuestLogComponent, delegates rewards,
     * gets reward summary, and dispatches 'quest:completed' event.
     * @param {string} questId - The ID of the quest to complete.
     * @private
     */
    completeQuest(questId) {
        const player = this.gameStateManager.getPlayer();
        const questLogComponent = player?.getComponent(QUEST_LOG_COMPONENT_KEY);
        const questDefinition = this.dataManager.getQuestDefinition(questId);

        if (!player || !questLogComponent || !questDefinition) {
            console.error(`QuestSystem.completeQuest: Cannot complete quest "${questId}" - missing dependencies.`);
            return;
        }
        const titleId = questDefinition.titleId || `quest_title_${questId}`; // Fallback titleId

        if(questLogComponent.getQuestStatus(questId) !== 'active') {
            console.warn(`QuestSystem.completeQuest: Attempted to complete quest "${questId}" but its status is not 'active' (${questLogComponent.getQuestStatus(questId)}). Aborting.`);
            // Still dispatch completion event to ensure cleanup runs via _handleQuestEnded
            this.eventBus.dispatch('quest:completed', { questId: questId, titleId: titleId, rewardSummary: null });
            return;
        }

        try {
            questLogComponent.updateQuestStatus(questId, 'completed');
            console.log(`QuestSystem: Marked quest "${questId}" as completed in QuestLogComponent.`);

            // ---> Delegate actual reward GRANTING (happens silently now)
            console.log(`QuestSystem: Delegating reward granting for quest "${questId}" to QuestRewardService...`);
            this.questRewardService.grant(questDefinition, player);

            // ---> Get reward SUMMARY from service
            const rewardSummary = this.questRewardService.getRewardSummary(questDefinition);

            this.eventBus.dispatch('quest:completed', {
                questId: questId,
                titleId: titleId,
                rewardSummary: rewardSummary
            });
            console.log(`QuestSystem: Dispatched quest:completed for quest "${questId}". Cleanup handled by listener.`);

        } catch (error) {
            console.error(`QuestSystem.completeQuest: Error completing quest "${questId}":`, error);
            // Force cleanup via services AND semantic event dispatch if status update/grant/event failed
            this.objectiveEventListenerService.unregisterAllListenersForQuest(questId);
            this.objectiveStateCheckerService.unregisterAllChecksForQuest(questId);
            // Dispatch semantic event even on error to potentially trigger cleanup
            this.eventBus.dispatch('quest:completed', { questId: questId, titleId: titleId, rewardSummary: null });
        }
    }



    /**
     * Marks a quest as failed, updates QuestLogComponent,
     * and dispatches 'quest:failed' event.
     * @param {string} questId - The ID of the quest to fail.
     * @param {string} [reason=null] - Optional reason for failure (can be used by UI).
     */
    failQuest(questId, reason = null) { //
        const player = this.gameStateManager.getPlayer();
        const questLogComponent = player?.getComponent(QUEST_LOG_COMPONENT_KEY);
        const questDefinition = this.dataManager.getQuestDefinition(questId); // Needed for titleId

        if (!player || !questLogComponent) {
            console.error(`QuestSystem.failQuest: Cannot fail quest "${questId}" - missing player or quest log.`);
            return;
        }
        const titleId = questDefinition?.titleId || `quest_title_${questId}`; // Fallback titleId

        const currentStatus = questLogComponent.getQuestStatus(questId);
        if(currentStatus !== 'active') {
            console.warn(`QuestSystem.failQuest: Attempted to fail quest "${questId}" but its status is not 'active' (${currentStatus}). Aborting.`);
            // Still dispatch failed event to ensure cleanup runs via _handleQuestEnded
            this.eventBus.dispatch('quest:failed', { questId: questId, titleId: titleId, reason: reason });
            return;
        }

        try {
            questLogComponent.updateQuestStatus(questId, 'failed');
            console.log(`QuestSystem: Marked quest "${questId}" as failed in QuestLogComponent.`);

            this.eventBus.dispatch('quest:failed', {
                questId: questId,
                titleId: titleId,
                reason: reason // Pass the reason along
            });
            console.log(`QuestSystem: Dispatched quest:failed for quest "${questId}". Cleanup handled by listener.`);

        } catch (error) {
            console.error(`QuestSystem.failQuest: Error failing quest "${questId}":`, error);
            // Force cleanup via services AND semantic event dispatch if status update/event failed
            this.objectiveEventListenerService.unregisterAllListenersForQuest(questId);
            this.objectiveStateCheckerService.unregisterAllChecksForQuest(questId);
            this.eventBus.dispatch('quest:failed', { questId: questId, titleId: titleId, reason: reason });
        }
    }
}

export default QuestSystem;