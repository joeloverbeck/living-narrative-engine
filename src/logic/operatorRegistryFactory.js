// src/logic/operatorRegistryFactory.js

/**
 * @file Factory for creating and organizing JSON Logic custom operators.
 * Groups operators by their dependency requirements for efficient instantiation.
 */

import { HasPartWithComponentValueOperator } from './operators/hasPartWithComponentValueOperator.js';
import { HasPartOfTypeOperator } from './operators/hasPartOfTypeOperator.js';
import { HasPartOfTypeWithComponentValueOperator } from './operators/hasPartOfTypeWithComponentValueOperator.js';
import { HasPartWithStatusEffectOperator } from './operators/hasPartWithStatusEffectOperator.js';
import { HasWoundedPartOperator } from './operators/hasWoundedPartOperator.js';
import { IsBodyPartWoundedOperator } from './operators/isBodyPartWoundedOperator.js';
import { IsSlotExposedOperator } from './operators/isSlotExposedOperator.js';
import { IsSocketCoveredOperator } from './operators/isSocketCoveredOperator.js';
import { SocketExposureOperator } from './operators/socketExposureOperator.js';
import { IsBodyPartAccessibleOperator } from './operators/isBodyPartAccessibleOperator.js';
import { HasSittingSpaceToRightOperator } from './operators/hasSittingSpaceToRightOperator.js';
import { CanScootCloserOperator } from './operators/canScootCloserOperator.js';
import { IsClosestLeftOccupantOperator } from './operators/isClosestLeftOccupantOperator.js';
import { IsClosestRightOccupantOperator } from './operators/isClosestRightOccupantOperator.js';
import { IsNearbyFurnitureOperator } from './operators/isNearbyFurnitureOperator.js';
import { HasOtherActorsAtLocationOperator } from './operators/hasOtherActorsAtLocationOperator.js';
import { IsRemovalBlockedOperator } from './operators/isRemovalBlockedOperator.js';
import { HasComponentOperator } from './operators/hasComponentOperator.js';
import { HasFreeGrabbingAppendagesOperator } from './operators/hasFreeGrabbingAppendagesOperator.js';
import { CanActorGrabItemOperator } from './operators/canActorGrabItemOperator.js';
import { IsItemBeingGrabbedOperator } from './operators/isItemBeingGrabbedOperator.js';
import { GetSkillValueOperator } from './operators/getSkillValueOperator.js';
import { HasDamageCapabilityOperator } from './operators/hasDamageCapabilityOperator.js';
import { HasPartSubTypeContainingOperator } from './operators/hasPartSubTypeContainingOperator.js';
import { IsActorLocationLitOperator } from './operators/isActorLocationLitOperator.js';
import { LocationHasExitsOperator } from './operators/locationHasExitsOperator.js';
import { hasValidEntityId } from './utils/entityPathResolver.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../anatomy/bodyGraphService.js').BodyGraphService} BodyGraphService */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../locations/services/lightingStateService.js').LightingStateService} LightingStateService */

/**
 * @typedef {Object} OperatorDependencies
 * @property {IEntityManager} entityManager
 * @property {ILogger} logger
 * @property {BodyGraphService} [bodyGraphService]
 * @property {LightingStateService} [lightingStateService]
 */

/**
 * @typedef {Object} OperatorInstances
 * @property {Map<string, Object>} operators - Map of operator name to instance
 * @property {IsSocketCoveredOperator} isSocketCoveredOp - Socket covered operator (for external access)
 * @property {SocketExposureOperator} socketExposureOp - Socket exposure operator (for external access)
 * @property {Array<Object>} operatorsWithCaches - Operators that have caches to clear
 */

/**
 * Factory for creating JSON Logic custom operators.
 * Organizes operator creation by dependency groups for maintainability.
 */
export class OperatorRegistryFactory {
  #dependencies;

  /**
   * @param {OperatorDependencies} dependencies
   */
  constructor(dependencies) {
    if (!dependencies.entityManager) {
      throw new Error('OperatorRegistryFactory requires entityManager');
    }
    if (!dependencies.logger) {
      throw new Error('OperatorRegistryFactory requires logger');
    }
    this.#dependencies = dependencies;
  }

