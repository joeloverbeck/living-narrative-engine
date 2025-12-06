import { describe, it, expect } from '@jest/globals';
import { ActionFormattingStage } from '../../../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import ActionCommandFormatter from '../../../../../src/actions/actionFormatter.js';
import { SafeEventDispatcher } from '../../../../../src/events/safeEventDispatcher.js';
import { ActionErrorContextBuilder } from '../../../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../../../src/actions/errors/fixSuggestionEngine.js';
import { ActionTargetContext } from '../../../../../src/models/actionTargetContext.js';
import SimpleEntityManager from '../../../../common/entities/simpleEntityManager.js';

class TestLogger {
  constructor() {
    this.debugMessages = [];
    this.infoMessages = [];
    this.warnMessages = [];
    this.errorMessages = [];
  }

  debug(...args) {
    this.debugMessages.push(args);
  }

  info(...args) {
    this.infoMessages.push(args);
  }

  warn(...args) {
    this.warnMessages.push(args);
  }

  error(...args) {
    this.errorMessages.push(args);
  }
}

class TestValidatedEventDispatcher {
  constructor() {
    this.dispatched = [];
  }

  dispatch(eventName, payload) {
    this.dispatched.push({ eventName, payload });
  }

  subscribe() {
    return () => {};
  }

  unsubscribe() {}
}

class TestGameDataRepository {
  getComponentDefinition() {
    return { id: 'component', name: 'Component' };
  }

  getConditionDefinition() {
    return { id: 'condition', name: 'Condition' };
  }
}

class TestActionIndex {
  getCandidateActions() {
    return [];
  }
}

/**
 *
 */
function createEntityManager() {
  return new SimpleEntityManager([
    {
      id: 'actor-1',
      components: {
        'core:name': { value: 'Actor One' },
        'core:location': { value: 'atrium' },
      },
    },
    {
      id: 'target-1',
      components: {
        'core:name': { value: 'Target One' },
      },
    },
  ]);
}

/**
 *
 */
function createStageFixture() {
  const logger = new TestLogger();
  const entityManager = createEntityManager();
  const validatedEventDispatcher = new TestValidatedEventDispatcher();
  const safeEventDispatcher = new SafeEventDispatcher({
    validatedEventDispatcher,
    logger,
  });
  const commandFormatter = new ActionCommandFormatter();
  const fixSuggestionEngine = new FixSuggestionEngine({
    logger,
    gameDataRepository: new TestGameDataRepository(),
    actionIndex: new TestActionIndex(),
  });
  const errorContextBuilder = new ActionErrorContextBuilder({
    entityManager,
    logger,
    fixSuggestionEngine,
  });
  const getEntityDisplayNameFn = (entity, fallback) => {
    return entity?.components?.['core:name']?.value ?? fallback;
  };

  const stage = new ActionFormattingStage({
    commandFormatter,
    entityManager,
    safeEventDispatcher,
    getEntityDisplayNameFn,
    errorContextBuilder,
    logger,
  });

  return { stage, logger, entityManager };
}

/**
 *
 * @param id
 * @param overrides
 */
function createActionDefinition(id, overrides = {}) {
  const base = {
    id,
    name: `Action ${id}`,
    description: 'Example action for formatting stage coverage',
    template: 'wave at {target}',
    scope: 'none',
    prerequisites: [],
    required_components: { actor: [] },
  };

  if (Object.prototype.hasOwnProperty.call(overrides, 'visual')) {
    base.visual = overrides.visual;
  }

  return { ...base, ...overrides };
}

/**
 *
 * @param id
 * @param root0
 * @param root0.visual
 */
function createActionWithTargets(id, { visual } = {}) {
  const actionDef = createActionDefinition(id, { visual });
  return {
    actionDef,
    targetContexts: [ActionTargetContext.forEntity('target-1')],
    resolvedTargets: {
      primary: [{ id: 'target-1' }],
    },
    targetDefinitions: {
      primary: { placeholder: 'target' },
    },
    isMultiTarget: true,
  };
}

