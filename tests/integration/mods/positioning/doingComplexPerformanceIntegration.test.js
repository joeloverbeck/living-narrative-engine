/**
 * @file Integration tests for positioning mod doing_complex_performance component
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Positioning Mod - doing_complex_performance Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  afterEach(() => {
    if (testBed && typeof testBed.cleanup === 'function') {
      testBed.cleanup();
    }
  });

  describe('Component Loading', () => {
    it('should load doing_complex_performance component with positioning mod', async () => {
      const { modLoader } = testBed.getServices();

      await modLoader.loadMod('positioning');

      const { componentRegistry } = testBed.getServices();
      expect(componentRegistry.has('positioning:doing_complex_performance')).toBe(true);
    });

    it('should be listed in positioning mod manifest', async () => {
      const { modLoader } = testBed.getServices();

      const manifest = await modLoader.loadModManifest('positioning');

      expect(manifest.content.components).toContain('doing_complex_performance.component.json');
    });
  });

  describe('Component Application', () => {
    it('should add doing_complex_performance marker to an entity', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      const entityId = entityManager.createEntity();
      componentMutationService.addComponent(entityId, 'positioning:doing_complex_performance', {});

      const hasComponent = componentMutationService.hasComponent(
        entityId,
        'positioning:doing_complex_performance'
      );
      expect(hasComponent).toBe(true);
    });

    it('should retrieve empty data for marker component', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      const entityId = entityManager.createEntity();
      componentMutationService.addComponent(entityId, 'positioning:doing_complex_performance', {});

      const data = componentMutationService.getComponentData(
        entityId,
        'positioning:doing_complex_performance'
      );
      expect(data).toEqual({});
    });

    it('should remove doing_complex_performance component successfully', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      const entityId = entityManager.createEntity();
      componentMutationService.addComponent(entityId, 'positioning:doing_complex_performance', {});

      componentMutationService.removeComponent(entityId, 'positioning:doing_complex_performance');

      const hasComponent = componentMutationService.hasComponent(
        entityId,
        'positioning:doing_complex_performance'
      );
      expect(hasComponent).toBe(false);
    });
  });

  describe('Cross-Mod Integration with Music Mod', () => {
    it('should work alongside music mod components', async () => {
      const { modLoader, entityManager, componentMutationService } = testBed.getServices();

      // Load both mods
      await modLoader.loadMod('positioning');
      await modLoader.loadMod('music');

      const musicianId = entityManager.createEntity();
      const instrumentId = entityManager.createEntity();

      // Add music components
      componentMutationService.addComponent(musicianId, 'music:is_musician', {});
      componentMutationService.addComponent(instrumentId, 'music:is_instrument', {});
      componentMutationService.addComponent(musicianId, 'music:playing_music', {
        playing_on: instrumentId,
      });
      componentMutationService.addComponent(musicianId, 'music:performance_mood', {
        mood: 'cheerful',
      });

      // Add positioning component to mark complex performance
      componentMutationService.addComponent(musicianId, 'positioning:doing_complex_performance', {});

      // Verify all components coexist
      expect(componentMutationService.hasComponent(musicianId, 'music:playing_music')).toBe(true);
      expect(componentMutationService.hasComponent(musicianId, 'music:performance_mood')).toBe(
        true
      );
      expect(
        componentMutationService.hasComponent(musicianId, 'positioning:doing_complex_performance')
      ).toBe(true);
    });

    it('should support multiple entities with complex performance marker', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      const performer1 = entityManager.createEntity();
      const performer2 = entityManager.createEntity();
      const performer3 = entityManager.createEntity();

      // Add marker to all performers
      componentMutationService.addComponent(performer1, 'positioning:doing_complex_performance', {});
      componentMutationService.addComponent(performer2, 'positioning:doing_complex_performance', {});
      componentMutationService.addComponent(performer3, 'positioning:doing_complex_performance', {});

      // Verify all have the component
      expect(
        componentMutationService.hasComponent(performer1, 'positioning:doing_complex_performance')
      ).toBe(true);
      expect(
        componentMutationService.hasComponent(performer2, 'positioning:doing_complex_performance')
      ).toBe(true);
      expect(
        componentMutationService.hasComponent(performer3, 'positioning:doing_complex_performance')
      ).toBe(true);
    });
  });

  describe('No Regression in Existing Positioning Functionality', () => {
    it('should not affect existing positioning components', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      const entityId = entityManager.createEntity();

      // Add existing positioning components
      componentMutationService.addComponent(entityId, 'positioning:hugging', {
        hugging: 'other_entity',
      });

      // Add new component
      componentMutationService.addComponent(entityId, 'positioning:doing_complex_performance', {});

      // Verify both work together
      expect(componentMutationService.hasComponent(entityId, 'positioning:hugging')).toBe(true);
      expect(
        componentMutationService.hasComponent(entityId, 'positioning:doing_complex_performance')
      ).toBe(true);
    });

    it('should coexist with other positioning state components', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      const entityId = entityManager.createEntity();
      const targetId = 'target_entity';

      // Add various positioning components
      componentMutationService.addComponent(entityId, 'positioning:closeness', {
        distance: 'close',
        relativeTo: targetId,
      });

      componentMutationService.addComponent(entityId, 'positioning:facing_away', {
        facing_away_from: targetId,
      });

      componentMutationService.addComponent(entityId, 'positioning:doing_complex_performance', {});

      // Verify all coexist
      expect(componentMutationService.hasComponent(entityId, 'positioning:closeness')).toBe(true);
      expect(componentMutationService.hasComponent(entityId, 'positioning:facing_away')).toBe(true);
      expect(
        componentMutationService.hasComponent(entityId, 'positioning:doing_complex_performance')
      ).toBe(true);
    });
  });
});
