// Self-check for the plan catalog: every preset only sets fields its platform really has, and
// every price breakdown adds up to the advertised monthly total.   node deploy/check-plans.mjs
import { PLANS } from './plans.mjs';
import { PROVIDERS } from './providers/index.mjs';

let bad = 0;
for (const p of PLANS) {
  const provider = PROVIDERS[p.provider];
  const fields = new Set(provider?.fields.map((f) => f.key));
  const unknown = Object.keys(p.cfg).filter((k) => !fields.has(k));
  const sum = p.breakdown.reduce((t, [, cost]) => t + cost, 0);
  const problems = [
    !provider && `unknown platform ${p.provider}`,
    unknown.length && `preset sets unknown fields: ${unknown.join(', ')}`,
    Math.abs(sum - p.monthly) > 6 && `breakdown adds to $${sum.toFixed(0)}, plan says $${p.monthly}`
  ].filter(Boolean);
  if (problems.length) bad++;
  console.log(`${problems.length ? '✗' : '✓'} ${p.id.padEnd(20)} $${p.monthly}${problems.length ? `  ${problems.join('; ')}` : ''}`);
}
console.log(bad ? `\n${bad} plan(s) inconsistent` : '\nall plans consistent');
process.exit(bad ? 1 : 0);
