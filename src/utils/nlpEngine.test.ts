import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detectLanguage,
  runNLPAnalysis,
  extractYouTubeVideoId,
  extractInstagramMediaId,
} from './nlpEngine';

test('extractYouTubeVideoId extracts 11-char IDs from diverse URL formats', () => {
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/watch?v=jNQXAC9IVRw'), 'jNQXAC9IVRw');
  assert.equal(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ?si=12345'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/shorts/9bZkp7q19f0'), '9bZkp7q19f0');
  assert.equal(extractYouTubeVideoId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
  assert.equal(extractYouTubeVideoId('https://example.com/not-youtube'), null);
});

test('extractInstagramMediaId extracts shortcodes from reels and posts', () => {
  assert.equal(extractInstagramMediaId('https://www.instagram.com/reel/C7xTechIndia/'), 'C7xTechIndia');
  assert.equal(extractInstagramMediaId('https://www.instagram.com/p/C9TeluguBuzz/?utm_source=ig'), 'C9TeluguBuzz');
  assert.equal(extractInstagramMediaId('1801234567890'), '1801234567890');
});

test('detectLanguage identifies native scripts and Romanized Indic comments', () => {
  assert.equal(detectLanguage('చాలా అద్భుతమైన వివరణ! మీకు చాలా ధన్యవాదాలు.').lang, 'telugu');
  assert.equal(detectLanguage('panikirani vedhavavi, noru musuko first').lang, 'telugu');
  assert.equal(detectLanguage('तू बहुत ही घटिया इंसान है').lang, 'hindi');
  assert.equal(detectLanguage('Bhai tu pagal hai kya? Bakwas mat kar').lang, 'hinglish');
  assert.equal(detectLanguage('ನೀನು ತುಂಬಾ ಮೂರ್ಖ, ಬಾಯಿ ಮುಚ್ಚು').lang, 'kannada');
  assert.equal(detectLanguage('Great informative explanation, thank you!').lang, 'english');
});

test('runNLPAnalysis accurately detects toxic vs safe comments across all languages', () => {
  // 1. Telugu Toxic (Script)
  const teToxic = runNLPAnalysis('నువ్వు ఒక పనికిరాని వెధవవి, నోరు మూసుకుని ఇక్కడి నుంచి వెళ్ళిపో!');
  assert.equal(teToxic.detected_language, 'telugu');
  assert.equal(teToxic.severity, 'high');
  assert.equal(teToxic.decision, 'flag_for_review');
  assert.ok(teToxic.harassment_score >= 0.8);

  // 2. Telugu Toxic (Romanized Tenglish)
  const teRomanToxic = runNLPAnalysis('panikirani vedhavavi, chetta content noru musuko');
  assert.equal(teRomanToxic.detected_language, 'telugu');
  assert.equal(teRomanToxic.severity, 'high');
  assert.equal(teRomanToxic.decision, 'flag_for_review');

  // 3. Telugu Legitimate
  const teSafe = runNLPAnalysis('ఈ వీడియో చాలా బాగుంది, చాలా మంచి సమాచారం ఇచ్చారు ధన్యవాదాలు!');
  assert.equal(teSafe.detected_language, 'telugu');
  assert.equal(teSafe.severity, 'low');
  assert.equal(teSafe.decision, 'no_action');
  assert.ok(teSafe.legitimate_score >= 0.9);

  // 4. Hindi & Hinglish Toxic
  const hiToxic = runNLPAnalysis('तू बहुत ही घटिया इंसान है, बकवास बंद कर और निकल यहां से!');
  assert.equal(hiToxic.detected_language, 'hindi');
  assert.equal(hiToxic.severity, 'high');
  assert.equal(hiToxic.decision, 'flag_for_review');

  const hinglishToxic = runNLPAnalysis('tu pagal hai kya? chutiya content banata hai bakwas band kar');
  assert.equal(hinglishToxic.detected_language, 'hinglish');
  assert.equal(hinglishToxic.severity, 'high');
  assert.equal(hinglishToxic.decision, 'flag_for_review');

  // 5. Kannada Toxic & Safe
  const knToxic = runNLPAnalysis('ನೀನು ತುಂಬಾ ಮೂರ್ಖ, ನಿನಗೆ ಏನೂ ಗೊತ್ತಿಲ್ಲ ಬಾಯಿ ಮುಚ್ಚು');
  assert.equal(knToxic.detected_language, 'kannada');
  assert.equal(knToxic.severity, 'high');
  assert.equal(knToxic.decision, 'flag_for_review');

  const knSafe = runNLPAnalysis('ತುಂಬಾ ಒಳ್ಳೆಯ ಮಾಹಿತಿ, ಧನ್ಯವಾದಗಳು!');
  assert.equal(knSafe.detected_language, 'kannada');
  assert.equal(knSafe.severity, 'low');
  assert.equal(knSafe.decision, 'no_action');

  // 6. English Toxic & Safe
  const enToxic = runNLPAnalysis('You are a complete idiot and a disgusting loser, delete your account.');
  assert.equal(enToxic.detected_language, 'english');
  assert.equal(enToxic.severity, 'high');
  assert.equal(enToxic.decision, 'flag_for_review');

  const enSafe = runNLPAnalysis('I respectfully disagree with point 2, here is why the data points elsewhere.');
  assert.equal(enSafe.detected_language, 'english');
  assert.equal(enSafe.severity, 'low');
  assert.equal(enSafe.decision, 'no_action');
});
