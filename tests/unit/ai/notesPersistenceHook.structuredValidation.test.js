/**
 * @file Tests for structured note validation in notesPersistenceHook
 * @see src/ai/notesPersistenceHook.js
 */

import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { persistNotes } from '../../../src/ai/notesPersistenceHook.js';
import { NOTES_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';
import ComponentAccessService from '../../../src/entities/componentAccessService.js';

const makeLogger = () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
});

describe('persistNotes - structured note validation', () => {
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

  test('should dispatch error for object with missing text field', () => {
    const action = {
      notes: [
        {
          subject: 'valid_subject',
          // text field is missing
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

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'NotesPersistenceHook: Invalid note skipped',
        details: {
          note: { subject: 'valid_subject' },
          reason: 'Missing or blank text field',
        },
      })
    );
    expect(actor.components).toEqual({});
  });

  test('should dispatch error for object with blank text field', () => {
    const action = {
      notes: [
        {
          text: '',
          subject: 'valid_subject',
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

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'NotesPersistenceHook: Invalid note skipped',
        details: {
          note: { text: '', subject: 'valid_subject' },
          reason: 'Missing or blank text field',
        },
      })
    );
  });

  test('should dispatch error for object with whitespace-only text field', () => {
    const action = {
      notes: [
        {
          text: '   ',
          subject: 'valid_subject',
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

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'NotesPersistenceHook: Invalid note skipped',
        details: {
          note: { text: '   ', subject: 'valid_subject' },
          reason: 'Missing or blank text field',
        },
      })
    );
  });

  test('should dispatch error for object with missing subject field', () => {
    const action = {
      notes: [
        {
          text: 'Valid text content',
          // subject field is missing
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

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'NotesPersistenceHook: Invalid note skipped',
        details: {
          note: { text: 'Valid text content' },
          reason: 'Missing or blank subject field',
        },
      })
    );
  });

  test('should dispatch error for object with blank subject field', () => {
    const action = {
      notes: [
        {
          text: 'Valid text content',
          subject: '',
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

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'NotesPersistenceHook: Invalid note skipped',
        details: {
          note: { text: 'Valid text content', subject: '' },
          reason: 'Missing or blank subject field',
        },
      })
    );
  });

  test('should dispatch error for object with whitespace-only subject field', () => {
    const action = {
      notes: [
        {
          text: 'Valid text content',
          subject: '   \t\n',
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

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'NotesPersistenceHook: Invalid note skipped',
        details: {
          note: { text: 'Valid text content', subject: '   \t\n' },
          reason: 'Missing or blank subject field',
        },
      })
    );
  });

  test('should handle mixed valid and invalid structured notes', () => {
    const action = {
      notes: [
        {
          text: 'Valid note 1',
          subject: 'subject_1',
        },
        {
          text: '',
          subject: 'subject_2',
        },
        {
          text: 'Valid note 2',
          subject: '',
        },
        {
          text: 'Valid note 3',
          subject: 'subject_3',
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

    // Should dispatch 2 errors
    expect(dispatcher.dispatch).toHaveBeenCalledTimes(2);

    // Should only persist the 2 valid notes
    expect(actor.components[NOTES_COMPONENT_ID].notes).toHaveLength(2);
    expect(actor.components[NOTES_COMPONENT_ID].notes[0].text).toBe(
      'Valid note 1'
    );
    expect(actor.components[NOTES_COMPONENT_ID].notes[1].text).toBe(
      'Valid note 3'
    );
  });

  test('should dispatch error for object with null text field', () => {
    const action = {
      notes: [
        {
          text: null,
          subject: 'valid_subject',
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

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'NotesPersistenceHook: Invalid note skipped',
        details: {
          note: { text: null, subject: 'valid_subject' },
          reason: 'Missing or blank text field',
        },
      })
    );
  });

  test('should dispatch error for object with null subject field', () => {
    const action = {
      notes: [
        {
          text: 'Valid text',
          subject: null,
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

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'NotesPersistenceHook: Invalid note skipped',
        details: {
          note: { text: 'Valid text', subject: null },
          reason: 'Missing or blank subject field',
        },
      })
    );
  });

  test('should dispatch error for object with both text and subject invalid', () => {
    const action = {
      notes: [
        {
          text: '',
          subject: '',
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

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'NotesPersistenceHook: Invalid note skipped',
        details: {
          note: { text: '', subject: '' },
          reason: 'Missing or blank text field', // text is checked first
        },
      })
    );
  });

  test('should handle structured notes with extra fields but invalid required fields', () => {
    const action = {
      notes: [
        {
          text: '',
          subject: 'valid_subject',
          context: 'some_context',
          tags: ['tag1', 'tag2'],
          metadata: { extra: 'data' },
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

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'NotesPersistenceHook: Invalid note skipped',
        details: {
          note: expect.objectContaining({
            text: '',
            subject: 'valid_subject',
            context: 'some_context',
          }),
          reason: 'Missing or blank text field',
        },
      })
    );
  });

  test('should cover else-if branch for object with valid text but no subject', () => {
    // This test specifically covers the else-if branch on line 82
    const action = {
      notes: [
        {
          text: 'Valid text',
          // Intentionally not setting subject property at all
          otherField: 'other',
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

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: 'NotesPersistenceHook: Invalid note skipped',
        details: {
          note: { text: 'Valid text', otherField: 'other' },
          reason: 'Missing or blank subject field',
        },
      })
    );
  });
});
