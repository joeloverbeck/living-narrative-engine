/**
 * @file Integration tests for emotions sadness expression content.
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
  'deep_despair.expression.json',
  'quiet_grief.expression.json',
  'melancholic_disappointment.expression.json',
  'lonely_isolation.expression.json',
  'tearful_sorrow.expression.json',
];

describe('Emotions sadness expressions', () => {
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

  it('validates sadness expressions against the expression schema', () => {
    for (const expression of Object.values(expressionsById)) {
      const result = schemaValidator.validate(
        'schema://living-narrative-engine/expression.schema.json',
        expression
      );

      expect(result.isValid).toBe(true);
    }
  });

  it('all sadness expressions have a valid {actor} placeholder', () => {
    for (const expression of Object.values(expressionsById)) {
      expect(expression.description_text).toContain('{actor}');
    }
  });

  it('deep_despair requires high despair and sadness', () => {
    const expression = expressionsById['emotions:deep_despair'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: { despair: 0.75, sadness: 0.65 },
    };

    const failingContext = {
      emotions: { despair: 0.65, sadness: 0.65 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('tearful_sorrow requires sadness with low numbness', () => {
    const expression = expressionsById['emotions:tearful_sorrow'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: { sadness: 0.7, numbness: 0.2 },
    };

    const failingContext = {
      emotions: { sadness: 0.7, numbness: 0.5 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('quiet_grief requires grief with LOW arousal', () => {
    const expression = expressionsById['emotions:quiet_grief'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: { grief: 0.6, sadness: 0.55 },
      moodAxes: { arousal: 10 },
    };

    const failingContext = {
      emotions: { grief: 0.6, sadness: 0.55 },
      moodAxes: { arousal: 40 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('lonely_isolation requires sufficient loneliness', () => {
    const expression = expressionsById['emotions:lonely_isolation'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: { loneliness: 0.6 },
    };

    const failingContext = {
      emotions: { loneliness: 0.4 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('melancholic_disappointment requires disappointment with sadness', () => {
    const expression = expressionsById['emotions:melancholic_disappointment'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: { disappointment: 0.5, sadness: 0.4 },
    };

    const failingContext = {
      emotions: { disappointment: 0.3, sadness: 0.4 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });
});
