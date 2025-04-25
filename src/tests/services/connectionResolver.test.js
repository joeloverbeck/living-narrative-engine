// src/services/connectionResolver.test.js

// ** Imports for Jest and Core Testing Utilities **
import {beforeEach, afterEach, describe, expect, jest, test} from '@jest/globals';

// ** Import Function Under Test **
import {resolveTargetConnection} from '../../services/connectionResolver.js';

// ** Import Dependencies for Mocking/Setup **
import Entity from '../../entities/entity.js'; // Adjust path if necessary
// We might not need ConnectionsComponent instance directly anymore, but keep import if used elsewhere
import {ConnectionsComponent} from '../../components/connectionsComponent.js'; // Adjust path
import {NameComponent} from '../../components/nameComponent.js'; // Adjust path
import {TARGET_MESSAGES} from '../../utils/messages.js'; // Adjust path
import {getDisplayName} from '../../utils/messages.js';
import ValidatedEventDispatcher from '../../services/validatedEventDispatcher.js'; // Adjust path if needed
import {ILogger} from '../../core/interfaces/coreServices.js'; // Adjust path if needed
import {CONNECTIONS_COMPONENT_TYPE_ID, NAME_COMPONENT_TYPE_ID} from '../../types/components.js'; // *** IMPORT TYPE ID ***

// ** Import Types (for clarity, often optional in JS tests but good practice) **
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../components/connectionsComponent.js').ConnectionMapping} ConnectionMapping */ // Might be outdated if data structure changed


// ========================================================================
// == Test Suite Setup ====================================================
// ========================================================================

