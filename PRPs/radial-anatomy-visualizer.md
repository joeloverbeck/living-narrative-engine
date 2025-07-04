name: "Radial Layout for Anatomy Graph Visualizer"
description: |

## Purpose
Implement a radial tree layout for the anatomy graph visualizer to replace the current tier-based layout, preventing bezier curve overlaps and providing better visual clarity for complex body part hierarchies.

## Core Principles
1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md

---

## Goal
Transform the current tier/row-based anatomy graph layout into a radial tree layout where:
- Root node is centered
- Children radiate outward in concentric circles
- Bezier curves don't overlap
- Siblings are spaced to prevent visual clutter
- The visualization can expand as needed (panning is available)

## Why
- **Visual Clarity**: Current tier-based layout causes many bezier curve overlaps making the graph confusing
- **Space Efficiency**: Radial layouts better utilize available space for tree structures
- **Scalability**: Can handle complex anatomies with many branches without horizontal crowding
- **Professional Appearance**: Radial layouts are standard for hierarchical data visualization

## What
Transform the node positioning algorithm in AnatomyGraphRenderer.js from horizontal tiers to radial positioning while maintaining all existing functionality (tooltips, pan/zoom, node colors).

### Success Criteria
- [ ] All nodes positioned in radial layout with no overlapping bezier curves
- [ ] Root node centered in viewport
- [ ] Children evenly distributed around parents
- [ ] Smooth bezier curves connecting nodes
- [ ] All existing features work (pan, zoom, tooltips)
- [ ] Unit tests pass with >80% branch coverage
- [ ] Integration tests verify full rendering

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- url: https://eclipse.dev/elk/reference/algorithms/org-eclipse-elk-radial.html
  why: ELK's radial algorithm details annulus wedge criteria and overlap removal
  
- url: https://stackoverflow.com/questions/33328245/radial-tree-layout-algorithm
  why: Mathematical formulas for angle calculation and coordinate conversion
  critical: Angles must be in radians, not degrees
  
- url: https://docs.yworks.com/yfiles-html/dguide/layout/radial_layout.html
  why: Edge routing strategies and overlap prevention techniques
  
- url: https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths
  why: SVG path commands for bezier curves (Q command for quadratic)
  
- file: src/visualizer/renderers/AnatomyGraphRenderer.js
  why: Current implementation to modify - tier-based layout at lines 265-294
  
- file: tests/unit/visualizer/AnatomyGraphRenderer.test.js
  why: Existing test patterns and mock data structures
  
- file: tests/integration/domUI/AnatomyVisualizerUI.integration.test.js
  why: Integration test patterns for full rendering verification

- file: src/anatomy-visualizer.js
  why: Main entry point that initializes AnatomyGraphRenderer
```

### Current Implementation Details
```javascript
// CURRENT: Tier-based positioning (lines 265-294 in AnatomyGraphRenderer.js)
_calculateNodePositions() {
    const width = 1200;
    
    // Group nodes by depth
    const levels = new Map();
    for (const [nodeId, node] of this._nodes) {
        if (!levels.has(node.depth)) {
            levels.set(node.depth, []);
        }
        levels.get(node.depth).push(node);
    }
    
    // Position nodes
    for (const [depth, nodes] of levels) {
        const y = depth * 150 + 80; // Fixed vertical spacing
        const spacing = width / (nodes.length + 1);
        
        nodes.forEach((node, index) => {
            node.x = spacing * (index + 1);
            node.y = y;
        });
    }
}
```

### Mathematical Formulas for Radial Layout
```javascript
// CRITICAL: Angle calculation for proportional distribution
angleForChild = parentStartAngle + (childLeafCount / parentLeafCount * parentAngleRange)

// CRITICAL: Polar to Cartesian conversion
x = centerX + radius * Math.cos(angle)  // angle in radians!
y = centerY + radius * Math.sin(angle)  // angle in radians!