  /**
   * Creates all operator instances.
   * @returns {OperatorInstances}
   */
  createOperators() {
    const operators = new Map();
    const operatorsWithCaches = [];

    const baseDeps = {
      entityManager: this.#dependencies.entityManager,
      logger: this.#dependencies.logger,
    };

    const bodyDeps = {
      ...baseDeps,
      bodyGraphService: this.#dependencies.bodyGraphService,
    };

    // Body part operators (require bodyGraphService)
    this.#createBodyOperators(operators, bodyDeps);

    // Equipment/slot operators (entityManager + logger only)
    const { isSocketCoveredOp, socketExposureOp } = this.#createEquipmentOperators(
      operators,
      baseDeps,
      operatorsWithCaches
    );

    // Accessibility operator (requires slot/socket operators)
    this.#createAccessibilityOperator(operators, bodyDeps, {
      isSlotExposedOp: operators.get('isSlotExposed'),
      socketExposureOp,
    });

    // Furniture operators
    this.#createFurnitureOperators(operators, baseDeps);

    // Component operators
    this.#createComponentOperators(operators, baseDeps);

    // Grabbing operators
    this.#createGrabbingOperators(operators, baseDeps);

    // Skill operator
    operators.set('getSkillValue', new GetSkillValueOperator(baseDeps));

    // Damage operator
    operators.set('has_damage_capability', new HasDamageCapabilityOperator(baseDeps));

    // Lighting operator (requires lightingStateService)
    this.#createLightingOperators(operators, {
      ...baseDeps,
      lightingStateService: this.#dependencies.lightingStateService,
    });

    // Inline function operator: get_component_value
    operators.set('get_component_value', this.#createGetComponentValueFunction());

    return {
      operators,
      isSocketCoveredOp,
      socketExposureOp,
      operatorsWithCaches,
    };
  }

  /**
   * Creates body part related operators.
   * @private
   */
  #createBodyOperators(operators, deps) {
    operators.set('hasPartWithComponentValue', new HasPartWithComponentValueOperator(deps));
    operators.set('hasPartOfType', new HasPartOfTypeOperator(deps));
    operators.set('hasPartOfTypeWithComponentValue', new HasPartOfTypeWithComponentValueOperator(deps));
    operators.set('hasPartWithStatusEffect', new HasPartWithStatusEffectOperator(deps));
    operators.set('hasWoundedPart', new HasWoundedPartOperator(deps));
    operators.set('isBodyPartWounded', new IsBodyPartWoundedOperator(deps));
    operators.set('hasPartSubTypeContaining', new HasPartSubTypeContainingOperator(deps));
  }

  /**
   * Creates equipment/slot related operators.
   * @private
   * @returns {{ isSocketCoveredOp: IsSocketCoveredOperator, socketExposureOp: SocketExposureOperator }}
   */
  #createEquipmentOperators(operators, deps, operatorsWithCaches) {
    operators.set('isSlotExposed', new IsSlotExposedOperator(deps));

    const isSocketCoveredOp = new IsSocketCoveredOperator(deps);
    operators.set('isSocketCovered', isSocketCoveredOp);
    operatorsWithCaches.push(isSocketCoveredOp);

    const socketExposureOp = new SocketExposureOperator({
      ...deps,
      isSocketCoveredOperator: isSocketCoveredOp,
    });
    operators.set('socketExposure', socketExposureOp);

    operators.set('isRemovalBlocked', new IsRemovalBlockedOperator(deps));

    return { isSocketCoveredOp, socketExposureOp };
  }

  /**
   * Creates accessibility operator (depends on slot/socket operators).
   * @private
   */
  #createAccessibilityOperator(operators, deps, { isSlotExposedOp, socketExposureOp }) {
    operators.set(
      'isBodyPartAccessible',
      new IsBodyPartAccessibleOperator({
        ...deps,
        isSlotExposedOperator: isSlotExposedOp,
        socketExposureOperator: socketExposureOp,
      })
    );
  }

  /**
   * Creates furniture related operators.
   * @private
   */
  #createFurnitureOperators(operators, deps) {
    operators.set('hasSittingSpaceToRight', new HasSittingSpaceToRightOperator(deps));
    operators.set('canScootCloser', new CanScootCloserOperator(deps));
    operators.set('isClosestLeftOccupant', new IsClosestLeftOccupantOperator(deps));
    operators.set('isClosestRightOccupant', new IsClosestRightOccupantOperator(deps));
    operators.set('isNearbyFurniture', new IsNearbyFurnitureOperator(deps));
    operators.set('hasOtherActorsAtLocation', new HasOtherActorsAtLocationOperator(deps));
  }

  /**
   * Creates component operators.
   * @private
   */
  #createComponentOperators(operators, deps) {
    operators.set('has_component', new HasComponentOperator(deps));
  }

  /**
   * Creates grabbing related operators.
   * @private
   */
  #createGrabbingOperators(operators, deps) {
    operators.set('hasFreeGrabbingAppendages', new HasFreeGrabbingAppendagesOperator(deps));
    operators.set('canActorGrabItem', new CanActorGrabItemOperator(deps));
    operators.set('isItemBeingGrabbed', new IsItemBeingGrabbedOperator(deps));
  }

  /**
   * Creates lighting related operators.
   * @private
   */
  #createLightingOperators(operators, deps) {
    operators.set('isActorLocationLit', new IsActorLocationLitOperator(deps));
    operators.set('locationHasExits', new LocationHasExitsOperator({
      entityManager: deps.entityManager,
      logger: deps.logger,
    }));
  }

  /**
   * Creates the get_component_value inline function operator.
   * This is a special case - not a class-based operator.
   * @private
   * @returns {Function}
   */
  #createGetComponentValueFunction() {
    const entityManager = this.#dependencies.entityManager;

    return (entityRef, componentId, propertyPath = null) => {
      let entityId = null;

      if (hasValidEntityId(entityRef)) {
        entityId = entityRef.id;
      } else if (typeof entityRef === 'string' || typeof entityRef === 'number') {
        entityId = entityRef;
      }

      if (entityId === null || entityId === undefined) {
        return null;
      }

      const componentData = entityManager.getComponentData(entityId, componentId);

      if (!componentData || typeof componentData !== 'object') {
        return null;
      }

      if (!propertyPath || typeof propertyPath !== 'string') {
        return componentData;
      }

      return propertyPath
        .split('.')
        .reduce(
          (value, key) =>
            value && Object.prototype.hasOwnProperty.call(value, key) ? value[key] : null,
          componentData
        );
    };
  }

  /**
   * Gets the list of all operator names that the factory creates.
   * @returns {string[]}
   */
  static getOperatorNames() {
    return [
      // Body operators (7)
      'hasPartWithComponentValue',
      'hasPartOfType',
      'hasPartOfTypeWithComponentValue',
      'hasPartWithStatusEffect',
      'hasWoundedPart',
      'isBodyPartWounded',
      'hasPartSubTypeContaining',
      // Equipment operators (4)
      'isSlotExposed',
      'isSocketCovered',
      'socketExposure',
      'isRemovalBlocked',
      // Accessibility (1)
      'isBodyPartAccessible',
      // Furniture operators (6)
      'hasSittingSpaceToRight',
      'canScootCloser',
      'isClosestLeftOccupant',
      'isClosestRightOccupant',
      'isNearbyFurniture',
      'hasOtherActorsAtLocation',
      // Component operators (2)
      'has_component',
      'get_component_value',
      // Grabbing operators (3)
      'hasFreeGrabbingAppendages',
      'canActorGrabItem',
      'isItemBeingGrabbed',
      // Skill operator (1)
      'getSkillValue',
      // Damage operator (1)
      'has_damage_capability',
      // Lighting operators (2)
      'isActorLocationLit',
      'locationHasExits',
    ];
  }
}

export default OperatorRegistryFactory;
