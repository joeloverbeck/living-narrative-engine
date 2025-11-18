import { describe, it, expect, beforeEach } from '@jest/globals';
import { TargetResolutionStage } from '../../../../../src/actions/pipeline/stages/TargetResolutionStage.js';
import { TargetResolutionService } from '../../../../../src/actions/targetResolutionService.js';
import { UnifiedScopeResolver } from '../../../../../src/actions/scopes/unifiedScopeResolver.js';
import { ActionErrorContextBuilder } from '../../../../../src/actions/errors/actionErrorContextBuilder.js';
import { ActionTargetContext } from '../../../../../src/models/actionTargetContext.js';
import SimpleEntityManager from '../../../../common/entities/simpleEntityManager.js';

class TestLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(message, meta) {
    this.debugLogs.push({ message, meta });
  }

  info(message, meta) {
    this.infoLogs.push({ message, meta });
  }

  warn(message, meta) {
    this.warnLogs.push({ message, meta });
  }

  error(message, meta) {
    this.errorLogs.push({ message, meta });
  }
}

class StubFixSuggestionEngine {
  suggestFixes() {
    return [];
  }
}

class StaticScopeRegistry {
  constructor(definitions = {}) {
    this.definitions = new Map(Object.entries(definitions));
  }

  getScope(name) {
    return this.definitions.get(name) ?? null;
  }

  getScopeAst(name) {
    return this.getScope(name)?.ast ?? null;
  }

  hasScope(name) {
    return this.definitions.has(name);
  }
}

class StaticScopeEngine {
  constructor(resolvers = {}) {
    this.resolvers = resolvers;
  }

  resolve(ast, actor, runtimeCtx) {
    const resolver = this.resolvers[ast.key];
    if (!resolver) {
      return new Set();
    }

    const value = resolver({ actor, runtimeCtx });
    if (value instanceof Set) {
      return value;
    }
    if (Array.isArray(value)) {
      return new Set(value);
    }
    if (value && typeof value === 'object' && value instanceof Error) {
      throw value;
    }
    return new Set();
  }
}

class StaticJsonLogicEvaluationService {
  evaluate() {
    return true;
  }
}

class StaticDslParser {
  parse(expr) {
    return { key: expr };
  }
}

class TestTrace {
  constructor() {
    this.steps = [];
    this.infos = [];
    this.successes = [];
    this.failures = [];
    this.spans = [];
    this.logs = [];
  }

  #record(type, message, source, data) {
    const entry = {
      type,
      message,
      source,
      data,
      timestamp: Date.now(),
    };
    this.logs.push(entry);
    return entry;
  }

  step(message, source) {
    this.steps.push({ message, source });
    this.#record('step', message, source);
  }

  info(message, source, data) {
    this.infos.push({ message, source, data });
    this.#record('info', message, source, data);
  }

  success(message, source, data) {
    this.successes.push({ message, source, data });
    this.#record('success', message, source, data);
  }

  failure(message, source, data) {
    this.failures.push({ message, source, data });
    this.#record('failure', message, source, data);
  }

  withSpan(name, fn, attrs) {
    this.spans.push({ name, attrs });
    return fn();
  }

  warn(message, source, data) {
    this.#record('warn', message, source, data);
  }

  error(message, source, data) {
    this.#record('error', message, source, data);
  }
}

const defaultScopeDefinitions = {
  'world:friends': { expr: 'friends', ast: { key: 'friends' } },
  'world:empty': { expr: 'empty', ast: { key: 'empty' } },
  'world:unstable': { expr: 'unstable', ast: { key: 'unstable' } },
};

const defaultScopeResolutions = {
  friends: () => ['friend-1', 'friend-2'],
  empty: () => [],
  unstable: () => {
    throw new Error('scope resolution failure');
  },
};

const defaultEntities = [
  {
    id: 'actor-1',
    components: {
      'core:location': { value: 'lounge' },
      'status:ready': { value: true },
    },
  },
  { id: 'friend-1', components: {} },
  { id: 'friend-2', components: {} },
];

/**
 *
 * @param root0
 * @param root0.scopeDefinitions
 * @param root0.scopeResolutions
 * @param root0.entities
 */
function createStageTestBed({
  scopeDefinitions = defaultScopeDefinitions,
  scopeResolutions = defaultScopeResolutions,
  entities = defaultEntities,
} = {}) {
  const logger = new TestLogger();
  const entityManager = new SimpleEntityManager(entities);
  const fixSuggestionEngine = new StubFixSuggestionEngine();
  const errorContextBuilder = new ActionErrorContextBuilder({
    entityManager,
    logger,
    fixSuggestionEngine,
  });

  const scopeRegistry = new StaticScopeRegistry(scopeDefinitions);
  const scopeEngine = new StaticScopeEngine(scopeResolutions);
  const jsonLogicEvaluationService = new StaticJsonLogicEvaluationService();
  const dslParser = new StaticDslParser();

  const unifiedScopeResolver = new UnifiedScopeResolver({
    scopeRegistry,
    scopeEngine,
    entityManager,
    jsonLogicEvaluationService,
    dslParser,
    logger,
    actionErrorContextBuilder: errorContextBuilder,
  });

  const targetResolutionService = new TargetResolutionService({
    unifiedScopeResolver,
    logger,
  });

  const stage = new TargetResolutionStage(
    targetResolutionService,
    errorContextBuilder,
    logger
  );

  return {
    stage,
    logger,
    entityManager,
    createTrace: () => new TestTrace(),
  };
}

