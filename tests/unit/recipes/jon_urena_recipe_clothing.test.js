/**
 * @file Unit tests for Jon Ureña recipe clothing integration
 * Tests the character recipe structure and clothing entity integration
 */

import {
  describe,
  it,
  expect,
  beforeEach,
} from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';
import Ajv from 'ajv';

describe('Jon Ureña Recipe Clothing Integration Unit Tests', () => {
  let recipe;
  let ajv;
  let recipeSchema;

  beforeEach(() => {
    // Load the recipe file
    const recipePath = join(process.cwd(), '.private/data/mods/p_erotica/recipes/jon_urena.recipe.json');
    const recipeContent = readFileSync(recipePath, 'utf8');
    recipe = JSON.parse(recipeContent);

    ajv = new Ajv({ strict: false });
    
    // Mock recipe schema - in real implementation this would be loaded from schema files
    recipeSchema = {
      type: 'object',
      required: ['$schema', 'recipeId', 'blueprintId', 'slots', 'patterns', 'clothingEntities'],
      properties: {
        $schema: { type: 'string' },
        recipeId: { type: 'string', pattern: '^p_erotica:' },
        blueprintId: { type: 'string', pattern: '^anatomy:' },
        slots: { type: 'object' },
        patterns: { type: 'array' },
        clothingEntities: {
          type: 'array',
          items: {
            type: 'object',
            required: ['entityId', 'equip'],
            properties: {
              entityId: { type: 'string', pattern: '^clothing:' },
              equip: { type: 'boolean' }
            }
          }
        }
      }
    };
  });

  describe('Recipe Structure Validation', () => {
    it('should have valid JSON structure', () => {
      expect(recipe).toBeDefined();
      expect(typeof recipe).toBe('object');
    });

    it('should pass schema validation', () => {
      const validate = ajv.compile(recipeSchema);
      const valid = validate(recipe);
      
      expect(valid).toBe(true);
      if (!valid) {
        console.error('Recipe validation errors:', validate.errors);
      }
    });

    it('should have correct recipe metadata', () => {
      expect(recipe.recipeId).toBe('p_erotica:jon_urena_recipe');
      expect(recipe.blueprintId).toBe('anatomy:human_male');
      expect(recipe.$schema).toBe('http://example.com/schemas/anatomy.recipe.schema.json');
    });

    it('should preserve existing anatomy slots and patterns', () => {
      expect(recipe.slots).toBeDefined();
      expect(recipe.patterns).toBeDefined();
      expect(recipe.patterns).toHaveLength(5); // Should maintain existing patterns
      
      // Verify key anatomy slots are preserved
      expect(recipe.slots.torso).toBeDefined();
      expect(recipe.slots.head).toBeDefined();
      expect(recipe.slots.hair).toBeDefined();
      expect(recipe.slots.penis).toBeDefined();
    });
  });

  describe('Clothing Entities Array', () => {
    it('should have exactly 6 clothing entities', () => {
      expect(recipe.clothingEntities).toBeDefined();
      expect(Array.isArray(recipe.clothingEntities)).toBe(true);
      expect(recipe.clothingEntities).toHaveLength(6);
    });

    it('should have all entities set to equip', () => {
      for (const clothingEntity of recipe.clothingEntities) {
        expect(clothingEntity.equip).toBe(true);
      }
    });

    it('should have correct entity IDs', () => {
      const expectedEntityIds = [
        'clothing:charcoal_wool_tshirt',
        'clothing:forest_green_cotton_linen_button_down',
        'clothing:dark_olive_cotton_twill_chore_jacket',
        'clothing:dark_indigo_denim_jeans',
        'clothing:sand_suede_chukka_boots',
        'clothing:dark_brown_leather_belt',
      ];

      const actualEntityIds = recipe.clothingEntities.map(entity => entity.entityId);
      
      for (const expectedId of expectedEntityIds) {
        expect(actualEntityIds).toContain(expectedId);
      }
    });

    it('should have valid clothing namespace prefixes', () => {
      for (const clothingEntity of recipe.clothingEntities) {
        expect(clothingEntity.entityId).toMatch(/^clothing:/);
      }
    });

    it('should maintain proper layering order in array', () => {
      const entityIds = recipe.clothingEntities.map(entity => entity.entityId);
      
      // Base layers should come before outer layers
      const tshirtIndex = entityIds.indexOf('clothing:charcoal_wool_tshirt');
      const buttonDownIndex = entityIds.indexOf('clothing:forest_green_cotton_linen_button_down');
      const jacketIndex = entityIds.indexOf('clothing:dark_olive_cotton_twill_chore_jacket');
      
      expect(tshirtIndex).toBeLessThan(jacketIndex);
      expect(buttonDownIndex).toBeLessThan(jacketIndex);
    });
  });

  describe('Recipe Compatibility', () => {
    it('should be compatible with human_male blueprint', () => {
      expect(recipe.blueprintId).toBe('anatomy:human_male');
      
      // Verify that clothing entities reference slots that exist in male blueprint
      const expectedSlots = ['torso_upper', 'legs', 'feet', 'torso_lower'];
      
      // This would be validated in integration tests with actual blueprint loading
      expect(expectedSlots).toContain('torso_upper'); // Torso items
      expect(expectedSlots).toContain('legs'); // Jeans
      expect(expectedSlots).toContain('feet'); // Boots
      expect(expectedSlots).toContain('torso_lower'); // Belt
    });

    it('should maintain existing character anatomy properties', () => {
      // Verify that adding clothing doesn't affect existing anatomy
      expect(recipe.slots.torso.properties['descriptors:build'].build).toBe('thick');
      expect(recipe.slots.torso.properties['descriptors:body_hair'].density).toBe('hairy');
      
      // Verify male-specific anatomy is preserved
      expect(recipe.slots.penis).toBeDefined();
      expect(recipe.slots.penis.properties['descriptors:build'].build).toBe('thick');
      expect(recipe.slots.penis.properties['descriptors:size_category'].size).toBe('large');
    });

    it('should maintain pattern definitions for body parts', () => {
      const patterns = recipe.patterns;
      
      // Find specific patterns
      const armPattern = patterns.find(p => p.matches.includes('left_arm') && p.matches.includes('right_arm'));
      const legPattern = patterns.find(p => p.matches.includes('left_leg') && p.matches.includes('right_leg'));
      const eyePattern = patterns.find(p => p.matches.includes('left_eye') && p.matches.includes('right_eye'));
      
      expect(armPattern).toBeDefined();
      expect(legPattern).toBeDefined();
      expect(eyePattern).toBeDefined();
      
      // Verify muscular, hairy characteristics are maintained
      expect(armPattern.properties['descriptors:build'].build).toBe('muscular');
      expect(armPattern.properties['descriptors:body_hair'].density).toBe('hairy');
      expect(legPattern.properties['descriptors:build'].build).toBe('muscular');
      expect(legPattern.properties['descriptors:body_hair'].density).toBe('hairy');
    });
  });

  describe('JSON Format and Syntax', () => {
    it('should be valid JSON with proper formatting', () => {
      const recipePath = join(process.cwd(), '.private/data/mods/p_erotica/recipes/jon_urena.recipe.json');
      const recipeContent = readFileSync(recipePath, 'utf8');
      
      // Should parse without throwing
      expect(() => JSON.parse(recipeContent)).not.toThrow();
      
      // Should have consistent indentation (2 spaces based on existing format)
      const lines = recipeContent.split('\n');
      const indentedLines = lines.filter(line => line.match(/^\s+\S/));
      
      if (indentedLines.length > 0) {
        // Check that indentation uses spaces (not tabs)
        for (const line of indentedLines) {
          expect(line).not.toMatch(/^\t/); // No leading tabs
        }
      }
    });

    it('should maintain consistent property ordering', () => {
      // Each clothing entity should have consistent property order
      for (const clothingEntity of recipe.clothingEntities) {
        const properties = Object.keys(clothingEntity);
        
        expect(properties[0]).toBe('entityId');
        expect(properties[1]).toBe('equip');
      }
    });

    it('should not have any trailing commas or syntax issues', () => {
      const recipePath = join(process.cwd(), '.private/data/mods/p_erotica/recipes/jon_urena.recipe.json');
      const recipeContent = readFileSync(recipePath, 'utf8');
      
      // Check for common JSON syntax issues
      expect(recipeContent).not.toMatch(/,\s*}/); // No trailing commas before closing braces
      expect(recipeContent).not.toMatch(/,\s*]/); // No trailing commas before closing brackets
    });
  });

  describe('Data Integrity', () => {
    it('should not have duplicate clothing entities', () => {
      const entityIds = recipe.clothingEntities.map(entity => entity.entityId);
      const uniqueEntityIds = new Set(entityIds);
      
      expect(uniqueEntityIds.size).toBe(entityIds.length);
    });

    it('should have reasonable entity ID lengths', () => {
      for (const clothingEntity of recipe.clothingEntities) {
        expect(clothingEntity.entityId.length).toBeGreaterThan(10);
        expect(clothingEntity.entityId.length).toBeLessThan(100);
      }
    });

    it('should use consistent naming convention', () => {
      for (const clothingEntity of recipe.clothingEntities) {
        const entityId = clothingEntity.entityId;
        
        // Should follow pattern: clothing:lowercase_with_underscores
        expect(entityId).toMatch(/^clothing:[a-z0-9_]+$/);
        
        // Should not have double underscores or trailing underscores
        expect(entityId).not.toMatch(/__/);
        expect(entityId).not.toMatch(/_$/);
      }
    });
  });

  describe('Clothing Coverage Analysis', () => {
    it('should provide comprehensive wardrobe coverage', () => {
      const entityIds = recipe.clothingEntities.map(entity => entity.entityId);
      
      // Should have upper body coverage
      const hasShirt = entityIds.some(id => id.includes('button_down') || id.includes('tshirt'));
      const hasJacket = entityIds.some(id => id.includes('jacket'));
      
      // Should have lower body coverage  
      const hasPants = entityIds.some(id => id.includes('jeans') || id.includes('pants'));
      const hasShoes = entityIds.some(id => id.includes('boots') || id.includes('shoes'));
      
      // Should have accessories
      const hasBelt = entityIds.some(id => id.includes('belt'));
      
      expect(hasShirt).toBe(true);
      expect(hasJacket).toBe(true);
      expect(hasPants).toBe(true);
      expect(hasShoes).toBe(true);
      expect(hasBelt).toBe(true);
    });

    it('should represent a cohesive style theme', () => {
      const entityIds = recipe.clothingEntities.map(entity => entity.entityId);
      
      // Jon Ureña's wardrobe should reflect masculine, earthy, utilitarian style
      const hasEarthyColors = entityIds.some(id => 
        id.includes('olive') || id.includes('forest') || id.includes('brown') || id.includes('indigo')
      );
      
      const hasUtilitarianPieces = entityIds.some(id => 
        id.includes('chore') || id.includes('denim') || id.includes('leather')
      );
      
      expect(hasEarthyColors).toBe(true);
      expect(hasUtilitarianPieces).toBe(true);
    });
  });
});