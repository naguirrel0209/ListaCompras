import { describe, expect, it } from "vitest";
import { FAMILY_SESSION_REQUIRED_ERR_MSG } from "@shared/const";
import { isExpectedFamilySessionError } from "./query-errors";

describe("isExpectedFamilySessionError", () => {
  it("identifica la ausencia normal de sesión familiar", () => {
    expect(isExpectedFamilySessionError(new Error(FAMILY_SESSION_REQUIRED_ERR_MSG))).toBe(true);
  });

  it("no oculta errores reales de API", () => {
    expect(isExpectedFamilySessionError(new Error("La base de datos no está disponible."))).toBe(false);
  });
});
