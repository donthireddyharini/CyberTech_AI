import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createNewAuditSession,
  doesSyncLogBelongToSession,
  filterSyncLogsForSessionAndTab,
  getTabCountsForSession,
  buildQueueRecordsForSession,
  type AuditSession,
} from './auditSessions';
import type { SocialSyncLog, ModerationRecord } from '../types';

const SAMPLE_SEEDED_LOGS: SocialSyncLog[] = [
  {
    id: 'sync-yt-seed-01',
    platform: 'youtube',
    target_input: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    channel_name: 'Telugu News Live',
    total_fetched: 50,
    newly_ingested: 50,
    duplicate_count: 0,
    flagged_count: 15,
    approved_count: 35,
    status: 'completed',
    processing_time_ms: 42,
    created_at: new Date(1000000).toISOString(),
    records: [],
  },
  {
    id: 'sync-ig-seed-02',
    platform: 'instagram',
    target_input: '@tollywood_insider',
    channel_name: '@tollywood_insider',
    total_fetched: 50,
    newly_ingested: 50,
    duplicate_count: 0,
    flagged_count: 18,
    approved_count: 32,
    status: 'completed',
    processing_time_ms: 38,
    created_at: new Date(1000500).toISOString(),
    records: [],
  },
];

test('clicking New Audit Session starts completely empty across all category tabs', () => {
  const nowMs = 2000000;
  const session1 = createNewAuditSession([], nowMs);
  const sessions: AuditSession[] = [session1];

  const counts = getTabCountsForSession(SAMPLE_SEEDED_LOGS, session1.id, sessions);
  assert.equal(counts[''], 0, 'All Sources tab must be 0 on a fresh audit session');
  assert.equal(counts['youtube'], 0, 'YouTube tab must be 0 on a fresh audit session');
  assert.equal(counts['instagram'], 0, 'Instagram tab must be 0 on a fresh audit session');
  assert.equal(counts['manual'], 0, 'Direct Text / Manual tab must be 0 on a fresh audit session');
  assert.equal(counts['csv_upload'], 0, 'CSV File Imports tab must be 0 on a fresh audit session');

  const queueRecords = buildQueueRecordsForSession(
    [
      {
        id: 'rec-old-1',
        original_text: 'Old pre-existing comment',
        severity: 'high',
        decision: 'flagged_for_review',
        status: 'pending',
        detected_language: 'telugu',
        hate_speech_score: 0.8,
        harassment_score: 0.7,
        cyberbullying_score: 0.6,
        legitimate_score: 0.1,
        model_name: 'IndicBERT',
        model_version: '2.4',
        platform: 'youtube',
        is_demo: true,
        is_code_mixed: false,
        created_at: new Date(1000000).toISOString(),
        ambiguity_warning: null,
        recommended_action: null,
      },
    ],
    SAMPLE_SEEDED_LOGS,
    session1.id,
    sessions,
    ''
  );
  assert.equal(queueRecords.length, 0, 'Queue records must be empty on a fresh audit session');
});

test('newly detected runs after starting an Audit Session are stored category-wise across tabs', () => {
  const sessionStartMs = 2000000;
  const session1 = createNewAuditSession([], sessionStartMs);
  const sessions: AuditSession[] = [session1];

  const newYoutubeRun: SocialSyncLog = {
    id: 'sync-yt-live-99',
    platform: 'youtube',
    session_id: session1.id,
    target_input: 'https://www.youtube.com/watch?v=9bZkp7q19f0',
    channel_name: 'Official Psy Channel',
    total_fetched: 25,
    newly_ingested: 25,
    duplicate_count: 0,
    flagged_count: 5,
    approved_count: 20,
    status: 'completed',
    processing_time_ms: 50,
    created_at: new Date(sessionStartMs + 5000).toISOString(),
    records: [
      {
        id: 'c-yt-1',
        comment_id: 'c-yt-1',
        text: 'nuvvu chala manchi video chesav bro',
        author_name: 'ravi_teja',
        platform: 'youtube',
        severity: 'low',
        decision: 'auto_approve',
        detected_language: 'telugu',
        toxicity_score: 0.05,
        is_flagged: false,
        published_at: new Date(sessionStartMs + 5000).toISOString(),
      },
    ],
  };

  const newManualRun: SocialSyncLog = {
    id: 'sync-manual-live-100',
    platform: 'manual',
    session_id: session1.id,
    target_input: 'Direct Text Batch (2 Comments)',
    channel_name: 'Direct Text / Manual Batch',
    total_fetched: 2,
    newly_ingested: 2,
    duplicate_count: 0,
    flagged_count: 1,
    approved_count: 1,
    status: 'completed',
    processing_time_ms: 15,
    created_at: new Date(sessionStartMs + 10000).toISOString(),
    records: [
      {
        id: 'c-man-1',
        comment_id: 'c-man-1',
        text: 'నువ్వు ఒక పనికిరాని వెధవవి',
        author_name: 'manual_entry',
        platform: 'manual',
        severity: 'high',
        decision: 'flagged_for_review',
        detected_language: 'telugu',
        toxicity_score: 0.91,
        is_flagged: true,
        published_at: new Date(sessionStartMs + 10000).toISOString(),
      },
    ],
  };

  const allLogs = [newManualRun, newYoutubeRun, ...SAMPLE_SEEDED_LOGS];

  // Check category-wise counts in session1
  const counts = getTabCountsForSession(allLogs, session1.id, sessions);
  assert.equal(counts[''], 2, 'All Sources has 2 new runs in session1');
  assert.equal(counts['youtube'], 1, 'YouTube tab has 1 new run in session1');
  assert.equal(counts['instagram'], 0, 'Instagram tab still has 0 runs in session1');
  assert.equal(counts['manual'], 1, 'Manual tab has 1 new run in session1');
  assert.equal(counts['csv_upload'], 0, 'CSV tab still has 0 runs in session1');

  // Check filtered logs per tab
  const ytLogs = filterSyncLogsForSessionAndTab(allLogs, session1.id, sessions, 'youtube');
  assert.equal(ytLogs.length, 1);
  assert.equal(ytLogs[0].id, 'sync-yt-live-99');

  const manualLogs = filterSyncLogsForSessionAndTab(allLogs, session1.id, sessions, 'manual');
  assert.equal(manualLogs.length, 1);
  assert.equal(manualLogs[0].id, 'sync-manual-live-100');

  // Starting a second Audit Session resets the new session view to 0 while keeping session1 intact
  const session2 = createNewAuditSession(sessions, sessionStartMs + 60000);
  const updatedSessions = [session2, session1];

  const session2Counts = getTabCountsForSession(allLogs, session2.id, updatedSessions);
  assert.equal(session2Counts[''], 0, 'New Session #2 starts empty');

  const session1CountsAfter = getTabCountsForSession(allLogs, session1.id, updatedSessions);
  assert.equal(session1CountsAfter[''], 2, 'Previous Session #1 retains its 2 runs');

  // Switching to "all" shows both seeded and session runs
  const allHistoryCounts = getTabCountsForSession(allLogs, 'all', updatedSessions);
  assert.equal(allHistoryCounts[''], 4);
  assert.equal(doesSyncLogBelongToSession(SAMPLE_SEEDED_LOGS[0], 'all', updatedSessions), true);
});
