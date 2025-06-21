import { describe, it, beforeEach, expect, jest } from '@jest/globals';
import ActorTurnHandler from '../../../../src/turns/handlers/actorTurnHandler.js';
import { tokens } from '../../../../src/dependencyInjection/tokens.js';

/**
 * Helper to create a basic handler with a DI container that resolves
 * IActionIndexer.
 *
 * @param container
 */
function createHandler(container) {
  const mockState = {
    startTurn: jest.fn(),
    enterState: jest.fn(),
    exitState: jest.fn(),
    getStateName: jest.fn(),
    isIdle: jest.fn(),
  };
  const deps = {
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    turnStateFactory: { createInitialState: jest.fn(() => mockState) },
    turnEndPort: {},
    strategyFactory: { create: jest.fn(() => ({ decideAction: jest.fn() })) },
    turnContextBuilder: {
      build: jest.fn(() => ({ getActor: jest.fn(() => ({ id: 'actor' })) })),
    },
    container,
  };
  return { handler: new ActorTurnHandler(deps), state: mockState };
}

describe('IActionIndexer.beginTurn integration', () => {
  let mockIndexer;
  let mockContainer;
  let actor;

  beforeEach(() => {
    actor = { id: 'player1' };
    mockIndexer = { beginTurn: jest.fn() };
    mockContainer = {
      resolve: jest.fn((t) =>
        t === tokens.IActionIndexer ? mockIndexer : null
      ),
    };
  });

  it('invokes beginTurn once for a human handler', async () => {
    const { handler } = createHandler(mockContainer);
    await handler.startTurn(actor);
    expect(mockIndexer.beginTurn).toHaveBeenCalledTimes(1);
    expect(mockIndexer.beginTurn).toHaveBeenCalledWith(actor.id);
  });

  it('invokes beginTurn once for an AI handler', async () => {
    const { handler } = createHandler(mockContainer);
    await handler.startTurn(actor);
    expect(mockIndexer.beginTurn).toHaveBeenCalledTimes(1);
    expect(mockIndexer.beginTurn).toHaveBeenCalledWith(actor.id);
  });
});
