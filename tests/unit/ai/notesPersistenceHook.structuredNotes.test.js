/**
 * @file Tests for structured note format in notesPersistenceHook
 * @see src/ai/notesPersistenceHook.js
 */

import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { persistNotes } from '../../../src/ai/notesPersistenceHook.js';
import { NOTES_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import ComponentAccessService from '../../../src/entities/componentAccessService.js';

const makeLogger = () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
});

describe('persistNotes - structured notes', () => {
  let actor;
  let logger;
  let dispatcher;
  let componentAccess;

  beforeEach(() => {
    actor = {
      id: 'actor-1',
      components: {},
    };
    logger = makeLogger();
    dispatcher = { dispatch: jest.fn() };
    componentAccess = new ComponentAccessService();
  });

  test('should persist valid structured notes with text and subject', () => {
    const action = {
      notes: [
        {
          text: 'The player seems interested in exploration',
          subject: 'player_behavior',
        },
      ],
    };

    persistNotes(
      action,
      actor,
      logger,
      dispatcher,
      undefined,
      undefined,
      componentAccess
    );

    expect(actor.components[NOTES_COMPONENT_ID]).toBeDefined();
    expect(actor.components[NOTES_COMPONENT_ID].notes).toHaveLength(1);
    const addedNote = actor.components[NOTES_COMPONENT_ID].notes[0];
    expect(addedNote.text).toBe('The player seems interested in exploration');
    expect(addedNote.subject).toBe('player_behavior');
    expect(addedNote.timestamp).toBeDefined();
    expect(logger.debug).toHaveBeenCalledWith(
      expect.stringContaining(
        'Added note: "The player seems interested in exploration" at'
      )
    );
  });

  test('should persist structured notes with optional fields', () => {
    const action = {
      notes: [
        {
          text: 'Combat encounter completed',
          subject: 'combat_summary',
          context: 'dungeon_level_2',
          tags: ['combat', 'victory', 'experience_gained'],
        },
      ],
    };

    persistNotes(
      action,
      actor,
      logger,
      dispatcher,
      undefined,
      undefined,
      componentAccess
    );

    const addedNote = actor.components[NOTES_COMPONENT_ID].notes[0];
    expect(addedNote.text).toBe('Combat encounter completed');
    expect(addedNote.subject).toBe('combat_summary');
    expect(addedNote.context).toBe('dungeon_level_2');
    expect(addedNote.tags).toEqual(['combat', 'victory', 'experience_gained']);
  });

  test('should handle mixed array of string and structured notes', () => {
    const action = {
      notes: [
        'Simple string note',
        {
          text: 'Structured note',
          subject: 'mixed_format',
        },
        'Another string note',
      ],
    };

    persistNotes(
      action,
      actor,
      logger,
      dispatcher,
      undefined,
      undefined,
      componentAccess
    );

    expect(actor.components[NOTES_COMPONENT_ID].notes).toHaveLength(3);
    const notes = actor.components[NOTES_COMPONENT_ID].notes;

    // First note should be converted from string
    expect(notes[0].text).toBe('Simple string note');
    expect(notes[0].timestamp).toBeDefined();

    // Second note should retain structure
    expect(notes[1].text).toBe('Structured note');
    expect(notes[1].subject).toBe('mixed_format');

    // Third note should be converted from string
    expect(notes[2].text).toBe('Another string note');
  });

  test('should add structured notes to existing notes component', () => {
    // Pre-populate with existing notes
    actor.components[NOTES_COMPONENT_ID] = {
      notes: [
        {
          text: 'Existing note',
          timestamp: '2024-01-01T00:00:00.000Z',
        },
      ],
    };

    const action = {
      notes: [
        {
          text: 'New structured note',
          subject: 'player_action',
        },
      ],
    };

    persistNotes(
      action,
      actor,
      logger,
      dispatcher,
      undefined,
      undefined,
      componentAccess
    );

    expect(actor.components[NOTES_COMPONENT_ID].notes).toHaveLength(2);
    expect(actor.components[NOTES_COMPONENT_ID].notes[1].text).toBe(
      'New structured note'
    );
    expect(actor.components[NOTES_COMPONENT_ID].notes[1].subject).toBe(
      'player_action'
    );
  });

  test('should handle multiple structured notes in one call', () => {
    const action = {
      notes: [
        {
          text: 'First observation',
          subject: 'npc_behavior',
        },
        {
          text: 'Second observation',
          subject: 'environment_state',
          context: 'market_square',
        },
        {
          text: 'Third observation',
          subject: 'quest_progress',
          tags: ['main_quest', 'chapter_2'],
        },
      ],
    };

    persistNotes(
      action,
      actor,
      logger,
      dispatcher,
      undefined,
      undefined,
      componentAccess
    );

    expect(actor.components[NOTES_COMPONENT_ID].notes).toHaveLength(3);
    expect(logger.debug).toHaveBeenCalledTimes(3);
  });

  test('should respect custom timestamp when provided via notesService', () => {
    const customDate = new Date('2025-06-15T12:00:00Z');
    const notesService = {
      addNotes: jest.fn(() => ({
        wasModified: true,
        component: { notes: [] },
        addedNotes: [
          {
            text: 'Test note',
            subject: 'test_subject',
            timestamp: customDate.toISOString(),
          },
        ],
      })),
    };

    const action = {
      notes: [
        {
          text: 'Test note',
          subject: 'test_subject',
        },
      ],
    };

    persistNotes(
      action,
      actor,
      logger,
      dispatcher,
      notesService,
      customDate,
      componentAccess
    );

    expect(notesService.addNotes).toHaveBeenCalledWith(
      { notes: [] },
      [{ text: 'Test note', subject: 'test_subject' }],
      customDate
    );
    expect(logger.debug).toHaveBeenCalledWith(
      `Added note: "Test note" at ${customDate.toISOString()}`
    );
  });
});