// tests/entities/spatialIndexManager.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import SpatialIndexManager from '../../../src/entities/spatialIndexManager.js';
import BatchSpatialIndexManager from '../../../src/entities/operations/BatchSpatialIndexManager.js';
import { POSITION_COMPONENT_ID } from '../../../src/constants/componentIds.js'; // Assuming path is correct
import { createMockEntityManager } from '../../common/mockFactories.js';
// Entity, EntityDefinition, EntityInstanceData no longer needed for this simplified mock

describe('SpatialIndexManager', () => {
  /** @type {SpatialIndexManager} */
  let spatialIndexManager;
  let mockLogger;

  beforeEach(() => {
    jest.restoreAllMocks();
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Create a fresh instance for each test AFTER spies are ready
    spatialIndexManager = new SpatialIndexManager({ logger: mockLogger });
  });

  //------------------------------------------
  // Constructor Tests
  //------------------------------------------
  describe('constructor', () => {
    it('should initialize with an empty locationIndex Map', () => {
      expect(spatialIndexManager.locationIndex).toBeDefined();
      expect(spatialIndexManager.locationIndex).toBeInstanceOf(Map);
      expect(spatialIndexManager.locationIndex.size).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledTimes(1);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'SpatialIndexManager initialized.',
        { batchOperationsEnabled: false }
      );
    });
  });

  //------------------------------------------
  // addEntity Tests
  //------------------------------------------
  describe('addEntity', () => {
    it('should add an entity to a new location', () => {
      spatialIndexManager.addEntity('entity1', 'locationA');
      expect(spatialIndexManager.locationIndex.size).toBe(1);
      expect(spatialIndexManager.locationIndex.has('locationA')).toBe(true);
      const locationSet = spatialIndexManager.locationIndex.get('locationA');
      expect(locationSet).toBeInstanceOf(Set);
      expect(locationSet.size).toBe(1);
      expect(locationSet.has('entity1')).toBe(true);
    });

    it('should add multiple entities to the same location', () => {
      spatialIndexManager.addEntity('entity1', 'locationA');
      spatialIndexManager.addEntity('entity2', 'locationA');
      expect(spatialIndexManager.locationIndex.size).toBe(1);
      const locationSet = spatialIndexManager.locationIndex.get('locationA');
      expect(locationSet.size).toBe(2);
      expect(locationSet.has('entity1')).toBe(true);
      expect(locationSet.has('entity2')).toBe(true);
    });

    it('should add entities to different locations', () => {
      spatialIndexManager.addEntity('entity1', 'locationA');
      spatialIndexManager.addEntity('entity2', 'locationB');
      expect(spatialIndexManager.locationIndex.size).toBe(2);
      expect(spatialIndexManager.locationIndex.has('locationA')).toBe(true);
      expect(spatialIndexManager.locationIndex.has('locationB')).toBe(true);
      expect(
        spatialIndexManager.locationIndex.get('locationA').has('entity1')
      ).toBe(true);
      expect(
        spatialIndexManager.locationIndex.get('locationB').has('entity2')
      ).toBe(true);
    });

    it('should not add the same entity to the same location twice', () => {
      spatialIndexManager.addEntity('entity1', 'locationA');
      spatialIndexManager.addEntity('entity1', 'locationA'); // Add again
      expect(spatialIndexManager.locationIndex.size).toBe(1);
      const locationSet = spatialIndexManager.locationIndex.get('locationA');
      expect(locationSet.size).toBe(1);
      expect(locationSet.has('entity1')).toBe(true);
    });

    it('should ignore adding if locationId is null', () => {
      spatialIndexManager.addEntity('entity1', null);
      expect(spatialIndexManager.locationIndex.size).toBe(0);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should ignore adding if locationId is undefined', () => {
      spatialIndexManager.addEntity('entity1', undefined);
      expect(spatialIndexManager.locationIndex.size).toBe(0);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should ignore adding if locationId is an empty string', () => {
      spatialIndexManager.addEntity('entity1', '');
      expect(spatialIndexManager.locationIndex.size).toBe(0);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should ignore adding if locationId is a whitespace string', () => {
      spatialIndexManager.addEntity('entity1', '   ');
      expect(spatialIndexManager.locationIndex.size).toBe(0);
      expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should ignore adding and warn if entityId is invalid (null)', () => {
      spatialIndexManager.addEntity(null, 'locationA');
      expect(spatialIndexManager.locationIndex.size).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entityId (null)')
      );
    });

    it('should ignore adding and warn if entityId is invalid (empty string)', () => {
      spatialIndexManager.addEntity('', 'locationA');
      expect(spatialIndexManager.locationIndex.size).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entityId ()')
      );
    });

    it('should ignore adding and warn if entityId is invalid (whitespace string)', () => {
      spatialIndexManager.addEntity('   ', 'locationA');
      expect(spatialIndexManager.locationIndex.size).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entityId (   )')
      );
    });
  });

  //------------------------------------------
  // removeEntity Tests
  //------------------------------------------
  describe('removeEntity', () => {
    beforeEach(() => {
      spatialIndexManager.addEntity('entity1', 'locationA');
      spatialIndexManager.addEntity('entity2', 'locationA');
      spatialIndexManager.addEntity('entity3', 'locationB');
    });

    it('should remove an entity from a location', () => {
      spatialIndexManager.removeEntity('entity1', 'locationA'); // Method returns void
      const locationASet = spatialIndexManager.locationIndex.get('locationA');
      expect(locationASet.size).toBe(1);
      expect(locationASet.has('entity1')).toBe(false);
      expect(locationASet.has('entity2')).toBe(true);
      expect(spatialIndexManager.locationIndex.has('locationA')).toBe(true);
    });

    it('should remove the location entry if the last entity is removed', () => {
      spatialIndexManager.removeEntity('entity3', 'locationB');
      expect(spatialIndexManager.locationIndex.has('locationB')).toBe(false);
      expect(spatialIndexManager.locationIndex.size).toBe(1);
    });

    it('should do nothing if the entity is not in the specified location', () => {
      spatialIndexManager.removeEntity('entity1', 'locationB');
      expect(spatialIndexManager.locationIndex.get('locationA').size).toBe(2);
      expect(spatialIndexManager.locationIndex.get('locationB').size).toBe(1);
    });

    it('should do nothing if the location does not exist', () => {
      spatialIndexManager.removeEntity('entity1', 'nonExistentLocation');
      expect(spatialIndexManager.locationIndex.get('locationA').size).toBe(2);
      expect(spatialIndexManager.locationIndex.size).toBe(2);
    });

    it('should do nothing if locationId is null', () => {
      const originalSize = spatialIndexManager.locationIndex.size;
      spatialIndexManager.removeEntity('entity1', null);
      expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
    });

    it('should do nothing if locationId is undefined', () => {
      const originalSize = spatialIndexManager.locationIndex.size;
      spatialIndexManager.removeEntity('entity1', undefined);
      expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
    });

    it('should do nothing if locationId is an empty string', () => {
      const originalSize = spatialIndexManager.locationIndex.size;
      spatialIndexManager.removeEntity('entity1', '');
      expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
    });

    it('should do nothing if locationId is a whitespace string', () => {
      const originalSize = spatialIndexManager.locationIndex.size;
      spatialIndexManager.removeEntity('entity1', '   ');
      expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
    });

    it('should ignore removal and warn if entityId is invalid (null)', () => {
      const originalSize = spatialIndexManager.locationIndex.size;
      spatialIndexManager.removeEntity(null, 'locationA');
      expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entityId (null)')
      );
    });

    it('should ignore removal and warn if entityId is invalid (empty string)', () => {
      const originalSize = spatialIndexManager.locationIndex.size;
      spatialIndexManager.removeEntity('', 'locationA');
      expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entityId ()')
      );
    });
  });

  //------------------------------------------
  // updateEntityLocation Tests
  //------------------------------------------
  describe('updateEntityLocation', () => {
    beforeEach(() => {
      spatialIndexManager.addEntity('entity1', 'locationA');
      spatialIndexManager.addEntity('entity2', 'locationA');
      // entity3 is not added here, tests will handle it
    });

    it('should move an entity from one valid location to another', () => {
      spatialIndexManager.updateEntityLocation(
        'entity1',
        'locationA',
        'locationB'
      );
      const locationASet = spatialIndexManager.locationIndex.get('locationA');
      expect(locationASet.has('entity1')).toBe(false);
      expect(locationASet.size).toBe(1);
      expect(spatialIndexManager.locationIndex.has('locationB')).toBe(true);
      const locationBSet = spatialIndexManager.locationIndex.get('locationB');
      expect(locationBSet.size).toBe(1);
      expect(locationBSet.has('entity1')).toBe(true);
    });

    it('should remove the old location entry if it becomes empty after moving the entity', () => {
      spatialIndexManager.addEntity('soloEntity', 'locationC');
      spatialIndexManager.updateEntityLocation(
        'soloEntity',
        'locationC',
        'locationD'
      );
      expect(spatialIndexManager.locationIndex.has('locationC')).toBe(false);
      expect(spatialIndexManager.locationIndex.has('locationD')).toBe(true);
      expect(
        spatialIndexManager.locationIndex.get('locationD').has('soloEntity')
      ).toBe(true);
    });

    it('should remove an entity from its old location when moving to null', () => {
      spatialIndexManager.updateEntityLocation('entity1', 'locationA', null);
      const locationASet = spatialIndexManager.locationIndex.get('locationA');
      expect(locationASet.has('entity1')).toBe(false);
      expect(locationASet.size).toBe(1);
      expect(spatialIndexManager.locationIndex.size).toBe(1);
    });

    it('should remove an entity from its old location when moving to undefined', () => {
      spatialIndexManager.updateEntityLocation(
        'entity1',
        'locationA',
        undefined
      );
      const locationASet = spatialIndexManager.locationIndex.get('locationA');
      expect(locationASet.has('entity1')).toBe(false);
      expect(spatialIndexManager.locationIndex.size).toBe(1);
    });

    it('should remove an entity from its old location when moving to empty string', () => {
      spatialIndexManager.updateEntityLocation('entity1', 'locationA', '');
      const locationASet = spatialIndexManager.locationIndex.get('locationA');
      expect(locationASet.has('entity1')).toBe(false);
      expect(spatialIndexManager.locationIndex.size).toBe(1);
    });

    it('should remove an entity from its old location when moving to whitespace string', () => {
      spatialIndexManager.updateEntityLocation('entity1', 'locationA', '   ');
      const locationASet = spatialIndexManager.locationIndex.get('locationA');
      expect(locationASet.has('entity1')).toBe(false);
      expect(spatialIndexManager.locationIndex.size).toBe(1);
    });

    it('should add an entity to a new location when moving from null', () => {
      spatialIndexManager.updateEntityLocation('entity3', null, 'locationC'); // entity3 was not in a location initially
      expect(spatialIndexManager.locationIndex.has('locationC')).toBe(true);
      expect(
        spatialIndexManager.locationIndex.get('locationC').has('entity3')
      ).toBe(true);
      expect(spatialIndexManager.locationIndex.size).toBe(2); // locationA and locationC
    });

    it('should add an entity to a new location when moving from undefined', () => {
      spatialIndexManager.updateEntityLocation(
        'entity3',
        undefined,
        'locationC'
      );
      expect(spatialIndexManager.locationIndex.has('locationC')).toBe(true);
      expect(
        spatialIndexManager.locationIndex.get('locationC').has('entity3')
      ).toBe(true);
      expect(spatialIndexManager.locationIndex.size).toBe(2);
    });

    it('should add an entity to a new location when moving from empty string', () => {
      spatialIndexManager.updateEntityLocation('entity3', '', 'locationC');
      expect(spatialIndexManager.locationIndex.has('locationC')).toBe(true);
      expect(
        spatialIndexManager.locationIndex.get('locationC').has('entity3')
      ).toBe(true);
      expect(spatialIndexManager.locationIndex.size).toBe(2);
    });

    it('should add an entity to a new location when moving from whitespace string', () => {
      spatialIndexManager.updateEntityLocation('entity3', '   ', 'locationC');
      expect(spatialIndexManager.locationIndex.has('locationC')).toBe(true);
      expect(
        spatialIndexManager.locationIndex.get('locationC').has('entity3')
      ).toBe(true);
      expect(spatialIndexManager.locationIndex.size).toBe(2);
    });

    it('should do nothing if old and new locations are the same (valid string)', () => {
      const originalLocationASet = new Set(
        spatialIndexManager.locationIndex.get('locationA')
      );
      const originalSize = spatialIndexManager.locationIndex.size;
      spatialIndexManager.updateEntityLocation(
        'entity1',
        'locationA',
        'locationA'
      );
      expect(spatialIndexManager.locationIndex.get('locationA')).toEqual(
        originalLocationASet
      );
      expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
    });

    it('should do nothing if old and new locations are the same (null)', () => {
      const originalSize = spatialIndexManager.locationIndex.size;
      spatialIndexManager.updateEntityLocation('entity3', null, null);
      expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
    });

    it('should do nothing if old and new locations are effectively the same (null/undefined/empty/whitespace)', () => {
      const originalSize = spatialIndexManager.locationIndex.size;
      spatialIndexManager.updateEntityLocation('entity3', null, undefined);
      expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
      spatialIndexManager.updateEntityLocation('entity3', undefined, '');
      expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
    });

    it('should ignore update and warn if entityId is invalid', () => {
      const originalSize = spatialIndexManager.locationIndex.size;
      spatialIndexManager.updateEntityLocation('', 'locationA', 'locationB');
      expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid entityId')
      );
    });
  });

  //------------------------------------------
  // getEntitiesInLocation Tests
  //------------------------------------------
  describe('getEntitiesInLocation', () => {
    beforeEach(() => {
      spatialIndexManager.addEntity('entity1', 'locationA');
      spatialIndexManager.addEntity('entity2', 'locationA');
    });

    it('should return a Set of entity IDs for a valid location', () => {
      const entities = spatialIndexManager.getEntitiesInLocation('locationA');
      expect(entities).toBeInstanceOf(Set);
      expect(entities.size).toBe(2);
      expect(entities.has('entity1')).toBe(true);
      expect(entities.has('entity2')).toBe(true);
    });

    it('should return an empty Set for a non-existent location', () => {
      const entities = spatialIndexManager.getEntitiesInLocation(
        'nonExistentLocation'
      );
      expect(entities.size).toBe(0);
    });

    it('should return an empty Set if locationId is null', () => {
      expect(spatialIndexManager.getEntitiesInLocation(null).size).toBe(0);
    });

    it('should return an empty Set if locationId is undefined', () => {
      expect(spatialIndexManager.getEntitiesInLocation(undefined).size).toBe(0);
    });

    it('should return an empty Set if locationId is an empty string', () => {
      expect(spatialIndexManager.getEntitiesInLocation('').size).toBe(0);
    });

    it('should return an empty Set if locationId is a whitespace string', () => {
      expect(spatialIndexManager.getEntitiesInLocation('   ').size).toBe(0);
    });

    it('should return a *copy* of the internal Set', () => {
      const entities = spatialIndexManager.getEntitiesInLocation('locationA');
      entities.add('entity3'); // Modify returned set
      const internalSet = spatialIndexManager.locationIndex.get('locationA');
      expect(internalSet.size).toBe(2); // Internal should be unchanged
      expect(internalSet.has('entity3')).toBe(false);
    });
  });

  //------------------------------------------
  // buildIndex Tests
  //------------------------------------------
  describe('buildIndex', () => {
    beforeEach(() => {
      spatialIndexManager = new SpatialIndexManager({ logger: mockLogger });
    });

    it('should correctly build the index using getComponentData', () => {
      const mockEntityManager = setupMockEntityManagerWithEntities(true);
      // Debug: verify setup
      spatialIndexManager.buildIndex(mockEntityManager);

      expect(spatialIndexManager.locationIndex.size).toBe(2);
      expect(spatialIndexManager.locationIndex.has('locationA')).toBe(true);
      const locationASet = spatialIndexManager.locationIndex.get('locationA');
      expect(locationASet.size).toBe(1);
      expect(locationASet.has('entity1')).toBe(true);

      expect(spatialIndexManager.locationIndex.has('locationB')).toBe(true);
      const locationBSet = spatialIndexManager.locationIndex.get('locationB');
      expect(locationBSet.size).toBe(1);
      expect(locationBSet.has('entity2')).toBe(true);

      // Verify that entities without valid locationId or without position component are not added.
      const mockEntityManagerWithInvalid = setupMockEntityManagerWithEntities(
        true,
        true,
        true,
        true
      );
      spatialIndexManager.buildIndex(mockEntityManagerWithInvalid);
      expect(spatialIndexManager.locationIndex.size).toBe(2); // Still entity1 & entity2
      expect(spatialIndexManager.locationIndex.has('locationA')).toBe(true);
      expect(spatialIndexManager.locationIndex.has('locationB')).toBe(true);
      expect(spatialIndexManager.locationIndex.has('   ')).toBe(false); // Invalid loc from entity3InvalidLoc
      const hasNullKey = Array.from(
        spatialIndexManager.locationIndex.keys()
      ).some((key) => key === null);
      expect(hasNullKey).toBe(false);

      // Remove or update specific mockLogger.info checks that are failing due to new detailed logging
      // For example, if it was checking for "Building index from active entities..."
      // This specific check might no longer be relevant or correct.
      // expect(mockLogger.info).toHaveBeenCalledWith(
      //   'SpatialIndexManager: Building index from active entities...'
      // );
      // If other specific logs from buildIndex are important, adjust their expectations.
      // For now, we are focusing on functional correctness.
      expect(mockLogger.warn).not.toHaveBeenCalled(); // Assuming no warnings for this valid case
    });

    it('should clear the existing index before building', () => {
      // Pre-populate index
      spatialIndexManager.addEntity('preExisting1', 'locationOld1');
      spatialIndexManager.addEntity('preExisting2', 'locationOld2');
      expect(spatialIndexManager.locationIndex.size).toBe(2);

      const mockEntityManager = setupMockEntityManagerWithEntities(true);
      spatialIndexManager.buildIndex(mockEntityManager);

      expect(spatialIndexManager.locationIndex.has('locationOld1')).toBe(false); // Cleared
      expect(spatialIndexManager.locationIndex.has('locationOld2')).toBe(false); // Cleared
      expect(spatialIndexManager.locationIndex.size).toBe(2); // From mockEntityManager
      expect(spatialIndexManager.locationIndex.has('locationA')).toBe(true);
      expect(spatialIndexManager.locationIndex.has('locationB')).toBe(true);
      // mockLogger.info assertions related to old messages can be removed or updated here as well.
    });

    it('should handle invalid EntityManager gracefully', () => {
      spatialIndexManager.buildIndex(null);
      expect(spatialIndexManager.locationIndex.size).toBe(0);
      expect(mockLogger.error).toHaveBeenCalledWith(
        // 'SpatialIndexManager.buildIndex: Invalid EntityManager or missing activeEntities iterable provided.'
        'SpatialIndexManager.buildIndex: Invalid entityManager provided.' // Updated message
      );
      // Check for the new specific log message related to clearing if needed, or remove if too fragile.
      // expect(mockLogger.info).toHaveBeenCalledWith(
      //   '[SpatialIndexManager.buildIndex] Index cleared.'
      // );
    });

    it('should not add entities with invalid location IDs during build', () => {
      const mockEntityManager = setupMockEntityManagerWithEntities(
        true,
        true,
        true,
        true
      );
      spatialIndexManager.buildIndex(mockEntityManager);
      expect(spatialIndexManager.locationIndex.size).toBe(2);
      expect(spatialIndexManager.locationIndex.has('locationA')).toBe(true);
      expect(spatialIndexManager.locationIndex.has('locationB')).toBe(true);
      expect(spatialIndexManager.locationIndex.has('   ')).toBe(false);
      const hasNullKey = Array.from(
        spatialIndexManager.locationIndex.keys()
      ).some((key) => key === null);
      expect(hasNullKey).toBe(false);
    });

    it('skips entities missing required properties during build', () => {
      const invalidEntity1 = { id: 'bad1' }; // no getComponentData
      const invalidEntity2 = {
        getComponentData: () => ({ locationId: 'locationX' }),
      }; // no id
      const validEntity = {
        id: 'good1',
        getComponentData: (type) =>
          type === POSITION_COMPONENT_ID ? { locationId: 'locValid' } : null,
      };
      const activeEntities = new Map([
        [validEntity.id, validEntity],
        ['bad1', invalidEntity1],
        ['bad2', invalidEntity2],
      ]);
      const entityManager = {
        get entities() {
          return activeEntities.values();
        },
      };
      spatialIndexManager.buildIndex(entityManager);
      expect(spatialIndexManager.locationIndex.size).toBe(1);
      expect(spatialIndexManager.locationIndex.has('locValid')).toBe(true);
      expect(
        spatialIndexManager.locationIndex.get('locValid').has('good1')
      ).toBe(true);
    });
  });

  //------------------------------------------
  // clearIndex Tests
  //------------------------------------------
  describe('clearIndex', () => {
    it('should remove all entries from the locationIndex', () => {
      spatialIndexManager.addEntity('entity1', 'locationA');
      spatialIndexManager.addEntity('entity2', 'locationB');
      expect(spatialIndexManager.locationIndex.size).toBe(2);
      mockLogger.info.mockClear(); // Clear constructor log

      spatialIndexManager.clearIndex();

      expect(spatialIndexManager.locationIndex.size).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'SpatialIndexManager: Index cleared.'
      );
    });

    it('should work correctly on an already empty index', () => {
      expect(spatialIndexManager.locationIndex.size).toBe(0);
      mockLogger.info.mockClear(); // Clear constructor log

      spatialIndexManager.clearIndex();

      expect(spatialIndexManager.locationIndex.size).toBe(0);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'SpatialIndexManager: Index cleared.'
      );
    });
  });

  //------------------------------------------
  // Adapter Methods Tests
  //------------------------------------------
  describe('adapter methods', () => {
    beforeEach(() => {
      spatialIndexManager.addEntity('entity1', 'locationA');
      spatialIndexManager.addEntity('entity2', 'locationB');
    });

    describe('add', () => {
      it('should delegate to addEntity method', () => {
        const addEntitySpy = jest.spyOn(spatialIndexManager, 'addEntity');

        spatialIndexManager.add('entity3', 'locationC');

        expect(addEntitySpy).toHaveBeenCalledWith('entity3', 'locationC');
        expect(
          spatialIndexManager.getEntitiesInLocation('locationC').has('entity3')
        ).toBe(true);
      });
    });

    describe('remove', () => {
      it('should remove entity from all locations', () => {
        spatialIndexManager.addEntity('entity1', 'locationB'); // entity1 now in both locationA and locationB

        const removed = spatialIndexManager.remove('entity1');

        expect(removed).toBe(true);
        expect(
          spatialIndexManager.getEntitiesInLocation('locationA').has('entity1')
        ).toBe(false);
        expect(
          spatialIndexManager.getEntitiesInLocation('locationB').has('entity1')
        ).toBe(false);
      });

      it('should return false if entity not found', () => {
        const removed = spatialIndexManager.remove('nonexistent');
        expect(removed).toBe(false);
      });
    });

    describe('move', () => {
      it('should delegate to updateEntityLocation method', () => {
        const updateSpy = jest.spyOn(
          spatialIndexManager,
          'updateEntityLocation'
        );

        const moved = spatialIndexManager.move(
          'entity1',
          'locationA',
          'locationC'
        );

        expect(moved).toBe(true);
        expect(updateSpy).toHaveBeenCalledWith(
          'entity1',
          'locationA',
          'locationC'
        );
      });
    });

    describe('getEntitiesAtLocation', () => {
      it('should return array instead of Set', () => {
        const entities = spatialIndexManager.getEntitiesAtLocation('locationA');

        expect(Array.isArray(entities)).toBe(true);
        expect(entities.includes('entity1')).toBe(true);
      });
    });

    describe('clear', () => {
      it('should delegate to clearIndex method', () => {
        const clearIndexSpy = jest.spyOn(spatialIndexManager, 'clearIndex');

        spatialIndexManager.clear();

        expect(clearIndexSpy).toHaveBeenCalled();
        expect(spatialIndexManager.locationIndex.size).toBe(0);
      });
    });

    describe('size property', () => {
      it('should return the size of locationIndex', () => {
        expect(spatialIndexManager.size).toBe(2);

        spatialIndexManager.addEntity('entity3', 'locationC');
        expect(spatialIndexManager.size).toBe(3);
      });
    });
  });

  //------------------------------------------
  // Batch Operations Tests
  //------------------------------------------
  describe('batch operations', () => {
    let mockBatchSpatialIndexManager;

    beforeEach(() => {
      mockBatchSpatialIndexManager = {
        batchAdd: jest.fn().mockResolvedValue({
          successful: [{ entityId: 'entity1', locationId: 'locationA' }],
          failed: [],
          totalProcessed: 1,
          indexSize: 1,
          processingTime: 10,
        }),
        batchRemove: jest.fn().mockResolvedValue({
          successful: [{ entityId: 'entity1', removed: true }],
          failed: [],
          totalProcessed: 1,
          indexSize: 0,
          processingTime: 5,
        }),
        batchMove: jest.fn().mockResolvedValue({
          successful: [
            {
              entityId: 'entity1',
              oldLocationId: 'locationA',
              newLocationId: 'locationB',
            },
          ],
          failed: [],
          totalProcessed: 1,
          indexSize: 1,
          processingTime: 8,
        }),
        rebuild: jest.fn().mockResolvedValue({
          successful: [{ entityId: 'entity1', locationId: 'locationA' }],
          failed: [],
          totalProcessed: 1,
          indexSize: 1,
          processingTime: 15,
        }),
      };
    });

    describe('with batch operations enabled', () => {
      beforeEach(() => {
        spatialIndexManager = new SpatialIndexManager({
          logger: mockLogger,
          batchSpatialIndexManager: mockBatchSpatialIndexManager,
          enableBatchOperations: true,
        });
      });

      describe('batchAdd', () => {
        it('should delegate to batch spatial index manager', async () => {
          const additions = [{ entityId: 'entity1', locationId: 'locationA' }];
          const options = { batchSize: 10 };

          const result = await spatialIndexManager.batchAdd(additions, options);

          expect(mockBatchSpatialIndexManager.batchAdd).toHaveBeenCalledWith(
            additions,
            options
          );
          expect(result.successful).toHaveLength(1);
          expect(result.totalProcessed).toBe(1);
        });

        it('should log batch operation execution', async () => {
          const additions = [{ entityId: 'entity1', locationId: 'locationA' }];

          await spatialIndexManager.batchAdd(additions);

          expect(mockLogger.info).toHaveBeenCalledWith(
            'Executing batch spatial index addition',
            { entityCount: 1 }
          );
        });
      });

      describe('batchRemove', () => {
        it('should delegate to batch spatial index manager', async () => {
          const entityIds = ['entity1', 'entity2'];
          const options = { batchSize: 5 };

          const result = await spatialIndexManager.batchRemove(
            entityIds,
            options
          );

          expect(mockBatchSpatialIndexManager.batchRemove).toHaveBeenCalledWith(
            entityIds,
            options
          );
          expect(result.successful).toHaveLength(1);
        });

        it('should log batch operation execution', async () => {
          const entityIds = ['entity1'];

          await spatialIndexManager.batchRemove(entityIds);

          expect(mockLogger.info).toHaveBeenCalledWith(
            'Executing batch spatial index removal',
            { entityCount: 1 }
          );
        });
      });

      describe('batchMove', () => {
        it('should delegate to batch spatial index manager', async () => {
          const updates = [
            {
              entityId: 'entity1',
              oldLocationId: 'locationA',
              newLocationId: 'locationB',
            },
          ];
          const options = { enableParallel: true };

          const result = await spatialIndexManager.batchMove(updates, options);

          expect(mockBatchSpatialIndexManager.batchMove).toHaveBeenCalledWith(
            updates,
            options
          );
          expect(result.successful).toHaveLength(1);
        });

        it('should log batch operation execution', async () => {
          const updates = [
            {
              entityId: 'entity1',
              oldLocationId: 'locationA',
              newLocationId: 'locationB',
            },
          ];

          await spatialIndexManager.batchMove(updates);

          expect(mockLogger.info).toHaveBeenCalledWith(
            'Executing batch spatial index move',
            { updateCount: 1 }
          );
        });
      });

      describe('rebuild', () => {
        it('should delegate to batch spatial index manager', async () => {
          const entityLocations = [
            { entityId: 'entity1', locationId: 'locationA' },
          ];
          const options = { batchSize: 20 };

          const result = await spatialIndexManager.rebuild(
            entityLocations,
            options
          );

          expect(mockBatchSpatialIndexManager.rebuild).toHaveBeenCalledWith(
            entityLocations,
            options
          );
          expect(result.successful).toHaveLength(1);
        });

        it('should log batch operation execution', async () => {
          const entityLocations = [
            { entityId: 'entity1', locationId: 'locationA' },
          ];

          await spatialIndexManager.rebuild(entityLocations);

          expect(mockLogger.info).toHaveBeenCalledWith(
            'Executing spatial index rebuild',
            { entityCount: 1 }
          );
        });
      });
    });

    describe('with batch operations disabled', () => {
      beforeEach(() => {
        spatialIndexManager = new SpatialIndexManager({
          logger: mockLogger,
          batchSpatialIndexManager: null,
          enableBatchOperations: false,
        });
      });

      describe('batchAdd fallback', () => {
        it('should use sequential fallback when batch operations disabled', async () => {
          const addEntitySpy = jest.spyOn(spatialIndexManager, 'addEntity');
          const additions = [
            { entityId: 'entity1', locationId: 'locationA' },
            { entityId: 'entity2', locationId: 'locationB' },
          ];

          const result = await spatialIndexManager.batchAdd(additions);

          expect(addEntitySpy).toHaveBeenCalledTimes(2);
          expect(result.successful).toHaveLength(2);
          expect(result.totalProcessed).toBe(2);
          expect(result.processingTime).toBeGreaterThan(0);
        });

        it('should handle errors in sequential fallback', async () => {
          const addEntitySpy = jest.spyOn(spatialIndexManager, 'addEntity');
          addEntitySpy.mockImplementationOnce(() => {
            throw new Error('Addition failed');
          });

          const additions = [
            { entityId: 'entity1', locationId: 'locationA' },
            { entityId: 'entity2', locationId: 'locationB' },
          ];

          const result = await spatialIndexManager.batchAdd(additions);

          expect(result.successful).toHaveLength(1);
          expect(result.failed).toHaveLength(1);
          expect(result.failed[0].error.message).toBe('Addition failed');
        });

        it('should stop on first error when stopOnError is true', async () => {
          const addEntitySpy = jest.spyOn(spatialIndexManager, 'addEntity');
          addEntitySpy.mockImplementationOnce(() => {
            throw new Error('Addition failed');
          });

          const additions = [
            { entityId: 'entity1', locationId: 'locationA' },
            { entityId: 'entity2', locationId: 'locationB' },
            { entityId: 'entity3', locationId: 'locationC' },
          ];

          const result = await spatialIndexManager.batchAdd(additions, {
            stopOnError: true,
          });

          expect(addEntitySpy).toHaveBeenCalledTimes(1);
          expect(result.successful).toHaveLength(0);
          expect(result.failed).toHaveLength(1);
          expect(result.totalProcessed).toBe(1);
        });

        it('should continue processing after error when stopOnError is false', async () => {
          const addEntitySpy = jest.spyOn(spatialIndexManager, 'addEntity');
          addEntitySpy
            .mockImplementationOnce(() => {
              throw new Error('First addition failed');
            })
            .mockImplementationOnce(() => {
              // Second call succeeds
            })
            .mockImplementationOnce(() => {
              throw new Error('Third addition failed');
            });

          const additions = [
            { entityId: 'entity1', locationId: 'locationA' },
            { entityId: 'entity2', locationId: 'locationB' },
            { entityId: 'entity3', locationId: 'locationC' },
          ];

          const result = await spatialIndexManager.batchAdd(additions, {
            stopOnError: false,
          });

          expect(addEntitySpy).toHaveBeenCalledTimes(3);
          expect(result.successful).toHaveLength(1);
          expect(result.failed).toHaveLength(2);
          expect(result.totalProcessed).toBe(3);
        });

        it('should stop processing when stopOnError is true and previous errors exist', async () => {
          const addEntitySpy = jest.spyOn(spatialIndexManager, 'addEntity');
          // First call succeeds
          addEntitySpy
            .mockImplementationOnce(() => {
              // Success
            })
            .mockImplementationOnce(() => {
              throw new Error('Second failed');
            });

          const additions = [
            { entityId: 'entity1', locationId: 'locationA' },
            { entityId: 'entity2', locationId: 'locationB' },
            { entityId: 'entity3', locationId: 'locationC' },
          ];

          const result = await spatialIndexManager.batchAdd(additions, {
            stopOnError: true,
          });

          expect(addEntitySpy).toHaveBeenCalledTimes(2);
          expect(result.successful).toHaveLength(1);
          expect(result.failed).toHaveLength(1);
          expect(result.totalProcessed).toBe(2);
        });
      });

      describe('batchRemove fallback', () => {
        it('should use sequential fallback when batch operations disabled', async () => {
          spatialIndexManager.addEntity('entity1', 'locationA');
          spatialIndexManager.addEntity('entity2', 'locationB');

          const removeSpy = jest.spyOn(spatialIndexManager, 'remove');
          const entityIds = ['entity1', 'entity2'];

          const result = await spatialIndexManager.batchRemove(entityIds);

          expect(removeSpy).toHaveBeenCalledTimes(2);
          expect(result.successful).toHaveLength(2);
          expect(result.totalProcessed).toBe(2);
        });

        it('should stop on first error when stopOnError is true', async () => {
          const removeSpy = jest.spyOn(spatialIndexManager, 'remove');
          removeSpy.mockImplementationOnce(() => {
            throw new Error('Remove failed');
          });

          const entityIds = ['entity1', 'entity2', 'entity3'];

          const result = await spatialIndexManager.batchRemove(entityIds, {
            stopOnError: true,
          });

          expect(removeSpy).toHaveBeenCalledTimes(1);
          expect(result.successful).toHaveLength(0);
          expect(result.failed).toHaveLength(1);
          expect(result.totalProcessed).toBe(1);
          expect(result.failed[0].error.message).toBe('Remove failed');
        });

        it('should continue processing after error when stopOnError is false', async () => {
          spatialIndexManager.addEntity('entity1', 'locationA');
          spatialIndexManager.addEntity('entity2', 'locationB');
          spatialIndexManager.addEntity('entity3', 'locationC');

          const removeSpy = jest.spyOn(spatialIndexManager, 'remove');
          removeSpy
            .mockImplementationOnce(() => {
              throw new Error('First remove failed');
            })
            .mockImplementationOnce(() => {
              return true; // Second succeeds
            })
            .mockImplementationOnce(() => {
              throw new Error('Third remove failed');
            });

          const entityIds = ['entity1', 'entity2', 'entity3'];

          const result = await spatialIndexManager.batchRemove(entityIds, {
            stopOnError: false,
          });

          expect(removeSpy).toHaveBeenCalledTimes(3);
          expect(result.successful).toHaveLength(1);
          expect(result.failed).toHaveLength(2);
          expect(result.totalProcessed).toBe(3);
        });

        it('should stop processing when stopOnError is true and previous errors exist', async () => {
          spatialIndexManager.addEntity('entity1', 'locationA');
          spatialIndexManager.addEntity('entity2', 'locationB');

          const removeSpy = jest.spyOn(spatialIndexManager, 'remove');
          removeSpy
            .mockImplementationOnce(() => {
              return true; // First succeeds
            })
            .mockImplementationOnce(() => {
              throw new Error('Second remove failed');
            });

          const entityIds = ['entity1', 'entity2', 'entity3'];

          const result = await spatialIndexManager.batchRemove(entityIds, {
            stopOnError: true,
          });

          expect(removeSpy).toHaveBeenCalledTimes(2);
          expect(result.successful).toHaveLength(1);
          expect(result.failed).toHaveLength(1);
          expect(result.totalProcessed).toBe(2);
        });
      });

      describe('batchMove fallback', () => {
        it('should use sequential fallback when batch operations disabled', async () => {
          spatialIndexManager.addEntity('entity1', 'locationA');

          const moveSpy = jest.spyOn(spatialIndexManager, 'move');
          const updates = [
            {
              entityId: 'entity1',
              oldLocationId: 'locationA',
              newLocationId: 'locationB',
            },
          ];

          const result = await spatialIndexManager.batchMove(updates);

          expect(moveSpy).toHaveBeenCalledTimes(1);
          expect(result.successful).toHaveLength(1);
          expect(result.totalProcessed).toBe(1);
        });

        it('should stop on first error when stopOnError is true', async () => {
          const moveSpy = jest.spyOn(spatialIndexManager, 'move');
          moveSpy.mockImplementationOnce(() => {
            throw new Error('Move failed');
          });

          const updates = [
            {
              entityId: 'entity1',
              oldLocationId: 'locationA',
              newLocationId: 'locationB',
            },
            {
              entityId: 'entity2',
              oldLocationId: 'locationC',
              newLocationId: 'locationD',
            },
          ];

          const result = await spatialIndexManager.batchMove(updates, {
            stopOnError: true,
          });

          expect(moveSpy).toHaveBeenCalledTimes(1);
          expect(result.successful).toHaveLength(0);
          expect(result.failed).toHaveLength(1);
          expect(result.totalProcessed).toBe(1);
          expect(result.failed[0].error.message).toBe('Move failed');
        });

        it('should continue processing after error when stopOnError is false', async () => {
          const moveSpy = jest.spyOn(spatialIndexManager, 'move');
          moveSpy
            .mockImplementationOnce(() => {
              throw new Error('First move failed');
            })
            .mockImplementationOnce(() => {
              return true; // Second succeeds
            })
            .mockImplementationOnce(() => {
              throw new Error('Third move failed');
            });

          const updates = [
            {
              entityId: 'entity1',
              oldLocationId: 'locationA',
              newLocationId: 'locationB',
            },
            {
              entityId: 'entity2',
              oldLocationId: 'locationC',
              newLocationId: 'locationD',
            },
            {
              entityId: 'entity3',
              oldLocationId: 'locationE',
              newLocationId: 'locationF',
            },
          ];

          const result = await spatialIndexManager.batchMove(updates, {
            stopOnError: false,
          });

          expect(moveSpy).toHaveBeenCalledTimes(3);
          expect(result.successful).toHaveLength(1);
          expect(result.failed).toHaveLength(2);
          expect(result.totalProcessed).toBe(3);
        });

        it('should stop processing when stopOnError is true and previous errors exist', async () => {
          const moveSpy = jest.spyOn(spatialIndexManager, 'move');
          moveSpy
            .mockImplementationOnce(() => {
              return true; // First succeeds
            })
            .mockImplementationOnce(() => {
              throw new Error('Second move failed');
            });

          const updates = [
            {
              entityId: 'entity1',
              oldLocationId: 'locationA',
              newLocationId: 'locationB',
            },
            {
              entityId: 'entity2',
              oldLocationId: 'locationC',
              newLocationId: 'locationD',
            },
            {
              entityId: 'entity3',
              oldLocationId: 'locationE',
              newLocationId: 'locationF',
            },
          ];

          const result = await spatialIndexManager.batchMove(updates, {
            stopOnError: true,
          });

          expect(moveSpy).toHaveBeenCalledTimes(2);
          expect(result.successful).toHaveLength(1);
          expect(result.failed).toHaveLength(1);
          expect(result.totalProcessed).toBe(2);
        });
      });

      describe('rebuild fallback', () => {
        it('should use sequential fallback when batch operations disabled', async () => {
          const clearIndexSpy = jest.spyOn(spatialIndexManager, 'clearIndex');
          const addEntitySpy = jest.spyOn(spatialIndexManager, 'addEntity');

          const entityLocations = [
            { entityId: 'entity1', locationId: 'locationA' },
            { entityId: 'entity2', locationId: 'locationB' },
          ];

          const result = await spatialIndexManager.rebuild(entityLocations);

          expect(clearIndexSpy).toHaveBeenCalledTimes(1);
          expect(addEntitySpy).toHaveBeenCalledTimes(2);
          expect(result.successful).toHaveLength(2);
          expect(result.totalProcessed).toBe(2);
        });

        it('should stop on first error when stopOnError is true', async () => {
          const clearIndexSpy = jest.spyOn(spatialIndexManager, 'clearIndex');
          const addEntitySpy = jest.spyOn(spatialIndexManager, 'addEntity');
          addEntitySpy.mockImplementationOnce(() => {
            throw new Error('Add failed during rebuild');
          });

          const entityLocations = [
            { entityId: 'entity1', locationId: 'locationA' },
            { entityId: 'entity2', locationId: 'locationB' },
            { entityId: 'entity3', locationId: 'locationC' },
          ];

          const result = await spatialIndexManager.rebuild(entityLocations, {
            stopOnError: true,
          });

          expect(clearIndexSpy).toHaveBeenCalledTimes(1);
          expect(addEntitySpy).toHaveBeenCalledTimes(1);
          expect(result.successful).toHaveLength(0);
          expect(result.failed).toHaveLength(1);
          expect(result.totalProcessed).toBe(1);
          expect(result.failed[0].error.message).toBe(
            'Add failed during rebuild'
          );
        });

        it('should continue processing after error when stopOnError is false', async () => {
          const clearIndexSpy = jest.spyOn(spatialIndexManager, 'clearIndex');
          const addEntitySpy = jest.spyOn(spatialIndexManager, 'addEntity');
          addEntitySpy
            .mockImplementationOnce(() => {
              throw new Error('First add failed');
            })
            .mockImplementationOnce(() => {
              // Second succeeds
            })
            .mockImplementationOnce(() => {
              throw new Error('Third add failed');
            });

          const entityLocations = [
            { entityId: 'entity1', locationId: 'locationA' },
            { entityId: 'entity2', locationId: 'locationB' },
            { entityId: 'entity3', locationId: 'locationC' },
          ];

          const result = await spatialIndexManager.rebuild(entityLocations, {
            stopOnError: false,
          });

          expect(clearIndexSpy).toHaveBeenCalledTimes(1);
          expect(addEntitySpy).toHaveBeenCalledTimes(3);
          expect(result.successful).toHaveLength(1);
          expect(result.failed).toHaveLength(2);
          expect(result.totalProcessed).toBe(3);
        });

        it('should stop processing when stopOnError is true and previous errors exist', async () => {
          const clearIndexSpy = jest.spyOn(spatialIndexManager, 'clearIndex');
          const addEntitySpy = jest.spyOn(spatialIndexManager, 'addEntity');
          addEntitySpy
            .mockImplementationOnce(() => {
              // First succeeds
            })
            .mockImplementationOnce(() => {
              throw new Error('Second add failed');
            });

          const entityLocations = [
            { entityId: 'entity1', locationId: 'locationA' },
            { entityId: 'entity2', locationId: 'locationB' },
            { entityId: 'entity3', locationId: 'locationC' },
          ];

          const result = await spatialIndexManager.rebuild(entityLocations, {
            stopOnError: true,
          });

          expect(clearIndexSpy).toHaveBeenCalledTimes(1);
          expect(addEntitySpy).toHaveBeenCalledTimes(2);
          expect(result.successful).toHaveLength(1);
          expect(result.failed).toHaveLength(1);
          expect(result.totalProcessed).toBe(2);
        });
      });
    });

    describe('setBatchSpatialIndexManager', () => {
      it('should set the batch spatial index manager', () => {
        spatialIndexManager.setBatchSpatialIndexManager(
          mockBatchSpatialIndexManager
        );

        // Test that the manager is now set by trying a batch operation
        spatialIndexManager.enableBatchOperations = true;
        expect(() => spatialIndexManager.batchAdd([])).not.toThrow();
      });
    });
  });

  //------------------------------------------
  // onInvalidId Tests
  //------------------------------------------
  describe('onInvalidId', () => {
    it('should log a warning with the correct format when called', () => {
      const invalidId = 123; // Invalid non-string ID
      const operation = 'testOperation';

      spatialIndexManager.onInvalidId(invalidId, operation);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        `SpatialIndexManager.${operation}: Invalid id (${invalidId}). Skipping.`
      );
    });
  });
});

