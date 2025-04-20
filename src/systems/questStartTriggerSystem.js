// src/services/questStartTriggerSystem.js

/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../core/gameStateManager.js').default} GameStateManager */
/** @typedef {import('../components/questLogComponent.js').QuestLogComponent} QuestLogComponent */
/** @typedef {import('../types/questTypes.js').QuestDefinition} QuestDefinition */
/** @typedef {import('../types/eventTypes.js').EntityMovedEventPayload} EntityMovedEventPayload */

// Assuming component keys match class names for getComponent lookup
import {QuestLogComponent} from "../components/questLogComponent.js";

const QUEST_LOG_COMPONENT_KEY = QuestLogComponent;

/**
 * Listens for player movement and checks if entering a new location
 * should trigger the start of any available quests based on their
 * `startingTriggers` definition.
 */
class QuestStartTriggerSystem {
    /** @type {EventBus} */
    #eventBus;
    /** @type {GameDataRepository} */
    #repository;
    /** @type {GameStateManager} */
    #gameStateManager;

    /**
     * @param {object} dependencies - The dependencies required by the service.
     * @param {EventBus} dependencies.eventBus - For subscribing to events and dispatching triggers.
     * @param {GameDataRepository} dependencies.gameDataRepository - For accessing quest definitions.
     * @param {GameStateManager} dependencies.gameStateManager - For accessing the player entity and their quest log.
     */
    constructor({eventBus, gameDataRepository, gameStateManager}) { // Updated param name
        if (!eventBus) throw new Error("QuestStartTriggerSystem requires EventBus.");
        if (!gameDataRepository) throw new Error("QuestStartTriggerSystem requires GameDataRepository."); // Updated check
        if (!gameStateManager) throw new Error("QuestStartTriggerSystem requires GameStateManager.");

        this.#eventBus = eventBus;
        this.#repository = gameDataRepository; // Updated assignment
        this.#gameStateManager = gameStateManager;
        console.log("QuestStartTriggerSystem: Instantiated.");
    }


    /**
     * Initializes the service by subscribing to relevant game events.
     */
    initialize() {
        this.#eventBus.subscribe("event:entity_moved", this._handleEntityMoved.bind(this));
    }

    /**
     * Handles the "event:entity_moved" event. Checks if the player entered a location
     * that triggers the start of any eligible quests.
     * @param {EntityMovedEventPayload} eventData - The payload from the entity movement event.
     * @private
     */
    _handleEntityMoved({entityId, newLocationId}) {
        // 1. Check if the moved entity is the player
        const player = this.#gameStateManager.getPlayer();
        if (!player || player.id !== entityId) {
            // console.debug(`QuestStartTriggerSystem: Ignoring move event for non-player entity ${entityId}`);
            return;
        }

        if (!newLocationId) {
            console.warn(`QuestStartTriggerSystem: Player move event missing newLocationId. Cannot check triggers.`);
            return;
        }

        // console.log(`QuestStartTriggerSystem: Player ${player.id} moved to location ${newLocationId}. Checking for quest start triggers...`);

        // 2. Get Player's Quest Log
        const questLogComponent = player.getComponent(QUEST_LOG_COMPONENT_KEY);
        if (!questLogComponent) {
            console.error(`QuestStartTriggerSystem: Player ${player.id} is missing QuestLogComponent. Cannot check quest eligibility.`);
            return;
        }

        // 3. Get All Quest Definitions
        const allQuestDefinitions = this.#repository.getAllQuestDefinitions();
        if (!allQuestDefinitions || allQuestDefinitions.length === 0) {
            // console.log("QuestStartTriggerSystem: No quest definitions found in GameDataRepository.");
            return;
        }

        // 4. Iterate through quests
        for (const questDef of allQuestDefinitions) {
            if (!questDef || !questDef.id) {
                console.warn("QuestStartTriggerSystem: Encountered invalid quest definition during iteration.", questDef);
                continue;
            }

            // 5. Eligibility Check: Is the quest already tracked?
            const currentStatus = questLogComponent.getQuestStatus(questDef.id);
            if (currentStatus) {
                // console.debug(`QuestStartTriggerSystem: Skipping quest "${questDef.id}" - already tracked with status "${currentStatus}".`);
                continue; // Skip quests the player already has (active, completed, or failed)
            }

            // 6. Check Starting Triggers
            if (!questDef.startingTriggers || !Array.isArray(questDef.startingTriggers)) {
                // console.debug(`QuestStartTriggerSystem: Quest "${questDef.id}" has no startingTriggers array. Skipping.`);
                continue; // No starting triggers defined for this quest
            }

            for (const trigger of questDef.startingTriggers) {
                // 7. Check for Matching 'on_enter_location' Trigger
                if (trigger && trigger.type === 'on_enter_location' && trigger.locationId === newLocationId) {
                    console.log(`QuestStartTriggerSystem: MATCH FOUND! Player entered location "${newLocationId}", which matches 'on_enter_location' trigger for eligible quest "${questDef.id}".`);

                    // 8. Dispatch Event to Signal Quest System
                    this.#eventBus.dispatch('event:quest_trigger_met', {
                        questId: questDef.id
                        // Optional: Could add triggerType: 'on_enter_location' if QuestSystem needs it
                    });

                    // Found a matching trigger for this quest, no need to check other triggers *for this specific quest*.
                    // Move to the next quest definition.
                    break;
                }
            } // End loop through triggers for one quest
        } // End loop through all quest definitions
    }
}

// Export the service class
export {QuestStartTriggerSystem};