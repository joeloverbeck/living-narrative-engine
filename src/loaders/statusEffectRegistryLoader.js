/**
 * @file Loader for status-effect registry definitions.
 */

import { SimpleItemLoader } from './simpleItemLoader.js';

/**
 * Loader responsible for status-effect registry files. These files provide
 * data-driven defaults for bleeding/burning/poison/fracture/dismember effects.
 */
class StatusEffectRegistryLoader extends SimpleItemLoader {
  constructor(
    config,
    pathResolver,
    dataFetcher,
    schemaValidator,
    dataRegistry,
    logger
  ) {
    super(
      'statusEffects',
      config,
      pathResolver,
      dataFetcher,
      schemaValidator,
      dataRegistry,
      logger
    );
  }
}

export default StatusEffectRegistryLoader;
