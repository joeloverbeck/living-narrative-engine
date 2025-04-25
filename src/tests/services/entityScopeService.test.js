// src/services/entityScopeService.test.js

import {beforeEach, describe, expect, jest, test, afterEach} from '@jest/globals'; // Added afterEach for safety
import {getEntityIdsForScopes} from '../../services/entityScopeService.js'; // Adjust path as needed
import Entity from '../../entities/entity.js';
import {
  CONNECTIONS_COMPONENT_TYPE_ID,
  EQUIPMENT_COMPONENT_ID,
  EQUIPPABLE_COMPONENT_ID, HEALTH_COMPONENT_ID,
  INVENTORY_COMPONENT_ID, ITEM_COMPONENT_ID, NAME_COMPONENT_TYPE_ID, PASSAGE_DETAILS_COMPONENT_TYPE_ID,
  POSITION_COMPONENT_ID
} from '../../types/components.js'; // Adjust path as needed
// REMOVED: No more Component class imports needed here

// ******** DEFINE YOUR ACTUAL COMPONENT TYPE ID STRINGS HERE ********
// These MUST match the strings used in your game data and logic.
// Add any other component type IDs used in your tests

// --- Mocks ---
// Mock console methods BEFORE tests run to capture logs during setup/execution
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {
});
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {
});
// Mock console.log as well to potentially suppress entity creation logs if needed
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {
});

// Mock EntityManager adhering to its expected interface
const mockEntityManager = {
  // Use jest.fn() for methods we want to spy on or provide mock implementations for
  getEntityInstance: jest.fn((id) => mockEntityManager.entities.get(id)),
  getEntitiesInLocation: jest.fn((locId) => mockEntityManager.locations.get(locId) || new Set()),
  // Internal state for the mock
  entities: new Map(), // Map<entityId, Entity>
  locations: new Map(), // Map<locationId, Set<entityId>>
};

// Mock Entities (will be instantiated in beforeEach)
let mockPlayerEntity;
let mockCurrentLocation;

// --- Test Context ---
// Mimics the ActionContext structure passed to the service
const mockContext = {
  playerEntity: null, // Will be set in beforeEach
  currentLocation: null, // Will be set in beforeEach
  entityManager: mockEntityManager,
  // Include other potential context properties even if not used by this service directly
  dispatch: jest.fn(),
  targets: [],
  gameDataRepository: {}, // Keep if needed by other parts, otherwise remove
};

// --- Helper Functions (REVISED for NO CLASSES) ---

/**
 * Creates a mock entity with specified components.
 * @param {string} id - The entity ID.
 * @param {object | null} nameComponentData - The data object for the name component (e.g., { value: "Player" }) or null.
 * @param {Record<string, object>} [components={}] - An object where keys are componentTypeId strings
 * and values are the component data objects.
 * @returns {Entity} The created entity instance.
 */
const createMockEntity = (id, nameComponentData, components = {}) => {
  const entity = new Entity(id); // Entity constructor is likely unchanged

  // Add name component if data is provided
  if (nameComponentData && typeof nameComponentData === 'object') {
    // Use the defined constant for the name component ID
    entity.addComponent(NAME_COMPONENT_TYPE_ID, {...nameComponentData}); // Add copy
  }

  // Add other components from the provided map
  for (const [componentTypeId, componentData] of Object.entries(components)) {
    // Ensure data is a valid object before adding
    if (typeof componentData === 'object' && componentData !== null) {
      // Directly use the typeId and data from the map
      entity.addComponent(componentTypeId, {...componentData}); // Add copy
    } else {
      console.warn(`[createMockEntity] Skipping invalid data for component '${componentTypeId}' on entity '${id}'. Data:`, componentData);
    }
  }

  mockEntityManager.entities.set(id, entity); // Register entity with mock manager
  return entity;
};

/**
 * Ensures an entity has a specific component, adding it with initial data if absent.
 * Returns the component's data object.
 * @param {Entity} entity - The entity instance.
 * @param {string} componentTypeId - The string ID of the component type.
 * @param {object} [initialData={}] - The initial data to use if the component is added.
 * @returns {object | undefined} The component data object (existing or newly added), or undefined if entity is invalid.
 */
const ensureComponent = (entity, componentTypeId, initialData = {}) => {
  if (!entity || typeof componentTypeId !== 'string') {
    console.error('[ensureComponent] Invalid entity or componentTypeId provided.');
    return undefined;
  }

  if (!entity.hasComponent(componentTypeId)) {
    // Clone initial data only when adding to prevent reference sharing issues
    const clonedInitialData = JSON.parse(JSON.stringify(initialData));
    entity.addComponent(componentTypeId, clonedInitialData);
  }
  // Return the actual data object stored within the entity
  return entity.getComponentData(componentTypeId);
};


