/**
 * @file Integration tests for validate-recipe.js CLI tool
 * @description Tests CLI execution scenarios with actual recipe files
 */

import { describe, it, expect } from '@jest/globals';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../../..');
const scriptPath = path.join(projectRoot, 'scripts/validate-recipe.js');

/**
 * Execute the CLI and return results
 *
 * @param {Array<string>} args - CLI arguments
 * @returns {object} Execution results with stdout, stderr, exitCode
 */
function executeCLI(args) {
  try {
    const stdout = execSync(`node ${scriptPath} ${args.join(' ')}`, {
      cwd: projectRoot,
      encoding: 'utf-8',
      stdio: 'pipe',
    });

    return {
      stdout,
      stderr: '',
      exitCode: 0,
    };
  } catch (error) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.status || 1,
    };
  }
}

describe('validate-recipe CLI integration tests', () => {
  describe('Basic execution', () => {
    it('should exit with error when no recipe files are specified', () => {
      const result = executeCLI([]);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('Usage: npm run validate:recipe');
    });

    it('should validate a single recipe file', () => {
      const recipePath = 'data/mods/anatomy/recipes/human_male.recipe.json';
      const result = executeCLI([recipePath]);

      // With empty registry (Phase 1), we expect validation errors
      // but the tool should execute successfully
      expect(result.stdout).toContain('Validating');
      expect(result.stdout).toContain('Validation Report');
      expect(result.stdout).toContain('anatomy:human_male');
    });

    it('should validate multiple recipe files', () => {
      const recipePaths = [
        'data/mods/anatomy/recipes/human_male.recipe.json',
        'data/mods/anatomy/recipes/human_female.recipe.json',
      ];
      const result = executeCLI(recipePaths);

      expect(result.stdout).toContain('anatomy:human_male');
      expect(result.stdout).toContain('anatomy:human_female');
      expect(result.stdout).toContain('VALIDATION SUMMARY');
      expect(result.stdout).toContain('Recipes Validated: 2');
    });

    it('should complete validation in under 5 seconds', () => {
      const recipePath = 'data/mods/anatomy/recipes/red_dragon.recipe.json';
      const startTime = Date.now();

      executeCLI([recipePath]);

      const duration = Date.now() - startTime;

      // Should be much faster than 5 seconds, but allow some margin
      expect(duration).toBeLessThan(5000);
    });
  });

  describe('JSON output', () => {
    it('should output valid JSON with --json flag', () => {
      const recipePath = 'data/mods/anatomy/recipes/human_male.recipe.json';
      const result = executeCLI(['--json', recipePath]);

      // Extract JSON from output (ignore warnings)
      const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);
      expect(jsonMatch).not.toBeNull();

      const jsonOutput = JSON.parse(jsonMatch[0]);

      expect(jsonOutput).toHaveProperty('recipeId');
      expect(jsonOutput).toHaveProperty('recipePath');
      expect(jsonOutput).toHaveProperty('timestamp');
      expect(jsonOutput).toHaveProperty('errors');
      expect(jsonOutput).toHaveProperty('warnings');
      expect(jsonOutput).toHaveProperty('suggestions');
      expect(jsonOutput).toHaveProperty('passed');

      expect(jsonOutput.recipeId).toBe('anatomy:human_male');
      expect(Array.isArray(jsonOutput.errors)).toBe(true);
      expect(Array.isArray(jsonOutput.warnings)).toBe(true);
      expect(Array.isArray(jsonOutput.suggestions)).toBe(true);
    });
  });

  describe('Exit codes', () => {
    it('should exit with code 1 when validation fails', () => {
      const recipePath = 'data/mods/anatomy/recipes/red_dragon.recipe.json';
      const result = executeCLI([recipePath]);

      // With empty registry, all recipes will fail validation
      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('Validation FAILED');
    });

    it('should exit with code 1 for non-existent recipe file', () => {
      const recipePath = 'data/mods/anatomy/recipes/nonexistent.recipe.json';
      const result = executeCLI([recipePath]);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('Validation FAILED');
    });
  });

  describe('Validation checks', () => {
    it('should report component existence errors with empty registry', () => {
      const recipePath = 'data/mods/anatomy/recipes/human_male.recipe.json';
      const result = executeCLI([recipePath]);

      // With empty registry (Phase 1), expect component errors
      expect(result.stdout).toContain('Component');
      expect(result.stdout).toContain('does not exist');
    });

    it('should report blueprint errors with empty registry', () => {
      const recipePath = 'data/mods/anatomy/recipes/red_dragon.recipe.json';
      const result = executeCLI([recipePath]);

      // With empty registry, blueprint should not be found
      expect(result.stdout).toContain('Blueprint');
      expect(result.stdout).toContain('does not exist');
    });

    it('should provide helpful suggestions', () => {
      const recipePath = 'data/mods/anatomy/recipes/red_dragon.recipe.json';
      const result = executeCLI([recipePath]);

      expect(result.stdout).toContain('Suggestion');
    });

    it('should show passed checks section', () => {
      const recipePath = 'data/mods/anatomy/recipes/human_male.recipe.json';
      const result = executeCLI([recipePath]);

      expect(result.stdout).toContain('Passed Checks');
    });
  });

  describe('Fail-fast mode', () => {
    it('should stop on first error with --fail-fast flag', () => {
      const recipePaths = [
        'data/mods/anatomy/recipes/human_male.recipe.json',
        'data/mods/anatomy/recipes/human_female.recipe.json',
      ];
      const result = executeCLI(['--fail-fast', ...recipePaths]);

      expect(result.exitCode).toBe(1);
      // Should validate first recipe but stop there
      expect(result.stdout).toContain('anatomy:human_male');
    });
  });

  describe('Performance characteristics', () => {
    it('should validate multiple recipes efficiently', () => {
      const recipePaths = [
        'data/mods/anatomy/recipes/human_male.recipe.json',
        'data/mods/anatomy/recipes/human_female.recipe.json',
        'data/mods/anatomy/recipes/red_dragon.recipe.json',
      ];

      const startTime = Date.now();
      executeCLI(recipePaths);
      const duration = Date.now() - startTime;

      // Should complete 3 recipes in under 10 seconds
      expect(duration).toBeLessThan(10000);
    });
  });

  describe('Output formatting', () => {
    it('should include colored output symbols', () => {
      const recipePath = 'data/mods/anatomy/recipes/human_male.recipe.json';
      const result = executeCLI([recipePath]);

      // Check for various output symbols
      expect(result.stdout).toContain('Validation Report');
      expect(result.stdout).toContain('='.repeat(80));
    });

    it('should include summary statistics for batch validation', () => {
      const recipePaths = [
        'data/mods/anatomy/recipes/human_male.recipe.json',
        'data/mods/anatomy/recipes/human_female.recipe.json',
      ];
      const result = executeCLI(recipePaths);

      expect(result.stdout).toContain('VALIDATION SUMMARY');
      expect(result.stdout).toContain('Recipes Validated');
      expect(result.stdout).toContain('Errors:');
      expect(result.stdout).toContain('Warnings:');
    });
  });
});
