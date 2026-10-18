// Check cancellation on both sides of each asynchronous frame. React may
// unmount/remount the preview while a frame is pending (including StrictMode).
export async function collectSequenceMeasurements<T>(
  count: number,
  render: (index: number) => void,
  measure: () => T | undefined,
  active: () => boolean,
  nextFrame: () => Promise<void>,
): Promise<T[] | null> {
  const values: T[] = [];
  for (let i = 0; i < count; i++) {
    await nextFrame();
    if (!active()) return null;
    render(i);
    await nextFrame();
    if (!active()) return null;
    const value = measure();
    if (value !== undefined) values.push(value);
  }
  return active() ? values : null;
}
