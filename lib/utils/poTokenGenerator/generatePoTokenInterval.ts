import {
  type GeneratorOptions,
  type GeneratorReturnData,
  generateTrustedToken,
} from "./generatePoToken";

export interface IGeneratorOptions {
  interval?: number;
  onGenerate: (data: GeneratorReturnData) => any;
  generateInstant?: boolean;
  onError: (e: any) => any;
}

export type IntervalGeneratorOptions = IGeneratorOptions &
  Omit<GeneratorOptions, "skipPuppeteerCheck">;

export async function generateTrustedTokenInterval(
  options: IntervalGeneratorOptions,
) {
  if (!options.interval) options.interval = 6.048e8; // 1 week in ms

  if (options.generateInstant) {
    const tokens = await generateTrustedToken({
      ...options,
      skipPuppeteerCheck: false,
    }).catch((e) => e);

    if (tokens instanceof Error) {
      if (!options.onError) throw tokens;
      else options.onError(tokens);
    } else {
      options.onGenerate(tokens);
    }
  }

  // non blocking interval
  const interval = setInterval(async () => {
    const tokens = await generateTrustedToken({
      ...options,
      skipPuppeteerCheck: true,
    }).catch((e) => e);

    if (tokens instanceof Error) {
      if (!options.onError) throw tokens;
      else options.onError(tokens);
    } else {
      options.onGenerate(tokens);
    }
  }, options.interval);

  const background = () => interval.unref();
  const foreground = () => interval.ref();
  const stop = () => clearInterval(interval);

  return {
    background,
    foreground,
    stop,
  };
}
