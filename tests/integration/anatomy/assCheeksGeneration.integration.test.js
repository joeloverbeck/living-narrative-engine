/**
 * @file Integration test for ass cheek generation in anatomy system
 */

import { describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';

// Import anatomy mod data directly
import bodyComponent from '../../../data/mods/anatomy/components/body.component.json';
import jointComponent from '../../../data/mods/anatomy/components/joint.component.json';
import partComponent from '../../../data/mods/anatomy/components/part.component.json';
import socketsComponent from '../../../data/mods/anatomy/components/sockets.component.json';

// Import entity definitions
import humanFemaleTorso from '../../../data/mods/anatomy/entities/definitions/human_female_torso.entity.json';
import humanMaleTorso from '../../../data/mods/anatomy/entities/definitions/human_male_torso.entity.json';
import humanAssCheek from '../../../data/mods/anatomy/entities/definitions/human_ass_cheek.entity.json';

// Import core components needed for anatomy
import nameComponent from '../../../data/mods/core/components/name.component.json';
import descriptionComponent from '../../../data/mods/core/components/description.component.json';

// Import blueprint and recipe data
import humanFemaleBlueprint from '../../../data/mods/anatomy/blueprints/human_female.blueprint.json';
import humanMaleBlueprint from '../../../data/mods/anatomy/blueprints/human_male.blueprint.json';
import humanFemaleRecipe from '../../../data/mods/anatomy/recipes/human_female.recipe.json';
import humanMaleRecipe from '../../../data/mods/anatomy/recipes/human_male.recipe.json';
import humanoidSlotLibrary from '../../../data/mods/anatomy/libraries/humanoid.slot-library.json';
import humanoidCorePart from '../../../data/mods/anatomy/parts/humanoid_core.part.json';

// Define test entity for human female
const testHumanFemale = {
  $schema: 'schema://living-narrative-engine/entity-definition.schema.json',
  id: 'test:human_female',
  description: 'Test human female for ass cheek generation',
  components: {
    'core:name': {
      text: 'Test Female',
    },
    'anatomy:body': {
      blueprint: 'anatomy:human_female',
      recipe: 'anatomy:human_female',
    },
  },
};

// Define test entity for human male
const testHumanMale = {
  $schema: 'schema://living-narrative-engine/entity-definition.schema.json',
  id: 'test:human_male',
  description: 'Test human male for ass cheek generation',
  components: {
    'core:name': {
      text: 'Test Male',
    },
    'anatomy:body': {
      blueprint: 'anatomy:human_male',
      recipe: 'anatomy:human_male',
    },
  },
};

describe('Ass Cheek Generation Integration Tests', () => {
  let testBed;

  beforeEach(() => {
    testBed = new AnatomyIntegrationTestBed();

    // Load core components
    testBed.loadComponents({
      'core:name': nameComponent,
      'core:description': descriptionComponent,
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
      'anatomy:human_female_torso': humanFemaleTorso,
      'anatomy:human_male_torso': humanMaleTorso,
      'anatomy:human_ass_cheek': humanAssCheek,
      'test:human_female': testHumanFemale,
      'test:human_male': testHumanMale,
    });

    // Load slot libraries and parts first (blueprints depend on parts)
    testBed.loadSlotLibraries({
      'anatomy:humanoid_slots': humanoidSlotLibrary,
    });

    testBed.loadBlueprintParts({
      'anatomy:humanoid_core': humanoidCorePart,
    });

    // Load blueprints (depends on parts)
    testBed.loadBlueprints({
      'anatomy:human_female': humanFemaleBlueprint,
      'anatomy:human_male': humanMaleBlueprint,
    });

    testBed.loadRecipes({
      'anatomy:human_female': humanFemaleRecipe,
      'anatomy:human_male': humanMaleRecipe,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Entity Definition Validation', () => {
    it('should validate ass cheek entity definition', () => {
      const assCheekEntity = testBed.getEntityDefinition(
        'anatomy:human_ass_cheek'
      );

      expect(assCheekEntity).toBeDefined();
      expect(assCheekEntity.id).toBe('anatomy:human_ass_cheek');
      expect(assCheekEntity.components['anatomy:part'].subType).toBe(
        'ass_cheek'
      );
      expect(assCheekEntity.components['core:name'].text).toBe('ass cheek');
    });

    it('should validate torso sockets support ass cheeks', () => {
      const femaleTorso = testBed.getEntityDefinition(
        'anatomy:human_female_torso'
      );
      const maleTorso = testBed.getEntityDefinition('anatomy:human_male_torso');

      // Check female torso sockets
      const femaleSockets = femaleTorso.components['anatomy:sockets'].sockets;
      const leftAssSocket = femaleSockets.find((s) => s.id === 'left_ass');
      const rightAssSocket = femaleSockets.find((s) => s.id === 'right_ass');

      expect(leftAssSocket).toBeDefined();
      expect(leftAssSocket.allowedTypes).toContain('ass_cheek');
      expect(leftAssSocket.orientation).toBe('left');

      expect(rightAssSocket).toBeDefined();
      expect(rightAssSocket.allowedTypes).toContain('ass_cheek');
      expect(rightAssSocket.orientation).toBe('right');

      // Check male torso sockets
      const maleSockets = maleTorso.components['anatomy:sockets'].sockets;
      const maleLeftAssSocket = maleSockets.find((s) => s.id === 'left_ass');
      const maleRightAssSocket = maleSockets.find((s) => s.id === 'right_ass');

      expect(maleLeftAssSocket).toBeDefined();
      expect(maleLeftAssSocket.allowedTypes).toContain('ass_cheek');
      expect(maleRightAssSocket).toBeDefined();
      expect(maleRightAssSocket.allowedTypes).toContain('ass_cheek');
    });
  });

  describe('Slot Library Integration', () => {
    it('should include standard_ass_cheek in slot library', () => {
      const slotLib = testBed.getSlotLibrary('anatomy:humanoid_slots');

      expect(slotLib.slotDefinitions.standard_ass_cheek).toBeDefined();
      expect(slotLib.slotDefinitions.standard_ass_cheek.socket).toBe('ass');
      expect(
        slotLib.slotDefinitions.standard_ass_cheek.requirements.partType
      ).toBe('ass_cheek');
      expect(
        slotLib.slotDefinitions.standard_ass_cheek.requirements.components
      ).toContain('anatomy:part');
    });
  });

  describe('Part Integration', () => {
    it('should include ass cheek slots in humanoid core part', () => {
      const humanoidCore = testBed.getPart('anatomy:humanoid_core');

      expect(humanoidCore.slots.left_ass).toBeDefined();
      expect(humanoidCore.slots.left_ass.$use).toBe('standard_ass_cheek');
      expect(humanoidCore.slots.left_ass.socket).toBe('left_ass');

      expect(humanoidCore.slots.right_ass).toBeDefined();
      expect(humanoidCore.slots.right_ass.$use).toBe('standard_ass_cheek');
      expect(humanoidCore.slots.right_ass.socket).toBe('right_ass');
    });
  });

  describe('Component Validation', () => {
    it('should validate the ass cheek architecture components are correctly configured', () => {
      // This test validates that all the required components are properly configured
      // The actual anatomy generation is tested in the broader integration tests

      // 1. Validate entity definition exists and is correct
      const assCheekEntity = testBed.getEntityDefinition(
        'anatomy:human_ass_cheek'
      );
      expect(assCheekEntity).toBeDefined();
      expect(assCheekEntity.components['anatomy:part'].subType).toBe(
        'ass_cheek'
      );

      // 2. Validate slot library includes ass cheek definition
      const slotLib = testBed.getSlotLibrary('anatomy:humanoid_slots');
      expect(slotLib.slotDefinitions.standard_ass_cheek).toBeDefined();
      expect(
        slotLib.slotDefinitions.standard_ass_cheek.requirements.partType
      ).toBe('ass_cheek');

      // 3. Validate humanoid core part includes ass cheek slots
      const humanoidCore = testBed.getPart('anatomy:humanoid_core');
      expect(humanoidCore.slots.left_ass).toBeDefined();
      expect(humanoidCore.slots.right_ass).toBeDefined();
      expect(humanoidCore.slots.left_ass.$use).toBe('standard_ass_cheek');
      expect(humanoidCore.slots.right_ass.$use).toBe('standard_ass_cheek');

      // 4. Validate torso sockets support ass cheeks
      const femaleTorso = testBed.getEntityDefinition(
        'anatomy:human_female_torso'
      );
      const maleTorso = testBed.getEntityDefinition('anatomy:human_male_torso');

      const femaleSockets = femaleTorso.components['anatomy:sockets'].sockets;
      const maleSockets = maleTorso.components['anatomy:sockets'].sockets;

      expect(
        femaleSockets.find((s) => s.id === 'left_ass').allowedTypes
      ).toContain('ass_cheek');
      expect(
        femaleSockets.find((s) => s.id === 'right_ass').allowedTypes
      ).toContain('ass_cheek');
      expect(
        maleSockets.find((s) => s.id === 'left_ass').allowedTypes
      ).toContain('ass_cheek');
      expect(
        maleSockets.find((s) => s.id === 'right_ass').allowedTypes
      ).toContain('ass_cheek');
    });
  });

  describe('Blueprint Inheritance', () => {
    it('should inherit ass cheek slots from humanoid_core part', () => {
      const femaleBlueprint = testBed.getBlueprint('anatomy:human_female');
      const maleBlueprint = testBed.getBlueprint('anatomy:human_male');

      // Verify blueprints have inherited slots from humanoid_core
      // After composition, the slots should be present in the blueprint
      expect(femaleBlueprint.slots.left_ass).toBeDefined();
      expect(femaleBlueprint.slots.right_ass).toBeDefined();
      expect(femaleBlueprint.slots.left_ass.requirements.partType).toBe(
        'ass_cheek'
      );
      expect(femaleBlueprint.slots.right_ass.requirements.partType).toBe(
        'ass_cheek'
      );

      expect(maleBlueprint.slots.left_ass).toBeDefined();
      expect(maleBlueprint.slots.right_ass).toBeDefined();
      expect(maleBlueprint.slots.left_ass.requirements.partType).toBe(
        'ass_cheek'
      );
      expect(maleBlueprint.slots.right_ass.requirements.partType).toBe(
        'ass_cheek'
      );
    });
  });

  describe('Architecture Integration', () => {
    it('should follow complete anatomy system architecture', () => {
      // Test the complete chain: Entity -> Library -> Part -> Blueprint

      // 1. Entity exists
      const assCheekEntity = testBed.getEntityDefinition(
        'anatomy:human_ass_cheek'
      );
      expect(assCheekEntity).toBeDefined();

      // 2. Library definition exists
      const slotLib = testBed.getSlotLibrary('anatomy:humanoid_slots');
      expect(slotLib.slotDefinitions.standard_ass_cheek).toBeDefined();

      // 3. Part references library
      const humanoidCore = testBed.getPart('anatomy:humanoid_core');
      expect(humanoidCore.slots.left_ass).toBeDefined();
      expect(humanoidCore.slots.right_ass).toBeDefined();

      // 4. Blueprint inherits from part
      const femaleBlueprint = testBed.getBlueprint('anatomy:human_female');
      expect(femaleBlueprint.slots.left_ass).toBeDefined();
      expect(femaleBlueprint.slots.right_ass).toBeDefined();
      expect(femaleBlueprint.slots.left_ass.requirements.partType).toBe(
        'ass_cheek'
      );
      expect(femaleBlueprint.slots.right_ass.requirements.partType).toBe(
        'ass_cheek'
      );

      // This validates that all architectural layers are properly connected
      // The actual generation is tested in the broader anatomy integration tests
    });
  });
});
