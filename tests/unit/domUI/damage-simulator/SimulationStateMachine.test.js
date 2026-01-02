/**
 * @file SimulationStateMachine.test.js
 * @description Unit tests for SimulationStateMachine
 */

import {
  SimulationStateMachine,
  SimulationState,
} from '../../../../src/domUI/damage-simulator/SimulationStateMachine.js';

describe('SimulationStateMachine', () => {
  describe('constructor', () => {
    it('should start in IDLE state', () => {
      const machine = new SimulationStateMachine();

      expect(machine.state).toBe(SimulationState.IDLE);
      expect(machine.isIdle).toBe(true);
    });

    it('should accept optional onStateChange callback', () => {
      const onStateChange = jest.fn();
      const machine = new SimulationStateMachine(onStateChange);

      machine.transition(SimulationState.CONFIGURED);

      expect(onStateChange).toHaveBeenCalledWith(
        SimulationState.IDLE,
        SimulationState.CONFIGURED
      );
    });
  });

  describe('transition', () => {
    it('should allow IDLE -> CONFIGURED', () => {
      const machine = new SimulationStateMachine();

      expect(() =>
        machine.transition(SimulationState.CONFIGURED)
      ).not.toThrow();
      expect(machine.state).toBe(SimulationState.CONFIGURED);
    });

    it('should allow CONFIGURED -> RUNNING', () => {
      const machine = new SimulationStateMachine();

      machine.transition(SimulationState.CONFIGURED);

      expect(() => machine.transition(SimulationState.RUNNING)).not.toThrow();
      expect(machine.state).toBe(SimulationState.RUNNING);
    });

    it('should allow RUNNING -> STOPPING', () => {
      const machine = new SimulationStateMachine();

      machine.transition(SimulationState.CONFIGURED);
      machine.transition(SimulationState.RUNNING);

      expect(() => machine.transition(SimulationState.STOPPING)).not.toThrow();
      expect(machine.state).toBe(SimulationState.STOPPING);
    });

    it('should allow RUNNING -> COMPLETED', () => {
      const machine = new SimulationStateMachine();

      machine.transition(SimulationState.CONFIGURED);
      machine.transition(SimulationState.RUNNING);

      expect(() => machine.transition(SimulationState.COMPLETED)).not.toThrow();
      expect(machine.state).toBe(SimulationState.COMPLETED);
    });

    it('should allow RUNNING -> ERROR', () => {
      const machine = new SimulationStateMachine();

      machine.transition(SimulationState.CONFIGURED);
      machine.transition(SimulationState.RUNNING);

      expect(() => machine.transition(SimulationState.ERROR)).not.toThrow();
      expect(machine.state).toBe(SimulationState.ERROR);
    });

    it('should allow STOPPING -> COMPLETED', () => {
      const machine = new SimulationStateMachine();

      machine.transition(SimulationState.CONFIGURED);
      machine.transition(SimulationState.RUNNING);
      machine.transition(SimulationState.STOPPING);

      expect(() => machine.transition(SimulationState.COMPLETED)).not.toThrow();
      expect(machine.state).toBe(SimulationState.COMPLETED);
    });

    it('should allow STOPPING -> ERROR', () => {
      const machine = new SimulationStateMachine();

      machine.transition(SimulationState.CONFIGURED);
      machine.transition(SimulationState.RUNNING);
      machine.transition(SimulationState.STOPPING);

      expect(() => machine.transition(SimulationState.ERROR)).not.toThrow();
      expect(machine.state).toBe(SimulationState.ERROR);
    });

    it('should allow COMPLETED -> RUNNING', () => {
      const machine = new SimulationStateMachine();

      machine.transition(SimulationState.CONFIGURED);
      machine.transition(SimulationState.RUNNING);
      machine.transition(SimulationState.COMPLETED);

      expect(() => machine.transition(SimulationState.RUNNING)).not.toThrow();
      expect(machine.state).toBe(SimulationState.RUNNING);
    });

    it('should allow COMPLETED -> CONFIGURED', () => {
      const machine = new SimulationStateMachine();

      machine.transition(SimulationState.CONFIGURED);
      machine.transition(SimulationState.RUNNING);
      machine.transition(SimulationState.COMPLETED);

      expect(() =>
        machine.transition(SimulationState.CONFIGURED)
      ).not.toThrow();
      expect(machine.state).toBe(SimulationState.CONFIGURED);
    });

    it('should allow ERROR -> RUNNING', () => {
      const machine = new SimulationStateMachine();

      machine.transition(SimulationState.CONFIGURED);
      machine.transition(SimulationState.RUNNING);
      machine.transition(SimulationState.ERROR);

      expect(() => machine.transition(SimulationState.RUNNING)).not.toThrow();
      expect(machine.state).toBe(SimulationState.RUNNING);
    });

    it('should allow ERROR -> CONFIGURED', () => {
      const machine = new SimulationStateMachine();

      machine.transition(SimulationState.CONFIGURED);
      machine.transition(SimulationState.RUNNING);
      machine.transition(SimulationState.ERROR);

      expect(() =>
        machine.transition(SimulationState.CONFIGURED)
      ).not.toThrow();
      expect(machine.state).toBe(SimulationState.CONFIGURED);
    });

    it('should throw on invalid transition IDLE -> RUNNING', () => {
      const machine = new SimulationStateMachine();

      expect(() => machine.transition(SimulationState.RUNNING)).toThrow(
        'Invalid state transition: IDLE -> RUNNING. Valid transitions: CONFIGURED'
      );
    });

    it('should throw on invalid transition RUNNING -> CONFIGURED', () => {
      const machine = new SimulationStateMachine();

      machine.transition(SimulationState.CONFIGURED);
      machine.transition(SimulationState.RUNNING);

      expect(() => machine.transition(SimulationState.CONFIGURED)).toThrow(
        'Invalid state transition: RUNNING -> CONFIGURED. Valid transitions: STOPPING, COMPLETED, ERROR'
      );
    });
  });

  describe('canTransition', () => {
    it('should return true for valid transitions', () => {
      const machine = new SimulationStateMachine();

      expect(machine.canTransition(SimulationState.CONFIGURED)).toBe(true);

      machine.transition(SimulationState.CONFIGURED);

      expect(machine.canTransition(SimulationState.RUNNING)).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      const machine = new SimulationStateMachine();

      expect(machine.canTransition(SimulationState.RUNNING)).toBe(false);

      machine.transition(SimulationState.CONFIGURED);

      expect(machine.canTransition(SimulationState.STOPPING)).toBe(false);
    });
  });

  describe('state getters', () => {
    it('should correctly report isRunning and isActive for RUNNING', () => {
      const machine = new SimulationStateMachine();

      machine.transition(SimulationState.CONFIGURED);
      machine.transition(SimulationState.RUNNING);

      expect(machine.isRunning).toBe(true);
      expect(machine.isActive).toBe(true);
      expect(machine.isStopping).toBe(false);
    });

    it('should correctly report isActive for STOPPING', () => {
      const machine = new SimulationStateMachine();

      machine.transition(SimulationState.CONFIGURED);
      machine.transition(SimulationState.RUNNING);
      machine.transition(SimulationState.STOPPING);

      expect(machine.isStopping).toBe(true);
      expect(machine.isActive).toBe(true);
      expect(machine.isCompleted).toBe(false);
    });

    it('should correctly report terminal states', () => {
      const machine = new SimulationStateMachine();

      machine.transition(SimulationState.CONFIGURED);
      machine.transition(SimulationState.RUNNING);
      machine.transition(SimulationState.ERROR);

      expect(machine.isError).toBe(true);
      expect(machine.isActive).toBe(false);
    });
  });

  describe('onStateChange callback', () => {
    it('should be called on successful transitions', () => {
      const onStateChange = jest.fn();
      const machine = new SimulationStateMachine(onStateChange);

      machine.transition(SimulationState.CONFIGURED);
      machine.transition(SimulationState.RUNNING);

      expect(onStateChange).toHaveBeenCalledTimes(2);
      expect(onStateChange).toHaveBeenLastCalledWith(
        SimulationState.CONFIGURED,
        SimulationState.RUNNING
      );
    });

    it('should not be called on failed transitions', () => {
      const onStateChange = jest.fn();
      const machine = new SimulationStateMachine(onStateChange);

      expect(() => machine.transition(SimulationState.RUNNING)).toThrow();
      expect(onStateChange).not.toHaveBeenCalled();
    });
  });
});