const placeInLocation = (entityId, locationId, x = 0, y = 0) => {
  if (!mockEntityManager.locations.has(locationId)) {
    mockEntityManager.locations.set(locationId, new Set());
  }
  mockEntityManager.locations.get(locationId).add(entityId); // Add entity ID to location set
  const entity = mockEntityManager.entities.get(entityId);

  if (entity) {
    // Use ensureComponent with the TYPE ID string and the desired DATA structure
    const posData = ensureComponent(entity, POSITION_COMPONENT_ID, {locationId, x, y});
    // ensureComponent adds the component if missing. If it exists, it returns the data.
    // Now, update the data object directly.
    if (posData) { // Check if ensureComponent returned data
      posData.locationId = locationId;
      posData.x = x;
      posData.y = y;
    }
  }
};

const addToInventory = (entityId, ownerEntity) => {
  // Use ensureComponent with the TYPE ID string and INITIAL data
  const invData = ensureComponent(ownerEntity, INVENTORY_COMPONENT_ID, {items: []});

  // Modify the data object directly
  if (invData && invData.items && !invData.items.includes(entityId)) {
    invData.items.push(entityId);
  }

  // Update Position component data of the item being added
  const itemEntity = mockEntityManager.entities.get(entityId);
  if (itemEntity?.hasComponent(POSITION_COMPONENT_ID)) {
    const itemPosData = itemEntity.getComponentData(POSITION_COMPONENT_ID);
    if (itemPosData) {
      itemPosData.locationId = null; // Set locationId to null in the data object
    }
  }
};

const equipItem = (itemId, slotId, ownerEntity) => {
  // Ensure EquipmentComponent data exists. Initial data is only used if the component is ABSENT.
  // Since the player entity is created WITH equipment data, this initialData isn't used for the player.
  const eqData = ensureComponent(ownerEntity, EQUIPMENT_COMPONENT_ID, {slots: {}});

  // Check if the data and the slots object exist before modification
  if (eqData?.slots) {
    // No real need to check hasOwnProperty if the slot is guaranteed to exist by createMockEntity
    // Directly assign the item ID to the slot in the data object
    eqData.slots[slotId] = itemId;
  } else {
    console.error(`[equipItem] Failed to get equipment data or slots for entity ${ownerEntity.id}`);
  }
};

