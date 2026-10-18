/** Pointer convenience only; keyboard users reach the existing control with Tab. */
export function focusGroupControl(
  group: Element | null,
  target: Element | null,
) {
  if (
    target?.closest(
      'button, a, input, textarea, select, label, [role="button"], [role="link"], [contenteditable]:not([contenteditable="false"]), [tabindex]',
    )
  )
    return;
  group
    ?.querySelector<HTMLInputElement | HTMLTextAreaElement>(
      'input:not(:disabled):not([type="hidden"]), textarea:not(:disabled)',
    )
    ?.focus();
}
