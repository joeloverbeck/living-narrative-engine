import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  checkBlueprintRecipeCompatibility,
  validateBlueprintRecipeConsistency,
} from '../../../../src/anatomy/bodyBlueprintFactory/blueprintValidator.js';
import { ValidationError } from '../../../../src/errors/validationError.js';

describe('Blueprint/Recipe Compatibility Checker', () => {
  let mockLogger;
  let mockRecipePatternResolver;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockRecipePatternResolver = {
      resolveRecipePatterns: jest.fn(),
    };
  });

  describe('checkBlueprintRecipeCompatibility', () => {
    describe('V1 Blueprints', () => {
      it('should return no issues when all required slots are populated', () => {
        const blueprint = {
          id: 'test:humanoid',
          slots: {
            head: { socket: 'head', optional: false },
            torso: { socket: 'torso', optional: false },
            arm_left: { socket: 'arm_left', optional: false },
            arm_right: { socket: 'arm_right', optional: false },
          },
        };

        const recipe = {
          recipeId: 'test:recipe',
          slots: {
            head: { partType: 'human_head' },
            torso: { partType: 'human_torso' },
            arm_left: { partType: 'human_arm' },
            arm_right: { partType: 'human_arm' },
          },
        };

        const issues = checkBlueprintRecipeCompatibility(blueprint, recipe, {
          recipePatternResolver: mockRecipePatternResolver,
          logger: mockLogger,
        });

        expect(issues).toEqual([]);
      });

      it('should detect missing required slots', () => {
        const blueprint = {
          id: 'test:humanoid',
          slots: {
            head: { socket: 'head', optional: false },
            torso: { socket: 'torso', optional: false },
            arm_left: { socket: 'arm_left', optional: false },
            arm_right: { socket: 'arm_right', optional: false },
          },
        };

        const recipe = {
          recipeId: 'test:recipe',
          slots: {
            head: { partType: 'human_head' },
            torso: { partType: 'human_torso' },
            // Missing arm_left and arm_right
          },
        };

        const issues = checkBlueprintRecipeCompatibility(blueprint, recipe, {
          recipePatternResolver: mockRecipePatternResolver,
          logger: mockLogger,
        });

        expect(issues).toHaveLength(2);
        expect(issues[0]).toMatchObject({
          type: 'missing_required_slot',
          severity: 'error',
          slot: 'arm_left',
          message: expect.stringContaining(
            "Required slot 'arm_left' not populated"
          ),
        });
        expect(issues[1]).toMatchObject({
          type: 'missing_required_slot',
          severity: 'error',
          slot: 'arm_right',
          message: expect.stringContaining(
            "Required slot 'arm_right' not populated"
          ),
        });
      });

      it('should allow optional slots to be missing', () => {
        const blueprint = {
          id: 'test:humanoid',
          slots: {
            head: { socket: 'head', optional: false },
            tail: { socket: 'tail', optional: true },
          },
        };

        const recipe = {
          recipeId: 'test:recipe',
          slots: {
            head: { partType: 'human_head' },
            // tail is optional, can be missing
          },
        };

        const issues = checkBlueprintRecipeCompatibility(blueprint, recipe, {
          recipePatternResolver: mockRecipePatternResolver,
          logger: mockLogger,
        });

        expect(issues).toEqual([]);
      });

      it('should warn about unexpected recipe slots', () => {
        const blueprint = {
          id: 'test:humanoid',
          slots: {
            head: { socket: 'head', optional: false },
          },
        };

        const recipe = {
          recipeId: 'test:recipe',
          slots: {
            head: { partType: 'human_head' },
            wing_left: { partType: 'dragon_wing' }, // Not in blueprint
            wing_right: { partType: 'dragon_wing' }, // Not in blueprint
          },
        };

        const issues = checkBlueprintRecipeCompatibility(blueprint, recipe, {
          recipePatternResolver: mockRecipePatternResolver,
          logger: mockLogger,
        });

        const warnings = issues.filter((i) => i.severity === 'warning');
        expect(warnings).toHaveLength(2);
        expect(warnings[0]).toMatchObject({
          type: 'unexpected_slot',
          severity: 'warning',
          slot: 'wing_left',
          impact: 'Slot will be ignored during anatomy generation',
        });
      });

      it('should skip special slots (torso, root)', () => {
        const blueprint = {
          id: 'test:humanoid',
          slots: {
            head: { socket: 'head', optional: false },
          },
        };

        const recipe = {
          recipeId: 'test:recipe',
          slots: {
            head: { partType: 'human_head' },
            torso: { partType: 'special_torso' }, // Special slot
            root: { partType: 'special_root' }, // Special slot
          },
        };

        const issues = checkBlueprintRecipeCompatibility(blueprint, recipe, {
          recipePatternResolver: mockRecipePatternResolver,
          logger: mockLogger,
        });

        // Should not warn about torso/root
        expect(issues).toEqual([]);
      });

      it('should handle V1 patterns with explicit matches', () => {
        const blueprint = {
          id: 'test:spider',
          slots: {
            leg_1: { socket: 'leg_1', optional: false },
            leg_2: { socket: 'leg_2', optional: false },
            leg_3: { socket: 'leg_3', optional: false },
            leg_4: { socket: 'leg_4', optional: false },
          },
        };

        const recipe = {
          recipeId: 'test:spider_recipe',
          slots: {},
          patterns: [
            {
              matches: ['leg_1', 'leg_2', 'leg_3', 'leg_4'],
              partType: 'spider_leg',
            },
          ],
        };

        const issues = checkBlueprintRecipeCompatibility(blueprint, recipe, {
          recipePatternResolver: mockRecipePatternResolver,
          logger: mockLogger,
        });

        expect(issues).toEqual([]);
      });
    });

    describe('V2 Blueprints', () => {
      it('should resolve V2 patterns using RecipePatternResolver', () => {
        const blueprint = {
          id: 'test:humanoid',
          schemaVersion: '2.0',
          structureTemplate: 'humanoid',
          slots: {
            head: { socket: 'head', optional: false },
            arm_left: { socket: 'arm_left', optional: false },
            arm_right: { socket: 'arm_right', optional: false },
          },
        };

        const recipe = {
          recipeId: 'test:recipe',
          slots: {
            head: { partType: 'human_head' },
          },
          patterns: [
            {
              matchesPattern: 'arm_*',
              partType: 'human_arm',
            },
          ],
        };

        // Mock pattern resolution to return expanded slots
        const resolvedRecipe = {
          ...recipe,
          slots: {
            head: { partType: 'human_head' },
            arm_left: { partType: 'human_arm' },
            arm_right: { partType: 'human_arm' },
          },
        };
        mockRecipePatternResolver.resolveRecipePatterns.mockReturnValue(
          resolvedRecipe
        );

        const issues = checkBlueprintRecipeCompatibility(blueprint, recipe, {
          recipePatternResolver: mockRecipePatternResolver,
          logger: mockLogger,
        });

        expect(
          mockRecipePatternResolver.resolveRecipePatterns
        ).toHaveBeenCalledWith(recipe, blueprint);
        expect(issues).toEqual([]);
      });

      it('should handle pattern resolution failures gracefully', () => {
        const blueprint = {
          id: 'test:humanoid',
          schemaVersion: '2.0',
          structureTemplate: 'humanoid',
          slots: {
            head: { socket: 'head', optional: false },
            arm_left: { socket: 'arm_left', optional: false },
          },
        };

        const recipe = {
          recipeId: 'test:recipe',
          slots: {
            head: { partType: 'human_head' },
          },
          patterns: [
            {
              matchesPattern: 'arm_*',
              partType: 'human_arm',
            },
          ],
        };

        // Mock pattern resolution to throw error
        mockRecipePatternResolver.resolveRecipePatterns.mockImplementation(
          () => {
            throw new Error('Pattern resolution failed');
          }
        );

        const issues = checkBlueprintRecipeCompatibility(blueprint, recipe, {
          recipePatternResolver: mockRecipePatternResolver,
          logger: mockLogger,
        });

        // Should continue with explicit slots only
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Failed to resolve recipe patterns')
        );
        // Should detect missing arm_left since patterns failed
        expect(issues.some((i) => i.slot === 'arm_left')).toBe(true);
      });

      it('should combine explicit slots and pattern-matched slots', () => {
        const blueprint = {
          id: 'test:humanoid',
          schemaVersion: '2.0',
          structureTemplate: 'humanoid',
          slots: {
            head: { socket: 'head', optional: false },
            arm_left: { socket: 'arm_left', optional: false },
            arm_right: { socket: 'arm_right', optional: false },
            leg_left: { socket: 'leg_left', optional: false },
            leg_right: { socket: 'leg_right', optional: false },
          },
        };

        const recipe = {
          recipeId: 'test:recipe',
          slots: {
            head: { partType: 'human_head' },
            arm_left: { partType: 'human_arm' },
          },
          patterns: [
            {
              matchesPattern: 'leg_*',
              partType: 'human_leg',
            },
          ],
        };

        // Mock pattern resolution
        const resolvedRecipe = {
          ...recipe,
          slots: {
            head: { partType: 'human_head' },
            arm_left: { partType: 'human_arm' },
            leg_left: { partType: 'human_leg' },
            leg_right: { partType: 'human_leg' },
          },
        };
        mockRecipePatternResolver.resolveRecipePatterns.mockReturnValue(
          resolvedRecipe
        );

        const issues = checkBlueprintRecipeCompatibility(blueprint, recipe, {
          recipePatternResolver: mockRecipePatternResolver,
          logger: mockLogger,
        });

        // Should detect missing arm_right
        expect(issues).toHaveLength(1);
        expect(issues[0]).toMatchObject({
          type: 'missing_required_slot',
          severity: 'error',
          slot: 'arm_right',
        });
      });
    });

    describe('Edge Cases', () => {
      it('should handle empty blueprint slots', () => {
        const blueprint = {
          id: 'test:empty',
          slots: {},
        };

        const recipe = {
          recipeId: 'test:recipe',
          slots: {
            head: { partType: 'human_head' },
          },
        };

        const issues = checkBlueprintRecipeCompatibility(blueprint, recipe, {
          recipePatternResolver: mockRecipePatternResolver,
          logger: mockLogger,
        });

        expect(issues.some((i) => i.type === 'unexpected_slot')).toBe(true);
      });

      it('should handle empty recipe slots', () => {
        const blueprint = {
          id: 'test:humanoid',
          slots: {
            head: { socket: 'head', optional: false },
          },
        };

        const recipe = {
          recipeId: 'test:recipe',
          slots: {},
        };

        const issues = checkBlueprintRecipeCompatibility(blueprint, recipe, {
          recipePatternResolver: mockRecipePatternResolver,
          logger: mockLogger,
        });

        expect(issues.some((i) => i.type === 'missing_required_slot')).toBe(
          true
        );
      });

      it('should handle missing slots property in blueprint', () => {
        const blueprint = {
          id: 'test:empty',
        };

        const recipe = {
          recipeId: 'test:recipe',
          slots: {},
        };

        const issues = checkBlueprintRecipeCompatibility(blueprint, recipe, {
          recipePatternResolver: mockRecipePatternResolver,
          logger: mockLogger,
        });

        expect(issues).toEqual([]);
      });

      it('should handle missing slots property in recipe', () => {
        const blueprint = {
          id: 'test:humanoid',
          slots: {
            head: { socket: 'head', optional: false },
          },
        };

        const recipe = {
          recipeId: 'test:recipe',
        };

        const issues = checkBlueprintRecipeCompatibility(blueprint, recipe, {
          recipePatternResolver: mockRecipePatternResolver,
          logger: mockLogger,
        });

        expect(issues.some((i) => i.type === 'missing_required_slot')).toBe(
          true
        );
      });
    });

    describe('Logging', () => {
      it('should log pattern matching coverage', () => {
        const blueprint = {
          id: 'test:humanoid',
          schemaVersion: '2.0',
          slots: {
            head: { socket: 'head', optional: false },
          },
        };

        const recipe = {
          recipeId: 'test:recipe',
          slots: {
            head: { partType: 'human_head' },
          },
          patterns: [
            {
              matchesPattern: 'arm_*',
              partType: 'human_arm',
            },
          ],
        };

        mockRecipePatternResolver.resolveRecipePatterns.mockReturnValue({
          ...recipe,
          slots: { head: { partType: 'human_head' } },
        });

        checkBlueprintRecipeCompatibility(blueprint, recipe, {
          recipePatternResolver: mockRecipePatternResolver,
          logger: mockLogger,
        });

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('patterns matching')
        );
      });
    });
  });

  describe('validateBlueprintRecipeConsistency', () => {
    it('should not throw when recipePatternResolver is not provided', () => {
      const blueprint = {
        id: 'test:humanoid',
        slots: {},
      };

      const recipe = {
        recipeId: 'test:recipe',
        slots: {},
      };

      expect(() => {
        validateBlueprintRecipeConsistency(blueprint, recipe, {
          logger: mockLogger,
        });
      }).not.toThrow();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Validating consistency')
      );
    });

    it('should throw ValidationError when compatibility errors exist', () => {
      const blueprint = {
        id: 'test:humanoid',
        slots: {
          head: { socket: 'head', optional: false },
          arm_left: { socket: 'arm_left', optional: false },
        },
      };

      const recipe = {
        recipeId: 'test:recipe',
        slots: {
          head: { partType: 'human_head' },
          // Missing arm_left
        },
      };

      expect(() => {
        validateBlueprintRecipeConsistency(blueprint, recipe, {
          recipePatternResolver: mockRecipePatternResolver,
          logger: mockLogger,
        });
      }).toThrow(ValidationError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('compatibility errors')
      );
    });

    it('should log warnings but not throw for warning-level issues', () => {
      const blueprint = {
        id: 'test:humanoid',
        slots: {
          head: { socket: 'head', optional: false },
        },
      };

      const recipe = {
        recipeId: 'test:recipe',
        slots: {
          head: { partType: 'human_head' },
          wing_left: { partType: 'dragon_wing' }, // Not in blueprint - warning
        },
      };

      expect(() => {
        validateBlueprintRecipeConsistency(blueprint, recipe, {
          recipePatternResolver: mockRecipePatternResolver,
          logger: mockLogger,
        });
      }).not.toThrow();

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "Recipe slot 'wing_left' not defined in blueprint"
        )
      );
    });

    it('should include all error messages in thrown error', () => {
      const blueprint = {
        id: 'test:humanoid',
        slots: {
          head: { socket: 'head', optional: false },
          arm_left: { socket: 'arm_left', optional: false },
          arm_right: { socket: 'arm_right', optional: false },
        },
      };

      const recipe = {
        recipeId: 'test:recipe',
        slots: {
          head: { partType: 'human_head' },
          // Missing both arms
        },
      };

      expect(() => {
        validateBlueprintRecipeConsistency(blueprint, recipe, {
          recipePatternResolver: mockRecipePatternResolver,
          logger: mockLogger,
        });
      }).toThrow(/arm_left.*arm_right/);
    });

    it('should handle both errors and warnings together', () => {
      const blueprint = {
        id: 'test:humanoid',
        slots: {
          head: { socket: 'head', optional: false },
        },
      };

      const recipe = {
        recipeId: 'test:recipe',
        slots: {
          // Missing head (error)
          wing_left: { partType: 'dragon_wing' }, // Unexpected (warning)
        },
      };

      expect(() => {
        validateBlueprintRecipeConsistency(blueprint, recipe, {
          recipePatternResolver: mockRecipePatternResolver,
          logger: mockLogger,
        });
      }).toThrow(ValidationError);

      // Should have logged error
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
