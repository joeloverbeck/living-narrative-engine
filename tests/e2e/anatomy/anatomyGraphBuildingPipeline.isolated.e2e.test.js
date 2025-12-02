/**
 * @file Isolated test to verify anatomy generation pipeline behavior
 * @description Tests the exact same functionality as the main test but in complete isolation
 */

import {
  beforeEach,
  describe,
  expect,
  it,
  jest,
  afterEach,
} from '@jest/globals';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';
import AnatomyIntegrationTestBed from '../../common/anatomy/anatomyIntegrationTestBed.js';

// Mock console to reduce test output noise (but keep error for debugging)
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: originalConsole.error, // Keep error for debugging
};

describe('Anatomy Graph Building Pipeline - ISOLATED Test', () => {
  let testBed;
  let entityManager;
  let anatomyGenerationService;
  let bodyGraphService;

  beforeEach(async () => {
    // Create test bed with real anatomy components
    testBed = new AnatomyIntegrationTestBed();

    // Ensure absolutely clean state
    if (testBed.registry?.clear) {
      testBed.registry.clear();
    }
    if (testBed.entityManager?.clearAll) {
      testBed.entityManager.clearAll();
    }
    if (testBed.bodyGraphService?.clearCache) {
      testBed.bodyGraphService.clearCache();
    }
    if (testBed.anatomyClothingCache?.clear) {
      testBed.anatomyClothingCache.clear();
    }

    // Get services from test bed
    entityManager = testBed.getEntityManager();
    anatomyGenerationService = testBed.anatomyGenerationService;
    bodyGraphService = testBed.bodyGraphService;

    // Load required components
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
      'anatomy:equipment': {
        id: 'anatomy:equipment',
        description: 'Equipment component',
        dataSchema: {
          type: 'object',
          properties: {},
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
      'anatomy:blueprint_slot': {
        id: 'anatomy:blueprint_slot',
        description: 'Blueprint slot entity definition',
        dataSchema: {
          type: 'object',
          properties: {},
        },
      },
    });

    // Load test entity definitions
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
                id: 'left_arm',
                orientation: 'left',
                max: 1,
                nameTpl: '{{orientation}} {{type}}',
                allowedTypes: ['arm'],
              },
              {
                id: 'right_arm',
                orientation: 'right',
                max: 1,
                nameTpl: '{{orientation}} {{type}}',
                allowedTypes: ['arm'],
              },
              {
                id: 'left_leg',
                orientation: 'left',
                max: 1,
                nameTpl: '{{orientation}} {{type}}',
                allowedTypes: ['leg'],
              },
              {
                id: 'right_leg',
                orientation: 'right',
                max: 1,
                nameTpl: '{{orientation}} {{type}}',
                allowedTypes: ['leg'],
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
      'test:arm': {
        id: 'test:arm',
        description: 'Test arm entity',
        components: {
          'anatomy:part': {
            subType: 'arm',
          },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'hand',
                max: 1,
                nameTpl: '{{parent.name}}_{{type}}',
                allowedTypes: ['hand'],
              },
            ],
          },
          'core:name': {
            text: 'arm',
          },
        },
      },
      'test:hand': {
        id: 'test:hand',
        description: 'Test hand entity',
        components: {
          'anatomy:part': {
            subType: 'hand',
          },
          'anatomy:sockets': {
            sockets: [
              {
                id: 'grip',
                max: 1,
                allowedTypes: ['*'],
              },
            ],
          },
          'core:name': {
            text: 'hand',
          },
        },
      },
      'test:leg': {
        id: 'test:leg',
        description: 'Test leg entity',
        components: {
          'anatomy:part': {
            subType: 'leg',
          },
          'anatomy:sockets': {
            sockets: [],
          },
          'core:name': {
            text: 'leg',
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

    // Register test anatomy blueprints
    testBed.loadBlueprints({
      'test:simple_anatomy': {
        id: 'test:simple_anatomy',
        version: '1.0.0',
        root: 'test:torso',
        slots: {
          head: {
            socket: 'head',
            preferId: 'test:head',
            required: true,
          },
          left_arm: {
            socket: 'left_arm',
            preferId: 'test:arm',
            required: true,
          },
          right_arm: {
            socket: 'right_arm',
            preferId: 'test:arm',
            required: true,
          },
          left_leg: {
            socket: 'left_leg',
            preferId: 'test:leg',
            required: true,
          },
          right_leg: {
            socket: 'right_leg',
            preferId: 'test:leg',
            required: true,
          },
          left_hand: {
            socket: 'hand',
            parent: 'left_arm',
            preferId: 'test:hand',
            required: true,
          },
          right_hand: {
            socket: 'hand',
            parent: 'right_arm',
            preferId: 'test:hand',
            required: true,
          },
          'main-hand': {
            socket: 'grip',
            parent: 'right_hand',
            requirements: { strength: 5 },
            required: false,
          },
          'off-hand': {
            socket: 'grip',
            parent: 'left_hand',
            requirements: { dexterity: 3 },
            required: false,
          },
        },
      },
    });

    // Register test anatomy recipes
    testBed.loadRecipes({
      'test:basic_recipe': {
        id: 'test:basic_recipe',
        blueprintId: 'test:simple_anatomy',
        descriptorOverrides: {
          head: {
            shape: 'round',
            size: 'medium',
          },
          arm: {
            muscle: 'toned',
          },
          hand: {
            size: 'medium',
          },
          leg: {
            muscle: 'toned',
          },
        },
      },
    });
  });

  afterEach(async () => {
    if (testBed?.cleanup) {
      await testBed.cleanup();
    }

    // Extra cleanup to ensure isolation
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
      if (testBed.anatomyClothingCache?.clear) {
        testBed.anatomyClothingCache.clear();
      }
    }

    jest.clearAllMocks();
  });

  describe('Isolated anatomy generation test', () => {
    it('should generate anatomy with correct part counts in complete isolation', async () => {
      // Step 1: Create an entity that needs anatomy
      const mockEntity = testBed.createMockEntity();
      const ownerId = mockEntity.id;

      await entityManager.createEntityInstance('test:actor', {
        instanceId: ownerId,
      });

      entityManager.addComponent(ownerId, 'core:name', {
        text: 'Test Actor',
      });

      entityManager.addComponent(ownerId, ANATOMY_BODY_COMPONENT_ID, {
        recipeId: 'test:basic_recipe',
      });

      // Verify initial state - no anatomy generated yet
      const initialData = entityManager.getComponentData(
        ownerId,
        ANATOMY_BODY_COMPONENT_ID
      );
      expect(initialData).toBeDefined();
      expect(initialData.recipeId).toBe('test:basic_recipe');
      expect(initialData.body).toBeUndefined();

      // Step 2: Execute the complete pipeline through generateAnatomyIfNeeded
      const result =
        await anatomyGenerationService.generateAnatomyIfNeeded(ownerId);
      expect(result).toBe(true);

      // Step 3: Verify anatomy:body component was updated with structure
      const anatomyData = entityManager.getComponentData(
        ownerId,
        ANATOMY_BODY_COMPONENT_ID
      );
      expect(anatomyData).toBeDefined();
      expect(anatomyData.recipeId).toBe('test:basic_recipe');
      expect(anatomyData.body).toBeDefined();
      expect(anatomyData.body.root).toBeDefined();
      expect(anatomyData.body.parts).toBeDefined();

      // Step 4: Verify entity graph was created
      const rootId = anatomyData.body.root;
      const rootEntity = entityManager.getEntityInstance(rootId);
      expect(rootEntity).toBeDefined();
      expect(rootEntity.hasComponent('anatomy:part')).toBe(true);

      const rootPartData = rootEntity.getComponentData('anatomy:part');
      expect(rootPartData.subType).toBe('torso');

      // Step 5: Verify parts were created
      const partEntities =
        entityManager.getEntitiesWithComponent('anatomy:part');

      // Filter to only parts owned by this anatomy (excluding root)
      const anatomyParts = partEntities.filter((entity) => {
        const ownedBy = entity.getComponentData('core:owned_by');
        return ownedBy && ownedBy.ownerId === ownerId && entity.id !== rootId;
      });

      // Debug: Print detailed information about all parts
      console.log('=== ISOLATED TEST DEBUG INFO ===');
      console.log('Total part entities:', partEntities.length);
      console.log('Anatomy parts (excluding root):', anatomyParts.length);

      const partTypes = anatomyParts.map((entity) => {
        const partData = entity.getComponentData('anatomy:part');
        const nameData = entity.getComponentData('core:name');
        return {
          id: entity.id,
          subType: partData.subType,
          name: nameData?.text,
          ownerId: entity.getComponentData('core:owned_by')?.ownerId,
        };
      });

      console.log('Part details:', JSON.stringify(partTypes, null, 2));

      // Count by type
      const typeCounts = {};
      partTypes.forEach((part) => {
        typeCounts[part.subType] = (typeCounts[part.subType] || 0) + 1;
      });

      console.log('Part type counts:', typeCounts);
      console.log('=== END DEBUG INFO ===');

      // Extract just the part types for assertions
      const partTypesList = partTypes.map((part) => part.subType);

      // We should have at least 7 parts (head, 2 arms, 2 hands, 2 legs)
      expect(anatomyParts.length).toBeGreaterThanOrEqual(7);

      // Check that we have the expected parts for this specific anatomy
      expect(
        partTypesList.filter((type) => type === 'head').length
      ).toBeGreaterThanOrEqual(1);
      expect(partTypesList.filter((type) => type === 'arm').length).toBe(2);
      expect(
        partTypesList.filter((type) => type === 'hand').length
      ).toBeGreaterThanOrEqual(2);
      expect(partTypesList.filter((type) => type === 'leg').length).toBe(2);
    });
  });
});
