/**
 * @file Integration tests for wielding activity descriptions
 * Tests the integration between positioning:wielding component and activity description system
 * with focus on multi-item array formatting.
 * @see specs/wielding-component.md
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../../common/anatomy/anatomyIntegrationTestBed.js';
import ActivityCacheManager from '../../../../src/anatomy/cache/activityCacheManager.js';
import ActivityMetadataCollectionSystem from '../../../../src/anatomy/services/activityMetadataCollectionSystem.js';
import ActivityNLGSystem from '../../../../src/anatomy/services/activityNLGSystem.js';
import '../../../common/mods/domainMatchers.js';

/**
 * Registers components needed for wielding activity tests.
 *
 * @param testBed
 */
function registerWieldingComponents(testBed) {
  // Register positioning:wielding component definition using loadComponents pattern
  testBed.loadComponents({
    'positioning:wielding': {
      id: 'positioning:wielding',
      dataSchema: {
        type: 'object',
        properties: {
          wielded_item_ids: {
            type: 'array',
            items: { type: 'string' },
          },
          activityMetadata: {
            type: 'object',
            properties: {
              shouldDescribeInActivity: { type: 'boolean' },
              template: { type: 'string' },
              targetRole: { type: 'string' },
              targetRoleIsArray: { type: 'boolean' },
              priority: { type: 'integer' },
            },
          },
        },
        required: ['wielded_item_ids'],
      },
    },
    'items:item': {
      id: 'items:item',
      dataSchema: { type: 'object', properties: {} },
    },
    'weapons:weapon': {
      id: 'weapons:weapon',
      dataSchema: { type: 'object', properties: {} },
    },
  });

  // Register test:weapon entity definition for weapons
  testBed.loadEntityDefinitions({
    'test:weapon': {
      id: 'test:weapon',
      description: 'Test weapon entity',
      components: {},
    },
  });
}

/**
 * Creates an actor entity for testing.
 *
 * @param testBed
 * @param root0
 * @param root0.id
 * @param root0.name
 * @param root0.gender
 */
async function createActor(testBed, { id, name, gender = 'male' }) {
  const entity = await testBed.entityManager.createEntityInstance('core:actor', {
    instanceId: id,
  });
  if (name) {
    testBed.entityManager.addComponent(entity.id, 'core:name', { text: name });
  }
  if (gender) {
    testBed.entityManager.addComponent(entity.id, 'core:gender', { value: gender });
  }
  return entity;
}

/**
 * Creates a weapon entity for testing.
 *
 * @param testBed
 * @param root0
 * @param root0.id
 * @param root0.name
 */
async function createWeapon(testBed, { id, name }) {
  const entity = await testBed.entityManager.createEntityInstance('test:weapon', {
    instanceId: id,
  });
  testBed.entityManager.addComponent(entity.id, 'core:name', { text: name });
  testBed.entityManager.addComponent(entity.id, 'items:item', {});
  testBed.entityManager.addComponent(entity.id, 'weapons:weapon', {});
  return entity;
}

/**
 * Adds wielding component with activity metadata to an entity.
 *
 * @param entityManager
 * @param entityId
 * @param weaponIds
 * @param customMetadata
 */
function addWieldingComponent(entityManager, entityId, weaponIds, customMetadata = {}) {
  const defaultMetadata = {
    shouldDescribeInActivity: true,
    template: '{actor} is wielding {targets} threateningly',
    targetRole: 'wielded_item_ids',
    targetRoleIsArray: true,
    priority: 70,
  };

  entityManager.addComponent(entityId, 'positioning:wielding', {
    wielded_item_ids: weaponIds,
    activityMetadata: { ...defaultMetadata, ...customMetadata },
  });
}

