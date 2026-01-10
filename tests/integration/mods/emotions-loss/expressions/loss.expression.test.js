/**
 * @file Integration tests for emotions-loss expression content.
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

const EXPRESSIONS_DIR = path.resolve('data/mods/emotions-loss/expressions');
const AFFILIATION_DIR = path.resolve(
  'data/mods/emotions-affiliation/expressions'
);
const EXPRESSION_FILES = [
  { dir: EXPRESSIONS_DIR, file: 'deep_despair.expression.json' },
  { dir: EXPRESSIONS_DIR, file: 'quiet_grief.expression.json' },
  { dir: EXPRESSIONS_DIR, file: 'melancholic_disappointment.expression.json' },
  { dir: AFFILIATION_DIR, file: 'lonely_isolation.expression.json' },
  { dir: EXPRESSIONS_DIR, file: 'tearful_sorrow.expression.json' },
];

describe('Emotions loss expressions', () => {
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

  it('validates loss expressions against the expression schema', () => {
    for (const expression of Object.values(expressionsById)) {
      const result = schemaValidator.validate(
        'schema://living-narrative-engine/expression.schema.json',
        expression
      );

      expect(result.isValid).toBe(true);
    }
  });

  it('all loss expressions have a valid {actor} placeholder', () => {
    for (const expression of Object.values(expressionsById)) {
      expect(expression.description_text).toContain('{actor}');
    }
  });

  it('deep_despair requires high despair and sadness', () => {
    const expression = expressionsById['emotions-loss:deep_despair'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: {
        despair: 0.75,
        sadness: 0.65,
        hope: 0.2,
        optimism: 0.2,
        rage: 0.2,
        terror: 0.2,
      },
      moodAxes: {
        future_expectancy: -45,
        engagement: -40,
        agency_control: -35,
        arousal: 15,
      },
      previousEmotions: {
        despair: 0.5,
      },
    };

    const failingContext = {
      emotions: {
        despair: 0.65,
        sadness: 0.65,
        hope: 0.2,
        optimism: 0.2,
        rage: 0.2,
        terror: 0.2,
      },
      moodAxes: {
        future_expectancy: -45,
        engagement: -40,
        agency_control: -35,
        arousal: 15,
      },
      previousEmotions: {
        despair: 0.5,
      },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('tearful_sorrow requires sadness with low numbness', () => {
    const expression = expressionsById['emotions-loss:tearful_sorrow'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: {
        sadness: 0.7,
        numbness: 0.2,
        dissociation: 0.1,
        rage: 0.2,
        terror: 0.2,
        disgust: 0.2,
        grief: 0.45,
        disappointment: 0.2,
        lonely_yearning: 0.2,
      },
      moodAxes: {
        arousal: 10,
        self_evaluation: 10,
      },
    };

    const failingContext = {
      emotions: {
        sadness: 0.7,
        numbness: 0.5,
        dissociation: 0.1,
        rage: 0.2,
        terror: 0.2,
        disgust: 0.2,
        grief: 0.45,
        disappointment: 0.2,
        lonely_yearning: 0.2,
      },
      moodAxes: {
        arousal: 10,
        self_evaluation: 10,
      },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('quiet_grief requires grief with LOW arousal', () => {
    const expression = expressionsById['emotions-loss:quiet_grief'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: {
        grief: 0.6,
        sadness: 0.55,
        alarm: 0.2,
        fear: 0.3,
        anxiety: 0.4,
      },
      moodAxes: {
        arousal: 10,
        valence: -20,
        future_expectancy: -15,
      },
      previousEmotions: {
        grief: 0.5,
        sadness: 0.4,
      },
    };

    const failingContext = {
      emotions: {
        grief: 0.6,
        sadness: 0.55,
        alarm: 0.2,
        fear: 0.3,
        anxiety: 0.4,
      },
      moodAxes: {
        arousal: 40,
        valence: -20,
        future_expectancy: -15,
      },
      previousEmotions: {
        grief: 0.5,
        sadness: 0.4,
      },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('lonely_isolation requires sufficient withdrawn_isolation', () => {
    const expression = expressionsById['emotions-affiliation:lonely_isolation'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: {
        withdrawn_isolation: 0.6,
        affection: 0.3,
        love_attachment: 0.2,
        trust: 0.2,
        gratitude: 0.25,
        despair: 0.5,
        lonely_yearning: 0.2,
      },
      moodAxes: {
        engagement: -20,
        valence: -20,
      },
      previousEmotions: {
        withdrawn_isolation: 0.45,
        affection: 0.4,
        love_attachment: 0.4,
        trust: 0.4,
      },
      previousMoodAxes: {
        engagement: -5,
      },
    };

    const failingContext = {
      emotions: {
        withdrawn_isolation: 0.4,
        affection: 0.3,
        love_attachment: 0.2,
        trust: 0.2,
        gratitude: 0.25,
        despair: 0.5,
        lonely_yearning: 0.2,
      },
      moodAxes: {
        engagement: -20,
        valence: -20,
      },
      previousEmotions: {
        withdrawn_isolation: 0.45,
        affection: 0.4,
        love_attachment: 0.4,
        trust: 0.4,
      },
      previousMoodAxes: {
        engagement: -5,
      },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('melancholic_disappointment requires disappointment with sadness', () => {
    const expression = expressionsById['emotions-loss:melancholic_disappointment'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: {
        disappointment: 0.5,
        sadness: 0.4,
        anger: 0.3,
        rage: 0.15,
        frustration: 0.4,
        despair: 0.4,
        grief: 0.5,
      },
      moodAxes: {
        arousal: 20,
        valence: -15,
        future_expectancy: 5,
      },
      previousEmotions: {
        disappointment: 0.35,
      },
    };

    const failingContext = {
      emotions: {
        disappointment: 0.3,
        sadness: 0.4,
        anger: 0.3,
        rage: 0.15,
        frustration: 0.4,
        despair: 0.4,
        grief: 0.5,
      },
      moodAxes: {
        arousal: 20,
        valence: -15,
        future_expectancy: 5,
      },
      previousEmotions: {
        disappointment: 0.35,
      },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });
});