describe('TargetResolutionStage integration with real target resolution service', () => {
  let testBed;

  beforeEach(() => {
    testBed = createStageTestBed();
  });

  it('resolves target contexts through the real service stack', async () => {
    const trace = testBed.createTrace();
    const actor = testBed.entityManager.getEntityInstance('actor-1');

    const result = await testBed.stage.execute({
      actor,
      candidateActions: [
        { id: 'demo:wave', scope: 'world:friends' },
      ],
      actionContext: { currentLocation: 'lounge' },
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.data.actionsWithTargets).toHaveLength(1);
    const [entry] = result.data.actionsWithTargets;
    expect(entry.actionDef.id).toBe('demo:wave');
    const resolvedIds = entry.targetContexts.map((ctx) => ctx.entityId);
    expect(resolvedIds).toEqual(['friend-1', 'friend-2']);
    entry.targetContexts.forEach((ctx) => {
      expect(ctx).toBeInstanceOf(ActionTargetContext);
      expect(ctx.type).toBe('entity');
    });

    expect(trace.steps).toEqual([
      expect.objectContaining({
        message: expect.stringContaining('Resolving targets for 1 candidate actions'),
      }),
    ]);
    expect(trace.infos.some((record) =>
      record.message.includes("Scope 'world:friends' resolved to 2 target(s).")
    )).toBe(true);
    expect(trace.spans).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'target.resolve',
          attrs: expect.objectContaining({
            scopeName: 'world:friends',
            actorId: 'actor-1',
            actionId: 'demo:wave',
          }),
        }),
      ])
    );

    expect(
      testBed.logger.debugLogs.some((log) =>
        log.message.includes('TargetResolutionStage context keys:')
      )
    ).toBe(true);
    expect(
      testBed.logger.debugLogs.some((log) =>
        log.message.includes('Target resolution complete: 1 actions have valid targets')
      )
    ).toBe(true);
  });

  it("returns noTarget context when candidate scope is 'none'", async () => {
    const trace = testBed.createTrace();
    const actor = testBed.entityManager.getEntityInstance('actor-1');

    const result = await testBed.stage.execute({
      actor,
      candidateActions: [
        { id: 'core:wait', scope: 'none' },
      ],
      actionContext: { currentLocation: 'lounge' },
      trace,
    });

    expect(result.success).toBe(true);
    const [entry] = result.data.actionsWithTargets;
    expect(entry.targetContexts).toHaveLength(1);
    expect(entry.targetContexts[0].type).toBe('none');
    expect(entry.targetContexts[0].entityId).toBeNull();
    expect(trace.infos.some((record) =>
      record.message.includes("Action 'core:wait' has 'none' scope - no target resolution needed")
    )).toBe(true);
  });

  it('builds enhanced error context when scope definition is missing', async () => {
    const trace = testBed.createTrace();
    const actor = testBed.entityManager.getEntityInstance('actor-1');

    const result = await testBed.stage.execute({
      actor,
      candidateActions: [
        { id: 'demo:unknown', scope: 'world:missing' },
      ],
      actionContext: { currentLocation: 'lounge' },
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.data.actionsWithTargets).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    const [errorContext] = result.errors;
    expect(errorContext.phase).toBe('validation');
    expect(errorContext.actionId).toBe('demo:unknown');
    expect(errorContext.environmentContext.scopeName).toBe('world:missing');
    expect(
      testBed.logger.errorLogs.some((log) =>
        log.message.includes("Error resolving scope for action 'demo:unknown'")
      )
    ).toBe(true);
  });

  it('captures thrown errors from the resolver pipeline', async () => {
    const trace = testBed.createTrace();
    const actor = testBed.entityManager.getEntityInstance('actor-1');

    const result = await testBed.stage.execute({
      actor,
      candidateActions: [
        { id: 'demo:unstable', scope: 'world:unstable' },
      ],
      actionContext: { currentLocation: 'lounge' },
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.data.actionsWithTargets).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    const [errorContext] = result.errors;
    expect(errorContext.phase).toBe('scope_resolution');
    expect(errorContext.environmentContext.errorName).toBe('Error');
    expect(errorContext.environmentContext.scopeName).toBe('world:unstable');
  });

  it('skips actions when resolution returns an empty set', async () => {
    const trace = testBed.createTrace();
    const actor = testBed.entityManager.getEntityInstance('actor-1');

    const result = await testBed.stage.execute({
      actor,
      candidateActions: [
        { id: 'demo:none', scope: 'world:empty' },
      ],
      actionContext: { currentLocation: 'lounge' },
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.data.actionsWithTargets).toHaveLength(0);
    expect(
      trace.infos.some((record) =>
        record.message.includes("Scope 'world:empty' resolved to no targets.")
      )
    ).toBe(true);
  });

  it('handles invalid candidate list gracefully', async () => {
    const trace = testBed.createTrace();
    const actor = testBed.entityManager.getEntityInstance('actor-1');

    const result = await testBed.stage.execute({
      actor,
      candidateActions: null,
      actionContext: { currentLocation: 'lounge' },
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.data.actionsWithTargets).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(
      testBed.logger.warnLogs.some((log) =>
        log.message.includes('TargetResolutionStage received invalid candidateActions')
      )
    ).toBe(true);
  });

  it('continues when candidate list contains null entries', async () => {
    const trace = testBed.createTrace();
    const actor = testBed.entityManager.getEntityInstance('actor-1');

    const result = await testBed.stage.execute({
      actor,
      candidateActions: [
        null,
        { id: 'demo:wave', scope: 'world:friends' },
        undefined,
      ],
      actionContext: { currentLocation: 'lounge' },
      trace,
    });

    expect(
      testBed.logger.warnLogs.some((log) =>
        log.message === 'Skipping null action definition in candidateActions'
      )
    ).toBe(true);
    expect(result.data.actionsWithTargets).toHaveLength(1);
  });
});
