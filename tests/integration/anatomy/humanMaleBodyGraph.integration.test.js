/**
 * @file Integration test for complete anatomy generation of human male body graph
 */

import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
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
import sizeCategoryComponent from '../../../data/mods/descriptors/components/size_category.component.json';
import shapeGeneralComponent from '../../../data/mods/descriptors/components/shape_general.component.json';

// Import entity definitions
import humanoidArm from '../../../data/mods/anatomy/entities/definitions/humanoid_arm.entity.json';
import humanoidHead from '../../../data/mods/anatomy/entities/definitions/humanoid_head.entity.json';
import humanoidLeg from '../../../data/mods/anatomy/entities/definitions/human_leg.entity.json';
import humanoidEar from '../../../data/mods/anatomy/entities/definitions/humanoid_ear.entity.json';
import humanoidNose from '../../../data/mods/anatomy/entities/definitions/humanoid_nose.entity.json';
import humanoidMouth from '../../../data/mods/anatomy/entities/definitions/humanoid_mouth.entity.json';
import humanoidTeeth from '../../../data/mods/anatomy/entities/definitions/humanoid_teeth.entity.json';
import humanPenis from '../../../data/mods/anatomy/entities/definitions/human_penis.entity.json';
import humanTesticle from '../../../data/mods/anatomy/entities/definitions/human_testicle.entity.json';
import humanHair from '../../../data/mods/anatomy/entities/definitions/human_hair.entity.json';
import humanPubicHair from '../../../data/mods/anatomy/entities/definitions/human_pubic_hair.entity.json';
import humanMaleTorso from '../../../data/mods/anatomy/entities/definitions/human_male_torso.entity.json';
import humanEye from '../../../data/mods/anatomy/entities/definitions/human_eye_brown.entity.json';
import humanAsshole from '../../../data/mods/anatomy/entities/definitions/human_asshole.entity.json';
import humanAssCheek from '../../../data/mods/anatomy/entities/definitions/human_ass_cheek.entity.json';
import humanHand from '../../../data/mods/anatomy/entities/definitions/human_hand.entity.json';
import humanFoot from '../../../data/mods/anatomy/entities/definitions/human_foot.entity.json';
import blueprintSlot from '../../../data/mods/anatomy/entities/definitions/blueprint_slot.entity.json';
import humanMaleBlueprint from '../../../data/mods/anatomy/blueprints/human_male.blueprint.json';
import humanMaleRecipe from '../../../data/mods/anatomy/recipes/human_male.recipe.json';
import humanoidCore from '../../../data/mods/anatomy/parts/humanoid_core.part.json';
import humanoidSlotLibrary from '../../../data/mods/anatomy/libraries/humanoid.slot-library.json';
import humanHeart from '../../../data/mods/anatomy/entities/definitions/human_heart.entity.json';
import humanBrain from '../../../data/mods/anatomy/entities/definitions/human_brain.entity.json';
import humanSpine from '../../../data/mods/anatomy/entities/definitions/human_spine.entity.json';
import humanLungLeft from '../../../data/mods/anatomy/entities/definitions/human_lung_left.entity.json';
import humanLungRight from '../../../data/mods/anatomy/entities/definitions/human_lung_right.entity.json';

// Import core components needed for anatomy
import nameComponent from '../../../data/mods/core/components/name.component.json';
import descriptionComponent from '../../../data/mods/core/components/description.component.json';

// Define test entity for human male
const testHumanMale = {
  $schema: 'schema://living-narrative-engine/entity-definition.schema.json',
  id: 'test:human_male',
  description: 'Test human male for body graph verification',
  components: {
    'core:name': {
      text: 'Test Human Male',
    },
    'core:description': {
      description: 'A test entity for verifying human male anatomy generation.',
    },
    'anatomy:body': {
      recipeId: 'anatomy:human_male',
    },
  },
};

