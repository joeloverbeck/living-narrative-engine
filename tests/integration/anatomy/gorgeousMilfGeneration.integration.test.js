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

// Import descriptor components
import sizeCategoryComponent from '../../../data/mods/descriptors/components/size_category.component.json';
import sizeSpecificComponent from '../../../data/mods/descriptors/components/size_specific.component.json';
import firmnessComponent from '../../../data/mods/descriptors/components/firmness.component.json';
import weightFeelComponent from '../../../data/mods/descriptors/components/weight_feel.component.json';
import textureComponent from '../../../data/mods/descriptors/components/texture.component.json';
import shapeGeneralComponent from '../../../data/mods/descriptors/components/shape_general.component.json';
import shapeEyeComponent from '../../../data/mods/descriptors/components/shape_eye.component.json';
import buildComponent from '../../../data/mods/descriptors/components/build.component.json';
import lengthCategoryComponent from '../../../data/mods/descriptors/components/length_category.component.json';
import lengthHairComponent from '../../../data/mods/descriptors/components/length_hair.component.json';
import colorBasicComponent from '../../../data/mods/descriptors/components/color_basic.component.json';
import colorExtendedComponent from '../../../data/mods/descriptors/components/color_extended.component.json';
import hairStyleComponent from '../../../data/mods/descriptors/components/hair_style.component.json';

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

    // Load descriptor components
    testBed.loadComponents({
      'descriptors:size_category': sizeCategoryComponent,
      'descriptors:size_specific': sizeSpecificComponent,
      'descriptors:firmness': firmnessComponent,
      'descriptors:weight_feel': weightFeelComponent,
      'descriptors:texture': textureComponent,
      'descriptors:shape_general': shapeGeneralComponent,
      'descriptors:shape_eye': shapeEyeComponent,
      'descriptors:build': buildComponent,
      'descriptors:length_category': lengthCategoryComponent,
      'descriptors:length_hair': lengthHairComponent,
      'descriptors:color_basic': colorBasicComponent,
      'descriptors:color_extended': colorExtendedComponent,
      'descriptors:hair_style': hairStyleComponent,
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
      const eyeColor = getPartComponent(eyeId, 'descriptors:color_extended');
      const eyeShape = getPartComponent(eyeId, 'descriptors:shape_eye');
      expect(eyeColor).toBeDefined();
      expect(eyeColor.color).toBe('cobalt');
      expect(eyeShape).toBeDefined();
      expect(eyeShape.shape).toBe('almond');
      
      // Verify it's the cobalt eye entity
      const eyeEntity = entityManager.getEntityInstance(eyeId);
      expect(eyeEntity.definitionId).toBe('anatomy:human_eye_cobalt');
    }

    // Test 2: Verify long raven-black hair
    const hair = findPartsByType('hair');
    expect(hair.length).toBe(1); // Should have exactly 1 hair

    const hairColor = getPartComponent(hair[0], 'descriptors:color_extended');
    const hairLength = getPartComponent(hair[0], 'descriptors:length_hair');
    const hairStyle = getPartComponent(hair[0], 'descriptors:hair_style');
    expect(hairColor).toBeDefined();
    expect(hairColor.color).toBe('raven-black');
    expect(hairLength).toBeDefined();
    expect(hairLength.length).toBe('long');
    expect(hairStyle).toBeDefined();
    expect(hairStyle.style).toBe('straight');

    // Test 3: Verify D-cup meaty breasts
    const breasts = findPartsByType('breast');
    expect(breasts.length).toBe(2); // Should have exactly 2 breasts

    for (const breastId of breasts) {
      const breastSize = getPartComponent(breastId, 'descriptors:size_specific');
      const breastWeight = getPartComponent(breastId, 'descriptors:weight_feel');
      const breastFirmness = getPartComponent(breastId, 'descriptors:firmness');
      expect(breastSize).toBeDefined();
      expect(breastSize.size).toBe('D-cup');
      expect(breastWeight).toBeDefined();
      expect(breastWeight.weight).toBe('meaty');
      expect(breastFirmness).toBeDefined();
      expect(breastFirmness.firmness).toBe('firm');
    }

    // Test 4: Verify long shapely legs
    const legs = findPartsByType('leg');
    expect(legs.length).toBe(2); // Should have exactly 2 legs

    for (const legId of legs) {
      const legLength = getPartComponent(legId, 'descriptors:length_category');
      const legBuild = getPartComponent(legId, 'descriptors:build');
      expect(legLength).toBeDefined();
      expect(legLength.length).toBe('long');
      expect(legBuild).toBeDefined();
      expect(legBuild.build).toBe('shapely');
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
      'descriptors:length_category': {
        length: 'long',
      },
      'descriptors:build': {
        build: 'shapely',
      },
    });

    expect(recipe.slots.breasts.properties).toMatchObject({
      'descriptors:size_specific': {
        size: 'D-cup',
      },
      'descriptors:weight_feel': {
        weight: 'meaty',
      },
      'descriptors:firmness': {
        firmness: 'firm',
      },
    });
  });
});