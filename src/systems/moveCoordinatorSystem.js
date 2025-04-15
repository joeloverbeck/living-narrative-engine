// src/systems/moveCoordinatorSystem.js

// --- Type Imports for JSDoc ---
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./blockerSystem.js').default} BlockerSystem */
/** @typedef {import('./movementSystem.js').default} MovementSystem */
/** @typedef {import('../types/eventTypes.js').MoveAttemptedEventPayload} MoveAttemptedEventPayload */
/** @typedef {import('../types/eventTypes.js').ActionMoveFailedPayload} ActionMoveFailedPayload */
/** @typedef {import('./blockerSystem.js').BlockerCheckPayload} BlockerCheckPayload */
/** @typedef {import('./blockerSystem.js').BlockerCheckResult} BlockerCheckResult */
/** @typedef {import('./movementSystem.js').MoveExecutionPayload} MoveExecutionPayload */ // Assuming MovementSystem defines this type

/**
 * @class MoveCoordinatorSystem
 * @description Coordinates the process of entity movement attempts. It listens for
 * 'event:move_attempted', checks the target location, checks for potential blockers
 * using the BlockerSystem, and if the path is clear, instructs the MovementSystem
 * to execute the move. Includes top-level error handling for robustness. // <<< UPDATED JSDoc
 */
class MoveCoordinatorSystem {
    /** @type {EventBus} */
    #eventBus;
    /** @type {EntityManager} */
    #entityManager;
    /** @type {BlockerSystem} */
    #blockerSystem;
    /** @type {MovementSystem} */
    #movementSystem;

    /**
     * Constructs the MoveCoordinatorSystem.
     * @param {object} options - The dependencies for the system.
     * @param {EventBus} options.eventBus - The game's central event bus.
     * @param {EntityManager} options.entityManager - Manages game entities.
     * @param {BlockerSystem} options.blockerSystem - System responsible for checking movement blockers.
     * @param {MovementSystem} options.movementSystem - System responsible for executing the actual entity move.
     * @throws {Error} If any required dependency is missing.
     */
    constructor({ eventBus, entityManager, blockerSystem, movementSystem }) {
        if (!eventBus) {
            throw new Error("MoveCoordinatorSystem requires an EventBus dependency.");
        }
        if (!entityManager) {
            throw new Error("MoveCoordinatorSystem requires an EntityManager dependency.");
        }
        if (!blockerSystem) {
            throw new Error("MoveCoordinatorSystem requires a BlockerSystem dependency.");
        }
        if (!movementSystem) {
            throw new Error("MoveCoordinatorSystem requires a MovementSystem dependency.");
        }

        this.#eventBus = eventBus;
        this.#entityManager = entityManager;
        this.#blockerSystem = blockerSystem;
        this.#movementSystem = movementSystem;

        console.log("MoveCoordinatorSystem: Instance created.");
    }

