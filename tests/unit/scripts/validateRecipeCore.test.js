/**
 * @file Unit tests for validateRecipeCore.js
 * @description Tests CLI logic without process spawning or mod loading
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateCliArgs,
  calculateSummaryStats,
  formatJsonOutput,
  determineExitCode,
  formatErrorResult,
} from '../../../scripts/validateRecipeCore.js';

describe('validateRecipeCore', () => {
  describe('validateCliArgs', () => {
    it('should return error when no recipes provided', () => {
      const result = validateCliArgs([]);

      expect(result.exitCode).toBe(1);
      expect(result.isValid).toBe(false);
      expect(result.errorType).toBe('NO_RECIPES_PROVIDED');
    });

    it('should return error when recipes is null', () => {
      const result = validateCliArgs(null);

      expect(result.exitCode).toBe(1);
      expect(result.isValid).toBe(false);
    });

    it('should return error when recipes is undefined', () => {
      const result = validateCliArgs(undefined);

      expect(result.exitCode).toBe(1);
      expect(result.isValid).toBe(false);
    });

    it('should return success when recipes provided', () => {
      const result = validateCliArgs(['recipe1.json']);

      expect(result.exitCode).toBe(0);
      expect(result.isValid).toBe(true);
    });

    it('should return success when multiple recipes provided', () => {
      const result = validateCliArgs(['recipe1.json', 'recipe2.json']);

      expect(result.exitCode).toBe(0);
      expect(result.isValid).toBe(true);
    });
  });

  describe('calculateSummaryStats', () => {
    it('should calculate stats for single valid recipe', () => {
      const results = [
        { isValid: true, errors: [], warnings: [], suggestions: [] },
      ];

      const stats = calculateSummaryStats(results);

      expect(stats.totalRecipes).toBe(1);
      expect(stats.validRecipes).toBe(1);
      expect(stats.invalidRecipes).toBe(0);
      expect(stats.totalErrors).toBe(0);
      expect(stats.totalWarnings).toBe(0);
      expect(stats.totalSuggestions).toBe(0);
    });

    it('should calculate stats for multiple recipes', () => {
      const results = [
        { isValid: true, errors: [], warnings: [], suggestions: [] },
        { isValid: false, errors: [{ message: 'error' }], warnings: [], suggestions: [] },
      ];

      const stats = calculateSummaryStats(results);

      expect(stats.totalRecipes).toBe(2);
      expect(stats.validRecipes).toBe(1);
      expect(stats.invalidRecipes).toBe(1);
      expect(stats.totalErrors).toBe(1);
    });

    it('should count errors, warnings, and suggestions correctly', () => {
      const results = [
        {
          isValid: false,
          errors: [{ message: 'error1' }, { message: 'error2' }],
          warnings: [{ message: 'warn1' }],
          suggestions: [{ message: 'suggest1' }],
        },
        {
          isValid: true,
          errors: [],
          warnings: [{ message: 'warn2' }],
          suggestions: [],
        },
      ];

      const stats = calculateSummaryStats(results);

      expect(stats.totalErrors).toBe(2);
      expect(stats.totalWarnings).toBe(2);
      expect(stats.totalSuggestions).toBe(1);
    });
  });

  describe('formatJsonOutput', () => {
    it('should format validation report as JSON', () => {
      const mockReport = {
        toJSON: () => ({
          recipeId: 'test:recipe',
          recipePath: 'test.json',
          errors: [],
          warnings: [],
          suggestions: [],
          passed: true,
        }),
      };

      const json = formatJsonOutput(mockReport);

      expect(json).toContain('"recipeId"');
      expect(json).toContain('"recipePath"');
      expect(json).toContain('"errors"');
      expect(json).toContain('"warnings"');
      expect(json).toContain('"suggestions"');
      expect(json).toContain('test:recipe');
    });

    it('should produce valid JSON', () => {
      const mockReport = {
        toJSON: () => ({
          recipeId: 'anatomy:human',
          recipePath: 'data/mods/anatomy/recipes/human.recipe.json',
          errors: [{ message: 'Test error' }],
          warnings: [],
          suggestions: [],
          passed: false,
        }),
      };

      const json = formatJsonOutput(mockReport);
      const parsed = JSON.parse(json);

      expect(parsed.recipeId).toBe('anatomy:human');
      expect(parsed.errors).toHaveLength(1);
      expect(parsed.errors[0].message).toBe('Test error');
    });
  });

  describe('determineExitCode', () => {
    it('should return exit code 0 for all valid recipes', () => {
      const results = [
        { isValid: true, errors: [], warnings: [] },
        { isValid: true, errors: [], warnings: [] },
      ];

      const exitResult = determineExitCode(results);

      expect(exitResult.exitCode).toBe(0);
      expect(exitResult.passed).toBe(true);
      expect(exitResult.totalRecipes).toBe(2);
      expect(exitResult.totalErrors).toBe(0);
    });

    it('should return exit code 1 when errors present', () => {
      const results = [
        { isValid: false, errors: [{ message: 'error' }], warnings: [] },
      ];

      const exitResult = determineExitCode(results);

      expect(exitResult.exitCode).toBe(1);
      expect(exitResult.passed).toBe(false);
      expect(exitResult.totalErrors).toBe(1);
    });

    it('should count total errors from multiple recipes', () => {
      const results = [
        { isValid: false, errors: [{ message: 'error1' }], warnings: [] },
        { isValid: false, errors: [{ message: 'error2' }, { message: 'error3' }], warnings: [] },
      ];

      const exitResult = determineExitCode(results);

      expect(exitResult.exitCode).toBe(1);
      expect(exitResult.totalErrors).toBe(3);
    });

    it('should count warnings even when validation passes', () => {
      const results = [
        { isValid: true, errors: [], warnings: [{ message: 'warn1' }] },
        { isValid: true, errors: [], warnings: [{ message: 'warn2' }] },
      ];

      const exitResult = determineExitCode(results);

      expect(exitResult.exitCode).toBe(0);
      expect(exitResult.passed).toBe(true);
      expect(exitResult.totalWarnings).toBe(2);
    });

    it('should handle mixed success and failure', () => {
      const results = [
        { isValid: true, errors: [], warnings: [] },
        { isValid: false, errors: [{ message: 'error' }], warnings: [{ message: 'warn' }] },
      ];

      const exitResult = determineExitCode(results);

      expect(exitResult.exitCode).toBe(1);
      expect(exitResult.passed).toBe(false);
      expect(exitResult.totalErrors).toBe(1);
      expect(exitResult.totalWarnings).toBe(1);
    });
  });

  describe('formatErrorResult', () => {
    it('should format error result with message', () => {
      const error = new Error('Test error message');
      const recipePath = 'test/recipe.json';

      const result = formatErrorResult(recipePath, error);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Test error message');
      expect(result.warnings).toEqual([]);
      expect(result.suggestions).toEqual([]);
      expect(result.recipePath).toBe(recipePath);
    });

    it('should include recipePath in result', () => {
      const error = new Error('File not found');
      const recipePath = 'data/mods/anatomy/recipes/nonexistent.json';

      const result = formatErrorResult(recipePath, error);

      expect(result.recipePath).toBe(recipePath);
    });

    it('should handle errors with complex messages', () => {
      const error = new Error('Failed to load recipe file: ENOENT: no such file or directory');
      const recipePath = 'invalid/path.json';

      const result = formatErrorResult(recipePath, error);

      expect(result.errors[0].message).toContain('ENOENT');
    });
  });
});
