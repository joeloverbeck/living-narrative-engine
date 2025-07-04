# PRP: Fix Anatomy Visualizer to Display Full Body Graph

## Context

The anatomy visualizer currently only displays the root node (torso) instead of showing all body parts with bezier curves connecting them. The visualization should show a complete graph of all body parts defined in the blueprint (approximately 20 nodes for a human male).

## Technical Background

### Current Architecture
1. **AnatomyVisualizerUI** - Main UI controller that loads entities and coordinates visualization
2. **AnatomyGraphRenderer** - Renders the SVG graph with nodes and bezier curve edges
3. **AnatomyGenerationService** - Generates body parts from blueprints/recipes
4. **BodyBlueprintFactory** - Creates the anatomy graph structure

### Expected Behavior (from tests)
- A human male body should display 20 nodes: torso, head, 2 arms, 2 hands, 2 legs, 2 eyes, 2 ears, nose, mouth, hair, penis, 2 testicles, asshole, pubic hair (optional)
- All parts should be connected via bezier curves showing parent-child relationships
- The graph should be interactive with pan/zoom and tooltips

### Current Issue Analysis
The renderer's traversal logic appears correct (lines 98-169 in AnatomyGraphRenderer.js). The issue is likely:
1. The `bodyData.parts` object may not contain all generated parts
2. Parts might exist but lack proper joint connections
3. The parts map building process might be incomplete

## Implementation Strategy

### 1. Debug and Diagnose the Issue
First, add comprehensive logging to understand what's happening:

```javascript
// In AnatomyGraphRenderer._buildGraphData() at line 98
async _buildGraphData(bodyData) {
  this._logger.debug('Building graph data from bodyData:', {
    root: bodyData.root,
    partsCount: Object.keys(bodyData.parts || {}).length,
    parts: bodyData.parts
  });
  
  // ... existing code ...
  
  // After line 107, log all collected part IDs
  this._logger.debug('All part IDs collected:', Array.from(allPartIds));
  
  // Inside the while loop after line 116
  const entity = await this._entityManager.getEntityInstance(id);
  if (!entity) {
    this._logger.warn(`Entity not found: ${id}`);
    continue;
  }
  
  // Log entity details
  const partComponent = entity.getComponentData('anatomy:part');
  const jointComponent = entity.getComponentData('anatomy:joint');
  this._logger.debug(`Processing entity ${id}:`, {
    hasPartComponent: !!partComponent,
    hasJointComponent: !!jointComponent,
    jointParentId: jointComponent?.parentId,
    partType: partComponent?.subType
  });
}
```

### 2. Fix Parts Collection in AnatomyGenerationWorkflow
The issue might be in how parts are collected. Check the buildPartsMap method:

```javascript
// In src/anatomy/AnatomyGenerationWorkflow.js
#buildPartsMap(uow) {
  const parts = {};
  const allEntities = uow.getCreatedEntities();
  
  this._logger.debug(`Building parts map from ${allEntities.length} entities`);
  
  for (const entity of allEntities) {
    const nameData = entity.getComponentData('core:name');
    if (nameData?.name) {
      parts[nameData.name] = entity.id;
      this._logger.debug(`Added part: ${nameData.name} -> ${entity.id}`);
    } else {
      // Log parts without names
      const partData = entity.getComponentData('anatomy:part');
      this._logger.warn(`Entity ${entity.id} has no name, part type: ${partData?.subType}`);
    }
  }
  
  this._logger.info(`Built parts map with ${Object.keys(parts).length} named parts`);
  return parts;
}
```

### 3. Ensure All Parts Have Names
Check that part entities are created with proper names:

```javascript
// In src/anatomy/BodyBlueprintFactory.js
// When creating parts, ensure they have names
async #createAndAttachPart(slotName, slotDef, parentId, parentSocket, context) {
  // ... existing part creation logic ...
  
  // Ensure the created part has a name
  const partEntity = await this._entityManager.getEntityInstance(partEntityId);
  const nameComponent = partEntity.getComponentData('core:name');
  if (!nameComponent?.name) {
    this._logger.warn(`Part ${partEntityId} (slot: ${slotName}) created without name`);
    // Consider generating a name based on slot name if missing
  }
  
  return partEntityId;
}
```

### 4. Fix Graph Traversal
Enhance the graph traversal to be more robust:

```javascript
// In AnatomyGraphRenderer._buildGraphData()
// Replace lines 151-165 with more comprehensive child discovery
// Find children by checking all parts for connections to this entity
const children = [];
for (const [partName, partId] of Object.entries(bodyData.parts)) {
  if (!visited.has(partId)) {
    try {
      const partEntity = await this._entityManager.getEntityInstance(partId);
      if (partEntity) {
        const partJoint = partEntity.getComponentData('anatomy:joint');
        if (partJoint && partJoint.parentId === id) {
          children.push({ id: partId, name: partName });
          queue.push({ id: partId, depth: depth + 1, parent: id });
        }
      }
    } catch (err) {
      this._logger.warn(`Failed to check entity ${partId} (${partName}):`, err);
    }
  }
}
this._logger.debug(`Found ${children.length} children for ${id}:`, children);
```

