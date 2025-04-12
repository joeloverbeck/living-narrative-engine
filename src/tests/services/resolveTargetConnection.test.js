// src/tests/resolveTargetConnection.test.js

import {beforeEach, describe, expect, jest, test} from '@jest/globals';
import {
    resolveTargetConnection,
} from '../../services/targetResolutionService.js';
import Entity from '../../entities/entity.js'; // Assuming Entity is default export
import {NameComponent} from '../../components/nameComponent.js';
import {PositionComponent} from '../../components/positionComponent.js';
import {ConnectionsComponent} from '../../components/connectionsComponent.js'; // Import ConnectionComponent
import {TARGET_MESSAGES, getDisplayName} from '../../utils/messages.js';

// --- Mocks ---
const mockDispatch = jest.fn(); // General dispatch mock for resolveTargetEntity/Connection context
const mockEventBusDispatch = jest.fn(); // Specific dispatch mock for resolveItemTarget eventBus
const mockEntityManager = {
    getEntityInstance: jest.fn((id) => mockEntityManager.entities.get(id)),
    getEntitiesInLocation: jest.fn((locId) => mockEntityManager.locations.get(locId) || new Set()),
    entities: new Map(),
    locations: new Map(), // Map<locationId, Set<entityId>>
};
const mockConditionEvaluationService = {
    evaluateConditions: jest.fn(),
};

// Mock Entities
let mockPlayerEntity;
let mockCurrentLocation;

// --- Test Context ---
const mockContext = {
    playerEntity: null, // Will be set in beforeEach
    currentLocation: null, // Will be set in beforeEach
    entityManager: mockEntityManager,
    dispatch: mockDispatch, // Used by resolveTargetEntity/Connection
    targets: [],
    dataManager: {},
};


// --- Helper Functions ---
const createMockEntity = (id, name, components = []) => {
    const entity = new Entity(id);
    entity.addComponent(new NameComponent({value: name}));
    components.forEach(comp => entity.addComponent(comp));
    mockEntityManager.entities.set(id, entity);
    return entity;
};

const placeInLocation = (entityId, locationId) => {
    if (!mockEntityManager.locations.has(locationId)) {
        mockEntityManager.locations.set(locationId, new Set());
    }
    mockEntityManager.locations.get(locationId).add(entityId);
    const entity = mockEntityManager.entities.get(entityId);
    if (entity) {
        let posComp = entity.getComponent(PositionComponent);
        if (!posComp) {
            posComp = new PositionComponent({locationId: locationId});
            entity.addComponent(posComp);
        } else {
            posComp.setLocation(locationId);
        }
    }
};

// --- Global Setup ---
beforeEach(() => {
    // Clear mocks
    mockDispatch.mockClear();
    mockEventBusDispatch.mockClear();
    mockEntityManager.entities.clear();
    mockEntityManager.locations.clear();
    mockEntityManager.getEntityInstance.mockClear().mockImplementation((id) => mockEntityManager.entities.get(id));
    mockEntityManager.getEntitiesInLocation.mockClear().mockImplementation((locId) => mockEntityManager.locations.get(locId) || new Set());
    mockConditionEvaluationService.evaluateConditions.mockClear().mockResolvedValue({
        success: true,
        messages: [],
        failureMessage: null
    }); // Default success

    // Reset player/location
    mockPlayerEntity = createMockEntity('player', 'Player');
    mockCurrentLocation = createMockEntity('loc-1', 'Test Room');
    placeInLocation(mockPlayerEntity.id, mockCurrentLocation.id); // Place player

    // Update context
    mockContext.playerEntity = mockPlayerEntity;
    mockContext.currentLocation = mockCurrentLocation;
    mockContext.targets = [];
});

// ========================================================================
// == Tests for resolveTargetConnection Utility Function ==================
// ========================================================================

// Note: The extensive Analysis Summary comment block previously here
// has been moved to the Jira ticket description (CHILD-TICKET-2.2.2)
// or related documentation for better code readability, as suggested.

