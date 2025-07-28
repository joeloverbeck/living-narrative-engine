/**
 * @file Cross-Component Integration Tests
 * @description Tests for integration between multi-target actions and other game systems
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { EntityManagerTestBed } from '../../common/entities/entityManagerTestBed.js';
import { createMockFacades } from '../../common/facades/testingFacadeRegistrations.js';

describe('Cross-Component Integration', () => {
  let entityTestBed;
  let facades;
  let actionServiceFacade;
  let entityServiceFacade;
  let mockLogger;
  let mockEventBus;

  beforeEach(() => {
    entityTestBed = new EntityManagerTestBed();
    const testBed = createTestBed();
    mockLogger = testBed.mockLogger;
    
    // Create facades
    facades = createMockFacades({}, jest.fn);
    actionServiceFacade = facades.actionService;
    entityServiceFacade = facades.entityService;
    mockEventBus = facades.mockDeps.entity.eventBus;
  });

  afterEach(() => {
    entityTestBed.cleanup();
    actionServiceFacade.clearMockData();
  });

  describe('Action System Integration', () => {
    it('should integrate with AI memory system for multi-target actions', async () => {
      const actionDefinition = {
        id: 'test:ai_memory_integration',
        name: 'interact with {person} about {topic}',
        targets: {
          person: {
            name: 'person',
            scope: 'location.core:actors[]',
            required: true,
            validation: {
              type: 'object',
              properties: {
                components: {
                  type: 'object',
                  properties: {
                    'ai:memory': { type: 'object' },
                  },
                  required: ['ai:memory'],
                },
              },
            },
          },
          topic: {
            name: 'topic',
            scope: 'target.ai:memory.known_topics[]',
            contextFrom: 'person',
            required: true,
          },
        },
        operations: [
          {
            operation: {
              type: 'dispatchEvent',
              eventType: 'AI_INTERACTION',
              payload: {
                actorId: 'actor.id',
                targetId: 'person.id',
                topic: 'topic.id',
                memoryContext: 'person.components.ai:memory',
              },
            },
          },
        ],
        template: 'discuss {topic.name} with {person.components.core:actor.name}',
      };

      // Setup entities with AI memory components
      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:actor': { name: 'Player' },
        },
      });

      const scholarEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'scholar_001',
        overrides: {
          'core:actor': { name: 'Scholar' },
          'ai:memory': {
            known_topics: ['ancient_history', 'magic_theory'],
            personality: 'academic',
            knowledge_level: 8,
            memory_events: [
              {
                type: 'conversation',
                timestamp: Date.now() - 3600000,
                participant: 'player',
                topic: 'ancient_history',
                sentiment: 'positive',
              },
            ],
          },
        },
      });

      const roomEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'library',
        overrides: {
          'core:location': { name: 'Library' },
          'core:actors': ['scholar_001'],
        },
      });

      // Mock discovery with AI memory integration
      const mockDiscoveryResult = [
        {
          actionId: actionDefinition.id,
          targets: {
            person: { id: 'scholar_001', displayName: 'Scholar' },
            topic: { 
              id: 'ancient_history', 
              displayName: 'Ancient History',
              name: 'Ancient History',
              complexity: 6,
            },
          },
          command: 'discuss Ancient History with Scholar',
          available: true,
          aiContext: {
            previousInteractions: 1,
            relationshipLevel: 'neutral',
            topicFamiliarity: 'high',
          },
        },
        {
          actionId: actionDefinition.id,
          targets: {
            person: { id: 'scholar_001', displayName: 'Scholar' },
            topic: { 
              id: 'magic_theory', 
              displayName: 'Magic Theory',
              name: 'Magic Theory',
              complexity: 8,
            },
          },
          command: 'discuss Magic Theory with Scholar',
          available: true,
          aiContext: {
            previousInteractions: 0,
            relationshipLevel: 'neutral',
            topicFamiliarity: 'medium',
          },
        },
      ];

      actionServiceFacade.setMockActions('player', mockDiscoveryResult);

      // Mock execution with AI memory update
      const mockExecutionResult = {
        success: true,
        effects: [
          'Dispatched AI_INTERACTION event',
          'Updated scholar AI memory with conversation',
          'Generated dynamic dialogue based on memory context',
        ],
        description: 'You discuss Ancient History with Scholar. The scholar remembers your previous conversation and continues where you left off.',
        command: 'discuss Ancient History with Scholar',
        aiUpdates: {
          memoryEvent: {
            type: 'conversation',
            timestamp: Date.now(),
            participant: 'player',
            topic: 'ancient_history',
            sentiment: 'positive',
            details: 'Continued discussion about the fall of the ancient empire',
          },
          relationshipChange: 0.1,
        },
      };

      jest
        .spyOn(actionServiceFacade.actionPipelineOrchestrator, 'execute')
        .mockResolvedValue(mockExecutionResult);

      const availableActions = await actionServiceFacade.discoverActions('player');

      expect(availableActions).toHaveLength(2);
      
      // Verify AI context is included
      const ancientHistoryAction = availableActions.find(
        a => a.targets.topic.id === 'ancient_history'
      );
      expect(ancientHistoryAction.aiContext).toBeDefined();
      expect(ancientHistoryAction.aiContext.previousInteractions).toBe(1);

      // Execute the action
      const executionResult = await actionServiceFacade.executeAction({
        actionId: actionDefinition.id,
        actorId: 'player',
        targets: {
          person: { id: 'scholar_001' },
          topic: { id: 'ancient_history' },
        },
      });

      expect(executionResult.success).toBe(true);
      expect(executionResult.effects).toContain('Updated scholar AI memory with conversation');
      expect(executionResult.aiUpdates).toBeDefined();
      expect(executionResult.aiUpdates.memoryEvent.topic).toBe('ancient_history');
    });

    it('should integrate with clothing system for complex multi-target actions', async () => {
      const actionDefinition = {
        id: 'test:clothing_system_integration',
        name: 'tailor {person} {garment} with {materials}',
        targets: {
          person: {
            name: 'person',
            scope: 'location.core:actors[]',
            required: true,
            validation: {
              type: 'object',
              properties: {
                components: {
                  type: 'object',
                  properties: {
                    'clothing:equipment': { type: 'object' },
                  },
                  required: ['clothing:equipment'],
                },
              },
            },
          },
          garment: {
            name: 'garment',
            scope: 'target.clothing:equipment.equipped[]',
            contextFrom: 'person',
            required: true,
            validation: {
              type: 'object',
              properties: {
                components: {
                  type: 'object',
                  properties: {
                    'clothing:garment': {
                      type: 'object',
                      properties: {
                        adjustable: { type: 'boolean', const: true },
                      },
                      required: ['adjustable'],
                    },
                  },
                  required: ['clothing:garment'],
                },
              },
            },
          },
          materials: {
            name: 'materials',
            scope: 'actor.core:inventory.items[]',
            contextFrom: 'garment',
            required: true,
            multiple: true,
            validation: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  components: {
                    type: 'object',
                    properties: {
                      'tailoring:material': {
                        type: 'object',
                        properties: {
                          fabric_type: {
                            const: { var: 'targets.garment[0].components.clothing:garment.fabric_type' },
                          },
                        },
                        required: ['fabric_type'],
                      },
                    },
                    required: ['tailoring:material'],
                  },
                },
              },
            },
          },
        },
        operations: [
          {
            operation: {
              type: 'modifyComponent',
              entityId: 'garment.id',
              componentId: 'clothing:garment',
              modifications: {
                fit_quality: {
                  operation: 'add',
                  value: 15,
                },
                durability: {
                  operation: 'add',
                  value: 10,
                },
              },
            },
          },
          {
            operation: {
              type: 'dispatchEvent',
              eventType: 'GARMENT_TAILORED',
              payload: {
                tailorId: 'actor.id',
                customerId: 'person.id',
                garmentId: 'garment.id',
                materialsUsed: 'materials.length',
              },
            },
          },
        ],
        template: 'tailor {person.components.core:actor.name} garment with materials',
      };

      // Setup complex clothing system entities
      const tailorEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'tailor',
        overrides: {
          'core:actor': { name: 'Master Tailor' },
          'core:inventory': { items: ['silk_thread', 'cotton_thread'] },
        },
      });

      const customerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'customer_001',
        overrides: {
          'core:actor': { name: 'Customer' },
          'clothing:equipment': {
            equipped: [
              {
                id: 'silk_dress',
                slot: 'torso_upper',
                layer: 'outer',
              },
            ],
          },
        },
      });

      const silkDressEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'silk_dress',
        overrides: {
          'core:item': { name: 'Silk Dress' },
          'clothing:garment': {
            slot: 'torso_upper',
            layer: 'outer',
            fabric_type: 'silk',
            adjustable: true,
            fit_quality: 60,
            durability: 75,
            style: 'formal',
            color: 'blue',
          },
        },
      });

      const silkThreadEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'silk_thread',
        overrides: {
          'core:item': { name: 'Silk Thread' },
          'tailoring:material': {
            fabric_type: 'silk',
            quality: 15,
            color_matching: true,
          },
        },
      });

      const cottonThreadEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'cotton_thread',
        overrides: {
          'core:item': { name: 'Cotton Thread' },
          'tailoring:material': {
            fabric_type: 'cotton',
            quality: 10,
            color_matching: false,
          },
        },
      });

      const shopEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'tailor_shop',
        overrides: {
          'core:location': { name: 'Tailor Shop' },
          'core:actors': ['customer_001'],
        },
      });

      // Mock discovery with clothing system integration
      const mockDiscoveryResult = [
        {
          actionId: actionDefinition.id,
          targets: {
            person: { id: 'customer_001', displayName: 'Customer' },
            garment: { id: 'silk_dress', displayName: 'Silk Dress' },
            materials: [
              { id: 'silk_thread', displayName: 'Silk Thread' },
            ],
          },
          command: 'tailor Customer garment with materials',
          available: true,
          clothingContext: {
            currentFitQuality: 60,
            currentDurability: 75,
            materialMatch: true,
            expectedImprovement: {
              fitQuality: 15,
              durability: 10,
            },
          },
        },
      ];

      actionServiceFacade.setMockActions('tailor', mockDiscoveryResult);

      const availableActions = await actionServiceFacade.discoverActions('tailor');

      expect(availableActions).toHaveLength(1);
      
      // Verify only matching material (silk thread) was included
      const action = availableActions[0];
      expect(action.targets.materials).toHaveLength(1);
      expect(action.targets.materials[0].id).toBe('silk_thread');
      
      // Cotton thread should not be included due to fabric type mismatch
      const hasCottonThread = action.targets.materials.some(
        m => m.id === 'cotton_thread'
      );
      expect(hasCottonThread).toBe(false);
      
      // Verify clothing context
      expect(action.clothingContext).toBeDefined();
      expect(action.clothingContext.materialMatch).toBe(true);
    });
  });

  describe('Event System Integration', () => {
    it('should integrate with complex event chains triggered by multi-target actions', async () => {
      const actionDefinition = {
        id: 'test:event_chain_integration',
        name: 'combine {item1} {item2} to create {result}',
        targets: {
          item1: {
            name: 'item1',
            scope: 'actor.core:inventory.items[]',
            required: true,
          },
          item2: {
            name: 'item2',
            scope: 'actor.core:inventory.items[]',
            required: true,
            validation: {
              type: 'object',
              properties: {
                id: {
                  type: 'string',
                  not: { const: { var: 'targets.item1[0].id' } },
                },
              },
            },
          },
          result: {
            name: 'result',
            scope: 'game.combination_results[]',
            contextFrom: 'item1,item2',
            required: true,
            validation: {
              type: 'object',
              properties: {
                required_items: {
                  type: 'array',
                  allOf: [
                    { contains: { const: { var: 'targets.item1[0].id' } } },
                    { contains: { const: { var: 'targets.item2[0].id' } } },
                  ],
                },
              },
            },
          },
        },
        operations: [
          {
            operation: {
              type: 'dispatchEvent',
              eventType: 'COMBINATION_STARTED',
              payload: {
                actorId: 'actor.id',
                item1Id: 'item1.id',
                item2Id: 'item2.id',
                resultId: 'result.id',
              },
            },
          },
        ],
        template: 'combine items to create {result.name}',
      };

      // Setup combination system
      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:inventory': { items: ['fire_essence', 'water_essence'] },
        },
      });

      const fireEssenceEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'fire_essence',
        overrides: {
          'core:item': { name: 'Fire Essence', element: 'fire' },
        },
      });

      const waterEssenceEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'water_essence',
        overrides: {
          'core:item': { name: 'Water Essence', element: 'water' },
        },
      });

      // Mock discovery with event chain
      const mockDiscoveryResult = [
        {
          actionId: actionDefinition.id,
          targets: {
            item1: { id: 'fire_essence', displayName: 'Fire Essence' },
            item2: { id: 'water_essence', displayName: 'Water Essence' },
            result: { 
              id: 'steam_essence',
              displayName: 'Steam Essence',
              name: 'Steam Essence',
            },
          },
          command: 'combine items to create Steam Essence',
          available: true,
        },
      ];

      actionServiceFacade.setMockActions('player', mockDiscoveryResult);

      // Mock execution with event chain
      const mockExecutionResult = {
        success: true,
        effects: [
          'Dispatched COMBINATION_STARTED event',
          'Event chain triggered: COMBINATION_PROCESSING',
          'Event chain triggered: COMBINATION_COMPLETED',
        ],
        description: 'Combination process initiated.',
        command: 'combine items to create Steam Essence',
        eventChain: [
          {
            type: 'COMBINATION_STARTED',
            payload: {
              actorId: 'player',
              item1Id: 'fire_essence',
              item2Id: 'water_essence',
              resultId: 'steam_essence',
            },
          },
          {
            type: 'COMBINATION_PROCESSING',
            payload: {
              combinationId: 'steam_essence',
              processingTime: 3000,
            },
            triggeredBy: 'COMBINATION_STARTED',
          },
          {
            type: 'COMBINATION_COMPLETED',
            payload: {
              combinationId: 'steam_essence',
              success: true,
              resultItemId: 'steam_essence_001',
            },
            triggeredBy: 'COMBINATION_PROCESSING',
          },
        ],
      };

      jest
        .spyOn(actionServiceFacade.actionPipelineOrchestrator, 'execute')
        .mockResolvedValue(mockExecutionResult);

      const availableActions = await actionServiceFacade.discoverActions('player');

      expect(availableActions).toHaveLength(1);

      // Execute action and verify event chain
      const executionResult = await actionServiceFacade.executeAction({
        actionId: actionDefinition.id,
        actorId: 'player',
        targets: {
          item1: { id: 'fire_essence' },
          item2: { id: 'water_essence' },
          result: { id: 'steam_essence' },
        },
      });

      expect(executionResult.success).toBe(true);
      expect(executionResult.eventChain).toBeDefined();
      expect(executionResult.eventChain).toHaveLength(3);
      
      // Verify event chain progression
      expect(executionResult.eventChain[0].type).toBe('COMBINATION_STARTED');
      expect(executionResult.eventChain[1].type).toBe('COMBINATION_PROCESSING');
      expect(executionResult.eventChain[1].triggeredBy).toBe('COMBINATION_STARTED');
      expect(executionResult.eventChain[2].type).toBe('COMBINATION_COMPLETED');
      expect(executionResult.eventChain[2].triggeredBy).toBe('COMBINATION_PROCESSING');
    });

    it('should handle cascading events from multi-target actions', async () => {
      const actionDefinition = {
        id: 'test:cascading_events',
        name: 'activate {device} with {power_source}',
        targets: {
          device: {
            name: 'device',
            scope: 'location.core:objects[]',
            required: true,
            validation: {
              type: 'object',
              properties: {
                components: {
                  type: 'object',
                  properties: {
                    'tech:device': {
                      type: 'object',
                      properties: {
                        powered: { type: 'boolean', const: false },
                      },
                    },
                  },
                },
              },
            },
          },
          power_source: {
            name: 'power_source',
            scope: 'actor.core:inventory.items[]',
            required: true,
            validation: {
              type: 'object',
              properties: {
                components: {
                  type: 'object',
                  properties: {
                    'tech:power': {
                      type: 'object',
                      properties: {
                        charge: { type: 'number', minimum: 10 },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        operations: [
          {
            operation: {
              type: 'modifyComponent',
              entityId: 'device.id',
              componentId: 'tech:device',
              modifications: {
                powered: true,
              },
            },
          },
          {
            operation: {
              type: 'dispatchEvent',
              eventType: 'DEVICE_ACTIVATED',
              payload: {
                deviceId: 'device.id',
                activatorId: 'actor.id',
                powerSourceId: 'power_source.id',
              },
            },
          },
        ],
        template: 'activate {device.components.core:object.name} with {power_source.components.core:item.name}',
      };

      // Setup tech system entities
      const playerEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'player',
        overrides: {
          'core:inventory': { items: ['power_cell_001'] },
        },
      });

      const deviceEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'portal_001',
        overrides: {
          'core:object': { name: 'Portal Device' },
          'tech:device': {
            powered: false,
            type: 'teleporter',
            connected_devices: ['portal_002', 'portal_003'],
          },
        },
      });

      const powerCellEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'power_cell_001',
        overrides: {
          'core:item': { name: 'Power Cell' },
          'tech:power': {
            charge: 100,
            type: 'universal',
          },
        },
      });

      const roomEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'tech_lab',
        overrides: {
          'core:location': { name: 'Technology Lab' },
          'core:objects': ['portal_001'],
        },
      });

      // Mock discovery
      const mockDiscoveryResult = [
        {
          actionId: actionDefinition.id,
          targets: {
            device: { id: 'portal_001', displayName: 'Portal Device' },
            power_source: { id: 'power_cell_001', displayName: 'Power Cell' },
          },
          command: 'activate Portal Device with Power Cell',
          available: true,
        },
      ];

      actionServiceFacade.setMockActions('player', mockDiscoveryResult);

      // Mock execution with cascading events
      const mockExecutionResult = {
        success: true,
        effects: [
          'Device portal_001 powered on',
          'Dispatched DEVICE_ACTIVATED event',
          'Cascading event: DEVICE_NETWORK_SYNC triggered',
          'Cascading event: PORTAL_NETWORK_ONLINE triggered',
          'Cascading event: NEW_DESTINATIONS_AVAILABLE triggered',
        ],
        description: 'You activate Portal Device with Power Cell. The device hums to life and synchronizes with the portal network.',
        command: 'activate Portal Device with Power Cell',
        cascadingEvents: [
          {
            type: 'DEVICE_ACTIVATED',
            payload: {
              deviceId: 'portal_001',
              activatorId: 'player',
              powerSourceId: 'power_cell_001',
            },
          },
          {
            type: 'DEVICE_NETWORK_SYNC',
            payload: {
              deviceId: 'portal_001',
              connectedDevices: ['portal_002', 'portal_003'],
            },
            triggeredBy: 'DEVICE_ACTIVATED',
            delay: 1000,
          },
          {
            type: 'PORTAL_NETWORK_ONLINE',
            payload: {
              networkDevices: ['portal_001', 'portal_002', 'portal_003'],
              availableDestinations: 2,
            },
            triggeredBy: 'DEVICE_NETWORK_SYNC',
            delay: 2000,
          },
          {
            type: 'NEW_DESTINATIONS_AVAILABLE',
            payload: {
              destinations: ['Ancient Ruins', 'Crystal Caverns'],
              unlockedBy: 'player',
            },
            triggeredBy: 'PORTAL_NETWORK_ONLINE',
            delay: 2500,
          },
        ],
      };

      jest
        .spyOn(actionServiceFacade.actionPipelineOrchestrator, 'execute')
        .mockResolvedValue(mockExecutionResult);

      const executionResult = await actionServiceFacade.executeAction({
        actionId: actionDefinition.id,
        actorId: 'player',
        targets: {
          device: { id: 'portal_001' },
          power_source: { id: 'power_cell_001' },
        },
      });

      expect(executionResult.success).toBe(true);
      expect(executionResult.cascadingEvents).toBeDefined();
      expect(executionResult.cascadingEvents).toHaveLength(4);
      
      // Verify cascading event sequence
      const syncEvent = executionResult.cascadingEvents.find(
        e => e.type === 'DEVICE_NETWORK_SYNC'
      );
      expect(syncEvent.triggeredBy).toBe('DEVICE_ACTIVATED');
      expect(syncEvent.payload.connectedDevices).toHaveLength(2);
      
      const networkEvent = executionResult.cascadingEvents.find(
        e => e.type === 'PORTAL_NETWORK_ONLINE'
      );
      expect(networkEvent.triggeredBy).toBe('DEVICE_NETWORK_SYNC');
      expect(networkEvent.payload.networkDevices).toHaveLength(3);
      
      const destinationsEvent = executionResult.cascadingEvents.find(
        e => e.type === 'NEW_DESTINATIONS_AVAILABLE'
      );
      expect(destinationsEvent.triggeredBy).toBe('PORTAL_NETWORK_ONLINE');
      expect(destinationsEvent.payload.destinations).toHaveLength(2);
    });
  });

  describe('System State Integration', () => {
    it('should properly update multiple systems from a single multi-target action', async () => {
      const actionDefinition = {
        id: 'test:multi_system_update',
        name: 'teach {student} {skill} using {book}',
        targets: {
          student: {
            name: 'student',
            scope: 'location.core:actors[]',
            required: true,
            validation: {
              type: 'object',
              properties: {
                components: {
                  type: 'object',
                  properties: {
                    'skills:learner': { type: 'object' },
                  },
                },
              },
            },
          },
          skill: {
            name: 'skill',
            scope: 'game.skills[]',
            required: true,
          },
          book: {
            name: 'book',
            scope: 'actor.core:inventory.items[]',
            contextFrom: 'skill',
            required: true,
            validation: {
              type: 'object',
              properties: {
                components: {
                  type: 'object',
                  properties: {
                    'core:book': {
                      type: 'object',
                      properties: {
                        skill_type: {
                          const: { var: 'targets.skill[0].type' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        operations: [
          // Update student's skills
          {
            operation: {
              type: 'modifyComponent',
              entityId: 'student.id',
              componentId: 'skills:learner',
              modifications: {
                known_skills: {
                  operation: 'push',
                  value: 'skill.id',
                },
                skill_levels: {
                  operation: 'set',
                  path: 'skill.id',
                  value: 1,
                },
              },
            },
          },
          // Update book durability
          {
            operation: {
              type: 'modifyComponent',
              entityId: 'book.id',
              componentId: 'core:book',
              modifications: {
                uses_remaining: {
                  operation: 'subtract',
                  value: 1,
                },
              },
            },
          },
          // Update teacher experience
          {
            operation: {
              type: 'modifyComponent',
              entityId: 'actor.id',
              componentId: 'skills:teacher',
              modifications: {
                teaching_experience: {
                  operation: 'add',
                  value: 10,
                },
                students_taught: {
                  operation: 'push',
                  value: 'student.id',
                },
              },
            },
          },
          // Dispatch learning event
          {
            operation: {
              type: 'dispatchEvent',
              eventType: 'SKILL_LEARNED',
              payload: {
                teacherId: 'actor.id',
                studentId: 'student.id',
                skillId: 'skill.id',
                bookId: 'book.id',
              },
            },
          },
        ],
        template: 'teach {student.components.core:actor.name} {skill.name} using {book.components.core:item.name}',
      };

      // Setup complex teaching scenario
      const teacherEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'teacher',
        overrides: {
          'core:actor': { name: 'Master Teacher' },
          'core:inventory': { items: ['swordsmanship_manual'] },
          'skills:teacher': {
            teaching_experience: 100,
            students_taught: [],
            specialties: ['combat', 'magic'],
          },
        },
      });

      const studentEntity = await entityTestBed.createEntity('actor', {
        instanceId: 'student_001',
        overrides: {
          'core:actor': { name: 'Eager Student' },
          'skills:learner': {
            known_skills: [],
            skill_levels: {},
            learning_speed: 1.2,
          },
        },
      });

      const bookEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'swordsmanship_manual',
        overrides: {
          'core:item': { name: 'Swordsmanship Manual' },
          'core:book': {
            skill_type: 'combat',
            uses_remaining: 5,
            quality: 'excellent',
          },
        },
      });

      const classroomEntity = await entityTestBed.createEntity('basic', {
        instanceId: 'classroom',
        overrides: {
          'core:location': { name: 'Training Hall' },
          'core:actors': ['student_001'],
        },
      });

      // Mock discovery
      const mockDiscoveryResult = [
        {
          actionId: actionDefinition.id,
          targets: {
            student: { id: 'student_001', displayName: 'Eager Student' },
            skill: { 
              id: 'swordsmanship',
              displayName: 'Swordsmanship',
              name: 'Swordsmanship',
              type: 'combat',
            },
            book: { id: 'swordsmanship_manual', displayName: 'Swordsmanship Manual' },
          },
          command: 'teach Eager Student Swordsmanship using Swordsmanship Manual',
          available: true,
        },
      ];

      actionServiceFacade.setMockActions('teacher', mockDiscoveryResult);

      // Mock execution with multi-system updates
      const mockExecutionResult = {
        success: true,
        effects: [
          'Student learned skill: swordsmanship',
          'Book uses remaining: 4',
          'Teacher experience increased by 10',
          'Dispatched SKILL_LEARNED event',
        ],
        description: 'You teach Eager Student Swordsmanship using Swordsmanship Manual. The student shows great progress!',
        command: 'teach Eager Student Swordsmanship using Swordsmanship Manual',
        systemUpdates: {
          skillSystem: {
            studentId: 'student_001',
            newSkill: 'swordsmanship',
            skillLevel: 1,
          },
          inventorySystem: {
            bookId: 'swordsmanship_manual',
            usesRemaining: 4,
          },
          teachingSystem: {
            teacherId: 'teacher',
            experienceGained: 10,
            totalStudents: 1,
          },
        },
      };

      jest
        .spyOn(actionServiceFacade.actionPipelineOrchestrator, 'execute')
        .mockResolvedValue(mockExecutionResult);

      const executionResult = await actionServiceFacade.executeAction({
        actionId: actionDefinition.id,
        actorId: 'teacher',
        targets: {
          student: { id: 'student_001' },
          skill: { id: 'swordsmanship' },
          book: { id: 'swordsmanship_manual' },
        },
      });

      expect(executionResult.success).toBe(true);
      expect(executionResult.systemUpdates).toBeDefined();
      
      // Verify all systems were updated
      expect(executionResult.systemUpdates.skillSystem.newSkill).toBe('swordsmanship');
      expect(executionResult.systemUpdates.inventorySystem.usesRemaining).toBe(4);
      expect(executionResult.systemUpdates.teachingSystem.experienceGained).toBe(10);
    });
  });
});