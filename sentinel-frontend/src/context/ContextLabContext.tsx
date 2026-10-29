import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type {
  AnalyzeResponse, CompareTextsResponse, ChatMessage,
  ChatSessionSummary, ChatSessionDetail
} from '../types';
import { analyzeApi } from '../api/client';
import { useAuth } from './AuthContext';

export interface ContextLabContextType {
  // Mode toggle
  mode: 'single' | 'compare';
  setMode: (mode: 'single' | 'compare') => void;

  // Single Analysis inputs
  text: string;
  setText: (t: string) => void;
  languageHint: string;
  setLanguageHint: (h: string) => void;
  platform: string;
  setPlatform: (p: string) => void;

  // Chat Sessions & Transcript
  sessions: ChatSessionSummary[];
  activeSessionId: string | null;
  currentSession: ChatSessionDetail | null;
  loadingSession: boolean;
  newChat: () => Promise<string>;
  selectSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  addMessageToActiveSession: (
    analysisText: string,
    langHint: string | undefined,
    originPlatform: string | undefined,
    result: AnalyzeResponse
  ) => Promise<void>;

  // Compare Context Inputs & State
  compareText1: string;
  setCompareText1: (t: string) => void;
  compareText2: string;
  setCompareText2: (t: string) => void;
  compareLang1: string;
  setCompareLang1: (l: string) => void;
  compareLang2: string;
  setCompareLang2: (l: string) => void;
  compareResult: CompareTextsResponse | null;
  setCompareResult: (r: CompareTextsResponse | null) => void;
  clearCompare: () => void;
}

const ContextLabContext = createContext<ContextLabContextType | undefined>(undefined);

