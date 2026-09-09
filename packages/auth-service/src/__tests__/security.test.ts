import { validationResult } from 'express-validator';
import {
  resetPasswordValidators,
  verifyEmailValidators
} from '../modules/public/auth/auth.validator.js';
import buildTokenPayload from '../shared/utils/buildTokenPayload.util.js';
import { generateOTPToken, generateResetPasswordToken } from '../shared/utils/token.util.js';

const runValidation = async (validators: any[], body: Record<string, unknown>) => {
  const request = { body } as any;
  for (const validator of validators.slice(0, -1)) await validator.run(request);
  return validationResult(request);
};

describe('authentication security boundaries', () => {
  test('rejects Mongo query operators as reset tokens', async () => {
    const result = await runValidation(resetPasswordValidators, {
      token: { $ne: null },
      password: 'new-password'
    });
    expect(result.isEmpty()).toBe(false);
  });

  test('requires a six-digit email verification code', async () => {
    const result = await runValidation(verifyEmailValidators, {
      email: 'learner@example.com',
      token: 'not-an-otp'
    });
    expect(result.isEmpty()).toBe(false);
  });

  test('defaults signed-in users to the unprivileged trainee role', async () => {
    const payload = await buildTokenPayload({
      _id: { toString: () => 'user-1' },
      email: 'learner@example.com'
    });
    expect(payload.role).toBe('trainee');
  });

  test('uses fixed-format cryptographic one-time and reset tokens', () => {
    const otp = generateOTPToken();
    const resetA = generateResetPasswordToken();
    const resetB = generateResetPasswordToken();
    expect(otp).toMatch(/^\d{6}$/);
    expect(resetA).toHaveLength(32);
    expect(resetA).not.toBe(resetB);
  });
});
