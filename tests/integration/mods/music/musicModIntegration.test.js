/**
 * @file Integration tests for music mod component integration and loading
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Music Mod - Integration Tests', () => {
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
    it('should load music mod manifest correctly', async () => {
      const { modLoader } = testBed.getServices();

      // Load music mod
      const manifest = await modLoader.loadModManifest('music');

      expect(manifest).toBeDefined();
      expect(manifest.id).toBe('music');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.name).toBe('Music Performance System');
    });

    it('should have correct dependencies', async () => {
      const { modLoader } = testBed.getServices();

      const manifest = await modLoader.loadModManifest('music');

      expect(manifest.dependencies).toBeDefined();
      expect(manifest.dependencies.length).toBeGreaterThanOrEqual(2);

      const dependencyIds = manifest.dependencies.map((dep) => dep.id);
      expect(dependencyIds).toContain('positioning');
      expect(dependencyIds).toContain('core');
    });

    it('should list all music mod components in manifest', async () => {
      const { modLoader } = testBed.getServices();

      const manifest = await modLoader.loadModManifest('music');

      expect(manifest.content.components).toContain('is_musician.component.json');
      expect(manifest.content.components).toContain('is_instrument.component.json');
      expect(manifest.content.components).toContain('playing_music.component.json');
      expect(manifest.content.components).toContain('performance_mood.component.json');
      expect(manifest.content.components.length).toBe(4);
    });

    it('should load all music mod components successfully', async () => {
      const { componentRegistry, modLoader } = testBed.getServices();

      await modLoader.loadMod('music');

      expect(componentRegistry.has('music:is_musician')).toBe(true);
      expect(componentRegistry.has('music:is_instrument')).toBe(true);
      expect(componentRegistry.has('music:playing_music')).toBe(true);
      expect(componentRegistry.has('music:performance_mood')).toBe(true);
    });
  });

  describe('Component Application - is_musician', () => {
    it('should add is_musician component to an entity', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      const entityId = entityManager.createEntity();
      componentMutationService.addComponent(entityId, 'music:is_musician', {});

      const hasComponent = componentMutationService.hasComponent(entityId, 'music:is_musician');
      expect(hasComponent).toBe(true);
    });

    it('should retrieve empty data for is_musician marker component', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      const entityId = entityManager.createEntity();
      componentMutationService.addComponent(entityId, 'music:is_musician', {});

      const data = componentMutationService.getComponentData(entityId, 'music:is_musician');
      expect(data).toEqual({});
    });
  });

  describe('Component Application - is_instrument', () => {
    it('should add is_instrument component to an entity', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      const entityId = entityManager.createEntity();
      componentMutationService.addComponent(entityId, 'music:is_instrument', {});

      const hasComponent = componentMutationService.hasComponent(entityId, 'music:is_instrument');
      expect(hasComponent).toBe(true);
    });

    it('should retrieve empty data for is_instrument marker component', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      const entityId = entityManager.createEntity();
      componentMutationService.addComponent(entityId, 'music:is_instrument', {});

      const data = componentMutationService.getComponentData(entityId, 'music:is_instrument');
      expect(data).toEqual({});
    });
  });

  describe('Component Application - playing_music', () => {
    it('should add playing_music component with valid instrument ID', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      const actorId = entityManager.createEntity();
      const instrumentId = 'instrument:guitar_001';

      componentMutationService.addComponent(actorId, 'music:playing_music', {
        playing_on: instrumentId,
      });

      const hasComponent = componentMutationService.hasComponent(actorId, 'music:playing_music');
      expect(hasComponent).toBe(true);
    });

    it('should store and retrieve correct instrument ID', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      const actorId = entityManager.createEntity();
      const instrumentId = 'instrument:guitar_001';

      componentMutationService.addComponent(actorId, 'music:playing_music', {
        playing_on: instrumentId,
      });

      const data = componentMutationService.getComponentData(actorId, 'music:playing_music');
      expect(data.playing_on).toBe(instrumentId);
    });

    it('should support activityMetadata for activity descriptions', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      const actorId = entityManager.createEntity();
      const instrumentId = 'instrument:guitar_001';

      componentMutationService.addComponent(actorId, 'music:playing_music', {
        playing_on: instrumentId,
        activityMetadata: {
          shouldDescribeInActivity: true,
          template: '{actor} is playing {target}',
          targetRole: 'playing_on',
          priority: 70,
        },
      });

      const data = componentMutationService.getComponentData(actorId, 'music:playing_music');
      expect(data.activityMetadata).toBeDefined();
      expect(data.activityMetadata.priority).toBe(70);
    });

    it('should remove playing_music component successfully', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      const actorId = entityManager.createEntity();
      const instrumentId = 'instrument:guitar_001';

      componentMutationService.addComponent(actorId, 'music:playing_music', {
        playing_on: instrumentId,
      });

      componentMutationService.removeComponent(actorId, 'music:playing_music');

      const hasComponent = componentMutationService.hasComponent(actorId, 'music:playing_music');
      expect(hasComponent).toBe(false);
    });
  });

  describe('Component Application - performance_mood', () => {
    it('should add performance_mood component with valid mood', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      const actorId = entityManager.createEntity();

      componentMutationService.addComponent(actorId, 'music:performance_mood', {
        mood: 'cheerful',
      });

      const hasComponent = componentMutationService.hasComponent(
        actorId,
        'music:performance_mood'
      );
      expect(hasComponent).toBe(true);
    });

    it('should store and retrieve correct mood value', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      const actorId = entityManager.createEntity();

      componentMutationService.addComponent(actorId, 'music:performance_mood', {
        mood: 'solemn',
      });

      const data = componentMutationService.getComponentData(actorId, 'music:performance_mood');
      expect(data.mood).toBe('solemn');
    });

    it('should support all valid mood enum values', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      const validMoods = [
        'cheerful',
        'solemn',
        'mournful',
        'eerie',
        'tense',
        'triumphant',
        'tender',
        'playful',
        'aggressive',
        'meditative',
      ];

      validMoods.forEach((mood) => {
        const actorId = entityManager.createEntity();

        componentMutationService.addComponent(actorId, 'music:performance_mood', { mood });

        const data = componentMutationService.getComponentData(actorId, 'music:performance_mood');
        expect(data.mood).toBe(mood);
      });
    });

    it('should support activityMetadata for mood descriptions', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      const actorId = entityManager.createEntity();

      componentMutationService.addComponent(actorId, 'music:performance_mood', {
        mood: 'triumphant',
        activityMetadata: {
          shouldDescribeInActivity: true,
          template: '{actor} performs with {mood} mood',
          priority: 65,
        },
      });

      const data = componentMutationService.getComponentData(actorId, 'music:performance_mood');
      expect(data.activityMetadata).toBeDefined();
      expect(data.activityMetadata.priority).toBe(65);
    });
  });

  describe('Musical Performance Workflow', () => {
    it('should create a complete musical performance state', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      // Create musician entity
      const musicianId = entityManager.createEntity();
      componentMutationService.addComponent(musicianId, 'music:is_musician', {});

      // Create instrument entity
      const instrumentId = entityManager.createEntity();
      componentMutationService.addComponent(instrumentId, 'music:is_instrument', {});

      // Start playing
      componentMutationService.addComponent(musicianId, 'music:playing_music', {
        playing_on: instrumentId,
      });

      componentMutationService.addComponent(musicianId, 'music:performance_mood', {
        mood: 'cheerful',
      });

      // Add complex performance marker from positioning mod
      componentMutationService.addComponent(
        musicianId,
        'positioning:doing_complex_performance',
        {}
      );

      // Verify all components are present
      expect(componentMutationService.hasComponent(musicianId, 'music:is_musician')).toBe(true);
      expect(componentMutationService.hasComponent(musicianId, 'music:playing_music')).toBe(true);
      expect(componentMutationService.hasComponent(musicianId, 'music:performance_mood')).toBe(
        true
      );
      expect(
        componentMutationService.hasComponent(musicianId, 'positioning:doing_complex_performance')
      ).toBe(true);
      expect(componentMutationService.hasComponent(instrumentId, 'music:is_instrument')).toBe(
        true
      );
    });

    it('should support multiple musicians performing simultaneously', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      // Create two musicians
      const musician1Id = entityManager.createEntity();
      const musician2Id = entityManager.createEntity();

      componentMutationService.addComponent(musician1Id, 'music:is_musician', {});
      componentMutationService.addComponent(musician2Id, 'music:is_musician', {});

      // Create two instruments
      const guitar = entityManager.createEntity();
      const piano = entityManager.createEntity();

      componentMutationService.addComponent(guitar, 'music:is_instrument', {});
      componentMutationService.addComponent(piano, 'music:is_instrument', {});

      // Both start playing with different moods
      componentMutationService.addComponent(musician1Id, 'music:playing_music', {
        playing_on: guitar,
      });
      componentMutationService.addComponent(musician1Id, 'music:performance_mood', {
        mood: 'cheerful',
      });

      componentMutationService.addComponent(musician2Id, 'music:playing_music', {
        playing_on: piano,
      });
      componentMutationService.addComponent(musician2Id, 'music:performance_mood', {
        mood: 'solemn',
      });

      // Verify both are performing independently
      const musician1Data = componentMutationService.getComponentData(
        musician1Id,
        'music:playing_music'
      );
      const musician2Data = componentMutationService.getComponentData(
        musician2Id,
        'music:playing_music'
      );

      expect(musician1Data.playing_on).toBe(guitar);
      expect(musician2Data.playing_on).toBe(piano);

      const mood1 = componentMutationService.getComponentData(
        musician1Id,
        'music:performance_mood'
      );
      const mood2 = componentMutationService.getComponentData(
        musician2Id,
        'music:performance_mood'
      );

      expect(mood1.mood).toBe('cheerful');
      expect(mood2.mood).toBe('solemn');
    });

    it('should allow changing performance mood during performance', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      const musicianId = entityManager.createEntity();
      const instrumentId = entityManager.createEntity();

      componentMutationService.addComponent(musicianId, 'music:is_musician', {});
      componentMutationService.addComponent(instrumentId, 'music:is_instrument', {});

      // Start playing with cheerful mood
      componentMutationService.addComponent(musicianId, 'music:playing_music', {
        playing_on: instrumentId,
      });
      componentMutationService.addComponent(musicianId, 'music:performance_mood', {
        mood: 'cheerful',
      });

      // Change to solemn mood
      componentMutationService.updateComponentData(musicianId, 'music:performance_mood', {
        mood: 'solemn',
      });

      const moodData = componentMutationService.getComponentData(
        musicianId,
        'music:performance_mood'
      );
      expect(moodData.mood).toBe('solemn');
    });

    it('should clean up all performance components when stopping', () => {
      const { entityManager, componentMutationService } = testBed.getServices();

      const musicianId = entityManager.createEntity();
      const instrumentId = entityManager.createEntity();

      componentMutationService.addComponent(musicianId, 'music:is_musician', {});
      componentMutationService.addComponent(instrumentId, 'music:is_instrument', {});

      // Start playing
      componentMutationService.addComponent(musicianId, 'music:playing_music', {
        playing_on: instrumentId,
      });
      componentMutationService.addComponent(musicianId, 'music:performance_mood', {
        mood: 'cheerful',
      });
      componentMutationService.addComponent(
        musicianId,
        'positioning:doing_complex_performance',
        {}
      );

      // Stop playing - remove all performance components
      componentMutationService.removeComponent(musicianId, 'music:playing_music');
      componentMutationService.removeComponent(musicianId, 'music:performance_mood');
      componentMutationService.removeComponent(musicianId, 'positioning:doing_complex_performance');

      // Verify performance components are removed
      expect(componentMutationService.hasComponent(musicianId, 'music:playing_music')).toBe(false);
      expect(componentMutationService.hasComponent(musicianId, 'music:performance_mood')).toBe(
        false
      );
      expect(
        componentMutationService.hasComponent(musicianId, 'positioning:doing_complex_performance')
      ).toBe(false);

      // Musician marker should remain
      expect(componentMutationService.hasComponent(musicianId, 'music:is_musician')).toBe(true);
    });
  });
});
