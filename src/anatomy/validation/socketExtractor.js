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

let socketExtractorLogger = console;

export function setSocketExtractorLogger(logger) {
  socketExtractorLogger = logger || null;
}

/**
 * Extracts hierarchical socket map from blueprint, structure template, and entity definitions.
 * Supports the hierarchical socket architecture where:
 * - Root entity has direct sockets
 * - Structure template generates parts (limbs, head, tail) with their own sockets
 * - Blueprint slots/additionalSlots can reference child part sockets via 'parent' property
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

  // Extract namespace from blueprint root entity ID for entity resolution preference
  // This prevents cross-mod contamination when validating recipes from different mods in batch
  // Note: We use blueprint.root (e.g., "anatomy:human_male_torso") instead of blueprint.id
  // because the id field may not include the namespace prefix after loading/processing
  const blueprintNamespace = blueprint?.root?.split(':')[0] || null;

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
      dataRegistry,
      blueprintNamespace
    );
  }

  // 3. For blueprints with compose instruction, extract slots from composed parts
  //    This supports V1 blueprints that use composition instead of structure templates
  //
  // NOTE: After loading by AnatomyBlueprintLoader, the compose property is deleted
  // and slots are merged into blueprint.slots. The extractSlotChildSockets function
  // handles both V1 (slots) and V2 (additionalSlots) by processing all slots with
  // partType requirements.
  if (blueprint?.compose && dataRegistry) {
    await extractComposedSlots(blueprint, hierarchicalSockets, dataRegistry, blueprintNamespace);
  }

  // 4. For blueprints without structure template, extract child sockets
  //    from entities attached to slots that have child slots with parent refs
  if (!structureTemplate && dataRegistry && blueprint) {
    await extractSlotChildSockets(blueprint, hierarchicalSockets, dataRegistry, blueprintNamespace);
  }

  return hierarchicalSockets;
}

/**
 * Extracts child sockets from entities that will be attached to parent slots.
 * This supports the older blueprint `slots` format (without structure templates)
 * where child slots reference parent slots via the `parent` property.
 *
 * For each slot without a parent, we look up its entity definition and extract
 * its sockets, making them available to child slots that reference it.
 *
 * @param {object} blueprint - Blueprint definition
 * @param {Map<string, object>} hierarchicalSockets - Socket map to populate
 * @param {object} dataRegistry - Data registry for entity lookups
 * @param {string} [preferredNamespace] - Optional namespace to prefer for entity resolution
 * @returns {Promise<void>}
 * @private
 */
