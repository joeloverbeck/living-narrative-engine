/**
 * @file Integration test for muscular male anatomy generation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';

// Import anatomy mod data directly
import bodyComponent from '../../../data/mods/anatomy/components/body.component.json';
import jointComponent from '../../../data/mods/anatomy/components/joint.component.json';
import partComponent from '../../../data/mods/anatomy/components/part.component.json';
import socketsComponent from '../../../data/mods/anatomy/components/sockets.component.json';
import vitalOrganComponent from '../../../data/mods/anatomy/components/vital_organ.component.json';
import partHealthComponent from '../../../data/mods/anatomy/components/part_health.component.json';
import damagePropagationComponent from '../../../data/mods/anatomy/components/damage_propagation.component.json';

// Import descriptor components
import buildComponent from '../../../data/mods/descriptors/components/build.component.json';
import sizeCategoryComponent from '../../../data/mods/descriptors/components/size_category.component.json';
import sizeSpecificComponent from '../../../data/mods/descriptors/components/size_specific.component.json';
import firmnessComponent from '../../../data/mods/descriptors/components/firmness.component.json';
import weightFeelComponent from '../../../data/mods/descriptors/components/weight_feel.component.json';
import textureComponent from '../../../data/mods/descriptors/components/texture.component.json';
import shapeGeneralComponent from '../../../data/mods/descriptors/components/shape_general.component.json';
import shapeEyeComponent from '../../../data/mods/descriptors/components/shape_eye.component.json';
import lengthCategoryComponent from '../../../data/mods/descriptors/components/length_category.component.json';
import lengthHairComponent from '../../../data/mods/descriptors/components/length_hair.component.json';
import colorBasicComponent from '../../../data/mods/descriptors/components/color_basic.component.json';
import colorExtendedComponent from '../../../data/mods/descriptors/components/color_extended.component.json';
import hairStyleComponent from '../../../data/mods/descriptors/components/hair_style.component.json';

// Import entity definitions
import humanMaleTorso from '../../../data/mods/anatomy/entities/definitions/human_male_torso.entity.json';
import humanMaleTorsoMuscular from '../../../data/mods/anatomy/entities/definitions/human_male_torso_muscular.entity.json';
import humanoidArm from '../../../data/mods/anatomy/entities/definitions/humanoid_arm.entity.json';
import humanoidArmMuscular from '../../../data/mods/anatomy/entities/definitions/humanoid_arm_muscular.entity.json';
import humanoidHead from '../../../data/mods/anatomy/entities/definitions/humanoid_head.entity.json';
import humanLeg from '../../../data/mods/anatomy/entities/definitions/human_leg.entity.json';
import humanLegMuscular from '../../../data/mods/anatomy/entities/definitions/human_leg_muscular.entity.json';
import humanLegShapely from '../../../data/mods/anatomy/entities/definitions/human_leg_shapely.entity.json';
import humanoidEar from '../../../data/mods/anatomy/entities/definitions/humanoid_ear.entity.json';
import humanoidNose from '../../../data/mods/anatomy/entities/definitions/humanoid_nose.entity.json';
import humanoidMouth from '../../../data/mods/anatomy/entities/definitions/humanoid_mouth.entity.json';
import humanoidTeeth from '../../../data/mods/anatomy/entities/definitions/humanoid_teeth.entity.json';
import humanPenis from '../../../data/mods/anatomy/entities/definitions/human_penis.entity.json';
import humanTesticle from '../../../data/mods/anatomy/entities/definitions/human_testicle.entity.json';
import humanHand from '../../../data/mods/anatomy/entities/definitions/human_hand.entity.json';
import humanFoot from '../../../data/mods/anatomy/entities/definitions/human_foot.entity.json';
import humanAsshole from '../../../data/mods/anatomy/entities/definitions/human_asshole.entity.json';
import humanAssCheek from '../../../data/mods/anatomy/entities/definitions/human_ass_cheek.entity.json';
import humanEyeBlue from '../../../data/mods/anatomy/entities/definitions/human_eye_blue.entity.json';
import humanEyeBrown from '../../../data/mods/anatomy/entities/definitions/human_eye_brown.entity.json';
import humanEyeCobalt from '../../../data/mods/anatomy/entities/definitions/human_eye_cobalt.entity.json';
import humanEyeGreen from '../../../data/mods/anatomy/entities/definitions/human_eye_green.entity.json';
import humanHair from '../../../data/mods/anatomy/entities/definitions/human_hair.entity.json';
import humanHairRaven from '../../../data/mods/anatomy/entities/definitions/human_hair_raven.entity.json';
import humanHairBlonde from '../../../data/mods/anatomy/entities/definitions/human_hair_blonde.entity.json';
import humanPubicHair from '../../../data/mods/anatomy/entities/definitions/human_pubic_hair.entity.json';
import humanMaleBlueprint from '../../../data/mods/anatomy/blueprints/human_male.blueprint.json';
import humanoidSlotLibrary from '../../../data/mods/anatomy/libraries/humanoid.slot-library.json';
import humanoidCorePart from '../../../data/mods/anatomy/parts/humanoid_core.part.json';
import blueprintSlot from '../../../data/mods/anatomy/entities/definitions/blueprint_slot.entity.json';
import humanHeart from '../../../data/mods/anatomy/entities/definitions/human_heart.entity.json';
import humanBrain from '../../../data/mods/anatomy/entities/definitions/human_brain.entity.json';
import humanSpine from '../../../data/mods/anatomy/entities/definitions/human_spine.entity.json';
import humanLungLeft from '../../../data/mods/anatomy/entities/definitions/human_lung_left.entity.json';
import humanLungRight from '../../../data/mods/anatomy/entities/definitions/human_lung_right.entity.json';

// Import core components needed for anatomy
import nameComponent from '../../../data/mods/core/components/name.component.json';
import descriptionComponent from '../../../data/mods/core/components/description.component.json';

// Define the muscular male recipe inline
const muscularMaleRecipe = {
  $schema: 'schema://living-narrative-engine/anatomy.recipe.schema.json',
  recipeId: 'test:muscular_male_recipe',
  blueprintId: 'anatomy:human_male',
  slots: {
    torso: {
      partType: 'torso',
      preferId: 'anatomy:human_male_torso_muscular',
    },
    head: {
      partType: 'head',
      preferId: 'anatomy:humanoid_head',
    },
  },
  patterns: [
    {
      matches: ['left_arm', 'right_arm'],
      partType: 'arm',
      preferId: 'anatomy:humanoid_arm_muscular',
    },
    {
      matches: ['left_leg', 'right_leg'],
      partType: 'leg',
      preferId: 'anatomy:human_leg_muscular',
    },
  ],
};

// Define muscular male entity inline for testing
const muscularMale = {
  $schema: 'schema://living-narrative-engine/entity-definition.schema.json',
  id: 'test:muscular_male',
  components: {
    'core:name': {
      text: 'Muscular Male',
    },
    'anatomy:body': {
      recipeId: 'test:muscular_male_recipe',
    },
  },
};

describe('Muscular Male Anatomy Generation Integration Test', () => {
  let testBed;
  let entityManager;
  let anatomyGenerationService;

  beforeEach(() => {
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
      'descriptors:build': buildComponent,
      'descriptors:size_category': sizeCategoryComponent,
      'descriptors:size_specific': sizeSpecificComponent,
      'descriptors:firmness': firmnessComponent,
      'descriptors:weight_feel': weightFeelComponent,
      'descriptors:texture': textureComponent,
      'descriptors:shape_general': shapeGeneralComponent,
      'descriptors:shape_eye': shapeEyeComponent,
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
      'anatomy:vital_organ': vitalOrganComponent,
      'anatomy:part_health': partHealthComponent,
      'anatomy:damage_propagation': damagePropagationComponent,
    });

    // Load entity definitions
    testBed.loadEntityDefinitions({
      'anatomy:blueprint_slot': blueprintSlot,
      'anatomy:human_male_torso': humanMaleTorso,
      'anatomy:human_male_torso_muscular': humanMaleTorsoMuscular,
      'anatomy:humanoid_arm': humanoidArm,
      'anatomy:humanoid_arm_muscular': humanoidArmMuscular,
      'anatomy:humanoid_head': humanoidHead,
      'anatomy:human_leg': humanLeg,
      'anatomy:human_leg_muscular': humanLegMuscular,
      'anatomy:human_leg_shapely': humanLegShapely,
      'anatomy:humanoid_ear': humanoidEar,
      'anatomy:humanoid_nose': humanoidNose,
      'anatomy:humanoid_mouth': humanoidMouth,
      'anatomy:humanoid_teeth': humanoidTeeth,
      'anatomy:human_penis': humanPenis,
      'anatomy:human_testicle': humanTesticle,
      'anatomy:human_hand': humanHand,
      'anatomy:human_foot': humanFoot,
      'anatomy:human_asshole': humanAsshole,
      'anatomy:human_ass_cheek': humanAssCheek,
      'anatomy:human_eye_blue': humanEyeBlue,
      'anatomy:human_eye_brown': humanEyeBrown,
      'anatomy:human_eye_cobalt': humanEyeCobalt,
      'anatomy:human_eye_green': humanEyeGreen,
      'anatomy:human_hair': humanHair,
      'anatomy:human_hair_raven': humanHairRaven,
      'anatomy:human_hair_blonde': humanHairBlonde,
      'anatomy:human_pubic_hair': humanPubicHair,
      'anatomy:human_heart': humanHeart,
      'anatomy:human_brain': humanBrain,
      'anatomy:human_spine': humanSpine,
      'anatomy:human_lung_left': humanLungLeft,
      'anatomy:human_lung_right': humanLungRight,
      'test:muscular_male': muscularMale,
    });

    // Load slot libraries
    testBed.loadSlotLibraries({
      'anatomy:humanoid_slots': humanoidSlotLibrary,
    });

    // Load blueprint parts
    testBed.loadBlueprintParts({
      'anatomy:humanoid_core': humanoidCorePart,
    });

    // Load blueprints
    testBed.loadBlueprints({
      'anatomy:human_male': humanMaleBlueprint,
    });

    // Load recipes
    testBed.loadRecipes({
      'test:muscular_male_recipe': muscularMaleRecipe,
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('should generate anatomy for muscular male with muscular torso, arms, and legs', async () => {
    // Create muscular male entity
    const muscularEntity =
      await entityManager.createEntityInstance('test:muscular_male');
    expect(muscularEntity).toBeDefined();
    expect(muscularEntity.id).toBeDefined();

    // Verify he has the anatomy:body component with the correct recipe
    const anatomyBodyData = entityManager.getComponentData(
      muscularEntity.id,
      ANATOMY_BODY_COMPONENT_ID
    );
    expect(anatomyBodyData).toBeDefined();
    expect(anatomyBodyData.recipeId).toBe('test:muscular_male_recipe');

    // Generate anatomy
    const wasGenerated = await anatomyGenerationService.generateAnatomyIfNeeded(
      muscularEntity.id
    );
    expect(wasGenerated).toBe(true);

    // Get updated anatomy data
    const generatedBody = entityManager.getComponentData(
      muscularEntity.id,
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

    // Test 1: Verify muscular torso
    const torsos = findPartsByType('torso');
    expect(torsos.length).toBe(1); // Should have exactly 1 torso

    const torsoBuild = getPartComponent(torsos[0], 'descriptors:build');
    expect(torsoBuild).toBeDefined();
    expect(torsoBuild.build).toBe('muscular');

    // Test 2: Verify muscular arms
    const arms = findPartsByType('arm');
    expect(arms.length).toBe(2); // Should have exactly 2 arms

    for (const armId of arms) {
      const armBuild = getPartComponent(armId, 'descriptors:build');
      expect(armBuild).toBeDefined();
      expect(armBuild.build).toBe('muscular');
    }

    // Test 3: Verify muscular legs
    const legs = findPartsByType('leg');
    expect(legs.length).toBe(2); // Should have exactly 2 legs

    for (const legId of legs) {
      const legBuild = getPartComponent(legId, 'descriptors:build');
      expect(legBuild).toBeDefined();
      expect(legBuild.build).toBe('muscular');
    }

    // Test 4: Verify all parts are properly connected
    for (const partId of allParts) {
      if (partId === generatedBody.body.root) continue; // Root doesn't have a joint

      const joint = getPartComponent(partId, 'anatomy:joint');
      expect(joint).toBeDefined();
      expect(joint.parentId).toBeDefined();
      expect(joint.socketId).toBeDefined();

      // Verify parent exists in the anatomy
      expect(allParts).toContain(joint.parentId);
    }

    // Test 5: Verify the torso is the root
    const rootId = generatedBody.body.root;
    const rootPart = getPartComponent(rootId, 'anatomy:part');
    expect(rootPart).toBeDefined();
    expect(rootPart.subType).toBe('torso');
  });

  it('recipe should properly specify muscular build for torso, arms, and legs', () => {
    // Get the recipe from the registry
    const recipe = testBed.registry.get(
      'anatomyRecipes',
      'test:muscular_male_recipe'
    );
    expect(recipe).toBeDefined();
    expect(recipe.blueprintId).toBe('anatomy:human_male');

    // Verify torso slot uses muscular variant
    expect(recipe.slots.torso).toBeDefined();
    expect(recipe.slots.torso.preferId).toBe(
      'anatomy:human_male_torso_muscular'
    );

    // Verify patterns for arms and legs
    expect(recipe.patterns).toBeDefined();
    expect(recipe.patterns.length).toBe(2);

    // Find arm pattern
    const armPattern = recipe.patterns.find((p) =>
      p.matches.includes('left_arm')
    );
    expect(armPattern).toBeDefined();
    expect(armPattern.matches).toContain('left_arm');
    expect(armPattern.matches).toContain('right_arm');
    expect(armPattern.preferId).toBe('anatomy:humanoid_arm_muscular');

    // Find leg pattern
    const legPattern = recipe.patterns.find((p) =>
      p.matches.includes('left_leg')
    );
    expect(legPattern).toBeDefined();
    expect(legPattern.matches).toContain('left_leg');
    expect(legPattern.matches).toContain('right_leg');
    expect(legPattern.preferId).toBe('anatomy:human_leg_muscular');
  });
});
