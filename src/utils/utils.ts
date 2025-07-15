export const timestampName = (prefix?: string) => {
  const ts = new Date();
  const tsString = ts
    .toLocaleString('en-US', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    })
    .replace(/,|:/g, '_')
    .replace(' ', '_');
  return `${prefix}_${tsString}`;
};

export const calculateDurationNs = (start: Date, end?: Date): number => {
  if (!end) {
    end = new Date();
  }
  return Number(end.getTime() - start.getTime()) * 1_000_000;
};
