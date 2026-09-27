import { isSourceFile } from '../runners/discovery.runner.js';

export interface SimilarityFlag {
  subAId: string;
  subBId: string;
  subAName: string;
  subBName: string;
  similarity: number; // 0-1, share of the smaller project found in the other
  sharedExamples: string[]; // "a/path:line ~ b/path:line"
  reason: string;
}

interface Doc {
  id: string;
  name: string;
  repoUrl?: string;
  snippets: Record<string, string>;
}

const norm = (line: string) => line.replace(/\s+/g, '').toLowerCase();

/** 3-line windows of meaningful code, keyed by content, remembering where each came from. */
const fingerprints = (snippets: Record<string, string>) => {
  const out = new Map<string, string>();
  for (const [path, content] of Object.entries(snippets)) {
    if (!isSourceFile(path) || /\.(md|txt|json|lock|svg)$/i.test(path)) continue;
    const lines = content
      .split('\n')
      .map((l, i) => ({ l: norm(l), n: i + 1 }))
      .filter((x) => x.l.length >= 12); // drop braces, blank-ish and tiny boilerplate lines
    for (let i = 0; i + 2 < lines.length; i++) {
      const key = lines[i].l + '|' + lines[i + 1].l + '|' + lines[i + 2].l;
      if (!out.has(key)) out.set(key, `${path}:${lines[i].n}`);
    }
  }
  return out;
};

/**
 * Pairs of submissions whose code is substantially the same. Windows shared by at least half the
 * cohort (starter templates, framework scaffolds) are ignored so only unusual overlap counts.
 * ponytail: all-pairs, O(n^2) over submissions; fine for class-sized events, switch to an
 * inverted index over windows if events reach thousands of submissions.
 */
export const findSimilar = (docs: Doc[], threshold = 0.6, minShared = 15): SimilarityFlag[] => {
  const prints = docs.map((d) => fingerprints(d.snippets));
  const df = new Map<string, number>();
  for (const p of prints) for (const k of p.keys()) df.set(k, (df.get(k) || 0) + 1);
  // at least 3 submissions and half the cohort: a copied PAIR is never mistaken for a template
  const common = (k: string) => (df.get(k) || 0) >= Math.max(3, docs.length / 2);

  const flags: SimilarityFlag[] = [];
  const repo = (u?: string) => (u || '').toLowerCase().replace(/\.git$|\/+$/g, '');
  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      const [a, b] = [docs[i], docs[j]];
      if (repo(a.repoUrl) && repo(a.repoUrl) === repo(b.repoUrl)) {
        flags.push({
          subAId: a.id,
          subBId: b.id,
          subAName: a.name,
          subBName: b.name,
          similarity: 1,
          sharedExamples: [],
          reason: `Both submitted the same repository (${a.repoUrl})`
        });
        continue;
      }
      const pa = [...prints[i].keys()].filter((k) => !common(k));
      const pb = new Set([...prints[j].keys()].filter((k) => !common(k)));
      const shared = pa.filter((k) => pb.has(k));
      const similarity = shared.length / Math.max(1, Math.min(pa.length, pb.size));
      if (shared.length >= minShared && similarity >= threshold) {
        flags.push({
          subAId: a.id,
          subBId: b.id,
          subAName: a.name,
          subBName: b.name,
          similarity: Math.round(similarity * 100) / 100,
          sharedExamples: shared
            .slice(0, 5)
            .map((k) => `${prints[i].get(k)} ~ ${prints[j].get(k)}`),
          reason: `${Math.round(similarity * 100)}% of the smaller project's distinctive code appears in the other (${shared.length} matching blocks)`
        });
      }
    }
  }
  return flags.sort((x, y) => y.similarity - x.similarity);
};
