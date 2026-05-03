/**
 * BeLikeNative MCP Server -- Tool Definitions & Handlers
 *
 * Exposes 4 tools: check_grammar, improve_writing, translate, adjust_tone.
 *
 * check_grammar + improve_writing: Use LOCAL rule-based processing (no API).
 * translate + adjust_tone: Return structured prompts for the host AI to process.
 *
 * All functions comply with NASA Power of 10 rules.
 */

import { runRules, analyzeStyle, BRAND_FOOTER } from "./rules.mjs";

// ---------------------------------------------------------------------------
// Constants (frozen -- NASA P10)
// ---------------------------------------------------------------------------

const MAX_TEXT_LENGTH = 6000;

const STYLE_OPTIONS = Object.freeze([
  "academic", "business", "creative", "technical", "simple", "concise",
]);

const TONE_OPTIONS = Object.freeze([
  "formal", "casual", "friendly", "professional",
  "persuasive", "confident", "empathetic", "diplomatic",
]);

// ---------------------------------------------------------------------------
// Style guidelines (frozen lookup for improve_writing)
// ---------------------------------------------------------------------------

const STYLE_GUIDELINES = Object.freeze({
  academic: Object.freeze({
    label: "Academic",
    principles: [
      "Use formal vocabulary and avoid contractions",
      "Write in third person (avoid \"I\" and \"you\")",
      "Support claims with evidence and hedging (\"suggests\", \"indicates\")",
      "Use topic sentences to open paragraphs",
      "Prefer complex sentence structures with subordinate clauses",
    ],
    avoid: ["contractions", "slang", "first person", "absolute claims without evidence"],
  }),
  business: Object.freeze({
    label: "Business",
    principles: [
      "Lead with the key message or action item",
      "Use short, direct sentences",
      "Favor active voice over passive",
      "Eliminate filler words and unnecessary qualifiers",
      "Be specific: replace vague language with concrete details",
    ],
    avoid: ["jargon without explanation", "passive voice", "burying the lead", "wordiness"],
  }),
  creative: Object.freeze({
    label: "Creative",
    principles: [
      "Vary sentence length for rhythm",
      "Use vivid, sensory language",
      "Show rather than tell",
      "Employ metaphor and analogy where appropriate",
      "Create emotional resonance through word choice",
    ],
    avoid: ["cliches", "telling instead of showing", "monotonous sentence structure"],
  }),
  technical: Object.freeze({
    label: "Technical",
    principles: [
      "Use precise, unambiguous terminology",
      "Write in active voice with imperative mood for instructions",
      "Define acronyms on first use",
      "Use numbered steps for procedures",
      "Keep sentences under 25 words",
    ],
    avoid: ["minimizing language (\"simply\", \"just\", \"easy\")", "passive voice", "undefined jargon"],
  }),
  simple: Object.freeze({
    label: "Simple",
    principles: [
      "Use short words (prefer \"use\" over \"utilize\")",
      "Keep sentences under 15 words where possible",
      "One idea per sentence",
      "Use common vocabulary (aim for 8th-grade reading level)",
      "Replace abstract nouns with concrete verbs",
    ],
    avoid: ["complex vocabulary", "nested clauses", "abstract language", "long sentences"],
  }),
  concise: Object.freeze({
    label: "Concise",
    principles: [
      "Remove every word that doesn't add meaning",
      "Replace wordy phrases (\"in order to\" -> \"to\")",
      "Eliminate redundant pairs (\"each and every\" -> \"each\")",
      "Convert passive to active voice",
      "Cut throat-clearing phrases (\"It is important to note that\")",
    ],
    avoid: ["redundancy", "filler phrases", "passive voice", "unnecessary modifiers"],
  }),
});

// ---------------------------------------------------------------------------
// Tone guidelines (frozen lookup for adjust_tone)
// ---------------------------------------------------------------------------