describe('resolveTargetConnection', () => {
    let locationEntity;
    let northConn, southConn, eastDoorConn, westAmbiguousConn1, westAmbiguousConn2;

    beforeEach(() => {
        // Use the global mock context (player, location already set up)
        locationEntity = mockCurrentLocation;

        // Setup connections (Keep existing ones)
        northConn = {connectionId: 'c-n', direction: 'north', targetLocationId: 'loc-n', name: 'archway'};
        southConn = {connectionId: 'c-s', direction: 'south', targetLocationId: 'loc-s', name: 'gap in the wall'};
        eastDoorConn = {connectionId: 'c-e', direction: 'east', targetLocationId: 'loc-e', name: 'heavy wooden door'};
        // Ambiguous connections (both match 'west' direction AND partial 'path')
        westAmbiguousConn1 = {connectionId: 'c-w1', direction: 'west', targetLocationId: 'loc-w1', name: 'narrow path'};
        westAmbiguousConn2 = {connectionId: 'c-w2', direction: 'west', targetLocationId: 'loc-w2', name: 'wider path'};

        const connectionsComp = new ConnectionsComponent();
        connectionsComp.addConnection(northConn);
        connectionsComp.addConnection(southConn);
        connectionsComp.addConnection(eastDoorConn);
        connectionsComp.addConnection(westAmbiguousConn1);
        connectionsComp.addConnection(westAmbiguousConn2);
        locationEntity.addComponent(connectionsComp);
    });

    // --- Input Validation ---
    test('should return null if connectionTargetName is empty or whitespace', () => {
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        expect(resolveTargetConnection(mockContext, '')).toBeNull();
        expect(resolveTargetConnection(mockContext, '  ')).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalledWith("resolveTargetConnection: Received empty connectionTargetName. Resolution cannot proceed.");
        consoleWarnSpy.mockRestore();
        expect(mockDispatch).not.toHaveBeenCalled(); // Does not dispatch PROMPT_WHAT by default
    });

    // --- Location State ---
    test('should return null if location lacks ConnectionsComponent', () => {
        locationEntity.removeComponent(ConnectionsComponent);
        const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
        });
        expect(resolveTargetConnection(mockContext, 'north')).toBeNull();
        expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining("lacks ConnectionsComponent"));
        consoleWarnSpy.mockRestore();
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    test('should return null and dispatch SCOPE_EMPTY if location has no connections', () => {
        locationEntity.getComponent(ConnectionsComponent).clearConnections(); // Remove all connections
        const actionVerb = 'go';
        expect(resolveTargetConnection(mockContext, 'north', actionVerb)).toBeNull();
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.SCOPE_EMPTY_GENERIC(actionVerb, 'in this direction'),
            type: 'info',
        });
    });

    // --- Basic Matching Logic ---
    test('should find unique connection by exact direction (case-insensitive)', () => {
        expect(resolveTargetConnection(mockContext, 'north')).toBe(northConn);
        expect(resolveTargetConnection(mockContext, 'SOUTH')).toBe(southConn);
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    test('should find unique connection by partial name (case-insensitive)', () => {
        expect(resolveTargetConnection(mockContext, 'arch')).toBe(northConn);
        expect(resolveTargetConnection(mockContext, 'GAP')).toBe(southConn);
        expect(resolveTargetConnection(mockContext, 'wooden door')).toBe(eastDoorConn); // Matches 'heavy wooden door'
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    test('should find unique connection by full name (case-insensitive)', () => {
        expect(resolveTargetConnection(mockContext, 'heavy wooden door')).toBe(eastDoorConn);
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    test('should return null and dispatch NOT_FOUND if no connection matches', () => {
        const targetName = 'teleporter';
        expect(resolveTargetConnection(mockContext, targetName)).toBeNull();
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetName),
            type: 'info',
        });
    });

    // --- Ambiguity ---
    test('should return null and dispatch ambiguous message if direction matches multiple', () => {
        const targetName = 'west'; // Matches westAmbiguousConn1 and westAmbiguousConn2 by direction
        const actionVerb = 'move';
        const result = resolveTargetConnection(mockContext, targetName, actionVerb);
        expect(result).toBeNull();
        const displayNames = [westAmbiguousConn1, westAmbiguousConn2].map(c => c.name || c.direction).join(', ');
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: `There are multiple ways to go '${targetName}'. Which one did you mean? (${displayNames})`,
            type: 'warning',
        });
    });

    test('should return null and dispatch ambiguous message if name matches multiple', () => {
        const targetName = 'path'; // Matches westAmbiguousConn1 and westAmbiguousConn2 by name
        const actionVerb = 'use key on';
        const result = resolveTargetConnection(mockContext, targetName, actionVerb);
        expect(result).toBeNull();
        const displayNames = [westAmbiguousConn1, westAmbiguousConn2].map(c => c.name || c.direction).join(', ');
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: `Which '${targetName}' did you want to ${actionVerb}? (${displayNames})`,
            type: 'warning',
        });
    });

    // --- Priority ---
    test('should prioritize direction match over name match if unique by direction', () => {
        // Add a connection that might match 'east' by name but not direction
        const sneakyConn = {
            connectionId: 'c-sneak',
            direction: 'up',
            targetLocationId: 'loc-up',
            name: 'east wing passage'
        };
        locationEntity.getComponent(ConnectionsComponent).addConnection(sneakyConn);

        // Searching for 'east' should uniquely find the one with direction 'east'
        expect(resolveTargetConnection(mockContext, 'east')).toBe(eastDoorConn);
        expect(mockDispatch).not.toHaveBeenCalled();
    });

    // --- Whitespace and Punctuation Edge Case Tests (CHILD-TICKET-2.2.2) ---

    // AC1: Internal Whitespace - Name (No Match)
    test('should return null for input name with extra internal spaces not matching target name', () => {
        const targetNameInput = 'heavy   wooden  door'; // Input with extra spaces
        // Target connection `eastDoorConn` has name: 'heavy wooden door'
        expect(resolveTargetConnection(mockContext, targetNameInput)).toBeNull();
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetNameInput.trim()), // trim() happens before message
            type: 'info',
        });
    });

    // AC2: Trailing Punctuation - Name Match
    test('should find connection when input name with trailing punctuation matches target name punctuation', () => {
        // Add a specific connection for this test case
        const signConn = {
            connectionId: 'c-sign',
            direction: 'portal',
            targetLocationId: 'loc-sign',
            name: 'Exit sign.'
        };
        locationEntity.getComponent(ConnectionsComponent).addConnection(signConn);

        const targetNameInput = 'sign.'; // Input with trailing period
        expect(resolveTargetConnection(mockContext, targetNameInput)).toBe(signConn);
        expect(mockDispatch).not.toHaveBeenCalled(); // Successful unique match
    });

    // AC3: Trailing Punctuation - Name No Match
    test('should return null when input name with trailing punctuation does not match target name', () => {
        const targetNameInput = 'archway.'; // Input with trailing period
        // Target connection `northConn` has name: 'archway'
        expect(resolveTargetConnection(mockContext, targetNameInput)).toBeNull();
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetNameInput.trim()), // trim() happens before message
            type: 'info',
        });
    });

    // AC4: Trailing Punctuation - Direction No Match
    test('should return null when input direction with trailing punctuation does not match target direction', () => {
        const targetDirectionInput = 'north.'; // Input with trailing period
        // Target connection `northConn` has direction: 'north'
        expect(resolveTargetConnection(mockContext, targetDirectionInput)).toBeNull();
        expect(mockDispatch).toHaveBeenCalledWith('ui:message_display', {
            text: TARGET_MESSAGES.TARGET_NOT_FOUND_CONTEXT(targetDirectionInput.trim()), // trim() happens before message
            type: 'info',
        });
    });


}); // End describe for resolveTargetConnection