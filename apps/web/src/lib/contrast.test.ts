/**
 * WCAG contrast check for the design tokens in index.css, in both themes.
 *
 * jsdom cannot compute colours, so axe's `color-contrast` rule cannot run in unit tests. This test
 * reads the real token values from the stylesheet and applies the WCAG 2.x formula, so a palette
 * change that breaks accessibility fails CI.
 *   - Text: 4.5:1 (AA).  - Borders of form fields and focus rings: 3:1 (1.4.11 non-text contrast).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');

type Rgb = [number, number, number];

function parseBlock(selector: RegExp): Record<string, string> {
  const body = css.match(selector)?.[1] ?? '';
  const vars: Record<string, string> = {};
  for (const [, name, value] of body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    vars[name!] = value!;
  }
  return vars;
}

const root = parseBlock(/^:root\s*\{([^}]*)\}/m);
const dark = { ...root, ...parseBlock(/^\.dark\s*\{([^}]*)\}/m) };
const THEMES = { light: root, dark } as const;

const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;

function luminance([r, g, b]: Rgb) {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(a: Rgb, b: Rgb) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** `color` at `alpha` painted over `bg` (what `bg-warning/15` looks like on a card). */
const over = (color: Rgb, alpha: number, bg: Rgb): Rgb =>
  color.map((c, i) => Math.round(c * alpha + bg[i]! * (1 - alpha))) as Rgb;

describe('design tokens parse', () => {
  it('finds both themes', () => {
    expect(Object.keys(root).length).toBeGreaterThan(15);
    expect(dark['background']).not.toBe(root['background']);
  });
});

for (const [theme, t] of Object.entries(THEMES)) {
  const c = (token: string) => rgb(t[token]!);
  const check = (label: string, fg: Rgb, bg: Rgb, min: number) =>
    it(`${theme}: ${label} >= ${min}:1`, () => {
      expect(ratio(fg, bg)).toBeGreaterThanOrEqual(min);
    });

  describe(`${theme} theme: text`, () => {
    for (const surface of ['background', 'card', 'muted']) {
      check(`foreground on ${surface}`, c('foreground'), c(surface), 4.5);
      check(`muted-foreground on ${surface}`, c('muted-foreground'), c(surface), 4.5);
    }
    check(
      'primary-foreground on primary (buttons, chips)',
      c('primary-foreground'),
      c('primary'),
      4.5,
    );
    for (const surface of ['background', 'card', 'primary-soft']) {
      check(`primary text/links on ${surface}`, c('primary'), c(surface), 4.5);
    }
    check(
      'destructive-foreground on destructive (bell badge)',
      c('destructive-foreground'),
      c('destructive'),
      4.5,
    );
    for (const surface of ['background', 'card']) {
      for (const tone of ['destructive', 'success', 'warning']) {
        check(`${tone} text on ${surface}`, c(tone), c(surface), 4.5);
      }
    }
  });

  describe(`${theme} theme: badges (text over a 15% tint of its own colour)`, () => {
    for (const surface of ['card', 'background']) {
      const bg = (token: string) => over(c(token), 0.15, c(surface));
      for (const tone of [
        'band-cheap',
        'band-mid',
        'band-expensive',
        'success',
        'warning',
        'destructive',
      ]) {
        check(`${tone} badge on ${surface}`, c(tone), bg(tone), 4.5);
      }
      check(`"no price" badge on ${surface}`, c('muted-foreground'), bg('band-none'), 4.5);
    }
  });

  describe(`${theme} theme: map pins`, () => {
    for (const band of ['band-cheap', 'band-mid', 'band-expensive', 'band-none']) {
      check(`pin text on ${band}`, c('band-foreground'), c(band), 4.5);
    }
  });

  describe(`${theme} theme: non-text (3:1)`, () => {
    check('focus ring on background', c('ring'), c('background'), 3);
    check('focus ring on card', c('ring'), c('card'), 3);
    check('form field border on card', c('input'), c('card'), 3);
  });
}
