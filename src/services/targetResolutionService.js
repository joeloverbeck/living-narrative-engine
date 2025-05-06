import {ITargetResolutionService} from "../core/interfaces/ITargetResolutionService.js";

/**
 * @description Service responsible for resolving the target of an action based on player input,
 * action definitions, and the current game state.
 * @implements {ITargetResolutionService}
 */
class TargetResolutionService extends ITargetResolutionService {
    /** @type {IEntityManager} */ #entityManager;
    /** @type {IWorldContext} */ #worldContext;
    /** @type {IGameDataRepository} */ #gameDataRepository;
    /** @type {ILogger} */ #logger;

    /**
     * @description Validates a dependency instance, checking for its existence and required methods.
     * Logs an error and throws if validation fails. This method is intended for internal use
     * during constructor setup.
     * @param {any} dependency - The dependency instance to validate.
     * @param {string} dependencyName - The name of the dependency (for logging and error messages).
     * @param {string[]} [requiredMethods=[]] - An array of method names that must exist on the dependency.
     * @private
     * @throws {Error} If the dependency is missing or does not have all required methods.
     */
    #_validateDependency(dependency, dependencyName, requiredMethods = []) {
        if (!dependency) {
            const errorMsg = `TargetResolutionService Constructor: Missing required dependency: ${dependencyName}.`;
            // this.#logger will be available here as it's validated first.
            // The 'this.#logger !== dependency' check is a safeguard.
            if (this.#logger && this.#logger !== dependency) {
                this.#logger.error(errorMsg);
            }
            throw new Error(errorMsg);
        }
        for (const method of requiredMethods) {
            if (typeof dependency[method] !== 'function') {
                const errorMsg = `TargetResolutionService Constructor: Invalid or missing method '${method}' on dependency '${dependencyName}'.`;
                if (this.#logger && this.#logger !== dependency) {
                    this.#logger.error(errorMsg);
                }
                throw new Error(errorMsg);
            }
        }
    }

    /**
     * @description Constructor for TargetResolutionService. It injects and validates all required dependencies.
     * The logger is validated first so it can be used for reporting issues with other dependencies.
     * @param {TargetResolutionServiceOptions} options - Configuration object containing all necessary service dependencies.
     * @throws {Error} If the logger dependency is invalid or any other critical dependency is missing or malformed.
     */
    constructor(options) {
        super(); // Call super if extending a class with a constructor, though ITargetResolutionService is an interface here.
                 // For pure JSDoc interfaces, this isn't strictly necessary but doesn't harm.
        const {
            entityManager,
            worldContext,
            gameDataRepository,
            logger
        } = options || {};

        // 1. Validate Logger separately and first
        if (!logger ||
            typeof logger.info !== 'function' ||
            typeof logger.error !== 'function' ||
            typeof logger.debug !== 'function' ||
            typeof logger.warn !== 'function') {
            const errorMsg = 'TargetResolutionService Constructor: CRITICAL - Invalid or missing ILogger instance. Requires methods: info, error, debug, warn.';
            console.error(errorMsg); // Use console.error as a fallback
            throw new Error(errorMsg);
        }
        this.#logger = logger;

        // 2. Validate other dependencies
        try {
            // Assuming common method names for these interfaces based on CommandProcessor usage
            this.#_validateDependency(entityManager, 'entityManager', ['getEntityInstance']);
            this.#_validateDependency(worldContext, 'worldContext', ['getLocationOfEntity', 'getEntitiesInLocation']);
            this.#_validateDependency(gameDataRepository, 'gameDataRepository', ['getActionDefinition', 'getItemDefinition', 'getNpcDefinition']);
        } catch (error) {
            this.#logger.error(`TargetResolutionService Constructor: Dependency validation failed. ${error.message}`);
            throw error;
        }

        // 3. Assign validated dependencies
        this.#entityManager = entityManager;
        this.#worldContext = worldContext;
        this.#gameDataRepository = gameDataRepository;

        this.#logger.info("TargetResolutionService: Instance created and dependencies validated.");
    }

    /**
     * Resolves the target for a given action based on the action definition and context.
     * This is a placeholder implementation.
     * @param {ActionDefinition} actionDefinition - The definition of the action being performed.
     * @param {ActionContext} actionContext - The context in which the action is being performed.
     * @returns {Promise<TargetResolutionResult>} A promise that resolves to the target resolution result.
     * @async
     * @override
     */
    async resolveActionTarget(actionDefinition, actionContext) {
        this.#logger.debug(`TargetResolutionService.resolveActionTarget called for action: ${actionDefinition.id}, actor: ${actionContext.actingEntity.id}`);
        // Placeholder implementation
        return {
            status: ResolutionStatus.NOT_FOUND,
            targetType: 'none',
            targetId: null
        };
    }
}

export default TargetResolutionService;