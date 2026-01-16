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

const EMOTIONS_ANGER_FURY_RAGE_DIR = path.resolve(
  'data/mods/emotions-anger-fury-rage/expressions'
);
const EMOTIONS_DESPAIR_DIR = path.resolve('data/mods/emotions-despair/expressions');

const FURY_RAGE_EXPRESSION_FILES = [
  'suppressed_rage.expression.json',
  'explosive_anger.expression.json',
  'cold_fury.expression.json',
];

const DESPAIR_EXPRESSION_FILES = ['frustrated_helplessness.expression.json'];

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

    const furyRageExpressions = await Promise.all(
      FURY_RAGE_EXPRESSION_FILES.map(async (file) => {
        const filePath = path.join(EMOTIONS_ANGER_FURY_RAGE_DIR, file);
        const data = await readFile(filePath, { encoding: 'utf-8' });
        return JSON.parse(data);
      })
    );

    const despairExpressions = await Promise.all(
      DESPAIR_EXPRESSION_FILES.map(async (file) => {
        const filePath = path.join(EMOTIONS_DESPAIR_DIR, file);
        const data = await readFile(filePath, { encoding: 'utf-8' });
        return JSON.parse(data);
      })
    );

    const allExpressions = [...furyRageExpressions, ...despairExpressions];

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

  it('frustrated_helplessness prerequisites evaluate correctly', () => {
    const expression = expressionsById['emotions-despair:frustrated_helplessness'];
    const logic = expression.prerequisites[0].logic;

    // Passing context: satisfies all condition groups + worsening detection
    // Expression requires:
    // - frustration >= 0.55
    // - freeze < 0.25
    // - dissociation < 0.35
    // - engagement >= 5
    // - agency_control <= -40
    // - OR: future_expectancy <= -25 | despair >= 0.35 | hope <= 0.1
    // - OR: stress_acute >= 0.35 | rage >= 0.35 | arousal >= 15
    // - numbness <= 0.5
    // - OR: affiliation <= 25 | (previousAffiliation - affiliation >= 10)
    // - OR: (frustration - prev.frustration >= 0.1) | (agency - prev.agency <= -10) | (prev.affiliation - affiliation >= 10)
    const passingContext = {
      emotions: {
        frustration: 0.6, // >= 0.55
        hope: 0.05, // <= 0.10 (one of the OR conditions for bleak signals)
        despair: 0.1,
        stress_acute: 0.4, // >= 0.35 (activation driver OR condition)
        rage: 0.1,
        numbness: 0.3, // <= 0.50
        dissociation: 0.2, // < 0.35
        freeze: 0.1, // < 0.25
      },
      previousEmotions: { frustration: 0.45 }, // For worsening detection (spike >= 0.10)
      moodAxes: {
        agency_control: -50, // <= -40
        future_expectancy: -30, // <= -25 (one of the OR conditions)
        engagement: 10, // >= 5
        arousal: 10,
        affiliation: 20, // <= 25 (satisfies affiliation OR condition)
      },
      previousMoodAxes: {
        agency_control: -35, // For agency drop detection
        affiliation: 25,
      },
    };

    // Failing context: hope too high (no bleak signals)
    const failingContext = {
      emotions: {
        frustration: 0.6,
        hope: 0.6, // > 0.10 - fails that OR branch
        despair: 0.1, // < 0.35 - fails that OR branch
        stress_acute: 0.4,
        rage: 0.1,
        numbness: 0.3,
        dissociation: 0.2,
        freeze: 0.1,
      },
      previousEmotions: { frustration: 0.45 },
      moodAxes: {
        agency_control: -50,
        future_expectancy: -10, // > -25 - fails that OR branch (all bleak signal OR conditions fail)
        engagement: 10,
        arousal: 10,
        affiliation: 20,
      },
      previousMoodAxes: {
        agency_control: -35,
        affiliation: 25,
      },
    };

    expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
    expect(jsonLogicService.evaluate(logic, failingContext)).toBe(false);
  });
});
