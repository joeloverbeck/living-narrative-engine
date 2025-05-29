// src/core/turns/factories/ConcreteTurnStateFactory.js
// ──────────────────────────────────────────────────────────────────────────────

import {ITurnStateFactory} from '../interfaces/ITurnStateFactory.js';
import {TurnIdleState} from '../states/turnIdleState.js';
import {TurnEndingState} from '../states/turnEndingState.js';
import {AwaitingPlayerInputState} from '../states/awaitingPlayerInputState.js'; // If creating this state too

/**
 * @typedef {import('../handlers/baseTurnHandler.js').BaseTurnHandler} BaseTurnHandler
 * @typedef {import('../interfaces/ITurnState.js').ITurnState} ITurnState
 */

/**
 * @class ConcreteTurnStateFactory
 * @implements {ITurnStateFactory}
 * @description
 * Concrete factory for creating various turn state instances.
 */
export class ConcreteTurnStateFactory extends ITurnStateFactory {
    /**
     * @override
     */
    createInitialState(handler) {
        return new TurnIdleState(handler); // Typically, initial state is Idle
    }

    /**
     * @override
     */
    createIdleState(handler) {
        return new TurnIdleState(handler);
    }

    /**
     * @override
     */
    createEndingState(handler, actorId, error) {
        return new TurnEndingState(handler, actorId, error);
    }

    /**
     * @override
     */
    createAwaitingInputState(handler) {
        return new AwaitingPlayerInputState(handler);
    }
}

// --- FILE END ---