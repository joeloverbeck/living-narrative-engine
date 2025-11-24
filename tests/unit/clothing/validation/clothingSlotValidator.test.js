/**
 * @file Unit tests for ClothingSlotValidator
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ClothingSlotValidator } from '../../../../src/clothing/validation/clothingSlotValidator.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('ClothingSlotValidator', () => {
  let validator;
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
    validator = new ClothingSlotValidator({ logger });
  });

  describe('constructor', () => {
    it('should create instance with valid dependencies', () => {
      expect(validator).toBeDefined();
      expect(validator).toBeInstanceOf(ClothingSlotValidator);
    });

    it('should throw error when logger is missing', () => {
      expect(() => new ClothingSlotValidator({})).toThrow();
    });
  });

  describe('validateSlotCompatibility', () => {
    const entityId = 'entity123';
    const slotId = 'upper_body';
    const itemId = 'item456';
    let availableSlots;
    let resolveAttachmentPoints;

    beforeEach(() => {
      availableSlots = new Map();
      resolveAttachmentPoints = jest.fn();
    });

    describe('parameter validation', () => {
      it('should throw error when entityId is missing', async () => {
        await expect(
          validator.validateSlotCompatibility(
            null,
            slotId,
            itemId,
            availableSlots,
            resolveAttachmentPoints
          )
        ).rejects.toThrow('Entity ID is required');
      });

      it('should throw error when entityId is not a string', async () => {
        await expect(
          validator.validateSlotCompatibility(
            123,
            slotId,
            itemId,
            availableSlots,
            resolveAttachmentPoints
          )
        ).rejects.toThrow('Entity ID is required');
      });

      it('should throw error when slotId is missing', async () => {
        await expect(
          validator.validateSlotCompatibility(
            entityId,
            null,
            itemId,
            availableSlots,
            resolveAttachmentPoints
          )
        ).rejects.toThrow('Slot ID is required');
      });

      it('should throw error when slotId is not a string', async () => {
        await expect(
          validator.validateSlotCompatibility(
            entityId,
            {},
            itemId,
            availableSlots,
            resolveAttachmentPoints
          )
        ).rejects.toThrow('Slot ID is required');
      });

      it('should throw error when itemId is missing', async () => {
        await expect(
          validator.validateSlotCompatibility(
            entityId,
            slotId,
            null,
            availableSlots,
            resolveAttachmentPoints
          )
        ).rejects.toThrow('Item ID is required');
      });

      it('should throw error when itemId is not a string', async () => {
        await expect(
          validator.validateSlotCompatibility(
            entityId,
            slotId,
            [],
            availableSlots,
            resolveAttachmentPoints
          )
        ).rejects.toThrow('Item ID is required');
      });
    });

    describe('slot existence validation', () => {
      it('should return invalid when entity lacks the slot', async () => {
        // availableSlots is empty, so slot doesn't exist
        const result = await validator.validateSlotCompatibility(
          entityId,
          slotId,
          itemId,
          availableSlots,
          resolveAttachmentPoints
        );

        expect(result).toEqual({
          valid: false,
          reason: `Entity lacks clothing slot '${slotId}'`,
        });
        expect(resolveAttachmentPoints).not.toHaveBeenCalled();
      });

      it('should continue validation when entity has the slot', async () => {
        availableSlots.set(slotId, { blueprintSlots: ['torso'] });
        resolveAttachmentPoints.mockResolvedValue([
          { entityId: 'part1', socketId: 'socket1' },
        ]);

        const result = await validator.validateSlotCompatibility(
          entityId,
          slotId,
          itemId,
          availableSlots,
          resolveAttachmentPoints
        );

        expect(result.valid).toBe(true);
        expect(resolveAttachmentPoints).toHaveBeenCalledWith(entityId, slotId);
      });
    });

    describe('attachment point validation', () => {
      beforeEach(() => {
        availableSlots.set(slotId, { blueprintSlots: ['torso'] });
      });

      it('should return invalid when slot has no attachment points', async () => {
        resolveAttachmentPoints.mockResolvedValue([]);

        const result = await validator.validateSlotCompatibility(
          entityId,
          slotId,
          itemId,
          availableSlots,
          resolveAttachmentPoints
        );

        expect(result).toEqual({
          valid: false,
          reason:
            "Clothing slot 'upper_body' has no valid attachment points for entity 'entity123' with item 'item456'. This usually means: 1) Socket index not populated yet, 2) Blueprint slot mapping incorrect, or 3) Anatomy part missing the required socket.",
        });
      });

      it('should return invalid when attachment points is null', async () => {
        resolveAttachmentPoints.mockResolvedValue(null);

        const result = await validator.validateSlotCompatibility(
          entityId,
          slotId,
          itemId,
          availableSlots,
          resolveAttachmentPoints
        );

        expect(result).toEqual({
          valid: false,
          reason:
            "Clothing slot 'upper_body' has no valid attachment points for entity 'entity123' with item 'item456'. This usually means: 1) Socket index not populated yet, 2) Blueprint slot mapping incorrect, or 3) Anatomy part missing the required socket.",
        });
      });

      it('should return valid when slot has attachment points', async () => {
        const attachmentPoints = [
          { entityId: 'part1', socketId: 'socket1' },
          { entityId: 'part2', socketId: 'socket2' },
        ];
        resolveAttachmentPoints.mockResolvedValue(attachmentPoints);

        const result = await validator.validateSlotCompatibility(
          entityId,
          slotId,
          itemId,
          availableSlots,
          resolveAttachmentPoints
        );

        expect(result).toEqual({ valid: true });
        expect(logger.debug).toHaveBeenCalledWith(
          `ClothingSlotValidator: Slot '${slotId}' has ${attachmentPoints.length} valid attachment points`
        );
      });

      it('should handle errors from resolveAttachmentPoints', async () => {
        const errorMessage = 'Failed to resolve attachment points';
        resolveAttachmentPoints.mockRejectedValue(new Error(errorMessage));

        const result = await validator.validateSlotCompatibility(
          entityId,
          slotId,
          itemId,
          availableSlots,
          resolveAttachmentPoints
        );

        expect(result).toEqual({
          valid: false,
          reason: `Failed to resolve attachment points: ${errorMessage}`,
        });
        expect(logger.error).toHaveBeenCalledWith(
          `ClothingSlotValidator: Error resolving attachment points for slot '${slotId}'`,
          expect.any(Object)
        );
      });
    });

    describe('logging', () => {
      it('should log debug message when starting validation', async () => {
        const result = await validator.validateSlotCompatibility(
          entityId,
          slotId,
          itemId,
          availableSlots,
          resolveAttachmentPoints
        );

        expect(logger.debug).toHaveBeenCalledWith(
          `ClothingSlotValidator: Validating slot '${slotId}' for entity '${entityId}' with item '${itemId}'`
        );
      });
    });

    describe('edge cases', () => {
      it('should handle empty string IDs', async () => {
        await expect(
          validator.validateSlotCompatibility(
            '',
            slotId,
            itemId,
            availableSlots,
            resolveAttachmentPoints
          )
        ).rejects.toThrow('Entity ID is required');
      });

      it('should handle single attachment point', async () => {
        availableSlots.set(slotId, { blueprintSlots: ['torso'] });
        resolveAttachmentPoints.mockResolvedValue([
          { entityId: 'part1', socketId: 'socket1' },
        ]);

        const result = await validator.validateSlotCompatibility(
          entityId,
          slotId,
          itemId,
          availableSlots,
          resolveAttachmentPoints
        );

        expect(result).toEqual({ valid: true });
      });

      it('should handle undefined availableSlots', async () => {
        const result = await validator.validateSlotCompatibility(
          entityId,
          slotId,
          itemId,
          undefined,
          resolveAttachmentPoints
        );

        // undefined.has() will throw, but our code should handle it gracefully
        expect(result.valid).toBe(false);
      });
    });
  });
});
