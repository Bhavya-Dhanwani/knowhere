import {
  judgeCode,
  judgeStatus,
  outputsMatch,
  signatureError,
  starterCode,
  wrapSolution
} from '@lms/shared';
import type { FunctionSignature } from '@lms/shared';

const twoSum: FunctionSignature = {
  functionName: 'twoSum',
  params: [
    { name: 'nums', type: 'int[]' },
    { name: 'target', type: 'int' }
  ],
  returnType: 'int[]'
};

describe('LeetCode-style signatures', () => {
  it('rejects unusable signatures', () => {
    expect(signatureError(twoSum)).toBeNull();
    expect(signatureError({ ...twoSum, functionName: 'two sum' })).toMatch(/identifier/);
    expect(signatureError({ ...twoSum, params: [] })).toMatch(/1 to 8/);
    expect(signatureError({ ...twoSum, returnType: 'map' })).toMatch(/return type/);
    expect(signatureError({ ...twoSum, params: [twoSum.params[0], twoSum.params[0]] })).toMatch(
      /twice/
    );
  });

  it('writes LeetCode starter templates', () => {
    expect(starterCode(twoSum, 'python')).toContain(
      'def twoSum(self, nums: List[int], target: int) -> List[int]:'
    );
    expect(
      starterCode(twoSum, 'python').startsWith(
        '# @param nums: List[int]\n# @param target: int\n# @return: List[int]\nclass Solution:'
      )
    ).toBe(true);
    expect(starterCode(twoSum, 'java')).toContain(' * @param nums: int[]');
    expect(starterCode(twoSum, 'cpp')).toContain(
      'vector<int> twoSum(vector<int>& nums, int target)'
    );
    expect(starterCode(twoSum, 'java')).toContain('public int[] twoSum(int[] nums, int target)');
    expect(starterCode(twoSum, 'javascript')).toContain('var twoSum = function(nums, target)');
  });

  it('compares outputs as JSON', () => {
    expect(outputsMatch('[0,1]', '[0, 1]\n')).toBe(true);
    expect(outputsMatch('2', '2.0')).toBe(true);
    expect(outputsMatch('0.3333333', '0.33333334')).toBe(true);
    expect(outputsMatch('[0,1]', '[1,0]')).toBe(false);
    expect(outputsMatch('hello world', 'hello world  ')).toBe(true);
  });

  it('judges a JavaScript function through the hidden driver', async () => {
    const code = `var twoSum = function(nums, target) {
      for (let i = 0; i < nums.length; i++)
        for (let j = i + 1; j < nums.length; j++)
          if (nums[i] + nums[j] === target) return [i, j];
    };`;
    const cases = [
      { input: '[2,7,11,15]\n9', expectedOutput: '[0,1]' },
      { input: '[3,2,4]\n6', expectedOutput: '[1,2]' }
    ];
    const ok = await judgeCode('javascript', wrapSolution(twoSum, 'javascript', code), cases);
    expect(ok.passed).toBe(2);
    expect(judgeStatus(ok)).toBe('Accepted');

    const wrong = await judgeCode(
      'javascript',
      wrapSolution(twoSum, 'javascript', 'var twoSum = function() { return [9, 9]; };'),
      cases
    );
    expect(judgeStatus(wrong)).toBe('Wrong Answer');

    const missing = await judgeCode(
      'javascript',
      wrapSolution(twoSum, 'javascript', 'var x = 1;'),
      cases
    );
    expect(judgeStatus(missing)).toBe('Runtime Error');
  });
});
