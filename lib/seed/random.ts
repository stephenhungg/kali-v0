import { Faker, en } from "@faker-js/faker";
import seedrandom from "seedrandom";

export type Rng = ReturnType<typeof seedrandom>;

export function makeRng(seed: string): Rng {
  return seedrandom(seed);
}

export function makeFaker(seed: number): Faker {
  const f = new Faker({ locale: [en] });
  f.seed(seed);
  return f;
}

export function powerLaw(rng: Rng, min: number, max: number, _exponent = 2.5): number {
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  return Math.exp(logMin + rng() * (logMax - logMin));
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function pickN<T>(rng: Rng, arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    const i = Math.floor(rng() * copy.length);
    out.push(copy[i]);
    copy.splice(i, 1);
  }
  return out;
}

export function chance(rng: Rng, prob: number): boolean {
  return rng() < prob;
}

export function intBetween(rng: Rng, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function gaussian(rng: Rng, mean: number, std: number): number {
  const u1 = rng() || 0.0001;
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

export function dateBetween(rng: Rng, start: Date, end: Date): Date {
  const t = start.getTime() + rng() * (end.getTime() - start.getTime());
  return new Date(t);
}

export function driftName(rng: Rng, name: string): string {
  if (!chance(rng, 0.5)) return name;
  const variants = [
    () => name.replace(/^Catherine/i, "Cathy"),
    () => name.replace(/^William/i, "Bill"),
    () => name.replace(/^Robert/i, "Bob"),
    () => name.replace(/^Elizabeth/i, "Liz"),
    () => name.replace(/^Michael/i, "Mike"),
    () => name.replace(/^Christopher/i, "Chris"),
    () => name.replace(/^Jennifer/i, "Jen"),
    () => name.replace(/^Anthony/i, "Tony"),
    () => name + ".",
    () => name.toLowerCase(),
    () => name.toUpperCase(),
    () => name.replace(/\s/g, "  "),
    () => name.replace(/-/g, " "),
    (s = name) => s,
  ];
  return pick(rng, variants)();
}
