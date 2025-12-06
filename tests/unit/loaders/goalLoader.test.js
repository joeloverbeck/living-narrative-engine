import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import GoalLoader from '../../../src/loaders/goalLoader.js';
import { BaseManifestItemLoader } from '../../../src/loaders/baseManifestItemLoader.js';
import * as processHelper from '../../../src/loaders/helpers/processAndStoreItem.js';
import { SimpleItemLoader } from '../../../src/loaders/simpleItemLoader.js';
import * as schemaValidationUtils from '../../../src/utils/schemaValidationUtils.js';
import { createGoalFixture } from '../../fixtures/goals/createGoalFixture.js';

/**
 * Creates minimal mock dependencies required for GoalLoader.
 *
 * @returns {object} mocks
 */
function createMocks() {
  const config = {
    getModsBasePath: jest.fn(),
    getContentTypeSchemaId: jest.fn().mockReturnValue('goal.schema.json'),
  };
  const pathResolver = { resolveModContentPath: jest.fn() };
  const dataFetcher = { fetch: jest.fn() };
  const schemaValidator = {
    validate: jest.fn(),
    getValidator: jest.fn(),
    isSchemaLoaded: jest.fn(),
  };
  const dataRegistry = { store: jest.fn(), get: jest.fn() };
  const logger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
  return {
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger,
  };
}

