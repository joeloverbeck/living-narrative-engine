/**
 * @file Integration test for complete anatomy generation with specific appearance requirements
 */

import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';

// Import anatomy mod data directly
import bodyComponent from '../../../data/mods/anatomy/components/body.component.json';
import jointComponent from '../../../data/mods/anatomy/components/joint.component.json';
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
import humanHairRaven from '../../../data/mods/anatomy/entities/definitions/human_hair_raven.entity.json';
import humanLegShapely from '../../../data/mods/anatomy/entities/definitions/human_leg_shapely.entity.json';
import humanoidArm from '../../../data/mods/anatomy/entities/definitions/humanoid_arm.entity.json';
import humanoidHead from '../../../data/mods/anatomy/entities/definitions/humanoid_head.entity.json';
import humanoidLeg from '../../../data/mods/anatomy/entities/definitions/humanoid_leg.entity.json';
import humanoidEar from '../../../data/mods/anatomy/entities/definitions/humanoid_ear.entity.json';
import humanoidNose from '../../../data/mods/anatomy/entities/definitions/humanoid_nose.entity.json';
import humanoidMouth from '../../../data/mods/anatomy/entities/definitions/humanoid_mouth.entity.json';
import humanVagina from '../../../data/mods/anatomy/entities/definitions/human_vagina.entity.json';
import humanBreast from '../../../data/mods/anatomy/entities/definitions/human_breast.entity.json';
import humanHair from '../../../data/mods/anatomy/entities/definitions/human_hair.entity.json';
import humanFemaleTorso from '../../../data/mods/anatomy/entities/definitions/human_female_torso.entity.json';
import humanHand from '../../../data/mods/anatomy/entities/definitions/human_hand.entity.json';
import humanAsshole from '../../../data/mods/anatomy/entities/definitions/human_asshole.entity.json';
import humanFemaleBlueprint from '../../../data/mods/anatomy/blueprints/human_female.blueprint.json';
import gorgeousMilfRecipe from '../../../data/mods/anatomy/recipes/gorgeous_milf.recipe.json';

// Import core components needed for anatomy
import nameComponent from '../../../data/mods/core/components/name.component.json';
import descriptionComponent from '../../../data/mods/core/components/description.component.json';

// Define human female entity inline (example entity for testing)
const humanFemale = {
  $schema: 'http://example.com/schemas/entity-definition.schema.json',
  id: 'anatomy:human_female',
  components: {
    'core:name': {
      text: 'Human Female',
    },
    'anatomy:body': {
      recipeId: 'anatomy:gorgeous_milf',
    },
  },
};

