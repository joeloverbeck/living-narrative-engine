// src/tests/core/turns/fsm/turnStateMachine.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';

// --- Module to Test ---
import TurnStateMachine from '../../../../core/turns/fsm/turnStateMachine.js';

// --- Dependencies ---
import TurnState from '../../../../core/turns/fsm/turnState.js';
import TurnDirective from '../../../../core/constants/turnDirectives.js';

// --- Helper Functions for Events ---
/** @typedef {import('./turnEvents.js').TurnEvent} TurnEvent */

/** @type {(actorId: string) => import('./turnEvents.js').TurnEvent_START} */
const createStartEvent = (actorId) => ({ type: 'START', payload: { actorId } });

/** @type {() => import('./turnEvents.js').TurnEvent_PROMPT_SUCCESS} */
const createPromptSuccessEvent = () => ({ type: 'PROMPT_SUCCESS' });

/** @type {(error: Error) => import('./turnEvents.js').TurnEvent_PROMPT_FAILURE} */
const createPromptFailureEvent = (error = new Error('Prompt failed')) => ({ type: 'PROMPT_FAILURE', payload: { error } });

/** @type {(commandString: string) => import('./turnEvents.js').TurnEvent_COMMAND} */
const createCommandEvent = (commandString) => ({ type: 'COMMAND', payload: { commandString } });

/** @type {(directive: TurnDirective[keyof TurnDirective]) => import('./turnEvents.js').TurnEvent_PROCESS_RESULT} */
const createProcessResultEvent = (directive) => ({ type: 'PROCESS_RESULT', payload: { directive } });

/** @type {(reason?: any) => import('./turnEvents.js').TurnEvent_FORCE_END} */
const createForceEndEvent = (reason) => ({ type: 'FORCE_END', payload: reason ? { reason } : undefined });

/** @type {() => import('./turnEvents.js').TurnEvent_DESTROY} */
const createDestroyEvent = () => ({ type: 'DESTROY' });


