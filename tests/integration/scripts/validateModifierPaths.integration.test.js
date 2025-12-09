/**
 * @file Integration tests for validateModifierPaths CLI tool
 * @description Tests the modifier entity path validation workflow with real action files
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { glob } from 'glob';

const PROJECT_ROOT = process.cwd();
const MODS_DIR = path.join(PROJECT_ROOT, 'data', 'mods');
const SCRIPT_PATH = path.join(PROJECT_ROOT, 'scripts', 'validateModifierPaths.js');
const TEST_MOD_NAME = `test_modifier_validation_${Date.now()}`;
const TEST_MOD_DIR = path.join(MODS_DIR, TEST_MOD_NAME);

/**
 * Runs the CLI script with given arguments
 *
 * @param {string[]} args - Command line arguments
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>} CLI output and exit code
 */
function runCLI(args = []) {
  return new Promise((resolve) => {
    const proc = spawn('node', [SCRIPT_PATH, ...args], {
      cwd: PROJECT_ROOT,
      env: { ...process.env },
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        stdout,
        stderr,
        exitCode: code,
      });
    });
  });
}

/**
 * Creates a test mod with action files for testing
 *
 * @param {object} options - Options for creating the test mod
 * @param {object[]} options.actions - Action files to create
 */
async function createTestMod(options = {}) {
  const { actions = [] } = options;
  const actionsDir = path.join(TEST_MOD_DIR, 'actions');

  await fs.mkdir(actionsDir, { recursive: true });

  // Create mod manifest
  await fs.writeFile(
    path.join(TEST_MOD_DIR, 'mod-manifest.json'),
    JSON.stringify({
      id: TEST_MOD_NAME,
      name: 'Test Modifier Validation Mod',
      version: '1.0.0',
    }, null, 2)
  );

  // Create action files
  for (const action of actions) {
    await fs.writeFile(
      path.join(actionsDir, action.filename),
      JSON.stringify(action.content, null, 2)
    );
  }
}

/**
 * Removes the test mod directory
 */
async function cleanupTestMod() {
  try {
    await fs.rm(TEST_MOD_DIR, { recursive: true, force: true });
  } catch {
    // Ignore errors during cleanup
  }
}

