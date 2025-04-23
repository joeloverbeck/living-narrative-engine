// ────────────────────────────────────────────────────────────────────────────────
// src/services/actionValidationService.js  – all tests green
// ────────────────────────────────────────────────────────────────────────────────

/* type-only imports removed for brevity */
import {ActionTargetContext} from '../models/actionTargetContext.js';

export class ActionValidationService {
    #entityManager;
    #logger;
    #domainContextCompatibilityChecker;
    #jsonLogicEvaluationService;
    #createActionValidationContext;

    /**
     * @param {{
     *   entityManager: import('../entities/entityManager.js').default,
     *   logger:        import('../core/interfaces/coreServices.js').ILogger,
     *   domainContextCompatibilityChecker: import('../validation/domainContextCompatibilityChecker.js').DomainContextCompatibilityChecker,
     *   jsonLogicEvaluationService: import('../logic/JsonLogicEvaluationService.js').default,
     *   createActionValidationContextFunction: import('../logic/createActionValidationContext.js').createActionValidationContext
     * }} deps
     */
    constructor({
                    entityManager,
                    logger,
                    domainContextCompatibilityChecker,
                    jsonLogicEvaluationService,
                    createActionValidationContextFunction,
                }) {
        if (!entityManager?.getEntityInstance)
            throw new Error('ActionValidationService requires a valid EntityManager.');
        if (!logger?.debug || !logger?.error)
            throw new Error('ActionValidationService requires a valid ILogger.');
        if (!domainContextCompatibilityChecker?.check)
            throw new Error('ActionValidationService requires a valid DomainContextCompatibilityChecker.');
        if (!jsonLogicEvaluationService?.evaluate)
            throw new Error('ActionValidationService requires a valid JsonLogicEvaluationService.');
        if (typeof createActionValidationContextFunction !== 'function')
            throw new Error('ActionValidationService requires createActionValidationContextFunction (fn).');

        this.#entityManager = entityManager;
        this.#logger = logger;
        this.#domainContextCompatibilityChecker = domainContextCompatibilityChecker;
        this.#jsonLogicEvaluationService = jsonLogicEvaluationService;
        this.#createActionValidationContext = createActionValidationContextFunction;

        this.#logger.info('ActionValidationService initialised.');
    }

    /**
     * @param {import('../types/actionDefinition.js').ActionDefinition} actionDefinition
     * @param {import('../entities/entity.js').default}                 actorEntity
     * @param {ActionTargetContext}                                     targetContext
     * @returns {boolean}
     */
    isValid(actionDefinition, actorEntity, targetContext) {
        // ─── 0 Structural sanity ────────────────────────────────────────────────
        if (!actionDefinition?.id?.trim())
            throw new Error('ActionValidationService.isValid: invalid actionDefinition');
        if (!actorEntity?.id?.trim())
            throw new Error('ActionValidationService.isValid: invalid actorEntity');
        if (!(targetContext instanceof ActionTargetContext))
            throw new Error('ActionValidationService.isValid: targetContext must be ActionTargetContext');

        const actionId = actionDefinition.id;
        const actorId = actorEntity.id;

        this.#logger.debug(
            `START Validation: action='${actionId}', actor='${actorId}', ctxType='${targetContext.type}', target='${targetContext.entityId ?? targetContext.direction ?? 'none'}'`,
        );

        try {
            // ─── 1 Domain / context compatibility ───────────────────────────────
            const expectedDomain = actionDefinition.target_domain || 'none';

            if (
                (targetContext.type !== 'none' || expectedDomain === 'none') &&
                !this.#domainContextCompatibilityChecker.check(actionDefinition, targetContext)
            ) {
                this.#logger.debug(' ← STEP 1 FAILED (domain/context).');
                return false;
            }

            if (
                expectedDomain === 'self' &&
                targetContext.type === 'entity' &&
                targetContext.entityId !== actorId
            ) {
                this.#logger.debug(' ← STEP 1 FAILED (self mismatch).');
                return false;
            }

            this.#logger.debug(' → STEP 1 PASSED.');

            // ─── 2 Resolve actor & (optional) target entities ───────────────────
            const resolvedActor =
                this.#entityManager.getEntityInstance(actorId) ?? actorEntity;

            if (targetContext.type === 'entity') {
                const targetEntity = this.#entityManager.getEntityInstance(
                    targetContext.entityId,
                );
                if (!targetEntity) {
                    this.#logger.error(
                        `Prerequisite Check FAILED: Required target entity '${targetContext.entityId}' could not be resolved for action '${actionId}'.`,
                    );
                    return false;
                }
            }

            // ─── 3 Collect prerequisites array (may be empty) ───────────────────
            let prerequisites = [];
            if (Array.isArray(actionDefinition.prerequisites)) {
                prerequisites = actionDefinition.prerequisites;
            } else if ('prerequisites' in actionDefinition) {
                this.#logger.warn(
                    `Action '${actionId}' has a 'prerequisites' property, but it's not an array. Skipping prerequisite check.`,
                );
            }

            // ─── 4 Build evaluation context when required ───────────────────────
            const mustBuildCtx =
                targetContext.type !== 'none' || prerequisites.length > 0;

            /** @type {import('../logic/defs.js').JsonLogicEvaluationContext | undefined} */
            let evalCtx;
            if (mustBuildCtx) {
                try {
                    evalCtx = this.#createActionValidationContext(
                        resolvedActor,
                        targetContext,
                        this.#entityManager,
                        this.#logger,
                    );
                } catch (err) {
                    this.#logger.error('Error assembling evaluation context', {
                        error: err.message,
                        stack: err.stack,
                    });
                    return false;
                }
            }

            // ─── 5 If there are no rules, we’re done ────────────────────────────
            if (!prerequisites.length) {
                this.#logger.debug('No prerequisites to evaluate. Skipping STEP 2.');
                this.#logger.debug(`END Validation: PASSED for action '${actionId}'.`);
                return true;
            }

            // ─── 6 Evaluate prerequisite rules ──────────────────────────────────
            for (const prereq of prerequisites) {
                const rule = prereq.logic;
                if (!rule || typeof rule !== 'object' || Array.isArray(rule)) {
                    this.#logger.warn(
                        `Prerequisite on action '${actionId}' has invalid 'logic': ${JSON.stringify(rule)}`,
                    );
                    return false;
                }

                let pass = this.#jsonLogicEvaluationService.evaluate(rule, evalCtx);
                if (prereq.negate) pass = !pass;

                if (!pass) {
                    this.#logger.debug('STEP 2 FAILED: Prerequisite check FAILED');
                    if (prereq.failure_message)
                        this.#logger.debug(`Reason: ${prereq.failure_message}`);
                    return false;
                }
            }

            // ─── 7 Placeholder for extra hooks ──────────────────────────────────
            this.#logger.debug(`END Validation: PASSED for action '${actionId}'.`);
            return true;
        } catch (err) {
            this.#logger.error(
                `Unexpected error while validating action '${actionId}' for actor '${actorId}': ${err.message}`,
                {stack: err.stack},
            );
            return false;
        }
    }
}