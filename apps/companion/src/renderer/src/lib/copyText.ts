/** Copy plain text; Electron uses main-process clipboard IPC, then Clipboard API, then execCommand. */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (!text) return;

  if (typeof window !== "undefined" && window.mimica?.writeClipboardText) {
    try {
      await window.mimica.writeClipboardText(text);
      return;
    } catch {
      /* fall through */
    }
  }

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      /* fall through */
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    const ok = document.execCommand("copy");
    if (!ok) throw new Error("execCommand copy failed");
  } finally {
    document.body.removeChild(textarea);
  }
}
