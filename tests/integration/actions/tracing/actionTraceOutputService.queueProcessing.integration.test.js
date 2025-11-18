/**
 * @file Integration tests for ActionTraceOutputService queue processing and file output flows
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createEnhancedMockLogger } from '../../../common/mockFactories/loggerMocks.js';

class FlakyStorageAdapter {
  constructor({ failTimes = 0 } = {}) {
    this.store = { actionTraces: [] };
    this.failTimes = failTimes;
  }

  async getItem(key) {
    return this.store[key];
  }

  async setItem(key, value) {
    if (this.failTimes > 0) {
      this.failTimes -= 1;
      throw new Error('Simulated storage failure');
    }
    this.store[key] = value;
  }

  async removeItem(key) {
    delete this.store[key];
  }

  async getAllKeys() {
    return Object.keys(this.store);
  }
}

/**
 *
 * @param root0
 * @param root0.beforeImport
 */
async function loadService({ beforeImport } = {}) {
  jest.resetModules();

  let ServiceClass;

  await jest.isolateModulesAsync(async () => {
    if (beforeImport) {
      await beforeImport();
    }

    const module = await import(
      '../../../../src/actions/tracing/actionTraceOutputService.js'
    );
    ServiceClass = module.ActionTraceOutputService;
  });

  return ServiceClass;
}

