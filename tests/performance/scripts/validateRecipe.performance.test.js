/**
 * @file Performance tests for validate-recipe.js CLI tool
 * @description Tests CLI execution performance characteristics
 */

import { describe, it, expect } from '@jest/globals';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '../../..');
const scriptPath = path.join(projectRoot, 'scripts/validate-recipe.js');

/**
 * Execute the CLI and return results with timing
 *
 * @param {Array<string>} args - CLI arguments
 * @returns {object} Execution results with stdout, stderr, exitCode, duration
 */
function executeCLI(args) {
  const startTime = Date.now();

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
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.status || 1,
      duration: Date.now() - startTime,
    };
  }
}

describe('validate-recipe CLI performance tests', () => {
  describe('Single recipe validation', () => {
    it('should complete single recipe validation in under 5 seconds', () => {
      // Use human_male as it's a simpler recipe than red_dragon
      const recipePath = 'data/mods/anatomy/recipes/human_male.recipe.json';
      const result = executeCLI([recipePath]);

      // Should complete in reasonable time
      expect(result.duration).toBeLessThan(5000);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Batch validation', () => {
    it('should validate multiple recipes efficiently', () => {
      const recipePaths = [
        'data/mods/anatomy/recipes/human_male.recipe.json',
        'data/mods/anatomy/recipes/human_female.recipe.json',
        'data/mods/anatomy/recipes/red_dragon.recipe.json',
      ];

      const result = executeCLI(recipePaths);

      // Should complete 3 recipes in under 10 seconds
      expect(result.duration).toBeLessThan(10000);
      expect(result.exitCode).toBe(0);
    });
  });

  describe('Startup overhead', () => {
    it('should have consistent startup time across invocations', async () => {
      const recipePath = 'data/mods/anatomy/recipes/human_male.recipe.json';

      // Run 2 times to measure consistency (reduced from 3 for performance)
      const durations = [];
      for (let i = 0; i < 2; i++) {
        const result = executeCLI([recipePath]);
        durations.push(result.duration);
      }

      // Calculate variance between the two runs
      const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
      const variance = durations.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / durations.length;
      const stdDev = Math.sqrt(variance);

      // Standard deviation should be reasonable (less than 50% of average)
      // With only 2 samples, we're checking for basic consistency
      expect(stdDev).toBeLessThan(avg * 0.5);
    });
  });
});
