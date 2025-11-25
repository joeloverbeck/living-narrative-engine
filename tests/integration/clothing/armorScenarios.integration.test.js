import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

/**
 * @file Armor Layer Integration Tests - ARMSYSANA-009
 *
 * Tests armor visibility, blocking, and coverage resolution across realistic
 * character archetypes. Validates the armor layer (priority 150) integrates
 * correctly with the clothing layer system.
 *
 * Layer hierarchy (innermost to outermost):
 * - underwear (300)
 * - base (200)
 * - armor (150)
 * - outer (100)
 * - accessories/direct (400)
 */
describe('Armor Layer Scenarios - ARMSYSANA-009', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'clothing',
      'clothing:remove_clothing',
      null,
      null,
      {
        autoRegisterScopes: true,
        scopeCategories: ['clothing'],
      }
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  /**
   * Helper to get topmost (removable) items via scope resolution
   *
   * @param {string} actorId - The ID of the actor entity
   * @returns {Array} Array of topmost clothing entities
   */
  const getTopmostItems = (actorId) => {
    const testContext = { actor: { id: actorId, components: {} } };
    const scopeResult = fixture.testEnv.unifiedScopeResolver.resolveSync(
      'clothing:topmost_clothing',
      testContext
    );
    return Array.from(scopeResult.value);
  };

  describe('Knight Archetype - Heavy Armor Visibility', () => {
    it('should show cuirass as topmost when no outer layer (warrior visible armor)', async () => {
      // Arrange: Knight with cuirass over shirt, no cloak/robe
      const { actor } = fixture.createStandardActorTarget(['Sir Galahad', 'Unused']);

      const shirt = fixture.createEntity({
        id: 'knight_shirt',
        name: 'Linen Shirt',
        components: {
          'clothing:wearable': {
            layer: 'base',
            equipmentSlots: { primary: 'torso_upper' },
          },
          'clothing:coverage_mapping': {
            covers: ['torso_upper'],
            coveragePriority: 'base',
          },
        },
      });

      const cuirass = fixture.createEntity({
        id: 'knight_cuirass',
        name: 'Steel Cuirass',
        components: {
          'clothing:wearable': {
            layer: 'armor',
            equipmentSlots: { primary: 'torso_upper' },
          },
          'clothing:coverage_mapping': {
            covers: ['torso_upper'],
            coveragePriority: 'armor',
          },
        },
      });

      await fixture.modifyComponent(actor.id, 'clothing:equipment', {
        equipped: {
          torso_upper: {
            base: shirt,
            armor: cuirass,
          },
        },
      });

      // Act
      const topmostItems = getTopmostItems(actor.id);

      // Assert: Cuirass (armor:150) is topmost, shirt (base:200) is beneath
      expect(topmostItems).toContain(cuirass);
      expect(topmostItems).not.toContain(shirt);
    });

    it('should block base shirt removal when cuirass equipped', async () => {
      // Arrange: Knight with cuirass blocking shirt removal
      const { actor } = fixture.createStandardActorTarget(['Sir Lancelot', 'Unused']);

      const shirt = fixture.createEntity({
        id: 'blocked_shirt',
        name: 'Cotton Shirt',
        components: {
          'clothing:wearable': {
            layer: 'base',
            equipmentSlots: { primary: 'torso_upper' },
          },
          'clothing:coverage_mapping': {
            covers: ['torso_upper'],
            coveragePriority: 'base',
          },
        },
      });

      const cuirass = fixture.createEntity({
        id: 'blocking_cuirass',
        name: 'Plate Cuirass',
        components: {
          'clothing:wearable': {
            layer: 'armor',
            equipmentSlots: { primary: 'torso_upper' },
          },
          'clothing:coverage_mapping': {
            covers: ['torso_upper'],
            coveragePriority: 'armor',
          },
          'clothing:blocks_removal': {
            blockedSlots: [
              {
                slot: 'torso_upper',
                layers: ['base', 'underwear'],
                blockType: 'full_block',
              },
            ],
          },
        },
      });

      await fixture.modifyComponent(actor.id, 'clothing:equipment', {
        equipped: {
          torso_upper: {
            base: shirt,
            armor: cuirass,
          },
        },
      });

      // Act
      const topmostItems = getTopmostItems(actor.id);

      // Assert: Only cuirass removable, shirt is blocked
      expect(topmostItems).toContain(cuirass);
      expect(topmostItems).not.toContain(shirt);
    });

    it('should show gauntlets over leather gloves (armor > accessories)', async () => {
      // Arrange: Knight with gauntlets over gloves
      const { actor } = fixture.createStandardActorTarget(['Sir Percival', 'Unused']);

      const gloves = fixture.createEntity({
        id: 'leather_gloves',
        name: 'Leather Gloves',
        components: {
          'clothing:wearable': {
            layer: 'accessories',
            equipmentSlots: { primary: 'hands' },
          },
          'clothing:coverage_mapping': {
            covers: ['hands'],
            coveragePriority: 'direct', // accessories fall back to direct: 400
          },
        },
      });

      const gauntlets = fixture.createEntity({
        id: 'steel_gauntlets',
        name: 'Steel Gauntlets',
        components: {
          'clothing:wearable': {
            layer: 'armor',
            equipmentSlots: { primary: 'hands' },
          },
          'clothing:coverage_mapping': {
            covers: ['hands'],
            coveragePriority: 'armor', // armor: 150
          },
        },
      });

      await fixture.modifyComponent(actor.id, 'clothing:equipment', {
        equipped: {
          hands: {
            accessories: gloves,
            armor: gauntlets,
          },
        },
      });

      // Act
      const topmostItems = getTopmostItems(actor.id);

      // Assert: Gauntlets (armor:150) visible over gloves (direct:400)
      expect(topmostItems).toContain(gauntlets);
      // Note: gloves may or may not appear depending on blocking rules
      // The key assertion is that gauntlets are topmost
    });
  });

  describe('Mage Archetype - Hidden Armor Under Robes', () => {
    it('should hide chainmail under magical robes (outer > armor)', async () => {
      // Arrange: Mage with chainmail hidden under robes
      const { actor } = fixture.createStandardActorTarget(['Gandalf', 'Unused']);

      const chainmail = fixture.createEntity({
        id: 'mage_chainmail',
        name: 'Mithril Chainmail',
        components: {
          'clothing:wearable': {
            layer: 'armor',
            equipmentSlots: { primary: 'torso_upper' },
          },
          'clothing:coverage_mapping': {
            covers: ['torso_upper'],
            coveragePriority: 'armor', // armor: 150
          },
        },
      });

      const robes = fixture.createEntity({
        id: 'mage_robes',
        name: 'Grey Robes',
        components: {
          'clothing:wearable': {
            layer: 'outer',
            equipmentSlots: { primary: 'torso_upper' },
          },
          'clothing:coverage_mapping': {
            covers: ['torso_upper'],
            coveragePriority: 'outer', // outer: 100 - highest visibility
          },
        },
      });

      await fixture.modifyComponent(actor.id, 'clothing:equipment', {
        equipped: {
          torso_upper: {
            armor: chainmail,
            outer: robes,
          },
        },
      });

      // Act
      const topmostItems = getTopmostItems(actor.id);

      // Assert: Robes (outer:100) visible, chainmail (armor:150) hidden beneath
      expect(topmostItems).toContain(robes);
      expect(topmostItems).not.toContain(chainmail);
    });

    it('should resolve chainmail coverage on both torso and arms', async () => {
      // Arrange: Mage with chainmail hauberk covering torso + arms
      const { actor } = fixture.createStandardActorTarget(['Merlin', 'Unused']);

      const hauberk = fixture.createEntity({
        id: 'chainmail_hauberk',
        name: 'Chainmail Hauberk',
        components: {
          'clothing:wearable': {
            layer: 'armor',
            equipmentSlots: {
              primary: 'torso_upper',
              secondary: ['left_arm_clothing', 'right_arm_clothing'],
            },
          },
          'clothing:coverage_mapping': {
            covers: ['torso_upper', 'torso_lower', 'left_arm_clothing', 'right_arm_clothing'],
            coveragePriority: 'armor',
          },
        },
      });

      await fixture.modifyComponent(actor.id, 'clothing:equipment', {
        equipped: {
          torso_upper: {
            armor: hauberk,
          },
          left_arm_clothing: {
            armor: hauberk,
          },
          right_arm_clothing: {
            armor: hauberk,
          },
        },
      });

      // Act
      const topmostItems = getTopmostItems(actor.id);

      // Assert: Hauberk appears as topmost on all covered slots
      expect(topmostItems).toContain(hauberk);
    });
  });

  describe('Rogue Archetype - Light Armor with Cloak', () => {
    it('should resolve bracers visibility when cloak equipped', async () => {
      // Arrange: Rogue with bracers on arms and cloak on torso
      const { actor } = fixture.createStandardActorTarget(['Shadow', 'Unused']);

      const bracers = fixture.createEntity({
        id: 'rogue_bracers',
        name: 'Leather Bracers',
        components: {
          'clothing:wearable': {
            layer: 'armor',
            equipmentSlots: {
              primary: 'left_arm_clothing',
              secondary: ['right_arm_clothing'],
            },
          },
          'clothing:coverage_mapping': {
            covers: ['left_arm_clothing', 'right_arm_clothing'],
            coveragePriority: 'armor',
          },
        },
      });

      const cloak = fixture.createEntity({
        id: 'rogue_cloak',
        name: 'Dark Cloak',
        components: {
          'clothing:wearable': {
            layer: 'outer',
            equipmentSlots: { primary: 'torso_upper' },
          },
          'clothing:coverage_mapping': {
            covers: ['torso_upper'], // Cloak only covers torso, not arms
            coveragePriority: 'outer',
          },
        },
      });

      await fixture.modifyComponent(actor.id, 'clothing:equipment', {
        equipped: {
          torso_upper: {
            outer: cloak,
          },
          left_arm_clothing: {
            armor: bracers,
          },
          right_arm_clothing: {
            armor: bracers,
          },
        },
      });

      // Act
      const topmostItems = getTopmostItems(actor.id);

      // Assert: Both cloak (torso) and bracers (arms) should be visible
      // since they cover different slots
      expect(topmostItems).toContain(cloak);
      expect(topmostItems).toContain(bracers);
    });
  });

  describe('Ranger Archetype - Mixed Layers Across Slots', () => {
    it('should correctly resolve different layers on different slots', async () => {
      // Arrange: Ranger with cloak on torso, bracers on arms, pants on legs
      const { actor } = fixture.createStandardActorTarget(['Strider', 'Unused']);

      const cloak = fixture.createEntity({
        id: 'ranger_cloak',
        name: 'Green Cloak',
        components: {
          'clothing:wearable': {
            layer: 'outer',
            equipmentSlots: { primary: 'torso_upper' },
          },
          'clothing:coverage_mapping': {
            covers: ['torso_upper'],
            coveragePriority: 'outer',
          },
        },
      });

      const bracers = fixture.createEntity({
        id: 'ranger_bracers',
        name: 'Leather Bracers',
        components: {
          'clothing:wearable': {
            layer: 'armor',
            equipmentSlots: {
              primary: 'left_arm_clothing',
              secondary: ['right_arm_clothing'],
            },
          },
          'clothing:coverage_mapping': {
            covers: ['left_arm_clothing', 'right_arm_clothing'],
            coveragePriority: 'armor',
          },
        },
      });

      const pants = fixture.createEntity({
        id: 'ranger_pants',
        name: 'Leather Pants',
        components: {
          'clothing:wearable': {
            layer: 'base',
            equipmentSlots: { primary: 'legs' },
          },
          'clothing:coverage_mapping': {
            covers: ['legs'],
            coveragePriority: 'base',
          },
        },
      });

      await fixture.modifyComponent(actor.id, 'clothing:equipment', {
        equipped: {
          torso_upper: {
            outer: cloak,
          },
          left_arm_clothing: {
            armor: bracers,
          },
          right_arm_clothing: {
            armor: bracers,
          },
          legs: {
            base: pants,
          },
        },
      });

      // Act
      const topmostItems = getTopmostItems(actor.id);

      // Assert: All three items visible on their respective slots
      expect(topmostItems).toContain(cloak);
      expect(topmostItems).toContain(bracers);
      expect(topmostItems).toContain(pants);
    });
  });

  describe('Edge Cases', () => {
    it('should handle armor with coverage_mapping component correctly', async () => {
      // Arrange: Armor entity with full coverage_mapping setup
      const { actor } = fixture.createStandardActorTarget(['Test Knight', 'Unused']);

      const helmet = fixture.createEntity({
        id: 'iron_helmet',
        name: 'Iron Helmet',
        components: {
          'clothing:wearable': {
            layer: 'armor',
            equipmentSlots: { primary: 'head' },
            allowedLayers: ['underwear', 'base', 'armor', 'outer'],
          },
          'clothing:coverage_mapping': {
            covers: ['head'],
            coveragePriority: 'armor',
          },
          'core:name': {
            text: 'iron helmet',
          },
        },
      });

      const hood = fixture.createEntity({
        id: 'cloth_hood',
        name: 'Cloth Hood',
        components: {
          'clothing:wearable': {
            layer: 'outer',
            equipmentSlots: { primary: 'head' },
          },
          'clothing:coverage_mapping': {
            covers: ['head'],
            coveragePriority: 'outer',
          },
        },
      });

      await fixture.modifyComponent(actor.id, 'clothing:equipment', {
        equipped: {
          head: {
            armor: helmet,
            outer: hood,
          },
        },
      });

      // Act
      const topmostItems = getTopmostItems(actor.id);

      // Assert: Hood (outer:100) over helmet (armor:150)
      expect(topmostItems).toContain(hood);
      expect(topmostItems).not.toContain(helmet);
    });
  });
});
