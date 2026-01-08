/**
 * @file Integration tests for emotions fear expression content.
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
  'startle_flinch.expression.json',
  'panic_onset.expression.json',
  'hypervigilant_scanning.expression.json',
];

describe('Emotions fear expressions', () => {
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

  it('validates fear expressions against the expression schema', () => {
    for (const expression of Object.values(expressionsById)) {
      const result = schemaValidator.validate(
        'schema://living-narrative-engine/expression.schema.json',
        expression
      );

      expect(result.isValid).toBe(true);
    }
  });

  it('all fear expressions have a valid {actor} placeholder', () => {
    for (const expression of Object.values(expressionsById)) {
      expect(expression.description_text).toContain('{actor}');
    }
  });

  describe('startle_flinch delta detection', () => {
    it('requires high surprise_startle AND rapid increase (delta >= 0.25)', () => {
      const expression = expressionsById['emotions:startle_flinch'];
      const logic = expression.prerequisites[0].logic;

      // Now also requires max(alarm, fear) >= 0.20
      const passingContext = {
        emotions: { surprise_startle: 0.6, alarm: 0.3 }, // alarm >= 0.20
        previousEmotions: { surprise_startle: 0.3 },
      };

      const failingContextLowDelta = {
        emotions: { surprise_startle: 0.6, alarm: 0.3 },
        previousEmotions: { surprise_startle: 0.5 }, // delta = 0.1 < 0.25
      };

      expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
      expect(jsonLogicService.evaluate(logic, failingContextLowDelta)).toBe(
        false
      );
    });

    it('fails when surprise_startle is below threshold even with high delta', () => {
      const expression = expressionsById['emotions:startle_flinch'];
      const logic = expression.prerequisites[0].logic;

      const failingContextLowEmotion = {
        emotions: { surprise_startle: 0.4, alarm: 0.3 }, // surprise_startle < 0.55
        previousEmotions: { surprise_startle: 0.1 },
      };

      expect(jsonLogicService.evaluate(logic, failingContextLowEmotion)).toBe(
        false
      );
    });

    it('passes at exact thresholds (0.55 emotion, 0.25 delta)', () => {
      const expression = expressionsById['emotions:startle_flinch'];
      const logic = expression.prerequisites[0].logic;

      const exactThresholdContext = {
        emotions: { surprise_startle: 0.55, fear: 0.25 }, // fear >= 0.20
        previousEmotions: { surprise_startle: 0.3 },
      };

      expect(jsonLogicService.evaluate(logic, exactThresholdContext)).toBe(
        true
      );
    });
  });

  describe('panic_onset delta detection', () => {
    it('requires high terror, high alarm, AND rapid terror increase', () => {
      const expression = expressionsById['emotions:panic_onset'];
      const logic = expression.prerequisites[0].logic;

      // Now also requires: threat >= 30, arousal >= 25, agency_control <= -5, numbness <= 0.45
      const passingContext = {
        emotions: { terror: 0.7, alarm: 0.6, numbness: 0.2 },
        previousEmotions: { terror: 0.4 },
        moodAxes: {
          threat: 35,
          arousal: 30,
          agency_control: -10,
        },
      };

      const failingContextNoIncrease = {
        emotions: { terror: 0.7, alarm: 0.6, numbness: 0.2 },
        previousEmotions: { terror: 0.6 }, // delta = 0.1 < 0.20
        moodAxes: {
          threat: 35,
          arousal: 30,
          agency_control: -10,
        },
      };

      expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
      expect(jsonLogicService.evaluate(logic, failingContextNoIncrease)).toBe(
        false
      );
    });

    it('fails when alarm is below threshold', () => {
      const expression = expressionsById['emotions:panic_onset'];
      const logic = expression.prerequisites[0].logic;

      const failingContextLowAlarm = {
        emotions: { terror: 0.7, alarm: 0.4, numbness: 0.2 }, // alarm < 0.55
        previousEmotions: { terror: 0.4 },
        moodAxes: {
          threat: 35,
          arousal: 30,
          agency_control: -10,
        },
      };

      expect(jsonLogicService.evaluate(logic, failingContextLowAlarm)).toBe(
        false
      );
    });

    it('fails when terror is below threshold', () => {
      const expression = expressionsById['emotions:panic_onset'];
      const logic = expression.prerequisites[0].logic;

      const failingContextLowTerror = {
        emotions: { terror: 0.4, alarm: 0.6, numbness: 0.2 }, // terror < 0.55
        previousEmotions: { terror: 0.1 },
        moodAxes: {
          threat: 35,
          arousal: 30,
          agency_control: -10,
        },
      };

      expect(jsonLogicService.evaluate(logic, failingContextLowTerror)).toBe(
        false
      );
    });

    it('passes at exact thresholds (0.55 terror, 0.55 alarm, 0.20 delta)', () => {
      const expression = expressionsById['emotions:panic_onset'];
      const logic = expression.prerequisites[0].logic;

      const exactThresholdContext = {
        emotions: { terror: 0.55, alarm: 0.55, numbness: 0.4 },
        previousEmotions: { terror: 0.35 },
        moodAxes: {
          threat: 30,
          arousal: 25,
          agency_control: -5,
        },
      };

      expect(jsonLogicService.evaluate(logic, exactThresholdContext)).toBe(
        true
      );
    });
  });

  describe('hypervigilant_scanning (with activation detection)', () => {
    it('requires high hypervigilance AND moderate fear', () => {
      const expression = expressionsById['emotions:hypervigilant_scanning'];
      const logic = expression.prerequisites[0].logic;

      // Now requires: threat >= 20, numbness <= 0.55, plus activation
      // Activation can be: threshold crossing, hypervigilance spike, or threat spike
      const passingContext = {
        emotions: { hypervigilance: 0.7, fear: 0.5, numbness: 0.3 },
        previousEmotions: { hypervigilance: 0.5 }, // < 0.65 for threshold crossing
        moodAxes: { threat: 25 },
        previousMoodAxes: { threat: 10 },
      };

      const failingContextLowHypervigilance = {
        emotions: { hypervigilance: 0.5, fear: 0.5, numbness: 0.3 }, // < 0.65
        previousEmotions: { hypervigilance: 0.3 },
        moodAxes: { threat: 25 },
        previousMoodAxes: { threat: 10 },
      };

      expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
      expect(
        jsonLogicService.evaluate(logic, failingContextLowHypervigilance)
      ).toBe(false);
    });

    it('fails when fear is below threshold', () => {
      const expression = expressionsById['emotions:hypervigilant_scanning'];
      const logic = expression.prerequisites[0].logic;

      const failingContextLowFear = {
        emotions: { hypervigilance: 0.7, fear: 0.3, numbness: 0.3 }, // fear < 0.45
        previousEmotions: { hypervigilance: 0.5 },
        moodAxes: { threat: 25 },
        previousMoodAxes: { threat: 10 },
      };

      expect(jsonLogicService.evaluate(logic, failingContextLowFear)).toBe(
        false
      );
    });

    it('passes at exact thresholds (0.65 hypervigilance, 0.45 fear)', () => {
      const expression = expressionsById['emotions:hypervigilant_scanning'];
      const logic = expression.prerequisites[0].logic;

      const exactThresholdContext = {
        emotions: { hypervigilance: 0.65, fear: 0.45, numbness: 0.5 },
        previousEmotions: { hypervigilance: 0.45 }, // < 0.65 for threshold crossing
        moodAxes: { threat: 20 },
      };

      expect(jsonLogicService.evaluate(logic, exactThresholdContext)).toBe(
        true
      );
    });

    it('can activate via threat spike instead of threshold crossing', () => {
      const expression = expressionsById['emotions:hypervigilant_scanning'];
      const logic = expression.prerequisites[0].logic;

      // Already above threshold, but threat spike activates it
      const contextWithThreatSpike = {
        emotions: { hypervigilance: 0.7, fear: 0.5, numbness: 0.3 },
        previousEmotions: { hypervigilance: 0.7 }, // No threshold crossing
        moodAxes: { threat: 35 },
        previousMoodAxes: { threat: 20 }, // Threat spike >= 10
      };

      expect(jsonLogicService.evaluate(logic, contextWithThreatSpike)).toBe(
        true
      );
    });
  });
});
