import { describe, it, expect, beforeEach } from '@jest/globals';
import { PrerequisiteEvaluationStage } from '../../../../../src/actions/pipeline/stages/PrerequisiteEvaluationStage.js';
import { PrerequisiteEvaluationService } from '../../../../../src/actions/validation/prerequisiteEvaluationService.js';
import { ActionValidationContextBuilder } from '../../../../../src/actions/validation/actionValidationContextBuilder.js';
import { ActionErrorContextBuilder } from '../../../../../src/actions/errors/actionErrorContextBuilder.js';
import JsonLogicEvaluationService from '../../../../../src/logic/jsonLogicEvaluationService.js';
import ActionAwareStructuredTrace from '../../../../../src/actions/tracing/actionAwareStructuredTrace.js';
import ActionTraceFilter from '../../../../../src/actions/tracing/actionTraceFilter.js';
import ConsoleLogger, { LogLevel } from '../../../../../src/logging/consoleLogger.js';

class FakeEntityManager {
  constructor() {
    this.entities = new Map();
  }

  registerEntity({ id, type = 'test:actor', components = {} }) {
    const entity = {
      id,
      type,
      components: { ...components },
    };
    this.entities.set(id, entity);
    return entity;
  }

  getEntityInstance(entityId) {
    const entity = this.entities.get(entityId);
    if (!entity) {
      throw new Error(`Unknown entity ${entityId}`);
    }
    return entity;
  }

  getAllComponentTypesForEntity(entityId) {
    const entity = this.getEntityInstance(entityId);
    return Object.keys(entity.components);
  }

  getComponentData(entityId, componentType) {
    const entity = this.getEntityInstance(entityId);
    if (!(componentType in entity.components)) {
      throw new Error(`Component ${componentType} not found on ${entityId}`);
    }
    return entity.components[componentType];
  }

  hasComponent(entityId, componentType) {
    const entity = this.getEntityInstance(entityId);
    return Object.prototype.hasOwnProperty.call(entity.components, componentType);
  }
}

class FakeGameDataRepository {
  constructor() {
    this.conditions = new Map();
  }

  registerCondition(id, logic) {
    this.conditions.set(id, { id, logic });
  }

  getConditionDefinition(id) {
    return this.conditions.get(id) || null;
  }
}

class StubFixSuggestionEngine {
  suggestFixes() {
    return [];
  }
}

class StageIntegrationHarness {
  constructor() {
    this.logger = new ConsoleLogger(LogLevel.ERROR);
    this.entityManager = new FakeEntityManager();
    this.gameDataRepository = new FakeGameDataRepository();
    this.fixSuggestionEngine = new StubFixSuggestionEngine();
    this.forcedErrors = new Map();

    this.errorContextBuilder = new ActionErrorContextBuilder({
      entityManager: this.entityManager,
      logger: this.logger,
      fixSuggestionEngine: this.fixSuggestionEngine,
    });

    this.actionValidationContextBuilder = new ActionValidationContextBuilder({
      entityManager: this.entityManager,
      logger: this.logger,
    });

    this.jsonLogicEvaluationService = new JsonLogicEvaluationService({
      logger: this.logger,
      gameDataRepository: this.gameDataRepository,
    });

    this.prerequisiteService = new PrerequisiteEvaluationService({
      logger: this.logger,
      jsonLogicEvaluationService: this.jsonLogicEvaluationService,
      actionValidationContextBuilder: this.actionValidationContextBuilder,
      gameDataRepository: this.gameDataRepository,
    });

    this.stage = new PrerequisiteEvaluationStage(
      this.prerequisiteService,
      this.errorContextBuilder,
      this.logger
    );

    this.#installTraceIntrospection();
  }

  #installTraceIntrospection() {
    const originalEvaluate = this.prerequisiteService.evaluate.bind(
      this.prerequisiteService
    );

    this.prerequisiteService.evaluate = (
      prerequisites,
      actionDefinition,
      actor,
      trace
    ) => {
      const result = originalEvaluate(
        prerequisites,
        actionDefinition,
        actor,
        trace
      );

      if (trace) {
        const context = {
          actorId: actor?.id,
          actionId: actionDefinition?.id,
          longDescription: 'x'.repeat(520),
        };
        context.self = context;

        trace.captureEvaluationContext?.(context);
        trace.captureJsonLogicTrace?.(
          { var: 'actor.components.core:stats.mana' },
          context,
          result,
          [
            {
              step: 'mock-evaluation',
              result,
            },
          ]
        );
      }

      const forcedError = this.forcedErrors.get(actionDefinition?.id);
      if (forcedError) {
        throw forcedError;
      }

      return result;
    };
  }

  registerActor(actorId, components) {
    this.currentActorId = actorId;
    return this.entityManager.registerEntity({
      id: actorId,
      components,
    });
  }

  registerCondition(id, logic) {
    this.gameDataRepository.registerCondition(id, logic);
  }

  createTrace(tracedActions) {
    const actionTraceFilter = new ActionTraceFilter({
      tracedActions,
      verbosityLevel: 'verbose',
      inclusionConfig: {
        componentData: true,
        prerequisites: true,
        targets: true,
      },
      logger: this.logger,
    });

    return new ActionAwareStructuredTrace({
      actionTraceFilter,
      actorId: this.currentActorId ?? 'unknown-actor',
      context: { sessionId: 'integration-test' },
      logger: this.logger,
    });
  }

  forceEvaluationFailureFor(actionId, errorMessage) {
    this.forcedErrors.set(actionId, new Error(errorMessage));
  }
}

