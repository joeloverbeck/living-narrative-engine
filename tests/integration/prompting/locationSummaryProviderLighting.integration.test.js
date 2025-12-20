// tests/integration/prompting/locationSummaryProviderLighting.integration.test.js

/**
 * @file Integration tests for LocationSummaryProvider lighting system integration.
 *
 * These tests verify that the LocationSummaryProvider correctly populates
 * the isLit and descriptionInDarkness fields in the AILocationSummaryDTO,
 * ensuring the LLM prompt generation receives accurate lighting information.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { LocationSummaryProvider } from '../../../src/data/providers/locationSummaryProvider.js';
import {
  POSITION_COMPONENT_ID,
  EXITS_COMPONENT_ID,
  NAME_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';
import {
  createMockLogger,
  createMockSafeEventDispatcher,
  createTestEntity,
} from '../../common/mockFactories/index.js';

/**
 * Creates a mock LightingStateService for testing.
 *
 * @param {object} options - Configuration options
 * @param {boolean} [options.isLit] - Whether location is lit
 * @param {string[]} [options.lightSources] - Light source entity IDs
 * @returns {object} Mock lighting state service
 */
function createMockLightingStateService({ isLit = true, lightSources = [] } = {}) {
  return {
    getLocationLightingState: jest.fn().mockReturnValue({ isLit, lightSources }),
    isLocationLit: jest.fn().mockReturnValue(isLit),
  };
}

/**
 * Creates a mock entity manager for testing.
 *
 * @returns {object} Mock entity manager
 */
function createMockEntityManager() {
  return {
    getEntityInstance: jest.fn(),
    getEntitiesInLocation: jest.fn().mockResolvedValue(new Set()),
    hasComponent: jest.fn(),
    getComponentData: jest.fn(),
  };
}

/**
 * Creates a mock entity summary provider for testing.
 *
 * @returns {object} Mock summary provider
 */
function createMockSummaryProvider() {
  return {
    getSummary: jest.fn().mockImplementation((entity) => {
      const name = entity.components?.[NAME_COMPONENT_ID]?.text || 'Unknown';
      const description = entity.components?.[DESCRIPTION_COMPONENT_ID]?.text || '';
      return { id: entity.id, name, description };
    }),
  };
}

