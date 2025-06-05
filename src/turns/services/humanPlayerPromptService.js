// src/turns/services/playerPromptService.js
// --- FILE START ---

// --- Interface/Type Imports for JSDoc ---
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/./IActionDiscoveryService.js').IActionDiscoveryService} IActionDiscoverySystem */
/**
 * @typedef {object} DiscoveredActionInfo
 * @property {string} id - The unique ID of the action.
 * @property {string} name - The human-readable name of the action.
 * @property {string} command - The command string for the action.
 * @property {string} [description] - Optional. The detailed description of the action.
 */
/** @typedef {import('../ports/IPromptOutputPort.js').IPromptOutputPort} IPromptOutputPort */
/** @typedef {import('../../interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../../interfaces/IValidatedEventDispatcher.js').IValidatedEventDispatcher} IValidatedEventDispatcher */

// --- Import Custom Error ---
import { PromptError } from '../../errors/promptError.js';
import { IHumanPlayerPromptService } from '../interfaces/IHumanPlayerPromptService.js';
import { PLAYER_TURN_SUBMITTED_ID } from '../../constants/eventIds.js';

/**
 * @typedef {object} PlayerPromptServiceDependencies
 * @property {ILogger} logger - The logging service.
 * @property {IActionDiscoverySystem} actionDiscoverySystem - Service to discover available actions.
 * @property {IPromptOutputPort} promptOutputPort - Port for sending prompts to the player.
 * @property {IWorldContext} worldContext - Service to access current world state (like entity locations).
 * @property {IEntityManager} entityManager - Service to manage entity instances.
 * @property {IGameDataRepository} gameDataRepository - Service to access game definition data.
 * @property {IValidatedEventDispatcher} validatedEventDispatcher - Dispatcher for subscribing to validated events.
 */

/**
 * Represents the object resolved by the prompt() method's promise.
 *
 * @typedef {object} PlayerPromptResolution
 * @property {DiscoveredActionInfo} action - The selected available action object.
 * @property {string | null} speech - The speech input from the player, or null.
 */

/**
 * @typedef {object} CorePlayerTurnSubmittedEvent
 * @property {string} type - The event type, e.g., PLAYER_TURN_SUBMITTED_ID.
 * @property {CorePlayerTurnSubmittedEventPayload} payload - The nested payload of the event.
 */

/**
 * @typedef {object} CorePlayerTurnSubmittedEventPayload
 * @property {string} [submittedByActorId] - Optional, but recommended. The ID of the actor who submitted.
 * @property {string} actionId - The ID of the action submitted by the player.
 * @property {string|null} speech - The speech associated with the action.
 */

/**
 * @typedef {object} CurrentPromptContext
 * @property {string} actorId - The ID of the actor being prompted.
 * @property {Function} resolve - The resolve function of the current prompt's promise.
 * @property {Function} reject - The reject function of the current prompt's promise.
 * @property {(() => void) | null} unsubscribe - The unsubscribe function for the event listener.
 * @property {DiscoveredActionInfo[]} discoveredActions - The actions discovered for the current prompt.
 * @property {AbortSignal | undefined} [cancellationSignal] - The AbortSignal for this prompt.
 * @property {(() => void) | null} [abortListenerCleanup] - Function to remove the abort listener.
 * @property {boolean} isResolvedOrRejected - Flag to track if the promise has been settled.
 */

/**
 * @class HumanPlayerPromptService
 * @augments IHumanPlayerPromptService
 * @description Service responsible for prompting the player for actions and awaiting their response asynchronously.
 * Implements the IPlayerPromptService interface. Ensures only one prompt is active globally at any time.
 */
class HumanPlayerPromptService extends IHumanPlayerPromptService {
  /** @type {ILogger} */
  #logger;
  /** @type {IActionDiscoverySystem} */
  #actionDiscoverySystem;
  /** @type {IPromptOutputPort} */
  #promptOutputPort;
  /** @type {IWorldContext} */
  #worldContext;
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {IGameDataRepository} */
  #gameDataRepository;
  /** @type {IValidatedEventDispatcher} */
  #validatedEventDispatcher;

  /**
   * @private
   * @type {CurrentPromptContext | null}
   */
  #currentPromptContext = null;

