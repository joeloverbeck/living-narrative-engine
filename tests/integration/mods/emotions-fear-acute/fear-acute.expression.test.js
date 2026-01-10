/**
 * @file Integration tests for emotions-fear-acute panic expression content.
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

const EXPRESSIONS_DIR = path.resolve('data/mods/emotions-fear-acute/expressions');
const EXPRESSION_FILES = ['panic_onset.expression.json'];

describe('Emotions-fear-acute panic expressions', () => {
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

  it('validates panic expressions against the expression schema', () => {
    for (const expression of Object.values(expressionsById)) {
      const result = schemaValidator.validate(
        'schema://living-narrative-engine/expression.schema.json',
        expression
      );

      expect(result.isValid).toBe(true);
    }
  });

  it('all panic expressions have a valid {actor} placeholder', () => {
    for (const expression of Object.values(expressionsById)) {
      expect(expression.description_text).toContain('{actor}');
    }
  });

  describe('panic_onset delta detection', () => {
    it('requires panic threshold, mood axes gates, and activation trigger', () => {
      const expression = expressionsById['emotions-fear-acute:panic_onset'];
      const logic = expression.prerequisites[0].logic;

      // Production expression requires:
      // - panic >= 0.48
      // - threat >= 50, arousal >= 55, agency_control <= -12, valence <= -15, engagement >= 10
      // - freeze < 0.35, dissociation < 0.55
      // - Activation: panic delta >= 0.1 OR (previousPanic < 0.38 AND panic >= 0.48)
      //   OR agency drop >= 10 OR threat/arousal spike >= 15
      const passingContext = {
        emotions: { panic: 0.6, freeze: 0.1, dissociation: 0.2 },
        previousEmotions: { panic: 0.45 }, // delta = 0.15 triggers activation
        moodAxes: {
          threat: 55,
          arousal: 60,
          agency_control: -15,
          valence: -20,
          engagement: 15,
        },
        previousMoodAxes: {
          threat: 55,
          arousal: 60,
          agency_control: -15,
        },
      };

      // Failing: panic doesn't have activation trigger (no delta, no threshold cross, no agency drop)
      const failingContextNoIncrease = {
        emotions: { panic: 0.6, freeze: 0.1, dissociation: 0.2 },
        previousEmotions: { panic: 0.55 }, // previousPanic >= 0.38 and delta = 0.05 < 0.1
        moodAxes: {
          threat: 55,
          arousal: 60,
          agency_control: -15,
          valence: -20,
          engagement: 15,
        },
        previousMoodAxes: {
          threat: 55,
          arousal: 60,
          agency_control: -15, // No agency drop
        },
      };

      expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
      expect(jsonLogicService.evaluate(logic, failingContextNoIncrease)).toBe(
        false
      );
    });

    it('fails when panic is below threshold', () => {
      const expression = expressionsById['emotions-fear-acute:panic_onset'];
      const logic = expression.prerequisites[0].logic;

      // Panic must be >= 0.48
      const failingContextLowPanic = {
        emotions: { panic: 0.45, freeze: 0.1, dissociation: 0.2 }, // panic < 0.48
        previousEmotions: { panic: 0.2 },
        moodAxes: {
          threat: 55,
          arousal: 60,
          agency_control: -15,
          valence: -20,
          engagement: 15,
        },
        previousMoodAxes: {
          threat: 55,
          arousal: 60,
          agency_control: -15,
        },
      };

      expect(jsonLogicService.evaluate(logic, failingContextLowPanic)).toBe(
        false
      );
    });

    it('fails when threat is below the required threshold', () => {
      const expression = expressionsById['emotions-fear-acute:panic_onset'];
      const logic = expression.prerequisites[0].logic;

      const failingContextLowThreat = {
        emotions: { panic: 0.6, freeze: 0.1, dissociation: 0.2 },
        previousEmotions: { panic: 0.45 }, // delta = 0.15 would trigger activation
        moodAxes: {
          threat: 45, // below 50
          arousal: 60,
          agency_control: -15,
          valence: -20,
          engagement: 15,
        },
        previousMoodAxes: {
          threat: 45,
          arousal: 60,
          agency_control: -15,
        },
      };

      expect(jsonLogicService.evaluate(logic, failingContextLowThreat)).toBe(
        false
      );
    });

    it('passes at exact thresholds (panic 0.48, activation via threshold crossing)', () => {
      const expression = expressionsById['emotions-fear-acute:panic_onset'];
      const logic = expression.prerequisites[0].logic;

      // Exact thresholds: panic = 0.48, threat = 50, arousal = 55, agency_control = -12,
      //                   valence = -15, engagement = 10
      // Activation via threshold crossing: previousPanic < 0.38 AND panic >= 0.48
      const exactThresholdContext = {
        emotions: { panic: 0.48, freeze: 0.34, dissociation: 0.54 },
        previousEmotions: { panic: 0.37 }, // < 0.38, triggers threshold cross activation
        moodAxes: {
          threat: 50,
          arousal: 55,
          agency_control: -12,
          valence: -15,
          engagement: 10,
        },
        previousMoodAxes: {
          threat: 50,
          arousal: 55,
          agency_control: -12,
        },
      };

      expect(jsonLogicService.evaluate(logic, exactThresholdContext)).toBe(
        true
      );
    });
  });
});
