import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { persistThoughts } from '../../../src/ai/thoughtPersistenceHook.js';
import ShortTermMemoryService from '../../../src/ai/shortTermMemoryService.js';
import ComponentAccessService from '../../../src/entities/componentAccessService.js';
import { SHORT_TERM_MEMORY_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';

describe('persistThoughts integration', () => {
  let logger;
  let componentAccess;
  let dispatcher;

  beforeEach(() => {
    logger = { warn: jest.fn() };
    componentAccess = new ComponentAccessService();
    dispatcher = { dispatch: jest.fn() };
  });

  it('logs a warning and dispatches a system error when thoughts are blank', () => {
    const actor = {
      id: 'actor-blank',
      components: {
        [SHORT_TERM_MEMORY_COMPONENT_ID]: {
          thoughts: [],
          maxEntries: 1,
        },
      },
    };
    const action = { thoughts: '    ' };
    const fetchSpy = jest.spyOn(componentAccess, 'fetchComponent');

    persistThoughts(
      action,
      actor,
      logger,
      dispatcher,
      new ShortTermMemoryService(),
      new Date('2024-01-01T00:00:00.000Z'),
      componentAccess
    );

    expect(logger.warn).toHaveBeenCalledWith('STM-001 Missing thoughts');
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      SYSTEM_ERROR_OCCURRED_ID,
      expect.objectContaining({
        message: expect.stringContaining('thoughts'),
        details: { actorId: 'actor-blank' },
      })
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('logs and skips persistence when the short-term memory component is missing', () => {
    const actor = { id: 'actor-missing', components: {} };
    const action = { thoughts: 'record me' };
    const stmService = new ShortTermMemoryService();
    const addThoughtSpy = jest.spyOn(stmService, 'addThought');
    const applySpy = jest.spyOn(componentAccess, 'applyComponent');

    persistThoughts(
      action,
      actor,
      logger,
      undefined,
      stmService,
      new Date('2024-02-02T12:00:00.000Z'),
      componentAccess
    );

    expect(logger.warn).toHaveBeenCalledWith('STM-002 Missing component');
    expect(addThoughtSpy).not.toHaveBeenCalled();
    expect(applySpy).not.toHaveBeenCalled();
  });

  it('persists trimmed thoughts and applies the updated memory component', () => {
    const initialThoughts = [
      { text: 'keep me', timestamp: '2024-03-01T09:00:00.000Z' },
      { text: 'replace me', timestamp: '2024-03-01T10:00:00.000Z' },
    ];
    const actor = {
      id: 'actor-update',
      components: {
        [SHORT_TERM_MEMORY_COMPONENT_ID]: {
          entityId: 'actor-update',
          maxEntries: 2,
          thoughts: [...initialThoughts],
        },
      },
    };
    const action = { thoughts: '   Fresh perspective   ' };
    const now = new Date('2024-03-01T11:00:00.000Z');
    const stmService = new ShortTermMemoryService();
    const addThoughtSpy = jest.spyOn(stmService, 'addThought');
    const applySpy = jest.spyOn(componentAccess, 'applyComponent');

    persistThoughts(
      action,
      actor,
      logger,
      undefined,
      stmService,
      now,
      componentAccess
    );

    expect(addThoughtSpy).toHaveBeenCalledWith(
      actor.components[SHORT_TERM_MEMORY_COMPONENT_ID],
      'Fresh perspective',
      now
    );
    expect(applySpy).toHaveBeenCalledWith(
      actor,
      SHORT_TERM_MEMORY_COMPONENT_ID,
      actor.components[SHORT_TERM_MEMORY_COMPONENT_ID]
    );

    const updatedThoughts =
      actor.components[SHORT_TERM_MEMORY_COMPONENT_ID].thoughts;
    expect(updatedThoughts).toHaveLength(2);
    expect(updatedThoughts[0]).toEqual(initialThoughts[1]);
    expect(updatedThoughts[1]).toEqual({
      text: 'Fresh perspective',
      timestamp: now.toISOString(),
    });
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