describe('ActionFormattingStage integration coverage', () => {
  it('formats actions with trace-aware instrumentation and validates visual metadata', async () => {
    const { stage, logger, entityManager } = createStageFixture();
    const actor = entityManager.getEntityInstance('actor-1');

    const traceSteps = [];
    const traceRecords = [];
    const trace = {
      step: (message, source) => {
        traceSteps.push({ message, source });
      },
      captureActionData: (category, id, payload) => {
        traceRecords.push({ category, id, payload });
      },
    };

    const actionsWithTargets = [
      createActionWithTargets('core:wave-no-visual'),
      createActionWithTargets('core:wave-string', { visual: 'unsupported' }),
      createActionWithTargets('core:wave-object', {
        visual: { textColor: 123, sparkle: '#fff' },
      }),
      createActionWithTargets('core:wave-array', { visual: [] }),
      createActionWithTargets('core:wave-known', {
        visual: { textColor: '#fff', hoverTextColor: '#eee' },
      }),
    ];

    const result = await stage.execute({
      actor,
      actionsWithTargets,
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.actions).toHaveLength(5);
    expect(result.actions.map((action) => action.command)).toEqual([
      'wave at Target One',
      'wave at Target One',
      'wave at Target One',
      'wave at Target One',
      'wave at Target One',
    ]);

    expect(traceSteps).toEqual([
      {
        message: 'Formatting 5 actions with their targets',
        source: 'ActionFormattingStage.execute',
      },
    ]);

    const statuses = traceRecords.map((entry) => entry.payload.status);
    expect(statuses).toEqual(
      expect.arrayContaining(['started', 'formatting', 'completed'])
    );
    const summary = traceRecords.find(
      (entry) => entry.id === '__stage_summary'
    );
    expect(summary).toBeDefined();
    expect(summary?.payload.statistics.total).toBe(5);

    expect(
      logger.warnMessages.some((entry) =>
        entry[0].includes(
          "Invalid visual property structure for action 'core:wave-string'"
        )
      )
    ).toBe(true);
    expect(
      logger.warnMessages.some((entry) =>
        entry[0].includes(
          "Unknown visual properties for action 'core:wave-object': sparkle"
        )
      )
    ).toBe(true);
    expect(
      logger.warnMessages.some((entry) =>
        entry[0].includes(
          "Visual property 'textColor' for action 'core:wave-object' should be a string"
        )
      )
    ).toBe(true);
    expect(
      logger.warnMessages.some((entry) =>
        entry[0].includes(
          "Invalid visual property structure for action 'core:wave-array'"
        )
      )
    ).toBe(true);
    expect(
      logger.warnMessages.some((entry) => entry[0].includes('core:wave-known'))
    ).toBe(false);
  });

  it('uses noop instrumentation when trace lacks captureActionData and preserves formatting', async () => {
    const { stage, logger, entityManager } = createStageFixture();
    const actor = entityManager.getEntityInstance('actor-1');

    const traceSteps = [];
    const trace = {
      step: (message, source) => {
        traceSteps.push({ message, source });
      },
    };

    const result = await stage.execute({
      actor,
      actionsWithTargets: [createActionWithTargets('core:wave-basic')],
      trace,
    });

    expect(result.success).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].command).toBe('wave at Target One');
    expect(traceSteps).toEqual([
      {
        message: 'Formatting 1 actions with their targets',
        source: 'ActionFormattingStage.execute',
      },
    ]);
    expect(logger.warnMessages).toHaveLength(0);
  });

  it('handles missing actions by returning a successful empty result', async () => {
    const { stage, entityManager } = createStageFixture();
    const actor = entityManager.getEntityInstance('actor-1');
    const traceSteps = [];
    const trace = {
      step: (message, source) => {
        traceSteps.push({ message, source });
      },
    };

    const result = await stage.execute({ actor, trace });

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
    expect(traceSteps).toEqual([
      {
        message: 'Formatting 0 actions with their targets',
        source: 'ActionFormattingStage.execute',
      },
    ]);
  });
});