describe('LocationSummaryProvider Lighting Integration', () => {
  let entityManager;
  let summaryProvider;
  let safeEventDispatcher;
  let logger;

  beforeEach(() => {
    entityManager = createMockEntityManager();
    summaryProvider = createMockSummaryProvider();
    safeEventDispatcher = createMockSafeEventDispatcher();
    logger = createMockLogger();
  });

  describe('naturally dark location with no light sources', () => {
    it('should include isLit=false for naturally dark location with no light sources', async () => {
      const lightingStateService = createMockLightingStateService({ isLit: false });

      const provider = new LocationSummaryProvider({
        entityManager,
        summaryProvider,
        safeEventDispatcher,
        lightingStateService,
      });

      const actor = createTestEntity('actor1', {
        [POSITION_COMPONENT_ID]: { locationId: 'lower_gallery' },
      });

      const locationEntity = createTestEntity('lower_gallery', {
        [NAME_COMPONENT_ID]: { text: 'lower gallery' },
        [DESCRIPTION_COMPONENT_ID]: { text: 'A long subterranean corridor.' },
        [EXITS_COMPONENT_ID]: [],
        'locations:naturally_dark': {},
      });

      entityManager.getEntityInstance.mockResolvedValue(locationEntity);

      const result = await provider.build(actor, logger);

      expect(result).not.toBeNull();
      expect(result.isLit).toBe(false);
      expect(lightingStateService.getLocationLightingState).toHaveBeenCalledWith('lower_gallery');
    });

    it('should include descriptionInDarkness when component is present', async () => {
      const lightingStateService = createMockLightingStateService({ isLit: false });

      const provider = new LocationSummaryProvider({
        entityManager,
        summaryProvider,
        safeEventDispatcher,
        lightingStateService,
      });

      const darknessDescription = 'The darkness presses close. Your boots scrape on uneven flagstone.';

      const actor = createTestEntity('actor1', {
        [POSITION_COMPONENT_ID]: { locationId: 'lower_gallery' },
      });

      const locationEntity = createTestEntity('lower_gallery', {
        [NAME_COMPONENT_ID]: { text: 'lower gallery' },
        [DESCRIPTION_COMPONENT_ID]: { text: 'A long subterranean corridor.' },
        [EXITS_COMPONENT_ID]: [],
        'locations:naturally_dark': {},
        'locations:description_in_darkness': { text: darknessDescription },
      });

      entityManager.getEntityInstance.mockResolvedValue(locationEntity);

      const result = await provider.build(actor, logger);

      expect(result).not.toBeNull();
      expect(result.isLit).toBe(false);
      expect(result.descriptionInDarkness).toBe(darknessDescription);
    });
  });

  describe('naturally dark location with light sources', () => {
    it('should include isLit=true for naturally dark location with light sources', async () => {
      const lightingStateService = createMockLightingStateService({
        isLit: true,
        lightSources: ['torch_01'],
      });

      const provider = new LocationSummaryProvider({
        entityManager,
        summaryProvider,
        safeEventDispatcher,
        lightingStateService,
      });

      const actor = createTestEntity('actor1', {
        [POSITION_COMPONENT_ID]: { locationId: 'lower_gallery' },
      });

      const locationEntity = createTestEntity('lower_gallery', {
        [NAME_COMPONENT_ID]: { text: 'lower gallery' },
        [DESCRIPTION_COMPONENT_ID]: { text: 'A long subterranean corridor.' },
        [EXITS_COMPONENT_ID]: [],
        'locations:naturally_dark': {},
        'locations:description_in_darkness': { text: 'Darkness description' },
      });

      entityManager.getEntityInstance.mockResolvedValue(locationEntity);

      const result = await provider.build(actor, logger);

      expect(result).not.toBeNull();
      expect(result.isLit).toBe(true);
      // descriptionInDarkness should still be populated (available for other uses)
      expect(result.descriptionInDarkness).toBe('Darkness description');
    });
  });

  describe('naturally lit location', () => {
    it('should include isLit=true for naturally lit locations', async () => {
      const lightingStateService = createMockLightingStateService({ isLit: true });

      const provider = new LocationSummaryProvider({
        entityManager,
        summaryProvider,
        safeEventDispatcher,
        lightingStateService,
      });

      const actor = createTestEntity('actor1', {
        [POSITION_COMPONENT_ID]: { locationId: 'town_square' },
      });

      const locationEntity = createTestEntity('town_square', {
        [NAME_COMPONENT_ID]: { text: 'town square' },
        [DESCRIPTION_COMPONENT_ID]: { text: 'A busy town square.' },
        [EXITS_COMPONENT_ID]: [],
        // No naturally_dark component = naturally lit
      });

      entityManager.getEntityInstance.mockResolvedValue(locationEntity);

      const result = await provider.build(actor, logger);

      expect(result).not.toBeNull();
      expect(result.isLit).toBe(true);
      expect(result.descriptionInDarkness).toBeNull();
    });
  });

  describe('missing darkness description', () => {
    it('should set descriptionInDarkness to null when component is missing', async () => {
      const lightingStateService = createMockLightingStateService({ isLit: false });

      const provider = new LocationSummaryProvider({
        entityManager,
        summaryProvider,
        safeEventDispatcher,
        lightingStateService,
      });

      const actor = createTestEntity('actor1', {
        [POSITION_COMPONENT_ID]: { locationId: 'dark_room' },
      });

      const locationEntity = createTestEntity('dark_room', {
        [NAME_COMPONENT_ID]: { text: 'dark room' },
        [DESCRIPTION_COMPONENT_ID]: { text: 'A very dark room.' },
        [EXITS_COMPONENT_ID]: [],
        'locations:naturally_dark': {},
        // No description_in_darkness component
      });

      entityManager.getEntityInstance.mockResolvedValue(locationEntity);

      const result = await provider.build(actor, logger);

      expect(result).not.toBeNull();
      expect(result.isLit).toBe(false);
      expect(result.descriptionInDarkness).toBeNull();
    });
  });
});