// CRITICAL: Prevent overlap with minimum angle between siblings
siblingAngle = Math.min(availableAngleRange / numChildren, Math.PI / 10)
```

### Known Gotchas & Library Quirks
```javascript
// CRITICAL: SVG coordinate system has Y-axis pointing down
// CRITICAL: Math functions expect radians, not degrees (2*PI not 360)
// CRITICAL: this._viewBox needs updating after radial positioning for proper initial zoom
// CRITICAL: Node data structure has x,y properties that must be set
```

## Implementation Blueprint

### Data models and structure

Extend node data structure with radial properties:
```javascript
// Add to node objects during graph building:
node.angle = 0;        // Angle in radians from parent
node.radius = 0;       // Distance from center
node.leafCount = 0;    // Number of leaf descendants
node.angleStart = 0;   // Start of allocated angle range
node.angleEnd = 0;     // End of allocated angle range
```

### List of tasks to be completed

```yaml
Task 1: Add helper methods for radial calculations
MODIFY src/visualizer/renderers/AnatomyGraphRenderer.js:
  - ADD _calculateLeafCounts() method after _buildGraphData()
  - ADD _polarToCartesian(centerX, centerY, radius, angle) helper
  - ADD _calculateMinimumRadius(depth, nodeCount) helper

Task 2: Implement radial positioning algorithm
MODIFY src/visualizer/renderers/AnatomyGraphRenderer.js:
  - REPLACE _calculateNodePositions() implementation
  - ADD _calculateRadialPositions() recursive method
  - UPDATE node.x and node.y using polar conversion

Task 3: Update viewBox calculation for radial layout
MODIFY src/visualizer/renderers/AnatomyGraphRenderer.js:
  - UPDATE _updateViewBoxToFitContent() to handle circular bounds
  - ENSURE initial view shows entire radial graph centered

Task 4: Enhance bezier curve rendering for radial layout
MODIFY src/visualizer/renderers/AnatomyGraphRenderer.js:
  - FIND _createEdgeElement() method
  - UPDATE bezier control point calculation for better radial curves
  - KEEP quadratic bezier (Q command) but adjust control points

Task 5: Create unit tests for radial positioning
CREATE tests/unit/visualizer/AnatomyGraphRendererRadial.test.js:
  - MIRROR test structure from AnatomyGraphRenderer.test.js
  - TEST radial position calculations
  - TEST edge cases: single node, linear chain, highly branched
  - TEST no node overlap at same depth

Task 6: Update existing unit tests
MODIFY tests/unit/visualizer/AnatomyGraphRenderer.test.js:
  - UPDATE position assertions to expect radial coordinates
  - KEEP all other test logic intact

Task 7: Create integration tests for radial layout
MODIFY tests/integration/domUI/AnatomyVisualizerUI.integration.test.js:
  - ADD test case for radial layout rendering
  - VERIFY nodes positioned in circles
  - VERIFY bezier curves connect properly
  - TEST pan/zoom still works
```

### Per task pseudocode

#### Task 1: Helper Methods
```javascript
_calculateLeafCounts() {
  // Post-order traversal to count leaves
  // If node has no children, leafCount = 1
  // Else leafCount = sum of children's leafCounts
}

_polarToCartesian(centerX, centerY, radius, angle) {
  return {
    x: centerX + radius * Math.cos(angle),
    y: centerY + radius * Math.sin(angle)
  };
}

_calculateMinimumRadius(depth, nodeCount) {
  // Base radius for each depth level
  const baseRadius = 150;
  // Additional spacing for crowded levels
  const crowdingFactor = Math.max(1, nodeCount / 8);
  return baseRadius * depth * crowdingFactor;
}
```

#### Task 2: Radial Positioning Algorithm
```javascript
_calculateRadialPositions() {
  // First, calculate leaf counts for all nodes
  this._calculateLeafCounts();
  
  // Find root node(s) - nodes with depth 0
  const roots = Array.from(this._nodes.values()).filter(n => n.depth === 0);
  
  // Position root at center
  const centerX = 600;  // Center of typical viewport
  const centerY = 400;
  
  roots.forEach(root => {
    root.x = centerX;
    root.y = centerY;
    root.angleStart = 0;
    root.angleEnd = 2 * Math.PI;
    
    // Recursively position children
    this._positionChildrenRadially(root);
  });
}

