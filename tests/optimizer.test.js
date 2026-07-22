import test from 'node:test';
import assert from 'node:assert/strict';
import { optimizePrompt } from '../src/optimizer-v2.js';

test('balanced mode preserves the original request and adds structure', () => {
  const result = optimizePrompt({
    prompt: 'Crée-moi un site pour vendre des ebooks',
    mode: 'balanced',
    target_model: 'chatgpt'
  });

  assert.match(result.optimized_prompt, /Crée-moi un site pour vendre des ebooks/);
  assert.match(result.optimized_prompt, /Mission|Objectif/);
  assert.equal(result.mode, 'balanced');
  assert.equal(result.target_model, 'chatgpt');
  assert.ok(result.score_after > result.score_before);
});

test('deep mode is more detailed than fast mode', () => {
  const fast = optimizePrompt({ prompt: 'Write a product page', mode: 'fast', language: 'en' });
  const deep = optimizePrompt({ prompt: 'Write a product page', mode: 'deep', language: 'en' });

  assert.ok(deep.optimized_prompt.length > fast.optimized_prompt.length);
  assert.match(deep.optimized_prompt, /Self-review/);
});

test('detects missing audience, output format, constraints, and success criteria', () => {
  const result = optimizePrompt({ prompt: 'Fais une campagne marketing', language: 'fr' });

  assert.ok(result.missing_information.includes('Public cible'));
  assert.ok(result.missing_information.includes('Format de sortie'));
  assert.ok(result.missing_information.includes('Contraintes essentielles'));
  assert.ok(result.missing_information.includes('Critères de réussite'));
});

test('uses supplied hints instead of reporting them as missing', () => {
  const result = optimizePrompt({
    prompt: 'Crée une campagne marketing avec un budget de 500 euros et trois variantes',
    audience: 'Artisans locaux',
    output_format: 'Tableau',
    context: 'Lancement en septembre',
    language: 'fr'
  });

  assert.ok(!result.missing_information.includes('Public cible'));
  assert.ok(!result.missing_information.includes('Format de sortie'));
  assert.ok(!result.missing_information.includes('Contexte utile'));
  assert.match(result.optimized_prompt, /Artisans locaux/);
  assert.match(result.optimized_prompt, /Tableau/);
});

test('auto-detects French and English', () => {
  assert.equal(optimizePrompt({ prompt: 'Crée une stratégie claire pour mon entreprise' }).language, 'fr');
  assert.equal(optimizePrompt({ prompt: 'Create a clear strategy for my business' }).language, 'en');
});

test('keeps scores in the 0 to 100 range', () => {
  const result = optimizePrompt({ prompt: 'Analyse ceci', mode: 'deep' });

  assert.ok(result.score_before >= 0 && result.score_before <= 100);
  assert.ok(result.score_after >= 0 && result.score_after <= 100);
});

test('rejects an empty prompt', () => {
  assert.throws(() => optimizePrompt({ prompt: '  ' }), /prompt/i);
});

test('rejects unsupported modes', () => {
  assert.throws(() => optimizePrompt({ prompt: 'Analyse ceci', mode: 'extreme' }), /mode/i);
});

test('detects website prompts and injects website-specific guidance', () => {
  const result = optimizePrompt({
    prompt: 'Crée-moi un site moderne pour vendre des ebooks sur l’intelligence artificielle',
    mode: 'balanced',
    language: 'fr'
  });

  assert.equal(result.detected_task_type, 'website');
  assert.match(result.optimized_prompt, /Pages attendues/);
  assert.match(result.optimized_prompt, /Responsive/);
  assert.match(result.optimized_prompt, /conversion/i);
});

test('detects image generation prompts and injects visual guidance', () => {
  const result = optimizePrompt({
    prompt: 'Generate a cinematic image of a futuristic library at night',
    mode: 'balanced',
    language: 'en'
  });

  assert.equal(result.detected_task_type, 'image_generation');
  assert.match(result.optimized_prompt, /Composition/);
  assert.match(result.optimized_prompt, /Lighting/);
  assert.match(result.optimized_prompt, /Aspect ratio/);
});

test('returns clarification questions aligned with missing information', () => {
  const result = optimizePrompt({
    prompt: 'Fais une campagne marketing',
    language: 'fr'
  });

  assert.ok(Array.isArray(result.clarifying_questions));
  assert.ok(result.clarifying_questions.length > 0);
  assert.match(result.clarifying_questions[0], /public|cible|format|objectif/i);
});

test('falls back to general for ambiguous requests', () => {
  const result = optimizePrompt({ prompt: 'Aide-moi à améliorer ceci', language: 'fr' });
  assert.equal(result.detected_task_type, 'general');
});
