/**
 * @file Integration tests for validateMods CLI tool
 * @description Tests the complete validation workflow with real dependencies
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

/**
 * Helper function to run the validateMods CLI script
 * @param {string[]} args - Command line arguments
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
function runCLI(args = []) {
  return new Promise((resolve) => {
    // Use process.cwd() to get the project root
    const projectRoot = process.cwd();
    const scriptPath = path.join(projectRoot, 'scripts', 'validateMods.js');
    const child = spawn('node', [scriptPath, ...args], {
      env: { ...process.env, NODE_ENV: 'test' },
      cwd: projectRoot
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (exitCode) => {
      resolve({ stdout, stderr, exitCode });
    });
  });
}

describe('ValidateMods CLI Integration', () => {
  let testBed;
  let tempModPath;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(async () => {
    testBed.cleanup();
    
    // Clean up temporary test mods
    if (tempModPath) {
      try {
        await fs.rm(tempModPath, { recursive: true, force: true });
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Real Mod Validation', () => {
    it('should validate a real mod with CLI interface', async () => {
      // Create a test mod with cross-reference violations
      const testModName = 'test_mod_' + Date.now();
      tempModPath = path.join('data', 'mods', testModName);
      
      await fs.mkdir(tempModPath, { recursive: true });
      await fs.mkdir(path.join(tempModPath, 'components'), { recursive: true });
      
      // Create mod manifest
      const manifest = {
        id: testModName,
        name: 'Test Mod',
        version: '1.0.0',
        dependencies: [{ id: 'core', version: '^1.0.0' }] // Missing 'positioning' dependency
      };
      await fs.writeFile(
        path.join(tempModPath, 'mod-manifest.json'),
        JSON.stringify(manifest, null, 2)
      );
      
      // Create component with cross-reference violation
      const component = {
        id: `${testModName}:test-component`,
        dataSchema: {
          type: 'object',
          properties: {
            reference: {
              type: 'string',
              default: 'positioning:standing' // Reference to undeclared dependency
            }
          }
        }
      };
      await fs.writeFile(
        path.join(tempModPath, 'components', 'test-component.json'),
        JSON.stringify(component, null, 2)
      );

      // Run the CLI with the test mod
      const result = await runCLI([
        '--mod', testModName,
        '--format', 'json',
        '--strict',
        '--quiet'
      ]);

      // Parse JSON output if available
      let jsonOutput;
      try {
        // Extract JSON from stdout (may have other output)
        const jsonMatch = result.stdout.match(/\{[\s\S]*\}/);  
        if (jsonMatch) {
          jsonOutput = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        // Not JSON output, that's okay for this test
      }

      // In strict mode with violations, should exit with code 1
      expect(result.exitCode).toBe(1);
      
      // Should mention the violation in output
      const output = result.stdout + result.stderr;
      expect(output).toContain(testModName);
    });

    it('should handle command line arguments correctly', async () => {
      // Test basic CLI argument parsing
      const result = await runCLI(['--help']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Living Narrative Engine Mod Validator');
      expect(result.stdout).toContain('USAGE:');
      expect(result.stdout).toContain('--mod');
      expect(result.stdout).toContain('--ecosystem');
    });

    it('should validate ecosystem by default', async () => {
      // Run without specific mods (should validate entire ecosystem)
      const result = await runCLI(['--quiet', '--format', 'json']);
      
      // Should complete without crashing
      // Exit code depends on actual mod state
      expect([0, 1, 2]).toContain(result.exitCode);
    });

    it('should handle version flag', async () => {
      const result = await runCLI(['--version']);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Living Narrative Engine Mod Validator');
      expect(result.stdout).toMatch(/v\d+\.\d+\.\d+/);
    });

    it('should support different output formats', async () => {
      // Test JSON format
      const jsonResult = await runCLI(['--mod', 'core', '--format', 'json', '--quiet']);
      expect([0, 1, 2]).toContain(jsonResult.exitCode);
      
      // Test console format (default)
      const consoleResult = await runCLI(['--mod', 'core', '--quiet']);
      expect([0, 1, 2]).toContain(consoleResult.exitCode);
    });
  });

  describe('CLI Error Handling', () => {
    it('should handle invalid arguments gracefully', async () => {
      const result = await runCLI(['--invalid-flag']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unknown option');
    });

    it('should handle invalid format option', async () => {
      const result = await runCLI(['--format', 'invalid-format']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid format');
    });

    it('should handle invalid severity option', async () => {
      const result = await runCLI(['--severity', 'invalid']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid severity');
    });
  });

  describe('CLI Options', () => {
    it('should support strict mode', async () => {
      const result = await runCLI(['--mod', 'core', '--strict', '--quiet']);
      
      // Should complete (exit code depends on actual validation results)
      expect([0, 1, 2]).toContain(result.exitCode);
    });

    it('should support verbose output', async () => {
      const result = await runCLI(['--mod', 'core', '--verbose']);
      
      expect([0, 1, 2]).toContain(result.exitCode);
      // Verbose mode should produce more output
      expect(result.stdout.length).toBeGreaterThan(0);
    });

    it('should support quiet mode', async () => {
      const quietResult = await runCLI(['--mod', 'core', '--quiet']);
      const normalResult = await runCLI(['--mod', 'core']);
      
      // Quiet mode should produce less output than normal
      expect(quietResult.stdout.length).toBeLessThan(normalResult.stdout.length);
    });

    it('should support concurrency option', async () => {
      const result = await runCLI(['--concurrency', '5', '--quiet']);
      
      expect([0, 1, 2]).toContain(result.exitCode);
    });

    it('should reject invalid concurrency values', async () => {
      const result = await runCLI(['--concurrency', '0']);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Invalid concurrency');
    });
  });

  describe('File Output', () => {
    it('should write output to file when specified', async () => {
      const outputFile = path.join(process.cwd(), 'test-output.json');
      
      try {
        const result = await runCLI([
          '--mod', 'core',
          '--format', 'json',
          '--output', outputFile,
          '--quiet'
        ]);
        
        expect([0, 1, 2]).toContain(result.exitCode);
        
        // Check if file was created
        const fileExists = await fs.access(outputFile).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);
        
        if (fileExists) {
          // Clean up
          await fs.unlink(outputFile);
        }
      } catch (error) {
        // Clean up on error
        try {
          await fs.unlink(outputFile);
        } catch {}
        throw error;
      }
    });
  });
});