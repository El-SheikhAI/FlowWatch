export function generatePassword(length = 20): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%&*";
  const all = upper + lower + digits + symbols;

  const rng = new Uint8Array(length);
  crypto.getRandomValues(rng);

  let result = upper[rng[0] % upper.length]
    + lower[rng[1] % lower.length]
    + digits[rng[2] % digits.length]
    + symbols[rng[3] % symbols.length];

  for (let i = 4; i < length; i++) {
    result += all[rng[i] % all.length];
  }

  const chars = result.split("");

  for (let i = chars.length - 1; i > 0; i--) {
    const j = rng[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}

export type Strength = "weak" | "fair" | "good" | "strong";

export function passwordStrength(pw: string): { label: Strength; score: number } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 14) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  let label: Strength = "weak";
  if (score >= 4) label = "fair";
  if (score >= 5) label = "good";
  if (score >= 6) label = "strong";

  return { label, score };
}
