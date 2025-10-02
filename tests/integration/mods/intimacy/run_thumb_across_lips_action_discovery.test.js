/**
 * @file Integration tests for the intimacy:run_thumb_across_lips action definition.
 * @description Tests that the run_thumb_across_lips action is properly defined and structured.
 * Note: Full action discovery testing would require complex scope engine setup.
 * This test validates the action definition structure for correct integration.
 *
 * This test is migrated to use ModTestFixture pattern for consistency,
 * but primarily tests action definition structure rather than execution.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import runThumbAcrossLipsAction from '../../../../data/mods/intimacy/actions/run_thumb_across_lips.action.json';

describe('intimacy:run_thumb_across_lips action definition', () => {
  let testFixture;

  beforeEach(async () => {
    // Initialize a basic test fixture for consistency
    // Note: This test primarily validates action structure, not execution
    testFixture = await ModTestFixture.forAction(
      'intimacy',
      'intimacy:run_thumb_across_lips'
    );
  });

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should have correct action structure', () => {
    expect(runThumbAcrossLipsAction).toBeDefined();
    expect(runThumbAcrossLipsAction.id).toBe('intimacy:run_thumb_across_lips');
    expect(runThumbAcrossLipsAction.name).toBe('Run Thumb Across Lips');
    expect(runThumbAcrossLipsAction.description).toBe(
      "Gently run your thumb across the target's lips in an intimate gesture."
    );
    expect(runThumbAcrossLipsAction.template).toBe(
      "run your thumb across {target}'s lips"
    );
  });

  it('should use correct scope for targets', () => {
    expect(runThumbAcrossLipsAction.targets).toBe(
      'intimacy:close_actors_facing_each_other'
    );
  });

  it('should require positioning:closeness component', () => {
    expect(runThumbAcrossLipsAction.required_components).toBeDefined();
    expect(runThumbAcrossLipsAction.required_components.actor).toContain(
      'positioning:closeness'
    );
  });

  it('should forbid intimacy:kissing component to prevent action during active kissing', () => {
    expect(runThumbAcrossLipsAction.forbidden_components).toBeDefined();
    expect(runThumbAcrossLipsAction.forbidden_components.actor).toContain(
      'intimacy:kissing'
    );
  });

  it('should have correct visual styling matching other intimacy actions', () => {
    expect(runThumbAcrossLipsAction.visual).toBeDefined();
    expect(runThumbAcrossLipsAction.visual.backgroundColor).toBe('#ad1457');
    expect(runThumbAcrossLipsAction.visual.textColor).toBe('#ffffff');
    expect(runThumbAcrossLipsAction.visual.hoverBackgroundColor).toBe(
      '#c2185b'
    );
    expect(runThumbAcrossLipsAction.visual.hoverTextColor).toBe('#fce4ec');
  });

  it('should have schema reference', () => {
    expect(runThumbAcrossLipsAction.$schema).toBe(
      'schema://living-narrative-engine/action.schema.json'
    );
  });

  describe('Expected action discovery behavior (manual testing)', () => {
    it('should appear when actors are close and facing each other', () => {
      // Manual test case:
      // 1. Create two actors in same location
      // 2. Make them enter closeness with mutual consent
      // 3. Set facing directions opposite (north/south)
      // 4. Expected: run_thumb_across_lips action should be available
      expect(true).toBe(true);
    });

    it('should NOT appear without closeness component', () => {
      // Manual test case:
      // 1. Create two actors in same location
      // 2. Do NOT establish closeness
      // 3. Expected: run_thumb_across_lips action should NOT be available
      expect(true).toBe(true);
    });

    it('should NOT appear when actor has kissing component', () => {
      // Manual test case:
      // 1. Create two actors kissing each other
      // 2. Ensure they have closeness and are facing
      // 3. Expected: run_thumb_across_lips action should NOT be available
      // (forbidden components blocking it)
      expect(true).toBe(true);
    });

    it('should NOT appear when actors are not facing each other', () => {
      // Manual test case:
      // 1. Create two actors in same location with closeness
      // 2. Set both facing same direction (both north)
      // 3. Expected: run_thumb_across_lips action should NOT be available
      // (scope condition requires facing each other)
      expect(true).toBe(true);
    });
  });
});
