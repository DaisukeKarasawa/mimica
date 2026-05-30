import { Agent } from "@cursor/sdk";

export type CursorSdkConversationMode = "agent" | "plan";

export interface CreateCursorAgentParams {
  apiKey: string;
  workspacePath: string;
  mode?: CursorSdkConversationMode;
}

export async function createCursorAgent(
  params: CreateCursorAgentParams,
): Promise<Awaited<ReturnType<typeof Agent.create>>> {
  const sdkMode = params.mode ?? "agent";

  return Agent.create({
    apiKey: params.apiKey,
    model: { id: "composer-2.5" as const },
    name: "Mimica",
    mode: sdkMode,
    local: {
      cwd: params.workspacePath,
      settingSources: ["project"] as "project"[],
    },
  });
}
