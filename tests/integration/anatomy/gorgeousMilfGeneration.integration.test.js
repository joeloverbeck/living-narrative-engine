/**
 * @file Integration test for complete anatomy generation with specific appearance requirements
 */

import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';

// Import anatomy mod data directly
import bodyComponent from '../../../data/mods/anatomy/components/body.component.json';
import breastAppearanceComponent from '../../../data/mods/anatomy/components/breast_appearance.component.json';
import eyeAppearanceComponent from '../../../data/mods/anatomy/components/eye_appearance.component.json';
import hairAppearanceComponent from '../../../data/mods/anatomy/components/hair_appearance.component.json';
import jointComponent from '../../../data/mods/anatomy/components/joint.component.json';
import legAppearanceComponent from '../../../data/mods/anatomy/components/leg_appearance.component.json';
import partComponent from '../../../data/mods/anatomy/components/part.component.json';
import socketsComponent from '../../../data/mods/anatomy/components/sockets.component.json';

import humanBreastDCup from '../../../data/mods/anatomy/entities/definitions/human_breast_d_cup.entity.json';
import humanEye from '../../../data/mods/anatomy/entities/definitions/human_eye.entity.json';
import humanEyeBlue from '../../../data/mods/anatomy/entities/definitions/human_eye_blue.entity.json';
import humanEyeBrown from '../../../data/mods/anatomy/entities/definitions/human_eye_brown.entity.json';
import humanEyeCobalt from '../../../data/mods/anatomy/entities/definitions/human_eye_cobalt.entity.json';
import humanFemale from '../../../data/mods/anatomy/entities/definitions/human_female.entity.json';
import humanHairRaven from '../../../data/mods/anatomy/entities/definitions/human_hair_raven.entity.json';
import humanLegShapely from '../../../data/mods/anatomy/entities/definitions/human_leg_shapely.entity.json';
import humanoidArm from '../../../data/mods/anatomy/entities/definitions/humanoid_arm.entity.json';
import humanoidHead from '../../../data/mods/anatomy/entities/definitions/humanoid_head.entity.json';
import humanoidLeg from '../../../data/mods/anatomy/entities/definitions/humanoid_leg.entity.json';
import humanoidTorso from '../../../data/mods/anatomy/entities/definitions/humanoid_torso.entity.json';
import jacquelineRouxel from '../../../data/mods/anatomy/entities/instances/jacqueline_rouxel.entity.json';

import humanoidStandardBlueprint from '../../../data/mods/anatomy/blueprints/humanoid_standard.blueprint.json';
import gorgeousMilfRecipe from '../../../data/mods/anatomy/recipes/gorgeous_milf.recipe.json';

// Import core components needed for anatomy
import nameComponent from '../../../data/mods/core/components/name.component.json';
import descriptionComponent from '../../../data/mods/core/components/description.component.json';

