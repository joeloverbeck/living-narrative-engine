/**
 * @file Integration test for chance modifier tag display on multi-target actions
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionFormattingStage } from '../../../src/actions/pipeline/stages/ActionFormattingStage.js';
import { MultiTargetActionFormatter } from '../../../src/actions/formatters/MultiTargetActionFormatter.js';
import ChanceCalculationService from '../../../src/combat/services/ChanceCalculationService.js';
import SkillResolverService from '../../../src/combat/services/SkillResolverService.js';
import ModifierCollectorService from '../../../src/combat/services/ModifierCollectorService.js';
import ModifierContextBuilder from '../../../src/combat/services/ModifierContextBuilder.js';
import ProbabilityCalculatorService from '../../../src/combat/services/ProbabilityCalculatorService.js';
import OutcomeDeterminerService from '../../../src/combat/services/OutcomeDeterminerService.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import sawThroughAction from '../../../data/mods/breaching/actions/saw_through_barred_blocker.action.json' assert { type: 'json' };
import corrodedCondition from '../../../data/mods/blockers/conditions/target-is-corroded.condition.json' assert { type: 'json' };

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('ActionFormattingStage - chance modifier tags for multi-target actions', () => {
  let logger;
  let entityManager;
  let formattingStage;

  beforeEach(() => {
    logger = createLogger();
    entityManager = new SimpleEntityManager([
      {
        id: 'actor-1',
        components: {
          'core:actor': {},
          'skills:craft_skill': { value: 60 },
        },
      },
      {
        id: 'blocker-1',
        components: {
          'blockers:structural_resistance': { value: 60 },
          'blockers:is_barred': {},
          'blockers:corroded': {},
        },
      },
      {
        id: 'tool-1',
        components: {
          'items-core:item': {},
          'breaching:allows_abrasive_sawing': {},
        },
      },
    ]);

    const chanceCalculationService = new ChanceCalculationService({
      skillResolverService: new SkillResolverService({
        entityManager,
        logger,
      }),
      modifierCollectorService: new ModifierCollectorService({
        entityManager,
        modifierContextBuilder: new ModifierContextBuilder({
          entityManager,
          logger,
        }),
        logger,
        gameDataRepository: {
          getConditionDefinition: (id) =>
            id === corrodedCondition.id ? corrodedCondition : null,
        },
      }),
      probabilityCalculatorService: new ProbabilityCalculatorService({
        logger,
      }),
      outcomeDeterminerService: new OutcomeDeterminerService({
        logger,
      }),
      logger,
    });

    const baseFormatter = { format: jest.fn() };
    const multiTargetFormatter = new MultiTargetActionFormatter(
      baseFormatter,
      logger
    );

    formattingStage = new ActionFormattingStage({
      commandFormatter: multiTargetFormatter,
      entityManager,
      safeEventDispatcher: { emit: jest.fn() },
      getEntityDisplayNameFn: () => null,
      errorContextBuilder: { buildErrorContext: jest.fn() },
      logger,
      chanceCalculationService,
    });
  });

  it('adds modifier tags when chance is calculated for multi-target actions', async () => {
    const resolvedTargets = {
      primary: [{ id: 'blocker-1', displayName: 'ancient iron grate' }],
      secondary: [{ id: 'tool-1', displayName: 'hacksaw' }],
    };

    const context = {
      actor: { id: 'actor-1' },
      resolvedTargets,
      targetDefinitions: sawThroughAction.targets,
      actionsWithTargets: [
        {
          actionDef: sawThroughAction,
          resolvedTargets,
          targetDefinitions: sawThroughAction.targets,
          isMultiTarget: true,
        },
      ],
    };

    const result = await formattingStage.execute(context);

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].command).toContain('[corroded]');
    expect(result.actions[0].command).toContain('(60% chance)');
  });
});
