import axe from 'axe-core';

/**
 * Runs axe on a rendered subtree and returns readable violation lines (empty = clean).
 *
 * Two rules are off on purpose:
 *  - `color-contrast`: jsdom has no layout/colour engine. Contrast is covered by
 *    src/lib/contrast.test.ts (tokens) and by the real-browser check documented in the README.
 *  - `region`: components are rendered alone, without the page landmarks around them.
 */
export async function a11yViolations(container: Element): Promise<string[]> {
  const results = await axe.run(container, {
    rules: { 'color-contrast': { enabled: false }, region: { enabled: false } },
  });
  return results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help} → ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`,
  );
}