describe('Gorgeous MILF Anatomy Generation Integration Test', () => {
  let testBed;
  let entityManager;
  let anatomyGenerationService;

  beforeAll(() => {
    testBed = new AnatomyIntegrationTestBed();
    entityManager = testBed.entityManager;
    anatomyGenerationService = testBed.anatomyGenerationService;

    // Load core components
    testBed.loadComponents({
      'core:name': nameComponent,
      'core:description': descriptionComponent,
    });

    // Load anatomy components
    testBed.loadComponents({
      'anatomy:body': bodyComponent,
      'anatomy:breast_appearance': breastAppearanceComponent,
      'anatomy:eye_appearance': eyeAppearanceComponent,
      'anatomy:hair_appearance': hairAppearanceComponent,
      'anatomy:joint': jointComponent,
      'anatomy:leg_appearance': legAppearanceComponent,
      'anatomy:part': partComponent,
      'anatomy:sockets': socketsComponent,
    });

    // Load entity definitions
    testBed.loadEntityDefinitions({
      'anatomy:human_breast_d_cup': humanBreastDCup,
      'anatomy:human_eye': humanEye,
      'anatomy:human_eye_blue': humanEyeBlue,
      'anatomy:human_eye_brown': humanEyeBrown,
      'anatomy:human_eye_cobalt': humanEyeCobalt,
      'anatomy:human_female': humanFemale,
      'anatomy:human_hair_raven': humanHairRaven,
      'anatomy:human_leg_shapely': humanLegShapely,
      'anatomy:humanoid_arm': humanoidArm,
      'anatomy:humanoid_head': humanoidHead,
      'anatomy:humanoid_leg': humanoidLeg,
      'anatomy:humanoid_torso': humanoidTorso,
      'anatomy:jacqueline_rouxel': jacquelineRouxel,
    });

    // Load blueprints
    testBed.loadBlueprints({
      'anatomy:humanoid_standard': humanoidStandardBlueprint,
    });

    // Load recipes
    testBed.loadRecipes({
      'anatomy:gorgeous_milf': gorgeousMilfRecipe,
    });

  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('should generate complete anatomy for Jacqueline Rouxel with all specified features', async () => {
    // Create Jacqueline entity
    const jacquelineEntity = entityManager.createEntityInstance('anatomy:jacqueline_rouxel');
    expect(jacquelineEntity).toBeDefined();
    expect(jacquelineEntity.id).toBeDefined();

    // Verify she has the anatomy:body component with the correct recipe
    const anatomyBodyData = entityManager.getComponentData(
      jacquelineEntity.id,
      ANATOMY_BODY_COMPONENT_ID
    );
    expect(anatomyBodyData).toBeDefined();
    expect(anatomyBodyData.recipeId).toBe('anatomy:gorgeous_milf');

    // Generate anatomy
    const wasGenerated = await anatomyGenerationService.generateAnatomyIfNeeded(
      jacquelineEntity.id
    );
    expect(wasGenerated).toBe(true);

    // Get updated anatomy data
    const generatedBody = entityManager.getComponentData(
      jacquelineEntity.id,
      ANATOMY_BODY_COMPONENT_ID
    );
    expect(generatedBody.body).toBeDefined();
    expect(generatedBody.body.root).toBeDefined();
    expect(generatedBody.body.allParts).toBeInstanceOf(Array);
    expect(generatedBody.body.allParts.length).toBeGreaterThan(0);

    // Helper function to find parts by type
    const findPartsByType = (partType) => {
      return generatedBody.body.allParts.filter((partId) => {
        const partEntity = entityManager.getEntityInstance(partId);
        if (!partEntity) return false;
        const anatomyPart = entityManager.getComponentData(partId, 'anatomy:part');
        return anatomyPart && anatomyPart.subType === partType;
      });
    };

    // Helper function to get component data
    const getPartComponent = (partId, componentId) => {
      return entityManager.getComponentData(partId, componentId);
    };

    // Test 1: Verify cobalt blue eyes
    const eyes = findPartsByType('eye');
    expect(eyes.length).toBe(2); // Should have exactly 2 eyes

    for (const eyeId of eyes) {
      const eyeAppearance = getPartComponent(eyeId, 'anatomy:eye_appearance');
      expect(eyeAppearance).toBeDefined();
      expect(eyeAppearance.color).toBe('blue'); // Cobalt blue maps to "blue" in the enum
      
      // Verify it's the cobalt eye entity
      const eyeEntity = entityManager.getEntityInstance(eyeId);
      expect(eyeEntity.definitionId).toBe('anatomy:human_eye_cobalt');
    }

    // Test 2: Verify long raven-black hair
    const hair = findPartsByType('hair');
    expect(hair.length).toBe(1); // Should have exactly 1 hair

    const hairAppearance = getPartComponent(hair[0], 'anatomy:hair_appearance');
    expect(hairAppearance).toBeDefined();
    expect(hairAppearance.color).toBe('raven-black');
    expect(hairAppearance.length).toBe('long');

    // Test 3: Verify D-cup meaty breasts
    const breasts = findPartsByType('breast');
    expect(breasts.length).toBe(2); // Should have exactly 2 breasts

    for (const breastId of breasts) {
      const breastAppearance = getPartComponent(breastId, 'anatomy:breast_appearance');
      expect(breastAppearance).toBeDefined();
      expect(breastAppearance.size).toBe('D-cup');
      expect(breastAppearance.descriptor).toBe('meaty');
    }

    // Test 4: Verify long shapely legs
    const legs = findPartsByType('leg');
    expect(legs.length).toBe(2); // Should have exactly 2 legs

    for (const legId of legs) {
      const legAppearance = getPartComponent(legId, 'anatomy:leg_appearance');
      expect(legAppearance).toBeDefined();
      expect(legAppearance.length).toBe('long');
      expect(legAppearance.descriptor).toBe('shapely');
    }

    // Test 5: Verify all parts are properly connected
    for (const partId of generatedBody.body.allParts) {
      if (partId === generatedBody.body.root) continue; // Root doesn't have a joint

      const joint = getPartComponent(partId, 'anatomy:joint');
      expect(joint).toBeDefined();
      expect(joint.parentId).toBeDefined();
      expect(joint.socketId).toBeDefined();
      
      // Verify parent exists in the anatomy
      expect(generatedBody.body.allParts).toContain(joint.parentId);
    }

    // Test 6: Verify the head has all expected child parts
    const heads = findPartsByType('head');
    expect(heads.length).toBe(1);
    const headId = heads[0];

    // Get all parts attached to the head
    const headChildren = generatedBody.body.allParts.filter((partId) => {
      const joint = getPartComponent(partId, 'anatomy:joint');
      return joint && joint.parentId === headId;
    });

    // Should have 2 eyes and 1 hair at minimum
    expect(headChildren.length).toBeGreaterThanOrEqual(3);

    // Count specific child types
    const childTypes = {};
    for (const childId of headChildren) {
      const part = getPartComponent(childId, 'anatomy:part');
      if (part && part.subType) {
        childTypes[part.subType] = (childTypes[part.subType] || 0) + 1;
      }
    }

    expect(childTypes.eye).toBe(2);
    expect(childTypes.hair).toBe(1);
  });

  it('recipe should properly reference all created part types', () => {
    // Get the recipe from the registry
    const recipe = testBed.registry.get('anatomyRecipes', 'anatomy:gorgeous_milf');
    expect(recipe).toBeDefined();
    expect(recipe.blueprintId).toBe('anatomy:humanoid_standard');

    // Verify all slot specifications
    expect(recipe.slots.head.childSlots).toBeDefined();
    expect(recipe.slots.head.childSlots.left_eye.preferId).toBe('anatomy:human_eye_cobalt');
    expect(recipe.slots.head.childSlots.right_eye.preferId).toBe('anatomy:human_eye_cobalt');
    expect(recipe.slots.head.childSlots.scalp.preferId).toBe('anatomy:human_hair_raven');
    
    expect(recipe.slots.legs.preferId).toBe('anatomy:human_leg_shapely');
    expect(recipe.slots.breasts.preferId).toBe('anatomy:human_breast_d_cup');

    // Verify property requirements
    expect(recipe.slots.legs.properties).toMatchObject({
      'anatomy:leg_appearance': {
        length: 'long',
        descriptor: 'shapely',
      },
    });

    expect(recipe.slots.breasts.properties).toMatchObject({
      'anatomy:breast_appearance': {
        size: 'D-cup',
        descriptor: 'meaty',
      },
    });
  });
});