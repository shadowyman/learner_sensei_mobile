export type ArtifactState =
  | 'Pending'
  | 'Dispatching'
  | 'AwaitingReview'
  | 'Remediating'
  | 'Complete'
  | 'Error';

export type ReviewVerdict = 'PASS' | 'FAIL' | 'ERROR' | 'COMMAND_ERROR' | 'PARSE_ERROR';

export interface StatusUpdateMessage {
  readonly type: 'status:update';
  readonly artifactId: string;
  readonly state: ArtifactState;
  readonly text: string;
  readonly spinner: boolean;
  readonly aiLine?: string;
  readonly verdict?: ReviewVerdict;
  readonly timestamp: number;
}

export interface LogAppendMessage {
  readonly type: 'log:append';
  readonly artifactId: string;
  readonly threadId: number;
  readonly message: string;
  readonly timestamp: number;
}

export interface NewArtifactMessage {
  readonly type: 'status:newArtifact';
  readonly originalArtifact: string;
  readonly newArtifactPath: string;
  readonly timestamp: number;
}

export interface ErrorMessage {
  readonly type: 'status:error';
  readonly artifactId: string;
  readonly message: string;
  readonly timestamp: number;
}

export interface CompleteMessage {
  readonly type: 'status:complete';
  readonly artifactId: string;
  readonly verdict: ReviewVerdict;
  readonly timestamp: number;
}

export interface WorkerHeartbeatMessage {
  readonly type: 'status:heartbeat';
  readonly artifactId: string;
  readonly timestamp: number;
}

export type WorkerToMainMessage =
  | StatusUpdateMessage
  | LogAppendMessage
  | NewArtifactMessage
  | ErrorMessage
  | CompleteMessage
  | WorkerHeartbeatMessage;

export interface ShutdownMessage {
  readonly type: 'control:shutdown';
}

export type MainToWorkerMessage = ShutdownMessage;

export interface ArtifactContext {
  readonly artifactPath: string;
  readonly originalArtifact: string;
  readonly slug: string;
  readonly narrative: string;
  readonly reviewProcessDir: string;
  readonly threadId: number;
}

export interface WorkerInitMessage {
  readonly context: ArtifactContext;
}

export interface ArtifactStatusRecord {
  artifactId: string;
  state: ArtifactState;
  text: string;
  spinner: boolean;
  threadId?: number;
  aiLine?: string;
  verdict?: ReviewVerdict;
  lastUpdate: number;
}

export interface DashboardLogEntry {
  raw: string;
  visible: string;
  artifactId?: string;
  threadId?: number;
  timestamp?: number;
}

export interface DashboardSnapshot {
  statuses: ArtifactStatusRecord[];
  logs: DashboardLogEntry[];
}
