// Importing modules
import Competency from '../models/competency.model.js';

// class to handle competency data access operations
class CompetencyDao {
  CompetencyModel: typeof Competency;

  constructor() {
    this.CompetencyModel = Competency;
  }

  // function to find all competencies by userId
  async findCompetenciesByUserId(userId: string) {
    return await this.CompetencyModel.find({ userId }).sort({ createdAt: -1 });
  }

  // function to find competency by userId and skill
  async findCompetencyByUserAndSkill(userId: string, skill: string) {
    return await this.CompetencyModel.findOne({ userId, skill });
  }

  // function to upsert competency
  async upsertCompetency(data: {
    userId: string;
    skill: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    score?: number;
    verifiedBy?: string;
  }) {
    return await this.CompetencyModel.findOneAndUpdate(
      { userId: data.userId, skill: data.skill },
      {
        $set: {
          level: data.level,
          score: data.score ?? 0,
          verifiedBy: data.verifiedBy || ''
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }
}

export default CompetencyDao;
