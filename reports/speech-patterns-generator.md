# Feature Requirements for Speech Patterns Generator

We want to create a new page for the 'Character Builder' series. This new page will be about generating speech patterns. It should have its own button in index.html, after all the other buttons of the 'Character Builder' series.

This new page should use as reference other pages and their code, that generate content through large language models: cliches-generator.html , core-motivations-generator.html , thematic-direction-generator.html , and traits-generator.html . The prompt for this new page should be very similar. The content guidelines (indicating that this app is for adults) should be used verbatim.

Although other pages allow the user to select among the existing thematic directions, this new page for generating speech patterns will be much simpler: the user will have a textarea or similar element to introduce an existing character definition. The following is an example of the kind of character definitions that the user may include (always in JSON):

{
    "$schema": "http://example.com/schemas/entity-definition.schema.json",
    "id": "p_erotica:ane_arrieta",
    "components": {
        "core:name": {
            "text": "Ane Arrieta"
        },
        "core:portrait": {
            "imagePath": "portraits/ane_arrieta.png",
            "altText": "Ane Arrieta - A young woman with red hair in pigtails, brown eyes, and a youthful face"
        },
        "core:profile": {
            "text": "Ane is short, and usually wears her red hair in pigtails. Living in the poorest district of Irún..."
        },
        "core:personality": {
            "text": "Ane has become so skilled at reading and reflecting what others want to see..."
        },
        "core:strengths": {
            "text": "Psychological profiling expertise from reading men's desires and weaknesses."
        },
        "core:weaknesses": {
            "text": "Inability to distinguish between transactional and genuine affection. Pathological need to maintain impossible standards that prevent real connection. Dangerous overconfidence in her ability to control men who hold actual power over her."
        },
        "core:likes": {
            "text": "American romance movies that reinforce her rescue fantasies. Expensive makeup samples stolen from department stores. The sound of coins clinking in her hidden savings jar. Moments when clients seem to forget they're paying her. Stories of other girls who 'made it out' through relationships."
        },
        "core:dislikes": {
            "text": "Men who try to haggle or negotiate her established prices. Being referred to as anyone's daughter or compared to family members. Women who judge her choices while having more options. Rain that ruins her carefully maintained appearance. Questions about her future plans beyond finding her 'savior'."
        },
        "core:fears": {
            "text": "That she's created such an impossible standard for her 'worthy' man that he doesn't exist, meaning she'll grow old and worthless while waiting."
        },
        "core:goals": {
            "goals": [
                {
                    "text": "Save enough money to buy a real designer outfit for special occasions."
                },
                {
                    "text": "Find a regular client willing to pay premium rates for exclusive access."
                }
            ]
        },
        "core:secrets": {
            "text": "She practices conversations with her imaginary perfect man in the mirror, rehearsing how she'll confess her past and why it makes her more valuable rather than less."
        },
        "core:speech_patterns": {
            "patterns": []
        },
        "anatomy:body": {
            "recipeId": "p_erotica:ane_arrieta_recipe"
        },
        "core:perception_log": {
            "maxEntries": 50,
            "logEntries": []
        },
        "core:actor": {},
        "core:player_type": {
            "type": "human"
        },
        "core:notes": {
            "notes": [
                {
                    "text": "Ane's mother cleans floors for the French border guard at night.",
                    "subject": "mother",
                    "subjectType": "character",
                    "context": "my mother's job"
                },
                {
                    "text": "Ane's loser mother does little else recently than drink herself into a stupor soon after she gets home from her dead-end job. All that yelling, the slurred words and attacks... Ane wishes she didn't have to return home at all. The worst is when she's lying in bed in the dark with earplugs on and she still hears her mother yelling. Ane understands why her father left.",
                    "subject": "mother",
                    "subjectType": "character",
                    "context": "resentment about my mother's failures"
                }
            ]
        },
        "core:apparent_age": {
            "minAge": 18,
            "maxAge": 20
        }
    }
}

----

In the prompt, enforced by the JSON schema for the response, the instructions should indicate that the LLM should provide with about 20 examples of unique phrases, verbal tics, recurring metaphors, or a characteristic communication style (e. g., overly formal, clipped and pragmatic, prone to ironic understatement). These speech patterns should reflect the provided character's whole persona. Avoid just assigning an accent.

All generated speech patterns should include snippets of the character's voice as if they were speaking. If necessary, a speech pattern should preface the snippet of the character's voice with an indication, in parentheses, of the circumstances where such speech or utterances would be common. Examples:

"(When comfortable, slipping into a more genuine, playful tone) 'Oh! That's absolutely brilliant!' or 'You've got to be kidding me!'",
"(Using vulgarity as armor) 'I'm not some fucking kid, I know exactly what I'm doing.'",
"(A rare, unguarded moment of curiosity) '...You really think that? Huh. Most people don't think at all.'",
"(Flirtatious, but with an edge) 'You like that, huh? Everyone does. It's my best feature... besides my mouth, of course.'",
"(On the fantasy) 'He'll be... solid. Not like these shaky, nervous boys. He'll know what he wants and he'll know I'm worth it.'"

The generated speech patterns shouldn't be stored, just displayed. However, there should be an option to export it into text.

Note: given that this is a chat-based app, in which the large language models will communicate through text, speaking as their assigned characters, creating unique, memorable, distinct speech patterns is vital.