_positionChildrenRadially(parent) {
  const children = this._getDirectChildren(parent.id);
  if (children.length === 0) return;
  
  // Calculate radius for this depth level
  const radius = this._calculateMinimumRadius(parent.depth + 1, children.length);
  
  // Calculate angle range for each child based on leaf count
  const parentAngleRange = parent.angleEnd - parent.angleStart;
  const totalLeaves = parent.leafCount;
  
  let currentAngle = parent.angleStart;
  
  children.forEach(child => {
    // Proportional angle allocation
    const childAngleRange = (child.leafCount / totalLeaves) * parentAngleRange;
    
    // Minimum angle to prevent overlap
    const minAngle = Math.PI / 10;  // 18 degrees
    const actualAngleRange = Math.max(childAngleRange, minAngle);
    
    // Position at center of allocated range
    const childAngle = currentAngle + actualAngleRange / 2;
    
    // Convert to cartesian
    const pos = this._polarToCartesian(parent.x, parent.y, radius, childAngle);
    child.x = pos.x;
    child.y = pos.y;
    child.angleStart = currentAngle;
    child.angleEnd = currentAngle + actualAngleRange;
    
    currentAngle += actualAngleRange;
    
    // Recurse for grandchildren
    this._positionChildrenRadially(child);
  });
}
```

#### Task 4: Enhanced Bezier Curves
```javascript
_createEdgeElement(edge) {
  const source = this._nodes.get(edge.source);
  const target = this._nodes.get(edge.target);
  
  // For radial layout, curve should follow the natural arc
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Control point at 30% distance, perpendicular to direct line
  const t = 0.3;
  const midX = source.x + dx * t;
  const midY = source.y + dy * t;
  
  // Perpendicular offset for curve
  const curvature = 0.15;
  const controlX = midX - dy * curvature;
  const controlY = midY + dx * curvature;
  
  // Create quadratic bezier path
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', `M ${source.x} ${source.y} Q ${controlX} ${controlY} ${target.x} ${target.y}`);
  path.setAttribute('class', 'edge');
  path.setAttribute('data-source', edge.source);
  path.setAttribute('data-target', edge.target);
  
  return path;
}
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors before proceeding
npm run lint src/visualizer/renderers/AnatomyGraphRenderer.js
npm run format

# Expected: No errors. If errors, READ and fix.
```

### Level 2: Unit Tests
```bash
# Run new radial tests
npm run test tests/unit/visualizer/AnatomyGraphRendererRadial.test.js

# Run updated existing tests
npm run test tests/unit/visualizer/AnatomyGraphRenderer.test.js

# If failing: Read error, understand root cause, fix code, re-run
```

### Level 3: Integration Tests
```bash
# Run full integration test suite
npm run test tests/integration/domUI/AnatomyVisualizerUI.integration.test.js

# Verify visual rendering manually
npm run dev
# Navigate to anatomy-visualizer.html
# Check: nodes in circles, no overlapping curves, smooth interaction
```

## Final Validation Checklist
- [ ] All tests pass: `npm run test`
- [ ] No linting errors: `npm run lint src/visualizer/renderers/AnatomyGraphRenderer.js`
- [ ] Radial layout displays correctly with sample data
- [ ] No bezier curve overlaps for complex anatomies
- [ ] Pan and zoom work smoothly
- [ ] Tooltips display on hover
- [ ] Performance acceptable for large graphs (100+ nodes)
- [ ] Branch coverage >80% for modified code

---

## Anti-Patterns to Avoid
- ❌ Don't use degrees - JavaScript Math functions expect radians
- ❌ Don't ignore existing test patterns - follow the established structure
- ❌ Don't hardcode viewport dimensions - use dynamic calculations
- ❌ Don't forget to update _viewBox after positioning
- ❌ Don't create overlapping nodes - maintain minimum angle spacing
- ❌ Don't break existing features (tooltips, colors, pan/zoom)

## Edge Cases to Test
- Single root node with no children
- Linear chain (each node has exactly one child)
- Highly branched tree (node with 20+ children)
- Unbalanced tree (one branch much deeper than others)
- Multiple root nodes (forest instead of tree)

## Performance Considerations
- Leaf count calculation is O(n) - cache results
- Position calculation is O(n) - acceptable
- Use requestAnimationFrame for smooth transitions if animating
- Consider level-of-detail for very large graphs (500+ nodes)

## Confidence Score
**8/10** - High confidence in one-pass implementation success

The mathematical formulas are well-documented, the existing code structure is clear, and the test patterns are established. The main complexity is in the angle allocation algorithm to prevent overlaps, but the provided formulas and constraints should handle this effectively.