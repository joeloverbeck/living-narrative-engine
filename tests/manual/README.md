# Manual Testing

This directory contains scripts and tools for manual testing that require human interaction or visual verification.

## Files

### verify-anatomy-visualizer.js

Manual verification script for the anatomy visualizer system.

**Purpose**: Validates that the anatomy visualizer correctly renders and displays anatomical structures.

**How to Run**:

```bash
node tests/manual/verify-anatomy-visualizer.js
```

**When to Use**:

- After making changes to the anatomy system
- Before releasing new anatomy features
- When investigating visual rendering issues

**Note**: This is not an automated test and requires human verification of the output.
