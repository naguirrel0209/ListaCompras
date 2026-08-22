import type { Request, Response } from "express";
import { jwtVerify, SignJWT } from "jose";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { FAMILY_SESSION_COOKIE, FAMILY_SESSION_MAX_AGE } from "../shared/const";

export type FamilySession = {
  familyId: string;
  memberName: string;
};

function signingSecret() {
  if (!ENV.cookieSecret) {
    throw new Error("JWT_SECRET es obligatorio para firmar la sesión familiar.");
  }
  return new TextEncoder().encode(ENV.cookieSecret);
}

function readCookie(req: Request, name: string) {
  const header = req.headers.cookie;
  if (!header) return undefined;
  return header
    .split(";")
    .map(value => value.trim())
    .find(value => value.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

export async function getFamilySession(req: Request): Promise<FamilySession | null> {
  const token = readCookie(req, FAMILY_SESSION_COOKIE);
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, signingSecret());
    if (typeof payload.familyId !== "string" || typeof payload.memberName !== "string") {
      return null;
    }
    return { familyId: payload.familyId, memberName: payload.memberName };
  } catch {
    return null;
  }
}

export async function writeFamilySession(
  req: Request,
  res: Response,
  session: FamilySession,
) {
  const token = await new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(signingSecret());

  res.cookie(FAMILY_SESSION_COOKIE, token, {
    ...getSessionCookieOptions(req),
    maxAge: FAMILY_SESSION_MAX_AGE,
  });
}

export function clearFamilySession(req: Request, res: Response) {
  res.clearCookie(FAMILY_SESSION_COOKIE, {
    ...getSessionCookieOptions(req),
    maxAge: -1,
  });
}
