// src/services/objectiveStateCheckerService.js

/** @typedef {import('../../eventBus.js').default} EventBus */
/** @typedef {import('../../dataManager.js').default} DataManager */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../../gameStateManager.js').default} GameStateManager */
/** @typedef {import('../components/questLogComponent.js').QuestLogComponent} QuestLogComponent */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../../types/questTypes.js').QuestDefinition} QuestDefinition */
/** @typedef {import('../../types/questTypes.js').ObjectiveDefinition} ObjectiveDefinition */
/** @typedef {import('../../types/questTypes.js').PlayerLocationCondition} PlayerLocationCondition */
/** @typedef {import('../../types/questTypes.js').EntityStateCondition} EntityStateCondition */
/** @typedef {import('../../types/questTypes.js').CompletionCondition} CompletionCondition */

/**
 * Service dedicated to managing the checking of objectives based on
 * player location or entity state changes, primarily driven by game events.
 */
class ObjectiveStateCheckerService {
    /** @type {EventBus} */
    eventBus;
    /** @type {DataManager} */
    dataManager;
    /** @type {EntityManager} */
    entityManager;
    /** @type {GameStateManager} */
    gameStateManager;

    /**
     * Stores objectives currently requiring checks.
     * Structure: Map<questId, Map<objectiveId, { definition: ObjectiveDefinition, conditions: Array<PlayerLocationCondition | EntityStateCondition>, callback: Function }>>
     * @private
     * @type {Map<string, Map<string, { definition: ObjectiveDefinition, conditions: Array<PlayerLocationCondition | EntityStateCondition>, callback: Function }>>}
     */
    #activeChecks = new Map();

    /**
     * Lookup map for player location checks.
     * Structure: Map<locationId, Set<string>> where string is 'questId:objectiveId'
     * @private
     * @type {Map<string, Set<string>>}
     */
    #locationWatchers = new Map();

    /**
     * Lookup map for entity state checks.
     * Structure: Map<entityId, Set<{ questId: string, objectiveId: string, requiredState: string }>>
     * @private
     * @type {Map<string, Set<{ questId: string, objectiveId: string, requiredState: string }>>}
     */
    #entityWatchers = new Map();

    /**
     * @param {object} dependencies - The dependencies required by the service.
     * @param {EventBus} dependencies.eventBus - For subscribing to game events.
     * @param {DataManager} dependencies.dataManager - For fetching objective definitions.
     * @param {EntityManager} dependencies.entityManager - For fetching entity instances to check state.
     * @param {GameStateManager} dependencies.gameStateManager - For getting the player entity ID.
     */
    constructor({ eventBus, dataManager, entityManager, gameStateManager }) {
        if (!eventBus) throw new Error("ObjectiveStateCheckerService requires EventBus.");
        if (!dataManager) throw new Error("ObjectiveStateCheckerService requires DataManager.");
        if (!entityManager) throw new Error("ObjectiveStateCheckerService requires EntityManager.");
        if (!gameStateManager) throw new Error("ObjectiveStateCheckerService requires GameStateManager.");

        this.eventBus = eventBus;
        this.dataManager = dataManager;
        this.entityManager = entityManager;
        this.gameStateManager = gameStateManager;

        // Subscribe to relevant events
        this.eventBus.subscribe('event:entity_moved', this._handleEntityMoved.bind(this));
        this.eventBus.subscribe('event:entity_died', this._handleEntityDied.bind(this));
        // Future: Add subscriptions for other potential state-changing events if needed
        // e.g., this.eventBus.subscribe('event:interaction_completed', this._handleInteraction.bind(this));
        // e.g., this.eventBus.subscribe('event:item_effect_applied', this._handleEffectApplied.bind(this));

        console.log("ObjectiveStateCheckerService: Instantiated and subscribed to events.");
    }

