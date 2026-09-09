// Importing modules
import jwt from 'jsonwebtoken';
import { randomBytes, randomInt } from 'node:crypto';
import env from '../config/env.config.js';
import { EXPIRY } from '../constants/tokens.constants.js';

// function to generate access token
function generateAccessToken(payload: Record<string, unknown> | object) {
  return jwt.sign(payload, env.ACCESS_TOKEN_SECRET, { expiresIn: EXPIRY.ACCESS_TOKEN });
}

// function to generate refresh token
function generateRefreshToken(payload: Record<string, unknown> | object) {
  return jwt.sign(payload, env.REFRESH_TOKEN_SECRET, { expiresIn: EXPIRY.REFRESH_TOKEN });
}

function generateOTPToken(length = 6) {
  const min = Math.pow(10, length - 1);
  const maxExclusive = Math.pow(10, length);
  return randomInt(min, maxExclusive).toString();
}

function generateResetPasswordToken(length = 32) {
  return randomBytes(Math.ceil((length * 3) / 4))
    .toString('base64url')
    .slice(0, length);
}

export { generateAccessToken, generateRefreshToken, generateOTPToken, generateResetPasswordToken };
