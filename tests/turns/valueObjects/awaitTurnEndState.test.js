// tests/turns/valueObjects/awaitTurnEndState.test.js
import { describe, it, expect, beforeAll } from '@jest/globals';
import { AwaitTurnEndState } from '../../../src/turns/valueObjects/awaitTurnEndState.js';

describe('AwaitTurnEndState', () => {
  describe('Immutability', () => {
    it('should be frozen when created via idle()', () => {
      const idleState = AwaitTurnEndState.idle();
      expect(Object.isFrozen(idleState)).toBe(true);
    });

    it('should be frozen when created via waitingFor()', () => {
      const waitingState = AwaitTurnEndState.waitingFor('actor1');
      expect(Object.isFrozen(waitingState)).toBe(true);
    });
  });

  describe('idle()', () => {
    it('should return a singleton instance', () => {
      const instance1 = AwaitTurnEndState.idle();
      const instance2 = AwaitTurnEndState.idle();
      expect(instance1).toBe(instance2);
    });

    it('should have isWaiting() return false', () => {
      const idleState = AwaitTurnEndState.idle();
      expect(idleState.isWaiting()).toBe(false);
    });

    it('should have getActorId() return null', () => {
      const idleState = AwaitTurnEndState.idle();
      expect(idleState.getActorId()).toBe(null);
    });

    it('should have a correct string representation', () => {
      const idleState = AwaitTurnEndState.idle();
      expect(idleState.toString()).toBe('State: Idle');
    });
  });

  describe('waitingFor(actorId)', () => {
    it('should return a new instance with the correct actorId', () => {
      const waitingState = AwaitTurnEndState.waitingFor('player-alpha');
      expect(waitingState.isWaiting()).toBe(true);
      expect(waitingState.getActorId()).toBe('player-alpha');
    });

    it('should handle null or empty actorId gracefully', () => {
      const waitingState = AwaitTurnEndState.waitingFor(null);
      expect(waitingState.isWaiting()).toBe(true);
      expect(waitingState.getActorId()).toBe(null);
    });

    it('should have a correct string representation', () => {
      const waitingState1 = AwaitTurnEndState.waitingFor('actor-beta');
      const waitingState2 = AwaitTurnEndState.waitingFor(null);
      expect(waitingState1.toString()).toBe(
        "State: Waiting for Actor 'actor-beta'"
      );
      expect(waitingState2.toString()).toBe("State: Waiting for Actor 'ANY'");
    });
  });
});
