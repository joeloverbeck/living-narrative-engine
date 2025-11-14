/**
 * @file Unit tests for GoapPlanner task library construction
 * @see src/goap/planner/goapPlanner.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import GoapPlanner from '../../../../src/goap/planner/goapPlanner.js';
import { createTestBed } from '../../../common/testBed.js';

describe('GoapPlanner - Task Library Construction', () => {
  let testBed;
  let planner;
  let mockLogger;
  let mockJsonLogicService;
  let mockRepository;
  let mockEntityManager;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockJsonLogicService = testBed.createMock('jsonLogicService', [
      'evaluateCondition',
    ]);
    mockRepository = testBed.createMock('repository', ['get']);
    mockEntityManager = testBed.createMock('entityManager', ['getEntityInstance']);

    // Default mock implementations
    mockRepository.get.mockImplementation(key => {
      if (key === 'tasks') {
        return {
          core: {
            'core:consume_item': {
              id: 'core:consume_item',
              structuralGates: {
                condition: { has_component: ['actor', 'core:digestive_system'] },
              },
            },
            'core:move': {
              id: 'core:move',
              // No structural gates
            },
            'core:play_music': {
              id: 'core:play_music',
              structuralGates: {
                condition: {
                  and: [
                    { has_component: ['actor', 'core:musician'] },
                    { '>': [{ var: 'actor.core:skill_level' }, 0] },
                  ],
                },
              },
            },
          },
        };
      }
      return null;
    });

    mockEntityManager.getEntityInstance.mockReturnValue({
      id: 'actor-123',
      components: {
        'core:digestive_system': {},
        'core:musician': {},
        'core:skill_level': 5,
      },
    });

    planner = new GoapPlanner({
      logger: mockLogger,
      jsonLogicService: mockJsonLogicService,
      gameDataRepository: mockRepository,
      entityManager: mockEntityManager,
    });
  });

  describe('Basic Filtering', () => {
    it('should return all tasks when actor passes all gates', () => {
      mockJsonLogicService.evaluateCondition.mockReturnValue(true);

      const tasks = planner.testGetTaskLibrary('actor-123');

      expect(tasks).toHaveLength(3);
      expect(tasks.map(t => t.id)).toContain('core:consume_item');
      expect(tasks.map(t => t.id)).toContain('core:move');
      expect(tasks.map(t => t.id)).toContain('core:play_music');
    });

    it('should exclude tasks when actor fails gates', () => {
      mockJsonLogicService.evaluateCondition
        .mockReturnValueOnce(false) // consume_item fails
        .mockReturnValueOnce(false); // play_music fails

      const tasks = planner.testGetTaskLibrary('actor-123');

      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('core:move');
    });

    it('should include tasks without structural gates', () => {
      mockJsonLogicService.evaluateCondition.mockReturnValue(false);

      const tasks = planner.testGetTaskLibrary('actor-123');

      // Only core:move should pass (has no gates)
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('core:move');
    });

    it('should return empty array when no tasks available', () => {
      mockRepository.get.mockReturnValue(null);

      const tasks = planner.testGetTaskLibrary('actor-123');

      expect(tasks).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No tasks available in repository'
      );
    });

    it('should return empty array when actor not found', () => {
      mockEntityManager.getEntityInstance.mockReturnValue(null);

      const tasks = planner.testGetTaskLibrary('actor-123');

      expect(tasks).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Actor not found')
      );
    });
  });

  describe('Task Retrieval', () => {
    it('should correctly flatten tasks from nested mod structure', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:task1': { id: 'core:task1' },
          'core:task2': { id: 'core:task2' },
        },
        music: {
          'music:task1': { id: 'music:task1' },
        },
      });
      mockJsonLogicService.evaluateCondition.mockReturnValue(true);

      const tasks = planner.testGetTaskLibrary('actor-123');

      expect(tasks).toHaveLength(3);
      expect(tasks.map(t => t.id)).toContain('core:task1');
      expect(tasks.map(t => t.id)).toContain('core:task2');
      expect(tasks.map(t => t.id)).toContain('music:task1');
    });

    it('should handle empty tasks data gracefully', () => {
      mockRepository.get.mockReturnValue({});

      const tasks = planner.testGetTaskLibrary('actor-123');

      expect(tasks).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No tasks found in repository data'
      );
    });

    it('should handle null/undefined tasks data', () => {
      mockRepository.get.mockReturnValue(undefined);

      const tasks = planner.testGetTaskLibrary('actor-123');

      expect(tasks).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'No tasks available in repository'
      );
    });
  });

  describe('Structural Gate Evaluation', () => {
    it('should evaluate has_component conditions correctly', () => {
      planner.testGetTaskLibrary('actor-123');

      // Verify evaluateCondition was called with correct context
      expect(mockJsonLogicService.evaluateCondition).toHaveBeenCalledWith(
        expect.objectContaining({
          has_component: expect.any(Array),
        }),
        expect.objectContaining({
          actor: expect.objectContaining({
            id: 'actor-123',
            components: expect.any(Object),
          }),
        })
      );
    });

    it('should evaluate complex AND/OR conditions', () => {
      mockJsonLogicService.evaluateCondition
        .mockReturnValueOnce(true) // consume_item passes
        .mockReturnValueOnce(true); // play_music passes

      planner.testGetTaskLibrary('actor-123');

      // Should evaluate complex AND condition for play_music
      expect(mockJsonLogicService.evaluateCondition).toHaveBeenCalledWith(
        expect.objectContaining({
          and: expect.any(Array),
        }),
        expect.any(Object)
      );
    });

    it('should evaluate component field value conditions', () => {
      mockJsonLogicService.evaluateCondition
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true);

      planner.testGetTaskLibrary('actor-123');

      // Verify field value condition was evaluated
      const calls = mockJsonLogicService.evaluateCondition.mock.calls;
      const playMusicCall = calls.find(
        call =>
          call[0].and &&
          call[0].and.some(cond => cond['>'] && cond['>'][0].var)
      );
      expect(playMusicCall).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle gate evaluation errors (excludes task, logs error)', () => {
      mockJsonLogicService.evaluateCondition
        .mockImplementationOnce(() => {
          throw new Error('Evaluation error');
        })
        .mockReturnValueOnce(true);

      const tasks = planner.testGetTaskLibrary('actor-123');

      // Should exclude failed task, include others
      expect(tasks.length).toBeLessThan(3);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Structural gate evaluation failed'),
        expect.any(Error),
        expect.any(Object)
      );
    });

    it('should handle malformed gate conditions', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:bad_task': {
            id: 'core:bad_task',
            structuralGates: {
              condition: null, // Malformed
            },
          },
        },
      });

      const tasks = planner.testGetTaskLibrary('actor-123');

      // Should include task (no valid condition = always relevant)
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('core:bad_task');
    });

    it('should log errors for failed evaluations', () => {
      mockJsonLogicService.evaluateCondition.mockImplementation(() => {
        throw new Error('Test error');
      });

      planner.testGetTaskLibrary('actor-123');

      expect(mockLogger.error).toHaveBeenCalled();
      const errorCalls = mockLogger.error.mock.calls;
      expect(errorCalls.some(call => call[0].includes('evaluation failed'))).toBe(
        true
      );
    });
  });

  describe('Logging', () => {
    it('should log task counts (filtered vs total)', () => {
      mockJsonLogicService.evaluateCondition.mockReturnValue(true);

      planner.testGetTaskLibrary('actor-123');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Task library for actor-123: 3 / 3 tasks')
      );
    });

    it('should log individual gate decisions at debug level', () => {
      mockJsonLogicService.evaluateCondition
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      planner.testGetTaskLibrary('actor-123');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('has no structural gates')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('structural gates passed')
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('structural gates failed')
      );
    });

    it('should log errors for failed evaluations', () => {
      mockJsonLogicService.evaluateCondition.mockImplementation(() => {
        throw new Error('Evaluation error');
      });

      planner.testGetTaskLibrary('actor-123');

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Structural gate evaluation failed'),
        expect.any(Error),
        expect.objectContaining({
          condition: expect.any(Object),
        })
      );
    });
  });

  describe('Context Building', () => {
    it('should build context with actor entity', () => {
      const actorEntity = {
        id: 'actor-123',
        components: {
          'core:test': { value: 42 },
        },
      };
      mockEntityManager.getEntityInstance.mockReturnValue(actorEntity);

      planner.testGetTaskLibrary('actor-123');

      // Verify context passed to evaluateCondition includes actor
      expect(mockJsonLogicService.evaluateCondition).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          actor: actorEntity,
        })
      );
    });

    it('should use getEntityInstance method (not getEntity)', () => {
      planner.testGetTaskLibrary('actor-123');

      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(
        'actor-123'
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle tasks with nested mod structures containing nulls', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:task1': { id: 'core:task1' },
        },
        invalid: null,
        music: {
          'music:task1': { id: 'music:task1' },
        },
      });
      mockJsonLogicService.evaluateCondition.mockReturnValue(true);

      const tasks = planner.testGetTaskLibrary('actor-123');

      expect(tasks).toHaveLength(2);
      expect(tasks.map(t => t.id)).toEqual(['core:task1', 'music:task1']);
    });

    it('should handle mixed tasks with and without gates', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:gated': {
            id: 'core:gated',
            structuralGates: { condition: { test: true } },
          },
          'core:ungated': {
            id: 'core:ungated',
          },
        },
      });
      mockJsonLogicService.evaluateCondition.mockReturnValue(false);

      const tasks = planner.testGetTaskLibrary('actor-123');

      // Ungated task should pass, gated should fail
      expect(tasks).toHaveLength(1);
      expect(tasks[0].id).toBe('core:ungated');
    });

    it('should log total task count before filtering', () => {
      mockRepository.get.mockReturnValue({
        core: {
          'core:task1': { id: 'core:task1' },
          'core:task2': { id: 'core:task2' },
        },
      });

      planner.testGetTaskLibrary('actor-123');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Filtering 2 tasks for actor actor-123')
      );
    });
  });
});
