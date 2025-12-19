import { describe, it, expect } from '@jest/globals';
import { ActionErrorContextBuilder } from '../../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../../src/actions/errors/fixSuggestionEngine.js';
import { ActionIndex } from '../../../../src/actions/actionIndex.js';
import {
  ERROR_PHASES,
  FIX_TYPES,
} from '../../../../src/actions/errors/actionErrorTypes.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';
import { TestDataFactory } from '../../../common/actions/testDataFactory.js';

class RecordingLogger {
  constructor() {
    this.debugEntries = [];
    this.infoEntries = [];
    this.warnEntries = [];
    this.errorEntries = [];
  }

  debug(message, context) {
    this.debugEntries.push({ message, context });
  }

  info(message, context) {
    this.infoEntries.push({ message, context });
  }

  warn(message, context) {
    this.warnEntries.push({ message, context });
  }

  error(message, context) {
    this.errorEntries.push({ message, context });
  }
}

class InMemoryGameDataRepository {
  getComponentDefinition(componentId) {
    return { id: componentId, name: `Component ${componentId}` };
  }

  getConditionDefinition(conditionId) {
    return { id: conditionId, description: `Condition ${conditionId}` };
  }
}

/**
 *
 * @param root0
 * @param root0.extraActions
 * @param root0.extraEntities
 */
function createHarness({ extraActions = [], extraEntities = [] } = {}) {
  const logger = new RecordingLogger();
  const defaultEntities = [
    {
      id: 'spy-1',
      components: {
        'core:location': { value: 'field-base' },
        'core:position': { locationId: 'field-base' },
        'core:inventory': { items: [] },
      },
    },
  ];

  const entityManager = new SimpleEntityManager([
    ...defaultEntities,
    ...extraEntities,
  ]);

  const baselineActions = TestDataFactory.createBasicActions();
  const actions = [...baselineActions, ...extraActions];

  const actionIndex = new ActionIndex({ logger, entityManager });
  actionIndex.buildIndex(actions);

  const fixSuggestionEngine = new FixSuggestionEngine({
    logger,
    gameDataRepository: new InMemoryGameDataRepository(),
    actionIndex,
  });

  const builder = new ActionErrorContextBuilder({
    entityManager,
    logger,
    fixSuggestionEngine,
  });

  return { builder, fixSuggestionEngine, actionIndex, entityManager, logger };
}

