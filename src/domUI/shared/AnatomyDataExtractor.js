/**
 * @file AnatomyDataExtractor.js
 * @description Service for extracting hierarchical anatomy data structures.
 * Provides tree-based traversal of anatomy:body component data.
 * Reusable across visualizers (anatomy-visualizer, damage-simulator, etc.)
 * @see VisualizationComposer.js - Reference implementation for traversal patterns
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {object} AnatomyTreeNode
 * @property {string} id - The part entity ID
 * @property {string} name - Human-readable part name from core:name
 * @property {{[key: string]: object}} components - Mechanical components (excludes descriptors)
 * @property {{current: number, max: number}|null} health - Health data from anatomy:part_health
 * @property {AnatomyTreeNode[]} children - Child nodes in the hierarchy
 */

/**
 * Service for extracting hierarchical anatomy data from anatomy:body components.
 * Builds tree structures suitable for card-based UI and damage simulation.
 */
class AnatomyDataExtractor {
  /** @type {import('../../interfaces/coreServices.js').IEntityManager} */
  #entityManager;

  /** @type {import('../../interfaces/ILogger.js').ILogger} */
  #logger;

  /**
   * Creates a new AnatomyDataExtractor instance.
   *
   * @param {object} dependencies - The service dependencies
   * @param {import('../../interfaces/coreServices.js').IEntityManager} dependencies.entityManager - Entity manager for retrieving instances
   * @param {import('../../interfaces/ILogger.js').ILogger} dependencies.logger - Logger instance
   */
  constructor({ entityManager, logger }) {
    validateDependency(entityManager, 'IEntityManager', console, {
      requiredMethods: ['getEntityInstance'],
    });
    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    this.#entityManager = entityManager;
    this.#logger = logger;
  }

