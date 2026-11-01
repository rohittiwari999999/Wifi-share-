export type DeviceType = 'PHONE' | 'TABLET' | 'BROWSER';

export interface DeviceInfo {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  deviceType: DeviceType;
  protocolVersion: string;
  isAvailable: boolean;
  lastSeenTimestamp: number;
}

export interface FileTransferItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  sha256?: string;
  dataUrl?: string;
  blob?: Blob;
}

export type TransferState =
  | 'IDLE'
  | 'SCANNING'
  | 'HANDSHAKE'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'IN_PROGRESS'
  | 'PAUSED'
  | 'COMPLETED'
  | 'FAILED'
  | 'REJECTED'
  | 'CANCELLED';

export interface TransferProgress {
  sessionId: string;
  fileId: string;
  fileName: string;
  bytesTransferred: number;
  totalBytes: number;
  bytesPerSecond: number;
  estimatedRemainingSeconds: number;
  currentFileIndex: number;
  totalFiles: number;
  state: TransferState;
  errorMessage?: string;
}

export interface TransferHistoryRecord {
  id: string;
  sessionId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  direction: 'SENT' | 'RECEIVED';
  peerName: string;
  timestamp: number;
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
  sha256: string;
}

export interface BrowserSession {
  token: string;
  senderName: string;
  files: FileTransferItem[];
  totalBytes: number;
  createdAt: number;
  expiresAt: number;
  isApproved: boolean;
  isRejected: boolean;
}

export interface ProtocolLogEntry {
  id: string;
  timestamp: number;
  type: 'NSD_DISCOVERY' | 'NSD_REGISTER' | 'HTTP_REQUEST' | 'HTTP_RESPONSE' | 'STREAM_CHUNK';
  source: string;
  destination: string;
  endpoint?: string;
  payloadSummary: string;
  status?: string;
}
