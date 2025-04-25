// src/services/questRewardService.js

/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../core/gameStateManager.js').default} GameStateManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../types/questTypes.js').QuestDefinition} QuestDefinition */
/** @typedef {import('../types/questTypes.js').RewardSummary} RewardSummary */
/** @typedef {import('./validatedEventDispatcher.js').default} ValidatedEventDispatcher */ // <-- ADDED
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */ // <-- ADDED

/** @typedef {import('../types/questTypes.js').RewardSummaryItem} RewardSummaryItem */

/**
 * Service responsible for granting rewards upon quest completion and providing reward summaries.
 */
class QuestRewardService {
  /** @type {GameDataRepository} */
  #repository;
  /** @type {GameStateManager} */
  #gameStateManager;
  /** @type {ValidatedEventDispatcher} */
  #validatedDispatcher;
  /** @type {ILogger} */
  #logger;


  /**
     * @param {object} dependencies
     * @param {GameDataRepository} dependencies.gameDataRepository - The game data repository instance.
     * // @param {EventBus} dependencies.eventBus // <-- REMOVED
     * @param {GameStateManager} dependencies.gameStateManager
     * @param {ValidatedEventDispatcher} dependencies.validatedDispatcher
     * @param {ILogger} dependencies.logger
     */
  constructor({gameDataRepository, gameStateManager, validatedDispatcher, logger}) { // <-- UPDATED signature
    // Updated error message to reflect new dependency
    if (!gameDataRepository) throw new Error('QuestRewardService requires GameDataRepository.');
    if (!gameStateManager) throw new Error('QuestRewardService requires GameStateManager.');
    if (!validatedDispatcher) throw new Error('QuestRewardService requires ValidatedEventDispatcher.');
    if (!logger) throw new Error('QuestRewardService requires ILogger.');

    this.#repository = gameDataRepository;
    // this.#eventBus = eventBus;
    this.#gameStateManager = gameStateManager;
    this.#validatedDispatcher = validatedDispatcher;
    this.#logger = logger;

    this.#logger.info('QuestRewardService: Instantiated.'); // <-- UPDATED to use logger
  }

