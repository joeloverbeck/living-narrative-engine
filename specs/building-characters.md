# Feature Requirements for Building Characters

## Step 1: Thematic directions

- The user provides a general idea for a character: e.g. "a ditzy female adventurer who's good with a bow"

- A prompt for the LLM should be something like this:

I have a basic character concept: [PROVIDED CHARACTER CONCEPT].

1. Help me brainstorm 3-5 distinct thematic directions or core tensions this character could embody
2. For each direction, suggest a unique twist or deeper archetype it could lean into, moving beyond the surface description.

Goal: to move beyond a simple descriptor to a concept with more inherent narrative potential and a clearer understanding of the character's possible function before detailing traits. This helps ensure originality has a purpose.

The app should ensure that each of these distinct thematic directions or core tensions are stored, maybe as plain JSON files. Given that the client-side uses http-client, perhaps there will be the requirement for the player to specify the folder where the JSON files should be stored (a folder which may contain previously-stored thematic directions/core tensions for characters.)

## Step 2: Cliché Deconstruction & Trope Identification

Based on the refined core concept from step 1, ask the LLM to identify common pitfalls.

Prompt idea:

- For a character centered around [THEMATIC DIRECTION/CORE TENSION FOR CHARACTER - FROM STEP 1], please list:

1. The most clichéd, common, and uninspired responses for the following categories: name, physical description, personality traits, skills/abilities, typical likes, typical dislikes, common fears, generic goals, predictable background/origin story elements, overused secrets, and common speech patterns or catchphrases associated with this type of character.
2. Common tropes and stereotypes often associated with such a character.

Goal: to create a comprehensive "what to avoid" list, not just for individual traits but also for narrative patterns.

In the app, the produced list of common clichés, etc. produced by the LLM should get linked to the [THEMATIC DIRECTION/CORE TENSION FOR CHARACTER] that was used to prompt the LLM to get the lists of clichés, etc.

The app should show somehow that a stored [THEMATIC DIRECTION/CORE TENSION FOR CHARACTER] already has list of clichés associated.

## Step 3: Brainstorming Core Motivations, Internal Contradictions, and a Central Question

- Action: This is a crucial new step to build a strong foundation for originality that isn't just "not cliché."
- This step will only be available in the app for [THEMATIC DIRECTION/CORE TENSION FOR CHARACTER] entries that have associated a list of clichés already generated.

- A prompt to be sent to the LLM could be something like this:

Based on the refined concept '[THEMATIC DIRECTION/CORE TENSION FOR CHARACTER]' and keeping in mind the clichés and tropes to avoid from [ASSOCIATED LIST OF CLICHÉS]:

Brainstorm 3-5 powerful and potentially unconventional core motivations for this character. What deeply drives them?
For each motivation, suggest one significant internal contradiction or an external conflict/dilemma that makes them complex and less predictable. (e.g., Motivation: 'Yearns for true freedom.' Contradiction: 'Is bound by an unbreakable oath made under duress,' or 'Deeply fears the responsibility that comes with freedom.')
Formulate a 'Central Question' that the character grapples with throughout their journey (e.g., 'Is it possible to achieve X without sacrificing Y?' or 'Can I become Z if I'm defined by W?')."

Goal: To establish the character's psychological and narrative core. Compelling characters often arise from such tensions and questions. This moves from "what the character is" to "what drives the character and what struggles define them."

This output from the LLM should also become associated to the [THEMATIC DIRECTION/CORE TENSION FOR CHARACTER] that was used to prompt the LLM for this step.

## Step 4: Generating Unique & Coherent Traits (Systematic Subversion & Creation)

Action: Now we populate the categories (name, description, likes, dislikes, etc.), but instead of just "rejecting" clichés in isolation, the LLM will be guided to create traits that embody the chosen core motivations and contradictions identified in Step 3, while simultaneously and consciously subverting the clichés from Step 2.

Prompt Idea (this will be a comprehensive prompt, addressing all your categories): "I am developing a character based on the following core elements:

Refined Concept: [THEMATIC DIRECTION/CORE TENSION FOR CHARACTER]

Chosen Core Motivation: [Although the user should be shown in the interface all the generated core motivations from Step 3, the user would need to write in his chosen text for the core motivation. e.g. 'To prove their worth on their own terms, not by fulfilling a predetermined path.']
Chosen Internal Contradiction/External Conflict: [Although the user should be shown in the interface all the generated internal contradictions and external conflict/dilemmas generated in Step 3, the user would write in his chosen one: e.g., 'They secretly fear they are only what the prophecy says, and any deviation is a path to failure.']
Central Question: [Although the user should be shown in the interface all the generated central questions that the character grapples with, from the output of Step 3, the user should write in his chosen one.: e.g., 'Can I forge my own legend, or am I just a puppet of fate?']
Clichés to Subvert: [ASSOCIATED LIST OF CLICHÉS]

Now, generate compelling, original, and unique details for this character in the following categories. Each detail should: a) Actively subvert or offer a fresh alternative to the identified clichés for that category. b) Be thematically consistent with the character's core motivation, contradiction, and central question. c) Contribute to a cohesive and intriguing whole.

