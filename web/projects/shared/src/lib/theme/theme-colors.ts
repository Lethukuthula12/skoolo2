/** Colour calculations for validated, six-digit school theme colours. */
export function themeRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function themeMix(a: string, b: string, amount: number): string {
  const target = themeRgb(b);
  return '#' + themeRgb(a).map((c, i) => Math.round(c + (target[i] - c) * amount).toString(16).padStart(2, '0')).join('');
}

function luminance(hex: string): number {
  const [r, g, b] = themeRgb(hex).map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}

export function themeContrast(a: string, b: string): number {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export function themeForeground(background: string): string {
  return themeContrast(background, '#ffffff') >= 4.5 ? '#ffffff' : '#000000';
}

export function readableThemeColor(color: string, surface: string): string {
  let result = color;
  const target = luminance(surface) < 0.5 ? '#ffffff' : '#000000';
  for (let step = 0; step < 40 && themeContrast(result, surface) < 5; step++) {
    result = themeMix(result, target, 0.12);
  }
  return result;
}
