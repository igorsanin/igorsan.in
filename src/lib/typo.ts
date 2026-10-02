// Typographic glue for English copy: keep short words (articles, prepositions,
// conjunctions, "I") attached to the next word, and numbers to their units,
// so they never hang at the end of a line.
const SHORT = 'a|an|the|of|in|on|at|to|for|by|with|from|into|onto|as|and|or|but|nor|is|was|be|we|our|its|it|my|me|i|no|not|via|per|up|off|out|so|if|&|—|–|×';
const RE_SHORT = new RegExp(`(^|[\\s(«“"])(${SHORT}) +(?=\\S)`, 'gi');
const RE_NUM = /(\d) +(?=(?:sec|min|px|K|M|tonnes|tons|years?|days?|LED|%|×)\b)/g;

export function nbsp(text: string): string {
  if (!text) return text;
  // twice, so chains like "in a" both bind
  return text.replace(RE_SHORT, '$1$2 ').replace(RE_SHORT, '$1$2 ').replace(RE_NUM, '$1 ');
}
