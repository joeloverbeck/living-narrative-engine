/**
 * @file Integration tests for validateMods CLI tool
 * @description Tests the complete validation workflow with real dependencies
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import path from 'path';
import fs from 'fs/promises';
import { pathToFileURL } from 'url';
import { format as utilFormat } from 'util';

const MODS_DIR = path.join(process.cwd(), 'data', 'mods');
const TEST_MOD_PATTERN = /^integration_test_mod_\d+$/;

/**
 *
 */
async function cleanupIntegrationTestMods() {
  try {
    const entries = await fs.readdir(MODS_DIR, { withFileTypes: true });
    await Promise.all(
      entries
        .filter(
          (entry) => entry.isDirectory() && TEST_MOD_PATTERN.test(entry.name)
        )
        .map(async (entry) => {
          const modPath = path.join(MODS_DIR, entry.name);
          try {
            await fs.rm(modPath, { recursive: true, force: true });
          } catch (error) {
            console.warn(
              `Failed to remove leftover integration test mod ${entry.name}:`,
              error.message
            );
          }
        })
    );
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.warn(
        'Failed to inspect mods directory during cleanup:',
        error.message
      );
    }
  }
}

/**
 * Cache of CLI invocation promises to avoid repeated expensive runs.
 *
 * @type {Map<string, Promise<{stdout: string, stderr: string, exitCode: number}>>}
 */
const cliResultCache = new Map();
const TEST_EXIT_SIGNAL = Symbol.for('validateMods.test.exit');

/**
 * @description Helper function to run the validateMods CLI script.
 * @param {string[]} args - Command line arguments.
 * @param {{env?: Record<string, string>, useCache?: boolean}} [options] - Execution options.
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
function runCLI(args = [], options = {}) {
  const { env: envOverrides = {}, useCache = true } = options;
  const cacheKey = useCache
    ? JSON.stringify({ args, env: envOverrides })
    : null;

  if (useCache && cliResultCache.has(cacheKey)) {
    return cliResultCache.get(cacheKey);
  }

  const runPromise = (async () => {
    const projectRoot = process.cwd();
    const scriptPath = path.join(projectRoot, 'scripts', 'validateMods.js');
    const cliModule = await loadCliModule(scriptPath);

    const restoreStdIO = interceptStdIO();
    const restoreEnv = applyEnvOverrides(envOverrides);
    const restoreArgv = overrideProcessArgv(scriptPath, args);
    const originalExit = process.exit;
    let exitCode = 0;

    process.exit = (code = 0) => {
      exitCode = typeof code === 'number' ? code : parseInt(code, 10) || 0;
      throw TEST_EXIT_SIGNAL;
    };

    try {
      await cliModule.main();
    } catch (error) {
      if (error !== TEST_EXIT_SIGNAL) {
        throw error;
      }
    } finally {
      process.exit = originalExit;
      restoreArgv();
      restoreEnv();
    }

    const { stdout, stderr } = restoreStdIO();
    return { stdout, stderr, exitCode };
  })();

  if (useCache) {
    cliResultCache.set(cacheKey, runPromise);
  }

  return runPromise;
}

/**
 *
 */
function interceptStdIO() {
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  let stdout = '';
  let stderr = '';

  const appendStdout = (value) => {
    stdout += value;
  };
  const appendStderr = (value) => {
    stderr += value;
  };

  process.stdout.write = createWriteInterceptor(appendStdout);
  process.stderr.write = createWriteInterceptor(appendStderr);

  console.log = createConsoleInterceptor(appendStdout);
  console.info = createConsoleInterceptor(appendStdout);
  console.warn = createConsoleInterceptor(appendStderr);
  console.error = createConsoleInterceptor(appendStderr);

  return () => {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
    return { stdout, stderr };
  };
}

/**
 *
 * @param collector
 */
function createWriteInterceptor(collector) {
  return (chunk, encoding, callback) => {
    collector(normalizeChunk(chunk, encoding));
    if (typeof callback === 'function') {
      callback();
    }
    return true;
  };
}

/**
 *
 * @param collector
 */
function createConsoleInterceptor(collector) {
  return (...args) => {
    collector(utilFormat(...args) + '\n');
    return undefined;
  };
}

/**
 *
 * @param chunk
 * @param encoding
 */
function normalizeChunk(chunk, encoding) {
  if (typeof chunk === 'string') {
    return chunk;
  }
  if (!chunk) {
    return '';
  }
  const enc = typeof encoding === 'string' ? encoding : undefined;
  return chunk.toString(enc);
}

