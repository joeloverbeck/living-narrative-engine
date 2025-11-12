# ARMSYSANA-009: Test Armor with Real Scenarios

**Phase**: Phase 4 - Testing with Real Scenarios
**Priority**: High
**Risk Level**: Low (Validation only)
**Estimated Effort**: 90 minutes

## Context

With armor entities created and the system fully implemented, it's essential to test armor in realistic gameplay scenarios. This validates that:
1. Armor works correctly in actual game situations
2. Coverage resolution behaves as expected
3. Action text generation properly describes armored characters
4. Edge cases are handled correctly
5. The player experience is good

## Objective

Create test characters with various armor configurations and verify that all aspects of the armor system work correctly in real gameplay scenarios.

## Test Characters to Create

### Character 1: Fully Armored Knight

**Configuration**:
- **Name**: Sir Galahad
- **Underwear**: None
- **Base**: Linen shirt, wool pants
- **Armor**: Steel cuirass, steel gauntlets, iron helmet, leather boots
- **Outer**: None
- **Expected Visibility**: All armor pieces should be visible

**Test File**: `tests/manual/armor/fully-armored-knight.test.js`

```javascript
describe('Fully Armored Knight Scenario', () => {
  let world, knight;

  beforeEach(() => {
    world = createTestWorld();
    knight = createCharacter({
      name: 'Sir Galahad',
      equipment: {
        torso_upper: 'armor:steel_cuirass',
        hands: 'armor:steel_gauntlets',
        head_gear: 'armor:iron_helmet',
        feet: 'armor:leather_boots',
      },
      clothing: {
        base_shirt: 'clothing:linen_shirt',
        base_pants: 'clothing:wool_pants',
      }
    });
  });

  it('should show all armor pieces in description', () => {
    const description = getCharacterAppearance(knight.id);
    expect(description).toContain('steel cuirass');
    expect(description).toContain('steel gauntlets');
    expect(description).toContain('iron helmet');
    expect(description).toContain('leather boots');
  });

  it('should hide base clothing under armor', () => {
    const description = getCharacterAppearance(knight.id);
    expect(description).not.toContain('linen shirt'); // Hidden by cuirass
    expect(description).not.toContain('wool pants');  // No leg armor, may be visible
  });

  it('should use armor in action text', () => {
    const action = performAction(knight.id, 'stand', {});
    expect(action.text).toMatch(/cuirass|armor/i);
  });
});
```

### Character 2: Rogue with Light Armor

**Configuration**:
- **Name**: Shadowblade
- **Underwear**: None
- **Base**: Black tunic, dark pants, soft boots
- **Armor**: Leather bracers only
- **Outer**: Dark cloak (hood up)
- **Expected Visibility**: Cloak most visible, bracers may be hidden by cloak

**Test File**: `tests/manual/armor/rogue-light-armor.test.js`

```javascript
describe('Rogue with Light Armor Scenario', () => {
  let world, rogue;

  beforeEach(() => {
    world = createTestWorld();
    rogue = createCharacter({
      name: 'Shadowblade',
      equipment: {
        left_arm_clothing: 'armor:leather_bracers',
        right_arm_clothing: 'armor:leather_bracers',
      },
      clothing: {
        base_torso: 'clothing:black_tunic',
        base_legs: 'clothing:dark_pants',
        base_feet: 'clothing:soft_boots',
        outer_torso: 'clothing:dark_cloak',
      }
    });
  });

  it('should show cloak as most visible outer layer', () => {
    const description = getCharacterAppearance(rogue.id);
    expect(description).toContain('dark cloak');
  });

  it('should handle bracers correctly with cloak', () => {
    const armCoverage = getCoverageForSlot(rogue.id, 'left_arm_clothing');
    // Cloak may or may not cover arms depending on cloak definition
    // This tests the resolution logic
    expect(armCoverage.layer).toMatch(/armor|outer/);
  });

  it('should show base clothing on legs (no armor)', () => {
    const legCoverage = getCoverageForSlot(rogue.id, 'legs');
    expect(legCoverage.layer).toBe('base');
  });
});
```

### Character 3: Mage with Armor Under Robes

**Configuration**:
- **Name**: Mordecai
- **Underwear**: None
- **Base**: Simple tunic, simple pants
- **Armor**: Chainmail hauberk (covers torso and arms)
- **Outer**: Flowing magical robes
- **Expected Visibility**: Robes most visible, chainmail hidden but present

