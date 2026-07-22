const MODES = new Set(['fast', 'balanced', 'deep']);
const LANGUAGES = new Set(['auto', 'fr', 'en']);

const FRENCH_MARKERS = [
  /[àâçéèêëîïôùûüÿœ]/i,
  /\b(crée|créer|fais|faire|pour|avec|sans|dans|mon|ma|mes|une|des|le|la|les|stratégie|entreprise|analyse)\b/i
];

const SIGNALS = {
  audience: /\b(public|audience|cible|clients?|utilisateurs?|lecteurs?|débutants?|experts?|professionnels?|parents?|students?|customers?|users?|readers?|beginners?|experts?|professionals?)\b/i,
  format: /\b(format|tableau|liste|étapes?|plan|json|markdown|email|rapport|résumé|script|code|table|list|steps?|outline|report|summary)\b/i,
  constraints: /\b(ne pas|sans|doit|maximum|minimum|limite|budget|délai|avant|après|mots?|pages?|euros?|€|must|without|avoid|maximum|minimum|limit|budget|deadline|words?|pages?)\b/i,
  success: /\b(réussite|succès|objectif mesurable|kpi|conversion|taux|qualité|validation|acceptation|success|metric|quality|acceptance|conversion rate)\b/i,
  context: /\b(contexte|actuellement|projet|entreprise|marque|produit|service|situation|context|currently|project|company|brand|product|service|situation)\b/i,
  examples: /\b(exemple|comme|inspiré|référence|example|such as|reference|inspired)\b/i,
  steps: /\b(étape|d'abord|ensuite|enfin|phase|step|first|then|finally|phase)\b/i
};

function assertString(value, name, { min = 0, max = 20_000, optional = false } = {}) {
  if (value === undefined || value === null) {
    if (optional) return undefined;
    throw new TypeError(`${name} is required`);
  }
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length < min) throw new RangeError(`${name} must contain at least ${min} characters`);
  if (trimmed.length > max) throw new RangeError(`${name} must contain at most ${max} characters`);
  return trimmed;
}

function detectLanguage(prompt) {
  return FRENCH_MARKERS.some((pattern) => pattern.test(prompt)) ? 'fr' : 'en';
}

function hasSignal(text, signal) {
  return SIGNALS[signal].test(text);
}

function calculateInitialScore(prompt, hints) {
  let score = 18;
  if (prompt.length >= 40) score += 8;
  if (prompt.length >= 120) score += 8;
  if (prompt.length >= 300) score += 6;
  if (hasSignal(prompt, 'audience') || hints.audience) score += 12;
  if (hasSignal(prompt, 'format') || hints.outputFormat) score += 12;
  if (hasSignal(prompt, 'constraints')) score += 12;
  if (hasSignal(prompt, 'success')) score += 10;
  if (hasSignal(prompt, 'context') || hints.context) score += 8;
  if (hasSignal(prompt, 'steps')) score += 6;
  return Math.min(96, Math.max(0, score));
}

function findMissingInformation(prompt, hints, language, mode) {
  const missing = [];
  const labels = language === 'fr'
    ? {
        audience: 'Public cible',
        format: 'Format de sortie',
        constraints: 'Contraintes essentielles',
        success: 'Critères de réussite',
        context: 'Contexte utile',
        examples: 'Exemples ou références'
      }
    : {
        audience: 'Target audience',
        format: 'Output format',
        constraints: 'Essential constraints',
        success: 'Success criteria',
        context: 'Useful context',
        examples: 'Examples or references'
      };

  if (!hints.audience && !hasSignal(prompt, 'audience')) missing.push(labels.audience);
  if (!hints.outputFormat && !hasSignal(prompt, 'format')) missing.push(labels.format);
  if (!hasSignal(prompt, 'constraints')) missing.push(labels.constraints);
  if (!hasSignal(prompt, 'success')) missing.push(labels.success);
  if (!hints.context && !hasSignal(prompt, 'context')) missing.push(labels.context);
  if (mode === 'deep' && !hasSignal(prompt, 'examples')) missing.push(labels.examples);
  return missing;
}

function placeholder(value, frLabel, enLabel, language) {
  if (value) return value;
  return language === 'fr' ? `[À préciser : ${frLabel}]` : `[To clarify: ${enLabel}]`;
}