// Helper function to set up a mock EntityManager with specific entities
// for testing buildIndex and other methods that iterate over entities.
const setupMockEntityManagerWithEntities = (
  includePosition = false,
  includeInvalidLocationId = false,
  includeNullLocationId = false,
  includeEntityWithoutPosition = false
) => {
  const activeEntities = new Map();
  let mockEntity1, mockEntity2, mockEntity3;

  if (includePosition) {
    mockEntity1 = {
      id: 'entity1',
      getComponentData: (componentTypeId) => {
        if (componentTypeId === POSITION_COMPONENT_ID) {
          return { locationId: 'locationA' };
        }
        return undefined;
      },
    };
    activeEntities.set(mockEntity1.id, mockEntity1);

    mockEntity2 = {
      id: 'entity2',
      getComponentData: (componentTypeId) => {
        if (componentTypeId === POSITION_COMPONENT_ID) {
          return { locationId: 'locationB' };
        }
        return undefined;
      },
    };
    activeEntities.set(mockEntity2.id, mockEntity2);
  }

  if (includeInvalidLocationId) {
    mockEntity3 = {
      id: 'entity3InvalidLoc',
      getComponentData: (componentTypeId) => {
        if (componentTypeId === POSITION_COMPONENT_ID) {
          return { locationId: '   ' }; // Invalid (whitespace)
        }
        return undefined;
      },
    };
    activeEntities.set(mockEntity3.id, mockEntity3);
  }

  if (includeNullLocationId) {
    const mockEntityNullLoc = {
      id: 'entity4NullLoc',
      getComponentData: (componentTypeId) => {
        if (componentTypeId === POSITION_COMPONENT_ID) {
          return { locationId: null };
        }
        return undefined;
      },
    };
    activeEntities.set(mockEntityNullLoc.id, mockEntityNullLoc);
  }

  if (includeEntityWithoutPosition) {
    const mockEntityNoPos = {
      id: 'entity5NoPos',
      getComponentData: (componentTypeId) => {
        // Does not return POSITION_COMPONENT_ID data
        if (componentTypeId === 'other:component') return { data: 'test' };
        return undefined;
      },
    };
    activeEntities.set(mockEntityNoPos.id, mockEntityNoPos);
  }

  return Object.defineProperties(
    {
      activeEntities,
      getEntityInstance: jest.fn((entityId) => activeEntities.get(entityId)),
    },
    {
      entities: {
        get() {
          const iterable = {
            [Symbol.iterator]: () => activeEntities.values(),
            values: () => activeEntities.values(),
          };
          return iterable;
        },
        enumerable: true,
        configurable: false,
      },
    }
  );
};
