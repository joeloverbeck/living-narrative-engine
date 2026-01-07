/**
 * @file Integration tests for emotions aroused-but-ashamed conflict prerequisites.
 */

import { beforeAll, describe, expect, it } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import ConsoleLogger from '../../../../../src/logging/consoleLogger.js';
import JsonLogicEvaluationService from '../../../../../src/logic/jsonLogicEvaluationService.js';

const EXPRESSIONS_DIR = path.resolve('data/mods/emotions/expressions');
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

    const context = {
      emotions: {
        shame: 0.45,
        embarrassment: 0.2,
        guilt: 0.2,
      },
      sexualStates: {
        aroused_with_shame: 0.7,
        sexual_lust: 0.5,
        aroused_with_disgust: 0.3,
        sexual_indifference: 0.2,
      },
      moodAxes: {
        self_evaluation: -15,
        threat: 10,
      },
      previousEmotions: {
        shame: 0.35,
      },
      previousSexualStates: {
        aroused_with_shame: 0.55,
      },
    };

    const results = expression.prerequisites.map(({ logic }) =>
      jsonLogicService.evaluate(logic, context)
    );

    expect(results).toEqual([true, true]);
    expect(results.every(Boolean)).toBe(true);
  });
});
