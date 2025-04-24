// src/logic/contextAssembler.js

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./defs.js').GameEvent} GameEvent */
/** @typedef {import('./defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('./defs.js').JsonLogicEntityContext} JsonLogicEntityContext */
// +++ Add imports for the new function's parameters +++
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../models/actionTargetContext.js').ActionTargetContext} ActionTargetContext */


/** @typedef {string | number | null | undefined} EntityId */

/**
 * Creates a proxy-like object to dynamically access component data for a given entity.
 * When a property (componentTypeId) is accessed on this object, it uses the
 * EntityManager to fetch the actual component data. Returns null if the component
 * does not exist on the entity.
 *
 * Note: This uses dynamic property definition with getters to simulate the
 * dynamic lookup described in the JsonLogicEntityContext JSDoc without needing
 * a full ES6 Proxy (which might be overkill or have compatibility concerns).
 * JSON Logic typically accesses specific, known properties, making this approach viable.
 *
 * @param {string | number} entityId - The ID of the entity whose components are accessed.
 * @param {EntityManager} entityManager - The EntityManager instance to use for data fetching.
 * @param {ILogger} logger - Logger instance for diagnostics.
 * @returns {Object<string, object|null>} An object that allows dynamic fetching of component data.
 */
export function createComponentAccessor(entityId, entityManager, logger) {
    // *** Revised Approach: Use a Proxy for true dynamic access ***
    return new Proxy({}, {
        // --- GET Trap (Correct logic + Optional Logging) ---
        get: function (target, prop, receiver) {
            // <<<--- ADD TEMPORARY LOGGING HERE --->>>
            // console.log(`!!! ComponentAccessor GET Trap: EntityID=${entityId}, Prop=${String(prop)}`);
            // <<<------------------------------------>>>
            if (typeof prop === 'string') {
                if (prop === 'isProxy' || prop === 'then' || typeof prop === 'symbol') {
                    // console.log(`!!! ComponentAccessor GET Trap: Skipping special prop ${String(prop)}`);
                    return undefined;
                }
                // logger.debug(`ComponentAccessor: GET trap for prop [${String(prop)}] on entity [${entityId}]`); // Can be noisy
                try {
                    // <<<--- ADD TEMPORARY LOGGING HERE --->>>
                    // console.log(`!!! ComponentAccessor GET Trap: Calling getComponentData(${entityId}, ${String(prop)})`);
                    // <<<------------------------------------>>>
                    const componentData = entityManager.getComponentData(entityId, prop);
                    // console.log(`!!! ComponentAccessor GET Trap: Data for ${String(prop)}:`, componentData); // Be careful logging potentially large objects
                    return componentData ?? null; // Return data or null
                } catch (error) {
                    logger.error(`ComponentAccessor: Error fetching component [${String(prop)}] for entity [${entityId}]:`, error);
                    return null;
                }
            }
            // console.log(`!!! ComponentAccessor GET Trap: Reflect.get for non-string prop ${String(prop)}`);
            return Reflect.get(target, prop, receiver);
        },

        set: function (target, prop, value) {
            // (Your existing set trap is fine)
            logger.warn(`ComponentAccessor: Attempted to set property [${String(prop)}] on read-only accessor for entity [${entityId}]. Operation ignored.`);
            return false;
        },

        // --- HAS Trap (Corrected Logic) ---
        has: function (target, prop) {
            if (typeof prop === 'string') {
                // --- Correct logic for 'has' trap ---
                // logger.debug(`ComponentAccessor: HAS trap for prop [${String(prop)}] on entity [${entityId}]`); // Can be noisy
                try {
                    // Check existence using the correct EntityManager method
                    const exists = entityManager.hasComponent(entityId, prop);
                    // logger.debug(`ComponentAccessor: Existence check for [${String(prop)}]: ${exists}`); // Can be noisy
                    return exists; // Return boolean
                } catch (error) {
                    logger.error(`ComponentAccessor: Error checking component existence [${String(prop)}] for entity [${entityId}]:`, error);
                    return false; // Return false on error
                }
            }
            // Fallback for non-string properties
            return Reflect.has(target, prop);
        },

        // --- OWNKEYS Trap (Existing logic is likely okay) ---
        ownKeys: function (target) {
            // logger.debug(`ComponentAccessor: ownKeys trap invoked for entity [${entityId}]. Returning empty array.`); // Can be noisy
            return []; // Returning empty is often safest unless full enumeration is needed
        },

        // --- GETOWNPROPERTYDESCRIPTOR Trap (Relies on the now-fixed 'has' trap) ---
        getOwnPropertyDescriptor: function (target, prop) {
            // Now that 'this.has' is fixed, this *might* work correctly.
            // It attempts to create a descriptor if the component exists.
            // Note: Directly calling 'has' might cause issues in strict environments, use Reflect.has if needed
            const exists = Reflect.has(this, prop); // Safer way to call the trap internally

            if (typeof prop === 'string' && exists) { // Use the result of the 'has' trap
                // logger.debug(`ComponentAccessor: getOwnPropertyDescriptor trap for existing prop [${String(prop)}]`); // Can be noisy
                return {
                    // Using 'get' trap ensures consistency if data fetching is complex
                    // Note: Using 'this.get' might also be problematic, use Reflect.get
                    get: () => Reflect.get(this, prop, null), // Safer way to call the trap
                    set: undefined, // Read-only
                    enumerable: true, // Important for introspection
                    configurable: true // Usually true for proxy properties
                };
            }
            // logger.debug(`ComponentAccessor: getOwnPropertyDescriptor trap for non-string or non-existent prop [${String(prop)}]`); // Can be noisy
            // Fallback for non-string or non-existent properties
            return Reflect.getOwnPropertyDescriptor(target, prop);
        }
    });
}


