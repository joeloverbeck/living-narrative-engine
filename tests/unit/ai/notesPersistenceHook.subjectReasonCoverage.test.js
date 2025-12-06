import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import { persistNotes } from '../../../src/ai/notesPersistenceHook.js';
import { NOTES_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/eventIds.js';

const createLogger = () => ({
  debug: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
});

describe('NotesPersistenceHook subject validation edge cases', () => {
  let actor;
  let logger;
  let dispatcher;

  beforeEach(() => {
    actor = {
      id: 'actor-edge',
      components: {},
      addComponent: jest.fn(function addComponent(id, data) {
        this.components[id] = data;
      }),
    };
    logger = createLogger();
    dispatcher = { dispatch: jest.fn() };
  });

  it('retains diagnostic details when a subject becomes valid on re-read', () => {
    let subjectAccessCount = 0;
    const inconsistentNote = {
      text: 'Temporal subject note',
      get subject() {
        subjectAccessCount += 1;
        return subjectAccessCount === 1 ? '   ' : 'Quest hook';
      },
    };

    persistNotes({ notes: [inconsistentNote] }, actor, logger, dispatcher);

    expect(dispatcher.dispatch).toHaveBeenCalledTimes(1);
    const [eventName, payload] = dispatcher.dispatch.mock.calls[0];
    expect(eventName).toBe(SYSTEM_ERROR_OCCURRED_ID);
    expect(payload.details.note).toBe(inconsistentNote);
    expect(payload.details.reason).toBeUndefined();

    expect(actor.addComponent).not.toHaveBeenCalled();
    expect(actor.components[NOTES_COMPONENT_ID]).toBeUndefined();
  });
});
