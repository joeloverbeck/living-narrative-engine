// tests/integration/actions/prerequisiteEvaluationService.auditPaths.integration.test.js

import { describe, it, expect, jest, afterEach } from '@jest/globals';
import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
import { ActionValidationContextBuilder } from '../../../src/actions/validation/actionValidationContextBuilder.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { GameDataRepository } from '../../../src/data/gameDataRepository.js';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import { createTestEntityManager } from '../../common/entities/entityManagerTestFactory.js';

/**
 * Creates a lightweight test logger backed by Jest spies so we can assert on
 * integration-time logging behaviour without replacing the logger interface.
 *
 * @returns {{debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock}}
 */
function createTestLogger() {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
}

const DEFAULT_ACTOR_ID = 'entity:test-actor';
const DEFAULT_ACTION_ID = 'action:test-move';

/**
 * Sets up a fully wired PrerequisiteEvaluationService with production
 * collaborators. Tests may provide a custom context builder class or initial
 * condition definitions to exercise special branches.
 *
 * @param {object} [options]
 * @param {typeof ActionValidationContextBuilder} [options.builderClass]
 * @param {Array<object>} [options.conditions]
 * @returns {{
 *   service: PrerequisiteEvaluationService,
 *   logger: ReturnType<typeof createTestLogger>,
 *   actionDefinition: {id: string},
 *   actor: {id: string},
 * }}
 */
function createService(options = {}) {
  const { builderClass = ActionValidationContextBuilder, conditions = [] } =
    options;
  const logger = createTestLogger();
  const registry = new InMemoryDataRegistry({ logger });
  const gameDataRepository = new GameDataRepository(registry, logger);

  for (const condition of conditions) {
    registry.store('conditions', condition.id, condition);
  }

  const entityManager = createTestEntityManager({
    logger,
    initialEntities: [
      {
        id: DEFAULT_ACTOR_ID,
        components: {
          'core:movement': { locked: false },
          'core:health': { current: 80, max: 100 },
        },
      },
    ],
  });

  const contextBuilder = new builderClass({
    entityManager,
    logger,
  });

  const jsonLogicService = new JsonLogicEvaluationService({ logger });

  const service = new PrerequisiteEvaluationService({
    logger,
    jsonLogicEvaluationService: jsonLogicService,
    actionValidationContextBuilder: contextBuilder,
    gameDataRepository,
  });

  return {
    service,
    logger,
    actionDefinition: { id: DEFAULT_ACTION_ID },
    actor: { id: DEFAULT_ACTOR_ID },
  };
}

class NullContextBuilder extends ActionValidationContextBuilder {
  buildContext(actionDefinition, actor) {
    super.buildContext(actionDefinition, actor);
    return null;
  }
}

class MissingActorContextBuilder extends ActionValidationContextBuilder {
  buildContext(actionDefinition, actor) {
    super.buildContext(actionDefinition, actor);
    return { actor: null };
  }
}

class NullComponentsContextBuilder extends ActionValidationContextBuilder {
  buildContext(actionDefinition, actor) {
    const context = super.buildContext(actionDefinition, actor);
    return {
      actor: {
        id: context.actor.id,
        components: null,
      },
    };
  }
}

class FailingSerializationContextBuilder extends ActionValidationContextBuilder {
  buildContext(actionDefinition, actor) {
    super.buildContext(actionDefinition, actor);
    return {
      actor: {
        id: actor.id,
        components: {
          toJSON: () => {
            throw new Error('intentional serialization failure');
          },
        },
      },
    };
  }
}

class BigIntSerializationContextBuilder extends ActionValidationContextBuilder {
  buildContext(actionDefinition, actor) {
    super.buildContext(actionDefinition, actor);
    return {
      actor: {
        id: actor.id,
        components: {
          toJSON: () => ({ 'core:debug': { flag: BigInt(1) } }),
        },
      },
    };
  }
}

describe('PrerequisiteEvaluationService integration – audit coverage', () => {
  const constantTruePrereq = [{ logic: { '==': [1, 1] } }];

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns false when the context builder yields a non-object (skips audit early)', () => {
    const { service, actionDefinition, actor } = createService({
      builderClass: NullContextBuilder,
    });

    const result = service.evaluate(
      constantTruePrereq,
      actionDefinition,
      actor
    );

    expect(result).toBe(false);
  });

  it('continues evaluation when the actor context is missing entirely', () => {
    const { service, logger, actionDefinition, actor } = createService({
      builderClass: MissingActorContextBuilder,
    });

    const result = service.evaluate(
      constantTruePrereq,
      actionDefinition,
      actor
    );

    expect(result).toBe(true);
    expect(
      logger.debug.mock.calls.some((call) =>
        String(call[0]).includes('Actor context resolved')
      )
    ).toBe(false);
  });

  it('warns when actor components are missing or not objects', () => {
    const { service, logger, actionDefinition, actor } = createService({
      builderClass: NullComponentsContextBuilder,
    });

    const result = service.evaluate(
      constantTruePrereq,
      actionDefinition,
      actor
    );

    expect(result).toBe(true);
    expect(
      logger.warn.mock.calls.some((call) =>
        String(call[0]).includes('appears to have NO components')
      )
    ).toBe(true);
  });

  it('logs and continues when component snapshot serialization throws a generic error', () => {
    const { service, logger, actionDefinition, actor } = createService({
      builderClass: FailingSerializationContextBuilder,
    });

    const result = service.evaluate(
      constantTruePrereq,
      actionDefinition,
      actor
    );

    expect(result).toBe(true);
    expect(
      logger.warn.mock.calls.some((call) =>
        String(call[0]).includes('components could not be inspected')
      )
    ).toBe(true);
  });

  it('treats TypeError during JSON serialization as a context-building failure', () => {
    const { service, logger, actionDefinition, actor } = createService({
      builderClass: BigIntSerializationContextBuilder,
    });

    const result = service.evaluate(
      constantTruePrereq,
      actionDefinition,
      actor
    );

    expect(result).toBe(false);
    expect(
      logger.debug.mock.calls.some((call) =>
        String(call[0]).includes(
          'Could not serialize components for validation logging'
        )
      )
    ).toBe(true);
    expect(
      logger.error.mock.calls.some(
        (call) =>
          String(call[0]).includes('Failed to build evaluation context') &&
          String(call[0]).includes('Do not know how to serialize a BigInt')
      )
    ).toBe(true);
  });

  it('merges context overrides and evaluates prerequisites against the merged view', () => {
    const { service, logger, actionDefinition, actor } = createService({
      conditions: [
        {
          id: 'tests:actor-stance',
          logic: { '==': [{ var: 'actor.stance' }, 'crouched'] },
        },
        {
          id: 'tests:environment',
          logic: { '==': [{ var: 'context.environment' }, 'rainy'] },
        },
      ],
    });

    const prerequisites = [
      { logic: { condition_ref: 'tests:actor-stance' } },
      { logic: { condition_ref: 'tests:environment' } },
      { logic: { '==': [{ var: 'extra' }, 42] } },
    ];

    const result = service.evaluate(
      prerequisites,
      actionDefinition,
      actor,
      null,
      {
        contextOverride: {
          actor: { stance: 'crouched' },
          context: { environment: 'rainy' },
          extra: 42,
          unused: undefined,
        },
      }
    );

    expect(result).toBe(true);
    expect(
      logger.debug.mock.calls.some(
        (call) =>
          String(call[0]).includes(
            'Applied context override for prerequisite evaluation.'
          ) && call[1]?.overrideKeys?.includes('unused')
      )
    ).toBe(true);
  });
});
