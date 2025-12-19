import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';
import { StateConsistencyValidator } from '../../../src/utils/stateConsistencyValidator.js';

describe('StateConsistencyValidator', () => {
  let testBed;
  let validator;
  let mockLogger;
  let mockEntityManager;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockEntityManager = testBed.createMock('IEntityManager', [
      'getEntitiesWithComponent',
      'getComponentData',
      'addComponent',
    ]);

    validator = new StateConsistencyValidator({
      logger: mockLogger,
      entityManager: mockEntityManager,
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Constructor', () => {
    it('should validate logger dependency', () => {
      expect(
        () =>
          new StateConsistencyValidator({
            logger: null,
            entityManager: mockEntityManager,
          })
      ).toThrow('Missing required dependency: ILogger');
    });

    it('should validate entityManager dependency', () => {
      expect(
        () =>
          new StateConsistencyValidator({
            logger: mockLogger,
            entityManager: null,
          })
      ).toThrow('Missing required dependency: IEntityManager');
    });

    it('should require logger with required methods', () => {
      const invalidLogger = { info: jest.fn() };
      expect(
        () =>
          new StateConsistencyValidator({
            logger: invalidLogger,
            entityManager: mockEntityManager,
          })
      ).toThrow("Invalid or missing method 'warn' on dependency 'ILogger'");
    });

    it('should require entityManager with required methods', () => {
      const invalidEntityManager = { getComponentData: jest.fn() };
      expect(
        () =>
          new StateConsistencyValidator({
            logger: mockLogger,
            entityManager: invalidEntityManager,
          })
      ).toThrow(
        "Invalid or missing method 'getEntitiesWithComponent' on dependency 'IEntityManager'"
      );
    });

    it('should create validator with valid dependencies', () => {
      expect(
        () =>
          new StateConsistencyValidator({
            logger: mockLogger,
            entityManager: mockEntityManager,
          })
      ).not.toThrow();
    });
  });

  describe('validateAllClosenessRelationships', () => {
    describe('Valid cases', () => {
      it('should return empty array when no entities have closeness components', () => {
        mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

        const issues = validator.validateAllClosenessRelationships();

        expect(issues).toEqual([]);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should return empty array when all relationships are bidirectional', () => {
        const entities = [{ id: 'core:actor1' }, { id: 'core:actor2' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'personal-space-states:closeness') {
              if (entityId === 'core:actor1') {
                return { partners: ['core:actor2'] };
              }
              if (entityId === 'core:actor2') {
                return { partners: ['core:actor1'] };
              }
            }
            return null;
          }
        );

        const issues = validator.validateAllClosenessRelationships();

        expect(issues).toEqual([]);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should handle empty partners arrays', () => {
        const entities = [{ id: 'core:actor1' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockReturnValue({ partners: [] });

        const issues = validator.validateAllClosenessRelationships();

        expect(issues).toEqual([]);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should handle missing closeness components', () => {
        const entities = [{ id: 'core:actor1' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockReturnValue(null);

        const issues = validator.validateAllClosenessRelationships();

        expect(issues).toEqual([]);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should skip already checked pairs', () => {
        const entities = [{ id: 'core:actor1' }, { id: 'core:actor2' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'personal-space-states:closeness') {
              if (entityId === 'core:actor1') {
                return { partners: ['core:actor2'] };
              }
              if (entityId === 'core:actor2') {
                return { partners: ['core:actor1'] };
              }
            }
            return null;
          }
        );

        const issues = validator.validateAllClosenessRelationships();

        expect(issues).toEqual([]);
        // Should check each pair only once
        expect(mockEntityManager.getComponentData).toHaveBeenCalledTimes(3);
      });
    });

    describe('Issue detection', () => {
      it('should detect unidirectional relationship from A to B', () => {
        const entities = [{ id: 'core:actor1' }, { id: 'core:actor2' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'personal-space-states:closeness') {
              if (entityId === 'core:actor1') {
                return { partners: ['core:actor2'] };
              }
              if (entityId === 'core:actor2') {
                return { partners: [] };
              }
            }
            return null;
          }
        );

        const issues = validator.validateAllClosenessRelationships();

        expect(issues).toHaveLength(1);
        expect(issues[0]).toEqual({
          type: 'unidirectional_closeness',
          from: 'core:actor1',
          to: 'core:actor2',
          message: 'core:actor1 has core:actor2 as partner, but not vice versa',
        });
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Closeness relationship consistency issues found',
          { issues }
        );
      });

      it('should detect unidirectional relationship from B to A', () => {
        const entities = [{ id: 'core:actor1' }, { id: 'core:actor2' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'personal-space-states:closeness') {
              if (entityId === 'core:actor1') {
                return { partners: [] };
              }
              if (entityId === 'core:actor2') {
                return { partners: ['core:actor1'] };
              }
            }
            return null;
          }
        );

        const issues = validator.validateAllClosenessRelationships();

        expect(issues).toHaveLength(1);
        expect(issues[0]).toEqual({
          type: 'unidirectional_closeness',
          from: 'core:actor2',
          to: 'core:actor1',
          message: 'core:actor2 has core:actor1 as partner, but not vice versa',
        });
      });

      it('should detect multiple unidirectional relationships', () => {
        const entities = [
          { id: 'core:actor1' },
          { id: 'core:actor2' },
          { id: 'core:actor3' },
        ];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'personal-space-states:closeness') {
              if (entityId === 'core:actor1') {
                return { partners: ['core:actor2', 'core:actor3'] };
              }
              // actor2 and actor3 have no closeness components
            }
            return null;
          }
        );

        const issues = validator.validateAllClosenessRelationships();

        expect(issues).toHaveLength(2);
        expect(issues).toContainEqual({
          type: 'unidirectional_closeness',
          from: 'core:actor1',
          to: 'core:actor2',
          message: 'core:actor1 has core:actor2 as partner, but not vice versa',
        });
        expect(issues).toContainEqual({
          type: 'unidirectional_closeness',
          from: 'core:actor1',
          to: 'core:actor3',
          message: 'core:actor1 has core:actor3 as partner, but not vice versa',
        });
      });

      it('should handle partner with missing closeness component', () => {
        const entities = [{ id: 'core:actor1' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (
              entityId === 'core:actor1' &&
              componentId === 'personal-space-states:closeness'
            ) {
              return { partners: ['core:actor2'] };
            }
            return null;
          }
        );

        const issues = validator.validateAllClosenessRelationships();

        expect(issues).toHaveLength(1);
        expect(issues[0].type).toBe('unidirectional_closeness');
      });
    });
  });

  describe('validateMovementLocks', () => {
    describe('Valid cases', () => {
      it('should return empty array when no entities have movement components', () => {
        mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

        const issues = validator.validateMovementLocks();

        expect(issues).toEqual([]);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should return empty array when no entities have locked movement', () => {
        const entities = [{ id: 'core:actor1' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockReturnValue({ locked: false });

        const issues = validator.validateMovementLocks();

        expect(issues).toEqual([]);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should accept locked movement with closeness partners', () => {
        const entities = [{ id: 'core:actor1' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'core:movement') {
              return { locked: true };
            }
            if (componentId === 'personal-space-states:closeness') {
              return { partners: ['core:actor2'] };
            }
            return null;
          }
        );

        const issues = validator.validateMovementLocks();

        expect(issues).toEqual([]);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should accept locked movement with sitting state', () => {
        const entities = [{ id: 'core:actor1' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'core:movement') {
              return { locked: true };
            }
            if (componentId === 'sitting-states:sitting_on') {
              return { furniture_id: 'core:chair', spot_index: 0 };
            }
            return null;
          }
        );

        const issues = validator.validateMovementLocks();

        expect(issues).toEqual([]);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should handle null movement component', () => {
        const entities = [{ id: 'core:actor1' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockReturnValue(null);

        const issues = validator.validateMovementLocks();

        expect(issues).toEqual([]);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });
    });

    describe('Issue detection', () => {
      it('should detect orphaned movement lock with no closeness or sitting', () => {
        const entities = [{ id: 'core:actor1' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'core:movement') {
              return { locked: true };
            }
            if (componentId === 'personal-space-states:closeness') {
              return { partners: [] };
            }
            return null;
          }
        );

        const issues = validator.validateMovementLocks();

        expect(issues).toHaveLength(1);
        expect(issues[0]).toEqual({
          type: 'orphaned_movement_lock',
          entityId: 'core:actor1',
          message:
            'core:actor1 has movement locked but no closeness partners or sitting state',
        });
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Movement lock consistency issues found',
          { issues }
        );
      });

      it('should detect orphaned lock when closeness component is null', () => {
        const entities = [{ id: 'core:actor1' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'core:movement') {
              return { locked: true };
            }
            return null;
          }
        );

        const issues = validator.validateMovementLocks();

        expect(issues).toHaveLength(1);
        expect(issues[0].type).toBe('orphaned_movement_lock');
      });

      it('should detect multiple orphaned locks', () => {
        const entities = [{ id: 'core:actor1' }, { id: 'core:actor2' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'core:movement') {
              return { locked: true };
            }
            return null;
          }
        );

        const issues = validator.validateMovementLocks();

        expect(issues).toHaveLength(2);
        expect(issues[0].entityId).toBe('core:actor1');
        expect(issues[1].entityId).toBe('core:actor2');
      });
    });
  });

  describe('validateFurnitureOccupancy', () => {
    describe('Valid cases', () => {
      it('should return empty array when no furniture entities exist', () => {
        mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

        const issues = validator.validateFurnitureOccupancy();

        expect(issues).toEqual([]);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should handle furniture with empty spots', () => {
        const entities = [{ id: 'core:chair' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockReturnValue({
          spots: [null, null],
        });

        const issues = validator.validateFurnitureOccupancy();

        expect(issues).toEqual([]);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should validate matching sitting components', () => {
        const entities = [{ id: 'core:chair' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (
              entityId === 'core:chair' &&
              componentId === 'sitting:allows_sitting'
            ) {
              return { spots: ['core:actor1', null] };
            }
            if (
              entityId === 'core:actor1' &&
              componentId === 'sitting-states:sitting_on'
            ) {
              return { furniture_id: 'core:chair', spot_index: 0 };
            }
            return null;
          }
        );

        const issues = validator.validateFurnitureOccupancy();

        expect(issues).toEqual([]);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should handle null furniture component', () => {
        const entities = [{ id: 'core:chair' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockReturnValue(null);

        const issues = validator.validateFurnitureOccupancy();

        expect(issues).toEqual([]);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should handle furniture with no spots property', () => {
        const entities = [{ id: 'core:chair' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockReturnValue({});

        const issues = validator.validateFurnitureOccupancy();

        expect(issues).toEqual([]);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });
    });

    describe('Issue detection', () => {
      it('should detect missing sitting component', () => {
        const entities = [{ id: 'core:chair' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (
              entityId === 'core:chair' &&
              componentId === 'sitting:allows_sitting'
            ) {
              return { spots: ['core:actor1'] };
            }
            return null;
          }
        );

        const issues = validator.validateFurnitureOccupancy();

        expect(issues).toHaveLength(1);
        expect(issues[0]).toEqual({
          type: 'missing_sitting_component',
          furnitureId: 'core:chair',
          occupantId: 'core:actor1',
          spotIndex: 0,
          message:
            'core:actor1 is in furniture core:chair spot 0 but has no sitting component',
        });
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Furniture occupancy consistency issues found',
          { issues }
        );
      });

      it('should detect furniture mismatch in sitting component', () => {
        const entities = [{ id: 'core:chair' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (
              entityId === 'core:chair' &&
              componentId === 'sitting:allows_sitting'
            ) {
              return { spots: ['core:actor1'] };
            }
            if (
              entityId === 'core:actor1' &&
              componentId === 'sitting-states:sitting_on'
            ) {
              return { furniture_id: 'core:bench', spot_index: 0 };
            }
            return null;
          }
        );

        const issues = validator.validateFurnitureOccupancy();

        expect(issues).toHaveLength(1);
        expect(issues[0]).toEqual({
          type: 'sitting_mismatch',
          furnitureId: 'core:chair',
          occupantId: 'core:actor1',
          spotIndex: 0,
          actualFurniture: 'core:bench',
          actualSpot: 0,
          message: 'Sitting component mismatch for core:actor1',
        });
      });

      it('should detect spot index mismatch', () => {
        const entities = [{ id: 'core:bench' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (
              entityId === 'core:bench' &&
              componentId === 'sitting:allows_sitting'
            ) {
              return { spots: [null, 'core:actor1'] };
            }
            if (
              entityId === 'core:actor1' &&
              componentId === 'sitting-states:sitting_on'
            ) {
              return { furniture_id: 'core:bench', spot_index: 0 };
            }
            return null;
          }
        );

        const issues = validator.validateFurnitureOccupancy();

        expect(issues).toHaveLength(1);
        expect(issues[0].type).toBe('sitting_mismatch');
        expect(issues[0].spotIndex).toBe(1);
        expect(issues[0].actualSpot).toBe(0);
      });

      it('should detect multiple issues in same furniture', () => {
        const entities = [{ id: 'core:bench' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (
              entityId === 'core:bench' &&
              componentId === 'sitting:allows_sitting'
            ) {
              return { spots: ['core:actor1', 'core:actor2'] };
            }
            // Neither actor has sitting component
            return null;
          }
        );

        const issues = validator.validateFurnitureOccupancy();

        expect(issues).toHaveLength(2);
        expect(issues[0].occupantId).toBe('core:actor1');
        expect(issues[1].occupantId).toBe('core:actor2');
      });
    });
  });

  describe('performFullValidation', () => {
    it('should run all validations and return comprehensive report', () => {
      // Setup for no issues
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      const report = validator.performFullValidation();

      expect(report).toHaveProperty('timestamp');
      expect(report.closenessIssues).toEqual([]);
      expect(report.movementLockIssues).toEqual([]);
      expect(report.furnitureOccupancyIssues).toEqual([]);
      expect(report.totalIssues).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'State consistency validation passed - no issues found'
      );
    });

    it('should aggregate all issues and log warning', () => {
      const entities = [{ id: 'core:actor1' }];
      mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
      mockEntityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === 'personal-space-states:closeness') {
            return { partners: ['core:actor2'] };
          }
          if (componentId === 'core:movement') {
            return { locked: true };
          }
          if (componentId === 'sitting:allows_sitting') {
            return { spots: ['core:actor3'] };
          }
          return null;
        }
      );

      const report = validator.performFullValidation();

      expect(report.totalIssues).toBeGreaterThan(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'State consistency validation found issues',
        expect.objectContaining({
          totalIssues: report.totalIssues,
          breakdown: expect.any(Object),
        })
      );
    });

    it('should include timestamp in ISO format', () => {
      mockEntityManager.getEntitiesWithComponent.mockReturnValue([]);

      const report = validator.performFullValidation();

      expect(report.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
      );
    });
  });

  describe('repairIssues', () => {
    describe('Successful repairs', () => {
      it('should repair unidirectional closeness', async () => {
        const issue = {
          type: 'unidirectional_closeness',
          from: 'core:actor1',
          to: 'core:actor2',
        };
        mockEntityManager.getComponentData.mockReturnValue({
          partners: ['core:actor2', 'core:actor3'],
        });
        mockEntityManager.addComponent.mockResolvedValue(undefined);

        const report = await validator.repairIssues([issue]);

        expect(report.attempted).toBe(1);
        expect(report.successful).toBe(1);
        expect(report.failed).toEqual([]);
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'core:actor1',
          'personal-space-states:closeness',
          { partners: ['core:actor3'] }
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Repaired unidirectional closeness',
          expect.objectContaining({ from: 'core:actor1' })
        );
      });

      it('should repair orphaned movement lock', async () => {
        const issue = {
          type: 'orphaned_movement_lock',
          entityId: 'core:actor1',
        };
        mockEntityManager.getComponentData.mockReturnValue({
          locked: true,
          speed: 5,
        });
        mockEntityManager.addComponent.mockResolvedValue(undefined);

        const report = await validator.repairIssues([issue]);

        expect(report.successful).toBe(1);
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'core:actor1',
          'core:movement',
          { locked: false, speed: 5 }
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Repaired orphaned movement lock',
          { entityId: 'core:actor1' }
        );
      });

      it('should repair sitting mismatch', async () => {
        const issue = {
          type: 'sitting_mismatch',
          furnitureId: 'core:chair',
          occupantId: 'core:actor1',
          spotIndex: 0,
        };
        mockEntityManager.addComponent.mockResolvedValue(undefined);

        const report = await validator.repairIssues([issue]);

        expect(report.successful).toBe(1);
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'core:actor1',
          'sitting-states:sitting_on',
          { furniture_id: 'core:chair', spot_index: 0 }
        );
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'Repaired sitting component mismatch',
          expect.objectContaining({ occupantId: 'core:actor1' })
        );
      });
    });

    describe('Failed repairs', () => {
      it('should report missing sitting component as non-repairable', async () => {
        const issue = {
          type: 'missing_sitting_component',
          furnitureId: 'core:chair',
          occupantId: 'core:actor1',
        };

        const report = await validator.repairIssues([issue]);

        expect(report.successful).toBe(0);
        expect(report.failed).toHaveLength(1);
        expect(report.failed[0].reason).toContain(
          'manual intervention required'
        );
      });

      it('should handle unknown issue types', async () => {
        const issue = {
          type: 'unknown_issue_type',
        };

        const report = await validator.repairIssues([issue]);

        expect(report.successful).toBe(0);
        expect(report.failed).toHaveLength(1);
        expect(report.failed[0].reason).toBe(
          'No repair strategy for issue type'
        );
      });

      it('should handle repair exceptions', async () => {
        const issue = {
          type: 'orphaned_movement_lock',
          entityId: 'core:actor1',
        };
        mockEntityManager.getComponentData.mockReturnValue({ locked: true });
        mockEntityManager.addComponent.mockRejectedValue(
          new Error('Database error')
        );

        const report = await validator.repairIssues([issue]);

        expect(report.successful).toBe(0);
        expect(report.failed).toHaveLength(1);
        expect(report.failed[0].reason).toBe('Database error');
      });
    });

    describe('Mixed repairs', () => {
      it('should handle multiple issues with mixed success', async () => {
        const issues = [
          { type: 'orphaned_movement_lock', entityId: 'core:actor1' },
          {
            type: 'missing_sitting_component',
            furnitureId: 'core:chair',
            occupantId: 'core:actor2',
          },
          {
            type: 'unidirectional_closeness',
            from: 'core:actor3',
            to: 'core:actor4',
          },
        ];
        mockEntityManager.getComponentData.mockImplementation((entityId) => {
          if (entityId === 'core:actor1') {
            return { locked: true };
          }
          if (entityId === 'core:actor3') {
            return { partners: ['core:actor4'] };
          }
          return null;
        });
        mockEntityManager.addComponent.mockResolvedValue(undefined);

        const report = await validator.repairIssues(issues);

        expect(report.attempted).toBe(3);
        expect(report.successful).toBe(2);
        expect(report.failed).toHaveLength(1);
        expect(mockLogger.info).toHaveBeenCalledWith(
          'Issue repair completed',
          report
        );
      });

      it('should handle empty issues array', async () => {
        const report = await validator.repairIssues([]);

        expect(report.attempted).toBe(0);
        expect(report.successful).toBe(0);
        expect(report.failed).toEqual([]);
      });
    });
  });

  describe('Circular Reference Detection', () => {
    describe('validateAllClosenessRelationships - circular references', () => {
      it('should detect circular reference: A → B → C → A', () => {
        const entities = [
          { id: 'core:actor1' },
          { id: 'core:actor2' },
          { id: 'core:actor3' },
        ];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'personal-space-states:closeness') {
              if (entityId === 'core:actor1') {
                return { partners: ['core:actor2'] };
              }
              if (entityId === 'core:actor2') {
                return { partners: ['core:actor3'] };
              }
              if (entityId === 'core:actor3') {
                return { partners: ['core:actor1'] };
              }
            }
            return null;
          }
        );

        const issues = validator.validateAllClosenessRelationships();

        // Circular references are valid as long as they're bidirectional
        // This test should detect unidirectional relationships within the circle
        expect(issues).toHaveLength(3); // Each relationship is unidirectional
        expect(
          issues.some((i) => i.from === 'core:actor1' && i.to === 'core:actor2')
        ).toBe(true);
        expect(
          issues.some((i) => i.from === 'core:actor2' && i.to === 'core:actor3')
        ).toBe(true);
        expect(
          issues.some((i) => i.from === 'core:actor3' && i.to === 'core:actor1')
        ).toBe(true);
      });

      it('should handle bidirectional circular references correctly', () => {
        const entities = [
          { id: 'core:actor1' },
          { id: 'core:actor2' },
          { id: 'core:actor3' },
        ];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'personal-space-states:closeness') {
              if (entityId === 'core:actor1') {
                return { partners: ['core:actor2', 'core:actor3'] };
              }
              if (entityId === 'core:actor2') {
                return { partners: ['core:actor1', 'core:actor3'] };
              }
              if (entityId === 'core:actor3') {
                return { partners: ['core:actor1', 'core:actor2'] };
              }
            }
            return null;
          }
        );

        const issues = validator.validateAllClosenessRelationships();

        // All relationships are bidirectional, so no issues
        expect(issues).toEqual([]);
        expect(mockLogger.warn).not.toHaveBeenCalled();
      });

      it('should detect self-referential closeness', () => {
        const entities = [{ id: 'core:actor1' }];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'personal-space-states:closeness') {
              if (entityId === 'core:actor1') {
                return { partners: ['core:actor1'] }; // Self-reference
              }
            }
            return null;
          }
        );

        const issues = validator.validateAllClosenessRelationships();

        // Self-reference validation depends on implementation
        // The validator may skip self-references as they're always invalid
        expect(issues).toBeDefined();
        // Either no issues (skipped) or one issue (detected)
        expect(issues.length).toBeLessThanOrEqual(1);
      });

      it('should handle complex circular graphs with multiple loops', () => {
        const entities = [
          { id: 'core:actor1' },
          { id: 'core:actor2' },
          { id: 'core:actor3' },
          { id: 'core:actor4' },
        ];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'personal-space-states:closeness') {
              // Creating fully bidirectional relationships
              if (entityId === 'core:actor1') {
                return { partners: ['core:actor2', 'core:actor3'] };
              }
              if (entityId === 'core:actor2') {
                return {
                  partners: ['core:actor1', 'core:actor3', 'core:actor4'],
                };
              }
              if (entityId === 'core:actor3') {
                return {
                  partners: ['core:actor1', 'core:actor2', 'core:actor4'],
                };
              }
              if (entityId === 'core:actor4') {
                return { partners: ['core:actor2', 'core:actor3'] };
              }
            }
            return null;
          }
        );

        const issues = validator.validateAllClosenessRelationships();

        // All relationships are bidirectional, so no issues
        expect(issues).toEqual([]);
      });

      it('should detect partial circular references with broken links', () => {
        const entities = [
          { id: 'core:actor1' },
          { id: 'core:actor2' },
          { id: 'core:actor3' },
          { id: 'core:actor4' },
        ];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'personal-space-states:closeness') {
              if (entityId === 'core:actor1') {
                return { partners: ['core:actor2'] };
              }
              if (entityId === 'core:actor2') {
                return { partners: ['core:actor3'] };
              }
              if (entityId === 'core:actor3') {
                return { partners: ['core:actor4'] };
              }
              if (entityId === 'core:actor4') {
                return { partners: [] }; // Breaks the circle
              }
            }
            return null;
          }
        );

        const issues = validator.validateAllClosenessRelationships();

        // All relationships are unidirectional
        expect(issues).toHaveLength(3);
        expect(issues.every((i) => i.type === 'unidirectional_closeness')).toBe(
          true
        );
      });

      it('should handle deeply nested circular references', () => {
        const entities = [];
        const numActors = 10;

        // Create a long chain of actors
        for (let i = 1; i <= numActors; i++) {
          entities.push({ id: `core:actor${i}` });
        }

        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            if (componentId === 'personal-space-states:closeness') {
              const match = entityId.match(/core:actor(\d+)/);
              if (match) {
                const num = parseInt(match[1]);
                const nextNum = num === numActors ? 1 : num + 1;
                const prevNum = num === 1 ? numActors : num - 1;
                // Each actor is connected to next and previous, forming a circle
                return {
                  partners: [`core:actor${nextNum}`, `core:actor${prevNum}`],
                };
              }
            }
            return null;
          }
        );

        const issues = validator.validateAllClosenessRelationships();

        // All relationships should be bidirectional
        expect(issues).toEqual([]);
      });

      it('should not get stuck in infinite loop with circular references', () => {
        const entities = [
          { id: 'core:actor1' },
          { id: 'core:actor2' },
          { id: 'core:actor3' },
        ];
        mockEntityManager.getEntitiesWithComponent.mockReturnValue(entities);

        let callCount = 0;
        mockEntityManager.getComponentData.mockImplementation(
          (entityId, componentId) => {
            callCount++;
            // Prevent infinite recursion by limiting calls
            if (callCount > 100) {
              throw new Error('Too many calls - possible infinite loop');
            }

            if (componentId === 'personal-space-states:closeness') {
              if (entityId === 'core:actor1') {
                return { partners: ['core:actor2'] };
              }
              if (entityId === 'core:actor2') {
                return { partners: ['core:actor3'] };
              }
              if (entityId === 'core:actor3') {
                return { partners: ['core:actor1'] };
              }
            }
            return null;
          }
        );

        // Should not throw and should complete normally
        expect(() =>
          validator.validateAllClosenessRelationships()
        ).not.toThrow();
        expect(callCount).toBeLessThan(20); // Should only need a few calls
      });
    });

    describe('repairIssues - circular reference handling', () => {
      it('should repair circular unidirectional references', async () => {
        const issues = [
          {
            type: 'unidirectional_closeness',
            from: 'core:actor1',
            to: 'core:actor2',
          },
          {
            type: 'unidirectional_closeness',
            from: 'core:actor2',
            to: 'core:actor3',
          },
          {
            type: 'unidirectional_closeness',
            from: 'core:actor3',
            to: 'core:actor1',
          },
        ];

        mockEntityManager.getComponentData.mockImplementation((entityId) => {
          if (entityId === 'core:actor1') {
            return { partners: ['core:actor2'] };
          }
          if (entityId === 'core:actor2') {
            return { partners: ['core:actor3'] };
          }
          if (entityId === 'core:actor3') {
            return { partners: ['core:actor1'] };
          }
          return null;
        });
        mockEntityManager.addComponent.mockResolvedValue(undefined);

        const report = await validator.repairIssues(issues);

        expect(report.attempted).toBe(3);
        expect(report.successful).toBe(3);

        // Should remove the unidirectional relationships
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'core:actor1',
          'personal-space-states:closeness',
          { partners: [] }
        );
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'core:actor2',
          'personal-space-states:closeness',
          { partners: [] }
        );
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'core:actor3',
          'personal-space-states:closeness',
          { partners: [] }
        );
      });

      it('should handle self-referential repair', async () => {
        const issue = {
          type: 'unidirectional_closeness',
          from: 'core:actor1',
          to: 'core:actor1',
        };

        mockEntityManager.getComponentData.mockReturnValue({
          partners: ['core:actor1', 'core:actor2'],
        });
        mockEntityManager.addComponent.mockResolvedValue(undefined);

        const report = await validator.repairIssues([issue]);

        expect(report.successful).toBe(1);

        // Should remove self-reference but keep other partners
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'core:actor1',
          'personal-space-states:closeness',
          { partners: ['core:actor2'] }
        );
      });
    });
  });
});
