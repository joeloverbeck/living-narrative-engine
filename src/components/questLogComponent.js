// src/components/questLogComponent.js

import Component from './component.js';

// Define valid quest statuses
const VALID_STATUSES = new Set(['active', 'completed', 'failed']);

/**
 * Manages the runtime state of quests for an entity.
 * Stores active, completed, and failed quests along with their
 * completed objectives.
 */
export class QuestLogComponent extends Component {
    constructor() {
        super();
        /**
         * Stores the runtime state of all quests associated with this entity.
         * Key: QuestID (string)
         * Value: QuestProgress object {status: string, completedObjectives: Set<string>}
         * @type {Map<string, {status: 'active' | 'completed' | 'failed', completedObjectives: Set<string>}>}
         */
        this.quests = new Map();
        console.log("QuestLogComponent initialized with empty quest map."); // Debug log
    }

    /**
     * Helper method to safely retrieve the progress object for a quest.
     * @param {string} questId - The ID of the quest.
     * @returns {{status: string, completedObjectives: Set<string>} | undefined} The progress object or undefined if not found.
     * @private
     */
    _getQuestProgress(questId) {
        return this.quests.get(questId);
    }

    /**
     * Adds a new quest to the log with 'active' status.
     * Does nothing and logs a warning if the quest is already tracked.
     * @param {string} questId - The unique ID of the quest to start.
     * @returns {boolean} True if the quest was successfully started, false otherwise (e.g., already exists).
     */
    startQuest(questId) {
        if (typeof questId !== 'string' || questId.trim() === '') {
            console.error("QuestLogComponent.startQuest: Invalid questId provided.");
            return false;
        }
        if (this.quests.has(questId)) {
            console.warn(`QuestLogComponent.startQuest: Quest "${questId}" is already being tracked.`);
            return false;
        }

        const newProgress = {
            status: 'active',
            completedObjectives: new Set()
        };
        this.quests.set(questId, newProgress);
        console.log(`QuestLogComponent: Started quest "${questId}".`); // Debug log
        return true;
    }

    /**
     * Gets the current status of a specific quest.
     * @param {string} questId - The ID of the quest.
     * @returns {'active' | 'completed' | 'failed' | undefined} The status string or undefined if the quest is not tracked.
     */
    getQuestStatus(questId) {
        const progress = this._getQuestProgress(questId);
        return progress ? progress.status : undefined;
    }

    /**
     * Gets the Set of completed objective IDs for a specific quest.
     * The set is returned even for completed or failed quests (historical data).
     * @param {string} questId - The ID of the quest.
     * @returns {Set<string> | undefined} The Set of completed objective IDs, or undefined if the quest is not tracked.
     */
    getCompletedObjectives(questId) {
        const progress = this._getQuestProgress(questId);
        // Return a *copy* of the set to prevent external modification
        return progress ? new Set(progress.completedObjectives) : undefined;
    }

    /**
     * Checks if a specific objective within a quest has been completed.
     * @param {string} questId - The ID of the quest.
     * @param {string} objectiveId - The ID of the objective.
     * @returns {boolean} True if the objective is completed for the quest, false otherwise (including if quest or objective ID is invalid or quest not tracked).
     */
    isObjectiveComplete(questId, objectiveId) {
        if (typeof objectiveId !== 'string' || objectiveId.trim() === '') {
            console.warn("QuestLogComponent.isObjectiveComplete: Invalid objectiveId provided.");
            return false;
        }
        const progress = this._getQuestProgress(questId);
        return progress ? progress.completedObjectives.has(objectiveId) : false;
    }

