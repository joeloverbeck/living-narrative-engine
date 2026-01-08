/**
 * @file Integration tests for emotions-anger expression content.
 */

import { beforeAll, describe, expect, it } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import StaticConfiguration from '../../../../../src/configuration/staticConfiguration.js';
import DefaultPathResolver from '../../../../../src/pathing/defaultPathResolver.js';
import ConsoleLogger from '../../../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../../../src/validation/ajvSchemaValidator.js';
import SchemaLoader from '../../../../../src/loaders/schemaLoader.js';
import JsonLogicEvaluationService from '../../../../../src/logic/jsonLogicEvaluationService.js';

const EMOTIONS_ANGER_DIR = path.resolve('data/mods/emotions-anger/expressions');
const EMOTIONS_LOSS_DIR = path.resolve('data/mods/emotions-loss/expressions');

const ANGER_EXPRESSION_FILES = [
  'suppressed_rage.expression.json',
  'explosive_anger.expression.json',
  'cold_fury.expression.json',
  'mild_irritation.expression.json',
];

const LOSS_EXPRESSION_FILES = ['frustrated_helplessness.expression.json'];

describe('Emotions anger expressions', () => {
  let expressionsById;
  let jsonLogicService;
  let schemaValidator;

  beforeAll(async () => {
    const logger = new ConsoleLogger('ERROR');
    const config = new StaticConfiguration();
    const resolver = new DefaultPathResolver(config);
    schemaValidator = new AjvSchemaValidator({ logger });

    const fetcher = {
      async fetch(filePath) {
        const data = await readFile(filePath, { encoding: 'utf-8' });
        return JSON.parse(data);
      },
    };

    const schemaLoader = new SchemaLoader(
      config,
      resolver,
      fetcher,
      schemaValidator,
      logger
    );

    await schemaLoader.loadAndCompileAllSchemas();

    const angerExpressions = await Promise.all(
      ANGER_EXPRESSION_FILES.map(async (file) => {
        const filePath = path.join(EMOTIONS_ANGER_DIR, file);
        const data = await readFile(filePath, { encoding: 'utf-8' });
        return JSON.parse(data);
      })
    );

    const lossExpressions = await Promise.all(
      LOSS_EXPRESSION_FILES.map(async (file) => {
        const filePath = path.join(EMOTIONS_LOSS_DIR, file);
        const data = await readFile(filePath, { encoding: 'utf-8' });
        return JSON.parse(data);
      })
    );

    const allExpressions = [...angerExpressions, ...lossExpressions];

    expressionsById = Object.fromEntries(
      allExpressions.map((expression) => [expression.id, expression])
    );

    jsonLogicService = new JsonLogicEvaluationService({ logger });
  });

  it('validates anger expressions against the expression schema', () => {
    for (const expression of Object.values(expressionsById)) {
      const result = schemaValidator.validate(
        'schema://living-narrative-engine/expression.schema.json',
        expression
      );

      expect(result.isValid).toBe(true);
    }
  });

  it('all anger expressions have a valid {actor} placeholder', () => {
    for (const expression of Object.values(expressionsById)) {
      expect(expression.description_text).toContain('{actor}');
    }
  });

  it('suppressed_rage prerequisites evaluate correctly', () => {
    const expression = expressionsById['emotions-anger:suppressed_rage'];
    // Expression has TWO prerequisites that must both pass
    const logic1 = expression.prerequisites[0].logic;
    const logic2 = expression.prerequisites[1].logic;

    // Passing context: satisfies all 7 conditions in first prereq + activation in second
    const passingContext = {
      emotions: {
        anger: 0.7, // >= 0.60
        rage: 0.4, // >= 0.35 (OR frustration >= 0.55)
        calm: 0.25, // >= 0.20 (OR confidence >= 0.20)
        despair: 0.3, // <= 0.55
      },
      previousEmotions: { anger: 0.5, rage: 0.3 }, // For spike detection
      moodAxes: {
        arousal: 10, // >= 5
        agency_control: 15, // >= 10 (OR threat >= 20)
        future_expectancy: 0, // >= -30
      },
    };

    // Failing context: anger too low to trigger
    const failingContext = {
      emotions: {
        anger: 0.4, // < 0.60 - fails first condition
        rage: 0.4,
        calm: 0.25,
        despair: 0.3,
      },
      previousEmotions: { anger: 0.3, rage: 0.3 },
      moodAxes: {
        arousal: 10,
        agency_control: 15,
        future_expectancy: 0,
      },
    };

    // Both prerequisites must pass
    expect(jsonLogicService.evaluate(logic1, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic2, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic1, failingContext)).toBe(false);
  });

  it('explosive_anger requires high anger AND high rage', () => {
    const expression = expressionsById['emotions-anger:explosive_anger'];
    const logic = expression.prerequisites[0].logic;

    // Passing context: satisfies all 5 conditions + spike detection
    const passingContext = {
      emotions: { anger: 0.8, rage: 0.7 }, // anger >= 0.75, rage >= 0.60
      previousEmotions: { anger: 0.6, rage: 0.5 }, // For spike detection (delta >= 0.15)
      moodAxes: {
        arousal: 30, // >= 25
        agency_control: -15, // <= -10
      },
      previousMoodAxes: { agency_control: 5 }, // For agency drop detection
    };

    // Failing context: rage too low
    const failingContext = {
      emotions: { anger: 0.8, rage: 0.4 }, // rage < 0.60 - fails
      previousEmotions: { anger: 0.6, rage: 0.2 },
      moodAxes: {
        arousal: 30,
        agency_control: -15,
      },
      previousMoodAxes: { agency_control: 5 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('cold_fury requires high anger with suppressed rage and control', () => {
    const expression = expressionsById['emotions-anger:cold_fury'];
    const logic = expression.prerequisites[0].logic;

    // Passing context: satisfies all 9 conditions + activation
    const passingContext = {
      emotions: {
        anger: 0.7, // >= 0.60
        rage: 0.2, // <= 0.30
        contempt: 0.35, // >= 0.30 (one of contempt/resentment/determination)
        determination: 0.1,
        terror: 0.2, // <= 0.30
        fear: 0.3, // <= 0.55
        surprise_startle: 0.3, // <= 0.50
      },
      previousEmotions: { anger: 0.6 }, // For activation via anger spike >= 0.08
      moodAxes: {
        agency_control: 15, // >= 10
        arousal: 40, // <= 55
      },
    };

    // Failing context: rage too high (not suppressed) and agency_control too low
    const failingContext = {
      emotions: {
        anger: 0.7,
        rage: 0.5, // > 0.30 - fails
        contempt: 0.35,
        determination: 0.1,
        terror: 0.2,
        fear: 0.3,
        surprise_startle: 0.3,
      },
      previousEmotions: { anger: 0.6 },
      moodAxes: {
        agency_control: 5, // < 10 - also fails
        arousal: 40,
      },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('mild_irritation does not trigger when anger is high', () => {
    const expression = expressionsById['emotions-anger:mild_irritation'];
    const logic = expression.prerequisites[0].logic;

    // Passing context: satisfies all 9 conditions including threshold crossing
    const passingContext = {
      emotions: {
        irritation: 0.4, // >= 0.35
        anger: 0.3, // < 0.50
        rage: 0.1, // < 0.20
        contempt: 0.2, // < 0.35
        disgust: 0.2, // < 0.35
      },
      previousEmotions: { irritation: 0.2 }, // < 0.35 for threshold crossing
      moodAxes: {
        arousal: 30, // 10-60 range
        threat: 40, // <= 60
      },
    };

    // Failing context: anger too high
    const failingContext = {
      emotions: {
        irritation: 0.4,
        anger: 0.6, // >= 0.50 - fails
        rage: 0.1,
        contempt: 0.2,
        disgust: 0.2,
      },
      previousEmotions: { irritation: 0.2 },
      moodAxes: {
        arousal: 30,
        threat: 40,
      },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('frustrated_helplessness prerequisites evaluate correctly', () => {
    const expression = expressionsById['emotions-loss:frustrated_helplessness'];
    const logic = expression.prerequisites[0].logic;

    // Passing context: satisfies all 6 condition groups + worsening detection
    const passingContext = {
      emotions: {
        frustration: 0.6, // >= 0.55
        hope: 0.05, // <= 0.10 (one of the OR conditions)
        despair: 0.1,
        stress: 0.4, // >= 0.35 (activation driver)
        numbness: 0.3, // <= 0.50
      },
      previousEmotions: { frustration: 0.45 }, // For worsening detection (spike >= 0.10)
      moodAxes: {
        agency_control: -50, // <= -40
        future_expectancy: -30, // <= -25 (one of the OR conditions)
      },
      previousMoodAxes: { agency_control: -35 }, // For agency drop detection
    };

    // Failing context: hope too high (no bleak signals)
    const failingContext = {
      emotions: {
        frustration: 0.6,
        hope: 0.6, // > 0.10 - fails that OR branch
        despair: 0.1, // < 0.35 - fails that OR branch
        stress: 0.4,
        numbness: 0.3,
      },
      previousEmotions: { frustration: 0.45 },
      moodAxes: {
        agency_control: -50,
        future_expectancy: -10, // > -25 - fails that OR branch (all OR conditions fail)
      },
      previousMoodAxes: { agency_control: -35 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });
});
