import { describe, it, expect, jest } from '@jest/globals';
import { normalizeValidationResult } from '../../../../../src/anatomy/validation/utils/validationResultNormalizer.js';

const createLogger = () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
});

describe('normalizeValidationResult', () => {
  it('injects synthetic error when pipeline result is missing', () => {
    const logger = createLogger();
    const monitoringCoordinator = { incrementValidationPipelineHealth: jest.fn() };
    const recipe = { recipeId: 'anatomy:test_recipe' };

    const normalized = normalizeValidationResult(recipe, undefined, logger, {
      validatorCount: 11,
      monitoringCoordinator,
    });

    expect(normalized.errors).toHaveLength(1);
    expect(normalized.errors[0]).toMatchObject({
      type: 'VALIDATION_ERROR',
      severity: 'error',
    });
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('ValidationPipeline returned no payload for anatomy:test_recipe')
    );
    expect(logger.error).toHaveBeenCalledWith('ValidationPipeline:invalid_result', {
      recipeId: 'anatomy:test_recipe',
      validatorCount: 11,
      issue: 'missing_payload',
    });
    expect(monitoringCoordinator.incrementValidationPipelineHealth).toHaveBeenCalledWith(
      'missing_payload'
    );
  });

  it('applies defaults for missing arrays and logs debug diagnostics', () => {
    const logger = createLogger();
    const monitoringCoordinator = { incrementValidationPipelineHealth: jest.fn() };
    const recipe = { recipeId: 'anatomy:test_recipe', recipePath: 'foo.json' };

    const normalized = normalizeValidationResult(
      recipe,
      {
        recipeId: 'anatomy:test_recipe',
        errors: [{ type: 'ERR', severity: 'error' }],
      },
      logger,
      { monitoringCoordinator }
    );

    expect(normalized.warnings).toEqual([]);
    expect(normalized.suggestions).toEqual([]);
    expect(normalized.passed).toEqual([]);
    expect(normalized.isValid).toBe(false);
    expect(logger.debug).toHaveBeenCalledWith(
      'ValidationPipeline: normalized missing fields',
      expect.objectContaining({
        recipeId: 'anatomy:test_recipe',
        defaultsApplied: expect.arrayContaining(['warnings', 'suggestions', 'passed', 'isValid']),
      })
    );
    expect(logger.warn).toHaveBeenCalledWith('ValidationPipeline:invalid_result', {
      recipeId: 'anatomy:test_recipe',
      validatorCount: 0,
      issue: 'missing_fields',
      fields: expect.arrayContaining(['warnings', 'suggestions', 'passed', 'isValid']),
    });
    expect(monitoringCoordinator.incrementValidationPipelineHealth).toHaveBeenCalledWith(
      'missing_fields'
    );
  });

  it('returns frozen payloads even when source is frozen', () => {
    const logger = createLogger();
    const source = Object.freeze({
      recipeId: 'anatomy:test_recipe',
      recipePath: 'foo.json',
      timestamp: '2024-01-01T00:00:00.000Z',
      errors: [],
      warnings: [],
      suggestions: [],
      passed: [],
      isValid: true,
    });

    const normalized = normalizeValidationResult({ recipeId: 'anatomy:test_recipe' }, source, logger);

    expect(Object.isFrozen(normalized)).toBe(true);
    expect(normalized).not.toBe(source);
    expect(normalized.isValid).toBe(true);
  });
});
