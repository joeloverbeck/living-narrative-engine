/**
 * @file Socket extraction utilities for anatomy entities
 * @see ./socketSlotCompatibilityValidator.js
 */

/**
 * Extracts socket information from entity definition
 *
 * @param {object} entity - Entity definition
 * @returns {Map<string, object>} Map of socket ID to socket data
 */
export function extractSocketsFromEntity(entity) {
  const socketsMap = new Map();

  if (!entity || typeof entity !== 'object') {
    return socketsMap;
  }

  // Check for anatomy:sockets component
  const socketsComponent = entity.components?.['anatomy:sockets'];

  if (!socketsComponent) {
    return socketsMap; // No sockets component
  }

  // Extract socket list
  const socketList = socketsComponent.sockets || [];

  for (const socket of socketList) {
    if (socket.id) {
      socketsMap.set(socket.id, {
        id: socket.id,
        orientation: socket.orientation,
        allowedTypes: socket.allowedTypes || [],
        nameTpl: socket.nameTpl,
        index: socket.index,
      });
    }
  }

  return socketsMap;
}

/**
 * Extracts hierarchical socket map from blueprint, structure template, and entity definitions.
 * Supports the hierarchical socket architecture where:
 * - Root entity has direct sockets
 * - Structure template generates parts (limbs, head, tail) with their own sockets
 * - Blueprint additionalSlots can reference child part sockets via 'parent' property
 *
 * @param {object} blueprint - Blueprint definition
 * @param {object} rootEntity - Root entity definition
 * @param {object} structureTemplate - Structure template definition (optional)
 * @param {object} dataRegistry - Data registry for entity lookups
 * @returns {Promise<Map<string, object>>} Hierarchical socket map with parent context
 */
export async function extractHierarchicalSockets(
  blueprint,
  rootEntity,
  structureTemplate,
  dataRegistry
) {
  const hierarchicalSockets = new Map();

  // 1. Extract root entity sockets (direct attachments)
  const rootSockets = extractSocketsFromEntity(rootEntity);
  for (const [socketId, socketData] of rootSockets) {
    hierarchicalSockets.set(socketId, {
      ...socketData,
      source: 'root',
      entityId: rootEntity.id,
    });
  }

  // 2. If structure template exists, extract sockets from generated parts
  if (structureTemplate && dataRegistry) {
    await extractStructureTemplateSockets(
      structureTemplate,
      hierarchicalSockets,
      dataRegistry
    );
  }

  return hierarchicalSockets;
}

/**
 * Extracts sockets from structure template generated parts.
 * Structure templates define topology (limbSets, appendages) which generate parts,
 * and those parts have their own sockets for nested attachments.
 *
 * @param {object} structureTemplate - Structure template definition
 * @param {Map<string, object>} hierarchicalSockets - Socket map to populate
 * @param {object} dataRegistry - Data registry for entity lookups
 * @returns {Promise<void>}
 * @private
 */
async function extractStructureTemplateSockets(
  structureTemplate,
  hierarchicalSockets,
  dataRegistry
) {
  const topology = structureTemplate?.topology;
  if (!topology) {
    return;
  }

  // Extract sockets from limbSets (arms, legs, wings, etc.)
  if (Array.isArray(topology.limbSets)) {
    for (const limbSet of topology.limbSets) {
      await extractLimbSetSockets(limbSet, hierarchicalSockets, dataRegistry);
    }
  }

  // Extract sockets from appendages (head, tail, etc.)
  if (Array.isArray(topology.appendages)) {
    for (const appendage of topology.appendages) {
      await extractAppendageSockets(
        appendage,
        hierarchicalSockets,
        dataRegistry
      );
    }
  }
}

/**
 * Extracts sockets from a limbSet definition (e.g., bilateral arms/legs).
 *
 * This function registers TWO types of sockets:
 * 1. The limbSet sockets themselves (e.g., arm_left, arm_right) on the root
 * 2. The sockets ON the parts that attach to those sockets (e.g., hand socket on arm entity)
 *
 * @param {object} limbSet - LimbSet definition from structure template
 * @param {Map<string, object>} hierarchicalSockets - Socket map to populate
 * @param {object} dataRegistry - Data registry for entity lookups
 * @returns {Promise<void>}
 * @private
 */
async function extractLimbSetSockets(limbSet, hierarchicalSockets, dataRegistry) {
  const socketPattern = limbSet?.socketPattern;
  if (!socketPattern) {
    return;
  }

  const idTemplate = socketPattern.idTemplate;
  const allowedTypes = socketPattern.allowedTypes || [];
  const arrangement = limbSet.arrangement || 'bilateral';
  const count = limbSet.count || 2;

  // Generate socket IDs based on arrangement (these are the parent sockets)
  const socketIds = generateSocketIds(idTemplate, arrangement, count);

  // Register each generated socket as a root-level socket from structure template
  for (const socketId of socketIds) {
    hierarchicalSockets.set(socketId, {
      id: socketId,
      allowedTypes,
      source: 'structure_template_limbset',
      nameTpl: socketPattern.nameTpl,
    });

    // Now extract child sockets from the parts that attach to these sockets
    for (const partType of allowedTypes) {
      const entityId = await resolveEntityId(partType, dataRegistry);
      if (entityId) {
        const partEntity = await getEntityDefinition(dataRegistry, entityId);
        if (partEntity) {
          const partSockets = extractSocketsFromEntity(partEntity);
          // Add part's sockets to hierarchical map with parent context
          for (const [partSocketId, partSocketData] of partSockets) {
            const hierarchicalKey = `${socketId}:${partSocketId}`;
            hierarchicalSockets.set(partSocketId, {
              ...partSocketData,
              source: 'structure_template_limb_child',
              parent: socketId,
              parentEntity: entityId,
              hierarchicalKey,
            });
          }
        }
      }
    }
  }
}