**Test File**: `tests/manual/armor/mage-armored-robes.test.js`

```javascript
describe('Mage with Armor Under Robes Scenario', () => {
  let world, mage;

  beforeEach(() => {
    world = createTestWorld();
    mage = createCharacter({
      name: 'Mordecai',
      equipment: {
        torso_upper: 'armor:chainmail_hauberk',
        left_arm_clothing: 'armor:chainmail_hauberk',
        right_arm_clothing: 'armor:chainmail_hauberk',
      },
      clothing: {
        base_torso: 'clothing:simple_tunic',
        base_legs: 'clothing:simple_pants',
        outer_torso: 'clothing:magical_robes',
      }
    });
  });

  it('should show robes as most visible layer', () => {
    const description = getCharacterAppearance(mage.id);
    expect(description).toContain('magical robes');
  });

  it('should hide chainmail under robes', () => {
    const description = getCharacterAppearance(mage.id);
    expect(description).not.toContain('chainmail');
  });

  it('should have chainmail present in equipment', () => {
    const equipment = getEquipment(mage.id);
    expect(equipment.torso_upper.id).toBe('armor:chainmail_hauberk');
  });

  it('should use correct priority: robes > chainmail > tunic', () => {
    const torsoCoverage = getCoverageForSlot(mage.id, 'torso_upper');
    expect(torsoCoverage.priority).toBe(100); // Outer layer
    expect(torsoCoverage.layer).toBe('outer');
  });
});
```

### Character 4: Warrior Without Outer Garments

**Configuration**:
- **Name**: Conan
- **Underwear**: None
- **Base**: Linen shirt, leather pants
- **Armor**: Steel cuirass, leather boots
- **Outer**: None
- **Expected Visibility**: Armor should be visible, base clothing hidden by armor where covered

**Test File**: `tests/manual/armor/warrior-visible-armor.test.js`

```javascript
describe('Warrior with Visible Armor Scenario', () => {
  let world, warrior;

  beforeEach(() => {
    world = createTestWorld();
    warrior = createCharacter({
      name: 'Conan',
      equipment: {
        torso_upper: 'armor:steel_cuirass',
        feet: 'armor:leather_boots',
      },
      clothing: {
        base_torso: 'clothing:linen_shirt',
        base_legs: 'clothing:leather_pants',
      }
    });
  });

  it('should show armor as most visible (no outer layer)', () => {
    const torsoCoverage = getCoverageForSlot(warrior.id, 'torso_upper');
    expect(torsoCoverage.layer).toBe('armor');
    expect(torsoCoverage.item).toBe('armor:steel_cuirass');
  });

  it('should hide shirt under cuirass', () => {
    const description = getCharacterAppearance(warrior.id);
    expect(description).toContain('steel cuirass');
    expect(description).not.toContain('linen shirt');
  });

  it('should show leather pants (no leg armor)', () => {
    const legCoverage = getCoverageForSlot(warrior.id, 'legs');
    expect(legCoverage.layer).toBe('base');
  });
});
```

### Character 5: Mixed Equipment Layers

**Configuration**:
- **Name**: Ranger
- **Underwear**: Light undergarments
- **Base**: Forest green tunic, dark brown pants
- **Armor**: Leather bracers, leather boots
- **Outer**: Travel cloak (only on torso)
- **Accessories**: Leather belt, fingerless gloves
- **Expected Visibility**: Complex layering across different body parts

**Test File**: `tests/manual/armor/ranger-mixed-layers.test.js`

```javascript
describe('Ranger with Mixed Layers Scenario', () => {
  let world, ranger;

  beforeEach(() => {
    world = createTestWorld();
    ranger = createCharacter({
      name: 'Ranger',
      equipment: {
        torso_upper: 'clothing:forest_green_tunic',
        legs: 'clothing:dark_brown_pants',
        left_arm_clothing: 'armor:leather_bracers',
        right_arm_clothing: 'armor:leather_bracers',
        feet: 'armor:leather_boots',
        outer_torso: 'clothing:travel_cloak',
      },
      accessories: {
        waist: 'accessories:leather_belt',
        hands: 'accessories:fingerless_gloves',
      }
    });
  });

  it('should show cloak on torso (outer > armor > base)', () => {
    const torsoCoverage = getCoverageForSlot(ranger.id, 'torso_upper');
    expect(torsoCoverage.layer).toBe('outer');
  });

  it('should show leather bracers on arms (armor > base)', () => {
    const armCoverage = getCoverageForSlot(ranger.id, 'left_arm_clothing');
    expect(armCoverage.layer).toBe('armor');
  });

  it('should show leather boots on feet (armor)', () => {
    const feetCoverage = getCoverageForSlot(ranger.id, 'feet');
    expect(feetCoverage.layer).toBe('armor');
  });

  it('should show pants on legs (base, no armor)', () => {
    const legCoverage = getCoverageForSlot(ranger.id, 'legs');
    expect(legCoverage.layer).toBe('base');
  });
});
```

