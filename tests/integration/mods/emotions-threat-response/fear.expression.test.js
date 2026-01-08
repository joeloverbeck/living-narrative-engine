/**
 * @file Integration tests for emotions-threat-response fear expression content.
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

const EXPRESSIONS_DIR = path.resolve('data/mods/emotions-threat-response/expressions');
const EXPRESSION_FILES = [
  'startle_flinch.expression.json',
  'panic_onset.expression.json',
  'hypervigilant_scanning.expression.json',
];

describe('Emotions-threat-response fear expressions', () => {
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
      const expression = expressionsById['emotions-threat-response:startle_flinch'];
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
      const expression = expressionsById['emotions-threat-response:startle_flinch'];
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
      const expression = expressionsById['emotions-threat-response:startle_flinch'];
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
    it('requires high panic as primary signal with terror/alarm support AND activation trigger', () => {
      const expression = expressionsById['emotions-threat-response:panic_onset'];
      const logic = expression.prerequisites[0].logic;

      // Production expression now requires:
      // - panic >= 0.62 (primary signal, not terror/alarm)
      // - OR block: terror >= 0.55 OR alarm >= 0.55 OR fear >= 0.65
      // - threat >= 40, arousal >= 35, agency_control <= -10
      // - numbness <= 0.45, freeze < 0.25
      // - Activation: panic delta >= 0.15 OR (previousPanic < 0.55 AND panic >= 0.62) OR agency drop >= 12
      const passingContext = {
        emotions: { panic: 0.75, terror: 0.6, alarm: 0.6, numbness: 0.2, freeze: 0.1 },
        previousEmotions: { panic: 0.5 }, // previousPanic < 0.55, panic >= 0.62 triggers activation
        moodAxes: {
          threat: 50,
          arousal: 45,
          agency_control: -15,
        },
        previousMoodAxes: {
          agency_control: -5,
        },
      };

      // Failing: panic doesn't have activation trigger (no delta, no threshold cross, no agency drop)
      const failingContextNoIncrease = {
        emotions: { panic: 0.75, terror: 0.6, alarm: 0.6, numbness: 0.2, freeze: 0.1 },
        previousEmotions: { panic: 0.65 }, // previousPanic > 0.55 and delta = 0.10 < 0.15
        moodAxes: {
          threat: 50,
          arousal: 45,
          agency_control: -15,
        },
        previousMoodAxes: {
          agency_control: -15, // No agency drop
        },
      };

      expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
      expect(jsonLogicService.evaluate(logic, failingContextNoIncrease)).toBe(
        false
      );
    });

    it('fails when panic is below threshold', () => {
      const expression = expressionsById['emotions-threat-response:panic_onset'];
      const logic = expression.prerequisites[0].logic;

      // Now panic is the primary signal (>= 0.62 required)
      const failingContextLowPanic = {
        emotions: { panic: 0.5, terror: 0.7, alarm: 0.6, numbness: 0.2, freeze: 0.1 }, // panic < 0.62
        previousEmotions: { panic: 0.3 },
        moodAxes: {
          threat: 50,
          arousal: 45,
          agency_control: -15,
        },
      };

      expect(jsonLogicService.evaluate(logic, failingContextLowPanic)).toBe(
        false
      );
    });

    it('fails when none of terror/alarm/fear meet their thresholds', () => {
      const expression = expressionsById['emotions-threat-response:panic_onset'];
      const logic = expression.prerequisites[0].logic;

      // OR block requires: terror >= 0.55 OR alarm >= 0.55 OR fear >= 0.65
      const failingContextLowSupport = {
        emotions: { panic: 0.75, terror: 0.4, alarm: 0.4, fear: 0.5, numbness: 0.2, freeze: 0.1 },
        previousEmotions: { panic: 0.5 },
        moodAxes: {
          threat: 50,
          arousal: 45,
          agency_control: -15,
        },
      };

      expect(jsonLogicService.evaluate(logic, failingContextLowSupport)).toBe(
        false
      );
    });

    it('passes at exact thresholds (0.62 panic, 0.55 terror, threshold cross activation)', () => {
      const expression = expressionsById['emotions-threat-response:panic_onset'];
      const logic = expression.prerequisites[0].logic;

      // Exact thresholds: panic = 0.62, terror = 0.55, threat = 40, arousal = 35, agency_control = -10
      // Activation via threshold crossing: previousPanic < 0.55 AND panic >= 0.62
      const exactThresholdContext = {
        emotions: { panic: 0.62, terror: 0.55, alarm: 0.55, numbness: 0.45, freeze: 0.24 },
        previousEmotions: { panic: 0.54 }, // < 0.55, triggers threshold cross activation
        moodAxes: {
          threat: 40,
          arousal: 35,
          agency_control: -10,
        },
      };

      expect(jsonLogicService.evaluate(logic, exactThresholdContext)).toBe(
        true
      );
    });
  });

  describe('hypervigilant_scanning (with activation detection)', () => {
    it('requires high hypervigilance AND moderate fear with proper mood axes', () => {
      const expression = expressionsById['emotions-threat-response:hypervigilant_scanning'];
      const logic = expression.prerequisites[0].logic;

      // Production expression now requires:
      // - hypervigilance >= 0.65, fear >= 0.45
      // - threat >= 20, engagement >= 15, agency_control >= -15
      // - dissociation < 0.35, panic <= 0.40, freeze < 0.20, numbness <= 0.55
      // - Activation: threshold crossing OR hypervigilance spike OR threat spike
      const passingContext = {
        emotions: {
          hypervigilance: 0.7,
          fear: 0.5,
          numbness: 0.3,
          dissociation: 0.2,
          panic: 0.2,
          freeze: 0.1,
        },
        previousEmotions: { hypervigilance: 0.5 }, // < 0.65 for threshold crossing
        moodAxes: { threat: 25, engagement: 20, agency_control: -10 },
        previousMoodAxes: { threat: 10 },
      };

      const failingContextLowHypervigilance = {
        emotions: {
          hypervigilance: 0.5, // < 0.65
          fear: 0.5,
          numbness: 0.3,
          dissociation: 0.2,
          panic: 0.2,
          freeze: 0.1,
        },
        previousEmotions: { hypervigilance: 0.3 },
        moodAxes: { threat: 25, engagement: 20, agency_control: -10 },
        previousMoodAxes: { threat: 10 },
      };

      expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
      expect(
        jsonLogicService.evaluate(logic, failingContextLowHypervigilance)
      ).toBe(false);
    });

    it('fails when fear is below threshold', () => {
      const expression = expressionsById['emotions-threat-response:hypervigilant_scanning'];
      const logic = expression.prerequisites[0].logic;

      const failingContextLowFear = {
        emotions: {
          hypervigilance: 0.7,
          fear: 0.3, // < 0.45
          numbness: 0.3,
          dissociation: 0.2,
          panic: 0.2,
          freeze: 0.1,
        },
        previousEmotions: { hypervigilance: 0.5 },
        moodAxes: { threat: 25, engagement: 20, agency_control: -10 },
        previousMoodAxes: { threat: 10 },
      };

      expect(jsonLogicService.evaluate(logic, failingContextLowFear)).toBe(
        false
      );
    });

    it('passes at exact thresholds (0.65 hypervigilance, 0.45 fear)', () => {
      const expression = expressionsById['emotions-threat-response:hypervigilant_scanning'];
      const logic = expression.prerequisites[0].logic;

      // Exact thresholds for all requirements
      const exactThresholdContext = {
        emotions: {
          hypervigilance: 0.65,
          fear: 0.45,
          numbness: 0.55,
          dissociation: 0.34, // < 0.35
          panic: 0.40, // <= 0.40
          freeze: 0.19, // < 0.20
        },
        previousEmotions: { hypervigilance: 0.45 }, // < 0.65 for threshold crossing
        moodAxes: { threat: 20, engagement: 15, agency_control: -15 },
      };

      expect(jsonLogicService.evaluate(logic, exactThresholdContext)).toBe(
        true
      );
    });

    it('can activate via threat spike instead of threshold crossing', () => {
      const expression = expressionsById['emotions-threat-response:hypervigilant_scanning'];
      const logic = expression.prerequisites[0].logic;

      // Already above threshold, but threat spike activates it
      // Must include all required emotion constraints
      const contextWithThreatSpike = {
        emotions: {
          hypervigilance: 0.7,
          fear: 0.5,
          numbness: 0.3,
          dissociation: 0.2,
          panic: 0.2,
          freeze: 0.1,
        },
        previousEmotions: { hypervigilance: 0.7 }, // No threshold crossing
        moodAxes: { threat: 35, engagement: 20, agency_control: -10 },
        previousMoodAxes: { threat: 20 }, // Threat spike >= 10
      };

      expect(jsonLogicService.evaluate(logic, contextWithThreatSpike)).toBe(
        true
      );
    });
  });
});