// --- Test Suite ---
describe('TurnStateMachine', () => {
    /** @type {TurnStateMachine} */
    let machine;
    const actorId = 'player-123';
    const otherActorId = 'player-456';

    beforeEach(() => {
        machine = new TurnStateMachine();
    });

    // --- Initialization ---
    describe('Initialization', () => {
        it('should initialize in the Idle state', () => {
            expect(machine.current()).toBe(TurnState.IDLE);
        });

        it('should have null actorId initially', () => {
            // Tested implicitly via assertActor not throwing in Idle
            expect(() => machine.assertActor(actorId)).not.toThrow();
        });
    });

    // --- send() Basic Validation ---
    describe('send() Basic Validation', () => {
        it('should return false for null/undefined event', () => {
            expect(machine.send(null)).toBe(false);
            expect(machine.send(undefined)).toBe(false);
            expect(machine.current()).toBe(TurnState.IDLE);
        });

        it('should return false for event without a type', () => {
            expect(machine.send({})).toBe(false);
            expect(machine.send({ payload: {} })).toBe(false);
            expect(machine.current()).toBe(TurnState.IDLE);
        });

        it('should return false for event with non-string type', () => {
            expect(machine.send({ type: 123 })).toBe(false);
            expect(machine.current()).toBe(TurnState.IDLE);
        });
    });


    // --- Valid Transitions ---
    describe('Valid Transitions', () => {
        describe('Idle State', () => {
            it('should transition Idle -> Prompting on START', () => {
                const event = createStartEvent(actorId);
                const result = machine.send(event);

                expect(result).toBe(true);
                expect(machine.current()).toBe(TurnState.PROMPTING);
                // Verify actorId stored by checking assertActor
                expect(() => machine.assertActor(actorId)).not.toThrow();
                expect(() => machine.assertActor(otherActorId)).toThrow(/Actor assertion failed/);
            });

            it('should ignore START event without actorId payload', () => {
                const event = { type: 'START', payload: {} }; // Missing actorId
                const result = machine.send(event);
                expect(result).toBe(false);
                expect(machine.current()).toBe(TurnState.IDLE);
            });

            it('should ignore START event with null/empty actorId payload', () => {
                expect(machine.send({ type: 'START', payload: { actorId: null} })).toBe(false);
                expect(machine.current()).toBe(TurnState.IDLE);
                expect(machine.send({ type: 'START', payload: { actorId: ''} })).toBe(false);
                expect(machine.current()).toBe(TurnState.IDLE);
            });
        });

        describe('Prompting State', () => {
            beforeEach(() => {
                machine.send(createStartEvent(actorId)); // Setup: Idle -> Prompting
            });

            it('should transition Prompting -> WaitingForCommand on PROMPT_SUCCESS', () => {
                const event = createPromptSuccessEvent();
                const result = machine.send(event);

                expect(result).toBe(true);
                expect(machine.current()).toBe(TurnState.WAITING_FOR_COMMAND);
                expect(() => machine.assertActor(actorId)).not.toThrow(); // Actor should still be set
            });

            it('should transition Prompting -> Idle (via Ending) on PROMPT_FAILURE', () => {
                const event = createPromptFailureEvent();
                const result = machine.send(event);

                expect(result).toBe(true);
                expect(machine.current()).toBe(TurnState.IDLE); // Settles in Idle
                // Verify actorId cleared
                expect(() => machine.assertActor(actorId)).not.toThrow(); // Should not throw in Idle
            });

            it('should transition Prompting -> Idle (via Ending) on FORCE_END', () => {
                const event = createForceEndEvent('test reason');
                const result = machine.send(event);

                expect(result).toBe(true);
                expect(machine.current()).toBe(TurnState.IDLE);
                expect(() => machine.assertActor(actorId)).not.toThrow(); // Actor cleared
            });
        });

        describe('WaitingForCommand State', () => {
            beforeEach(() => {
                machine.send(createStartEvent(actorId));
                machine.send(createPromptSuccessEvent()); // Setup: -> WaitingForCommand
            });

            it('should transition WaitingForCommand -> ProcessingCommand on COMMAND', () => {
                const event = createCommandEvent('look');
                const result = machine.send(event);

                expect(result).toBe(true);
                expect(machine.current()).toBe(TurnState.PROCESSING_COMMAND);
                expect(() => machine.assertActor(actorId)).not.toThrow(); // Actor should still be set
            });

            it('should transition WaitingForCommand -> Idle (via Ending) on FORCE_END', () => {
                const event = createForceEndEvent();
                const result = machine.send(event);

                expect(result).toBe(true);
                expect(machine.current()).toBe(TurnState.IDLE);
                expect(() => machine.assertActor(actorId)).not.toThrow(); // Actor cleared
            });

            it('should ignore COMMAND event with missing commandString payload', () => {
                const event = { type: 'COMMAND', payload: {} };
                const result = machine.send(event);
                expect(result).toBe(false);
                expect(machine.current()).toBe(TurnState.WAITING_FOR_COMMAND);
            });
        });

        describe('ProcessingCommand State', () => {
            beforeEach(() => {
                machine.send(createStartEvent(actorId));
                machine.send(createPromptSuccessEvent());
                machine.send(createCommandEvent('attack')); // Setup: -> ProcessingCommand
            });

            it('should transition ProcessingCommand -> Prompting on PROCESS_RESULT (RE_PROMPT)', () => {
                const event = createProcessResultEvent(TurnDirective.RE_PROMPT);
                const result = machine.send(event);

                expect(result).toBe(true);
                expect(machine.current()).toBe(TurnState.PROMPTING);
                expect(() => machine.assertActor(actorId)).not.toThrow(); // Actor should still be set
            });

            it('should transition ProcessingCommand -> Idle (via Ending) on PROCESS_RESULT (END_TURN_SUCCESS)', () => {
                const event = createProcessResultEvent(TurnDirective.END_TURN_SUCCESS);
                const result = machine.send(event);

                expect(result).toBe(true);
                expect(machine.current()).toBe(TurnState.IDLE);
                expect(() => machine.assertActor(actorId)).not.toThrow(); // Actor cleared
            });

            it('should transition ProcessingCommand -> Idle (via Ending) on PROCESS_RESULT (END_TURN_FAILURE)', () => {
                const event = createProcessResultEvent(TurnDirective.END_TURN_FAILURE);
                const result = machine.send(event);

                expect(result).toBe(true);
                expect(machine.current()).toBe(TurnState.IDLE);
                expect(() => machine.assertActor(actorId)).not.toThrow(); // Actor cleared
            });

            it('should transition ProcessingCommand -> Idle (via Ending) on FORCE_END', () => {
                const event = createForceEndEvent();
                const result = machine.send(event);

                expect(result).toBe(true);
                expect(machine.current()).toBe(TurnState.IDLE);
                expect(() => machine.assertActor(actorId)).not.toThrow(); // Actor cleared
            });

            it('should ignore PROCESS_RESULT event without directive payload', () => {
                const event = { type: 'PROCESS_RESULT', payload: {} };
                const result = machine.send(event);
                expect(result).toBe(false);
                expect(machine.current()).toBe(TurnState.PROCESSING_COMMAND);
            });
        });

        describe('Ending State (Automatic Transition)', () => {
            // The Ending state is transient, immediately moving to Idle.
            // We test this by triggering transitions *into* Ending.
            it('should auto-transition Ending -> Idle immediately after PROMPT_FAILURE', () => {
                machine.send(createStartEvent(actorId));
                const result = machine.send(createPromptFailureEvent()); // Enters Ending, then Idle
                expect(result).toBe(true);
                expect(machine.current()).toBe(TurnState.IDLE);
            });

            it('should auto-transition Ending -> Idle immediately after PROCESS_RESULT (END_TURN_SUCCESS)', () => {
                machine.send(createStartEvent(actorId));
                machine.send(createPromptSuccessEvent());
                machine.send(createCommandEvent('win'));
                const result = machine.send(createProcessResultEvent(TurnDirective.END_TURN_SUCCESS)); // Enters Ending, then Idle
                expect(result).toBe(true);
                expect(machine.current()).toBe(TurnState.IDLE);
            });

            it('should auto-transition Ending -> Idle immediately after FORCE_END', () => {
                machine.send(createStartEvent(actorId));
                machine.send(createPromptSuccessEvent());
                const result = machine.send(createForceEndEvent()); // Enters Ending, then Idle
                expect(result).toBe(true);
                expect(machine.current()).toBe(TurnState.IDLE);
            });
        });
    });

    // --- Invalid Transitions ---
    describe('Invalid Transitions (Ignored Events)', () => {
        it('should ignore non-START events in Idle state', () => {
            expect(machine.send(createPromptSuccessEvent())).toBe(false);
            expect(machine.send(createPromptFailureEvent())).toBe(false);
            expect(machine.send(createCommandEvent('test'))).toBe(false);
            expect(machine.send(createProcessResultEvent(TurnDirective.RE_PROMPT))).toBe(false);
            expect(machine.send(createForceEndEvent())).toBe(false);
            expect(machine.current()).toBe(TurnState.IDLE);
        });

        it('should ignore non-PROMPT_*, non-FORCE_END events in Prompting state', () => {
            machine.send(createStartEvent(actorId)); // -> Prompting
            const initial_state = machine.current();

            expect(machine.send(createStartEvent(otherActorId))).toBe(false);
            expect(machine.send(createCommandEvent('test'))).toBe(false);
            expect(machine.send(createProcessResultEvent(TurnDirective.RE_PROMPT))).toBe(false);
            // FORCE_END is valid, PROMPT_* are valid (tested above)

            expect(machine.current()).toBe(initial_state); // State unchanged
            expect(() => machine.assertActor(actorId)).not.toThrow(); // Actor unchanged
        });

        it('should ignore non-COMMAND, non-FORCE_END events in WaitingForCommand state', () => {
            machine.send(createStartEvent(actorId));
            machine.send(createPromptSuccessEvent()); // -> WaitingForCommand
            const initial_state = machine.current();

            expect(machine.send(createStartEvent(otherActorId))).toBe(false);
            expect(machine.send(createPromptSuccessEvent())).toBe(false);
            expect(machine.send(createPromptFailureEvent())).toBe(false);
            expect(machine.send(createProcessResultEvent(TurnDirective.RE_PROMPT))).toBe(false);
            // FORCE_END is valid, COMMAND is valid (tested above)

            expect(machine.current()).toBe(initial_state); // State unchanged
            expect(() => machine.assertActor(actorId)).not.toThrow(); // Actor unchanged
        });

        it('should ignore non-PROCESS_RESULT, non-FORCE_END events in ProcessingCommand state', () => {
            machine.send(createStartEvent(actorId));
            machine.send(createPromptSuccessEvent());
            machine.send(createCommandEvent('attack')); // -> ProcessingCommand
            const initial_state = machine.current();

            expect(machine.send(createStartEvent(otherActorId))).toBe(false);
            expect(machine.send(createPromptSuccessEvent())).toBe(false);
            expect(machine.send(createPromptFailureEvent())).toBe(false);
            expect(machine.send(createCommandEvent('another'))).toBe(false);
            // FORCE_END is valid, PROCESS_RESULT is valid (tested above)

            expect(machine.current()).toBe(initial_state); // State unchanged
            expect(() => machine.assertActor(actorId)).not.toThrow(); // Actor unchanged
        });
    });

    // --- assertActor() ---
    describe('assertActor()', () => {
        it('should not throw in Idle state', () => {
            expect(() => machine.assertActor(actorId)).not.toThrow();
            expect(() => machine.assertActor(otherActorId)).not.toThrow();
            expect(() => machine.assertActor(null)).not.toThrow(); // Test edge case
        });

        it('should not throw in Prompting state with correct actorId', () => {
            machine.send(createStartEvent(actorId)); // -> Prompting
            expect(() => machine.assertActor(actorId)).not.toThrow();
        });

        it('should throw in Prompting state with incorrect actorId', () => {
            machine.send(createStartEvent(actorId)); // -> Prompting
            expect(() => machine.assertActor(otherActorId))
                .toThrow(`TurnStateMachineError: Actor assertion failed. Expected '${actorId}' but received '${otherActorId}' in state '${TurnState.PROMPTING}'.`);
        });

        it('should not throw in WaitingForCommand state with correct actorId', () => {
            machine.send(createStartEvent(actorId));
            machine.send(createPromptSuccessEvent()); // -> WaitingForCommand
            expect(() => machine.assertActor(actorId)).not.toThrow();
        });

        it('should throw in WaitingForCommand state with incorrect actorId', () => {
            machine.send(createStartEvent(actorId));
            machine.send(createPromptSuccessEvent()); // -> WaitingForCommand
            expect(() => machine.assertActor(otherActorId))
                .toThrow(`TurnStateMachineError: Actor assertion failed. Expected '${actorId}' but received '${otherActorId}' in state '${TurnState.WAITING_FOR_COMMAND}'.`);
        });

        it('should not throw in ProcessingCommand state with correct actorId', () => {
            machine.send(createStartEvent(actorId));
            machine.send(createPromptSuccessEvent());
            machine.send(createCommandEvent('attack')); // -> ProcessingCommand
            expect(() => machine.assertActor(actorId)).not.toThrow();
        });

        it('should throw in ProcessingCommand state with incorrect actorId', () => {
            machine.send(createStartEvent(actorId));
            machine.send(createPromptSuccessEvent());
            machine.send(createCommandEvent('attack')); // -> ProcessingCommand
            expect(() => machine.assertActor(otherActorId))
                .toThrow(`TurnStateMachineError: Actor assertion failed. Expected '${actorId}' but received '${otherActorId}' in state '${TurnState.PROCESSING_COMMAND}'.`);
        });

        it('should not throw after turn ends (back to Idle)', () => {
            // Example path: Prompt Failure
            machine.send(createStartEvent(actorId));
            machine.send(createPromptFailureEvent()); // -> Ending -> Idle
            expect(machine.current()).toBe(TurnState.IDLE);
            expect(() => machine.assertActor(actorId)).not.toThrow(); // No longer throws for original actor
            expect(() => machine.assertActor(otherActorId)).not.toThrow(); // Or any other actor
        });
    });

    // --- Special Events (FORCE_END / DESTROY) ---
    describe('Special Events (FORCE_END / DESTROY)', () => {

        // FORCE_END cases tested within valid transitions above for each state

        describe('DESTROY Event', () => {
            it('should transition Idle -> Idle on DESTROY', () => {
                const result = machine.send(createDestroyEvent());
                // Technically no change, but #transition returns false if state is same
                expect(result).toBe(false);
                expect(machine.current()).toBe(TurnState.IDLE);
                expect(() => machine.assertActor(actorId)).not.toThrow(); // Actor remains null
            });

            it('should transition Prompting -> Idle on DESTROY and clear actorId', () => {
                machine.send(createStartEvent(actorId)); // -> Prompting
                const result = machine.send(createDestroyEvent());
                expect(result).toBe(true);
                expect(machine.current()).toBe(TurnState.IDLE);
                expect(() => machine.assertActor(actorId)).not.toThrow(); // Actor cleared
            });

            it('should transition WaitingForCommand -> Idle on DESTROY and clear actorId', () => {
                machine.send(createStartEvent(actorId));
                machine.send(createPromptSuccessEvent()); // -> WaitingForCommand
                const result = machine.send(createDestroyEvent());
                expect(result).toBe(true);
                expect(machine.current()).toBe(TurnState.IDLE);
                expect(() => machine.assertActor(actorId)).not.toThrow(); // Actor cleared
            });

            it('should transition ProcessingCommand -> Idle on DESTROY and clear actorId', () => {
                machine.send(createStartEvent(actorId));
                machine.send(createPromptSuccessEvent());
                machine.send(createCommandEvent('attack')); // -> ProcessingCommand
                const result = machine.send(createDestroyEvent());
                expect(result).toBe(true);
                expect(machine.current()).toBe(TurnState.IDLE);
                expect(() => machine.assertActor(actorId)).not.toThrow(); // Actor cleared
            });

            it('should transition Ending -> Idle on DESTROY (even though Ending is transient)', () => {
                // Hard to test directly, but DESTROY should override any state.
                // Test by sending DESTROY immediately after an event that leads to Ending
                machine.send(createStartEvent(actorId));
                machine.send(createPromptFailureEvent()); // Should trigger Ending -> Idle
                // If we could intercept before the auto-transition:
                // machine.#currentState = TurnState.ENDING; // Force ending state (if possible in test)
                const result = machine.send(createDestroyEvent());
                expect(machine.current()).toBe(TurnState.IDLE);
                // Result might be true or false depending if the auto-transition happened first
                // The key is that it ends up IDLE with actor cleared.
                expect(() => machine.assertActor(actorId)).not.toThrow();
            });
        });
    });
});