function buildFastPrompt({ prompt, language, audience, outputFormat }) {
  if (language === 'fr') {
    return [
      'Exécute la demande suivante avec précision, sans modifier son intention.',
      '',
      `Demande : ${prompt}`,
      `Public cible : ${placeholder(audience, 'public cible', 'target audience', language)}`,
      `Sortie attendue : ${placeholder(outputFormat, 'format de sortie', 'output format', language)}`,
      '',
      'Contraintes :',
      '- N’invente pas les faits manquants : signale clairement les hypothèses.',
      '- Donne une réponse directement exploitable, claire et concise.',
      '- Vérifie que la réponse traite bien toute la demande.'
    ].join('\n');
  }

  return [
    'Execute the following request precisely without changing its intent.',
    '',
    `Request: ${prompt}`,
    `Target audience: ${placeholder(audience, 'public cible', 'target audience', language)}`,
    `Expected output: ${placeholder(outputFormat, 'format de sortie', 'output format', language)}`,
    '',
    'Constraints:',
    '- Do not invent missing facts; state assumptions explicitly.',
    '- Produce a clear, concise, directly usable answer.',
    '- Verify that the answer covers the full request.'
  ].join('\n');
}

function buildBalancedPrompt({ prompt, language, targetModel, context, audience, outputFormat }) {
  if (language === 'fr') {
    return [
      '# Rôle',
      `Agis comme un expert méthodique utilisant ${targetModel}. Adapte ton expertise au domaine réel de la demande.`,
      '',
      '# Mission',
      'Traite la demande ci-dessous sans en déformer l’intention :',
      `"""\n${prompt}\n"""`,
      '',
      '# Contexte disponible',
      placeholder(context, 'contexte du projet', 'project context', language),
      '',
      '# Public cible',
      placeholder(audience, 'public cible', 'target audience', language),
      '',
      '# Méthode',
      '1. Reformule mentalement l’objectif principal sans le remplacer.',
      '2. Repère les informations manquantes qui changeraient réellement la réponse.',
      '3. Utilise uniquement des hypothèses prudentes et rends-les visibles.',
      '4. Produis le résultat final avant les explications secondaires.',
      '',
      '# Contraintes',
      '- Préserve les noms, chiffres, conditions et priorités fournis.',
      '- N’invente ni sources, ni capacités, ni résultats garantis.',
      '- Évite le jargon inutile et les répétitions.',
      '- En cas d’ambiguïté bloquante, pose une seule question à fort impact ou utilise un placeholder explicite.',
      '',
      '# Format de sortie',
      placeholder(outputFormat, 'format de sortie attendu', 'expected output format', language),
      '',
      '# Critères de qualité',
      '- Réponse exacte, structurée et directement exploitable.',
      '- Chaque recommandation doit servir l’objectif principal.',
      '- Les hypothèses et limites doivent être distinguées des faits.'
    ].join('\n');
  }

  return [
    '# Role',
    `Act as a methodical expert using ${targetModel}. Adapt your expertise to the actual domain of the request.`,
    '',
    '# Mission',
    'Complete the request below without distorting its intent:',
    `"""\n${prompt}\n"""`,
    '',
    '# Available context',
    placeholder(context, 'contexte du projet', 'project context', language),
    '',
    '# Target audience',
    placeholder(audience, 'public cible', 'target audience', language),
    '',
    '# Method',
    '1. Identify the primary objective without replacing it.',
    '2. Detect missing information that would materially change the answer.',
    '3. Use only cautious assumptions and make them visible.',
    '4. Put the usable result before secondary explanation.',
    '',
    '# Constraints',
    '- Preserve all supplied names, numbers, conditions, and priorities.',
    '- Do not invent sources, capabilities, or guaranteed outcomes.',
    '- Avoid unnecessary jargon and repetition.',
    '- For blocking ambiguity, ask one high-impact question or use an explicit placeholder.',
    '',
    '# Output format',
    placeholder(outputFormat, 'format de sortie attendu', 'expected output format', language),
    '',
    '# Quality criteria',
    '- Accurate, structured, and directly usable.',
    '- Every recommendation must support the primary objective.',
    '- Clearly separate facts, assumptions, and limitations.'
  ].join('\n');
}

function buildDeepPrompt(input) {
  const balanced = buildBalancedPrompt(input);
  if (input.language === 'fr') {
    return [
      balanced,
      '',
      '# Gestion des inconnues',
      '- Classe les inconnues en trois catégories : bloquantes, utiles, facultatives.',
      '- Ne demande une clarification que si l’inconnue est bloquante.',
      '- Pour les autres inconnues, avance avec une hypothèse explicitement étiquetée.',
      '',
      '# Processus d’exécution',
      '1. Définis le résultat concret attendu.',
      '2. Décompose le travail en étapes logiques.',
      '3. Exécute chaque étape en respectant les contraintes.',
      '4. Vérifie les contradictions, omissions et affirmations non étayées.',
      '5. Présente le livrable final dans le format demandé.',
      '',
      '# Auto-vérification finale',
      'Avant de répondre, contrôle silencieusement : fidélité à la demande, complétude, cohérence, précision, utilité et respect du format. Corrige toute faiblesse détectée avant de livrer.'
    ].join('\n');
  }

  return [
    balanced,
    '',
    '# Unknowns management',
    '- Classify unknowns as blocking, useful, or optional.',
    '- Ask a clarification only when an unknown is blocking.',
    '- For other unknowns, proceed with an explicitly labeled assumption.',
    '',
    '# Execution process',
    '1. Define the concrete result expected.',
    '2. Break the work into logical stages.',
    '3. Execute each stage while respecting constraints.',
    '4. Check for contradictions, omissions, and unsupported claims.',
    '5. Present the final deliverable in the requested format.',
    '',
    '# Self-review',
    'Before answering, silently check fidelity, completeness, consistency, precision, usefulness, and format compliance. Fix any weakness before delivering.'
  ].join('\n');
}

