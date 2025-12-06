import { describe, it, expect, jest, afterEach } from '@jest/globals';

const MODULE_UNDER_TEST =
  '../../../../src/turns/services/actionIndexingService.js';
const CORE_CONSTANTS_PATH = '../../../../src/constants/core.js';

describe('ActionIndexingService branch coverage enhancements', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('applies default values when discovered actions omit optional fields', async () => {
    await jest.isolateModulesAsync(async () => {
      const { ActionIndexingService } = await import(MODULE_UNDER_TEST);
      const logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      const service = new ActionIndexingService({ logger });

      const composites = service.indexActions('actor-defaults', [
        { id: 'fallback', command: 'look' },
        { id: 'withNulls', command: 'speak', params: null, description: null },
      ]);

      expect(composites).toHaveLength(2);
      expect(composites[0]).toMatchObject({
        actionId: 'fallback',
        params: {},
        description: '',
        visual: null,
      });
      expect(composites[1]).toMatchObject({
        params: {},
        description: '',
      });
    });
  });

  it('omits parameter details when duplicate actions have empty params', async () => {
    await jest.isolateModulesAsync(async () => {
      const { ActionIndexingService } = await import(MODULE_UNDER_TEST);
      const logger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };
      const service = new ActionIndexingService({ logger });

      service.indexActions('actor-duplicates', [
        { id: 'duplicate', command: 'wave' },
        { id: 'duplicate', command: 'wave' },
        { id: 'unique', command: 'nod', params: { intensity: 'low' } },
      ]);

      const duplicateLog = logger.info.mock.calls.find(([message]) =>
        String(message).includes('duplicate actions')
      );

      expect(duplicateLog).toBeDefined();
      expect(duplicateLog[0]).toContain('duplicate (wave) x2');
      expect(duplicateLog[0]).not.toContain('params:');
    });
  });

  it('uses noop fallbacks when optional logger methods are absent', async () => {
    jest.doMock(
      CORE_CONSTANTS_PATH,
      () => ({
        MAX_AVAILABLE_ACTIONS_PER_TURN: 2,
      }),
      { virtual: true }
    );

    await jest.isolateModulesAsync(async () => {
      const { ActionIndexingService } = await import(MODULE_UNDER_TEST);
      const logger = {
        debug: jest.fn(),
      };
      const service = new ActionIndexingService({ logger });

      const composites = service.indexActions('actor-truncation', [
        { id: 'dup', command: 'wave' },
        { id: 'dup', command: 'wave' },
        { id: 'visual', command: 'look', visual: { icon: 'eye' } },
        { id: 'plain', command: 'walk' },
      ]);

      expect(composites).toHaveLength(2);
      expect(composites.map((c) => c.actionId)).toEqual(['dup', 'visual']);
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('indexed 2 actions for actor-truncation')
      );

      const resolved = service.resolve('actor-truncation', 1);
      expect(resolved.actionId).toBe('dup');
    });
  });
});
