import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { persistNotes } from '../../../src/ai/notesPersistenceHook.js';
import { DEFAULT_SUBJECT_TYPE } from '../../../src/constants/subjectTypes.js';
import { NOTES_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

const createActor = (overrides = {}) => ({
  id: 'actor-1',
  definitionId: 'actor-def',
  components: {},
  addComponent: jest.fn(function addComponent(id, data) {
    this.components[id] = data;
  }),
  getComponentData: jest.fn(function getComponentData(id) {
    return this.components[id];
  }),
  ...overrides,
});

const createLogger = () => ({
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
});

describe('notesPersistenceHook subject type handling', () => {
  let actor;
  let logger;

  beforeEach(() => {
    actor = createActor();
    logger = createLogger();
  });

  test('assigns default subjectType when missing and logs migration', () => {
    const dispatcher = { dispatch: jest.fn() };
    const action = {
      notes: [
        {
          text: 'Remember to debrief the scout',
          subject: 'Mission Log',
        },
      ],
    };

    persistNotes(action, actor, logger, dispatcher);

    const storedNotes = actor.components[NOTES_COMPONENT_ID].notes;
    expect(storedNotes).toHaveLength(1);
    expect(storedNotes[0].subjectType).toBe(DEFAULT_SUBJECT_TYPE);
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Auto-assigned default subjectType'),
      expect.objectContaining({ subject: 'Mission Log' })
    );
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  test('dispatches error and normalizes invalid subjectType', () => {
    const dispatch = jest.fn();
    const dispatcher = { dispatch };
    const action = {
      notes: [
        {
          text: 'Created a new prototype',
          subject: 'R&D Update',
          subjectType: 'alien-tech',
        },
      ],
    };

    persistNotes(action, actor, logger, dispatcher);

    expect(dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'NotesPersistenceHook: Invalid subjectType, using default',
        details: expect.objectContaining({
          invalidSubjectType: 'alien-tech',
          subject: 'R&D Update',
          defaultAssigned: DEFAULT_SUBJECT_TYPE,
        }),
      })
    );

    const storedNotes = actor.components[NOTES_COMPONENT_ID].notes;
    expect(storedNotes).toHaveLength(1);
    expect(storedNotes[0].subjectType).toBe(DEFAULT_SUBJECT_TYPE);
  });

  test('normalizes invalid subjectType even without dispatcher', () => {
    const action = {
      notes: [
        {
          text: 'Brief the diplomacy team',
          subject: 'Strategy',
          subjectType: 'completely-invalid',
        },
      ],
    };

    expect(() => persistNotes(action, actor, logger, undefined)).not.toThrow();

    const storedNotes = actor.components[NOTES_COMPONENT_ID].notes;
    expect(storedNotes).toHaveLength(1);
    expect(storedNotes[0].subjectType).toBe(DEFAULT_SUBJECT_TYPE);
  });

  test('defaults subjectType without logger or dispatcher', () => {
    const action = {
      notes: [
        {
          text: 'Catalog a new constellation',
          subject: 'Astronomy',
        },
      ],
    };

    const actorWithoutLogger = createActor();
    const notesService = {
      addNotes: jest.fn((component, notes) => ({
        wasModified: false,
        component,
        addedNotes: notes,
      })),
    };

    persistNotes(
      action,
      actorWithoutLogger,
      undefined,
      undefined,
      notesService
    );

    expect(notesService.addNotes).toHaveBeenCalledTimes(1);
    const [, notes] = notesService.addNotes.mock.calls[0];
    expect(notes[0].subjectType).toBe(DEFAULT_SUBJECT_TYPE);
  });

  test('uses UNKNOWN_ACTOR fallback when dispatcher handles non-array notes', () => {
    const dispatch = jest.fn();
    const dispatcher = { dispatch };
    const actorWithoutId = createActor({ id: undefined });

    persistNotes({ notes: 42 }, actorWithoutId, logger, dispatcher);

    expect(dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        details: { actorId: 'UNKNOWN_ACTOR' },
      })
    );
  });
});