function buildImprovements(language, mode, hints, missing) {
  const fr = language === 'fr';
  const improvements = fr
    ? ['Objectif original préservé', 'Structure de réponse clarifiée', 'Hypothèses rendues explicites', 'Critères de qualité ajoutés']
    : ['Original objective preserved', 'Response structure clarified', 'Assumptions made explicit', 'Quality criteria added'];

  if (hints.audience) improvements.push(fr ? 'Public cible intégré' : 'Target audience integrated');
  if (hints.context) improvements.push(fr ? 'Contexte intégré' : 'Context integrated');
  if (hints.outputFormat) improvements.push(fr ? 'Format de sortie intégré' : 'Output format integrated');
  if (mode === 'deep') improvements.push(fr ? 'Auto-vérification finale ajoutée' : 'Final self-review added');
  if (missing.length > 0) improvements.push(fr ? 'Informations manquantes signalées' : 'Missing information surfaced');
  return improvements;
}

function buildAssumptions(language, targetModel, requestedLanguage, missing) {
  const fr = language === 'fr';
  const assumptions = [
    fr
      ? `Le prompt final est adapté de manière générique à ${targetModel}, sans dépendre d’une fonction propriétaire.`
      : `The final prompt is generically adapted to ${targetModel} without relying on a proprietary feature.`
  ];
  if (requestedLanguage === 'auto') {
    assumptions.push(fr ? 'La langue française a été détectée automatiquement.' : 'English was detected automatically.');
  }
  if (missing.length > 0) {
    assumptions.push(
      fr
        ? 'Les informations absentes sont conservées sous forme de placeholders plutôt que d’être inventées.'
        : 'Missing details are kept as placeholders rather than invented.'
    );
  }
  return assumptions;
}

export function optimizePrompt(rawInput = {}) {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    throw new TypeError('input must be an object');
  }

  const prompt = assertString(rawInput.prompt, 'prompt', { min: 3, max: 20_000 });
  const mode = rawInput.mode ?? 'balanced';
  if (!MODES.has(mode)) throw new RangeError('mode must be fast, balanced, or deep');

  const requestedLanguage = rawInput.language ?? 'auto';
  if (!LANGUAGES.has(requestedLanguage)) throw new RangeError('language must be auto, fr, or en');

  const targetModel = assertString(rawInput.target_model ?? 'chatgpt', 'target_model', { min: 1, max: 100 });
  const context = assertString(rawInput.context, 'context', { optional: true, max: 5_000 });
  const audience = assertString(rawInput.audience, 'audience', { optional: true, max: 1_000 });
  const outputFormat = assertString(rawInput.output_format, 'output_format', { optional: true, max: 1_000 });
  const language = requestedLanguage === 'auto' ? detectLanguage(prompt) : requestedLanguage;

  const hints = { context, audience, outputFormat };
  const missingInformation = findMissingInformation(prompt, hints, language, mode);
  const scoreBefore = calculateInitialScore(prompt, hints);
  const modeFloor = { fast: 76, balanced: 87, deep: 93 }[mode];
  const scoreAfter = Math.min(98, Math.max(scoreBefore + 12, modeFloor));

  const builderInput = {
    prompt,
    mode,
    language,
    targetModel,
    context,
    audience,
    outputFormat
  };

  const optimizedPrompt = mode === 'fast'
    ? buildFastPrompt(builderInput)
    : mode === 'deep'
      ? buildDeepPrompt(builderInput)
      : buildBalancedPrompt(builderInput);

  return {
    optimized_prompt: optimizedPrompt,
    improvements: buildImprovements(language, mode, hints, missingInformation),
    missing_information: missingInformation,
    assumptions: buildAssumptions(language, targetModel, requestedLanguage, missingInformation),
    score_before: scoreBefore,
    score_after: scoreAfter,
    mode,
    target_model: targetModel,
    language
  };
}
