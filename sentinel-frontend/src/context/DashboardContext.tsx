import React, { createContext, useContext, useState } from 'react';

export interface DashboardContextType {
  // Ingestion Mode & Workspace Inputs
  ingestMode: 'text' | 'csv' | 'youtube' | 'instagram';
  setIngestMode: (mode: 'text' | 'csv' | 'youtube' | 'instagram') => void;
  batchText: string;
  setBatchText: (text: string) => void;
  csvFile: File | null;
  setCsvFile: (file: File | null) => void;
  deduplicate: boolean;
  setDeduplicate: (dedup: boolean) => void;
  batchResult: any | null;
  setBatchResult: (result: any | null) => void;
  sessionBatchCount: number;
  setSessionBatchCount: React.Dispatch<React.SetStateAction<number>>;
  sessionCommentsProcessed: number;
  setSessionCommentsProcessed: React.Dispatch<React.SetStateAction<number>>;

  // YouTube Inputs
  ytVideoInput: string;
  setYtVideoInput: (input: string) => void;
  ytMaxComments: number;
  setYtMaxComments: (max: number) => void;
  ytIncludeReplies: boolean;
  setYtIncludeReplies: (inc: boolean) => void;
  ytOrder: string;
  setYtOrder: (order: string) => void;

  // Instagram Inputs
  igMediaInput: string;
  setIgMediaInput: (input: string) => void;
  igMaxComments: number;
  setIgMaxComments: (max: number) => void;
  igIncludeReplies: boolean;
  setIgIncludeReplies: (inc: boolean) => void;

  // Date and Platform Filters
  timeframe: 'today' | 'yesterday' | '7d' | '30d' | 'all' | 'custom';
  setTimeframe: (tf: 'today' | 'yesterday' | '7d' | '30d' | 'all' | 'custom') => void;
  showCustomPicker: boolean;
  setShowCustomPicker: (show: boolean) => void;
  customStartDate: string;
  setCustomStartDate: (date: string) => void;
  customEndDate: string;
  setCustomEndDate: (date: string) => void;
  appliedCustomRange: { start: string; end: string } | null;
  setAppliedCustomRange: (range: { start: string; end: string } | null) => void;
  selectedPlatform: string;
  setSelectedPlatform: (p: string) => void;

  // Workspace Reset (Form reset only, preserves persisted records in DB)
  clearWorkspace: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  // Ingestion Mode & Inputs
  const [ingestMode, setIngestMode] = useState<'text' | 'csv' | 'youtube' | 'instagram'>('text');
  const [batchText, setBatchText] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [deduplicate, setDeduplicate] = useState(true);
  const [batchResult, setBatchResult] = useState<any | null>(null);
  const [sessionBatchCount, setSessionBatchCount] = useState(0);
  const [sessionCommentsProcessed, setSessionCommentsProcessed] = useState(0);

  // YouTube Inputs
  const [ytVideoInput, setYtVideoInput] = useState('');
  const [ytMaxComments, setYtMaxComments] = useState(50);
  const [ytIncludeReplies, setYtIncludeReplies] = useState(true);
  const [ytOrder, setYtOrder] = useState('relevance');

  // Instagram Inputs
  const [igMediaInput, setIgMediaInput] = useState('');
  const [igMaxComments, setIgMaxComments] = useState(25);
  const [igIncludeReplies, setIgIncludeReplies] = useState(true);

  // Filters
  const [timeframe, setTimeframe] = useState<'today' | 'yesterday' | '7d' | '30d' | 'all' | 'custom'>('7d');
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [appliedCustomRange, setAppliedCustomRange] = useState<{ start: string; end: string } | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState('all');

  const clearWorkspace = () => {
    setBatchText('');
    setCsvFile(null);
    setBatchResult(null);
    setYtVideoInput('');
    setIgMediaInput('');
  };

  return (
    <DashboardContext.Provider
      value={{
        ingestMode,
        setIngestMode,
        batchText,
        setBatchText,
        csvFile,
        setCsvFile,
        deduplicate,
        setDeduplicate,
        batchResult,
        setBatchResult,
        sessionBatchCount,
        setSessionBatchCount,
        sessionCommentsProcessed,
        setSessionCommentsProcessed,
        ytVideoInput,
        setYtVideoInput,
        ytMaxComments,
        setYtMaxComments,
        ytIncludeReplies,
        setYtIncludeReplies,
        ytOrder,
        setYtOrder,
        igMediaInput,
        setIgMediaInput,
        igMaxComments,
        setIgMaxComments,
        igIncludeReplies,
        setIgIncludeReplies,
        timeframe,
        setTimeframe,
        showCustomPicker,
        setShowCustomPicker,
        customStartDate,
        setCustomStartDate,
        customEndDate,
        setCustomEndDate,
        appliedCustomRange,
        setAppliedCustomRange,
        selectedPlatform,
        setSelectedPlatform,
        clearWorkspace,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
}

export function useDashboard() {
  const ctx = useContext(DashboardContext);
  if (!ctx) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return ctx;
}
