/**
 * @file Integration tests for emotions-surprise startle expression content.
 */

import { beforeAll, describe, expect, it } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import StaticConfiguration from '../../../../src/configuration/staticConfiguration.js';
import DefaultPathResolver from '../../../../src/pathing/defaultPathResolver.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
import SchemaLoader from '../../../../src/loaders/schemaLoader.js';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';

const EXPRESSIONS_DIR = path.resolve('data/mods/emotions-surprise/expressions');
const EXPRESSION_FILES = ['startle_flinch.expression.json'];

describe('Emotions-surprise startle expressions', () => {
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

  it('validates startle expressions against the expression schema', () => {
    for (const expression of Object.values(expressionsById)) {
      const result = schemaValidator.validate(
        'schema://living-narrative-engine/expression.schema.json',
        expression
      );

      expect(result.isValid).toBe(true);
    }
  });

  it('all startle expressions have a valid {actor} placeholder', () => {
    for (const expression of Object.values(expressionsById)) {
      expect(expression.description_text).toContain('{actor}');
    }
  });

  describe('startle_flinch delta detection', () => {
    it('requires surprise_startle >= 0.45 AND activation trigger (delta >= 0.12)', () => {
      const expression = expressionsById['emotions-surprise:startle_flinch'];
      const logic = expression.prerequisites[0].logic;

      // Requires: surprise_startle >= 0.45, max(alarm, fear) >= 0.15 OR threat >= 10
      // Activation: delta >= 0.12 OR arousal spike >= 15 OR threat spike >= 12
      const passingContext = {
        emotions: { surprise_startle: 0.6, alarm: 0.2 }, // alarm >= 0.15
        previousEmotions: { surprise_startle: 0.4 }, // delta = 0.2 >= 0.12
      };

      const failingContextLowDelta = {
        emotions: { surprise_startle: 0.6, alarm: 0.2 },
        previousEmotions: { surprise_startle: 0.55 }, // delta = 0.05 < 0.12
        moodAxes: {},
        previousMoodAxes: {},
      };

      expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
      expect(jsonLogicService.evaluate(logic, failingContextLowDelta)).toBe(
        false
      );
    });

    it('fails when surprise_startle is below threshold even with high delta', () => {
      const expression = expressionsById['emotions-surprise:startle_flinch'];
      const logic = expression.prerequisites[0].logic;

      const failingContextLowEmotion = {
        emotions: { surprise_startle: 0.4, alarm: 0.3 }, // surprise_startle < 0.45
        previousEmotions: { surprise_startle: 0.1 },
      };

      expect(jsonLogicService.evaluate(logic, failingContextLowEmotion)).toBe(
        false
      );
    });

    it('passes at exact thresholds (0.45 emotion, 0.12 delta)', () => {
      const expression = expressionsById['emotions-surprise:startle_flinch'];
      const logic = expression.prerequisites[0].logic;

      const exactThresholdContext = {
        emotions: { surprise_startle: 0.45, fear: 0.15 }, // fear >= 0.15
        previousEmotions: { surprise_startle: 0.33 }, // delta = 0.12
      };

      expect(jsonLogicService.evaluate(logic, exactThresholdContext)).toBe(
        true
      );
    });
  });
});