    /**
     * Initializes the system by subscribing to relevant events.
     * Specifically, listens for 'event:move_attempted' to trigger the coordination logic.
     */
    initialize() {
        this.#eventBus.subscribe(
            'event:move_attempted',
            this.#handleMoveAttempted.bind(this)
        );
        console.log("MoveCoordinatorSystem: Initialized. Listening for 'event:move_attempted'.");
    }

    /**
     * Handles the 'event:move_attempted' event.
     * This is the entry point for the move coordination logic.
     * Step 1 (TRG-8.2): Check if the target location entity exists.
     * Step 2 (TRG-8.3): Check for blockers.
     * Step 3 (TRG-8.4): Execute move if clear (success path).
     * Step 4 (TRG-8.5): Handle move execution failure (if executeMove returns false).
     * Step 5 (TRG-8.6): Top-level error handling catches any unexpected errors during coordination. // <<< UPDATED JSDoc
     * @private
     * @async
     * @param {MoveAttemptedEventPayload} payload - The data associated with the move attempt event.
     * @returns {Promise<void>} Resolves when handling is complete (including error handling). // <<< UPDATED JSDoc
     */
    async #handleMoveAttempted(payload) {
        // --- Start Top-Level try...catch (TRG-8.6 Implementation) ---
        try {
            // --- AC 1: Scope - Entire method body wrapped ---
            const { entityId: actorId, direction, targetLocationId, previousLocationId, blockerEntityId } = payload;

            console.log(`MoveCoordinatorSystem: Handling move attempt for actor ${actorId} (Dir: ${direction}) towards location ${targetLocationId} from ${previousLocationId}.`);

            // --- Step 1: Check Target Location Existence (TRG-8.2) ---
            console.log(`MoveCoordinatorSystem: [Step 1] Checking existence of target location ${targetLocationId}...`);
            const targetLocationEntity = this.#entityManager.getEntityInstance(targetLocationId);

            if (!targetLocationEntity) {
                const reason = `The intended destination location entity (ID: ${targetLocationId}) does not exist or is not active.`;
                console.warn(`MoveCoordinatorSystem: [Step 1 Failed] Target location ${targetLocationId} not found for actor ${actorId}'s move attempt. Reason: ${reason}`);
                /** @type {ActionMoveFailedPayload} */
                const failurePayload = {
                    actorId: actorId, direction: direction, previousLocationId: previousLocationId,
                    attemptedTargetLocationId: targetLocationId, reasonCode: 'TARGET_LOCATION_NOT_FOUND', details: reason,
                    blockerDisplayName: null, blockerEntityId: null,
                };
                await this.#eventBus.dispatch('action:move_failed', failurePayload);
                return; // Exit early on handled failure
            }
            console.log(`MoveCoordinatorSystem: [Step 1 Succeeded] Target location ${targetLocationId} exists.`);
            // --- End Step 1 (TRG-8.2) ---


            // --- Step 2: Check for Blockers (TRG-8.3) ---
            console.log(`MoveCoordinatorSystem: [Step 2] Checking for blockers for actor ${actorId} moving ${direction}. Blocker ID specified: ${blockerEntityId ?? 'None'}.`);
            /** @type {BlockerCheckPayload} */
            const blockerCheckPayload = {
                entityId: actorId, previousLocationId: previousLocationId,
                direction: direction, blockerEntityId: blockerEntityId
            };
            const blockerResult = this.#blockerSystem.checkMovementBlock(blockerCheckPayload);

            if (blockerResult.blocked) {
                console.log(`MoveCoordinatorSystem: [Step 2 Failed] Movement blocked for actor ${actorId}. Blocker: ${blockerResult.blockerDisplayName ?? 'Unknown/Not Found'} (${blockerResult.blockerEntityId}). Reason: ${blockerResult.reasonCode} - ${blockerResult.details}`);
                /** @type {ActionMoveFailedPayload} */
                const failurePayload = {
                    actorId: actorId, direction: direction, previousLocationId: previousLocationId,
                    attemptedTargetLocationId: targetLocationId, reasonCode: blockerResult.reasonCode, details: blockerResult.details,
                    blockerDisplayName: blockerResult.blockerDisplayName, blockerEntityId: blockerResult.blockerEntityId
                };
                await this.#eventBus.dispatch('action:move_failed', failurePayload);
                console.log(`MoveCoordinatorSystem: Dispatched action:move_failed (${blockerResult.reasonCode}) for actor ${actorId} due to blocker.`);
                return; // Exit early on handled failure
            }
            console.log(`MoveCoordinatorSystem: [Step 2 Succeeded] Blocker check passed for actor ${actorId}. Path is clear. ${blockerResult.details ? `(${blockerResult.details})` : ''}`);
            // --- End Step 2 (TRG-8.3) ---


            // --- Step 3: Execute Movement & Handle Success/Failure (TRG-8.4 & TRG-8.5) ---
            console.log(`MoveCoordinatorSystem: [Step 3] Attempting to execute move for actor ${actorId} via MovementSystem.`);

            /** @type {MoveExecutionPayload} */
            const movePayload = {
                entityId: actorId,
                targetLocationId: targetLocationId,
                previousLocationId: previousLocationId,
                direction: direction
            };

            let moveSuccessful = false;
            try {
                // Attempt the move execution
                moveSuccessful = this.#movementSystem.executeMove(movePayload);
            } catch (error) { // Inner catch for executeMove errors
                console.error(`MoveCoordinatorSystem: [Step 3 Failed - Inner Catch] Unexpected error during MovementSystem.executeMove for actor ${actorId}:`, error);
                /** @type {ActionMoveFailedPayload} */
                const failurePayload = {
                    actorId: actorId, direction: direction, previousLocationId: previousLocationId,
                    attemptedTargetLocationId: targetLocationId, reasonCode: 'MOVE_EXECUTION_ERROR',
                    details: `An unexpected error occurred in MovementSystem during move execution: ${error.message}`,
                    blockerDisplayName: null, blockerEntityId: null,
                };
                await this.#eventBus.dispatch('action:move_failed', failurePayload);
                console.log(`MoveCoordinatorSystem: Dispatched action:move_failed (MOVE_EXECUTION_ERROR) for actor ${actorId}.`);
                return; // Exit early on handled failure (from inner catch)
            }

            // --- Handle executeMove Result ---
            if (moveSuccessful) { // TRG-8.4 Success Path
                console.log(`MoveCoordinatorSystem: [Step 3 Succeeded] MovementSystem reported successful execution for actor ${actorId}. Coordination complete (MovementSystem should dispatch event:entity_moved).`);
            } else { // TRG-8.5 Failure Path (executeMove returned false)
                const failureReason = `MovementSystem.executeMove returned false, indicating an internal error or condition prevented the move execution.`;
                console.error(`MoveCoordinatorSystem: [Step 4 Failed] Movement execution failed (executeMove returned false) for actor ${actorId}. Reason: ${failureReason}`);

                /** @type {ActionMoveFailedPayload} */
                const failurePayload = {
                    actorId: actorId,
                    direction: direction,
                    previousLocationId: previousLocationId,
                    attemptedTargetLocationId: targetLocationId,
                    reasonCode: 'MOVEMENT_EXECUTION_FAILED', // Specific code for executeMove returning false
                    details: failureReason,
                    blockerDisplayName: null,
                    blockerEntityId: null
                };
                await this.#eventBus.dispatch('action:move_failed', failurePayload);
                console.log(`MoveCoordinatorSystem: Dispatched action:move_failed (MOVEMENT_EXECUTION_FAILED) for actor ${actorId}.`);
            }
            // --- End Step 3 ---

            // --- Catch Block for Top-Level Errors (TRG-8.6 Implementation) ---
        } catch (error) {
            // AC 2: Log the error with context
            // Defensively access payload properties in case payload itself is invalid
            const actorId = payload?.entityId ?? 'Unknown Actor';
            const direction = payload?.direction ?? 'Unknown Direction';
            const targetLocationId = payload?.targetLocationId ?? 'Unknown Target';
            const previousLocationId = payload?.previousLocationId ?? 'Unknown Previous';
            let payloadString = 'Payload Unavailable';
            try {
                // Avoid circular structure issues if payload contains complex objects
                payloadString = JSON.stringify(payload, null, 2);
            } catch (stringifyError) {
                payloadString = `Payload could not be stringified: ${stringifyError.message}`;
            }

            console.error(`MoveCoordinatorSystem: [Top-Level Error Caught] Unexpected error during move attempt handling for actor ${actorId}. Error: ${error.message}`, { error, stack: error.stack, payloadString });

            // AC 4: Prepare failure payload
            /** @type {ActionMoveFailedPayload} */
            const failurePayload = {
                actorId: actorId,
                direction: direction,
                previousLocationId: previousLocationId,
                attemptedTargetLocationId: targetLocationId,
                reasonCode: 'COORDINATOR_INTERNAL_ERROR', // Specific reason code
                details: `Unexpected error in MoveCoordinatorSystem: ${error.message}`,
                blockerDisplayName: null,
                blockerEntityId: null
            };

            // AC 3: Dispatch failure event asynchronously
            try {
                await this.#eventBus.dispatch('action:move_failed', failurePayload);
                console.log(`MoveCoordinatorSystem: Dispatched action:move_failed (COORDINATOR_INTERNAL_ERROR) for actor ${actorId}.`);
            } catch (dispatchError) {
                // Log critically if dispatching the error event itself fails
                console.error(`MoveCoordinatorSystem: [Critical] Failed to dispatch COORDINATOR_INTERNAL_ERROR event after catching top-level error. Dispatch Error: ${dispatchError.message}`, { originalError: error, dispatchError });
            }

            // AC 5: Error is contained. Do not re-throw. Method completes here.
        }
    } // End #handleMoveAttempted

} // End class MoveCoordinatorSystem

export default MoveCoordinatorSystem;