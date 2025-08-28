# Rewrite Traits - Feature Requirements

We want to create a new page in our app. This page will be about rewriting the provided traits in the first-person perspective, in the voice of the character to whom the character definition belongs to.

This new page should have its own button in index.html, after all the other buttons of the 'Character Builder' section.

This new page will be similar to the speech-patterns-generator.html page. On the left, it will have a field that will allow the user to paste the character definition JSON. The code that speech-patterns-generator.html has to check the syntax of the pasted JSON, and make suggestions, could be refactored out so both pages would use it.

This new page will also send a prompt to the node API server, so that it makes a request to a large language model. The prompt should have a very similar structure (XML-like sections). The prompt will provide the entire character definition JSON, and specify that the goal is to rewrite the traits of the character definition JSON from the third person to a first-person in the voice of the character to whom the character definition belongs to. The first-person voice of the character should be heavily guided by the speech patterns included in the character definition.

The traits that should be rewritten by the LLM in the first person should be (if present in the original character definition JSON):

'core:likes'
'core:dislikes'
'core:fears'
'core:goals'
'core:notes'
'core:personality'
'core:profile'
'core:secrets'
'core:strengths'
'core:weaknesses'

Important: the prompt should specify that the rewrite should carry over all meaningful information from the original traits.

In the new page, in the right panel, after the LLM returns its response, the rewritten traits should be displayed in sections. E.g. a section for 'Likes', and then the rewritten text.

The new page should also provide functionality to extract the rewritten traits.

The goal of these rewrites is the following: in the main game, the LLM is prompted with the full character definition to choose an action, write speech and internal thoughts. We want those behaviors, speech and thoughts to be as unique to the character as possible, and having the traits in the character definition written from the character's perspective will help a lot to establish a unique voice for that character.
