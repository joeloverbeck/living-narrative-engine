// src/systems/gameRuleSystem.js

/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../core/worldContext.js').default} GameStateManager */
/** @typedef {import('../actions/actionExecutor.js').default} ActionExecutor */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../entities/entity.js').default} Entity */

/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */

/**
 * Manages overarching game rules, including auto-look on start/move.
 */
class GameRuleSystem {
  #eventBus;
  #gameStateManager;
  #actionExecutor;
  #entityManager;
  /**
     * @type {GameDataRepository} // <-- UPDATED Type
     */
  #repository; // <-- UPDATED Property Name

  /**
     * // *** [REFACTOR-014-SUB-11] Updated Constructor Signature ***
     * @param {object} options Container for dependencies.
     * @param {EventBus} options.eventBus
     * @param {GameStateManager} options.gameStateManager
     * @param {ActionExecutor} options.actionExecutor
     * @param {EntityManager} options.entityManager
     * @param {GameDataRepository} options.gameDataRepository - The game data repository.
     */
  constructor({eventBus, gameStateManager, actionExecutor, entityManager, gameDataRepository}) { // <-- UPDATED Parameter key
    if (!eventBus) throw new Error('GameRuleSystem requires options.eventBus.');
    if (!gameStateManager) throw new Error('GameRuleSystem requires options.gameStateManager.');
    if (!actionExecutor) throw new Error('GameRuleSystem requires options.actionExecutor.');
    if (!entityManager) throw new Error('GameRuleSystem requires options.entityManager.');
    // Updated error message to reflect new dependency
    if (!gameDataRepository) throw new Error('GameRuleSystem requires options.gameDataRepository.');

    this.#eventBus = eventBus;
    this.#gameStateManager = gameStateManager;
    this.#actionExecutor = actionExecutor;
    this.#entityManager = entityManager;
    this.#repository = gameDataRepository; // <-- UPDATED Assignment

    console.log('GameRuleSystem: Instance created.');
  }

  /**
     * Initializes the GameRuleSystem by subscribing to events needed for
     * built-in game rules (like auto-look).
     * (AC 3)
     */
  initialize() {
    console.log('GameRuleSystem: Initializing subscriptions for game rules...');

    // --- Subscribe Handlers for Built-in Rules ---
    // Handler for the *initial* game start look
    this.#eventBus.subscribe('event:room_entered', this.#handleInitialRoomEntered.bind(this));
    console.log("GameRuleSystem: Subscribed #handleInitialRoomEntered to 'event:room_entered' for initial auto-look.");

    // Handler for subsequent player moves (look after move)
    this.#eventBus.subscribe('event:entity_moved', this.#handlePlayerMovedLook.bind(this));
    console.log("GameRuleSystem: Subscribed #handlePlayerMovedLook to '" + 'event:entity_moved' + "' for post-move auto-look.");

    // Future logic like turn progression subscriptions would go here.
    // Example: this.#eventBus.subscribe('core:turn_ended', this.#handleTurnEnd.bind(this));

    console.log('GameRuleSystem: Initialization complete.');
  }

  /**
     * Handles the 'event:room_entered' event specifically for the initial game load scenario.
     * If the previousLocation is null/undefined, it triggers an automatic 'look' action.
     * (AC 1)
     * @private
     * @param {{ newLocation: Entity, playerEntity: Entity, previousLocation?: Entity | null }} eventData
     */
  async #handleInitialRoomEntered(eventData) {
    const {newLocationId, playerId, previousLocationId} = eventData;

    if (!newLocationId || !playerId) {
      console.error("GameRuleSystem #handleInitialRoomEntered: Received 'event:room_entered' but newLocation or playerEntity was missing.", eventData);
      return;
    }

