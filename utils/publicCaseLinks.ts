const LEGACY_PUBLIC_CASE_PATH_PREFIX = '/shared/case';
const SHORT_PUBLIC_CASE_PATH_PREFIX = '/c';
const BASE62_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const encodeBase62 = (value: bigint) => {
  if (value === 0n) return BASE62_ALPHABET[0];

  let current = value;
  let output = '';
  while (current > 0n) {
    const remainder = Number(current % 62n);
    output = `${BASE62_ALPHABET[remainder]}${output}`;
    current /= 62n;
  }

  return output;
};

const decodeBase62 = (value: string) => {
  let output = 0n;
  for (const character of value) {
    const index = BASE62_ALPHABET.indexOf(character);
    if (index === -1) return null;
    output = (output * 62n) + BigInt(index);
  }
  return output;
};

const insertUuidHyphens = (value: string) =>
  `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;

export const isUuidPublicCaseToken = (value: string) => UUID_PATTERN.test(value.trim());

export const shortenPublicCaseToken = (publicToken: string) => {
  const normalized = publicToken.trim().toLowerCase();
  if (!isUuidPublicCaseToken(normalized)) return publicToken.trim();
  const hex = normalized.replace(/-/g, '');
  return encodeBase62(BigInt(`0x${hex}`));
};

export const expandShortPublicCaseToken = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return null;
  if (isUuidPublicCaseToken(normalized)) return normalized.toLowerCase();

  const decoded = decodeBase62(normalized);
  if (decoded === null) return null;

  const hex = decoded.toString(16).padStart(32, '0');
  const uuid = insertUuidHyphens(hex);
  return isUuidPublicCaseToken(uuid) ? uuid.toLowerCase() : null;
};

export const normalizePublicCaseToken = (value: string) => {
  const normalized = value.trim();
  if (!normalized || normalized.length > 36) return '';
  if (isUuidPublicCaseToken(normalized)) return normalized.toLowerCase();
  return expandShortPublicCaseToken(normalized) || normalized;
};

export const buildPublicCasePath = (publicToken: string) =>
  `${SHORT_PUBLIC_CASE_PATH_PREFIX}/${encodeURIComponent(shortenPublicCaseToken(publicToken))}`;

export const getPublicCaseTokenFromPath = (pathname: string) => {
  const normalizedPath = pathname.trim();
  const prefixes = [`${SHORT_PUBLIC_CASE_PATH_PREFIX}/`, `${LEGACY_PUBLIC_CASE_PATH_PREFIX}/`];

  for (const prefix of prefixes) {
    if (!normalizedPath.startsWith(prefix)) continue;
    const token = normalizedPath.slice(prefix.length).split('/')[0]?.trim();
    if (token) return token;
  }

  return null;
};