// Define Jacqueline Rouxel entity inline (test-only entity)
const jacquelineRouxel = {
  $schema: 'http://example.com/schemas/entity-definition.schema.json',
  id: 'anatomy:jacqueline_rouxel',
  description: 'Jacqueline Rouxel - A gorgeous woman',
  components: {
    'core:name': {
      text: 'Jacqueline Rouxel',
    },
    'core:description': {
      description:
        'A stunning woman with striking features and an alluring presence.',
    },
    'anatomy:body': {
      recipeId: 'anatomy:gorgeous_milf',
    },
    'core:location': {
      locationInstanceId: 'default-location',
    },
  },
};

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
      'anatomy:joint': jointComponent,
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
      'anatomy:humanoid_ear': humanoidEar,
      'anatomy:humanoid_nose': humanoidNose,
      'anatomy:humanoid_mouth': humanoidMouth,
      'anatomy:human_vagina': humanVagina,
      'anatomy:human_breast': humanBreast,
      'anatomy:human_hair': humanHair,
      'anatomy:human_female_torso': humanFemaleTorso,
      'anatomy:human_hand': humanHand,
      'anatomy:human_asshole': humanAsshole,
      'anatomy:jacqueline_rouxel': jacquelineRouxel,
    });

    // Load blueprints
    testBed.loadBlueprints({
      'anatomy:human_female': humanFemaleBlueprint,
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
    const jacquelineEntity = entityManager.createEntityInstance(
      'anatomy:jacqueline_rouxel'
    );
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

    // Helper function to get all parts by traversing the anatomy graph
    const getAllParts = (rootId) => {
      const result = [];
      const visited = new Set();
      const stack = [rootId];

      while (stack.length > 0) {
        const currentId = stack.pop();
        if (visited.has(currentId)) continue;

        visited.add(currentId);
        result.push(currentId);

        // Find all children (entities with joints pointing to this entity)
        const entitiesWithJoints =
          entityManager.getEntitiesWithComponent('anatomy:joint');
        for (const entity of entitiesWithJoints) {
          const joint = entityManager.getComponentData(
            entity.id,
            'anatomy:joint'
          );
          if (joint && joint.parentId === currentId) {
            stack.push(entity.id);
          }
        }
      }
      return result;
    };

    const allParts = getAllParts(generatedBody.body.root);
    expect(allParts.length).toBeGreaterThan(0);

    // Helper function to find parts by type
    const findPartsByType = (partType) => {
      return allParts.filter((partId) => {
        const partEntity = entityManager.getEntityInstance(partId);
        if (!partEntity) return false;
        const anatomyPart = entityManager.getComponentData(
          partId,
          'anatomy:part'
        );
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
    const heads = findPartsByType('head');
    expect(heads.length).toBe(1);
    const headId = heads[0];

    const hair = findPartsByType('hair');
    // Filter for scalp hair only (attached to head)
    const scalpHair = hair.filter((hairId) => {
      const joint = getPartComponent(hairId, 'anatomy:joint');
      return joint && joint.parentId === headId;
    });
    expect(scalpHair.length).toBe(1); // Should have exactly 1 scalp hair

    const hairColor = getPartComponent(
      scalpHair[0],
      'descriptors:color_extended'
    );
    const hairLength = getPartComponent(
      scalpHair[0],
      'descriptors:length_hair'
    );
    const hairStyle = getPartComponent(scalpHair[0], 'descriptors:hair_style');
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
      const breastSize = getPartComponent(
        breastId,
        'descriptors:size_specific'
      );
      const breastWeight = getPartComponent(
        breastId,
        'descriptors:weight_feel'
      );
      const breastFirmness = getPartComponent(breastId, 'descriptors:firmness');
      expect(breastSize).toBeDefined();
      expect(breastSize.size).toBe('D-cup');
      expect(breastWeight).toBeDefined();
      expect(breastWeight.weight).toBe('meaty');
      expect(breastFirmness).toBeDefined();
      expect(breastFirmness.firmness).toBe('soft');
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
    for (const partId of allParts) {
      if (partId === generatedBody.body.root) continue; // Root doesn't have a joint

      const joint = getPartComponent(partId, 'anatomy:joint');
      expect(joint).toBeDefined();
      expect(joint.parentId).toBeDefined();
      expect(joint.socketId).toBeDefined();

      // Verify parent exists in the anatomy
      expect(allParts).toContain(joint.parentId);
    }

    // Test 6: Verify the head has all expected child parts

    // Get all parts attached to the head
    const headChildren = allParts.filter((partId) => {
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
    expect(childTypes.hair).toBe(1); // scalp hair
  });

  it('recipe should properly reference all created part types', () => {
    // Get the recipe from the registry
    const recipe = testBed.registry.get(
      'anatomyRecipes',
      'anatomy:gorgeous_milf'
    );
    expect(recipe).toBeDefined();
    expect(recipe.blueprintId).toBe('anatomy:human_female');

    // Verify slot specifications that aren't patterns
    expect(recipe.slots.hair.preferId).toBe('anatomy:human_hair_raven');

    // Verify pattern specifications
    expect(recipe.patterns).toBeDefined();
    expect(recipe.patterns.length).toBeGreaterThan(0);

    // Find eye pattern
    const eyePattern = recipe.patterns.find((p) =>
      p.matches.includes('left_eye')
    );
    expect(eyePattern).toBeDefined();
    expect(eyePattern.preferId).toBe('anatomy:human_eye_cobalt');
    expect(eyePattern.matches).toContain('left_eye');
    expect(eyePattern.matches).toContain('right_eye');

    // Find leg pattern
    const legPattern = recipe.patterns.find((p) =>
      p.matches.includes('left_leg')
    );
    expect(legPattern).toBeDefined();
    expect(legPattern.preferId).toBe('anatomy:human_leg_shapely');
    expect(legPattern.properties).toMatchObject({
      'descriptors:length_category': {
        length: 'long',
      },
      'descriptors:build': {
        build: 'shapely',
      },
    });

    // Find breast pattern
    const breastPattern = recipe.patterns.find((p) =>
      p.matches.includes('left_breast')
    );
    expect(breastPattern).toBeDefined();
    expect(breastPattern.preferId).toBe('anatomy:human_breast_d_cup');
    expect(breastPattern.properties).toMatchObject({
      'descriptors:size_specific': {
        size: 'D-cup',
      },
      'descriptors:weight_feel': {
        weight: 'meaty',
      },
      'descriptors:firmness': {
        firmness: 'soft',
      },
    });
  });
});
