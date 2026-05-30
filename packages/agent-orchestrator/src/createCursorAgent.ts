import { Agent } from "@cursor/sdk";

export interface CreateCursorAgentParams {
  apiKey: string;
  workspacePath: string;
}

export async function createCursorAgent(
  params: CreateCursorAgentParams,
): Promise<Awaited<ReturnType<typeof Agent.create>>> {
  const base = {
    apiKey: params.apiKey,
    model: { id: "composer-2.5" as const },
    name: "Mimica",
  };

  const localBase = {
    cwd: params.workspacePath,
    settingSources: ["project"] as ("project")[],
  };

  try {
    return await Agent.create({
      ...base,
      local: { ...localBase, sandboxOptions: { enabled: true } },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const sandboxUnsupported = /sandbox/i.test(message);
    if (!sandboxUnsupported) throw err;
    console.warn(
      "[mimica] sandboxOptions unsupported in this Cursor SDK build; creating agent without sandbox",
    );
    return await Agent.create({
      ...base,
      local: localBase,
    });
  }
}
