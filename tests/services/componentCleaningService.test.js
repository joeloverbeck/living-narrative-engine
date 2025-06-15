import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ComponentCleaningService from '../../src/persistence/componentCleaningService.js';
import {
  NOTES_COMPONENT_ID,
  SHORT_TERM_MEMORY_COMPONENT_ID,
  PERCEPTION_LOG_COMPONENT_ID,
} from '../../src/constants/componentIds.js';

const makeLogger = () => ({
  debug: jest.fn(),
  error: jest.fn(),
});

describe('ComponentCleaningService', () => {
  let logger;
  let service;

  beforeEach(() => {
    logger = makeLogger();
    service = new ComponentCleaningService({ logger });
  });

  it('allows registering and executing custom cleaners', () => {
    service.registerCleaner('test:comp', (d) => ({ cleaned: true }));
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
    expect(logger.error).toHaveBeenCalledWith(
      'ComponentCleaningService.clean deepClone failed:',
      expect.any(Error),
      cyc
    );
  });
});
