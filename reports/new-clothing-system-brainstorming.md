# Clothing System Brainstorming

We want to implement a clothing system that relies on the existing anatomy system.

## Clothing System Integration Assessment in the Anatomy System

### What Can Be Reused

1. **Socket System** - Perfect for equipment slots
2. **Validation Framework** - Extend for clothing rules
3. **Graph Algorithms** - Traverse equipped items

### Idea: Socket System Enhancement for Layering

```javascript
// Current: Single occupancy
isSocketOccupied(parentId, socketId);

// Enhanced: Layer-aware
isSocketOccupied(parentId, socketId, layer);
getSocketOccupants(parentId, socketId); // Returns all layers
```

### Clothing items as entities

We intend for each clothing item (a sock, a jacket, a pair of sunglasses) to be entities. That will make the Entity/Component system of the rest of the app be able to treat them in a way that other system could pick the items up, equip or unequip them, and esoteric stuff like burning them or making them degrade.

Entities in our app are solely containers with two properties: id and components, so we would need components to depict the following:

Clothing type: "sock", "jacket", "sunglasses", etc.

To what layer they're assigned: "base", "underwear", etc.

What slots they cover: "torso" (is 'torso' a slot? Would need to figure out how the root is actually sotred), "left_arm", "right_arm"...

Notes on the slots to cover: a piece of clothing should have a required slot to cover: for example, the torso. But also other slots they cover: e.g. "left_arm". The system should be strong enough to allow things like equipping a jacket, that would cover torso and arms, but be equippable in people who lack arms, but that have a torso.

Would need to figure out how to handle ambiguities in the body parts that are covered. For example, "boxers" could cover "penis", "left_testicle", "right_testicle", "asshole". But surely they can also cover "vagina". No reason why a woman wouldn't be able to equip a pair of boxers.

How to depict layering? For example, lower body: there should be a layer for underwear, and another for whatever a pair of pants is considered. But what if the entity is wearing outerwear like "pants", but nothing in the "underwear" layer? Is that a problem if the character could otherwise put on a pair of boxers? Perhaps that should be handled entirely through action prerequisites; for example, checking that there's no layer occupied above the underwear layer.

Perhaps there should be a 'size' component. Obviously a shirt for an adult would fit well on a toddler.

All the clothes entities and clothing-related JSON definitions should go in a new 'clothing' mod.
