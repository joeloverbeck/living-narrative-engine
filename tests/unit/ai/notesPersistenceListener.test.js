// tests/ai/notesPersistenceListener.test.js

import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { NotesPersistenceListener } from '../../../src/ai/notesPersistenceListener.js';
import { persistNotes } from '../../../src/ai/notesPersistenceHook.js';

jest.mock('../../../src/ai/notesPersistenceHook.js', () => ({
  persistNotes: jest.fn(),
}));

describe('NotesPersistenceListener', () => {
  let logger;
  let entityManager;
  let dispatcher;
  let listener;

  beforeEach(() => {
    logger = {
      warn: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    dispatcher = { dispatch: jest.fn() };
    entityManager = { getEntityInstance: jest.fn() };
    listener = new NotesPersistenceListener({
      logger,
      entityManager,
      dispatcher,
    });
    persistNotes.mockClear();
  });

  test('persists notes when entity found', () => {
    const actorEntity = {};
    entityManager.getEntityInstance.mockReturnValue(actorEntity);

    listener.handleEvent({
      payload: {
        actorId: 'a1',
        extractedData: { notes: ['note'] },
      },
    });

    expect(entityManager.getEntityInstance).toHaveBeenCalledWith('a1');
    expect(persistNotes).toHaveBeenCalledWith(
      { notes: ['note'] },
      actorEntity,
      logger,
      dispatcher,
      listener.notesService,
      expect.any(Date)
    );
  });

  test('logs warning when entity missing', () => {
    entityManager.getEntityInstance.mockReturnValue(null);

    listener.handleEvent({
      payload: {
        actorId: 'a1',
        extractedData: { notes: ['n'] },
      },
    });

    expect(logger.warn).toHaveBeenCalledWith(
      'NotesPersistenceListener: entity not found for actor a1'
    );
    expect(persistNotes).not.toHaveBeenCalled();
  });

  test('does nothing when notes array empty', () => {
    listener.handleEvent({
      payload: {
        actorId: 'a1',
        extractedData: { notes: [] },
      },
    });

    expect(persistNotes).not.toHaveBeenCalled();
  });
});