export function ContextLabProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userKey = user?.id || 'guest';

  // Mode
  const [mode, setMode] = useState<'single' | 'compare'>('single');

  // Single Analysis Inputs
  const [text, setText] = useState('');
  const [languageHint, setLanguageHint] = useState('');
  const [platform, setPlatform] = useState('');

  // Sessions state
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<ChatSessionDetail | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);

  // Compare Context State
  const [compareText1, setCompareText1] = useState('');
  const [compareText2, setCompareText2] = useState('');
  const [compareLang1, setCompareLang1] = useState('');
  const [compareLang2, setCompareLang2] = useState('');
  const [compareResult, setCompareResult] = useState<CompareTextsResponse | null>(null);

  const storageKeySessions = `cybertech_lab_sessions_${userKey}`;
  const storageKeyActiveId = `cybertech_lab_active_id_${userKey}`;
  const storageKeyActiveDetail = `cybertech_lab_active_detail_${userKey}`;

  // Helper to persist active session to local storage for instant offline recall
  const saveLocalSnapshot = (sessDetail: ChatSessionDetail | null, sessId: string | null) => {
    try {
      if (sessDetail && sessId) {
        localStorage.setItem(storageKeyActiveId, sessId);
        localStorage.setItem(storageKeyActiveDetail, JSON.stringify(sessDetail));
      } else {
        localStorage.removeItem(storageKeyActiveId);
        localStorage.removeItem(storageKeyActiveDetail);
      }
    } catch {
      // Local storage fallback
    }
  };

  // Fetch session list from backend (with localStorage cache fallback)
  const refreshSessions = useCallback(async () => {
    try {
      const resp = await analyzeApi.listSessions();
      if (resp.data) {
        setSessions(resp.data);
        localStorage.setItem(storageKeySessions, JSON.stringify(resp.data));
        return resp.data;
      }
    } catch {
      // Fallback to cached session list
      try {
        const cached = localStorage.getItem(storageKeySessions);
        if (cached) {
          const parsed = JSON.parse(cached);
          setSessions(parsed);
          return parsed;
        }
      } catch {
        // Ignore
      }
    }
    return [];
  }, [storageKeySessions]);

  // Initial mount: load cached session or fetch from server
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      // Restore local snapshot first to prevent any visual flicker on tab navigation
      try {
        const savedId = localStorage.getItem(storageKeyActiveId);
        const savedDetail = localStorage.getItem(storageKeyActiveDetail);
        if (savedId && savedDetail && mounted) {
          const parsed = JSON.parse(savedDetail);
          setActiveSessionId(savedId);
          setCurrentSession(parsed);
        }
      } catch {
        // Ignore
      }

      const list = await refreshSessions();
      if (!mounted) return;

      // If no active session, create or select the most recent one
      const savedId = localStorage.getItem(storageKeyActiveId);
      if (!savedId && list && list.length > 0) {
        await selectSession(list[0].id);
      } else if (!savedId && (!list || list.length === 0)) {
        await newChat();
      }
    };

    init();
    return () => {
      mounted = false;
    };
  }, [userKey]);

  // Start a New Chat Session
  const newChat = async (): Promise<string> => {
    setLoadingSession(true);
    setText('');
    setLanguageHint('');
    setPlatform('');

    const newId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nowIso = new Date().toISOString();
    const blankDetail: ChatSessionDetail = {
      id: newId,
      title: 'New Intelligence Session',
      user_id: user?.id || null,
      messages: [],
      created_at: nowIso,
      updated_at: nowIso,
    };

    setActiveSessionId(newId);
    setCurrentSession(blankDetail);
    saveLocalSnapshot(blankDetail, newId);

    try {
      const resp = await analyzeApi.createSession('New Intelligence Session');
      if (resp.data) {
        setActiveSessionId(resp.data.id);
        setCurrentSession(resp.data);
        saveLocalSnapshot(resp.data, resp.data.id);
        await refreshSessions();
        setLoadingSession(false);
        return resp.data.id;
      }
    } catch {
      // Local fallback session active
    } finally {
      setLoadingSession(false);
    }
    return newId;
  };

  // Select an existing session from history
  const selectSession = async (sessionId: string) => {
    setLoadingSession(true);
    setActiveSessionId(sessionId);
    try {
      const resp = await analyzeApi.getSession(sessionId);
      if (resp.data) {
        setCurrentSession(resp.data);
        saveLocalSnapshot(resp.data, sessionId);
      }
    } catch {
      // If server unreachable, check if local detail matches
      try {
        const savedDetail = localStorage.getItem(storageKeyActiveDetail);
        if (savedDetail) {
          const parsed = JSON.parse(savedDetail);
          if (parsed.id === sessionId) {
            setCurrentSession(parsed);
          }
        }
      } catch {
        // Ignore
      }
    } finally {
      setLoadingSession(false);
    }
  };

  // Delete a session
  const deleteSession = async (sessionId: string) => {
    try {
      await analyzeApi.deleteSession(sessionId);
    } catch {
      // Ignore
    }
    const updated = sessions.filter(s => s.id !== sessionId);
    setSessions(updated);
    localStorage.setItem(storageKeySessions, JSON.stringify(updated));

    if (activeSessionId === sessionId) {
      if (updated.length > 0) {
        await selectSession(updated[0].id);
      } else {
        await newChat();
      }
    }
  };

  // Append analysis message to the current session
  const addMessageToActiveSession = async (
    analysisText: string,
    langHint: string | undefined,
    originPlatform: string | undefined,
    analysisResult: AnalyzeResponse
  ) => {
    let sessId = activeSessionId;
    if (!sessId || !currentSession) {
      sessId = await newChat();
    }

    const newMessage: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      text: analysisText,
      language_hint: langHint,
      platform: originPlatform || 'manual',
      timestamp: new Date().toISOString(),
      result: analysisResult,
    };

    // Optimistically update active session state
    setCurrentSession(prev => {
      const existing = prev ? prev.messages : [];
      const updatedMessages = [...existing, newMessage];
      const title =
        prev && prev.title && prev.title !== 'New Intelligence Session'
          ? prev.title
          : analysisText.slice(0, 45) + (analysisText.length > 45 ? '...' : '');

      const updatedDetail: ChatSessionDetail = {
        id: sessId!,
        title,
        user_id: user?.id || null,
        messages: updatedMessages,
        created_at: prev?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      saveLocalSnapshot(updatedDetail, sessId!);
      return updatedDetail;
    });

    // Sync to backend asynchronously
    try {
      await analyzeApi.addMessage(sessId!, {
        text: analysisText,
        language_hint: langHint,
        platform: originPlatform || 'manual',
        result: analysisResult,
      });
      await refreshSessions();
    } catch {
      // Local state already updated
    }
  };

  const clearCompare = () => {
    setCompareText1('');
    setCompareText2('');
    setCompareLang1('');
    setCompareLang2('');
    setCompareResult(null);
  };

  return (
    <ContextLabContext.Provider
      value={{
        mode,
        setMode,
        text,
        setText,
        languageHint,
        setLanguageHint,
        platform,
        setPlatform,
        sessions,
        activeSessionId,
        currentSession,
        loadingSession,
        newChat,
        selectSession,
        deleteSession,
        addMessageToActiveSession,
        compareText1,
        setCompareText1,
        compareText2,
        setCompareText2,
        compareLang1,
        setCompareLang1,
        compareLang2,
        setCompareLang2,
        compareResult,
        setCompareResult,
        clearCompare,
      }}
    >
      {children}
    </ContextLabContext.Provider>
  );
}

export function useContextLab() {
  const ctx = useContext(ContextLabContext);
  if (!ctx) {
    throw new Error('useContextLab must be used within a ContextLabProvider');
  }
  return ctx;
}
