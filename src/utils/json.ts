export const safeJsonParse = <T>(str: string): T | undefined => {
  try {
    return JSON.parse(str) as T;
  } catch {
    return undefined;
  }
};

export const safeJsonStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return '';
  }
};
