/**
 * @file Integration tests for validate-recipe.js CLI tool
 * @description Tests CLI execution with actual recipe validation and mod loading
 * @note Streamlined to critical paths only - CLI behavior tests moved to unit tests
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
  describe('Critical validation paths', () => {
    it('should validate a valid recipe with full mod loading', () => {
      const recipePath = 'data/mods/anatomy/recipes/human_male.recipe.json';
      const result = executeCLI([recipePath]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('anatomy:human_male');
      expect(result.stdout).toContain('component references exist');
      expect(result.stdout).toContain('Blueprint');
      expect(result.stdout).toContain('Passed Checks');
      expect(result.stdout).toContain('Validation PASSED');
    });

    it('should validate multiple recipes in batch', () => {
      const recipePaths = [
        'data/mods/anatomy/recipes/human_male.recipe.json',
        'data/mods/anatomy/recipes/human_female.recipe.json',
      ];
      const result = executeCLI(recipePaths);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('anatomy:human_male');
      expect(result.stdout).toContain('anatomy:human_female');
      expect(result.stdout).toContain('VALIDATION SUMMARY');
      expect(result.stdout).toContain('Recipes Validated: 2');
      expect(result.stdout).toContain('Validation PASSED');
    });

    it('should validate recipe with structure template (red_dragon)', () => {
      const recipePath = 'data/mods/anatomy/recipes/red_dragon.recipe.json';
      const result = executeCLI([recipePath]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Validation PASSED');
      expect(result.stdout).toContain('Blueprint');
    });

    it('should fail for non-existent recipe file', () => {
      const recipePath = 'data/mods/anatomy/recipes/nonexistent.recipe.json';
      const result = executeCLI([recipePath]);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('Validation FAILED');
    });

    it('should fail for invalid file path', () => {
      const recipePath = 'invalid/path/to/recipe.json';
      const result = executeCLI([recipePath]);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('Validation FAILED');
    });
  });

  describe('JSON output format', () => {
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

  describe('Fail-fast mode', () => {
    it('should stop on first error with --fail-fast flag', () => {
      const recipePaths = [
        'data/mods/anatomy/recipes/nonexistent.recipe.json',
        'data/mods/anatomy/recipes/human_female.recipe.json',
      ];
      const result = executeCLI(['--fail-fast', ...recipePaths]);

      // Should fail on first non-existent file
      expect(result.exitCode).toBe(1);
      // Check for error indicator
      const output = result.stdout + result.stderr;
      expect(
        output.includes('Failed to validate') || output.includes('FAILED')
      ).toBe(true);
      // Should not process second file
      expect(result.stdout).not.toContain('anatomy:human_female');
    });

    it('should validate all valid recipes even with --fail-fast flag', () => {
      const recipePaths = [
        'data/mods/anatomy/recipes/human_male.recipe.json',
        'data/mods/anatomy/recipes/human_female.recipe.json',
      ];
      const result = executeCLI(['--fail-fast', ...recipePaths]);

      // With valid recipes, --fail-fast has no effect (all pass)
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('anatomy:human_male');
      expect(result.stdout).toContain('anatomy:human_female');
    });
  });

  describe('Comprehensive validation checks', () => {
    it('should validate all existing recipes successfully', () => {
      const recipePaths = [
        'data/mods/anatomy/recipes/human_male.recipe.json',
        'data/mods/anatomy/recipes/human_female.recipe.json',
        'data/mods/anatomy/recipes/red_dragon.recipe.json',
      ];
      const result = executeCLI(recipePaths);

      // All valid recipes should pass with loaded mods
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Validation PASSED');
      expect(result.stdout).toContain('Recipes Validated: 3');
    });
  });
});
