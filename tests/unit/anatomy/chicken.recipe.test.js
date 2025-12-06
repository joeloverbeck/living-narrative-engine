/**
 * @file Tests for chicken anatomy recipes (rooster and hen)
 * @see specs/rooster-hen-anatomy-recipes.md
 * @see tickets/ROOHENANAREC-003-recipes.md
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Chicken Recipes', () => {
  let roosterRecipe;
  let henRecipe;
  let roosterBlueprint;
  let henBlueprint;

  beforeEach(() => {
    // Load the rooster recipe
    const roosterRecipePath = path.join(
      process.cwd(),
      'data/mods/anatomy/recipes/rooster.recipe.json'
    );
    roosterRecipe = JSON.parse(fs.readFileSync(roosterRecipePath, 'utf8'));

    // Load the hen recipe
    const henRecipePath = path.join(
      process.cwd(),
      'data/mods/anatomy/recipes/hen.recipe.json'
    );
    henRecipe = JSON.parse(fs.readFileSync(henRecipePath, 'utf8'));

    // Load blueprints for reference
    const roosterBlueprintPath = path.join(
      process.cwd(),
      'data/mods/anatomy/blueprints/rooster.blueprint.json'
    );
    roosterBlueprint = JSON.parse(
      fs.readFileSync(roosterBlueprintPath, 'utf8')
    );

    const henBlueprintPath = path.join(
      process.cwd(),
      'data/mods/anatomy/blueprints/hen.blueprint.json'
    );
    henBlueprint = JSON.parse(fs.readFileSync(henBlueprintPath, 'utf8'));
  });

  describe('Rooster Recipe', () => {
    describe('Basic Structure', () => {
      it('should have correct recipe ID', () => {
        expect(roosterRecipe.recipeId).toBe('anatomy:rooster');
      });

      it('should reference the rooster blueprint', () => {
        expect(roosterRecipe.blueprintId).toBe('anatomy:rooster');
      });

      it('should have the correct schema reference', () => {
        expect(roosterRecipe.$schema).toBe(
          'schema://living-narrative-engine/anatomy.recipe.schema.json'
        );
      });

      it('should have body descriptors', () => {
        expect(roosterRecipe.bodyDescriptors).toBeDefined();
        expect(roosterRecipe.bodyDescriptors.height).toBe('petite');
        expect(roosterRecipe.bodyDescriptors.hairDensity).toBe('furred');
      });
    });

    describe('Comb Slot', () => {
      it('should have comb slot with chicken_comb part type', () => {
        expect(roosterRecipe.slots.comb).toBeDefined();
        expect(roosterRecipe.slots.comb.partType).toBe('chicken_comb');
        expect(roosterRecipe.slots.comb.preferId).toBe('anatomy:chicken_comb');
      });
    });

    describe('Wattle Slot', () => {
      it('should have wattle slot with chicken_wattle part type', () => {
        expect(roosterRecipe.slots.wattle).toBeDefined();
        expect(roosterRecipe.slots.wattle.partType).toBe('chicken_wattle');
        expect(roosterRecipe.slots.wattle.preferId).toBe(
          'anatomy:chicken_wattle'
        );
      });
    });

    describe('Tail Slot', () => {
      it('should have tail slot with chicken_tail part type', () => {
        expect(roosterRecipe.slots.tail).toBeDefined();
        expect(roosterRecipe.slots.tail.partType).toBe('chicken_tail');
        expect(roosterRecipe.slots.tail.preferId).toBe('anatomy:chicken_tail');
      });
    });

    describe('Spur Slots (Rooster-specific)', () => {
      it('should have left_spur slot with chicken_spur part type', () => {
        expect(roosterRecipe.slots.left_spur).toBeDefined();
        expect(roosterRecipe.slots.left_spur.partType).toBe('chicken_spur');
        expect(roosterRecipe.slots.left_spur.preferId).toBe(
          'anatomy:chicken_spur'
        );
      });

      it('should have right_spur slot with chicken_spur part type', () => {
        expect(roosterRecipe.slots.right_spur).toBeDefined();
        expect(roosterRecipe.slots.right_spur.partType).toBe('chicken_spur');
        expect(roosterRecipe.slots.right_spur.preferId).toBe(
          'anatomy:chicken_spur'
        );
      });

      it('should map spurs to blueprint spur slots', () => {
        // Verify blueprint has the slots we expect to map
        expect(roosterBlueprint.slots.left_spur).toBeDefined();
        expect(roosterBlueprint.slots.right_spur).toBeDefined();
      });
    });

    describe('Pattern Definitions', () => {
      it('should have patterns for paired body parts', () => {
        expect(roosterRecipe.patterns).toBeDefined();
        expect(Array.isArray(roosterRecipe.patterns)).toBe(true);
        expect(roosterRecipe.patterns.length).toBeGreaterThanOrEqual(4);
      });

      it('should have wing pattern matching both wings', () => {
        const wingPattern = roosterRecipe.patterns.find(
          (p) => p.partType === 'chicken_wing'
        );
        expect(wingPattern).toBeDefined();
        expect(wingPattern.matches).toContain('left_wing');
        expect(wingPattern.matches).toContain('right_wing');
      });

      it('should have leg pattern matching both legs', () => {
        const legPattern = roosterRecipe.patterns.find(
          (p) => p.partType === 'chicken_leg'
        );
        expect(legPattern).toBeDefined();
        expect(legPattern.matches).toContain('left_leg');
        expect(legPattern.matches).toContain('right_leg');
      });

      it('should have foot pattern matching both feet', () => {
        const footPattern = roosterRecipe.patterns.find(
          (p) => p.partType === 'chicken_foot'
        );
        expect(footPattern).toBeDefined();
        expect(footPattern.matches).toContain('left_foot');
        expect(footPattern.matches).toContain('right_foot');
      });

      it('should have eye pattern matching both eyes', () => {
        const eyePattern = roosterRecipe.patterns.find(
          (p) => p.partType === 'eye'
        );
        expect(eyePattern).toBeDefined();
        expect(eyePattern.matches).toContain('left_eye');
        expect(eyePattern.matches).toContain('right_eye');
      });
    });
  });

  describe('Hen Recipe', () => {
    describe('Basic Structure', () => {
      it('should have correct recipe ID', () => {
        expect(henRecipe.recipeId).toBe('anatomy:hen');
      });

      it('should reference the hen blueprint', () => {
        expect(henRecipe.blueprintId).toBe('anatomy:hen');
      });

      it('should have the correct schema reference', () => {
        expect(henRecipe.$schema).toBe(
          'schema://living-narrative-engine/anatomy.recipe.schema.json'
        );
      });

      it('should have body descriptors', () => {
        expect(henRecipe.bodyDescriptors).toBeDefined();
        expect(henRecipe.bodyDescriptors.height).toBe('petite');
        expect(henRecipe.bodyDescriptors.hairDensity).toBe('furred');
      });
    });

    describe('Comb Slot', () => {
      it('should have comb slot with chicken_comb part type', () => {
        expect(henRecipe.slots.comb).toBeDefined();
        expect(henRecipe.slots.comb.partType).toBe('chicken_comb');
        expect(henRecipe.slots.comb.preferId).toBe('anatomy:chicken_comb');
      });
    });

    describe('Wattle Slot', () => {
      it('should have wattle slot with chicken_wattle part type', () => {
        expect(henRecipe.slots.wattle).toBeDefined();
        expect(henRecipe.slots.wattle.partType).toBe('chicken_wattle');
        expect(henRecipe.slots.wattle.preferId).toBe('anatomy:chicken_wattle');
      });
    });

    describe('Tail Slot', () => {
      it('should have tail slot with chicken_tail part type', () => {
        expect(henRecipe.slots.tail).toBeDefined();
        expect(henRecipe.slots.tail.partType).toBe('chicken_tail');
        expect(henRecipe.slots.tail.preferId).toBe('anatomy:chicken_tail');
      });
    });

    describe('Spur Slots (Absent for Hen)', () => {
      it('should NOT have left_spur slot', () => {
        expect(henRecipe.slots.left_spur).toBeUndefined();
      });

      it('should NOT have right_spur slot', () => {
        expect(henRecipe.slots.right_spur).toBeUndefined();
      });

      it('should match hen blueprint which has no spur slots', () => {
        expect(henBlueprint.slots.left_spur).toBeUndefined();
        expect(henBlueprint.slots.right_spur).toBeUndefined();
      });
    });

    describe('Pattern Definitions', () => {
      it('should have patterns for paired body parts', () => {
        expect(henRecipe.patterns).toBeDefined();
        expect(Array.isArray(henRecipe.patterns)).toBe(true);
        expect(henRecipe.patterns.length).toBeGreaterThanOrEqual(4);
      });

      it('should have wing pattern matching both wings', () => {
        const wingPattern = henRecipe.patterns.find(
          (p) => p.partType === 'chicken_wing'
        );
        expect(wingPattern).toBeDefined();
        expect(wingPattern.matches).toContain('left_wing');
        expect(wingPattern.matches).toContain('right_wing');
      });
    });
  });

  describe('Rooster vs Hen Recipe Comparison', () => {
    it('should use different blueprints', () => {
      expect(roosterRecipe.blueprintId).toBe('anatomy:rooster');
      expect(henRecipe.blueprintId).toBe('anatomy:hen');
    });

    it('should both have the same schema', () => {
      expect(roosterRecipe.$schema).toBe(henRecipe.$schema);
    });

    it('should have rooster with spurs and hen without', () => {
      expect(roosterRecipe.slots.left_spur).toBeDefined();
      expect(roosterRecipe.slots.right_spur).toBeDefined();
      expect(henRecipe.slots.left_spur).toBeUndefined();
      expect(henRecipe.slots.right_spur).toBeUndefined();
    });

    it('should have same pattern structure for common body parts', () => {
      const roosterWing = roosterRecipe.patterns.find(
        (p) => p.partType === 'chicken_wing'
      );
      const henWing = henRecipe.patterns.find(
        (p) => p.partType === 'chicken_wing'
      );

      expect(roosterWing.preferId).toBe(henWing.preferId);
      expect(roosterWing.matches).toEqual(henWing.matches);
    });
  });

  describe('Recipe-Blueprint Slot Coverage', () => {
    it('rooster recipe should cover all rooster blueprint slots', () => {
      const blueprintSlotKeys = Object.keys(roosterBlueprint.slots);
      const recipeSlotKeys = Object.keys(roosterRecipe.slots);
      const patternSlotKeys = roosterRecipe.patterns.flatMap((p) => p.matches);

      const coveredSlots = new Set([...recipeSlotKeys, ...patternSlotKeys]);

      blueprintSlotKeys.forEach((slotKey) => {
        expect(coveredSlots.has(slotKey)).toBe(true);
      });
    });

    it('hen recipe should cover all hen blueprint slots', () => {
      const blueprintSlotKeys = Object.keys(henBlueprint.slots);
      const recipeSlotKeys = Object.keys(henRecipe.slots);
      const patternSlotKeys = henRecipe.patterns.flatMap((p) => p.matches);

      const coveredSlots = new Set([...recipeSlotKeys, ...patternSlotKeys]);

      blueprintSlotKeys.forEach((slotKey) => {
        expect(coveredSlots.has(slotKey)).toBe(true);
      });
    });
  });

  describe('Base Chicken Recipe Simplicity (RECVALROB-006 Regression)', () => {
    /**
     * Regression test for Failure 3 scenario from specs/recipe-validation-robustness.md
     *
     * IMPORTANT: The `properties` field is a VALID and useful feature for filtering
     * entities that have specific component values. It is used extensively in
     * character recipes (e.g., data/mods/fantasy/recipes/) to select specific
     * eye colors, hair types, skin tones, etc.
     *
     * However, the BASE chicken recipes (anatomy:rooster, anatomy:hen) should NOT
     * use `properties` because:
     * 1. There are no entity variants for chicken parts (comb, wattle, tail, etc.)
     *    with different component values to filter between
     * 2. Using `properties` here would cause "No entity definitions found" errors
     *    since no matching entities exist
     * 3. These base recipes use only `preferId` to directly reference the single
     *    available entity for each part type
     *
     * If chicken part variants are added in the future (e.g., large_comb, small_comb),
     * then using `properties` to filter between them would be appropriate and these
     * tests should be updated accordingly.
     */

    describe('Rooster Recipe', () => {
      it('should not use properties field in any slot', () => {
        const slots = Object.values(roosterRecipe.slots);
        expect(slots.length).toBeGreaterThan(0);

        slots.forEach((slotConfig) => {
          expect(slotConfig.properties).toBeUndefined();
        });
      });

      it('should not use properties field in any pattern', () => {
        expect(roosterRecipe.patterns.length).toBeGreaterThan(0);

        roosterRecipe.patterns.forEach((pattern) => {
          expect(pattern.properties).toBeUndefined();
        });
      });
    });

    describe('Hen Recipe', () => {
      it('should not use properties field in any slot', () => {
        const slots = Object.values(henRecipe.slots);
        expect(slots.length).toBeGreaterThan(0);

        slots.forEach((slotConfig) => {
          expect(slotConfig.properties).toBeUndefined();
        });
      });

      it('should not use properties field in any pattern', () => {
        expect(henRecipe.patterns.length).toBeGreaterThan(0);

        henRecipe.patterns.forEach((pattern) => {
          expect(pattern.properties).toBeUndefined();
        });
      });
    });
  });
});
