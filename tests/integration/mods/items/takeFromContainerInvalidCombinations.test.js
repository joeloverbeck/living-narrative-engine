/**
 * @file Integration test for take_from_container invalid action combination bug.
 * @description Tests that actions are NOT generated for items from the wrong container
 * when multiple containers exist at the same location.
 *
 * This test reproduces the bug where:
 * - Bulletin board contains [notice1, notice2, ...]
 * - Table contains [ale_tankard]
 * - Both are at the same location
 * - Bug: "take notice from table" is incorrectly generated
 *
 * Expected: Only valid combinations should exist:
 * - "take notice from bulletin_board" ✓
 * - "take ale_tankard from table" ✓
 * - "take notice from table" ✗ (INVALID - should not exist)
 */

import { describe, it, expect } from '@jest/globals';

describe('take_from_container - invalid multi-target combinations bug', () => {

  it('should correctly pair items with their actual containers using MultiTargetActionFormatter', () => {
    // This test validates that MultiTargetActionFormatter correctly handles contextFrom dependencies
    // to prevent invalid item-container pairings when multiple containers exist.

    // Import the formatter directly (dynamic import for test-time only)
    const { MultiTargetActionFormatter } = require('../../../../src/actions/formatters/MultiTargetActionFormatter.js');
    const ConsoleLogger = require('../../../../src/logging/consoleLogger.js').default;

    // Setup formatter
    const logger = new ConsoleLogger('ERROR');
    const baseFormatter = { format: () => ({ ok: true, value: 'mock' }) };
    const formatter = new MultiTargetActionFormatter(baseFormatter, logger);

    // Setup action definition for take_from_container
    const actionDef = {
      id: 'items:take_from_container',
      name: 'Take from Container',
      template: 'take {secondary} from {primary}',
      targets: {
        primary: {
          placeholder: 'primary',
          description: 'Container to take from',
        },
        secondary: {
          placeholder: 'secondary',
          description: 'Item to take',
          contextFrom: 'primary', // CRITICAL: This enforces proper pairing
        },
      },
    };

    // Setup resolved targets - simulating what MultiTargetResolutionStage would produce
    const resolvedTargets = {
      primary: [
        { id: 'test:containerA', displayName: 'Container A', type: 'entity' },
        { id: 'test:containerB', displayName: 'Container B', type: 'entity' },
      ],
      secondary: [
        {
          id: 'test:itemA1',
          displayName: 'Item A1',
          type: 'entity',
          contextFromId: 'test:containerA', // Links to Container A
        },
        {
          id: 'test:itemA2',
          displayName: 'Item A2',
          type: 'entity',
          contextFromId: 'test:containerA', // Links to Container A
        },
        {
          id: 'test:itemB1',
          displayName: 'Item B1',
          type: 'entity',
          contextFromId: 'test:containerB', // Links to Container B
        },
      ],
    };

    // Mock entity manager (not used in formatting)
    const mockEntityManager = {
      getEntityInstance: () => null,
    };

    // Act: Format the actions
    const result = formatter.formatMultiTarget(
      actionDef,
      resolvedTargets,
      mockEntityManager,
      { debug: false },
      { targetDefinitions: actionDef.targets }
    );

    // Assert: Formatting should succeed
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.value)).toBe(true);

    // Assert: Should have exactly 3 valid actions (2 from containerA + 1 from containerB)
    expect(result.value).toHaveLength(3);

    // Extract commands and validate proper pairing
    const commands = result.value.map((item) => item.command);

    // Assert: Valid combinations should exist
    expect(commands).toContain('take Item A1 from Container A');
    expect(commands).toContain('take Item A2 from Container A');
    expect(commands).toContain('take Item B1 from Container B');

    // Assert: CRITICAL - Invalid combinations should NOT exist
    expect(commands).not.toContain('take Item A1 from Container B');
    expect(commands).not.toContain('take Item A2 from Container B');
    expect(commands).not.toContain('take Item B1 from Container A');

    // Assert: Verify targets are properly linked
    result.value.forEach((formattedAction) => {
      // Verify that targets structure exists
      expect(formattedAction.targets).toBeDefined();
      expect(formattedAction.targets.primary).toBeDefined();
      expect(formattedAction.targets.secondary).toBeDefined();

      // Note: MultiTargetActionFormatter returns targets as arrays
      const primary = Array.isArray(formattedAction.targets.primary)
        ? formattedAction.targets.primary[0]
        : formattedAction.targets.primary;
      const secondary = Array.isArray(formattedAction.targets.secondary)
        ? formattedAction.targets.secondary[0]
        : formattedAction.targets.secondary;

      const primaryId = primary.id || primary.entityId;
      const secondaryId = secondary.id || secondary.entityId;

      // Find the secondary target definition in our original resolved targets
      const secondaryTarget = resolvedTargets.secondary.find(
        (t) => t.id === secondaryId || t.entityId === secondaryId
      );

      // Verify the contextFromId matches the primary target
      expect(secondaryTarget).toBeDefined();
      expect(secondaryTarget.contextFromId).toBe(primaryId);

      // CRITICAL: This proves no invalid cross-contamination occurred
      // If itemA1 is paired with containerA, itemA1's contextFromId must be containerA
      // If itemB1 is paired with containerB, itemB1's contextFromId must be containerB
    });
  });
});
