import { describe, expect, it } from '@jest/globals';
import { persistNotes } from '../../../src/ai/notesPersistenceHook.js';
import NotesService, { normalizeNoteText } from '../../../src/ai/notesService.js';
import ComponentAccessService from '../../../src/entities/componentAccessService.js';
import { NOTES_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { DEFAULT_SUBJECT_TYPE, SUBJECT_TYPES } from '../../../src/constants/subjectTypes.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

class MemoryLogger {
  constructor() {
    this.debugMessages = [];
    this.errorMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
  }

  debug(message, context) {
    this.debugMessages.push({ message, context });
  }

  error(message, context) {
    this.errorMessages.push({ message, context });
  }

  info(message, context) {
    this.infoMessages.push({ message, context });
  }

  warn(message, context) {
    this.warnMessages.push({ message, context });
  }
}

class MemoryDispatcher {
  constructor() {
    this.events = [];
  }

  dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
  }
}

const createActor = (id, components = {}) => ({
  id,
  components,
});

describe('NotesService integration edge cases', () => {
  it('throws when the persisted component was corrupted to lack a notes array', () => {
    const logger = new MemoryLogger();
    const dispatcher = new MemoryDispatcher();
    const notesService = new NotesService();
    const componentAccess = new ComponentAccessService();
    const actor = createActor('actor-corrupted', {
      [NOTES_COMPONENT_ID]: { notes: { not: 'an array' } },
    });

    expect(() =>
      persistNotes(
        {
          notes: [
            { text: 'Restore the archives', subject: 'Records Office' },
          ],
        },
        actor,
        logger,
        dispatcher,
        notesService,
        new Date('2025-08-01T10:00:00.000Z'),
        componentAccess,
      ),
    ).toThrow(
      'notesComp must be an object conforming to the core:notes schema with a `notes` array.'
    );

    expect(actor.components[NOTES_COMPONENT_ID].notes).toEqual({ not: 'an array' });
    expect(logger.debugMessages).toHaveLength(1);
    expect(logger.debugMessages[0].message).toContain(
      'Auto-assigned default subjectType "other" to note'
    );
    const addedLogs = logger.debugMessages.filter(({ message }) =>
      message.startsWith('Added note:')
    );
    expect(addedLogs).toHaveLength(0);
    expect(dispatcher.events).toHaveLength(0);
  });

  it('builds the existing normalization set and skips duplicates even with stray entries', () => {
    const logger = new MemoryLogger();
    const dispatcher = new MemoryDispatcher();
    const notesService = new NotesService();
    const componentAccess = new ComponentAccessService();
    const existingNote = {
      text: 'Existing Insight',
      subject: 'Lorekeeper',
      subjectType: SUBJECT_TYPES.ENTITY,
      timestamp: '2024-04-04T04:04:04.000Z',
    };
    const actor = createActor('actor-dedup', {
      [NOTES_COMPONENT_ID]: {
        notes: [existingNote],
      },
    });
    const timestamp = new Date('2025-08-01T11:00:00.000Z');

    persistNotes(
      {
        notes: [
          { text: '   existing insight!!!   ', subject: 'Lorekeeper', subjectType: SUBJECT_TYPES.ENTITY },
          { text: '  Fresh Perspective  ', subject: 'Archivist' },
          'not-an-object',
        ],
      },
      actor,
      logger,
      dispatcher,
      notesService,
      timestamp,
      componentAccess,
    );

    const storedComponent = actor.components[NOTES_COMPONENT_ID];
    expect(Array.isArray(storedComponent.notes)).toBe(true);
    expect(storedComponent.notes[0]).toBe(existingNote);
    expect(storedComponent.notes).toHaveLength(2);

    const [, addedNote] = storedComponent.notes;
    expect(addedNote).toMatchObject({
      text: 'Fresh Perspective',
      subject: 'Archivist',
      subjectType: DEFAULT_SUBJECT_TYPE,
      timestamp: timestamp.toISOString(),
    });

    const addedMessages = logger.debugMessages.filter(({ message }) =>
      message.startsWith('Added note:')
    );
    expect(addedMessages).toHaveLength(1);
    expect(addedMessages[0].message).toContain('Fresh Perspective');
    expect(
      logger.debugMessages.some(({ message }) =>
        message.includes('Auto-assigned default subjectType "other" to note')
      ),
    ).toBe(true);

    expect(dispatcher.events).toHaveLength(1);
    expect(dispatcher.events[0]).toEqual({
      eventId: SYSTEM_ERROR_OCCURRED_ID,
      payload: {
        message: 'NotesPersistenceHook: Invalid note skipped',
        details: { note: 'not-an-object' },
      },
    });

    expect(normalizeNoteText('unexpected string payload')).toBe('');
    expect(normalizeNoteText(storedComponent.notes[0])).toBe(
      'entity:lorekeeper:existing insight'
    );
    expect(normalizeNoteText(addedNote)).toBe('other:archivist:fresh perspective');
  });
});
