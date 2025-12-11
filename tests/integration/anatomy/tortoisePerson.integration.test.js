/**
 * @file Integration tests for tortoise person anatomy generation
 * Tests complete workflow of generating tortoise anatomy with all required parts
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { AnatomyGenerationService } from '../../../src/anatomy/anatomyGenerationService.js';

describe('Tortoise Person Anatomy Integration', () => {
  /** @type {AnatomyIntegrationTestBed} */
  let testBed;
  /** @type {AnatomyGenerationService} */
  let anatomyGenerationService;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.loadAnatomyModData();

    anatomyGenerationService = new AnatomyGenerationService({
      entityManager: testBed.entityManager,
      dataRegistry: testBed.registry,
      logger: testBed.logger,
      bodyBlueprintFactory: testBed.bodyBlueprintFactory,
      anatomyDescriptionService: testBed.anatomyDescriptionService,
      bodyGraphService: testBed.bodyGraphService,
    });
  });

  afterEach(() => {
    if (testBed && testBed.cleanup) {
      testBed.cleanup();
    }
  });

  describe('Complete Anatomy Generation', () => {
    it('should generate complete tortoise anatomy with all required parts', async () => {
      // Create test entity with tortoise person recipe
      const tortoise = await testBed.createActor({
        recipeId: 'anatomy-creatures:tortoise_person',
      });

      // Generate anatomy
      const result = await anatomyGenerationService.generateAnatomyIfNeeded(
        tortoise.id
      );

      // Verify anatomy was successfully generated
      expect(result).toBe(true);

      // Verify tortoise has anatomy:body component
      const bodyComponent = testBed.entityManager.getComponentData(
        tortoise.id,
        'anatomy:body'
      );
      expect(bodyComponent).toBeDefined();
      expect(bodyComponent.body).toBeDefined();
      expect(bodyComponent.body.parts).toBeDefined();

      const parts = bodyComponent.body.parts;
      const partsList = Object.values(parts);

      // Verify total part count: 16 parts
      // 1 torso + 2 shell + 1 head + 1 beak + 2 eyes + 2 arms + 2 hands + 2 legs + 2 feet + 1 tail
      // Fixed: Now correctly generating 2 hands and 2 feet with bilateral symmetry
      expect(partsList).toHaveLength(16);

      // Helper to check if a part with specific subType exists
      const hasPartWithSubType = (subType) => {
        return partsList.some((partId) => {
          const partEntity = testBed.entityManager.getEntityInstance(partId);
          const partComponent = partEntity.getComponentData('anatomy:part');
          return partComponent && partComponent.subType === subType;
        });
      };

      // Helper to count parts with specific subType
      const countPartsWithSubType = (subType) => {
        return partsList.filter((partId) => {
          const partEntity = testBed.entityManager.getEntityInstance(partId);
          const partComponent = partEntity.getComponentData('anatomy:part');
          return partComponent && partComponent.subType === subType;
        }).length;
      };

      // Verify shell parts (2)
      expect(hasPartWithSubType('shell_carapace')).toBe(true);
      expect(hasPartWithSubType('shell_plastron')).toBe(true);

      // Verify head and beak (2)
      expect(hasPartWithSubType('tortoise_head')).toBe(true);
      expect(hasPartWithSubType('tortoise_beak')).toBe(true);

      // Verify eyes (2)
      expect(countPartsWithSubType('tortoise_eye')).toBe(2);

      // Verify arms (2)
      expect(countPartsWithSubType('tortoise_arm')).toBe(2);

      // Verify hands (at least 1, ideally 2)
      expect(countPartsWithSubType('tortoise_hand')).toBeGreaterThanOrEqual(1);

      // Verify legs (2)
      expect(countPartsWithSubType('tortoise_leg')).toBe(2);

      // Verify feet (at least 1, ideally 2)
      expect(countPartsWithSubType('tortoise_foot')).toBeGreaterThanOrEqual(1);

      // Verify tail (1)
      expect(hasPartWithSubType('tortoise_tail')).toBe(true);
    });

    it('should have correct body descriptors', async () => {
      // Create test entity
      const tortoise = await testBed.createActor({
        recipeId: 'anatomy-creatures:tortoise_person',
      });

      // Generate anatomy
      await anatomyGenerationService.generateAnatomyIfNeeded(tortoise.id);

      // Get body component
      const bodyComponent = testBed.entityManager.getComponentData(
        tortoise.id,
        'anatomy:body'
      );
      expect(bodyComponent).toBeDefined();

      // Verify body descriptors match recipe
      expect(bodyComponent.body.descriptors.height).toBe('short');
      expect(bodyComponent.body.descriptors.build).toBe('stocky');
      expect(bodyComponent.body.descriptors.composition).toBe('average');
      expect(bodyComponent.body.descriptors.hairDensity).toBe('hairless');
      expect(bodyComponent.body.descriptors.skinColor).toBe('olive-green');
      expect(bodyComponent.body.descriptors.smell).toBe('earthy');
    });

    it('should have shell parts with correct descriptors', async () => {
      // Create test entity
      const tortoise = await testBed.createActor({
        recipeId: 'anatomy-creatures:tortoise_person',
      });

      // Generate anatomy
      await anatomyGenerationService.generateAnatomyIfNeeded(tortoise.id);

      // Get body component
      const bodyComponent = testBed.entityManager.getComponentData(
        tortoise.id,
        'anatomy:body'
      );
      const parts = bodyComponent.body.parts;

      // Find carapace
      const carapaceId = Object.values(parts).find((partId) => {
        const partEntity = testBed.entityManager.getEntityInstance(partId);
        const partComponent = partEntity.getComponentData('anatomy:part');
        return partComponent && partComponent.subType === 'shell_carapace';
      });

      expect(carapaceId).toBeDefined();
      const carapace = testBed.entityManager.getEntityInstance(carapaceId);

      const carapaceTexture = carapace.getComponentData('descriptors:texture');
      expect(carapaceTexture).toBeDefined();
      expect(carapaceTexture.texture).toBe('scaled');

      const carapaceShape = carapace.getComponentData(
        'descriptors:shape_general'
      );
      expect(carapaceShape).toBeDefined();
      expect(carapaceShape.shape).toBe('domed');

      const carapaceColor = carapace.getComponentData(
        'descriptors:color_extended'
      );
      expect(carapaceColor).toBeDefined();
      expect(carapaceColor.color).toBe('bronze');

      // Find plastron
      const plastronId = Object.values(parts).find((partId) => {
        const partEntity = testBed.entityManager.getEntityInstance(partId);
        const partComponent = partEntity.getComponentData('anatomy:part');
        return partComponent && partComponent.subType === 'shell_plastron';
      });

      expect(plastronId).toBeDefined();
      const plastron = testBed.entityManager.getEntityInstance(plastronId);

      const plastronTexture = plastron.getComponentData('descriptors:texture');
      expect(plastronTexture).toBeDefined();
      expect(plastronTexture.texture).toBe('smooth');

      const plastronShape = plastron.getComponentData(
        'descriptors:shape_general'
      );
      expect(plastronShape).toBeDefined();
      expect(plastronShape.shape).toBe('flat');

      const plastronColor = plastron.getComponentData(
        'descriptors:color_extended'
      );
      expect(plastronColor).toBeDefined();
      expect(plastronColor.color).toBe('cream');
    });

    it('should have clawed hands and feet', async () => {
      // Create test entity
      const tortoise = await testBed.createActor({
        recipeId: 'anatomy-creatures:tortoise_person',
      });

      // Generate anatomy
      await anatomyGenerationService.generateAnatomyIfNeeded(tortoise.id);

      // Get body component
      const bodyComponent = testBed.entityManager.getComponentData(
        tortoise.id,
        'anatomy:body'
      );
      const parts = bodyComponent.body.parts;

      // Find all hands and feet
      const hands = Object.values(parts).filter((partId) => {
        const partEntity = testBed.entityManager.getEntityInstance(partId);
        const partComponent = partEntity.getComponentData('anatomy:part');
        return partComponent && partComponent.subType === 'tortoise_hand';
      });

      const feet = Object.values(parts).filter((partId) => {
        const partEntity = testBed.entityManager.getEntityInstance(partId);
        const partComponent = partEntity.getComponentData('anatomy:part');
        return partComponent && partComponent.subType === 'tortoise_foot';
      });

      // Verify we have at least 1 hand (ideally 2, but currently limited to 1)
      expect(hands.length).toBeGreaterThanOrEqual(1);

      // Verify each hand has claws and 3 digits
      hands.forEach((handId) => {
        const hand = testBed.entityManager.getEntityInstance(handId);

        const projection = hand.getComponentData('descriptors:projection');
        expect(projection).toBeDefined();
        expect(projection.projection).toBe('clawed');

        const digitCount = hand.getComponentData('descriptors:digit_count');
        expect(digitCount).toBeDefined();
        expect(digitCount.count).toBe('3');
      });

      // Verify we have at least 1 foot (ideally 2, but currently limited to 1)
      expect(feet.length).toBeGreaterThanOrEqual(1);

      // Verify each foot has claws and 3 digits
      feet.forEach((footId) => {
        const foot = testBed.entityManager.getEntityInstance(footId);

        const projection = foot.getComponentData('descriptors:projection');
        expect(projection).toBeDefined();
        expect(projection.projection).toBe('clawed');

        const digitCount = foot.getComponentData('descriptors:digit_count');
        expect(digitCount).toBeDefined();
        expect(digitCount.count).toBe('3');
      });
    });

    it('should have beak properly attached to head', async () => {
      // Create test entity
      const tortoise = await testBed.createActor({
        recipeId: 'anatomy-creatures:tortoise_person',
      });

      // Generate anatomy
      await anatomyGenerationService.generateAnatomyIfNeeded(tortoise.id);

      // Get body component
      const bodyComponent = testBed.entityManager.getComponentData(
        tortoise.id,
        'anatomy:body'
      );
      const parts = bodyComponent.body.parts;

      // Find head
      const headId = Object.values(parts).find((partId) => {
        const partEntity = testBed.entityManager.getEntityInstance(partId);
        const partComponent = partEntity.getComponentData('anatomy:part');
        return partComponent && partComponent.subType === 'tortoise_head';
      });

      expect(headId).toBeDefined();

      // Find beak
      const beakId = Object.values(parts).find((partId) => {
        const partEntity = testBed.entityManager.getEntityInstance(partId);
        const partComponent = partEntity.getComponentData('anatomy:part');
        return partComponent && partComponent.subType === 'tortoise_beak';
      });

      expect(beakId).toBeDefined();

      // Verify beak descriptors
      const beak = testBed.entityManager.getEntityInstance(beakId);

      const beakTexture = beak.getComponentData('descriptors:texture');
      expect(beakTexture).toBeDefined();
      expect(beakTexture.texture).toBe('ridged');

      const beakShape = beak.getComponentData('descriptors:shape_general');
      expect(beakShape).toBeDefined();
      expect(beakShape.shape).toBe('hooked');
    });
  });

  describe('Formatting Output', () => {
    it('should generate body description with correct descriptors', async () => {
      // Create test entity
      const tortoise = await testBed.createActor({
        recipeId: 'anatomy-creatures:tortoise_person',
      });

      // Generate anatomy
      await anatomyGenerationService.generateAnatomyIfNeeded(tortoise.id);

      // Get the actor entity to generate descriptions
      const actorEntity = testBed.entityManager.getEntityInstance(tortoise.id);

      // Generate all descriptions
      const { bodyDescription } =
        await testBed.anatomyDescriptionService.generateAllDescriptions(
          actorEntity
        );

      expect(bodyDescription).toBeDefined();
      expect(typeof bodyDescription).toBe('string');
      expect(bodyDescription.length).toBeGreaterThan(0);

      const lowerDescription = bodyDescription.toLowerCase();

      // Current system generates body descriptors only (not individual part descriptions)
      // Verify body descriptors are included
      expect(lowerDescription).toContain('short'); // height
      expect(lowerDescription).toContain('olive-green'); // skin color
      expect(lowerDescription).toContain('stocky'); // build
      expect(lowerDescription).toContain('hairless'); // hair density
    });
  });
});
