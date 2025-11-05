/**
 * @file Integration test for skinColor descriptor in anatomy descriptions
 * @description Tests the full workflow from anatomy recipe with skinColor to generated description
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBedAnatomy } from '../../common/testbed.anatomy.js';

describe('SkinColor in Anatomy Descriptions - Integration', () => {
  let testBed;
  let entityManager;
  let bodyDescriptionComposer;

  beforeEach(async () => {
    testBed = new TestBedAnatomy();
    await testBed.setup();
    entityManager = testBed.entityManager;
    bodyDescriptionComposer = testBed.bodyDescriptionComposer;
  });

  afterEach(async () => {
    if (testBed && typeof testBed.cleanup === 'function') {
      await testBed.cleanup();
    }
  });

  describe('Recipe with skinColor bodyDescriptor', () => {
    it('should include skinColor in description when present in recipe', async () => {
      // Create a test entity with anatomy:body component containing skinColor
      const actor = await entityManager.createEntityInstance('core:actor', {
        skipValidation: false,
        generateId: true,
      });
      const actorId = actor.id;

      // Add anatomy:body component with body.descriptors.skinColor
      await entityManager.addComponent(actorId, 'anatomy:body', {
        recipeId: 'test:recipe_with_skin_color',
        body: {
          root: 'test-torso-id',
          descriptors: {
            height: 'tall',
            skinColor: 'tanned',
            build: 'muscular',
            composition: 'lean',
            hairDensity: 'hairy',
          },
          parts: {},
        },
      });

      // Get the entity instance
      const entity = entityManager.getEntityInstance(actorId);

      // Generate description
      const description =
        await bodyDescriptionComposer.composeDescription(entity);

      // Verify that skinColor appears in the description
      expect(description).toContain('Skin color: tanned');

      // Verify other descriptors are also present
      expect(description).toContain('Height: tall');
      expect(description).toContain('Build: muscular');
      expect(description).toContain('Body composition: lean');
      expect(description).toContain('Body hair: hairy');
    });

    it('should work with different skinColor values', async () => {
      const skinColorValues = ['fair', 'olive', 'tanned', 'dark', 'ebony'];

      for (const skinColor of skinColorValues) {
        // Create entity with specific skinColor
        const actor = await entityManager.createEntityInstance('core:actor', {
          skipValidation: false,
          generateId: true,
        });
        const actorId = actor.id;

        await entityManager.addComponent(actorId, 'anatomy:body', {
          recipeId: `test:recipe_${skinColor}`,
          body: {
            root: 'test-torso-id',
            descriptors: {
              skinColor: skinColor,
            },
            parts: {},
          },
        });

        const entity = entityManager.getEntityInstance(actorId);
        const description =
          await bodyDescriptionComposer.composeDescription(entity);

        expect(description).toContain(`Skin color: ${skinColor}`);
      }
    });

    it('should handle recipe without skinColor gracefully', async () => {
      // Create entity without skinColor
      const actor = await entityManager.createEntityInstance('core:actor', {
        skipValidation: false,
        generateId: true,
      });
      const actorId = actor.id;

      await entityManager.addComponent(actorId, 'anatomy:body', {
        recipeId: 'test:recipe_no_skin_color',
        body: {
          root: 'test-torso-id',
          descriptors: {
            build: 'athletic',
            composition: 'average',
          },
          parts: {},
        },
      });

      const entity = entityManager.getEntityInstance(actorId);
      const description =
        await bodyDescriptionComposer.composeDescription(entity);

      // Should not contain skin color
      expect(description).not.toContain('Skin color:');

      // Should contain other descriptors
      expect(description).toContain('Build: athletic');
      expect(description).toContain('Body composition: average');
    });

    it('should place skinColor in correct order relative to other descriptors', async () => {
      const actor = await entityManager.createEntityInstance('core:actor', {
        skipValidation: false,
        generateId: true,
      });
      const actorId = actor.id;

      await entityManager.addComponent(actorId, 'anatomy:body', {
        recipeId: 'test:recipe_all_descriptors',
        body: {
          root: 'test-torso-id',
          descriptors: {
            height: 'average',
            skinColor: 'olive',
            build: 'slim',
            composition: 'lean',
            hairDensity: 'light',
          },
          parts: {},
        },
      });

      const entity = entityManager.getEntityInstance(actorId);
      const description =
        await bodyDescriptionComposer.composeDescription(entity);

      // Extract positions of each descriptor
      const heightIndex = description.indexOf('Height:');
      const skinColorIndex = description.indexOf('Skin color:');
      const buildIndex = description.indexOf('Build:');
      const compositionIndex = description.indexOf('Body composition:');
      const densityIndex = description.indexOf('Body hair:');

      // Verify all are present
      expect(heightIndex).toBeGreaterThan(-1);
      expect(skinColorIndex).toBeGreaterThan(-1);
      expect(buildIndex).toBeGreaterThan(-1);
      expect(compositionIndex).toBeGreaterThan(-1);
      expect(densityIndex).toBeGreaterThan(-1);

      // Verify correct ordering (based on default descriptionOrder)
      // Expected order: height, skin_color, build, body_composition, body_hair
      expect(heightIndex).toBeLessThan(skinColorIndex);
      expect(skinColorIndex).toBeLessThan(buildIndex);
      expect(buildIndex).toBeLessThan(compositionIndex);
      expect(compositionIndex).toBeLessThan(densityIndex);
    });

    it('should work with only skinColor descriptor', async () => {
      const actor = await entityManager.createEntityInstance('core:actor', {
        skipValidation: false,
        generateId: true,
      });
      const actorId = actor.id;

      await entityManager.addComponent(actorId, 'anatomy:body', {
        recipeId: 'test:recipe_only_skin_color',
        body: {
          root: 'test-torso-id',
          descriptors: {
            skinColor: 'bronze',
          },
          parts: {},
        },
      });

      const entity = entityManager.getEntityInstance(actorId);
      const description =
        await bodyDescriptionComposer.composeDescription(entity);

      expect(description).toContain('Skin color: bronze');
      // Should not contain other body-level descriptors
      expect(description).not.toContain('Build:');
      expect(description).not.toContain('Body composition:');
      expect(description).not.toContain('Body hair:');
    });
  });

  describe('Backward compatibility with deprecated entity-level components', () => {
    it('should still extract skinColor from deprecated descriptors:skin_color component', async () => {
      const actor = await entityManager.createEntityInstance('core:actor', {
        skipValidation: false,
        generateId: true,
      });
      const actorId = actor.id;

      // Add anatomy:body without skinColor in body.descriptors
      await entityManager.addComponent(actorId, 'anatomy:body', {
        recipeId: 'test:deprecated_format',
        body: {
          root: 'test-torso-id',
          parts: {},
        },
      });

      // Add deprecated entity-level descriptor component
      await entityManager.addComponent(actorId, 'descriptors:skin_color', {
        skinColor: 'pale',
      });

      const entity = entityManager.getEntityInstance(actorId);
      const description =
        await bodyDescriptionComposer.composeDescription(entity);

      // Should extract from deprecated format with deprecation warning
      expect(description).toContain('Skin color: pale');
    });

    it('should prefer body.descriptors.skinColor over deprecated format', async () => {
      const actor = await entityManager.createEntityInstance('core:actor', {
        skipValidation: false,
        generateId: true,
      });
      const actorId = actor.id;

      // Add both new and deprecated formats
      await entityManager.addComponent(actorId, 'anatomy:body', {
        recipeId: 'test:mixed_format',
        body: {
          root: 'test-torso-id',
          descriptors: {
            skinColor: 'olive', // New format
          },
          parts: {},
        },
      });

      await entityManager.addComponent(actorId, 'descriptors:skin_color', {
        skinColor: 'pale', // Deprecated format
      });

      const entity = entityManager.getEntityInstance(actorId);
      const description =
        await bodyDescriptionComposer.composeDescription(entity);

      // Should use the new format value
      expect(description).toContain('Skin color: olive');
      expect(description).not.toContain('Skin color: pale');
    });
  });
});
