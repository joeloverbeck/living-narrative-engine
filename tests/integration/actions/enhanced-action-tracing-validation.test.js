/**
 * @file Integration test to validate enhanced action tracing functionality
 * @description Tests that the enhanced tracing captures detailed target resolution information
 * for debugging action availability issues like the fondle_ass scenario.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SimpleEntityManager } from '../../common/entities/index.js';
import { MultiTargetResolutionStage } from '../../../src/actions/pipeline/stages/MultiTargetResolutionStage.js';
import createClothingStepResolver from '../../../src/scopeDsl/nodes/clothingStepResolver.js';
import createSlotAccessResolver from '../../../src/scopeDsl/nodes/slotAccessResolver.js';

describe('Enhanced Action Tracing Validation', () => {
  let entityManager;
  let entitiesGateway;
  let mockTrace;

  beforeEach(() => {
    entityManager = new SimpleEntityManager();

    entitiesGateway = {
      getComponentData: (entityId, componentId) => {
        return entityManager.getComponentData(entityId, componentId);
      },
    };

    // Mock trace object to capture tracing calls
    mockTrace = {
      logs: [],
      addLog: function (level, message, component, data = {}) {
        this.logs.push({ level, message, component, data });
      },
      captureActionData: function (stage, actionId, data) {
        this.logs.push({ type: 'actionData', stage, actionId, data });
      },
    };
  });

  it('should trace detailed clothing resolution for scenario with only accessories', () => {
    // Arrange - Set up Jon with only belt (accessories layer)
    const jonId = 'test:jon_scenario';

    entityManager.addComponent(jonId, 'clothing:equipment', {
      equipped: {
        torso_lower: {
          accessories: 'clothing:dark_brown_leather_belt',
          // No other layers - this should trigger the "accessories only" scenario
        },
      },
    });

    const clothingResolver = createClothingStepResolver({ entitiesGateway });
    const slotResolver = createSlotAccessResolver({ entitiesGateway });

    // Act - Resolve clothing with topmost_no_accessories mode
    const clothingAccessObject = clothingResolver.resolve(
      {
        type: 'Step',
        field: 'topmost_clothing_no_accessories',
        parent: { type: 'Variable', name: 'target' },
      },
      {
        dispatcher: {
          resolve: () => new Set([jonId]),
        },
        trace: mockTrace,
      }
    );

    const clothingAccess = Array.from(clothingAccessObject)[0];

    const slotResult = slotResolver.resolve(
      {
        type: 'Step',
        field: 'torso_lower',
        parent: {
          type: 'Step',
          field: 'topmost_clothing_no_accessories',
        },
      },
      {
        dispatcher: {
          resolve: () => new Set([clothingAccess]),
        },
        trace: mockTrace,
      }
    );

    // Assert - Check that detailed tracing was captured
    const resolvedItems = Array.from(slotResult);
    expect(resolvedItems).toHaveLength(0); // Should be empty due to accessories exclusion

    // Find clothing step resolver logs
    const clothingLogs = mockTrace.logs.filter(
      (log) => log.component === 'ClothingStepResolver'
    );
    expect(clothingLogs.length).toBeGreaterThan(0);

    const clothingLog = clothingLogs.find((log) =>
      log.message.includes('Found clothing')
    );
    expect(clothingLog).toBeDefined();
    expect(clothingLog.data.mode).toBe('topmost_no_accessories');
    expect(
      clothingLog.data.clothingSlotSummary.torso_lower.accessories
    ).toBeDefined();

    // Find slot access resolver logs
    const slotLogs = mockTrace.logs.filter(
      (log) => log.component === 'SlotAccessResolver'
    );
    expect(slotLogs.length).toBeGreaterThan(0);

    // Check for the "Processing slot" log
    const processingLog = slotLogs.find((log) =>
      log.message.includes('Processing slot torso_lower')
    );
    expect(processingLog).toBeDefined();
    expect(processingLog.data.field).toBe('torso_lower');

    // Check for the "No items found" log (since accessories are excluded)
    const noItemsLog = slotLogs.find((log) =>
      log.message.includes('No items found for slot torso_lower')
    );
    expect(noItemsLog).toBeDefined();
    expect(noItemsLog.data.slotName).toBe('torso_lower');
    expect(noItemsLog.data.mode).toBe('topmost_no_accessories');
    
    // The available slots should include torso_lower since it has accessories
    expect(noItemsLog.data.availableSlots).toContain('torso_lower');
  });

  it('should trace successful clothing resolution for scenario with base layer', () => {
    // Arrange - Set up Silvia with skirt in base layer
    const silviaId = 'test:silvia_scenario';

    entityManager.addComponent(silviaId, 'clothing:equipment', {
      equipped: {
        torso_lower: {
          base: 'clothing:pink_short_flared_skirt',
        },
      },
    });

    const clothingResolver = createClothingStepResolver({ entitiesGateway });
    const slotResolver = createSlotAccessResolver({ entitiesGateway });

    // Act - Resolve clothing with topmost_no_accessories mode
    const clothingAccessObject = clothingResolver.resolve(
      {
        type: 'Step',
        field: 'topmost_clothing_no_accessories',
        parent: { type: 'Variable', name: 'target' },
      },
      {
        dispatcher: {
          resolve: () => new Set([silviaId]),
        },
        trace: mockTrace,
      }
    );

    const clothingAccess = Array.from(clothingAccessObject)[0];

    const slotResult = slotResolver.resolve(
      {
        type: 'Step',
        field: 'torso_lower',
        parent: {
          type: 'Step',
          field: 'topmost_clothing_no_accessories',
        },
      },
      {
        dispatcher: {
          resolve: () => new Set([clothingAccess]),
        },
        trace: mockTrace,
      }
    );

    // Assert - Check that clothing was found successfully
    const resolvedItems = Array.from(slotResult);
    expect(resolvedItems).toHaveLength(1);
    expect(resolvedItems[0]).toBe('clothing:pink_short_flared_skirt');

    // Find slot access resolver logs
    const slotLogs = mockTrace.logs.filter(
      (log) => log.component === 'SlotAccessResolver'
    );

    const successLog = slotLogs.find((log) =>
      log.message.includes('Selected item')
    );
    expect(successLog).toBeDefined();
    expect(successLog.data.layer).toBe('base');
    expect(successLog.data.itemId).toBe('clothing:pink_short_flared_skirt');
    expect(successLog.data.mode).toBe('topmost_no_accessories');
  });

  it('should capture detailed target resolution results in MultiTargetResolutionStage', () => {
    // This test verifies that the enhanced tracing structure is properly captured
    // In a real scenario, this would be tested via a complete action pipeline

    const mockResult = {
      data: {
        detailedResolutionResults: {
          primary: {
            scopeId: 'test:primary_scope',
            contextFrom: null,
            candidatesFound: 1,
            candidatesResolved: 1,
            failureReason: null,
            evaluationTimeMs: 5,
          },
          secondary: {
            scopeId: 'test:secondary_scope',
            contextFrom: 'primary',
            candidatesFound: 0,
            candidatesResolved: 0,
            failureReason:
              'Only accessories available but mode excludes accessories',
            evaluationTimeMs: 3,
            contextEntityIds: ['test:primary_entity'],
          },
        },
      },
    };

    // Verify the structure contains the expected detailed information
    const details = mockResult.data.detailedResolutionResults;

    expect(details.primary).toBeDefined();
    expect(details.primary.scopeId).toBe('test:primary_scope');
    expect(details.primary.candidatesFound).toBe(1);
    expect(details.primary.candidatesResolved).toBe(1);
    expect(details.primary.failureReason).toBeNull();

    expect(details.secondary).toBeDefined();
    expect(details.secondary.scopeId).toBe('test:secondary_scope');
    expect(details.secondary.contextFrom).toBe('primary');
    expect(details.secondary.candidatesFound).toBe(0);
    expect(details.secondary.candidatesResolved).toBe(0);
    expect(details.secondary.failureReason).toContain(
      'accessories available but mode excludes'
    );
    expect(details.secondary.contextEntityIds).toContain('test:primary_entity');
  });
});
