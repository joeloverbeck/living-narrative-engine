import { ACTOR_COMPONENT_ID } from '../constants/componentIds.js';

export default class RoundManager {
  #turnOrderService;
  #entityManager;
  #logger;
  #inProgress = false;
  #hadSuccess = false;

  constructor(turnOrderService, entityManager, logger) {
    this.#turnOrderService = turnOrderService;
    this.#entityManager = entityManager;
    this.#logger = logger;
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
      const hasInitiativeData = initiativeData !== undefined;

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
        if (typeof entityId !== 'string' || entityId.length === 0) {
          this.#logger.warn(
            'RoundManager.startRound(): Ignoring initiative entry with non-string entity id from Map input.',
            { entityId }
          );
          continue;
        }

        const numericScore = this.#coerceInitiativeScore(score, entityId);
        if (numericScore === undefined) {
          continue;
        }

        normalisedFromMap.set(entityId, numericScore);
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
        if (typeof entityId !== 'string' || entityId.length === 0) {
          this.#logger.warn(
            'RoundManager.startRound(): Ignoring initiative entry with non-string entity id from array input.',
            { entityId }
          );
          continue;
        }

        const numericScore = this.#coerceInitiativeScore(score, entityId);
        if (numericScore === undefined) {
          continue;
        }

        normalisedFromArray.set(entityId, numericScore);
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
        if (typeof entityId !== 'string' || entityId.length === 0) {
          this.#logger.warn(
            'RoundManager.startRound(): Ignoring initiative entry with non-string entity id from object input.',
            { entityId }
          );
          continue;
        }

        const numericScore = this.#coerceInitiativeScore(score, entityId);
        if (numericScore === undefined) {
          continue;
        }

        normalisedFromObject.set(entityId, numericScore);
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

    let parsed;
    try {
      parsed = Number(rawScore);
    } catch (error) {
      this.#logger.warn(
        'RoundManager.startRound(): Ignoring initiative entry with non-numeric score.',
        {
          entityId,
          receivedType: typeof rawScore,
          error: error instanceof Error ? error.message : error,
        }
      );
      return undefined;
    }

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
}
