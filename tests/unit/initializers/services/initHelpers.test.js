import { describe, expect, it, jest } from '@jest/globals';
import { setupPersistenceListeners } from '../../../../src/initializers/services/initHelpers.js';

describe('initHelpers.setupPersistenceListeners', () => {
  it('subscribes each listener and emits debug output when logger provided', () => {
    const dispatcher = { subscribe: jest.fn() };
    const listeners = [
      { eventId: 'event:a', handler: jest.fn() },
      { eventId: 'event:b', handler: jest.fn() },
    ];
    const logger = { debug: jest.fn() };

    setupPersistenceListeners(dispatcher, listeners, logger);

    expect(dispatcher.subscribe).toHaveBeenNthCalledWith(
      1,
      'event:a',
      listeners[0].handler
    );
    expect(dispatcher.subscribe).toHaveBeenNthCalledWith(
      2,
      'event:b',
      listeners[1].handler
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'Registered AI persistence listeners.'
    );
  });

  it('allows omitting the logger without throwing', () => {
    const dispatcher = { subscribe: jest.fn() };
    const listeners = [{ eventId: 'event:c', handler: jest.fn() }];

    expect(() =>
      setupPersistenceListeners(dispatcher, listeners)
    ).not.toThrow();
    expect(dispatcher.subscribe).toHaveBeenCalledWith(
      'event:c',
      listeners[0].handler
    );
  });

  it('throws when the dispatcher is missing a subscribe function', () => {
    const dispatcher = {};
    const listeners = [{ eventId: 'event:d', handler: jest.fn() }];

    expect(() => setupPersistenceListeners(dispatcher, listeners)).toThrow(
      'setupPersistenceListeners: invalid dispatcher'
    );
  });

  it('throws when listeners is not an array', () => {
    const dispatcher = { subscribe: jest.fn() };

    expect(() => setupPersistenceListeners(dispatcher, null)).toThrow(
      'setupPersistenceListeners: listeners must be an array'
    );
  });

  it('throws when a listener handler is not a function', () => {
    const dispatcher = { subscribe: jest.fn() };
    const listeners = [{ eventId: 'event:e', handler: 'not a function' }];

    expect(() => setupPersistenceListeners(dispatcher, listeners)).toThrow(
      'setupPersistenceListeners: invalid listener definition'
    );
    expect(dispatcher.subscribe).not.toHaveBeenCalled();
  });

  it('throws when a listener is missing an event identifier', () => {
    const dispatcher = { subscribe: jest.fn() };
    const listeners = [{ eventId: '', handler: jest.fn() }];

    expect(() => setupPersistenceListeners(dispatcher, listeners)).toThrow(
      'setupPersistenceListeners: invalid listener definition'
    );
    expect(dispatcher.subscribe).not.toHaveBeenCalled();
  });
});
