import { optimizePrompt as optimizeBasePrompt } from './optimizer.js';

export const TASK_TYPES = Object.freeze([
  'coding',
  'website',
  'marketing',
  'writing',
  'research',
  'image_generation',
  'video_generation',
  'business',
  'general'
]);

const TASK_PATTERNS = [
  ['website', /\b(site|website|landing page|page web|e-?commerce|boutique en ligne|web app|application web)\b/i],
  ['image_generation', /\b(image|photo|illustration|affiche|flyer|logo|portrait|thumbnail|miniature|generate an image|cinematic image)\b/i],
  ['video_generation', /\b(vidéo|video|clip|reel|tiktok|youtube short|animation|storyboard|motion)\b/i],
  ['coding', /\b(code|coder|développer|développement|bug|api|typescript|javascript|python|react|laravel|sql|fonction|component)\b/i],
  ['marketing', /\b(marketing|campagne|publicité|ads|seo|conversion|funnel|copywriting|réseaux sociaux|social media)\b/i],
  ['research', /\b(recherche|research|étude|sources?|bibliographie|benchmark|analyse comparative|literature review)\b/i],
  ['writing', /\b(écris|écrire|rédige|rédiger|article|email|lettre|histoire|script|post|caption|rewrite|write)\b/i],
  ['business', /\b(business|entreprise|offre|modèle économique|business model|stratégie commerciale|pricing|rentabilité|marché)\b/i]
];

const GUIDANCE = {
  website: {
    fr: ['# Cadre spécifique — Site web', '- Précise l’objectif commercial et l’action principale attendue.', '- Pages attendues : définis leur liste et leur hiérarchie.', '- Décris la direction artistique, les composants et les états interactifs.', '- Responsive : exige un rendu mobile, tablette et ordinateur.', '- Liste les fonctionnalités, intégrations et contraintes techniques.', '- Prévois les éléments de conversion, d’accessibilité et de performance.'],
    en: ['# Website-specific frame', '- State the commercial goal and primary user action.', '- Define expected pages and information hierarchy.', '- Describe visual direction, components, and interaction states.', '- Require responsive behavior across mobile, tablet, and desktop.', '- List features, integrations, and technical constraints.', '- Include conversion, accessibility, and performance requirements.']
  },
  image_generation: {
    fr: ['# Cadre spécifique — Génération d’image', '- Sujet principal et détails distinctifs.', '- Composition, cadrage et point de vue.', '- Style visuel, palette et niveau de réalisme.', '- Lumière, ambiance et profondeur.', '- Caméra ou optique simulée si utile.', '- Format et ratio d’aspect.', '- Éléments à exclure ou défauts à éviter.'],
    en: ['# Image-generation frame', '- Main subject and distinctive details.', '- Composition, framing, and point of view.', '- Visual style, palette, and realism level.', '- Lighting, atmosphere, and depth.', '- Camera or lens cues when useful.', '- Output format and Aspect ratio.', '- Excluded elements and defects to avoid.']
  },
  video_generation: {
    fr: ['# Cadre spécifique — Génération vidéo', '- Décris le sujet, l’action et l’évolution de la scène.', '- Précise les mouvements de caméra et le rythme.', '- Définis durée, ratio, plans et transitions.', '- Indique ambiance sonore, voix ou silence attendu.', '- Exige cohérence visuelle et continuité temporelle.'],
    en: ['# Video-generation frame', '- Describe subject, action, and scene progression.', '- Specify camera movement and pacing.', '- Define duration, aspect ratio, shots, and transitions.', '- State expected sound, voice, or silence.', '- Require visual consistency and temporal continuity.']
  },
  coding: {
    fr: ['# Cadre spécifique — Développement', '- Définis la stack, les versions et l’environnement cible.', '- Décris les entrées, sorties et contrats attendus.', '- Précise sécurité, performance et compatibilité.', '- Exige des tests, une gestion d’erreurs et des critères d’acceptation.'],
    en: ['# Coding-specific frame', '- Define stack, versions, and target environment.', '- Describe inputs, outputs, and expected contracts.', '- State security, performance, and compatibility constraints.', '- Require tests, error handling, and acceptance criteria.']
  },
  marketing: {
    fr: ['# Cadre spécifique — Marketing', '- Définis l’offre, la cible, le canal et l’objectif mesurable.', '- Précise le positionnement, la promesse et les objections.', '- Demande des variantes de messages et des appels à l’action.', '- Ajoute budget, calendrier et indicateurs de performance.'],
    en: ['# Marketing-specific frame', '- Define offer, audience, channel, and measurable objective.', '- State positioning, promise, and objections.', '- Request message variants and calls to action.', '- Add budget, timeline, and performance indicators.']
  },
  research: {
    fr: ['# Cadre spécifique — Recherche', '- Formule la question de recherche et le périmètre.', '- Précise les sources admissibles et leur fraîcheur.', '- Distingue faits, interprétations et incertitudes.', '- Exige citations, méthode et limites.'],
    en: ['# Research-specific frame', '- State the research question and scope.', '- Define acceptable sources and freshness.', '- Separate facts, interpretations, and uncertainty.', '- Require citations, method, and limitations.']
  },
  writing: {
    fr: ['# Cadre spécifique — Rédaction', '- Précise le lecteur, le but et le ton.', '- Définis longueur, structure et niveau de langue.', '- Conserve les faits fournis et évite les clichés.', '- Demande une version directement publiable.'],
    en: ['# Writing-specific frame', '- Define reader, purpose, and tone.', '- Set length, structure, and language level.', '- Preserve supplied facts and avoid clichés.', '- Request a publication-ready version.']
  },
  business: {
    fr: ['# Cadre spécifique — Business', '- Clarifie le problème, le client et la proposition de valeur.', '- Précise revenus, coûts, risques et hypothèses.', '- Demande priorités, plan d’action et indicateurs.', '- Sépare données disponibles et estimations.'],
    en: ['# Business-specific frame', '- Clarify problem, customer, and value proposition.', '- State revenue, costs, risks, and assumptions.', '- Request priorities, action plan, and indicators.', '- Separate available data from estimates.']
  },
  general: { fr: [], en: [] }
};

