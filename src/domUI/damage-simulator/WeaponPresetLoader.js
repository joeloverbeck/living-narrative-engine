/**
 * @file WeaponPresetLoader - Loads damage capability presets from weapon entities
 * @see DamageCapabilityComposer.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/** @typedef {import('../../interfaces/ISafeEventDispatcher.js').default} ISafeEventDispatcher */
/** @typedef {import('../../interfaces/ILogger.js').default} ILogger */
/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */

/**
 * @typedef {object} WeaponPreset
 * @property {string} id - Weapon definition ID
 * @property {string} name - Display name
 * @property {string} damageType - Primary damage type
 * @property {Array<object>} entries - All damage entries
 */

/**
 * Event types emitted by the preset loader
 *
 * @type {Readonly<Record<string, string>>}
 */
const PRESET_EVENTS = Object.freeze({
  PRESET_LOADED: 'damage-simulator:preset-loaded',
  PRESET_LOAD_ERROR: 'damage-simulator:preset-load-error',
});

/**
 * Loads damage capability presets from weapon entities in the mod system.
 * Filters to actual weapons (entities with both damage_capabilities and weapons:weapon components).
 */
class WeaponPresetLoader {
  /** @type {IDataRegistry} */
  #dataRegistry;

  /** @type {ISafeEventDispatcher} */
  #eventBus;

  /** @type {ILogger} */
  #logger;

  /** @type {WeaponPreset[]|null} */
  #cachedPresets = null;

  /**
   * @param {object} dependencies
   * @param {IDataRegistry} dependencies.dataRegistry - Registry for entity definitions
   * @param {ISafeEventDispatcher} dependencies.eventBus - Event dispatcher
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ dataRegistry, eventBus, logger }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['getAllEntityDefinitions'],
    });
    validateDependency(eventBus, 'ISafeEventDispatcher', logger, {
      requiredMethods: ['dispatch'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#dataRegistry = dataRegistry;
    this.#eventBus = eventBus;
    this.#logger = logger;
  }

  /**
   * Get all available weapon presets from the registry.
   * Filters to entities with BOTH damage_capabilities AND weapons:weapon components.
   *
   * @returns {WeaponPreset[]} Array of available weapon presets
   */
  getAvailablePresets() {
    if (this.#cachedPresets !== null) {
      this.#logger.debug(
        '[WeaponPresetLoader] Returning cached presets',
        this.#cachedPresets.length
      );
      return this.#cachedPresets;
    }

    this.#logger.debug('[WeaponPresetLoader] Scanning registry for weapons');

    try {
      const definitions = this.#dataRegistry.getAllEntityDefinitions();

      if (!definitions || definitions.length === 0) {
        this.#logger.debug(
          '[WeaponPresetLoader] No entity definitions found in registry'
        );
        this.#cachedPresets = [];
        return this.#cachedPresets;
      }

