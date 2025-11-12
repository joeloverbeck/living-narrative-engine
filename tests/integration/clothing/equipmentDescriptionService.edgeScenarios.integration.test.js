import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ClothingIntegrationTestBed } from '../../common/clothing/clothingIntegrationTestBed.js';

/**
 * @file Integration tests exercising equipment description edge cases and error handling.
 */

describe('EquipmentDescriptionService integration edge scenarios', () => {
  let testBed;
  let equipmentDescriptionService;
  let clothingManagementService;
  let descriptorFormatter;

  beforeEach(async () => {
    testBed = new ClothingIntegrationTestBed();
    await testBed.setup();
    equipmentDescriptionService = testBed.getService(
      'equipmentDescriptionService'
    );
    clothingManagementService = testBed.getService('clothingManagementService');
    descriptorFormatter = testBed.getService('descriptorFormatter');
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('clothing retrieval failures', () => {
    it('returns an empty string when clothing lookups fail gracefully', async () => {
      const entityId = await testBed.createTestEntity({
        name: 'Lookup Failure',
        components: {
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: { coveredSockets: ['breast_left', 'breast_right'] },
              torso_lower: { coveredSockets: ['genitals'] },
            },
          },
        },
      });

      const baseGetComponentDataImplementation =
        testBed.entityManager.getComponentData.getMockImplementation();

      testBed.entityManager.getComponentData.mockImplementation(
        (requestedEntityId, componentId) => {
          if (
            requestedEntityId === entityId &&
            componentId === 'clothing:equipment'
          ) {
            throw new Error('equipment fetch failed');
          }

          return baseGetComponentDataImplementation(
            requestedEntityId,
            componentId
          );
        }
      );

      const result =
        await equipmentDescriptionService.generateEquipmentDescription(
          entityId
        );

      expect(result).toBe(
        'Wearing: Torso is fully exposed. Genitals are fully exposed.'
      );
      expect(testBed.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get equipped items for entity')
      );

      testBed.entityManager.getComponentData.mockImplementation(
        baseGetComponentDataImplementation
      );
    });

    it('surfaces an empty string when clothing retrieval throws unexpectedly', async () => {
      const entityId = await testBed.createTestEntity({
        name: 'Lookup Crash',
        components: {
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: { coveredSockets: ['breast_left'] },
            },
          },
        },
      });

      const originalGetEquippedItems =
        clothingManagementService.getEquippedItems.bind(
          clothingManagementService
        );

      clothingManagementService.getEquippedItems = async () => {
        throw new Error('unexpected failure');
      };

      const result =
        await equipmentDescriptionService.generateEquipmentDescription(
          entityId
        );

      expect(result).toBe('Wearing: Torso is fully exposed.');
      expect(testBed.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get equipped items for entity'),
        expect.any(Error)
      );

      clothingManagementService.getEquippedItems = originalGetEquippedItems;
    });
  });

  describe('item formatting edge cases', () => {
    it('warns and skips equipment entities without component data', async () => {
      const entityId = await testBed.createTestEntity({
        name: 'Missing Components Hero',
        components: {},
      });

      const itemId = await testBed.createClothingItem({
        name: 'Invisible Cloak',
        components: {
          'clothing:wearable': { slotId: 'torso_clothing', layer: 'outer' },
        },
      });

      await testBed.equipClothingItem(entityId, itemId);

      const storedItem = testBed.entityManager.entities.get(itemId);
      storedItem.components = null;
      delete storedItem.getComponentData;

      const description =
        await equipmentDescriptionService.generateEquipmentDescription(
          entityId
        );

      expect(description).toBe('');
      expect(testBed.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No components found for equipment entity')
      );
    });

    it('logs a formatting error when descriptor formatting fails', async () => {
      const entityId = await testBed.createTestEntity({
        name: 'Descriptor Failure Hero',
        components: {},
      });

      const itemId = await testBed.createClothingItem({
        name: 'Faulty Jacket',
        components: {
          'core:name': { text: 'faulty jacket' },
          'core:material': { material: 'cotton' },
          'descriptors:color_basic': { color: 'green' },
          'clothing:wearable': { slotId: 'torso_clothing', layer: 'base' },
        },
      });

      await testBed.equipClothingItem(entityId, itemId);

      const originalFormatDescriptors = descriptorFormatter.formatDescriptors;
      descriptorFormatter.formatDescriptors = () => {
        throw new Error('formatter blew up');
      };

      const description =
        await equipmentDescriptionService.generateEquipmentDescription(
          entityId
        );

      expect(description).toBe('');
      expect(testBed.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to format item description for entity'),
        expect.any(Error)
      );

      descriptorFormatter.formatDescriptors = originalFormatDescriptors;
    });

    it('returns an empty description when entity retrieval throws', async () => {
      const entityId = await testBed.createTestEntity({
        name: 'Entity Lookup Failure',
        components: {},
      });

      const itemId = await testBed.createClothingItem({
        name: 'Fragile Boots',
        components: {
          'core:name': { text: 'fragile boots' },
          'core:material': { material: 'leather' },
          'clothing:wearable': { slotId: 'feet_clothing', layer: 'base' },
        },
      });

      await testBed.equipClothingItem(entityId, itemId);

      const baseGetEntityInstance =
        testBed.entityManager.getEntityInstance.getMockImplementation();

      testBed.entityManager.getEntityInstance.mockImplementation((id) => {
        if (id === itemId) {
          throw new Error('entity lookup failed');
        }

        return baseGetEntityInstance(id);
      });

      const description =
        await equipmentDescriptionService.generateEquipmentDescription(
          entityId
        );

      expect(description).toBe('');
      expect(testBed.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to generate equipment description for entity'
        ),
        expect.any(Error)
      );

      testBed.entityManager.getEntityInstance.mockImplementation(
        baseGetEntityInstance
      );
    });
  });

  describe('exposure note generation', () => {
    it('reports torso and lower exposure with breast anatomy present', async () => {
      const torsoPartId = await testBed.createClothingItem({
        name: 'torso-anatomy-proxy',
        components: {
          'anatomy:part': { subType: 'torso' },
        },
      });

      const leftBreastPartId = await testBed.createClothingItem({
        name: 'breast-anatomy-proxy',
        components: {
          'anatomy:part': { subType: 'breast' },
        },
      });

      const entityId = await testBed.createTestEntity({
        name: 'Exposed Adventurer',
        components: {
          'anatomy:body': {
            body: {
              parts: {
                torso: torsoPartId,
                left_breast: leftBreastPartId,
                invalid: null,
              },
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['upper_torso', 'breast_left', 'breast_right'],
              },
              torso_lower: { coveredSockets: ['genitals'] },
            },
          },
        },
      });

      testBed.entityManager.setComponentData(entityId, 'clothing:equipment', {
        equipped: {
          torso_upper: { base: null },
          torso_lower: {},
        },
      });

      const description =
        await equipmentDescriptionService.generateEquipmentDescription(
          entityId
        );

      expect(description).toBe(
        'Wearing: Torso is fully exposed. The breasts are exposed. Genitals are fully exposed.'
      );
    });

    it('merges exposure notes with clothing description when secondary coverage exists', async () => {
      const torsoPartId = await testBed.createClothingItem({
        name: 'torso-anatomy-proxy',
        components: {
          'anatomy:part': { subType: 'torso' },
        },
      });

      const entityId = await testBed.createTestEntity({
        name: 'Partially Covered Hero',
        components: {
          'anatomy:body': {
            body: {
              parts: [torsoPartId],
            },
          },
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: {
                coveredSockets: ['upper_torso', 'breast_left'],
              },
              torso_lower: { coveredSockets: ['genitals'] },
            },
          },
        },
      });

      const cloakId = await testBed.createClothingItem({
        name: 'Coverage Cloak',
        components: {
          'core:name': { text: 'coverage cloak' },
          'descriptors:color_extended': { sparkle: 'iridescent sheen' },
          'clothing:wearable': { slotId: 'torso_clothing', layer: 'outer' },
          'clothing:coverage_mapping': { covers: ['torso_upper'] },
        },
      });

      await testBed.equipClothingItem(entityId, cloakId);

      const description =
        await equipmentDescriptionService.generateEquipmentDescription(
          entityId
        );

      expect(description).toBe(
        'Wearing: iridescent sheen coverage cloak. Genitals are fully exposed.'
      );
    });

    it('handles coverage mapping lookup errors while still reporting exposure', async () => {
      const entityId = await testBed.createTestEntity({
        name: 'Metadata Error Hero',
        components: {
          'clothing:slot_metadata': {
            slotMappings: {
              torso_upper: { coveredSockets: ['upper_torso'] },
              torso_lower: { coveredSockets: ['genitals'] },
            },
          },
        },
      });

      const coverageItemId = await testBed.createClothingItem({
        name: 'Coverage Accessory',
        components: {
          'clothing:wearable': { slotId: 'belt_clothing', layer: 'base' },
          'clothing:coverage_mapping': { covers: ['torso_upper'] },
        },
      });

      testBed.entityManager.setComponentData(entityId, 'clothing:equipment', {
        equipped: {
          belt_clothing: { base: coverageItemId },
          torso_upper: {},
          torso_lower: {},
        },
      });

      const baseGetComponentDataImplementation =
        testBed.entityManager.getComponentData.getMockImplementation();

      testBed.entityManager.getComponentData.mockImplementation(
        (requestedEntityId, componentId) => {
          if (
            requestedEntityId === coverageItemId &&
            componentId === 'clothing:coverage_mapping'
          ) {
            throw new Error('coverage mapping unavailable');
          }

          return baseGetComponentDataImplementation(
            requestedEntityId,
            componentId
          );
        }
      );

      const description =
        await equipmentDescriptionService.generateEquipmentDescription(
          entityId
        );

      expect(description).toBe(
        'Wearing: Torso is fully exposed. Genitals are fully exposed.'
      );
      expect(testBed.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Could not check coverage_mapping for item'),
        expect.any(Error)
      );

      testBed.entityManager.getComponentData.mockImplementation(
        baseGetComponentDataImplementation
      );
    });
  });
});