describe('validateModifierPaths CLI', () => {
  afterAll(async () => {
    await cleanupTestMod();
  });

  describe('help and basic execution', () => {
    it('should show help message with --help flag', async () => {
      const result = await runCLI(['--help']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Modifier Entity Path Validator');
      expect(result.stdout).toContain('Usage:');
      expect(result.stdout).toContain('--mod, -m');
      expect(result.stdout).toContain('--verbose, -v');
      expect(result.stdout).toContain('--json');
      expect(result.stdout).toContain('Valid entity paths must:');
    });

    it('should show help message with -h flag', async () => {
      const result = await runCLI(['-h']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Modifier Entity Path Validator');
    });

    it('should show valid roles in help message', async () => {
      const result = await runCLI(['--help']);

      expect(result.stdout).toContain('actor');
      expect(result.stdout).toContain('primary');
      expect(result.stdout).toContain('secondary');
      expect(result.stdout).toContain('tertiary');
      expect(result.stdout).toContain('location');
    });
  });

  describe('output formats', () => {
    it('should output summary with counts by default', async () => {
      const result = await runCLI(['--mod', 'first-aid']);

      expect(result.stdout).toContain('Summary');
      expect(result.stdout).toContain('Total action files:');
      expect(result.stdout).toMatch(/Valid \(with modifiers\):\s+\d+/);
      expect(result.stdout).toMatch(/Invalid:\s+\d+/);
      expect(result.stdout).toMatch(/No modifiers:\s+\d+/);
    });

    it('should output JSON with --json flag', async () => {
      const result = await runCLI(['--mod', 'first-aid', '--json']);

      // Parse the JSON output - find the complete JSON object
      const jsonMatch = result.stdout.match(/\{[\s\S]*"total"[\s\S]*\}/);
      expect(jsonMatch).not.toBeNull();

      const parsed = JSON.parse(jsonMatch[0]);
      expect(parsed).toHaveProperty('total');
      expect(parsed).toHaveProperty('valid');
      expect(parsed).toHaveProperty('invalid');
      expect(parsed).toHaveProperty('noModifiers');
      expect(parsed).toHaveProperty('errors');
      expect(Array.isArray(parsed.errors)).toBe(true);
    });

    it('should show detailed output with --verbose flag', async () => {
      const result = await runCLI(['--mod', 'first-aid', '--verbose']);

      // Verbose mode shows all files including those without modifiers
      expect(result.stdout).toMatch(/no modifiers|✅/);
    });
  });

  describe('mod filtering', () => {
    it('should filter by single mod with --mod flag', async () => {
      const result = await runCLI(['--mod', 'first-aid']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Total action files:');
    });

    it('should filter by multiple mods with repeated --mod flags', async () => {
      const result = await runCLI(['--mod', 'first-aid', '--mod', 'core']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Total action files:');
    });

    it('should handle non-existent mod gracefully', async () => {
      const result = await runCLI(['--mod', 'nonexistent_mod_12345']);

      expect(result.stdout).toContain('No action files found');
    });
  });

  describe('exit codes', () => {
    it('should exit with code 0 when all paths are valid', async () => {
      // first-aid mod should have valid paths after the fix
      const result = await runCLI(['--mod', 'first-aid']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('All modifier entity paths are valid!');
    });

    it('should exit with code 0 when no action files found', async () => {
      const result = await runCLI(['--mod', 'nonexistent_mod_xyz']);

      expect(result.exitCode).toBe(0);
    });
  });

  describe('validation with test fixtures', () => {
    beforeAll(async () => {
      await cleanupTestMod();
    });

    afterAll(async () => {
      await cleanupTestMod();
    });

    it('should detect invalid paths missing entity. prefix', async () => {
      await createTestMod({
        actions: [{
          filename: 'test_invalid_prefix.action.json',
          content: {
            id: `${TEST_MOD_NAME}:test_invalid_prefix`,
            name: 'Test Invalid Prefix',
            description: 'Test action with invalid path prefix',
            chanceBased: {
              baseChance: 50,
              modifiers: [{
                name: 'test_modifier',
                value: 10,
                condition: {
                  logic: {
                    'isSlotExposed': ['actor', { 'var': 'slot' }]
                  }
                }
              }]
            }
          }
        }]
      });

      const result = await runCLI(['--mod', TEST_MOD_NAME]);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('❌');
      expect(result.stdout).toContain('actor');
      expect(result.stdout).toContain('must start with "entity."');
    });

    it('should detect invalid entity roles', async () => {
      await cleanupTestMod();
      await createTestMod({
        actions: [{
          filename: 'test_invalid_role.action.json',
          content: {
            id: `${TEST_MOD_NAME}:test_invalid_role`,
            name: 'Test Invalid Role',
            description: 'Test action with invalid entity role',
            chanceBased: {
              baseChance: 50,
              modifiers: [{
                name: 'test_modifier',
                value: 10,
                condition: {
                  logic: {
                    'isSocketCovered': ['entity.target', { 'var': 'socket' }]
                  }
                }
              }]
            }
          }
        }]
      });

      const result = await runCLI(['--mod', TEST_MOD_NAME]);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('❌');
      expect(result.stdout).toContain('Invalid entity role');
      expect(result.stdout).toContain('target');
    });

    it('should pass valid entity paths', async () => {
      await cleanupTestMod();
      await createTestMod({
        actions: [{
          filename: 'test_valid_paths.action.json',
          content: {
            id: `${TEST_MOD_NAME}:test_valid_paths`,
            name: 'Test Valid Paths',
            description: 'Test action with valid paths',
            chanceBased: {
              baseChance: 50,
              modifiers: [{
                name: 'test_modifier',
                value: 10,
                condition: {
                  logic: {
                    'isSlotExposed': ['entity.actor', { 'var': 'slot' }]
                  }
                }
              }]
            }
          }
        }]
      });

      const result = await runCLI(['--mod', TEST_MOD_NAME]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('All modifier entity paths are valid!');
    });

    it('should handle actions without modifiers', async () => {
      await cleanupTestMod();
      await createTestMod({
        actions: [{
          filename: 'test_no_modifiers.action.json',
          content: {
            id: `${TEST_MOD_NAME}:test_no_modifiers`,
            name: 'Test No Modifiers',
            description: 'Test action without modifiers'
          }
        }]
      });

      const result = await runCLI(['--mod', TEST_MOD_NAME, '--verbose']);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('no modifiers');
    });

    it('should handle malformed JSON files gracefully', async () => {
      await cleanupTestMod();
      const actionsDir = path.join(TEST_MOD_DIR, 'actions');
      await fs.mkdir(actionsDir, { recursive: true });

      await fs.writeFile(
        path.join(TEST_MOD_DIR, 'mod-manifest.json'),
        JSON.stringify({ id: TEST_MOD_NAME, name: 'Test', version: '1.0.0' })
      );

      await fs.writeFile(
        path.join(actionsDir, 'malformed.action.json'),
        '{ invalid json'
      );

      const result = await runCLI(['--mod', TEST_MOD_NAME]);

      // Error message could be in stdout or stderr depending on how console.error outputs
      const combinedOutput = result.stdout + result.stderr;
      expect(combinedOutput).toContain('Error processing');
    });

    it('should report multiple errors in same file', async () => {
      await cleanupTestMod();
      await createTestMod({
        actions: [{
          filename: 'test_multiple_errors.action.json',
          content: {
            id: `${TEST_MOD_NAME}:test_multiple_errors`,
            name: 'Test Multiple Errors',
            description: 'Test action with multiple invalid paths',
            chanceBased: {
              baseChance: 50,
              modifiers: [
                {
                  name: 'modifier_1',
                  value: 10,
                  condition: {
                    logic: {
                      'isSlotExposed': ['actor', { 'var': 'slot' }]
                    }
                  }
                },
                {
                  name: 'modifier_2',
                  value: 5,
                  condition: {
                    logic: {
                      'isSocketCovered': ['target', { 'var': 'socket' }]
                    }
                  }
                }
              ]
            }
          }
        }]
      });

      const result = await runCLI(['--mod', TEST_MOD_NAME]);

      expect(result.exitCode).toBe(1);
      expect(result.stdout).toContain('modifier_1');
      expect(result.stdout).toContain('modifier_2');
    });
  });

  describe('real codebase validation', () => {
    it('should validate all action files in the codebase', async () => {
      const result = await runCLI([]);

      // Should complete without crashing
      expect(typeof result.exitCode).toBe('number');
      expect(result.stdout).toContain('Total action files:');
      expect(result.stdout).toContain('Summary');
    });

    it('should find action files in multiple mods', async () => {
      // Get count of action files
      const actionFiles = await glob(`${MODS_DIR}/**/actions/*.action.json`);

      const result = await runCLI(['--json']);
      // Parse the JSON output - find the complete JSON object
      const jsonMatch = result.stdout.match(/\{[\s\S]*"total"[\s\S]*\}/);
      expect(jsonMatch).not.toBeNull();
      const parsed = JSON.parse(jsonMatch[0]);

      expect(parsed.total).toBe(actionFiles.length);
    });
  });
});