  /**
     * Grants rewards defined in the quest definition to the player entity by dispatching
     * validated events.
     * Handles distribution of XP, items, currency, and game state flag changes.
     * Does NOT dispatch UI messages directly. Dispatch is asynchronous due to validation.
     *
     * @param {QuestDefinition} questDefinition - The definition of the completed quest.
     * @param {Entity} playerEntity - The player entity receiving the rewards.
     * @returns {Promise<void>} A promise that resolves when all dispatch attempts are complete.
     */
  async grant(questDefinition, playerEntity) { // <-- ADDED async
    if (!questDefinition || !playerEntity || !questDefinition.rewards) {
      // Use logger for warning
      this.#logger.warn(`QuestRewardService.grant: Invalid arguments or no rewards for quest "${questDefinition?.id}". Granting process skipped.`);
      return;
    }

    const questId = questDefinition.id;
    // Use logger for info
    this.#logger.info(`QuestRewardService: Granting rewards for completed quest "${questId}" to player ${playerEntity.id}...`);
    const rewards = questDefinition.rewards;
    const source = `Quest: ${questId}`; // Common source string

    // Array to hold dispatch promises (optional, if you need to wait for all)
    const dispatchPromises = [];

    // Experience Points (XP)
    if (typeof rewards.experience === 'number' && rewards.experience > 0) {
      const payload = {
        entityId: playerEntity.id,
        amount: rewards.experience,
        source: source // Use common source
      };
      this.#logger.debug(' - Preparing dispatch: event:xp_gain_requested', payload);
      // Replace direct dispatch with validated dispatch
      dispatchPromises.push(
        this.#validatedDispatcher.dispatchValidated('event:xp_gain_requested', payload)
          .catch(err => this.#logger.error(`Error during dispatchValidated for xp_gain_requested: ${err.message}`, err)) // Catch potential errors in dispatch itself
      );
    }

    // Items
    if (rewards.items?.length > 0) {
      rewards.items.forEach(itemReward => {
        if (itemReward?.itemId) {
          const quantity = typeof itemReward.quantity === 'number' && itemReward.quantity > 0 ? itemReward.quantity : 1;
          const payload = {
            entityId: playerEntity.id,
            itemId: itemReward.itemId,
            quantity: quantity,
            source: source // Use common source
          };
          this.#logger.debug(' - Preparing dispatch: event:item_add_requested', payload);
          // Replace direct dispatch with validated dispatch
          dispatchPromises.push(
            this.#validatedDispatcher.dispatchValidated('event:item_add_requested', payload)
              .catch(err => this.#logger.error(`Error during dispatchValidated for item_add_requested: ${err.message}`, err))
          );
        } else {
          // Use logger for warning
          this.#logger.warn(`QuestRewardService: Invalid item reward found in quest "${questId}":`, itemReward);
        }
      });
    }

    // Currency
    if (rewards.currency && typeof rewards.currency === 'object') {
      for (const currencyType in rewards.currency) {
        if (Object.hasOwnProperty.call(rewards.currency, currencyType)) {
          const amount = rewards.currency[currencyType];
          if (typeof amount === 'number' && amount > 0) {
            const payload = {
              entityId: playerEntity.id,
              currencyType: currencyType,
              amount: amount,
              source: source // Use common source
            };
            this.#logger.debug(' - Preparing dispatch: event:currency_add_requested', payload);
            // Replace direct dispatch with validated dispatch
            dispatchPromises.push(
              this.#validatedDispatcher.dispatchValidated('event:currency_add_requested', payload)
                .catch(err => this.#logger.error(`Error during dispatchValidated for currency_add_requested: ${err.message}`, err))
            );
          } else {
            // Use logger for warning
            this.#logger.warn(`QuestRewardService: Invalid amount (${amount}) for currency type "${currencyType}" in quest "${questId}".`);
          }
        }
      }
    }

    // Game State Changes (Flags)
    if (rewards.gameStateChanges && typeof rewards.gameStateChanges === 'object') {
      for (const flagName in rewards.gameStateChanges) {
        if (Object.hasOwnProperty.call(rewards.gameStateChanges, flagName)) {
          const value = rewards.gameStateChanges[flagName];
          // Basic check for potentially problematic types (functions, undefined) before dispatching
          if (typeof value !== 'function' && typeof value !== 'undefined') {
            const payload = {
              flagName: flagName,
              value: value,
              source: source // Use common source
            };
            this.#logger.debug(' - Preparing dispatch: event:game_state_flag_set_requested', payload);
            // Replace direct dispatch with validated dispatch
            dispatchPromises.push(
              this.#validatedDispatcher.dispatchValidated('event:game_state_flag_set_requested', payload)
                .catch(err => this.#logger.error(`Error during dispatchValidated for game_state_flag_set_requested: ${err.message}`, err))
            );
          } else {
            this.#logger.warn(`QuestRewardService: Invalid value type (${typeof value}) for game state flag "${flagName}" in quest "${questId}". Skipping dispatch.`);
          }
        }
      }
    }

    // Add other reward types as needed (e.g., reputation changes, unlocking skills)
    // if (rewards.reputationChanges) { ... }

    // Wait for all dispatches to attempt (optional, useful for sequencing or logging completion)
    await Promise.all(dispatchPromises);

    // Use logger for info
    this.#logger.info(`QuestRewardService: Finished processing reward grants for quest "${questId}". Validation and dispatch handled by ValidatedEventDispatcher.`);
  }

  /**
     * Reads the rewards section of a quest definition and returns a structured summary.
     * Does not grant any rewards or interact with player state.
     * (This method remains unchanged as it doesn't dispatch events)
     *
     * @param {QuestDefinition} questDefinition - The definition of the quest.
     * @returns {RewardSummary | null} A summary object or null if no rewards are defined.
     */
  getRewardSummary(questDefinition) {
    if (!questDefinition?.rewards) {
      return null; // No rewards defined
    }

    const rewards = questDefinition.rewards;
    /** @type {RewardSummary} */
    const summary = {}; // Initialize as RewardSummary type

    // Experience
    if (typeof rewards.experience === 'number' && rewards.experience > 0) {
      summary.experience = rewards.experience;
    }

    // Items
    if (rewards.items?.length > 0) {
      const validItems = rewards.items
        .filter(item => item?.itemId && typeof item.itemId === 'string') // Filter out invalid entries more strictly
        .map(item => ({
          itemId: item.itemId,
          quantity: typeof item.quantity === 'number' && item.quantity > 0 ? item.quantity : 1
        }));
      if (validItems.length > 0) {
        summary.items = validItems;
      }
    }


    // Currency
    if (rewards.currency && typeof rewards.currency === 'object') {
      const validCurrency = {};
      let hasCurrency = false;
      for (const type in rewards.currency) {
        // Ensure it's a direct property and type is a non-empty string
        if (Object.hasOwnProperty.call(rewards.currency, type) && typeof type === 'string' && type.length > 0) {
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
    // Ensure gameStateChanges is an object before processing
    if (rewards.gameStateChanges && typeof rewards.gameStateChanges === 'object') {
      const flags = Object.keys(rewards.gameStateChanges)
        .filter(flagName => typeof flagName === 'string' && flagName.length > 0); // Ensure flag names are valid strings
      if (flags.length > 0) {
        summary.gameStateFlagsSet = flags;
      }
    }


    // Return null if the summary object is empty after processing
    return Object.keys(summary).length > 0 ? summary : null;
  }
}

export {QuestRewardService};