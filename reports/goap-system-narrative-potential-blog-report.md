# The GOAP System: Teaching NPCs to Think (and Tell Better Stories)

## A Blog Report on Living Narrative Engine's New AI Decision-Making System

_Written for readers interested in AI, storytelling, and game development_

---

## What is GOAP? (In Human Terms)

Imagine you're watching a character in a story who's hungry. They don't just magically teleport to the nearest restaurant. They think: "I need food. There's a sandwich in the kitchen. But first, I need to get up from this chair, walk to the kitchen, and open the fridge." That's essentially what GOAP (Goal-Oriented Action Planning) does for NPCs (non-player characters) in games.

**GOAP is a system that lets AI characters figure out how to achieve their goals by planning a series of actions**, much like how you or I would solve a problem. Instead of following pre-programmed scripts, characters can reason about what they want and figure out the steps to get there.

In the Living Narrative Engine, this system is now fully implemented and working. After months of development, all three architectural tiers are complete, tested, and ready to transform how characters behave in narrative games.

---

## The Problem Before GOAP

Before GOAP, creating believable AI behavior was like writing a gigantic flowchart of "if this, then that" rules. Want an NPC to find food when hungry?

**Old way:**

```
IF hungry AND food_nearby:
  → walk to food
  → pick up food
  → eat food
```

Seems simple, right? But what if:

- The food is in a locked container?
- The character needs to pick up a key first?
- The character is sitting and needs to stand up?
- There are multiple ways to get food?

You'd need dozens of rules for every possible situation. It quickly becomes a nightmare to maintain, and characters feel robotic because they can only do exactly what you programmed, nothing more.

---

## What GOAP Changes: Characters That Think

With GOAP, you don't tell characters _how_ to do things—you tell them _what_ they can do, and they figure out the rest.

**The GOAP Way:**

**You define:**

- **Goals**: "I want to have food" or "I want to rest safely"
- **Actions**: "Pick up item," "Open container," "Stand up," "Move to location"
- **Effects**: What each action changes in the world

**The AI figures out:**

- Which actions will help achieve the goal
- The correct order to perform them
- Alternative paths if the first plan doesn't work

### A Real Example: The Hungry Cat

One of the end-to-end tests in the system demonstrates a cat NPC with a "find food" goal. The cat:

1. **Recognizes** it's hungry (goal becomes relevant)
2. **Evaluates** available actions (pick up food, search container, etc.)
3. **Plans** which action brings it closer to having food
4. **Acts** by picking up a nearby food item

If the food were locked in a container, the cat would automatically:

1. Check if it can open the container
2. Open the container first
3. Then take the food

**You didn't program this specific sequence**. The cat figured it out based on understanding what actions are possible and what effects they have.

---

## What This Means for Modders

If you're creating content (or "mods") for the Living Narrative Engine, GOAP gives you superpowers:

### 1. **Define Actions, Not Scripts**

Instead of writing complex scripts for every situation, you define simple actions:

**Example: "Sit Down" Action**

- **What it does**: Removes "standing" state, adds "sitting" state
- **When it's available**: When the character is standing and near a chair

GOAP handles everything else. The character will automatically:

- Consider sitting when tired
- Stand up before walking if they're sitting
- Chain actions together naturally

### 2. **Mix and Match Content from Different Mods**

The system supports **cross-mod goals and actions**. This means:

- You create a "rest when tired" goal in your mod
- Someone else creates "lie down on bed" and "close door" actions in their mods
- Characters automatically combine these: close door → lie down → rest

**No coordination required**. The AI figures out how different mods' actions work together to achieve goals.

### 3. **Create Believable Motivations**

You can define character goals with priorities:

- **Critical (100+)**: Flee from danger, seek medical help
- **High (80-99)**: Combat, finding food when starving
- **Medium (60-79)**: Rest when tired, seek shelter
- **Low (40-59)**: Social interaction, grooming
- **Optional (20-39)**: Exploration, collecting items

Characters automatically pursue their highest-priority relevant goal. If a character is tired (60 priority) but suddenly becomes hungry (80 priority), they'll switch to finding food first. **This creates emergent, believable behavior.**

### 4. **Test Multiple Actors Simultaneously**

The system includes **multi-actor support** with smart caching. Tests show 5 actors can make independent decisions in under 5 seconds, with each actor's plans cached separately to improve performance.

