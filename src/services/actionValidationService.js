// src/services/actionValidationService.js

// --- Type Imports ---
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../validation/componentRequirementChecker.js').ComponentRequirementChecker} ComponentRequirementChecker */
/** @typedef {import('../validation/domainContextCompatibilityChecker.js').DomainContextCompatibilityChecker} DomainContextCompatibilityChecker */
/** @typedef {import('../validation/prerequisiteChecker.js').PrerequisiteChecker} PrerequisiteChecker */
/** @typedef {import('../types/actionDefinition.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */

// --- Model Imports ---
import {ActionTargetContext} from '../models/actionTargetContext.js'; // Already present

// --- Helper Imports ---
// Checkers are injected via constructor.

/**
 * Service responsible for validating if a specific action is currently valid
 * for a given actor and target context, based on the game state and action definitions.
 * It orchestrates checks by delegating to specialized services:
 * - ComponentRequirementChecker (for actor and target components)
 * - DomainContextCompatibilityChecker (for target domain/context type match)
 * - PrerequisiteChecker (for JSON Logic prerequisites)
 */
export class ActionValidationService {
    /** @private @type {EntityManager} */
    #entityManager;
    // REMOVED: #gameDataRepository field
    /** @private @type {ILogger} */
    #logger;
    // REMOVED: #jsonLogicEvaluationService field
    /** @private @type {ComponentRequirementChecker} */
    #componentRequirementChecker;
    /** @private @type {DomainContextCompatibilityChecker} */
    #domainContextCompatibilityChecker;
    /** @private @type {PrerequisiteChecker} */
    #prerequisiteChecker;


    /**
     * Creates an instance of ActionValidationService.
     * @param {object} dependencies - The required dependencies.
     * @param {EntityManager} dependencies.entityManager - Service to access entity instances and component data.
     * @param {ILogger} dependencies.logger - Logger service instance.
     * @param {ComponentRequirementChecker} dependencies.componentRequirementChecker - Service to check entity component requirements.
     * @param {DomainContextCompatibilityChecker} dependencies.domainContextCompatibilityChecker - Service to check domain/context compatibility.
     * @param {PrerequisiteChecker} dependencies.prerequisiteChecker - Service to check action prerequisites.
     * @throws {Error} If any required dependency is missing or invalid.
     */
    constructor({
                    entityManager,
                    logger,
                    componentRequirementChecker,
                    domainContextCompatibilityChecker,
                    prerequisiteChecker
                }) {
        // --- Dependency Validation ---
        if (!entityManager || typeof entityManager.getEntityInstance !== 'function') {
            throw new Error("ActionValidationService requires a valid EntityManager instance.");
        }
        // REMOVED: Dependency check for gameDataRepository
        if (!logger || typeof logger.debug !== 'function' || typeof logger.error !== 'function') {
            throw new Error("ActionValidationService requires a valid ILogger instance.");
        }
        // REMOVED: Dependency check for jsonLogicEvaluationService
        if (!componentRequirementChecker || typeof componentRequirementChecker.check !== 'function') {
            throw new Error("ActionValidationService requires a valid ComponentRequirementChecker instance.");
        }
        if (!domainContextCompatibilityChecker || typeof domainContextCompatibilityChecker.check !== 'function') {
            throw new Error("ActionValidationService requires a valid DomainContextCompatibilityChecker instance.");
        }
        if (!prerequisiteChecker || typeof prerequisiteChecker.check !== 'function') {
            throw new Error("ActionValidationService requires a valid PrerequisiteChecker instance.");
        }

        // --- Assign Dependencies ---
        this.#entityManager = entityManager;
        this.#logger = logger;
        this.#componentRequirementChecker = componentRequirementChecker;
        this.#domainContextCompatibilityChecker = domainContextCompatibilityChecker;
        this.#prerequisiteChecker = prerequisiteChecker;

        this.#logger.info("ActionValidationService initialized with required dependencies (EntityManager, 3 Checkers, Logger).");
    }

