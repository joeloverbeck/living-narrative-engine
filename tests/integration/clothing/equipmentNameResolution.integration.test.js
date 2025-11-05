import { beforeEach, describe, expect, it } from '@jest/globals';
import { EquipmentDescriptionIntegrationTestBed } from '../../common/clothing/equipmentDescriptionIntegrationTestBed.js';

describe('Equipment Name Resolution Integration Tests', () => {
  let testBed;

  beforeEach(() => {
    testBed = new EquipmentDescriptionIntegrationTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('core:name component resolution', () => {
    it('should resolve equipment names using core:name component', async () => {
      // Arrange
      const characterId = 'test_character';
      const shirtId = 'test_shirt';
      const bootsId = 'test_boots';

      // Create character with equipment
      testBed.createCharacter(characterId, {
        'clothing:equipment': {
          equipped: {
            torso_clothing: {
              base: shirtId,
            },
            feet_clothing: {
              base: bootsId,
            },
          },
        },
      });

      // Create equipment entities with core:name components
      testBed.createEquipmentEntity(shirtId, {
        'core:name': { text: 'dress shirt' },
        'core:material': { material: 'cotton' },
        'descriptors:color_basic': { color: 'blue' },
      });

      testBed.createEquipmentEntity(bootsId, {
        'core:name': { text: 'boots' },
        'core:material': { material: 'leather' },
        'descriptors:color_basic': { color: 'brown' },
      });

      // Act
      const result = await testBed.generateEquipmentDescription(characterId);

      // Assert
      expect(result).toBe(
        'Wearing: cotton, blue dress shirt | leather, brown boots.'
      );
    });

    it('should fallback to core:description when core:name is missing', async () => {
      // Arrange
      const characterId = 'test_character';
      const shirtId = 'test_shirt';

      testBed.createCharacter(characterId, {
        'clothing:equipment': {
          equipped: {
            torso_clothing: {
              base: shirtId,
            },
          },
        },
      });

      // Create equipment entity with only core:description
      testBed.createEquipmentEntity(shirtId, {
        'core:description': { text: 'basic shirt' },
        'core:material': { material: 'cotton' },
      });

      // Act
      const result = await testBed.generateEquipmentDescription(characterId);

      // Assert
      expect(result).toBe('Wearing: cotton basic shirt.');
    });

    it('should prioritize core:name over core:description', async () => {
      // Arrange
      const characterId = 'test_character';
      const shirtId = 'test_shirt';

      testBed.createCharacter(characterId, {
        'clothing:equipment': {
          equipped: {
            torso_clothing: {
              base: shirtId,
            },
          },
        },
      });

      // Create equipment entity with both components
      testBed.createEquipmentEntity(shirtId, {
        'core:name': { text: 'silk blouse' },
        'core:description': { text: 'generic shirt' },
        'core:material': { material: 'silk' },
      });

      // Act
      const result = await testBed.generateEquipmentDescription(characterId);

      // Assert
      expect(result).toBe('Wearing: silk silk blouse.');
    });

    it('should handle missing name components gracefully', async () => {
      // Arrange
      const characterId = 'test_character';
      const shirtId = 'test_shirt';

      testBed.createCharacter(characterId, {
        'clothing:equipment': {
          equipped: {
            torso_clothing: {
              base: shirtId,
            },
          },
        },
      });

      // Create equipment entity with no name components
      testBed.createEquipmentEntity(shirtId, {
        'core:material': { material: 'cotton' },
      });

      // Act
      const result = await testBed.generateEquipmentDescription(characterId);

      // Assert
      expect(result).toBe('');
      expect(testBed.getWarnings()).toContain(
        'No name found for equipment entity: test_shirt'
      );
    });
  });

  describe('complex equipment scenarios', () => {
    it('should handle multiple items with mixed name component types', async () => {
      // Arrange
      const characterId = 'test_character';
      const shirtId = 'test_shirt';
      const jacketId = 'test_jacket';
      const bootsId = 'test_boots';

      testBed.createCharacter(characterId, {
        'clothing:equipment': {
          equipped: {
            torso_clothing: {
              base: shirtId,
              outer: jacketId,
            },
            feet_clothing: {
              base: bootsId,
            },
          },
        },
      });

      // Mix of core:name and core:description components
      testBed.createEquipmentEntity(shirtId, {
        'core:name': { text: 'dress shirt' },
        'descriptors:color_basic': { color: 'white' },
      });

      testBed.createEquipmentEntity(jacketId, {
        'core:description': { text: 'blazer' },
        'descriptors:color_basic': { color: 'navy' },
      });

      testBed.createEquipmentEntity(bootsId, {
        'core:name': { text: 'boots' },
        'core:material': { material: 'leather' },
      });

      // Act
      const result = await testBed.generateEquipmentDescription(characterId);

      // Assert
      expect(result).toContain('dress shirt');
      expect(result).toContain('blazer');
      expect(result).toContain('boots');
    });

    it('should handle layered equipment with proper name resolution', async () => {
      // Arrange
      const characterId = 'test_character';
      const underwearId = 'test_underwear';
      const shirtId = 'test_shirt';
      const jacketId = 'test_jacket';

      testBed.createCharacter(characterId, {
        'clothing:equipment': {
          equipped: {
            torso_clothing: {
              underwear: underwearId,
              base: shirtId,
              outer: jacketId,
            },
          },
        },
      });

      testBed.createEquipmentEntity(underwearId, {
        'core:name': { text: 'undershirt' },
      });

      testBed.createEquipmentEntity(shirtId, {
        'core:name': { text: 'polo shirt' },
      });

      testBed.createEquipmentEntity(jacketId, {
        'core:name': { text: 'windbreaker' },
      });

      // Act
      const result = await testBed.generateEquipmentDescription(characterId);

      // Assert
      expect(result).toContain('undershirt');
      expect(result).toContain('polo shirt');
      expect(result).toContain('windbreaker');
    });
  });

  describe('error recovery scenarios', () => {
    it('should continue processing other items when one has no name', async () => {
      // Arrange
      const characterId = 'test_character';
      const shirtId = 'test_shirt';
      const bootsId = 'test_boots';

      testBed.createCharacter(characterId, {
        'clothing:equipment': {
          equipped: {
            torso_clothing: {
              base: shirtId,
            },
            feet_clothing: {
              base: bootsId,
            },
          },
        },
      });

      // One item with name, one without
      testBed.createEquipmentEntity(shirtId, {
        'core:material': { material: 'cotton' },
        // No name components
      });

      testBed.createEquipmentEntity(bootsId, {
        'core:name': { text: 'boots' },
        'core:material': { material: 'leather' },
      });

      // Act
      const result = await testBed.generateEquipmentDescription(characterId);

      // Assert
      expect(result).toBe('Wearing: leather boots.');
      expect(testBed.getWarnings()).toContain(
        'No name found for equipment entity: test_shirt'
      );
    });

    it('should handle malformed component data gracefully', async () => {
      // Arrange
      const characterId = 'test_character';
      const shirtId = 'test_shirt';

      testBed.createCharacter(characterId, {
        'clothing:equipment': {
          equipped: {
            torso_clothing: {
              base: shirtId,
            },
          },
        },
      });

      // Create equipment entity with malformed name component
      testBed.createEquipmentEntity(shirtId, {
        'core:name': {
          /* missing text property */
        },
        'core:description': { text: 'backup name' },
        'core:material': { material: 'cotton' },
      });

      // Act
      const result = await testBed.generateEquipmentDescription(characterId);

      // Assert
      expect(result).toBe('Wearing: cotton backup name.');
    });
  });
});
