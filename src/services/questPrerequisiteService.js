// src/services/questPrerequisiteService.js

/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/questLogComponent.js').QuestLogComponent} QuestLogComponent */
/** @typedef {import('../components/statsComponent.js').StatsComponent} StatsComponent */
/** @typedef {import('../../types/questTypes.js').QuestDefinition} QuestDefinition */ // Assuming type definition exists

// Import required components for checking prerequisites
import { QuestLogComponent } from "../components/questLogComponent.js";
import { StatsComponent } from "../components/statsComponent.js";

// Component keys used for retrieval from the entity
const QUEST_LOG_COMPONENT_KEY = QuestLogComponent;
const STATS_COMPONENT_KEY = StatsComponent;

/**
 * Service responsible for checking if a player meets the prerequisites
 * to start a specific quest.
 */
class QuestPrerequisiteService {

    /**
     * Checks prerequisites defined in the quest definition against the player entity.
     * @param {QuestDefinition} questDefinition - The quest definition object, containing prerequisites.
     * @param {Entity} playerEntity - The player entity instance.
     * @returns {boolean} True if all prerequisites are met or if none are defined, false otherwise.
     */
    check(questDefinition, playerEntity) {
        if (!questDefinition) {
            console.error("QuestPrerequisiteService.check: Received invalid questDefinition.");
            return false; // Cannot check prerequisites without a definition
        }
        if (!playerEntity) {
            console.error(`QuestPrerequisiteService.check: Received invalid playerEntity for quest "${questDefinition.id}".`);
            return false; // Cannot check prerequisites without a player
        }

        const prerequisites = questDefinition.prerequisites;

        // If no prerequisites are defined, the check automatically passes.
        if (!prerequisites) {
            // console.debug(`QuestPrerequisiteService.check: No prerequisites defined for quest "${questDefinition.id}". Check passes.`);
            return true;
        }

        // Normalize prerequisites into an array if it's a single object
        const conditionList = Array.isArray(prerequisites) ? prerequisites : [prerequisites];

        // If the list is empty after normalization, it also passes.
        if (conditionList.length === 0) {
            // console.debug(`QuestPrerequisiteService.check: Empty prerequisite list for quest "${questDefinition.id}". Check passes.`);
            return true;
        }

        // Retrieve necessary player components ONCE for efficiency
        const questLog = playerEntity.getComponent(QUEST_LOG_COMPONENT_KEY);
        const statsComp = playerEntity.getComponent(STATS_COMPONENT_KEY);

        // Iterate through each prerequisite condition
        for (const condition of conditionList) {
            if (!condition || typeof condition !== 'object' || !condition.type) {
                console.warn(`QuestPrerequisiteService.check: Invalid prerequisite format in quest "${questDefinition.id}":`, condition);
                continue; // Skip invalid conditions? Or should this fail the whole check? Let's fail it for safety.
                // return false; // Uncomment this line to make invalid conditions cause failure
            }

            let conditionMet = false; // Assume condition fails unless proven otherwise

            // Check based on the condition type
            switch (condition.type) {
                case 'player_level':
                    const minLevel = condition.minLevel;
                    if (typeof minLevel !== 'number' || minLevel <= 0) {
                        console.warn(`QuestPrerequisiteService.check: Invalid minLevel (${minLevel}) in player_level prereq for "${questDefinition.id}". Condition fails.`);
                        conditionMet = false;
                    } else if (!statsComp) {
                        console.warn(`QuestPrerequisiteService.check: Cannot check player_level prereq for "${questDefinition.id}" - player missing StatsComponent. Condition fails.`);
                        conditionMet = false;
                    } else {
                        const playerLevel = statsComp.level;
                        if (typeof playerLevel !== 'number') {
                            console.warn(`QuestPrerequisiteService.check: Could not determine player level from StatsComponent for "${questDefinition.id}". Assuming condition fails.`);
                            conditionMet = false;
                        } else {
                            conditionMet = playerLevel >= minLevel;
                            // console.debug(`QuestPrerequisiteService Check: Quest "${questDefinition.id}", Prereq: Level >= ${minLevel}, Player Level: ${playerLevel}. Met: ${conditionMet}`);
                        }
                    }
                    break;

                case 'quest_complete':
                    const requiredQuestId = condition.questId;
                    if (!requiredQuestId || typeof requiredQuestId !== 'string') {
                        console.warn(`QuestPrerequisiteService.check: Invalid questId in quest_complete prereq for "${questDefinition.id}":`, requiredQuestId);
                        conditionMet = false;
                    } else if (!questLog) {
                        console.warn(`QuestPrerequisiteService.check: Cannot check quest_complete prereq for "${questDefinition.id}" - player missing QuestLogComponent. Condition fails.`);
                        conditionMet = false;
                    } else {
                        conditionMet = questLog.getQuestStatus(requiredQuestId) === 'completed';
                        // console.debug(`QuestPrerequisiteService Check: Quest "${questDefinition.id}", Prereq: Quest "${requiredQuestId}" complete. Met: ${conditionMet}`);
                    }
                    break;

                // --- Add other prerequisite types here ---
                // Example:
                // case 'has_item':
                //     // Logic to check player inventory component
                //     break;
                // case 'game_state_flag':
                //     // Logic to check GameStateManager flags (might need GameStateManager passed in or accessed globally)
                //     break;

                default:
                    console.warn(`QuestPrerequisiteService.check: Unknown prerequisite type "${condition.type}" for quest "${questDefinition.id}". Assuming condition failed.`);
                    conditionMet = false;
                    break;
            }

            // If ANY condition is not met, the entire prerequisite check fails immediately.
            if (!conditionMet) {
                console.log(`QuestPrerequisiteService.check: Prerequisite type "${condition.type}" failed for quest "${questDefinition.id}". Aborting check.`);
                return false; // Early exit
            }
        }

        // If the loop completes without returning false, all conditions passed.
        console.log(`QuestPrerequisiteService.check: All prerequisites successfully met for quest "${questDefinition.id}".`);
        return true;
    }
}

// Export the service class for use elsewhere
export { QuestPrerequisiteService };
