// Importing modules
import { ContentItemType } from '../shared/models/contentItem.model.js';
import NotFound from '../shared/errors/NotFound.error.js';
import BadRequest from '../shared/errors/BadRequest.error.js';
import env from '../shared/config/env.config.js';

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
    ref_id: string,
    authorization?: string
  ): Promise<ExternalReferenceData> {
    const handler = this.validateHandlers.get(type);

    if (!handler) {
      const item = await this.fetchRemote(type, ref_id, authorization);
      return {
        title: String(item.title || `${type} resource`),
        max_score: Number(item.max_score ?? 0)
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
  async fetchItemDetail(
    type: ContentItemType,
    ref_id: string,
    authorization?: string
  ): Promise<Record<string, unknown>> {
    const handler = this.detailHandlers.get(type);

    if (!handler) {
      return this.fetchRemote(type, ref_id, authorization);
    }

    const detail = await handler(ref_id);
    if (!detail) {
      throw new NotFound(`Details for ${type} with ID '${ref_id}' not found in target service.`);
    }

    return detail;
  }

  private async fetchRemote(
    type: ContentItemType,
    refId: string,
    authorization?: string
  ): Promise<Record<string, any>> {
    if (!refId) throw new BadRequest('Invalid reference ID');
    const target =
      type === 'video' || type === 'notes'
        ? `${env.MEDIA_SERVICE_URL}/api/resources/${encodeURIComponent(refId)}`
        : type === 'mcq'
          ? `${env.MCQ_SERVICE_URL}/api/questions/${encodeURIComponent(refId)}/display`
          : `${env.CODING_SERVICE_URL}/api/questions/${encodeURIComponent(refId)}/display`;
    const response = await fetch(target, {
      headers: authorization ? { authorization } : {},
      signal: AbortSignal.timeout(5_000)
    });
    if (response.status === 404) throw new NotFound(`Referenced ${type} '${refId}' was not found.`);
    if (!response.ok)
      throw new BadRequest(`Unable to validate referenced ${type} (HTTP ${response.status}).`);
    const payload = await response.json();
    return payload?.data || payload;
  }
}

export const externalContentService = new ExternalContentService();
export default externalContentService;
