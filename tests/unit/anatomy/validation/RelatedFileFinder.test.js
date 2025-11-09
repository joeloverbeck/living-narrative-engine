/**
 * @file Unit tests for RelatedFileFinder
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { RelatedFileFinder } from '../../../../src/anatomy/validation/RelatedFileFinder.js';
import { ValidationReport } from '../../../../src/anatomy/validation/ValidationReport.js';

describe('RelatedFileFinder', () => {
  let mockReportData;
  let report;

  beforeEach(() => {
    mockReportData = {
      recipeId: 'test:recipe',
      recipePath: 'data/mods/test/recipes/test.recipe.json',
      timestamp: '2025-01-01T00:00:00.000Z',
      errors: [],
      warnings: [],
      suggestions: [],
      passed: [],
    };
  });

  describe('extractFiles', () => {
    it('should extract recipe file from summary', () => {
      report = new ValidationReport(mockReportData);
      const files = RelatedFileFinder.extractFiles(report);

      expect(files.recipes).toContain('data/mods/test/recipes/test.recipe.json');
      expect(files.total).toBe(1);
    });

    it('should extract blueprint files from errors', () => {
      mockReportData.errors = [
        {
          type: 'BLUEPRINT_NOT_FOUND',
          blueprintId: 'core:humanoid',
        },
      ];
      report = new ValidationReport(mockReportData);
      const files = RelatedFileFinder.extractFiles(report);

      expect(files.blueprints).toContain('data/mods/core/blueprints/humanoid.blueprint.json');
    });

    it('should extract component files from errors', () => {
      mockReportData.errors = [
        {
          type: 'COMPONENT_NOT_FOUND',
          componentId: 'core:actor',
        },
      ];
      report = new ValidationReport(mockReportData);
      const files = RelatedFileFinder.extractFiles(report);

      expect(files.components).toContain('data/mods/core/components/actor.component.json');
    });

    it('should extract files from fix messages', () => {
      mockReportData.errors = [
        {
          type: 'BLUEPRINT_NOT_FOUND',
          blueprintId: 'test:custom',
          fix: 'Create blueprint at data/mods/test/blueprints/custom.blueprint.json',
        },
      ];
      report = new ValidationReport(mockReportData);
      const files = RelatedFileFinder.extractFiles(report);

      expect(files.blueprints).toContain('data/mods/test/blueprints/custom.blueprint.json');
    });

    it('should extract files from suggestion messages', () => {
      mockReportData.warnings = [
        {
          type: 'MISSING_COMPONENT',
          suggestion: 'Add component at data/mods/test/components/missing.component.json',
        },
      ];
      report = new ValidationReport(mockReportData);
      const files = RelatedFileFinder.extractFiles(report);

      expect(files.components).toContain('data/mods/test/components/missing.component.json');
    });

    it('should handle multiple file types', () => {
      mockReportData.errors = [
        {
          blueprintId: 'core:humanoid',
        },
        {
          componentId: 'core:actor',
        },
      ];
      report = new ValidationReport(mockReportData);
      const files = RelatedFileFinder.extractFiles(report);

      expect(files.blueprints.length).toBe(1);
      expect(files.components.length).toBe(1);
      expect(files.recipes.length).toBe(1);
      expect(files.total).toBe(3);
    });

    it('should deduplicate file references', () => {
      mockReportData.errors = [
        {
          blueprintId: 'core:humanoid',
        },
        {
          blueprintId: 'core:humanoid',
        },
      ];
      report = new ValidationReport(mockReportData);
      const files = RelatedFileFinder.extractFiles(report);

      expect(files.blueprints.length).toBe(1);
    });

    it('should sort file paths', () => {
      mockReportData.errors = [
        {
          componentId: 'core:zebra',
        },
        {
          componentId: 'core:actor',
        },
      ];
      report = new ValidationReport(mockReportData);
      const files = RelatedFileFinder.extractFiles(report);

      expect(files.components[0]).toBe('data/mods/core/components/actor.component.json');
      expect(files.components[1]).toBe('data/mods/core/components/zebra.component.json');
    });

    it('should handle issues without file references', () => {
      mockReportData.errors = [
        {
          type: 'GENERIC_ERROR',
          message: 'Generic error without file references',
        },
      ];
      report = new ValidationReport(mockReportData);
      const files = RelatedFileFinder.extractFiles(report);

      expect(files.total).toBe(1); // Only recipe file
    });

    it('should handle report without recipePath', () => {
      delete mockReportData.recipePath;
      report = new ValidationReport(mockReportData);
      const files = RelatedFileFinder.extractFiles(report);

      expect(files.recipes).toEqual([]);
      expect(files.total).toBe(0);
    });

    it('should extract from warnings and suggestions', () => {
      mockReportData.warnings = [
        {
          componentId: 'core:warning_component',
        },
      ];
      mockReportData.suggestions = [
        {
          componentId: 'core:suggestion_component',
        },
      ];
      report = new ValidationReport(mockReportData);
      const files = RelatedFileFinder.extractFiles(report);

      expect(files.components).toContain('data/mods/core/components/warning_component.component.json');
      expect(files.components).toContain('data/mods/core/components/suggestion_component.component.json');
    });
  });

  describe('formatFileList', () => {
    it('should format file list with sections', () => {
      mockReportData.errors = [
        {
          blueprintId: 'core:humanoid',
          componentId: 'core:actor',
        },
      ];
      report = new ValidationReport(mockReportData);
      const files = RelatedFileFinder.extractFiles(report);
      const formatted = RelatedFileFinder.formatFileList(files);

      expect(formatted).toContain('Related Files:');
      expect(formatted).toContain('Recipes (1):');
      expect(formatted).toContain('Blueprints (1):');
      expect(formatted).toContain('Components (1):');
      expect(formatted).toContain('Total: 3 file(s)');
    });

    it('should handle empty file list', () => {
      const emptyFiles = {
        recipes: [],
        blueprints: [],
        components: [],
        other: [],
        total: 0,
      };
      const formatted = RelatedFileFinder.formatFileList(emptyFiles);

      expect(formatted).toContain('Related Files:');
      expect(formatted).toContain('Total: 0 file(s)');
    });

    it('should include other files section', () => {
      const files = {
        recipes: [],
        blueprints: [],
        components: [],
        other: ['data/mods/test/other/file.txt'],
        total: 1,
      };
      const formatted = RelatedFileFinder.formatFileList(files);

      expect(formatted).toContain('Other (1):');
      expect(formatted).toContain('data/mods/test/other/file.txt');
    });
  });

  describe('generateFileCommands', () => {
    it('should generate shell commands for file checks', () => {
      mockReportData.errors = [
        {
          blueprintId: 'core:humanoid',
        },
      ];
      report = new ValidationReport(mockReportData);
      const files = RelatedFileFinder.extractFiles(report);
      const commands = RelatedFileFinder.generateFileCommands(files);

      expect(commands.length).toBeGreaterThan(0);
      expect(commands.join('\n')).toContain('if [ ! -f');
      expect(commands.join('\n')).toContain('mkdir -p');
      expect(commands.join('\n')).toContain('data/mods/');
    });

    it('should handle multiple files', () => {
      mockReportData.errors = [
        {
          blueprintId: 'core:humanoid',
          componentId: 'core:actor',
        },
      ];
      report = new ValidationReport(mockReportData);
      const files = RelatedFileFinder.extractFiles(report);
      const commands = RelatedFileFinder.generateFileCommands(files);

      const commandText = commands.join('\n');
      expect(commandText).toContain('humanoid.blueprint.json');
      expect(commandText).toContain('actor.component.json');
      expect(commandText).toContain('test.recipe.json');
    });

    it('should handle empty file list', () => {
      const emptyFiles = {
        recipes: [],
        blueprints: [],
        components: [],
        other: [],
        total: 0,
      };
      const commands = RelatedFileFinder.generateFileCommands(emptyFiles);

      expect(commands).toEqual([]);
    });
  });
});
