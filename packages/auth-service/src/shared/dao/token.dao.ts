// Importing modules
import Token from '../models/token.model.js';
import { createHash } from 'node:crypto';

const digestToken = (value: string) => createHash('sha256').update(value).digest('hex');

// class for the Token Data Access Object (DAO)
class TokenDAO {
  tokenModel: typeof Token;

  constructor() {
    this.tokenModel = Token;
  }

  // method to create a new token
  async createToken(tokenData: Record<string, unknown>) {
    const token = await this.tokenModel.create({
      ...tokenData,
      value: digestToken(String(tokenData.value || ''))
    });
    return token;
  }

  // method to find a token by its value
  async findTokenByValue(value: string) {
    const token = await this.tokenModel.findOne({ value: digestToken(value) });
    return token;
  }

  // method to delete a token by its value
  async deleteTokenByValue(value: string) {
    const result = await this.tokenModel.deleteOne({ value: digestToken(value) });
    return result;
  }

  // method to delete a token by its email and type
  async deleteTokenByEmail(email: string, type: string) {
    const result = await this.tokenModel.deleteMany({ email: email, type: type });
    return result;
  }

  async consumeValidToken(value: string, type: 'otp' | 'reset' | 'invitation', email?: string) {
    return await this.tokenModel.findOneAndDelete({
      value: digestToken(value),
      type,
      expiresAt: { $gt: new Date() },
      ...(email ? { email: email.toLowerCase() } : {})
    });
  }
}

export default TokenDAO;