---

## What This Means for Players

### Emergent Storytelling

Characters don't follow scripts—they respond to situations. This creates:

**Unexpected Moments:**

- A guard who's supposed to patrol might sit down because they're tired
- An NPC who notices you're injured might abandon their task to help
- Characters might form plans you didn't anticipate

**Reactive Behavior:**

- NPCs adapt to world changes
- If you take the food they were going to get, they find another way
- Characters respond to your actions in contextually appropriate ways

### Consistent Character Behavior

The system includes **plan caching and multi-turn goal achievement**. This means:

- Characters remember their plans across turns
- They persist in pursuing goals until achieved
- Behavior remains consistent unless the world changes

If a character decides to rest, they'll follow through: find a bed, lie down, and rest. They won't randomly change their mind unless something more important happens.

---

## The Narrative Potential

This is where GOAP becomes truly exciting for storytelling:

### 1. **Character-Driven Stories**

Instead of railroading players through pre-scripted sequences, stories can emerge from character motivations:

- A villain isn't just "evil"—they have goals (power, revenge, safety) and will take sensible actions to achieve them
- Allies don't just follow you—they have their own needs and will act on them
- Every character becomes a potential plot thread

### 2. **Meaningful Choices**

Player decisions have weight because NPCs respond intelligently:

- Steal someone's food → they seek alternative food sources → maybe they steal from someone else → chain reactions
- Help someone achieve their goal → they remember and might reciprocate
- Block someone's plans → they adapt and try alternative approaches

### 3. **Living Worlds**

The world feels alive because characters are actively pursuing goals even when you're not watching:

- Merchants restock inventory when supplies run low
- Guards patrol but take breaks when tired
- NPCs form relationships based on shared goals and repeated interactions

### 4. **Complex Scenarios Without Complex Code**

Want to create a scenario where:

- NPCs negotiate for resources?
- Characters form alliances based on complementary goals?
- A character pursues revenge but struggles with moral constraints?

With GOAP, you define the goals and constraints. The AI figures out the behavior. **You focus on storytelling, not programming edge cases.**

---

## Real Examples from the System

The GOAP implementation includes several behavioral tests that demonstrate the potential:

### The Cat and the Food

**Scenario**: Cat is hungry, food is on the floor
**Goal**: Acquire food (priority: 80)
**Result**: Cat identifies "pick up food" as the best action and executes it

**What makes this special**: If the food were in a container, the cat would automatically plan: open container → take food. No special programming needed.

### The Goblin Warrior

**Scenario**: Goblin encounters combat situation
**Goal**: Be prepared for combat
**Available Actions**: Pick up weapon, attack, defend, flee
**Result**: Goblin evaluates current state (unarmed) and picks up weapon before engaging

**What makes this special**: The goblin reasons about prerequisites. It doesn't blindly attack—it first ensures it has the tools to succeed.

---

## Technical Achievements (Simplified)

For those curious about how this works under the hood:

### Three-Tier Architecture

1. **Tier 1: Effects Auto-Generation**
   - Analyzes game rules to understand what actions actually do
   - Automatically generates planning metadata
   - No manual annotation needed

2. **Tier 2: Goal-Based Action Selection**
   - Evaluates which actions move characters closer to goals
   - Simulates action outcomes to predict results
   - Selects optimal actions based on goal progress

3. **Tier 3: Multi-Step Planning & Optimization**
   - Plans sequences of actions across multiple turns
   - Caches plans for performance
   - Handles multiple actors making concurrent decisions
   - Recovers gracefully from failures

### Smart Performance

- **Plan caching**: Once a character figures out a plan, it's saved and reused
- **Selective invalidation**: Only affected plans are recalculated when the world changes
- **Multi-actor isolation**: Multiple characters can plan simultaneously without interfering
- **Proven performance**: 5 actors complete decision-making in under 5 seconds

### Comprehensive Testing

The system includes **15 end-to-end tests** covering:

- Complete decision workflows with real game mods
- Goal relevance and satisfaction checking
- Multi-turn goal achievement
- Cross-mod action and goal compatibility
- Error recovery and graceful degradation
- Performance under load

**Test coverage**: 90%+ branches, 95%+ lines for critical components. This isn't experimental—it's production-ready.

