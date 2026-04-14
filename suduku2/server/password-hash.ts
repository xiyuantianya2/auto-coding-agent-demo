import crypto from "node:crypto";

/** scrypt 派生密钥长度（字节），与校验侧保持一致 */
const SCRYPT_KEYLEN = 64;

export type PasswordRecord = {
  algo: "scrypt";
  /** Base64(salt) */
  saltB64: string;
  /** Base64(scrypt(password, salt)) */
  hashB64: string;
  keylen: number;
};

function scryptDerive(password: string, salt: Buffer): Buffer {
  return crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
}

export function hashPassword(password: string): PasswordRecord {
  const salt = crypto.randomBytes(16);
  const hash = scryptDerive(password, salt);
  return {
    algo: "scrypt",
    saltB64: salt.toString("base64"),
    hashB64: hash.toString("base64"),
    keylen: SCRYPT_KEYLEN,
  };
}

/** 供后续 `login` 校验使用 */
export function verifyPassword(password: string, record: PasswordRecord): boolean {
  if (record.algo !== "scrypt" || record.keylen !== SCRYPT_KEYLEN) {
    return false;
  }
  const salt = Buffer.from(record.saltB64, "base64");
  const expected = Buffer.from(record.hashB64, "base64");
  const actual = scryptDerive(password, salt);
  if (expected.length !== actual.length) {
    return false;
  }
  return crypto.timingSafeEqual(expected, actual);
}