- **Name**: Suggest 3-5 unique names. For each, provide a brief (1-sentence) justification for how it might reflect their personality, background, or the subversion of clichés. (Avoid names that are overly common for the cliché or overtly "fantasy generic" unless there's a specific ironic twist).
- **Physical Description**: Describe their appearance focusing on 2-3 distinctive features that subvert typical appearances for this archetype AND hint at their core motivation or contradiction. (e.g., Instead of 'graceful and elf-like archer,' perhaps 'surprisingly sturdy build with calloused hands from obsessive, non-elegant practice, and eyes that often look distant, contemplating their fate').
- **Personality**: Detail 3-5 key personality traits. Ensure these are not just anti-clichés but form a coherent, nuanced personality. Explain how each trait stems from or is influenced by their core motivation/contradiction. (e.g., If 'ditzy' was a cliché, the subversion isn't just 'super serious,' but perhaps 'selectively observant, appearing ditzy to disarm others or hide their internal scrutiny').
  Skills/Abilities: Beyond their main skill (e.g., archery), what are 1-2 unexpected or uniquely applied secondary skills? How do these skills subvert clichés and relate to their core? (e.g., The archer is also a surprisingly good cook of foraged food, a skill learned not from a 'wise mentor' cliché but from periods of rebellious self-isolation).
- **Likes**: List 3-5 likes that are specific and telling. How do these likes connect to their deeper motivations, offer them escape, or ironically contrast with their situation? Avoid generic likes.
- **Dislikes**: List 3-5 dislikes that are specific and reveal their sensitivities or principles. How do these relate to their core conflict or past experiences, and how do they avoid clichéd dislikes for the archetype?
- **Fears**: Identify 1-2 profound, specific fears (beyond generic 'fear of death/failure'). These should be deeply rooted in their core motivation, contradiction, or backstory, and be more nuanced than typical archetype fears.
- **Goals**: (Short-term & Long-term): What are 1-2 short-term goals and one major long-term goal? Ensure these are driven by their core motivation and complicated by their contradiction, and are not the standard goals for this character type.
- **Notes**: (Important Knowledge): What are 2-3 pieces of unique or unexpected knowledge, lore, or practical information this character possesses? How did they acquire it in a way that defies cliché and reveals character? (e.g., 'Knows the migratory patterns of a rare bird that surprisingly holds the key to a hidden path,' learned not from a scroll, but patient, lonely observation).
- **Profile** (Background Summary): Write a concise (3-5 sentence) background summary that explains their current situation, how they acquired their key skills/flaws, and the origin of their core motivation/contradiction. Focus on originality and avoid clichéd origin stories (e.g., 'chosen one from a destroyed village,' 'mysterious orphan with amnesia').
- **Secrets**: Describe 1-2 significant secrets the character harbors. These secrets should be potent, directly tied to their core motivation/contradiction or fears, and have the potential to significantly impact their relationships or choices. Make them more inventive than common "dark secrets."
- **Speech Patterns/Voice**: Provide 3-5 examples of unique phrases, verbal tics, recurring metaphors, or a characteristic communication style (e.g., overly formal, clipped and pragmatic, prone to ironic understatement). Explain how this speech pattern reflects their personality, background, and subverts typical speech for their archetype. Avoid just assigning an accent."

Goal: To have a rich, detailed, and interconnected set of traits that are original not just by avoiding clichés, but by being thoughtfully constructed around a compelling core.

The app should store the Name, Physical Description, Personality, etc. generated, associated to the original [THEMATIC DIRECTION/CORE TENSION FOR CHARACTER]

## Step 5: Weaving Interconnections and Adding Nuance

This would only be available in the app for [THEMATIC DIRECTION/CORE TENSION FOR CHARACTER] that has associated clichés created, associated core motivations, etc., and also associated categories (like Name, Physical Description, etc.) from Step 4.

Action: Review the generated character profile from Step 4. The LLM will now focus on deepening the connections between the traits.

Prompt Idea: "Review the character profile generated in Step 4: [Paste the full profile from Step 4].

Identify 3 pairs of traits (e.g., a fear and a like, a secret and a speech pattern, a skill and a personality trait) that could be more explicitly or subtly interconnected. Describe how these connections could manifest.

Suggest 2-3 specific nuances or subtle behaviors that arise from the interplay of their core motivation and contradiction. How might these manifest in quiet moments, under pressure, or in social interactions?

Propose one way a seemingly minor detail (like a specific 'like' or 'note') could actually have a more significant implication for their goals or how they react to a specific situation.

Are there any aspects that still feel a little generic or could be pushed further from the initial cliché list (from Step 1) without sacrificing coherence with the established core (from Step 2)? Suggest one specific refinement.

Suggest 2-3 truly unique and memorable quirks, habits, signature possessions, or non-verbal mannerisms. These should: Not be essential to their core personality or backstory but add an extra layer of distinctiveness. Ideally, be subtly linked to one of their existing traits (motivation, fear, skill, like/dislike) in an unexpected way. Avoid being a caricature or overshadowing their deeper complexities."

Goal: To ensure the character feels like a truly integrated and organic whole, rather than a list of interesting but separate attributes. This step adds layers and subtlety. The truly unique and memorable quirks, habits, etc. would add a final touch of individuality that makes the character unforgettable, without making them gimmicky.

With these steps, you should have a character that is not only original in its individual components but also possesses a coherent and compelling psychological depth, with traits that are interconnected and serve the character's core.

---

Notes about the feature:

- Real character work is iterative. I want the page to turn the "steps"”" into states the user can revisit. Surface a timeline or milestone view so they can jump, edit, or redo any node.
- Use a single local database (IndexedDB) or lightweight server store.
- There should be schemas for the contents: Character { id, concept, directions[], cliches[], motives[], traits[], nuances[]}, etc.
