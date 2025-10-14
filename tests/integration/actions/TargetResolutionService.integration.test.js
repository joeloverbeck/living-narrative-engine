import {
  describe,
  beforeEach,
  afterEach,
  test,
  expect,
  jest,
} from '@jest/globals';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { UnifiedScopeResolver } from '../../../src/actions/scopes/unifiedScopeResolver.js';
import { ScopeCacheStrategy } from '../../../src/actions/scopes/scopeCacheStrategy.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { DefaultDslParser } from '../../../src/scopeDsl/parser/defaultDslParser.js';
import { ActionErrorContextBuilder } from '../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../src/actions/errors/fixSuggestionEngine.js';
import { ActionIndex } from '../../../src/actions/actionIndex.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { TraceContext } from '../../../src/actions/tracing/traceContext.js';
import { SimpleEntityManager } from '../../common/entities/index.js';

class SpanEnabledTrace extends TraceContext {
  withSpan(name, fn, metadata) {
    this.step(`Span start: ${name}`, 'SpanEnabledTrace', metadata);
    const result = fn();
    this.step(`Span end: ${name}`,'SpanEnabledTrace');
    return result;
  }
}

describe('TargetResolutionService integration', () => {
  let logger;
  let entityManager;
  let dataRegistry;
  let gameDataRepository;
  let actionIndex;
  let fixSuggestionEngine;
  let actionErrorContextBuilder;
  let scopeRegistry;
  let scopeEngine;
  let dslParser;
  let cacheStrategy;
  let jsonLogicEvaluationService;
  let unifiedScopeResolver;
  let targetResolutionService;
  let baseDiscoveryContext;
  let heroActor;

  const addScopeDefinition = (id, expr) => {
    const ast = dslParser.parse(expr);
    return { id, expr, ast };
  };

  const createDiscoveryContext = (overrides = {}) => ({
    currentLocation: 'tavern',
    entityManager,
    ...overrides,
  });

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = new SimpleEntityManager([
      {
        id: 'hero',
        components: {
          'core:actor': { name: 'Hero' },
          'core:position': { locationId: 'tavern' },
          'companionship:followers': { ids: ['companion'] },
        },
      },
      {
        id: 'companion',
        components: {
          'core:actor': { name: 'Companion' },
          'core:position': { locationId: 'tavern' },
        },
      },
      {
        id: 'chair1',
        components: {
          'core:position': { locationId: 'tavern' },
          'furniture:seat': { comfort: 5 },
        },
      },
      {
        id: 'chair2',
        components: {
          'core:position': { locationId: 'kitchen' },
          'furniture:seat': { comfort: 1 },
        },
      },
    ]);

    dataRegistry = new InMemoryDataRegistry({ logger });
    gameDataRepository = new GameDataRepository(dataRegistry, logger);

    actionIndex = new ActionIndex({ logger, entityManager });
    actionIndex.buildIndex([]);

    fixSuggestionEngine = new FixSuggestionEngine({
      logger,
      gameDataRepository,
      actionIndex,
    });

    actionErrorContextBuilder = new ActionErrorContextBuilder({
      entityManager,
      logger,
      fixSuggestionEngine,
    });

    scopeRegistry = new ScopeRegistry();
    scopeEngine = new ScopeEngine({ scopeRegistry });
    dslParser = new DefaultDslParser();
    cacheStrategy = new ScopeCacheStrategy({ logger, defaultTTL: 10_000 });

    jsonLogicEvaluationService = new JsonLogicEvaluationService({
      logger,
      gameDataRepository,
    });

    unifiedScopeResolver = new UnifiedScopeResolver({
      scopeRegistry,
      scopeEngine,
      entityManager,
      jsonLogicEvaluationService,
      dslParser,
      logger,
      actionErrorContextBuilder,
      cacheStrategy,
    });

    targetResolutionService = new TargetResolutionService({
      unifiedScopeResolver,
      logger,
    });

    const scopeDefinitions = {
      'positioning:available_furniture': addScopeDefinition(
        'positioning:available_furniture',
        'entities(furniture:seat)[{"==":[{"var":"entity.components.core:position.locationId"},{"var":"location"}]}]'
      ),
      'social:same_room_actors': addScopeDefinition(
        'social:same_room_actors',
        'entities(core:actor)[{"and":[{"!=":[{"var":"entity.id"},{"var":"actor.id"}]},{"==":[{"var":"entity.components.core:position.locationId"},{"var":"location"}]}]}]'
      ),
    };

    scopeRegistry.initialize(scopeDefinitions);

    baseDiscoveryContext = createDiscoveryContext();
    heroActor = entityManager.getEntityInstance('hero');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('resolves the self scope through trace spans', () => {
    const trace = new SpanEnabledTrace();
    const result = targetResolutionService.resolveTargets(
      'self',
      heroActor,
      baseDiscoveryContext,
      trace,
      'core:wait'
    );

    expect(result.success).toBe(true);
    expect(Array.isArray(result.value)).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toBeInstanceOf(ActionTargetContext);
    expect(result.value[0].type).toBe('entity');
    expect(result.value[0].entityId).toBe('hero');
    expect(trace.logs.some((entry) => entry.message.includes('Span start: target.resolve'))).toBe(true);
    expect(trace.logs.some((entry) => entry.message.includes('Span end: target.resolve'))).toBe(true);
  });

  test('returns a no-target context for the none scope', () => {
    const result = targetResolutionService.resolveTargets(
      'none',
      heroActor,
      baseDiscoveryContext,
      null,
      'core:none'
    );

    expect(result.success).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value[0]).toBeInstanceOf(ActionTargetContext);
    expect(result.value[0].type).toBe('none');
    expect(result.value[0].entityId).toBeNull();
  });

  test('resolves DSL scopes and caches the result for repeated lookups', () => {
    const trace = new TraceContext();
    const resolveSpy = jest.spyOn(scopeEngine, 'resolve');

    const firstResult = targetResolutionService.resolveTargets(
      'positioning:available_furniture',
      heroActor,
      baseDiscoveryContext,
      trace,
      'positioning:sit_down'
    );

    expect(firstResult.success).toBe(true);
    expect(firstResult.value.map((ctx) => ctx.entityId)).toEqual(['chair1']);
    expect(resolveSpy).toHaveBeenCalledTimes(1);

    const secondResult = targetResolutionService.resolveTargets(
      'positioning:available_furniture',
      heroActor,
      baseDiscoveryContext,
      new TraceContext(),
      'positioning:sit_down'
    );

    expect(secondResult.success).toBe(true);
    expect(secondResult.value.map((ctx) => ctx.entityId)).toEqual(['chair1']);
    expect(resolveSpy).toHaveBeenCalledTimes(1);
  });

  test('resolves other actors in the same room', () => {
    const result = targetResolutionService.resolveTargets(
      'social:same_room_actors',
      heroActor,
      baseDiscoveryContext,
      null,
      'social:check_room'
    );

    expect(result.success).toBe(true);
    expect(result.value.map((ctx) => ctx.entityId)).toEqual(['companion']);
  });

  test('returns an empty array when DSL scope resolves to no entities', () => {
    const context = createDiscoveryContext({ currentLocation: 'balcony' });
    const result = targetResolutionService.resolveTargets(
      'social:same_room_actors',
      heroActor,
      context,
      null,
      'social:check_room'
    );

    expect(result.success).toBe(true);
    expect(result.value).toEqual([]);
  });

  test('propagates resolver failures when discovery context is incomplete', () => {
    const invalidContext = createDiscoveryContext({ currentLocation: null });
    const result = targetResolutionService.resolveTargets(
      'social:same_room_actors',
      heroActor,
      invalidContext,
      null,
      'social:check_room'
    );

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].name).toBe('InvalidContextError');
  });
});
