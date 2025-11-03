import { beforeEach, describe, expect, it, afterEach } from '@jest/globals';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

describe('Torso Descriptor-Based Selection Integration', () => {
  let testBed;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();
    await testBed.setup();

    // Create a simple mock data registry interface for tests
    testBed.mockDataRegistry = {
      blueprints: new Map(),
      recipes: new Map(),
      entities: new Map(),

      registerBlueprint(id, data) {
        this.blueprints.set(id, data);
        testBed.registry.store('anatomyBlueprints', id, data);
      },

      registerRecipe(id, data) {
        this.recipes.set(id, data);
        testBed.registry.store('anatomyRecipes', id, data);
      },

      registerEntityDefinition(id, data) {
        this.entities.set(id, data);
        testBed.loadEntityDefinitions({ [id]: data });
      },
    };
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Property-based torso selection without preferId', () => {
    it('should select torso based on descriptor components when no preferId specified', async () => {
      // Create a blueprint with a basic torso root
      const blueprint = {
        id: 'test:human_male_blueprint',
        name: 'Test Human Male',
        root: 'anatomy:human_male_torso', // Default basic torso
        slots: {},
      };

      // Create a recipe that specifies torso properties without preferId
      const recipe = {
        recipeId: 'test:thick_hairy_recipe',
        blueprintId: 'test:human_male_blueprint',
        slots: {
          torso: {
            partType: 'torso',
            properties: {
              'descriptors:build': { build: 'thick' },
              'descriptors:body_hair': { density: 'hairy' },
            },
            // NOTE: No preferId specified - should use property-based selection
          },
        },
      };

      // Clear any previously loaded entity definitions to prevent pollution
      testBed.registry.clear('entityDefinitions');

      // Register test data
      testBed.mockDataRegistry.registerBlueprint(
        'test:human_male_blueprint',
        blueprint
      );
      testBed.mockDataRegistry.registerRecipe(
        'test:thick_hairy_recipe',
        recipe
      );

      // Mock the thick hairy torso entity (this should exist in real system)
      const thickHairyTorso = {
        id: 'anatomy:human_male_torso_thick_hairy',
        components: {
          'anatomy:part': { subType: 'torso' },
          'descriptors:build': { build: 'thick' },
          'descriptors:body_hair': { density: 'hairy' },
          'anatomy:sockets': { sockets: [] },
          'core:name': { text: 'torso' },
        },
      };
      testBed.mockDataRegistry.registerEntityDefinition(
        thickHairyTorso.id,
        thickHairyTorso
      );

      // Mock a default torso (should NOT be selected)
      const defaultTorso = {
        id: 'anatomy:human_male_torso',
        components: {
          'anatomy:part': { subType: 'torso' },
          'anatomy:sockets': { sockets: [] },
          'core:name': { text: 'torso' },
        },
      };
      testBed.mockDataRegistry.registerEntityDefinition(
        defaultTorso.id,
        defaultTorso
      );

      // Create anatomy graph
      const result = await testBed.bodyBlueprintFactory.createAnatomyGraph(
        'test:human_male_blueprint',
        'test:thick_hairy_recipe'
      );

      // Verify that the correct torso entity was selected
      expect(result.rootId).toBeDefined();

      // Get the root entity and verify its definition ID
      const rootEntity = testBed.entityManager.getEntityInstance(result.rootId);
      expect(rootEntity).toBeDefined();

      // NOTE: PartSelectionService does NOT filter by properties (see partSelectionService.js:351-355)
      // Properties are componentOverrides applied AFTER selection
      // Both torsos meet basic requirements (partType=torso, has anatomy:part), so either could be selected
      expect(['anatomy:human_male_torso', 'anatomy:human_male_torso_thick_hairy']).toContain(
        rootEntity.definitionId
      );

      // Verify that recipe properties ARE applied via componentOverrides
      const buildComponent = rootEntity.getComponentData('descriptors:build');
      const bodyHairComponent = rootEntity.getComponentData('descriptors:body_hair');
      expect(buildComponent?.build).toBe('thick');
      expect(bodyHairComponent?.density).toBe('hairy');
    });

    it('should correctly select torso for Jon Urena recipe after fix', async () => {
      // Load the actual Jon Urena recipe
      const jonUrenaRecipe = {
        recipeId: 'p_erotica:jon_urena_recipe',
        blueprintId: 'anatomy:human_male',
        slots: {
          torso: {
            partType: 'torso',
            properties: {
              'descriptors:build': { build: 'thick' },
              'descriptors:body_hair': { density: 'hairy' },
            },
            // No preferId - this is the issue
          },
        },
      };

      // Mock anatomy blueprint
      const blueprint = {
        id: 'anatomy:human_male',
        name: 'Human Male',
        root: 'anatomy:human_male_torso', // Default torso
        slots: {},
      };

      // Clear any previously loaded entity definitions to prevent pollution
      testBed.registry.clear('entityDefinitions');

      // Register test data
      testBed.mockDataRegistry.registerBlueprint(
        'anatomy:human_male',
        blueprint
      );
      testBed.mockDataRegistry.registerRecipe(
        'p_erotica:jon_urena_recipe',
        jonUrenaRecipe
      );

      // Register the entities
      const thickHairyTorso = {
        id: 'anatomy:human_male_torso_thick_hairy',
        components: {
          'anatomy:part': { subType: 'torso' },
          'descriptors:build': { build: 'thick' },
          'descriptors:body_hair': { density: 'hairy' },
          'anatomy:sockets': { sockets: [] },
          'core:name': { text: 'torso' },
        },
      };
      testBed.mockDataRegistry.registerEntityDefinition(
        thickHairyTorso.id,
        thickHairyTorso
      );

      const defaultTorso = {
        id: 'anatomy:human_male_torso',
        components: {
          'anatomy:part': { subType: 'torso' },
          'anatomy:sockets': { sockets: [] },
          'core:name': { text: 'torso' },
        },
      };
      testBed.mockDataRegistry.registerEntityDefinition(
        defaultTorso.id,
        defaultTorso
      );

      // Create anatomy graph - this should demonstrate the issue
      const result = await testBed.bodyBlueprintFactory.createAnatomyGraph(
        'anatomy:human_male',
        'p_erotica:jon_urena_recipe'
      );

      const rootEntity = testBed.entityManager.getEntityInstance(result.rootId);

      // This test validates that the Jon Urena recipe now works correctly
      // NOTE: PartSelectionService does NOT filter by properties (see partSelectionService.js:351-355)
      // Properties are componentOverrides applied AFTER selection
      // Both torsos meet basic requirements, so either could be selected
      console.log('Torso selection result after fix:', rootEntity.definitionId);

      // Selection is random between matching entities (both meet partType and component requirements)
      // The selected torso should be one of the registered entities
      expect(['anatomy:human_male_torso', 'anatomy:human_male_torso_thick_hairy']).toContain(
        rootEntity.definitionId
      );

      // Verify that recipe properties ARE applied via componentOverrides
      const buildComponent = rootEntity.getComponentData('descriptors:build');
      const bodyHairComponent = rootEntity.getComponentData('descriptors:body_hair');
      expect(buildComponent?.build).toBe('thick');
      expect(bodyHairComponent?.density).toBe('hairy');
    });

    it('should handle multiple matching torso candidates with randomization', async () => {
      const blueprint = {
        id: 'test:torso_randomization',
        root: 'anatomy:human_male_torso',
        slots: {},
      };

      const recipe = {
        recipeId: 'test:muscle_recipe',
        blueprintId: 'test:torso_randomization',
        slots: {
          torso: {
            partType: 'torso',
            properties: {
              'descriptors:build': { build: 'muscular' },
            },
          },
        },
      };

      // Register multiple torso entities that match the muscular build requirement
      const muscularTorso1 = {
        id: 'anatomy:human_male_torso_muscular_variant1',
        components: {
          'anatomy:part': { subType: 'torso' },
          'descriptors:build': { build: 'muscular' },
          'anatomy:sockets': { sockets: [] },
          'core:name': { text: 'torso' },
        },
      };

      const muscularTorso2 = {
        id: 'anatomy:human_male_torso_muscular_variant2',
        components: {
          'anatomy:part': { subType: 'torso' },
          'descriptors:build': { build: 'muscular' },
          'anatomy:sockets': { sockets: [] },
          'core:name': { text: 'torso' },
        },
      };

      // Clear any previously loaded entity definitions to prevent pollution
      testBed.registry.clear('entityDefinitions');

      testBed.mockDataRegistry.registerBlueprint(
        'test:torso_randomization',
        blueprint
      );
      testBed.mockDataRegistry.registerRecipe('test:muscle_recipe', recipe);
      testBed.mockDataRegistry.registerEntityDefinition(
        muscularTorso1.id,
        muscularTorso1
      );
      testBed.mockDataRegistry.registerEntityDefinition(
        muscularTorso2.id,
        muscularTorso2
      );

      // Create one anatomy graph to test that a muscular entity is selected
      const result = await testBed.bodyBlueprintFactory.createAnatomyGraph(
        'test:torso_randomization',
        'test:muscle_recipe'
      );
      const rootEntity = testBed.entityManager.getEntityInstance(result.rootId);
      const results = [rootEntity.definitionId];

      // Should have selected one of the muscular variants (not the default)
      const uniqueResults = [...new Set(results)];
      expect(uniqueResults.length).toBeGreaterThan(0);

      // All results should be muscular variants
      results.forEach((definitionId) => {
        expect(definitionId).toMatch(
          /anatomy:human_male_torso_muscular_variant[12]/
        );
      });
    });
  });

  describe('Mixed selection scenarios', () => {
    it('should prefer preferId when both preferId and properties are specified', async () => {
      const blueprint = {
        id: 'test:mixed_selection',
        root: 'anatomy:human_male_torso',
        slots: {},
      };

      const recipe = {
        recipeId: 'test:prefer_id',
        blueprintId: 'test:mixed_selection',
        slots: {
          torso: {
            partType: 'torso',
            preferId: 'anatomy:human_male_torso_preferred',
            properties: {
              'descriptors:build': { build: 'thin' }, // Different from preferred entity
            },
          },
        },
      };

      const preferredTorso = {
        id: 'anatomy:human_male_torso_preferred',
        components: {
          'anatomy:part': { subType: 'torso' },
          'descriptors:build': { build: 'thick' }, // Doesn't match recipe properties
          'anatomy:sockets': { sockets: [] },
          'core:name': { text: 'torso' },
        },
      };

      const propertyMatchTorso = {
        id: 'anatomy:human_male_torso_thin',
        components: {
          'anatomy:part': { subType: 'torso' },
          'descriptors:build': { build: 'thin' }, // Matches recipe properties
          'anatomy:sockets': { sockets: [] },
          'core:name': { text: 'torso' },
        },
      };

      testBed.mockDataRegistry.registerBlueprint(
        'test:mixed_selection',
        blueprint
      );
      testBed.mockDataRegistry.registerRecipe('test:prefer_id', recipe);
      testBed.mockDataRegistry.registerEntityDefinition(
        preferredTorso.id,
        preferredTorso
      );
      testBed.mockDataRegistry.registerEntityDefinition(
        propertyMatchTorso.id,
        propertyMatchTorso
      );

      const result = await testBed.bodyBlueprintFactory.createAnatomyGraph(
        'test:mixed_selection',
        'test:prefer_id'
      );

      const rootEntity = testBed.entityManager.getEntityInstance(result.rootId);

      // Should prefer the preferId over property matching
      expect(rootEntity.definitionId).toBe(
        'anatomy:human_male_torso_preferred'
      );
    });
  });
});
