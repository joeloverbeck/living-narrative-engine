import { describe, it, expect } from '@jest/globals';
import ContentLoadManager from '../../../src/loaders/ContentLoadManager.js';
import LoadResultAggregator from '../../../src/loaders/LoadResultAggregator.js';
import { ContentLoadStatus } from '../../../src/loaders/types.js';

/**
 * @description Minimal in-memory logger used to capture log output emitted by the content loader pipeline.
 * @class
 */
class TestLogger {
  constructor() {
    this.logs = {
      debug: [],
      info: [],
      warn: [],
      error: [],
    };
  }

  debug(message, ...args) {
    this.logs.debug.push({ message, args });
  }

  info(message, ...args) {
    this.logs.info.push({ message, args });
  }

  warn(message, ...args) {
    this.logs.warn.push({ message, args });
  }

  error(message, ...args) {
    this.logs.error.push({ message, args });
  }

  get errorMessages() {
    return this.logs.error.map(({ message }) => String(message));
  }

  get debugMessages() {
    return this.logs.debug.map(({ message }) => String(message));
  }
}

/**
 * @description Lightweight dispatcher that records dispatched events for assertions.
 * @class
 */
class RecordingDispatcher {
  constructor() {
    this.events = [];
  }

  async dispatch(eventName, payload, options) {
    this.events.push({ eventName, payload, options });
    return true;
  }
}

/**
 * @description Test loader implementation that returns scripted results and tracks finalize calls.
 * @class
 */
class RecordingLoader {
  constructor(name, plans = new Map(), { throwOnFinalize = false } = {}) {
    this.name = name;
    this.plans = plans;
    this.throwOnFinalize = throwOnFinalize;
    this.calls = [];
    this.finalizeCalls = 0;
    this.finalized = false;
  }

  async loadItemsForMod(modId, manifest, contentKey, diskFolder, registryKey) {
    this.calls.push({ modId, manifest, contentKey, diskFolder, registryKey });
    const plan = this.plans.get(modId);
    if (!plan) {
      return { count: 0, overrides: 0, errors: 0, failures: [] };
    }

    if (plan.throw) {
      const error = new Error(plan.throw);
      if (plan.code) {
        error.code = plan.code;
      }
      throw error;
    }

    const { count = 0, overrides = 0, errors = 0, failures = [] } = plan;
    return { count, overrides, errors, failures };
  }

  async finalize() {
    this.finalizeCalls += 1;
    if (this.throwOnFinalize) {
      throw new Error(`${this.name} finalize failure`);
    }
    this.finalized = true;
  }
}

/**
 * @description Builds a manifest object containing entity definition and instance references.
 * @param {string} id - Identifier of the manifest being created.
 * @param {{definitions?: string[], instances?: string[]}} [options] - Optional overrides for manifest content arrays.
 * @returns {{id: string, content: {entities: {definitions: string[], instances: string[]}}}} Manifest description for tests.
 */
function createManifest(id, { definitions = ['entry.json'], instances = ['instance.json'] } = {}) {
  return {
    id,
    content: {
      entities: {
        definitions: [...definitions],
        instances: [...instances],
      },
    },
  };
}

/**
 * @typedef {object} BuildManagerOptions
 * @property {Map<string, {count?: number, overrides?: number, errors?: number, failures?: Array<{file?: string, error?: Error}>, throw?: string, code?: string}>} [definitionPlan]
 * Scripted behavior for the definitions loader keyed by mod ID.
 * @property {Map<string, {count?: number, overrides?: number, errors?: number, failures?: Array<{file?: string, error?: Error}>, throw?: string, code?: string}>} [instancePlan]
 * Scripted behavior for the instances loader keyed by mod ID.
 * @property {boolean} [definitionFinalizeThrows=false] - Whether the definitions loader should throw during finalize.
 * @property {boolean} [instanceFinalizeThrows=false] - Whether the instances loader should throw during finalize.
 * @property {boolean} [includeDefinitions=true] - Whether to include a definitions phase loader in the configuration.
 * @property {boolean} [includeInstances=true] - Whether to include an instances phase loader in the configuration.
 */

