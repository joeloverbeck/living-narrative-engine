// src/tests/services/targetResolutionService.domain-direction.test.js

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { TargetResolutionService } from '../../src/services/targetResolutionService.js';
import { ResolutionStatus } from '../../src/types/resolutionStatus.js';
import { EXITS_COMPONENT_ID } from '../../src/constants/componentIds.js';
import { getEntityIdsForScopes } from '../../src/services/entityScopeService.js'; // Import the constant

// --- Mocks for Dependencies ---
let mockEntityManager;
let mockWorldContext;
let mockGameDataRepository;
let mockLogger;
// --- End Mocks ---

describe("TargetResolutionService - Domain 'direction'", () => {
  let service;
  const mockActorEntity = { id: 'actor1' }; // A minimal mock actor
  const actionDefinition = { id: 'test:go-action', target_domain: 'direction' };

  // Helper to create actionContext with correct structure
  const createActionContext = (
    nounPhraseValue,
    currentActingEntity = mockActorEntity
  ) => {
    return {
      actingEntity: currentActingEntity,
      parsedCommand: {
        directObjectPhrase: nounPhraseValue,
        actionId: actionDefinition.id,
        originalInput:
          typeof nounPhraseValue === 'string' ? nounPhraseValue : '',
        error: null,
        preposition: null,
        indirectObjectPhrase: null,
      },
      entityManager: mockEntityManager,
      worldContext: mockWorldContext,
      gameDataRepository: mockGameDataRepository,
      logger: mockLogger,
      currentLocation: mockWorldContext.getCurrentLocation(currentActingEntity), // Get the currently mocked location
    };
  };

  beforeEach(() => {
    jest.resetAllMocks();

    mockEntityManager = {
      getEntityInstance: jest.fn(),
      getEntitiesInLocation: jest.fn(),
    };
    mockWorldContext = {
      getCurrentLocation: jest.fn(),
      getLocationOfEntity: jest.fn(),
      getCurrentActor: jest.fn(),
    };
    mockGameDataRepository = {
      getActionDefinition: jest.fn(),
      getAllActionDefinitions: jest.fn(),
    };
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
    };

    const options = {
      entityManager: mockEntityManager,
      worldContext: mockWorldContext,
      gameDataRepository: mockGameDataRepository,
      logger: mockLogger,
      getEntityIdsForScopes: getEntityIdsForScopes,
    };
    service = new TargetResolutionService(options);

    // Default mock for actor's location for _buildMinimalContextForScopes if called.
    // Most direction tests mock getCurrentLocation directly.
    mockWorldContext.getLocationOfEntity.mockReturnValue({
      id: 'defaultMockLoc',
    });

    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
    mockLogger.debug.mockClear();
    mockLogger.warn.mockClear();
  });

  // 7.1: Current Location Not Found
  describe('7.1: Current Location Not Found', () => {
    test('should return ERROR if current location is unknown (actorEntity null)', async () => {
      mockWorldContext.getCurrentLocation.mockReturnValue(undefined);
      const actionContext = createActionContext('north', null); // actorEntity is null

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.ERROR);
      expect(result.targetType).toBe('direction');
      expect(result.targetId).toBeNull();
      expect(result.error).toBe('Internal error: Your location is unknown.');
      // Note: actorEntity?.id in the log will be undefined with actorEntity as null
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'TargetResolutionService.#_resolveDirection: Could not determine current location. actorEntity ID: undefined'
      );
    });

    test('should return ERROR if current location is unknown (actorEntity non-null)', async () => {
      mockWorldContext.getCurrentLocation.mockReturnValue(undefined);
      const actionContext = createActionContext('north');

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.ERROR);
      expect(result.targetType).toBe('direction');
      expect(result.targetId).toBeNull();
      expect(result.error).toBe('Internal error: Your location is unknown.');
      expect(mockWorldContext.getCurrentLocation).toHaveBeenCalledWith(
        mockActorEntity
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'TargetResolutionService.#_resolveDirection: Could not determine current location. actorEntity ID: actor1'
      );
    });

    test('should return ERROR if current location entity has no ID', async () => {
      mockWorldContext.getCurrentLocation.mockReturnValue({
        name: 'A nameless void',
      }); // No .id property
      const actionContext = createActionContext('north');

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );
      expect(result.status).toBe(ResolutionStatus.ERROR);
      expect(result.targetType).toBe('direction');
      expect(result.targetId).toBeNull();
      expect(result.error).toBe('Internal error: Your location is unknown.');
    });
  });

  // 7.2: Location Has No EXITS_COMPONENT_ID / Component is Empty/Invalid Array
  describe('7.2: Location Has No EXITS_COMPONENT_ID / Component is Empty/Invalid Array', () => {
    const mockLocationNoExits = {
      id: 'location1',
      getComponentData: jest.fn(),
    };

    beforeEach(() => {
      mockLocationNoExits.getComponentData.mockReset();
      mockWorldContext.getCurrentLocation.mockReturnValue(mockLocationNoExits);
    });

    test('should return NOT_FOUND if location has no EXITS_COMPONENT_ID', async () => {
      mockLocationNoExits.getComponentData.mockReturnValue(undefined);
      const actionContext = createActionContext('north');

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
      expect(result.targetType).toBe('direction');
      expect(result.targetId).toBeNull();
      expect(result.error).toBe('There are no obvious exits from here.');
      expect(mockLocationNoExits.getComponentData).toHaveBeenCalledWith(
        EXITS_COMPONENT_ID
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining(`has no '${EXITS_COMPONENT_ID}' component`)
      );
    });

    test('should return NOT_FOUND if exits component is an empty array', async () => {
      mockLocationNoExits.getComponentData.mockReturnValue([]);
      const actionContext = createActionContext('north');

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
      expect(result.error).toBe('There are no obvious exits from here.');
    });

    test('should return NOT_FOUND if exits component is not an array (e.g., an object)', async () => {
      mockLocationNoExits.getComponentData.mockReturnValue({}); // Invalid data type
      const actionContext = createActionContext('north');

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
      expect(result.error).toBe('There are no obvious exits from here.');
    });
  });

  // 7.3: exitsComponentData Contains Invalid Exit Objects
  describe('7.3: exitsComponentData Contains Invalid Exit Objects (skipped, logged)', () => {
    const mockLocationWithMixedExits = {
      id: 'location2',
      getComponentData: jest.fn(),
    };

    beforeEach(() => {
      mockLocationWithMixedExits.getComponentData.mockReset();
      mockWorldContext.getCurrentLocation.mockReturnValue(
        mockLocationWithMixedExits
      );
    });

    test('should skip invalid exit objects and still find valid ones', async () => {
      const exitsData = [
        null,
        { direction: 123 },
        { direction: 'North' },
        { direction: '' },
        { someOtherProp: 'East' },
        { direction: '  ' },
        { direction: 'South' },
      ];
      mockLocationWithMixedExits.getComponentData.mockReturnValue(exitsData);
      const actionContext = createActionContext('north'); // Corrected actionContext

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
      expect(result.targetId).toBe('North');
      expect(mockLogger.warn).toHaveBeenCalledTimes(5);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'invalid exit object or missing/empty direction string: null'
        )
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'invalid exit object or missing/empty direction string: {"direction":123}'
        )
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'invalid exit object or missing/empty direction string: {"direction":""}'
        )
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'invalid exit object or missing/empty direction string: {"someOtherProp":"East"}'
        )
      );
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'invalid exit object or missing/empty direction string: {"direction":"  "}'
        )
      );
    });
  });

  // 7.4: All Exits in Component are Invalid
  describe('7.4: All Exits in Component are Invalid', () => {
    const mockLocationWithOnlyInvalidExits = {
      id: 'location3',
      getComponentData: jest.fn(),
    };

    beforeEach(() => {
      mockLocationWithOnlyInvalidExits.getComponentData.mockReset();
      mockWorldContext.getCurrentLocation.mockReturnValue(
        mockLocationWithOnlyInvalidExits
      );
    });

    test('should return NOT_FOUND with "no clearly marked exits" if all exits are invalid', async () => {
      const exitsData = [{ direction: 123 }, { direction: '' }, null];
      mockLocationWithOnlyInvalidExits.getComponentData.mockReturnValue(
        exitsData
      );
      const actionContext = createActionContext('north'); // Corrected actionContext

      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
      expect(result.targetType).toBe('direction');
      expect(result.targetId).toBeNull();
      expect(result.error).toBe('There are no clearly marked exits here.');
      expect(mockLogger.warn).toHaveBeenCalledTimes(3);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('no valid direction strings found')
      );
    });
  });

  // 7.5: No Noun Phrase Provided (valid exits exist)
  describe('7.5: No Noun Phrase Provided (valid exits exist)', () => {
    const mockLocationWithValidExits = {
      id: 'location4',
      getComponentData: jest.fn(),
    };

    beforeEach(() => {
      mockLocationWithValidExits.getComponentData.mockReset();
      mockWorldContext.getCurrentLocation.mockReturnValue(
        mockLocationWithValidExits
      );
      mockLocationWithValidExits.getComponentData.mockReturnValue([
        { direction: 'North' },
        { direction: 'South' },
      ]);
    });

    test.each([
      [null, 'null nounPhrase'],
      [undefined, 'undefined nounPhrase'],
      ['', 'empty string nounPhrase'],
      ['   ', 'whitespace string nounPhrase'],
    ])(
      'should return NONE "Which direction...?" for %s',
      async (nounPhraseValue, _description) => {
        const actionContext = createActionContext(nounPhraseValue); // Uses the helper which nests correctly

        const result = await service.resolveActionTarget(
          actionDefinition,
          actionContext
        );

        expect(result.status).toBe(ResolutionStatus.NONE);
        expect(result.targetType).toBe('direction');
        expect(result.targetId).toBeNull();
        expect(result.error).toBe('Which direction do you want to go?');
        expect(mockLogger.debug).toHaveBeenCalledWith(
          'TargetResolutionService.#_resolveDirection: No nounPhrase (direction) provided.'
        );
      }
    );
  });

  // 7.6: Unique Direction Match (Case-Insensitive)
  describe('7.6: Unique Direction Match (Case-Insensitive)', () => {
    const mockLocationWithExits = {
      id: 'location5',
      getComponentData: jest.fn(),
    };
    beforeEach(() => {
      mockLocationWithExits.getComponentData.mockReset();
      mockWorldContext.getCurrentLocation.mockReturnValue(
        mockLocationWithExits
      );
      mockLocationWithExits.getComponentData.mockReturnValue([
        { direction: 'North' },
        { direction: 'South-East' },
      ]);
    });

    test('should find a unique direction match case-insensitively (e.g. "north" for "North")', async () => {
      const actionContext = createActionContext('north'); // Corrected actionContext
      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
      expect(result.targetType).toBe('direction');
      expect(result.targetId).toBe('North');
      expect(result.error).toBeUndefined();
      expect(mockLogger.debug).toHaveBeenCalledWith(
        "TargetResolutionService.#_resolveDirection: Found unique direction: 'North'"
      );
    });

    test('should find a unique direction match for multi-word, case-insensitively (e.g. "south-east" for "South-East")', async () => {
      const actionContext = createActionContext('south-east'); // Corrected actionContext
      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
      expect(result.targetType).toBe('direction');
      expect(result.targetId).toBe('South-East');
    });

    test('should find a unique direction match with leading/trailing spaces in nounPhrase', async () => {
      const actionContext = createActionContext('  NoRtH  '); // Corrected actionContext
      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.FOUND_UNIQUE);
      expect(result.targetId).toBe('North');
    });
  });

  // 7.7: No Matching Direction
  describe('7.7: No Matching Direction', () => {
    const mockLocationWithExits = {
      id: 'location6',
      getComponentData: jest.fn(),
    };
    beforeEach(() => {
      mockLocationWithExits.getComponentData.mockReset();
      mockWorldContext.getCurrentLocation.mockReturnValue(
        mockLocationWithExits
      );
      mockLocationWithExits.getComponentData.mockReturnValue([
        { direction: 'West' },
        { direction: 'Up' },
      ]);
    });

    test('should return NOT_FOUND if nounPhrase does not match any valid exit', async () => {
      const nounPhraseValue = 'East';
      const actionContext = createActionContext(nounPhraseValue); // Corrected actionContext
      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.NOT_FOUND);
      expect(result.targetType).toBe('direction');
      expect(result.targetId).toBeNull();
      expect(result.error).toBe(`You can't go "${nounPhraseValue}".`);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        `TargetResolutionService.#_resolveDirection: No exit matches direction '${nounPhraseValue}'. Valid exits were: West, Up`
      );
    });
  });

  // 7.8: Ambiguous Direction Match
  describe('7.8: Ambiguous Direction Match', () => {
    const mockLocationWithAmbiguousExits = {
      id: 'location7',
      getComponentData: jest.fn(),
    };
    beforeEach(() => {
      mockLocationWithAmbiguousExits.getComponentData.mockReset();
      mockWorldContext.getCurrentLocation.mockReturnValue(
        mockLocationWithAmbiguousExits
      );
      mockLocationWithAmbiguousExits.getComponentData.mockReturnValue([
        { direction: 'UP' },
        { direction: 'up' },
        { direction: 'North' },
      ]);
    });

    test('should return AMBIGUOUS if nounPhrase matches multiple exits due to casing', async () => {
      const nounPhraseValue = 'up';
      const actionContext = createActionContext(nounPhraseValue); // Corrected actionContext
      const result = await service.resolveActionTarget(
        actionDefinition,
        actionContext
      );

      expect(result.status).toBe(ResolutionStatus.AMBIGUOUS);
      expect(result.targetType).toBe('direction');
      expect(result.targetId).toBeNull();
      expect(result.error).toBe(
        `The direction "${nounPhraseValue}" is ambiguously defined here.`
      );
      expect(result.candidates).toEqual(expect.arrayContaining(['UP', 'up']));
      expect(result.candidates.length).toBe(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        `TargetResolutionService.#_resolveDirection: Ambiguous direction due to duplicate exit definitions for 'up'. Matched: UP, up.`
      );
    });
  });
});
