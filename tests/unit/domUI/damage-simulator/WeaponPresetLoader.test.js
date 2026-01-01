/**
 * @file WeaponPresetLoader.test.js
 * @description Unit tests for WeaponPresetLoader component
 */

import WeaponPresetLoader, {
  PRESET_EVENTS,
} from '../../../../src/domUI/damage-simulator/WeaponPresetLoader.js';
import { jest } from '@jest/globals';

describe('WeaponPresetLoader', () => {
  let mockLogger;
  let mockEventBus;
  let mockDataRegistry;
  let loader;

  /**
   * Create a mock weapon entity definition
   *
   * @param {string} id - Entity ID
   * @param {string} name - Weapon name
   * @param {Array<object>} entries - Damage entries
   * @param {boolean} includeWeaponMarker - Whether to include weapons:weapon component
   * @returns {object} Mock entity definition
   */
  const createMockWeaponDef = (
    id,
    name,
    entries,
    includeWeaponMarker = true
  ) => ({
    id,
    components: {
      'core:name': { text: name },
      'damage-types:damage_capabilities': { entries },
      ...(includeWeaponMarker ? { 'weapons:weapon': {} } : {}),
    },
  });

  /**
   * Create a mock body part entity (has damage capabilities but no weapon marker)
   *
   * @param {string} id - Entity ID
   * @param {string} name - Part name
   * @param {Array<object>} entries - Damage entries
   * @returns {object} Mock entity definition
   */
  const createMockBodyPartDef = (id, name, entries) =>
    createMockWeaponDef(id, name, entries, false);

  /**
   * Sample damage entries for testing
   */
  const sampleDamageEntries = {
    rapier: [
      {
        name: 'piercing',
        amount: 18,
        penetration: 0.6,
        bleed: { enabled: true, severity: 'moderate', baseDurationTurns: 3 },
      },
      {
        name: 'slashing',
        amount: 8,
        penetration: 0.1,
        bleed: { enabled: true, severity: 'minor', baseDurationTurns: 2 },
      },
    ],
    longsword: [
      {
        name: 'slashing',
        amount: 20,
        penetration: 0.3,
        bleed: { enabled: true, severity: 'moderate', baseDurationTurns: 3 },
      },
      { name: 'piercing', amount: 12, penetration: 0.4 },
    ],
    club: [{ name: 'blunt', amount: 15, penetration: 0.1 }],
    arm: [{ name: 'blunt', amount: 5, penetration: 0.0 }],
  };

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Mock event bus
    mockEventBus = {
      dispatch: jest.fn(),
    };

    // Mock data registry with default weapon definitions
    mockDataRegistry = {
      getAllEntityDefinitions: jest.fn().mockReturnValue([
        createMockWeaponDef(
          'fantasy:vespera_rapier',
          'theatrical rapier',
          sampleDamageEntries.rapier
        ),
        createMockWeaponDef(
          'fantasy:melissa_longsword',
          'blessed longsword',
          sampleDamageEntries.longsword
        ),
        createMockWeaponDef(
          'core:simple_club',
          'wooden club',
          sampleDamageEntries.club
        ),
        // Body part - should be filtered out
        createMockBodyPartDef(
          'anatomy:humanoid_arm',
          'humanoid arm',
          sampleDamageEntries.arm
        ),
      ]),
    };

    // Create loader instance
    loader = new WeaponPresetLoader({
      dataRegistry: mockDataRegistry,
      eventBus: mockEventBus,
      logger: mockLogger,
    });
  });

  describe('constructor', () => {
    it('should validate all required dependencies', () => {
      expect(() => {
        new WeaponPresetLoader({
          dataRegistry: mockDataRegistry,
          eventBus: mockEventBus,
          logger: mockLogger,
        });
      }).not.toThrow();
    });

    it('should throw when dataRegistry is missing getAllEntityDefinitions', () => {
      expect(() => {
        new WeaponPresetLoader({
          dataRegistry: {},
          eventBus: mockEventBus,
          logger: mockLogger,
        });
      }).toThrow();
    });

    it('should throw when eventBus is missing dispatch', () => {
      expect(() => {
        new WeaponPresetLoader({
          dataRegistry: mockDataRegistry,
          eventBus: {},
          logger: mockLogger,
        });
      }).toThrow();
    });
  });

  describe('getAvailablePresets', () => {
    it('should scan registry for entities with damage_capabilities', () => {
      const presets = loader.getAvailablePresets();

      expect(mockDataRegistry.getAllEntityDefinitions).toHaveBeenCalled();
      expect(presets.length).toBeGreaterThan(0);
    });

    it('should filter out entities without weapons:weapon component', () => {
      const presets = loader.getAvailablePresets();

      // Should have 3 weapons, not the body part
      expect(presets).toHaveLength(3);
      expect(presets.find((p) => p.id === 'anatomy:humanoid_arm')).toBeUndefined();
    });

    it('should format dropdown options with name and damage type', () => {
      const presets = loader.getAvailablePresets();

      const rapierPreset = presets.find(
        (p) => p.id === 'fantasy:vespera_rapier'
      );
      expect(rapierPreset).toBeDefined();
      expect(rapierPreset.name).toBe('theatrical rapier');
      expect(rapierPreset.damageType).toBe('piercing');
    });

    it('should handle weapons with multiple damage entries', () => {
      const presets = loader.getAvailablePresets();

      const rapierPreset = presets.find(
        (p) => p.id === 'fantasy:vespera_rapier'
      );
      expect(rapierPreset.entries).toHaveLength(2);
      expect(rapierPreset.entries[0].name).toBe('piercing');
      expect(rapierPreset.entries[1].name).toBe('slashing');
    });

    it('should handle missing damage_capabilities gracefully', () => {
      mockDataRegistry.getAllEntityDefinitions.mockReturnValue([
        {
          id: 'test:no_damage',
          components: {
            'core:name': { text: 'no damage item' },
            'weapons:weapon': {},
          },
        },
      ]);

      const presets = loader.getAvailablePresets();
      expect(presets).toHaveLength(0);
    });

    it('should handle empty registry gracefully', () => {
      mockDataRegistry.getAllEntityDefinitions.mockReturnValue([]);

      const presets = loader.getAvailablePresets();

      expect(presets).toEqual([]);
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('No entity definitions found in registry')
      );
    });

    it('should cache presets after first call', () => {
      loader.getAvailablePresets();
      loader.getAvailablePresets();

      // Should only call getAllEntityDefinitions once
      expect(mockDataRegistry.getAllEntityDefinitions).toHaveBeenCalledTimes(1);
    });

    it('should use entity ID as name when core:name is missing', () => {
      mockDataRegistry.getAllEntityDefinitions.mockReturnValue([
        {
          id: 'test:unnamed_weapon',
          components: {
            'weapons:weapon': {},
            'damage-types:damage_capabilities': {
              entries: [{ name: 'blunt', amount: 10, penetration: 0.2 }],
            },
          },
        },
      ]);

      const presets = loader.getAvailablePresets();
      expect(presets[0].name).toBe('test:unnamed_weapon');
    });

    it('should handle entities with empty entries array', () => {
      mockDataRegistry.getAllEntityDefinitions.mockReturnValue([
        createMockWeaponDef('test:empty_weapon', 'empty weapon', []),
      ]);

      const presets = loader.getAvailablePresets();
      expect(presets).toHaveLength(0);
    });

    it('should handle registry errors gracefully', () => {
      mockDataRegistry.getAllEntityDefinitions.mockImplementation(() => {
        throw new Error('Registry error');
      });

      const presets = loader.getAvailablePresets();

      expect(presets).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error scanning registry'),
        expect.any(Error)
      );
    });
  });

  describe('loadPreset', () => {
    it('should return damage entry for selected weapon', () => {
      const entry = loader.loadPreset('fantasy:vespera_rapier');

      expect(entry).toBeDefined();
      expect(entry.name).toBe('piercing');
      expect(entry.amount).toBe(18);
      expect(entry.penetration).toBe(0.6);
    });

    it('should emit event on preset loaded', () => {
      loader.loadPreset('fantasy:vespera_rapier');

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        PRESET_EVENTS.PRESET_LOADED,
        {
          weaponDefId: 'fantasy:vespera_rapier',
          weaponName: 'theatrical rapier',
          damageEntry: expect.objectContaining({
            name: 'piercing',
            amount: 18,
          }),
        }
      );
    });

    it('should return first entry for weapons with multiple damage entries', () => {
      const entry = loader.loadPreset('fantasy:melissa_longsword');

      expect(entry.name).toBe('slashing');
      expect(entry.amount).toBe(20);
    });

    it('should return null for non-existent weapon', () => {
      const entry = loader.loadPreset('fantasy:nonexistent');

      expect(entry).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Preset not found'),
        'fantasy:nonexistent'
      );
    });

    it('should emit error event when preset not found', () => {
      loader.loadPreset('fantasy:nonexistent');

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        PRESET_EVENTS.PRESET_LOAD_ERROR,
        {
          weaponDefId: 'fantasy:nonexistent',
          error: expect.stringContaining('not found'),
        }
      );
    });

    it('should log info on successful preset load', () => {
      loader.loadPreset('fantasy:vespera_rapier');

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Loaded preset successfully'),
        'fantasy:vespera_rapier',
        'piercing'
      );
    });
  });

  describe('populateSelector', () => {
    let selectElement;

    beforeEach(() => {
      selectElement = document.createElement('select');
    });

    it('should populate dropdown with available weapons', () => {
      loader.populateSelector(selectElement);

      // 1 placeholder + 3 weapons
      expect(selectElement.options.length).toBe(4);
    });

    it('should add placeholder option first', () => {
      loader.populateSelector(selectElement);

      const placeholder = selectElement.options[0];
      expect(placeholder.value).toBe('');
      expect(placeholder.disabled).toBe(true);
      expect(placeholder.selected).toBe(true);
      expect(placeholder.textContent).toContain('Select a weapon');
    });

    it('should format options with name and damage type', () => {
      loader.populateSelector(selectElement);

      // Find the rapier option (options are sorted alphabetically)
      const options = Array.from(selectElement.options);
      const rapierOption = options.find((o) =>
        o.textContent.includes('theatrical rapier')
      );

      expect(rapierOption).toBeDefined();
      expect(rapierOption.textContent).toBe('theatrical rapier (piercing)');
      expect(rapierOption.value).toBe('fantasy:vespera_rapier');
    });

    it('should sort options alphabetically by name', () => {
      loader.populateSelector(selectElement);

      const optionTexts = Array.from(selectElement.options)
        .slice(1) // Skip placeholder
        .map((o) => o.textContent);

      // Should be alphabetically sorted
      expect(optionTexts[0]).toContain('blessed longsword');
      expect(optionTexts[1]).toContain('theatrical rapier');
      expect(optionTexts[2]).toContain('wooden club');
    });

    it('should handle empty registry gracefully', () => {
      mockDataRegistry.getAllEntityDefinitions.mockReturnValue([]);
      loader.clearCache();

      loader.populateSelector(selectElement);

      // Placeholder + "No weapons available" message
      expect(selectElement.options.length).toBe(2);
      expect(selectElement.options[1].textContent).toContain('No weapons');
      expect(selectElement.options[1].disabled).toBe(true);
    });

    it('should clear existing options before populating', () => {
      // Add some existing options
      const existingOption = document.createElement('option');
      existingOption.textContent = 'Old option';
      selectElement.add(existingOption);

      loader.populateSelector(selectElement);

      // Should not include the old option
      const optionTexts = Array.from(selectElement.options).map(
        (o) => o.textContent
      );
      expect(optionTexts).not.toContain('Old option');
    });

    it('should handle invalid select element gracefully', () => {
      loader.populateSelector(null);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid select element')
      );

      loader.populateSelector(document.createElement('div'));
      expect(mockLogger.warn).toHaveBeenCalledTimes(2);
    });
  });

  describe('clearCache', () => {
    it('should clear cached presets', () => {
      // First call caches
      loader.getAvailablePresets();
      expect(mockDataRegistry.getAllEntityDefinitions).toHaveBeenCalledTimes(1);

      // Clear cache
      loader.clearCache();

      // Second call should re-scan
      loader.getAvailablePresets();
      expect(mockDataRegistry.getAllEntityDefinitions).toHaveBeenCalledTimes(2);
    });
  });

  describe('integration with DamageCapabilityComposer', () => {
    it('should return preset data compatible with composer setConfiguration', () => {
      const entry = loader.loadPreset('fantasy:vespera_rapier');

      // Entry should have the expected structure
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('amount');
      expect(entry).toHaveProperty('penetration');
      expect(typeof entry.amount).toBe('number');
      expect(typeof entry.penetration).toBe('number');
    });

    it('should apply preset to composer form via event', () => {
      loader.loadPreset('fantasy:vespera_rapier');

      // Verify the event was dispatched with full damage entry
      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        PRESET_EVENTS.PRESET_LOADED,
        expect.objectContaining({
          damageEntry: expect.objectContaining({
            name: 'piercing',
            amount: 18,
            penetration: 0.6,
          }),
        })
      );
    });
  });

  describe('PRESET_EVENTS export', () => {
    it('should export correct event types', () => {
      expect(PRESET_EVENTS.PRESET_LOADED).toBe('damage-simulator:preset-loaded');
      expect(PRESET_EVENTS.PRESET_LOAD_ERROR).toBe(
        'damage-simulator:preset-load-error'
      );
    });
  });
});
