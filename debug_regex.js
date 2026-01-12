const action = "Fire in the foreground, Afsaar (IMAGE 2) beyond, her face lit by the fire. She looks upwards, and casts the blue gravel into the fire with a flourish. The fire sparks and flares upwards into crackling blue flame. Materializing out of the fire - Quiren towers over Afsaar (IMAGE 2).";

console.log("Original:", action);

const sentences = action.match(/[^.!?]+[.!?]+/g);
console.log("Sentences found:", sentences ? sentences.length : 0);

if (sentences && sentences.length > 0) {
    const firstSentence = sentences[0].trim();
    console.log("First Sentence:", firstSentence);
} else {
    console.log("No match found.");
}