const TONE_GUIDELINES = Object.freeze({
  formal: Object.freeze({
    label: "Formal",
    characteristics: ["No contractions", "Third person preferred", "Complete sentences", "Professional vocabulary"],
    transforms: ["Expand contractions", "Replace casual phrases", "Use proper titles"],
  }),
  casual: Object.freeze({
    label: "Casual",
    characteristics: ["Contractions OK", "First/second person", "Shorter sentences", "Conversational"],
    transforms: ["Use contractions", "Simplify vocabulary", "Add conversational connectors"],
  }),
  friendly: Object.freeze({
    label: "Friendly",
    characteristics: ["Warm and approachable", "Inclusive language", "Encouraging", "Personal touch"],
    transforms: ["Add warmth", "Use inclusive \"we\"", "Soften directives", "Add encouragement"],
  }),
  professional: Object.freeze({
    label: "Professional",
    characteristics: ["Polished but not stiff", "Confident", "Clear and direct", "Respectful"],
    transforms: ["Balance formality with approachability", "Lead with key points", "Use precise language"],
  }),
  persuasive: Object.freeze({
    label: "Persuasive",
    characteristics: ["Action-oriented", "Benefit-focused", "Confident claims", "Call to action"],
    transforms: ["Emphasize benefits", "Add urgency", "Use power words", "Include social proof framing"],
  }),
  confident: Object.freeze({
    label: "Confident",
    characteristics: ["Assertive", "No hedging", "Direct statements", "Strong verbs"],
    transforms: ["Remove hedge words (\"maybe\", \"perhaps\")", "Use declarative sentences", "Replace weak verbs"],
  }),
  empathetic: Object.freeze({
    label: "Empathetic",
    characteristics: ["Acknowledges feelings", "Supportive", "Understanding", "Solution-oriented"],
    transforms: ["Add acknowledgment", "Validate concerns", "Offer support", "Use gentle language"],
  }),
  diplomatic: Object.freeze({
    label: "Diplomatic",
    characteristics: ["Balanced", "Non-confrontational", "Respectful of perspectives", "Tactful"],
    transforms: ["Soften criticism", "Acknowledge other viewpoints", "Frame negatives constructively"],
  }),
});

// ---------------------------------------------------------------------------
// Tool JSON Schema definitions
// ---------------------------------------------------------------------------

const TOOL_DEFINITIONS = Object.freeze([
  Object.freeze({
    name: "check_grammar",
    description:
      "Check grammar, spelling, and punctuation using local rule-based analysis. Returns structured JSON with errors found, corrections, and L1-aware explanations. No API calls needed. Powered by BeLikeNative.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          maxLength: MAX_TEXT_LENGTH,
          description: "The text to check for grammar errors (max 6000 chars).",
        },
        language: {
          type: "string",
          description:
            'The writer\'s native language (L1) for tailored explanations. ISO 639-1 code or language name. Default: "en".',
          default: "en",
        },
      },
      required: ["text"],
    },
  }),
  Object.freeze({
    name: "improve_writing",
    description:
      "Analyze text for writing quality using rule-based style checks. Returns structured suggestions covering wordiness, passive voice, sentence length, and style-specific guidelines. No API calls needed. Powered by BeLikeNative.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          maxLength: MAX_TEXT_LENGTH,
          description: "The text to improve (max 6000 chars).",
        },
        style: {
          type: "string",
          enum: STYLE_OPTIONS,
          description:
            'Target writing style. One of: academic, business, creative, technical, simple, concise. Default: "business".',
          default: "business",
        },
      },
      required: ["text"],
    },
  }),
  Object.freeze({
    name: "translate",
    description:
      "Returns a structured translation prompt for the host AI to process. The MCP server provides formatting and context -- the host AI performs the actual translation. Powered by BeLikeNative.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          maxLength: MAX_TEXT_LENGTH,
          description: "The text to translate (max 6000 chars).",
        },
        source_language: {
          type: "string",
          description:
            'Source language. ISO 639-1 code or full name (e.g. "en", "English", "fr", "French").',
        },
        target_language: {
          type: "string",
          description:
            'Target language. ISO 639-1 code or full name (e.g. "es", "Spanish", "de", "German").',
        },
      },
      required: ["text", "source_language", "target_language"],
    },
  }),
  Object.freeze({
    name: "adjust_tone",
    description:
      "Returns structured tone adjustment guidelines and a prompt for the host AI to process. The MCP server provides tone rules and transformation guidance -- the host AI performs the rewrite. Powered by BeLikeNative.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          maxLength: MAX_TEXT_LENGTH,
          description: "The text whose tone to adjust (max 6000 chars).",
        },
        tone: {
          type: "string",
          enum: TONE_OPTIONS,
          description:
            "Desired tone. One of: formal, casual, friendly, professional, persuasive, confident, empathetic, diplomatic.",
        },
      },
      required: ["text", "tone"],
    },
  }),
]);