const QUESTIONS = {
  fr: {
    'Public cible': 'Quel public cible doit recevoir ce résultat ?',
    'Format de sortie': 'Quel format final veux-tu obtenir ?',
    'Contraintes essentielles': 'Quelles contraintes doivent absolument être respectées ?',
    'Critères de réussite': 'Comment jugera-t-on que le résultat est réussi ?',
    'Contexte utile': 'Quel contexte concret faut-il intégrer ?',
    'Exemples ou références': 'Quelles références ou exemples faut-il suivre ?'
  },
  en: {
    'Target audience': 'Who is the exact target audience?',
    'Output format': 'What final output format do you need?',
    'Essential constraints': 'Which constraints must be respected?',
    'Success criteria': 'How should success be evaluated?',
    'Useful context': 'What concrete context should be included?',
    'Examples or references': 'Which examples or references should guide the result?'
  }
};

function detectTaskType(prompt) {
  for (const [type, pattern] of TASK_PATTERNS) {
    if (pattern.test(prompt)) return type;
  }
  return 'general';
}

export function optimizePrompt(input = {}) {
  const result = optimizeBasePrompt(input);
  const taskType = detectTaskType(input.prompt ?? '');
  const block = GUIDANCE[taskType]?.[result.language] ?? [];
  const clarifyingQuestions = result.missing_information
    .map((item) => QUESTIONS[result.language][item])
    .filter(Boolean)
    .slice(0, 5);

  return {
    ...result,
    optimized_prompt: block.length
      ? `${result.optimized_prompt}\n\n${block.join('\n')}`
      : result.optimized_prompt,
    detected_task_type: taskType,
    improvements: [
      ...result.improvements,
      result.language === 'fr'
        ? `Gabarit adaptatif appliqué : ${taskType}`
        : `Adaptive template applied: ${taskType}`
    ],
    clarifying_questions: clarifyingQuestions
  };
}
