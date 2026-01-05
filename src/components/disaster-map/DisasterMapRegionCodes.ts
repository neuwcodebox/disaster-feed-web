export const normalizeRegionCode = (code: string): string | null => {
  const digits = code.replace(/\D/g, '');
  if (!digits) {
    return null;
  }
  if (digits.length >= 10) {
    return digits.slice(0, 10);
  }
  return digits.padEnd(10, '0');
};

export const resolveRegionPrefix = (normalized: string): string => {
  const sigungu = normalized.slice(2, 5);
  if (sigungu === '000') {
    return normalized.slice(0, 2);
  }
  return normalized.slice(0, 5);
};