## Action Text Generation Tests

Test that armor appears correctly in generated action text:

### Test Suite: Action Text with Armor

**Test File**: `tests/manual/armor/action-text-generation.test.js`

```javascript
describe('Action Text Generation with Armor', () => {
  describe('Movement Actions', () => {
    it('should mention armor in walking description', () => {
      const knight = createArmoredKnight();
      const action = performAction(knight.id, 'walk', { direction: 'north' });
      expect(action.text).toMatch(/armor|cuirass|clinks?|clanks?/i);
    });

    it('should describe armor weight affecting movement', () => {
      const knight = createArmoredKnight();
      const action = performAction(knight.id, 'run', {});
      expect(action.text).toMatch(/heavy|weighted|armored/i);
    });
  });

  describe('Combat Actions', () => {
    it('should mention armor in attack descriptions', () => {
      const knight = createArmoredKnight();
      const action = performAction(knight.id, 'attack', { target: 'orc' });
      expect(action.text).toMatch(/armored|cuirass|gauntlets?/i);
    });

    it('should describe armor in defense', () => {
      const knight = createArmoredKnight();
      const action = performAction(knight.id, 'defend', {});
      expect(action.text).toMatch(/armor|protected|steel/i);
    });
  });

  describe('Social Actions', () => {
    it('should mention armor in appearance descriptions', () => {
      const knight = createArmoredKnight();
      const action = performAction(knight.id, 'greet', { target: 'npc' });
      expect(action.text).toMatch(/armor|cuirass|armed/i);
    });

    it('should not mention hidden armor under robes', () => {
      const mage = createMageWithHiddenArmor();
      const action = performAction(mage.id, 'greet', { target: 'npc' });
      expect(action.text).toContain('robes');
      expect(action.text).not.toContain('chainmail');
    });
  });
});
```

## Coverage Resolution Edge Cases

Test edge cases in coverage resolution:

### Test Suite: Coverage Resolution Edge Cases

**Test File**: `tests/manual/armor/coverage-edge-cases.test.js`

```javascript
describe('Coverage Resolution Edge Cases', () => {
  it('should handle same-layer conflicts (two armor pieces on same slot)', () => {
    // This should not be possible with proper equipment logic
    // But test that system handles it gracefully
    const character = createCharacter({});
    expect(() => {
      equipItem(character.id, 'armor:steel_cuirass');
      equipItem(character.id, 'armor:leather_vest'); // Conflict
    }).toThrow(/already equipped|slot occupied/i);
  });

  it('should handle multi-slot armor (chainmail hauberk)', () => {
    const character = createCharacter({});
    equipItem(character.id, 'armor:chainmail_hauberk');

    const torsoCoverage = getCoverageForSlot(character.id, 'torso_upper');
    const armCoverage = getCoverageForSlot(character.id, 'left_arm_clothing');

    expect(torsoCoverage.item).toBe('armor:chainmail_hauberk');
    expect(armCoverage.item).toBe('armor:chainmail_hauberk');
  });

  it('should handle armor with no coverage mapping', () => {
    // Some armor may not have coverage_mapping component
    const character = createCharacter({});
    equipItem(character.id, 'armor:simple_helmet');

    const coverage = getCoverageForSlot(character.id, 'head_gear');
    expect(coverage).toBeDefined();
    expect(coverage.layer).toBe('armor');
  });

  it('should prioritize armor over accessories', () => {
    const character = createCharacter({});
    equipItem(character.id, 'accessories:leather_gloves'); // base layer
    equipItem(character.id, 'armor:steel_gauntlets'); // armor layer

    const handsCoverage = getCoverageForSlot(character.id, 'hands');
    expect(handsCoverage.layer).toBe('armor');
    expect(handsCoverage.item).toBe('armor:steel_gauntlets');
  });

  it('should handle removing armor (revert to lower layer)', () => {
    const character = createCharacter({
      equipment: {
        torso_upper: 'clothing:shirt',
      }
    });

    equipItem(character.id, 'armor:steel_cuirass');
    let coverage = getCoverageForSlot(character.id, 'torso_upper');
    expect(coverage.layer).toBe('armor');

    unequipItem(character.id, 'armor:steel_cuirass');
    coverage = getCoverageForSlot(character.id, 'torso_upper');
    expect(coverage.layer).toBe('base');
    expect(coverage.item).toBe('clothing:shirt');
  });
});
```

