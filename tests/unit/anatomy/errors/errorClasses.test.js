/**
 * @file Unit tests for anatomy error classes
 * @description Tests error creation, formatting, and serialization
 */

import { describe, it, expect } from '@jest/globals';
import AnatomyError from '../../../../src/anatomy/errors/AnatomyError.js';
import ComponentNotFoundError from '../../../../src/anatomy/errors/ComponentNotFoundError.js';
import InvalidPropertyError from '../../../../src/anatomy/errors/InvalidPropertyError.js';
import SocketNotFoundError from '../../../../src/anatomy/errors/SocketNotFoundError.js';
import RecipeValidationError from '../../../../src/anatomy/errors/RecipeValidationError.js';
import { createError, ERROR_TEMPLATES } from '../../../../src/anatomy/errors/errorTemplates.js';

describe('AnatomyError Base Class', () => {
  it('should create error with all fields', () => {
    const error = new AnatomyError({
      context: 'Test context',
      problem: 'Test problem',
      impact: 'Test impact',
      fix: 'Test fix',
      references: ['ref1', 'ref2'],
    });

    expect(error.name).toBe('AnatomyError');
    expect(error.context).toBe('Test context');
    expect(error.problem).toBe('Test problem');
    expect(error.impact).toBe('Test impact');
    expect(error.fix).toBe('Test fix');
    expect(error.references).toEqual(['ref1', 'ref2']);
    expect(error.timestamp).toBeDefined();
  });

  it('should format toString() correctly with all fields', () => {
    const error = new AnatomyError({
      context: 'Test context',
      problem: 'Test problem',
      impact: 'Test impact',
      fix: 'Test fix',
      references: ['ref1', 'ref2'],
    });

    const str = error.toString();

    expect(str).toContain('[AnatomyError]');
    expect(str).toContain('Context:  Test context');
    expect(str).toContain('Problem:  Test problem');
    expect(str).toContain('Impact:   Test impact');
    expect(str).toContain('Fix:      Test fix');
    expect(str).toContain('References:');
    expect(str).toContain('  - ref1');
    expect(str).toContain('  - ref2');
    expect(str).toContain('='.repeat(80));
  });

  it('should format toString() with array fix', () => {
    const error = new AnatomyError({
      problem: 'Test problem',
      fix: ['Step 1', 'Step 2', 'Step 3'],
    });

    const str = error.toString();

    expect(str).toContain('Fix:');
    expect(str).toContain('  Step 1');
    expect(str).toContain('  Step 2');
    expect(str).toContain('  Step 3');
  });

  it('should format toString() without optional fields', () => {
    const error = new AnatomyError({
      problem: 'Test problem',
    });

    const str = error.toString();

    expect(str).toContain('Problem:  Test problem');
    expect(str).not.toContain('Context:');
    expect(str).not.toContain('Impact:');
    expect(str).not.toContain('Fix:');
    expect(str).not.toContain('References:');
  });

  it('should include original error in toString()', () => {
    const originalError = new Error('Original error message');
    const error = new AnatomyError({
      problem: 'Test problem',
      originalError,
    });

    const str = error.toString();

    expect(str).toContain('Original Error:');
    expect(str).toContain('Original error message');
  });

  it('should serialize to JSON correctly', () => {
    const error = new AnatomyError({
      context: 'Test context',
      problem: 'Test problem',
      impact: 'Test impact',
      fix: 'Test fix',
      references: ['ref1'],
    });

    const json = error.toJSON();

    expect(json.name).toBe('AnatomyError');
    expect(json.context).toBe('Test context');
    expect(json.problem).toBe('Test problem');
    expect(json.impact).toBe('Test impact');
    expect(json.fix).toBe('Test fix');
    expect(json.references).toEqual(['ref1']);
    expect(json.timestamp).toBeDefined();
  });

  it('should handle empty references array', () => {
    const error = new AnatomyError({
      problem: 'Test problem',
      references: [],
    });

    const str = error.toString();

    expect(str).not.toContain('References:');
  });
});

