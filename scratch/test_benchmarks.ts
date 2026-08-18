import { evaluateSpeech } from './test_scoring';

const testCases = [
  {
    name: "1. Perfect Native Speech",
    prompt: "Describe your favorite travel destination and explain why you love visiting it.",
    transcript: "Describe your favorite travel destination and explain why you love visiting it",
  },
  {
    name: "2. Good Speech (minor plural/tense difference)",
    prompt: "Describe your favorite travel destination and explain why you love visiting it.",
    transcript: "Describe your favorite travel destinations and explain why you love visiting it",
  },
  {
    name: "3. User Distorted Speech (Heavy distortion in first half)",
    prompt: "Describe your favorite travel destination and explain why you love visiting it.",
    transcript: "what your how far is there traffic Lee definitely on and explain where you love visiting it",
  },
  {
    name: "4. Completely Wrong / Gibberish Speech",
    prompt: "Describe your favorite travel destination and explain why you love visiting it.",
    transcript: "i want to eat banana and drink orange juice in the morning",
  }
];

testCases.forEach(tc => {
  console.log(`\n========================================`);
  console.log(`TEST: ${tc.name}`);
  const r = evaluateSpeech(tc.prompt, tc.transcript);
  console.log(`Score: ${r.overallScore}% | Pronunciation: ${r.pronunciation}% | Fluency: ${r.fluency}% | Grammar: ${r.grammar}% | Vocab: ${r.vocabulary}%`);
  console.log(`Weaknesses:\n${r.weaknesses}`);
});
