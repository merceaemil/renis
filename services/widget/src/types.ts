export type VerifyStatus = "PUBLISHED" | "REVOKED" | "TRANSCRIPT" | "UNKNOWN";

export interface VerifyResult {
  status: VerifyStatus;
  kind?: "diploma" | "transcript";
  message?: string;
  type?: string;
  title?: string;
  programme?: string | null;
  institution?: string;
  academicYear?: string;
  semester?: string;
  graduationYear?: number;
  honors?: string | null;
  holder?: string;
  revokedAt?: string;
  verifiedAt?: string;
}