describe('Human Male Body Graph Integration Test', () => {
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
      'descriptors:shape_general': shapeGeneralComponent,
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
      'anatomy:humanoid_arm': humanoidArm,
      'anatomy:humanoid_head': humanoidHead,
      'anatomy:humanoid_leg': humanoidLeg,
      'anatomy:humanoid_ear': humanoidEar,
      'anatomy:humanoid_nose': humanoidNose,
      'anatomy:humanoid_mouth': humanoidMouth,
      'anatomy:humanoid_teeth': humanoidTeeth,
      'anatomy:human_penis': humanPenis,
      'anatomy:human_testicle': humanTesticle,
      'anatomy:human_hair': humanHair,
      'anatomy:human_pubic_hair': humanPubicHair,
      'anatomy:human_male_torso': humanMaleTorso,
      'anatomy:human_eye_brown': humanEye,
      'anatomy:human_asshole': humanAsshole,
      'anatomy:human_ass_cheek': humanAssCheek,
      'anatomy:human_hand': humanHand,
      'anatomy:human_foot': humanFoot,
      'anatomy:blueprint_slot': blueprintSlot,
      'anatomy:human_heart': humanHeart,
      'anatomy:human_brain': humanBrain,
      'anatomy:human_spine': humanSpine,
      'anatomy:human_lung_left': humanLungLeft,
      'anatomy:human_lung_right': humanLungRight,
      'test:human_male': testHumanMale,
    });

    // Load slot libraries
    testBed.loadSlotLibraries({
      'anatomy:humanoid_slots': humanoidSlotLibrary,
    });

    // Load blueprint parts
    testBed.loadBlueprintParts({
      'anatomy:humanoid_core': humanoidCore,
    });

    // Load blueprints
    testBed.loadBlueprints({
      'anatomy:human_male': humanMaleBlueprint,
    });

    // Load recipes
    testBed.loadRecipes({
      'anatomy:human_male': humanMaleRecipe,
    });
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  it('should generate complete anatomy for human male with all required body parts', async () => {
    // Create test entity
    const maleEntity =
      await entityManager.createEntityInstance('test:human_male');
    expect(maleEntity).toBeDefined();
    expect(maleEntity.id).toBeDefined();

    // Verify anatomy:body component with correct recipe
    const anatomyBodyData = entityManager.getComponentData(
      maleEntity.id,
      ANATOMY_BODY_COMPONENT_ID
    );
    expect(anatomyBodyData).toBeDefined();
    expect(anatomyBodyData.recipeId).toBe('anatomy:human_male');

    // Generate anatomy
    const wasGenerated = await anatomyGenerationService.generateAnatomyIfNeeded(
      maleEntity.id
    );
    expect(wasGenerated).toBe(true);

    // Get updated anatomy data
    const generatedBody = entityManager.getComponentData(
      maleEntity.id,
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

    // Verify all required body parts exist with correct counts
    const expectedParts = {
      head: 1,
      arm: 2,
      hand: 2,
      leg: 2,
      foot: 2,
      eye: 2,
      ear: 2,
      nose: 1,
      mouth: 1,
      teeth: 1,
      penis: 1,
      testicle: 2,
      asshole: 1,
    };

    for (const [partType, expectedCount] of Object.entries(expectedParts)) {
      const parts = findPartsByType(partType);
      expect(parts.length).toBe(
        expectedCount,
        `Expected ${expectedCount} ${partType}(s), but found ${parts.length}`
      );
    }

    // Verify hair separately (1 scalp hair on head, may have pubic hair)
    const allHair = findPartsByType('hair');
    const scalpHair = allHair.filter((hairId) => {
      const joint = entityManager.getComponentData(hairId, 'anatomy:joint');
      const heads = findPartsByType('head');
      return joint && joint.parentId === heads[0];
    });
    expect(scalpHair.length).toBe(1, 'Expected 1 scalp hair attached to head');

    // Verify hands are attached to arms
    const arms = findPartsByType('arm');
    const hands = findPartsByType('hand');

    for (const handId of hands) {
      const joint = entityManager.getComponentData(handId, 'anatomy:joint');
      expect(joint).toBeDefined();
      expect(joint.socketId).toBe('wrist');
      expect(arms).toContain(joint.parentId);
    }

    // Verify teeth are attached to mouth
    const mouths = findPartsByType('mouth');
    const teeth = findPartsByType('teeth');

    for (const teethId of teeth) {
      const joint = entityManager.getComponentData(teethId, 'anatomy:joint');
      expect(joint).toBeDefined();
      expect(joint.socketId).toBe('teeth');
      expect(mouths).toContain(joint.parentId);
    }

    // Verify feet are attached to legs
    const legs = findPartsByType('leg');
    const feet = findPartsByType('foot');

    for (const footId of feet) {
      const joint = entityManager.getComponentData(footId, 'anatomy:joint');
      expect(joint).toBeDefined();
      expect(joint.socketId).toBe('ankle');
      expect(legs).toContain(joint.parentId);
    }

    // Verify all parts have proper parent-child relationships
    for (const partId of allParts) {
      if (partId === generatedBody.body.root) continue; // Root doesn't have a joint

      const joint = entityManager.getComponentData(partId, 'anatomy:joint');
      expect(joint).toBeDefined();
      expect(joint.parentId).toBeDefined();
      expect(joint.socketId).toBeDefined();

      // Verify parent exists in the anatomy
      expect(allParts).toContain(joint.parentId);
    }

    // Verify specific attachments
    const heads = findPartsByType('head');
    const headId = heads[0];

    // Get all parts attached to the head
    const headChildren = allParts.filter((partId) => {
      const joint = entityManager.getComponentData(partId, 'anatomy:joint');
      return joint && joint.parentId === headId;
    });

    // Count specific child types of head
    const headChildTypes = {};
    for (const childId of headChildren) {
      const part = entityManager.getComponentData(childId, 'anatomy:part');
      if (part && part.subType) {
        headChildTypes[part.subType] = (headChildTypes[part.subType] || 0) + 1;
      }
    }

    expect(headChildTypes.eye).toBe(2);
    expect(headChildTypes.ear).toBe(2);
    expect(headChildTypes.nose).toBe(1);
    expect(headChildTypes.mouth).toBe(1);
    expect(headChildTypes.hair).toBe(1);

    // Verify torso has correct attachments
    const torsoId = generatedBody.body.root;
    const torsoChildren = allParts.filter((partId) => {
      const joint = entityManager.getComponentData(partId, 'anatomy:joint');
      return joint && joint.parentId === torsoId;
    });

    const torsoChildTypes = {};
    for (const childId of torsoChildren) {
      const part = entityManager.getComponentData(childId, 'anatomy:part');
      if (part && part.subType) {
        torsoChildTypes[part.subType] =
          (torsoChildTypes[part.subType] || 0) + 1;
      }
    }

    expect(torsoChildTypes.head).toBe(1);
    expect(torsoChildTypes.arm).toBe(2);
    expect(torsoChildTypes.leg).toBe(2);
    expect(torsoChildTypes.penis).toBe(1);
    expect(torsoChildTypes.testicle).toBe(2);
    expect(torsoChildTypes.asshole).toBe(1);

    // Verify specific male anatomy characteristics
    const penis = findPartsByType('penis');
    expect(penis.length).toBe(1);
    const penisData = entityManager.getComponentData(
      penis[0],
      'descriptors:size_category'
    );
    expect(penisData).toBeDefined();
    expect(penisData.size).toBe('medium');

    const testicles = findPartsByType('testicle');
    expect(testicles.length).toBe(2);
  });
});
