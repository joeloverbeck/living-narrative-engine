import { describe, expect, it, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { ValidationError } from '../../../src/errors/index.js';
import { SYSTEM_ERROR_OCCURRED_ID } from '../../../src/constants/systemEventIds.js';
import {
  ANATOMY_BODY_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID,
  ANATOMY_SOCKETS_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('Anatomy Recipe Slot Validation Integration', () => {
  let testBed;
  let bodyBlueprintFactory;
  let eventDispatcher;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    bodyBlueprintFactory = testBed.bodyBlueprintFactory;
    eventDispatcher = testBed.eventDispatcher;

    // Load test anatomy components
    testBed.loadComponents({
      [ANATOMY_BODY_COMPONENT_ID]: {
        id: ANATOMY_BODY_COMPONENT_ID,
        data: { rootPartId: null, recipeId: null, body: null },
      },
      [ANATOMY_PART_COMPONENT_ID]: {
        id: ANATOMY_PART_COMPONENT_ID,
        data: { subType: null },
      },
      [ANATOMY_SOCKETS_COMPONENT_ID]: {
        id: ANATOMY_SOCKETS_COMPONENT_ID,
        data: { sockets: [] },
      },
    });

    // Load test entity definitions
    testBed.loadEntityDefinitions({
      'test:torso': {
        id: 'test:torso',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'torso' },
          [ANATOMY_SOCKETS_COMPONENT_ID]: {
            sockets: [
              { id: 'head_socket', allowedTypes: ['head'], maxCount: 1 },
              { id: 'arm_socket', allowedTypes: ['arm'], maxCount: 2 },
            ],
          },
        },
      },
      'test:head': {
        id: 'test:head',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'head' },
          [ANATOMY_SOCKETS_COMPONENT_ID]: {
            sockets: [{ id: 'scalp', allowedTypes: ['hair'], maxCount: 1 }],
          },
        },
      },
      'test:arm': {
        id: 'test:arm',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'arm' },
        },
      },
      'test:hair': {
        id: 'test:hair',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'hair' },
        },
      },
    });

    // Load test blueprints
    testBed.loadBlueprints({
      'test:humanoid': {
        id: 'test:humanoid',
        root: 'test:torso',
        slots: {
          head: {
            parent: null,
            socket: 'head_socket',
            requirements: {},
          },
          leftArm: {
            parent: null,
            socket: 'arm_socket',
            requirements: {},
          },
          rightArm: {
            parent: null,
            socket: 'arm_socket',
            requirements: {},
          },
          hair: {
            parent: 'head',
            socket: 'scalp',
            requirements: {},
            optional: true,
          },
        },
      },
    });
  });

  afterEach(() => {
    // Clean up
  });

  describe('Invalid Recipe Slot Keys', () => {
    it('should throw ValidationError when recipe contains non-existent slot key', async () => {
      // Load recipe with invalid slot key 'scalp' instead of 'hair'
      testBed.loadRecipes({
        'test:invalid_slots': {
          recipeId: 'test:invalid_slots',
          blueprintId: 'test:humanoid',
          slots: {
            scalp: {
              // This should be 'hair', not 'scalp'
              partType: 'hair',
              preferId: 'test:hair',
            },
          },
        },
      });

      // Attempt to create anatomy graph with invalid recipe
      await expect(
        bodyBlueprintFactory.createAnatomyGraph(
          'test:humanoid',
          'test:invalid_slots'
        )
      ).rejects.toThrow(ValidationError);

      // Verify specific error message
      await expect(
        bodyBlueprintFactory.createAnatomyGraph(
          'test:humanoid',
          'test:invalid_slots'
        )
      ).rejects.toThrow(
        "Recipe 'test:invalid_slots' contains invalid slot keys that don't exist in blueprint 'test:humanoid': scalp"
      );
    });

    it('should throw ValidationError with multiple invalid slot keys', async () => {
      // Load recipe with multiple invalid slot keys
      testBed.loadRecipes({
        'test:multiple_invalid': {
          recipeId: 'test:multiple_invalid',
          blueprintId: 'test:humanoid',
          slots: {
            scalp: {
              partType: 'hair',
              preferId: 'test:hair',
            },
            neck: {
              partType: 'neck',
            },
            foot: {
              partType: 'foot',
            },
          },
        },
      });

      // Attempt to create anatomy graph
      await expect(
        bodyBlueprintFactory.createAnatomyGraph(
          'test:humanoid',
          'test:multiple_invalid'
        )
      ).rejects.toThrow(
        "Recipe 'test:multiple_invalid' contains invalid slot keys that don't exist in blueprint 'test:humanoid': scalp, neck, foot"
      );
    });

    it('should dispatch SYSTEM_ERROR_OCCURRED_ID event with full context', async () => {
      testBed.loadRecipes({
        'test:invalid_with_context': {
          recipeId: 'test:invalid_with_context',
          blueprintId: 'test:humanoid',
          slots: {
            invalidSlot: {
              partType: 'something',
            },
          },
        },
      });

      // Clear any previous calls
      eventDispatcher.dispatch.mockClear();

      // Attempt to create anatomy graph
      try {
        await bodyBlueprintFactory.createAnatomyGraph(
          'test:humanoid',
          'test:invalid_with_context'
        );
      } catch {
        // Expected error
      }

      // Verify event was dispatched
      expect(eventDispatcher.dispatch).toHaveBeenCalled();

      // Find the validation error event call
      const calls = eventDispatcher.dispatch.mock.calls;
      const validationCall = calls.find(
        (call) =>
          call[0] === SYSTEM_ERROR_OCCURRED_ID &&
          call[1].message.includes('invalid slot keys')
      );

      expect(validationCall).toBeDefined();
      expect(validationCall[1].message).toContain('invalid slot keys');

      const details = JSON.parse(validationCall[1].details.raw);
      expect(details.recipeId).toBe('test:invalid_with_context');
      expect(details.blueprintId).toBe('test:humanoid');
      expect(details.invalidSlotKeys).toEqual(['invalidSlot']);
      expect(details.validSlotKeys).toEqual([
        'head',
        'leftArm',
        'rightArm',
        'hair',
      ]);
      expect(details.context).toBe('BlueprintValidator.validateRecipeSlots');
    });
  });

  describe('Valid Recipe Slot Keys', () => {
    it('should allow torso slot as special case for root entity override', async () => {
      // Load recipe with torso slot (special case)
      testBed.loadRecipes({
        'test:torso_override': {
          recipeId: 'test:torso_override',
          blueprintId: 'test:humanoid',
          slots: {
            torso: {
              partType: 'torso',
              preferId: 'test:torso',
            },
            head: {
              partType: 'head',
              preferId: 'test:head',
            },
          },
        },
      });

      // Should create anatomy without errors - torso is allowed as special case
      const result = await bodyBlueprintFactory.createAnatomyGraph(
        'test:humanoid',
        'test:torso_override'
      );

      expect(result).toBeDefined();
      expect(result.rootId).toBeDefined();
      expect(result.entities).toBeInstanceOf(Array);
    });

    it('should successfully create anatomy with all valid slot keys', async () => {
      // Load recipe with all valid slot keys
      testBed.loadRecipes({
        'test:valid_slots': {
          recipeId: 'test:valid_slots',
          blueprintId: 'test:humanoid',
          slots: {
            head: {
              partType: 'head',
              preferId: 'test:head',
            },
            leftArm: {
              partType: 'arm',
              preferId: 'test:arm',
            },
            rightArm: {
              partType: 'arm',
              preferId: 'test:arm',
            },
            hair: {
              partType: 'hair',
              preferId: 'test:hair',
            },
          },
        },
      });

      // Should create anatomy without errors
      const result = await bodyBlueprintFactory.createAnatomyGraph(
        'test:humanoid',
        'test:valid_slots'
      );

      expect(result).toBeDefined();
      expect(result.rootId).toBeDefined();
      expect(result.entities).toBeInstanceOf(Array);
      expect(result.entities.length).toBeGreaterThan(0);
    });

    it('should handle recipes with no slots defined', async () => {
      // Load recipe with no slots
      testBed.loadRecipes({
        'test:no_slots': {
          recipeId: 'test:no_slots',
          blueprintId: 'test:humanoid',
          slots: {},
        },
      });

      // Should create anatomy without errors
      const result = await bodyBlueprintFactory.createAnatomyGraph(
        'test:humanoid',
        'test:no_slots'
      );

      expect(result).toBeDefined();
      expect(result.rootId).toBeDefined();
    });

    it('should handle recipes with partial valid slots', async () => {
      // Load recipe with only some slots defined
      testBed.loadRecipes({
        'test:partial_slots': {
          recipeId: 'test:partial_slots',
          blueprintId: 'test:humanoid',
          slots: {
            head: {
              partType: 'head',
              preferId: 'test:head',
            },
            hair: {
              partType: 'hair',
              preferId: 'test:hair',
            },
          },
        },
      });

      // Should create anatomy without errors
      const result = await bodyBlueprintFactory.createAnatomyGraph(
        'test:humanoid',
        'test:partial_slots'
      );

      expect(result).toBeDefined();
      expect(result.rootId).toBeDefined();
      expect(result.entities).toBeInstanceOf(Array);
    });
  });

  describe('Edge Cases', () => {
    it('should handle blueprint with no slots', async () => {
      // Load blueprint with no slots
      testBed.loadBlueprints({
        'test:no_slots_blueprint': {
          id: 'test:no_slots_blueprint',
          root: 'test:torso',
          // No slots defined
        },
      });

      // Load recipe trying to add slots
      testBed.loadRecipes({
        'test:recipe_for_no_slots': {
          recipeId: 'test:recipe_for_no_slots',
          blueprintId: 'test:no_slots_blueprint',
          slots: {
            anySlot: {
              partType: 'something',
            },
          },
        },
      });

      // Should throw error for invalid slot
      await expect(
        bodyBlueprintFactory.createAnatomyGraph(
          'test:no_slots_blueprint',
          'test:recipe_for_no_slots'
        )
      ).rejects.toThrow(
        "Recipe 'test:recipe_for_no_slots' contains invalid slot keys that don't exist in blueprint 'test:no_slots_blueprint': anySlot"
      );
    });

    it('should validate recipe slots after pattern expansion', async () => {
      // Load recipe with patterns that expand to invalid slots
      testBed.loadRecipes({
        'test:pattern_invalid': {
          recipeId: 'test:pattern_invalid',
          blueprintId: 'test:humanoid',
          patterns: [
            {
              matches: ['invalidSlot1', 'invalidSlot2'],
              partType: 'something',
            },
          ],
          slots: {},
        },
      });

      // Pattern expansion happens in processRecipe, so invalid slots should be caught
      await expect(
        bodyBlueprintFactory.createAnatomyGraph(
          'test:humanoid',
          'test:pattern_invalid'
        )
      ).rejects.toThrow(
        "Recipe 'test:pattern_invalid' contains invalid slot keys that don't exist in blueprint 'test:humanoid': invalidSlot1, invalidSlot2"
      );
    });
  });
});