  /**
   * @private
   * Validates a constructor dependency, checking for its presence and required methods.
   * Uses console.error for logging as this runs before the class logger is fully confirmed.
   * @param {any} dependency - The dependency instance to validate.
   * @param {string} dependencyName - The name of the dependency (e.g., "ILogger", "IActionDiscoverySystem") for error messages.
   * @param {string[]} [requiredMethods] - An array of method names that must exist on the dependency.
   * @throws {Error} If the dependency is null/undefined or a required method is missing.
   */
  _validateDependency(dependency, dependencyName, requiredMethods = []) {
    if (!dependency) {
      console.error(
        `PlayerPromptService Constructor: Missing ${dependencyName} dependency.`
      );
      throw new Error(
        `PlayerPromptService: Missing ${dependencyName} dependency.`
      );
    }
    for (const methodName of requiredMethods) {
      if (typeof dependency[methodName] !== 'function') {
        console.error(
          `PlayerPromptService Constructor: Invalid ${dependencyName} dependency. Missing method: ${methodName}(). Provided:`,
          dependency
        );
        throw new Error(
          `PlayerPromptService: Invalid ${dependencyName} dependency. Missing method: ${methodName}().`
        );
      }
    }
  }

  /**
   * Constructor for PlayerPromptService.
   *
   * @param {PlayerPromptServiceDependencies} dependencies - The dependencies for the service.
   */
  constructor({
    logger,
    actionDiscoverySystem,
    promptOutputPort,
    worldContext,
    entityManager,
    gameDataRepository,
    validatedEventDispatcher,
  }) {
    super();

    this._validateDependency(logger, 'ILogger', [
      'error',
      'info',
      'debug',
      'warn',
    ]);
    this.#logger = logger;

    this._validateDependency(actionDiscoverySystem, 'IActionDiscoverySystem', [
      'getValidActions',
    ]);
    this.#actionDiscoverySystem = actionDiscoverySystem;

    this._validateDependency(promptOutputPort, 'IPromptOutputPort', ['prompt']);
    this.#promptOutputPort = promptOutputPort;

    this._validateDependency(worldContext, 'IWorldContext', [
      'getLocationOfEntity',
    ]);
    this.#worldContext = worldContext;

    this._validateDependency(entityManager, 'IEntityManager', [
      'getEntityInstance',
    ]);
    this.#entityManager = entityManager;

    this._validateDependency(gameDataRepository, 'IGameDataRepository', [
      'getActionDefinition',
    ]);
    this.#gameDataRepository = gameDataRepository;

    this._validateDependency(
      validatedEventDispatcher,
      'IValidatedEventDispatcher',
      ['subscribe', 'unsubscribe']
    );
    this.#validatedEventDispatcher = validatedEventDispatcher;

    this.#logger.info('PlayerPromptService initialized successfully.');
  }