async function extractSlotChildSockets(
  blueprint,
  hierarchicalSockets,
  dataRegistry,
  preferredNamespace = null
) {
  // Combine both slots and additionalSlots for complete coverage
  const allSlots = {
    ...(blueprint?.slots || {}),
    ...(blueprint?.additionalSlots || {}),
  };

  // Identify all slots with partType requirements
  // This includes both top-level slots AND nested slots (e.g., mouth which has parent: head)
  // because any slot with a partType can have its own child sockets
  const slotsWithPartType = new Map();
  for (const [slotName, slotConfig] of Object.entries(allSlots)) {
    // Include all slots that have requirements.partType, regardless of parent
    if (slotConfig?.requirements?.partType) {
      slotsWithPartType.set(slotName, slotConfig);
    }
  }

  // For each slot with partType, look up its entity and extract sockets
  for (const [slotName, slotConfig] of slotsWithPartType) {
    const partType = slotConfig.requirements?.partType;
    if (!partType) {
      continue;
    }

    // Try to find entity definition for this part type
    // Pass preferredNamespace to avoid cross-mod contamination in batch validation
    const entityId = await resolveEntityId(partType, dataRegistry, preferredNamespace);
    if (!entityId) {
      continue;
    }

    const partEntity = await getEntityDefinition(dataRegistry, entityId);
    if (!partEntity) {
      continue;
    }

    // Extract sockets from this slot's entity
    const partSockets = extractSocketsFromEntity(partEntity);

    // Add each socket to the hierarchical map with parent context
    for (const [socketId, socketData] of partSockets) {
      hierarchicalSockets.set(socketId, {
        ...socketData,
        source: 'slot_child',
        parent: slotName,
        parentEntity: entityId,
        hierarchicalKey: `${slotName}:${socketId}`,
      });
    }
  }
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
  dataRegistry,
  preferredNamespace = null
) {
  const topology = structureTemplate?.topology;
  if (!topology) {
    return;
  }

  // Extract sockets from limbSets (arms, legs, wings, etc.)
  if (Array.isArray(topology.limbSets)) {
    for (const limbSet of topology.limbSets) {
      await extractLimbSetSockets(limbSet, hierarchicalSockets, dataRegistry, preferredNamespace);
    }
  }

  // Extract sockets from appendages (head, tail, etc.)
  if (Array.isArray(topology.appendages)) {
    for (const appendage of topology.appendages) {
      await extractAppendageSockets(
        appendage,
        hierarchicalSockets,
        dataRegistry,
        preferredNamespace
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
async function extractLimbSetSockets(
  limbSet,
  hierarchicalSockets,
  dataRegistry,
  preferredNamespace = null
) {
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
      // Pass preferredNamespace to avoid cross-mod entity contamination in batch validation
      const entityId = await resolveEntityId(partType, dataRegistry, preferredNamespace);
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
  dataRegistry,
  preferredNamespace = null
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
    // Pass preferredNamespace to avoid cross-mod entity contamination in batch validation
    const entityId = await resolveEntityId(partType, dataRegistry, preferredNamespace);
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
 * Resolves partType to entity ID by searching for entities with matching anatomy:part.subType.
 * Entity IDs don't directly match partTypes (e.g., partType "head" → entity "anatomy:humanoid_head"),
 * so we search all entity definitions to find one with matching subType.
 *
 * When preferredNamespace is provided, entities from that namespace are strongly preferred.
 * This prevents cross-mod contamination when validating recipes from different mods in batch.
 *
 * @param {string} partType - Part type identifier (e.g., "head", "arm", "leg")
 * @param {object} dataRegistry - Data registry for lookups
 * @param {string} [preferredNamespace] - Optional namespace to prefer (e.g., "anatomy")
 * @returns {Promise<string|null>} Resolved entity ID or null
 * @private
 * @internal Exported for unit testing only
 */
export async function resolveEntityId(partType, dataRegistry, preferredNamespace = null) {
  if (!dataRegistry || !partType) {
    return null;
  }

  const logger = socketExtractorLogger ?? console;

  // Get all entity definitions and search for one with matching partType
  let allEntities = [];

  if (typeof dataRegistry.getAll === 'function') {
    allEntities = dataRegistry.getAll('entityDefinitions') || [];
  } else if (typeof dataRegistry.getAllEntityDefinitions === 'function') {
    allEntities = dataRegistry.getAllEntityDefinitions() || [];
  }

  // Find all entities with matching subType
  const candidates = allEntities.filter((entity) => {
    const partComponent = entity?.components?.['anatomy:part'];
    return partComponent?.subType === partType;
  });

  if (candidates.length === 0) {
    return null;
  }

  if (candidates.length === 1) {
    return candidates[0].id;
  }

  // Multiple candidates: apply deterministic priority rules with namespace preference
  candidates.sort((a, b) => {
    const aId = a.id || '';
    const bId = b.id || '';

    // Rule 0 (NEW): Prefer entities from the preferred namespace
    // This is critical for batch validation to prevent cross-mod contamination
    if (preferredNamespace) {
      const aNamespace = aId.split(':')[0] || '';
      const bNamespace = bId.split(':')[0] || '';
      const aMatches = aNamespace === preferredNamespace;
      const bMatches = bNamespace === preferredNamespace;

      if (aMatches && !bMatches) return -1;
      if (bMatches && !aMatches) return 1;
    }

    // Rule 1: Fewer underscores = higher priority (base entities)
    const aUnderscores = (aId.match(/_/g) || []).length;
    const bUnderscores = (bId.match(/_/g) || []).length;

    if (aUnderscores !== bUnderscores) {
      return aUnderscores - bUnderscores;
    }

    // Rule 2: Alphabetical for determinism and to prefer humanoid_head over kraken_head
    const alpha = aId.localeCompare(bId);
    if (alpha !== 0) {
      return alpha;
    }

    // Rule 3: Shorter ID = higher priority (fallback)
    return aId.length - bId.length;
  });

  const candidateIds = candidates.map((entity) => entity.id).filter(Boolean);
  const selectedId = candidates[0].id;

  logger?.debug?.(
    `[socketExtractor] Multiple entities with subType "${partType}": ${candidateIds.join(', ')}. Selected "${selectedId}" (priority: ${preferredNamespace ? `namespace "${preferredNamespace}", ` : ''}fewest underscores, alphabetical, shortest ID).`
  );

  return candidates[0].id;
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

/**
 * Gets blueprint part from registry.
 *
 * @param {object} dataRegistry - Data registry
 * @param {string} partId - Blueprint part identifier
 * @returns {Promise<object|undefined>} Blueprint part if found
 * @private
 */
async function getBlueprintPart(dataRegistry, partId) {
  if (!dataRegistry) {
    return undefined;
  }

  if (typeof dataRegistry.get === 'function') {
    return dataRegistry.get('anatomyBlueprintParts', partId);
  }

  return undefined;
}

/**
 * Gets slot library from registry.
 *
 * @param {object} dataRegistry - Data registry
 * @param {string} libraryId - Slot library identifier
 * @returns {Promise<object|undefined>} Slot library if found
 * @private
 */
async function getSlotLibrary(dataRegistry, libraryId) {
  if (!dataRegistry) {
    return undefined;
  }

  if (typeof dataRegistry.get === 'function') {
    return dataRegistry.get('anatomySlotLibraries', libraryId);
  }

  return undefined;
}

/**
 * Resolves a slot definition by merging $use references with overrides.
 *
 * @param {object} slotConfig - Slot configuration (may have $use reference)
 * @param {object|null} library - Slot library containing definitions
 * @returns {object} Resolved slot configuration
 * @private
 */
function resolveSlotDefinition(slotConfig, library) {
  if (!slotConfig?.$use || !library?.slotDefinitions) {
    return slotConfig;
  }

  const libraryDef = library.slotDefinitions[slotConfig.$use];
  if (!libraryDef) {
    return slotConfig;
  }

  // Merge library definition with overrides
  const resolved = { ...libraryDef };
  for (const [key, value] of Object.entries(slotConfig)) {
    if (key !== '$use') {
      resolved[key] = value;
    }
  }

  return resolved;
}

/**
 * Extracts slots from composed blueprint parts.
 * V1 blueprints use `compose` instruction to merge slots from separate part files.
 * This function loads those parts, resolves $use references, and registers:
 * 1. Slots themselves as valid parent targets
 * 2. Sockets from entities that attach to parent slots (for child slot validation)
 *
 * @param {object} blueprint - Blueprint definition with compose instruction
 * @param {Map<string, object>} hierarchicalSockets - Socket map to populate
 * @param {object} dataRegistry - Data registry for part lookups
 * @returns {Promise<void>}
 * @private
 */
async function extractComposedSlots(
  blueprint,
  hierarchicalSockets,
  dataRegistry,
  preferredNamespace = null
) {
  const composeInstructions = blueprint?.compose;
  if (!Array.isArray(composeInstructions)) {
    return;
  }

  for (const instruction of composeInstructions) {
    const partId = instruction.part;
    if (!partId) {
      continue;
    }

    // Only process if 'slots' is included in the compose instruction
    const includeList = instruction.include;
    if (!Array.isArray(includeList) || !includeList.includes('slots')) {
      continue;
    }

    // Load the blueprint part
    const part = await getBlueprintPart(dataRegistry, partId);
    if (!part?.slots) {
      continue;
    }

    // Load the slot library if the part references one
    let library = null;
    if (part.library) {
      library = await getSlotLibrary(dataRegistry, part.library);
      // DEBUG: Log library loading
      console.log(
        `[DEBUG socketExtractor] Library ${part.library}: ${library ? 'LOADED' : 'NOT FOUND'}`
      );
    }

    // First pass: collect all resolved slots and register them as valid parents
    const resolvedSlots = new Map();
    for (const [slotName, slotConfig] of Object.entries(part.slots)) {
      if (!slotConfig || typeof slotConfig !== 'object') {
        continue;
      }

      // Resolve $use references
      const resolved = resolveSlotDefinition(slotConfig, library);
      resolvedSlots.set(slotName, resolved);

      // Register the slot itself as a valid parent target
      if (!hierarchicalSockets.has(slotName)) {
        hierarchicalSockets.set(slotName, {
          id: slotName,
          source: 'composed_slot',
          slotName,
          partId,
          parent: resolved.parent || null,
          requirements: resolved.requirements,
        });
      }
    }

    // Second pass: for ALL slots with requirements.partType, extract entity sockets
    // This enables validation of nested hierarchies (e.g., head→mouth→teeth)
    // Any slot with a partType requirement can potentially have child sockets
    for (const [slotName, resolved] of resolvedSlots) {
      const partType = resolved.requirements?.partType;
      if (!partType) {
        // Skip slots without partType - they don't reference specific entity types
        continue;
      }

      // Try to find entity definition for this part type
      // Pass preferredNamespace to avoid cross-mod entity contamination in batch validation
      const entityId = await resolveEntityId(partType, dataRegistry, preferredNamespace);
      if (!entityId) {
        continue;
      }

      const partEntity = await getEntityDefinition(dataRegistry, entityId);
      if (!partEntity) {
        continue;
      }

      // Extract sockets from this parent's entity
      const partSockets = extractSocketsFromEntity(partEntity);

      // Add each socket to the hierarchical map with parent context
      for (const [socketId, socketData] of partSockets) {
        hierarchicalSockets.set(socketId, {
          ...socketData,
          source: 'composed_part_child',
          parent: slotName,
          parentEntity: entityId,
          hierarchicalKey: `${slotName}:${socketId}`,
        });
      }
    }
  }
}
