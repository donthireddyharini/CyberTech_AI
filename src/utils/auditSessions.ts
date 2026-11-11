import type { ModerationRecord, SocialSyncLog } from '../types';

export interface AuditSession {
  id: string;
  name: string;
  created_at: string;
  started_at_ms: number;
}

export const AUDIT_SESSIONS_STORAGE_KEY = 'sentinel_audit_sessions_v2';
export const ACTIVE_AUDIT_SESSION_STORAGE_KEY = 'sentinel_active_audit_session_id_v2';

export function loadAuditSessions(): AuditSession[] {
  try {
    const raw = localStorage.getItem(AUDIT_SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is AuditSession =>
        Boolean(s && typeof s.id === 'string' && typeof s.started_at_ms === 'number')
    );
  } catch {
    return [];
  }
}

export function saveAuditSessions(sessions: AuditSession[]): void {
  try {
    localStorage.setItem(AUDIT_SESSIONS_STORAGE_KEY, JSON.stringify(sessions.slice(0, 30)));
  } catch {
    // ignore storage quota errors
  }
}

export function getActiveAuditSessionId(): string {
  try {
    return localStorage.getItem(ACTIVE_AUDIT_SESSION_STORAGE_KEY) || 'all';
  } catch {
    return 'all';
  }
}

export function setActiveAuditSessionId(sessionId: string): void {
  try {
    localStorage.setItem(ACTIVE_AUDIT_SESSION_STORAGE_KEY, sessionId || 'all');
  } catch {
    // ignore storage errors
  }
}

export function matchesPlatformTab(itemPlatform: string | null | undefined, tabKey: string): boolean {
  if (!tabKey) return true; // 'All Sources'
  const p = (itemPlatform || 'manual').toLowerCase();
  if (tabKey === 'youtube') return p === 'youtube';
  if (tabKey === 'instagram') return p === 'instagram' || p === 'ig';
  if (tabKey === 'manual') return p === 'manual' || p === 'direct' || p.includes('direct');
  if (tabKey === 'csv_upload') return p === 'csv_upload' || p.includes('csv') || p.includes('batch');
  return p === tabKey.toLowerCase();
}

export function createNewAuditSession(
  existingSessions: AuditSession[],
  nowMs: number = Date.now()
): AuditSession {
  const nextNumber = existingSessions.length + 1;
  const dateObj = new Date(nowMs);
  const timeStr = dateObj.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return {
    id: `sess_${nowMs}`,
    name: `Audit Session #${nextNumber} (${timeStr})`,
    created_at: dateObj.toISOString(),
    started_at_ms: nowMs,
  };
}

export function getSessionTimeWindow(
  activeSessionId: string,
  sessions: AuditSession[]
): { startMs: number; endMs: number | null; session: AuditSession } | null {
  if (!activeSessionId || activeSessionId === 'all') return null;
  const sortedAsc = [...sessions].sort((a, b) => a.started_at_ms - b.started_at_ms);
  const idx = sortedAsc.findIndex((s) => s.id === activeSessionId);
  if (idx === -1) return null;
  const target = sortedAsc[idx];
  const nextSession = idx + 1 < sortedAsc.length ? sortedAsc[idx + 1] : null;
  return {
    startMs: target.started_at_ms,
    endMs: nextSession ? nextSession.started_at_ms : null,
    session: target,
  };
}

export function doesSyncLogBelongToSession(
  log: SocialSyncLog,
  activeSessionId: string,
  sessions: AuditSession[]
): boolean {
  if (!activeSessionId || activeSessionId === 'all') return true;

  const windowInfo = getSessionTimeWindow(activeSessionId, sessions);
  if (!windowInfo) return false;

  // Seeded demo logs never belong to a user-started fresh audit session
  if (log.id && log.id.includes('-seed-')) {
    return false;
  }

  // Explicit session_id tag takes highest priority
  if (log.session_id) {
    return log.session_id === activeSessionId;
  }

  // Fallback to timestamp window for logs created during the session
  const createdMs = new Date(log.created_at).getTime();
  if (Number.isNaN(createdMs)) return false;
  if (createdMs < windowInfo.startMs) return false;
  if (windowInfo.endMs !== null && createdMs >= windowInfo.endMs) return false;
  return true;
}

export function filterSyncLogsForSession(
  logs: SocialSyncLog[],
  activeSessionId: string,
  sessions: AuditSession[]
): SocialSyncLog[] {
  return logs.filter((log) => doesSyncLogBelongToSession(log, activeSessionId, sessions));
}