## Manual Testing Procedure

In addition to automated tests, perform these manual tests:

### Manual Test 1: Visual Inspection

1. Start the application
2. Create each test character
3. View character appearance
4. Verify armor is described correctly
5. Verify layering appears correct
6. Check for any odd descriptions

### Manual Test 2: Equipment Changes

1. Create a character
2. Equip base clothing
3. Equip armor pieces one by one
4. Observe description changes
5. Unequip armor pieces
6. Verify description reverts correctly

### Manual Test 3: Action Performance

1. Create armored character
2. Perform various actions (walk, run, attack, defend, sit, etc.)
3. Read generated action text
4. Verify armor is mentioned appropriately
5. Check for immersion breaks

### Manual Test 4: Save/Load

1. Create armored character
2. Save game
3. Load game
4. Verify armor is still equipped correctly
5. Verify coverage resolution still works

## Success Criteria

- [ ] All test character configurations created
- [ ] All automated tests pass
- [ ] Action text generation tests pass
- [ ] Coverage resolution edge case tests pass
- [ ] Manual testing completed successfully
- [ ] Armor visibility works as expected in all scenarios
- [ ] Coverage priority resolution is correct
- [ ] Action text appropriately describes armored characters
- [ ] No console errors or warnings
- [ ] Player experience is immersive and correct
- [ ] Save/load preserves armor state correctly

## Common Issues to Watch For

### Issue 1: Armor Not Visible When Expected

**Symptom**: Armor should be visible but is hidden

**Possible Causes**:
- Coverage priority incorrect
- Outer garment covering armor unexpectedly
- Coverage mapping not working

**Fix**: Review coverage resolution logic and priority values

### Issue 2: Action Text Doesn't Mention Armor

**Symptom**: Character wearing armor but text never mentions it

**Possible Causes**:
- Action text generation not checking armor layer
- Description system not recognizing armor

**Fix**: Update action text templates to include armor

### Issue 3: Conflicts Between Armor Pieces

**Symptom**: Can't equip multiple armor pieces

**Possible Causes**:
- Slot conflicts
- Equipment validation too strict

**Fix**: Review equipment slot logic and multi-slot handling

### Issue 4: Performance Degradation

**Symptom**: Game runs slower with armored characters

**Possible Causes**:
- Coverage resolution too expensive
- Too many layer checks

**Fix**: See ARMSYSANA-010 (Performance Testing)

## Documentation

Document the following:

1. **Test Results**
   - Which tests passed/failed
   - Any unexpected behavior
   - Screenshots if applicable

2. **Character Configurations**
   - Document what worked well
   - Note any problematic configurations
   - Suggest improvements

3. **Action Text Quality**
   - Examples of good armor descriptions
   - Examples of poor armor descriptions
   - Suggestions for improvement

4. **Edge Cases Found**
   - Document any new edge cases discovered
   - Note how they were handled
   - Create tickets if fixes needed

## Related Tickets

- **Previous**: ARMSYSANA-008 (Create Armor Examples)
- **Next**: ARMSYSANA-010 (Performance Testing)
- **Depends On**: ARMSYSANA-001 through ARMSYSANA-008

## Notes

This is a **critical validation ticket** - it tests armor in real-world scenarios that players will actually encounter.

Focus on:
1. **Player Experience**: Does armor feel right?
2. **Immersion**: Do descriptions make sense?
3. **Correctness**: Is priority resolution accurate?
4. **Edge Cases**: Do unusual configurations work?

Take time to thoroughly test various scenarios. Real-world testing often reveals issues that automated tests miss.

If issues are found, create follow-up tickets to address them before considering the armor system complete.

## Reference

Test scenarios are based on common sword & sorcery character archetypes:
- Heavily armored warrior (knight)
- Lightly armored rogue
- Robed spellcaster with hidden armor
- Barbarian with minimal armor
- Ranger with mixed equipment

These cover the most likely player configurations.
