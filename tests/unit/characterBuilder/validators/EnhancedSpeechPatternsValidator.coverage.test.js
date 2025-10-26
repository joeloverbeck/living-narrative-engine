/**
 * @file Additional coverage-focused tests for EnhancedSpeechPatternsValidator
 * @description Exercises caching-specific behavior and delegation helpers that were previously uncovered
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { EnhancedSpeechPatternsValidator } from '../../../../src/characterBuilder/validators/EnhancedSpeechPatternsValidator.js';

const SPEECH_PATTERN_DETAIL_WARNING =
  'Character definition may need more detail for optimal speech pattern generation';

const createDependencies = () => ({
  schemaValidator: {
    validate: jest.fn().mockReturnValue({ isValid: true, errors: [] }),
    isSchemaLoaded: jest.fn().mockReturnValue(true),
    validateAndSanitizeResponse: jest
      .fn()
      .mockResolvedValue({ isValid: true, errors: [], sanitizedResponse: {} }),
  },
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
});

describe('EnhancedSpeechPatternsValidator additional coverage', () => {
  let validator;

  beforeEach(() => {
    validator = new EnhancedSpeechPatternsValidator(createDependencies());
  });

  it('adds the speech-pattern detail warning only once even when cached results are reused', async () => {
    const minimalCharacter = {
      components: {
        'core:name': { text: 'Echo' },
      },
    };

    const firstResult = await validator.validateInput(minimalCharacter, {
      includeQualityAssessment: true,
    });

    const firstWarnings = firstResult.warnings.filter(
      (warning) => warning === SPEECH_PATTERN_DETAIL_WARNING
    );
    expect(firstWarnings).toHaveLength(1);

    const cachedResult = await validator.validateInput(minimalCharacter, {
      includeQualityAssessment: true,
    });

    const cachedWarnings = cachedResult.warnings.filter(
      (warning) => warning === SPEECH_PATTERN_DETAIL_WARNING
    );
    expect(cachedWarnings).toHaveLength(1);
    expect(cachedResult).toBe(firstResult);
  });

  it('extracts character names directly from the underlying character definition', () => {
    const name = validator.extractCharacterName({
      components: {
        'core:name': { text: 'Iris Quinn' },
      },
    });

    expect(name).toBe('Iris Quinn');
  });

  it('clears validation caches and exposes stats through delegated helpers', () => {
    const initialStats = validator.getValidationStats();
    expect(initialStats).toEqual(
      expect.objectContaining({ cacheSize: expect.any(Number) })
    );

    validator.clearCache();

    const postClearStats = validator.getValidationStats();
    expect(postClearStats.cacheSize).toBe(0);
  });
});
