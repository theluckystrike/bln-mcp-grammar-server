/**
 * BeLikeNative MCP Server — Local Grammar Rules Engine
 *
 * Rule-based grammar checking, style analysis, and writing improvement.
 * No external API calls — all processing is local regex + heuristics.
 * NASA Power of 10 compliant.
 *
 * Exports:
 *   RULES            — Frozen array of grammar/spelling/style rule objects
 *   runRules(text)    — Apply all rules to text, return structured findings
 *   analyzeStyle(text) — Analyze writing style (sentence length, passive %, wordiness)
 *   BRAND_FOOTER      — Shared branding constant
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BRAND_FOOTER = "Powered by BeLikeNative -- belikenative.com";
const MAX_RULES = 200;
const MAX_FINDINGS_PER_RULE = 50;
const MAX_SENTENCE_LENGTH_WORDS = 30;
const PASSIVE_THRESHOLD_PCT = 30;

// ---------------------------------------------------------------------------
// Rule builder (validates every rule at load time)
// ---------------------------------------------------------------------------

/**
 * Build and freeze a single rule object with validation.
 * @param {object} def - Rule definition
 * @returns {Readonly<object>}
 */
function buildRule(def) {
  const { id, pattern, message, fix, severity, category, l1Insight } = def;

  console.assert(typeof id === "string" && id.length > 0,
    `rule id must be a non-empty string, got: ${id}`);
  console.assert(pattern instanceof RegExp,
    `rule ${id}: pattern must be a RegExp`);
  console.assert(typeof message === "string" && message.length > 0,
    `rule ${id}: message must be a non-empty string`);
  console.assert(
    ["error", "warning", "info"].includes(severity),
    `rule ${id}: severity must be error|warning|info`);
  console.assert(
    ["grammar", "style", "spelling", "punctuation"].includes(category),
    `rule ${id}: category must be grammar|style|spelling|punctuation`);

  return Object.freeze({
    id,
    pattern,
    message,
    fix: fix ?? null,
    severity,
    category,
    l1Insight: l1Insight ?? null,
  });
}

// ---------------------------------------------------------------------------
// Rule definitions (50+ rules)
// ---------------------------------------------------------------------------

