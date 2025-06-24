/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../data/gameDataRepository.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */

export class ActionIndex {
  /** @type {ILogger} */
  #logger;
  /** @type {EntityManager} */
  #entityManager;

  /**
   * A map where keys are component IDs and values are arrays of ActionDefinitions
   * that require that component on the actor.
   * @type {Map<string, ActionDefinition[]>}
   */
  #byActorComponent = new Map();

  /**
   * An array of ActionDefinitions that have no specific actor component requirements.
   * These are always included as candidates.
   * @type {ActionDefinition[]}
   */
  #noActorRequirement = [];

  /**
   * @param {{logger: ILogger, entityManager: EntityManager}} deps
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
   * @param {ActionDefinition[]} allActionDefinitions
   */
  buildIndex(allActionDefinitions) {
    if (!Array.isArray(allActionDefinitions)) {
      this.#logger.warn('ActionIndex.buildIndex: allActionDefinitions must be an array. Skipping index build.');
      return;
    }

    this.#logger.debug(`Building action index from ${allActionDefinitions.length} definitions...`);
    
    this.#byActorComponent.clear();
    this.#noActorRequirement = [];

    for (const actionDef of allActionDefinitions) {
      if (!actionDef || typeof actionDef !== 'object') {
        this.#logger.debug(`ActionIndex.buildIndex: Skipping invalid action definition: ${actionDef}`);
        continue;
      }

      const requiredActorComponents = actionDef.required_components?.actor;

      if (requiredActorComponents && Array.isArray(requiredActorComponents) && requiredActorComponents.length > 0) {
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
    }

    this.#logger.debug(`Action index built. ${this.#byActorComponent.size} component-to-action maps created.`);
  }

  /**
   * Retrieves a pre-filtered list of candidate actions for a given actor
   * based on the components they possess.
   * @param {Entity} actorEntity
   * @returns {ActionDefinition[]} A unique list of candidate action definitions.
   */
  getCandidateActions(actorEntity) {
    if (!actorEntity || !actorEntity.id) return [];

    // Assumes the prerequisite method from step 1 exists.
    const actorComponentTypes = this.#entityManager.getAllComponentTypesForEntity(actorEntity.id);

    // Handle null or undefined return values
    if (!actorComponentTypes || !Array.isArray(actorComponentTypes)) {
      this.#logger.debug(`ActionIndex: Retrieved ${this.#noActorRequirement.length} candidate actions for actor ${actorEntity.id}.`);
      return [...this.#noActorRequirement];
    }

    // Use a Set to automatically handle de-duplication.
    // An action requiring two components the actor has would otherwise be added twice.
    const candidateSet = new Set(this.#noActorRequirement);

    for (const componentType of actorComponentTypes) {
      const actionsForComponent = this.#byActorComponent.get(componentType);
      if (actionsForComponent) {
        for (const action of actionsForComponent) {
          candidateSet.add(action);
        }
      }
    }

    const candidates = Array.from(candidateSet);
    this.#logger.debug(`ActionIndex: Retrieved ${candidates.length} candidate actions for actor ${actorEntity.id}.`);
    return candidates;
  }
} 