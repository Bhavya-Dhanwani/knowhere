export interface UntrustedInputSource {
  source: 'README' | 'LIVE_SITE' | 'API_ERROR' | 'COMMIT_MSG' | 'CODE_COMMENT';
  content: string;
  identifier?: string;
}

export interface InjectionDetectionResult {
  hasInjectionMarker: boolean;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'NONE';
  markers: Array<{
    pattern: string;
    snippet: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    source: 'README' | 'LIVE_SITE' | 'API_ERROR' | 'COMMIT_MSG' | 'CODE_COMMENT';
  }>;
  flaggedForHumanReview: boolean;
  reason?: string;
}

export interface ExtractedNeutralClaims {
  claimedFeatures: string[];
  claimedEndpoints: string[];
  techStackClaims: string[];
  summary: string;
  secondarySafetyPassed: boolean;
}

export interface SanitizationResult {
  delimitedContext: string;
  extractedClaims: ExtractedNeutralClaims;
  detectionResult: InjectionDetectionResult;
  humanReviewRequired: boolean;
  sanitizationPassed: boolean;
}
