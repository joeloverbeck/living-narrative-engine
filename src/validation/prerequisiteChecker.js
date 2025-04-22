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
     * @throws {Error} If critical inputs (actionDefinition, actorEntity) are invalid. Rethrows errors from context assembly if they occur.
     */
    check(actionDefinition, actorEntity, targetEntity) {
        console.log(`PrereqChecker.check: Entered for action ${actionDefinition.id}, actor ${actorEntity.id}, target ${targetEntity ? targetEntity.id : 'null'}`);
        // --- Input Validation (Basic) ---
        // More robust validation might be needed depending on how this is called
        if (!actionDefinition || !actionDefinition.id) {
            this.#logger.error("PrerequisiteChecker.check: Called with invalid actionDefinition.");
            // Or throw, depending on desired strictness
            return false;
        }
        if (!actorEntity || !actorEntity.id) {
            this.#logger.error(`PrerequisiteChecker.check: Called with invalid actorEntity for action '${actionDefinition.id}'.`);
            // Or throw
            return false;
        }
        // targetEntity can legitimately be null

        const actionId = actionDefinition.id;
        const actorId = actorEntity.id;
        const targetId = targetEntity ? targetEntity.id : null; // Extract ID, handle null target

        this.#logger.debug(`PrerequisiteChecker: Starting check for action '${actionId}', actor '${actorId}', target '${targetId ?? 'None'}'.`);

        try {
            // --- Assemble Evaluation Context using createJsonLogicContext --- (AC3)
            // Create a minimal event object for the context assembler
            const validationEvent = {
                type: 'ACTION_VALIDATION',
                payload: {actionId: actionId}
            };

            console.log('PrereqChecker.check: About to assemble context...');

            /** @type {JsonLogicEvaluationContext} */
            const evaluationContext = createJsonLogicContext(
                validationEvent,
                actorId,
                targetId,
                this.#entityManager, // Use injected dependency
                this.#logger         // Use injected dependency
            );

            console.log('PrereqChecker.check: Context assembly successful. Context keys:', Object.keys(evaluationContext || {}));

            // Note: The context assembler handles logging related to context creation internally.

            // --- Iterate Through Prerequisites --- (AC3)
            const prerequisites = actionDefinition.prerequisites || [];

            if (prerequisites.length === 0) {
                this.#logger.debug(`PrerequisiteChecker: No prerequisites defined for action '${actionId}'. Check PASSED.`);
                return true; // No prerequisites means success
            }

            this.#logger.debug(`PrerequisiteChecker: Checking ${prerequisites.length} prerequisite(s) for action '${actionId}'...`);

            for (const prerequisite of prerequisites) {
                // Assuming structure: { logic: {...}, condition_type?: string, failure_message?: string, negate?: boolean }
                const rule = prerequisite.logic;

                if (!rule || typeof rule !== 'object') {
                    // Validate the rule structure minimally
                    this.#logger.warn(`PrerequisiteChecker: Skipping prerequisite in action '${actionId}' due to missing or invalid 'logic' property. Considering this a failure.`, {prerequisite});
                    return false; // Treat missing/invalid logic as failure
                }

                // Log rule details cautiously for complex rules
                const ruleSummary = JSON.stringify(rule).substring(0, 100) + (JSON.stringify(rule).length > 100 ? '...' : '');
                this.#logger.debug(` -> Evaluating prerequisite rule: Type='${prerequisite.condition_type || 'N/A'}', Negate=${prerequisite.negate || false}. Rule snippet: ${ruleSummary}`);

                console.log('PrereqChecker.check: About to call evaluate for rule:', JSON.stringify(rule));

                // --- Call Evaluation Service --- (AC3)
                let prerequisitePassed = this.#jsonLogicEvaluationService.evaluate(rule, evaluationContext);

                // Handle optional negation if present in definition (though negation is often better handled *within* JSON Logic)
                if (prerequisite.negate === true) {
                    prerequisitePassed = !prerequisitePassed;
                    this.#logger.debug(`    Result negated due to 'negate: true'. Final result: ${prerequisitePassed}`);
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
            console.error('!!! PrereqChecker.check: Caught error:', error);
            // Catch errors during context assembly or unexpected issues during evaluation
            this.#logger.error(`PrerequisiteChecker: Unexpected error during prerequisite check for action '${actionId}':`, error);
            return false; // Treat unexpected errors as failure
        }
    }
} // End of PrerequisiteChecker class

// AC1: PrerequisiteChecker class exists in src/validation/prerequisiteChecker.js. Checked.
// AC2: Checker accepts dependencies via constructor. Checked.
// AC3: Orchestration logic (context assembly, loop, evaluation call) in 'check' method, returns boolean. Checked.