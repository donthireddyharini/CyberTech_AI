import React, { useState } from 'react';
import {
  Shield, Lock, Cpu, Globe, CheckCircle2, ArrowRight,
  Sparkles, Terminal, Activity, FileText, ChevronRight, X, AlertTriangle, Eye, Menu
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../i18n/I18nContext';
import { analyzeApi } from '../api/client';
import { GoogleLoginButton } from '../components/GoogleLoginButton';
import type { AnalyzeResponse } from '../types';

export default function LandingPage() {
  const { login, register } = useAuth();
  const { t } = useTranslation();

  // Navigation State
  const [activeSection, setActiveSection] = useState<string>('hero');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const element = document.getElementById(targetId);
    if (!element) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const headerOffset = 80;
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

    window.scrollTo({
      top: offsetPosition,
      behavior: prefersReducedMotion ? 'auto' : 'smooth',
    });

    try {
      window.history.pushState(null, '', `#${targetId}`);
    } catch {}
    setActiveSection(targetId);
  };

  React.useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 120;
      const sections = ['architecture', 'multilingual', 'features', 'demo-preview', 'hero'];
      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const top = el.offsetTop;
          if (scrollPosition >= top) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [demoModalOpen, setDemoModalOpen] = useState(false);

  // Auth form state
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Live Demo state
  const [demoText, setDemoText] = useState('నువ్వు చాలా పనికిరాని వెధవవి');
  const [demoLanguageHint, setDemoLanguageHint] = useState('te');
  const [demoAnalyzing, setDemoAnalyzing] = useState(false);
  const [demoResult, setDemoResult] = useState<AnalyzeResponse | null>(null);

  const sampleComments = [
    { text: 'నువ్వు చాలా పనికిరాని వెధవవి', lang: 'te', label: 'Telugu Insult' },
    { text: 'ye bilkul bekaar aur wahiyat aadmi hai', lang: 'hinglish', label: 'Hinglish Abuse' },
    { text: 'तू बहुत ही घटिया और बदतमीज इंसान है', lang: 'hi', label: 'Hindi Harassment' },
    { text: 'ನೀನು ತುಂಬಾ ಕೆಟ್ಟವನು ಮತ್ತು ಅಸಹ್ಯ', lang: 'kn', label: 'Kannada Insult' },
    { text: 'You are completely useless and pathetic', lang: 'en', label: 'English Abuse' },
    { text: 'This presentation was wonderful and very helpful, thanks!', lang: 'en', label: 'English Constructive' },
  ];

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        await login({ email, password });
      } else {
        await register({ email, name, password, preferred_language: 'en' });
      }
      setAuthModalOpen(false);
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setAuthLoading(false);
    }
  };

  const DEMO_ACCOUNTS = [
    { label: 'Faculty Evaluator', role: 'Evaluator', email: 'evaluator@cybertech.ai', pass: 'DemoPassword2026!' },
    { label: 'Lead Admin', role: 'Admin', email: 'admin@cybertech.ai', pass: 'CyberTech2026!' },
    { label: 'Safety Moderator', role: 'Moderator', email: 'moderator@cybertech.ai', pass: 'Moderator2026!' },
  ];

  const fillCredentials = (acc: typeof DEMO_ACCOUNTS[0]) => {
    setAuthMode('login');
    setEmail(acc.email);
    setPassword(acc.pass);
    setAuthError('');
  };

  const handleQuickDemoLogin = async () => {
    setAuthError('');
    setAuthLoading(true);
    try {
      try {
        await login({ email: 'evaluator@cybertech.ai', password: 'DemoPassword2026!' });
      } catch {
        await login({ email: 'admin@cybertech.ai', password: 'CyberTech2026!' });
      }
      setAuthModalOpen(false);
    } catch (err: any) {
      setAuthError(err.message || 'Quick demo login failed.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRunDemo = async (textToRun = demoText, langHint = demoLanguageHint) => {
    setDemoAnalyzing(true);
    try {
      const resp = await analyzeApi.analyze({
        text: textToRun,
        language_hint: langHint,
      });
      setDemoResult(resp.data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setDemoAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6FA] text-[#20212B] selection:bg-[#6C5CE7] selection:text-white font-sans antialiased overflow-x-hidden">
      {/* Background soft subtle ambient decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-[#6C5CE7]/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-32 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-indigo-100/40 rounded-full blur-3xl" />
      </div>

      {/* Top Navigation */}
      <header className="relative z-20 border-b border-[#E9EAF1] bg-white/90 backdrop-blur-md sticky top-0 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#6C5CE7] flex items-center justify-center text-white shadow-sm shadow-[#6C5CE7]/25">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-base font-black tracking-tight text-[#20212B] flex items-center gap-2">
              <span>CyberTech AI</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#EEEAFE] text-[#6C5CE7] border border-[#DDD6FE] font-mono font-bold">
                Enterprise AI
              </span>
            </div>
            <div className="text-xs text-[#858795] font-medium">Content Moderation Intelligence</div>
          </div>
        </div>

        {/* Desktop Links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <a
            href="#hero"
            onClick={(e) => handleNavClick(e, 'hero')}
            className={`transition-colors py-1 px-1 border-b-2 ${
              activeSection === 'hero'
                ? 'text-[#6C5CE7] border-[#6C5CE7] font-semibold'
                : 'text-[#858795] border-transparent hover:text-[#6C5CE7]'
            }`}
          >
            Overview
          </a>
          <a
            href="#features"
            onClick={(e) => handleNavClick(e, 'features')}
            className={`transition-colors py-1 px-1 border-b-2 ${
              activeSection === 'features'
                ? 'text-[#6C5CE7] border-[#6C5CE7] font-semibold'
                : 'text-[#858795] border-transparent hover:text-[#6C5CE7]'
            }`}
          >
            Features
          </a>
          <a
            href="#multilingual"
            onClick={(e) => handleNavClick(e, 'multilingual')}
            className={`transition-colors py-1 px-1 border-b-2 ${
              activeSection === 'multilingual'
                ? 'text-[#6C5CE7] border-[#6C5CE7] font-semibold'
                : 'text-[#858795] border-transparent hover:text-[#6C5CE7]'
            }`}
          >
            Languages
          </a>
          <a
            href="#architecture"
            onClick={(e) => handleNavClick(e, 'architecture')}
            className={`transition-colors py-1 px-1 border-b-2 ${
              activeSection === 'architecture'
                ? 'text-[#6C5CE7] border-[#6C5CE7] font-semibold'
                : 'text-[#858795] border-transparent hover:text-[#6C5CE7]'
            }`}
          >
            Architecture
          </a>
          <button
            onClick={() => {
              setDemoModalOpen(true);
              handleRunDemo();
            }}
            className="flex items-center gap-1.5 text-[#6C5CE7] hover:text-[#5B4CD9] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C5CE7] rounded-lg px-2 py-1"
          >
            <Sparkles className="w-4 h-4" />
            <span>Interactive Demo</span>
          </button>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setAuthMode('login');
              setAuthModalOpen(true);
            }}
            className="px-4 py-1.5 text-xs font-semibold rounded-xl text-[#20212B] hover:text-[#6C5CE7] hover:bg-white transition-all border border-transparent hover:border-[#E9EAF1]"
          >
            {t('action.signIn', 'Sign In')}
          </button>

          <button
            onClick={() => {
              setAuthMode('register');
              setAuthModalOpen(true);
            }}
            className="px-4 py-1.5 text-xs font-semibold rounded-xl bg-[#6C5CE7] text-white hover:bg-[#5B4CD9] shadow-sm shadow-[#6C5CE7]/25 transition-all"
          >
            {t('action.getStarted', 'Get Started')}
          </button>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-[#858795] hover:text-[#20212B] hover:bg-[#F5F6FA] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6C5CE7]"
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden sticky top-[73px] z-20 border-b border-[#E9EAF1] bg-white/95 backdrop-blur-md px-6 py-4 space-y-3 shadow-md animate-in slide-in-from-top duration-200">
          <a
            href="#hero"
            onClick={(e) => handleNavClick(e, 'hero')}
            className={`block text-sm py-1.5 transition-colors ${
              activeSection === 'hero' ? 'text-[#6C5CE7] font-bold' : 'text-[#858795] hover:text-[#20212B]'
            }`}
          >
            Overview
          </a>
          <a
            href="#features"
            onClick={(e) => handleNavClick(e, 'features')}
            className={`block text-sm py-1.5 transition-colors ${
              activeSection === 'features' ? 'text-[#6C5CE7] font-bold' : 'text-[#858795] hover:text-[#20212B]'
            }`}
          >
            Features
          </a>
          <a
            href="#multilingual"
            onClick={(e) => handleNavClick(e, 'multilingual')}
            className={`block text-sm py-1.5 transition-colors ${
              activeSection === 'multilingual' ? 'text-[#6C5CE7] font-bold' : 'text-[#858795] hover:text-[#20212B]'
            }`}
          >
            Languages
          </a>
          <a
            href="#architecture"
            onClick={(e) => handleNavClick(e, 'architecture')}
            className={`block text-sm py-1.5 transition-colors ${
              activeSection === 'architecture' ? 'text-[#6C5CE7] font-bold' : 'text-[#858795] hover:text-[#20212B]'
            }`}
          >
            Architecture
          </a>
          <button
            onClick={() => {
              setMobileMenuOpen(false);
              setDemoModalOpen(true);
              handleRunDemo();
            }}
            className="flex items-center gap-2 text-sm py-1.5 text-[#6C5CE7] font-semibold w-full text-left"
          >
            <Sparkles className="w-4 h-4" />
            <span>Interactive Demo</span>
          </button>
        </div>
      )}

      {/* Hero Section */}
      <section id="hero" className="scroll-mt-24 relative z-10 pt-20 pb-20 px-6 max-w-6xl mx-auto text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EEEAFE] border border-[#DDD6FE] text-[#6C5CE7] text-xs font-semibold mb-8 shadow-xs">
          <Sparkles className="w-3.5 h-3.5 text-[#6C5CE7]" />
          <span>Strict Offline Machine Learning Architecture • Zero External APIs</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black text-[#20212B] tracking-tight leading-tight max-w-4xl mx-auto">
          Understand Harmful Content.{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#6C5CE7] via-[#5B4CD9] to-[#00CEC9]">
            Build Safer Digital Spaces.
          </span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-[#858795] max-w-3xl mx-auto leading-relaxed font-normal">
          High-performance, context-aware content moderation engineered specifically for Indic languages, code-mixed text, and cultural nuance. Built with verified machine learning models and 100% local inference.
        </p>

        {/* CTA Buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <button
            onClick={() => {
              setAuthMode('login');
              setAuthModalOpen(true);
            }}
            className="px-8 py-3.5 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-white font-semibold text-sm shadow-md shadow-[#6C5CE7]/25 hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center gap-2"
          >
            <span>{t('action.getStarted', 'Enter Moderation Dashboard')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setDemoModalOpen(true);
              handleRunDemo();
            }}
            className="px-7 py-3.5 rounded-xl bg-white border border-[#E9EAF1] hover:border-[#6C5CE7]/40 text-[#20212B] font-semibold text-sm shadow-xs transition-all flex items-center gap-2 hover:bg-[#FBFBFE]"
          >
            <Eye className="w-4 h-4 text-[#6C5CE7]" />
            <span>{t('action.tryDemo', 'Try Interactive Live Demo')}</span>
          </button>
        </div>

        {/* Key Feature Highlights Pill Row */}
        <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-4xl mx-auto">
          <div className="p-4 rounded-2xl bg-white border border-[#E9EAF1] shadow-xs text-left">
            <div className="text-2xl font-black text-[#20212B]">5+</div>
            <div className="text-xs text-[#6C5CE7] font-semibold">Languages Supported</div>
            <div className="text-[11px] text-[#858795] mt-1">Telugu, Hindi, Kannada, Hinglish, English</div>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-[#E9EAF1] shadow-xs text-left">
            <div className="text-2xl font-black text-[#20212B]">&lt; 50ms</div>
            <div className="text-xs text-[#00B894] font-semibold">Local Inference Latency</div>
            <div className="text-[11px] text-[#858795] mt-1">Direct memory pipelines with zero network delays</div>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-[#E9EAF1] shadow-xs text-left">
            <div className="text-2xl font-black text-[#20212B]">100%</div>
            <div className="text-xs text-[#0984E3] font-semibold">Data Privacy & Sovereignty</div>
            <div className="text-[11px] text-[#858795] mt-1">Zero cloud APIs, zero leaks, 100% offline</div>
          </div>
          <div className="p-4 rounded-2xl bg-white border border-[#E9EAF1] shadow-xs text-left">
            <div className="text-2xl font-black text-[#20212B]">Active</div>
            <div className="text-xs text-[#FDCB6E] font-semibold">Human-in-the-Loop</div>
            <div className="text-[11px] text-[#858795] mt-1">4-way feedback loop for continuous refinement</div>
          </div>
        </div>
      </section>

      {/* Product Preview Card */}
      <section id="demo-preview" className="scroll-mt-24 relative z-10 px-6 max-w-5xl mx-auto mb-20">
        <div className="rounded-2xl border border-[#E9EAF1] bg-white p-2 shadow-xl shadow-slate-200/50">
          <div className="rounded-xl bg-[#FBFBFE] p-6 border border-[#E9EAF1]">
            <div className="flex items-center justify-between pb-4 border-b border-[#E9EAF1]">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-rose-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
                <span className="ml-3 text-xs font-medium text-[#858795]">CyberTech Intelligence Engine • Real-Time Stream</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-emerald-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Engine Active</span>
              </div>
            </div>

            {/* Quick Demo Preview inside UI */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="text-xs font-bold text-[#20212B]">Live Sample Input</label>
                <div className="p-4 rounded-xl bg-white border border-[#E9EAF1] shadow-xs text-sm text-[#20212B]">
                  <p className="font-semibold text-[#6C5CE7]">నువ్వు చాలా పనికిరాని వెధవవి</p>
                  <div className="mt-2 text-[11px] text-[#858795] flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-[#EEEAFE] text-[#6C5CE7] border border-[#DDD6FE] font-medium">Telugu Script</span>
                    <span>Direct personal insult & abusive language</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setDemoText('నువ్వు చాలా పనికిరాని వెధవవి');
                      setDemoLanguageHint('te');
                      setDemoModalOpen(true);
                      handleRunDemo('నువ్వు చాలా పనికిరాని వెధవవి', 'te');
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] text-xs font-semibold text-white shadow-sm shadow-[#6C5CE7]/20 transition-all"
                  >
                    Run Local Classification
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-[#20212B]">Classified Telemetry</label>
                <div className="p-4 rounded-xl bg-white border border-[#E9EAF1] shadow-xs text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[#858795]">Classification</span>
                    <span className="px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 font-bold uppercase text-[11px]">
                      Toxic / Harassment
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#858795]">Harm Severity</span>
                    <span className="text-rose-600 font-bold">High Harm (0.978)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#858795]">Resolved Language</span>
                    <span className="text-[#6C5CE7] font-semibold">Telugu (తెలుగు)</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[#858795]">Active Pipeline</span>
                    <span className="font-mono text-[11px] text-[#858795]">telugu_generalization_v3</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features Section */}
      <section id="features" className="scroll-mt-24 relative z-10 py-16 px-6 max-w-6xl mx-auto border-t border-[#E9EAF1]">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-black text-[#20212B] tracking-tight">
            Engineered for Cultural Nuance and High Precision
          </h2>
          <p className="mt-3 text-[#858795] text-sm max-w-2xl mx-auto">
            Standard moderation models fail when faced with regional slang, phonetic typing, and code-mixing. CyberTech AI addresses these real-world challenges.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl bg-white border border-[#E9EAF1] hover:border-[#6C5CE7]/40 hover:shadow-lg hover:shadow-[#6C5CE7]/5 transition-all group shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-[#EEEAFE] border border-[#DDD6FE] flex items-center justify-center text-[#6C5CE7] mb-5 group-hover:scale-105 transition-transform">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#20212B] mb-2">Context Intelligence Lab</h3>
            <p className="text-xs text-[#858795] leading-relaxed">
              Disentangles apparent hostility from colloquial banter. Evaluates preceding and following context to eliminate unwarranted false positives.
            </p>
          </div>

          <div id="multilingual" className="scroll-mt-24 p-6 rounded-2xl bg-white border border-[#E9EAF1] hover:border-[#6C5CE7]/40 hover:shadow-lg hover:shadow-[#6C5CE7]/5 transition-all group shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-[#6C5CE7] mb-5 group-hover:scale-105 transition-transform">
              <Globe className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#20212B] mb-2">Multilingual & Code-Mixed</h3>
            <p className="text-xs text-[#858795] leading-relaxed">
              Custom specialized word and character n-gram pipelines for Telugu, Hindi, Kannada, Hinglish, and English, retaining full Unicode fidelity.
            </p>
          </div>

          <div id="architecture" className="scroll-mt-24 p-6 rounded-2xl bg-white border border-[#E9EAF1] hover:border-[#6C5CE7]/40 hover:shadow-lg hover:shadow-[#6C5CE7]/5 transition-all group shadow-xs">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 mb-5 group-hover:scale-105 transition-transform">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-[#20212B] mb-2">100% Offline & Private</h3>
            <p className="text-xs text-[#858795] leading-relaxed">
              Zero dependency on third-party cloud LLMs or paid APIs. Complete institutional privacy and compliance with university research standards.
            </p>
          </div>
        </div>
      </section>

      {/* Live Interactive Demo Modal */}
      {demoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20212B]/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl bg-white border border-[#E9EAF1] rounded-2xl shadow-2xl p-6 relative text-[#20212B]">
            <button
              onClick={() => setDemoModalOpen(false)}
              className="absolute top-4 right-4 text-[#858795] hover:text-[#20212B] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-[#6C5CE7]" />
              <h3 className="text-lg font-bold text-[#20212B]">Interactive Live Detection Sandbox</h3>
            </div>
            <p className="text-xs text-[#858795] mb-4">
              Test genuine local model inference without requiring an account. Select a sample or type your own multilingual comment.
            </p>

            {/* Quick Sample Selector */}
            <div className="flex flex-wrap gap-2 mb-4">
              {sampleComments.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setDemoText(s.text);
                    setDemoLanguageHint(s.lang);
                    handleRunDemo(s.text, s.lang);
                  }}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-[#F5F6FA] border border-[#E9EAF1] text-[#20212B] hover:border-[#6C5CE7] hover:bg-[#EEEAFE] hover:text-[#6C5CE7] transition-all"
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Input area */}
            <div className="space-y-3">
              <textarea
                value={demoText}
                onChange={(e) => setDemoText(e.target.value)}
                placeholder="Enter text to analyze..."
                rows={3}
                className="w-full p-3.5 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-sm text-[#20212B] focus:outline-none focus:border-[#6C5CE7] resize-none"
              />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs text-[#858795]">
                  <span className="font-medium">Language Hint:</span>
                  <select
                    value={demoLanguageHint}
                    onChange={(e) => setDemoLanguageHint(e.target.value)}
                    className="bg-white border border-[#E9EAF1] rounded-lg px-2.5 py-1 text-[#20212B] text-xs font-medium focus:outline-none focus:border-[#6C5CE7]"
                  >
                    <option value="te">Telugu (తెలుగు)</option>
                    <option value="hi">Hindi (हिन्दी)</option>
                    <option value="hinglish">Hinglish</option>
                    <option value="kn">Kannada (ಕನ್ನಡ)</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <button
                  onClick={() => handleRunDemo()}
                  disabled={demoAnalyzing || !demoText.trim()}
                  className="px-5 py-2 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] disabled:opacity-50 text-white font-semibold text-xs shadow-sm shadow-[#6C5CE7]/25 transition-all flex items-center gap-2"
                >
                  {demoAnalyzing ? 'Analyzing...' : 'Run Analysis'}
                </button>
              </div>
            </div>

            {/* Result Area */}
            {demoResult && (
              <div className="mt-6 p-4 rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#20212B]">Analysis Verdict:</span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${
                      demoResult.severity === 'high'
                        ? 'bg-rose-50 border border-rose-200 text-rose-700'
                        : demoResult.severity === 'medium'
                        ? 'bg-amber-50 border border-amber-200 text-amber-700'
                        : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    }`}
                  >
                    {demoResult.decision || demoResult.severity}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-[#20212B] pt-2 border-t border-[#E9EAF1]">
                  <div>
                    <span className="text-[#858795]">Toxicity Score:</span>{' '}
                    <span className="font-bold tabular-nums text-[#20212B]">
                      {demoResult.toxicity_prediction?.toxicity_score !== undefined
                        ? (demoResult.toxicity_prediction.toxicity_score * 100).toFixed(1) + '%'
                        : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#858795]">Detected Language:</span>{' '}
                    <span className="font-semibold text-[#6C5CE7]">{demoResult.detected_language}</span>
                  </div>
                  <div>
                    <span className="text-[#858795]">Model Pipeline:</span>{' '}
                    <span className="font-mono text-[11px] text-[#20212B]">{demoResult.model_version}</span>
                  </div>
                  <div>
                    <span className="text-[#858795]">Latency:</span>{' '}
                    <span className="text-emerald-600 font-semibold tabular-nums">{demoResult.processing_time_ms} ms</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Auth Modal (Login / Register) */}
      {authModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#20212B]/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white border border-[#E9EAF1] rounded-2xl shadow-2xl p-6 relative text-[#20212B]">
            <button
              onClick={() => setAuthModalOpen(false)}
              className="absolute top-4 right-4 text-[#858795] hover:text-[#20212B] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Title */}
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-[#6C5CE7]" />
              <h3 className="text-lg font-bold text-[#20212B]">
                {authMode === 'login' ? 'Sign In to CyberTech AI' : 'Create Moderator Account'}
              </h3>
            </div>
            <p className="text-xs text-[#858795] mb-6">
              {authMode === 'login'
                ? 'Access real-time telemetry, moderation queues, and research reports.'
                : 'Join the moderation research and development platform.'}
            </p>

            {authError && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{authError}</span>
              </div>
            )}

            {/* Google Continue Button */}
            <div className="mb-4">
              <GoogleLoginButton
                buttonText={authMode === 'login' ? 'Continue with Google' : 'Sign up with Google'}
                onSuccess={() => setAuthModalOpen(false)}
                onError={(err) => setAuthError(err)}
              />
            </div>

            {/* Divider */}
            <div className="relative flex items-center justify-center mb-4">
              <div className="border-t border-[#E9EAF1] w-full" />
              <span className="bg-white px-3 text-[10px] font-semibold text-[#858795] uppercase tracking-wider relative">
                Or continue with email
              </span>
            </div>

            {/* Quick-Fill Demo Chips */}
            <div className="bg-[#F8F9FE] p-3 rounded-xl border border-[#E9EAF1] space-y-1.5 mb-4">
              <div className="text-[11px] font-semibold text-[#858795] flex items-center justify-between">
                <span>Pre-Configured Accounts:</span>
                <span className="text-[10px] text-[#6C5CE7]">Click to auto-fill</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {DEMO_ACCOUNTS.map((acc) => (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => fillCredentials(acc)}
                    className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-all cursor-pointer text-center truncate ${
                      email === acc.email
                        ? 'bg-[#6C5CE7] text-white border-[#6C5CE7] shadow-xs'
                        : 'bg-white text-[#20212B] border-[#E9EAF1] hover:border-[#6C5CE7]/40 hover:bg-[#F3F4FD]'
                    }`}
                    title={`${acc.label} (${acc.email})`}
                  >
                    {acc.role}
                  </button>
                ))}
              </div>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === 'register' && (
                <div>
                  <label className="block text-xs font-semibold text-[#20212B] mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Dr. A. Sharma"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-[#20212B] placeholder-[#858795] focus:outline-none focus:border-[#6C5CE7]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#20212B] mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="moderator@sentinel.ai"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-[#20212B] placeholder-[#858795] focus:outline-none focus:border-[#6C5CE7]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#20212B] mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#FBFBFE] border border-[#E9EAF1] text-[#20212B] placeholder-[#858795] focus:outline-none focus:border-[#6C5CE7]"
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 rounded-xl bg-[#6C5CE7] hover:bg-[#5B4CD9] disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-[#6C5CE7]/25 transition-all mt-2"
              >
                {authLoading ? 'Authenticating...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            {/* Quick Demo Access Button */}
            <div className="mt-4 pt-4 border-t border-[#E9EAF1]">
              <button
                onClick={handleQuickDemoLogin}
                disabled={authLoading}
                className="w-full py-2.5 rounded-xl bg-[#EEEAFE] border border-[#DDD6FE] hover:bg-[#E3DCFE] text-[#6C5CE7] text-xs font-semibold transition-colors flex items-center justify-center gap-1.5"
              >
                <Terminal className="w-3.5 h-3.5 text-[#6C5CE7]" />
                <span>One-Click Faculty / Evaluator Demo Sign In</span>
              </button>
            </div>

            {/* Toggle auth mode */}
            <div className="mt-4 text-center text-xs text-[#858795]">
              {authMode === 'login' ? (
                <span>
                  Don't have an account?{' '}
                  <button
                    onClick={() => {
                      setAuthError('');
                      setAuthMode('register');
                    }}
                    className="text-[#6C5CE7] hover:underline font-semibold"
                  >
                    Register here
                  </button>
                </span>
              ) : (
                <span>
                  Already registered?{' '}
                  <button
                    onClick={() => {
                      setAuthError('');
                      setAuthMode('login');
                    }}
                    className="text-[#6C5CE7] hover:underline font-semibold"
                  >
                    Sign In
                  </button>
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#E9EAF1] py-10 px-6 max-w-6xl mx-auto text-center text-xs text-[#858795]">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Shield className="w-4 h-4 text-[#6C5CE7]" />
          <span className="font-bold text-[#20212B]">CyberTech AI Intelligence Platform</span>
          <span>•</span>
          <span className="font-medium">Multi-Platform Social Media Moderation &amp; Local Inference</span>
        </div>
        <p>
          Offline Machine Learning &amp; Cultural Context Moderation. Zero external cloud LLM dependencies.
        </p>
      </footer>
    </div>
  );
}
