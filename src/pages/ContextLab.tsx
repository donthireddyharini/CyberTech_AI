import { useState, useRef, useEffect } from 'react';
import {
  Send, RotateCcw, AlertCircle, Info, ArrowRight,
  Globe, ChevronDown, CheckCircle2, TrendingUp,
  ShieldAlert, Sparkles, MessageSquare, PlusCircle,
  Trash2, Clock, Check, Mic, MicOff, Bot, User,
  ShieldCheck, Loader2, Volume2, VolumeX, Radio
} from 'lucide-react';
import { analyzeApi } from '../api/client';
import type { AnalyzeResponse, ChatMessage } from '../types';
import { useToast } from '../App';
import { useContextLab } from '../context/ContextLabContext';

// ─── EXACT SIX REQUESTED SUGGESTED SCENARIOS ─────────────────────────────────
interface SuggestedScenario {
  id: string;
  language: string;
  suggestion: string;
  example: string;
  langHint: string;
  isHarmful: boolean;
}

const SUGGESTED_SCENARIOS: SuggestedScenario[] = [
  {
    id: 'en_civil',
    language: 'English',
    suggestion: 'Good / Civil',
    example: 'Thank you for sharing this. I really appreciate your explanation.',
    langHint: 'english',
    isHarmful: false,
  },
  {
    id: 'en_harass',
    language: 'English',
    suggestion: 'Harassment',
    example: 'You are useless, and nobody wants to hear your opinion.',
    langHint: 'english',
    isHarmful: true,
  },
  {
    id: 'te_civil',
    language: 'Telugu',
    suggestion: 'Good / Civil',
    example: 'చాలా మంచి సమాచారం పంచుకున్నారు. ధన్యవాదాలు.',
    langHint: 'telugu',
    isHarmful: false,
  },
  {
    id: 'te_harass',
    language: 'Telugu',
    suggestion: 'Harassment',
    example: 'నీకు ఏమీ తెలియదు, నీ మాటలు ఎవరికీ అవసరం లేదు.',
    langHint: 'telugu',
    isHarmful: true,
  },
  {
    id: 'hi_civil',
    language: 'Hindi',
    suggestion: 'Good / Civil',
    example: 'आपने बहुत अच्छी जानकारी साझा की है। धन्यवाद।',
    langHint: 'hindi',
    isHarmful: false,
  },
  {
    id: 'hi_harass',
    language: 'Hindi',
    suggestion: 'Harassment',
    example: 'तुम्हें कुछ भी नहीं आता, तुम्हारी बात कोई नहीं सुनना चाहता।',
    langHint: 'hindi',
    isHarmful: true,
  },
];

// ─── VOICE ASSISTANCE MULTILINGUAL CONFIGURATION ─────────────────────────────
export interface VoiceLangOption {
  code: string;
  name: string;
  nativeName: string;
  shortLabel: string;
  defaultHint: string;
}

const VOICE_LANGUAGES: VoiceLangOption[] = [
  { code: 'en-IN', name: 'English (India)', nativeName: 'English', shortLabel: 'English', defaultHint: 'english' },
  { code: 'te-IN', name: 'Telugu', nativeName: 'తెలుగు', shortLabel: 'తెలుగు', defaultHint: 'telugu' },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', shortLabel: 'हिन्दी', defaultHint: 'hindi' },
  { code: 'kn-IN', name: 'Kannada', nativeName: 'ಕನ್ನಡ', shortLabel: 'ಕನ್ನಡ', defaultHint: 'kannada' },
  { code: 'en-US', name: 'English (US)', nativeName: 'US English', shortLabel: 'en-US', defaultHint: 'english' },
];

