import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
  createGoapEventPayload,
  emitGoapEvent,
} from '../../../../src/goap/events/goapEventFactory.js';

describe('goapEventFactory', () => {
  let nowSpy;

  beforeEach(() => {
    nowSpy = jest.spyOn(Date, 'now').mockReturnValue(123456789);
  });

  afterEach(() => {
    nowSpy.mockRestore();
  });

  describe('createGoapEventPayload', () => {
    it('injects timestamp and context defaults', () => {
      const payload = createGoapEventPayload(
        'goap:test',
        { foo: 'bar' },
        { actorId: 'actor-1', taskId: 'task-2' }
      );

      expect(payload).toEqual({
        foo: 'bar',
        actorId: 'actor-1',
        taskId: 'task-2',
        timestamp: 123456789,
      });
    });

    it('preserves existing timestamp and metadata', () => {
      const payload = createGoapEventPayload(
        'goap:test',
        { timestamp: 1, actorId: 'actor-override' },
        { actorId: 'actor-ctx', goalId: 'goal-1' }
      );

      expect(payload).toEqual({
        timestamp: 1,
        actorId: 'actor-override',
        goalId: 'goal-1',
      });
    });

    it('throws when payload is not a plain object', () => {
      expect(() => createGoapEventPayload('goap:test', null)).toThrow(
        /plain object/
      );
    });

    it('throws when event type is invalid', () => {
      expect(() => createGoapEventPayload('', {})).toThrow(/non-empty string/);
    });
  });

  describe('emitGoapEvent', () => {
    it('passes normalized payload to dispatcher', () => {
      const dispatcher = { dispatch: jest.fn() };

      emitGoapEvent(dispatcher, 'goap:test', { foo: 'bar' }, { actorId: 'actor' });

      expect(dispatcher.dispatch).toHaveBeenCalledWith('goap:test', {
        foo: 'bar',
        actorId: 'actor',
        timestamp: 123456789,
      });
    });

    it('throws when dispatcher is invalid', () => {
      expect(() => emitGoapEvent(null, 'goap:test', {})).toThrow(/dispatcher/);
    });
  });
});
