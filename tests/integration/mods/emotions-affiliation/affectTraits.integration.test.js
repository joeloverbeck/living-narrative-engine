/**
 * @file Integration tests for affect traits with emotions-affiliation expressions.
 * Tests the complete pipeline: expression file loading → JSON Logic evaluation with emotion contexts.
 *
 * Note: Unit tests for sociopath scenario, emotion prototype gates,
 * and serialization are already covered in:
 * - tests/unit/emotions/emotionCalculatorService.affectTraits.test.js
 * - tests/unit/mods/core/lookups/emotionPrototypes.lookup.test.js
 */

import { beforeAll, describe, expect, it } from '@jest/globals';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import JsonLogicEvaluationService from '../../../../src/logic/jsonLogicEvaluationService.js';
import ConsoleLogger from '../../../../src/logging/consoleLogger.js';

const EXPRESSIONS_DIR = path.resolve(
  'data/mods/emotions-affiliation/expressions'
);

// Expression files that require compassion emotion (trait-gated)
const COMPASSION_EXPRESSIONS = [
  'compassionate_concern.expression.json',
  'tearful_gratitude.expression.json',
  'warm_affection.expression.json',
];

describe('Affect Traits Integration - Emotions Affiliation Expressions', () => {
  let expressionsById;
  let jsonLogicService;
  let logger;

  beforeAll(async () => {
    logger = new ConsoleLogger('ERROR');
    jsonLogicService = new JsonLogicEvaluationService({ logger });

    // Load actual expression files from mod
    const expressions = await Promise.all(
      COMPASSION_EXPRESSIONS.map(async (file) => {
        const filePath = path.join(EXPRESSIONS_DIR, file);
        const data = await readFile(filePath, { encoding: 'utf-8' });
        return JSON.parse(data);
      })
    );

    expressionsById = Object.fromEntries(
      expressions.map((expression) => [expression.id, expression])
    );
  });

  describe('Expression File Loading', () => {
    it('loads compassionate_concern expression with valid structure', () => {
      const expression =
        expressionsById['emotions-affiliation:compassionate_concern'];
      expect(expression).toBeDefined();
      expect(expression.id).toBe('emotions-affiliation:compassionate_concern');
      expect(expression.prerequisites).toBeDefined();
      expect(Array.isArray(expression.prerequisites)).toBe(true);
      expect(expression.prerequisites.length).toBeGreaterThan(0);
    });

    it('loads tearful_gratitude expression with valid structure', () => {
      const expression =
        expressionsById['emotions-affiliation:tearful_gratitude'];
      expect(expression).toBeDefined();
      expect(expression.prerequisites).toBeDefined();
      expect(expression.prerequisites.length).toBeGreaterThan(0);
    });

    it('loads warm_affection expression with valid structure', () => {
      const expression = expressionsById['emotions-affiliation:warm_affection'];
      expect(expression).toBeDefined();
      expect(expression.prerequisites).toBeDefined();
      expect(expression.prerequisites.length).toBeGreaterThan(0);
    });
  });

  describe('Expression Prerequisite Evaluation with Emotion Contexts', () => {
    describe('compassionate_concern expression', () => {
      it('first prerequisite fails when compassion is zero (blocked by trait gate)', () => {
        const expression =
          expressionsById['emotions-affiliation:compassionate_concern'];
        const logic = expression.prerequisites[0].logic;

        // Context where compassion is zero (sociopath scenario - emotion blocked by trait gate)
        const failingContext = {
          emotions: {
            compassion: 0, // Blocked by low affective_empathy trait
            empathic_distress: 0,
            apathy: 0.1,
            numbness: 0.1,
            terror: 0.1,
            rage: 0.1,
            hatred: 0.1,
            disgust: 0.1,
            contempt: 0.1,
            panic: 0.1,
          },
          previousEmotions: { compassion: 0 },
          moodAxes: {
            affiliation: 20,
            threat: 30,
            agency_control: 10,
          },
        };

        const result = jsonLogicService.evaluate(logic, failingContext);
        expect(result).toBe(false);
      });

      it('second prerequisite (rise detection) passes with significant compassion increase', () => {
        const expression =
          expressionsById['emotions-affiliation:compassionate_concern'];
        const logic = expression.prerequisites[1].logic;

        // Context with compassion rise >= 0.07
        const risingContext = {
          emotions: { compassion: 0.45 },
          previousEmotions: { compassion: 0.3 }, // Rise of 0.15
        };

        const result = jsonLogicService.evaluate(logic, risingContext);
        expect(result).toBe(true);
      });

      it('second prerequisite fails with low compassion and no rise', () => {
        const expression =
          expressionsById['emotions-affiliation:compassionate_concern'];
        const logic = expression.prerequisites[1].logic;

        // Context with low compassion and no significant rise
        const stableContext = {
          emotions: { compassion: 0.3 },
          previousEmotions: { compassion: 0.28 }, // Rise of only 0.02
        };

        const result = jsonLogicService.evaluate(logic, stableContext);
        expect(result).toBe(false);
      });
    });
  });

  describe('All Expression Files Have Valid Schema Reference', () => {
    it('all loaded expressions have correct $schema', () => {
      for (const expression of Object.values(expressionsById)) {
        expect(expression.$schema).toBe(
          'schema://living-narrative-engine/expression.schema.json'
        );
      }
    });

    it('all loaded expressions have {actor} placeholder in description_text', () => {
      for (const expression of Object.values(expressionsById)) {
        expect(expression.description_text).toContain('{actor}');
      }
    });
  });
});
