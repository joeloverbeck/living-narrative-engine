import { describe, expect, test } from '@jest/globals';
import { persistNotes } from '../../../src/ai/notesPersistenceHook.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';
import Entity from '../../../src/entities/entity.js';
import { NOTES_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import {
  DEFAULT_SUBJECT_TYPE,
  SUBJECT_TYPES,
} from '../../../src/constants/subjectTypes.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(message, context) {
    this.debugLogs.push({ message, context });
  }

  info(message, context) {
    this.infoLogs.push({ message, context });
  }

  warn(message, context) {
    this.warnLogs.push({ message, context });
  }

  error(message, context) {
    this.errorLogs.push({ message, context });
  }
}

class RecordingDispatcher {
  constructor() {
    this.events = [];
  }

  dispatch(eventName, payload) {
    this.events.push({ eventName, payload });
  }
}

describe('notesPersistenceHook integration with Entity overrides', () => {
  test('merges notes into entity overrides while dispatching structured errors', () => {
    const baseDefinition = new EntityDefinition('core:test_actor', {
      components: {
        [NOTES_COMPONENT_ID]: {
          notes: [
            {
              text: 'Existing mission report',
              subject: 'history',
              subjectType: SUBJECT_TYPES.EVENT,
              timestamp: '2024-01-01T00:00:00.000Z',
            },
          ],
        },
      },
    });

    const instanceData = new EntityInstanceData(
      'actor-entity-override',
      baseDefinition
    );
    const actorEntity = new Entity(instanceData);
    const logger = new RecordingLogger();
    const dispatcher = new RecordingDispatcher();
    const timestamp = new Date('2025-05-15T10:00:00.000Z');

    persistNotes(
      {
        notes: [
          {
            text: 'Existing mission report',
            subject: 'history',
            subjectType: SUBJECT_TYPES.EVENT,
          },
          { text: 'Update infiltration plan', subject: 'operations' },
          {
            text: 'Investigate corrupted beacon',
            subject: 'danger',
            subjectType: 'nonsense-category',
          },
          { text: '   ', subject: 'ignored entry' },
        ],
      },
      actorEntity,
      logger,
      dispatcher,
      undefined,
      timestamp
    );

    const storedNotes = actorEntity.getComponentData(NOTES_COMPONENT_ID).notes;
    expect(storedNotes).toHaveLength(3);
    expect(storedNotes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'Existing mission report',
          subject: 'history',
          subjectType: SUBJECT_TYPES.EVENT,
        }),
        expect.objectContaining({
          text: 'Update infiltration plan',
          subject: 'operations',
          subjectType: DEFAULT_SUBJECT_TYPE,
          timestamp: timestamp.toISOString(),
        }),
        expect.objectContaining({
          text: 'Investigate corrupted beacon',
          subject: 'danger',
          subjectType: DEFAULT_SUBJECT_TYPE,
        }),
      ])
    );

    expect(actorEntity.hasComponentOverride(NOTES_COMPONENT_ID)).toBe(true);

    expect(dispatcher.events).toHaveLength(2);
    expect(dispatcher.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          eventName: SYSTEM_ERROR_OCCURRED_ID,
          payload: expect.objectContaining({
            message: 'NotesPersistenceHook: Invalid subjectType, using default',
            details: expect.objectContaining({
              invalidSubjectType: 'nonsense-category',
              subject: 'danger',
              defaultAssigned: DEFAULT_SUBJECT_TYPE,
            }),
          }),
        }),
        expect.objectContaining({
          eventName: SYSTEM_ERROR_OCCURRED_ID,
          payload: expect.objectContaining({
            message: 'NotesPersistenceHook: Invalid note skipped',
            details: expect.objectContaining({
              reason: 'Missing or blank text field',
            }),
          }),
        }),
      ])
    );

    const debugMessages = logger.debugLogs.map(({ message }) => message);
    expect(debugMessages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Auto-assigned default subjectType'),
        expect.stringContaining('Added note: "Update infiltration plan"'),
        expect.stringContaining('Added note: "Investigate corrupted beacon"'),
      ])
    );
  });
});
