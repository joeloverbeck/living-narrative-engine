import { jest } from '@jest/globals';
import { IntegrationTestBed } from '../../common/integrationTestBed.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { ActionCandidateProcessor } from '../../../src/actions/actionCandidateProcessor.js';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { MultiTargetActionFormatter } from '../../../src/actions/formatters/MultiTargetActionFormatter.js';
import { ActionTestUtilities } from '../../common/actions/actionTestUtilities.js';
import { createEntityDefinition } from '../../common/entities/entityFactories.js';
import { setComponent } from '../../../src/entities/entityAccessService.js';
import { getEntityDisplayName } from '../../../src/utils/entityUtils.js';
import { POSITION_COMPONENT_ID } from '../../../src/constants/componentIds.js';

/**
 * Integration tests for ActionCandidateProcessor covering real pipeline interactions.
 */
describe('ActionCandidateProcessor - integration coverage', () => {
  /** @type {IntegrationTestBed} */
  let testBed;
  let entityManager;
  let registry;
  let scopeRegistry;
  let dslParser;
  let logger;
  let traceFactory;
  let realPrerequisiteService;
  let realTargetResolutionService;
  let realSafeEventDispatcher;
  let realActionErrorContextBuilder;
  let baseFormatter;
  let multiFormatter;
  let playerActor;
  let lockedActor;
  let followerActor;
  let originalPositions;

  const ACTION_SCOPE_UNKNOWN = 'integration:unknown_scope';

  beforeAll(async () => {
    testBed = new IntegrationTestBed();
    await testBed.initialize();

    registry = testBed.get(tokens.IDataRegistry);
    entityManager = testBed.get(tokens.IEntityManager);
    scopeRegistry = testBed.get(tokens.IScopeRegistry);
    dslParser = testBed.get(tokens.DslParser);
    logger = testBed.mockLogger;

    realPrerequisiteService = testBed.get(tokens.PrerequisiteEvaluationService);
    realTargetResolutionService = testBed.get(tokens.ITargetResolutionService);
    realSafeEventDispatcher = testBed.get(tokens.ISafeEventDispatcher);
    realActionErrorContextBuilder = testBed.get(tokens.IActionErrorContextBuilder);
    traceFactory = testBed.get(tokens.TraceContextFactory);

    baseFormatter = new ActionCommandFormatter();
    multiFormatter = new MultiTargetActionFormatter(baseFormatter, logger);

    ActionTestUtilities.setupTestConditions(registry);
    ActionTestUtilities.setupScopeDefinitions(
      {
        scopeRegistry,
        dslParser,
        logger,
      },
      [
        {
          id: 'core:nearby_actors',
          expr: 'entities(core:actor)[{"==": [{"var": "components.core:position.locationId"}, {"var": "actor.components.core:position.locationId"}]}][{"!=": [{"var": "id"}, {"var": "actor.id"}]}]',
          description: 'Other actors in the same location (quoted keys for parser compatibility)',
        },
      ]
    );

    await ActionTestUtilities.createStandardTestWorld({
      entityManager,
      registry,
    });

    const actors = await ActionTestUtilities.createTestActors({
      entityManager,
      registry,
    });

    await ActionTestUtilities.setupActionIndex(
      { registry, actionIndex: testBed.get(tokens.ActionIndex) },
      []
    );

    playerActor = entityManager.getEntityInstance(actors.player.id);
    lockedActor = entityManager.getEntityInstance(actors.lockedActor.id);
    followerActor = entityManager.getEntityInstance(actors.follower.id);

    originalPositions = new Map([
      [playerActor.id, getActorLocationId(playerActor.id)],
      [lockedActor.id, getActorLocationId(lockedActor.id)],
      [followerActor.id, getActorLocationId(followerActor.id)],
    ]);
  });

  afterAll(async () => {
    if (testBed) {
      await testBed.cleanup();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
    restoreActorPositions();
  });

  /**
   *
   */
  function restoreActorPositions() {
    if (!originalPositions) {
      return;
    }
    for (const [actorId, locationId] of originalPositions.entries()) {
      if (locationId) {
        setComponent(
          actorId,
          POSITION_COMPONENT_ID,
          { locationId },
          { entityManager }
        );
      }
    }
  }

  /**
   *
   * @param actorId
   */
  function getActorLocationId(actorId) {
    const position = entityManager.getComponentData(
      actorId,
      POSITION_COMPONENT_ID
    );
    return position?.locationId ?? null;
  }

  /**
   *
   * @param actor
   * @param overrides
   */
  function createDiscoveryContext(actor, overrides = {}) {
    const baseLocation = getActorLocationId(actor.id);
    return {
      getActor: overrides.getActor ?? (() => actor),
      currentLocation: overrides.currentLocation ?? baseLocation,
      entityManager,
      registry,
      ...overrides,
    };
  }

  /**
   *
   * @param overrides
   */
  function createProcessor(overrides = {}) {
    const wrappedPrereqService = {
      evaluate: (...args) => {
        const [, actionDefinition] = args;
        if (actionDefinition?.id === 'integration:prereq-error') {
          throw new Error('Prerequisite evaluation exploded');
        }
        return realPrerequisiteService.evaluate.call(
          realPrerequisiteService,
          ...args
        );
      },
    };

    const wrappedFormatter = {
      format: (...args) => {
        const [actionDefinition] = args;
        if (actionDefinition?.id === 'integration:format-throw') {
          throw new Error('Formatter exploded');
        }
        return multiFormatter.format(...args);
      },
    };

    return new ActionCandidateProcessor({
      prerequisiteEvaluationService:
        overrides.prerequisiteEvaluationService ?? wrappedPrereqService,
      targetResolutionService:
        overrides.targetResolutionService ?? realTargetResolutionService,
      entityManager,
      actionCommandFormatter:
        overrides.actionCommandFormatter ?? wrappedFormatter,
      safeEventDispatcher:
        overrides.safeEventDispatcher ?? realSafeEventDispatcher,
      getEntityDisplayNameFn:
        overrides.getEntityDisplayNameFn ?? getEntityDisplayName,
      logger,
      actionErrorContextBuilder:
        overrides.actionErrorContextBuilder ?? realActionErrorContextBuilder,
    });
  }

  /**
   *
   * @param actionId
   * @param overrides
   */
  function cloneActionDefinition(actionId, overrides = {}) {
    const definition = registry.get('actions', actionId);
    if (!definition) {
      throw new Error(`Missing action definition for id ${actionId}`);
    }
    const cloned = structuredClone(definition);
    cloned.prerequisites = expandPrerequisites(cloned.prerequisites);
    return { ...cloned, ...overrides };
  }

  /**
   *
   * @param prereqs
   */
  function expandPrerequisites(prereqs = []) {
    return prereqs.map((entry) => {
      if (typeof entry === 'string') {
        const condition = registry.get('conditions', entry);
        if (!condition) {
          throw new Error(`Missing condition definition for id ${entry}`);
        }
        const normalizedLogic = normalizePrerequisiteLogic(
          structuredClone(condition.logic)
        );
        return {
          id: entry,
          logic: normalizedLogic,
          failure_message: condition.description || `${entry} failed`,
        };
      }
      if (entry && typeof entry === 'object' && entry.logic) {
        return {
          ...entry,
          logic: normalizePrerequisiteLogic(structuredClone(entry.logic)),
        };
      }
      return entry;
    });
  }

  /**
   *
   * @param logicNode
   */
  function normalizePrerequisiteLogic(logicNode) {
    if (Array.isArray(logicNode)) {
      return logicNode.map((node) => normalizePrerequisiteLogic(node));
    }
    if (logicNode && typeof logicNode === 'object') {
      if (
        typeof logicNode.var === 'string' &&
        logicNode.var.startsWith('actor.') &&
        !logicNode.var.startsWith('actor.components')
      ) {
        logicNode.var = logicNode.var.replace(
          /^actor\./,
          'actor.components.'
        );
      }
      for (const key of Object.keys(logicNode)) {
        logicNode[key] = normalizePrerequisiteLogic(logicNode[key]);
      }
    }
    return logicNode;
  }

  /**
   *
   * @param actor
   */
  async function ensureIsolatedLocation(actor) {
    const isolatedLocationId = 'integration:isolated_room';
    if (!registry.get('entityDefinitions', isolatedLocationId)) {
      const definition = createEntityDefinition(isolatedLocationId, {
        'core:name': { name: 'Isolated Room' },
        'core:description': { description: 'A quiet, empty chamber.' },
        'core:position': { x: 99, y: 0, z: 0 },
        'movement:exits': {},
      });
      registry.store('entityDefinitions', isolatedLocationId, definition);
      await entityManager.createEntityInstance(isolatedLocationId, {
        instanceId: isolatedLocationId,
        definitionId: isolatedLocationId,
      });
    }

    setComponent(
      actor.id,
      POSITION_COMPONENT_ID,
      { locationId: isolatedLocationId },
      { entityManager }
    );
    const updatedInstance = entityManager.getEntityInstance(actor.id);
    if (actor.id === followerActor?.id) {
      followerActor = updatedInstance;
    }
    return isolatedLocationId;
  }

  it('processes a valid candidate with structured trace and formats commands', () => {
    const processor = createProcessor();
    const actionDef = cloneActionDefinition('core:wait');
    const trace = traceFactory();

    const context = createDiscoveryContext(playerActor);
    const result = processor.process(actionDef, playerActor, context, trace);

    expect(result.success).toBe(true);
    expect(result.value.actions.length).toBeGreaterThan(0);
    expect(result.value.errors).toEqual([]);
    expect(result.value.actions[0].id).toBe('core:wait');

    const hierarchy = trace.getHierarchicalView();
    expect(hierarchy).not.toBeNull();
    expect(hierarchy.operation).toBe('candidate.process');
  });

  it('returns prerequisites-failed when actor cannot satisfy requirements', () => {
    const processor = createProcessor();
    const actionDef = cloneActionDefinition('movement:go');
    const context = createDiscoveryContext(lockedActor);

    const result = processor.process(actionDef, lockedActor, context, null);

    expect(result.success).toBe(true);
    expect(result.value.actions).toEqual([]);
    expect(result.value.cause).toBe('prerequisites-failed');
    expect(logger.debug).toHaveBeenCalled();
  });

  it('wraps prerequisite evaluation errors in enhanced contexts', () => {
    const processor = createProcessor();
    const actionDef = cloneActionDefinition('movement:go', {
      id: 'integration:prereq-error',
    });
    const context = createDiscoveryContext(playerActor);

    const result = processor.process(actionDef, playerActor, context, null);

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('prerequisite-error');
    expect(result.value.errors).toHaveLength(1);
    expect(result.value.errors[0]).toMatchObject({
      actionId: 'integration:prereq-error',
      phase: expect.any(String),
      timestamp: expect.any(Number),
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Error checking prerequisites for action 'integration:prereq-error'."
      ),
      expect.any(Object)
    );
  });

  it('returns no-targets when scope resolves to an empty set', async () => {
    const processor = createProcessor();
    const actionDef = cloneActionDefinition('core:attack', {
      id: 'integration:no-targets',
    });

    const isolatedLocationId = await ensureIsolatedLocation(followerActor);
    const context = createDiscoveryContext(followerActor, {
      currentLocation: isolatedLocationId,
    });

    const result = processor.process(actionDef, followerActor, context, null);

    expect(result.success).toBe(true);
    expect(result.value.actions).toEqual([]);
    expect(result.value.cause).toBe('no-targets');
    expect(logger.debug).toHaveBeenCalledWith(
      "Action 'integration:no-targets' resolved to 0 targets. Skipping."
    );
  });

  it('converts target resolution failures into structured errors', () => {
    const processor = createProcessor();
    const actionDef = cloneActionDefinition('core:attack', {
      id: 'integration:bad-scope',
      scope: ACTION_SCOPE_UNKNOWN,
    });
    const context = createDiscoveryContext(playerActor);

    const result = processor.process(actionDef, playerActor, context, null);

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('resolution-error');
    expect(result.value.errors).toHaveLength(1);
    expect(result.value.errors[0]).toMatchObject({
      actionId: 'integration:bad-scope',
      phase: expect.any(String),
      error: expect.objectContaining({ name: 'ScopeNotFoundError' }),
    });
  });

  it('records formatter failures when action definitions are malformed', () => {
    const processor = createProcessor();
    const actionDef = cloneActionDefinition('core:attack', {
      id: 'integration:bad-template',
      template: '',
    });
    const context = createDiscoveryContext(playerActor);

    const result = processor.process(actionDef, playerActor, context, null);

    expect(result.success).toBe(true);
    expect(result.value.actions).toEqual([]);
    expect(result.value.errors).toHaveLength(2);
    const errorTargets = result.value.errors.map((error) => error.targetId);
    expect(errorTargets).toEqual(
      expect.arrayContaining(['test-npc', 'test-follower'])
    );
    expect(result.value.errors.every((e) => e.actionId === 'integration:bad-template')).toBe(
      true
    );
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "Failed to format command for action 'integration:bad-template'"
      ),
      expect.any(Object)
    );
  });

  it('captures formatter exceptions and emits error contexts', () => {
    const processor = createProcessor();
    const actionDef = cloneActionDefinition('core:attack', {
      id: 'integration:format-throw',
    });
    const context = createDiscoveryContext(playerActor);

    const result = processor.process(actionDef, playerActor, context, null);

    expect(result.success).toBe(true);
    expect(result.value.errors).toHaveLength(2);
    result.value.errors.forEach((errorContext) => {
      expect(errorContext.actionId).toBe('integration:format-throw');
      expect(errorContext.phase).toBeDefined();
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining(
        "Error formatting action 'integration:format-throw'"
      ),
      expect.any(Object)
    );
  });
});
