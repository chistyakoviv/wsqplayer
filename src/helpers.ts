export function prependZeros(num: number, prependLen = 3): string {
  // Support only positive integer numbers and zero
  let val = Math.floor(num);
  const res: number[] = new Array(prependLen).fill(0);
  while (val > 0) {
    if (prependLen === 1) {
      return String(num);
    }
    res[--prependLen] = val % 10;
    val = Math.floor(val / 10);
  }
  return res.join('');
}

export function fitCover(
  sWidth: number,
  sHeight: number,
  dWidth: number,
  dHeight: number,
) {
  const ratio = sWidth / sHeight;
  return {
    width: Math.max(dWidth, dHeight * ratio),
    height: Math.max(dHeight, dWidth / ratio),
  };
}

export function fitContain(
  sWidth: number,
  sHeight: number,
  dWidth: number,
  dHeight: number,
) {
  const ratio = sWidth / sHeight;
  return {
    width: Math.min(dWidth, dHeight * ratio),
    height: Math.min(dHeight, dWidth / ratio),
  };
}

export function parseSeparatedNumbers(str: string, sep = '-') {
  const res: number[] = [];
  let start = 0;
  for (let i = 0; i <= str.length; i++) {
    if (i === str.length || str[i] === sep) {
      res.push(parseFloat(str.substring(start, i)));
      start = i + 1;
    }
  }
  return res;
}

export function clamp(value: number, minValue: number, maxValue: number) {
  return Math.min(Math.max(value, minValue), maxValue);
}

export function debounce(func: (...args: unknown[]) => void, ms: number) {
  let timeout: string | number | NodeJS.Timeout | undefined;
  return function (this: () => void, ...args: unknown[]): void {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), ms);
  };
}
