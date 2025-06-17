import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ComponentCleaningService, {
  buildDefaultComponentCleaners,
} from '../../src/persistence/componentCleaningService.js';
import {
  NOTES_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  PERCEPTION_LOG_COMPONENT_ID,
} from '../../src/constants/componentIds.js';

const makeLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
});

const makeDispatcher = () => ({
  dispatch: jest.fn(),
});

describe('ComponentCleaningService', () => {
  let logger;
  let dispatcher;
  let service;

  beforeEach(() => {
    logger = makeLogger();
    dispatcher = makeDispatcher();
    service = new ComponentCleaningService({
      logger,
      safeEventDispatcher: dispatcher,
      defaultCleaners: buildDefaultComponentCleaners(logger),
    });
  });

  it('allows registering and executing custom cleaners', () => {
    service.registerCleaner('test:comp', () => ({ cleaned: true }));
    const result = service.clean('test:comp', { foo: 'bar' });
    expect(result).toEqual({ cleaned: true });
  });

  it('cleans default components', () => {
    const notes = service.clean(NOTES_COMPONENT_ID, { notes: [] });
    expect(notes).toEqual({});
    const mem = service.clean(SHORT_TERM_MEMORY_COMPONENT_ID, {
      thoughts: '   ',
    });
    expect(mem).toEqual({});
    const log = service.clean(PERCEPTION_LOG_COMPONENT_ID, {
      log: [{ action: { speech: ' ' } }],
    });
    expect(log.log[0].action.speech).toBeUndefined();
  });

  it('logs and throws when deep clone fails', () => {
    const cyc = {};
    cyc.self = cyc;
    expect(() => service.clean('loop', cyc)).toThrow(
      'Failed to deep clone object data.'
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'core:system_error_occurred',
      expect.objectContaining({
        message: 'ComponentCleaningService.clean deepClone failed',
        details: expect.objectContaining({ componentId: 'loop' }),
      })
    );
  });

  it('warns when registering a cleaner twice', () => {
    const firstCleaner = jest.fn(() => ({ first: true }));
    const secondCleaner = jest.fn(() => ({ second: true }));

    service.registerCleaner('dup:comp', firstCleaner);
    logger.warn.mockClear();
    service.registerCleaner('dup:comp', secondCleaner);

    expect(logger.warn).toHaveBeenCalledWith(
      "ComponentCleaningService: Cleaner for component 'dup:comp' already registered. Overwriting."
    );

    const result = service.clean('dup:comp', {});
    expect(result).toEqual({ second: true });
  });
});
