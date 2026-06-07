import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { mimeFromExtension } from "./mime.js";

export function fileProtocolResponse(
  filePath: string,
  mimeType: string,
  extraHeaders?: HeadersInit,
): Response {
  try {
    const data = readFileSync(filePath);
    return new Response(data, {
      headers: {
        "Content-Type": mimeType,
        ...extraHeaders,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[mimica-protocol] read failed for ${filePath}: ${message}`);
    return new Response("Not Found", { status: 404 });
  }
}

export function fileProtocolResponseByExt(
  filePath: string,
  mimeMap: Record<string, string>,
  extraHeaders?: HeadersInit,
): Response {
  const mimeType = mimeFromExtension(extname(filePath), mimeMap);
  return fileProtocolResponse(filePath, mimeType, extraHeaders);
}