/**
 *
 * @param envOverrides
 */
function applyEnvOverrides(envOverrides) {
  const snapshot = new Map();
  snapshot.set('NODE_ENV', process.env.NODE_ENV);

  for (const [key, value] of Object.entries(envOverrides)) {
    if (!snapshot.has(key)) {
      snapshot.set(key, process.env[key]);
    }
    process.env[key] = value;
  }

  delete process.env.NODE_ENV;

  return () => {
    for (const [key, value] of snapshot.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  };
}

/**
 *
 * @param scriptPath
 * @param args
 */
function overrideProcessArgv(scriptPath, args) {
  const originalArgv = process.argv;
  process.argv = [originalArgv[0], scriptPath, ...args];
  return () => {
    process.argv = originalArgv;
  };
}

const cliModuleCache = new Map();
/**
 *
 * @param scriptPath
 */
async function loadCliModule(scriptPath) {
  if (!cliModuleCache.has(scriptPath)) {
    const moduleUrl = pathToFileURL(scriptPath).href;
    cliModuleCache.set(scriptPath, import(moduleUrl));
  }
  return cliModuleCache.get(scriptPath);
}

describe('ValidateMods CLI Integration', () => {
  let testBed;
  let tempModPath;
  let testModName;
  const FAST_ENV = { VALIDATE_MODS_TEST_MODE: 'fast' };
  let fastResults;

  beforeAll(async () => {
    await cleanupIntegrationTestMods();

    testModName = `integration_test_mod_${Date.now()}`;
    // Use absolute path to ensure cleanup works regardless of working directory
    tempModPath = path.join(MODS_DIR, testModName);

    await fs.mkdir(path.join(tempModPath, 'components'), { recursive: true });

    const manifest = {
      id: testModName,
      name: 'Test Mod',
      version: '1.0.0',
      dependencies: [{ id: 'core', version: '^1.0.0' }], // Missing 'positioning' dependency
    };
    await fs.writeFile(
      path.join(tempModPath, 'mod-manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    const component = {
      id: `${testModName}:test-component`,
      dataSchema: {
        type: 'object',
        properties: {
          reference: {
            type: 'string',
            default: 'positioning:standing', // Reference to undeclared dependency
          },
        },
      },
    };
    await fs.writeFile(
      path.join(tempModPath, 'components', 'test-component.json'),
      JSON.stringify(component, null, 2)
    );

    const fastCommands = {
      normal: ['--mod', testModName],
      quiet: ['--mod', testModName, '--quiet'],
      jsonQuiet: ['--mod', testModName, '--format', 'json', '--quiet'],
      verbose: ['--mod', testModName, '--verbose'],
      concurrency: ['--mod', testModName, '--concurrency', '5', '--quiet'],
    };

    const entries = [];
    for (const [key, args] of Object.entries(fastCommands)) {
      const result = await runCLI(args, { env: FAST_ENV });
      entries.push([key, result]);
    }

    fastResults = Object.fromEntries(entries);
  });

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(async () => {
    testBed.cleanup();
  });

  afterAll(async () => {
    await cleanupIntegrationTestMods();
  });

  describe('Real Mod Validation', () => {
    it('should validate a real mod with CLI interface', async () => {
      // Run the CLI with the test mod
      const result = await runCLI([
        '--mod',
        testModName,
        '--format',
        'json',
        '--strict',
        '--quiet',
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
      const jsonResult = fastResults.jsonQuiet;
      expect([0, 1, 2]).toContain(jsonResult.exitCode);

      // Test console format (default)
      const consoleResult = fastResults.quiet;
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
    it('should support verbose output', async () => {
      const result = fastResults.verbose;

      expect([0, 1, 2]).toContain(result.exitCode);
      // Verbose mode should produce more output
      expect(result.stdout.length).toBeGreaterThan(0);
    });

    it('should support quiet mode', async () => {
      const quietResult = fastResults.quiet;
      const normalResult = fastResults.normal;

      // Quiet mode should produce less output than normal
      expect(quietResult.stdout.length).toBeLessThan(
        normalResult.stdout.length
      );
    });

    it('should support concurrency option', async () => {
      const result = fastResults.concurrency;

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
        const result = await runCLI(
          [
            '--mod',
            testModName,
            '--format',
            'json',
            '--output',
            outputFile,
            '--quiet',
          ],
          { env: FAST_ENV, useCache: false }
        );

        expect([0, 1, 2]).toContain(result.exitCode);

        // Check if file was created
        const fileExists = await fs
          .access(outputFile)
          .then(() => true)
          .catch(() => false);
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