---

## What's Next?

The GOAP system is fully implemented and tested. Here's what this enables:

### Immediate Opportunities

1. **Richer Mods**: Content creators can define sophisticated AI behaviors without complex scripting
2. **Emergent Gameplay**: Players experience stories that unfold based on character decisions, not scripts
3. **Easier Development**: Creating believable NPCs becomes dramatically simpler

### Future Possibilities

1. **Social Goals**: Characters pursuing relationships, status, or influence
2. **Long-Term Planning**: Goals that span hours or days of game time
3. **Learning and Adaptation**: Characters whose priorities shift based on experiences
4. **Collaborative AI**: Multiple characters coordinating on shared goals

### Integration with Other Systems

GOAP integrates with the engine's existing systems:

- **Event System**: Planning decisions trigger events that other systems can respond to
- **Memory System**: Characters remember past successes and failures
- **Action System**: Works seamlessly with the existing 200+ actions across mods
- **Rule System**: Analyzes existing rules without requiring rewrites

---

## Why This Matters

### For Storytellers

GOAP gives you characters that feel alive. Instead of puppets following scripts, you get actors with agency who make decisions based on their needs and circumstances. **Your stories become dynamic and emergent rather than fixed and predictable.**

### For Players

You get to experience stories that respond to you. Characters aren't following invisible rails—they're making choices based on their situation. Every playthrough can unfold differently because characters adapt and respond to changing circumstances.

### For Developers

Building believable AI becomes dramatically simpler. Instead of writing thousands of lines of conditional logic, you define goals and actions. The system handles the complexity of figuring out how to achieve those goals.

---

## The Bigger Picture

AI in games has traditionally been about smoke and mirrors—making NPCs seem smart through carefully scripted sequences. GOAP represents a different approach: **give characters the tools to reason about their world and let them figure out how to achieve their goals**.

This aligns perfectly with the Living Narrative Engine's philosophy: **create systems that enable emergent stories rather than prescribing specific narratives**. With GOAP, characters become collaborators in storytelling, not just props.

### A Note on AI and LLMs

The Living Narrative Engine already uses Large Language Models (like Claude and GPT) for character dialogue and thoughts. GOAP complements this by handling the _decision-making_ aspect. Think of it as:

- **LLMs**: Generate what characters _say_ and _think_
- **GOAP**: Determine what characters _want_ and _do_

Together, these create characters who think, speak, and act in coherent, goal-driven ways. They're not just chatbots—they're agents pursuing objectives in a simulated world.

---

## Try It Yourself

The Living Narrative Engine is open source and available now. The GOAP system is fully integrated and ready to use. If you're interested in:

- Creating narrative games with intelligent NPCs
- Experimenting with emergent storytelling
- Building mods with sophisticated AI behavior
- Contributing to an AI-driven narrative platform

The code is on GitHub, documented and tested. The GOAP docs at `docs/goap/` provide complete guides for:

- Understanding the system architecture
- Creating goals and actions
- Testing AI behavior
- Troubleshooting common issues

---

## Final Thoughts

GOAP represents months of development work: designing the architecture, implementing three complete tiers, writing comprehensive tests, and documenting everything. But the real achievement isn't the code—it's what it enables.

**It enables stories where characters have agency.**

**It enables worlds that feel alive.**

**It enables gameplay that adapts and responds.**

**It enables narratives that emerge from character decisions rather than following predetermined scripts.**

This is the future of narrative games: not scripted sequences, but simulated worlds where characters pursue their goals and stories emerge from their choices. The technology is here, implemented, tested, and ready.

Now comes the fun part: seeing what stories people tell with it.

---

## Technical Resources

For those who want to dive deeper:

- **Full Documentation**: `/docs/goap/README.md`
- **Test Examples**: `/tests/e2e/goap/`
- **Operation Reference**: `/docs/goap/operation-mapping.md`
- **Planning System Details**: `/docs/goap/planning-system.md`
- **Effects System Guide**: `/docs/goap/effects-system.md`
- **Troubleshooting**: `/docs/goap/troubleshooting.md`

The system is fully documented with examples, test cases, and integration guides. Everything you need to understand and use GOAP is included.

---

_This report was created as part of Living Narrative Engine development documentation, analyzing the GOAP system's capabilities and potential for narrative gaming._