  /**
   * @private
   * Clears the currently active prompt by rejecting its promise.
   * The rejection handler of the prompt context is responsible for actual resource cleanup.
   * @param {PromptError | DOMException | null} [rejectionError] - The error to reject the current prompt's promise with.
   * If null, a default "superseded/cancelled" error is used.
   */
  #clearCurrentPrompt(rejectionError = null) {
    if (!this.#currentPromptContext) {
      this.#logger.debug(
        'PlayerPromptService.#clearCurrentPrompt: No active prompt to clear.'
      );
      return;
    }

    const contextToClear = this.#currentPromptContext; // Hold reference

    if (contextToClear.isResolvedOrRejected) {
      this.#logger.debug(
        `PlayerPromptService.#clearCurrentPrompt: Prompt for actor ${contextToClear.actorId} already settled. Ensuring global context matches.`
      );
      // If the global context somehow still points to this already-settled context,
      // nullify it. The original settlement should have done this, but this is a safeguard.
      if (this.#currentPromptContext === contextToClear) {
        this.#currentPromptContext = null;
      }
      return;
    }

    const oldActorId = contextToClear.actorId;
    this.#logger.warn(
      `PlayerPromptService.#clearCurrentPrompt: Actively clearing prompt for actor ${oldActorId}.`
    );

    let errorToRejectWith;
    if (rejectionError) {
      errorToRejectWith = rejectionError;
    } else if (contextToClear.cancellationSignal?.aborted) {
      // This case implies the AbortSignal's own listener might not have fired yet,
      // or #clearCurrentPrompt is called concurrently.
      this.#logger.warn(
        `PlayerPromptService.#clearCurrentPrompt: Prompt for ${oldActorId} was aborted by its signal.`
      );
      errorToRejectWith = new DOMException(
        'Prompt aborted by signal, then cleared.',
        'AbortError'
      );
    } else {
      this.#logger.warn(
        `PlayerPromptService.#clearCurrentPrompt: Prompt for ${oldActorId} superseded or cancelled without explicit error/signal.`
      );
      errorToRejectWith = new PromptError(
        `Prompt for actor ${oldActorId} was superseded or cancelled by system.`,
        null,
        'PROMPT_SYSTEM_CLEARED'
      );
    }

    // Call the context's own reject method. This will set its 'isResolvedOrRejected' flag,
    // call _performPromptResourceCleanup, and nullify 'this.#currentPromptContext' if it matches.
    contextToClear.reject(errorToRejectWith);
  }

  /**
   * @private
   * Performs resource cleanup for a given prompt context (event unsubscribe, abort listener removal).
   * This method is called when a prompt is settled (resolved, rejected, or cancelled).
   * @param {CurrentPromptContext} promptContext - The prompt context whose resources need cleaning.
   */
  _performPromptResourceCleanup(promptContext) {
    if (!promptContext) {
      this.#logger.warn(
        'PlayerPromptService._performPromptResourceCleanup: Called with null or undefined promptContext. Aborting cleanup.'
      );
      return;
    }

    if (typeof promptContext.unsubscribe === 'function') {
      try {
        this.#logger.debug(
          `PlayerPromptService._performPromptResourceCleanup: Unsubscribing event listener for prompt (actor ${promptContext.actorId}).`
        );
        promptContext.unsubscribe();
        this.#logger.debug(
          `PlayerPromptService._performPromptResourceCleanup: Successfully unsubscribed event listener for prompt (actor ${promptContext.actorId}).`
        );
      } catch (unsubError) {
        this.#logger.error(
          `PlayerPromptService._performPromptResourceCleanup: Error unsubscribing event listener for prompt (actor ${promptContext.actorId}).`,
          unsubError
        );
      }
      promptContext.unsubscribe = null;
    } else if (promptContext.unsubscribe !== null) {
      this.#logger.debug(
        `PlayerPromptService._performPromptResourceCleanup: No unsubscribe function to call for prompt (actor ${promptContext.actorId}). 'unsubscribe' is not a function or already null.`
      );
    }

    if (typeof promptContext.abortListenerCleanup === 'function') {
      try {
        this.#logger.debug(
          `PlayerPromptService._performPromptResourceCleanup: Cleaning up abort listener for prompt (actor ${promptContext.actorId}).`
        );
        promptContext.abortListenerCleanup();
        this.#logger.debug(
          `PlayerPromptService._performPromptResourceCleanup: Successfully cleaned up abort listener for prompt (actor ${promptContext.actorId}).`
        );
      } catch (cleanupError) {
        this.#logger.error(
          `PlayerPromptService._performPromptResourceCleanup: Error cleaning up abort listener for prompt (actor ${promptContext.actorId}).`,
          cleanupError
        );
      }
      promptContext.abortListenerCleanup = null;
    } else if (promptContext.abortListenerCleanup !== null) {
      this.#logger.debug(
        `PlayerPromptService._performPromptResourceCleanup: No abortListenerCleanup function to call for prompt (actor ${promptContext.actorId}). 'abortListenerCleanup' is not a function or already null.`
      );
    }
  }

  /**
   * @param actor
   * @param cancellationSignal
   * @private
   * Validates the actor, checks for initial cancellation, and clears any existing prompt.
   */
  async _preparePromptSession(actor, cancellationSignal) {
    if (cancellationSignal?.aborted) {
      this.#logger.warn(
        `PlayerPromptService._preparePromptSession: Prompt initiation for actor ${actor?.id || 'UNKNOWN'} aborted as signal was already aborted.`
      );
      throw new DOMException(
        'Prompt aborted by signal before initiation.',
        'AbortError'
      );
    }

    if (!actor || typeof actor.id !== 'string' || actor.id.trim() === '') {
      const errorMsg = `Invalid actor provided to PlayerPromptService.prompt: ${JSON.stringify(actor)}`;
      this.#logger.error(
        'PlayerPromptService._preparePromptSession: Invalid actor provided.',
        { actor }
      );
      throw new PromptError(errorMsg, null, 'INVALID_ACTOR');
    }
    const actorId = actor.id;

    if (this.#currentPromptContext) {
      const oldPromptActorId = this.#currentPromptContext.actorId;
      this.#logger.warn(
        `PlayerPromptService._preparePromptSession: New prompt for ${actorId} is superseding an existing prompt for ${oldPromptActorId}.`
      );

      let rejectionMsg = `New prompt initiated for actor ${actorId}, superseding previous prompt for ${oldPromptActorId}.`;
      if (actorId === oldPromptActorId) {
        rejectionMsg = `New prompt re-initiated for actor ${actorId}, superseding existing prompt.`;
      }
      this.#clearCurrentPrompt(
        new PromptError(rejectionMsg, null, 'PROMPT_SUPERSEDED_BY_NEW_REQUEST')
      );
    }
    return actorId;
  }

  /**
   * @param actor
   * @param actorId
   * @param cancellationSignal
   * @private
   * Fetches the actor's current location, creates the ActionContext, and discovers valid actions.
   */
  async _fetchContextAndDiscoverActions(actor, actorId, cancellationSignal) {
    let currentLocation;
    try {
      this.#logger.debug(
        `PlayerPromptService._fetchContextAndDiscoverActions: Fetching location for actor ${actorId}...`
      );
      currentLocation = await this.#worldContext.getLocationOfEntity(actorId);
      if (!currentLocation) {
        this.#logger.error(
          `PlayerPromptService._fetchContextAndDiscoverActions: Failed to get location for actor ${actorId}. Location not found or undefined.`
        );
        throw new PromptError(
          `Failed to determine actor location for ${actorId}: Location not found or undefined.`,
          null,
          'LOCATION_NOT_FOUND'
        );
      }
      this.#logger.debug(
        `PlayerPromptService._fetchContextAndDiscoverActions: Found location ${currentLocation.id} for actor ${actorId}.`
      );
    } catch (error) {
      this.#logger.error(
        `PlayerPromptService._fetchContextAndDiscoverActions: Error fetching location for actor ${actorId}.`,
        error
      );
      if (error instanceof PromptError || error.name === 'AbortError')
        throw error;
      throw new PromptError(
        `Failed to determine actor location for ${actorId}. Details: ${error.message}`,
        error,
        'LOCATION_FETCH_FAILED'
      );
    }

    if (cancellationSignal?.aborted) {
      this.#logger.warn(
        `PlayerPromptService._fetchContextAndDiscoverActions: Aborted by signal after location fetch for actor ${actorId}.`
      );
      throw new DOMException(
        'Prompt aborted by signal during location fetch.',
        'AbortError'
      );
    }

    const actionContext = {
      actor: actor,
      currentLocation: currentLocation,
      entityManager: this.#entityManager,
      gameDataRepository: this.#gameDataRepository,
      logger: this.#logger,
      worldContext: this.#worldContext,
    };
    this.#logger.debug(
      `PlayerPromptService._fetchContextAndDiscoverActions: Created ActionContext for actor ${actorId}.`
    );

    let discoveredActions;
    try {
      this.#logger.debug(
        `PlayerPromptService._fetchContextAndDiscoverActions: Discovering valid actions for actor ${actorId}...`
      );
      discoveredActions = await this.#actionDiscoverySystem.getValidActions(
        actor,
        actionContext
      );
      this.#logger.debug(
        `PlayerPromptService._fetchContextAndDiscoverActions: Discovered ${discoveredActions.length} actions for actor ${actorId}.`
      );
    } catch (error) {
      this.#logger.error(
        `PlayerPromptService._fetchContextAndDiscoverActions: Action discovery failed for actor ${actorId}.`,
        error
      );
      if (error instanceof PromptError || error.name === 'AbortError')
        throw error;
      throw new PromptError(
        `Action discovery failed for actor ${actorId}. Details: ${error.message}`,
        error,
        'ACTION_DISCOVERY_FAILED'
      );
    }

    if (cancellationSignal?.aborted) {
      this.#logger.warn(
        `PlayerPromptService._fetchContextAndDiscoverActions: Aborted by signal after action discovery for actor ${actorId}.`
      );
      throw new DOMException(
        'Prompt aborted by signal after action discovery.',
        'AbortError'
      );
    }

    return { currentLocation, discoveredActions, actionContext };
  }

  /**
   * @param actorId
   * @param discoveredActions
   * @param cancellationSignal
   * @param errorToShow
   * @private
   * Sends the prompt data (discovered actions or an error message) to the player via the output port.
   */
  async _dispatchPromptToOutputPort(
    actorId,
    discoveredActions,
    cancellationSignal,
    errorToShow = null
  ) {
    try {
      if (errorToShow) {
        const errorMessage =
          errorToShow instanceof Error
            ? errorToShow.message
            : String(errorToShow);
        this.#logger.debug(
          `PlayerPromptService._dispatchPromptToOutputPort: Sending error prompt for actor ${actorId}. Error: "${errorMessage}"`
        );
        await this.#promptOutputPort.prompt(actorId, [], errorMessage);
      } else {
        this.#logger.debug(
          `PlayerPromptService._dispatchPromptToOutputPort: Sending ${discoveredActions?.length || 0} discovered actions to actor ${actorId} via output port...`
        );
        await this.#promptOutputPort.prompt(actorId, discoveredActions || []);
      }
      this.#logger.info(
        `PlayerPromptService._dispatchPromptToOutputPort: Successfully sent prompt data for actor ${actorId} via output port.`
      );
    } catch (error) {
      this.#logger.error(
        `PlayerPromptService._dispatchPromptToOutputPort: Failed to dispatch prompt via output port for actor ${actorId}.`,
        error
      );
      if (error instanceof PromptError || error.name === 'AbortError')
        throw error;
      throw new PromptError(
        `Failed to dispatch prompt via output port for actor ${actorId}. Details: ${error.message}`,
        error,
        'OUTPUT_PORT_DISPATCH_FAILED'
      );
    }

    if (cancellationSignal?.aborted) {
      this.#logger.warn(
        `PlayerPromptService._dispatchPromptToOutputPort: Aborted by signal after attempting to send prompt for actor ${actorId}.`
      );
      throw new DOMException(
        'Prompt dispatch aborted by signal after send attempt.',
        'AbortError'
      );
    }
  }

  /**
   * @param eventObject
   * @param localPromptContext
   * @param resolve
   * @param reject
   * @private
   * Handles the PLAYER_TURN_SUBMITTED_ID event.
   */
  _handlePlayerTurnSubmittedEvent(
    eventObject,
    localPromptContext,
    resolve,
    reject
  ) {
    if (
      this.#currentPromptContext !== null &&
      this.#currentPromptContext !== localPromptContext
    ) {
      this.#logger.warn(
        `PlayerPromptService._handlePlayerTurnSubmittedEvent: Stale listener for actor ${localPromptContext.actorId} (event ${eventObject?.type}) received ${PLAYER_TURN_SUBMITTED_ID}, but current global prompt is for ${this.#currentPromptContext?.actorId}. This specific prompt instance will ignore.`
      );
      return;
    }
    if (localPromptContext.isResolvedOrRejected) {
      this.#logger.debug(
        `PlayerPromptService._handlePlayerTurnSubmittedEvent: Listener for ${localPromptContext.actorId} (event ${eventObject?.type}) received event but prompt already settled. Ignoring.`
      );
      return;
    }

    if (
      eventObject &&
      eventObject.payload &&
      typeof eventObject.payload.submittedByActorId === 'string'
    ) {
      const submittedByActorId = eventObject.payload.submittedByActorId;
      if (submittedByActorId !== localPromptContext.actorId) {
        this.#logger.debug(
          `PlayerPromptService._handlePlayerTurnSubmittedEvent: Received ${PLAYER_TURN_SUBMITTED_ID} for actor ${submittedByActorId}, but this prompt is for ${localPromptContext.actorId}. Ignoring.`
        );
        return;
      }
    } else {
      this.#logger.debug(
        `PlayerPromptService._handlePlayerTurnSubmittedEvent: ${PLAYER_TURN_SUBMITTED_ID} event did not contain 'submittedByActorId'. Proceeding based on this prompt's actor: ${localPromptContext.actorId}.`
      );
    }

    this.#logger.debug(
      `PlayerPromptService._handlePlayerTurnSubmittedEvent: Active listener for actor ${localPromptContext.actorId} received ${PLAYER_TURN_SUBMITTED_ID}. Full Event:`,
      eventObject
    );

    if (
      !eventObject ||
      eventObject.type !== PLAYER_TURN_SUBMITTED_ID ||
      !eventObject.payload ||
      typeof eventObject.payload !== 'object'
    ) {
      this.#logger.error(
        `PlayerPromptService._handlePlayerTurnSubmittedEvent: Invalid event object structure for prompt (actor ${localPromptContext.actorId}). Received:`,
        eventObject
      );
      reject(
        new PromptError(
          `Malformed event object for ${PLAYER_TURN_SUBMITTED_ID} for actor ${localPromptContext.actorId}.`,
          null,
          'INVALID_EVENT_STRUCTURE'
        )
      );
      return;
    }

    const actualPayload = eventObject.payload;

    if (
      typeof actualPayload.actionId !== 'string' ||
      actualPayload.actionId.trim() === ''
    ) {
      this.#logger.error(
        `PlayerPromptService._handlePlayerTurnSubmittedEvent: Invalid or missing actionId in payload for prompt (actor ${localPromptContext.actorId}). Payload:`,
        actualPayload
      );
      reject(
        new PromptError(
          `Invalid actionId in payload for ${PLAYER_TURN_SUBMITTED_ID} for actor ${localPromptContext.actorId}.`,
          null,
          'INVALID_PAYLOAD_CONTENT'
        )
      );
      return;
    }

    const { actionId: submittedActionId, speech } = actualPayload;
    const actionsForThisPrompt = localPromptContext.discoveredActions;

    const selectedAction = actionsForThisPrompt.find((da) => {
      if (!da || typeof da.id !== 'string') {
        this.#logger.warn(
          `PlayerPromptService._handlePlayerTurnSubmittedEvent: Malformed item in discoveredActions for prompt (actor ${localPromptContext.actorId}). Item:`,
          da
        );
        return false;
      }
      return da.id === submittedActionId;
    });

    if (!selectedAction) {
      this.#logger.error(
        `PlayerPromptService._handlePlayerTurnSubmittedEvent: Invalid actionId '${submittedActionId}' for prompt (actor ${localPromptContext.actorId}). Not found.`,
        {
          discoveredActionsPreview: actionsForThisPrompt.map((item) =>
            item
              ? {
                  id: item.id,
                  name: item.name,
                  command: item.command,
                }
              : { error: 'Null/undefined item' }
          ),
          receivedActionId: submittedActionId,
        }
      );
      reject(
        new PromptError(
          `Invalid actionId '${submittedActionId}' submitted by actor ${localPromptContext.actorId}. Action not available.`,
          null,
          'INVALID_ACTION_ID'
        )
      );
    } else {
      if (
        typeof selectedAction.name !== 'string' ||
        selectedAction.name.trim() === ''
      ) {
        this.#logger.warn(
          `PlayerPromptService._handlePlayerTurnSubmittedEvent: Action '${submittedActionId}' found for prompt (actor ${localPromptContext.actorId}), but missing 'name'. Action:`,
          selectedAction
        );
      }
      this.#logger.info(
        `PlayerPromptService._handlePlayerTurnSubmittedEvent: Valid actionId '${submittedActionId}' (Name: '${selectedAction.name || 'N/A'}') for prompt (actor ${localPromptContext.actorId}). Resolving.`
      );
      resolve({ action: selectedAction, speech: speech || null });
    }
  }

  /**
   * Prompts the specified actor for an action.
   *
   * @param actor
   * @param root0
   * @param root0.cancellationSignal
   */
  async prompt(actor, { cancellationSignal } = {}) {
    this.#logger.debug(
      `PlayerPromptService.prompt: Initiating prompt for actor ${actor?.id ?? 'INVALID'}. Signal provided: ${!!cancellationSignal}`
    );

    let actorId;
    let discoveredActions;

    try {
      actorId = await this._preparePromptSession(actor, cancellationSignal);
      this.#logger.debug(
        `PlayerPromptService.prompt: Session prepared for actor ${actorId}.`
      );

      const contextAndActions = await this._fetchContextAndDiscoverActions(
        actor,
        actorId,
        cancellationSignal
      );
      discoveredActions = contextAndActions.discoveredActions;
      this.#logger.debug(
        `PlayerPromptService.prompt: Context fetched and ${discoveredActions.length} actions discovered for actor ${actorId}.`
      );

      await this._dispatchPromptToOutputPort(
        actorId,
        discoveredActions,
        cancellationSignal,
        null
      );
      this.#logger.debug(
        `PlayerPromptService.prompt: Prompt dispatched to output port for actor ${actorId}.`
      );
    } catch (error) {
      this.#logger.error(
        `PlayerPromptService.prompt: Error during prompt setup for actor ${actor?.id ?? (actorId || 'UNKNOWN')}.`,
        error
      );
      if (
        error instanceof PromptError &&
        error.code === 'ACTION_DISCOVERY_FAILED'
      ) {
        const idForError = actorId || actor?.id || 'UNKNOWN_ACTOR';
        try {
          this.#logger.warn(
            `PlayerPromptService.prompt: Attempting to send action discovery failure to output port for actor ${idForError}.`
          );
          await this._dispatchPromptToOutputPort(
            idForError,
            null,
            cancellationSignal,
            error
          );
        } catch (dispatchError) {
          this.#logger.error(
            `PlayerPromptService.prompt: Failed to dispatch action discovery error to output port for actor ${idForError}. Initial error: ${error.message}`,
            dispatchError
          );
        }
      }
      throw error;
    }

    return new Promise((originalPromiseResolve, originalPromiseReject) => {
      const localPromptContext = {
        actorId: actorId,
        resolve: (value) => {
          if (localPromptContext.isResolvedOrRejected) {
            this.#logger.debug(
              `PlayerPromptService: Attempted to resolve already settled prompt for actor ${localPromptContext.actorId}. Ignoring.`
            );
            return;
          }
          localPromptContext.isResolvedOrRejected = true;
          this.#logger.debug(
            `PlayerPromptService: Resolving prompt for actor ${localPromptContext.actorId}.`
          );

          this._performPromptResourceCleanup(localPromptContext);

          if (this.#currentPromptContext === localPromptContext) {
            this.#currentPromptContext = null;
            this.#logger.debug(
              `PlayerPromptService: Cleared current prompt context for actor ${localPromptContext.actorId} on resolve.`
            );
          }
          originalPromiseResolve(value);
        },
        reject: (err) => {
          if (localPromptContext.isResolvedOrRejected) {
            this.#logger.debug(
              `PlayerPromptService: Attempted to reject already settled prompt for actor ${localPromptContext.actorId}. Error: ${err?.message}. Ignoring subsequent rejection.`
            );
            return;
          }
          localPromptContext.isResolvedOrRejected = true;

          // ── CHANGED LOGGING BEHAVIOUR ──────────────────────────────────────
          if (err instanceof DOMException && err.name === 'AbortError') {
            this.#logger.info(
              `PlayerPromptService: Prompt for actor ${localPromptContext.actorId} aborted. ${err.message}`
            );
          } else {
            this.#logger.warn(
              `PlayerPromptService: Rejecting prompt for actor ${localPromptContext.actorId}. Error: ${err?.message}`
            );
          }
          // ───────────────────────────────────────────────────────────────────

          this._performPromptResourceCleanup(localPromptContext);

          if (this.#currentPromptContext === localPromptContext) {
            this.#currentPromptContext = null;
            this.#logger.debug(
              `PlayerPromptService: Cleared current prompt context for actor ${localPromptContext.actorId} on reject.`
            );
          }
          originalPromiseReject(err);
        },
        unsubscribe: null,
        discoveredActions: discoveredActions,
        cancellationSignal: cancellationSignal,
        abortListenerCleanup: null,
        isResolvedOrRejected: false,
      };

      this.#currentPromptContext = localPromptContext;
      this.#logger.debug(
        `PlayerPromptService.prompt: Current prompt context set globally for actor ${actorId}.`
      );

      if (cancellationSignal) {
        const handleAbort = () => {
          this.#logger.info(
            `PlayerPromptService.prompt: Abort signal received for actor ${localPromptContext.actorId}. Rejecting prompt.`
          );
          localPromptContext.reject(
            new DOMException('Prompt aborted by signal.', 'AbortError')
          );
        };
        cancellationSignal.addEventListener('abort', handleAbort, {
          once: true,
        });
        localPromptContext.abortListenerCleanup = () => {
          cancellationSignal.removeEventListener('abort', handleAbort);
          this.#logger.debug(
            `PlayerPromptService.prompt: Removed abort signal listener for actor ${localPromptContext.actorId}.`
          );
        };
        this.#logger.debug(
          `PlayerPromptService.prompt: Abort signal listener set up for actor ${actorId}.`
        );

        if (
          cancellationSignal.aborted &&
          !localPromptContext.isResolvedOrRejected
        ) {
          this.#logger.warn(
            `PlayerPromptService.prompt: Actor ${actorId}'s prompt was aborted by signal just before event subscription could be fully set up or after context assignment. Triggering rejection.`
          );
          localPromptContext.reject(
            new DOMException(
              'Prompt aborted by signal before event subscription was finalized or immediately after context set.',
              'AbortError'
            )
          );
          return;
        }
      }

      if (localPromptContext.isResolvedOrRejected) {
        this.#logger.debug(
          `PlayerPromptService.prompt: Prompt for actor ${actorId} already settled before event subscription. Not subscribing.`
        );
        return;
      }

      try {
        this.#logger.debug(
          `PlayerPromptService.prompt: Subscribing to ${PLAYER_TURN_SUBMITTED_ID} for actor ${actorId}.`
        );
        const unsubscribeFunc = this.#validatedEventDispatcher.subscribe(
          PLAYER_TURN_SUBMITTED_ID,
          (eventData) => {
            this._handlePlayerTurnSubmittedEvent(
              eventData,
              localPromptContext,
              localPromptContext.resolve,
              localPromptContext.reject
            );
          }
        );

        if (typeof unsubscribeFunc !== 'function') {
          this.#logger.error(
            `PlayerPromptService.prompt: Subscription to ${PLAYER_TURN_SUBMITTED_ID} for actor ${actorId} did not return an unsubscribe function.`
          );
          localPromptContext.reject(
            new PromptError(
              `Failed to subscribe to player input event for actor ${actorId}: No unsubscribe function returned.`,
              null,
              'SUBSCRIPTION_FAILED'
            )
          );
          return;
        }
        localPromptContext.unsubscribe = unsubscribeFunc;
        this.#logger.info(
          `PlayerPromptService.prompt: Successfully subscribed to ${PLAYER_TURN_SUBMITTED_ID} for actor ${actorId}. Waiting for input.`
        );
      } catch (error) {
        this.#logger.error(
          `PlayerPromptService.prompt: Error subscribing to ${PLAYER_TURN_SUBMITTED_ID} for actor ${actorId}.`,
          error
        );
        localPromptContext.reject(
          new PromptError(
            `Failed to subscribe to player input event for actor ${actorId}. Details: ${error.message}`,
            error,
            'SUBSCRIPTION_ERROR'
          )
        );
      }
    });
  }

  /**
   * Public method to reset or cancel any ongoing prompt externally.
   */
  cancelCurrentPrompt() {
    this.#logger.info('PlayerPromptService: cancelCurrentPrompt called.');
    if (this.#currentPromptContext) {
      const contextToCancel = this.#currentPromptContext;
      this.#logger.debug(
        `PlayerPromptService.cancelCurrentPrompt: Attempting to cancel active prompt for actor ${contextToCancel.actorId}.`
      );

      let cancellationError;
      if (contextToCancel.cancellationSignal?.aborted) {
        cancellationError = new DOMException(
          'Prompt already aborted by its own signal; cancelCurrentPrompt called subsequently.',
          'AbortError'
        );
        this.#logger.warn(
          `PlayerPromptService.cancelCurrentPrompt: Prompt for ${contextToCancel.actorId} was already aborted by its signal.`
        );
      } else {
        cancellationError = new PromptError(
          'Current player prompt was explicitly cancelled by external request.',
          null,
          'PROMPT_CANCELLED'
        );
      }
      this.#clearCurrentPrompt(cancellationError);
    } else {
      this.#logger.debug(
        'PlayerPromptService: cancelCurrentPrompt called, but no active prompt to cancel.'
      );
    }
  }
}

export default HumanPlayerPromptService;
// --- FILE END ---