/**
 * Extracts sockets from an appendage definition (e.g., head, tail).
 *
 * This function registers TWO types of sockets:
 * 1. The appendage socket itself (e.g., head, tail) on the root
 * 2. The sockets ON the part that attaches to that socket (e.g., left_eye, right_eye on head entity)
 *
 * @param {object} appendage - Appendage definition from structure template
 * @param {Map<string, object>} hierarchicalSockets - Socket map to populate
 * @param {object} dataRegistry - Data registry for entity lookups
 * @returns {Promise<void>}
 * @private
 */
async function extractAppendageSockets(
  appendage,
  hierarchicalSockets,
  dataRegistry
) {
  const socketPattern = appendage?.socketPattern;
  if (!socketPattern) {
    return;
  }

  const socketId = socketPattern.idTemplate;
  const allowedTypes = socketPattern.allowedTypes || [];

  // Register the appendage socket itself as a root-level socket from structure template
  hierarchicalSockets.set(socketId, {
    id: socketId,
    allowedTypes,
    source: 'structure_template_appendage',
    nameTpl: socketPattern.nameTpl,
  });

  // Now extract child sockets from the parts that attach to this socket
  for (const partType of allowedTypes) {
    const entityId = await resolveEntityId(partType, dataRegistry);
    if (entityId) {
      const partEntity = await getEntityDefinition(dataRegistry, entityId);
      if (partEntity) {
        const partSockets = extractSocketsFromEntity(partEntity);
        // Add part's sockets to hierarchical map with parent context
        for (const [partSocketId, partSocketData] of partSockets) {
          const hierarchicalKey = `${socketId}:${partSocketId}`;
          hierarchicalSockets.set(partSocketId, {
            ...partSocketData,
            source: 'structure_template_appendage_child',
            parent: socketId,
            parentEntity: entityId,
            hierarchicalKey,
          });
        }
      }
    }
  }
}

/**
 * Generates socket IDs from template pattern based on arrangement.
 *
 * @param {string} idTemplate - Socket ID template (e.g., "arm_{{orientation}}")
 * @param {string} arrangement - Arrangement type ('bilateral', 'radial', etc.)
 * @param {number} count - Number of sockets to generate
 * @returns {Array<string>} Generated socket IDs
 * @private
 */
function generateSocketIds(idTemplate, arrangement, count) {
  const ids = [];

  if (arrangement === 'bilateral' && count === 2) {
    ids.push(
      idTemplate.replace('{{orientation}}', 'left'),
      idTemplate.replace('{{orientation}}', 'right')
    );
  } else if (arrangement === 'radial') {
    for (let i = 0; i < count; i++) {
      ids.push(idTemplate.replace('{{index}}', String(i)));
    }
  } else {
    // Fallback: generate indexed IDs
    for (let i = 0; i < count; i++) {
      ids.push(idTemplate.replace('{{orientation}}', String(i)));
    }
  }

  return ids;
}

/**
 * Resolves partType to entity ID.
 * In the anatomy system, partTypes often correspond to entity IDs with "anatomy:" namespace.
 *
 * @param {string} partType - Part type identifier
 * @param {object} dataRegistry - Data registry for lookups
 * @returns {Promise<string|null>} Resolved entity ID or null
 * @private
 */
async function resolveEntityId(partType, dataRegistry) {
  // Try with anatomy: namespace
  const anatomyId = `anatomy:${partType}`;
  const entity = await getEntityDefinition(dataRegistry, anatomyId);
  if (entity) {
    return anatomyId;
  }

  // Try without namespace (might already include it)
  const entityDirect = await getEntityDefinition(dataRegistry, partType);
  if (entityDirect) {
    return partType;
  }

  return null;
}

/**
 * Gets entity definition from registry with API compatibility.
 *
 * @param {object} dataRegistry - Data registry
 * @param {string} entityId - Entity identifier
 * @returns {Promise<object|undefined>} Entity definition if found
 * @private
 */
async function getEntityDefinition(dataRegistry, entityId) {
  if (!dataRegistry) {
    return undefined;
  }

  if (typeof dataRegistry.getEntityDefinition === 'function') {
    return dataRegistry.getEntityDefinition(entityId);
  }

  if (typeof dataRegistry.get === 'function') {
    return dataRegistry.get('entityDefinitions', entityId);
  }

  return undefined;
}
