/**
 * @file tests/e2e/anatomy/badgerFolkLungGeneration.e2e.test.js
 * @description E2E tests verifying that badger folk anatomy generates lungs correctly.
 * Tests the complete pipeline from recipe-based anatomy creation through to
 * OxygenAggregationService finding respiratory organs.
 *
 * Bug: Runtime error "Socket 'lung_left_socket' not found on parent entity
 * 'anatomy-creatures:badger_folk_male_torso'" occurs because the torso entity
 * was missing lung socket definitions.
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

describe('Badger Folk Lung Generation E2E', () => {
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

    // Load entity definitions simulating badger folk anatomy
    // The torso MUST have lung sockets for this to work
    testBed.loadEntityDefinitions({
      'test:actor': {
        id: 'test:actor',
        description: 'Test actor entity',
        components: {},
      },
      // Badger folk torso with lung sockets (fixed version)
      'test:badger_folk_torso': {
        id: 'test:badger_folk_torso',
        description: 'Test badger folk torso with lung sockets',
        components: {
          'anatomy:part': {
            subType: 'torso',
          },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'neck',
                allowedTypes: ['head'],
                nameTpl: '{{type}}',
              },
              {
                id: 'heart_socket',
                allowedTypes: ['heart'],
                nameTpl: '{{type}}',
              },
              {
                id: 'spine_socket',
                allowedTypes: ['spine'],
                nameTpl: '{{type}}',
              },
              // CRITICAL: These lung sockets are required for lung attachment
              {
                id: 'lung_left_socket',
                orientation: 'left',
                allowedTypes: ['lung'],
                nameTpl: '{{orientation}} {{type}}',
              },
              {
                id: 'lung_right_socket',
                orientation: 'right',
                allowedTypes: ['lung'],
                nameTpl: '{{orientation}} {{type}}',
              },
            ],
          },
          'core:name': {
            text: 'badger-folk torso',
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
      // Mustelid lung entities with respiratory organ component
      'test:mustelid_lung_left': {
        id: 'test:mustelid_lung_left',
        description: 'Mustelid left lung with respiratory organ component',
        components: {
          'anatomy:part': {
            subType: 'lung',
            orientation: 'left',
          },
          'anatomy:sockets': {
            sockets: [],
          },
          'core:name': {
            text: 'left lung',
          },
          // This component enables breathing/oxygen mechanics
          'breathing-states:respiratory_organ': {
            respirationType: 'pulmonary',
            oxygenCapacity: 8,
            currentOxygen: 8,
          },
        },
      },
      'test:mustelid_lung_right': {
        id: 'test:mustelid_lung_right',
        description: 'Mustelid right lung with respiratory organ component',
        components: {
          'anatomy:part': {
            subType: 'lung',
            orientation: 'right',
          },
          'anatomy:sockets': {
            sockets: [],
          },
          'core:name': {
            text: 'right lung',
          },
          'breathing-states:respiratory_organ': {
            respirationType: 'pulmonary',
            oxygenCapacity: 8,
            currentOxygen: 8,
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

    // Register blueprint with lung slots (simulating badger_folk_male blueprint)
    testBed.loadBlueprints({
      'test:badger_folk_male': {
        id: 'test:badger_folk_male',
        version: '1.0.0',
        root: 'test:badger_folk_torso',
        slots: {
          head: {
            socket: 'neck',
            preferId: 'test:head',
            required: true,
          },
          left_lung: {
            socket: 'lung_left_socket',
            preferId: 'test:mustelid_lung_left',
            required: true,
          },
          right_lung: {
            socket: 'lung_right_socket',
            preferId: 'test:mustelid_lung_right',
            required: true,
          },
        },
      },
    });

    // Register blueprint parts
    testBed.loadBlueprintParts({
      'test:badger_folk_torso': {
        id: 'test:badger_folk_torso',
        type: 'torso',
        sockets: {
          neck: {
            id: 'neck',
            max: 1,
            nameTpl: '{{type}}',
          },
          lung_left_socket: {
            id: 'lung_left_socket',
            max: 1,
            nameTpl: '{{orientation}} {{type}}',
          },
          lung_right_socket: {
            id: 'lung_right_socket',
            max: 1,
            nameTpl: '{{orientation}} {{type}}',
          },
        },
      },
    });

    // Register recipe (simulating badger_folk_male_standard.recipe.json)
    testBed.loadRecipes({
      'test:badger_folk_male_standard': {
        id: 'test:badger_folk_male_standard',
        blueprintId: 'test:badger_folk_male',
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

  describe('Badger Folk Anatomy Generation with Lungs', () => {
    it('should generate anatomy with lungs attached to torso lung sockets', async () => {
      // Arrange: Create a badger folk actor with anatomy recipe
      const mockEntity = testBed.createMockEntity();
      const actorId = mockEntity.id;

      await entityManager.createEntityInstance('test:actor', {
        instanceId: actorId,
      });

      entityManager.addComponent(actorId, 'core:name', {
        text: 'Test Badger Folk',
      });

      entityManager.addComponent(actorId, ANATOMY_BODY_COMPONENT_ID, {
        recipeId: 'test:badger_folk_male_standard',
      });

      // Act: Generate anatomy from recipe
      // This should NOT throw "Socket not found" error
      const result =
        await anatomyGenerationService.generateAnatomyIfNeeded(actorId);

      // Assert: Anatomy generation should succeed
      expect(result).toBe(true);

      // Verify anatomy body was created with proper structure
      const anatomyData = entityManager.getComponentData(
        actorId,
        ANATOMY_BODY_COMPONENT_ID
      );
      expect(anatomyData.body).toBeDefined();
      expect(anatomyData.body.root).toBeDefined();
    });

    it('should find respiratory organs via getEntitiesWithComponent after anatomy generation', async () => {
      // Arrange
      const mockEntity = testBed.createMockEntity();
      const actorId = mockEntity.id;

      await entityManager.createEntityInstance('test:actor', {
        instanceId: actorId,
      });

      entityManager.addComponent(actorId, 'core:name', {
        text: 'Test Badger Folk with Lungs',
      });

      entityManager.addComponent(actorId, ANATOMY_BODY_COMPONENT_ID, {
        recipeId: 'test:badger_folk_male_standard',
      });

      // Act: Generate anatomy
      await anatomyGenerationService.generateAnatomyIfNeeded(actorId);

      // Assert: Query for entities with respiratory_organ component
      const respiratoryOrgans = entityManager.getEntitiesWithComponent(
        RESPIRATORY_ORGAN_COMPONENT_ID
      );

      // Should find 2 lungs (left and right)
      expect(respiratoryOrgans.length).toBe(2);

      // Verify each lung has the expected component data
      for (const lungEntity of respiratoryOrgans) {
        const organData = lungEntity.getComponentData(
          RESPIRATORY_ORGAN_COMPONENT_ID
        );
        expect(organData).toBeDefined();
        expect(organData.respirationType).toBe('pulmonary');
        expect(organData.oxygenCapacity).toBe(8);
        expect(organData.currentOxygen).toBe(8);
      }
    });

    it('should return valid oxygen summary from OxygenAggregationService', async () => {
      // Arrange: Create badger folk actor with lungs
      const mockEntity = testBed.createMockEntity();
      const actorId = mockEntity.id;

      await entityManager.createEntityInstance('test:actor', {
        instanceId: actorId,
      });

      entityManager.addComponent(actorId, 'core:name', {
        text: 'Test Badger Folk',
      });

      entityManager.addComponent(actorId, ANATOMY_BODY_COMPONENT_ID, {
        recipeId: 'test:badger_folk_male_standard',
      });

      // Act: Generate anatomy
      await anatomyGenerationService.generateAnatomyIfNeeded(actorId);

      // Act: Aggregate oxygen (this is what the UI does to show oxygen bar)
      const oxygenSummary = oxygenAggregationService.aggregateOxygen(actorId);

      // Assert: Should return non-null with respiratory organs found
      expect(oxygenSummary).not.toBeNull();
      expect(oxygenSummary.hasRespiratoryOrgans).toBe(true);
      expect(oxygenSummary.organCount).toBe(2);
      expect(oxygenSummary.percentage).toBe(100); // Full oxygen
      expect(oxygenSummary.totalOxygenCapacity).toBe(16); // 2 lungs x 8 capacity
      expect(oxygenSummary.totalCurrentOxygen).toBe(16);
    });

    it('should properly set ownerEntityId on lung anatomy parts', async () => {
      // Arrange
      const mockEntity = testBed.createMockEntity();
      const actorId = mockEntity.id;

      await entityManager.createEntityInstance('test:actor', {
        instanceId: actorId,
      });

      entityManager.addComponent(actorId, 'core:name', {
        text: 'Test Badger Folk',
      });

      entityManager.addComponent(actorId, ANATOMY_BODY_COMPONENT_ID, {
        recipeId: 'test:badger_folk_male_standard',
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

    it('should create lungs with correct orientations (left and right)', async () => {
      // Arrange
      const mockEntity = testBed.createMockEntity();
      const actorId = mockEntity.id;

      await entityManager.createEntityInstance('test:actor', {
        instanceId: actorId,
      });

      entityManager.addComponent(actorId, ANATOMY_BODY_COMPONENT_ID, {
        recipeId: 'test:badger_folk_male_standard',
      });

      // Act
      await anatomyGenerationService.generateAnatomyIfNeeded(actorId);

      // Assert: Find respiratory organs and check orientations
      const respiratoryOrgans = entityManager.getEntitiesWithComponent(
        RESPIRATORY_ORGAN_COMPONENT_ID
      );

      const orientations = respiratoryOrgans.map((entity) => {
        const partData = entity.getComponentData(ANATOMY_PART_COMPONENT_ID);
        return partData.orientation;
      });

      expect(orientations).toContain('left');
      expect(orientations).toContain('right');
      expect(orientations.length).toBe(2);
    });
  });
});
