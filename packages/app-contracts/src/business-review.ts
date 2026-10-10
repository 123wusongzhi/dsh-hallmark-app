/** The immutable business evidence supplied by the host, never an Agent's review declaration. */
export interface SemanticReviewVersions {
  source: string;
  draft: string;
  policy?: string;
}

export interface SemanticReviewImage {
  id: string;
  role: 'source' | 'draft';
  /** An actual image URL or image data URL, kept intact for a vision-capable reviewer. */
  url: string;
}

export interface SemanticReviewQuestion {
  id: string;
  version: string;
  instructions: string;
  passCriteria: string;
  failCriteria: string;
  /** Application-owned choices; omitted preserves the binary probability question. */
  choices?: Record<string, { criteria: string; status: SemanticReviewStatus; applicable?: boolean }>;
  issue?: { field?: string; message: string; suggestion?: string };
  /** Omitted means all supplied images; [] explicitly marks a text-only question. */
  imageIds?: string[];
}

export interface SemanticReviewRequest {
  source: unknown;
  draft: unknown;
  versions: SemanticReviewVersions;
  questions: SemanticReviewQuestion[];
  images?: SemanticReviewImage[];
}

export type SemanticReviewStatus = 'passed' | 'rejected' | 'pending';
export type SemanticReviewActor = 'decisions' | 'independent-agent' | 'none';

export interface SemanticQuestionResult {
  id: string;
  version: string;
  status: SemanticReviewStatus;
  reviewer: SemanticReviewActor;
  /** The provider's estimate, not an empirically calibrated accuracy guarantee. */
  probability?: number;
  choice?: string;
  confidence?: number;
  /** False explicitly records an inapplicable criterion, rather than an affirmative finding. */
  applicable?: boolean;
  model?: string;
  reasonCode: string;
  field?: string;
  message?: string;
  suggestion?: string;
}

export interface SemanticReviewEvidence {
  versions: SemanticReviewVersions;
  thresholds: { pass: number; reject: number };
  requests: Array<{
    reviewer: SemanticReviewActor;
    model?: string;
    questionIds: string[];
    reasonCode: string;
    requestId?: string;
    reviewerId?: string;
    protocol?: string;
    inputTokens?: number;
    cost?: number;
  }>;
}

export interface SemanticReviewResult {
  status: SemanticReviewStatus;
  questions: SemanticQuestionResult[];
  evidence: SemanticReviewEvidence;
}

export interface SemanticReviewer {
  review(input: SemanticReviewRequest, signal?: AbortSignal): Promise<SemanticReviewResult>;
}

/** The host must create an independent session and withhold platform write tools. */
export interface IndependentReviewRequest extends SemanticReviewRequest {
  context: {
    mode: 'independent-review';
    toolPolicy: 'read-only';
    writeTools: [];
    reasons: Array<{ id: string; reasonCode: string }>;
  };
}

export interface IndependentReviewResult {
  reviewer: 'independent-agent';
  reviewerId: string;
  model: string;
  versions: SemanticReviewVersions;
  questions: Array<{
    id: string;
    version: string;
    status: SemanticReviewStatus;
    /** Required for questions with application-owned choices; the host maps it to status. */
    choice?: string;
    message?: string;
    suggestion?: string;
  }>;
}

export type IndependentReviewFallback = (
  input: IndependentReviewRequest,
  signal?: AbortSignal,
) => Promise<IndependentReviewResult>;