describe('GoalLoader._processFetchedItem', () => {
  let mocks;
  let loader;
  const originalAllowDefaults = process.env.GOAL_LOADER_ALLOW_DEFAULTS;
  const originalDiagnosticsFlag =
    process.env.GOAL_LOADER_NORMALIZATION_DIAGNOSTICS;

  beforeEach(() => {
    mocks = createMocks();
    loader = new GoalLoader(
      mocks.config,
      mocks.pathResolver,
      mocks.dataFetcher,
      mocks.schemaValidator,
      mocks.dataRegistry,
      mocks.logger
    );
  });

  afterEach(() => {
    GoalLoader.clearNormalizationExtensions();
    if (typeof originalAllowDefaults === 'undefined') {
      delete process.env.GOAL_LOADER_ALLOW_DEFAULTS;
    } else {
      process.env.GOAL_LOADER_ALLOW_DEFAULTS = originalAllowDefaults;
    }
    if (typeof originalDiagnosticsFlag === 'undefined') {
      delete process.env.GOAL_LOADER_NORMALIZATION_DIAGNOSTICS;
    } else {
      process.env.GOAL_LOADER_NORMALIZATION_DIAGNOSTICS =
        originalDiagnosticsFlag;
    }
  });

  it('calls processAndStoreItem with correct arguments and returns result', async () => {
    const processSpy = jest
      .spyOn(processHelper, 'processAndStoreItem')
      .mockResolvedValue({ qualifiedId: 'test:goal', didOverride: false });

    const data = createGoalFixture({
      id: 'goal',
      relevance: { condition: 'always' },
      goalState: { satisfied: true },
    });
    // FIX: Updated call to match the 5-argument signature of _processFetchedItem.
    // The 'resolvedPath' and 'registryKey' arguments are added.
    const result = await loader._processFetchedItem(
      'test',
      'goal.json',
      'test/goals/goal.json',
      data,
      'goals'
    );

    expect(processSpy).toHaveBeenCalledWith(loader, {
      data,
      idProp: 'id',
      category: 'goals',
      modId: 'test',
      filename: 'goal.json',
    });
    expect(result).toEqual({ qualifiedId: 'test:goal', didOverride: false });
    processSpy.mockRestore();
  });

  it('propagates didOverride flag from _parseIdAndStoreItem', async () => {
    const processSpy = jest
      .spyOn(processHelper, 'processAndStoreItem')
      .mockResolvedValue({ qualifiedId: 'mod:goal2', didOverride: true });

    const data = createGoalFixture({
      id: 'goal2',
      priority: 2,
      relevance: { condition: 'always' },
      goalState: { satisfied: true },
    });
    // FIX: Updated call to match the 5-argument signature.
    const result = await loader._processFetchedItem(
      'mod',
      'goal2.json',
      'mod/goals/goal2.json',
      data,
      'goals'
    );

    expect(result).toEqual({ qualifiedId: 'mod:goal2', didOverride: true });
    processSpy.mockRestore();
  });

  it('rethrows errors from _parseIdAndStoreItem', async () => {
    const error = new Error('parse failed');
    const parseSpy = jest
      .spyOn(processHelper, 'processAndStoreItem')
      .mockRejectedValue(error);

    const data = createGoalFixture({
      id: 'bad',
      priority: 5,
      relevance: { condition: 'always' },
      goalState: { satisfied: true },
    });
    // FIX: Updated call to match the 5-argument signature.
    await expect(
      loader._processFetchedItem(
        'badmod',
        'bad.json',
        'badmod/goals/bad.json',
        data,
        'goals'
      )
    ).rejects.toThrow(error);
    parseSpy.mockRestore();
  });

  it('normalizes goal data before delegating to the base loader', async () => {
    process.env.GOAL_LOADER_ALLOW_DEFAULTS = 'true';
    const processSpy = jest
      .spyOn(processHelper, 'processAndStoreItem')
      .mockResolvedValue({ qualifiedId: 'test:goal', didOverride: false });

    const data = createGoalFixture({
      id: 'goal-defaults',
      priority: '9',
      relevance: null,
      goalState: null,
    });

    await loader._processFetchedItem(
      'test',
      'goal.json',
      'path/goals/goal.json',
      data,
      'goals'
    );

    const storedPayload = processSpy.mock.calls[0][1].data;
    expect(storedPayload.priority).toBe(9);
    expect(storedPayload.relevance).toEqual({ '==': [1, 1] });
    expect(storedPayload.goalState).toEqual({
      '==': [{ var: 'state.goal.placeholder' }, true],
    });
    expect(storedPayload._normalization).toBeDefined();
    expect(storedPayload._normalization.mutations.length).toBeGreaterThan(0);
    expect(mocks.logger.warn).toHaveBeenCalled();

    processSpy.mockRestore();
  });

  it('runs registered normalization extensions via the GoalLoader API', async () => {
    const unregister = GoalLoader.registerNormalizationExtension(({ data }) => {
      data.extendedField = true;
    });

    const processSpy = jest
      .spyOn(processHelper, 'processAndStoreItem')
      .mockResolvedValue({ qualifiedId: 'test:goal', didOverride: false });

    const data = createGoalFixture({ id: 'goal-extension' });

    await loader._processFetchedItem(
      'test',
      'goal.json',
      'path/goals/goal.json',
      data,
      'goals'
    );

    const storedPayload = processSpy.mock.calls[0][1].data;
    expect(storedPayload.extendedField).toBe(true);

    unregister();
    processSpy.mockRestore();
  });

  it('emits structured diagnostics events and tracks counters when normalization mutates data', async () => {
    process.env.GOAL_LOADER_ALLOW_DEFAULTS = 'true';
    const processSpy = jest
      .spyOn(processHelper, 'processAndStoreItem')
      .mockResolvedValue({ qualifiedId: 'test:goal', didOverride: false });

    const data = createGoalFixture({
      id: 'goal-diagnostics',
      priority: '11',
      relevance: null,
      goalState: null,
    });

    await loader._processFetchedItem(
      'test',
      'goal.json',
      'path/goals/goal.json',
      data,
      'goals'
    );

    const mutationLog = mocks.logger.debug.mock.calls.find(
      ([message]) => message === 'goal-normalization.mutation'
    );
    expect(mutationLog).toBeDefined();
    expect(mutationLog[1]).toMatchObject({
      modId: 'test',
      filename: 'goal.json',
      allowDefaults: true,
      mutation: expect.objectContaining({ field: 'priority', type: 'coerced' }),
    });

    const snapshot = loader.getNormalizationDiagnosticsSnapshot();
    expect(snapshot.goalsProcessed).toBe(1);
    expect(snapshot.goalsWithMutations).toBe(1);
    expect(snapshot.totalMutations).toBeGreaterThanOrEqual(3);
    expect(snapshot.fieldsAutoFilled).toBe(2);
    expect(snapshot.warningsEmitted).toBeGreaterThanOrEqual(3);
    expect(snapshot.goalsRejected).toBe(0);

    processSpy.mockRestore();
  });

  it('suppresses per-mutation logs when GOAL_LOADER_NORMALIZATION_DIAGNOSTICS=0 but still tracks counters', async () => {
    process.env.GOAL_LOADER_ALLOW_DEFAULTS = 'true';
    process.env.GOAL_LOADER_NORMALIZATION_DIAGNOSTICS = '0';
    const processSpy = jest
      .spyOn(processHelper, 'processAndStoreItem')
      .mockResolvedValue({ qualifiedId: 'test:goal', didOverride: false });

    const data = createGoalFixture({
      id: 'goal-muted',
      priority: '7',
      relevance: null,
      goalState: null,
    });

    await loader._processFetchedItem(
      'test',
      'goal.json',
      'path/goals/goal.json',
      data,
      'goals'
    );

    const mutationLog = mocks.logger.debug.mock.calls.find(
      ([message]) => message === 'goal-normalization.mutation'
    );
    const warningLog = mocks.logger.debug.mock.calls.find(
      ([message]) => message === 'goal-normalization.warning'
    );
    expect(mutationLog).toBeUndefined();
    expect(warningLog).toBeUndefined();

    const snapshot = loader.getNormalizationDiagnosticsSnapshot();
    expect(snapshot.goalsWithMutations).toBe(1);
    expect(snapshot.diagnosticsEnabled).toBe(false);

    processSpy.mockRestore();
  });

  it('increments rejection counters when normalization throws', async () => {
    const processSpy = jest
      .spyOn(processHelper, 'processAndStoreItem')
      .mockResolvedValue({ qualifiedId: 'test:goal', didOverride: false });

    const invalidGoal = createGoalFixture({
      id: 'goal-invalid',
      priority: null,
    });

    await expect(
      loader._processFetchedItem(
        'test',
        'goal.json',
        'path/goals/goal.json',
        invalidGoal,
        'goals'
      )
    ).rejects.toThrow('Goal priority must be a finite number.');

    const snapshot = loader.getNormalizationDiagnosticsSnapshot();
    expect(snapshot.goalsRejected).toBe(1);
    expect(snapshot.goalsProcessed).toBe(0);

    processSpy.mockRestore();
  });
});