describe('ComponentNotFoundError', () => {
  it('should create error with correct structure', () => {
    const error = new ComponentNotFoundError({
      recipeId: 'human_female',
      location: { type: 'slot', name: 'torso' },
      componentId: 'anatomy:missing_component',
      recipePath: '/path/to/recipe.json',
    });

    expect(error.name).toBe('ComponentNotFoundError');
    expect(error.recipeId).toBe('human_female');
    expect(error.componentId).toBe('anatomy:missing_component');
    expect(error.location).toEqual({ type: 'slot', name: 'torso' });
    expect(error.recipePath).toBe('/path/to/recipe.json');
  });

  it('should format context correctly', () => {
    const error = new ComponentNotFoundError({
      recipeId: 'human_female',
      location: { type: 'slot', name: 'torso' },
      componentId: 'anatomy:missing_component',
    });

    const str = error.toString();

    expect(str).toContain("Recipe 'human_female', slot 'torso'");
    expect(str).toContain("Component 'anatomy:missing_component' does not exist");
  });

  it('should include example component structure in fix', () => {
    const error = new ComponentNotFoundError({
      recipeId: 'human_female',
      location: { type: 'slot', name: 'torso' },
      componentId: 'anatomy:missing_component',
    });

    const str = error.toString();

    expect(str).toContain('Example Component Structure:');
    expect(str).toContain('"$schema": "schema://living-narrative-engine/component.schema.json"');
    expect(str).toContain('"id": "anatomy:missing_component"');
  });

  it('should include references to documentation', () => {
    const error = new ComponentNotFoundError({
      recipeId: 'human_female',
      location: { type: 'slot', name: 'torso' },
      componentId: 'anatomy:missing_component',
    });

    const str = error.toString();

    expect(str).toContain('docs/anatomy/anatomy-system-guide.md');
    expect(str).toContain('data/mods/anatomy/components/part.component.json');
  });
});

describe('InvalidPropertyError', () => {
  it('should create error with valid values', () => {
    const error = new InvalidPropertyError({
      recipeId: 'human_female',
      location: { type: 'slot', name: 'torso' },
      componentId: 'anatomy:body',
      property: 'build',
      currentValue: 'invalid_build',
      validValues: ['slim', 'average', 'muscular', 'heavy'],
      schemaPath: 'data/mods/anatomy/components/body.component.json',
    });

    expect(error.property).toBe('build');
    expect(error.currentValue).toBe('invalid_build');
    expect(error.validValues).toEqual(['slim', 'average', 'muscular', 'heavy']);
  });

  it('should include valid values in fix section', () => {
    const error = new InvalidPropertyError({
      recipeId: 'human_female',
      location: { type: 'slot', name: 'torso' },
      componentId: 'anatomy:body',
      property: 'build',
      currentValue: 'invalid_build',
      validValues: ['slim', 'average', 'muscular'],
    });

    const str = error.toString();

    expect(str).toContain('Valid Values: ["slim", "average", "muscular"]');
  });

  it('should include suggestion in fix section when provided', () => {
    const error = new InvalidPropertyError({
      recipeId: 'human_female',
      location: { type: 'slot', name: 'torso' },
      componentId: 'anatomy:body',
      property: 'build',
      currentValue: 'invalid_build',
      validValues: ['slim', 'average', 'muscular'],
      suggestion: 'average',
    });

    const str = error.toString();

    expect(str).toContain('Suggested Fix:');
    expect(str).toContain('"build": "average"');
    expect(str).toContain('// Changed from "invalid_build"');
  });

  it('should include schema path in references', () => {
    const error = new InvalidPropertyError({
      recipeId: 'human_female',
      location: { type: 'slot', name: 'torso' },
      componentId: 'anatomy:body',
      property: 'build',
      currentValue: 'invalid_build',
      validValues: ['slim', 'average'],
      schemaPath: 'data/mods/anatomy/components/body.component.json',
    });

    const str = error.toString();

    expect(str).toContain('Component Schema: data/mods/anatomy/components/body.component.json');
  });
});

describe('SocketNotFoundError', () => {
  it('should create error with socket information', () => {
    const error = new SocketNotFoundError({
      blueprintId: 'human_female',
      slotName: 'torso',
      socketId: 'missing_socket',
      rootEntityId: 'humanoid_torso',
      availableSockets: ['left_shoulder', 'right_shoulder'],
      entityPath: 'data/mods/anatomy/entities/humanoid_torso.entity.json',
    });

    expect(error.blueprintId).toBe('human_female');
    expect(error.slotName).toBe('torso');
    expect(error.socketId).toBe('missing_socket');
    expect(error.rootEntityId).toBe('humanoid_torso');
    expect(error.availableSockets).toEqual(['left_shoulder', 'right_shoulder']);
  });

  it('should include two fix options', () => {
    const error = new SocketNotFoundError({
      blueprintId: 'human_female',
      slotName: 'torso',
      socketId: 'missing_socket',
      rootEntityId: 'humanoid_torso',
      availableSockets: ['left_shoulder', 'right_shoulder'],
      entityPath: 'data/mods/anatomy/entities/humanoid_torso.entity.json',
    });

    const str = error.toString();

    expect(str).toContain('Option 1: Add socket to root entity');
    expect(str).toContain('Option 2: Use existing socket');
  });

  it('should include socket structure example', () => {
    const error = new SocketNotFoundError({
      blueprintId: 'human_female',
      slotName: 'torso',
      socketId: 'missing_socket',
      rootEntityId: 'humanoid_torso',
      availableSockets: [],
    });

    const str = error.toString();

    expect(str).toContain('"id": "missing_socket"');
    expect(str).toContain('"allowedTypes": ["part_type_here"]');
    expect(str).toContain('"orientation": "mid"');
    expect(str).toContain('"nameTpl": "{{type}}"');
  });

  it('should list available sockets', () => {
    const error = new SocketNotFoundError({
      blueprintId: 'human_female',
      slotName: 'torso',
      socketId: 'missing_socket',
      rootEntityId: 'humanoid_torso',
      availableSockets: ['left_shoulder', 'right_shoulder', 'neck'],
    });

    const str = error.toString();

    expect(str).toContain('Available sockets: [left_shoulder, right_shoulder, neck]');
  });

  it('should include entity path when provided', () => {
    const error = new SocketNotFoundError({
      blueprintId: 'human_female',
      slotName: 'torso',
      socketId: 'missing_socket',
      rootEntityId: 'humanoid_torso',
      availableSockets: [],
      entityPath: 'data/mods/anatomy/entities/humanoid_torso.entity.json',
    });

    const str = error.toString();

    expect(str).toContain('File: data/mods/anatomy/entities/humanoid_torso.entity.json');
  });
});

