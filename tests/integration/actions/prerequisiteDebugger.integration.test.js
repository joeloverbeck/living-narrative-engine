import { describe, it, expect, jest } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
import { ActionValidationContextBuilder } from '../../../src/actions/validation/actionValidationContextBuilder.js';
import {
  DebugLevel,
  PrerequisiteDebugger,
} from '../../../src/actions/validation/prerequisiteDebugger.js';
import { PrerequisiteEvaluationError } from '../../../src/actions/validation/errors/prerequisiteEvaluationError.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { createEntityContext } from '../../../src/logic/contextAssembler.js';
import { createEntityManagerAdapter } from '../../common/entities/entityManagerTestFactory.js';

const ACTOR_ID = 'entity:actor-debug';
const TARGET_ID = 'entity:target-debug';
const ACTION_ID = 'action:prereq-debug';

/**
 *
 */
function createTestLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

/**
 *
 * @param components
 */
function createActor(components = {}) {
  return {
    id: ACTOR_ID,
    components: {
      'core:position': { locationId: 'location:alpha' },
      ...components,
    },
  };
}

/**
 *
 * @param components
 */
function createTarget(components = {}) {
  return {
    id: TARGET_ID,
    components: {
      'core:position': { locationId: 'location:beta' },
      ...components,
    },
  };
}

/**
 *
 * @param partId
 * @param subType
 */
function createPart(partId, subType) {
  return {
    id: partId,
    components: {
      'anatomy:part': { subType },
    },
  };
}

/**
 *
 * @param initialEntities
 * @param logic
 */
function buildDebuggerScenario(initialEntities, logic) {
  const logger = createTestLogger();
  const entityManager = createEntityManagerAdapter({ logger, initialEntities });
  const contextBuilder = new ActionValidationContextBuilder({
    entityManager,
    logger,
  });

  const context = contextBuilder.buildContext({ id: ACTION_ID }, { id: ACTOR_ID });
  context.target = createEntityContext(TARGET_ID, entityManager, logger);
  context.targets = {
    primary: createEntityContext(TARGET_ID, entityManager, logger),
  };

  const debuggerInstance = new PrerequisiteDebugger({
    logger,
    debugLevel: DebugLevel.ERROR,
    entityManager,
  });

  const evaluator = () => {
    throw new Error('forced failure for debugger enrichment');
  };

  const result = debuggerInstance.evaluate({
    actionId: ACTION_ID,
    prerequisiteIndex: 0,
    prerequisiteLogic: logic,
    evaluator,
    context,
  });

  expect(result.success).toBe(false);
  expect(result.error).toBeInstanceOf(PrerequisiteEvaluationError);

  return { result, logger };
}

describe('PrerequisiteDebugger integration coverage', () => {
  it('logs sanitized context when the evaluation service runs in debug mode', () => {
    const logger = createTestLogger();
    const registry = new InMemoryDataRegistry({ logger });
    const gameDataRepository = new GameDataRepository(registry, logger);

    const entityManager = createEntityManagerAdapter({
      logger,
      initialEntities: [
        createActor({
          'anatomy:body': {
            body: {
              parts: {},
            },
          },
        }),
        createTarget(),
      ],
    });

    const contextBuilder = new ActionValidationContextBuilder({
      entityManager,
      logger,
    });

    const jsonLogicService = new JsonLogicEvaluationService({ logger });

    const service = new PrerequisiteEvaluationService({
      logger,
      jsonLogicEvaluationService: jsonLogicService,
      actionValidationContextBuilder: contextBuilder,
      gameDataRepository,
      entityManager,
      debugMode: true,
    });

    const result = service.evaluate(
      [{ logic: { '==': [1, 1] } }],
      { id: ACTION_ID },
      { id: ACTOR_ID },
      null,
      {
        contextOverride: {
          target: { id: TARGET_ID },
          targets: { primary: { id: TARGET_ID } },
        },
      },
    );

    expect(result).toBe(true);

    const debugLogEntry = logger.debug.mock.calls.find(
      ([message]) => message === 'Prerequisite evaluated',
    );

    expect(debugLogEntry).toBeDefined();
    expect(debugLogEntry[1].context).toEqual({
      actor: ACTOR_ID,
      target: TARGET_ID,
      targets: ['primary'],
    });
  });

  it('enriches entity state when anatomy parts are missing', () => {
    const entities = [
      createActor({
        'anatomy:body': {
          body: {
            parts: {},
          },
        },
      }),
      createTarget(),
    ];

    const { result } = buildDebuggerScenario(entities, {
      hasPartOfType: ['actor', 'wing'],
    });

    expect(result.error.entityState).toEqual({
      actorId: ACTOR_ID,
      actorLocation: 'location:alpha',
      targetId: TARGET_ID,
      targetLocation: 'location:beta',
      bodyParts: [],
    });
    expect(result.error.hint).toBe(
      'Actor does not have any body parts of type "wing". Check anatomy:body component.',
    );
  });

  it('captures real anatomy data when body parts exist', () => {
    const armPartId = 'entity:part-arm';
    const entities = [
      createActor({
        'anatomy:body': {
          body: {
            parts: {
              leftArm: armPartId,
            },
          },
        },
      }),
      createTarget(),
      createPart(armPartId, 'arm'),
    ];

    const { result } = buildDebuggerScenario(entities, {
      hasPartOfType: ['actor', 'arm'],
    });

    expect(result.error.entityState.bodyParts).toEqual(['arm']);
    expect(result.error.hint).toBe('Review prerequisite logic and entity state above.');
  });

  it('reports when the actor is alone at a location', () => {
    const entities = [createActor(), createTarget()];

    const { result } = buildDebuggerScenario(entities, {
      hasOtherActorsAtLocation: ['actor'],
    });

    expect(result.error.entityState.entitiesAtLocation).toBe(1);
    expect(result.error.hint).toBe(
      'Only the actor is at this location. Add other actors to the scene.',
    );
  });

  it('describes missing clothing slots for hasClothingInSlot prerequisites', () => {
    const entities = [createActor(), createTarget()];

    const { result } = buildDebuggerScenario(entities, {
      hasClothingInSlot: ['actor', 'head'],
    });

    expect(result.error.entityState.wornItems).toEqual([]);
    expect(result.error.hint).toBe(
      'No clothing in slot "head". Add worn_items component with slot.',
    );
  });

  it('informs when a component_present prerequisite is missing data', () => {
    const entities = [createActor(), createTarget()];

    const { result } = buildDebuggerScenario(entities, {
      component_present: ['actor', 'custom:memory'],
    });

    expect(result.error.entityState.hasComponent).toBe(false);
    expect(result.error.hint).toBe(
      'Entity missing component "custom:memory". Add component to entity.',
    );
  });
});
