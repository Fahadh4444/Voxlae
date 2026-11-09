import { NextResponse } from "next/server";
import { TASK_MODELS } from "@/ai/models";
import { configuredProviders, PROVIDER_IDS } from "@/ai/providers";

/**
 * Reports which providers hold a credential and how each task is currently bound.
 *
 * Deliberately reports configuration only — it never calls a provider, so hitting it costs
 * nothing and is safe to poll.
 */
export async function GET() {
  const configured = configuredProviders();
  return NextResponse.json({
    providers: PROVIDER_IDS.map((id) => ({
      id,
      configured: configured.includes(id),
    })),
    tasks: TASK_MODELS,
  });
}
