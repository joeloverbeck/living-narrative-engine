# Proximity System Error Codes

## Parameter Validation Errors

### PROX-001: Invalid Furniture ID Format

**Message**: "Furniture ID must be in namespaced format (modId:identifier)"
**Cause**: Furniture ID doesn't follow the required format
**Solution**: Ensure furniture ID follows pattern: `modId:identifier`
**Example**: `furniture:couch`, `custom_mod:bench`

### PROX-002: Invalid Actor ID Format

**Message**: "Actor ID must be in namespaced format (modId:identifier)"
**Cause**: Actor ID doesn't follow the required format
**Solution**: Ensure actor ID follows pattern: `modId:identifier`
**Example**: `game:alice`, `npc:bob`

### PROX-003: Invalid Spot Index

**Message**: "Spot index must be a non-negative integer between 0 and 9"
**Cause**: Spot index is out of valid range
**Solution**: Use integer values 0-9 for spot index

## Component State Errors

### PROX-101: Missing Furniture Component

**Message**: "Furniture {id} missing allows_sitting component"
**Cause**: Furniture entity exists but lacks allows_sitting component
**Solution**: Ensure furniture has been properly initialized with allows_sitting

### PROX-102: Empty Spots Array

**Message**: "Furniture {id} has empty spots array"
**Cause**: Furniture component has spots=[] (no capacity)
**Solution**: Initialize furniture with at least one spot

### PROX-103: Duplicate Partners

**Message**: "Actor {id} has duplicate partners in closeness component"
**Cause**: Partners array contains duplicate entity IDs
**Solution**: Remove duplicates from partners array

### PROX-104: Self-Reference in Closeness

**Message**: "Actor {id} cannot be partner with themselves"
**Cause**: Actor's partners array includes their own ID
**Solution**: Remove self-reference from partners array

## Consistency Errors

### PROX-201: Unidirectional Closeness

**Message**: "Unidirectional closeness detected: {A} → {B} but not reverse"
**Cause**: Closeness relationship exists in only one direction
**Solution**: Ensure both actors have each other as partners

### PROX-202: Orphaned Movement Lock

**Message**: "{id} has movement locked but no closeness partners or sitting state"
**Cause**: Entity has locked movement without justification
**Solution**: Unlock movement or establish proper relationships

### PROX-203: Sitting Component Mismatch

**Message**: "Sitting component mismatch for {id}"
**Cause**: Actor's sitting component doesn't match furniture occupancy
**Solution**: Synchronize sitting component with furniture spots
