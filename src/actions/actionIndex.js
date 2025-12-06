// src/actions/actionIndex.js

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../data/gameDataRepository.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./tracing/traceContext.js').TraceContext} TraceContext */

export class ActionIndex {
  /** @type {ILogger} */
  #logger;
  /** @type {EntityManager} */
  #entityManager;

  /**
   * A map where keys are component IDs and values are arrays of ActionDefinitions
   * that require that component on the actor.
   *
   * @type {Map<string, ActionDefinition[]>}
   */
  #byActorComponent = new Map();

  /**
   * An array of ActionDefinitions that have no specific actor component requirements.
   * These are always included as candidates.
   *
   * @type {ActionDefinition[]}
   */
  #noActorRequirement = [];

  /**
   * A map where keys are component IDs and values are arrays of ActionDefinitions
   * that forbid that component on the actor.
   *
   * @type {Map<string, ActionDefinition[]>}
   */
  #byForbiddenComponent = new Map();

  /**
   * Direct lookup table for action definitions by their id.
   *
   * @type {Map<string, ActionDefinition>}
   */
  #byActionId = new Map();

  /**
   * Instantiates ActionIndex.
   *
   * @param {{logger: ILogger, entityManager: EntityManager}} deps ActionIndex's dependencies.
   */
  constructor({ logger, entityManager }) {
    if (!logger) {
      throw new Error('ActionIndex requires a logger dependency');
    }
    if (!entityManager) {
      throw new Error('ActionIndex requires an entityManager dependency');
    }

    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#logger.debug('ActionIndex initialised.');
  }

  /**
   * Builds the index from a list of all action definitions.
   * This should be called once at application startup.
   *
   * @param {ActionDefinition[]} allActionDefinitions An array containing all action definition objects in the app.
   */
  buildIndex(allActionDefinitions) {
    if (!Array.isArray(allActionDefinitions)) {
      this.#logger.warn(
        'ActionIndex.buildIndex: allActionDefinitions must be an array. Skipping index build.'
      );
      return;
    }

