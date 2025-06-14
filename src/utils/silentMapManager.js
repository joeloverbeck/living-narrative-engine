// src/utils/silentMapManager.js

import MapManager from './mapManager.js';

/**
 * @class SilentMapManager
 * @description MapManager variant that ignores invalid IDs
 * instead of throwing errors.
 */
class SilentMapManager extends MapManager {
  /** @override */
  onInvalidId() {
    // deliberately no-op
  }
}

export default SilentMapManager;