describe('GoalLoader diagnostics and error helpers', () => {
  let mocks;
  let loader;
  const originalAllowDefaults = process.env.GOAL_LOADER_ALLOW_DEFAULTS;
  const originalDiagnosticsFlag =
    process.env.GOAL_LOADER_NORMALIZATION_DIAGNOSTICS;

  beforeEach(() => {
    mocks = createMocks();
    loader = new GoalLoader(
      mocks.config,
      mocks.pathResolver,
      mocks.dataFetcher,
      mocks.schemaValidator,
      mocks.dataRegistry,
      mocks.logger
    );
  });

  afterEach(() => {
    if (typeof originalAllowDefaults === 'undefined') {
      delete process.env.GOAL_LOADER_ALLOW_DEFAULTS;
    } else {
      process.env.GOAL_LOADER_ALLOW_DEFAULTS = originalAllowDefaults;
    }
    if (typeof originalDiagnosticsFlag === 'undefined') {
      delete process.env.GOAL_LOADER_NORMALIZATION_DIAGNOSTICS;
    } else {
      process.env.GOAL_LOADER_NORMALIZATION_DIAGNOSTICS =
        originalDiagnosticsFlag;
    }
    jest.restoreAllMocks();
  });

  it('treats affirmative GOAL_LOADER_NORMALIZATION_DIAGNOSTICS values as enabled', () => {
    process.env.GOAL_LOADER_NORMALIZATION_DIAGNOSTICS = 'on';

    expect(loader._shouldEmitNormalizationDiagnostics()).toBe(true);
  });

  it('defaults to diagnostics enabled for unrecognized GOAL_LOADER_NORMALIZATION_DIAGNOSTICS values', () => {
    process.env.GOAL_LOADER_NORMALIZATION_DIAGNOSTICS = 'maybe';

    expect(loader._shouldEmitNormalizationDiagnostics()).toBe(true);
  });

  it('creates diagnostics state on demand when recording stats with no existing snapshot', () => {
    loader._normalizationDiagnostics = null;
    loader._emitNormalizationDiagnosticsLogs = jest.fn();

    loader._recordNormalizationStats(
      'mod-a',
      'goal.json',
      { mutations: [], warnings: [] },
      false
    );

    expect(loader._normalizationDiagnostics.modId).toBe('mod-a');
    expect(loader._normalizationDiagnostics.lastFile).toBe('goal.json');
    expect(loader._normalizationDiagnostics.goalsProcessed).toBe(1);
  });

  it('counts no autofilled fields when mutations is a non-array iterable-like object', () => {
    loader._emitNormalizationDiagnosticsLogs = jest.fn();

    loader._recordNormalizationStats(
      'mod-b',
      'mutations.json',
      { mutations: { 0: { type: 'coerced' }, length: 1 }, warnings: [] },
      false
    );

    expect(loader._normalizationDiagnostics.fieldsAutoFilled).toBe(0);
    expect(loader._normalizationDiagnostics.totalMutations).toBe(1);
  });

  it('initializes rejection diagnostics when normalization fails before state exists', () => {
    loader._normalizationDiagnostics = null;

    loader._recordNormalizationRejection('mod-c', 'failing.json');

    expect(loader._normalizationDiagnostics.goalsRejected).toBe(1);
    expect(loader._normalizationDiagnostics.lastFile).toBe('failing.json');
  });

  it('silently skips finalization when diagnostics were never initialized', () => {
    loader._normalizationDiagnostics = null;

    loader._finalizeNormalizationDiagnostics({ status: 'error' });

    expect(mocks.logger.info).not.toHaveBeenCalled();
    expect(loader.getNormalizationDiagnosticsSnapshot()).toBeNull();
  });

  it('captures error diagnostics when loadItemsForMod throws', async () => {
    const error = new Error('load failure');
    jest
      .spyOn(SimpleItemLoader.prototype, 'loadItemsForMod')
      .mockRejectedValueOnce(error);

    await expect(
      loader.loadItemsForMod('mod-d', {}, 'goals', '/disk', 'registry')
    ).rejects.toThrow(error);

    const snapshot = loader.getNormalizationDiagnosticsSnapshot();
    expect(snapshot.context.status).toBe('error');
    expect(snapshot.context.errorMessage).toBe('load failure');
    expect(snapshot.lastFile).toBeNull();
  });

  it('skips schema validation when no primary schema is configured', () => {
    loader._primarySchemaId = null;

    const result = loader._validatePrimarySchema(
      {},
      'goal.json',
      'mod-e',
      '/path'
    );

    expect(result).toEqual({ isValid: true, errors: null });
    expect(mocks.logger.debug).toHaveBeenCalled();
  });

  it('logs warnings and returns errors when schema validation fails but defaults are allowed', () => {
    loader._primarySchemaId = 'goal.schema.json';
    process.env.GOAL_LOADER_ALLOW_DEFAULTS = 'true';
    jest
      .spyOn(schemaValidationUtils, 'validateAgainstSchema')
      .mockImplementation(() => {
        throw new Error('schema failure');
      });

    const result = loader._validatePrimarySchema(
      { id: 'goal-x' },
      'goal.json',
      'mod-f',
      '/abs/path'
    );

    expect(result).toEqual({ isValid: false, errors: null });
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Schema validation failed'),
      expect.objectContaining({ modId: 'mod-f', filename: 'goal.json' })
    );
  });

  it('serializes goal data snippets from the root pointer', () => {
    const error = loader._createGoalSchemaError(
      new Error('validation'),
      'goal.schema.json',
      { foo: 'bar' },
      'mod-g',
      'goal.json',
      '/abs/path',
      { instancePath: '', message: 'failed' }
    );

    expect(error.context.dataSnippet).toBe('{"foo":"bar"}');
  });

  it('returns undefined snippets when the instance path cannot be resolved', () => {
    const error = loader._createGoalSchemaError(
      new Error('validation'),
      'goal.schema.json',
      { foo: 'bar' },
      'mod-h',
      'goal.json',
      '/abs/path',
      { instancePath: '/missing', message: 'failed' }
    );

    expect(error.context.dataSnippet).toBeUndefined();
  });

  it('truncates large serialized snippets and handles unserializable data', () => {
    const largeObject = { big: Array(150).fill('x') };
    const circular = { nested: largeObject };
    circular.self = circular;

    const truncated = loader._createGoalSchemaError(
      new Error('validation'),
      'goal.schema.json',
      { payload: largeObject },
      'mod-i',
      'goal.json',
      '/abs/path',
      { instancePath: '/payload', message: 'failed' }
    );

    expect(truncated.context.dataSnippet.endsWith('...')).toBe(true);

    const unserializable = loader._createGoalSchemaError(
      new Error('validation'),
      'goal.schema.json',
      { circular },
      'mod-j',
      'goal.json',
      '/abs/path',
      { instancePath: '/circular', message: 'failed' }
    );

    expect(unserializable.context.dataSnippet).toBe('[unserializable snippet]');
  });
});
