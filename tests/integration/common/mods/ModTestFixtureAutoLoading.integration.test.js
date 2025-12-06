/**
 * @file Integration tests for ModTestFixture auto-loading with real mod files
 * @description Tests the auto-loading functionality against actual mod files in the codebase
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  ModTestFixture,
  ModActionTestFixture,
} from '../../../common/mods/ModTestFixture.js';
import { createTestBed } from '../../../common/testBed.js';

describe('ModTestFixture - Auto-Loading Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Real File Auto-Loading Tests', () => {
    it('should auto-load kissing:kiss_cheek files', async () => {
      const fixture = await ModTestFixture.forActionAutoLoad(
        'kissing',
        'kissing:kiss_cheek'
      );

      expect(fixture).toBeInstanceOf(ModActionTestFixture);
      expect(fixture.modId).toBe('kissing');
      expect(fixture.actionId).toBe('kissing:kiss_cheek');
      expect(fixture.ruleFile).toBeDefined();
      expect(fixture.conditionFile).toBeDefined();

      // Verify rule file structure
      expect(fixture.ruleFile.rule_id).toBe('handle_kiss_cheek');
      expect(fixture.ruleFile.event_type).toBe('core:attempt_action');
      expect(fixture.ruleFile.condition.condition_ref).toBe(
        'kissing:event-is-action-kiss-cheek'
      );

      // Verify condition file structure
      expect(fixture.conditionFile.id).toBe(
        'kissing:event-is-action-kiss-cheek'
      );
      expect(fixture.conditionFile.logic).toBeDefined();
    });

    it('should auto-load deference:kneel_before files', async () => {
      const fixture = await ModTestFixture.forActionAutoLoad(
        'deference',
        'deference:kneel_before'
      );

      expect(fixture).toBeInstanceOf(ModActionTestFixture);
      expect(fixture.modId).toBe('deference');
      expect(fixture.actionId).toBe('deference:kneel_before');
      expect(fixture.ruleFile).toBeDefined();
      expect(fixture.conditionFile).toBeDefined();

      // Verify the files are loaded correctly
      expect(fixture.ruleFile.rule_id).toBeDefined();
      expect(fixture.conditionFile.id).toBe(
        'deference:event-is-action-kneel-before'
      );
    });

    it('should auto-load violence:sucker_punch files', async () => {
      const fixture = await ModTestFixture.forActionAutoLoad(
        'violence',
        'violence:sucker_punch'
      );

      expect(fixture).toBeInstanceOf(ModActionTestFixture);
      expect(fixture.modId).toBe('violence');
      expect(fixture.actionId).toBe('violence:sucker_punch');
      expect(fixture.ruleFile).toBeDefined();
      expect(fixture.conditionFile).toBeDefined();

      // Verify file structure
      expect(fixture.ruleFile.rule_id).toBe('handle_sucker_punch');
      expect(fixture.conditionFile.id).toBe(
        'violence:event-is-action-sucker-punch'
      );
    });

    it('should auto-load sex-breastplay:fondle_breasts files', async () => {
      const fixture = await ModTestFixture.forActionAutoLoad(
        'sex-breastplay',
        'sex-breastplay:fondle_breasts'
      );

      expect(fixture).toBeInstanceOf(ModActionTestFixture);
      expect(fixture.modId).toBe('sex-breastplay');
      expect(fixture.actionId).toBe('sex-breastplay:fondle_breasts');
      expect(fixture.ruleFile).toBeDefined();
      expect(fixture.conditionFile).toBeDefined();

      // Verify file structure
      expect(fixture.ruleFile.rule_id).toBe('handle_fondle_breasts');
      expect(fixture.conditionFile.id).toBe(
        'sex-breastplay:event-is-action-fondle-breasts'
      );
    });

    it('should work with handle_ prefixed rule files', async () => {
      // Test with an action that has handle_ prefix in rule file
      const fixture = await ModTestFixture.forActionAutoLoad(
        'affection',
        'affection:massage_shoulders'
      );

      expect(fixture).toBeInstanceOf(ModActionTestFixture);
      expect(fixture.ruleFile.rule_id).toBe('handle_massage_shoulders');
      expect(fixture.conditionFile.id).toBe(
        'affection:event-is-action-massage-shoulders'
      );
    });
  });

  describe('Backward Compatibility with Real Files', () => {
    it('should work with enhanced forAction method (auto-loading)', async () => {
      const fixture = await ModTestFixture.forAction(
        'kissing',
        'kissing:kiss_cheek'
      );

      expect(fixture).toBeInstanceOf(ModActionTestFixture);
      expect(fixture.ruleFile).toBeDefined();
      expect(fixture.conditionFile).toBeDefined();
    });

    it('should work with enhanced forRule method (auto-loading)', async () => {
      const fixture = await ModTestFixture.forRule(
        'kissing',
        'kissing:kiss_cheek'
      );

      expect(fixture.ruleFile).toBeDefined();
      expect(fixture.conditionFile).toBeDefined();
    });
  });

  describe('Error Handling with Real File Scenarios', () => {
    it('should throw clear error for non-existent mod', async () => {
      await expect(
        ModTestFixture.forActionAutoLoad(
          'nonexistent_mod',
          'nonexistent:action'
        )
      ).rejects.toThrow(
        /Could not load rule file for nonexistent_mod:nonexistent:action/
      );
    });

    it('should throw clear error for non-existent action', async () => {
      await expect(
        ModTestFixture.forActionAutoLoad(
          'kissing',
          'kissing:nonexistent_action'
        )
      ).rejects.toThrow(
        /Could not load rule file for kissing:kissing:nonexistent_action/
      );
    });

    it('should provide helpful error messages with attempted paths', async () => {
      await expect(
        ModTestFixture.forActionAutoLoad(
          'kissing',
          'kissing:nonexistent_action'
        )
      ).rejects.toThrow(/Tried paths:/);

      await expect(
        ModTestFixture.forActionAutoLoad(
          'kissing',
          'kissing:nonexistent_action'
        )
      ).rejects.toThrow(/data\/mods\/kissing\/rules\//);

      await expect(
        ModTestFixture.forActionAutoLoad(
          'kissing',
          'kissing:nonexistent_action'
        )
      ).rejects.toThrow(/nonexistent_action\.rule\.json/);
    });
  });

  describe('Fixture Functionality with Auto-Loaded Files', () => {
    it('should create working test environment with auto-loaded files', async () => {
      const fixture = await ModTestFixture.forActionAutoLoad(
        'kissing',
        'kissing:kiss_cheek'
      );

      // Should be able to create standard actor-target setup
      const scenario = fixture.createStandardActorTarget(['Alice', 'Bob']);

      expect(scenario.actor).toBeDefined();
      expect(scenario.target).toBeDefined();
      expect(scenario.actor.id).toBe('actor1');
      expect(scenario.target.id).toBe('target1');
    });

    it('should execute actions correctly with auto-loaded files', async () => {
      const fixture = await ModTestFixture.forActionAutoLoad(
        'kissing',
        'kissing:kiss_cheek'
      );

      // Create test scenario
      const scenario = fixture.createStandardActorTarget(['Alice', 'Bob']);

      // Execute the action
      await fixture.executeAction(scenario.actor.id, scenario.target.id);

      // Verify events were generated
      expect(fixture.events.length).toBeGreaterThan(0);

      // Should have success event (turn_ended with success: true)
      const successEvents = fixture.events.filter(
        (e) => e.eventType === 'core:turn_ended' && e.payload?.success === true
      );
      expect(successEvents.length).toBeGreaterThan(0);
    });

    it('should handle assertion helpers correctly with auto-loaded files', async () => {
      const fixture = await ModTestFixture.forActionAutoLoad(
        'kissing',
        'kissing:kiss_cheek'
      );

      const scenario = fixture.createStandardActorTarget(['Alice', 'Bob']);
      await fixture.executeAction(scenario.actor.id, scenario.target.id);

      // Should be able to assert action success (this contains internal assertions)
      fixture.assertActionSuccess("Alice leans in to kiss Bob's cheek softly.");

      // Explicit assertion to satisfy linter
      expect(fixture.events.length).toBeGreaterThan(0);
    });
  });

  describe('Performance with Auto-Loading', () => {
    it('should load files efficiently for multiple fixture creations', async () => {
      const startTime = Date.now();

      // Create multiple fixtures with auto-loading
      const fixtures = await Promise.all([
        ModTestFixture.forActionAutoLoad('kissing', 'kissing:kiss_cheek'),
        ModTestFixture.forActionAutoLoad('deference', 'deference:kneel_before'),
        ModTestFixture.forActionAutoLoad('violence', 'violence:sucker_punch'),
      ]);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete reasonably quickly (within 1 second)
      expect(duration).toBeLessThan(1000);

      // All fixtures should be created successfully
      expect(fixtures).toHaveLength(3);
      fixtures.forEach((fixture) => {
        expect(fixture).toBeInstanceOf(ModActionTestFixture);
      });
    });
  });

  describe('Mixed Usage Patterns', () => {
    it('should handle mixed auto-loading and explicit file provision', async () => {
      // First, get files through auto-loading to verify they exist
      const autoLoadedFixture = await ModTestFixture.forActionAutoLoad(
        'kissing',
        'kissing:kiss_cheek'
      );

      // Then create another fixture with explicit files
      const explicitFixture = await ModTestFixture.forAction(
        'kissing',
        'kissing:kiss_cheek',
        autoLoadedFixture.ruleFile,
        autoLoadedFixture.conditionFile
      );

      // Both should work identically
      expect(explicitFixture.ruleFile).toEqual(autoLoadedFixture.ruleFile);
      expect(explicitFixture.conditionFile).toEqual(
        autoLoadedFixture.conditionFile
      );
    });

    it('should handle partial auto-loading (only condition file)', async () => {
      // Get the rule file first
      const autoLoadedFixture = await ModTestFixture.forActionAutoLoad(
        'kissing',
        'kissing:kiss_cheek'
      );

      // Create fixture with explicit rule file but auto-loaded condition file
      const mixedFixture = await ModTestFixture.forAction(
        'kissing',
        'kissing:kiss_cheek',
        autoLoadedFixture.ruleFile,
        null // Should auto-load condition file
      );

      expect(mixedFixture.ruleFile).toEqual(autoLoadedFixture.ruleFile);
      expect(mixedFixture.conditionFile).toEqual(
        autoLoadedFixture.conditionFile
      );
    });

    it('should handle partial auto-loading (only rule file)', async () => {
      // Get the condition file first
      const autoLoadedFixture = await ModTestFixture.forActionAutoLoad(
        'kissing',
        'kissing:kiss_cheek'
      );

      // Create fixture with explicit condition file but auto-loaded rule file
      const mixedFixture = await ModTestFixture.forAction(
        'kissing',
        'kissing:kiss_cheek',
        null, // Should auto-load rule file
        autoLoadedFixture.conditionFile
      );

      expect(mixedFixture.ruleFile).toEqual(autoLoadedFixture.ruleFile);
      expect(mixedFixture.conditionFile).toEqual(
        autoLoadedFixture.conditionFile
      );
    });
  });

  describe('Path Convention Validation', () => {
    it('should correctly predict paths for existing files', () => {
      const { rulePaths, conditionPaths } = ModTestFixture.getConventionalPaths(
        'kissing',
        'kissing:kiss_cheek'
      );

      // Verify the correct paths are included
      expect(rulePaths).toContain(
        'data/mods/kissing/rules/kiss_cheek.rule.json'
      );
      expect(conditionPaths).toContain(
        'data/mods/kissing/conditions/event-is-action-kiss-cheek.condition.json'
      );
    });

    it('should correctly predict paths for handle_ prefixed rules', () => {
      const { rulePaths } = ModTestFixture.getConventionalPaths(
        'affection',
        'affection:massage_shoulders'
      );

      expect(rulePaths).toContain(
        'data/mods/affection/rules/handle_massage_shoulders.rule.json'
      );
    });

    it('should correctly handle hyphenation for condition files', () => {
      const { conditionPaths } = ModTestFixture.getConventionalPaths(
        'kissing',
        'kissing:nibble_earlobe_playfully'
      );

      expect(conditionPaths).toContain(
        'data/mods/kissing/conditions/event-is-action-nibble-earlobe-playfully.condition.json'
      );
    });
  });
});