describe('ActionTraceOutputService advanced integration coverage', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('formats structured traces for storage and tracks statistics', async () => {
    const ActionTraceOutputService = await loadService({
      beforeImport: async () => {
        const rotationModule = await import(
          '../../../../src/actions/tracing/storageRotationManager.js'
        );
        jest
          .spyOn(
            rotationModule.StorageRotationManager.prototype,
            'forceRotation'
          )
          .mockResolvedValue({
            deleted: 0,
            preserved: 0,
            errors: 0,
            duration: 0,
          });
      },
    });

    const logger = createEnhancedMockLogger();
    const storageAdapter = new FlakyStorageAdapter();

    const jsonFormatter = {
      format: jest.fn(() => {
        throw new Error('format failure');
      }),
    };

    const humanReadableFormatter = {
      format: jest.fn(() => 'human readable output'),
    };

    const service = new ActionTraceOutputService({
      storageAdapter,
      logger,
      jsonFormatter,
      humanReadableFormatter,
      actionTraceConfig: { outputFormats: ['json'] },
    });

    const complexTrace = {
      actionId: 'complex-action',
      actorId: 'actor-42',
      hasError: false,
      duration: 250,
      getSpans: () => [
        { operation: 'scope-check', startTime: 80, endTime: 10 },
        { name: 'secondary', duration: 15, attributes: { foo: 'bar' } },
      ],
      getTracedActions: () =>
        new Map([
          [
            'complex-action',
            {
              actorId: 'actor-42',
              stages: {
                start: { timestamp: 100 },
                enhanced_scope_evaluation: {
                  data: {
                    scope: 'test-scope',
                    timestamp: 120,
                    entityDiscovery: [
                      { foundEntities: 2 },
                      { foundEntities: 1 },
                    ],
                    filterEvaluations: [
                      { filterPassed: true },
                      { filterPassed: false },
                    ],
                  },
                },
                finish: { timestamp: 260 },
              },
            },
          ],
          [
            '_current_scope_evaluation',
            {
              stages: {
                operator_evaluations: {
                  timestamp: 300,
                  data: {
                    evaluations: [
                      { filterPassed: true },
                      { filterPassed: false },
                    ],
                  },
                },
              },
            },
          ],
        ]),
    };

    await service.__TEST_ONLY_storeTrace(complexTrace);

    const storedCollection = Object.values(storageAdapter.store).find(
      (value) => Array.isArray(value) && value.length > 0
    );
    expect(storedCollection).toBeDefined();
    const storedTrace = storedCollection[0];
    expect(storedTrace.data.actions['complex-action'].stageOrder).toEqual(
      expect.arrayContaining(['start', 'enhanced_scope_evaluation', 'finish'])
    );
    expect(
      storedTrace.data.operatorEvaluations.evaluations.filter(
        (evaluation) => evaluation.filterPassed
      ).length
    ).toBe(1);
    expect(storedTrace.data.operatorEvaluations.totalCount).toBe(2);
    expect(
      storedTrace.data.actions['complex-action'].enhancedScopeEvaluation.summary
    ).toEqual(
      expect.objectContaining({
        entitiesDiscovered: 3,
        entitiesPassed: 1,
        entitiesFailed: 1,
      })
    );

    expect(
      logger.warn.mock.calls.some(([message]) =>
        message.includes('Span "scope-check" has negative duration')
      )
    ).toBe(true);
    expect(jsonFormatter.format).toHaveBeenCalled();

    for (let i = 0; i < 5; i += 1) {
      await service.__TEST_ONLY_storeTrace({
        actionId: `extra-${i}`,
        actorId: 'actor-extra',
        toJSON() {
          return { actionId: `extra-${i}`, actorId: 'actor-extra' };
        },
      });
    }

    const stats = service.getStatistics();
    expect(stats.totalWrites).toBeGreaterThan(0);
    expect(stats.totalErrors).toBe(0);
    expect(stats.pendingWrites).toBe(0);

    const rotationStats = await service.getRotationStatistics();
    expect(rotationStats).toEqual(
      expect.objectContaining({
        currentCount: expect.any(Number),
        policy: expect.any(String),
      })
    );

    service.resetStatistics();
    expect(service.getStatistics()).toEqual({
      totalWrites: 0,
      totalErrors: 0,
      pendingWrites: 0,
      errorRate: 0,
    });
  });

  it('enables file output multi-format writes and handles default handler fallbacks', async () => {
    const writes = [];
    let writeSpy;
    let setDirectorySpy;

    const ActionTraceOutputService = await loadService({
      beforeImport: async () => {
        const fileModule = await import(
          '../../../../src/actions/tracing/fileTraceOutputHandler.js'
        );
        jest
          .spyOn(fileModule.default.prototype, 'initialize')
          .mockResolvedValue(true);
        setDirectorySpy = jest
          .spyOn(fileModule.default.prototype, 'setOutputDirectory')
          .mockImplementation(() => {});
        jest
          .spyOn(fileModule.default.prototype, 'isQueueEmpty')
          .mockReturnValue(true);
        const behaviors = [
          async (data, trace) => {
            writes.push({ kind: 'json', data, trace });
            return true;
          },
          async (data, trace) => {
            writes.push({ kind: 'text', data, trace });
            return true;
          },
          async (data, trace) => {
            writes.push({ kind: 'default-fail', data, trace });
            return false;
          },
          async (data, trace) => {
            writes.push({ kind: 'default-error', data, trace });
            throw new Error('file failure');
          },
        ];
        writeSpy = jest
          .spyOn(fileModule.default.prototype, 'writeTrace')
          .mockImplementation(async (data, trace) => {
            const behavior = behaviors.shift();
            if (behavior) {
              return behavior(data, trace);
            }
            writes.push({ kind: 'extra', data, trace });
            return true;
          });
      },
    });

    const logger = createEnhancedMockLogger();
    const jsonFormatter = {
      format: (trace) => JSON.stringify(trace.toJSON()),
    };
    const humanReadableFormatter = {
      format: () => {
        throw new Error('text failure');
      },
    };

    const service = new ActionTraceOutputService({
      logger,
      jsonFormatter,
      humanReadableFormatter,
    });

    service.setOutputDirectory('./no-file');
    expect(
      logger.warn.mock.calls.some(([message]) =>
        message.includes('file output not enabled')
      )
    ).toBe(true);

    const enabled = service.enableFileOutput('./enabled');
    expect(enabled).toBe(true);
    expect(
      logger.info.mock.calls.some(([message]) =>
        message.includes('File output mode enabled')
      )
    ).toBe(true);

    service.setOutputDirectory('./enabled-2');
    expect(setDirectorySpy).toHaveBeenCalledWith('./enabled-2');

    service.updateConfiguration({
      outputFormats: ['json', 'text'],
      textFormatOptions: { pretty: true },
    });
    expect(
      logger.debug.mock.calls.some(([message]) =>
        message.includes('Configuration updated')
      )
    ).toBe(true);

    const fileTrace = {
      actionId: 'file-trace',
      actorId: 'actor-file',
      duration: 40,
      hasError: false,
      toJSON() {
        return {
          actionId: 'file-trace',
          actorId: 'actor-file',
          actionType: 'fileTrace',
          stages: { begin: { timestamp: 1 }, finish: { timestamp: 5 } },
        };
      },
    };

    const writePromise = service.writeTrace(fileTrace);
    const waitPromise = service.waitForPendingWrites();
    await writePromise;
    await waitPromise;
    await service.waitForFileOperations();

    expect(writes[0].kind).toBe('json');
    expect(typeof writes[1].data).toBe('string');

    const fallbackTrace = {
      actionId: 'fallback',
      actorId: 'actor-fallback',
      duration: 10,
      hasError: false,
      getExecutionPhases: () => ['phase'],
    };
    await service.__TEST_ONLY_defaultOutputHandler(
      {
        writeMetadata: { writeSequence: 99 },
      },
      fallbackTrace
    );
    await service.__TEST_ONLY_defaultOutputHandler(
      {
        writeMetadata: { writeSequence: 100 },
      },
      fallbackTrace
    );

    expect(
      logger.warn.mock.calls.some(([message]) =>
        message.includes('File output failed, falling back to console logging')
      )
    ).toBe(true);
    expect(
      logger.error.mock.calls.some(
        ([message, details]) =>
          message.includes(
            'File output error, falling back to console logging'
          ) && details?.error === 'file failure'
      )
    ).toBe(true);
    expect(
      logger.debug.mock.calls.some(([message]) => message === 'ACTION_TRACE')
    ).toBe(true);

    expect(writeSpy).toHaveBeenCalledTimes(4);
    expect(service.getQueueMetrics()).toBeNull();
  });

  it('exposes queue processor metrics when advanced processor is available', async () => {
    const ActionTraceOutputService = await loadService();

    const logger = createEnhancedMockLogger();
    const storageAdapter = new FlakyStorageAdapter();

    const service = new ActionTraceOutputService({
      storageAdapter,
      logger,
    });

    const metrics = service.getQueueMetrics();
    expect(metrics).toEqual(
      expect.objectContaining({
        totalEnqueued: expect.any(Number),
        totalProcessed: expect.any(Number),
      })
    );
  });
});
