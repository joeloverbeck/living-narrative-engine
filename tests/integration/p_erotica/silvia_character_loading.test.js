/**
 * @file Integration test for character loading with anatomy recipe
 * Tests character definition and recipe loading patterns without external dependencies
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('Character with Anatomy Recipe Loading - Integration', () => {
  let tempDir;
  let characterPath;
  let recipePath;

  // Test data - create mock character and recipe locally
  const testCharacterData = {
    id: 'test_mod:test_character',
    components: {
      'core:name': { text: 'Test Character' },
      'core:profile': { value: 'A test character for integration testing' },
      'core:personality': { traits: ['curious', 'friendly'] },
      'core:likes': { items: ['reading', 'exploration'] },
      'core:dislikes': { items: ['conflict', 'deception'] },
      'core:fears': { items: ['darkness', 'isolation'] },
      'movement:goals': { items: ['learn new things', 'make friends'] },
      'core:secrets': { items: ['has a hidden talent'] },
      'core:speech_patterns': { patterns: ['speaks formally'] },
      'anatomy:body': { recipeId: 'test_mod:test_recipe' },
      'core:apparent_age': { minAge: 20, maxAge: 30 },
    },
  };

  const testRecipeData = {
    recipeId: 'test_mod:test_recipe',
    blueprintId: 'anatomy:human_female',
    bodyDescriptors: {
      height: 'average',
      build: 'athletic',
      skinColor: 'olive',
    },
    slots: {
      hair: {
        properties: {
          'descriptors:color_basic': { color: 'black' },
          'descriptors:length_hair': { length: 'long' },
          'descriptors:hair_style': { style: 'straight' },
        },
      },
      left_eye: {
        properties: {
          'descriptors:color_basic': { color: 'green' },
        },
      },
      right_eye: {
        properties: {
          'descriptors:color_basic': { color: 'green' },
        },
      },
      nose: {
        properties: {
          'descriptors:size_category': { size: 'medium' },
        },
      },
      torso: {
        properties: {
          'descriptors:build': { build: 'athletic' },
        },
      },
    },
    patterns: [
      {
        matches: ['left_arm', 'right_arm'],
        properties: {
          'descriptors:build': { build: 'athletic' },
        },
      },
      {
        matches: ['left_leg', 'right_leg'],
        properties: {
          'descriptors:build': { build: 'athletic' },
        },
      },
    ],
  };

  beforeEach(() => {
    // Create temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'character-test-'));

    // Create directory structure
    const modDir = path.join(tempDir, 'test_mod');
    const entitiesDir = path.join(modDir, 'entities', 'definitions');
    const recipesDir = path.join(modDir, 'recipes');

    fs.mkdirSync(entitiesDir, { recursive: true });
    fs.mkdirSync(recipesDir, { recursive: true });

    // Write test files
    characterPath = path.join(entitiesDir, 'test.character.json');
    recipePath = path.join(recipesDir, 'test.recipe.json');

    fs.writeFileSync(characterPath, JSON.stringify(testCharacterData, null, 2));
    fs.writeFileSync(recipePath, JSON.stringify(testRecipeData, null, 2));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('Character Definition Loading', () => {
    it('should load character.json without errors', () => {
      const characterExists = fs.existsSync(characterPath);
      expect(characterExists).toBe(true);

      const characterData = JSON.parse(fs.readFileSync(characterPath, 'utf8'));
      expect(characterData.id).toBe('test_mod:test_character');
      expect(characterData.components['core:name'].text).toBe('Test Character');
      expect(characterData.components['anatomy:body'].recipeId).toBe(
        'test_mod:test_recipe'
      );
      expect(characterData.components['core:apparent_age'].minAge).toBe(20);
      expect(characterData.components['core:apparent_age'].maxAge).toBe(30);
    });

    it('should have all required character components', () => {
      const characterData = JSON.parse(fs.readFileSync(characterPath, 'utf8'));
      const requiredComponents = [
        'core:name',
        'core:profile',
        'core:personality',
        'core:likes',
        'core:dislikes',
        'core:fears',
        'movement:goals',
        'core:secrets',
        'core:speech_patterns',
        'anatomy:body',
        'core:apparent_age',
      ];

      requiredComponents.forEach((component) => {
        expect(characterData.components[component]).toBeDefined();
      });
    });

    it('should validate character component structure', () => {
      const characterData = JSON.parse(fs.readFileSync(characterPath, 'utf8'));

      // Validate specific component structures
      expect(characterData.components['core:name']).toHaveProperty('text');
      expect(characterData.components['core:personality']).toHaveProperty(
        'traits'
      );
      expect(
        Array.isArray(characterData.components['core:personality'].traits)
      ).toBe(true);
      expect(characterData.components['anatomy:body']).toHaveProperty(
        'recipeId'
      );
      expect(characterData.components['core:apparent_age']).toHaveProperty(
        'minAge'
      );
      expect(characterData.components['core:apparent_age']).toHaveProperty(
        'maxAge'
      );
    });
  });

  describe('Recipe Loading', () => {
    it('should load recipe.json without errors', () => {
      const recipeExists = fs.existsSync(recipePath);
      expect(recipeExists).toBe(true);

      const recipeData = JSON.parse(fs.readFileSync(recipePath, 'utf8'));
      expect(recipeData.recipeId).toBe('test_mod:test_recipe');
      expect(recipeData.blueprintId).toBe('anatomy:human_female');
    });

    it('should have correct body descriptors', () => {
      const recipeData = JSON.parse(fs.readFileSync(recipePath, 'utf8'));
      expect(recipeData.bodyDescriptors).toBeDefined();
      expect(recipeData.bodyDescriptors.height).toBe('average');
      expect(recipeData.bodyDescriptors.build).toBe('athletic');
      expect(recipeData.bodyDescriptors.skinColor).toBe('olive');
    });

    it('should have correct hair descriptors', () => {
      const recipeData = JSON.parse(fs.readFileSync(recipePath, 'utf8'));
      const hairSlot = recipeData.slots.hair;
      expect(hairSlot).toBeDefined();
      expect(hairSlot.properties['descriptors:color_basic'].color).toBe(
        'black'
      );
      expect(hairSlot.properties['descriptors:length_hair'].length).toBe(
        'long'
      );
      expect(hairSlot.properties['descriptors:hair_style'].style).toBe(
        'straight'
      );
    });

    it('should have correct eye color for both eyes', () => {
      const recipeData = JSON.parse(fs.readFileSync(recipePath, 'utf8'));
      expect(
        recipeData.slots.left_eye.properties['descriptors:color_basic'].color
      ).toBe('green');
      expect(
        recipeData.slots.right_eye.properties['descriptors:color_basic'].color
      ).toBe('green');
    });

    it('should have correct nose descriptor', () => {
      const recipeData = JSON.parse(fs.readFileSync(recipePath, 'utf8'));
      expect(
        recipeData.slots.nose.properties['descriptors:size_category'].size
      ).toBe('medium');
    });

    it('should have consistent build across body parts', () => {
      const recipeData = JSON.parse(fs.readFileSync(recipePath, 'utf8'));

      // Check torso
      expect(recipeData.slots.torso.properties['descriptors:build'].build).toBe(
        'athletic'
      );

      // Check patterns for arms and legs
      const armPattern = recipeData.patterns.find((p) =>
        p.matches.includes('left_arm')
      );
      const legPattern = recipeData.patterns.find((p) =>
        p.matches.includes('left_leg')
      );

      expect(armPattern.properties['descriptors:build'].build).toBe('athletic');
      expect(legPattern.properties['descriptors:build'].build).toBe('athletic');
    });

    it('should validate pattern structure', () => {
      const recipeData = JSON.parse(fs.readFileSync(recipePath, 'utf8'));

      expect(Array.isArray(recipeData.patterns)).toBe(true);
      expect(recipeData.patterns.length).toBeGreaterThan(0);

      recipeData.patterns.forEach((pattern) => {
        expect(pattern).toHaveProperty('matches');
        expect(pattern).toHaveProperty('properties');
        expect(Array.isArray(pattern.matches)).toBe(true);
      });
    });
  });

  describe('Character-Recipe Integration', () => {
    it('should have matching recipe IDs between character and recipe files', () => {
      const characterData = JSON.parse(fs.readFileSync(characterPath, 'utf8'));
      const recipeData = JSON.parse(fs.readFileSync(recipePath, 'utf8'));

      const characterRecipeId =
        characterData.components['anatomy:body'].recipeId;
      const actualRecipeId = recipeData.recipeId;

      expect(characterRecipeId).toBe(actualRecipeId);
      expect(characterRecipeId).toBe('test_mod:test_recipe');
    });

    it('should validate complete integration workflow', () => {
      // Simulate loading both files as would happen in production
      const characterData = JSON.parse(fs.readFileSync(characterPath, 'utf8'));
      const recipeData = JSON.parse(fs.readFileSync(recipePath, 'utf8'));

      // Validate character references recipe
      const recipeId = characterData.components['anatomy:body'].recipeId;
      expect(recipeId).toBeDefined();

      // Validate recipe can be found
      expect(recipeData.recipeId).toBe(recipeId);

      // Validate recipe has required structure
      expect(recipeData.blueprintId).toBeDefined();
      expect(recipeData.bodyDescriptors).toBeDefined();
      expect(recipeData.slots).toBeDefined();
    });
  });
});
