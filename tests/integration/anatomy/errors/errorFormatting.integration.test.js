/**
 * @file Integration tests for anatomy error formatting
 * @description Tests complete error formatting scenarios with realistic data
 */

import { describe, it, expect } from '@jest/globals';
import {
  ComponentNotFoundError,
  InvalidPropertyError,
  SocketNotFoundError,
  RecipeValidationError,
  createError,
} from '../../../../src/anatomy/errors/index.js';

describe('Error Formatting Integration', () => {
  describe('ComponentNotFoundError - Complete Scenario', () => {
    it('should format complete error with all information', () => {
      const error = new ComponentNotFoundError({
        recipeId: 'human_female',
        location: { type: 'slot', name: 'torso' },
        componentId: 'anatomy:scaled_skin',
        recipePath: 'data/mods/anatomy/recipes/human_female.recipe.json',
      });

      const str = error.toString();
      const json = error.toJSON();

      // Verify toString formatting
      expect(str).toContain('[ComponentNotFoundError]');
      expect(str).toContain("Recipe 'human_female'");
      expect(str).toContain("slot 'torso'");
      expect(str).toContain("Component 'anatomy:scaled_skin' does not exist");
      expect(str).toContain(
        'slot cannot be processed, anatomy generation will fail'
      );
      expect(str).toContain(
        'Create component at: data/mods/*/components/scaled_skin.component.json'
      );
      expect(str).toContain('Example Component Structure:');
      expect(str).toContain('docs/anatomy/anatomy-system-guide.md');

      // Verify JSON serialization
      expect(json.name).toBe('ComponentNotFoundError');
      expect(json.problem).toContain('anatomy:scaled_skin');
      expect(json.context).toContain('human_female');
      expect(json.timestamp).toBeDefined();
      expect(Array.isArray(json.fix)).toBe(true);
      expect(Array.isArray(json.references)).toBe(true);
    });

    it('should work with pattern location type', () => {
      const error = new ComponentNotFoundError({
        recipeId: 'dragon_scale',
        location: { type: 'pattern', name: 'body_scales' },
        componentId: 'anatomy-creatures:dragon_scale',
      });

      const str = error.toString();

      expect(str).toContain("pattern 'body_scales'");
      expect(str).toContain('pattern cannot be processed');
    });
  });

  describe('InvalidPropertyError - Complete Scenario', () => {
    it('should format complete error with suggestion', () => {
      const error = new InvalidPropertyError({
        recipeId: 'human_female',
        location: { type: 'slot', name: 'torso' },
        componentId: 'anatomy:body',
        property: 'build',
        currentValue: 'super_muscular',
        validValues: ['slim', 'average', 'muscular', 'heavy'],
        suggestion: 'muscular',
        schemaPath: 'data/mods/anatomy/components/body.component.json',
      });

      const str = error.toString();
      const json = error.toJSON();

      // Verify toString formatting
      expect(str).toContain('[InvalidPropertyError]');
      expect(str).toContain("Recipe 'human_female'");
      expect(str).toContain("Component 'anatomy:body'");
      expect(str).toContain(
        "Property 'build' has invalid value 'super_muscular'"
      );
      expect(str).toContain(
        'Valid Values: ["slim", "average", "muscular", "heavy"]'
      );
      expect(str).toContain('Suggested Fix:');
      expect(str).toContain('"build": "muscular"');
      expect(str).toContain('// Changed from "super_muscular"');
      expect(str).toContain(
        'Component Schema: data/mods/anatomy/components/body.component.json'
      );

      // Verify JSON serialization
      expect(json.name).toBe('InvalidPropertyError');
      expect(json.problem).toContain('build');
      expect(json.problem).toContain('super_muscular');
    });

    it('should format error without suggestion', () => {
      const error = new InvalidPropertyError({
        recipeId: 'human_female',
        location: { type: 'slot', name: 'torso' },
        componentId: 'anatomy:body',
        property: 'build',
        currentValue: 'invalid',
        validValues: ['slim', 'average', 'muscular'],
      });

      const str = error.toString();

      expect(str).toContain('Valid Values: ["slim", "average", "muscular"]');
      expect(str).not.toContain('Suggested Fix:');
    });
  });

  describe('SocketNotFoundError - Complete Scenario', () => {
    it('should format complete error with available sockets', () => {
      const error = new SocketNotFoundError({
        blueprintId: 'human_female',
        slotName: 'left_arm',
        socketId: 'left_wrist',
        rootEntityId: 'humanoid_arm',
        availableSockets: ['left_elbow', 'left_shoulder'],
        entityPath:
          'data/mods/anatomy/entities/definitions/humanoid_arm.entity.json',
      });

      const str = error.toString();
      const json = error.toJSON();

      // Verify toString formatting
      expect(str).toContain('[SocketNotFoundError]');
      expect(str).toContain("Blueprint 'human_female'");
      expect(str).toContain("Slot 'left_arm'");
      expect(str).toContain(
        "Socket 'left_wrist' not found on root entity 'humanoid_arm'"
      );
      expect(str).toContain(
        'Slot processing will fail during anatomy generation'
      );
      expect(str).toContain('Option 1: Add socket to root entity');
      expect(str).toContain(
        'File: data/mods/anatomy/entities/definitions/humanoid_arm.entity.json'
      );
      expect(str).toContain('"id": "left_wrist"');
      expect(str).toContain('"allowedTypes": ["part_type_here"]');
      expect(str).toContain('Option 2: Use existing socket');
      expect(str).toContain('Available sockets: [left_elbow, left_shoulder]');

      // Verify JSON serialization
      expect(json.name).toBe('SocketNotFoundError');
      expect(json.problem).toContain('left_wrist');
      expect(json.context).toContain('human_female');
    });

    it('should format error without entity path', () => {
      const error = new SocketNotFoundError({
        blueprintId: 'human_female',
        slotName: 'left_arm',
        socketId: 'left_wrist',
        rootEntityId: 'humanoid_arm',
        availableSockets: [],
      });

      const str = error.toString();

      expect(str).toContain('Option 1: Add socket to root entity');
      expect(str).not.toContain('File:');
      expect(str).toContain('Available sockets: []');
    });
  });

  describe('RecipeValidationError - Complete Scenario', () => {
    it('should format complete error with validation report', () => {
      const report = {
        summary: {
          recipeId: 'human_female',
        },
        errors: [
          { message: 'Component not found: anatomy:missing1' },
          { message: 'Component not found: anatomy:missing2' },
          { message: 'Invalid property value' },
        ],
        warnings: [
          { message: 'Unused socket: extra_socket' },
          { message: 'Performance warning' },
        ],
      };

      const error = new RecipeValidationError({
        message: 'Recipe validation failed with 3 errors',
        report,
      });

      const str = error.toString();
      const json = error.toJSON();

      // Verify toString formatting
      expect(str).toContain('[RecipeValidationError]');
      expect(str).toContain('Recipe Validation: human_female');
      expect(str).toContain('Recipe validation failed with 3 errors');
      expect(str).toContain(
        'Recipe cannot be loaded due to 3 validation error(s)'
      );
      expect(str).toContain('Errors: 3');
      expect(str).toContain('Warnings: 2');
      expect(str).toContain(
        'Check RecipeValidationRunner for validation pipeline logic'
      );
      expect(str).toContain('docs/anatomy/troubleshooting.md');
      expect(str).toContain('src/anatomy/validation/RecipeValidationRunner.js');

      // Verify JSON serialization
      expect(json.name).toBe('RecipeValidationError');
      expect(json.problem).toContain('3 errors');
      expect(json.impact).toContain('3 validation error(s)');
    });

    it('should handle report with no warnings', () => {
      const report = {
        summary: {
          recipeId: 'simple_recipe',
        },
        errors: [{ message: 'Single error' }],
        warnings: [],
      };

      const error = new RecipeValidationError({
        message: 'Recipe validation failed',
        report,
      });

      const str = error.toString();

      expect(str).toContain('Errors: 1');
      expect(str).toContain('Warnings: 0');
    });
  });

  describe('Error Creation via Templates', () => {
    it('should create and format ComponentNotFoundError via template', () => {
      const error = createError('COMPONENT_NOT_FOUND', {
        recipeId: 'test_recipe',
        location: { type: 'slot', name: 'test_slot' },
        componentId: 'test:component',
      });

      expect(error).toBeInstanceOf(ComponentNotFoundError);

      const str = error.toString();
      expect(str).toContain('[ComponentNotFoundError]');
      expect(str).toContain('test_recipe');
      expect(str).toContain('test:component');
    });

    it('should create and format InvalidPropertyError via template', () => {
      const error = createError('INVALID_PROPERTY', {
        recipeId: 'test_recipe',
        location: { type: 'slot', name: 'test_slot' },
        componentId: 'test:component',
        property: 'testProp',
        currentValue: 'invalid',
        validValues: ['valid1', 'valid2'],
      });

      expect(error).toBeInstanceOf(InvalidPropertyError);

      const str = error.toString();
      expect(str).toContain('[InvalidPropertyError]');
      expect(str).toContain('testProp');
      expect(str).toContain('valid1');
    });
  });

  describe('Error Chaining and Context', () => {
    it('should include original error in formatting', () => {
      const originalError = new Error('Database connection failed');
      const error = new ComponentNotFoundError({
        recipeId: 'test',
        location: { type: 'slot', name: 'test' },
        componentId: 'test:component',
      });
      error.originalError = originalError;

      const str = error.toString();
      const json = error.toJSON();

      expect(str).toContain('Original Error:');
      expect(str).toContain('Database connection failed');
      expect(json.originalError).toBe('Database connection failed');
    });
  });

  describe('Console Output Readability', () => {
    it('should produce readable multi-line output', () => {
      const error = new InvalidPropertyError({
        recipeId: 'human_female',
        location: { type: 'slot', name: 'torso' },
        componentId: 'anatomy:body',
        property: 'build',
        currentValue: 'super_heavy',
        validValues: ['slim', 'average', 'muscular', 'heavy'],
        suggestion: 'heavy',
        schemaPath: 'data/mods/anatomy/components/body.component.json',
      });

      const str = error.toString();
      const lines = str.split('\n');

      // Should have clear section separators
      const separatorLines = lines.filter((line) => line.includes('==='));
      expect(separatorLines.length).toBeGreaterThanOrEqual(2);

      // Should have consistent indentation for fix steps
      const fixLines = lines.filter((line) => line.startsWith('  '));
      expect(fixLines.length).toBeGreaterThan(0);

      // Should have proper spacing between sections
      const emptyLines = lines.filter((line) => line === '');
      expect(emptyLines.length).toBeGreaterThan(0);
    });
  });
});
