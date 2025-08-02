/**
 * @file This module produces data about an entities.
 * @see src/data/providers/entitySummaryProvider.js
 */

import { IEntitySummaryProvider } from '../../interfaces/IEntitySummaryProvider.js';
import {
  NAME_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
  APPARENT_AGE_COMPONENT_ID,
} from '../../constants/componentIds.js';
import {
  DEFAULT_FALLBACK_DESCRIPTION_RAW,
  DEFAULT_COMPONENT_VALUE_NA,
} from '../../constants/textDefaults.js';
import { isNonBlankString } from '../../utils/textUtils.js';

/** @typedef {import('../../entities/entity.js').default} Entity */
/** @typedef {import('../../interfaces/IEntitySummaryProvider.js').EntitySummaryDTO} EntitySummaryDTO */

export class EntitySummaryProvider extends IEntitySummaryProvider {
  _getComponentText(
    entity,
    componentId,
    defaultValue = DEFAULT_COMPONENT_VALUE_NA,
    propertyPath = 'text'
  ) {
    if (!entity || typeof entity.getComponentData !== 'function') {
      return defaultValue;
    }
    const componentData = entity.getComponentData(componentId);
    const value = componentData?.[propertyPath];
    if (isNonBlankString(value)) {
      return value.trim();
    }
    return defaultValue;
  }

  /**
   * @override
   * @param {Entity} entity
   * @returns {EntitySummaryDTO}
   */
  getSummary(entity) {
    const name = this._getComponentText(
      entity,
      NAME_COMPONENT_ID,
      null // Return null if no name, so consumers can apply context-specific fallbacks.
    );
    const description = this._getComponentText(
      entity,
      DESCRIPTION_COMPONENT_ID,
      DEFAULT_FALLBACK_DESCRIPTION_RAW
    );

    // Extract apparent age if present
    const apparentAgeData = entity.getComponentData(APPARENT_AGE_COMPONENT_ID);

    return {
      id: entity.id,
      name,
      description,
      ...(apparentAgeData && { apparentAge: apparentAgeData }),
    };
  }
}
