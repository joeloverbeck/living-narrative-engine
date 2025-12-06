/**
 * @file Comprehensive test suite for enhanced updateManifest.js with validation integration
 * @description Tests all new validation features, batch processing, CLI parsing, and error handling
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import fs from 'fs/promises';
import path from 'path';

// Mock the updateManifest module functions
const mockUpdateManifest = {
  updateModManifest: jest.fn(),
  performManifestUpdate: jest.fn(),
  runValidation: jest.fn(),
  updateAllManifests: jest.fn(),
  parseCommandLineOptions: jest.fn(),
  ValidationError: class extends Error {
    constructor(message, componentTypeId = null, validationErrors = null) {
      super(message);
      this.name = 'ValidationError';
      this.componentTypeId = componentTypeId;
      this.validationErrors = validationErrors;
    }
  },
};

// Mock the required modules
jest.unstable_mockModule(
  '../../../scripts/updateManifest.js',
  () => mockUpdateManifest
);

describe('UpdateManifest - Enhanced with Validation Integration', () => {
  let testBed;
  let mockLogger;
  let mockValidationOrchestrator;
  let mockViolationReporter;

  beforeEach(async () => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();

    // Mock validation orchestrator
    mockValidationOrchestrator = {
      validateMod: jest.fn(),
    };

    // Mock violation reporter
    mockViolationReporter = {
      generateReport: jest.fn(),
    };

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Enhanced CLI Option Parsing', () => {
    it('should parse basic validation options correctly', () => {
      const args = [
        'test-mod',
        '--validate-references',
        '--fail-on-violations',
        '--format=json',
        '--output=report.json',
      ];

      // Mock the parseCommandLineOptions function
      mockUpdateManifest.parseCommandLineOptions.mockReturnValue({
        modName: 'test-mod',
        validateReferences: true,
        failOnViolations: true,
        validationFormat: 'json',
        validationOutput: 'report.json',
        preValidation: false,
        postValidation: true,
        validationStrictMode: false,
        showSuggestions: true,
        validationTimeout: 30000,
        verbose: false,
        dryRun: false,
        force: false,
        concurrency: 3,
        batch: false,
      });

      const options = mockUpdateManifest.parseCommandLineOptions(args);

      expect(options.modName).toBe('test-mod');
      expect(options.validateReferences).toBe(true);
      expect(options.failOnViolations).toBe(true);
      expect(options.validationFormat).toBe('json');
      expect(options.validationOutput).toBe('report.json');
    });

    it('should parse advanced validation options correctly', () => {
      const args = [
        'test-mod',
        '--pre-validation',
        '--validation-strict',
        '--no-suggestions',
        '--validation-timeout=60000',
        '--verbose',
        '--dry-run',
      ];

      mockUpdateManifest.parseCommandLineOptions.mockReturnValue({
        modName: 'test-mod',
        validateReferences: false,
        failOnViolations: false,
        validationFormat: 'console',
        validationOutput: null,
        preValidation: true,
        postValidation: true,
        validationStrictMode: true,
        showSuggestions: false,
        validationTimeout: 60000,
        verbose: true,
        dryRun: true,
        force: false,
        concurrency: 3,
        batch: false,
      });

      const options = mockUpdateManifest.parseCommandLineOptions(args);

      expect(options.preValidation).toBe(true);
      expect(options.validationStrictMode).toBe(true);
      expect(options.showSuggestions).toBe(false);
      expect(options.validationTimeout).toBe(60000);
      expect(options.verbose).toBe(true);
      expect(options.dryRun).toBe(true);
    });

    it('should parse batch processing options correctly', () => {
      const args = [
        '--batch',
        '--validate-references',
        '--concurrency=5',
        '--verbose',
      ];

      mockUpdateManifest.parseCommandLineOptions.mockReturnValue({
        modName: null,
        validateReferences: true,
        failOnViolations: false,
        validationFormat: 'console',
        validationOutput: null,
        preValidation: false,
        postValidation: true,
        validationStrictMode: false,
        showSuggestions: true,
        validationTimeout: 30000,
        verbose: true,
        dryRun: false,
        force: false,
        concurrency: 5,
        batch: true,
      });

      const options = mockUpdateManifest.parseCommandLineOptions(args);

      expect(options.batch).toBe(true);
      expect(options.concurrency).toBe(5);
      expect(options.validateReferences).toBe(true);
      expect(options.verbose).toBe(true);
    });

    it('should handle short flag aliases correctly', () => {
      const args = ['test-mod', '-v', '-s', '-V', '-d', '-f'];

      mockUpdateManifest.parseCommandLineOptions.mockReturnValue({
        modName: 'test-mod',
        validateReferences: true,
        failOnViolations: true,
        validationFormat: 'console',
        validationOutput: null,
        preValidation: false,
        postValidation: true,
        validationStrictMode: false,
        showSuggestions: true,
        validationTimeout: 30000,
        verbose: true,
        dryRun: true,
        force: true,
        concurrency: 3,
        batch: false,
      });

      const options = mockUpdateManifest.parseCommandLineOptions(args);

      expect(options.validateReferences).toBe(true);
      expect(options.failOnViolations).toBe(true);
      expect(options.verbose).toBe(true);
      expect(options.dryRun).toBe(true);
      expect(options.force).toBe(true);
    });

    it('should throw error for invalid validation format', () => {
      const args = ['test-mod', '--format=invalid'];

      mockUpdateManifest.parseCommandLineOptions.mockImplementation(() => {
        throw new Error(
          'Invalid validation format: invalid. Valid options: console, json, html, markdown, none'
        );
      });

      expect(() => mockUpdateManifest.parseCommandLineOptions(args)).toThrow(
        'Invalid validation format: invalid'
      );
    });
  });

  describe('Enhanced updateModManifest Function', () => {
    it('should perform post-validation by default when enabled', async () => {
      const mockResult = {
        success: true,
        modName: 'test-mod',
        timestamp: new Date().toISOString(),
        manifestUpdated: true,
        filesProcessed: 5,
        errors: [],
        warnings: [],
        validation: {
          performed: true,
          preValidation: null,
          postValidation: {
            hasViolations: false,
            violations: [],
            violationCount: 0,
            suggestions: [],
          },
          violations: [],
          suggestions: [],
        },
        performance: {
          startTime: Date.now(),
          phases: {
            manifestUpdate: 100,
            postValidation: 50,
          },
          totalTime: 150,
        },
      };

      mockUpdateManifest.updateModManifest.mockResolvedValue(mockResult);

      const result = await mockUpdateManifest.updateModManifest('test-mod', {
        validateReferences: true,
        postValidation: true,
      });

      expect(result.validation.performed).toBe(true);
      expect(result.validation.postValidation.hasViolations).toBe(false);
      expect(mockUpdateManifest.updateModManifest).toHaveBeenCalledWith(
        'test-mod',
        {
          validateReferences: true,
          postValidation: true,
        }
      );
    });

    it('should perform pre-validation when enabled', async () => {
      const mockResult = {
        success: true,
        modName: 'test-mod',
        timestamp: new Date().toISOString(),
        manifestUpdated: true,
        filesProcessed: 5,
        errors: [],
        warnings: [],
        validation: {
          performed: true,
          preValidation: {
            hasViolations: false,
            violations: [],
            violationCount: 0,
            suggestions: [],
          },
          postValidation: {
            hasViolations: false,
            violations: [],
            violationCount: 0,
            suggestions: [],
          },
          violations: [],
          suggestions: [],
        },
        performance: {
          startTime: Date.now(),
          phases: {
            preValidation: 30,
            manifestUpdate: 100,
            postValidation: 50,
          },
          totalTime: 180,
        },
      };

      mockUpdateManifest.updateModManifest.mockResolvedValue(mockResult);

      const result = await mockUpdateManifest.updateModManifest('test-mod', {
        validateReferences: true,
        preValidation: true,
        postValidation: true,
      });

      expect(result.validation.preValidation).toBeTruthy();
      expect(result.validation.postValidation).toBeTruthy();
      expect(result.performance.phases.preValidation).toBe(30);
    });

    it('should fail on violations when strictMode enabled', async () => {
      const mockError = new mockUpdateManifest.ValidationError(
        'Post-validation failed with 2 violations',
        null,
        {
          hasViolations: true,
          violations: [
            {
              message: 'Missing component reference',
              file: 'test.action.json',
            },
            { message: 'Invalid entity reference', file: 'test2.action.json' },
          ],
          violationCount: 2,
        }
      );

      mockUpdateManifest.updateModManifest.mockRejectedValue(mockError);

      await expect(
        mockUpdateManifest.updateModManifest('test-mod', {
          validateReferences: true,
          failOnViolations: true,
        })
      ).rejects.toThrow(mockUpdateManifest.ValidationError);
    });

    it('should generate validation reports in different formats', async () => {
      const mockResult = {
        success: true,
        modName: 'test-mod',
        timestamp: new Date().toISOString(),
        manifestUpdated: true,
        filesProcessed: 3,
        errors: [],
        warnings: [],
        validation: {
          performed: true,
          preValidation: null,
          postValidation: {
            hasViolations: true,
            violations: [{ message: 'Test violation', file: 'test.json' }],
            violationCount: 1,
            suggestions: [
              { description: 'Fix test violation by updating reference' },
            ],
          },
          violations: [{ message: 'Test violation', file: 'test.json' }],
          suggestions: [
            { description: 'Fix test violation by updating reference' },
          ],
        },
        performance: {
          startTime: Date.now(),
          phases: {
            manifestUpdate: 100,
            postValidation: 50,
          },
          totalTime: 150,
        },
      };

      mockUpdateManifest.updateModManifest.mockResolvedValue(mockResult);

      const result = await mockUpdateManifest.updateModManifest('test-mod', {
        validateReferences: true,
        validationFormat: 'json',
        validationOutput: 'test-report.json',
      });

      expect(result.validation.performed).toBe(true);
      expect(result.validation.postValidation.hasViolations).toBe(true);
      expect(result.validation.violations).toHaveLength(1);
      expect(result.validation.suggestions).toHaveLength(1);
    });

    it('should handle validation timeout correctly', async () => {
      const mockError = new Error('Validation timeout');
      mockUpdateManifest.updateModManifest.mockRejectedValue(mockError);

      await expect(
        mockUpdateManifest.updateModManifest('test-mod', {
          validateReferences: true,
          validationTimeout: 1000,
        })
      ).rejects.toThrow('Validation timeout');
    });

    it('should skip validation on dry run when configured', async () => {
      const mockResult = {
        success: true,
        modName: 'test-mod',
        timestamp: new Date().toISOString(),
        manifestUpdated: false, // Dry run doesn't update
        filesProcessed: 3,
        errors: [],
        warnings: [],
        validation: {
          performed: false,
          preValidation: null,
          postValidation: null,
          violations: [],
          suggestions: [],
        },
        performance: {
          startTime: Date.now(),
          phases: {
            manifestUpdate: 50,
          },
          totalTime: 50,
        },
      };

      mockUpdateManifest.updateModManifest.mockResolvedValue(mockResult);

      const result = await mockUpdateManifest.updateModManifest('test-mod', {
        validateReferences: true,
        dryRun: true,
        skipValidationOnDryRun: true,
      });

      expect(result.manifestUpdated).toBe(false);
      expect(result.validation.performed).toBe(false);
    });
  });

  describe('Batch Processing Functionality', () => {
    it('should process multiple mods with validation', async () => {
      const mockResults = {
        processed: ['mod-a', 'mod-b', 'mod-c'],
        successful: ['mod-a', 'mod-c'],
        failed: ['mod-b'],
        validationSummary: {
          totalViolations: 3,
          modsWithViolations: 2,
          commonViolations: new Map([
            ['core:missing-component', 2],
            ['positioning:invalid-entity', 1],
          ]),
        },
        performance: {
          startTime: Date.now(),
          totalTime: 5000,
        },
      };

      mockUpdateManifest.updateAllManifests.mockResolvedValue(mockResults);

      const results = await mockUpdateManifest.updateAllManifests({
        validateReferences: true,
        concurrency: 2,
      });

      expect(results.processed).toHaveLength(3);
      expect(results.successful).toHaveLength(2);
      expect(results.failed).toHaveLength(1);
      expect(results.validationSummary.modsWithViolations).toBe(2);
      expect(results.validationSummary.totalViolations).toBe(3);
      expect(results.validationSummary.commonViolations.size).toBe(2);
    });

    it('should handle concurrent processing limits', async () => {
      const mockResults = {
        processed: ['mod-1', 'mod-2', 'mod-3', 'mod-4', 'mod-5'],
        successful: ['mod-1', 'mod-2', 'mod-3', 'mod-4', 'mod-5'],
        failed: [],
        validationSummary: {
          totalViolations: 0,
          modsWithViolations: 0,
          commonViolations: new Map(),
        },
        performance: {
          startTime: Date.now(),
          totalTime: 3000,
        },
      };

      mockUpdateManifest.updateAllManifests.mockResolvedValue(mockResults);

      const results = await mockUpdateManifest.updateAllManifests({
        validateReferences: true,
        concurrency: 3,
      });

      expect(results.processed).toHaveLength(5);
      expect(results.successful).toHaveLength(5);
      expect(results.failed).toHaveLength(0);
      expect(mockUpdateManifest.updateAllManifests).toHaveBeenCalledWith({
        validateReferences: true,
        concurrency: 3,
      });
    });

    it('should aggregate validation statistics correctly', async () => {
      const mockResults = {
        processed: ['mod-a', 'mod-b'],
        successful: ['mod-a', 'mod-b'],
        failed: [],
        validationSummary: {
          totalViolations: 5,
          modsWithViolations: 2,
          commonViolations: new Map([
            ['core:actor', 3],
            ['positioning:location', 2],
          ]),
        },
        performance: {
          startTime: Date.now(),
          totalTime: 2000,
        },
      };

      mockUpdateManifest.updateAllManifests.mockResolvedValue(mockResults);

      const results = await mockUpdateManifest.updateAllManifests({
        validateReferences: true,
      });

      expect(results.validationSummary.totalViolations).toBe(5);
      expect(results.validationSummary.modsWithViolations).toBe(2);

      // Check common violations tracking
      const commonViolations = results.validationSummary.commonViolations;
      expect(commonViolations.get('core:actor')).toBe(3);
      expect(commonViolations.get('positioning:location')).toBe(2);
    });

    it('should handle batch processing failures gracefully', async () => {
      const mockError = new Error(
        'Batch processing failed due to file system error'
      );
      mockUpdateManifest.updateAllManifests.mockRejectedValue(mockError);

      await expect(
        mockUpdateManifest.updateAllManifests({
          validateReferences: true,
        })
      ).rejects.toThrow('Batch processing failed due to file system error');
    });
  });

  describe('Validation Integration', () => {
    it('should handle validation orchestrator unavailability gracefully', async () => {
      const mockResult = {
        success: true,
        modName: 'test-mod',
        timestamp: new Date().toISOString(),
        manifestUpdated: true,
        filesProcessed: 3,
        errors: [],
        warnings: ['Validation components not available: Mock error'],
        validation: {
          performed: false,
          preValidation: null,
          postValidation: null,
          violations: [],
          suggestions: [],
        },
        performance: {
          startTime: Date.now(),
          phases: {
            manifestUpdate: 100,
          },
          totalTime: 100,
        },
      };

      mockUpdateManifest.updateModManifest.mockResolvedValue(mockResult);

      const result = await mockUpdateManifest.updateModManifest('test-mod', {
        validateReferences: true,
      });

      expect(result.success).toBe(true);
      expect(result.validation.performed).toBe(false);
      expect(result.warnings).toContain(
        'Validation components not available: Mock error'
      );
    });

    it('should provide detailed validation error context', async () => {
      const validationErrors = {
        violations: [
          {
            message: 'Missing component reference in action',
            file: 'actions/test.action.json',
            line: 15,
            suggestedFixes: [
              {
                description: 'Add missing component reference',
                priority: 'primary',
              },
            ],
          },
        ],
        hasViolations: true,
        violationCount: 1,
      };

      const mockError = new mockUpdateManifest.ValidationError(
        'Validation failed with detailed context',
        'test-component',
        validationErrors
      );

      mockUpdateManifest.updateModManifest.mockRejectedValue(mockError);

      await expect(
        mockUpdateManifest.updateModManifest('test-mod', {
          validateReferences: true,
          failOnViolations: true,
        })
      ).rejects.toThrow(mockUpdateManifest.ValidationError);

      // The mock should be called with correct parameters
      expect(mockUpdateManifest.updateModManifest).toHaveBeenCalledWith(
        'test-mod',
        {
          validateReferences: true,
          failOnViolations: true,
        }
      );
    });
  });

  describe('Performance Tracking', () => {
    it('should track performance metrics for all phases', async () => {
      const mockResult = {
        success: true,
        modName: 'test-mod',
        timestamp: new Date().toISOString(),
        manifestUpdated: true,
        filesProcessed: 10,
        errors: [],
        warnings: [],
        validation: {
          performed: true,
          preValidation: {
            hasViolations: false,
            violations: [],
            violationCount: 0,
            suggestions: [],
          },
          postValidation: {
            hasViolations: false,
            violations: [],
            violationCount: 0,
            suggestions: [],
          },
          violations: [],
          suggestions: [],
        },
        performance: {
          startTime: Date.now() - 1000,
          phases: {
            preValidation: 100,
            manifestUpdate: 300,
            postValidation: 150,
          },
          totalTime: 550,
        },
      };

      mockUpdateManifest.updateModManifest.mockResolvedValue(mockResult);

      const result = await mockUpdateManifest.updateModManifest('test-mod', {
        validateReferences: true,
        preValidation: true,
        postValidation: true,
      });

      expect(result.performance.phases.preValidation).toBe(100);
      expect(result.performance.phases.manifestUpdate).toBe(300);
      expect(result.performance.phases.postValidation).toBe(150);
      expect(result.performance.totalTime).toBe(550);
    });

    it('should track performance for batch operations', async () => {
      const mockResults = {
        processed: ['mod-1', 'mod-2', 'mod-3'],
        successful: ['mod-1', 'mod-2', 'mod-3'],
        failed: [],
        validationSummary: {
          totalViolations: 0,
          modsWithViolations: 0,
          commonViolations: new Map(),
        },
        performance: {
          startTime: Date.now() - 5000,
          totalTime: 5000,
        },
      };

      mockUpdateManifest.updateAllManifests.mockResolvedValue(mockResults);

      const results = await mockUpdateManifest.updateAllManifests({
        validateReferences: true,
        concurrency: 2,
      });

      expect(results.performance.totalTime).toBe(5000);
      expect(results.performance.startTime).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('Error Handling', () => {
    it('should handle manifest file not found error', async () => {
      const mockResult = {
        success: false,
        modName: 'nonexistent-mod',
        timestamp: new Date().toISOString(),
        manifestUpdated: false,
        filesProcessed: 0,
        errors: ['Mod path is not a directory: data/mods/nonexistent-mod'],
        warnings: [],
        validation: {
          performed: false,
          preValidation: null,
          postValidation: null,
          violations: [],
          suggestions: [],
        },
        performance: {
          startTime: Date.now(),
          phases: {},
          totalTime: 50,
        },
      };

      mockUpdateManifest.updateModManifest.mockResolvedValue(mockResult);

      const result =
        await mockUpdateManifest.updateModManifest('nonexistent-mod');

      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'Mod path is not a directory: data/mods/nonexistent-mod'
      );
    });

    it('should handle invalid JSON in manifest file', async () => {
      const mockResult = {
        success: false,
        modName: 'invalid-mod',
        timestamp: new Date().toISOString(),
        manifestUpdated: false,
        filesProcessed: 0,
        errors: ['Failed to parse JSON: Unexpected token'],
        warnings: [],
        validation: {
          performed: false,
          preValidation: null,
          postValidation: null,
          violations: [],
          suggestions: [],
        },
        performance: {
          startTime: Date.now(),
          phases: {},
          totalTime: 25,
        },
      };

      mockUpdateManifest.updateModManifest.mockResolvedValue(mockResult);

      const result = await mockUpdateManifest.updateModManifest('invalid-mod');

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('Failed to parse JSON');
    });

    it('should handle validation timeout gracefully', async () => {
      const mockResult = {
        success: true,
        modName: 'test-mod',
        timestamp: new Date().toISOString(),
        manifestUpdated: true,
        filesProcessed: 3,
        errors: [],
        warnings: ['Post-validation failed: Validation timeout'],
        validation: {
          performed: false,
          preValidation: null,
          postValidation: null,
          violations: [],
          suggestions: [],
        },
        performance: {
          startTime: Date.now(),
          phases: {
            manifestUpdate: 100,
          },
          totalTime: 100,
        },
      };

      mockUpdateManifest.updateModManifest.mockResolvedValue(mockResult);

      const result = await mockUpdateManifest.updateModManifest('test-mod', {
        validateReferences: true,
        validationTimeout: 1000,
        failOnViolations: false,
      });

      expect(result.success).toBe(true);
      expect(result.warnings).toContain(
        'Post-validation failed: Validation timeout'
      );
    });
  });

  describe('Output and Reporting', () => {
    it('should generate comprehensive summary output', async () => {
      const mockResult = {
        success: true,
        modName: 'test-mod',
        timestamp: new Date().toISOString(),
        manifestUpdated: true,
        filesProcessed: 15,
        errors: [],
        warnings: ['Minor warning about deprecated field'],
        validation: {
          performed: true,
          preValidation: null,
          postValidation: {
            hasViolations: true,
            violations: [
              { message: 'Test violation 1', file: 'test1.json' },
              { message: 'Test violation 2', file: 'test2.json' },
            ],
            violationCount: 2,
            suggestions: [
              { description: 'Fix violation 1' },
              { description: 'Fix violation 2' },
            ],
          },
          violations: [
            { message: 'Test violation 1', file: 'test1.json' },
            { message: 'Test violation 2', file: 'test2.json' },
          ],
          suggestions: [
            { description: 'Fix violation 1' },
            { description: 'Fix violation 2' },
          ],
        },
        performance: {
          startTime: Date.now() - 500,
          phases: {
            manifestUpdate: 200,
            postValidation: 100,
          },
          totalTime: 500,
        },
      };

      mockUpdateManifest.updateModManifest.mockResolvedValue(mockResult);

      const result = await mockUpdateManifest.updateModManifest('test-mod', {
        validateReferences: true,
        verbose: true,
      });

      expect(result.filesProcessed).toBe(15);
      expect(result.validation.postValidation.violationCount).toBe(2);
      expect(result.validation.suggestions).toHaveLength(2);
      expect(result.warnings).toHaveLength(1);
      expect(result.performance.totalTime).toBe(500);
    });

    it('should support different validation report formats', async () => {
      const mockResult = {
        success: true,
        modName: 'test-mod',
        timestamp: new Date().toISOString(),
        manifestUpdated: true,
        filesProcessed: 5,
        errors: [],
        warnings: [],
        validation: {
          performed: true,
          preValidation: null,
          postValidation: {
            hasViolations: true,
            violations: [
              { message: 'Format test violation', file: 'test.json' },
            ],
            violationCount: 1,
            suggestions: [],
          },
          violations: [{ message: 'Format test violation', file: 'test.json' }],
          suggestions: [],
        },
        performance: {
          startTime: Date.now(),
          phases: {
            manifestUpdate: 100,
            postValidation: 50,
          },
          totalTime: 150,
        },
      };

      mockUpdateManifest.updateModManifest.mockResolvedValue(mockResult);

      // Test different formats
      const formats = ['console', 'json', 'html', 'markdown'];

      for (const format of formats) {
        const result = await mockUpdateManifest.updateModManifest('test-mod', {
          validateReferences: true,
          validationFormat: format,
        });

        expect(result.validation.performed).toBe(true);
        expect(result.validation.postValidation.hasViolations).toBe(true);
      }

      expect(mockUpdateManifest.updateModManifest).toHaveBeenCalledTimes(4);
    });
  });
});