describe('PrerequisiteEvaluationStage integration', () => {
  let harness;
  let actor;

  beforeEach(() => {
    harness = new StageIntegrationHarness();
    actor = harness.registerActor('actor-1', {
      'core:actor': { name: 'Integration Hero' },
      'core:stats': { mana: 50, level: 7 },
    });
  });

  it('evaluates prerequisites and captures detailed tracing data', async () => {
    harness.registerCondition('conditions:high_level', {
      '>=': [{ var: 'actor.components.core:stats.level' }, 5],
    });

    const candidateActions = [
      {
        id: 'core:cast_spell',
        name: 'Cast Spell',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'actor.components.core:stats.mana' }, 20] },
            failure_message: 'Not enough mana',
          },
          {
            logic: { condition_ref: 'conditions:high_level' },
            failure_message: 'Level too low',
          },
        ],
      },
      {
        id: 'core:low_mana',
        name: 'Expensive Spell',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'actor.components.core:stats.mana' }, 80] },
            failure_message: 'Insufficient mana reserve',
          },
        ],
      },
      {
        id: 'core:inspect',
        name: 'Inspect',
        prerequisites: null,
      },
    ];

    const actionContext = { mood: 'focused' };
    actionContext.circular = actionContext;

    const trace = harness.createTrace([
      'core:cast_spell',
      'core:low_mana',
      'core:inspect',
    ]);

    const result = await harness.stage.executeInternal({
      actor,
      candidateActions,
      trace,
      actionContext,
    });

    expect(result.success).toBe(true);
    expect(result.data.candidateActions.map((action) => action.id)).toEqual([
      'core:cast_spell',
      'core:inspect',
    ]);

    const tracedActions = trace.getTracedActions();
    const castSpellTrace = tracedActions.get('core:cast_spell');
    expect(castSpellTrace).toBeDefined();
    expect(castSpellTrace.stages.prerequisite_evaluation.data.evaluationPassed).toBe(
      true
    );
    expect(
      castSpellTrace.stages.prerequisite_evaluation.data.evaluationDetails
        .hasJsonLogicTraces
    ).toBe(true);
    expect(
      castSpellTrace.stages.prerequisite_evaluation.data.evaluationDetails
        .hasEvaluationContext
    ).toBe(true);
    expect(
      castSpellTrace.stages.prerequisite_evaluation.data.evaluationDetails
        .evaluationContext.self
    ).toBe('[Circular Reference]');
    expect(
      castSpellTrace.stages.prerequisite_evaluation.data.evaluationDetails
        .evaluationContext.longDescription
    ).toContain('[truncated]');
    expect(
      castSpellTrace.stages.stage_performance.data.itemsProcessed
    ).toBe(candidateActions.length);

    const lowManaTrace = tracedActions.get('core:low_mana');
    expect(lowManaTrace.stages.prerequisite_evaluation.data.evaluationPassed).toBe(
      false
    );
    expect(
      lowManaTrace.stages.prerequisite_evaluation.data.evaluationReason
    ).toBe('One or more prerequisites failed');

    const inspectTrace = tracedActions.get('core:inspect');
    expect(inspectTrace.stages.prerequisite_evaluation.data.hasPrerequisites).toBe(
      false
    );
    expect(inspectTrace.stages.prerequisite_evaluation.data.evaluationReason).toBe(
      'No prerequisites defined'
    );
  });

  it('captures structured errors when prerequisite evaluation throws', async () => {
    harness.forceEvaluationFailureFor(
      'core:dangerous',
      'JSON Logic failure'
    );

    const candidateActions = [
      {
        id: 'core:dangerous',
        name: 'Dangerous Action',
        prerequisites: [
          {
            logic: { '>=': [{ var: 'actor.components.core:stats.mana' }, 10] },
            failure_message: 'Unexpected failure',
          },
        ],
      },
      {
        id: 'core:backup',
        name: 'Backup Action',
        prerequisites: null,
      },
    ];

    const trace = harness.createTrace(['core:dangerous', 'core:backup']);

    const result = await harness.stage.executeInternal({
      actor,
      candidateActions,
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.data.candidateActions.map((action) => action.id)).toEqual([
      'core:backup',
    ]);
    expect(result.errors).toHaveLength(0);
    expect(result.data.prerequisiteErrors).toHaveLength(0);

    const dangerousTrace = trace.getTracedActions().get('core:dangerous');
    expect(dangerousTrace).toBeDefined();
    if (dangerousTrace) {
      const performanceData = dangerousTrace.stages.stage_performance?.data;
      expect(performanceData).toBeDefined();
      if (performanceData) {
        expect(performanceData.stage).toBe('prerequisite_evaluation');
        expect(performanceData.itemsProcessed).toBe(candidateActions.length);
        expect(performanceData.itemsPassed).toBe(
          result.data.candidateActions.length
        );
      }
    }
  });
});
