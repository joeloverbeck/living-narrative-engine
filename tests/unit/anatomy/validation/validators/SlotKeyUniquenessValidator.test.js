import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { SlotKeyUniquenessValidator } from '../../../../../src/anatomy/validation/validators/SlotKeyUniquenessValidator.js';
import { createTestBed } from '../../../../common/testBed.js';
import ValidationResultBuilder from '../../../../../src/anatomy/validation/core/ValidationResultBuilder.js';

describe('SlotKeyUniquenessValidator', () => {
  let logger;
  let mockAnatomyBlueprintRepository;
  let mockSlotGenerator;
  let mockDataRegistry;

  beforeEach(() => {
    ({ mockLogger: logger } = createTestBed());
    mockAnatomyBlueprintRepository = {
      getBlueprint: jest.fn(),
    };
    mockSlotGenerator = {
      generateBlueprintSlots: jest.fn(),
    };
    mockDataRegistry = {
      get: jest.fn(),
    };
  });

  const createValidator = (overrides = {}) =>
    new SlotKeyUniquenessValidator({
      logger,
      anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
      slotGenerator: mockSlotGenerator,
      dataRegistry: mockDataRegistry,
      ...overrides,
    });

  const createBuilder = (recipeId = 'test:recipe') =>
    new ValidationResultBuilder(recipeId);

  describe('constructor', () => {
    it('initializes with expected defaults', () => {
      const validator = createValidator();
      expect(validator.name).toBe('slot-key-uniqueness');
      expect(validator.priority).toBe(15);
      expect(validator.failFast).toBe(false);
    });

    it('throws when logger is missing', () => {
      expect(
        () =>
          new SlotKeyUniquenessValidator({
            anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
            slotGenerator: mockSlotGenerator,
            dataRegistry: mockDataRegistry,
          })
      ).toThrow();
    });

    it('throws when anatomyBlueprintRepository is missing', () => {
      expect(
        () =>
          new SlotKeyUniquenessValidator({
            logger,
            slotGenerator: mockSlotGenerator,
            dataRegistry: mockDataRegistry,
          })
      ).toThrow();
    });

    it('throws when slotGenerator is missing', () => {
      expect(
        () =>
          new SlotKeyUniquenessValidator({
            logger,
            anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
            dataRegistry: mockDataRegistry,
          })
      ).toThrow();
    });

    it('throws when dataRegistry is missing', () => {
      expect(
        () =>
          new SlotKeyUniquenessValidator({
            logger,
            anatomyBlueprintRepository: mockAnatomyBlueprintRepository,
            slotGenerator: mockSlotGenerator,
          })
      ).toThrow();
    });
  });

  describe('performValidation', () => {
    describe('skip conditions', () => {
      it('should skip validation when recipe has no blueprintId', async () => {
        const recipe = {};
        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        expect(result.isValid).toBe(true);
        expect(
          mockAnatomyBlueprintRepository.getBlueprint
        ).not.toHaveBeenCalled();
      });

      it('should skip validation when blueprint does not exist', async () => {
        const recipe = { blueprintId: 'anatomy:missing' };
        mockAnatomyBlueprintRepository.getBlueprint.mockReturnValue(undefined);

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        expect(result.isValid).toBe(true);
      });

      it('should skip validation for V1 blueprints', async () => {
        const recipe = { blueprintId: 'anatomy:v1_blueprint' };
        mockAnatomyBlueprintRepository.getBlueprint.mockReturnValue({
          id: 'anatomy:v1_blueprint',
          schemaVersion: '1.0',
        });

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        expect(result.isValid).toBe(true);
        expect(
          result.passed.some((p) => p.check === 'SLOT_KEY_UNIQUENESS_SKIP')
        ).toBe(true);
      });

      it('should skip validation when V2 blueprint has no structureTemplate', async () => {
        const recipe = { blueprintId: 'anatomy:no_template' };
        mockAnatomyBlueprintRepository.getBlueprint.mockReturnValue({
          id: 'anatomy:no_template',
          schemaVersion: '2.0',
          // No structureTemplate
        });

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        expect(result.isValid).toBe(true);
        expect(
          result.passed.some((p) => p.check === 'SLOT_KEY_UNIQUENESS_SKIP')
        ).toBe(true);
      });

      it('should handle missing template gracefully', async () => {
        const recipe = { blueprintId: 'anatomy:blueprint' };
        mockAnatomyBlueprintRepository.getBlueprint.mockReturnValue({
          id: 'anatomy:blueprint',
          schemaVersion: '2.0',
          structureTemplate: 'missing_template',
        });
        mockDataRegistry.get.mockReturnValue(undefined);

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        expect(result.isValid).toBe(true);
        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining("Template 'missing_template' not found")
        );
      });
    });

    describe('unique slot keys (pass scenarios)', () => {
      it('should pass when all slot keys are unique', async () => {
        const recipe = { blueprintId: 'anatomy:human' };
        mockAnatomyBlueprintRepository.getBlueprint.mockReturnValue({
          id: 'anatomy:human',
          schemaVersion: '2.0',
          structureTemplate: 'humanoid',
          additionalSlots: {
            tail: { parent: 'torso', socket: 'tail_socket' },
          },
        });
        mockDataRegistry.get.mockReturnValue({ id: 'humanoid' });
        mockSlotGenerator.generateBlueprintSlots.mockReturnValue({
          head: { parent: 'torso', socket: 'head_socket' },
          left_arm: { parent: 'torso', socket: 'left_arm_socket' },
          right_arm: { parent: 'torso', socket: 'right_arm_socket' },
        });

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        expect(result.isValid).toBe(true);
        expect(
          result.passed.some((p) => p.check === 'SLOT_KEY_UNIQUENESS_PASS')
        ).toBe(true);
      });

      it('should pass when additionalSlots is empty', async () => {
        const recipe = { blueprintId: 'anatomy:human' };
        mockAnatomyBlueprintRepository.getBlueprint.mockReturnValue({
          id: 'anatomy:human',
          schemaVersion: '2.0',
          structureTemplate: 'humanoid',
          // No additionalSlots
        });
        mockDataRegistry.get.mockReturnValue({ id: 'humanoid' });
        mockSlotGenerator.generateBlueprintSlots.mockReturnValue({
          head: { parent: 'torso', socket: 'head_socket' },
        });

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        expect(result.isValid).toBe(true);
      });

      it('should pass when generated slots is empty', async () => {
        const recipe = { blueprintId: 'anatomy:custom' };
        mockAnatomyBlueprintRepository.getBlueprint.mockReturnValue({
          id: 'anatomy:custom',
          schemaVersion: '2.0',
          structureTemplate: 'empty_template',
          additionalSlots: {
            custom_part: { parent: 'root', socket: 'main_socket' },
          },
        });
        mockDataRegistry.get.mockReturnValue({ id: 'empty_template' });
        mockSlotGenerator.generateBlueprintSlots.mockReturnValue({});

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        expect(result.isValid).toBe(true);
      });
    });

    describe('unintentional duplicate detection (error scenarios)', () => {
      it('should report error when additionalSlots duplicates generated slot with same parent', async () => {
        const recipe = { blueprintId: 'anatomy:human' };
        mockAnatomyBlueprintRepository.getBlueprint.mockReturnValue({
          id: 'anatomy:human',
          schemaVersion: '2.0',
          structureTemplate: 'humanoid',
          additionalSlots: {
            head: { parent: 'torso', socket: 'head_socket' }, // Same key AND same parent
          },
        });
        mockDataRegistry.get.mockReturnValue({ id: 'humanoid' });
        mockSlotGenerator.generateBlueprintSlots.mockReturnValue({
          head: { parent: 'torso', socket: 'head_socket' },
        });

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
        expect(result.errors[0].type).toBe('UNINTENTIONAL_SLOT_DUPLICATE');
        expect(result.errors[0].message).toContain('head');
      });

      it('should report multiple errors for multiple unintentional duplicates', async () => {
        const recipe = { blueprintId: 'anatomy:human' };
        mockAnatomyBlueprintRepository.getBlueprint.mockReturnValue({
          id: 'anatomy:human',
          schemaVersion: '2.0',
          structureTemplate: 'humanoid',
          additionalSlots: {
            head: { parent: 'torso', socket: 'head_socket' },
            left_arm: { parent: 'torso', socket: 'left_arm_socket' },
          },
        });
        mockDataRegistry.get.mockReturnValue({ id: 'humanoid' });
        mockSlotGenerator.generateBlueprintSlots.mockReturnValue({
          head: { parent: 'torso', socket: 'head_socket' },
          left_arm: { parent: 'torso', socket: 'left_arm_socket' },
        });

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBe(2);
        expect(
          result.errors.every((e) => e.type === 'UNINTENTIONAL_SLOT_DUPLICATE')
        ).toBe(true);
      });
    });

    describe('intentional override detection (warning scenarios)', () => {
      it('should report warning when additionalSlots overrides with different parent', async () => {
        const recipe = { blueprintId: 'anatomy:modified_human' };
        mockAnatomyBlueprintRepository.getBlueprint.mockReturnValue({
          id: 'anatomy:modified_human',
          schemaVersion: '2.0',
          structureTemplate: 'humanoid',
          additionalSlots: {
            head: { parent: 'neck', socket: 'head_socket' }, // Same key but DIFFERENT parent
          },
        });
        mockDataRegistry.get.mockReturnValue({ id: 'humanoid' });
        mockSlotGenerator.generateBlueprintSlots.mockReturnValue({
          head: { parent: 'torso', socket: 'head_socket' },
        });

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        // Warnings don't affect isValid
        expect(result.isValid).toBe(true);
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0].type).toBe('INTENTIONAL_SLOT_OVERRIDE');
        expect(result.warnings[0].message).toContain('head');
      });

      it('should handle mix of intentional and unintentional overrides', async () => {
        const recipe = { blueprintId: 'anatomy:mixed' };
        mockAnatomyBlueprintRepository.getBlueprint.mockReturnValue({
          id: 'anatomy:mixed',
          schemaVersion: '2.0',
          structureTemplate: 'humanoid',
          additionalSlots: {
            head: { parent: 'neck', socket: 'head_socket' }, // Different parent = intentional
            left_arm: { parent: 'torso', socket: 'left_arm_socket' }, // Same parent = unintentional
          },
        });
        mockDataRegistry.get.mockReturnValue({ id: 'humanoid' });
        mockSlotGenerator.generateBlueprintSlots.mockReturnValue({
          head: { parent: 'torso', socket: 'head_socket' },
          left_arm: { parent: 'torso', socket: 'left_arm_socket' },
        });

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        expect(result.isValid).toBe(false); // Unintentional duplicate causes failure
        expect(result.errors.length).toBe(1);
        expect(result.warnings.length).toBe(1);
        expect(result.errors[0].type).toBe('UNINTENTIONAL_SLOT_DUPLICATE');
        expect(result.warnings[0].type).toBe('INTENTIONAL_SLOT_OVERRIDE');
      });
    });

    describe('duplicate parent:socket detection', () => {
      it('should warn when two slots attach to same parent:socket combination', async () => {
        const recipe = { blueprintId: 'anatomy:conflicting' };
        mockAnatomyBlueprintRepository.getBlueprint.mockReturnValue({
          id: 'anatomy:conflicting',
          schemaVersion: '2.0',
          structureTemplate: 'base',
          additionalSlots: {
            // Different key but same parent:socket as generated left_arm
            extra_left_arm: { parent: 'torso', socket: 'left_arm_socket' },
          },
        });
        mockDataRegistry.get.mockReturnValue({ id: 'base' });
        mockSlotGenerator.generateBlueprintSlots.mockReturnValue({
          left_arm: { parent: 'torso', socket: 'left_arm_socket' },
        });

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        // Should have DUPLICATE_PARENT_SOCKET warning
        expect(
          result.warnings.some((w) => w.type === 'DUPLICATE_PARENT_SOCKET')
        ).toBe(true);
      });

      it('should not warn when slots have different parent:socket combinations', async () => {
        const recipe = { blueprintId: 'anatomy:valid' };
        mockAnatomyBlueprintRepository.getBlueprint.mockReturnValue({
          id: 'anatomy:valid',
          schemaVersion: '2.0',
          structureTemplate: 'base',
          additionalSlots: {
            tail: { parent: 'torso', socket: 'tail_socket' },
          },
        });
        mockDataRegistry.get.mockReturnValue({ id: 'base' });
        mockSlotGenerator.generateBlueprintSlots.mockReturnValue({
          left_arm: { parent: 'torso', socket: 'left_arm_socket' },
          right_arm: { parent: 'torso', socket: 'right_arm_socket' },
        });

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        expect(
          result.warnings.some((w) => w.type === 'DUPLICATE_PARENT_SOCKET')
        ).toBe(false);
      });

      it('should skip parent:socket check for slots without parent or socket', async () => {
        const recipe = { blueprintId: 'anatomy:incomplete' };
        mockAnatomyBlueprintRepository.getBlueprint.mockReturnValue({
          id: 'anatomy:incomplete',
          schemaVersion: '2.0',
          structureTemplate: 'base',
          additionalSlots: {
            orphan: {}, // No parent or socket
          },
        });
        mockDataRegistry.get.mockReturnValue({ id: 'base' });
        mockSlotGenerator.generateBlueprintSlots.mockReturnValue({
          root: { parent: null }, // No socket
        });

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        expect(result.isValid).toBe(true);
        expect(
          result.warnings.some((w) => w.type === 'DUPLICATE_PARENT_SOCKET')
        ).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('should handle null return from slotGenerator', async () => {
        const recipe = { blueprintId: 'anatomy:null_slots' };
        mockAnatomyBlueprintRepository.getBlueprint.mockReturnValue({
          id: 'anatomy:null_slots',
          schemaVersion: '2.0',
          structureTemplate: 'broken',
          additionalSlots: { part: {} },
        });
        mockDataRegistry.get.mockReturnValue({ id: 'broken' });
        mockSlotGenerator.generateBlueprintSlots.mockReturnValue(null);

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        expect(result.isValid).toBe(true);
      });

      it('should handle undefined parent comparison correctly', async () => {
        const recipe = { blueprintId: 'anatomy:undefined_parents' };
        mockAnatomyBlueprintRepository.getBlueprint.mockReturnValue({
          id: 'anatomy:undefined_parents',
          schemaVersion: '2.0',
          structureTemplate: 'template',
          additionalSlots: {
            part: { socket: 'some_socket' }, // No parent (undefined)
          },
        });
        mockDataRegistry.get.mockReturnValue({ id: 'template' });
        mockSlotGenerator.generateBlueprintSlots.mockReturnValue({
          part: { socket: 'some_socket' }, // No parent (undefined) - same as additional
        });

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        // Both have undefined parent, so they're equal = unintentional duplicate
        expect(result.isValid).toBe(false);
        expect(result.errors[0].type).toBe('UNINTENTIONAL_SLOT_DUPLICATE');
      });
    });

    describe('error message quality', () => {
      it('should include slot key in error message', async () => {
        const recipe = { blueprintId: 'anatomy:test' };
        mockAnatomyBlueprintRepository.getBlueprint.mockReturnValue({
          id: 'anatomy:test',
          schemaVersion: '2.0',
          structureTemplate: 'template',
          additionalSlots: {
            custom_slot_name: { parent: 'root', socket: 's1' },
          },
        });
        mockDataRegistry.get.mockReturnValue({ id: 'template' });
        mockSlotGenerator.generateBlueprintSlots.mockReturnValue({
          custom_slot_name: { parent: 'root', socket: 's1' },
        });

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        expect(result.errors[0].message).toContain('custom_slot_name');
      });

      it('should include parent info in warning details', async () => {
        const recipe = { blueprintId: 'anatomy:test' };
        mockAnatomyBlueprintRepository.getBlueprint.mockReturnValue({
          id: 'anatomy:test',
          schemaVersion: '2.0',
          structureTemplate: 'template',
          additionalSlots: {
            part: { parent: 'new_parent', socket: 's1' },
          },
        });
        mockDataRegistry.get.mockReturnValue({ id: 'template' });
        mockSlotGenerator.generateBlueprintSlots.mockReturnValue({
          part: { parent: 'original_parent', socket: 's1' },
        });

        const validator = createValidator();
        const builder = createBuilder();

        await validator.performValidation(recipe, {}, builder);

        const result = builder.build();
        // Metadata is spread directly into the warning object
        expect(result.warnings[0].generatedParent).toBe('original_parent');
        expect(result.warnings[0].overrideParent).toBe('new_parent');
      });
    });
  });
});
