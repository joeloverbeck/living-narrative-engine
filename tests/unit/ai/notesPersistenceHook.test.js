// tests/ai/notesPersistenceHook.test.js

import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { persistNotes } from '../../../src/ai/notesPersistenceHook.js';
import { NOTES_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import { INVALID_NOTE_SKIPPED_MESSAGE } from '../../common/constants.js';

const makeLogger = () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
});

describe('persistNotes', () => {
  let actor;
  let logger;
  let dispatcher;

  beforeEach(() => {
    actor = {
      id: 'actor-1',
      components: {},
      // Mock entity methods for testing
      addComponent: jest.fn(function (id, data) {
        this.components[id] = data;
      }),
      getComponentData: jest.fn(function (id) {
        return this.components[id];
      }),
    };
    logger = makeLogger();
    dispatcher = { dispatch: jest.fn() };
  });

  test('should do nothing if action.notes is missing or not an array', () => {
    // Note: The 'null' case is now handled by the updated guard in persistNotes,
    // which logs an error. We'll rely on the 'invalid notes' test for that.
    persistNotes({ thoughts: '...' }, actor, logger, dispatcher);
    persistNotes({ notes: [] }, actor, logger, dispatcher);

    expect(actor.addComponent).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  test('should create a new notes component if one does not exist', () => {
    const action = { notes: ['A new note'] };
    persistNotes(action, actor, logger, dispatcher);

    expect(actor.addComponent).toHaveBeenCalledTimes(1);
    expect(actor.addComponent).toHaveBeenCalledWith(
      NOTES_COMPONENT_ID,
      expect.objectContaining({
        notes: expect.arrayContaining([
          expect.objectContaining({ text: 'A new note' }),
        ]),
      })
    );
  });

  test('should add a note to an existing component', () => {
    actor.components[NOTES_COMPONENT_ID] = { notes: [] };
    const action = { notes: ['Another note'] };
    persistNotes(action, actor, logger, dispatcher);

    expect(actor.addComponent).toHaveBeenCalledTimes(1);
    const updatedComp = actor.components[NOTES_COMPONENT_ID];
    expect(updatedComp.notes).toHaveLength(1);
    expect(updatedComp.notes[0].text).toBe('Another note');
  });

  test('should log an info message when notes are successfully added', () => {
    const action = { notes: ['A valid note'] };
    persistNotes(action, actor, logger, dispatcher);

    // --- FIX: Updated the assertion to match the new, specific log message ---
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining('Added note: "A valid note" at')
    );
  });

  test('should not call addComponent or log info if note is a duplicate', () => {
    actor.components[NOTES_COMPONENT_ID] = {
      notes: [{ text: 'Existing Note', timestamp: 'TS' }],
    };
    const action = { notes: ['Existing Note'] };
    persistNotes(action, actor, logger, dispatcher);

    expect(actor.addComponent).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  test('should filter and log errors for invalid notes', () => {
    const action = {
      notes: [
        'Valid Note',
        '', // invalid
        123, // invalid
        'Another Valid Note',
        null, // invalid
      ],
    };

    persistNotes(action, actor, logger, dispatcher);

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(3);
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: INVALID_NOTE_SKIPPED_MESSAGE,
        details: { note: '' },
      })
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: INVALID_NOTE_SKIPPED_MESSAGE,
        details: { note: 123 },
      })
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: INVALID_NOTE_SKIPPED_MESSAGE,
        details: { note: null },
      })
    );

    const finalComp = actor.components[NOTES_COMPONENT_ID];
    expect(finalComp.notes).toHaveLength(2);
    expect(finalComp.notes.map((n) => n.text)).toEqual([
      'Valid Note',
      'Another Valid Note',
    ]);
  });

  test('dispatches error when notes field is not an array', () => {
    const action = { notes: 'oops' };

    persistNotes(action, actor, logger, dispatcher);

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message:
          "NotesPersistenceHook: 'notes' field is not an array; skipping merge",
        details: { actorId: 'actor-1' },
      })
    );
    expect(actor.addComponent).not.toHaveBeenCalled();
  });

  test('ignores invalid notes when none are valid', () => {
    const action = { notes: ['', null] };

    persistNotes(action, actor, logger, dispatcher);

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);
    expect(actor.addComponent).not.toHaveBeenCalled();
  });

  test('updates component directly when addComponent is unavailable', () => {
    delete actor.addComponent;
    delete actor.getComponentData;
    const action = { notes: ['direct update'] };

    persistNotes(action, actor, logger, dispatcher);

    expect(actor.components[NOTES_COMPONENT_ID]).toBeDefined();
    expect(actor.components[NOTES_COMPONENT_ID].notes[0].text).toBe(
      'direct update'
    );
  });

  test('invalid note without dispatcher does nothing', () => {
    const action = { notes: [null] };

    persistNotes(action, actor, logger);

    expect(actor.addComponent).not.toHaveBeenCalled();
  });

  test('returns silently when dispatcher missing for non-array notes', () => {
    const action = { notes: 123 };

    persistNotes(action, actor, logger);

    expect(actor.addComponent).not.toHaveBeenCalled();
  });

  test('allows injecting service and now provider', () => {
    actor.components[NOTES_COMPONENT_ID] = { notes: [] };
    const notesService = {
      addNotes: jest.fn(() => ({
        wasModified: true,
        component: actor.components[NOTES_COMPONENT_ID],
        addedNotes: [{ text: 'x', timestamp: 'ts' }],
      })),
    };
    const fakeNow = new Date('2025-01-01T00:00:00Z');

    persistNotes(
      { notes: ['x'] },
      actor,
      logger,
      dispatcher,
      notesService,
      fakeNow
    );

    expect(notesService.addNotes).toHaveBeenCalledWith(
      actor.components[NOTES_COMPONENT_ID],
      ['x'],
      fakeNow
    );
    expect(logger.debug).toHaveBeenCalledWith('Added note: "x" at ts');
  });
});
