/**
 * @file Detects and reports mod conflicts
 * @see src/modding/modDependencyValidator.js
 */

/**
 * @typedef {Object} ConflictInfo
 * @property {string} modA - First conflicting mod ID
 * @property {string} modB - Second conflicting mod ID
 * @property {'declared'|'version'|'resource'} type - Type of conflict
 * @property {string} reason - Human-readable explanation
 */

/**
 * @typedef {Object} ConflictReport
 * @property {boolean} hasConflicts
 * @property {ConflictInfo[]} conflicts
 * @property {Map<string, string[]>} modConflicts - Map of modId to conflicting mod IDs
 */

/**
 * @typedef {Object} ConflictDetectorOptions
 * @property {Object} logger
 */

/**
 * Detects conflicts between mods
 */
export class ConflictDetector {
  #logger;

  /**
   * @param {ConflictDetectorOptions} options
   */
  constructor({ logger }) {
    if (!logger) {
      throw new Error('ConflictDetector: logger is required');
    }
    this.#logger = logger;
  }

  /**
   * Detect all conflicts among a set of mods
   * @param {import('../services/ModDiscoveryService.js').ModMetadata[]} mods - All available mods
   * @param {string[]} activeMods - Currently active mod IDs
   * @returns {ConflictReport}
   */
  detectConflicts(mods, activeMods) {
    const conflicts = [];
    const modConflicts = new Map();

    // Build mod lookup
    const modMap = new Map(mods.map((m) => [m.id, m]));

    // Check declared conflicts
    for (const modId of activeMods) {
      const mod = modMap.get(modId);
      if (!mod) continue;

      // Check declared conflicts from manifest
      const declaredConflicts = mod.conflicts || [];
      for (const conflictId of declaredConflicts) {
        if (activeMods.includes(conflictId)) {
          const conflict = {
            modA: modId,
            modB: conflictId,
            type: 'declared',
            reason: `"${mod.name}" declares incompatibility with "${modMap.get(conflictId)?.name || conflictId}"`,
          };
          conflicts.push(conflict);
          this.#addToModConflicts(modConflicts, modId, conflictId);
          this.#addToModConflicts(modConflicts, conflictId, modId);
        }
      }

      // Check version conflicts (if mod specifies incompatible versions)
      const versionConflicts = this.#checkVersionConflicts(mod, modMap, activeMods);
      for (const vc of versionConflicts) {
        conflicts.push(vc);
        this.#addToModConflicts(modConflicts, vc.modA, vc.modB);
        this.#addToModConflicts(modConflicts, vc.modB, vc.modA);
      }
    }

    // Remove duplicate conflicts (A-B and B-A)
    const uniqueConflicts = this.#deduplicateConflicts(conflicts);

    if (uniqueConflicts.length > 0) {
      this.#logger.warn(`Detected ${uniqueConflicts.length} mod conflicts`, {
        conflicts: uniqueConflicts.map((c) => `${c.modA} <-> ${c.modB}`),
      });
    }

    return {
      hasConflicts: uniqueConflicts.length > 0,
      conflicts: uniqueConflicts,
      modConflicts,
    };
  }

  /**
   * Check if activating a mod would cause conflicts
   * @param {string} modId - Mod to check
   * @param {import('../services/ModDiscoveryService.js').ModMetadata[]} mods - All mods
   * @param {string[]} currentActiveMods - Current active mods
   * @returns {ConflictInfo[]}
   */
  checkActivationConflicts(modId, mods, currentActiveMods) {
    const potentialActive = [...currentActiveMods, modId];
    const report = this.detectConflicts(mods, potentialActive);

    // Return only conflicts involving the new mod
    return report.conflicts.filter((c) => c.modA === modId || c.modB === modId);
  }

  /**
   * Get all mods that conflict with a specific mod
   * @param {string} modId
   * @param {import('../services/ModDiscoveryService.js').ModMetadata[]} mods
   * @param {string[]} activeMods
   * @returns {string[]}
   */
  getConflictingMods(modId, mods, activeMods) {
    const report = this.detectConflicts(mods, activeMods);
    return report.modConflicts.get(modId) || [];
  }

  /**
   * Get a warning message for activation conflicts
   * @param {ConflictInfo[]} conflicts
   * @returns {string|null}
   */
  getConflictWarning(conflicts) {
    if (conflicts.length === 0) return null;

    if (conflicts.length === 1) {
      return conflicts[0].reason;
    }

    const firstModId = conflicts[0].modA;
    const conflictingModIds = conflicts.map((c) =>
      c.modA === firstModId ? c.modB : c.modA
    );
    return `This mod conflicts with ${conflicts.length} active mods: ${conflictingModIds.join(', ')}`;
  }

  /**
   * Check version-based conflicts
   * @param {import('../services/ModDiscoveryService.js').ModMetadata} mod
   * @param {Map<string, import('../services/ModDiscoveryService.js').ModMetadata>} modMap
   * @param {string[]} activeMods
   * @returns {ConflictInfo[]}
   */
  #checkVersionConflicts(mod, modMap, activeMods) {
    const conflicts = [];
    const versionIncompatibilities = mod.incompatibleVersions || {};

    for (const [targetModId, incompatibleVersions] of Object.entries(versionIncompatibilities)) {
      if (!activeMods.includes(targetModId)) continue;

      const targetMod = modMap.get(targetModId);
      if (!targetMod) continue;

      // Check if target mod version is in incompatible list
      if (this.#isVersionIncompatible(targetMod.version, incompatibleVersions)) {
        conflicts.push({
          modA: mod.id,
          modB: targetModId,
          type: 'version',
          reason: `"${mod.name}" is incompatible with "${targetMod.name}" version ${targetMod.version}`,
        });
      }
    }

    return conflicts;
  }

  /**
   * Check if a version matches incompatibility patterns
   * @param {string} version
   * @param {string[]} patterns - Version patterns (e.g., "1.x", ">=2.0")
   * @returns {boolean}
   */
  #isVersionIncompatible(version, patterns) {
    for (const pattern of patterns) {
      // Exact match (using compareVersions for normalized comparison)
      // This handles cases like "2.0" matching "2.0.0"
      if (
        !pattern.endsWith('.x') &&
        !pattern.startsWith('>=') &&
        !pattern.startsWith('<=')
      ) {
        if (this.#compareVersions(version, pattern) === 0) return true;
      }

      // Wildcard match (e.g., "1.x" matches "1.0", "1.5")
      if (pattern.endsWith('.x')) {
        const prefix = pattern.slice(0, -1);
        if (version.startsWith(prefix)) return true;
      }

      // Range match (e.g., ">=2.0")
      if (pattern.startsWith('>=')) {
        const minVersion = pattern.slice(2);
        if (this.#compareVersions(version, minVersion) >= 0) return true;
      }

      if (pattern.startsWith('<=')) {
        const maxVersion = pattern.slice(2);
        if (this.#compareVersions(version, maxVersion) <= 0) return true;
      }
    }

    return false;
  }

  /**
   * Simple version comparison
   * @param {string} a
   * @param {string} b
   * @returns {number} -1 if a < b, 0 if equal, 1 if a > b
   */
  #compareVersions(a, b) {
    const partsA = a.split('.').map(Number);
    const partsB = b.split('.').map(Number);
    const maxLen = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < maxLen; i++) {
      const partA = partsA[i] || 0;
      const partB = partsB[i] || 0;
      if (partA < partB) return -1;
      if (partA > partB) return 1;
    }

    return 0;
  }

  /**
   * Add a conflict to the modConflicts map
   * @param {Map<string, string[]>} map
   * @param {string} modId
   * @param {string} conflictId
   */
  #addToModConflicts(map, modId, conflictId) {
    if (!map.has(modId)) {
      map.set(modId, []);
    }
    const conflicts = map.get(modId);
    if (!conflicts.includes(conflictId)) {
      conflicts.push(conflictId);
    }
  }

  /**
   * Remove duplicate conflicts (A-B and B-A are the same)
   * @param {ConflictInfo[]} conflicts
   * @returns {ConflictInfo[]}
   */
  #deduplicateConflicts(conflicts) {
    const seen = new Set();
    const unique = [];

    for (const conflict of conflicts) {
      const key = [conflict.modA, conflict.modB].sort().join('|');
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(conflict);
      }
    }

    return unique;
  }
}

export default ConflictDetector;
