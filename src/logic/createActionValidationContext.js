/** type imports omitted for brevity */
import {createComponentAccessor} from './contextAssembler.js';

/**
 * Builds the JsonLogic-friendly context object used by the action-validation engine.
 * @param {import('../entities/entity.js').default} actorEntity
 * @param {import('../models/actionTargetContext.js').ActionTargetContext} targetContext
 * @param {import('../entities/entityManager.js').default} entityManager
 * @param {import('../core/interfaces/coreServices.js').ILogger} logger
 */
export function createActionValidationContext(actorEntity, targetContext, entityManager, logger) {
    /*──────────────────────
     * 1. Parameter guards
     *──────────────────────*/
    if (!actorEntity?.id?.trim() || typeof actorEntity.hasComponent !== 'function') {
        throw new Error('createActionValidationContext: invalid actorEntity');
    }
    if (!targetContext?.type) {
        throw new Error('createActionValidationContext: invalid targetContext');
    }
    if (typeof entityManager?.getEntityInstance !== 'function') {
        throw new Error('createActionValidationContext: invalid entityManager');
    }
    const {debug, warn, error} = logger ?? {};
    if (typeof debug !== 'function' ||
        typeof warn !== 'function' ||
        typeof error !== 'function') {
        throw new Error('createActionValidationContext: invalid logger');
    }

    debug(`Creating ActionValidationContext (actor='${actorEntity.id}', ctxType='${targetContext.type}').`);

    /*──────────────────────
     * 2. Actor accessor
     *──────────────────────*/
    let actorAccessor;
    try {
        actorAccessor = createComponentAccessor(actorEntity.id, entityManager, logger);
    } catch (err) {
        error(`Error creating component accessor for actor ID [${actorEntity.id}]`, err);
        throw err;                              // preserve original message for the tests
    }

    /** @type {import('./defs.js').JsonLogicEvaluationContext} */
    const ctx = {
        actor: {id: actorEntity.id, components: actorAccessor},
        target: null,
        event: null,
        context: {},
        globals: {},
        entities: {},
    };

    /*──────────────────────
     * 3. Target processing
     *──────────────────────*/
    if (targetContext.type === 'entity' &&
        typeof targetContext.entityId === 'string' &&
        targetContext.entityId.trim()) {

        const targetId = targetContext.entityId;

        // 3a. Look the entity up
        let targetEntity;
        try {
            targetEntity = entityManager.getEntityInstance(targetId);
        } catch (err) {
            error(`Error processing target ID [${targetId}]`, err);
            throw new Error(`Failed processing target entity ${targetId}: ${err.message}`);
        }

        // 3b. If found, build its accessor
        if (targetEntity) {
            try {
                const targetAccessor =
                    createComponentAccessor(targetEntity.id, entityManager, logger);
                ctx.target = {id: targetEntity.id, components: targetAccessor};
            } catch (err) {
                error(`Error processing target ID [${targetId}]`, err);
                throw err;                       // tests expect the original error message
            }
        } else {
            ctx.target = null;                   // not found → leave null
        }
    }
    /*──────────────────────
     * 4. Done
     *──────────────────────*/
    debug('ActionValidationContext assembled.');
    return ctx;
}