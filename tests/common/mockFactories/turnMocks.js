import { jest } from '@jest/globals';
import { createSimpleMock } from './coreServices.js';

export const createMockTurnManager = () =>
  createSimpleMock(['start', 'stop', 'nextTurn']);

export const createMockTurnOrderService = () =>
  createSimpleMock([
    'startNewRound',
    'getNextEntity',
    'peekNextEntity',
    'addEntity',
    'removeEntity',
    'isEmpty',
    'getCurrentOrder',
    'clearCurrentRound',
  ]);

export const createMockTurnHandlerResolver = () =>
  createSimpleMock(['resolveHandler']);

export const createMockTurnHandler = ({
  actor = null,
  failStart = false,
  failDestroy = false,
  includeSignalTermination = false,
  name = 'MockTurnHandler',
} = {}) => {
  const handler = {
    actor,
    startTurn: jest.fn().mockImplementation((currentActor) => {
      const promise = failStart
        ? Promise.reject(
            new Error(
              `Simulated startTurn failure for ${currentActor?.id || 'unknown actor'}`
            )
          )
        : Promise.resolve();
      console.log(
        'createMockTurnHandler.startTurn called, returns Promise:',
        typeof promise.then === 'function'
      );
      return promise;
    }),
    destroy: jest.fn().mockImplementation(() => {
      if (failDestroy) {
        return Promise.reject(new Error('Simulated destroy failure'));
      }
      return Promise.resolve();
    }),
  };
  const NamedConstructor = Function('return function ' + name + '(){}')();
  handler.constructor = NamedConstructor;
  if (includeSignalTermination) {
    handler.signalNormalApparentTermination = jest.fn();
  }
  return handler;
};
