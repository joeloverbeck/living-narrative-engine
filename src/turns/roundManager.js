import { ACTOR_COMPONENT_ID } from '../constants/componentIds.js';
import { ROUND_STARTED_ID } from '../constants/eventIds.js';

export default class RoundManager {
  #turnOrderService;
  #entityManager;
  #logger;
  #dispatcher;
  #inProgress = false;
  #hadSuccess = false;
  #roundNumber = 0;

  constructor(turnOrderService, entityManager, logger, dispatcher) {
    this.#turnOrderService = turnOrderService;
    this.#entityManager = entityManager;
    this.#logger = logger;

    if (!dispatcher || typeof dispatcher.dispatch !== 'function') {
      throw new Error(
        'RoundManager requires a valid dispatcher with dispatch method'
      );
    }
    this.#dispatcher = dispatcher;
  }

  /**
   * Starts a new round using the provided strategy and optional initiative data.
   *
   * @param {('round-robin' | 'initiative' | {strategy?: 'round-robin' | 'initiative'; initiativeData?: Map<string, number>})} [strategyOrOptions]
   *  Either the turn order strategy string or an options object.
   * @param {Map<string, number>} [initiativeDataParam] - Initiative data when the first parameter is a strategy string.
   * @returns {Promise<void>}
   */
  async startRound(strategyOrOptions = 'round-robin', initiativeDataParam) {
    this.#logger.debug('RoundManager.startRound() initiating...');

    // A new round is not considered active until we successfully hand control to
    // the turn order service. Reset the flag eagerly so callers never observe a
    // stale "in progress" state when this method throws before completion.
    this.#inProgress = false;

    // Increment round number at the start of each round
    this.#roundNumber++;
    this.#logger.debug(`Starting round ${this.#roundNumber}`);

    let strategy;
    let initiativeData;

    const isOptionsObject =
      strategyOrOptions &&
      typeof strategyOrOptions === 'object' &&
      !(strategyOrOptions instanceof String) &&
      !(strategyOrOptions instanceof Map);

    if (isOptionsObject) {
      initiativeData = strategyOrOptions.initiativeData;

      const rawStrategy = strategyOrOptions.strategy;
      const hasExplicitStrategy =
        typeof rawStrategy === 'string' && rawStrategy.trim() !== '';
      const hasInitiativeData =
        initiativeData !== undefined && initiativeData !== null;

      if (hasExplicitStrategy) {
        strategy = rawStrategy;
      } else if (hasInitiativeData) {
        strategy = 'initiative';
      } else {
        strategy = 'round-robin';
      }
    } else {
      strategy = strategyOrOptions ?? 'round-robin';
      initiativeData = initiativeDataParam;
    }

    if (typeof strategy !== 'string' || strategy.trim() === '') {
      strategy = 'round-robin';
    } else {
      strategy = strategy.trim().toLowerCase();
    }

    const hasInitiativeCandidate = this.#hasCandidateInitiativeData(
      initiativeData
    );
    if (strategy !== 'initiative' && strategy !== 'round-robin') {
      const fallbackStrategy = hasInitiativeCandidate
        ? 'initiative'
        : 'round-robin';
      const reasonSuffix = hasInitiativeCandidate
        ? ' because initiative data was provided.'
        : '.';
      this.#logger.warn(
        `RoundManager.startRound(): Unknown strategy '${strategy}'. Falling back to '${fallbackStrategy}'${reasonSuffix}`
      );
      strategy = fallbackStrategy;
    }

    if (strategy === 'initiative') {
      initiativeData = this.#normaliseInitiativeData(initiativeData);
      if (!(initiativeData instanceof Map) || initiativeData.size === 0) {
        const errorMsg =
          'Cannot start an initiative round: initiativeData Map is required.';
        this.#logger.error(errorMsg);
        throw new Error(errorMsg);
      }
    } else {
      initiativeData = undefined;
    }

    // Get all active entities and filter for actors
    const allEntities = Array.from(this.#entityManager.entities ?? []);
    const actors = allEntities.filter(
      (entity) =>
        entity &&
        typeof entity.hasComponent === 'function' &&
        entity.hasComponent(ACTOR_COMPONENT_ID)
    );

    if (actors.length === 0) {
      const errorMsg =
        'Cannot start a new round: No active entities with an Actor component found.';
      this.#logger.error(errorMsg);
      throw new Error(errorMsg);
    }

    const actorIds = actors.map((a) => a.id);
    this.#logger.debug(
      `Found ${actors.length} actors to start the round: ${actorIds.join(', ')}`
    );

    // Start the new round in the service
    await this.#turnOrderService.startNewRound(
      actors,
      strategy,
      initiativeData
    );

    // Reset success flag only after the round starts successfully
    this.#hadSuccess = false;
    this.#inProgress = true;

    // Dispatch round started event for UI components (e.g., turn order ticker)
    this.#dispatcher.dispatch(ROUND_STARTED_ID, {
      roundNumber: this.#roundNumber,
      actors: actorIds,
      strategy: strategy,
    });

    this.#logger.debug(
      `Successfully started a new round with ${actors.length} actors using the '${strategy}' strategy.`
    );
  }

  endTurn(success) {
    if (success) {
      this.#hadSuccess = true;
    }
  }

  get inProgress() {
    return this.#inProgress;
  }

  get hadSuccess() {
    return this.#hadSuccess;
  }

  resetFlags() {
    this.#inProgress = false;
    this.#hadSuccess = false;
    this.#roundNumber = 0;
  }

  /**
   * @description Determines whether initiative data input contains any candidate entries.
   * @param {unknown} rawInitiativeData - Initiative data provided by callers.
   * @returns {boolean} True when the input contains at least one entry candidate.
   */
  #hasCandidateInitiativeData(rawInitiativeData) {
    if (rawInitiativeData instanceof Map) {
      return rawInitiativeData.size > 0;
    }

    if (Array.isArray(rawInitiativeData)) {
      return rawInitiativeData.length > 0;
    }

    if (
      rawInitiativeData &&
      typeof rawInitiativeData === 'object' &&
      !Array.isArray(rawInitiativeData)
    ) {
      return Object.keys(rawInitiativeData).length > 0;
    }

    return false;
  }

  /**
   * Normalises initiative data passed to {@link startRound} into a Map.
   *
   * @param {unknown} rawInitiativeData - Initiative data provided by callers.
   * @returns {Map<string, number> | undefined} Normalised initiative data or undefined when normalisation fails.
   */
  #normaliseInitiativeData(rawInitiativeData) {
    if (rawInitiativeData instanceof Map) {
      const normalisedFromMap = new Map();
      for (const [entityId, score] of rawInitiativeData.entries()) {
        const normalisedId = this.#normaliseEntityId(entityId, 'Map');
        if (!normalisedId) {
          continue;
        }

        const numericScore = this.#coerceInitiativeScore(score, normalisedId);
        if (numericScore === undefined) {
          continue;
        }

        if (normalisedFromMap.has(normalisedId)) {
          this.#logger.warn(
            `RoundManager.startRound(): Duplicate initiative entry for entity id "${normalisedId}" after normalisation. Using latest value.`,
            { entityId }
          );
        }

        normalisedFromMap.set(normalisedId, numericScore);
      }

      return normalisedFromMap.size > 0 ? normalisedFromMap : undefined;
    }

    if (Array.isArray(rawInitiativeData)) {
      const normalisedFromArray = new Map();
      for (const entry of rawInitiativeData) {
        if (!Array.isArray(entry) || entry.length < 2) {
          this.#logger.warn(
            'RoundManager.startRound(): Ignoring malformed initiative entry from array input.',
            { entry }
          );
          continue;
        }
        const [entityId, score] = entry;
        const normalisedId = this.#normaliseEntityId(entityId, 'array');
        if (!normalisedId) {
          continue;
        }

        const numericScore = this.#coerceInitiativeScore(score, normalisedId);
        if (numericScore === undefined) {
          continue;
        }

        if (normalisedFromArray.has(normalisedId)) {
          this.#logger.warn(
            `RoundManager.startRound(): Duplicate initiative entry for entity id "${normalisedId}" after normalisation. Using latest value.`,
            { entityId }
          );
        }

        normalisedFromArray.set(normalisedId, numericScore);
      }
      return normalisedFromArray.size > 0 ? normalisedFromArray : undefined;
    }

    if (
      rawInitiativeData &&
      typeof rawInitiativeData === 'object' &&
      !Array.isArray(rawInitiativeData)
    ) {
      const entries = Object.entries(rawInitiativeData);
      if (entries.length === 0) {
        return undefined;
      }
      const normalisedFromObject = new Map();
      for (const [entityId, score] of entries) {
        const normalisedId = this.#normaliseEntityId(entityId, 'object');
        if (!normalisedId) {
          continue;
        }

        const numericScore = this.#coerceInitiativeScore(score, normalisedId);
        if (numericScore === undefined) {
          continue;
        }

        if (normalisedFromObject.has(normalisedId)) {
          this.#logger.warn(
            `RoundManager.startRound(): Duplicate initiative entry for entity id "${normalisedId}" after normalisation. Using latest value.`,
            { entityId }
          );
        }

        normalisedFromObject.set(normalisedId, numericScore);
      }

      if (normalisedFromObject.size === 0) {
        return undefined;
      }

      this.#logger.debug(
        'RoundManager.startRound(): Normalised plain object initiative data into Map for initiative round.'
      );
      return normalisedFromObject;
    }

    return undefined;
  }

  /**
   * @description Coerces a raw initiative score into a finite number for queue consumption.
   * @param {unknown} rawScore - The score provided by the caller.
   * @param {string} entityId - The entity identifier used for logging context.
   * @returns {number | undefined} A finite numeric score, or `undefined` when coercion fails.
   */
  #coerceInitiativeScore(rawScore, entityId) {
    if (typeof rawScore === 'number' && Number.isFinite(rawScore)) {
      return rawScore;
    }

    if (typeof rawScore === 'string') {
      const trimmed = rawScore.trim();
      if (trimmed.length === 0) {
        this.#logger.warn(
          'RoundManager.startRound(): Ignoring initiative entry with empty string score.',
          { entityId }
        );
        return undefined;
      }
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) {
        return parsed;
      }

      this.#logger.warn(
        'RoundManager.startRound(): Ignoring initiative entry with non-numeric score.',
        {
          entityId,
          receivedType: 'string',
          rawScore,
        }
      );
      return undefined;
    }

    if (rawScore == null) {
      this.#logger.warn(
        'RoundManager.startRound(): Ignoring initiative entry with missing score.',
        { entityId }
      );
      return undefined;
    }

    const parsed = Number(rawScore);
    if (Number.isFinite(parsed)) {
      return parsed;
    }

    this.#logger.warn(
      'RoundManager.startRound(): Ignoring initiative entry with non-numeric score.',
      {
        entityId,
        receivedType: typeof rawScore,
      }
    );
    return undefined;
  }

  /**
   * @description Normalises an initiative entity identifier by validating it is a string and trimming whitespace.
   * @param {unknown} rawEntityId - The raw identifier provided by the caller.
   * @param {'Map' | 'array' | 'object'} source - Source container type for logging context.
   * @returns {string | undefined} A trimmed entity identifier, or undefined when the id is invalid.
   */
  #normaliseEntityId(rawEntityId, source) {
    if (typeof rawEntityId !== 'string') {
      this.#logger.warn(
        `RoundManager.startRound(): Ignoring initiative entry with non-string entity id from ${source} input.`,
        { entityId: rawEntityId }
      );
      return undefined;
    }

    const trimmedId = rawEntityId.trim();
    if (trimmedId.length === 0) {
      this.#logger.warn(
        `RoundManager.startRound(): Ignoring initiative entry with blank entity id from ${source} input after trimming whitespace.`,
        { entityId: rawEntityId }
      );
      return undefined;
    }

    return trimmedId;
  }
}