/**
 * @description Creates a {@link ContentLoadManager} wired with deterministic test doubles for integration coverage.
 * @param {BuildManagerOptions} [options] - Configuration describing loader behaviors and phase inclusion.
 * @returns {{
 *   manager: ContentLoadManager,
 *   logger: TestLogger,
 *   dispatcher: RecordingDispatcher,
 *   contentLoadersConfig: import('../../../src/loaders/defaultLoaderConfig.js').LoaderConfigEntry[],
 *   loaders: Record<string, RecordingLoader>
 * }} Object containing the manager and supporting doubles for assertions.
 */
function buildManager({
  definitionPlan = new Map(),
  instancePlan = new Map(),
  definitionFinalizeThrows = false,
  instanceFinalizeThrows = false,
  includeDefinitions = true,
  includeInstances = true,
} = {}) {
  const logger = new TestLogger();
  const dispatcher = new RecordingDispatcher();
  const contentLoadersConfig = [];
  const loaders = {};

  if (includeDefinitions) {
    const loader = new RecordingLoader('entityDefinitions', definitionPlan, {
      throwOnFinalize: definitionFinalizeThrows,
    });
    contentLoadersConfig.push({
      loader,
      registryKey: 'entityDefinitions',
      contentKey: 'entities.definitions',
      diskFolder: 'entities/definitions',
      phase: 'definitions',
    });
    loaders.definitionLoader = loader;
  }

  if (includeInstances) {
    const loader = new RecordingLoader('entityInstances', instancePlan, {
      throwOnFinalize: instanceFinalizeThrows,
    });
    contentLoadersConfig.push({
      loader,
      registryKey: 'entityInstances',
      contentKey: 'entities.instances',
      diskFolder: 'entities/instances',
      phase: 'instances',
    });
    loaders.instanceLoader = loader;
  }

  const timer = (() => {
    let current = 0;
    return () => {
      current += 5;
      return current;
    };
  })();

  const manager = new ContentLoadManager({
    logger,
    validatedEventDispatcher: dispatcher,
    contentLoadersConfig,
    aggregatorFactory: (counts) => new LoadResultAggregator(counts),
    timer,
  });

  return { manager, logger, dispatcher, contentLoadersConfig, loaders };
}