describe('FixSuggestionEngine prerequisite and target integration', () => {
  it('surfaces prerequisite analysis and target fixes for validation errors', () => {
    const infiltrationAction = {
      id: 'stealth:infiltrate',
      name: 'Infiltrate Outpost',
      description: 'Slip past guard patrols to reach a target.',
      scope: 'stealth:guard_post',
      template: 'infiltrate {target}',
      prerequisites: [
        { hasComponent: 'stealth:training' },
        {
          logic: {
            and: [
              { condition_ref: 'anatomy:actor-can-move' },
              { hasComponent: 'core:position' },
            ],
          },
        },
      ],
      required_components: { actor: ['stealth:training', 'core:position'] },
    };

    const { builder } = createHarness({
      extraActions: [infiltrationAction],
    });

    const discoveryError = new Error(
      "Missing component 'stealth:training' prevents targeting guard outpost"
    );
    discoveryError.name = 'ComponentNotFoundError';

    const context = builder.buildErrorContext({
      error: discoveryError,
      actionDef: infiltrationAction,
      actorId: 'spy-1',
      phase: ERROR_PHASES.VALIDATION,
    });

    const missingComponentFix = context.suggestedFixes.find(
      (fix) => fix.details?.requiredBy === 'stealth:infiltrate'
    );
    expect(missingComponentFix).toMatchObject({
      type: FIX_TYPES.MISSING_COMPONENT,
      details: expect.objectContaining({
        componentId: 'stealth:training',
        actorId: 'spy-1',
        requiredBy: 'stealth:infiltrate',
      }),
    });

    const prerequisiteAnalysisFix = context.suggestedFixes.find(
      (fix) => fix.details?.source === 'prerequisite_analysis'
    );
    expect(prerequisiteAnalysisFix).toMatchObject({
      type: FIX_TYPES.MISSING_COMPONENT,
      details: expect.objectContaining({
        componentId: 'stealth:training',
        actorId: 'spy-1',
        source: 'prerequisite_analysis',
      }),
    });

    const targetFix = context.suggestedFixes.find(
      (fix) => fix.type === FIX_TYPES.INVALID_TARGET
    );
    expect(targetFix).toMatchObject({
      details: expect.objectContaining({
        actionScope: 'stealth:guard_post',
        actorLocation: 'field-base',
      }),
    });

    expect(context.suggestedFixes.length).toBeGreaterThanOrEqual(3);
  });

  it('falls back to default metadata when action definitions are missing', () => {
    const { builder } = createHarness();

    const fallbackError = new Error(
      "Missing component 'stealth:training' while targeting infiltration objective"
    );
    fallbackError.name = 'ComponentNotFoundError';

    const context = builder.buildErrorContext({
      error: fallbackError,
      actionDef: null,
      actorId: 'spy-1',
      phase: ERROR_PHASES.VALIDATION,
    });

    const missingComponentFix = context.suggestedFixes.find(
      (fix) => fix.details?.requiredBy === 'unknown'
    );
    expect(missingComponentFix).toMatchObject({
      type: FIX_TYPES.MISSING_COMPONENT,
      details: expect.objectContaining({
        componentId: 'stealth:training',
        actorId: 'spy-1',
        requiredBy: 'unknown',
      }),
    });

    const prerequisiteFixes = context.suggestedFixes.filter(
      (fix) => fix.details?.source === 'prerequisite_analysis'
    );
    expect(prerequisiteFixes).toHaveLength(0);

    const targetFix = context.suggestedFixes.find(
      (fix) => fix.type === FIX_TYPES.INVALID_TARGET
    );
    expect(targetFix).toMatchObject({
      details: expect.objectContaining({
        actionScope: 'none',
        actorLocation: 'field-base',
      }),
    });
  });

  it('labels prerequisite fixes with unknown action identifiers when absent', () => {
    const { builder } = createHarness();

    const anonymousAction = {
      prerequisites: [{ hasComponent: 'stealth:training' }],
      required_components: { actor: ['stealth:training'] },
    };

    const anonymousError = new Error(
      "Missing component 'stealth:training' disrupts target acquisition"
    );
    anonymousError.name = 'ComponentNotFoundError';

    const context = builder.buildErrorContext({
      error: anonymousError,
      actionDef: anonymousAction,
      actorId: 'spy-1',
      phase: ERROR_PHASES.VALIDATION,
    });

    const missingComponentFix = context.suggestedFixes.find(
      (fix) => fix.details?.requiredBy === 'unknown'
    );
    expect(missingComponentFix).toMatchObject({
      type: FIX_TYPES.MISSING_COMPONENT,
      details: expect.objectContaining({
        componentId: 'stealth:training',
        actorId: 'spy-1',
        requiredBy: 'unknown',
      }),
    });

    const prerequisiteComponentFix = context.suggestedFixes.find(
      (fix) => fix.details?.source === 'prerequisite_analysis'
    );
    expect(prerequisiteComponentFix).toMatchObject({
      type: FIX_TYPES.MISSING_COMPONENT,
      details: expect.objectContaining({
        componentId: 'stealth:training',
        actorId: 'spy-1',
        source: 'prerequisite_analysis',
      }),
    });

    const prerequisiteSummaryFix = context.suggestedFixes.find(
      (fix) => fix.type === FIX_TYPES.MISSING_PREREQUISITE
    );
    expect(prerequisiteSummaryFix?.description).toContain(
      "Action 'unknown' has prerequisites"
    );
  });
});