### 5. Add Fallback for Disconnected Parts
Some parts might not be properly connected. Add a second pass to include them:

```javascript
// After the main traversal loop in _buildGraphData
// Check for any parts that weren't visited
const unvisitedParts = [];
for (const [partName, partId] of Object.entries(bodyData.parts)) {
  if (!visited.has(partId)) {
    unvisitedParts.push({ name: partName, id: partId });
  }
}

if (unvisitedParts.length > 0) {
  this._logger.warn(`Found ${unvisitedParts.length} unconnected parts:`, unvisitedParts);
  
  // Add them as orphaned nodes (for debugging)
  for (const { name, id } of unvisitedParts) {
    try {
      const entity = await this._entityManager.getEntityInstance(id);
      if (entity) {
        const nameComponent = entity.getComponentData('core:name');
        const partComponent = entity.getComponentData('anatomy:part');
        
        const node = {
          id,
          name: nameComponent?.text || name || id,
          description: 'Unconnected part',
          type: partComponent?.subType || 'unknown',
          depth: 0, // Place at root level
          x: 0,
          y: 0
        };
        
        this._nodes.set(id, node);
      }
    } catch (err) {
      this._logger.error(`Failed to add unvisited part ${id}:`, err);
    }
  }
}
```

### 6. Add Visual Debugging
Add visual indicators to help debug the issue:

```javascript
// In AnatomyGraphRenderer._renderGraph()
// After rendering all nodes, add debug info
const debugGroup = this._document.createElementNS('http://www.w3.org/2000/svg', 'g');
debugGroup.setAttribute('class', 'debug-info');

const debugText = this._document.createElementNS('http://www.w3.org/2000/svg', 'text');
debugText.setAttribute('x', '10');
debugText.setAttribute('y', '20');
debugText.setAttribute('font-size', '14');
debugText.setAttribute('fill', '#666');
debugText.textContent = `Nodes: ${this._nodes.size}, Edges: ${this._edges.length}`;
debugGroup.appendChild(debugText);

this._svg.appendChild(debugGroup);
```

## Testing Strategy

### 1. Unit Tests
Create focused tests for the graph building logic:

```javascript
// tests/unit/domUI/AnatomyGraphRenderer.debug.test.js
describe('AnatomyGraphRenderer Debug Tests', () => {
  it('should collect all parts from bodyData', async () => {
    const bodyData = {
      root: 'torso-1',
      parts: {
        'torso': 'torso-1',
        'head': 'head-1',
        'left_arm': 'arm-1',
        'right_arm': 'arm-2'
      }
    };
    
    // Test that all 4 parts are processed
  });
  
  it('should handle parts without joint components gracefully', async () => {
    // Test orphaned parts
  });
});
```

### 2. Integration Tests
Add tests to verify the full anatomy generation:

```javascript
// tests/integration/anatomy/AnatomyGeneration.debug.test.js
describe('Anatomy Generation Debug Tests', () => {
  it('should generate all expected parts for human male blueprint', async () => {
    // Create entity with human male recipe
    // Verify bodyData.parts contains all expected entries
  });
});
```

### 3. Manual Testing
1. Load the anatomy visualizer page
2. Select a human male entity
3. Check browser console for debug logs
4. Verify node and edge counts match expectations
5. Use browser dev tools to inspect the SVG structure

## Validation Gates

```bash
# Lint and format checks
npm run lint
npm run format

# Run all tests
npm test

# Run specific test suites
npm test -- AnatomyGraphRenderer
npm test -- AnatomyVisualizerUI

# Run integration tests
npm test -- --testPathPattern=integration
```

## Implementation Order

1. **Add comprehensive logging** to understand the current state
2. **Fix parts map building** to ensure all parts are included
3. **Enhance graph traversal** to handle edge cases
4. **Add visual debugging** aids
5. **Create focused tests** to prevent regression
6. **Clean up debug code** once issue is resolved

## Resources

- Blueprint structure: `/data/mods/anatomy/blueprints/human_male.blueprint.json`
- Recipe structure: `/data/mods/anatomy/recipes/human_male.recipe.json`
- Test examples: `/tests/unit/visualizer/AnatomyGraphRenderer.enhanced.test.js`
- WebGL graph libraries for future enhancement: https://github.com/visjs/vis-network

## Success Criteria

- All body parts defined in the blueprint appear as nodes
- Bezier curves connect parent-child relationships correctly
- Graph is interactive with pan/zoom functionality
- Tooltips show part information on hover
- No console errors during visualization
- Test coverage maintained above 80%

## Confidence Score: 8/10

The diagnosis and solution are comprehensive. The main uncertainty is whether the issue is in the generation phase or the visualization phase, but the debugging steps will quickly identify the root cause.