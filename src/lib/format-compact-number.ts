function trimTrailingZeros(value: string): string {
  return value.replace(/\.?0+$/, "");
}

function formatScaled(abs: number, divisor: number, suffix: string, sign: string): string {
  return `${sign}${trimTrailingZeros((abs / divisor).toFixed(2))}${suffix}`;
}

export function formatCompactNumber(value: number, locale?: string): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 1_000_000_000) {
    return formatScaled(abs, 1_000_000_000, "B", sign);
  }
  if (abs >= 1_000_000) {
    return formatScaled(abs, 1_000_000, "M", sign);
  }
  if (abs >= 1_000) {
    return formatScaled(abs, 1_000, "K", sign);
  }

  if (locale) {
    return new Intl.NumberFormat(locale, {
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return sign + trimTrailingZeros(abs.toFixed(2));
}
