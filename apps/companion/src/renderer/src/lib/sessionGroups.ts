import type { ChatSession } from "@mimica/shared";

export interface SessionGroup {
  label: string;
  sessions: ChatSession[];
}

function startOfLocalDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function groupSessionsByDate(sessions: ChatSession[]): SessionGroup[] {
  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const yesterdayStart = todayStart - 86_400_000;

  const today: ChatSession[] = [];
  const yesterday: ChatSession[] = [];
  const older: ChatSession[] = [];

  for (const session of sessions) {
    const t = new Date(session.updatedAt).getTime();
    if (t >= todayStart) today.push(session);
    else if (t >= yesterdayStart) yesterday.push(session);
    else older.push(session);
  }

  const groups: SessionGroup[] = [];
  if (today.length) groups.push({ label: "今日", sessions: today });
  if (yesterday.length) groups.push({ label: "昨日", sessions: yesterday });
  if (older.length) groups.push({ label: "それ以前", sessions: older });
  return groups;
}
