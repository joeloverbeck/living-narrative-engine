/**
 * @file Integration tests for emotions anger expression content.
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

const EXPRESSIONS_DIR = path.resolve('data/mods/emotions/expressions');
const EXPRESSION_FILES = [
  'suppressed_rage.expression.json',
  'explosive_anger.expression.json',
  'cold_fury.expression.json',
  'mild_irritation.expression.json',
  'frustrated_helplessness.expression.json',
];

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
    const expressions = await Promise.all(
      EXPRESSION_FILES.map(async (file) => {
        const filePath = path.join(EXPRESSIONS_DIR, file);
        const data = await readFile(filePath, { encoding: 'utf-8' });
        return JSON.parse(data);
      })
    );

    expressionsById = Object.fromEntries(
      expressions.map((expression) => [expression.id, expression])
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
    const expression = expressionsById['emotions:suppressed_rage'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: { anger: 0.7 },
      moodAxes: { agency_control: -35, future_expectancy: 0 },
    };

    const failingContext = {
      emotions: { anger: 0.7 },
      moodAxes: { agency_control: -35, future_expectancy: -20 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('explosive_anger requires high anger AND high rage', () => {
    const expression = expressionsById['emotions:explosive_anger'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: { anger: 0.8, rage: 0.7 },
    };

    const failingContext = {
      emotions: { anger: 0.8, rage: 0.4 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('cold_fury requires high anger with suppressed rage and control', () => {
    const expression = expressionsById['emotions:cold_fury'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: { anger: 0.7, rage: 0.2, contempt: 0.1, determination: 0.1 },
      moodAxes: { agency_control: 15 },
    };

    const failingContext = {
      emotions: { anger: 0.7, rage: 0.5, contempt: 0.1, determination: 0.1 },
      moodAxes: { agency_control: 5 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('mild_irritation does not trigger when anger is high', () => {
    const expression = expressionsById['emotions:mild_irritation'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: { irritation: 0.4, anger: 0.3 },
    };

    const failingContext = {
      emotions: { irritation: 0.4, anger: 0.6 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('frustrated_helplessness prerequisites evaluate correctly', () => {
    const expression = expressionsById['emotions:frustrated_helplessness'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: { frustration: 0.6, hope: 0.2, despair: 0.1 },
      moodAxes: { agency_control: -50, future_expectancy: -30 },
    };

    const failingContext = {
      emotions: { frustration: 0.6, hope: 0.6, despair: 0.1 },
      moodAxes: { agency_control: -50, future_expectancy: -10 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });
});
