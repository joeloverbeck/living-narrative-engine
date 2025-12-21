/**
 * @file Integration tests for corroded modifier chance calculations
 */

import { describe, it, expect } from '@jest/globals';
import ChanceCalculationService from '../../../../src/combat/services/ChanceCalculationService.js';
import SkillResolverService from '../../../../src/combat/services/SkillResolverService.js';
import ModifierCollectorService from '../../../../src/combat/services/ModifierCollectorService.js';
import ModifierContextBuilder from '../../../../src/combat/services/ModifierContextBuilder.js';
import ProbabilityCalculatorService from '../../../../src/combat/services/ProbabilityCalculatorService.js';
import OutcomeDeterminerService from '../../../../src/combat/services/OutcomeDeterminerService.js';
import SimpleEntityManager from '../../../common/entities/simpleEntityManager.js';
import sawThroughAction from '../../../../data/mods/breaching/actions/saw_through_barred_blocker.action.json' assert { type: 'json' };
import corrodedCondition from '../../../../data/mods/blockers/conditions/target-is-corroded.condition.json' assert { type: 'json' };

const createLogger = () => ({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
});

const createChanceService = ({ entityManager }) =>
  new ChanceCalculationService({
    skillResolverService: new SkillResolverService({
      entityManager,
      logger: createLogger(),
    }),
    modifierCollectorService: new ModifierCollectorService({
      entityManager,
      modifierContextBuilder: new ModifierContextBuilder({
        entityManager,
        logger: createLogger(),
      }),
      logger: createLogger(),
      gameDataRepository: {
        getConditionDefinition: (id) =>
          id === corrodedCondition.id ? corrodedCondition : null,
      },
    }),
    probabilityCalculatorService: new ProbabilityCalculatorService({
      logger: createLogger(),
    }),
    outcomeDeterminerService: new OutcomeDeterminerService({
      logger: createLogger(),
    }),
    logger: createLogger(),
  });

describe('breaching:saw_through_barred_blocker chance modifiers', () => {
  it('applies corroded modifier to the calculated chance', () => {
    const actorId = 'pitch';
    const corrodedTargetId = 'ancient-iron-grate-corroded';
    const cleanTargetId = 'ancient-iron-grate-clean';

    const entityManager = new SimpleEntityManager([
      {
        id: actorId,
        components: {
          'core:actor': {},
          'skills:craft_skill': { value: 83 },
        },
      },
      {
        id: corrodedTargetId,
        components: {
          'blockers:structural_resistance': { value: 60 },
          'blockers:is_barred': {},
          'blockers:corroded': {},
        },
      },
      {
        id: cleanTargetId,
        components: {
          'blockers:structural_resistance': { value: 60 },
          'blockers:is_barred': {},
        },
      },
    ]);

    const chanceService = createChanceService({ entityManager });

    const corrodedChance = chanceService.calculateForDisplay({
      actorId,
      primaryTargetId: corrodedTargetId,
      actionDef: sawThroughAction,
    });
    const cleanChance = chanceService.calculateForDisplay({
      actorId,
      primaryTargetId: cleanTargetId,
      actionDef: sawThroughAction,
    });

    expect(cleanChance.chance).toBe(58);
    expect(corrodedChance.chance).toBe(68);
    expect(cleanChance.chance).toBeLessThan(corrodedChance.chance);
    expect(corrodedChance.activeTags).toContain('corroded');
    expect(cleanChance.activeTags).toEqual([]);
  });
});