// --- Test Suite ---
describe('entityScopeService', () => {
  // Declare variables for common test entities AT THE TOP LEVEL
  let sword, shield, potion, goblin, rock, rustyKey, shinyKey, door;
  let expectedNearbySet;
  // *** Declare passage/blocker variables at the top level ***
  let passage1, passage2, blocker1, blocker2, location2;

  // --- Reset Mocks and Setup Common Test Data Before Each Test ---
  beforeEach(() => {
    // Clear mock function calls and internal states
    mockConsoleWarn.mockClear();
    mockConsoleError.mockClear();
    mockConsoleLog.mockClear(); // Clear log mock too
    mockEntityManager.entities.clear();
    mockEntityManager.locations.clear();
    // Reset mock implementations to default behavior
    mockEntityManager.getEntityInstance.mockImplementation((id) => mockEntityManager.entities.get(id));
    // This mock should still work correctly as it deals with IDs
    mockEntityManager.getEntitiesInLocation.mockImplementation((locId) => {
      const allIds = mockEntityManager.locations.get(locId) || new Set();
      const filteredIds = new Set();
      for (const id of allIds) {
        if (mockContext.playerEntity && id === mockContext.playerEntity.id) {
          continue;
        }
        filteredIds.add(id);
      }
      return filteredIds;
    });
    mockContext.dispatch.mockClear();

    // Create fresh player and location for isolation
    // Use consistent IDs for easier debugging
    mockPlayerEntity = createMockEntity('player-1',
      {value: 'Player'}, // Name data
      { // Components map
        [INVENTORY_COMPONENT_ID]: {items: []},
        [EQUIPMENT_COMPONENT_ID]: {slots: {'main': null, 'off': null}}
      }
    );
    mockCurrentLocation = createMockEntity('loc-room1',
      {value: 'Test Room'},
      { // Add connections component data structure here if needed by tests
        // [CONNECTIONS_COMPONENT_ID]: { connections: {} }
      }
    );

    // Place player in the mock location (will be filtered out by mock getEntitiesInLocation)
    placeInLocation(mockPlayerEntity.id, mockCurrentLocation.id, 1, 1);

    // Update context with fresh player/location references
    mockContext.playerEntity = mockPlayerEntity;
    mockContext.currentLocation = mockCurrentLocation;

    // Create common test entities - using the NEW structure
    sword = createMockEntity('item-sword', {value: 'iron sword'}, {
      [ITEM_COMPONENT_ID]: {}, [EQUIPPABLE_COMPONENT_ID]: {slotId: 'main'}
    });
    shield = createMockEntity('item-shield', {value: 'wooden shield'}, {
      [ITEM_COMPONENT_ID]: {}, [EQUIPPABLE_COMPONENT_ID]: {slotId: 'off'}
    });
    potion = createMockEntity('item-potion', {value: 'red potion'}, {[ITEM_COMPONENT_ID]: {}});
    rustyKey = createMockEntity('item-key-rusty', {value: 'rusty key'}, {[ITEM_COMPONENT_ID]: {}});
    shinyKey = createMockEntity('item-key-shiny', {value: 'shiny key'}, {[ITEM_COMPONENT_ID]: {}});
    goblin = createMockEntity('npc-goblin', {value: 'grumpy goblin'}, {
      [HEALTH_COMPONENT_ID]: {
        current: 10,
        max: 10
      }
    });
    rock = createMockEntity('scenery-rock', {value: 'large rock'}, {}); // Assumes no special components
    door = createMockEntity('obj-door', {value: 'wooden door'}, {}); // Assumes no special components

    // Distribute entities into the test environment
    placeInLocation(goblin.id, mockCurrentLocation.id, 2, 2);
    placeInLocation(rock.id, mockCurrentLocation.id, 3, 3);
    placeInLocation(rustyKey.id, mockCurrentLocation.id, 4, 4); // Key starts on the ground
    placeInLocation(door.id, mockCurrentLocation.id, 5, 5);

    addToInventory(sword.id, mockPlayerEntity); // Sword starts in inventory
    addToInventory(potion.id, mockPlayerEntity); // Potion starts in inventory
    addToInventory(shinyKey.id, mockPlayerEntity); // Other key starts in inventory

    equipItem(shield.id, 'off', mockPlayerEntity); // Shield starts equipped

    // Calculate the expected 'nearby' set based on this standard setup
    // 'nearby' = inventory + location (excluding player)
    expectedNearbySet = new Set([
      // Inventory items:
      sword.id, potion.id, shinyKey.id,
      // Location entities (player is excluded by the mock getEntitiesInLocation):
      goblin.id, rock.id, rustyKey.id, door.id
    ]);

    // *** INITIALIZE passage1, blocker1 etc. HERE in the main beforeEach ***
    location2 = createMockEntity('loc-room2', {value: 'Another Room'}, {});
    passage1 = createMockEntity('conn-room1-room2-north', {value: 'passage north'}, {
      // Add passage details component data directly
      [PASSAGE_DETAILS_COMPONENT_TYPE_ID]: {
        locationAId: mockCurrentLocation.id,
        locationBId: location2.id,
        directionAtoB: 'north',
        directionBtoA: 'south',
        blockerEntityId: null, // Initially no blocker
      }
    });
    passage2 = createMockEntity('conn-room1-room2-east', {value: 'passage east'}, {
      [PASSAGE_DETAILS_COMPONENT_TYPE_ID]: {
        locationAId: mockCurrentLocation.id,
        locationBId: location2.id,
        directionAtoB: 'east',
        directionBtoA: 'west',
        blockerEntityId: null, // Initially no blocker
      }
    });
    blocker1 = createMockEntity('blocker-gate', {value: 'iron gate'}, {});
    blocker2 = createMockEntity('blocker-guard', {value: 'sleepy guard'}, {
      [HEALTH_COMPONENT_ID]: {current: 5, max: 5}
    });

    // NO need for ensureComponent calls for passages if createMockEntity adds the data

  }); // End beforeEach

  afterEach(() => {
    // Optional: Explicitly clear mocks if needed between describe blocks, though beforeEach usually handles it
    jest.clearAllMocks();
  });


  // --- Tests for existing scopes (UPDATED FOR TYPE IDS) ---
  describe('Scope: inventory', () => {
    test('should return items in player inventory', () => {
      const result = getEntityIdsForScopes('inventory', mockContext);
      // Assertion remains the same - checks IDs
      expect(result).toEqual(new Set([sword.id, potion.id, shinyKey.id]));
    });

    test('should return empty set and warn if playerEntity is missing', () => {
      mockContext.playerEntity = null;
      const result = getEntityIdsForScopes('inventory', mockContext);
      expect(result).toEqual(new Set());
      // Log message likely unchanged in the service
      expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("Scope 'inventory' requested but playerEntity is missing"));
    });

    test('should return empty set and warn if InventoryComponent data is missing', () => {
      // Use the TYPE ID string to remove the component data
      mockPlayerEntity.removeComponent(INVENTORY_COMPONENT_ID);
      const result = getEntityIdsForScopes('inventory', mockContext);
      expect(result).toEqual(new Set());
      // *** CORRECTED ASSERTION to match the actual log output ***
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        // Use the correct constant and match the actual log format
        `entityScopeService._handleInventory: Scope 'inventory' requested but player ${mockPlayerEntity.id} lacks component data for ID "${INVENTORY_COMPONENT_ID}".`
        // Or slightly less specific using stringContaining:
        // expect.stringContaining(`lacks component data for ID "${INVENTORY_COMPONENT_ID}"`)
      );
    });

  });

  describe('Scope: location', () => {
    test('should return entities in location, excluding player', () => {
      const result = getEntityIdsForScopes('location', mockContext);
      // Assertion logic unchanged
      expect(result).toEqual(new Set([goblin.id, rock.id, rustyKey.id, door.id]));
      expect(result.has(mockPlayerEntity.id)).toBe(false);
    });

    test('should return empty set and warn if currentLocation is null', () => {
      mockContext.currentLocation = null;
      const result = getEntityIdsForScopes('location', mockContext);
      expect(result).toEqual(new Set());
      expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining('currentLocation is null'));
    });


    test('should return empty set and log error if entityManager is missing from context', () => {
      const originalEntityManager = mockContext.entityManager;
      mockContext.entityManager = null;
      const result = getEntityIdsForScopes('location', mockContext);
      expect(result).toEqual(new Set());
      expect(mockConsoleError).toHaveBeenCalledWith(
        'getEntityIdsForScopes: Invalid or incomplete context provided. Cannot proceed.',
        {context: mockContext}
      );
      mockContext.entityManager = originalEntityManager; // Restore
    });
  });

  describe('Scope: equipment', () => {
    test('should return equipped items', () => {
      const result = getEntityIdsForScopes('equipment', mockContext);
      // Assertion logic unchanged
      expect(result).toEqual(new Set([shield.id]));
    });

    test('should return empty set and warn if playerEntity is missing', () => {
      mockContext.playerEntity = null;
      const result = getEntityIdsForScopes('equipment', mockContext);
      expect(result).toEqual(new Set());
      expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("Scope 'equipment' requested but playerEntity is missing"));
    });

    test('should return empty set and warn if EquipmentComponent data is missing', () => {
      // Use TYPE ID string
      mockPlayerEntity.removeComponent(EQUIPMENT_COMPONENT_ID);
      const result = getEntityIdsForScopes('equipment', mockContext);
      expect(result).toEqual(new Set());
      // Update expected log message
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        `entityScopeService._handleEquipment: Scope 'equipment' requested but player ${mockPlayerEntity.id} lacks component data for ID "${EQUIPMENT_COMPONENT_ID}".`
      );

    });
  });

  describe('Scope: location_items', () => {
    test('should return only items in location', () => {
      const result = getEntityIdsForScopes('location_items', mockContext);
      // Assertion logic unchanged (assumes service checks for ITEM_COMPONENT_ID)
      expect(result).toEqual(new Set([rustyKey.id])); // Only key is item on ground
    });

    test('should log warning for dangling entity IDs when checking ItemComponent data', () => {
      const danglingId = 'dangling-item-123';
      // Add ID to location set, but not to entity map
      mockEntityManager.locations.get(mockCurrentLocation.id).add(danglingId);

      // Ensure getEntityInstance returns undefined for this ID
      const originalGetEntityInstance = mockEntityManager.getEntityInstance;
      mockEntityManager.getEntityInstance = jest.fn((id) => {
        if (id === danglingId) return undefined;
        return originalGetEntityInstance.call(mockEntityManager, id); // Use .call()
      });

      const result = getEntityIdsForScopes('location_items', mockContext);
      expect(result).toEqual(new Set([rustyKey.id])); // Only valid item
      // Update expected log message if service uses component type ID
      expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining(`Entity ID ${danglingId} from location scope not found in entityManager when checking for component ${ITEM_COMPONENT_ID}`));

      mockEntityManager.getEntityInstance = originalGetEntityInstance;
    });
  });

  describe('Scope: location_non_items', () => {
    test('should return only non-items in location', () => {
      const result = getEntityIdsForScopes('location_non_items', mockContext);
      // Assertion logic unchanged (assumes service checks for absence of ITEM_COMPONENT_ID)
      expect(result).toEqual(new Set([goblin.id, rock.id, door.id]));
    });

    // In entityScopeService.test.js, inside the 'should log warning for dangling entity IDs when checking non-ItemComponent data' test:
    test('should log warning for dangling entity IDs when checking non-ItemComponent data', () => {
      const danglingId = 'dangling-nonitem-456';
      mockEntityManager.locations.get(mockCurrentLocation.id).add(danglingId);

      const originalGetEntityInstance = mockEntityManager.getEntityInstance;
      mockEntityManager.getEntityInstance = jest.fn((id) => {
        if (id === danglingId) return undefined;
        return originalGetEntityInstance.call(mockEntityManager, id); // Use .call()
      });

      const result = getEntityIdsForScopes('location_non_items', mockContext);
      expect(result).toEqual(new Set([goblin.id, rock.id, door.id])); // Valid non-items

      // --- CORRECTED ASSERTION ---
      // Match the string actually logged by the service
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        `entityScopeService._handleLocationNonItems: Entity ID ${danglingId} from location scope not found in entityManager when checking for non-ItemComponent.`
      );
      // --- END CORRECTION ---

      mockEntityManager.getEntityInstance = originalGetEntityInstance;
    });
  });

  describe('Scope: nearby', () => {
    test('should return combined inventory and location (excluding player)', () => {
      const result = getEntityIdsForScopes('nearby', mockContext);
      // Assertion logic unchanged
      expect(result).toEqual(expectedNearbySet); // Use pre-calculated set
    });

    test('should log warning and return only inventory if currentLocation is null', () => {
      mockContext.currentLocation = null; // Simulate missing location context
      const result = getEntityIdsForScopes('nearby', mockContext);
      // Only inventory items should be returned
      expect(result).toEqual(new Set([sword.id, potion.id, shinyKey.id]));
      // Warning should come from _handleLocation being called by _handleNearby
      expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining('currentLocation is null'));
    });
  });


  // ******** NEW TEST SUITE FOR nearby_including_blockers (UPDATED FOR TYPE IDS) ********
  describe('Scope: nearby_including_blockers', () => {

    beforeEach(() => {
      // Reset blockers on passages before each test in this suite
      // Access data directly via getComponentData
      const p1DetailsData = passage1?.getComponentData(PASSAGE_DETAILS_COMPONENT_TYPE_ID);
      if (p1DetailsData) p1DetailsData.blockerEntityId = null;
      const p2DetailsData = passage2?.getComponentData(PASSAGE_DETAILS_COMPONENT_TYPE_ID);
      if (p2DetailsData) p2DetailsData.blockerEntityId = null;

      // Ensure the location doesn't have connections carrying over from previous tests
      if (mockCurrentLocation?.hasComponent(CONNECTIONS_COMPONENT_TYPE_ID)) {
        mockCurrentLocation.removeComponent(CONNECTIONS_COMPONENT_TYPE_ID); // Remove if exists
      }
      // Also ensure the location component data is reset if needed, e.g. add it fresh
      ensureComponent(mockCurrentLocation, CONNECTIONS_COMPONENT_TYPE_ID, {connections: {}});
    });


    // AC: Baseline / No Connections
    test('AC: should return same as "nearby" if currentLocation lacks ConnectionsComponent data', () => {
      mockCurrentLocation.removeComponent(CONNECTIONS_COMPONENT_TYPE_ID); // Ensure it's removed
      const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);
      expect(result).toEqual(expectedNearbySet);
      // Service should handle this gracefully without warning now
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    test('AC: should return same as "nearby" if ConnectionsComponent data exists but connections are empty', () => {
      // ensureComponent in main beforeEach adds empty connections {}
      const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);
      expect(result).toEqual(expectedNearbySet);
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    // AC: Connections, No Blockers
    test('AC: should return same as "nearby" if connections exist but passages have null blockerEntityId', () => {
      // Setup: Add connection to passage1
      const connData = ensureComponent(mockCurrentLocation, CONNECTIONS_COMPONENT_TYPE_ID, {connections: {}});
      // Add connection info to the data object
      connData.connections['north'] = {connectionEntityId: passage1.id, direction: 'north'}; // Assuming this structure

      const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);
      expect(result).toEqual(expectedNearbySet); // Should still match 'nearby'
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    test('AC: should return same as "nearby" if connections exist but passages lack PassageDetailsComponent data', () => {
      // Create a passage entity without the details component data
      const passageNoDetails = createMockEntity('conn-nodetails', {value: 'broken passage'}, {}); // No PASSAGE_DETAILS_COMPONENT_ID
      // Setup: Connect to this broken passage
      const connData = ensureComponent(mockCurrentLocation, CONNECTIONS_COMPONENT_TYPE_ID, {connections: {}});
      connData.connections['south'] = {connectionEntityId: passageNoDetails.id, direction: 'south'};

      const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);
      expect(result).toEqual(expectedNearbySet); // Should still match 'nearby'
      // Expect a warning about the missing component data
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        `entityScopeService._handleNearbyIncludingBlockers: Passage entity '${passageNoDetails.id}' lacks component data for ${PASSAGE_DETAILS_COMPONENT_TYPE_ID}. Cannot check for blocker.`
      );
    });


    // AC: Connections with Blockers
    test('AC: should include blocker ID if a connected passage is blocked', () => {
      // Setup: Make passage1 blocked by blocker1
      const p1DetailsData = passage1.getComponentData(PASSAGE_DETAILS_COMPONENT_TYPE_ID);
      p1DetailsData.blockerEntityId = blocker1.id;
      // Setup: Add connection from current location to passage1
      const connData = ensureComponent(mockCurrentLocation, CONNECTIONS_COMPONENT_TYPE_ID, {connections: {}});
      connData.connections['north'] = {connectionEntityId: passage1.id, direction: 'north'};


      // Calculate expected: nearby + blocker1
      const expectedResult = new Set([...expectedNearbySet, blocker1.id]);

      const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);
      expect(result).toEqual(expectedResult);
      expect(mockConsoleWarn).not.toHaveBeenCalled(); // No dangling IDs here
    });

    // AC: Multiple Distinct Blockers
    test('AC: should include all unique blocker IDs from multiple blocked passages', () => {
      // Setup: Block passage1 with blocker1, passage2 with blocker2
      passage1.getComponentData(PASSAGE_DETAILS_COMPONENT_TYPE_ID).blockerEntityId = blocker1.id;
      passage2.getComponentData(PASSAGE_DETAILS_COMPONENT_TYPE_ID).blockerEntityId = blocker2.id;
      // Setup: Connect current location to both passages
      const connData = ensureComponent(mockCurrentLocation, CONNECTIONS_COMPONENT_TYPE_ID, {connections: {}});
      connData.connections['north'] = {connectionEntityId: passage1.id, direction: 'north'};
      connData.connections['east'] = {connectionEntityId: passage2.id, direction: 'east'};

      // Calculate expected: nearby + blocker1 + blocker2
      const expectedResult = new Set([...expectedNearbySet, blocker1.id, blocker2.id]);

      const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);
      expect(result).toEqual(expectedResult);
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    // AC: Shared Blocker
    test('AC: should include a shared blocker ID only once', () => {
      // Setup: Block passage1 AND passage2 with blocker1
      passage1.getComponentData(PASSAGE_DETAILS_COMPONENT_TYPE_ID).blockerEntityId = blocker1.id;
      passage2.getComponentData(PASSAGE_DETAILS_COMPONENT_TYPE_ID).blockerEntityId = blocker1.id;
      // Setup: Connect current location to both passages
      const connData = ensureComponent(mockCurrentLocation, CONNECTIONS_COMPONENT_TYPE_ID, {connections: {}});
      connData.connections['north'] = {connectionEntityId: passage1.id, direction: 'north'};
      connData.connections['east'] = {connectionEntityId: passage2.id, direction: 'east'};

      // Calculate expected: nearby + blocker1 (only once)
      const expectedResult = new Set([...expectedNearbySet, blocker1.id]);

      const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);
      expect(result).toEqual(expectedResult);
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    // AC: Dangling Passage ID
    test('AC: should log warning and skip connection if passage entity instance is missing', () => {
      const danglingPassageId = 'conn-dangling-west';
      // Setup: Connect current location to a non-existent passage ID
      const connData = ensureComponent(mockCurrentLocation, CONNECTIONS_COMPONENT_TYPE_ID, {connections: {}});
      connData.connections['west'] = {connectionEntityId: danglingPassageId, direction: 'west'};


      // Expected result should just be 'nearby' as the connection fails silently after warning
      const expectedResult = expectedNearbySet;

      // Clear mocks specific to this call to isolate the warning check
      mockConsoleWarn.mockClear();

      const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);

      expect(result).toEqual(expectedResult);
      // Verify the specific warning about the missing passage instance was logged
      expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining(`Passage entity instance not found for ID '${danglingPassageId}'. Skipping blocker check.`)
      );
    });

    // AC: Dangling Blocker ID
    test('AC: should include blocker ID and log warning if blocker entity instance is missing', () => {
      const danglingBlockerId = 'blocker-dangling-ghost';
      // Setup: Block passage1 with a non-existent blocker ID
      passage1.getComponentData(PASSAGE_DETAILS_COMPONENT_TYPE_ID).blockerEntityId = danglingBlockerId;
      // Setup: Connect current location to passage1
      const connData = ensureComponent(mockCurrentLocation, CONNECTIONS_COMPONENT_TYPE_ID, {connections: {}});
      connData.connections['north'] = {connectionEntityId: passage1.id, direction: 'north'};

      // Calculate expected: nearby + the dangling blocker ID
      const expectedResult = new Set([...expectedNearbySet, danglingBlockerId]);

      // Clear mocks specific to this call to isolate the warning check
      mockConsoleWarn.mockClear();

      const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);

      expect(result).toEqual(expectedResult); // The ID should be included
      // Verify the specific warning about the missing blocker *instance* was logged
      expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining(`Added blocker ID '${danglingBlockerId}' but instance not found.`)
      );
    });

    // Test edge case: Blocker ID is an empty string
    test('should ignore blocker ID if it is an empty string', () => {
      // Setup: Set blocker ID to empty string
      passage1.getComponentData(PASSAGE_DETAILS_COMPONENT_TYPE_ID).blockerEntityId = '';
      // Setup: Add connection
      const connData = ensureComponent(mockCurrentLocation, CONNECTIONS_COMPONENT_TYPE_ID, {connections: {}});
      connData.connections['north'] = {connectionEntityId: passage1.id, direction: 'north'};


      const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);
      expect(result).toEqual(expectedNearbySet); // Should match nearby, empty string ignored
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    // Test edge case: Missing entity manager in context (Handled by top-level check)
    test('should return empty set and log error if entityManager is missing in context', () => {
      const originalEntityManager = mockContext.entityManager;
      mockContext.entityManager = null; // Remove entityManager

      // Setup connection/blocker (won't be reached by service logic)
      const p1Data = passage1?.getComponentData(PASSAGE_DETAILS_COMPONENT_TYPE_ID);
      if (p1Data) p1Data.blockerEntityId = blocker1.id;
      ensureComponent(mockCurrentLocation, CONNECTIONS_COMPONENT_TYPE_ID, {
        connections: {
          north: {
            connectionEntityId: passage1.id,
            direction: 'north'
          }
        }
      });


      mockConsoleError.mockClear();
      const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);

      expect(result).toEqual(new Set());
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid or incomplete context provided'),
        expect.anything()
      );
      mockContext.entityManager = originalEntityManager; // Restore
    });


    // Test edge case: Missing current location in context
    test('should return only nearby results (inventory only) and warn if currentLocation is missing in context', () => {
      const originalCurrentLocation = mockContext.currentLocation;
      mockContext.currentLocation = null; // Remove currentLocation

      mockConsoleWarn.mockClear();
      const result = getEntityIdsForScopes('nearby_including_blockers', mockContext);

      const expectedInventoryOnly = new Set([sword.id, potion.id, shinyKey.id]);
      expect(result).toEqual(expectedInventoryOnly);

      // Check for the specific warning from _handleNearbyIncludingBlockers
      expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining('currentLocation missing in context. Cannot check for blockers.'));
      // We also expect a warning from _handleLocation called via _handleNearby
      expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining('currentLocation is null'));

      mockContext.currentLocation = originalCurrentLocation; // Restore
    });


  }); // End describe('Scope: nearby_including_blockers')

  // ******** NEW TEST SUITE FOR 'self' scope (Should be unchanged) ********
  describe('Scope: self', () => {
    test("should return a set containing only the player's ID", () => {
      const result = getEntityIdsForScopes('self', mockContext);
      expect(result).toEqual(new Set([mockPlayerEntity.id]));
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    test('should return an empty set and warn if playerEntity is missing in context', () => {
      mockContext.playerEntity = null;
      const result = getEntityIdsForScopes('self', mockContext);
      expect(result).toEqual(new Set());
      expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("Scope 'self' requested but playerEntity or playerEntity.id is missing"));
    });

    test('should return an empty set and warn if playerEntity has no ID (edge case)', () => {
      // Need to create a temporary entity without ID for this, or modify mockPlayerEntity carefully
      const originalId = mockPlayerEntity.id;
      mockPlayerEntity.id = null; // Simulate missing ID
      const result = getEntityIdsForScopes('self', mockContext);
      expect(result).toEqual(new Set());
      expect(mockConsoleWarn).toHaveBeenCalledWith(expect.stringContaining("Scope 'self' requested but playerEntity or playerEntity.id is missing"));
      mockPlayerEntity.id = originalId; // Restore
    });
  });

  // ******** NEW TEST SUITE FOR 'environment' mapping (Logic unchanged) ********
  describe('Scope: environment (mapped)', () => {
    test("should behave like 'nearby_including_blockers'", () => {
      // Setup: Block passage1 with blocker1
      passage1.getComponentData(PASSAGE_DETAILS_COMPONENT_TYPE_ID).blockerEntityId = blocker1.id;
      // Setup: Add connection from current location to passage1
      const connData = ensureComponent(mockCurrentLocation, CONNECTIONS_COMPONENT_TYPE_ID, {connections: {}});
      connData.connections['north'] = {connectionEntityId: passage1.id, direction: 'north'};


      // Calculate expected: nearby + blocker1
      const expectedResult = new Set([...expectedNearbySet, blocker1.id]);

      const result = getEntityIdsForScopes('environment', mockContext); // Use 'environment' scope
      expect(result).toEqual(expectedResult);
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });

    test("should return 'nearby' results if no blockers configured, when called with 'environment'", () => {
      // Setup connection without blocker
      const connData = ensureComponent(mockCurrentLocation, CONNECTIONS_COMPONENT_TYPE_ID, {connections: {}});
      connData.connections['north'] = {connectionEntityId: passage1.id, direction: 'north'};
      // Make sure passage1 blocker is null (should be by default from outer beforeEach)
      passage1.getComponentData(PASSAGE_DETAILS_COMPONENT_TYPE_ID).blockerEntityId = null;


      const result = getEntityIdsForScopes('environment', mockContext);
      expect(result).toEqual(expectedNearbySet); // Should match nearby
      expect(mockConsoleWarn).not.toHaveBeenCalled();
    });
  });


  // --- Aggregator Function (`getEntityIdsForScopes`) Tests (UPDATED FOR TYPE IDS) ---
  describe('getEntityIdsForScopes (Aggregator Logic)', () => {

    test('should aggregate unique IDs correctly from multiple valid scopes including new ones', () => {
      // Setup a blocker for the 'environment' scope test
      passage1.getComponentData(PASSAGE_DETAILS_COMPONENT_TYPE_ID).blockerEntityId = blocker1.id;
      const connData = ensureComponent(mockCurrentLocation, CONNECTIONS_COMPONENT_TYPE_ID, {connections: {}});
      connData.connections['north'] = {connectionEntityId: passage1.id, direction: 'north'};


      // Request equipment, self, and environment
      const result = getEntityIdsForScopes(['equipment', 'self', 'environment'], mockContext);

      // Expected: Equipment(shield) + Self(player) + Environment(nearby + blocker1)
      const expected = new Set([
        shield.id, // Equipment
        mockPlayerEntity.id, // Self
        sword.id, potion.id, shinyKey.id, // Env -> Nearby -> Inv
        goblin.id, rock.id, rustyKey.id, door.id, // Env -> Nearby -> Loc
        blocker1.id // Env -> Blocker
      ]);
      expect(result).toEqual(expected);
      expect(mockConsoleWarn).not.toHaveBeenCalled();
      expect(mockConsoleError).not.toHaveBeenCalled();
    });

    test('should log warning and skip unknown scopes', () => {
      mockConsoleWarn.mockClear(); // Clear warnings from setup
      const result = getEntityIdsForScopes(['inventory', 'unknown_scope_xyz', 'location'], mockContext);
      const expected = new Set([
        sword.id, potion.id, shinyKey.id, // Inventory
        goblin.id, rock.id, rustyKey.id, door.id // Location
      ]);
      expect(result).toEqual(expected);
      expect(mockConsoleWarn).toHaveBeenCalledWith("getEntityIdsForScopes: Unknown or unhandled scope/domain requested: 'unknown_scope_xyz'. Skipping.");
    });

    test('should log message and skip "direction" and "none" scopes', () => {
      mockConsoleLog.mockClear(); // Clear log mock specifically
      const result = getEntityIdsForScopes(['inventory', 'direction', 'none', 'equipment'], mockContext);
      const expected = new Set([
        sword.id, potion.id, shinyKey.id, // Inventory
        shield.id // Equipment
      ]);
      expect(result).toEqual(expected);
      expect(mockConsoleLog).toHaveBeenCalledWith("getEntityIdsForScopes: Scope 'direction' does not resolve to entity IDs. Skipping.");
      expect(mockConsoleLog).toHaveBeenCalledWith("getEntityIdsForScopes: Scope 'none' does not resolve to entity IDs. Skipping.");
      expect(mockConsoleWarn).not.toHaveBeenCalled(); // Should be log, not warn
    });


    test('should log error and skip scope if handler throws, but process others', () => {
      // Mock the failing component data access method
      const originalGetComponentData = mockPlayerEntity.getComponentData;
      const erroringGetComponentData = jest.fn((componentTypeId) => {
        // Make the inventory handler fail by checking its TYPE ID
        if (componentTypeId === INVENTORY_COMPONENT_ID) {
          throw new Error('Test Error Getting Inventory Data');
        }
        return originalGetComponentData.call(mockPlayerEntity, componentTypeId);
      });
      // Temporarily replace the method on the mock entity instance
      mockPlayerEntity.getComponentData = erroringGetComponentData;


      // Setup blocker for nearby_including_blockers part (still relevant)
      passage1.getComponentData(PASSAGE_DETAILS_COMPONENT_TYPE_ID).blockerEntityId = blocker1.id;
      const connData = ensureComponent(mockCurrentLocation, CONNECTIONS_COMPONENT_TYPE_ID, {connections: {}});
      connData.connections['north'] = {connectionEntityId: passage1.id, direction: 'north'};

      mockConsoleError.mockClear();

      // Request failing scope ('inventory') and successful ones ('equipment', 'nearby_including_blockers')
      // Note: 'nearby_including_blockers' will ALSO fail because it calls _handleNearby -> _handleInventory internally
      const result = getEntityIdsForScopes(['inventory', 'equipment', 'nearby_including_blockers'], mockContext);

      // Expected: Only IDs from scopes that DON'T fail. Equipment should succeed.
      const expected = new Set([
        shield.id, // Equipment
      ]);

      expect(result).toEqual(expected);

      // Verify the errors were logged FOR BOTH failing scopes ('inventory' and 'nearby_including_blockers')
      expect(mockConsoleError).toHaveBeenCalledTimes(2);
      expect(mockConsoleError).toHaveBeenCalledWith(
        "getEntityIdsForScopes: Error executing handler for scope/domain 'inventory':",
        expect.objectContaining({message: 'Test Error Getting Inventory Data'})
      );
      expect(mockConsoleError).toHaveBeenCalledWith(
        "getEntityIdsForScopes: Error executing handler for scope/domain 'nearby_including_blockers':",
        expect.objectContaining({message: 'Test Error Getting Inventory Data'}) // Fails with the same underlying error
      );

      // Restore original method IMPORTANT
      mockPlayerEntity.getComponentData = originalGetComponentData;
    });


    test('should return empty set and log error if context is invalid (null)', () => {
      mockConsoleError.mockClear();
      const resultNull = getEntityIdsForScopes(['inventory'], null);
      expect(resultNull).toEqual(new Set());
      expect(mockConsoleError).toHaveBeenCalledWith('getEntityIdsForScopes: Invalid or incomplete context provided. Cannot proceed.', {context: null});
    });

    test('should return empty set and log error if context is invalid (missing entityManager)', () => {
      mockConsoleError.mockClear();
      // Need a mock player entity for the context object, even if EM is missing
      const tempPlayer = createMockEntity('temp-p', {value: 'Temp'}, {});
      const resultNoEM = getEntityIdsForScopes(['inventory'], {playerEntity: tempPlayer}); // Missing EM
      expect(resultNoEM).toEqual(new Set());
      expect(mockConsoleError).toHaveBeenCalledWith('getEntityIdsForScopes: Invalid or incomplete context provided. Cannot proceed.', {context: {playerEntity: tempPlayer}});
    });


  }); // End describe('getEntityIdsForScopes (Aggregator Logic)')

}); // End describe('entityScopeService')