// ---------------------------------------------------------------------------
// Input validation helpers
// ---------------------------------------------------------------------------

/**
 * Validate the common 'text' input field.
 * @param {unknown} text
 * @returns {{ valid: boolean, error?: string }}
 */
function validateText(text) {
  console.assert(arguments.length === 1, "validateText takes exactly 1 argument");

  if (typeof text !== "string" || text.trim().length === 0) {
    return { valid: false, error: "The 'text' field is required and must be a non-empty string." };
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return {
      valid: false,
      error: `Text exceeds maximum length of ${MAX_TEXT_LENGTH} characters (got ${text.length}).`,
    };
  }

  console.assert(typeof text === "string", "Post-validation: text is a string");
  return { valid: true };
}

/**
 * Validate that a value is one of the allowed options.
 * @param {string} value
 * @param {ReadonlyArray<string>} allowed
 * @param {string} fieldName
 * @returns {{ valid: boolean, error?: string }}
 */
function validateEnum(value, allowed, fieldName) {
  console.assert(Array.isArray(allowed), "allowed must be an array");
  console.assert(typeof fieldName === "string", "fieldName must be a string");

  if (!allowed.includes(value)) {
    return {
      valid: false,
      error: `Invalid ${fieldName}: "${value}". Must be one of: ${allowed.join(", ")}.`,
    };
  }
  return { valid: true };
}

// ---------------------------------------------------------------------------
// Tool handler: check_grammar (LOCAL rule-based)
// ---------------------------------------------------------------------------

/**
 * Handle the check_grammar tool invocation.
 * Uses local regex rules -- no API calls.
 * @param {object} args - { text: string, language?: string }
 * @returns {object} MCP tool result
 */
function handleCheckGrammar(args) {
  console.assert(args !== null && typeof args === "object", "args must be an object");

  const textCheck = validateText(args.text);
  if (!textCheck.valid) {
    return buildErrorResult(textCheck.error);
  }

  const language = args.language || "en";
  console.assert(typeof language === "string", "language must be a string");

  const { findings, correctedText, summary } = runRules(args.text);

  const result = formatGrammarResult(args.text, findings, correctedText, summary, language);
  return buildSuccessResult(result);
}

/**
 * Format grammar check findings into a readable result string.
 * @param {string} originalText
 * @param {Array<object>} findings
 * @param {string} correctedText
 * @param {object} summary
 * @param {string} language
 * @returns {string}
 */
