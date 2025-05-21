// src/tests/core/spatialIndexManager.test.js

import {describe, it, expect, beforeEach, jest} from '@jest/globals';
import SpatialIndexManager from '../../src/entities/spatialIndexManager.js';
import {POSITION_COMPONENT_ID} from '../../src/constants/componentIds.js'; // Assuming path is correct
import Entity from '../../src/entities/entity.js'; // Needed for buildIndex mock

describe('SpatialIndexManager', () => {
    /** @type {SpatialIndexManager} */
    let spatialIndexManager;
    let consoleWarnSpy;
    let consoleErrorSpy;
    let consoleLogSpy;

    beforeEach(() => {
        // Restore any spied-on console methods before each test to prevent interference
        jest.restoreAllMocks();

        // --- Correction: Set up spies BEFORE the code that might call them runs ---
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        }); // Spy on log as well

        // Create a fresh instance for each test AFTER spies are ready
        spatialIndexManager = new SpatialIndexManager();
    });

    //------------------------------------------
    // Constructor Tests
    //------------------------------------------
    describe('constructor', () => {
        it('should initialize with an empty locationIndex Map', () => {
            // Instance is created in beforeEach
            expect(spatialIndexManager.locationIndex).toBeDefined();
            expect(spatialIndexManager.locationIndex).toBeInstanceOf(Map);
            expect(spatialIndexManager.locationIndex.size).toBe(0);

            // --- Verification ---
            // Now the spy was active during construction, so this should pass
            expect(consoleLogSpy).toHaveBeenCalledTimes(1); // Ensure it was called exactly once
            expect(consoleLogSpy).toHaveBeenCalledWith('SpatialIndexManager initialized.');
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
            expect(spatialIndexManager.locationIndex.get('locationA').has('entity1')).toBe(true);
            expect(spatialIndexManager.locationIndex.get('locationB').has('entity2')).toBe(true);
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
            expect(consoleWarnSpy).not.toHaveBeenCalled(); // Should not warn, this is expected
        });

        it('should ignore adding if locationId is undefined', () => {
            spatialIndexManager.addEntity('entity1', undefined);
            expect(spatialIndexManager.locationIndex.size).toBe(0);
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('should ignore adding if locationId is an empty string', () => {
            spatialIndexManager.addEntity('entity1', '');
            expect(spatialIndexManager.locationIndex.size).toBe(0);
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('should ignore adding if locationId is a whitespace string', () => {
            spatialIndexManager.addEntity('entity1', '   ');
            expect(spatialIndexManager.locationIndex.size).toBe(0);
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('should ignore adding and warn if entityId is invalid (null)', () => {
            spatialIndexManager.addEntity(null, 'locationA');
            expect(spatialIndexManager.locationIndex.size).toBe(0);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid entityId (null)'));
        });

        it('should ignore adding and warn if entityId is invalid (empty string)', () => {
            spatialIndexManager.addEntity('', 'locationA');
            expect(spatialIndexManager.locationIndex.size).toBe(0);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid entityId ()'));
        });

        it('should ignore adding and warn if entityId is invalid (whitespace string)', () => {
            spatialIndexManager.addEntity('   ', 'locationA');
            expect(spatialIndexManager.locationIndex.size).toBe(0);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid entityId (   )'));
        });
    });

    //------------------------------------------
    // removeEntity Tests
    //------------------------------------------
    describe('removeEntity', () => {
        beforeEach(() => {
            // Pre-populate for removal tests needs to happen *after* main beforeEach
            // because main beforeEach clears mocks and creates the instance.
            // Add data directly here.
            spatialIndexManager.addEntity('entity1', 'locationA');
            spatialIndexManager.addEntity('entity2', 'locationA');
            spatialIndexManager.addEntity('entity3', 'locationB');
        });

        it('should remove an entity from a location', () => {
            const removed = spatialIndexManager.removeEntity('entity1', 'locationA');
            expect(removed).toBeUndefined(); // Method returns void
            const locationASet = spatialIndexManager.locationIndex.get('locationA');
            expect(locationASet.size).toBe(1);
            expect(locationASet.has('entity1')).toBe(false);
            expect(locationASet.has('entity2')).toBe(true);
            expect(spatialIndexManager.locationIndex.has('locationA')).toBe(true); // Location should still exist
        });

        it('should remove the location entry if the last entity is removed', () => {
            spatialIndexManager.removeEntity('entity3', 'locationB');
            expect(spatialIndexManager.locationIndex.has('locationB')).toBe(false);
            expect(spatialIndexManager.locationIndex.size).toBe(1); // Only locationA remains
        });

        it('should do nothing if the entity is not in the specified location', () => {
            spatialIndexManager.removeEntity('entity1', 'locationB'); // entity1 is in locationA
            expect(spatialIndexManager.locationIndex.get('locationA').size).toBe(2);
            expect(spatialIndexManager.locationIndex.get('locationB').size).toBe(1);
            expect(consoleWarnSpy).not.toHaveBeenCalled(); // Optional: check for specific internal warnings if added
        });

        it('should do nothing if the location does not exist', () => {
            spatialIndexManager.removeEntity('entity1', 'nonExistentLocation');
            expect(spatialIndexManager.locationIndex.get('locationA').size).toBe(2);
            expect(spatialIndexManager.locationIndex.size).toBe(2); // locationA and locationB still exist
            expect(consoleWarnSpy).not.toHaveBeenCalled(); // Optional: check for specific internal warnings if added
        });

        it('should do nothing if locationId is null', () => {
            const originalSize = spatialIndexManager.locationIndex.size; // Should be 2 from nested beforeEach
            spatialIndexManager.removeEntity('entity1', null);
            expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
            expect(spatialIndexManager.locationIndex.get('locationA').size).toBe(2);
            expect(consoleWarnSpy).not.toHaveBeenCalled(); // No warning for null/invalid locationId on remove
        });

        it('should do nothing if locationId is undefined', () => {
            const originalSize = spatialIndexManager.locationIndex.size;
            spatialIndexManager.removeEntity('entity1', undefined);
            expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
            expect(spatialIndexManager.locationIndex.get('locationA').size).toBe(2);
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('should do nothing if locationId is an empty string', () => {
            const originalSize = spatialIndexManager.locationIndex.size;
            spatialIndexManager.removeEntity('entity1', '');
            expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
            expect(spatialIndexManager.locationIndex.get('locationA').size).toBe(2);
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('should do nothing if locationId is a whitespace string', () => {
            const originalSize = spatialIndexManager.locationIndex.size;
            spatialIndexManager.removeEntity('entity1', '   ');
            expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
            expect(spatialIndexManager.locationIndex.get('locationA').size).toBe(2);
            expect(consoleWarnSpy).not.toHaveBeenCalled();
        });

        it('should ignore removal and warn if entityId is invalid (null)', () => {
            const originalSize = spatialIndexManager.locationIndex.size;
            spatialIndexManager.removeEntity(null, 'locationA');
            expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
            expect(spatialIndexManager.locationIndex.get('locationA').size).toBe(2);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid entityId (null)'));
        });

        it('should ignore removal and warn if entityId is invalid (empty string)', () => {
            const originalSize = spatialIndexManager.locationIndex.size;
            spatialIndexManager.removeEntity('', 'locationA');
            expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
            expect(spatialIndexManager.locationIndex.get('locationA').size).toBe(2);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid entityId ()'));
        });
    });

    //------------------------------------------
    // updateEntityLocation Tests
    //------------------------------------------
    describe('updateEntityLocation', () => {
        beforeEach(() => {
            // Pre-populate for update tests
            spatialIndexManager.addEntity('entity1', 'locationA');
            spatialIndexManager.addEntity('entity2', 'locationA');
            // entity3 starts with no location (or null/undefined location)
        });

        it('should move an entity from one valid location to another', () => {
            spatialIndexManager.updateEntityLocation('entity1', 'locationA', 'locationB');

            // Check removed from old location
            const locationASet = spatialIndexManager.locationIndex.get('locationA');
            expect(locationASet.has('entity1')).toBe(false);
            expect(locationASet.size).toBe(1); // entity2 should still be there

            // Check added to new location
            expect(spatialIndexManager.locationIndex.has('locationB')).toBe(true);
            const locationBSet = spatialIndexManager.locationIndex.get('locationB');
            expect(locationBSet).toBeDefined();
            expect(locationBSet.size).toBe(1);
            expect(locationBSet.has('entity1')).toBe(true);
        });

        it('should remove the old location entry if it becomes empty after moving the entity', () => {
            spatialIndexManager.addEntity('soloEntity', 'locationC'); // Add an entity to its own location
            spatialIndexManager.updateEntityLocation('soloEntity', 'locationC', 'locationD');

            // Check old location is gone
            expect(spatialIndexManager.locationIndex.has('locationC')).toBe(false);

            // Check entity is in new location
            expect(spatialIndexManager.locationIndex.has('locationD')).toBe(true);
            expect(spatialIndexManager.locationIndex.get('locationD').has('soloEntity')).toBe(true);
        });


        it('should remove an entity from its old location when moving to null', () => {
            spatialIndexManager.updateEntityLocation('entity1', 'locationA', null);

            // Check removed from old location
            const locationASet = spatialIndexManager.locationIndex.get('locationA');
            expect(locationASet.has('entity1')).toBe(false);
            expect(locationASet.size).toBe(1); // entity2 still there

            // Check not added anywhere else (implicitly, size doesn't increase)
            expect(spatialIndexManager.locationIndex.size).toBe(1); // Only locationA should remain
        });

        it('should remove an entity from its old location when moving to undefined', () => {
            spatialIndexManager.updateEntityLocation('entity1', 'locationA', undefined);
            const locationASet = spatialIndexManager.locationIndex.get('locationA');
            expect(locationASet.has('entity1')).toBe(false);
            expect(locationASet.size).toBe(1);
            expect(spatialIndexManager.locationIndex.size).toBe(1);
        });

        it('should remove an entity from its old location when moving to empty string', () => {
            spatialIndexManager.updateEntityLocation('entity1', 'locationA', '');
            const locationASet = spatialIndexManager.locationIndex.get('locationA');
            expect(locationASet.has('entity1')).toBe(false);
            expect(locationASet.size).toBe(1);
            expect(spatialIndexManager.locationIndex.size).toBe(1);
        });

        it('should remove an entity from its old location when moving to whitespace string', () => {
            spatialIndexManager.updateEntityLocation('entity1', 'locationA', '   ');
            const locationASet = spatialIndexManager.locationIndex.get('locationA');
            expect(locationASet.has('entity1')).toBe(false);
            expect(locationASet.size).toBe(1);
            expect(spatialIndexManager.locationIndex.size).toBe(1);
        });


        it('should add an entity to a new location when moving from null', () => {
            spatialIndexManager.updateEntityLocation('entity3', null, 'locationC');

            // Check added to new location
            expect(spatialIndexManager.locationIndex.has('locationC')).toBe(true);
            const locationCSet = spatialIndexManager.locationIndex.get('locationC');
            expect(locationCSet.size).toBe(1);
            expect(locationCSet.has('entity3')).toBe(true);

            // Check other locations unaffected
            expect(spatialIndexManager.locationIndex.get('locationA').size).toBe(2);
            expect(spatialIndexManager.locationIndex.size).toBe(2); // locationA and locationC
        });

        it('should add an entity to a new location when moving from undefined', () => {
            spatialIndexManager.updateEntityLocation('entity3', undefined, 'locationC');
            expect(spatialIndexManager.locationIndex.has('locationC')).toBe(true);
            expect(spatialIndexManager.locationIndex.get('locationC').has('entity3')).toBe(true);
            expect(spatialIndexManager.locationIndex.size).toBe(2);
        });

        it('should add an entity to a new location when moving from empty string', () => {
            spatialIndexManager.updateEntityLocation('entity3', '', 'locationC');
            expect(spatialIndexManager.locationIndex.has('locationC')).toBe(true);
            expect(spatialIndexManager.locationIndex.get('locationC').has('entity3')).toBe(true);
            expect(spatialIndexManager.locationIndex.size).toBe(2);
        });

        it('should add an entity to a new location when moving from whitespace string', () => {
            spatialIndexManager.updateEntityLocation('entity3', '   ', 'locationC');
            expect(spatialIndexManager.locationIndex.has('locationC')).toBe(true);
            expect(spatialIndexManager.locationIndex.get('locationC').has('entity3')).toBe(true);
            expect(spatialIndexManager.locationIndex.size).toBe(2);
        });

        it('should do nothing if old and new locations are the same (valid string)', () => {
            const originalLocationASet = new Set(spatialIndexManager.locationIndex.get('locationA'));
            const originalSize = spatialIndexManager.locationIndex.size;

            spatialIndexManager.updateEntityLocation('entity1', 'locationA', 'locationA');

            expect(spatialIndexManager.locationIndex.get('locationA')).toEqual(originalLocationASet);
            expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
        });

        it('should do nothing if old and new locations are the same (null)', () => {
            const originalSize = spatialIndexManager.locationIndex.size; // Should be 1 (locationA) from outer beforeEach + nested
            spatialIndexManager.updateEntityLocation('entity3', null, null); // entity3 starts outside index
            expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
            expect(spatialIndexManager.locationIndex.has('locationA')).toBe(true);
        });

        it('should do nothing if old and new locations are effectively the same (null/undefined/empty/whitespace)', () => {
            const originalSize = spatialIndexManager.locationIndex.size;
            spatialIndexManager.updateEntityLocation('entity3', null, undefined);
            expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
            spatialIndexManager.updateEntityLocation('entity3', undefined, '');
            expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
            spatialIndexManager.updateEntityLocation('entity3', '', '   ');
            expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
            spatialIndexManager.updateEntityLocation('entity3', '   ', null);
            expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
        });

        it('should ignore update and warn if entityId is invalid', () => {
            const originalSize = spatialIndexManager.locationIndex.size;
            spatialIndexManager.updateEntityLocation('', 'locationA', 'locationB');
            expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
            expect(spatialIndexManager.locationIndex.get('locationA').size).toBe(2);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid entityId'));
        });
    });

    //------------------------------------------
    // getEntitiesInLocation Tests
    //------------------------------------------
    describe('getEntitiesInLocation', () => {
        beforeEach(() => {
            // Pre-populate
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
            const entities = spatialIndexManager.getEntitiesInLocation('nonExistentLocation');
            expect(entities).toBeInstanceOf(Set);
            expect(entities.size).toBe(0);
        });

        it('should return an empty Set if locationId is null', () => {
            const entities = spatialIndexManager.getEntitiesInLocation(null);
            expect(entities).toBeInstanceOf(Set);
            expect(entities.size).toBe(0);
            // Warnings for invalid input are optional here, often silenced
            // expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid or null locationId (null) requested.'));
        });

        it('should return an empty Set if locationId is undefined', () => {
            const entities = spatialIndexManager.getEntitiesInLocation(undefined);
            expect(entities).toBeInstanceOf(Set);
            expect(entities.size).toBe(0);
            // expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid or null locationId (undefined) requested.'));
        });

        it('should return an empty Set if locationId is an empty string', () => {
            const entities = spatialIndexManager.getEntitiesInLocation('');
            expect(entities).toBeInstanceOf(Set);
            expect(entities.size).toBe(0);
            // expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid or null locationId () requested.'));
        });

        it('should return an empty Set if locationId is a whitespace string', () => {
            const entities = spatialIndexManager.getEntitiesInLocation('   ');
            expect(entities).toBeInstanceOf(Set);
            expect(entities.size).toBe(0);
            // expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid or null locationId'));
        });

        it('should return a *copy* of the internal Set', () => {
            const entities = spatialIndexManager.getEntitiesInLocation('locationA');
            expect(entities.size).toBe(2);

            // Modify the returned set
            entities.add('entity3');
            entities.delete('entity1');

            // Check the internal set remains unchanged
            const internalSet = spatialIndexManager.locationIndex.get('locationA');
            expect(internalSet.size).toBe(2);
            expect(internalSet.has('entity1')).toBe(true);
            expect(internalSet.has('entity2')).toBe(true);
            expect(internalSet.has('entity3')).toBe(false);
        });
    });

    //------------------------------------------
    // buildIndex Tests
    //------------------------------------------
    describe('buildIndex', () => {
        let mockEntityManager;
        let mockEntity1, mockEntity2, mockEntityInvalidLoc, mockEntityNoPos, mockEntityMissingMethod, invalidEntityObj;

        beforeEach(() => {
            // Create mock entities using the actual Entity class (which has getComponentData)
            mockEntity1 = new Entity('entity1');
            mockEntity1.addComponent(POSITION_COMPONENT_ID, {locationId: 'locationA'});

            mockEntity2 = new Entity('entity2');
            mockEntity2.addComponent(POSITION_COMPONENT_ID, {locationId: 'locationB'});

            mockEntityInvalidLoc = new Entity('entityInvalidLoc');
            mockEntityInvalidLoc.addComponent(POSITION_COMPONENT_ID, {locationId: null}); // Invalid location

            mockEntityNoPos = new Entity('entityNoPos'); // No position component added

            // Create deliberately invalid/incomplete objects for testing robustness
            invalidEntityObj = null;
            mockEntityMissingMethod = {id: 'entityMissingMethod' /* no getComponentData */};

            // Mock the EntityManager
            mockEntityManager = {
                activeEntities: new Map([
                    ['entity1', mockEntity1],
                    ['entity2', mockEntity2],
                    ['entityInvalidLoc', mockEntityInvalidLoc], // Has position comp, invalid locationId
                    ['entityNoPos', mockEntityNoPos],         // No position comp
                    ['invalidEntityObjKey', invalidEntityObj], // Falsy entity object
                    ['entityMissingMethodKey', mockEntityMissingMethod] // Entity object missing required method
                ]),
            };
        });

        // --- Test with the *actual*, fixed buildIndex method ---
        it('should correctly build the index using getComponentData', () => {
            // --- Act ---
            // Call the REAL buildIndex method, not a simulation
            spatialIndexManager.buildIndex(mockEntityManager);

            // --- Assert ---
            // Check that only entities with VALID position components and VALID location IDs were added
            expect(spatialIndexManager.locationIndex.size).toBe(2); // Only locationA and locationB

            // Check locationA
            expect(spatialIndexManager.locationIndex.has('locationA')).toBe(true);
            const locationASet = spatialIndexManager.locationIndex.get('locationA');
            expect(locationASet.size).toBe(1);
            expect(locationASet.has('entity1')).toBe(true);

            // Check locationB
            expect(spatialIndexManager.locationIndex.has('locationB')).toBe(true);
            const locationBSet = spatialIndexManager.locationIndex.get('locationB');
            expect(locationBSet.size).toBe(1);
            expect(locationBSet.has('entity2')).toBe(true);

            // Check entities that should NOT be indexed
            // No location should exist for null, undefined, etc.
            let hasNullKey = false;
            for (const key of spatialIndexManager.locationIndex.keys()) {
                if (key === null || key === undefined || key === '') hasNullKey = true;
            }
            expect(hasNullKey).toBe(false);


            // Verify logs
            expect(consoleLogSpy).toHaveBeenCalledWith('SpatialIndexManager: Building index from active entities...');
            // Check warnings for skipped entities (order might vary depending on Map iteration)
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid entity object for ID invalidEntityObjKey'));
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid entity object for ID entityMissingMethodKey'));
            // Final log with correct count
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Index build complete. Added 2 entities with valid location IDs to the index.'));
        });

        it('should clear the existing index before building', () => {
            // Add something to the index first
            spatialIndexManager.addEntity('preExistingEntity', 'locationOld');
            expect(spatialIndexManager.locationIndex.size).toBe(1);

            // --- Act ---
            // Call the REAL buildIndex
            spatialIndexManager.buildIndex(mockEntityManager);

            // --- Assert ---
            // Verify the old location is gone
            expect(spatialIndexManager.locationIndex.has('locationOld')).toBe(false);
            // Verify the new locations are present (based on mockEntityManager)
            expect(spatialIndexManager.locationIndex.size).toBe(2);
            expect(spatialIndexManager.locationIndex.has('locationA')).toBe(true);
            expect(spatialIndexManager.locationIndex.has('locationB')).toBe(true);
        });

        it('should handle invalid EntityManager gracefully', () => {
            spatialIndexManager.buildIndex(null);
            expect(spatialIndexManager.locationIndex.size).toBe(0);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid EntityManager'));
            expect(consoleLogSpy).toHaveBeenCalledWith('SpatialIndexManager: Building index from active entities...'); // Log attempt
            expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Index build complete')); // But not completion

            // Reset spies for next check if needed, or check call counts carefully
            // jest.clearAllMocks(); // Or reset specific spies: consoleErrorSpy.mockClear(); consoleLogSpy.mockClear();
            // Create spies again if cleared entirely

            spatialIndexManager.buildIndex({}); // Missing activeEntities
            expect(spatialIndexManager.locationIndex.size).toBe(0);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid EntityManager'));

            spatialIndexManager.buildIndex({activeEntities: 'not a map'}); // Invalid activeEntities type
            expect(spatialIndexManager.locationIndex.size).toBe(0);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid EntityManager'));
        });
    });

    //------------------------------------------
    // clearIndex Tests
    //------------------------------------------
    describe('clearIndex', () => {
        it('should remove all entries from the locationIndex', () => {
            // Add some data
            spatialIndexManager.addEntity('entity1', 'locationA');
            spatialIndexManager.addEntity('entity2', 'locationB');
            expect(spatialIndexManager.locationIndex.size).toBe(2);

            // Clear the index
            spatialIndexManager.clearIndex();

            // Verify it's empty
            expect(spatialIndexManager.locationIndex.size).toBe(0);
            expect(consoleLogSpy).toHaveBeenCalledWith('SpatialIndexManager: Index cleared.');
        });

        it('should work correctly on an already empty index', () => {
            expect(spatialIndexManager.locationIndex.size).toBe(0);
            spatialIndexManager.clearIndex();
            expect(spatialIndexManager.locationIndex.size).toBe(0);
            expect(consoleLogSpy).toHaveBeenCalledWith('SpatialIndexManager: Index cleared.');
        });
    });
});
