import { FAMILY_SESSION_REQUIRED_ERR_MSG } from "@shared/const";

export function isExpectedFamilySessionError(error: unknown) {
  return error instanceof Error && error.message === FAMILY_SESSION_REQUIRED_ERR_MSG;
}