describe('RecipeValidationError', () => {
  it('should create error with validation report', () => {
    const report = {
      summary: {
        recipeId: 'human_female',
      },
      errors: [
        { message: 'Error 1' },
        { message: 'Error 2' },
      ],
      warnings: [
        { message: 'Warning 1' },
      ],
    };

    const error = new RecipeValidationError({ message: 'Recipe validation failed', report });

    expect(error.report).toBe(report);
  });

  it('should include error and warning counts in fix', () => {
    const report = {
      summary: {
        recipeId: 'human_female',
      },
      errors: [
        { message: 'Error 1' },
        { message: 'Error 2' },
        { message: 'Error 3' },
      ],
      warnings: [
        { message: 'Warning 1' },
        { message: 'Warning 2' },
      ],
    };

    const error = new RecipeValidationError({ message: 'Recipe validation failed', report });
    const str = error.toString();

    expect(str).toContain('Errors: 3');
    expect(str).toContain('Warnings: 2');
  });

  it('should reference recipe ID in context', () => {
    const report = {
      summary: {
        recipeId: 'human_female',
      },
      errors: [],
      warnings: [],
    };

    const error = new RecipeValidationError({ message: 'Recipe validation failed', report });
    const str = error.toString();

    expect(str).toContain("Recipe Validation: human_female");
  });

  it('should include validation references', () => {
    const report = {
      summary: {
        recipeId: 'human_female',
      },
      errors: [],
      warnings: [],
    };

    const error = new RecipeValidationError({ message: 'Recipe validation failed', report });
    const str = error.toString();

    expect(str).toContain('docs/anatomy/troubleshooting.md');
    expect(str).toContain('src/anatomy/validation/RecipePreflightValidator.js');
  });
});

describe('Error Templates', () => {
  it('should register all error types', () => {
    expect(ERROR_TEMPLATES.COMPONENT_NOT_FOUND).toBe(ComponentNotFoundError);
    expect(ERROR_TEMPLATES.INVALID_PROPERTY).toBe(InvalidPropertyError);
    expect(ERROR_TEMPLATES.SOCKET_NOT_FOUND).toBe(SocketNotFoundError);
    expect(ERROR_TEMPLATES.RECIPE_VALIDATION).toBe(RecipeValidationError);
  });

  it('should create ComponentNotFoundError via template', () => {
    const error = createError('COMPONENT_NOT_FOUND', {
      recipeId: 'human_female',
      location: { type: 'slot', name: 'torso' },
      componentId: 'anatomy:missing',
    });

    expect(error).toBeInstanceOf(ComponentNotFoundError);
    expect(error.componentId).toBe('anatomy:missing');
  });

  it('should create InvalidPropertyError via template', () => {
    const error = createError('INVALID_PROPERTY', {
      recipeId: 'human_female',
      location: { type: 'slot', name: 'torso' },
      componentId: 'anatomy:body',
      property: 'build',
      currentValue: 'invalid',
      validValues: ['slim', 'average'],
    });

    expect(error).toBeInstanceOf(InvalidPropertyError);
    expect(error.property).toBe('build');
  });

  it('should create SocketNotFoundError via template', () => {
    const error = createError('SOCKET_NOT_FOUND', {
      blueprintId: 'human_female',
      slotName: 'torso',
      socketId: 'missing',
      rootEntityId: 'humanoid_torso',
      availableSockets: [],
    });

    expect(error).toBeInstanceOf(SocketNotFoundError);
    expect(error.socketId).toBe('missing');
  });

  it('should create RecipeValidationError via template', () => {
    const report = {
      summary: { recipeId: 'human_female' },
      errors: [],
      warnings: [],
    };

    const error = createError('RECIPE_VALIDATION', {
      message: 'Validation failed',
      report,
    });

    expect(error).toBeInstanceOf(RecipeValidationError);
    expect(error.report).toBe(report);
  });

  it('should throw error for unknown template type', () => {
    expect(() => {
      createError('UNKNOWN_TYPE', {});
    }).toThrow('Unknown error type: UNKNOWN_TYPE');
  });
});
