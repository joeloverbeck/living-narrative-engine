/**
 * @file Unit tests for validateMods CLI tool
 * @description Tests CLI argument parsing, configuration handling, and validation logic
 * @jest-environment jsdom
 * @jest-timeout 30000
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  parseArguments,
  runValidation,
  calculateExitCode,
} from '../../../scripts/validateMods.js';

describe('ValidateMods CLI', () => {
  describe('Argument Parsing', () => {
    it('should parse basic validation options', () => {
      const args = ['--mod', 'positioning', '--format', 'json', '--verbose'];
      const config = parseArguments(args);

      expect(config.mods).toEqual(['positioning']);
      expect(config.ecosystem).toBe(false);
      expect(config.format).toBe('json');
      expect(config.verbose).toBe(true);
    });

    it('should parse multiple mod arguments', () => {
      const args = [
        '--mod',
        'positioning',
        '--mod',
        'intimacy',
        '--mod',
        'core',
      ];
      const config = parseArguments(args);

      expect(config.mods).toEqual(['positioning', 'intimacy', 'core']);
      expect(config.ecosystem).toBe(false);
    });

    it('should parse --flag=value format', () => {
      const args = ['--format=html', '--output=report.html', '--concurrency=5'];
      const config = parseArguments(args);

      expect(config.format).toBe('html');
      expect(config.output).toBe('report.html');
      expect(config.concurrency).toBe(5);
    });

    it('should handle short option aliases', () => {
      const args = ['-m', 'core', '-f', 'json', '-v', '-q'];
      const config = parseArguments(args);

      expect(config.mods).toEqual(['core']);
      expect(config.format).toBe('json');
      expect(config.verbose).toBe(false); // -q overrides -v
      expect(config.quiet).toBe(true);
    });

    it('should handle conflicting options appropriately', () => {
      expect(() => {
        parseArguments(['--quiet', '--verbose']);
      }).toThrow('Cannot use --quiet and --verbose together');
    });

    it('should validate format options', () => {
      expect(() => {
        parseArguments(['--format', 'invalid']);
      }).toThrow('Invalid format: invalid');
    });

    it('should validate severity options', () => {
      expect(() => {
        parseArguments(['--severity', 'invalid']);
      }).toThrow('Invalid severity: invalid');
    });

    it('should validate concurrency range', () => {
      expect(() => {
        parseArguments(['--concurrency', '0']);
      }).toThrow('Invalid concurrency value');

      expect(() => {
        parseArguments(['--concurrency', '25']);
      }).toThrow('Concurrency must be between 1 and 20');
    });

    it('should validate timeout minimum', () => {
      expect(() => {
        parseArguments(['--timeout', '500']);
      }).toThrow('Invalid timeout value (minimum 1000ms)');
    });

    it('should handle help and version flags', () => {
      const helpConfig = parseArguments(['--help']);
      expect(helpConfig.help).toBe(true);

      const versionConfig = parseArguments(['--version']);
      expect(versionConfig.version).toBe(true);
    });

    it('should handle ecosystem flag correctly', () => {
      const config1 = parseArguments(['--ecosystem']);
      expect(config1.ecosystem).toBe(true);
      expect(config1.mods).toBeNull();

      const config2 = parseArguments(['--mod', 'core', '--ecosystem']);
      expect(config2.ecosystem).toBe(true);
      expect(config2.mods).toBeNull(); // ecosystem overrides mods
    });

    it('should parse filter options', () => {
      const config = parseArguments([
        '--severity',
        'critical',
        '--mod-filter',
        '^core.*',
      ]);

      expect(config.severity).toBe('critical');
      expect(config.modFilter).toBeInstanceOf(RegExp);
      expect(config.modFilter.test('core-mod')).toBe(true);
      expect(config.modFilter.test('other-mod')).toBe(false);
    });

    it('should parse validation type toggles', () => {
      const config = parseArguments([
        '--no-dependencies',
        '--no-cross-references',
        '--check-load-order',
      ]);

      expect(config.dependencies).toBe(false);
      expect(config.crossReferences).toBe(false);
      expect(config.loadOrder).toBe(true);
    });

    it('should throw on unknown options', () => {
      expect(() => {
        parseArguments(['--unknown-flag']);
      }).toThrow('Unknown option: --unknown-flag');
    });
  });

  describe('Exit Code Calculation', () => {
    it('should return 0 for successful validation', () => {
      const results = new Map([
        ['mod1', { crossReferences: { hasViolations: false } }],
      ]);
      const config = { strictMode: false };

      expect(calculateExitCode(results, config)).toBe(0);
    });

    it('should return 1 for violations in strict mode', () => {
      const results = new Map([
        ['mod1', { crossReferences: { hasViolations: true } }],
      ]);
      const config = { strictMode: true };

      expect(calculateExitCode(results, config)).toBe(1);
    });

    it('should return 0 for violations in non-strict mode', () => {
      const results = new Map([
        ['mod1', { crossReferences: { hasViolations: true } }],
      ]);
      const config = { strictMode: false };

      expect(calculateExitCode(results, config)).toBe(0);
    });

    it('should return 2 for system errors', () => {
      const results = {
        dependencies: { isValid: false },
        errors: ['Dependency validation failed'],
      };
      const config = { strictMode: false };

      expect(calculateExitCode(results, config)).toBe(2);
    });

    it('should return 2 for errors in Map results', () => {
      const results = new Map();
      results.errors = ['Failed to validate mod'];
      const config = { strictMode: false };

      expect(calculateExitCode(results, config)).toBe(2);
    });

    it('should prioritize errors over violations', () => {
      const results = {
        dependencies: { isValid: false },
        crossReferences: new Map([['mod1', { hasViolations: true }]]),
      };
      const config = { strictMode: true };

      expect(calculateExitCode(results, config)).toBe(2); // errors take precedence
    });
  });

  describe('Validation Execution', () => {
    let mockOrchestrator;

    beforeEach(() => {
      mockOrchestrator = {
        validateEcosystem: jest.fn(),
        validateMod: jest.fn(),
      };
    });

    it('should call validateEcosystem for ecosystem validation', async () => {
      const config = {
        ecosystem: true,
        crossReferences: true,
        dependencies: true,
        failFast: false,
        strictMode: false,
        continueOnError: true,
        timeout: 60000,
        quiet: true,
      };

      mockOrchestrator.validateEcosystem.mockResolvedValue({
        dependencies: { isValid: true },
        crossReferences: new Map(),
      });

      const results = await runValidation(mockOrchestrator, config);

      expect(mockOrchestrator.validateEcosystem).toHaveBeenCalledWith({
        skipCrossReferences: false,
        failFast: false,
        modsToValidate: undefined,
        strictMode: false,
        continueOnError: true,
        timeout: 60000,
      });
      expect(results).toHaveProperty('dependencies');
    });

    it('should call validateMod for specific mod validation', async () => {
      const config = {
        ecosystem: false,
        mods: ['positioning', 'intimacy'],
        crossReferences: true,
        quiet: true,
      };

      mockOrchestrator.validateMod.mockResolvedValue({
        crossReferences: { hasViolations: false },
      });

      const results = await runValidation(mockOrchestrator, config);

      expect(mockOrchestrator.validateMod).toHaveBeenCalledTimes(2);
      expect(mockOrchestrator.validateMod).toHaveBeenCalledWith('positioning', {
        skipCrossReferences: false,
        includeContext: true,
      });
      expect(mockOrchestrator.validateMod).toHaveBeenCalledWith('intimacy', {
        skipCrossReferences: false,
        includeContext: true,
      });
      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(2);
    });

    it('should handle validation failures with failFast', async () => {
      const config = {
        ecosystem: false,
        mods: ['mod1', 'mod2'],
        failFast: true,
        quiet: true,
      };

      mockOrchestrator.validateMod
        .mockRejectedValueOnce(new Error('Validation failed'))
        .mockResolvedValueOnce({ crossReferences: { hasViolations: false } });

      await expect(runValidation(mockOrchestrator, config)).rejects.toThrow(
        'Validation failed'
      );

      expect(mockOrchestrator.validateMod).toHaveBeenCalledTimes(1);
    });

    it('should continue on error when failFast is false', async () => {
      const config = {
        ecosystem: false,
        mods: ['mod1', 'mod2'],
        failFast: false,
        quiet: true,
      };

      mockOrchestrator.validateMod
        .mockRejectedValueOnce(new Error('Validation failed'))
        .mockResolvedValueOnce({ crossReferences: { hasViolations: false } });

      const results = await runValidation(mockOrchestrator, config);

      expect(mockOrchestrator.validateMod).toHaveBeenCalledTimes(2);
      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(1); // Only successful validation
      expect(results.errors).toHaveLength(1);
      expect(results.errors[0]).toEqual({
        modId: 'mod1',
        error: 'Validation failed',
      });
    });

    it('should skip cross-references when configured', async () => {
      const config = {
        ecosystem: true,
        crossReferences: false,
        dependencies: true,
        quiet: true,
      };

      mockOrchestrator.validateEcosystem.mockResolvedValue({
        dependencies: { isValid: true },
      });

      await runValidation(mockOrchestrator, config);

      expect(mockOrchestrator.validateEcosystem).toHaveBeenCalledWith(
        expect.objectContaining({
          skipCrossReferences: true,
        })
      );
    });
  });

  describe('Configuration Defaults', () => {
    it('should use default configuration when no args provided', () => {
      const config = parseArguments([]);

      expect(config.ecosystem).toBe(true);
      expect(config.mods).toBeNull();
      expect(config.dependencies).toBe(true);
      expect(config.crossReferences).toBe(true);
      expect(config.loadOrder).toBe(false);
      expect(config.format).toBe('console');
      expect(config.output).toBeNull();
      expect(config.verbose).toBe(false);
      expect(config.quiet).toBe(false);
      expect(config.failFast).toBe(false);
      expect(config.strictMode).toBe(false);
      expect(config.concurrency).toBe(3);
      expect(config.timeout).toBe(60000);
    });
  });
});
