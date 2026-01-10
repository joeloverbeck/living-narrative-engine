/**
 * @file Integration tests for emotions-vigilance hypervigilant expression content.
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

const EXPRESSIONS_DIR = path.resolve('data/mods/emotions-vigilance/expressions');
const EXPRESSION_FILES = ['hypervigilant_scanning.expression.json'];

describe('Emotions-vigilance hypervigilant expressions', () => {
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

  it('validates vigilance expressions against the expression schema', () => {
    for (const expression of Object.values(expressionsById)) {
      const result = schemaValidator.validate(
        'schema://living-narrative-engine/expression.schema.json',
        expression
      );

      expect(result.isValid).toBe(true);
    }
  });

  it('all vigilance expressions have a valid {actor} placeholder', () => {
    for (const expression of Object.values(expressionsById)) {
      expect(expression.description_text).toContain('{actor}');
    }
  });

  describe('hypervigilant_scanning (with activation detection)', () => {
    it('requires high hypervigilance AND moderate fear with proper mood axes', () => {
      const expression = expressionsById['emotions-vigilance:hypervigilant_scanning'];
      const logic = expression.prerequisites[0].logic;

      // Production expression requires:
      // - hypervigilance >= 0.65, fear >= 0.45
      // - threat >= 30, arousal >= 20, engagement >= 15, agency_control >= -15
      // - dissociation < 0.35, panic <= 0.40, freeze < 0.20, numbness <= 0.55
      // - Activation: threshold crossing OR hypervigilance spike >= 0.15 OR threat spike >= 10
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
        moodAxes: { threat: 35, arousal: 25, engagement: 20, agency_control: -10 },
        previousMoodAxes: { threat: 20 },
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
        moodAxes: { threat: 35, arousal: 25, engagement: 20, agency_control: -10 },
        previousMoodAxes: { threat: 20 },
      };

      expect(jsonLogicService.evaluate(logic, passingContext)).toBe(true);
      expect(
        jsonLogicService.evaluate(logic, failingContextLowHypervigilance)
      ).toBe(false);
    });

    it('fails when fear is below threshold', () => {
      const expression = expressionsById['emotions-vigilance:hypervigilant_scanning'];
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
        moodAxes: { threat: 35, arousal: 25, engagement: 20, agency_control: -10 },
        previousMoodAxes: { threat: 20 },
      };

      expect(jsonLogicService.evaluate(logic, failingContextLowFear)).toBe(
        false
      );
    });

    it('passes at exact thresholds (0.65 hypervigilance, 0.45 fear)', () => {
      const expression = expressionsById['emotions-vigilance:hypervigilant_scanning'];
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
        previousEmotions: { hypervigilance: 0.50 }, // < 0.65 for threshold crossing
        moodAxes: { threat: 30, arousal: 20, engagement: 15, agency_control: -15 },
      };

      expect(jsonLogicService.evaluate(logic, exactThresholdContext)).toBe(
        true
      );
    });

    it('can activate via threat spike instead of threshold crossing', () => {
      const expression = expressionsById['emotions-vigilance:hypervigilant_scanning'];
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
        moodAxes: { threat: 40, arousal: 25, engagement: 20, agency_control: -10 },
        previousMoodAxes: { threat: 25 }, // Threat spike >= 10 (40 - 25 = 15)
      };

      expect(jsonLogicService.evaluate(logic, contextWithThreatSpike)).toBe(
        true
      );
    });
  });
});
