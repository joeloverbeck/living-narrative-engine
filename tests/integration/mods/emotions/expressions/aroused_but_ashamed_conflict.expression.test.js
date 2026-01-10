/**
 * @file Integration tests for emotions aroused-but-ashamed conflict prerequisites.
 */

import { beforeAll, describe, expect, it } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ConsoleLogger from '../../../../../src/logging/consoleLogger.js';
import JsonLogicEvaluationService from '../../../../../src/logic/jsonLogicEvaluationService.js';

const EXPRESSIONS_DIR = path.resolve(
  'data/mods/emotions-sexual-conflict/expressions'
);
const EXPRESSION_FILE = 'aroused_but_ashamed_conflict.expression.json';

describe('Emotions aroused-but-ashamed conflict prerequisites', () => {
  let expression;
  let jsonLogicService;

  beforeAll(async () => {
    const data = await readFile(path.join(EXPRESSIONS_DIR, EXPRESSION_FILE), {
      encoding: 'utf-8',
    });
    expression = JSON.parse(data);
    jsonLogicService = new JsonLogicEvaluationService({
      logger: new ConsoleLogger('ERROR'),
    });
  });

  it('passes when both prerequisite logic blocks are satisfied', () => {
    expect(expression.prerequisites).toHaveLength(2);

    // Production expression now requires:
    // - freeze >= 0.18 and <= 0.70 (social freeze, not threat-collapse)
    // - terror <= 0.40 and panic <= 0.20 (distinguishes from threat-collapse)
    // - threat >= 5 and <= 60 (mild threat, not overwhelming)
    // - aroused_with_disgust <= 0.45, sexual_indifference <= 0.55
    const context = {
      emotions: {
        shame: 0.45,
        embarrassment: 0.2,
        guilt: 0.2,
        freeze: 0.35, // Required: >= 0.18 AND <= 0.70
        terror: 0.25, // Required: <= 0.40
        panic: 0.1, // Required: <= 0.20
      },
      sexualStates: {
        aroused_with_shame: 0.7, // Required: >= 0.60
        sexual_lust: 0.5, // Required: >= 0.35
        aroused_with_disgust: 0.3, // Required: <= 0.45
        sexual_indifference: 0.2, // Required: <= 0.55
      },
      moodAxes: {
        self_evaluation: -15, // Required: <= -10
        threat: 25, // Required: >= 5 AND <= 60
      },
      previousEmotions: {
        shame: 0.35, // Delta: 0.45 - 0.35 = 0.10 >= 0.06
        freeze: 0.20,
      },
      previousSexualStates: {
        aroused_with_shame: 0.55, // Delta: 0.7 - 0.55 = 0.15 >= 0.06
      },
    };

    const results = expression.prerequisites.map(({ logic }) =>
      jsonLogicService.evaluate(logic, context)
    );

    expect(results).toEqual([true, true]);
    expect(results.every(Boolean)).toBe(true);
  });
});