    this.#logger.debug(
      `Building action index from ${allActionDefinitions.length} definitions...`
    );

    this.#byActorComponent.clear();
    this.#byForbiddenComponent.clear();
    this.#noActorRequirement = [];
    this.#byActionId.clear();

    for (const actionDef of allActionDefinitions) {
      if (!actionDef || typeof actionDef !== 'object') {
        this.#logger.debug(
          `ActionIndex.buildIndex: Skipping invalid action definition: ${actionDef}`
        );
        continue;
      }

      if (typeof actionDef.id === 'string' && actionDef.id.trim()) {
        this.#byActionId.set(actionDef.id, actionDef);
      }

      const requiredActorComponents = actionDef.required_components?.actor;

      if (
        requiredActorComponents &&
        Array.isArray(requiredActorComponents) &&
        requiredActorComponents.length > 0
      ) {
        for (const componentId of requiredActorComponents) {
          if (typeof componentId === 'string' && componentId.trim()) {
            if (!this.#byActorComponent.has(componentId)) {
              this.#byActorComponent.set(componentId, []);
            }
            this.#byActorComponent.get(componentId).push(actionDef);
          }
        }
      } else {
        this.#noActorRequirement.push(actionDef);
      }

      // Process forbidden components
      const forbiddenActorComponents = actionDef.forbidden_components?.actor;

      if (
        forbiddenActorComponents &&
        Array.isArray(forbiddenActorComponents) &&
        forbiddenActorComponents.length > 0
      ) {
        for (const componentId of forbiddenActorComponents) {
          if (typeof componentId === 'string' && componentId.trim()) {
            if (!this.#byForbiddenComponent.has(componentId)) {
              this.#byForbiddenComponent.set(componentId, []);
            }
            this.#byForbiddenComponent.get(componentId).push(actionDef);
          }
        }
      }
    }

    this.#logger.debug(
      `Action index built. ${this.#byActorComponent.size} component-to-action maps created.`
    );
  }

  /**
   * Retrieves a single action definition by its id.
   * Used by GOAP refinement to fetch concrete actions during execution.
   *
   * @param {string} actionId - Namespaced action id.
   * @returns {ActionDefinition|null}
   */
  getActionById(actionId) {
    if (typeof actionId !== 'string' || !actionId.trim()) {
      this.#logger.warn(
        `ActionIndex.getActionById called with invalid id: ${actionId}`
      );
      return null;
    }

    return this.#byActionId.get(actionId) ?? null;
  }

  /**
   * Retrieves a pre-filtered list of candidate actions for a given actor
   * based on the components they possess.
   *
   * @param {Entity} actorEntity The entity that could perform an action.
   * @param {TraceContext} [trace] The TraceContext object that contains the logs of the action discovery process.
   * @returns {ActionDefinition[]} A unique list of candidate action definitions.
   */
  getCandidateActions(actorEntity, trace = null) {
    const source = 'ActionIndex.getCandidateActions';
    if (!actorEntity || !actorEntity.id) return [];

    const actorComponentTypes =
      this.#entityManager.getAllComponentTypesForEntity(actorEntity.id) || [];

    trace?.data(`Actor '${actorEntity.id}' has components.`, source, {
      components: actorComponentTypes.length > 0 ? actorComponentTypes : [],
    });

    // Use a Set to automatically handle de-duplication.
    const candidateSet = new Set(this.#noActorRequirement);
    trace?.info(
      `Added ${this.#noActorRequirement.length} actions with no actor component requirements.`,
      source
    );

    for (const componentType of actorComponentTypes) {
      const actionsForComponent = this.#byActorComponent.get(componentType);
      if (actionsForComponent) {
        trace?.info(
          `Found ${actionsForComponent.length} actions requiring component '${componentType}'.`,
          source
        );
        for (const action of actionsForComponent) {
          candidateSet.add(action);
        }
      }
    }

    // Filter out actions with forbidden components
    const forbiddenCandidates = new Set();
    for (const componentType of actorComponentTypes) {
      const actionsWithForbiddenComponent =
        this.#byForbiddenComponent.get(componentType);
      if (actionsWithForbiddenComponent) {
        trace?.info(
          `Found ${actionsWithForbiddenComponent.length} actions forbidden by component '${componentType}'.`,
          source
        );
        for (const action of actionsWithForbiddenComponent) {
          forbiddenCandidates.add(action);
        }
      }
    }

    // Remove forbidden actions from candidates
    for (const forbiddenAction of forbiddenCandidates) {
      candidateSet.delete(forbiddenAction);
    }

    if (forbiddenCandidates.size > 0) {
      trace?.info(
        `Removed ${forbiddenCandidates.size} actions due to forbidden components.`,
        source,
        { removedActionIds: Array.from(forbiddenCandidates).map((a) => a.id) }
      );
    }

    // Filter candidates to ensure actor has ALL required components
    // Actions may have been added to candidateSet if actor has ANY of the required components,
    // but we need to ensure actor has ALL required components
    const candidates = Array.from(candidateSet).filter((action) => {
      const requiredActorComponents = action.required_components?.actor;

      // If no required components or empty array, include the action
      if (
        !requiredActorComponents ||
        !Array.isArray(requiredActorComponents) ||
        requiredActorComponents.length === 0
      ) {
        return true;
      }

      // Check if actor has ALL required components
      const hasAllRequired = requiredActorComponents.every((componentType) =>
        actorComponentTypes.includes(componentType)
      );

      if (!hasAllRequired) {
        trace?.info(
          `Excluding action '${action.id}' - actor missing required components.`,
          source,
          {
            required: requiredActorComponents,
            actorHas: actorComponentTypes.filter((c) =>
              requiredActorComponents.includes(c)
            ),
          }
        );
      }

      return hasAllRequired;
    });

    trace?.success(
      `Final candidate list contains ${candidates.length} unique actions after component validation.`,
      source,
      { actionIds: candidates.map((a) => a.id) }
    );

    this.#logger.debug(
      `ActionIndex: Retrieved ${candidates.length} candidate actions for actor ${actorEntity.id}.`
    );

    return candidates;
  }
}