    /**
     * Checks if a given action is valid for the specified actor and target context.
     * Orchestrates validation by calling specialized checker services in sequence:
     * 1. Actor Component Check
     * 2. Domain/Context Compatibility Check
     * 3. Target Resolution & Component Check (if applicable)
     * 4. Prerequisite Check
     *
     * @param {ActionDefinition} actionDefinition - The definition object of the action to validate. Must be valid.
     * @param {Entity} actorEntity - The entity instance performing the action. Must be valid.
     * @param {ActionTargetContext} targetContext - The context object describing the action's target. Must be valid.
     * @returns {boolean} True if the action is deemed valid according to all checks, false otherwise.
     * @throws {Error} If critical input parameters (actionDefinition, actorEntity, targetContext) are missing or structurally invalid.
     */
    isValid(actionDefinition, actorEntity, targetContext) {
        // --- ADD Log: Entry ---
        console.log(`[AVS.isValid] START: Action '${actionDefinition?.id}', Actor '${actorEntity?.id}', Target Type '${targetContext?.type}', Target ID/Dir '${targetContext?.entityId ?? targetContext?.direction ?? 'N/A'}'`);

        // --- Critical Input Validation --- (Keep existing)
        if (!actionDefinition || typeof actionDefinition.id !== 'string' || !actionDefinition.id.trim()) {
            const errorMsg = "ActionValidationService.isValid: Missing or invalid actionDefinition.";
            this.#logger.error(errorMsg, {actionDefinition});
            console.error("[AVS.isValid] CRITICAL FAILURE: Invalid actionDefinition input."); // Added console log
            throw new Error(errorMsg);
        }
        if (!actorEntity || typeof actorEntity.id !== 'string' || !actorEntity.id.trim() || typeof actorEntity.hasComponent !== 'function') {
            const errorMsg = `ActionValidationService.isValid: Missing or invalid actorEntity object for action '${actionDefinition.id}'.`;
            this.#logger.error(errorMsg, {actorEntity});
            console.error("[AVS.isValid] CRITICAL FAILURE: Invalid actorEntity input."); // Added console log
            throw new Error(errorMsg);
        }
        if (!targetContext || !(targetContext instanceof ActionTargetContext)) {
            const errorMsg = `ActionValidationService.isValid: Missing or invalid targetContext object for action '${actionDefinition.id}'. Expected instance of ActionTargetContext.`;
            this.#logger.error(errorMsg, {targetContext});
            console.error("[AVS.isValid] CRITICAL FAILURE: Invalid targetContext input."); // Added console log
            throw new Error(errorMsg);
        }
        // --- End Input Validation ---

        const actionId = actionDefinition.id;
        const actorId = actorEntity.id;
        let targetEntity = null; // Resolved in Step 3 if needed

        this.#logger.debug(`START Validation: Action '${actionId}' for actor '${actorId}', contextType '${targetContext.type}', targetId/Dir '${targetContext.entityId ?? targetContext.direction ?? 'N/A'}'`);

        try {
            // --- ADD Log: Entering Try Block ---
            console.log(`[AVS.isValid] Entering TRY block for action '${actionId}'`);

            // --- STEP 1: Actor Component Requirement Checks ---
            this.#logger.debug(` -> STEP 1: Checking Actor Components...`);
            const step1Passed = this.#componentRequirementChecker.check(
                actorEntity,
                actionDefinition.actor_required_components,
                actionDefinition.actor_forbidden_components,
                'actor',
                `action '${actionId}' actor requirements`
            );
            // --- ADD Log: After Step 1 Check ---
            console.log(`[AVS.isValid] Step 1 (Actor Components) Result: ${step1Passed}`);
            if (!step1Passed) {
                this.#logger.debug(` <- STEP 1 FAILED: Actor Component Check.`);
                return false; // Exit early
            }
            this.#logger.debug(` -> STEP 1 PASSED.`);


            // --- STEP 2: Target Domain / Context Type Compatibility Checks ---
            this.#logger.debug(` -> STEP 2: Checking Domain/Context Compatibility...`);
            let step2aPassed = true; // Assume pass initially

            // --- MODIFICATION START ---
            const expectedDomain = actionDefinition.target_domain || 'none';
            // Only run the domain compatibility check if:
            // 1. The target context is NOT 'none' (meaning we are checking a specific target)
            // OR 2. The target context IS 'none', AND the action's expected domain is also 'none'.
            if (targetContext.type !== 'none' || expectedDomain === 'none') {
                step2aPassed = this.#domainContextCompatibilityChecker.check(actionDefinition, targetContext);
                console.log(`[AVS.isValid] Step 2a (Domain/Context Compatibility) Result [Check Ran]: ${step2aPassed}`);
                if (!step2aPassed) {
                    this.#logger.debug(` <- STEP 2 FAILED: Domain/Context Check (Initial Compatibility).`);
                    return false; // Exit early if check ran and failed
                }
            } else {
                // If context is 'none' but domain requires something else (e.g., 'environment'),
                // skip this check during the initial phase. It will be checked properly later
                // when isValid is called again with the specific target context ('entity', 'direction').
                console.log(`[AVS.isValid] Step 2a (Domain/Context Compatibility) SKIPPED (Initial actor check vs non-'none' domain)`);
                // step2aPassed remains true because the check was intentionally skipped here.
            }


            let step2bPassed = true; // Assume pass unless 'self' check fails
            if (expectedDomain === 'self' && targetContext.type === 'entity' && targetContext.entityId !== actorId) {
                step2bPassed = false;
                // --- ADD Log: After Step 2b Check ---
                console.log(`[AVS.isValid] Step 2b ('self' domain check) Result: ${step2bPassed} (Target: ${targetContext.entityId}, Actor: ${actorId})`);
                this.#logger.debug(` <- STEP 2 FAILED: Domain/Context Check ('self' target mismatch). Action requires target self (${actorId}), but context target is ${targetContext.entityId}.`);
                return false; // Exit early
            }

            // --- ADD Log: After Step 2b Check (if not failed) ---
            if (step2bPassed) console.log(`[AVS.isValid] Step 2b ('self' domain check) Result: ${step2bPassed} (Not applicable or passed)`);
            this.#logger.debug(` -> STEP 2 PASSED.`);


            // --- STEP 3: Target Entity Resolution and Component Checks (Conditional) ---
            this.#logger.debug(` -> STEP 3: Resolving/Checking Target Entity (if applicable)...`);
            if (targetContext.type === 'entity') {
                // --- ADD Log: Entering Step 3 Logic ---
                console.log(`[AVS.isValid] Entering Step 3 logic (targetContext.type is 'entity')`);

                const targetEntityId = targetContext.entityId;
                if (!targetEntityId) {
                    // --- ADD Log: Missing targetEntityId ---
                    console.error(`[AVS.isValid] Step 3 Error: Context type is 'entity' but entityId is missing for action '${actionId}'.`);
                    this.#logger.error(`Action Validation Internal Error (Step 3): Context type is 'entity' but entityId is missing for action '${actionId}'.`);
                    return false; // Exit early
                }

                // Step 3a: Resolve Target Entity (Uses EntityManager directly)
                // --- ADD Log: Before getEntityInstance ---
                console.log(`[AVS.isValid] Step 3a: Attempting to resolve target entity ID: '${targetEntityId}'`);
                targetEntity = this.#entityManager.getEntityInstance(targetEntityId); // Use direct dependency
                // --- ADD Log: After getEntityInstance ---
                console.log(`[AVS.isValid] Step 3a: Resolved targetEntity: ${targetEntity ? `'${targetEntity.id}'` : 'null'}`);

                if (!targetEntity) {
                    // --- ADD Log: Target Resolution Failed ---
                    console.log(`[AVS.isValid] Step 3a: Target entity resolution FAILED.`);
                    this.#logger.debug(` <- STEP 3a FAILED: Target entity '${targetEntityId}' not found or inactive.`);
                    return false; // Exit early
                }
                this.#logger.debug(` -> STEP 3a PASSED: Target entity '${targetEntityId}' resolved.`);

                // Step 3b: Target Component Check (Delegate to checker)
                const step3bPassed = this.#componentRequirementChecker.check(
                    targetEntity,
                    actionDefinition.target_required_components,
                    actionDefinition.target_forbidden_components,
                    'target',
                    `action '${actionId}' target requirements`
                );
                // --- ADD Log: After Step 3b Check ---
                console.log(`[AVS.isValid] Step 3b (Target Components) Result: ${step3bPassed}`);
                if (!step3bPassed) {
                    this.#logger.debug(` <- STEP 3b FAILED: Target Component Check.`);
                    return false; // Exit early
                }
                this.#logger.debug(` -> STEP 3b PASSED.`);
                this.#logger.debug(` -> STEP 3 PASSED (Target resolved & components OK).`);

            } else {
                // --- ADD Log: Skipped Step 3 ---
                console.log(`[AVS.isValid] Step 3 SKIPPED (Context type: '${targetContext.type}')`);
                this.#logger.debug(` -> STEP 3 SKIPPED (Context type: '${targetContext.type}').`);
            }

