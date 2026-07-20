import { setTimeout as delay } from "node:timers/promises";

type JwtPayload = { iat?: number };

function issuedAt(accessToken: string) {
  const encodedPayload = accessToken.split(".")[1];
  if (!encodedPayload) throw new Error("Access token payload is missing.");
  const payload = JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8"),
  ) as JwtPayload;
  if (typeof payload.iat !== "number") {
    throw new Error("Access token issue time is missing.");
  }
  return payload.iat;
}

export async function waitUntilAccessTokenIsCurrent(accessToken: string) {
  const validAt = (issuedAt(accessToken) + 1) * 1000;
  const waitMilliseconds = Math.max(0, validAt - Date.now());
  if (waitMilliseconds > 0) await delay(waitMilliseconds);
}