const definitions = [
  // ===== ARTICLE ERRORS (L1: Chinese, Japanese, Korean, Russian, Turkish) =====
  {
    id: "article-missing-the-store",
    pattern: /\b(went|go|going|goes)\s+to\s+(store|school|office|hospital|bank|park|beach|gym|market|library)\b/gi,
    message: "Missing article \"the\" before a specific noun.",
    fix: (m) => `${m[1]} to the ${m[2]}`,
    severity: "error",
    category: "grammar",
    l1Insight:
      "Common for speakers of languages without articles (Chinese, Japanese, Korean, Russian, Turkish). These languages don't use \"a/an/the\", so omitting articles feels natural.",
  },
  {
    id: "article-a-before-vowel-sound",
    pattern: /\ba\s+(hour|honest|honor|heir|herb)\b/gi,
    message: "Use \"an\" before words with a silent \"h\" (vowel sound).",
    fix: (m) => `an ${m[1]}`,
    severity: "error",
    category: "grammar",
    l1Insight:
      "Article choice depends on pronunciation, not spelling. Words starting with a silent 'h' sound like vowels.",
  },
  {
    id: "article-an-before-consonant-sound",
    pattern: /\ban\s+(university|uniform|union|unique|unit|universal|united|useful|user|usual|European|one-time|one)\b/gi,
    message: "Use \"a\" before words that start with a consonant sound (\"yoo-\" or \"wuh-\").",
    fix: (m) => `a ${m[1]}`,
    severity: "error",
    category: "grammar",
    l1Insight:
      "The article choice (a vs. an) depends on the first *sound*, not the first *letter*. \"University\" starts with a /j/ sound.",
  },
  {
    id: "article-missing-a-an",
    pattern: /\b(is|was|be|been|being)\s+(good|great|bad|big|small|important|simple|common|typical|basic)\s+(idea|example|approach|way|method|tool|step|option|choice|practice)\b/gi,
    message: "Missing article \"a\" before adjective + singular noun.",
    fix: (m) => `${m[1]} a ${m[2]} ${m[3]}`,
    severity: "warning",
    category: "grammar",
    l1Insight:
      "Speakers of article-free languages (Chinese, Japanese, Korean, Russian) often drop articles before adjective-noun pairs.",
  },
  {
    id: "article-a-before-vowel-letter",
    pattern: /\ba\s+(apple|elephant|orange|umbrella|idea|issue|error|update|example|option|item|element|object|array|event|answer|argument|attempt|operation)\b/gi,
    message: "Use \"an\" before words starting with a vowel sound.",
    fix: (m) => `an ${m[1]}`,
    severity: "error",
    category: "grammar",
    l1Insight:
      "Use \"an\" before words that start with a vowel sound (a, e, i, o, u). This rule is about pronunciation.",
  },

  // ===== HOMOPHONES =====
  {
    id: "homophone-their-there",
    pattern: /\b(their)\s+(is|are|was|were|will|would|should|could|has|have|had)\b/gi,
    message: "\"Their\" is possessive. Use \"there\" before a verb.",
    fix: (m) => `there ${m[2]}`,
    severity: "error",
    category: "grammar",
    l1Insight:
      "English homophones (words that sound the same) are a common trap. Many languages don't have this ambiguity.",
  },
  {
    id: "homophone-there-possessive",
    pattern: /\b(there)\s+(account|car|house|team|work|code|project|file|data|system|app|site|page|repo|branch)\b/gi,
    message: "\"There\" is locative. Use \"their\" for possession.",
    fix: (m) => `their ${m[2]}`,
    severity: "error",
    category: "grammar",
    l1Insight:
      "\"Their\" shows ownership; \"there\" shows location. Many languages use a single word or different grammar for both concepts.",
  },
  {
    id: "homophone-your-youre",
    pattern: /\b(your)\s+(welcome|right|wrong|correct|sure|ready|done|going|looking|trying|using|running)\b/gi,
    message: "\"Your\" is possessive. Use \"you're\" (you are) before an adjective or verb.",
    fix: (m) => `you're ${m[2]}`,
    severity: "error",
    category: "grammar",
    l1Insight:
      "Contractions like \"you're\" don't exist in many languages, making the your/you're distinction unfamiliar.",
  },
  {
    id: "homophone-its-its",
    pattern: /\b(it's)\s+(own|version|name|value|state|data|size|type|content|purpose|function|role|behavior)\b/gi,
    message: "\"It's\" means \"it is\". Use \"its\" (no apostrophe) for possession.",
    fix: (m) => `its ${m[2]}`,
    severity: "error",
    category: "grammar",
    l1Insight:
      "Unlike other English possessives (John's, the dog's), \"its\" has NO apostrophe. This is an irregular exception.",
  },
  {
    id: "homophone-then-than",
    pattern: /\b(more|less|better|worse|faster|slower|greater|larger|smaller|higher|lower|easier|harder)\s+then\b/gi,
    message: "Use \"than\" for comparisons, not \"then\" (which means \"afterward\").",
    fix: (m) => `${m[1]} than`,
    severity: "error",
    category: "grammar",
    l1Insight:
      "\"Then\" (time) and \"than\" (comparison) sound nearly identical in casual speech, causing frequent mix-ups.",
  },
  {
    id: "homophone-affect-effect",
    pattern: /\bthe\s+affect\s+(of|on)\b/gi,
    message: "\"Affect\" is usually a verb. Use \"effect\" (noun) after \"the\".",
    fix: (m) => `the effect ${m[1]}`,
    severity: "warning",
    category: "grammar",
    l1Insight:
      "Affect (verb) vs. effect (noun) is one of the most commonly confused pairs, even among native speakers.",
  },
  {
    id: "homophone-to-too",
    pattern: /\b(is|was|are|were|seems?|looks?|feels?)\s+to\s+(big|small|long|short|hard|easy|fast|slow|hot|cold|much|many|late|early|high|low|loud|quiet|far|expensive|cheap)\b/gi,
    message: "Use \"too\" (meaning excessively) instead of \"to\" before adjectives.",
    fix: (m) => `${m[1]} too ${m[2]}`,
    severity: "error",
    category: "grammar",
    l1Insight:
      "\"To\" is a preposition/infinitive marker. \"Too\" means \"excessively\" or \"also\". They sound identical.",
  },
  {
    id: "homophone-loose-lose",
    pattern: /\b(don't|doesn't|didn't|will|won't|could|might|may|gonna|going to)\s+loose\b/gi,
    message: "\"Loose\" means not tight. Use \"lose\" (to misplace or fail to win).",
    fix: (m) => `${m[1]} lose`,
    severity: "error",
    category: "spelling",
  },

  // ===== COMMON MISSPELLINGS =====
  {
    id: "spelling-alot",
    pattern: /\balot\b/gi,
    message: "\"Alot\" is not a word. Use \"a lot\" (two words).",
    fix: () => "a lot",
    severity: "error",
    category: "spelling",
  },
  {
    id: "spelling-definately",
    pattern: /\bdefinately\b/gi,
    message: "Misspelling of \"definitely\".",
    fix: () => "definitely",
    severity: "error",
    category: "spelling",
  },
  {
    id: "spelling-seperate",
    pattern: /\bseperate\b/gi,
    message: "Misspelling of \"separate\".",
    fix: () => "separate",
    severity: "error",
    category: "spelling",
  },
  {
    id: "spelling-occured",
    pattern: /\boccured\b/gi,
    message: "Misspelling of \"occurred\" (double 'r').",
    fix: () => "occurred",
    severity: "error",
    category: "spelling",
  },
  {
    id: "spelling-recieve",
    pattern: /\brecieve\b/gi,
    message: "Misspelling of \"receive\" (i before e, except after c).",
    fix: () => "receive",
    severity: "error",
    category: "spelling",
  },
  {
    id: "spelling-neccessary",
    pattern: /\bn[ei]cc?ess?ary\b/gi,
    message: "Misspelling of \"necessary\" (one 'c', two 's').",
    fix: () => "necessary",
    severity: "error",
    category: "spelling",
  },
  {
    id: "spelling-accomodate",
    pattern: /\baccomodate\b/gi,
    message: "Misspelling of \"accommodate\" (double 'c', double 'm').",
    fix: () => "accommodate",
    severity: "error",
    category: "spelling",
  },
  {
    id: "spelling-occassion",
    pattern: /\boccassion\b/gi,
    message: "Misspelling of \"occasion\" (double 'c', single 's').",
    fix: () => "occasion",
    severity: "error",
    category: "spelling",
  },
  {
    id: "spelling-embarass",
    pattern: /\bembarass\b/gi,
    message: "Misspelling of \"embarrass\" (double 'r', double 's').",
    fix: () => "embarrass",
    severity: "error",
    category: "spelling",
  },
  {
    id: "spelling-enviroment",
    pattern: /\benviroment\b/gi,
    message: "Misspelling of \"environment\" (missing 'n').",
    fix: () => "environment",
    severity: "error",
    category: "spelling",
  },
  {
    id: "spelling-teh",
    pattern: /\bteh\b/g,
    message: "Typo: \"teh\" should be \"the\".",
    fix: () => "the",
    severity: "error",
    category: "spelling",
  },
  {
    id: "spelling-adn",
    pattern: /\badn\b/g,
    message: "Typo: \"adn\" should be \"and\".",
    fix: () => "and",
    severity: "error",
    category: "spelling",
  },
  {
    id: "spelling-lenght",
    pattern: /\blenght\b/gi,
    message: "Misspelling of \"length\".",
    fix: () => "length",
    severity: "error",
    category: "spelling",
  },
  {
    id: "spelling-widht",
    pattern: /\bwidht\b/gi,
    message: "Misspelling of \"width\".",
    fix: () => "width",
    severity: "error",
    category: "spelling",
  },
  {
    id: "spelling-heigth",
    pattern: /\bheigth\b/gi,
    message: "Misspelling of \"height\".",
    fix: () => "height",
    severity: "error",
    category: "spelling",
  },
  {
    id: "spelling-acheive",
    pattern: /\bacheive\b/gi,
    message: "Misspelling of \"achieve\".",
    fix: () => "achieve",
    severity: "error",
    category: "spelling",
  },
  {
    id: "spelling-beleive",
    pattern: /\bbeleive\b/gi,
    message: "Misspelling of \"believe\".",
    fix: () => "believe",
    severity: "error",
    category: "spelling",
  },
  {
    id: "spelling-wierd",
    pattern: /\bwierd\b/gi,
    message: "Misspelling of \"weird\" (e before i).",
    fix: () => "weird",
    severity: "error",
    category: "spelling",
  },

  // ===== GRAMMAR: VERB FORMS =====
  {
    id: "grammar-could-of",
    pattern: /\b(could|would|should|must|might)\s+of\b/gi,
    message: "Use \"have\" instead of \"of\" after modal verbs.",
    fix: (m) => `${m[1]} have`,
    severity: "error",
    category: "grammar",
    l1Insight:
      "\"Could've\" sounds like \"could of\" in spoken English. The correct form is always \"could have\".",
  },
  {
    id: "grammar-subject-verb-he-do",
    pattern: /\b(he|she|it)\s+(don't|do)\s/gi,
    message: "Use \"doesn't\" / \"does\" with third-person singular subjects.",
    fix: (m) => {
      const verb = m[2].toLowerCase() === "don't" ? "doesn't" : "does";
      return `${m[1]} ${verb} `;
    },
    severity: "error",
    category: "grammar",
    l1Insight:
      "Many languages don't change verb forms based on the subject. English third-person singular requires -s/es or \"does/doesn't\".",
  },
  {
    id: "grammar-double-negative",
    pattern: /\b(don't|doesn't|didn't|won't|can't|couldn't|wouldn't|shouldn't)\s+\w+\s+(no|nothing|nobody|nowhere|never)\b/gi,
    message: "Double negative detected. In standard English, use only one negative.",
    fix: null,
    severity: "warning",
    category: "grammar",
    l1Insight:
      "Double negatives are grammatically correct in many languages (Spanish, Russian, French) but are non-standard in English.",
  },
  {
    id: "grammar-much-many",
    pattern: /\b(much)\s+(files|items|users|requests|errors|issues|tasks|problems|options|features|things|people|examples|steps|changes)\b/gi,
    message: "Use \"many\" with countable plural nouns, not \"much\".",
    fix: (m) => `many ${m[2]}`,
    severity: "error",
    category: "grammar",
    l1Insight:
      "The much/many distinction (uncountable vs. countable) doesn't exist in many languages (Chinese, Japanese, Korean).",
  },
  {
    id: "grammar-less-fewer",
    pattern: /\bless\s+(files|items|users|requests|errors|issues|tasks|problems|options|features|things|people|examples|steps|changes|lines|commits|tests|bugs)\b/gi,
    message: "Use \"fewer\" with countable plural nouns. \"Less\" is for uncountable quantities.",
    fix: (m) => `fewer ${m[1]}`,
    severity: "warning",
    category: "grammar",
  },
  {
    id: "grammar-who-whom",
    pattern: /\bwhom\s+(is|was|are|were|has|have|had|will|would|can|could|shall|should)\b/gi,
    message: "Use \"who\" as a subject (before verbs). \"Whom\" is for objects.",
    fix: (m) => `who ${m[1]}`,
    severity: "warning",
    category: "grammar",
  },
  {
    id: "grammar-me-and",
    pattern: /\bme and\s+(\w+)\s+(went|go|are|were|was|will|have|had|should|could|would)\b/gi,
    message: "Use \"X and I\" as a subject, not \"me and X\".",
    fix: (m) => `${m[1]} and I ${m[2]}`,
    severity: "warning",
    category: "grammar",
  },
  {
    id: "grammar-irregardless",
    pattern: /\birregardless\b/gi,
    message: "\"Irregardless\" is non-standard. Use \"regardless\" instead.",
    fix: () => "regardless",
    severity: "error",
    category: "grammar",
  },
  {
    id: "grammar-supposably",
    pattern: /\bsupposably\b/gi,
    message: "\"Supposably\" is non-standard. Use \"supposedly\" instead.",
    fix: () => "supposedly",
    severity: "error",
    category: "grammar",
  },
  {
    id: "grammar-between-you-and-i",
    pattern: /\bbetween you and I\b/gi,
    message: "Use \"between you and me\" (object pronoun after preposition).",
    fix: () => "between you and me",
    severity: "error",
    category: "grammar",
  },
  {
    id: "grammar-preposition-consist-from",
    pattern: /\b(consist|comprised)\s+from\b/gi,
    message: "Use \"consist of\" / \"comprised of\", not \"from\".",
    fix: (m) => `${m[1]} of`,
    severity: "error",
    category: "grammar",
    l1Insight:
      "Prepositional collocations (which preposition goes with which verb) are language-specific and don't translate directly.",
  },
  {
    id: "grammar-have-went",
    pattern: /\b(have|has|had)\s+went\b/gi,
    message: "Use the past participle \"gone\" after \"have/has/had\", not \"went\".",
    fix: (m) => `${m[1]} gone`,
    severity: "error",
    category: "grammar",
    l1Insight:
      "English has irregular past participles (go/went/gone). Many languages have more regular verb systems.",
  },
  {
    id: "grammar-have-ran",
    pattern: /\b(have|has|had)\s+ran\b/gi,
    message: "Use the past participle \"run\" after \"have/has/had\", not \"ran\".",
    fix: (m) => `${m[1]} run`,
    severity: "error",
    category: "grammar",
  },
  {
    id: "grammar-have-did",
    pattern: /\b(have|has|had)\s+did\b/gi,
    message: "Use the past participle \"done\" after \"have/has/had\", not \"did\".",
    fix: (m) => `${m[1]} done`,
    severity: "error",
    category: "grammar",
  },
  {
    id: "grammar-subject-verb-they-does",
    pattern: /\b(they|we|you|I)\s+(does|doesn't)\b/gi,
    message: "Use \"do/don't\" with plural subjects and \"I\", not \"does/doesn't\".",
    fix: (m) => {
      const verb = m[2].toLowerCase() === "doesn't" ? "don't" : "do";
      return `${m[1]} ${verb}`;
    },
    severity: "error",
    category: "grammar",
    l1Insight:
      "English requires subject-verb agreement: \"I/you/we/they do\" but \"he/she/it does\".",
  },
  {
    id: "grammar-plural-verb-singular",
    pattern: /\b(the\s+\w+s)\s+(is|was|has)\b/gi,
    message: "Possible subject-verb disagreement: plural subject with singular verb.",
    fix: null,
    severity: "warning",
    category: "grammar",
    l1Insight:
      "English verbs must agree in number with their subject. Plural subjects take plural verbs.",
  },

  // ===== PUNCTUATION =====
  {
    id: "punctuation-repeated-word",
    pattern: /\b(\w{2,})\s+\1\b/gi,
    message: "Repeated word detected.",
    fix: (m) => m[1],
    severity: "error",
    category: "punctuation",
  },
  {
    id: "punctuation-double-space",
    pattern: /[^\n] {2,}(?=[^\s])/g,
    message: "Multiple consecutive spaces detected. Use a single space.",
    fix: null,
    severity: "info",
    category: "punctuation",
  },
  {
    id: "punctuation-no-cap-after-period",
    pattern: /\.\s+[a-z]/g,
    message: "Sentence after a period should start with a capital letter.",
    fix: null,
    severity: "warning",
    category: "punctuation",
  },
  {
    id: "punctuation-comma-splice-however",
    pattern: /,\s+(however|therefore|moreover|furthermore|nevertheless|consequently|meanwhile|otherwise)\s/gi,
    message: "Use a semicolon or period before conjunctive adverbs, not a comma.",
    fix: null,
    severity: "warning",
    category: "punctuation",
    l1Insight:
      "In many languages, commas are used more freely to join clauses. English requires semicolons before conjunctive adverbs.",
  },
  {
    id: "punctuation-missing-oxford-comma",
    pattern: /\b\w+,\s+\w+\s+and\s+\w+\b/gi,
    message: "Consider adding an Oxford comma before \"and\" in a list of three or more items.",
    fix: null,
    severity: "info",
    category: "punctuation",
  },

  // ===== STYLE: WORDY PHRASES =====
  {
    id: "style-in-order-to",
    pattern: /\bin order to\b/gi,
    message: "\"In order to\" is wordy. Use \"to\" instead.",
    fix: () => "to",
    severity: "info",
    category: "style",
  },
  {
    id: "style-utilize",
    pattern: /\butilize[sd]?\b/gi,
    message: "\"Utilize\" is unnecessarily formal. Use \"use\" instead.",
    fix: (m) => {
      const word = m[0].toLowerCase();
      if (word === "utilized") return "used";
      if (word === "utilizes") return "uses";
      return "use";
    },
    severity: "info",
    category: "style",
  },
  {
    id: "style-click-on",
    pattern: /\bclick on\b/gi,
    message: "\"Click on\" uses an unnecessary preposition. Use \"click\" alone.",
    fix: () => "click",
    severity: "info",
    category: "style",
  },
  {
    id: "style-at-this-point-in-time",
    pattern: /\bat this point in time\b/gi,
    message: "Wordy. Use \"now\" or \"currently\" instead.",
    fix: () => "now",
    severity: "info",
    category: "style",
  },
  {
    id: "style-due-to-the-fact",
    pattern: /\bdue to the fact that\b/gi,
    message: "Wordy. Use \"because\" instead.",
    fix: () => "because",
    severity: "info",
    category: "style",
  },
  {
    id: "style-in-the-event-that",
    pattern: /\bin the event that\b/gi,
    message: "Wordy. Use \"if\" instead.",
    fix: () => "if",
    severity: "info",
    category: "style",
  },
  {
    id: "style-a-number-of",
    pattern: /\ba number of\b/gi,
    message: "Vague. Use \"several\", \"many\", or a specific number instead.",
    fix: () => "several",
    severity: "info",
    category: "style",
  },
  {
    id: "style-very-unique",
    pattern: /\bvery\s+unique\b/gi,
    message: "\"Unique\" is absolute and cannot be modified by \"very\". Just use \"unique\".",
    fix: () => "unique",
    severity: "warning",
    category: "style",
  },
  {
    id: "style-sentence-start-but",
    pattern: /(?:^|\n)\s*But\s/g,
    message: "Starting a sentence with \"But\" is informal. Consider \"However\" in formal writing.",
    fix: null,
    severity: "info",
    category: "style",
  },
  {
    id: "style-sentence-start-and",
    pattern: /(?:^|\n)\s*And\s/g,
    message: "Starting a sentence with \"And\" is informal. Consider rephrasing in formal writing.",
    fix: null,
    severity: "info",
    category: "style",
  },
  {
    id: "style-basically",
    pattern: /\bbasically\b/gi,
    message: "\"Basically\" is often filler. Consider removing it.",
    fix: null,
    severity: "info",
    category: "style",
  },
  {
    id: "style-literally",
    pattern: /\bliterally\b/gi,
    message: "\"Literally\" is often misused for emphasis. Use only for factual statements.",
    fix: null,
    severity: "info",
    category: "style",
  },
  {
    id: "style-it-is-important-to-note",
    pattern: /\bit is (important|worth noting|interesting) to note that\b/gi,
    message: "Wordy throat-clearing. State the point directly.",
    fix: null,
    severity: "info",
    category: "style",
  },
  {
    id: "style-as-a-matter-of-fact",
    pattern: /\bas a matter of fact\b/gi,
    message: "Wordy. Use \"in fact\" or remove entirely.",
    fix: () => "in fact",
    severity: "info",
    category: "style",
  },

  // ===== PASSIVE VOICE =====
  {
    id: "style-passive-voice",
    pattern: /\b(is|are|was|were|be|been|being)\s+(being\s+)?(created|deleted|updated|removed|added|changed|modified|called|used|made|done|taken|given|shown|found|set|sent|built|written|run|seen|known|held|told|kept|left|read|considered|expected|required|needed|allowed|caused|designed|developed|implemented|performed|provided|received|recommended|reported|reviewed|selected|tested)\b/gi,
    message: "Passive voice detected. Consider rewriting in active voice for clarity.",
    fix: null,
    severity: "info",
    category: "style",
    l1Insight:
      "Passive voice is natural in many languages (German, Japanese, Arabic). In English technical writing, active voice is preferred for clarity.",
  },

  // ===== TECHNICAL WRITING =====
  {
    id: "tech-please-avoid",
    pattern: /\bplease\b/gi,
    message: "Avoid \"please\" in technical documentation. Use direct instructions instead.",
    fix: null,
    severity: "info",
    category: "style",
  },
  {
    id: "tech-simply",
    pattern: /\bsimply\b/gi,
    message: "Avoid \"simply\" in docs; what's simple to you may not be simple to the reader.",
    fix: null,
    severity: "info",
    category: "style",
  },
  {
    id: "tech-easy",
    pattern: /\b(easily|straightforward|obviously|trivial)\b/gi,
    message: "Minimizing language can alienate readers who find it difficult.",
    fix: null,
    severity: "info",
    category: "style",
  },
];

// ---------------------------------------------------------------------------
// Build & freeze all rules
// ---------------------------------------------------------------------------

console.assert(definitions.length >= 30,
  `Expected at least 30 rules, got ${definitions.length}`);
console.assert(definitions.length <= MAX_RULES,
  `Too many rules: ${definitions.length} exceeds limit of ${MAX_RULES}`);

const RULES = Object.freeze(definitions.map((def) => buildRule(def)));

// ---------------------------------------------------------------------------
// Rule engine: apply all rules to text
// ---------------------------------------------------------------------------

/**
 * Apply a single rule to text, collecting all matches.
 * @param {Readonly<object>} rule - A frozen rule object
 * @param {string} text - Text to check
 * @returns {Array<object>} Findings from this rule
 */
function applyOneRule(rule, text) {
  console.assert(rule !== null && typeof rule === "object",
    "rule must be an object");
  console.assert(typeof text === "string",
    "text must be a string");

  const findings = [];
  // Reset regex lastIndex for global patterns
  rule.pattern.lastIndex = 0;

  let match = rule.pattern.exec(text);
  let iterations = 0;

  while (match !== null && iterations < MAX_FINDINGS_PER_RULE) {
    const finding = {
      ruleId: rule.id,
      severity: rule.severity,
      category: rule.category,
      message: rule.message,
      matched: match[0],
      index: match.index,
      fix: null,
      l1Insight: rule.l1Insight,
    };

    if (typeof rule.fix === "function") {
      finding.fix = rule.fix(match);
    }

    findings.push(finding);
    iterations += 1;
    match = rule.pattern.exec(text);
  }

  return findings;
}

/**
 * Run all grammar rules against the input text.
 * @param {string} text - Text to check
 * @returns {{ findings: Array<object>, correctedText: string, summary: object }}
 */
function runRules(text) {
  console.assert(typeof text === "string" && text.length > 0,
    "text must be a non-empty string");
  console.assert(RULES.length > 0,
    "RULES array must not be empty");

  const allFindings = [];
  const ruleCount = RULES.length;

  for (let i = 0; i < ruleCount; i += 1) {
    const findings = applyOneRule(RULES[i], text);
    for (let j = 0; j < findings.length; j += 1) {
      allFindings.push(findings[j]);
    }
  }

  // Sort findings by position in text
  allFindings.sort((a, b) => a.index - b.index);

  // Build corrected text by applying fixes in reverse order
  const correctedText = buildCorrectedText(text, allFindings);

  // Build summary counts
  const summary = buildSummary(allFindings);

  return { findings: allFindings, correctedText, summary };
}

/**
 * Build corrected text by applying all fixable findings in reverse order.
 * @param {string} originalText
 * @param {Array<object>} findings - Sorted by index ascending
 * @returns {string}
 */
function buildCorrectedText(originalText, findings) {
  console.assert(typeof originalText === "string",
    "originalText must be a string");
  console.assert(Array.isArray(findings),
    "findings must be an array");

  // Filter to fixable findings and apply from end to start
  const fixable = findings.filter((f) => f.fix !== null);
  let result = originalText;

  // Apply in reverse to preserve indices
  for (let i = fixable.length - 1; i >= 0; i -= 1) {
    const f = fixable[i];
    const before = result.slice(0, f.index);
    const after = result.slice(f.index + f.matched.length);
    result = before + f.fix + after;
  }

  return result;
}

/**
 * Build a summary of findings by category and severity.
 * @param {Array<object>} findings
 * @returns {{ total: number, errors: number, warnings: number, info: number, byCategory: object }}
 */
function buildSummary(findings) {
  console.assert(Array.isArray(findings),
    "findings must be an array");

  const summary = {
    total: findings.length,
    errors: 0,
    warnings: 0,
    info: 0,
    byCategory: { grammar: 0, spelling: 0, punctuation: 0, style: 0 },
  };

  const maxLen = findings.length;
  for (let i = 0; i < maxLen; i += 1) {
    const f = findings[i];
    if (f.severity === "error") { summary.errors += 1; }
    else if (f.severity === "warning") { summary.warnings += 1; }
    else { summary.info += 1; }

    if (f.category in summary.byCategory) {
      summary.byCategory[f.category] += 1;
    }
  }

  console.assert(summary.errors + summary.warnings + summary.info === summary.total,
    "Severity counts must sum to total");
  return summary;
}

// ---------------------------------------------------------------------------
// Style analyzer: sentence length, passive voice %, readability heuristics
// ---------------------------------------------------------------------------

/**
 * Split text into sentences using common delimiters.
 * @param {string} text
 * @returns {Array<string>}
 */
function splitSentences(text) {
  console.assert(typeof text === "string",
    "text must be a string");
  console.assert(text.length > 0,
    "text must not be empty");

  // Split on .!? followed by space or end
  const raw = text.split(/(?<=[.!?])\s+/);
  const sentences = raw.filter((s) => s.trim().length > 0);
  return sentences;
}

/**
 * Count words in a string.
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
  console.assert(typeof text === "string",
    "text must be a string");

  const trimmed = text.trim();
  if (trimmed.length === 0) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Analyze writing style: sentence stats, passive voice, wordiness.
 * @param {string} text - Text to analyze
 * @returns {{ sentenceCount: number, avgWordsPerSentence: number, longSentences: Array, passiveCount: number, passivePct: number, wordCount: number, suggestions: Array<string> }}
 */
function analyzeStyle(text) {
  console.assert(typeof text === "string" && text.length > 0,
    "text must be a non-empty string");

  const sentences = splitSentences(text);
  const sentenceCount = sentences.length;
  const wordCount = countWords(text);

  console.assert(sentenceCount >= 0, "sentenceCount must be non-negative");
  console.assert(wordCount >= 0, "wordCount must be non-negative");

  const avgWords = sentenceCount > 0 ? Math.round(wordCount / sentenceCount) : 0;

  // Find long sentences
  const longSentences = findLongSentences(sentences);

  // Count passive voice instances
  const passivePattern = /\b(is|are|was|were|be|been|being)\s+(being\s+)?\w+ed\b/gi;
  const passiveMatches = text.match(passivePattern) || [];
  const passiveCount = passiveMatches.length;
  const passivePct = sentenceCount > 0
    ? Math.round((passiveCount / sentenceCount) * 100)
    : 0;

  // Build suggestions
  const suggestions = buildStyleSuggestions(avgWords, passivePct, longSentences.length, wordCount);

  return {
    sentenceCount,
    avgWordsPerSentence: avgWords,
    longSentences,
    passiveCount,
    passivePct,
    wordCount,
    suggestions,
  };
}

/**
 * Find sentences that exceed the recommended word count.
 * @param {Array<string>} sentences
 * @returns {Array<{sentence: string, wordCount: number}>}
 */
function findLongSentences(sentences) {
  console.assert(Array.isArray(sentences),
    "sentences must be an array");

  const results = [];
  const maxLen = Math.min(sentences.length, 500);

  for (let i = 0; i < maxLen; i += 1) {
    const wc = countWords(sentences[i]);
    if (wc > MAX_SENTENCE_LENGTH_WORDS) {
      // Truncate for display
      const preview = sentences[i].length > 80
        ? sentences[i].slice(0, 80) + "..."
        : sentences[i];
      results.push({ sentence: preview, wordCount: wc });
    }
  }

  return results;
}

/**
 * Build style improvement suggestions based on metrics.
 * @param {number} avgWords
 * @param {number} passivePct
 * @param {number} longCount
 * @param {number} totalWords
 * @returns {Array<string>}
 */
function buildStyleSuggestions(avgWords, passivePct, longCount, totalWords) {
  console.assert(typeof avgWords === "number", "avgWords must be a number");
  console.assert(typeof passivePct === "number", "passivePct must be a number");

  const suggestions = [];

  if (avgWords > MAX_SENTENCE_LENGTH_WORDS) {
    suggestions.push(
      `Average sentence length is ${avgWords} words. Aim for under ${MAX_SENTENCE_LENGTH_WORDS} words per sentence for readability.`
    );
  }

  if (longCount > 0) {
    suggestions.push(
      `${longCount} sentence(s) exceed ${MAX_SENTENCE_LENGTH_WORDS} words. Consider breaking them up.`
    );
  }

  if (passivePct > PASSIVE_THRESHOLD_PCT) {
    suggestions.push(
      `${passivePct}% of sentences contain passive voice. Consider using active voice for clarity.`
    );
  }

  if (totalWords < 5) {
    suggestions.push(
      "Text is very short. Style analysis works best with longer passages."
    );
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// Exports (frozen — NASA P10)
// ---------------------------------------------------------------------------

export {
  RULES,
  runRules,
  analyzeStyle,
  BRAND_FOOTER,
};
