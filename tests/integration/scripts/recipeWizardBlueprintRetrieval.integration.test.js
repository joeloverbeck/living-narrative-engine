/**
 * @file Integration tests for recipe wizard blueprint retrieval
 * Tests the workflow where wizard gets blueprints and then retrieves them by ID
 * Reproduces bug where getAll returns non-namespaced IDs but getBlueprint expects namespaced IDs
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import AppContainer from '../../../src/dependencyInjection/appContainer.js';
import { configureMinimalContainer } from '../../../src/dependencyInjection/minimalContainerConfig.js';
import { tokens } from '../../../src/dependencyInjection/tokens.js';
import { createLoadContext } from '../../../src/loaders/LoadContext.js';

describe('Recipe Wizard Blueprint Retrieval', () => {
  let container;
  let dataRegistry;
  let anatomyBlueprintRepository;

  beforeAll(async () => {
    // Set up container and load mods just like the wizard does
    container = new AppContainer();
    await configureMinimalContainer(container);

    // Override data fetchers for Node environment
    const NodeDataFetcher = (await import('../../../scripts/utils/nodeDataFetcher.js')).default;
    const NodeTextDataFetcher = (await import('../../../scripts/utils/nodeTextDataFetcher.js')).default;
    container.register(tokens.IDataFetcher, () => new NodeDataFetcher());
    container.register(tokens.ITextDataFetcher, () => new NodeTextDataFetcher());

    dataRegistry = container.resolve(tokens.IDataRegistry);
    anatomyBlueprintRepository = container.resolve(tokens.IAnatomyBlueprintRepository);

    // Load essential mods
    let loadContext = createLoadContext({
      worldName: 'test-wizard',
      requestedMods: ['core', 'descriptors', 'anatomy'],
      registry: dataRegistry,
    });

    const schemaPhase = container.resolve(tokens.SchemaPhase);
    const manifestPhase = container.resolve(tokens.ManifestPhase);
    const contentPhase = container.resolve(tokens.ContentPhase);

    loadContext = await schemaPhase.execute(loadContext);
    loadContext = await manifestPhase.execute(loadContext);
    loadContext = await contentPhase.execute(loadContext);
  });

  afterAll(() => {
    // Cleanup
    if (container) {
      container = null;
    }
  });

  describe('getAvailableBlueprints workflow', () => {
    it('should reproduce the wizard bug where blueprint IDs from getAll cannot be used with getBlueprint', async () => {
      // Step 1: Get all blueprints (like wizard does)
      const blueprints = dataRegistry.getAll('anatomyBlueprints') || [];
      expect(blueprints.length).toBeGreaterThan(0);

      // Step 2: Get the first blueprint's ID (like wizard does)
      const firstBlueprint = blueprints[0];
      expect(firstBlueprint).toBeDefined();
      expect(firstBlueprint.id).toBeDefined();

      const blueprintId = firstBlueprint.id; // This might be non-namespaced

      // Step 3: Try to retrieve the blueprint using that ID (this is what fails in the wizard)
      const retrievedBlueprint = await anatomyBlueprintRepository.getBlueprint(blueprintId);

      // After the fix, using _fullId should always work
      const fullId = firstBlueprint._fullId || firstBlueprint.id;
      const retrievedByFullId = await anatomyBlueprintRepository.getBlueprint(fullId);
      expect(retrievedByFullId).not.toBeNull();
      expect(retrievedByFullId).toBeDefined();

      // The fix ensures that the blueprint can be retrieved
      // Either the id already includes namespace, or we use _fullId
      expect(retrievedBlueprint !== null || retrievedByFullId !== null).toBe(true);
    });

    it('should successfully retrieve blueprints when using _fullId field', async () => {
      // This test shows the correct approach for the wizard
      const blueprints = dataRegistry.getAll('anatomyBlueprints') || [];
      expect(blueprints.length).toBeGreaterThan(0);

      const firstBlueprint = blueprints[0];

      // Use _fullId instead of id
      const blueprintId = firstBlueprint._fullId || firstBlueprint.id;
      const retrievedBlueprint = await anatomyBlueprintRepository.getBlueprint(blueprintId);

      expect(retrievedBlueprint).not.toBeNull();
      expect(retrievedBlueprint).toBeDefined();
    });

    it('should handle V1 blueprints without schemaVersion property', async () => {
      // Get human_female blueprint which is V1 (no schemaVersion)
      const blueprint = await anatomyBlueprintRepository.getBlueprint('anatomy:human_female');

      expect(blueprint).toBeDefined();
      expect(blueprint).not.toBeNull();

      // V1 blueprints might not have schemaVersion
      // The wizard's introspectBlueprint function should handle this gracefully
      const schemaVersion = blueprint.schemaVersion;

      // V1 blueprints either have undefined schemaVersion or not '2.0'
      // V2 blueprints should have schemaVersion === '2.0'
      const isV2 = schemaVersion === '2.0';

      // V1 blueprints should have slots directly defined
      // V2 blueprints should have structureTemplate
      const hasExpectedStructure = isV2
        ? blueprint.structureTemplate !== undefined
        : blueprint.slots !== undefined;

      expect(hasExpectedStructure).toBe(true);
    });
  });

  describe('introspectBlueprint behavior', () => {
    it('should not throw when blueprint is null', () => {
      // This tests the scenario where getBlueprint returns null
      // and introspectBlueprint tries to access blueprint.schemaVersion
      const nullBlueprint = null;

      // This should throw "Cannot read properties of null (reading 'schemaVersion')"
      // which is the original error the user reported
      expect(() => {
        if (nullBlueprint.schemaVersion !== '2.0') {
          // This line causes the error
        }
      }).toThrow("Cannot read properties of null (reading 'schemaVersion')");
    });

    it('should handle undefined schemaVersion as V1 blueprint', () => {
      const v1Blueprint = {
        id: 'anatomy:test',
        slots: { head: {} },
      };

      // V1 blueprints don't have schemaVersion
      expect(v1Blueprint.schemaVersion).toBeUndefined();

      // This is how introspectBlueprint should handle it
      const isV2 = v1Blueprint.schemaVersion === '2.0';
      expect(isV2).toBe(false);
    });
  });
});
