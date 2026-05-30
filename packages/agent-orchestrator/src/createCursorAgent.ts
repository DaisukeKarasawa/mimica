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

  try {
    return await Agent.create({
      ...base,
      local: {
        cwd: params.workspacePath,
        settingSources: [] as const,
        sandboxOptions: { enabled: true },
      },
    });
  } catch {
    return await Agent.create({
      ...base,
      local: { cwd: params.workspacePath, settingSources: [] as const },
    });
  }
}
