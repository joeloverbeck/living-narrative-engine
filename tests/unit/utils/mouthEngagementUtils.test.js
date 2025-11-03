import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import {
  updateMouthEngagementLock,
  isMouthLocked,
  getMouthParts,
} from '../../../src/utils/mouthEngagementUtils.js';

const createMockEntityManager = () => ({
  getComponentData: jest.fn(),
  addComponent: jest.fn(),
});

describe('mouthEngagementUtils', () => {
  let mockEntityManager;

  beforeEach(() => {
    mockEntityManager = createMockEntityManager();
  });

  describe('updateMouthEngagementLock', () => {
    describe('Input Validation', () => {
      test('should throw if entityManager is missing', async () => {
        await expect(
          updateMouthEngagementLock(null, 'entity_1', true)
        ).rejects.toThrow('EntityManager is required');
      });

      test('should throw if entityId is invalid', async () => {
        await expect(
          updateMouthEngagementLock(mockEntityManager, '', true)
        ).rejects.toThrow('Valid entityId string is required');

        await expect(
          updateMouthEngagementLock(mockEntityManager, null, true)
        ).rejects.toThrow('Valid entityId string is required');
      });

      test('should throw if locked is not boolean', async () => {
        await expect(
          updateMouthEngagementLock(mockEntityManager, 'entity_1', 'yes')
        ).rejects.toThrow('Locked parameter must be a boolean');
      });
    });

    describe('Anatomy-Based Entities', () => {
      test('should lock mouth part in anatomy-based entity', async () => {
        // Setup anatomy structure
        mockEntityManager.getComponentData
          .mockReturnValueOnce({
            // anatomy:body
            body: {
              root: 'torso_1',
              parts: { mouth: 'mouth_1' },
            },
          })
          .mockReturnValueOnce({
            // anatomy:part
            subType: 'mouth',
          })
          .mockReturnValueOnce(null); // No existing engagement

        // Execute
        const result = await updateMouthEngagementLock(
          mockEntityManager,
          'entity_1',
          true
        );

        // Verify
        expect(result).toEqual({
          updatedParts: [
            {
              partId: 'mouth_1',
              engagement: { locked: true, forcedOverride: false },
            },
          ],
          locked: true,
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'mouth_1',
          'core:mouth_engagement',
          { locked: true, forcedOverride: false }
        );
      });

      test('should unlock mouth part in anatomy-based entity', async () => {
        // Setup anatomy structure with existing engagement
        mockEntityManager.getComponentData
          .mockReturnValueOnce({
            // anatomy:body
            body: {
              root: 'torso_1',
              parts: { mouth: 'mouth_1' },
            },
          })
          .mockReturnValueOnce({
            // anatomy:part
            subType: 'mouth',
          })
          .mockReturnValueOnce({
            // Existing engagement
            locked: true,
            forcedOverride: false,
          });

        // Execute
        const result = await updateMouthEngagementLock(
          mockEntityManager,
          'entity_1',
          false
        );

        // Verify
        expect(result).toEqual({
          updatedParts: [
            {
              partId: 'mouth_1',
              engagement: { locked: false, forcedOverride: false },
            },
          ],
          locked: false,
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'mouth_1',
          'core:mouth_engagement',
          { locked: false, forcedOverride: false }
        );
      });

      test('should handle multiple mouth parts', async () => {
        // Setup entity with two mouths
        mockEntityManager.getComponentData
          .mockReturnValueOnce({
            // anatomy:body
            body: {
              root: 'torso_1',
              parts: {
                mouth: 'mouth_1',
                secondary_mouth: 'mouth_2',
              },
            },
          })
          .mockReturnValueOnce({ subType: 'mouth' }) // mouth_1 part
          .mockReturnValueOnce(null) // mouth_1 engagement
          .mockReturnValueOnce({ subType: 'mouth' }) // mouth_2 part
          .mockReturnValueOnce(null); // mouth_2 engagement

        // Execute
        const result = await updateMouthEngagementLock(
          mockEntityManager,
          'entity_1',
          true
        );

        // Verify both mouths updated
        expect(result.updatedParts).toHaveLength(2);
        expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(2);
      });

      test('should return null if no mouth parts found', async () => {
        // Setup entity without mouth
        mockEntityManager.getComponentData
          .mockReturnValueOnce({
            // anatomy:body
            body: {
              root: 'torso_1',
              parts: { head: 'head_1' }, // No mouth
            },
          })
          .mockReturnValueOnce({ subType: 'head' }); // Not a mouth

        // Execute
        const result = await updateMouthEngagementLock(
          mockEntityManager,
          'entity_1',
          true
        );

        // Verify
        expect(result).toBeNull();
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      });

      test('should return null when body component lacks parts map', async () => {
        mockEntityManager.getComponentData.mockReturnValueOnce({
          body: {
            root: 'torso_1',
          },
        });

        const result = await updateMouthEngagementLock(
          mockEntityManager,
          'entity_1',
          true
        );

        expect(result).toBeNull();
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      });

      test('should skip non-mouth parts', async () => {
        // Setup entity with mixed parts
        mockEntityManager.getComponentData
          .mockReturnValueOnce({
            // anatomy:body
            body: {
              root: 'torso_1',
              parts: {
                head: 'head_1',
                mouth: 'mouth_1',
                hand: 'hand_1',
              },
            },
          })
          .mockReturnValueOnce({ subType: 'head' }) // head part
          .mockReturnValueOnce({ subType: 'mouth' }) // mouth part
          .mockReturnValueOnce(null) // mouth engagement
          .mockReturnValueOnce({ subType: 'hand' }); // hand part

        // Execute
        const result = await updateMouthEngagementLock(
          mockEntityManager,
          'entity_1',
          true
        );

        // Verify only mouth was updated
        expect(result.updatedParts).toHaveLength(1);
        expect(result.updatedParts[0].partId).toBe('mouth_1');
        expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
      });
    });

    describe('Legacy Entities', () => {
      test('should update existing component on legacy entity', async () => {
        // Setup legacy entity
        mockEntityManager.getComponentData
          .mockReturnValueOnce(null) // No anatomy:body
          .mockReturnValueOnce({
            // Existing engagement
            locked: false,
            forcedOverride: false,
          });

        // Execute
        const result = await updateMouthEngagementLock(
          mockEntityManager,
          'legacy_entity',
          true
        );

        // Verify
        expect(result).toEqual({ locked: true });
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'legacy_entity',
          'core:mouth_engagement',
          { locked: true, forcedOverride: false }
        );
      });

      test('should create component if missing on legacy entity', async () => {
        // Setup
        mockEntityManager.getComponentData
          .mockReturnValueOnce(null) // No anatomy:body
          .mockReturnValueOnce(null); // No existing component

        // Execute
        const result = await updateMouthEngagementLock(
          mockEntityManager,
          'legacy_entity',
          false
        );

        // Verify
        expect(result).toEqual({ locked: false });
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'legacy_entity',
          'core:mouth_engagement',
          { locked: false, forcedOverride: false }
        );
      });

      test('should preserve forcedOverride when updating', async () => {
        // Setup
        mockEntityManager.getComponentData
          .mockReturnValueOnce(null) // No anatomy:body
          .mockReturnValueOnce({
            // Existing engagement with forcedOverride
            locked: false,
            forcedOverride: true,
          });

        // Execute
        await updateMouthEngagementLock(
          mockEntityManager,
          'legacy_entity',
          true
        );

        // Verify forcedOverride preserved
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'legacy_entity',
          'core:mouth_engagement',
          { locked: true, forcedOverride: true }
        );
      });
    });
  });

  describe('isMouthLocked', () => {
    test('should return true if anatomy mouth is locked', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          // anatomy:body
          body: {
            root: 'torso_1',
            parts: { mouth: 'mouth_1' },
          },
        })
        .mockReturnValueOnce({ subType: 'mouth' })
        .mockReturnValueOnce({ locked: true });

      const result = isMouthLocked(mockEntityManager, 'entity_1');
      expect(result).toBe(true);
    });

    test('should return false if no mouths are locked', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          // anatomy:body
          body: {
            root: 'torso_1',
            parts: { mouth: 'mouth_1' },
          },
        })
        .mockReturnValueOnce({ subType: 'mouth' })
        .mockReturnValueOnce({ locked: false });

      const result = isMouthLocked(mockEntityManager, 'entity_1');
      expect(result).toBe(false);
    });

    test('should return true if legacy entity mouth is locked', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce(null) // No anatomy:body
        .mockReturnValueOnce({ locked: true }); // Legacy engagement

      const result = isMouthLocked(mockEntityManager, 'entity_1');
      expect(result).toBe(true);
    });

    test('should return false if legacy entity mouth is not locked', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce(null) // No anatomy:body
        .mockReturnValueOnce({ locked: false }); // Legacy engagement

      const result = isMouthLocked(mockEntityManager, 'entity_1');
      expect(result).toBe(false);
    });

    test('should return false for invalid inputs', () => {
      expect(isMouthLocked(null, 'entity_1')).toBe(false);
      expect(isMouthLocked(mockEntityManager, null)).toBe(false);
      expect(isMouthLocked(null, null)).toBe(false);
    });

    test('should return false if no engagement component exists', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce(null) // No anatomy:body
        .mockReturnValueOnce(null); // No engagement

      const result = isMouthLocked(mockEntityManager, 'entity_1');
      expect(result).toBe(false);
    });

    test('should ignore anatomy parts that are not mouths', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          body: {
            root: 'torso_1',
            parts: { head: 'head_1' },
          },
        })
        .mockReturnValueOnce({ subType: 'head' });

      const result = isMouthLocked(mockEntityManager, 'entity_1');
      expect(result).toBe(false);
    });

    test('should return true if any mouth in multi-mouth entity is locked', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          // anatomy:body
          body: {
            root: 'torso_1',
            parts: {
              mouth: 'mouth_1',
              secondary_mouth: 'mouth_2',
            },
          },
        })
        .mockReturnValueOnce({ subType: 'mouth' }) // mouth_1 part
        .mockReturnValueOnce({ locked: false }) // mouth_1 not locked
        .mockReturnValueOnce({ subType: 'mouth' }) // mouth_2 part
        .mockReturnValueOnce({ locked: true }); // mouth_2 is locked

      const result = isMouthLocked(mockEntityManager, 'entity_1');
      expect(result).toBe(true);
    });
  });

  describe('getMouthParts', () => {
    test('should return all mouth parts with details', () => {
      const partComponent = { subType: 'mouth', name: 'mouth' };
      const engagement = { locked: false, forcedOverride: false };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          // anatomy:body
          body: {
            root: 'torso_1',
            parts: { mouth: 'mouth_1' },
          },
        })
        .mockReturnValueOnce(partComponent)
        .mockReturnValueOnce(engagement);

      const result = getMouthParts(mockEntityManager, 'entity_1');

      expect(result).toEqual([
        {
          partId: 'mouth_1',
          partComponent,
          engagement,
        },
      ]);
    });

    test('should return empty array for entity without mouths', () => {
      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          // anatomy:body
          body: {
            root: 'torso_1',
            parts: { head: 'head_1' },
          },
        })
        .mockReturnValueOnce({ subType: 'head' }); // Not a mouth

      const result = getMouthParts(mockEntityManager, 'entity_1');
      expect(result).toEqual([]);
    });

    test('should return empty array for legacy entity', () => {
      mockEntityManager.getComponentData.mockReturnValueOnce(null); // No anatomy:body

      const result = getMouthParts(mockEntityManager, 'entity_1');
      expect(result).toEqual([]);
    });

    test('should return empty array for invalid inputs', () => {
      expect(getMouthParts(null, 'entity_1')).toEqual([]);
      expect(getMouthParts(mockEntityManager, null)).toEqual([]);
    });

    test('should handle mouth parts without engagement component', () => {
      const partComponent = { subType: 'mouth', name: 'mouth' };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          // anatomy:body
          body: {
            root: 'torso_1',
            parts: { mouth: 'mouth_1' },
          },
        })
        .mockReturnValueOnce(partComponent)
        .mockReturnValueOnce(null); // No engagement

      const result = getMouthParts(mockEntityManager, 'entity_1');

      expect(result).toEqual([
        {
          partId: 'mouth_1',
          partComponent,
          engagement: null,
        },
      ]);
    });

    test('should return multiple mouth parts', () => {
      const partComponent1 = { subType: 'mouth', name: 'primary_mouth' };
      const partComponent2 = { subType: 'mouth', name: 'secondary_mouth' };
      const engagement1 = { locked: true, forcedOverride: false };
      const engagement2 = { locked: false, forcedOverride: false };

      mockEntityManager.getComponentData
        .mockReturnValueOnce({
          // anatomy:body
          body: {
            root: 'torso_1',
            parts: {
              mouth: 'mouth_1',
              secondary_mouth: 'mouth_2',
            },
          },
        })
        .mockReturnValueOnce(partComponent1)
        .mockReturnValueOnce(engagement1)
        .mockReturnValueOnce(partComponent2)
        .mockReturnValueOnce(engagement2);

      const result = getMouthParts(mockEntityManager, 'entity_1');

      expect(result).toHaveLength(2);
      expect(result[0].partId).toBe('mouth_1');
      expect(result[1].partId).toBe('mouth_2');
    });
  });
});
