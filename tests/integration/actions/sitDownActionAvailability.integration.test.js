/**
 * @file Integration test for sit_down action availability with core:actor requirement
 * Tests that actions explicitly requiring core:actor are properly discovered
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ActionDiscoveryServiceTestBed from '../../common/actions/actionDiscoveryServiceTestBed.js';

describe('Sit Down Action Availability', () => {
  let testBed;
  let actionDiscoveryService;

  beforeEach(async () => {
    testBed = new ActionDiscoveryServiceTestBed();
    
    // Load actual action definitions including positioning mod actions
    await testBed.loadRealActions();
    
    actionDiscoveryService = testBed.createStandardDiscoveryService();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should make sit_down action available when actor and furniture are at same location', async () => {
    // Create entities directly with the testBed
    const locationId = 'test:park';
    const actorId = 'test:actor';
    const benchId = 'test:park_bench';
    
    // Add location
    testBed.addEntity({
      id: locationId,
      components: {
        'core:name': { text: 'Park' }
      }
    });

    // Add actor with core:actor component at the location
    testBed.addEntity({
      id: actorId,
      components: {
        'core:name': { text: 'Test Actor' },
        'core:position': { location_id: locationId },
        'core:actor': {} // Explicit core:actor component
      }
    });

    // Add park bench furniture at same location with allows_sitting
    testBed.addEntity({
      id: benchId,
      components: {
        'core:name': { text: 'Park Bench' },
        'core:position': { location_id: locationId },
        'positioning:allows_sitting': {
          spots: [
            { spot_id: '1', occupied: false },
            { spot_id: '2', occupied: false }
          ]
        }
      }
    });

    // Discover actions for the actor
    const discoveredActions = await actionDiscoveryService.discoverActions(actorId);

    // Verify sit_down is available
    const sitDownAction = discoveredActions.find(a => a.id === 'positioning:sit_down');
    expect(sitDownAction).toBeDefined();
    expect(sitDownAction?.id).toBe('positioning:sit_down');
    
    // Verify the action has the proper command format
    if (sitDownAction) {
      expect(sitDownAction.formattedCommand).toContain('sit down');
      expect(sitDownAction.formattedCommand.toLowerCase()).toContain('park bench'); // Should include target
    }

    // Also verify other expected actions are present
    const goAction = discoveredActions.find(a => a.id === 'core:go');
    const lookAction = discoveredActions.find(a => a.id === 'core:look');
    expect(goAction).toBeDefined();
    expect(lookAction).toBeDefined();

    // Log discovered actions for debugging
    console.log('Discovered actions:', discoveredActions.map(a => a.id));
  });

  it('should NOT make sit_down available when actor is already sitting', async () => {
    const locationId = 'test:park';
    const actorId = 'test:actor';
    const benchId = 'test:park_bench';
    
    // Add location
    testBed.addEntity({
      id: locationId,
      components: {
        'core:name': { text: 'Park' }
      }
    });

    // Add actor already sitting (has forbidden component)
    testBed.addEntity({
      id: actorId,
      components: {
        'core:name': { text: 'Test Actor' },
        'core:position': { location_id: locationId },
        'core:actor': {},
        'positioning:sitting_on': { entityId: 'test:other_bench' } // Forbidden component
      }
    });

    // Add park bench furniture at same location
    testBed.addEntity({
      id: benchId,
      components: {
        'core:name': { text: 'Park Bench' },
        'core:position': { location_id: locationId },
        'positioning:allows_sitting': {
          spots: [
            { spot_id: '1', occupied: false },
            { spot_id: '2', occupied: false }
          ]
        }
      }
    });

    // Discover actions for the actor
    const discoveredActions = await actionDiscoveryService.discoverActions(actorId);

    // Verify sit_down is NOT available
    const sitDownAction = discoveredActions.find(a => a.id === 'positioning:sit_down');
    expect(sitDownAction).toBeUndefined();

    console.log('Actions when already sitting:', discoveredActions.map(a => a.id));
  });

  it('should NOT make sit_down available when no furniture with allows_sitting is present', async () => {
    const locationId = 'test:park';
    const actorId = 'test:actor';
    
    // Add location
    testBed.addEntity({
      id: locationId,
      components: {
        'core:name': { text: 'Park' }
      }
    });

    // Add actor with core:actor component at the location
    testBed.addEntity({
      id: actorId,
      components: {
        'core:name': { text: 'Test Actor' },
        'core:position': { location_id: locationId },
        'core:actor': {}
      }
    });

    // No furniture at all

    // Discover actions for the actor
    const discoveredActions = await actionDiscoveryService.discoverActions(actorId);

    // Verify sit_down is NOT available (no valid targets)
    const sitDownAction = discoveredActions.find(a => a.id === 'positioning:sit_down');
    expect(sitDownAction).toBeUndefined();

    console.log('Actions with no furniture:', discoveredActions.map(a => a.id));
  });
});