describe('ConnectionResolverService: resolveTargetConnection', () => {

  let mockContext;
  // let mockDispatch; // Replaced by mockValidatedDispatcher
  let mockEntityManager;
  let mockCurrentLocation;
  // let mockConnectionsComponentInstance; // Likely no longer needed for resolveTargetConnection tests
  let mockValidatedDispatcher;
  let mockLogger;

  // --- Helper Function to Create Mock Entities ---
  /**
     * Creates a mock Entity with a NameComponent and mocks its getComponentData method.
     * Adds the entity to the mockEntityManager.
     * @param {string} id - Entity ID.
     * @param {string} name - Display Name for the NameComponent data.
     * @returns {Entity} The mock entity instance.
     */
  const createMockConnectionEntity = (id, name) => {
    const entity = new Entity(id);
    const mockNameCompData = {typeId: NAME_COMPONENT_TYPE_ID, value: name};

    // Mock getComponentData for this entity instance
    entity.getComponentData = jest.fn((componentTypeId) => {
      if (componentTypeId === NAME_COMPONENT_TYPE_ID) {
        return mockNameCompData;
      }
      // Mock other component data if needed by tests (e.g., PassageDetailsComponent)
      // if (componentTypeId === PASSAGE_DETAILS_COMPONENT_TYPE_ID) { ... }
      return undefined;
    });

    // Mock getComponent for compatibility if needed elsewhere, but prioritize getComponentData
    entity.getComponent = jest.fn((componentConstructor) => {
      if (componentConstructor === NameComponent) {
        // Return an object mimicking the component *instance* if required
        // This might be simpler: { value: name } if only value is accessed
        return {value: name};
      }
      // if (componentConstructor === PassageDetailsComponent) { ... }
      return undefined;
    });


    // Add standard properties if needed by getDisplayName or other parts
    entity.name = name; // Useful for debugging/logging, but getDisplayName uses component data

    // Store in mock manager
    mockEntityManager.entities.set(id, entity);
    return entity;
  };

  beforeEach(() => {
    // 1. Clear all mocks
    jest.clearAllMocks();

    // --- Mock Logger ---
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // --- Mock ValidatedEventDispatcher ---
    mockValidatedDispatcher = {
      dispatchValidated: jest.fn().mockResolvedValue(undefined),
    };

    // --- Mock EntityManager ---
    mockEntityManager = {
      entities: new Map(),
      getEntityInstance: jest.fn((entityId) => mockEntityManager.entities.get(entityId)),
    };

    // --- Mock Current Location Entity (Updated for getComponentData) ---
    mockCurrentLocation = new Entity('loc-current');

    // *** KEY CHANGE: Mock getComponentData ***
    mockCurrentLocation.getComponentData = jest.fn((componentTypeId) => {
      if (componentTypeId === CONNECTIONS_COMPONENT_TYPE_ID) {
        // Return the expected data structure by default (empty connections map)
        // Specific tests will override this mock implementation.
        return {
          typeId: CONNECTIONS_COMPONENT_TYPE_ID, // Optional: include if structure has it
          connections: {}, // Default connections map
        };
      }
      return undefined; // Default for other components
    });

    // Keep getComponent mock for potential compatibility or other uses, but it's
    // not the primary method used by the connection resolver logic anymore.
    // mockConnectionsComponentInstance = { getAllConnections: jest.fn(() => []) }; // Keep if needed
    mockCurrentLocation.getComponent = jest.fn((componentConstructor) => {
      // if (componentConstructor === ConnectionsComponent) {
      //     return mockConnectionsComponentInstance; // Return if instance is needed elsewhere
      // }
      return undefined;
    });
    // --- End Updated Mock ---


    // --- Mock ActionContext ---
    mockContext = {
      entityManager: mockEntityManager,
      currentLocation: mockCurrentLocation, // Use the updated mock
      playerEntity: new Entity('player-test'),
      validatedDispatcher: mockValidatedDispatcher,
      logger: mockLogger,
    };

    // No need to mock getDisplayName, rely on mocked getComponentData in createMockConnectionEntity
  });

  // ========================================================================
  // == Test Cases Implementation ==========================================
  // ========================================================================

  // --- Scenario: Valid Input Required ---
  describe('Input Validation', () => {
    // Tests remain largely the same, ensure async/await is used
    test.each([
      [null],
      [undefined],
      [''],
      ['   '],
    ])('should return null and not dispatch for invalid input: %p', async (invalidInput) => {
      const result = await resolveTargetConnection(mockContext, invalidInput);
      expect(result).toBeNull();
      expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();
      // Logger checks remain the same
      if (invalidInput === null || invalidInput === undefined || (typeof invalidInput === 'string' && invalidInput.trim() === '')) {
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid or empty connectionTargetName'));
      }
    });

    test('should return null if context is invalid (missing logger)', async () => {
      const invalidContext = {...mockContext, logger: undefined};
      const result = await resolveTargetConnection(invalidContext, 'north');
      expect(result).toBeNull();
      // console.error assertion is tricky, relying on null return is better
    });

    test('should return null if context is invalid (missing validatedDispatcher)', async () => {
      const invalidContext = {...mockContext, validatedDispatcher: undefined};
      const result = await resolveTargetConnection(invalidContext, 'north');
      expect(result).toBeNull();
    });
  });

  // --- Scenario: Unique Direction Match ---
  describe('Unique Direction Match', () => {
    let northEntity;
    beforeEach(() => {
      northEntity = createMockConnectionEntity('conn-n', 'North Passage');

      // *** UPDATE MOCK: Mock getComponentData for this scenario ***
      mockCurrentLocation.getComponentData.mockImplementation((componentTypeId) => {
        if (componentTypeId === CONNECTIONS_COMPONENT_TYPE_ID) {
          return {
            typeId: CONNECTIONS_COMPONENT_TYPE_ID,
            connections: {
              'north': northEntity.id // Map direction key to entity ID
            }
          };
        }
        return undefined;
      });
    });

    test.each([
      ['north'],
      ['NORTH'],
      [' north '],
    ])('should return the correct entity for unique direction "%s"', async (input) => {
      const result = await resolveTargetConnection(mockContext, input);

      expect(result).toBe(northEntity); // Should now receive the entity
      expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();
      // Verify internal calls (Updated)
      expect(mockCurrentLocation.getComponentData).toHaveBeenCalledWith(CONNECTIONS_COMPONENT_TYPE_ID); // Check getComponentData call
      // expect(mockConnectionsComponentInstance.getAllConnections).not.toHaveBeenCalled(); // Ensure old path isn't used
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(northEntity.id);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Found unique direction match: north -> ${northEntity.id}`));
    });
  });

  // --- Scenario: Ambiguous Direction Match ---
  describe('Ambiguous Direction Match', () => {
    let westEntity1;
    let westEntity2;

    // Use helper function to find potential matches directly for this complex case
    // This avoids needing a complex mock for getComponentData that accurately reflects
    // how multiple entities might map to the same direction keyword.
    let mockFindMatchesFn;

    beforeEach(() => {
      westEntity1 = createMockConnectionEntity('conn-w1', 'West Archway');
      westEntity2 = createMockConnectionEntity('conn-w2', 'West Tunnel');

      // *** UPDATE MOCK: Mock the helper function directly ***
      mockFindMatchesFn = jest.fn().mockImplementation((context, targetName, logger) => {
        // Simulate finding two entities matching the direction 'west'
        if (targetName === 'west') {
          return {
            directionMatches: [
              {direction: 'west', connectionEntity: westEntity1},
              {direction: 'west', connectionEntity: westEntity2}
            ],
            nameMatches: [] // No name matches in this specific scenario
          };
        }
        // Fallback for other inputs if needed, though test uses 'west'
        return {directionMatches: [], nameMatches: []};
      });
    });

    test('should return null and dispatch AMBIGUOUS_DIRECTION message', async () => {
      const input = 'west';
      // Pass the mocked findMatchesFn to the resolver
      const result = await resolveTargetConnection(mockContext, input, 'go', mockFindMatchesFn);

      expect(result).toBeNull(); // Still expect null for ambiguity
      expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);

      // Check the dispatched message
      const expectedMsg = TARGET_MESSAGES.AMBIGUOUS_DIRECTION(input, [getDisplayName(westEntity1), getDisplayName(westEntity2)]);
      expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
        'event:display_message',
        {text: expectedMsg, type: 'warning'}
      );

      // Verify logs and mock call
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Ambiguous direction match for '${input}'`));
      expect(mockFindMatchesFn).toHaveBeenCalledWith(mockContext, input.trim().toLowerCase(), mockLogger);
      // Ensure the actual findPotentialConnectionMatches wasn't called (because we provided a mock)
      // This requires spying on the original module if you want to be absolutely sure.
    });
  });

  // --- Scenario: Unique Name Match (No Direction Match) ---
  describe('Unique Name Match (No Direction Match)', () => {
    let doorEntity;
    beforeEach(() => {
      doorEntity = createMockConnectionEntity('conn-door', 'Ornate Door');

      // *** UPDATE MOCK: Mock getComponentData for this scenario ***
      mockCurrentLocation.getComponentData.mockImplementation((componentTypeId) => {
        if (componentTypeId === CONNECTIONS_COMPONENT_TYPE_ID) {
          return {
            typeId: CONNECTIONS_COMPONENT_TYPE_ID,
            connections: {
              'east': doorEntity.id // Direction doesn't match 'door'
            }
          };
        }
        return undefined;
      });
      // Mock PassageDetailsComponent data if needed for name matching via blocker
      // doorEntity.getComponentData.mockImplementation(...) for PASSAGE_DETAILS_COMPONENT_TYPE_ID
    });

    test.each([
      ['door'], // Assumes 'Ornate Door' contains 'door'
      ['DOOR'],
      [' ornate '], // Assumes matching logic handles surrounding spaces and partials
      ['Ornate Door'],
    ])('should return the correct entity for unique name match "%s"', async (input) => {
      const result = await resolveTargetConnection(mockContext, input);

      expect(result).toBe(doorEntity);
      expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();
      expect(mockCurrentLocation.getComponentData).toHaveBeenCalledWith(CONNECTIONS_COMPONENT_TYPE_ID);
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(doorEntity.id);
      // Check getComponentData was called on the entity itself for name lookup
      expect(doorEntity.getComponentData).toHaveBeenCalledWith(NAME_COMPONENT_TYPE_ID);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Found unique name match: ${getDisplayName(doorEntity)} (${doorEntity.id})`));
    });
  });

  // --- Scenario: Ambiguous Name Match (No Direction Match) ---
  describe('Ambiguous Name Match (No Direction Match)', () => {
    let pathEntity1;
    let pathEntity2;
    beforeEach(() => {
      pathEntity1 = createMockConnectionEntity('conn-p1', 'Narrow Path'); // Matches 'path'
      pathEntity2 = createMockConnectionEntity('conn-p2', 'Winding Path'); // Matches 'path'

      // *** UPDATE MOCK: Mock getComponentData for this scenario ***
      mockCurrentLocation.getComponentData.mockImplementation((componentTypeId) => {
        if (componentTypeId === CONNECTIONS_COMPONENT_TYPE_ID) {
          return {
            typeId: CONNECTIONS_COMPONENT_TYPE_ID,
            connections: {
              'north': pathEntity1.id, // Directions don't match 'path'
              'south': pathEntity2.id
            }
          };
        }
        return undefined;
      });
    });

    test('should return null and dispatch TARGET_AMBIGUOUS_CONTEXT message', async () => {
      const input = 'path';
      const actionVerb = 'examine'; // Example verb
      const result = await resolveTargetConnection(mockContext, input, actionVerb);

      expect(result).toBeNull();
      expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);

      const expectedEntities = [pathEntity1, pathEntity2]; // Order might depend on iteration order in findPotential...
      const expectedMsg = TARGET_MESSAGES.TARGET_AMBIGUOUS_CONTEXT(actionVerb, input, expectedEntities);
      // Note: The order in the message might vary based on Object.entries iteration.
      // Consider using expect.arrayContaining or sorting names if order is not guaranteed/important.
      const receivedCall = mockValidatedDispatcher.dispatchValidated.mock.calls[0];
      expect(receivedCall[0]).toBe('event:display_message');
      expect(receivedCall[1].type).toBe('warning');
      // Check text content flexibly for names
      expect(receivedCall[1].text).toContain(`Which '${input}' did you want to ${actionVerb}?`);
      expect(receivedCall[1].text).toContain(getDisplayName(pathEntity1));
      expect(receivedCall[1].text).toContain(getDisplayName(pathEntity2));

      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Ambiguous name match for '${input}'`));
    });
  });

  // --- Scenario: Prioritization (Direction > Name) ---
  describe('Prioritization (Direction over Name)', () => {
    let eastDirEntity;
    let upNameEntity; // Has 'East' in its name
    beforeEach(() => {
      eastDirEntity = createMockConnectionEntity('conn-e', 'Corridor'); // Matches direction 'east'
      upNameEntity = createMockConnectionEntity('conn-u', 'East Window'); // Name contains 'East'

      // *** UPDATE MOCK: Mock getComponentData for this scenario ***
      mockCurrentLocation.getComponentData.mockImplementation((componentTypeId) => {
        if (componentTypeId === CONNECTIONS_COMPONENT_TYPE_ID) {
          return {
            typeId: CONNECTIONS_COMPONENT_TYPE_ID,
            connections: {
              'east': eastDirEntity.id, // Direction match for 'east'
              'up': upNameEntity.id     // Name match for 'east' exists via 'East Window'
            }
          };
        }
        return undefined;
      });
    });

    test('should return the entity matched by direction when input matches both', async () => {
      const input = 'east';
      const result = await resolveTargetConnection(mockContext, input);

      expect(result).toBe(eastDirEntity); // Prioritizes direction match
      expect(mockValidatedDispatcher.dispatchValidated).not.toHaveBeenCalled();
      // Check logger confirms direction match was chosen
      // Note: The logger message uses match.direction which comes from the data map key ('east')
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`Found unique direction match: east -> ${eastDirEntity.id}`));
    });
  });

  // --- Scenario: No Match ---
  describe('No Match', () => {
    beforeEach(() => {
      const northEntity = createMockConnectionEntity('conn-n', 'North Exit');

      // *** UPDATE MOCK: Mock getComponentData for this scenario ***
      mockCurrentLocation.getComponentData.mockImplementation((componentTypeId) => {
        if (componentTypeId === CONNECTIONS_COMPONENT_TYPE_ID) {
          return {
            typeId: CONNECTIONS_COMPONENT_TYPE_ID,
            connections: {
              'north': northEntity.id
            }
          };
        }
        return undefined;
      });
    });

    test('should return null and dispatch TARGET_NOT_FOUND_CONTEXT message', async () => {
      const input = 'teleporter'; // Doesn't match 'north' or 'North Exit'
      const result = await resolveTargetConnection(mockContext, input);

      expect(result).toBeNull();
      expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
      const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(input);
      expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
        'event:display_message',
        {text: expectedMsg, type: 'info'}
      );
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`No direction or name matches found for '${input}'`));
    });
  });

  // --- Scenario: Edge Cases ---
  describe('Edge Cases', () => {
    test('should return null and dispatch Not Found if location lacks ConnectionsComponent data', async () => {
      // *** UPDATE MOCK: Override getComponentData to return undefined ***
      mockCurrentLocation.getComponentData.mockReturnValue(undefined);

      const input = 'north';
      const result = await resolveTargetConnection(mockContext, input);

      expect(result).toBeNull();
      // Check findPotentialConnectionMatches logs warning about missing data
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Connections component data (typeId: ${CONNECTIONS_COMPONENT_TYPE_ID}) not found on location`));
      // The main function then finds 0 matches and dispatches Not Found.
      expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
      const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(input);
      expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
        'event:display_message',
        {text: expectedMsg, type: 'info'}
      );
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`No direction or name matches found for '${input}'`));
    });

    test('should return null and dispatch Not Found if Connections map is empty', async () => {
      // Default beforeEach already sets up getComponentData to return { connections: {} }
      const input = 'south';
      const result = await resolveTargetConnection(mockContext, input);

      expect(result).toBeNull();
      expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
      const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(input);
      expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
        'event:display_message',
        {text: expectedMsg, type: 'info'}
      );
      // Verify internal calls
      expect(mockCurrentLocation.getComponentData).toHaveBeenCalledWith(CONNECTIONS_COMPONENT_TYPE_ID);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`No direction or name matches found for '${input}'`));
    });

    test('should return null and dispatch Not Found if connection ID is dangling', async () => {
      const danglingId = 'conn-dangling';

      // *** UPDATE MOCK: Mock getComponentData with the dangling ID ***
      mockCurrentLocation.getComponentData.mockImplementation((componentTypeId) => {
        if (componentTypeId === CONNECTIONS_COMPONENT_TYPE_ID) {
          return {
            typeId: CONNECTIONS_COMPONENT_TYPE_ID,
            connections: {
              'up': danglingId
            }
          };
        }
        return undefined;
      });

      // Ensure entityManager returns null for this specific ID
      // (beforeEach already sets up getEntityInstance mock, just need to ensure it returns null for the ID)
      mockEntityManager.getEntityInstance.mockImplementation((id) => {
        if (id === danglingId) return null; // Explicitly return null for the dangling ID
        return mockEntityManager.entities.get(id); // Fallback for other valid IDs
      });


      const input = 'up';
      const result = await resolveTargetConnection(mockContext, input);

      expect(result).toBeNull();
      // Check that findPotentialConnectionMatches logged a warning about the missing entity
      expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining(`Could not find Connection entity '${danglingId}'`));
      // Check that the main function dispatched the "Not Found" message
      expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledTimes(1);
      const expectedMsg = TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(input);
      expect(mockValidatedDispatcher.dispatchValidated).toHaveBeenCalledWith(
        'event:display_message',
        {text: expectedMsg, type: 'info'}
      );
      // Verify the dangling ID was requested from entity manager
      expect(mockEntityManager.getEntityInstance).toHaveBeenCalledWith(danglingId);
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining(`No direction or name matches found for '${input}'`));
    });
  });

}); // End describe('ConnectionResolverService: resolveTargetConnection')