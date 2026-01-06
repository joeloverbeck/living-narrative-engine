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

const EXPRESSIONS_DIR = path.resolve('data/mods/emotions/expressions');
const EXPRESSION_FILES = [
  'euphoric_excitement.expression.json',
  'quiet_contentment.expression.json',
  'warm_affection.expression.json',
  'playful_mischief.expression.json',
  'intense_desire.expression.json',
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

  it('euphoric_excitement requires high arousal', () => {
    const expression = expressionsById['emotions:euphoric_excitement'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: { euphoria: 0.7 },
      moodAxes: { arousal: 55, valence: 50 },
    };

    const failingContext = {
      emotions: { euphoria: 0.7 },
      moodAxes: { arousal: 20, valence: 50 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('quiet_contentment requires LOW arousal', () => {
    const expression = expressionsById['emotions:quiet_contentment'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: { contentment: 0.6 },
      moodAxes: { arousal: 20, valence: 35 },
    };

    const failingContext = {
      emotions: { contentment: 0.6 },
      moodAxes: { arousal: 45, valence: 35 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('warm_affection considers engagement axis', () => {
    const expression = expressionsById['emotions:warm_affection'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: { affection: 0.6, love_attachment: 0.45 },
      moodAxes: { engagement: 30 },
    };

    const failingContext = {
      emotions: { affection: 0.6, love_attachment: 0.45 },
      moodAxes: { engagement: 5 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('playful_mischief needs amusement with active engagement', () => {
    const expression = expressionsById['emotions:playful_mischief'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      emotions: { amusement: 0.55 },
      moodAxes: { engagement: 20, arousal: 25, valence: 25 },
    };

    const failingContext = {
      emotions: { amusement: 0.55 },
      moodAxes: { engagement: 0, arousal: 25, valence: 25 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });

  it('intense_desire uses sexualStates.sexual_lust and sexualArousal', () => {
    const expression = expressionsById['emotions:intense_desire'];
    const logic = expression.prerequisites[0].logic;

    const passingContext = {
      sexualStates: { sexual_lust: 0.7 },
      sexualArousal: 0.6,
      moodAxes: { arousal: 60 },
    };

    const failingContext = {
      sexualStates: { sexual_lust: 0.7 },
      sexualArousal: 0.2,
      moodAxes: { arousal: 60 },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });
});
