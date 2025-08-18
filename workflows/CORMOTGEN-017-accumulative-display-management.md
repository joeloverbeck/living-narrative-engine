# CORMOTGEN-017: Add Accumulative Display Management

## Ticket ID

CORMOTGEN-017

## Title

Implement accumulative display management for motivation blocks

## Status

TODO

## Priority

HIGH

## Estimated Effort

3-4 hours

## Dependencies

- CORMOTGEN-015 (Display components)
- CORMOTGEN-004 (Controller)

## Description

Implement the accumulative display pattern where new motivations are added to existing ones rather than replacing them (key differentiator from clichés).

## Technical Requirements

### Key Features

1. **Accumulative Logic**
   - New motivations prepend to list
   - Existing motivations remain
   - No automatic replacement
   - Manual deletion only

2. **Display Management**

   ```javascript
   class AccumulativeDisplayManager {
     #motivations = [];

     addMotivations(newMotivations) {
       // Prepend new to existing
       // Maintain chronological order
       // Update display
     }

     removeMotivation(id) {
       // Remove single item
       // Update indices
       // Animate removal
     }

     clearAll() {
       // Remove all with confirmation
       // Batch animation
     }
   }
   ```

3. **Sorting & Filtering**
   - Newest first (default)
   - Oldest first option
   - Search/filter capability

4. **Performance**
   - Virtual scrolling for many items
   - Lazy rendering
   - Batch DOM updates

## Implementation Steps

1. Create display manager
2. Implement accumulation logic
3. Add sorting capabilities
4. Handle batch operations
5. Optimize for many items
6. Add search/filter

## Validation Criteria

- [ ] New motivations accumulate
- [ ] Order is maintained
- [ ] Deletion works correctly
- [ ] Performance with 50+ items
- [ ] Search/filter works
- [ ] Clear all with confirmation

## Checklist

- [ ] Create manager class
- [ ] Implement accumulation
- [ ] Add sorting
- [ ] Handle deletions
- [ ] Optimize performance
- [ ] Add search
- [ ] Test with many items
