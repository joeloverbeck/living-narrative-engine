// tests/entities/spatialIndexManager.test.js

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

        // Set up spies BEFORE the code that might call them runs
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
        });
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {
        });

        // Create a fresh instance for each test AFTER spies are ready
        spatialIndexManager = new SpatialIndexManager();
    });

    //------------------------------------------
    // Constructor Tests
    //------------------------------------------
    describe('constructor', () => {
        it('should initialize with an empty locationIndex Map', () => {
            expect(spatialIndexManager.locationIndex).toBeDefined();
            expect(spatialIndexManager.locationIndex).toBeInstanceOf(Map);
            expect(spatialIndexManager.locationIndex.size).toBe(0);
            expect(consoleLogSpy).toHaveBeenCalledTimes(1);
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
            expect(consoleWarnSpy).not.toHaveBeenCalled();
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
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid entityId (null)'));
        });

        it('should ignore removal and warn if entityId is invalid (empty string)', () => {
            const originalSize = spatialIndexManager.locationIndex.size;
            spatialIndexManager.removeEntity('', 'locationA');
            expect(spatialIndexManager.locationIndex.size).toBe(originalSize);
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid entityId ()'));
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
            spatialIndexManager.updateEntityLocation('entity1', 'locationA', 'locationB');
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
            spatialIndexManager.updateEntityLocation('soloEntity', 'locationC', 'locationD');
            expect(spatialIndexManager.locationIndex.has('locationC')).toBe(false);
            expect(spatialIndexManager.locationIndex.has('locationD')).toBe(true);
            expect(spatialIndexManager.locationIndex.get('locationD').has('soloEntity')).toBe(true);
        });


        it('should remove an entity from its old location when moving to null', () => {
            spatialIndexManager.updateEntityLocation('entity1', 'locationA', null);
            const locationASet = spatialIndexManager.locationIndex.get('locationA');
            expect(locationASet.has('entity1')).toBe(false);
            expect(locationASet.size).toBe(1);
            expect(spatialIndexManager.locationIndex.size).toBe(1);
        });

        it('should remove an entity from its old location when moving to undefined', () => {
            spatialIndexManager.updateEntityLocation('entity1', 'locationA', undefined);
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
            expect(spatialIndexManager.locationIndex.get('locationC').has('entity3')).toBe(true);
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
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid entityId'));
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
            const entities = spatialIndexManager.getEntitiesInLocation('nonExistentLocation');
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
        let mockEntityManager;
        let mockEntity1, mockEntity2, mockEntityInvalidLoc, mockEntityNoPos, mockEntityMissingMethod, invalidEntityObj;

        const DUMMY_DEFINITION_ID = 'def-spatial-test'; // Common definition ID

        beforeEach(() => {
            // Create mock entities using the new Entity constructor
            mockEntity1 = new Entity('entity1-instance', DUMMY_DEFINITION_ID);
            mockEntity1.addComponent(POSITION_COMPONENT_ID, {locationId: 'locationA'});

            mockEntity2 = new Entity('entity2-instance', DUMMY_DEFINITION_ID);
            mockEntity2.addComponent(POSITION_COMPONENT_ID, {locationId: 'locationB'});

            mockEntityInvalidLoc = new Entity('entityInvalidLoc-instance', DUMMY_DEFINITION_ID);
            mockEntityInvalidLoc.addComponent(POSITION_COMPONENT_ID, {locationId: null});

            mockEntityNoPos = new Entity('entityNoPos-instance', DUMMY_DEFINITION_ID);

            invalidEntityObj = null;
            // This mock is for an object that *looks like* an entity but isn't, or is missing methods.
            // It still needs an 'id' if it's going to be a key in activeEntities.
            mockEntityMissingMethod = {
                id: 'entityMissingMethod-instance',
                definitionId: DUMMY_DEFINITION_ID,
                // No getComponentData method
            };

            mockEntityManager = {
                activeEntities: new Map([
                    ['entity1-instance', mockEntity1],
                    ['entity2-instance', mockEntity2],
                    ['entityInvalidLoc-instance', mockEntityInvalidLoc],
                    ['entityNoPos-instance', mockEntityNoPos],
                    ['invalidEntityObjKey-instance', invalidEntityObj], // Key is instance ID
                    ['entityMissingMethodKey-instance', mockEntityMissingMethod] // Key is instance ID
                ]),
            };
            // Clear console spies again specifically for buildIndex logging accuracy
            consoleWarnSpy.mockClear();
            consoleErrorSpy.mockClear();
            consoleLogSpy.mockClear();
            // Ensure SpatialIndexManager's own index is clear before buildIndex test
            spatialIndexManager.locationIndex.clear();
        });

        it('should correctly build the index using getComponentData', () => {
            spatialIndexManager.buildIndex(mockEntityManager);

            expect(spatialIndexManager.locationIndex.size).toBe(2);
            expect(spatialIndexManager.locationIndex.has('locationA')).toBe(true);
            const locationASet = spatialIndexManager.locationIndex.get('locationA');
            expect(locationASet.size).toBe(1);
            expect(locationASet.has('entity1-instance')).toBe(true);

            expect(spatialIndexManager.locationIndex.has('locationB')).toBe(true);
            const locationBSet = spatialIndexManager.locationIndex.get('locationB');
            expect(locationBSet.size).toBe(1);
            expect(locationBSet.has('entity2-instance')).toBe(true);

            let hasNullKey = false;
            for (const key of spatialIndexManager.locationIndex.keys()) {
                if (key === null || key === undefined || key === '') hasNullKey = true;
            }
            expect(hasNullKey).toBe(false);

            expect(consoleLogSpy).toHaveBeenCalledWith('SpatialIndexManager: Building index from active entities...');
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid entity object for ID invalidEntityObjKey-instance'));
            expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Skipping invalid entity object for ID entityMissingMethodKey-instance'));
            expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Index build complete. Added 2 entities with valid location IDs to the index.'));
        });

        it('should clear the existing index before building', () => {
            spatialIndexManager.addEntity('preExistingEntity-instance', 'locationOld');
            expect(spatialIndexManager.locationIndex.size).toBe(1);

            spatialIndexManager.buildIndex(mockEntityManager);

            expect(spatialIndexManager.locationIndex.has('locationOld')).toBe(false);
            expect(spatialIndexManager.locationIndex.size).toBe(2); // From mockEntityManager
            expect(spatialIndexManager.locationIndex.has('locationA')).toBe(true);
            expect(spatialIndexManager.locationIndex.has('locationB')).toBe(true);
        });

        it('should handle invalid EntityManager gracefully', () => {
            // Ensure spies are clear before these specific checks
            consoleErrorSpy.mockClear();
            consoleLogSpy.mockClear();

            spatialIndexManager.buildIndex(null);
            expect(spatialIndexManager.locationIndex.size).toBe(0);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid EntityManager'));
            expect(consoleLogSpy).toHaveBeenCalledWith('SpatialIndexManager: Building index from active entities...');
            expect(consoleLogSpy).not.toHaveBeenCalledWith(expect.stringContaining('Index build complete'));


            consoleErrorSpy.mockClear();
            consoleLogSpy.mockClear();
            spatialIndexManager.buildIndex({}); // Missing activeEntities
            expect(spatialIndexManager.locationIndex.size).toBe(0);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid EntityManager'));


            consoleErrorSpy.mockClear();
            consoleLogSpy.mockClear();
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
            spatialIndexManager.addEntity('entity1', 'locationA');
            spatialIndexManager.addEntity('entity2', 'locationB');
            expect(spatialIndexManager.locationIndex.size).toBe(2);
            consoleLogSpy.mockClear(); // Clear constructor log

            spatialIndexManager.clearIndex();

            expect(spatialIndexManager.locationIndex.size).toBe(0);
            expect(consoleLogSpy).toHaveBeenCalledWith('SpatialIndexManager: Index cleared.');
        });

        it('should work correctly on an already empty index', () => {
            expect(spatialIndexManager.locationIndex.size).toBe(0);
            consoleLogSpy.mockClear(); // Clear constructor log

            spatialIndexManager.clearIndex();

            expect(spatialIndexManager.locationIndex.size).toBe(0);
            expect(consoleLogSpy).toHaveBeenCalledWith('SpatialIndexManager: Index cleared.');
        });
    });
});