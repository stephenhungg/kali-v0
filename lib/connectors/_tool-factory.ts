/**
 * Shared helper that turns a pure query function into a ToolDefinition.
 *
 * Every connector follows the same shape: load (cached) seed, run a typed
 * query against it, return validated output, audit-log the call. Duplicating
 * that 10× would be 400 lines of boilerplate, so we factor it once.
 *
 * Usage from a connector module:
 *
 *   const makeTool = makeToolFactory("bloomerang", getBloomerangSeed);
 *   const tools: ToolDefinition[] = [
 *     makeTool({
 *       name: "bloomerang.searchDonors",
 *       description: "...",
 *       domain: "donor",
 *       input: searchDonorsInput,
 *       output: searchDonorsOutput,
 *       collectRecordIds: out => out.donors.map(d => d.kali_entity_id),
 *       run: (seed, input) => searchDonors(seed, input),
 *     }),
 *   ];
 */

import type { z } from "zod";
import type {
  ConnectorId,
  ToolContext,
  ToolDefinition,
  ToolDomain,
} from "./base";
import { hashParams } from "./test-helpers";

export interface MakeToolSpec<
  TSeed,
  TInput extends z.ZodTypeAny,
  TOutput extends z.ZodTypeAny,
> {
  name: string;
  description: string;
  domain: ToolDomain;
  input: TInput;
  output: TOutput;
  /** Pure query — no I/O, takes the validated seed and the typed input. */
  run: (
    seed: TSeed,
    input: z.infer<TInput>,
  ) => z.infer<TOutput> | Promise<z.infer<TOutput>>;
  /**
   * Optional: pull the kali_entity_id (or comparable record id) list out of
   * the result so the audit log can fingerprint what was returned.
   */
  collectRecordIds?: (out: z.infer<TOutput>) => string[];
}

export function makeToolFactory<TSeed>(
  connectorId: ConnectorId,
  getSeed: () => Promise<TSeed>,
) {
  return function makeTool<
    TInput extends z.ZodTypeAny,
    TOutput extends z.ZodTypeAny,
  >(spec: MakeToolSpec<TSeed, TInput, TOutput>): ToolDefinition<TInput, TOutput> {
    return {
      name: spec.name,
      description: spec.description,
      domain: spec.domain,
      input: spec.input,
      output: spec.output,
      handler: async (input, ctx: ToolContext) => {
        const t0 = Date.now();
        const seed = await getSeed();
        const result = await spec.run(seed, input);
        const recordIds = spec.collectRecordIds ? spec.collectRecordIds(result) : [];
        await ctx.audit({
          source: connectorId,
          toolName: spec.name,
          paramsHash: hashParams(input),
          recordIds,
          durationMs: Date.now() - t0,
        });
        return result;
      },
    };
  };
}
