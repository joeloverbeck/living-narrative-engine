// src/services/questRewardService.js

/** @typedef {import('../../dataManager.js').default} DataManager */
/** @typedef {import('../../eventBus.js').default} EventBus */
/** @typedef {import('../../gameStateManager.js').default} GameStateManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../types/questTypes.js').QuestDefinition} QuestDefinition */
/** @typedef {import('../types/questTypes.js').RewardSummary} RewardSummary */
/** @typedef {import('../types/questTypes.js').RewardSummaryItem} RewardSummaryItem */

/**
 * Service responsible for granting rewards upon quest completion and providing reward summaries.
 * Decouples reward distribution logic from the main QuestSystem and UI.
 */
class QuestRewardService {
    /** @type {DataManager} */
    dataManager;
    /** @type {EventBus} */
    eventBus;
    /** @type {GameStateManager} */
    gameStateManager;

    constructor({ dataManager, eventBus, gameStateManager }) {
        if (!dataManager) throw new Error("QuestRewardService requires DataManager.");
        if (!eventBus) throw new Error("QuestRewardService requires EventBus.");
        if (!gameStateManager) throw new Error("QuestRewardService requires GameStateManager.");

        this.dataManager = dataManager;
        this.eventBus = eventBus;
        this.gameStateManager = gameStateManager;

        console.log("QuestRewardService: Instantiated.");
    }

    /**
     * Grants rewards defined in the quest definition to the player entity.
     * Handles distribution of XP, items, currency, and game state flag changes.
     * Does NOT dispatch UI messages directly.
     *
     * @param {QuestDefinition} questDefinition - The definition of the completed quest.
     * @param {Entity} playerEntity - The player entity receiving the rewards.
     */
    grant(questDefinition, playerEntity) {
        if (!questDefinition || !playerEntity || !questDefinition.rewards) {
            console.warn(`QuestRewardService.grant: Invalid arguments or no rewards for quest "${questDefinition?.id}".`);
            return;
        }

        const questId = questDefinition.id;
        console.log(`QuestRewardService: SILENTLY Granting rewards for completed quest "${questId}" to player ${playerEntity.id}...`);
        const rewards = questDefinition.rewards;

        // Experience Points (XP)
        if (typeof rewards.experience === 'number' && rewards.experience > 0) {
            // console.log(` - Granting ${rewards.experience} XP (via event)`);
            this.eventBus.dispatch('event:xp_gain_requested', { entityId: playerEntity.id, amount: rewards.experience, source: `Quest: ${questId}` });
        }

        // Items
        if (rewards.items?.length > 0) {
            rewards.items.forEach(itemReward => {
                if (itemReward?.itemId) {
                    const quantity = typeof itemReward.quantity === 'number' && itemReward.quantity > 0 ? itemReward.quantity : 1;
                    // console.log(` - Granting item ${itemReward.itemId} x ${quantity} (via event)`);
                    this.eventBus.dispatch('event:item_add_requested', { entityId: playerEntity.id, itemId: itemReward.itemId, quantity: quantity, source: `Quest: ${questId}` });
                } else {
                    console.warn(`QuestRewardService: Invalid item reward found in quest "${questId}":`, itemReward);
                }
            });
        }

        // Currency
        if (rewards.currency && typeof rewards.currency === 'object') {
            for (const currencyType in rewards.currency) {
                if (Object.hasOwnProperty.call(rewards.currency, currencyType)) {
                    const amount = rewards.currency[currencyType];
                    if (typeof amount === 'number' && amount > 0) {
                        // console.log(` - Granting ${amount} ${currencyType} (via event)`);
                        this.eventBus.dispatch('event:currency_add_requested', { entityId: playerEntity.id, currencyType: currencyType, amount: amount, source: `Quest: ${questId}` });
                    } else {
                        console.warn(`QuestRewardService: Invalid amount (${amount}) for currency type "${currencyType}" in quest "${questId}".`);
                    }
                }
            }
        }

        // Game State Changes (Flags)
        if (rewards.gameStateChanges && typeof rewards.gameStateChanges === 'object') {
            for (const flagName in rewards.gameStateChanges) {
                if (Object.hasOwnProperty.call(rewards.gameStateChanges, flagName)) {
                    const value = rewards.gameStateChanges[flagName];
                    // console.log(` - Setting game state flag "${flagName}" to ${value} (via event)`);
                    this.eventBus.dispatch('event:game_state_flag_set_requested', { flagName: flagName, value: value, source: `Quest: ${questId}` });
                }
            }
        }

        // Add other reward types as needed (e.g., reputation changes, unlocking skills)
        // if (rewards.reputationChanges) { ... }

        console.log(`QuestRewardService: Finished SILENTLY granting rewards for quest "${questId}".`);
    }

    /**
     * Reads the rewards section of a quest definition and returns a structured summary.
     * Does not grant any rewards or interact with player state.
     *
     * @param {QuestDefinition} questDefinition - The definition of the quest.
     * @returns {RewardSummary | null} A summary object or null if no rewards are defined.
     */
    getRewardSummary(questDefinition) {
        if (!questDefinition?.rewards) {
            return null; // No rewards defined
        }

        const rewards = questDefinition.rewards;
        const summary = {};

        // Experience
        if (typeof rewards.experience === 'number' && rewards.experience > 0) {
            summary.experience = rewards.experience;
        }

        // Items
        if (rewards.items?.length > 0) {
            summary.items = rewards.items
                .filter(item => item?.itemId) // Filter out invalid entries
                .map(item => ({
                    itemId: item.itemId,
                    quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1
                }));
            if (summary.items.length === 0) delete summary.items; // Clean up if all were invalid
        }

        // Currency
        if (rewards.currency && typeof rewards.currency === 'object') {
            const validCurrency = {};
            let hasCurrency = false;
            for (const type in rewards.currency) {
                if (Object.hasOwnProperty.call(rewards.currency, type)) {
                    const amount = rewards.currency[type];
                    if (typeof amount === 'number' && amount > 0) {
                        validCurrency[type] = amount;
                        hasCurrency = true;
                    }
                }
            }
            if (hasCurrency) {
                summary.currency = validCurrency;
            }
        }

        // Game State Flags (Optional inclusion in summary)
        if (rewards.gameStateChanges && typeof rewards.gameStateChanges === 'object') {
            const flags = Object.keys(rewards.gameStateChanges);
            if (flags.length > 0) {
                summary.gameStateFlagsSet = flags;
            }
        }

        // Return null if the summary object is empty after processing
        return Object.keys(summary).length > 0 ? summary : null;
    }
}

export { QuestRewardService };