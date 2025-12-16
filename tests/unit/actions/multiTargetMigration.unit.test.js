/**
 * @file Unit test for multi-target action migration
 * @description Verifies that migrated actions work correctly with both legacy and new formats
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { LegacyTargetCompatibilityLayer } from '../../../src/actions/pipeline/services/implementations/LegacyTargetCompatibilityLayer.js';
import { createMockLogger } from '../../common/mockFactories/index.js';

// Import migrated actions
import followAction from '../../../data/mods/companionship/actions/follow.action.json';
import stopFollowingAction from '../../../data/mods/companionship/actions/stop_following.action.json';
import waitAction from '../../../data/mods/core/actions/wait.action.json';

describe('Multi-Target Migration Unit Tests', () => {
  let compatibilityLayer;
  let logger;

  beforeEach(() => {
    logger = createMockLogger();
    compatibilityLayer = new LegacyTargetCompatibilityLayer({ logger });
  });

  describe('Action Format Verification', () => {
    it('should have targets property instead of scope for follow action', () => {
      expect(followAction.targets).toBeDefined();
      expect(followAction.scope).toBeUndefined();
      expect(followAction.targets).toEqual({
        primary: {
          scope: 'companionship:potential_leaders',
          placeholder: 'target',
          description: 'The leader to follow',
        },
      });
    });

    it('should have targets property instead of scope for stop_following action', () => {
      expect(stopFollowingAction.targets).toBeDefined();
      expect(stopFollowingAction.scope).toBeUndefined();
      expect(stopFollowingAction.targets).toBe('none');
    });

    it('should have targets property instead of scope for wait action', () => {
      expect(waitAction.targets).toBeDefined();
      expect(waitAction.scope).toBeUndefined();
      expect(waitAction.targets).toBe('none');
    });
  });

  describe('LegacyTargetCompatibilityLayer Handling', () => {
    it('should recognize object targets as modern format', () => {
      const isLegacy = compatibilityLayer.isLegacyAction(followAction);
      expect(isLegacy).toBe(false); // Object targets are modern format
    });

    it('should handle modern object format without conversion', () => {
      const mockActor = { id: 'test-actor' };
      // followAction now has object-based targets, so it shouldn't need conversion
      const isLegacy = compatibilityLayer.isLegacyAction(followAction);
      expect(isLegacy).toBe(false);

      // Verify the modern format structure
      expect(followAction.targets.primary).toBeDefined();
      expect(followAction.targets.primary.scope).toBe(
        'companionship:potential_leaders'
      );
      expect(followAction.targets.primary.placeholder).toBe('target');
    });

    it('should handle "none" targets specially', () => {
      const mockActor = { id: 'test-actor' };
      const result = compatibilityLayer.convertLegacyFormat(
        waitAction,
        mockActor
      );

      expect(result.isLegacy).toBe(true);
      expect(result.targetDefinitions.primary.scope).toBe('none');
      expect(result.targetDefinitions.primary.optional).toBe(true);
    });
  });

  describe('Template Preservation', () => {
    it('should preserve original template placeholders', () => {
      expect(followAction.template).toBe('follow {target}');
      expect(stopFollowingAction.template).toBe('stop following');
      expect(waitAction.template).toBe('wait');
    });
  });

  describe('Prerequisites Preservation', () => {
    it('should preserve all prerequisites for follow action', () => {
      expect(followAction.prerequisites).toHaveLength(3);
      expect(followAction.prerequisites[0].logic.condition_ref).toBe(
        'movement:actor-can-move'
      );
      expect(followAction.prerequisites[1].logic.not.condition_ref).toBe(
        'companionship:actor-is-following'
      );
      expect(followAction.prerequisites[2].logic.isActorLocationLit).toEqual([
        'actor',
      ]);
    });

    it('should preserve all prerequisites for stop_following action', () => {
      expect(stopFollowingAction.prerequisites).toHaveLength(1);
      expect(stopFollowingAction.prerequisites[0].logic.condition_ref).toBe(
        'companionship:actor-is-following'
      );
    });

    it('should have no prerequisites for wait action', () => {
      expect(waitAction.prerequisites).toHaveLength(0);
    });
  });

  describe('Action Properties Preservation', () => {
    it('should preserve all action properties after migration', () => {
      // Follow action
      expect(followAction.id).toBe('companionship:follow');
      expect(followAction.name).toBe('Follow');
      expect(followAction.description).toContain('follow the specified target');
      expect(followAction.required_components).toEqual({});

      // Stop following action
      expect(stopFollowingAction.id).toBe('companionship:stop_following');
      expect(stopFollowingAction.name).toBe('Stop Following');
      expect(stopFollowingAction.description).toContain('Stops following');
      expect(stopFollowingAction.required_components).toEqual({
        actor: ['companionship:following'],
      });

      // Wait action
      expect(waitAction.id).toBe('core:wait');
      expect(waitAction.name).toBe('Wait');
      expect(waitAction.description).toContain('Wait for a moment');
    });
  });
});
