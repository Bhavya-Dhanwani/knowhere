// Importing modules
import { ContentItemType } from '../shared/models/contentItem.model.js';
import NotFound from '../shared/errors/NotFound.error.js';
import BadRequest from '../shared/errors/BadRequest.error.js';

export interface ExternalReferenceData {
  title: string;
  max_score: number;
}

export type ExternalFetcher = (
  ref_id: string
) => Promise<{ title: string; max_score?: number } | null>;
export type DetailFetcher = (ref_id: string) => Promise<Record<string, unknown> | null>;

class ExternalContentService {
  private validateHandlers: Map<ContentItemType, ExternalFetcher> = new Map();
  private detailHandlers: Map<ContentItemType, DetailFetcher> = new Map();

  // register handler for in-process Phase 1 integration or mock
  registerProvider(
    type: ContentItemType,
    validator: ExternalFetcher,
    detailFetcher?: DetailFetcher
  ) {
    this.validateHandlers.set(type, validator);
    if (detailFetcher) {
      this.detailHandlers.set(type, detailFetcher);
    }
  }

  // validates ref_id and returns denormalized title and max_score
  async validateAndFetchReference(
    type: ContentItemType,
    ref_id: string
  ): Promise<ExternalReferenceData> {
    const handler = this.validateHandlers.get(type);

    if (!handler) {
      // In production or phase 2, this makes HTTP call to target service
      // If no handler is registered yet, ensure ref_id is valid string or throw
      if (!ref_id) {
        throw new BadRequest('Invalid reference ID');
      }
      return {
        title: `Attached ${type} resource`,
        max_score: type === 'mcq' || type === 'coding' ? 10 : 0
      };
    }

    const item = await handler(ref_id);
    if (!item) {
      throw new NotFound(`Referenced ${type} with ID '${ref_id}' not found in target service.`);
    }

    return {
      title: item.title,
      max_score: item.max_score ?? (type === 'mcq' || type === 'coding' ? 10 : 0)
    };
  }

  // fetches full display details for clicked item in detail call
  async fetchItemDetail(type: ContentItemType, ref_id: string): Promise<Record<string, unknown>> {
    const handler = this.detailHandlers.get(type);

    if (!handler) {
      return {
        type,
        ref_id,
        status: 'ready'
      };
    }

    const detail = await handler(ref_id);
    if (!detail) {
      throw new NotFound(`Details for ${type} with ID '${ref_id}' not found in target service.`);
    }

    return detail;
  }
}

export const externalContentService = new ExternalContentService();
export default externalContentService;