describe('Integration: ContentLoadManager deep coverage', () => {
  it('orchestrates multi-phase loading, merges totals, and finalizes loaders while surfacing loader failures', async () => {
    const definitionPlan = new Map([
      ['alpha', { count: 2, overrides: 1, errors: 0 }],
    ]);
    const instancePlan = new Map([
      ['alpha', { throw: 'instance processing exploded' }],
    ]);

    const { manager, logger, dispatcher, contentLoadersConfig, loaders } = buildManager({
      definitionPlan,
      instancePlan,
      definitionFinalizeThrows: true,
      instanceFinalizeThrows: false,
    });

    const finalModOrder = ['alpha'];
    const manifests = new Map([
      [
        'alpha',
        createManifest('alpha', {
          definitions: ['hero.def.json'],
          instances: ['hero.inst.json'],
        }),
      ],
    ]);
    const initialTotals = {
      entityDefinitions: { count: 1, overrides: 0, errors: 0 },
    };

    const result = await manager.loadContent(finalModOrder, manifests, initialTotals);

    expect(result.results).toEqual({
      alpha: ContentLoadStatus.FAILED,
    });
    expect(result.updatedTotals).toEqual({
      entityDefinitions: { count: 3, overrides: 1, errors: 0, failures: [] },
      entityInstances: { count: 0, overrides: 0, errors: 1, failures: [] },
    });
    expect(initialTotals).toEqual({
      entityDefinitions: { count: 1, overrides: 0, errors: 0 },
    });
    expect(result.updatedTotals).not.toBe(initialTotals);

    expect(loaders.definitionLoader.calls).toHaveLength(1);
    expect(loaders.instanceLoader.calls).toHaveLength(1);
    expect(loaders.instanceLoader.finalized).toBe(true);
    expect(loaders.definitionLoader.finalizeCalls).toBe(1);

    const failureEvent = dispatcher.events.find(
      (event) => event.eventName === 'initialization:world_loader:content_load_failed'
    );
    expect(failureEvent).toBeDefined();
    expect(failureEvent.payload).toEqual(
      expect.objectContaining({ modId: 'alpha', registryKey: 'entityInstances' })
    );

    expect(
      logger.errorMessages.some((message) =>
        message.includes('Error finalizing loader')
      )
    ).toBe(true);
  });

  it('returns skipped results when no loaders are configured for a phase', async () => {
    const { manager } = buildManager({ includeDefinitions: false, includeInstances: false });
    const finalOrder = ['alpha', 'beta'];
    const manifests = new Map([
      ['alpha', createManifest('alpha')],
      ['beta', createManifest('beta')],
    ]);
    const baseTotals = {
      entityDefinitions: { count: 0, overrides: 0, errors: 0 },
    };

    const phaseResult = await manager.loadContentForPhase(
      finalOrder,
      manifests,
      baseTotals,
      'instances'
    );

    expect(phaseResult.results).toEqual({
      alpha: ContentLoadStatus.SKIPPED,
      beta: ContentLoadStatus.SKIPPED,
    });
    expect(phaseResult.updatedTotals).toBe(baseTotals);
  });

  it('skips processing when a manifest is missing and records a mod failure event', async () => {
    const { manager, dispatcher, contentLoadersConfig } = buildManager();
    const totals = {
      entityDefinitions: { count: 0, overrides: 0, errors: 0 },
      entityInstances: { count: 0, overrides: 0, errors: 0 },
    };

    const definitionLoaders = contentLoadersConfig.filter(
      (entry) => entry.phase === 'definitions'
    );

    const result = await manager.processMod(
      'beta',
      null,
      totals,
      definitionLoaders,
      'definitions'
    );

    expect(result.status).toBe(ContentLoadStatus.SKIPPED);
    expect(result.updatedTotals).toEqual(totals);
    expect(result.updatedTotals).not.toBe(totals);

    const modFailureEvent = dispatcher.events.find(
      (event) => event.eventName === 'initialization:world_loader:mod_load_failed'
    );
    expect(modFailureEvent).toBeDefined();
    expect(modFailureEvent.payload).toEqual(
      expect.objectContaining({ modId: 'beta' })
    );
  });

  it('marks mods as failed when processMod throws and continues with remaining mods', async () => {
    const definitionPlan = new Map([
      ['beta', { count: 1, overrides: 0, errors: 0 }],
    ]);
    const { manager, logger, contentLoadersConfig } = buildManager({
      definitionPlan,
      includeInstances: false,
    });

    const finalOrder = ['alpha', 'beta'];
    const manifests = new Map([
      [
        'alpha',
        createManifest('alpha', { definitions: ['alpha.def.json'], instances: [] }),
      ],
      [
        'beta',
        createManifest('beta', { definitions: ['beta.def.json'], instances: [] }),
      ],
    ]);

    const baseTotals = {
      entityDefinitions: { count: 0, overrides: 0, errors: 0 },
    };

    const originalProcessMod = manager.processMod.bind(manager);
    manager.processMod = async (modId, manifest, totals, loaders, phase) => {
      if (modId === 'alpha') {
        throw new Error('unexpected loader error');
      }
      return originalProcessMod(modId, manifest, totals, loaders, phase);
    };

    const outcome = await manager.loadContentForPhase(
      finalOrder,
      manifests,
      baseTotals,
      'definitions'
    );

    expect(outcome.results).toEqual({
      alpha: ContentLoadStatus.FAILED,
      beta: ContentLoadStatus.SUCCESS,
    });
    expect(outcome.updatedTotals).toEqual({
      entityDefinitions: { count: 1, overrides: 0, errors: 0, failures: [] },
    });

    expect(
      logger.errorMessages.some((message) =>
        message.includes('ContentLoadManager: Error during processMod')
      )
    ).toBe(true);

    manager.processMod = originalProcessMod;
  });
});
