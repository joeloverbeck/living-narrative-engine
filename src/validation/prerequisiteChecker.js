// src/validation/prerequisiteChecker.js

// --- Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../types/actionDefinition.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../types/actionDefinition.js').Prerequisite} Prerequisite */

// --- Helper Imports ---
import {createJsonLogicContext} from '../logic/contextAssembler.js';

/**
 * Service responsible for checking if an action's prerequisites, defined using
 * JSON Logic, are met given the current context (actor, target, etc.).
 * It orchestrates the assembly of the evaluation context and the iteration
 * through prerequisite rules.
 */
export class PrerequisiteChecker {
    /** @private @type {JsonLogicEvaluationService} */
    #jsonLogicEvaluationService;
    /** @private @type {EntityManager} */
    #entityManager;
    /** @private @type {ILogger} */
    #logger;

    /**
     * Creates an instance of PrerequisiteChecker.
     * @param {object} dependencies - The required dependencies.
     * @param {JsonLogicEvaluationService} dependencies.jsonLogicEvaluationService - Service to evaluate JSON Logic rules.
     * @param {EntityManager} dependencies.entityManager - Service to access entity instances and component data (needed for context assembly).
     * @param {ILogger} dependencies.logger - Logger service instance.
     * @throws {Error} If any required dependency is missing or invalid.
     */
    constructor({jsonLogicEvaluationService, entityManager, logger}) {
        // AC2: Accepts dependencies & performs checks
        if (!jsonLogicEvaluationService || typeof jsonLogicEvaluationService.evaluate !== 'function') {
            throw new Error("PrerequisiteChecker requires a valid JsonLogicEvaluationService instance.");
        }
        if (!entityManager || typeof entityManager.getEntityInstance !== 'function') {
            throw new Error("PrerequisiteChecker requires a valid EntityManager instance.");
        }
        if (!logger || typeof logger.debug !== 'function' || typeof logger.error !== 'function' || typeof logger.warn !== 'function') {
            throw new Error("PrerequisiteChecker requires a valid ILogger instance.");
        }

        this.#jsonLogicEvaluationService = jsonLogicEvaluationService;
        this.#entityManager = entityManager;
        this.#logger = logger;
        this.#logger.info("PrerequisiteChecker initialized.");
    }

    /**
     * Checks all prerequisites defined in an action against the provided actor and target entities.
     * Assembles the necessary JSON Logic evaluation context and iterates through each prerequisite rule.
     *
     * @param {ActionDefinition} actionDefinition - The definition of the action containing the prerequisites.
     * @param {Entity} actorEntity - The entity performing the action.
     * @param {Entity | null} targetEntity - The entity being targeted (if any, null otherwise).
     * @returns {boolean} True if all prerequisites pass (or if there are none), false if any prerequisite fails. (AC3)
     * @throws {Error} Rethrows errors from context assembly if they occur (handled via catch).
     */
    check(actionDefinition, actorEntity, targetEntity) {
        // --- Input Validation (Moved UP) ---
        // Validate before accessing any properties
        if (!actionDefinition || !actionDefinition.id) {
            this.#logger.error("PrerequisiteChecker.check: Called with invalid actionDefinition.", {actionDefinition});
            return false;
        }
        if (!actorEntity || !actorEntity.id) {
            // Log action ID here since we know actionDefinition is valid at this point
            this.#logger.error(`PrerequisiteChecker.check: Called with invalid actorEntity for action '${actionDefinition.id}'.`, {actorEntity});
            return false;
        }
        // targetEntity can legitimately be null

        // --- Safe to Extract IDs Now ---
        const actionId = actionDefinition.id;
        const actorId = actorEntity.id;
        const targetId = targetEntity ? targetEntity.id : null; // Extract ID, handle null target

        // --- Use Logger Exclusively (Removed console.log) ---
        this.#logger.debug(`PrerequisiteChecker: Starting check for action '${actionId}', actor '${actorId}', target '${targetId ?? 'None'}'.`);

        try {
            // --- Assemble Evaluation Context using createJsonLogicContext --- (AC3)
            const validationEvent = {
                type: 'ACTION_VALIDATION',
                payload: {actionId: actionId}
            };

            // Removed console.log
            this.#logger.debug(`PrerequisiteChecker: Assembling context for action '${actionId}'...`);

            /** @type {JsonLogicEvaluationContext} */
            const evaluationContext = createJsonLogicContext(
                validationEvent,
                actorId,
                targetId,
                this.#entityManager, // Use injected dependency
                this.#logger         // Use injected dependency
            );

            // Removed console.log - contextAssembler should handle its own debug logging via the passed logger if needed

            // --- Iterate Through Prerequisites --- (AC3)
            const prerequisites = actionDefinition.prerequisites || [];

            if (prerequisites.length === 0) {
                this.#logger.debug(`PrerequisiteChecker: No prerequisites defined for action '${actionId}'. Check PASSED.`);
                return true; // No prerequisites means success
            }

            this.#logger.debug(`PrerequisiteChecker: Checking ${prerequisites.length} prerequisite(s) for action '${actionId}'...`);

            for (const prerequisite of prerequisites) {
                const rule = prerequisite.logic;

                if (!rule || typeof rule !== 'object') {
                    this.#logger.warn(`PrerequisiteChecker: Skipping prerequisite in action '${actionId}' due to missing or invalid 'logic' property. Considering this a failure.`, {prerequisite});
                    return false; // Treat missing/invalid logic as failure
                }

                const ruleSummary = JSON.stringify(rule).substring(0, 100) + (JSON.stringify(rule).length > 100 ? '...' : '');
                this.#logger.debug(` -> Evaluating prerequisite rule: Type='${prerequisite.condition_type || 'N/A'}', Negate=${prerequisite.negate || false}. Rule snippet: ${ruleSummary}`);

                // Removed console.log

                // --- Call Evaluation Service --- (AC3)
                let prerequisitePassed = this.#jsonLogicEvaluationService.evaluate(rule, evaluationContext);

                // Handle optional negation
                if (prerequisite.negate === true) {
                    const originalResult = prerequisitePassed; // Store original for logging
                    prerequisitePassed = !prerequisitePassed;
                    this.#logger.debug(`    Rule evaluation result: ${originalResult}. Result negated due to 'negate: true'. Final result: ${prerequisitePassed}`);
                } else {
                    this.#logger.debug(`    Rule evaluation result: ${prerequisitePassed}`);
                }

                if (!prerequisitePassed) {
                    const failureMsg = prerequisite.failure_message || `Prerequisite check failed (type: ${prerequisite.condition_type || 'N/A'}).`;
                    this.#logger.debug(`Prerequisite Check FAILED for action '${actionId}'. Reason: ${failureMsg}`);
                    return false; // Prerequisite failed, stop checking
                }
            }

            // If loop completes without returning false, all prerequisites passed
            this.#logger.debug(`PrerequisiteChecker: All ${prerequisites.length} prerequisite(s) met for action '${actionId}'. Check PASSED.`);
            return true;

        } catch (error) {
            // --- Use Logger Exclusively (Removed console.error) ---
            // Catch errors during context assembly or unexpected issues during evaluation
            this.#logger.error(`PrerequisiteChecker: Unexpected error during prerequisite check for action '${actionId}':`, error); // Log the error object itself
            return false; // Treat unexpected errors as failure
        }
    }
} // End of PrerequisiteChecker class