    /**
     * Registers state/location checks for relevant objectives within a given quest.
     * Called when a quest starts.
     *
     * @param {string} questId - The ID of the quest being started.
     * @param {QuestDefinition} questDefinition - The definition object for the quest.
     * @param {QuestLogComponent} questLogComponent - The player's quest log component to check completion status.
     * @param {Function} onObjectiveConditionMet - Callback function `(questId, objectiveId) => void` to execute when a condition is met.
     */
    registerChecksForQuest(questId, questDefinition, questLogComponent, onObjectiveConditionMet) {
        console.log(`ObjectiveStateCheckerService: Registering checks for quest "${questId}"...`);

        if (!questDefinition || !questLogComponent || typeof onObjectiveConditionMet !== 'function') {
            console.error(`ObjectiveStateCheckerService.registerChecksForQuest: Invalid arguments for quest "${questId}". Aborting registration.`);
            return;
        }

        if (!questDefinition.objectiveIds?.length) {
            // console.warn(`ObjectiveStateCheckerService: Quest "${questId}" has no objectiveIds. No checks to register.`);
            return;
        }

        for (const objectiveId of questDefinition.objectiveIds) {
            if (questLogComponent.isObjectiveComplete(questId, objectiveId)) {
                continue; // Skip already completed
            }

            const objectiveDefinition = this.dataManager.getObjectiveDefinition(objectiveId);
            if (!objectiveDefinition?.completionConditions?.allOf?.length) {
                continue; // Skip objectives without valid conditions
            }

            const relevantConditions = objectiveDefinition.completionConditions.allOf.filter(
                cond => cond.type === 'player_location_check' || cond.type === 'entity_state_check'
            );

            if (relevantConditions.length > 0) {
                // Store the objective and its relevant conditions if any state/location checks exist
                if (!this.#activeChecks.has(questId)) {
                    this.#activeChecks.set(questId, new Map());
                }
                this.#activeChecks.get(questId).set(objectiveId, {
                    definition: objectiveDefinition,
                    conditions: relevantConditions,
                    callback: onObjectiveConditionMet
                });

                // Add entries to the watcher maps
                for (const condition of relevantConditions) {
                    if (condition.type === 'player_location_check') {
                        const locationId = condition.locationId;
                        if (!this.#locationWatchers.has(locationId)) {
                            this.#locationWatchers.set(locationId, new Set());
                        }
                        this.#locationWatchers.get(locationId).add(`${questId}:${objectiveId}`);
                        console.log(`  - Watching location "${locationId}" for Objective "${objectiveId}"`);
                    } else if (condition.type === 'entity_state_check') {
                        const entityId = condition.entityId;
                        const requiredState = condition.requiredState;
                        if (!this.#entityWatchers.has(entityId)) {
                            this.#entityWatchers.set(entityId, new Set());
                        }
                        this.#entityWatchers.get(entityId).add({ questId, objectiveId, requiredState });
                        console.log(`  - Watching entity "${entityId}" for state "${requiredState}" for Objective "${objectiveId}"`);
                    }
                }
            }
        }
        console.log(`ObjectiveStateCheckerService: Finished registering checks for quest "${questId}".`);
    }

    /**
     * Unregisters all checks associated with a specific objective of a quest.
     * Removes the references from internal tracking maps.
     * Called by QuestSystem after an objective is completed.
     * @param {string} questId - The ID of the quest.
     * @param {string} objectiveId - The ID of the objective whose checks should be removed.
     */
    unregisterChecksForObjective(questId, objectiveId) {
        const questChecks = this.#activeChecks.get(questId);
        if (!questChecks?.has(objectiveId)) {
            // console.debug(`ObjectiveStateCheckerService.unregisterChecksForObjective: No active checks found for objective "${objectiveId}" in quest "${questId}".`);
            return;
        }

        console.log(`ObjectiveStateCheckerService: Unregistering checks for completed objective "${objectiveId}" (Quest: "${questId}")...`);
        const { conditions } = questChecks.get(objectiveId);

        // Remove from watcher maps
        for (const condition of conditions) {
            if (condition.type === 'player_location_check') {
                const locationId = condition.locationId;
                const watcherSet = this.#locationWatchers.get(locationId);
                if (watcherSet) {
                    watcherSet.delete(`${questId}:${objectiveId}`);
                    // console.log(`  - Stopped watching location "${locationId}" for objective "${objectiveId}"`);
                    if (watcherSet.size === 0) {
                        this.#locationWatchers.delete(locationId);
                        // console.log(`  - Removed location watcher for "${locationId}" (empty).`);
                    }
                }
            } else if (condition.type === 'entity_state_check') {
                const entityId = condition.entityId;
                const watcherSet = this.#entityWatchers.get(entityId);
                if (watcherSet) {
                    let found = null;
                    for (const watcher of watcherSet) {
                        if (watcher.questId === questId && watcher.objectiveId === objectiveId) {
                            found = watcher;
                            break;
                        }
                    }
                    if (found) {
                        watcherSet.delete(found);
                        // console.log(`  - Stopped watching entity "${entityId}" state for objective "${objectiveId}"`);
                    }
                    if (watcherSet.size === 0) {
                        this.#entityWatchers.delete(entityId);
                        // console.log(`  - Removed entity watcher for "${entityId}" (empty).`);
                    }
                }
            }
        }

        // Remove from the main tracking map
        questChecks.delete(objectiveId);
        // console.log(`ObjectiveStateCheckerService: Removed active check tracking for objective "${objectiveId}"`);

        // Clean up the quest entry if no objectives remain for this quest
        if (questChecks.size === 0) {
            this.#activeChecks.delete(questId);
            // console.log(`ObjectiveStateCheckerService: Removed active check tracking for quest "${questId}" as no objectives have active checks.`);
        }
    }

    /**
     * Unregisters ALL checks associated with ANY objective of a specific quest.
     * Used as a cleanup mechanism when a quest ends (completed or failed).
     * Called by QuestSystem when a quest completion or failure event is handled.
     * @param {string} questId - The ID of the quest.
     */
    unregisterAllChecksForQuest(questId) {
        const questChecks = this.#activeChecks.get(questId);
        if (!questChecks) {
            // console.debug(`ObjectiveStateCheckerService.unregisterAllChecksForQuest: No checks found for quest "${questId}". Already cleaned or none existed.`);
            return; // No checks tracked for this quest
        }

        console.log(`ObjectiveStateCheckerService: Performing full check cleanup for ended quest "${questId}"...`);

        const objectiveIdsToClean = Array.from(questChecks.keys());

        for (const objectiveId of objectiveIdsToClean) {
            // Reuse the objective-specific cleanup logic
            this.unregisterChecksForObjective(questId, objectiveId);
        }

        // Final check to remove the main quest entry if somehow missed (should be handled by unregisterChecksForObjective)
        if (this.#activeChecks.has(questId)) {
            this.#activeChecks.delete(questId);
            // console.log(`ObjectiveStateCheckerService: Confirmed removal of tracking entry for quest "${questId}".`);
        }
        console.log(`ObjectiveStateCheckerService: Check cleanup complete for quest "${questId}".`);
    }

    // --- Event Handlers ---

    /**
     * Handles the 'event:entity_moved' event. Checks if the moved entity is the player
     * and if their new location matches any watched locations for objectives.
     * @param {import('../types/eventTypes.js').EntityMovedEventPayload} eventData
     * @private
     */
    _handleEntityMoved({ entityId, newLocationId }) {
        const player = this.gameStateManager.getPlayer();
        if (!player || entityId !== player.id) {
            return; // Ignore non-player movements
        }

        const watchedObjectives = this.#locationWatchers.get(newLocationId);
        if (!watchedObjectives || watchedObjectives.size === 0) {
            return; // No objectives are watching this location
        }

        // console.log(`ObjectiveStateCheckerService: Player entered watched location "${newLocationId}". Checking objectives...`);

        // Create a copy as triggering callback might modify the original set via unregistration
        const objectivesToCheck = [...watchedObjectives];

        for (const questObjectiveKey of objectivesToCheck) {
            const [questId, objectiveId] = questObjectiveKey.split(':');
            this._checkAndTriggerObjective(questId, objectiveId, 'player_location_check');
        }
    }

    /**
     * Handles the 'event:entity_died' event. Checks if the deceased entity
     * is being watched for a state change (likely 'defeated').
     * @param {import('../types/eventTypes.js').EntityDiedEventPayload} eventData
     * @private
     */
    _handleEntityDied({ deceasedEntityId }) {
        const watchedObjectives = this.#entityWatchers.get(deceasedEntityId);
        if (!watchedObjectives || watchedObjectives.size === 0) {
            return; // No objectives are watching this entity
        }

        // console.log(`ObjectiveStateCheckerService: Watched entity "${deceasedEntityId}" died. Checking objectives...`);

        // Create a copy as triggering callback might modify the original set via unregistration
        const watchersToCheck = [...watchedObjectives];

        for (const watcher of watchersToCheck) {
            // Check the entity's state *now*. We assume 'death' implies the target state.
            // A more robust check might involve fetching the entity instance and verifying its state component value.
            // For now, we assume the event *itself* signifies the state needed (e.g., 'core:state_defeated').
            // Let's refine this: Check if the watcher's required state matches what death implies.
            // We need a configurable mapping or assumption. Let's assume 'core:state_defeated' is the only watched state triggered by death for now.
            if (watcher.requiredState === 'core:state_defeated') { // Check if the watcher expects this state
                this._checkAndTriggerObjective(watcher.questId, watcher.objectiveId, 'entity_state_check');
            }
            // Else: Death occurred, but this objective wasn't waiting for the 'defeated' state specifically.
        }
    }

    // Potential future handlers:
    /*
    _handleInteraction({ entityId, interactionType }) {
        // Check entityWatchers for entityId
        // Fetch entity state
        // Compare with requiredState
        // Trigger if match
    }

    _handleEffectApplied({ targetEntityId, effectState }) {
        // Check entityWatchers for targetEntityId
        // Fetch entity state OR use effectState if reliable
        // Compare with requiredState
        // Trigger if match
    }
    */

    /**
     * Centralized function to check if ALL conditions (including event_listener ones
     * handled elsewhere) for a specific objective are met, and trigger the callback if so.
     * This is necessary because an objective might require BOTH a state check AND
     * an event listener, or multiple state/location checks.
     *
     * @param {string} questId
     * @param {string} objectiveId
     * @param {('player_location_check'|'entity_state_check')} initiatingConditionType - The type of condition that triggered this check.
     * @private
     */
    _checkAndTriggerObjective(questId, objectiveId, initiatingConditionType) {
        const questChecks = this.#activeChecks.get(questId);
        const objectiveData = questChecks?.get(objectiveId);

        if (!objectiveData) {
            // console.warn(`ObjectiveStateCheckerService._checkAndTriggerObjective: Objective data not found for ${questId}:${objectiveId}. Might have been completed/unregistered concurrently.`);
            return;
        }

        // We need the QuestLogComponent to verify *other* conditions for this objective
        const player = this.gameStateManager.getPlayer();
        const questLogComponent = player?.getComponent(QuestLogComponent); // Adjust key if needed
        if (!questLogComponent) {
            console.error(`ObjectiveStateCheckerService._checkAndTriggerObjective: Cannot find player or QuestLogComponent for ${questId}:${objectiveId}.`);
            return;
        }

        // Check if *this* specific objective is already complete (safety check)
        if (questLogComponent.isObjectiveComplete(questId, objectiveId)) {
            // console.debug(`ObjectiveStateCheckerService: Objective ${questId}:${objectiveId} already complete. Skipping redundant trigger.`);
            // Should we still try to unregister? QuestSystem._processObjectiveCompletion handles this.
            return;
        }

        // Now, verify ALL conditions for this objective are currently met.
        // This requires knowledge of the objective definition.
        const allConditions = objectiveData.definition.completionConditions.allOf;
        let allMet = true;

        for (const condition of allConditions) {
            let conditionMet = false;
            switch (condition.type) {
                case 'player_location_check':
                    const playerLocation = player.getComponent('LocationComponent')?.currentLocationId; // Assuming LocationComponent exists
                    conditionMet = playerLocation === condition.locationId;
                    break;
                case 'entity_state_check':
                    const entity = this.entityManager.getEntityInstance(condition.entityId);
                    // Assume a standard way to get state, e.g., a component or property
                    const entityState = entity?.getComponent('StateComponent')?.getCurrentState() ?? entity?.currentState;
                    conditionMet = entityState === condition.requiredState;
                    break;
                case 'event_listener':
                    // This condition type is handled by ObjectiveEventListenerService.
                    // We cannot reliably check its status here without more complex state sharing.
                    // Assumption: If the event listener service triggered completion, it would have already marked
                    // the objective complete in the quest log. Since we passed the `isObjectiveComplete` check above,
                    // we assume any required event_listener conditions are NOT YET MET *unless* this check
                    // is being triggered *after* the event listener already fired but *before* QuestSystem finished processing.
                    // This implies a potential flaw if an objective requires BOTH an event AND a state check.
                    //
                    // Simpler Approach: Assume that if *this specific check* (location/state) is met,
                    // AND the objective isn't already complete, we fire the callback.
                    // QuestSystem._processObjectiveCompletion will then handle marking it complete.
                    // If other conditions (like an event listener) are still pending, QuestSystem won't mark
                    // the *quest* as complete until that condition is also met and fires its *own* callback.
                    // Let's stick to the simpler approach: if the initiating check is valid, trigger the callback.
                    conditionMet = true; // Assume event listeners are handled independently.
                    break;
                default:
                    console.warn(`ObjectiveStateCheckerService: Unknown condition type "${condition.type}" for objective ${questId}:${objectiveId}. Cannot verify.`);
                    conditionMet = false; // Treat unknown as unmet
                    break;
            }

            if (!conditionMet) {
                // Check if the condition that *initiated* this check is the one that failed.
                // This can happen if the state changed *between* the event firing and this check running (unlikely in turn-based).
                if (condition.type === initiatingConditionType) {
                    console.warn(`ObjectiveStateCheckerService: Initiating condition ${initiatingConditionType} for ${questId}:${objectiveId} no longer seems met. Aborting trigger.`);
                    allMet = false;
                    break;
                }
                // If *another* state/location condition isn't met, the objective isn't fully complete yet.
                else if (condition.type === 'player_location_check' || condition.type === 'entity_state_check') {
                    // console.debug(`ObjectiveStateCheckerService: Objective ${questId}:${objectiveId} not ready. Condition type ${condition.type} not yet met.`);
                    allMet = false;
                    break;
                }
                // Ignore event_listener types here as per the simpler approach.
            }
        }

        if (allMet) {
            console.log(`ObjectiveStateCheckerService: All relevant conditions met for objective "${objectiveId}" (Quest: "${questId}"). Triggering callback.`);
            try {
                // Execute the callback to notify the QuestSystem
                objectiveData.callback(questId, objectiveId);
            } catch (error) {
                console.error(`ObjectiveStateCheckerService: Error executing callback for quest "${questId}", objective "${objectiveId}".`, error);
            }
        }
    }
}

export { ObjectiveStateCheckerService };