    // Check if this is the initial entry (no previous location)
    if (previousLocationId === null || previousLocationId === undefined) {
      console.log("GameRuleSystem: Initial game load detected (no previousLocation). Triggering initial 'look'.");

      /** @type {ActionContext} */
      const lookContext = {
        playerEntity: this.#entityManager.getEntityInstance(playerId),
        currentLocation: this.#entityManager.getEntityInstance(newLocationId),
        parsedCommand: {
          actionId: 'action:look',
          directObjectPhrase: null,
          preposition: null,
          indirectObjectPhrase: null,
          originalInput: '[AUTO_LOOK_INITIAL]', // Indicate source
          error: null
        },
        gameDataRepository: this.#repository,
        entityManager: this.#entityManager,
        dispatch: this.#eventBus.dispatch.bind(this.#eventBus),
        eventBus: this.#eventBus
      };

      try {
        const lookResult = await this.#actionExecutor.executeAction('action:look', lookContext);
        if (!lookResult.success) {
          console.warn('GameRuleSystem: Initial \'action:look\' execution reported failure. Messages:', lookResult.messages);
        } else {
          console.log('GameRuleSystem: Initial \'action:look\' executed successfully.');
        }
      } catch (error) {
        console.error("GameRuleSystem: Uncaught error executing initial 'action:look':", error);
        this.#eventBus.dispatch('textUI:display_message', {
          text: 'Internal Error: Failed to perform initial look.', type: 'error'
        });
      }
    }
    // No 'else' needed - subsequent moves are handled by #handlePlayerMovedLook
  }

  /**
     * Handles the "event:entity_moved" event, specifically for the player.
     * Updates the game state's current location and triggers an automatic 'look'.
     * (AC 2)
     * @private
     * @param {{ entityId: string, newLocationId: string, oldLocationId: string | null }} eventData
     */
  async #handlePlayerMovedLook(eventData) {
    const {entityId, newLocationId} = eventData;
    const player = this.#gameStateManager.getPlayer();

    // Only act if the moved entity is the player
    if (!player || entityId !== player.id) {
      return;
    }

    console.log(`GameRuleSystem: Player moved to ${newLocationId}. Handling post-move auto-look.`);

    // Fetch the new location entity instance
    const newLocationEntity = this.#entityManager.getEntityInstance(newLocationId);

    if (!newLocationEntity) {
      console.error(`GameRuleSystem: Failed to find instance for location ${newLocationId}! Cannot proceed with post-move logic.`);
      this.#eventBus.dispatch('textUI:display_message', {
        text: `Critical Error: Cannot process arrival at ${newLocationId}. Location data might be missing or corrupted.`,
        type: 'error'
      });
      return;
    }

    // Update GameStateManager's current location *before* looking
    this.#gameStateManager.setCurrentLocation(newLocationEntity);
    console.log(`GameRuleSystem: Updated GameStateManager's current location to ${newLocationId}.`);

    // Trigger Automatic 'Look'
    console.log(`GameRuleSystem: Triggering automatic 'look' for player in ${newLocationId}.`);
    /** @type {ActionContext} */
    const lookContext = {
      playerEntity: player,
      currentLocation: newLocationEntity,
      parsedCommand: {
        actionId: 'action:look',
        directObjectPhrase: null,
        preposition: null,
        indirectObjectPhrase: null,
        originalInput: '[AUTO_LOOK_MOVE]', // Indicate source
        error: null
      },
      gameDataRepository: this.#repository,
      entityManager: this.#entityManager,
      dispatch: this.#eventBus.dispatch.bind(this.#eventBus),
      eventBus: this.#eventBus
    };

    try {
      const lookResult = await this.#actionExecutor.executeAction('action:look', lookContext);
      if (!lookResult.success) {
        console.warn('GameRuleSystem: Automatic \'action:look\' after move reported failure. Messages:', lookResult.messages);
      } else {
        console.log('GameRuleSystem: Automatic \'action:look\' after move executed successfully.');
      }
    } catch (error) {
      console.error("GameRuleSystem: Uncaught error executing automatic 'action:look' after move:", error);
      this.#eventBus.dispatch('textUI:display_message', {
        text: 'Internal Error: Failed to perform automatic look after moving.', type: 'error'
      });
    }
  }

  // --- Example Placeholder Methods (for potential future use) ---
  // #handleTurnEnd(eventData) {
  //    console.log("GameRuleSystem: Processing end-of-turn rules...");
  //    // Implement hunger/thirst updates, status effect ticks, etc.
  // }
  //
  // #updateWorldState() {
  //    console.log("GameRuleSystem: Updating world state (e.g., weather, time)...");
  // }
}

export default GameRuleSystem;