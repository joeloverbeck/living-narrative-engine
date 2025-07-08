import { describe, beforeEach, test, expect, jest } from '@jest/globals';
import { NotesPersistenceListener } from '../../../src/ai/notesPersistenceListener.js';
import { persistNotes } from '../../../src/ai/notesPersistenceHook.js';

jest.mock('../../../src/ai/notesPersistenceHook.js', () => ({
  persistNotes: jest.fn(),
}));

describe('NotesPersistenceListener additional branches', () => {
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

  test('returns early when event is null', () => {
    listener.handleEvent(null);
    expect(persistNotes).not.toHaveBeenCalled();
    expect(entityManager.getEntityInstance).not.toHaveBeenCalled();
  });

  test('returns early when payload is missing', () => {
    listener.handleEvent({});
    expect(persistNotes).not.toHaveBeenCalled();
    expect(entityManager.getEntityInstance).not.toHaveBeenCalled();
  });

  test('returns early when extractedData is missing', () => {
    listener.handleEvent({ payload: { actorId: 'actor1' } });
    expect(persistNotes).not.toHaveBeenCalled();
    expect(entityManager.getEntityInstance).not.toHaveBeenCalled();
  });

  test('returns early when notes is not an array', () => {
    listener.handleEvent({
      payload: { actorId: 'actor1', extractedData: { notes: 'oops' } },
    });
    expect(persistNotes).not.toHaveBeenCalled();
    expect(entityManager.getEntityInstance).not.toHaveBeenCalled();
  });
});