  /**
   * Extract hierarchical part data from anatomy:body component.
   * Uses BFS traversal with cycle detection to build a tree structure.
   *
   * @param {object} bodyData - The anatomy:body component data
   * @param {string} bodyData.root - Root part entity ID
   * @param {{[key: string]: string}} [bodyData.parts] - Named parts mapping
   * @returns {Promise<AnatomyTreeNode|null>} Tree structure or null if extraction fails
   */
  async extractHierarchy(bodyData) {
    if (!bodyData?.root) {
      this.#logger.warn('AnatomyDataExtractor: bodyData.root is required');
      return null;
    }

    this.#logger.debug('AnatomyDataExtractor: Extracting hierarchy', {
      root: bodyData.root,
      partsCount: Object.keys(bodyData.parts || {}).length,
    });

    // Collect all part IDs
    const allPartIds = new Set();
    if (bodyData.parts) {
      Object.values(bodyData.parts).forEach((partId) => allPartIds.add(partId));
    }
    allPartIds.add(bodyData.root);

    // Build parent-child index for O(1) lookup
    const parentChildIndex = await this.#buildParentChildIndex(allPartIds);

    // Track visited nodes to prevent cycles
    const visited = new Set();

    // Build tree recursively from root
    const rootNode = await this.#buildNode(
      bodyData.root,
      visited,
      parentChildIndex
    );

    this.#logger.debug('AnatomyDataExtractor: Extraction complete', {
      visitedCount: visited.size,
      rootNodeExists: !!rootNode,
    });

    return rootNode;
  }

  /**
   * Get children of a part via anatomy:joint relationships.
   * Uses pre-built parent-child index if provided, otherwise scans bodyData.parts.
   *
   * @param {string} partId - The parent part ID
   * @param {object} bodyData - The anatomy:body component data
   * @returns {Promise<string[]>} Child part IDs
   */
  async getChildren(partId, bodyData) {
    if (!partId || !bodyData) {
      return [];
    }

    // Collect all part IDs from bodyData
    const allPartIds = new Set();
    if (bodyData.parts) {
      Object.values(bodyData.parts).forEach((id) => allPartIds.add(id));
    }
    if (bodyData.root) {
      allPartIds.add(bodyData.root);
    }

    const children = [];

    for (const candidateId of allPartIds) {
      try {
        const entity = await this.#entityManager.getEntityInstance(candidateId);
        // eslint-disable-next-line mod-architecture/no-hardcoded-mod-references -- Service explicitly works with anatomy mod components
        const joint = entity?.getComponentData('anatomy:joint');
        if (joint?.parentId === partId) {
          children.push(candidateId);
        }
      } catch (error) {
        this.#logger.warn(
          `AnatomyDataExtractor: Failed to check child ${candidateId}:`,
          error
        );
      }
    }

    return children;
  }

  /**
   * Filter to mechanical components only.
   * Excludes descriptors:*, core:name, and core:description.
   *
   * @param {{[key: string]: object}} components - All components from an entity
   * @returns {{[key: string]: object}} Filtered components
   */
  filterMechanicalComponents(components) {
    if (!components || typeof components !== 'object') {
      return {};
    }

    const filtered = {};

    for (const [componentId, componentData] of Object.entries(components)) {
      // Skip descriptor components
      if (componentId.startsWith('descriptors:')) {
        continue;
      }
      // Skip core:name (extracted separately as 'name')
      if (componentId === 'core:name') {
        continue;
      }
      // Skip core:description
      if (componentId === 'core:description') {
        continue;
      }
      filtered[componentId] = componentData;
    }

    return filtered;
  }

  /**
   * Build parent-child index from anatomy:joint components.
   * This is an O(n) operation that enables O(1) child lookups during traversal.
   *
   * @private
   * @param {Set<string>} allPartIds - All part IDs to index
   * @returns {Promise<Map<string, string[]>>} Map of parent ID to child IDs
   */
  async #buildParentChildIndex(allPartIds) {
    /** @type {Map<string, string[]>} */
    const parentToChildren = new Map();

    for (const partId of allPartIds) {
      try {
        const entity = await this.#entityManager.getEntityInstance(partId);
        // eslint-disable-next-line mod-architecture/no-hardcoded-mod-references -- Service explicitly works with anatomy mod components
        const joint = entity?.getComponentData('anatomy:joint');
        if (joint?.parentId) {
          const children = parentToChildren.get(joint.parentId) || [];
          children.push(partId);
          parentToChildren.set(joint.parentId, children);
        }
      } catch (error) {
        this.#logger.warn(
          `AnatomyDataExtractor: Failed to index entity ${partId}:`,
          error
        );
      }
    }

    this.#logger.debug(
      `AnatomyDataExtractor: Built parent-child index with ${parentToChildren.size} parent entries`
    );

    return parentToChildren;
  }

  /**
   * Build a tree node for a part entity, recursively building children.
   *
   * @private
   * @param {string} partId - The part entity ID
   * @param {Set<string>} visited - Set of already-visited part IDs
   * @param {Map<string, string[]>} parentChildIndex - Pre-built parent-child index
   * @returns {Promise<AnatomyTreeNode|null>} The tree node or null if visited/missing
   */
  async #buildNode(partId, visited, parentChildIndex) {
    // Cycle detection - return null for already-visited parts
    if (visited.has(partId)) {
      this.#logger.debug(
        `AnatomyDataExtractor: Skipping visited part ${partId}`
      );
      return null;
    }
    visited.add(partId);

    try {
      const entity = await this.#entityManager.getEntityInstance(partId);
      if (!entity) {
        this.#logger.warn(`AnatomyDataExtractor: Entity not found: ${partId}`);
        return null;
      }

      // Extract name from core:name component
      const nameComponent = entity.getComponentData('core:name');
      const name = nameComponent?.text || partId;

      // Extract health from anatomy:part_health component
      // eslint-disable-next-line mod-architecture/no-hardcoded-mod-references -- Service explicitly works with anatomy mod components
      const healthComponent = entity.getComponentData('anatomy:part_health');
      const health = healthComponent
        ? { current: healthComponent.current, max: healthComponent.max }
        : null;

      // Get all components and filter to mechanical only
      const allComponents = entity.getAllComponents();
      const components = this.filterMechanicalComponents(allComponents);

      // Build children recursively
      const childIds = parentChildIndex.get(partId) || [];
      const children = [];

      for (const childId of childIds) {
        const childNode = await this.#buildNode(
          childId,
          visited,
          parentChildIndex
        );
        if (childNode) {
          children.push(childNode);
        }
      }

      return {
        id: partId,
        name,
        components,
        health,
        children,
      };
    } catch (error) {
      this.#logger.error(
        `AnatomyDataExtractor: Error building node for ${partId}:`,
        error
      );
      return null;
    }
  }
}

export default AnatomyDataExtractor;