    /**
     * Updates the overall status of a tracked quest.
     * Throws error if the quest is not found or the new status is invalid.
     * @param {string} questId - The ID of the quest to update.
     * @param {'active' | 'completed' | 'failed'} newStatus - The new status for the quest.
     * @returns {boolean} True if the status was successfully updated.
     * @throws {Error} If questId is not found or newStatus is invalid.
     */
    updateQuestStatus(questId, newStatus) {
        if (!VALID_STATUSES.has(newStatus)) {
            throw new Error(`QuestLogComponent.updateQuestStatus: Invalid status "${newStatus}". Must be one of: ${[...VALID_STATUSES].join(', ')}.`);
        }

        const progress = this._getQuestProgress(questId);
        if (!progress) {
            throw new Error(`QuestLogComponent.updateQuestStatus: Quest "${questId}" not found.`);
        }

        if (progress.status !== newStatus) {
            progress.status = newStatus;
            console.log(`QuestLogComponent: Updated status of quest "${questId}" to "${newStatus}".`); // Debug log
            // Optional: Emit event here if using an event system
            // this.entity.emit('questStatusChanged', { questId, newStatus });
        } else {
            console.log(`QuestLogComponent: Quest "${questId}" already has status "${newStatus}". No update needed.`); // Debug log
        }
        return true;
    }

    /**
     * Marks a specific objective as complete for a tracked, active quest.
     * Throws error if the quest is not found or is not currently active.
     * Logs a debug message if the objective was already complete.
     * @param {string} questId - The ID of the quest containing the objective.
     * @param {string} objectiveId - The ID of the objective to mark as complete.
     * @returns {boolean} True if the objective was newly marked as complete, false if it was already complete.
     * @throws {Error} If questId is not found, objectiveId is invalid, or the quest is not active.
     */
    completeObjective(questId, objectiveId) {
        if (typeof objectiveId !== 'string' || objectiveId.trim() === '') {
            throw new Error("QuestLogComponent.completeObjective: Invalid objectiveId provided.");
        }

        const progress = this._getQuestProgress(questId);
        if (!progress) {
            throw new Error(`QuestLogComponent.completeObjective: Quest "${questId}" not found.`);
        }

        if (progress.status !== 'active') {
            throw new Error(`QuestLogComponent.completeObjective: Cannot complete objective for quest "${questId}" because its status is "${progress.status}" (must be "active").`);
        }

        if (progress.completedObjectives.has(objectiveId)) {
            console.debug(`QuestLogComponent.completeObjective: Objective "${objectiveId}" for quest "${questId}" was already complete.`);
            return false; // Indicates objective was already complete
        }

        progress.completedObjectives.add(objectiveId);
        console.log(`QuestLogComponent: Completed objective "${objectiveId}" for quest "${questId}".`); // Debug log
        // Optional: Emit event here if using an event system
        // this.entity.emit('objectiveCompleted', { questId, objectiveId });
        return true; // Indicates objective was newly completed
    }

    /**
     * Gets all tracked quest IDs.
     * @returns {string[]} An array of quest IDs.
     */
    getAllQuestIds() {
        return Array.from(this.quests.keys());
    }

    /**
     * Gets the entire quest log state. Useful for saving.
     * Note: Converts Sets to Arrays for easier serialization.
     * @returns {Record<string, {status: string, completedObjectives: string[]}>} Plain object representation.
     */
    getSerializableState() {
        const state = {};
        for (const [questId, progress] of this.quests.entries()) {
            state[questId] = {
                status: progress.status,
                completedObjectives: Array.from(progress.completedObjectives) // Convert Set to Array
            };
        }
        return state;
    }

    /**
     * Restores the quest log state from a serializable object.
     * WARNING: Clears existing state before restoring.
     * @param {Record<string, {status: string, completedObjectives: string[]}>} state - The state object to load.
     */
    loadFromSerializableState(state) {
        this.quests.clear();
        if (!state || typeof state !== 'object') {
            console.warn("QuestLogComponent.loadFromSerializableState: Invalid or empty state provided.");
            return;
        }

        for (const questId in state) {
            if (Object.hasOwnProperty.call(state, questId)) {
                const progressData = state[questId];
                if (progressData && VALID_STATUSES.has(progressData.status) && Array.isArray(progressData.completedObjectives)) {
                    this.quests.set(questId, {
                        status: progressData.status,
                        completedObjectives: new Set(progressData.completedObjectives) // Convert Array back to Set
                    });
                } else {
                    console.warn(`QuestLogComponent.loadFromSerializableState: Invalid progress data for quest "${questId}". Skipping.`);
                }
            }
        }
        console.log(`QuestLogComponent: Loaded state for ${this.quests.size} quests.`);
    }
}