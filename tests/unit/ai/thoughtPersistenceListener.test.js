// tests/ai/thoughtPersistenceListener.test.js

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { ThoughtPersistenceListener } from '../../../src/ai/thoughtPersistenceListener.js';
import { persistThoughts } from '../../../src/ai/thoughtPersistenceHook.js';

jest.mock('../../../src/ai/thoughtPersistenceHook.js', () => ({
  persistThoughts: jest.fn(),
}));

describe('ThoughtPersistenceListener', () => {
  let logger;
  let entityManager;
  let listener;

  beforeEach(() => {
    logger = {
      warn: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    entityManager = { getEntityInstance: jest.fn() };
    listener = new ThoughtPersistenceListener({ logger, entityManager });
    persistThoughts.mockClear();
  });

  test('persists thoughts when entity found', () => {
    const actorEntity = {};
    entityManager.getEntityInstance.mockReturnValue(actorEntity);

    listener.handleEvent({
      payload: {
        actorId: 'a1',
        extractedData: { thoughts: 'hi' },
      },
    });

    expect(entityManager.getEntityInstance).toHaveBeenCalledWith('a1');
    expect(persistThoughts).toHaveBeenCalledWith(
      { thoughts: 'hi' },
      actorEntity,
      logger
    );
  });

  test('logs warning when entity missing', () => {
    entityManager.getEntityInstance.mockReturnValue(null);

    listener.handleEvent({
      payload: {
        actorId: 'a1',
        extractedData: { thoughts: 'hi' },
      },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'ThoughtPersistenceListener: entity not found for actor a1'
    );
    expect(persistThoughts).not.toHaveBeenCalled();
  });

  test('does nothing when thoughts missing', () => {
    listener.handleEvent({
      payload: {
        actorId: 'a1',
        extractedData: null,
      },
    });

    expect(persistThoughts).not.toHaveBeenCalled();
  });
});