export function filterSyncLogsForSessionAndTab(
  logs: SocialSyncLog[],
  activeSessionId: string,
  sessions: AuditSession[],
  tabKey: string
): SocialSyncLog[] {
  return logs.filter(
    (log) =>
      doesSyncLogBelongToSession(log, activeSessionId, sessions) &&
      matchesPlatformTab(log.platform, tabKey)
  );
}

export function getTabCountsForSession(
  logs: SocialSyncLog[],
  activeSessionId: string,
  sessions: AuditSession[]
): Record<string, number> {
  const sessionLogs = filterSyncLogsForSession(logs, activeSessionId, sessions);
  const tabKeys = ['', 'youtube', 'instagram', 'manual', 'csv_upload'];
  const counts: Record<string, number> = {};
  for (const key of tabKeys) {
    counts[key] = sessionLogs.filter((item) => matchesPlatformTab(item.platform, key)).length;
  }
  return counts;
}

export function buildQueueRecordsForSession(
  serverRecords: ModerationRecord[],
  allSyncLogs: SocialSyncLog[],
  activeSessionId: string,
  sessions: AuditSession[],
  tabKey: string,
  filters?: {
    status?: string;
    severity?: string;
    language?: string;
    search?: string;
  }
): ModerationRecord[] {
  if (!activeSessionId || activeSessionId === 'all') {
    return serverRecords;
  }

  const windowInfo = getSessionTimeWindow(activeSessionId, sessions);
  if (!windowInfo) return [];

  const sessionLogsForTab = filterSyncLogsForSessionAndTab(
    allSyncLogs,
    activeSessionId,
    sessions,
    tabKey
  );

  const byId = new Map<string, ModerationRecord>();

  // 1. Include records from any detection runs saved in this session
  for (const log of sessionLogsForTab) {
    for (const r of log.records || []) {
      const recId = r.id;
      if (!recId) continue;
      byId.set(recId, {
        id: recId,
        original_text: r.text,
        severity: r.severity || 'low',
        decision: r.decision || (r.is_flagged ? 'flagged_for_review' : 'auto_approve'),
        status: r.is_flagged ? 'pending' : 'reviewed',
        detected_language: r.detected_language || 'english',
        hate_speech_score: r.hate_speech_score ?? 0,
        harassment_score: r.harassment_score ?? 0,
        cyberbullying_score: r.cyberbullying_score ?? 0,
        legitimate_score: r.legitimate_score ?? (r.is_flagged ? 0.15 : 0.92),
        model_name: 'IndicBERT-Sentinel-XLM',
        model_version: '2.4.1',
        platform: r.platform || log.platform || 'manual',
        source_id: r.comment_id || null,
        source_url: r.source_url || log.source_url || null,
        author_name: r.author_name || null,
        parent_comment_id: r.parent_id || null,
        session_id: log.session_id || activeSessionId,
        is_demo: false,
        is_code_mixed: Boolean(r.is_code_mixed),
        created_at: r.published_at || log.created_at,
        ambiguity_warning: null,
        recommended_action: r.recommended_action || null,
      });
    }
  }

  // 2. Also include server records explicitly created during this session window
  for (const sr of serverRecords) {
    if (sr.is_demo || (sr.id && sr.id.includes('seed'))) continue;
    const belongsBySessionId = sr.session_id ? sr.session_id === activeSessionId : false;
    const createdMs = new Date(sr.created_at).getTime();
    const belongsByTime =
      !sr.session_id &&
      !Number.isNaN(createdMs) &&
      createdMs >= windowInfo.startMs &&
      (windowInfo.endMs === null || createdMs < windowInfo.endMs);

    if ((belongsBySessionId || belongsByTime) && matchesPlatformTab(sr.platform, tabKey)) {
      byId.set(sr.id, sr);
    }
  }

  let list = Array.from(byId.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  if (filters) {
    if (filters.status) {
      list = list.filter((r) => r.status.toLowerCase() === filters.status!.toLowerCase());
    }
    if (filters.severity) {
      list = list.filter((r) => r.severity.toLowerCase() === filters.severity!.toLowerCase());
    }
    if (filters.language) {
      list = list.filter((r) => r.detected_language.toLowerCase() === filters.language!.toLowerCase());
    }
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(
        (r) =>
          (r.original_text || '').toLowerCase().includes(q) ||
          (r.author_name || '').toLowerCase().includes(q) ||
          (r.id || '').toLowerCase().includes(q)
      );
    }
  }

  return list;
}
