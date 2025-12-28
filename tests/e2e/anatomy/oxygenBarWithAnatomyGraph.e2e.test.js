/**
 * @file tests/e2e/anatomy/oxygenBarWithAnatomyGraph.e2e.test.js
 * @description E2E tests verifying that oxygen bar appears after full anatomy
 * graph generation. Tests the complete pipeline from recipe-based anatomy
 * creation through to OxygenAggregationService finding respiratory organs.
 *
 * Issue: Oxygen bar doesn't appear for cat folk characters even though lungs
 * appear in anatomy visualizer. Hypothesis: breathing-states:respiratory_organ
 * component from entity definitions may not be properly indexed during entity
 * creation, causing getEntitiesWithComponent() to return empty.
 */

import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
  afterEach,
} from '@jest/globals';
import {
  ANATOMY_BODY_COMPONENT_ID,
  RESPIRATORY_ORGAN_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';
import OxygenAggregationService from '../../../src/anatomy/services/oxygenAggregationService.js';

// Mock console to reduce test output noise
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: originalConsole.error,
};

describe('Oxygen Bar with Anatomy Graph E2E', () => {
  let testBed;
  let entityManager;
  let anatomyGenerationService;
  let oxygenAggregationService;
  let logger;

  beforeEach(async () => {
    testBed = new AnatomyIntegrationTestBed();

    // Clear state
    if (testBed.registry?.clear) {
      testBed.registry.clear();
    }
    if (testBed.entityManager?.clearAll) {
      testBed.entityManager.clearAll();
    }
    if (testBed.bodyGraphService?.clearCache) {
      testBed.bodyGraphService.clearCache();
    }

    entityManager = testBed.getEntityManager();
    anatomyGenerationService = testBed.anatomyGenerationService;
    logger = testBed.mocks.logger;

    // Create OxygenAggregationService with real entityManager
    oxygenAggregationService = new OxygenAggregationService({
      logger,
      entityManager,
    });

    // Load required components - including respiratory_organ
    testBed.loadComponents({
      'anatomy:body': {
        id: 'anatomy:body',
        description: 'Body component for anatomy system',
        dataSchema: {
          type: 'object',
          properties: {
            recipeId: { type: 'string' },
            body: {
              type: 'object',
              properties: {
                root: { type: 'string' },
                parts: { type: 'object' },
              },
            },
          },
        },
      },
      'anatomy:part': {
        id: 'anatomy:part',
        description: 'Anatomy part component',
        dataSchema: {
          type: 'object',
          properties: {
            subType: { type: 'string' },
            parentId: { type: 'string' },
            ownerEntityId: { type: 'string' },
            orientation: { type: 'string' },
          },
        },
      },
      'anatomy:sockets': {
        id: 'anatomy:sockets',
        description: 'Anatomy sockets component',
        dataSchema: {
          type: 'object',
          properties: {
            sockets: { type: 'array' },
          },
        },
      },
      'anatomy:joint': {
        id: 'anatomy:joint',
        description: 'Anatomy joint component',
        dataSchema: {
          type: 'object',
          properties: {
            parentId: { type: 'string' },
            socketId: { type: 'string' },
          },
        },
      },
      'core:owned_by': {
        id: 'core:owned_by',
        description: 'Ownership component',
        dataSchema: {
          type: 'object',
          properties: {
            ownerId: { type: 'string' },
          },
        },
      },
      'core:name': {
        id: 'core:name',
        description: 'Name component',
        dataSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
          },
        },
      },
      'core:description': {
        id: 'core:description',
        description: 'Core description component',
        dataSchema: {
          type: 'object',
          properties: {
            text: { type: 'string' },
          },
        },
      },
      // CRITICAL: Register the respiratory organ component
      'breathing-states:respiratory_organ': {
        id: 'breathing-states:respiratory_organ',
        description: 'Respiratory organ component for breathing mechanics',
        dataSchema: {
          type: 'object',
          properties: {
            respirationType: { type: 'string' },
            oxygenCapacity: { type: 'number' },
            currentOxygen: { type: 'number' },
            depletionRate: { type: 'number' },
            restorationRate: { type: 'number' },
          },
        },
      },
      'anatomy:blueprintSlot': {
        id: 'anatomy:blueprintSlot',
        description: 'Blueprint slot component',
        dataSchema: {
          type: 'object',
          properties: {
            slotId: { type: 'string' },
            socketId: { type: 'string' },
            requirements: { type: 'object' },
          },
        },
      },
    });

    // Load entity definitions - including lungs with respiratory organ component
    testBed.loadEntityDefinitions({
      'test:actor': {
        id: 'test:actor',
        description: 'Test actor entity',
        components: {},
      },
      'test:torso': {
        id: 'test:torso',
        description: 'Test torso entity',
        components: {
          'anatomy:part': {
            subType: 'torso',
          },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'head',
                max: 1,
                nameTpl: '{{type}}',
                allowedTypes: ['head'],
              },
              {
                id: 'left_lung',
                orientation: 'left',
                max: 1,
                nameTpl: '{{orientation}} {{type}}',
                allowedTypes: ['lung'],
              },
              {
                id: 'right_lung',
                orientation: 'right',
                max: 1,
                nameTpl: '{{orientation}} {{type}}',
                allowedTypes: ['lung'],
              },
            ],
          },
          'core:name': {
            text: 'torso',
          },
        },
      },
      'test:head': {
        id: 'test:head',
        description: 'Test head entity',
        components: {
          'anatomy:part': {
            subType: 'head',
          },
          'anatomy:sockets': {
            sockets: [],
          },
          'core:name': {
            text: 'head',
          },
        },
      },
      // CRITICAL: Lung entity definition with respiratory_organ component
      'test:lung': {
        id: 'test:lung',
        description: 'Test lung entity with respiratory organ component',
        components: {
          'anatomy:part': {
            subType: 'lung',
          },
          'anatomy:sockets': {
            sockets: [],
          },
          'core:name': {
            text: 'lung',
          },
          // This is the component that should be indexed but may not be
          'breathing-states:respiratory_organ': {
            respirationType: 'pulmonary',
            oxygenCapacity: 10,
            currentOxygen: 10,
            depletionRate: 1,
            restorationRate: 10,
          },
        },
      },
      'anatomy:blueprint_slot': {
        id: 'anatomy:blueprint_slot',
        description: 'Blueprint slot entity',
        components: {
          'anatomy:blueprintSlot': {
            slotId: '',
            socketId: '',
            requirements: {},
          },
          'core:name': {
            text: 'Blueprint Slot',
          },
        },
      },
    });

    // Register blueprint with lung slots
    testBed.loadBlueprints({
      'test:anatomy_with_lungs': {
        id: 'test:anatomy_with_lungs',
        version: '1.0.0',
        root: 'test:torso',
        slots: {
          head: {
            socket: 'head',
            preferId: 'test:head',
            required: true,
          },
          left_lung: {
            socket: 'left_lung',
            preferId: 'test:lung',
            required: true,
          },
          right_lung: {
            socket: 'right_lung',
            preferId: 'test:lung',
            required: true,
          },
        },
      },
    });

    // Register blueprint parts
    testBed.loadBlueprintParts({
      'test:torso': {
        id: 'test:torso',
        type: 'torso',
        sockets: {
          head: {
            id: 'head',
            max: 1,
            nameTpl: '{{type}}',
          },
          left_lung: {
            id: 'left_lung',
            max: 1,
            nameTpl: '{{orientation}} {{type}}',
          },
          right_lung: {
            id: 'right_lung',
            max: 1,
            nameTpl: '{{orientation}} {{type}}',
          },
        },
      },
    });

    // Register recipe
    testBed.loadRecipes({
      'test:recipe_with_lungs': {
        id: 'test:recipe_with_lungs',
        blueprintId: 'test:anatomy_with_lungs',
        descriptorOverrides: {},
      },
    });
  });

  afterEach(async () => {
    if (testBed?.cleanup) {
      await testBed.cleanup();
    }

    if (testBed) {
      if (testBed.registry?.clear) {
        testBed.registry.clear();
      }
      if (testBed.entityManager?.clearAll) {
        testBed.entityManager.clearAll();
      }
      if (testBed.bodyGraphService?.clearCache) {
        testBed.bodyGraphService.clearCache();
      }
    }

    jest.clearAllMocks();
  });

  describe('Respiratory Organ Component Indexing', () => {
    it('should find respiratory organs via getEntitiesWithComponent after anatomy generation', async () => {
      // Arrange: Create an actor with anatomy recipe
      const mockEntity = testBed.createMockEntity();
      const actorId = mockEntity.id;

      await entityManager.createEntityInstance('test:actor', {
        instanceId: actorId,
      });

      entityManager.addComponent(actorId, 'core:name', {
        text: 'Test Actor with Lungs',
      });

      entityManager.addComponent(actorId, ANATOMY_BODY_COMPONENT_ID, {
        recipeId: 'test:recipe_with_lungs',
      });

      // Act: Generate anatomy from recipe
      const result =
        await anatomyGenerationService.generateAnatomyIfNeeded(actorId);
      expect(result).toBe(true);

      // Assert: Verify anatomy was created
      const anatomyData = entityManager.getComponentData(
        actorId,
        ANATOMY_BODY_COMPONENT_ID
      );
      expect(anatomyData.body).toBeDefined();
      expect(anatomyData.body.root).toBeDefined();

      // CRITICAL TEST: Query for entities with respiratory_organ component
      // This is what OxygenAggregationService does - if this returns empty,
      // the oxygen bar won't appear
      const respiratoryOrgans = entityManager.getEntitiesWithComponent(
        RESPIRATORY_ORGAN_COMPONENT_ID
      );

      // This assertion is the core of the bug investigation
      // If it fails, we've reproduced the issue
      expect(respiratoryOrgans.length).toBeGreaterThan(0);

      // Verify we found 2 lungs (left and right)
      expect(respiratoryOrgans.length).toBe(2);

      // Verify each lung has the expected component data
      for (const lungEntity of respiratoryOrgans) {
        const organData = lungEntity.getComponentData(
          RESPIRATORY_ORGAN_COMPONENT_ID
        );
        expect(organData).toBeDefined();
        expect(organData.respirationType).toBe('pulmonary');
        expect(organData.oxygenCapacity).toBe(10);
        expect(organData.currentOxygen).toBe(10);
      }
    });

    it('should return valid oxygen summary from OxygenAggregationService after anatomy generation', async () => {
      // Arrange: Create actor with lungs
      const mockEntity = testBed.createMockEntity();
      const actorId = mockEntity.id;

      await entityManager.createEntityInstance('test:actor', {
        instanceId: actorId,
      });

      entityManager.addComponent(actorId, 'core:name', {
        text: 'Test Actor with Lungs',
      });

      entityManager.addComponent(actorId, ANATOMY_BODY_COMPONENT_ID, {
        recipeId: 'test:recipe_with_lungs',
      });

      // Act: Generate anatomy
      await anatomyGenerationService.generateAnatomyIfNeeded(actorId);

      // Act: Aggregate oxygen (this is what the UI does)
      const oxygenSummary = oxygenAggregationService.aggregateOxygen(actorId);

      // Assert: Should return non-null with respiratory organs found
      expect(oxygenSummary).not.toBeNull();
      expect(oxygenSummary.hasRespiratoryOrgans).toBe(true);
      expect(oxygenSummary.organCount).toBe(2);
      expect(oxygenSummary.percentage).toBe(100); // Full oxygen
      expect(oxygenSummary.totalOxygenCapacity).toBe(20); // 2 lungs x 10 capacity
      expect(oxygenSummary.totalCurrentOxygen).toBe(20);
    });

    it('should properly set ownerEntityId on lung anatomy parts', async () => {
      // Arrange
      const mockEntity = testBed.createMockEntity();
      const actorId = mockEntity.id;

      await entityManager.createEntityInstance('test:actor', {
        instanceId: actorId,
      });

      entityManager.addComponent(actorId, 'core:name', {
        text: 'Test Actor',
      });

      entityManager.addComponent(actorId, ANATOMY_BODY_COMPONENT_ID, {
        recipeId: 'test:recipe_with_lungs',
      });

      // Act
      await anatomyGenerationService.generateAnatomyIfNeeded(actorId);

      // Assert: Find all respiratory organs
      const respiratoryOrgans = entityManager.getEntitiesWithComponent(
        RESPIRATORY_ORGAN_COMPONENT_ID
      );

      // Each lung should have anatomy:part with ownerEntityId set to the actor
      for (const lungEntity of respiratoryOrgans) {
        const partData = lungEntity.getComponentData(ANATOMY_PART_COMPONENT_ID);
        expect(partData).toBeDefined();
        expect(partData.ownerEntityId).toBe(actorId);
      }
    });

  });

  describe('Anatomy Visualizer vs Oxygen Service Comparison', () => {
    it('should find anatomy:joint components (like visualizer does) AND respiratory_organ components', async () => {
      // The anatomy visualizer uses anatomy:joint to find parts
      // This test verifies both indexing mechanisms work

      const mockEntity = testBed.createMockEntity();
      const actorId = mockEntity.id;

      await entityManager.createEntityInstance('test:actor', {
        instanceId: actorId,
      });

      entityManager.addComponent(actorId, ANATOMY_BODY_COMPONENT_ID, {
        recipeId: 'test:recipe_with_lungs',
      });

      await anatomyGenerationService.generateAnatomyIfNeeded(actorId);

      // anatomy:joint is added via addComponent() during entity graph building
      const jointsFound =
        entityManager.getEntitiesWithComponent('anatomy:joint');

      // breathing-states:respiratory_organ comes from entity definition
      const organsFound = entityManager.getEntitiesWithComponent(
        RESPIRATORY_ORGAN_COMPONENT_ID
      );

      // Both should be found
      // Joints are added at runtime, so they should work
      expect(jointsFound.length).toBeGreaterThan(0);

      // Organs come from definitions - this is the potential problem area
      expect(organsFound.length).toBeGreaterThan(0);

    });
  });
});
