// src/loaders/baseInlineSchemaLoader.js

/**
 * @file Provides BaseInlineSchemaLoader, extending BaseManifestItemLoader
 * with helper for registering inline schemas defined within item data.
 */

import { BaseManifestItemLoader } from './baseManifestItemLoader.js';
import { registerInlineSchema } from '../utils/schemaUtils.js';

/**
 * Extends {@link BaseManifestItemLoader} adding a convenience method for
 * registering inline schemas found on loaded items.
 *
 * @class BaseInlineSchemaLoader
 * @augments BaseManifestItemLoader
 */
export class BaseInlineSchemaLoader extends BaseManifestItemLoader {
  /**
   * Registers an inline schema extracted from `data[propName]` using
   * {@link registerInlineSchema}.
   *
   * @protected
   * @param {object} data - The item data containing the schema.
   * @param {string} propName - Property name on `data` holding the schema object.
   * @param {string} schemaId - ID to associate with the schema in the validator.
   * @param {object} [messages] - Optional logging message overrides.
   * @returns {Promise<void>} Resolves when registration completes.
   */
  async _registerItemSchema(data, propName, schemaId, messages = {}) {
    const schema = data?.[propName];
    await registerInlineSchema(
      this._schemaValidator,
      schema,
      schemaId,
      this._logger,
      messages
    );
  }
}

export default BaseInlineSchemaLoader;
