/** @typedef {import('../interfaces/coreServices.js').IConfiguration} IConfiguration */

import { IPathResolver } from '../interfaces/iPathResolver.js';

/**
 * Default implementation of IPathResolver.
 * Resolves paths by combining base paths from IConfiguration with specific filenames.
 * Uses standard URL/path joining logic (adjust if running in Node.js vs Browser).
 *
 * @implements {IPathResolver}
 */
class DefaultPathResolver extends IPathResolver {
  #config;

  /**
   * @param {IConfiguration} configuration
   */
  constructor(configuration) {
    super();

    const serviceName = 'DefaultPathResolver';
    const configInterface = 'IConfiguration';

    if (!configuration) {
      throw new Error(
        `${serviceName} requires an ${configInterface} instance.`
      );
    }

    const requiredMethods = [
      'getBaseDataPath',
      'getSchemaBasePath',
      'getContentBasePath',
      'getGameConfigFilename',
      'getModsBasePath',
      'getModManifestFilename',
    ];

    for (const m of requiredMethods) {
      if (typeof configuration[m] !== 'function') {
        throw new Error(
          `${serviceName} requires a valid ${configInterface} with method ${m}().`
        );
      }
    }

    this.#config = configuration;
  }

  /* ------------------------------------------------------------------ */
  /*  Internal helpers                                                  */

  /* ------------------------------------------------------------------ */

  /**
   * Very lightweight joiner that behaves identically in browser and Node.
   *
   * @private
   * @param {...string} segments
   * @returns {string}
   */
  #join(...segments) {
    const relevant = segments.filter(
      (s) => s !== null && s !== undefined && s !== ''
    );
    let path = relevant
      .map((seg, i) =>
        i < relevant.length - 1 ? String(seg).replace(/\/+$/, '') : String(seg)
      )
      .join('/');

    path = path.replace(/\/{2,}/g, '/'); // collapse doubles

    if (/^\.?\.?\//.test(relevant[0]) && !/^\.\.?\//.test(path)) {
      path = './' + path; // preserve leading './' if user supplied it
    } else if (relevant[0].startsWith('/') && !path.startsWith('/')) {
      path = '/' + path;
    }

    return path;
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                        */

  /* ------------------------------------------------------------------ */

  resolveSchemaPath(filename) {
    if (typeof filename !== 'string' || filename.trim() === '') {
      throw new Error(
        'Invalid or empty filename provided to resolveSchemaPath.'
      );
    }
    return this.#join(
      this.#config.getBaseDataPath(),
      this.#config.getSchemaBasePath(),
      filename
    );
  }

  resolveContentPath(registryKey, filename) {
    if (typeof registryKey !== 'string' || registryKey.trim() === '') {
      throw new Error(
        'Invalid or empty registryKey provided to resolveContentPath.'
      );
    }
    if (typeof filename !== 'string' || filename.trim() === '') {
      throw new Error(
        'Invalid or empty filename provided to resolveContentPath.'
      );
    }
    return this.#join(
      this.#config.getBaseDataPath(),
      this.#config.getContentBasePath(registryKey),
      filename
    );
  }

  resolveRulePath(filename) {
    if (typeof filename !== 'string' || filename.trim() === '') {
      throw new Error('Invalid or empty filename provided to resolveRulePath.');
    }
    if (typeof this.#config.getRuleBasePath !== 'function') {
      throw new Error(
        'Configuration service does not provide getRuleBasePath().'
      );
    }
    return this.#join(
      this.#config.getBaseDataPath(),
      this.#config.getRuleBasePath(),
      filename
    );
  }

  resolveGameConfigPath() {
    return this.#join(
      this.#config.getBaseDataPath(),
      this.#config.getGameConfigFilename()
    );
  }

  /**
   * **Implements Sub-Ticket 3.**
   *
   * @param {string} modId
   * @returns {string}
   */
  resolveModManifestPath(modId) {
    if (typeof modId !== 'string' || (modId = modId.trim()) === '') {
      throw new Error(
        'Invalid or empty modId provided to resolveModManifestPath.'
      );
    }
    return this.#join(
      this.#config.getBaseDataPath(),
      this.#config.getModsBasePath(),
      modId,
      this.#config.getModManifestFilename()
    );
  }

  resolveModContentPath(modId, registryKey, filename) {
    if (typeof modId !== 'string' || modId.trim() === '') {
      throw new Error(
        'Invalid or empty modId provided to resolveModContentPath.'
      );
    }
    if (typeof registryKey !== 'string' || registryKey.trim() === '') {
      throw new Error(
        'Invalid or empty registryKey provided to resolveModContentPath.'
      );
    }
    if (typeof filename !== 'string' || filename.trim() === '') {
      throw new Error(
        'Invalid or empty filename provided to resolveModContentPath.'
      );
    }
    return this.#join(
      this.#config.getBaseDataPath(),
      this.#config.getModsBasePath(),
      modId,
      registryKey,
      filename
    );
  }
}

export default DefaultPathResolver;
