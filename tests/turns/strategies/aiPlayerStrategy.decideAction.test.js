// tests/turns/strategies/aiPlayerStrategy.decideAction.test.js

import { AIPlayerStrategy } from '../../../src/turns/strategies/aiPlayerStrategy.js';
import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';

const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

class MockEntity {
  constructor(id) {
    this.id = id;
  }
}

const createMockActor = (id = 'actor1') => new MockEntity(id);

describe('AIPlayerStrategy', () => {
  let orchestrator;
  let logger;
  let instance;

  beforeEach(() => {
    orchestrator = { decideOrFallback: jest.fn() };
    logger = mockLogger();
    instance = new AIPlayerStrategy({ orchestrator, logger });
  });

  afterEach(() => jest.restoreAllMocks());

  test('should throw if context is null', async () => {
    await expect(instance.decideAction(null)).rejects.toThrow(
      'AIPlayerStrategy received an invalid ITurnContext.'
    );
  });

  test('should throw if context.getActor() returns null', async () => {
    const context = { getActor: jest.fn().mockReturnValue(null) };
    await expect(instance.decideAction(context)).rejects.toThrow(
      'AIPlayerStrategy could not retrieve a valid actor from the context.'
    );
  });

  test('should throw if actor has no ID', async () => {
    const actor = createMockActor();
    actor.id = null;
    const context = { getActor: jest.fn().mockReturnValue(actor) };
    await expect(instance.decideAction(context)).rejects.toThrow(
      'AIPlayerStrategy could not retrieve a valid actor from the context.'
    );
  });

  test('should delegate to orchestrator.decideOrFallback and return result', async () => {
    const actor = createMockActor('player123');
    const context = { getActor: jest.fn().mockReturnValue(actor) };
    const fakeResult = {
      action: { foo: 'bar' },
      extractedData: { speech: 'hi' },
    };
    orchestrator.decideOrFallback.mockResolvedValue(fakeResult);

    const result = await instance.decideAction(context);

    expect(orchestrator.decideOrFallback).toHaveBeenCalledWith({
      actor,
      context,
    });
    expect(logger.debug).toHaveBeenCalledWith(
      `AI decision for ${actor.id}:`,
      fakeResult
    );
    expect(result).toBe(fakeResult);
  });

  test('should throw if orchestrator.decideOrFallback throws', async () => {
    const actor = createMockActor('playerXYZ');
    const context = { getActor: jest.fn().mockReturnValue(actor) };
    const err = new Error('orchestrator failure');
    orchestrator.decideOrFallback.mockRejectedValue(err);

    await expect(instance.decideAction(context)).rejects.toThrow(err);
    expect(logger.debug).not.toHaveBeenCalled();
  });
});
