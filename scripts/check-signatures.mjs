// Checks the LeetCode-style drivers end to end: every parameter type round-trips through every
// language, and a real problem (Two Sum) is judged correctly. Needs the judge-runner:
//   JUDGE_URL=http://localhost:5010 node scripts/check-signatures.mjs
import { judgeCode, starterCode, wrapSolution, PARAM_TYPES } from '../packages/shared/dist/index.js';

const runnerUrl = process.env.JUDGE_URL || 'http://localhost:5010';
const SAMPLE = {
  int: '-42',
  long: '9007199254740',
  double: '2.5',
  boolean: 'true',
  string: '"he said \\"hi\\"\\n"',
  'int[]': '[3,-1,2]',
  'long[]': '[10000000000,-5]',
  'double[]': '[1.5,-0.25]',
  'boolean[]': '[true,false]',
  'string[]': '["a","b c"]',
  'int[][]': '[[1,2],[],[3]]',
  'string[][]': '[["x"],["y","z"]]'
};
// identity function body per language
const BODY = {
  javascript: (fn) => `var ${fn} = function(x) { return x; };`,
  python: (fn) => `class Solution:\n    def ${fn}(self, x):\n        return x\n`,
  cpp: (fn, t) => starterCode({ functionName: fn, params: [{ name: 'x', type: t }], returnType: t }, 'cpp').replace('        \n', '        return x;\n'),
  java: (fn, t) => starterCode({ functionName: fn, params: [{ name: 'x', type: t }], returnType: t }, 'java').replace('        \n', '        return x;\n')
};

let failed = 0;
const check = async (label, language, sig, code, cases) => {
  const v = await judgeCode(language, wrapSolution(sig, language, code), cases, { runnerUrl });
  const ok = v.passed === v.total;
  if (!ok) failed++;
  console.log(`${ok ? '✓' : '✗'} ${language.padEnd(10)} ${label}${ok ? '' : `  -> ${v.error} ${JSON.stringify(v.cases?.[0]?.output)}`}`);
};

for (const language of ['javascript', 'python', 'cpp', 'java']) {
  for (const t of PARAM_TYPES) {
    const sig = { functionName: 'echo', params: [{ name: 'x', type: t }], returnType: t };
    await check(`echo ${t}`, language, sig, BODY[language]('echo', t), [
      { input: SAMPLE[t], expectedOutput: SAMPLE[t] }
    ]);
  }
}

const twoSum = {
  functionName: 'twoSum',
  params: [
    { name: 'nums', type: 'int[]' },
    { name: 'target', type: 'int' }
  ],
  returnType: 'int[]'
};
const SOLUTIONS = {
  javascript: `var twoSum = function(nums, target) {
    const seen = new Map();
    for (let i = 0; i < nums.length; i++) {
        if (seen.has(target - nums[i])) return [seen.get(target - nums[i]), i];
        seen.set(nums[i], i);
    }
};`,
  python: `class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        seen = {}
        for i, n in enumerate(nums):
            if target - n in seen:
                return [seen[target - n], i]
            seen[n] = i
`,
  cpp: `class Solution {
public:
    vector<int> twoSum(vector<int>& nums, int target) {
        unordered_map<int, int> seen;
        for (int i = 0; i < (int)nums.size(); i++) {
            if (seen.count(target - nums[i])) return {seen[target - nums[i]], i};
            seen[nums[i]] = i;
        }
        return {};
    }
};`,
  java: `public class Solution {
    public int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> seen = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            if (seen.containsKey(target - nums[i])) return new int[] { seen.get(target - nums[i]), i };
            seen.put(nums[i], i);
        }
        return new int[0];
    }
}`
};
const cases = [
  { input: '[2,7,11,15]\n9', expectedOutput: '[0,1]' },
  { input: '[3,2,4]\n6', expectedOutput: '[1, 2]' },
  { input: '[3,3]\r\n6\r\n', expectedOutput: '[0,1]\n' }
];
for (const language of Object.keys(SOLUTIONS)) {
  await check('twoSum', language, twoSum, SOLUTIONS[language], cases);
}

console.log(failed ? `\n${failed} check(s) FAILED` : '\nALL SIGNATURE CHECKS PASSED');
process.exit(failed ? 1 : 0);