/**
 * Assembles the data context object (`JsonLogicEvaluationContext`) needed for
 * evaluating JSON Logic rules within the system.
 *
 * @param {GameEvent} event - The triggering game event object.
 * @param {EntityId} actorId - The ID of the entity considered the 'actor' for this event, if applicable.
 * @param {EntityId} targetId - The ID of the entity considered the 'target' for this event, if applicable.
 * @param {EntityManager} entityManager - The EntityManager instance for retrieving entity data.
 * @param {ILogger} logger - Logger instance for diagnostics.
 * @returns {JsonLogicEvaluationContext} The assembled data context object.
 * @throws {Error} If required arguments like event, entityManager, or logger are missing.
 */
export function createJsonLogicContext(event, actorId, targetId, entityManager, logger) {
    // --- Argument Validation ---
    if (!event || typeof event !== 'object' || typeof event.type !== 'string') {
        throw new Error("createJsonLogicContext: Missing or invalid 'event' object.");
    }
    if (!entityManager || typeof entityManager.getComponentData !== 'function' || typeof entityManager.getEntityInstance !== 'function') {
        throw new Error("createJsonLogicContext: Missing or invalid 'entityManager' instance.");
    }
    if (!logger || typeof logger.debug !== 'function' || typeof logger.warn !== 'function' || typeof logger.error !== 'function') {
        throw new Error("createJsonLogicContext: Missing or invalid 'logger' instance.");
    }

    logger.debug(`Creating JsonLogicEvaluationContext for event type [${event.type}]. ActorID: [${actorId ?? 'None'}], TargetID: [${targetId ?? 'None'}]`);

    // --- Initialize Context Object ---
    /** @type {JsonLogicEvaluationContext} */
    const evaluationContext = {
        event: { // AC.3: Populate event property
            type: event.type,
            // Before: payload: event.payload || {}
            // After: Represent a truly missing payload as null, otherwise use the provided payload (even if it's {} or other falsy value except undefined)
            payload: event.payload === undefined ? null : event.payload
        },
        actor: null,  // Initialize as null
        target: null, // Initialize as null
        context: {},  // AC.6: Initialize context as an empty object
        globals: {},  // AC.7: Initialize globals placeholder
        entities: {}  // AC.7: Initialize entities placeholder (if needed later)
    };

    // --- Populate Actor --- (AC.4, AC.5, AC.9)
    if (actorId && (typeof actorId === 'string' || typeof actorId === 'number')) {
        try {
            const actorEntity = entityManager.getEntityInstance(actorId);
            if (actorEntity) {
                logger.debug(`Found actor entity [${actorId}]. Creating context entry.`);
                evaluationContext.actor = {
                    id: actorEntity.id, // Use the actual ID from the entity instance
                    components: createComponentAccessor(actorEntity.id, entityManager, logger)
                };
            } else {
                logger.warn(`Actor entity not found for ID [${actorId}]. Setting actor context to null.`);
            }
        } catch (error) {
            // Log specific error during actor lookup? Or let it propagate?
            logger.error(`Error processing actor ID [${actorId}] in createJsonLogicContext:`, error);
            throw error; // Re-throw for now
        }
    } else if (actorId) {
        logger.warn(`Invalid actorId type provided: [${typeof actorId}]. Setting actor context to null.`);
    }

    // --- Populate Target --- (AC.4, AC.5, AC.9)
    if (targetId && (typeof targetId === 'string' || typeof targetId === 'number')) {
        try {
            const targetEntity = entityManager.getEntityInstance(targetId);

            if (targetEntity) {
                logger.debug(`Found target entity [${targetId}]. Creating context entry.`);
                const componentsProxy = createComponentAccessor(targetEntity.id, entityManager, logger);
                evaluationContext.target = {
                    id: targetEntity.id,
                    components: componentsProxy // Assign the proxy
                };

            } else {
                logger.warn(`Target entity not found for ID [${targetId}]. Setting target context to null.`);
                // evaluationContext.target remains null
            }
        } catch (error) {
            logger.error(`Error processing target ID [${targetId}] in createJsonLogicContext:`, error);
            throw error; // Re-throw for now
        }
    } else if (targetId) {
        logger.warn(`Invalid targetId type provided: [${typeof targetId}]. Setting target context to null.`);
        // evaluationContext.target remains null
    } else {
        // No targetId provided, target context remains null (this is normal)
        logger.debug("No targetId provided, target context remains null.");
    }

    logger.debug("JsonLogicEvaluationContext assembled successfully.");
    return evaluationContext;
}