            // --- STEP 4: Prerequisite Checks ---
            // Delegate check to the specialized service, passing resolved targetEntity
            this.#logger.debug(` -> STEP 4: Checking Prerequisites...`);
            // --- ADD Log: Before Prerequisite Check ---
            console.log(`[AVS.isValid] Step 4: About to call prerequisiteChecker.check for action '${actionId}'`);
            const step4Passed = this.#prerequisiteChecker.check(actionDefinition, actorEntity, targetEntity); // Assuming PrerequisiteChecker also has console logs now
            // --- ADD Log: After Prerequisite Check ---
            console.log(`[AVS.isValid] Step 4 (Prerequisites) Result: ${step4Passed}`);
            if (!step4Passed) {
                this.#logger.debug(` <- STEP 4 FAILED: Prerequisite Check.`);
                return false; // Exit early
            }
            this.#logger.debug(` -> STEP 4 PASSED.`);


            // --- STEP 5: Placeholder for Additional Domain-Specific Validation ---
            this.#logger.debug(` -> STEP 5: Placeholder check...`);
            console.log(`[AVS.isValid] Step 5: Placeholder check passed.`); // Added console log
            this.#logger.debug(` -> STEP 5 PASSED.`);


            // --- All Checks Passed ---
            // --- ADD Log: All Passed ---
            console.log(`[AVS.isValid] END: PASSED for action '${actionId}'.`);
            this.#logger.debug(`END Validation: PASSED for action '${actionId}'.`);
            return true;

        } catch (error) {
            // --- ADD Log: Caught Error ---
            console.error(`[AVS.isValid] !!! CAUGHT UNEXPECTED ERROR during validation for action '${actionId}' (actor '${actorId}'):`, error);
            this.#logger.error(`Unexpected error during validation process for action '${actionId}' (actor '${actorId}'):`, error);
            this.#logger.debug(`END Validation: FAILED due to unexpected error.`);
            return false; // Exit due to error
        }
    }

} // End of ActionValidationService class