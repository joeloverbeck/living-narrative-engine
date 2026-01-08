/**
 * @file Integration tests for emotions joy/arousal expression content.
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

const POSITIVE_AFFECT_DIR = path.resolve(
  'data/mods/emotions-positive-affect/expressions'
);
const AFFILIATION_DIR = path.resolve(
  'data/mods/emotions-affiliation/expressions'
);
const SEXUALITY_DIR = path.resolve(
  'data/mods/emotions-sexuality/expressions'
);
const EXPRESSION_FILES = [
  {
    dir: POSITIVE_AFFECT_DIR,
    file: 'euphoric_excitement.expression.json',
  },
  {
    dir: POSITIVE_AFFECT_DIR,
    file: 'quiet_contentment.expression.json',
  },
  {
    dir: AFFILIATION_DIR,
    file: 'warm_affection.expression.json',
  },
  {
    dir: POSITIVE_AFFECT_DIR,
    file: 'playful_mischief.expression.json',
  },
  {
    dir: SEXUALITY_DIR,
    file: 'intense_desire.expression.json',
  },
];

describe('Emotions joy/arousal expressions', () => {
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
    const expressions = await Promise.all(
      EXPRESSION_FILES.map(async ({ dir, file }) => {
        const filePath = path.join(dir, file);
        const data = await readFile(filePath, { encoding: 'utf-8' });
        return JSON.parse(data);
      })
    );

    expressionsById = Object.fromEntries(
      expressions.map((expression) => [expression.id, expression])
    );

    jsonLogicService = new JsonLogicEvaluationService({ logger });
  });

  it('validates joy/arousal expressions against the expression schema', () => {
    for (const expression of Object.values(expressionsById)) {
      const result = schemaValidator.validate(
        'schema://living-narrative-engine/expression.schema.json',
        expression
      );

      expect(result.isValid).toBe(true);
    }
  });

  it('all joy/arousal expressions have a valid {actor} placeholder', () => {
    for (const expression of Object.values(expressionsById)) {
      expect(expression.description_text).toContain('{actor}');
    }
  });

  it('euphoric_excitement requires euphoria threshold', () => {
    const expression = expressionsById['emotions-positive-affect:euphoric_excitement'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: {
        euphoria: 0.7,
        fatigue: 0.2,
        numbness: 0.1,
        despair: 0.1,
        anxiety: 0.2,
      },
      moodAxes: { valence: 40, arousal: 30 },
      previousEmotions: { euphoria: 0.55 },
    };

    const failingContext = {
      emotions: {
        euphoria: 0.4,
        fatigue: 0.2,
        numbness: 0.1,
        despair: 0.1,
        anxiety: 0.2,
      },
      moodAxes: { valence: 40, arousal: 30 },
      previousEmotions: { euphoria: 0.35 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('quiet_contentment requires contentment threshold', () => {
    const expression = expressionsById['emotions-positive-affect:quiet_contentment'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: {
        contentment: 0.6,
        calm: 0.5,
        stress: 0.2,
        anxiety: 0.2,
        unease: 0.2,
        boredom: 0.2,
        apathy: 0.2,
      },
      moodAxes: { valence: 20, arousal: 20, threat: 10 },
    };

    const failingContext = {
      emotions: {
        contentment: 0.4,
        calm: 0.5,
        stress: 0.2,
        anxiety: 0.2,
        unease: 0.2,
        boredom: 0.2,
        apathy: 0.2,
      },
      moodAxes: { valence: 20, arousal: 20, threat: 10 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('warm_affection requires affection and attachment', () => {
    const expression = expressionsById['emotions-affiliation:warm_affection'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: { affection: 0.6, love_attachment: 0.45 },
    };

    const failingContext = {
      emotions: { affection: 0.6, love_attachment: 0.2 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('playful_mischief needs amusement with interest or curiosity', () => {
    const expression = expressionsById['emotions-positive-affect:playful_mischief'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: {
        amusement: 0.55,
        curiosity: 0.3,
        stress: 0.2,
        anxiety: 0.2,
        fatigue: 0.2,
        boredom: 0.2,
        apathy: 0.2,
      },
      moodAxes: { valence: 20, engagement: 10, arousal: 10, threat: 10 },
      previousEmotions: { amusement: 0.4, curiosity: 0.2 },
    };

    const failingContext = {
      emotions: {
        amusement: 0.55,
        curiosity: 0.1,
        interest: 0.1,
        stress: 0.2,
        anxiety: 0.2,
        fatigue: 0.2,
        boredom: 0.2,
        apathy: 0.2,
      },
      moodAxes: { valence: 20, engagement: 10, arousal: 10, threat: 10 },
      previousEmotions: { amusement: 0.55, curiosity: 0.1 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('intense_desire uses sexualStates.sexual_lust and arousal', () => {
    const expression = expressionsById['emotions-sexuality:intense_desire'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      sexualArousal: 0.6,
      sexualStates: {
        sexual_lust: 0.7,
        sexual_repulsion: 0.1,
        sexual_indifference: 0.1,
        sexual_performance_anxiety: 0.1,
      },
      moodAxes: { arousal: 60, engagement: 20, threat: 10 },
      emotions: {
        fear: 0.2,
        terror: 0.1,
        disgust: 0.1,
        shame: 0.2,
      },
      previousSexualStates: { sexual_lust: 0.6 },
    };

    const failingContext = {
      sexualArousal: 0.6,
      sexualStates: {
        sexual_lust: 0.4,
        sexual_repulsion: 0.1,
        sexual_indifference: 0.1,
        sexual_performance_anxiety: 0.1,
      },
      moodAxes: { arousal: 60, engagement: 20, threat: 10 },
      emotions: {
        fear: 0.2,
        terror: 0.1,
        disgust: 0.1,
        shame: 0.2,
      },
      previousSexualStates: { sexual_lust: 0.3 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });
});
