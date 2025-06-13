/**
 * @file Defines a builder responsible for creating an ActionContext.
 * @module src/turns/prompting/ActionContextBuilder
 */

// ──────────── Interface / Type imports ────────────
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../../interfaces/IWorldContext.js').IWorldContext} IWorldContext */
/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/IGameDataRepository.js').IGameDataRepository} IGameDataRepository */
/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../actions/actionTypes.js').ActionContext} ActionContext */

import { PromptError } from '../../errors/promptError.js';
import { validateDependency } from '../../utils/validationUtils.js';

/**
 * @typedef {object} ActionContextBuilderDependencies
 * @property {IWorldContext}        worldContext
 * @property {IEntityManager}       entityManager
 * @property {IGameDataRepository}  gameDataRepository
 * @property {ILogger}              logger
 */

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @description A builder class that creates a valid `ActionContext` from an actor entity.
 * This ensures that higher-level services can get a context without needing direct
 * access to domain internals like the world state.
 * @class
 */
class ActionContextBuilder {
  /** @type {IWorldContext} */
  #worldContext;

  /** @type {IEntityManager} */
  #entityManager;

  /** @type {IGameDataRepository} */
  #gameDataRepository;

  /** @type {ILogger} */
  #logger;

  /**
   * Constructs an instance of ActionContextBuilder.
   *
   * @param {ActionContextBuilderDependencies} deps - The dependencies required by the builder.
   */
  constructor({ worldContext, entityManager, gameDataRepository, logger }) {
    // Validate dependencies using the centralized utility.
    validateDependency(logger, 'logger', console, {
      requiredMethods: ['info', 'error', 'debug', 'warn'],
    });
    validateDependency(worldContext, 'worldContext', logger, {
      requiredMethods: ['getLocationOfEntity'],
    });
    validateDependency(entityManager, 'entityManager', logger);
    validateDependency(gameDataRepository, 'gameDataRepository', logger);

    this.#worldContext = worldContext;
    this.#entityManager = entityManager;
    this.#gameDataRepository = gameDataRepository;
    this.#logger = logger;
  }

  /**
   * Builds an ActionContext for a given actor.
   * This involves validating the actor and finding its current location in the world.
   *
   * @async
   * @param {Entity} actor - The entity for whom to build the context.
   * @returns {Promise<ActionContext>} A promise that resolves to the constructed ActionContext.
   * @throws {PromptError} Throws a `PromptError` if the actor is invalid (`INVALID_ACTOR`)
   * or if the actor's location cannot be found (`LOCATION_NOT_FOUND`).
   */
  async buildContext(actor) {
    if (!actor || typeof actor.id !== 'string' || !actor.id.trim()) {
      throw new PromptError(
        'Cannot build ActionContext: actor is invalid or has no ID.',
        null,
        'INVALID_ACTOR'
      );
    }

    const currentLocation = await this.#worldContext.getLocationOfEntity(
      actor.id
    );

    if (!currentLocation) {
      throw new PromptError(
        `Location not found for actor with ID: ${actor.id}`,
        null,
        'LOCATION_NOT_FOUND'
      );
    }

    return {
      actingEntity: actor,
      currentLocation,
      entityManager: this.#entityManager,
      gameDataRepository: this.#gameDataRepository,
      logger: this.#logger,
      worldContext: this.#worldContext,
    };
  }
}

export default ActionContextBuilder;