describe('Wielding Activity Description Integration', () => {
  let testBed;
  let entityManager;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();
    testBed.loadCoreTestData();
    registerWieldingComponents(testBed);
    entityManager = testBed.entityManager;
  });

  afterEach(() => testBed.cleanup());

  describe('Single Weapon', () => {
    it('should generate description for single wielded weapon', async () => {
      // Arrange
      const actor = await createActor(testBed, { id: 'warrior', name: 'Marcus' });
      await createWeapon(testBed, { id: 'longsword', name: 'Longsword' });
      addWieldingComponent(entityManager, actor.id, ['longsword']);

      // Act - collect metadata directly
      const metadataCollector = new ActivityMetadataCollectionSystem({
        entityManager,
        logger: testBed.logger,
        activityIndex: null,
      });
      const activities = metadataCollector.collectActivityMetadata(actor.id);

      // Assert
      expect(activities).toBeDefined();
      expect(activities.length).toBeGreaterThan(0);
      const wieldingActivity = activities.find(
        (a) => a.sourceComponent === 'positioning:wielding'
      );
      expect(wieldingActivity).toBeDefined();
      expect(wieldingActivity.isMultiTarget).toBe(true);
      expect(wieldingActivity.targetEntityIds).toEqual(['longsword']);
    });

    it('should format single weapon name in activity phrase', async () => {
      // Arrange
      await createActor(testBed, { id: 'warrior', name: 'Marcus' });
      await createWeapon(testBed, { id: 'longsword', name: 'Longsword' });

      // Act
      const nlgSystem = new ActivityNLGSystem({
        logger: testBed.logger,
        entityManager,
        cacheManager: new ActivityCacheManager({
          logger: testBed.logger,
          eventBus: null,
        }),
      });

      const activity = {
        isMultiTarget: true,
        targetEntityIds: ['longsword'],
        template: '{actor} is wielding {targets} threateningly',
      };
      const phrase = nlgSystem.generateActivityPhrase('Marcus', activity);

      // Assert
      expect(phrase).toBe('Marcus is wielding Longsword threateningly');
    });
  });

  describe('Multiple Weapons', () => {
    it('should format two weapons with "and"', async () => {
      // Arrange
      await createActor(testBed, { id: 'duelist', name: 'Elena' });
      await createWeapon(testBed, { id: 'sword', name: 'Sword' });
      await createWeapon(testBed, { id: 'dagger', name: 'Dagger' });

      // Act
      const nlgSystem = new ActivityNLGSystem({
        logger: testBed.logger,
        entityManager,
        cacheManager: new ActivityCacheManager({
          logger: testBed.logger,
          eventBus: null,
        }),
      });

      const activity = {
        isMultiTarget: true,
        targetEntityIds: ['sword', 'dagger'],
        template: '{actor} is wielding {targets} threateningly',
      };
      const phrase = nlgSystem.generateActivityPhrase('Elena', activity);

      // Assert
      expect(phrase).toBe('Elena is wielding Sword and Dagger threateningly');
    });

    it('should format three weapons with Oxford comma', async () => {
      // Arrange
      await createActor(testBed, { id: 'champion', name: 'Viktor' });
      await createWeapon(testBed, { id: 'sword', name: 'Sword' });
      await createWeapon(testBed, { id: 'dagger', name: 'Dagger' });
      await createWeapon(testBed, { id: 'staff', name: 'Staff' });

      // Act
      const nlgSystem = new ActivityNLGSystem({
        logger: testBed.logger,
        entityManager,
        cacheManager: new ActivityCacheManager({
          logger: testBed.logger,
          eventBus: null,
        }),
      });

      const activity = {
        isMultiTarget: true,
        targetEntityIds: ['sword', 'dagger', 'staff'],
        template: '{actor} is wielding {targets} threateningly',
      };
      const phrase = nlgSystem.generateActivityPhrase('Viktor', activity);

      // Assert - Oxford comma format: "A, B, and C"
      expect(phrase).toBe('Viktor is wielding Sword, Dagger, and Staff threateningly');
    });

    it('should format four or more weapons correctly', async () => {
      // Arrange
      await createActor(testBed, { id: 'arsenal', name: 'Warrior' });
      await createWeapon(testBed, { id: 'w1', name: 'Sword' });
      await createWeapon(testBed, { id: 'w2', name: 'Dagger' });
      await createWeapon(testBed, { id: 'w3', name: 'Axe' });
      await createWeapon(testBed, { id: 'w4', name: 'Mace' });

      // Act
      const nlgSystem = new ActivityNLGSystem({
        logger: testBed.logger,
        entityManager,
        cacheManager: new ActivityCacheManager({
          logger: testBed.logger,
          eventBus: null,
        }),
      });

      const activity = {
        isMultiTarget: true,
        targetEntityIds: ['w1', 'w2', 'w3', 'w4'],
        template: '{actor} is wielding {targets} threateningly',
      };
      const phrase = nlgSystem.generateActivityPhrase('Warrior', activity);

      // Assert - "A, B, C, and D" format
      expect(phrase).toBe('Warrior is wielding Sword, Dagger, Axe, and Mace threateningly');
    });
  });

  describe('Activity Metadata', () => {
    it('should respect shouldDescribeInActivity: false', async () => {
      // Arrange
      const actor = await createActor(testBed, { id: 'sneaky', name: 'Shadow' });
      await createWeapon(testBed, { id: 'hidden-blade', name: 'Hidden Blade' });
      addWieldingComponent(entityManager, actor.id, ['hidden-blade'], {
        shouldDescribeInActivity: false,
      });

      // Act
      const metadataCollector = new ActivityMetadataCollectionSystem({
        entityManager,
        logger: testBed.logger,
        activityIndex: null,
      });
      const activities = metadataCollector.collectActivityMetadata(actor.id);

      // Assert - Activity should not be included when shouldDescribeInActivity is false
      // The system filters out activities with shouldDescribeInActivity: false
      const wieldingActivity = activities.find(
        (a) => a.sourceComponent === 'positioning:wielding'
      );
      expect(wieldingActivity).toBeUndefined();
    });

    it('should use priority 70 by default', async () => {
      // Arrange
      const actor = await createActor(testBed, { id: 'fighter', name: 'Knight' });
      await createWeapon(testBed, { id: 'broadsword', name: 'Broadsword' });
      addWieldingComponent(entityManager, actor.id, ['broadsword']);

      // Act
      const metadataCollector = new ActivityMetadataCollectionSystem({
        entityManager,
        logger: testBed.logger,
        activityIndex: null,
      });
      const activities = metadataCollector.collectActivityMetadata(actor.id);

      // Assert
      const wieldingActivity = activities.find(
        (a) => a.sourceComponent === 'positioning:wielding'
      );
      expect(wieldingActivity).toBeDefined();
      expect(wieldingActivity.priority).toBe(70);
    });

    it('should preserve targetRoleIsArray flag for multi-target detection', async () => {
      // Arrange
      const actor = await createActor(testBed, { id: 'guard', name: 'Guard' });
      await createWeapon(testBed, { id: 'spear', name: 'Spear' });
      addWieldingComponent(entityManager, actor.id, ['spear'], {
        targetRoleIsArray: true,
      });

      // Act
      const metadataCollector = new ActivityMetadataCollectionSystem({
        entityManager,
        logger: testBed.logger,
        activityIndex: null,
      });
      const activities = metadataCollector.collectActivityMetadata(actor.id);

      // Assert
      const wieldingActivity = activities.find(
        (a) => a.sourceComponent === 'positioning:wielding'
      );
      expect(wieldingActivity).toBeDefined();
      expect(wieldingActivity.isMultiTarget).toBe(true);
    });
  });

  describe('Template Replacement', () => {
    it('should replace {actor} placeholder with actor name', async () => {
      // Arrange
      await createActor(testBed, { id: 'hero', name: 'Aldric' });
      await createWeapon(testBed, { id: 'blade', name: 'Blade' });

      // Act
      const nlgSystem = new ActivityNLGSystem({
        logger: testBed.logger,
        entityManager,
        cacheManager: new ActivityCacheManager({
          logger: testBed.logger,
          eventBus: null,
        }),
      });

      const activity = {
        isMultiTarget: true,
        targetEntityIds: ['blade'],
        template: '{actor} is wielding {targets} threateningly',
      };
      const phrase = nlgSystem.generateActivityPhrase('Aldric', activity);

      // Assert
      expect(phrase).toContain('Aldric');
      expect(phrase).not.toContain('{actor}');
    });

    it('should replace {targets} placeholder with formatted weapon list', async () => {
      // Arrange
      await createActor(testBed, { id: 'warrior', name: 'Conan' });
      await createWeapon(testBed, { id: 'axe', name: 'Battle Axe' });
      await createWeapon(testBed, { id: 'shield', name: 'Tower Shield' });

      // Act
      const nlgSystem = new ActivityNLGSystem({
        logger: testBed.logger,
        entityManager,
        cacheManager: new ActivityCacheManager({
          logger: testBed.logger,
          eventBus: null,
        }),
      });

      const activity = {
        isMultiTarget: true,
        targetEntityIds: ['axe', 'shield'],
        template: '{actor} is wielding {targets} threateningly',
      };
      const phrase = nlgSystem.generateActivityPhrase('Conan', activity);

      // Assert
      expect(phrase).toContain('Battle Axe and Tower Shield');
      expect(phrase).not.toContain('{targets}');
    });
  });
});
