import { describe, it, expect, jest } from '@jest/globals';
import {
  ImmediateDispatchStrategy,
  SessionQueueStrategy,
  createDispatchStrategy,
} from '../../../../src/anatomy/services/eventDispatchStrategy.js';

describe('ImmediateDispatchStrategy', () => {
  it('constructor - validates safeEventDispatcher dependency', () => {
    expect(() => new ImmediateDispatchStrategy({})).toThrow(
      'ImmediateDispatchStrategy requires safeEventDispatcher with dispatch.'
    );
  });

  it('dispatch - calls dispatcher.dispatch with eventType and payload', () => {
    const dispatcher = { dispatch: jest.fn() };
    const strategy = new ImmediateDispatchStrategy({
      safeEventDispatcher: dispatcher,
    });

    strategy.dispatch('event:type', { value: 1 });

    expect(dispatcher.dispatch).toHaveBeenCalledWith('event:type', {
      value: 1,
    });
  });

  it('dispatch - ignores sessionContext parameter', () => {
    const dispatcher = { dispatch: jest.fn() };
    const strategy = new ImmediateDispatchStrategy({
      safeEventDispatcher: dispatcher,
    });
    const sessionContext = { damageSession: { pendingEvents: [] } };

    strategy.dispatch('event:type', { value: 1 }, sessionContext);

    expect(sessionContext.damageSession.pendingEvents).toEqual([]);
  });

  it('recordEffect - is a no-op (does not throw)', () => {
    const dispatcher = { dispatch: jest.fn() };
    const strategy = new ImmediateDispatchStrategy({
      safeEventDispatcher: dispatcher,
    });

    expect(() =>
      strategy.recordEffect('part:arm', 'bleeding', {
        damageSession: { entries: [] },
      })
    ).not.toThrow();
  });

  it('recordEffect - does not modify sessionContext', () => {
    const dispatcher = { dispatch: jest.fn() };
    const strategy = new ImmediateDispatchStrategy({
      safeEventDispatcher: dispatcher,
    });
    const sessionContext = {
      damageSession: {
        entries: [{ partId: 'part:arm', effectsTriggered: [] }],
        pendingEvents: [],
      },
    };

    strategy.recordEffect('part:arm', 'bleeding', sessionContext);

    expect(sessionContext.damageSession.entries[0].effectsTriggered).toEqual([]);
  });
});

describe('SessionQueueStrategy', () => {
  it('dispatch - pushes event to damageSession.pendingEvents', () => {
    const strategy = new SessionQueueStrategy();
    const damageSession = { pendingEvents: [] };

    strategy.dispatch('event:type', { value: 1 }, damageSession);

    expect(damageSession.pendingEvents).toEqual([
      { eventType: 'event:type', payload: { value: 1 } },
    ]);
  });

  it('recordEffect - adds effectName to matching entry effectsTriggered', () => {
    const strategy = new SessionQueueStrategy();
    const damageSession = {
      entries: [{ partId: 'part:arm', effectsTriggered: [] }],
    };

    strategy.recordEffect('part:arm', 'bleeding', damageSession);

    expect(damageSession.entries[0].effectsTriggered).toEqual(['bleeding']);
  });

  it('recordEffect - initializes effectsTriggered array if absent', () => {
    const strategy = new SessionQueueStrategy();
    const damageSession = {
      entries: [{ partId: 'part:arm' }],
    };

    strategy.recordEffect('part:arm', 'bleeding', damageSession);

    expect(damageSession.entries[0].effectsTriggered).toEqual(['bleeding']);
  });

  it('recordEffect - gracefully handles missing entry (no throw)', () => {
    const strategy = new SessionQueueStrategy();
    const damageSession = {
      entries: [{ partId: 'part:leg', effectsTriggered: [] }],
    };

    expect(() =>
      strategy.recordEffect('part:arm', 'bleeding', damageSession)
    ).not.toThrow();
    expect(damageSession.entries[0].effectsTriggered).toEqual([]);
  });
});

describe('createDispatchStrategy', () => {
  it('returns ImmediateDispatchStrategy when damageSession is null', () => {
    const dispatcher = { dispatch: jest.fn() };

    const strategy = createDispatchStrategy(dispatcher, null);

    expect(strategy).toBeInstanceOf(ImmediateDispatchStrategy);
  });

  it('returns ImmediateDispatchStrategy when damageSession is undefined', () => {
    const dispatcher = { dispatch: jest.fn() };

    const strategy = createDispatchStrategy(dispatcher);

    expect(strategy).toBeInstanceOf(ImmediateDispatchStrategy);
  });

  it('returns SessionQueueStrategy when damageSession is provided', () => {
    const dispatcher = { dispatch: jest.fn() };

    const strategy = createDispatchStrategy(dispatcher, { pendingEvents: [] });

    expect(strategy).toBeInstanceOf(SessionQueueStrategy);
  });
});