export default function ContextLab() {
  const { addToast } = useToast();
  const {
    text, setText,
    languageHint, setLanguageHint,
    platform,
    sessions,
    activeSessionId,
    currentSession,
    loadingSession,
    newChat,
    selectSession,
    deleteSession,
    addMessageToActiveSession,
  } = useContextLab();

  const [analyzing, setAnalyzing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);

  // Dedicated Voice Recognition Language (Initialized to match hint or Indian English default)
  const [voiceLanguage, setVoiceLanguage] = useState<string>(() => {
    if (languageHint === 'telugu') return 'te-IN';
    if (languageHint === 'hindi') return 'hi-IN';
    if (languageHint === 'kannada') return 'kn-IN';
    if (languageHint === 'english' || languageHint === 'hinglish') return 'en-IN';
    return 'en-IN';
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);

  // Current active voice language config object
  const currentVoiceConfig = VOICE_LANGUAGES.find((v) => v.code === voiceLanguage) || VOICE_LANGUAGES[0];

  // Initialize Speech Recognition capability check & cleanup on unmount
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }

    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Sync voiceLanguage when user changes the model languageHint dropdown
  const handleLanguageHintChange = (newHint: string) => {
    setLanguageHint(newHint);
    if (newHint === 'telugu') setVoiceLanguage('te-IN');
    else if (newHint === 'hindi') setVoiceLanguage('hi-IN');
    else if (newHint === 'kannada') setVoiceLanguage('kn-IN');
    else if (newHint === 'english' || newHint === 'hinglish') setVoiceLanguage('en-IN');
  };

  // Auto-scroll message feed to bottom when new messages arrive
  useEffect(() => {
    if (currentSession?.messages && currentSession.messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentSession?.messages?.length, analyzing]);

  // Stop active voice recognition safely
  const stopListening = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }
    setIsListening(false);
    setInterimTranscript('');
  };

  // Start or Toggle Voice Input with specific BCP-47 language tag
  const startListening = (langCode: string) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      addToast('Speech Recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.', 'warning');
      return;
    }

    // Stop any existing instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // ignore
      }
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = langCode;

      const targetVoice = VOICE_LANGUAGES.find((v) => v.code === langCode) || VOICE_LANGUAGES[0];

      recognition.onstart = () => {
        setIsListening(true);
        setInterimTranscript('');
        if (!languageHint || languageHint === 'english' || languageHint === targetVoice.defaultHint) {
          setLanguageHint(targetVoice.defaultHint);
        }
        addToast(`Microphone active. Listening in ${targetVoice.name} (${targetVoice.nativeName}). Speak clearly...`, 'info');
      };

      recognition.onresult = (event: any) => {
        // Reset silence timer on every voice result
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
        }
        // Auto-stop after 3.5 seconds of silence
        silenceTimerRef.current = setTimeout(() => {
          stopListening();
          addToast('Voice captured. Review your comment and submit.', 'success');
        }, 3500);

        let finalTranscript = '';
        let interim = '';

        // Accumulate complete sentence across all results (avoids losing previous words)
        for (let i = 0; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript + ' ';
          } else {
            interim += item[0].transcript;
          }
        }

        const combined = (finalTranscript + interim).trim();
        setInterimTranscript(interim);

        if (combined) {
          setText(combined);

          // Automatic script detection to route the backend model accurately
          if (/[ఀ-౿]/.test(combined)) {
            // Telugu Unicode block
            setLanguageHint('telugu');
          } else if (/[ऀ-ॿ]/.test(combined)) {
            // Devanagari (Hindi) Unicode block
            setLanguageHint('hindi');
          } else if (/[ಀ-೿]/.test(combined)) {
            // Kannada Unicode block
            setLanguageHint('kannada');
          } else if (targetVoice.defaultHint && targetVoice.defaultHint !== 'english') {
            // Latin script transcribed for regional voice language
            setLanguageHint(targetVoice.defaultHint);
          }
        }
      };

      recognition.onerror = (event: any) => {
        stopListening();
        if (event.error === 'not-allowed') {
          addToast('Microphone permission was denied. Please allow microphone access in your browser settings.', 'error');
        } else if (event.error === 'no-speech') {
          addToast(`No speech detected for ${targetVoice.name}. Please speak clearly into your microphone.`, 'warning');
        } else if (event.error === 'language-not-supported') {
          addToast(`Voice language ${langCode} is not installed in your browser. Falling back to Indian English (en-IN).`, 'warning');
          setVoiceLanguage('en-IN');
        } else if (event.error !== 'aborted') {
          addToast(`Voice input error: ${event.error}`, 'error');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterimTranscript('');
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      };

      recognition.start();
    } catch (err: any) {
      stopListening();
      addToast(err.message || 'Failed to start microphone speech recognition.', 'error');
    }
  };

  // Toggle Voice Input handler
  const toggleVoiceInput = (overrideLangCode?: string) => {
    if (isListening) {
      stopListening();
      addToast('Voice input stopped.', 'info');
    } else {
      const target = overrideLangCode || voiceLanguage;
      startListening(target);
    }
  };

  // Switch voice language and seamlessly restart recognition if currently listening
  const switchVoiceLang = (newCode: string, defaultHint?: string) => {
    setVoiceLanguage(newCode);
    const target = VOICE_LANGUAGES.find((v) => v.code === newCode);
    const hintToSet = defaultHint || target?.defaultHint;
    if (hintToSet) {
      setLanguageHint(hintToSet);
    }
    if (isListening) {
      stopListening();
      setTimeout(() => {
        startListening(newCode);
      }, 150);
    }
  };

  // ─── TEXT-TO-SPEECH (READ ALOUD) FOR AI RESPONSES ─────────────────────────
  const speakMessage = (msgId: string, textToSpeak: string, detectedLang?: string) => {
    if (!('speechSynthesis' in window)) {
      addToast('Text-to-speech is not supported in this browser.', 'warning');
      return;
    }

    if (speakingMessageId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMessageId(null);
      return;
    }

    window.speechSynthesis.cancel();

    // Clean text: strip markdown symbols, URLs, etc.
    const cleanText = textToSpeak
      .replace(/[#*_~`]/g, '')
      .replace(/\[.*?\]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .trim();

    if (!cleanText) return;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    const langKey = (detectedLang || languageHint || 'english').toLowerCase();
    let targetLangCode = 'en-IN';
    if (langKey.includes('telugu')) targetLangCode = 'te-IN';
    else if (langKey.includes('hindi')) targetLangCode = 'hi-IN';
    else if (langKey.includes('kannada')) targetLangCode = 'kn-IN';
    else if (langKey.includes('hinglish') || langKey.includes('english')) targetLangCode = 'en-IN';

    utterance.lang = targetLangCode;

    // Pick matching voice
    const voices = window.speechSynthesis.getVoices();
    const matchingVoice =
      voices.find((v) => v.lang.toLowerCase() === targetLangCode.toLowerCase()) ||
      voices.find((v) => v.lang.toLowerCase().startsWith(targetLangCode.split('-')[0])) ||
      voices.find((v) => v.lang.toLowerCase().includes('in')) ||
      voices[0];

    if (matchingVoice) {
      utterance.voice = matchingVoice;
    }

    utterance.onstart = () => {
      setSpeakingMessageId(msgId);
    };
    utterance.onend = () => {
      setSpeakingMessageId(null);
    };
    utterance.onerror = () => {
      setSpeakingMessageId(null);
    };

    window.speechSynthesis.speak(utterance);
  };

  const buildSpeechSummary = (res: AnalyzeResponse): string => {
    const lang = res.detected_language ? res.detected_language.toUpperCase() : 'English';
    const decision =
      res.decision === 'flag_for_review'
        ? 'Flagged for moderation review'
        : res.decision === 'human_review'
        ? 'Escalated to human moderator'
        : 'Approved as legitimate content';

    const tox = res.toxicity_prediction ? Math.round(res.toxicity_prediction.toxicity_score * 100) : 0;
    const reason = res.severity_reason ? ` Reason: ${res.severity_reason}.` : '';

    return `Moderation Analysis in ${lang}. Result: ${decision}. Severity level is ${res.severity}, with toxicity probability of ${tox} percent.${reason}`;
  };

  // Execute Single Comment Inference & Append to Conversation
  const handleAnalyze = async (overrideText?: string, overrideHint?: string) => {
    if (analyzing) return;
    const targetText = (overrideText !== undefined ? overrideText : text).trim();
    let targetHint = (overrideHint !== undefined ? overrideHint : languageHint).trim();

    if (!targetText) {
      addToast('Please enter a comment to analyze or select a suggested scenario.', 'warning');
      return;
    }

    // Dynamic Indic script detection to route accurately and prevent stale hints
    if (/[ऀ-ॿ]/.test(targetText)) {
      targetHint = 'hindi';
      setLanguageHint('hindi');
    } else if (/[ఀ-౿]/.test(targetText)) {
      targetHint = 'telugu';
      setLanguageHint('telugu');
    } else if (/[ಀ-೿]/.test(targetText)) {
      targetHint = 'kannada';
      setLanguageHint('kannada');
    }

    setAnalyzing(true);
    try {
      const resp = await analyzeApi.analyze({
        text: targetText,
        language_hint: targetHint || undefined,
        platform: platform || 'Context Lab Chatbot',
      });

      const analysisResult: AnalyzeResponse = resp.data;

      // Append to active chat transcript and persist
      await addMessageToActiveSession(
        targetText,
        targetHint || undefined,
        platform || 'Context Lab Chatbot',
        analysisResult
      );

      setText('');
      setInterimTranscript('');
      addToast('Comment analyzed and added to conversation.', 'success');
    } catch (err: any) {
      addToast(err.message || 'Analysis failed. Please check backend connection.', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  // Suggested Scenario Click Behavior: Auto-submit example and run real inference
  const handleScenarioClick = async (scenario: SuggestedScenario) => {
    if (analyzing) return;
    setText(scenario.example);
    setLanguageHint(scenario.langHint);
    if (scenario.langHint === 'telugu') setVoiceLanguage('te-IN');
    else if (scenario.langHint === 'hindi') setVoiceLanguage('hi-IN');
    else if (scenario.langHint === 'kannada') setVoiceLanguage('kn-IN');
    else setVoiceLanguage('en-IN');
    await handleAnalyze(scenario.example, scenario.langHint);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5 min-h-[calc(100vh-6rem)] lg:h-[calc(100vh-6rem)] pb-3 page-enter">
      
      {/* ── Left Sidebar: Dedicated Conversation History ── */}
      <aside className="w-full lg:w-72 bg-white rounded-2xl border border-[#E9EAF1] p-3.5 sm:p-4 flex flex-col shadow-xs shrink-0 h-auto lg:h-full">
        {/* Top Row on Mobile: + New Chat Action + Voice Lang Pill */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              await newChat();
              addToast('Started a new conversation session.', 'info');
            }}
            disabled={loadingSession}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-white text-xs font-bold shadow-md shadow-[#6C5CE7]/20 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <PlusCircle className="w-4 h-4 shrink-0" />
            <span>New Chat Session</span>
          </button>

          {/* Compact Voice Lang indicator on mobile */}
          <div className="lg:hidden px-2.5 py-2 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1] text-[11px] text-[#858795] flex items-center gap-1.5 shrink-0">
            <Radio className="w-3.5 h-3.5 text-[#6C5CE7] shrink-0" />
            <span className="text-[#6C5CE7] font-bold">{currentVoiceConfig.nativeName}</span>
          </div>
        </div>

        {/* Previous Conversations Header */}
        <div className="mt-3 sm:mt-4 mb-2 flex items-center justify-between text-[11px] font-bold text-[#858795] uppercase tracking-wider px-1">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#6C5CE7]" />
            <span>Chat Sessions ({sessions.length})</span>
          </div>
          {loadingSession && <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6C5CE7]" />}
        </div>

        {/* Scrollable Sessions List — Compact height on mobile so Chat is immediately visible */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[115px] lg:max-h-none">
          {sessions.length === 0 ? (
            <div className="p-3 sm:p-4 text-center text-xs text-[#858795] bg-[#F8F9FE] rounded-xl border border-dashed border-[#E9EAF1]">
              <MessageSquare className="w-4 h-4 mx-auto mb-1 text-[#858795]/50" />
              <span>No saved chats yet. Start typing to begin.</span>
            </div>
          ) : (
            sessions.map((s) => {
              const isActive = s.id === activeSessionId;
              return (
                <div
                  key={s.id}
                  onClick={() => selectSession(s.id)}
                  className={`group relative p-2.5 sm:p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start justify-between gap-2 ${
                    isActive
                      ? 'bg-[#EEEAFE] border-[#DDD6FE] text-[#6C5CE7] font-bold shadow-xs'
                      : 'bg-white hover:bg-[#F8F9FE] border-[#E9EAF1] text-[#20212B]'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-xs leading-snug">
                      {s.title || 'Untitled Conversation'}
                    </div>
                    <div className="text-[10px] text-[#858795] mt-0.5 flex items-center gap-1.5">
                      <span>{s.message_count} {s.message_count === 1 ? 'msg' : 'msgs'}</span>
                      <span>•</span>
                      <span>
                        {new Date(s.updated_at).toLocaleDateString([], {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Delete Conversation Button */}
                  <button
                    type="button"
                    title="Delete session"
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (window.confirm('Delete this conversation history?')) {
                        await deleteSession(s.id);
                        addToast('Session removed.', 'info');
                      }
                    }}
                    className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 p-1 text-[#858795] hover:text-rose-600 transition-opacity rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Multilingual Voice Indicator Pill in Sidebar (Desktop) */}
        <div className="hidden lg:flex mt-3 p-2.5 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1] text-[11px] text-[#858795] items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-[#6C5CE7]" />
            <span className="font-semibold text-[#20212B]">Voice Lang:</span>
            <span className="text-[#6C5CE7] font-bold">{currentVoiceConfig.nativeName}</span>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white font-mono text-[#858795] border border-[#E9EAF1]">
            {currentVoiceConfig.code}
          </span>
        </div>
      </aside>

      {/* ── Main Chat Area ── */}
      <section className="flex-1 bg-white rounded-2xl border border-[#E9EAF1] shadow-xs flex flex-col overflow-hidden min-h-[520px] lg:h-full">
        {/* Chat Header */}
        <header className="px-3.5 sm:px-5 py-3 sm:py-3.5 border-b border-[#E9EAF1] bg-[#FDFDFF] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#6C5CE7] text-white flex items-center justify-center shadow-xs shrink-0">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-[#20212B] flex items-center gap-2 flex-wrap">
                <span>Context Intelligence Lab</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 whitespace-nowrap">
                  Multilingual ML Active
                </span>
              </h2>
              <p className="text-[11px] text-[#858795] truncate">
                {currentSession?.title || 'Interactive Multilingual Content Moderation Assistant'}
              </p>
            </div>
          </div>

          {/* Top Right Corner: Active Speech Recognition Voice Language */}
          <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
            <div className="flex items-center justify-between sm:justify-start gap-1.5 sm:gap-2 p-1.5 pl-2.5 sm:pl-3 rounded-xl bg-[#F8F9FE] border border-[#DDD6FE] shadow-xs w-full sm:w-auto">
              <div className="flex items-center gap-1.5 shrink-0">
                {isListening ? (
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
                  </span>
                ) : (
                  <Mic className="w-3.5 h-3.5 text-[#6C5CE7]" />
                )}
                <span className="text-[11px] font-bold text-[#20212B] whitespace-nowrap">
                  Voice Lang:
                </span>
              </div>

              {/* Interactive Speech Recognition Voice Language Selector */}
              <select
                value={voiceLanguage}
                onChange={(e) => {
                  const target = VOICE_LANGUAGES.find((v) => v.code === e.target.value);
                  switchVoiceLang(e.target.value, target?.defaultHint);
                }}
                className={`py-1 px-2 rounded-lg text-xs font-bold border cursor-pointer focus:outline-none transition-colors flex-1 sm:flex-initial min-w-0 max-w-[165px] sm:max-w-none truncate ${
                  isListening
                    ? 'bg-rose-50 text-rose-800 border-rose-300'
                    : 'bg-white text-[#6C5CE7] border-[#DDD6FE] hover:border-[#6C5CE7]'
                }`}
                title="Active speech recognition voice language model"
              >
                {VOICE_LANGUAGES.map((v) => (
                  <option key={v.code} value={v.code}>
                    {v.nativeName} ({v.name}) • {v.code}
                  </option>
                ))}
              </select>

              {/* Quick mic toggle button directly in the top right header */}
              <button
                type="button"
                onClick={() => toggleVoiceInput()}
                title={isListening ? "Stop voice input" : `Start speaking in ${currentVoiceConfig.nativeName} (${currentVoiceConfig.code})`}
                className={`p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                  isListening
                    ? 'bg-rose-600 hover:bg-rose-700 text-white animate-pulse'
                    : 'bg-[#EEEAFE] hover:bg-[#DDD6FE] text-[#6C5CE7]'
                }`}
              >
                {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </header>

        {/* ── Scrollable Message Feed ── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-[#FBFBFE]">
          {/* Welcome Card if no messages in active session */}
          {(!currentSession?.messages || currentSession.messages.length === 0) && (
            <div className="max-w-2xl mx-auto py-6 space-y-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#EEEAFE] text-[#6C5CE7] flex items-center justify-center mx-auto shadow-xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#20212B]">
                  Welcome to CyberTech AI Context Intelligence Lab
                </h3>
                <p className="text-xs text-[#858795] max-w-md mx-auto">
                  Inspect real-time toxicity, hate speech, cyberbullying, and severity nuances across English, Telugu, Hindi, Hinglish, and Kannada models.
                </p>
              </div>

              {/* Six Predefined Suggested Scenarios */}
              <div className="space-y-2 text-left pt-2">
                <div className="text-[11px] font-bold text-[#858795] uppercase tracking-wider text-center">
                  Try one of our verified examples:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {SUGGESTED_SCENARIOS.map((scenario) => (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => handleScenarioClick(scenario)}
                      className="p-3 text-left rounded-xl bg-white border border-[#E9EAF1] hover:border-[#6C5CE7] hover:bg-[#F8F9FE] transition-all shadow-xs group cursor-pointer flex flex-col justify-between"
                    >
                      <div className="text-xs text-[#20212B] font-medium leading-relaxed group-hover:text-[#6C5CE7] transition-colors">
                        "{scenario.example}"
                      </div>
                      <div className="mt-2 text-[10px] text-[#858795] flex items-center justify-between">
                        <span className="font-semibold capitalize text-[#6C5CE7]">{scenario.language}</span>
                        <span className="flex items-center gap-1 group-hover:translate-x-0.5 transition-transform text-[#6C5CE7] font-semibold">
                          <span>Analyze</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Render Active Session Messages */}
          {currentSession?.messages?.map((msg: ChatMessage, idx: number) => {
            const res = msg.result || (msg as any).analysis_result;
            const isFlagged = res && (res.decision !== 'no_action');
            const isHigh = res && res.severity === 'high';
            const isMed = res && res.severity === 'medium';
            const isSpeakingThis = speakingMessageId === (msg.id || String(idx));

            return (
              <div key={msg.id || idx} className="space-y-3.5">
                {/* 1. User Message Chat Bubble (Right-aligned) */}
                <div className="flex items-start justify-end gap-2.5 max-w-2xl ml-auto">
                  <div className="space-y-1 text-right">
                    <div className="text-[10px] text-[#858795] font-semibold flex items-center justify-end gap-1.5">
                      <span>You</span>
                      <span>•</span>
                      <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {msg.language_hint && (
                        <span className="text-[9px] bg-[#EEEAFE] text-[#6C5CE7] px-1.5 py-0.2 rounded font-semibold capitalize">
                          Hint: {msg.language_hint}
                        </span>
                      )}
                    </div>
                    <div className="p-3.5 rounded-2xl rounded-tr-none bg-[#6C5CE7] text-white text-xs font-medium shadow-sm leading-relaxed text-left inline-block">
                      {msg.text}
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-full bg-[#EEEAFE] text-[#6C5CE7] flex items-center justify-center text-xs font-bold shrink-0 mt-3 border border-[#DDD6FE]">
                    <User className="w-3.5 h-3.5" />
                  </div>
                </div>

                {/* 2. CyberTech AI Assistant Response Card (Left-aligned) */}
                {res && (
                  <div className="flex items-start gap-2.5 max-w-2xl mr-auto">
                    <div className="w-7 h-7 rounded-full bg-[#6C5CE7] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-3 shadow-xs">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <div className="space-y-1.5 flex-1">
                      {/* Top status bar with Listen / Speak aloud button */}
                      <div className="text-[10px] text-[#858795] font-semibold flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <span>CyberTech AI</span>
                          <span>•</span>
                          <span className="capitalize text-[#6C5CE7] font-bold">{res.detected_language}</span>
                          <span>•</span>
                          <span>{res.processing_time_ms ? `${res.processing_time_ms.toFixed(1)}ms` : '< 3ms'}</span>
                        </div>

                        {/* Read Aloud Voice Button */}
                        <button
                          type="button"
                          onClick={() => speakMessage(msg.id || String(idx), buildSpeechSummary(res), res.detected_language)}
                          title={isSpeakingThis ? 'Stop voice playback' : 'Listen to audio explanation'}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                            isSpeakingThis
                              ? 'bg-rose-100 text-rose-700 ring-1 ring-rose-300 animate-pulse'
                              : 'bg-[#EEEAFE] text-[#6C5CE7] hover:bg-[#DDD6FE]'
                          }`}
                        >
                          {isSpeakingThis ? (
                            <>
                              <VolumeX className="w-3.5 h-3.5" />
                              <span>Stop Audio</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5" />
                              <span>Listen</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* Prediction & Scores Card */}
                      <div className="p-4 rounded-2xl rounded-tl-none bg-white border border-[#E9EAF1] shadow-xs space-y-3 text-xs text-[#20212B]">
                        {/* Status Badges */}
                        <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-[#E9EAF1]">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              isHigh ? 'bg-rose-50 text-rose-700 border-rose-200' :
                              isMed ? 'bg-amber-50 text-amber-700 border-amber-200' :
                              'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              Severity: {res.severity}
                            </span>

                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                              isFlagged
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {res.decision === 'flag_for_review' ? 'Flagged for Review' :
                               res.decision === 'human_review' ? 'Escalated to Human' :
                               'Approved / Legitimate'}
                            </span>
                          </div>

                          {res.toxicity_prediction && (
                            <span className={`font-mono text-xs font-bold ${res.toxicity_prediction.is_toxic ? 'text-rose-600' : 'text-emerald-600'}`}>
                              Toxicity: {(res.toxicity_prediction.toxicity_score * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>

                        {/* Category Probability Scores */}
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-[#858795]">
                            Category Probability Scores:
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {(res.labels || []).map((l: any) => {
                              const isUnsupported = l.supported === false;
                              const pct = Math.round(l.score * 100);
                              const isHarm = !isUnsupported && l.label !== 'legitimate' && pct >= 40;
                              return (
                                <div key={l.label} className="p-2 rounded-xl bg-[#F8F9FE] border border-[#E9EAF1] space-y-1">
                                  <div className="flex items-center justify-between text-[11px]">
                                    <span className="capitalize font-semibold text-[#858795]">{l.label.replace(/_/g, ' ')}</span>
                                    {isUnsupported ? (
                                      <span className="inline-flex items-center gap-1">
                                        <span className="text-[10px] text-[#858795] font-normal italic">Not available</span>
                                        <span className="px-1.5 py-0.2 rounded text-[9px] bg-[#E9EAF1] text-[#858795] font-semibold">Unrated</span>
                                      </span>
                                    ) : (
                                      <span className={`font-mono font-bold ${isHarm ? 'text-rose-600' : 'text-[#20212B]'}`}>{pct}%</span>
                                    )}
                                  </div>
                                  <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        isUnsupported
                                          ? 'bg-gray-300'
                                          : l.label === 'legitimate' ? 'bg-emerald-500' : isHarm ? 'bg-rose-500' : 'bg-amber-400'
                                      }`}
                                      style={{ width: isUnsupported ? '0%' : `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Explanation Reason */}
                        {res.severity_reason && (
                          <div className="text-[11px] text-[#858795] pt-1">
                            <span className="font-semibold text-[#20212B]">Reason: </span>
                            <span>{res.severity_reason}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Loading Indicator when inference is running */}
          {analyzing && (
            <div className="flex items-center gap-2.5 text-xs text-[#858795] animate-pulse">
              <div className="w-7 h-7 rounded-full bg-[#6C5CE7] text-white flex items-center justify-center text-xs font-bold">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div className="p-3 rounded-2xl bg-white border border-[#E9EAF1] shadow-xs flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#6C5CE7]" />
                <span>Running regional multilingual model inference...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Fixed Bottom Input Area (Message Input, Voice Assistance & Send Control) ── */}
        <footer className="p-4 border-t border-[#E9EAF1] bg-white space-y-2.5">
          {/* Voice Listening Active Indicator Banner */}
          {isListening && (
            <div className="p-3 rounded-2xl bg-gradient-to-r from-rose-50 via-purple-50 to-indigo-50 border border-rose-200 text-xs shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600"></span>
                </span>
                <Mic className="w-4 h-4 text-rose-600 animate-bounce" />
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-rose-950 font-bold">
                    Listening in {currentVoiceConfig.name} ({currentVoiceConfig.nativeName}):
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-200 text-rose-800 font-mono font-bold">
                    {currentVoiceConfig.code}
                  </span>
                </div>
              </div>

              {/* Language Switch Pills right inside the listening banner */}
              <div className="flex items-center flex-wrap gap-1.5">
                <span className="text-[#858795] text-[10px] font-semibold uppercase tracking-wider mr-1">Switch:</span>
                {VOICE_LANGUAGES.map((v) => (
                  <button
                    key={v.code}
                    type="button"
                    onClick={() => switchVoiceLang(v.code, v.defaultHint)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                      voiceLanguage === v.code
                        ? 'bg-[#6C5CE7] text-white shadow-xs'
                        : 'bg-white text-[#20212B] hover:bg-slate-50 border border-[#E9EAF1]'
                    }`}
                  >
                    {v.nativeName}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={stopListening}
                  className="ml-1 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] shadow-xs cursor-pointer transition-colors"
                >
                  Done Speaking
                </button>
              </div>
            </div>
          )}

          {/* Real-time Interim Voice Speech Feedback if speaking */}
          {isListening && interimTranscript && (
            <div className="px-3 py-1.5 rounded-xl bg-purple-50/70 border border-purple-100 text-xs text-purple-900 flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600">Live:</span>
              <span className="italic">"{interimTranscript}"</span>
            </div>
          )}

          {/* Input Controls Row */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Language Hint Dropdown */}
            <select
              value={languageHint}
              onChange={(e) => handleLanguageHintChange(e.target.value)}
              className="px-2.5 py-2.5 rounded-xl border border-[#E9EAF1] bg-[#F8F9FE] text-xs text-[#20212B] font-semibold focus:outline-none focus:border-[#6C5CE7] cursor-pointer shrink-0 max-w-[130px] sm:max-w-none"
              title="Override language model route"
            >
              <option value="">Auto-Detect</option>
              <option value="english">English</option>
              <option value="hindi">Hindi (हिन्दी)</option>
              <option value="telugu">Telugu (తెలుగు)</option>
              <option value="kannada">Kannada (ಕನ್ನಡ)</option>
              <option value="hinglish">Hinglish</option>
            </select>



            {/* Main Text Input with Embedded Voice Mic Control */}
            <div className="relative flex-1">
              <input
                type="text"
                value={text}
                onChange={(e) => {
                  const val = e.target.value;
                  setText(val);
                  if (/[ऀ-ॿ]/.test(val)) {
                    setLanguageHint('hindi');
                  } else if (/[ఀ-౿]/.test(val)) {
                    setLanguageHint('telugu');
                  } else if (/[ಀ-೿]/.test(val)) {
                    setLanguageHint('kannada');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleAnalyze();
                  }
                }}
                placeholder={
                  isListening
                    ? `Listening in ${currentVoiceConfig.nativeName}... speak now`
                    : `Type a comment or tap mic to speak in ${currentVoiceConfig.nativeName}...`
                }
                disabled={analyzing}
                className="w-full pl-3.5 pr-10 py-2.5 text-xs rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-[#20212B] placeholder-[#858795] focus:outline-none focus:border-[#6C5CE7] focus:bg-white transition-all"
              />

              {/* Voice Assistance Button (Mic) */}
              <button
                type="button"
                onClick={() => toggleVoiceInput()}
                title={
                  speechSupported
                    ? isListening
                      ? 'Stop voice input'
                      : `Speak comment in ${currentVoiceConfig.name} (${currentVoiceConfig.nativeName} - ${currentVoiceConfig.code})`
                    : 'Speech recognition not supported in this browser'
                }
                className={`absolute right-2 top-2 p-1.5 rounded-lg transition-all cursor-pointer ${
                  isListening
                    ? 'text-rose-600 bg-rose-100 animate-pulse ring-2 ring-rose-400'
                    : 'text-[#858795] hover:text-[#6C5CE7] hover:bg-[#EEEAFE]'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            </div>

            {/* Send Control */}
            <button
              type="button"
              onClick={() => handleAnalyze()}
              disabled={analyzing || !text.trim()}
              className="flex items-center justify-center p-2.5 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] disabled:opacity-40 text-white transition-all shadow-md shadow-[#6C5CE7]/25 cursor-pointer active:scale-95 shrink-0"
              title="Submit for inference"
            >
              {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