      const weaponPresets = definitions
        .filter((def) => this.#isWeaponWithCapabilities(def))
        .map((def) => this.#extractPreset(def))
        .filter((preset) => preset !== null);

      this.#cachedPresets = weaponPresets;
      this.#logger.debug(
        '[WeaponPresetLoader] Found weapons with damage capabilities',
        weaponPresets.length
      );

      return this.#cachedPresets;
    } catch (error) {
      this.#logger.error(
        '[WeaponPresetLoader] Error scanning registry for weapons',
        error
      );
      return [];
    }
  }

  /**
   * Load damage entry from a weapon preset.
   * Returns the first damage entry from the weapon.
   *
   * @param {string} weaponDefId - Weapon definition ID
   * @returns {object | null} First damage capability entry, or null if not found
   */
  loadPreset(weaponDefId) {
    this.#logger.debug('[WeaponPresetLoader] Loading preset', weaponDefId);

    try {
      const presets = this.getAvailablePresets();
      const preset = presets.find((p) => p.id === weaponDefId);

      if (!preset) {
        this.#logger.warn(
          '[WeaponPresetLoader] Preset not found for weapon',
          weaponDefId
        );
        this.#eventBus.dispatch(PRESET_EVENTS.PRESET_LOAD_ERROR, {
          weaponDefId,
          error: `Preset not found for weapon: ${weaponDefId}`,
        });
        return null;
      }

      if (!preset.entries || preset.entries.length === 0) {
        this.#logger.warn(
          '[WeaponPresetLoader] Weapon has no damage entries',
          weaponDefId
        );
        this.#eventBus.dispatch(PRESET_EVENTS.PRESET_LOAD_ERROR, {
          weaponDefId,
          error: `Weapon has no damage entries: ${weaponDefId}`,
        });
        return null;
      }

      const damageEntry = preset.entries[0];
      this.#logger.info(
        '[WeaponPresetLoader] Loaded preset successfully',
        weaponDefId,
        damageEntry.name
      );

      this.#eventBus.dispatch(PRESET_EVENTS.PRESET_LOADED, {
        weaponDefId,
        weaponName: preset.name,
        damageEntry,
      });

      return damageEntry;
    } catch (error) {
      this.#logger.error(
        '[WeaponPresetLoader] Error loading preset',
        weaponDefId,
        error
      );
      this.#eventBus.dispatch(PRESET_EVENTS.PRESET_LOAD_ERROR, {
        weaponDefId,
        error: error.message,
      });
      return null;
    }
  }

  /**
   * Populate a select element with available presets.
   *
   * @param {HTMLSelectElement} selectElement - Select element to populate
   */
  populateSelector(selectElement) {
    if (!selectElement || !(selectElement instanceof HTMLSelectElement)) {
      this.#logger.warn(
        '[WeaponPresetLoader] Invalid select element provided'
      );
      return;
    }

    this.#logger.debug('[WeaponPresetLoader] Populating selector');

    // Clear existing options except placeholder
    while (selectElement.options.length > 0) {
      selectElement.remove(0);
    }

    // Add placeholder option
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '-- Select a weapon preset --';
    placeholder.disabled = true;
    placeholder.selected = true;
    selectElement.add(placeholder);

    const presets = this.getAvailablePresets();

    if (presets.length === 0) {
      const emptyOption = document.createElement('option');
      emptyOption.value = '';
      emptyOption.textContent = '(No weapons available)';
      emptyOption.disabled = true;
      selectElement.add(emptyOption);
      return;
    }

    // Sort presets alphabetically by name
    const sortedPresets = [...presets].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    for (const preset of sortedPresets) {
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = this.#formatPresetOption(preset);
      selectElement.add(option);
    }

    this.#logger.debug(
      '[WeaponPresetLoader] Selector populated with presets',
      sortedPresets.length
    );
  }

  /**
   * Clear the cached presets to force a refresh on next access.
   */
  clearCache() {
    this.#cachedPresets = null;
    this.#logger.debug('[WeaponPresetLoader] Cache cleared');
  }

  /**
   * Check if an entity definition is a weapon with damage capabilities.
   * Requires BOTH damage-types:damage_capabilities AND weapons:weapon components.
   *
   * @param {object} definition - Entity definition
   * @returns {boolean} True if entity is a weapon with damage capabilities
   * @private
   */
  #isWeaponWithCapabilities(definition) {
    if (!definition || !definition.components) {
      return false;
    }

    const hasDamageCapabilities = Boolean(
      definition.components['damage-types:damage_capabilities']
    );
    const isWeapon = Boolean(definition.components['weapons:weapon']);

    return hasDamageCapabilities && isWeapon;
  }

  /**
   * Extract preset data from a weapon entity definition.
   *
   * @param {object} definition - Entity definition
   * @returns {WeaponPreset|null} Extracted preset or null if invalid
   * @private
   */
  #extractPreset(definition) {
    try {
      const capabilities =
        definition.components['damage-types:damage_capabilities'];
      const entries = capabilities?.entries || [];

      if (entries.length === 0) {
        this.#logger.debug(
          '[WeaponPresetLoader] Weapon has empty entries array',
          definition.id
        );
        return null;
      }

      const name = definition.components?.['core:name']?.text || definition.id;
      const primaryType = entries[0]?.name || 'unknown';

      return {
        id: definition.id,
        name,
        damageType: primaryType,
        entries,
      };
    } catch (error) {
      this.#logger.warn(
        '[WeaponPresetLoader] Error extracting preset from definition',
        definition?.id,
        error
      );
      return null;
    }
  }

  /**
   * Format a preset for display in the dropdown.
   *
   * @param {WeaponPreset} preset - Preset to format
   * @returns {string} Formatted display string
   * @private
   */
  #formatPresetOption(preset) {
    return `${preset.name} (${preset.damageType})`;
  }
}

export default WeaponPresetLoader;
export { PRESET_EVENTS };