function formatGrammarResult(originalText, findings, correctedText, summary, language) {
  console.assert(typeof originalText === "string", "originalText must be a string");
  console.assert(Array.isArray(findings), "findings must be an array");

  const lines = [];
  lines.push(`GRAMMAR CHECK RESULTS (${summary.total} issue(s) found)`);
  lines.push(`Errors: ${summary.errors} | Warnings: ${summary.warnings} | Info: ${summary.info}`);
  lines.push("");

  if (findings.length === 0) {
    lines.push("No grammar issues detected.");
    lines.push("");
    lines.push("ORIGINAL TEXT (no changes needed):");
    lines.push(originalText);
  } else {
    lines.push("ERRORS:");
    const maxFindings = Math.min(findings.length, 100);
    for (let i = 0; i < maxFindings; i += 1) {
      const f = findings[i];
      const fixStr = f.fix !== null ? ` -> "${f.fix}"` : "";
      lines.push(`- [${f.severity.toUpperCase()}] "${f.matched}"${fixStr} -- ${f.message}`);
      if (f.l1Insight !== null && language !== "en") {
        lines.push(`  L1 insight: ${f.l1Insight}`);
      }
    }
    lines.push("");
    lines.push("CORRECTED TEXT:");
    lines.push(correctedText);
  }

  lines.push("");
  lines.push(BRAND_FOOTER);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Tool handler: improve_writing (LOCAL rule-based)
// ---------------------------------------------------------------------------

/**
 * Handle the improve_writing tool invocation.
 * Uses local style analysis -- no API calls.
 * @param {object} args - { text: string, style?: string }
 * @returns {object} MCP tool result
 */
function handleImproveWriting(args) {
  console.assert(args !== null && typeof args === "object", "args must be an object");

  const textCheck = validateText(args.text);
  if (!textCheck.valid) {
    return buildErrorResult(textCheck.error);
  }

  const style = args.style || "business";
  const styleCheck = validateEnum(style, STYLE_OPTIONS, "style");
  if (!styleCheck.valid) {
    return buildErrorResult(styleCheck.error);
  }

  // Run grammar rules for error detection
  const { findings, correctedText, summary } = runRules(args.text);

  // Run style analysis
  const styleAnalysis = analyzeStyle(args.text);

  // Get style-specific guidelines
  const guidelines = STYLE_GUIDELINES[style];
  console.assert(guidelines !== undefined, `Guidelines must exist for style: ${style}`);

  const result = formatWritingResult(
    args.text, correctedText, findings, summary, styleAnalysis, guidelines, style
  );
  return buildSuccessResult(result);
}

/**
 * Format writing improvement results into a readable string.
 * @param {string} original
 * @param {string} corrected
 * @param {Array} findings
 * @param {object} summary
 * @param {object} styleAnalysis
 * @param {object} guidelines
 * @param {string} styleName
 * @returns {string}
 */
function formatWritingResult(original, corrected, findings, summary, styleAnalysis, guidelines, styleName) {
  console.assert(typeof original === "string", "original must be a string");
  console.assert(typeof styleName === "string", "styleName must be a string");

  const lines = [];
  lines.push(`WRITING ANALYSIS (target style: ${guidelines.label})`);
  lines.push("");

  // Style metrics
  lines.push("METRICS:");
  lines.push(`- Word count: ${styleAnalysis.wordCount}`);
  lines.push(`- Sentences: ${styleAnalysis.sentenceCount}`);
  lines.push(`- Avg words per sentence: ${styleAnalysis.avgWordsPerSentence}`);
  lines.push(`- Passive voice: ${styleAnalysis.passiveCount} instance(s) (${styleAnalysis.passivePct}%)`);
  lines.push(`- Grammar/spelling issues: ${summary.errors} errors, ${summary.warnings} warnings`);
  lines.push("");

  // Grammar/spelling findings
  if (findings.length > 0) {
    lines.push("ISSUES FOUND:");
    const maxShow = Math.min(findings.length, 50);
    for (let i = 0; i < maxShow; i += 1) {
      const f = findings[i];
      const fixStr = f.fix !== null ? ` -> "${f.fix}"` : "";
      lines.push(`- [${f.severity.toUpperCase()}] "${f.matched}"${fixStr} -- ${f.message}`);
    }
    lines.push("");
  }

  // Long sentences
  if (styleAnalysis.longSentences.length > 0) {
    lines.push("LONG SENTENCES (consider breaking up):");
    const maxLong = Math.min(styleAnalysis.longSentences.length, 10);
    for (let i = 0; i < maxLong; i += 1) {
      const ls = styleAnalysis.longSentences[i];
      lines.push(`- (${ls.wordCount} words) "${ls.sentence}"`);
    }
    lines.push("");
  }

  // Style suggestions
  if (styleAnalysis.suggestions.length > 0) {
    lines.push("STYLE SUGGESTIONS:");
    for (let i = 0; i < styleAnalysis.suggestions.length; i += 1) {
      lines.push(`- ${styleAnalysis.suggestions[i]}`);
    }
    lines.push("");
  }

  // Style guidelines
  lines.push(`${guidelines.label.toUpperCase()} STYLE GUIDELINES:`);
  for (let i = 0; i < guidelines.principles.length; i += 1) {
    lines.push(`- ${guidelines.principles[i]}`);
  }
  lines.push("");
  lines.push("AVOID:");
  for (let i = 0; i < guidelines.avoid.length; i += 1) {
    lines.push(`- ${guidelines.avoid[i]}`);
  }
  lines.push("");

  // Corrected text (with rule-based fixes applied)
  if (corrected !== original) {
    lines.push("TEXT WITH RULE-BASED CORRECTIONS APPLIED:");
    lines.push(corrected);
    lines.push("");
  }

  lines.push(BRAND_FOOTER);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Tool handler: translate (structured prompt for host AI)
// ---------------------------------------------------------------------------

/**
 * Handle the translate tool invocation.
 * Returns a structured prompt for the host AI to perform the translation.
 * @param {object} args - { text, source_language, target_language }
 * @returns {object} MCP tool result
 */
function handleTranslate(args) {
  console.assert(args !== null && typeof args === "object", "args must be an object");

  const textCheck = validateText(args.text);
  if (!textCheck.valid) {
    return buildErrorResult(textCheck.error);
  }

  if (typeof args.source_language !== "string" || args.source_language.trim().length === 0) {
    return buildErrorResult("The 'source_language' field is required.");
  }
  if (typeof args.target_language !== "string" || args.target_language.trim().length === 0) {
    return buildErrorResult("The 'target_language' field is required.");
  }

  const result = formatTranslationPrompt(args.text, args.source_language, args.target_language);
  return buildSuccessResult(result);
}

/**
 * Format a structured translation prompt for the host AI.
 * @param {string} text
 * @param {string} sourceLang
 * @param {string} targetLang
 * @returns {string}
 */
function formatTranslationPrompt(text, sourceLang, targetLang) {
  console.assert(typeof text === "string" && text.length > 0,
    "text must be a non-empty string");
  console.assert(typeof sourceLang === "string" && sourceLang.length > 0,
    "sourceLang must be a non-empty string");

  const lines = [];
  lines.push("TRANSLATION REQUEST (for host AI to process)");
  lines.push("");
  lines.push(`Source language: ${sourceLang}`);
  lines.push(`Target language: ${targetLang}`);
  lines.push("");
  lines.push("INSTRUCTIONS FOR HOST AI:");
  lines.push("Please translate the following text with these guidelines:");
  lines.push("1. Produce a natural, fluent translation -- not word-for-word literal.");
  lines.push("2. Preserve the tone, intent, and formatting of the original.");
  lines.push("3. Translate idiomatic expressions to equivalent idioms in the target language when possible.");
  lines.push("4. If any part is ambiguous, pick the most likely meaning and note the ambiguity.");
  lines.push("");
  lines.push("RESPONSE FORMAT:");
  lines.push(`TRANSLATION (${targetLang}):`);
  lines.push("[translated text]");
  lines.push("");
  lines.push("NOTES:");
  lines.push("- [any relevant translation notes, or \"None\" if straightforward]");
  lines.push("");
  lines.push("TEXT TO TRANSLATE:");
  lines.push(text);
  lines.push("");
  lines.push(BRAND_FOOTER);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Tool handler: adjust_tone (structured prompt for host AI)
// ---------------------------------------------------------------------------

/**
 * Handle the adjust_tone tool invocation.
 * Returns structured guidelines and a prompt for the host AI to process.
 * @param {object} args - { text: string, tone: string }
 * @returns {object} MCP tool result
 */
function handleAdjustTone(args) {
  console.assert(args !== null && typeof args === "object", "args must be an object");

  const textCheck = validateText(args.text);
  if (!textCheck.valid) {
    return buildErrorResult(textCheck.error);
  }

  if (typeof args.tone !== "string" || args.tone.trim().length === 0) {
    return buildErrorResult("The 'tone' field is required.");
  }

  const toneCheck = validateEnum(args.tone, TONE_OPTIONS, "tone");
  if (!toneCheck.valid) {
    return buildErrorResult(toneCheck.error);
  }

  const toneGuide = TONE_GUIDELINES[args.tone];
  console.assert(toneGuide !== undefined, `Tone guidelines must exist for: ${args.tone}`);

  const result = formatTonePrompt(args.text, args.tone, toneGuide);
  return buildSuccessResult(result);
}

/**
 * Format a structured tone adjustment prompt for the host AI.
 * @param {string} text
 * @param {string} toneName
 * @param {object} toneGuide
 * @returns {string}
 */
function formatTonePrompt(text, toneName, toneGuide) {
  console.assert(typeof text === "string" && text.length > 0,
    "text must be a non-empty string");
  console.assert(typeof toneName === "string",
    "toneName must be a string");

  const lines = [];
  lines.push(`TONE ADJUSTMENT REQUEST (for host AI to process)`);
  lines.push("");
  lines.push(`Target tone: ${toneGuide.label}`);
  lines.push("");
  lines.push("TONE CHARACTERISTICS:");
  for (let i = 0; i < toneGuide.characteristics.length; i += 1) {
    lines.push(`- ${toneGuide.characteristics[i]}`);
  }
  lines.push("");
  lines.push("TRANSFORMATION GUIDELINES:");
  for (let i = 0; i < toneGuide.transforms.length; i += 1) {
    lines.push(`- ${toneGuide.transforms[i]}`);
  }
  lines.push("");
  lines.push("INSTRUCTIONS FOR HOST AI:");
  lines.push(`Please rewrite the following text in a "${toneName}" tone.`);
  lines.push("1. Keep the original meaning and information intact.");
  lines.push(`2. Adjust vocabulary, sentence structure, and phrasing to match the "${toneName}" tone.`);
  lines.push("3. Do NOT add new ideas or remove existing ones.");
  lines.push("4. If the text is already in the requested tone, return it with minimal changes and note that.");
  lines.push("");
  lines.push("RESPONSE FORMAT:");
  lines.push("ADJUSTED TEXT:");
  lines.push("[text in the adjusted tone]");
  lines.push("");
  lines.push("TONE CHANGES:");
  lines.push("- [brief bullet for each significant change]");
  lines.push("");
  lines.push("TEXT TO ADJUST:");
  lines.push(text);
  lines.push("");
  lines.push(BRAND_FOOTER);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Response builders
// ---------------------------------------------------------------------------

/**
 * Build an MCP success result.
 * @param {string} text
 * @returns {object}
 */
function buildSuccessResult(text) {
  console.assert(typeof text === "string", "text must be a string");
  console.assert(text.length > 0, "text must not be empty");

  return {
    content: [{ type: "text", text }],
  };
}

/**
 * Build an MCP error result.
 * @param {string} message
 * @returns {object}
 */
function buildErrorResult(message) {
  console.assert(typeof message === "string", "Error message must be a string");
  console.assert(message.length > 0, "Error message must not be empty");

  return {
    content: [
      {
        type: "text",
        text: `Error: ${message}\n\n${BRAND_FOOTER}`,
      },
    ],
    isError: true,
  };
}

// ---------------------------------------------------------------------------
// Handler dispatch map (frozen -- NASA P10)
// ---------------------------------------------------------------------------

const TOOL_HANDLERS = Object.freeze({
  check_grammar: handleCheckGrammar,
  improve_writing: handleImproveWriting,
  translate: handleTranslate,
  adjust_tone: handleAdjustTone,
});

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { TOOL_DEFINITIONS, TOOL_HANDLERS };
