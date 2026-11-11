// Translations dictionary for Sentinel AI
// Languages supported: English (en), Hindi (hi), Hinglish (hinglish), Telugu (te), Kannada (kn)

export type SupportedLanguage = 'en' | 'hi' | 'hinglish' | 'te' | 'kn';

export interface LanguageOption {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'hinglish', name: 'Hinglish', nativeName: 'Hinglish', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', flag: '🇮🇳' },
];

export const translations: Record<SupportedLanguage, Record<string, string>> = {
  en: {
    // Nav & General
    'nav.dashboard': 'Dashboard',
    'nav.contextLab': 'Context Intelligence Lab',
    'nav.moderation': 'Moderator Command Center',
    'nav.datasetLab': 'Dataset & Model Lab',
    'nav.evaluations': 'Fairness & Evaluation',
    'nav.feedback': 'Feedback & Error Analysis',
    'nav.navigation': 'Navigation',
    'nav.modelOnline': 'Model Active',
    'nav.logout': 'Sign Out',
    'nav.profile': 'Profile & Settings',
    'nav.language': 'Language',

    // Brand card
    'brand.title': 'Safer Social Media.',
    'brand.subtitle': 'Healthier Conversations.',
    'brand.desc': 'AI-powered moderation for a kinder and more inclusive online community.',

    // Common actions
    'action.refresh': 'Refresh',
    'action.cancel': 'Cancel',
    'action.save': 'Save Changes',
    'action.close': 'Close',
    'action.filter': 'Filter',
    'action.search': 'Search',
    'action.submit': 'Submit',
    'action.downloadReport': 'Download Research Report',
    'action.exportCsv': 'Export CSV',
    'action.analyze': 'Analyze Now',
    'action.tryDemo': 'Try Live Demo',
    'action.signIn': 'Sign In',
    'action.register': 'Create Account',
    'action.getStarted': 'Get Started Free',

    // Dashboard
    'dashboard.title': 'System Analytics & Operations',
    'dashboard.subtitle': 'Real-time telemetry, model inference metrics, and content moderation performance across Indian languages.',
    'dashboard.filter.all': 'All Time',
    'dashboard.filter.today': 'Today',
    'dashboard.filter.yesterday': 'Yesterday',
    'dashboard.filter.7d': 'Last 7 Days',
    'dashboard.filter.30d': 'Last 30 Days',
    'dashboard.kpi.totalAnalyzed': 'Total Analyzed',
    'dashboard.kpi.flaggedComments': 'Flagged Comments',
    'dashboard.kpi.pendingReview': 'Pending Review',
    'dashboard.kpi.highPriority': 'High Severity',
    'dashboard.kpi.todayAnalyzed': 'Analyzed Today',
    'dashboard.chart.severity': 'Severity Distribution',
    'dashboard.chart.language': 'Language Distribution',
    'dashboard.chart.category': 'Violation Categories',
    'dashboard.chart.trend': 'Activity Volume Trend',
    'dashboard.recentActivity': 'Recent Moderation Telemetry',
    'dashboard.empty.title': 'No Moderation Data Yet',
    'dashboard.empty.desc': 'Comments analyzed will appear here with live classifications and severity distributions.',

    // Moderation Center
    'moderation.title': 'Moderator Command Center',
    'moderation.subtitle': 'Streamlined review interface for human verification and active learning feedback.',
    'moderation.confirmCorrect': 'Confirm Correct',
    'moderation.flagFP': 'False Positive',
    'moderation.flagFN': 'False Negative',
    'moderation.markAmbiguous': 'Ambiguous',

    // Evaluation
    'eval.title': 'Evaluation History & Research Audit',
    'eval.subtitle': 'Model benchmark performance across multilingual test sets with publication-grade research reporting.',
    'eval.downloadPdf': 'Download Research Report (PDF)',

    // Feedback
    'feedback.title': 'Feedback & Error Analysis',
    'feedback.subtitle': 'Track model misclassifications, false alarms, and continuous improvement metrics.',
    'feedback.falsePositives': 'False Positives',
    'feedback.falseNegatives': 'False Negatives',
    'feedback.ambiguous': 'Ambiguous Cases',
    'feedback.confirmed': 'Confirmed Correct',

    // Profile Popover
    'profile.title': 'User Profile',
    'profile.email': 'Email',
    'profile.role': 'Role',
    'profile.joined': 'Member Since',
    'profile.preferredLang': 'Preferred Language',
    'profile.edit': 'Edit Profile',
  },

  hi: {
    // Nav & General
    'nav.dashboard': 'डैशबोर्ड',
    'nav.contextLab': 'संदर्भ इंटेलिजेंस लैब',
    'nav.moderation': 'मॉडरेटर कमांड सेंटर',
    'nav.datasetLab': 'डेटासेट व मॉडल लैब',
    'nav.evaluations': 'निष्पक्षता एवं मूल्यांकन',
    'nav.feedback': 'प्रतिक्रिया एवं त्रुटि विश्लेषण',
    'nav.navigation': 'नेविगेशन',
    'nav.modelOnline': 'मॉडल सक्रिय',
    'nav.logout': 'लॉग आउट',
    'nav.profile': 'प्रोफ़ाइल एवं सेटिंग्स',
    'nav.language': 'भाषा',

    // Brand card
    'brand.title': 'सुरक्षित सोशल मीडिया।',
    'brand.subtitle': 'स्वस्थ और सम्मानजनक संवाद।',
    'brand.desc': 'अधिक समावेशी और सकारात्मक ऑनलाइन समुदाय के लिए स्थानीय AI मॉडरेशन।',

    // Common actions
    'action.refresh': 'रीफ्रेश करें',
    'action.cancel': 'रद्द करें',
    'action.save': 'परिवर्तन सहेजें',
    'action.close': 'बंद करें',
    'action.filter': 'फ़िल्टर',
    'action.search': 'खोजें',
    'action.submit': 'सबमिट करें',
    'action.downloadReport': 'रिसर्च रिपोर्ट डाउनलोड करें',
    'action.exportCsv': 'CSV एक्सपोर्ट करें',
    'action.analyze': 'विश्लेषण करें',
    'action.tryDemo': 'लाइव डेमो आज़माएं',
    'action.signIn': 'साइन इन करें',
    'action.register': 'खाता बनाएं',
    'action.getStarted': 'मुफ़्त शुरू करें',

    // Dashboard
    'dashboard.title': 'सिस्टम एनालिटिक्स व संचालन',
    'dashboard.subtitle': 'भारतीय भाषाओं में रियल-टाइम टेलीमेट्री, मॉडल इन्फरेंस मैट्रिक्स और कंटेंट मॉडरेशन प्रदर्शन।',
    'dashboard.filter.all': 'सभी समय',
    'dashboard.filter.today': 'आज',
    'dashboard.filter.yesterday': 'कल',
    'dashboard.filter.7d': 'पिछले 7 दिन',
    'dashboard.filter.30d': 'पिछले 30 दिन',
    'dashboard.kpi.totalAnalyzed': 'कुल विश्लेषित',
    'dashboard.kpi.flaggedComments': 'फ़्लैग की गई टिप्पणियाँ',
    'dashboard.kpi.pendingReview': 'समीक्षा लंबित',
    'dashboard.kpi.highPriority': 'उच्च गंभीरता',
    'dashboard.kpi.todayAnalyzed': 'आज विश्लेषित',
    'dashboard.chart.severity': 'गंभीरता वितरण',
    'dashboard.chart.language': 'भाषा वितरण',
    'dashboard.chart.category': 'उल्लंघन श्रेणियाँ',
    'dashboard.chart.trend': 'गतिविधि रुझान',
    'dashboard.recentActivity': 'हाल की मॉडरेशन टेलीमेट्री',
    'dashboard.empty.title': 'अभी तक कोई मॉडरेशन डेटा नहीं है',
    'dashboard.empty.desc': 'विश्लेषित टिप्पणियाँ यहाँ लाइव वर्गीकरण और गंभीरता वितरण के साथ दिखाई देंगी।',

    // Moderation Center
    'moderation.title': 'मॉडरेटर कमांड सेंटर',
    'moderation.subtitle': 'मानव सत्यापन और सक्रिय लर्निंग फीडबैक के लिए सहज इंटरफ़ेस।',
    'moderation.confirmCorrect': 'सटीक पुष्टि करें',
    'moderation.flagFP': 'फॉल्स पॉजिटिव (गलत अलार्म)',
    'moderation.flagFN': 'फॉल्स नेगेटिव (चूकी हुई हानि)',
    'moderation.markAmbiguous': 'अस्पष्ट',

    // Evaluation
    'eval.title': 'मूल्यांकन इतिहास एवं रिसर्च ऑडिट',
    'eval.subtitle': 'प्रकाशन-स्तर की शोध रिपोर्टिंग के साथ बहुभाषी परीक्षण सेटों पर मॉडल बेंचमार्क।',
    'eval.downloadPdf': 'रिसर्च रिपोर्ट डाउनलोड करें (PDF)',

    // Feedback
    'feedback.title': 'प्रतिक्रिया एवं त्रुटि विश्लेषण',
    'feedback.subtitle': 'मॉडल के गलत वर्गीकरण, झूठे अलार्म और निरंतर सुधार मेट्रिक्स की निगरानी करें।',
    'feedback.falsePositives': 'फॉल्स पॉजिटिव',
    'feedback.falseNegatives': 'फॉल्स नेगेटिव',
    'feedback.ambiguous': 'अस्पष्ट मामले',
    'feedback.confirmed': 'पुष्ट सटीकता',

    // Profile Popover
    'profile.title': 'उपयोगकर्ता प्रोफ़ाइल',
    'profile.email': 'ईमेल',
    'profile.role': 'भूमिका',
    'profile.joined': 'सदस्यता तिथि',
    'profile.preferredLang': 'पसंदीदा भाषा',
    'profile.edit': 'प्रोफ़ाइल संपादित करें',
  },

  hinglish: {
    // Nav & General
    'nav.dashboard': 'Dashboard',
    'nav.contextLab': 'Context Intelligence Lab',
    'nav.moderation': 'Moderation Command Center',
    'nav.datasetLab': 'Dataset & Model Lab',
    'nav.evaluations': 'Fairness & Evaluation',
    'nav.feedback': 'Feedback & Error Analysis',
    'nav.navigation': 'Navigation',
    'nav.modelOnline': 'Model Active Hai',
    'nav.logout': 'Sign Out Karein',
    'nav.profile': 'Profile & Settings',
    'nav.language': 'Language Chunein',

    // Brand card
    'brand.title': 'Safe Social Media.',
    'brand.subtitle': 'Better Conversations.',
    'brand.desc': 'Safe aur respectful online communities ke liye advanced AI moderation.',

    // Common actions
    'action.refresh': 'Refresh Karein',
    'action.cancel': 'Cancel',
    'action.save': 'Changes Save Karein',
    'action.close': 'Band Karein',
    'action.filter': 'Filter',
    'action.search': 'Dhoondhein',
    'action.submit': 'Submit Karein',
    'action.downloadReport': 'Research Report Download Karein',
    'action.exportCsv': 'CSV Export Karein',
    'action.analyze': 'Analyze Karein',
    'action.tryDemo': 'Live Demo Dekhein',
    'action.signIn': 'Sign In',
    'action.register': 'Account Banayein',
    'action.getStarted': 'Free Me Start Karein',

    // Dashboard
    'dashboard.title': 'System Analytics & Operations',
    'dashboard.subtitle': 'Indian languages me real-time telemetry, model metrics aur content moderation stats.',
    'dashboard.filter.all': 'Sabhi Time',
    'dashboard.filter.today': 'Aaj',
    'dashboard.filter.yesterday': 'Kal',
    'dashboard.filter.7d': 'Last 7 Din',
    'dashboard.filter.30d': 'Last 30 Din',
    'dashboard.kpi.totalAnalyzed': 'Total Analyzed',
    'dashboard.kpi.flaggedComments': 'Flagged Comments',
    'dashboard.kpi.pendingReview': 'Review Pending',
    'dashboard.kpi.highPriority': 'High Severity',
    'dashboard.kpi.todayAnalyzed': 'Aaj Ka Analysis',
    'dashboard.chart.severity': 'Severity Distribution',
    'dashboard.chart.language': 'Language Breakdown',
    'dashboard.chart.category': 'Violation Types',
    'dashboard.chart.trend': 'Activity Trend',
    'dashboard.recentActivity': 'Recent Moderation Activity',
    'dashboard.empty.title': 'Abhi Tak Koi Data Nahi Hai',
    'dashboard.empty.desc': 'Jaise hi comments analyze honge, live stats aur graphs yahan show honge.',

    // Moderation Center
    'moderation.title': 'Moderator Command Center',
    'moderation.subtitle': 'Human verification aur active feedback ke liye fast review dashboard.',
    'moderation.confirmCorrect': 'Sahi Hai (Confirm)',
    'moderation.flagFP': 'False Positive (Galat Flag)',
    'moderation.flagFN': 'False Negative (Chhuta Hua)',
    'moderation.markAmbiguous': 'Ambiguous (Confusing)',

    // Evaluation
    'eval.title': 'Evaluation History & Research Audit',
    'eval.subtitle': 'Multilingual test sets par benchmark results aur publication-ready research reports.',
    'eval.downloadPdf': 'Download Research Report (PDF)',

    // Feedback
    'feedback.title': 'Feedback & Error Analysis',
    'feedback.subtitle': 'Model mistakes, false alarms aur quality improvement metrics track karein.',
    'feedback.falsePositives': 'False Positives',
    'feedback.falseNegatives': 'False Negatives',
    'feedback.ambiguous': 'Ambiguous Cases',
    'feedback.confirmed': 'Confirmed Correct',

    // Profile Popover
    'profile.title': 'User Profile',
    'profile.email': 'Email',
    'profile.role': 'Role',
    'profile.joined': 'Joined Date',
    'profile.preferredLang': 'Language Preference',
    'profile.edit': 'Profile Edit Karein',
  },

  te: {
    // Nav & General
    'nav.dashboard': 'డాష్‌బోర్డ్',
    'nav.contextLab': 'సందర్భ ఇంటెలిజెన్స్ ల్యాబ్',
    'nav.moderation': 'మోడరేటర్ కమాండ్ సెంటర్',
    'nav.datasetLab': 'డేటాసెట్ & మోడల్ ల్యాబ్',
    'nav.evaluations': 'న్యాయబద్ధత & మూల్యాంకనం',
    'nav.feedback': 'ఫీడ్‌బ్యాక్ & లోపాల విశ్లేషణ',
    'nav.navigation': 'నావిగేషన్',
    'nav.modelOnline': 'మోడల్ యాక్టివ్',
    'nav.logout': 'లాగ్ అవుట్',
    'nav.profile': 'ప్రొఫైల్ & సెట్టింగ్‌లు',
    'nav.language': 'భాష',

    // Brand card
    'brand.title': 'సురక్షిత సోషల్ మీడియా.',
    'brand.subtitle': 'ఆరోగ్యకరమైన సంభాషణలు.',
    'brand.desc': 'మరింత కలుపుగోలు ఆన్‌లైన్ సమాజం కోసం ఆర్టిఫిషియల్ ఇంటెలిజెన్స్ ఆధారిత మోడరేషన్.',

    // Common actions
    'action.refresh': 'రిఫ్రెష్ చేయండి',
    'action.cancel': 'రద్దు చేయండి',
    'action.save': 'మార్పులను భద్రపరచండి',
    'action.close': 'మూసివేయండి',
    'action.filter': 'ఫిల్టర్',
    'action.search': 'శోధించండి',
    'action.submit': 'సమర్పించండి',
    'action.downloadReport': 'పరిశోధన నివేదిక డౌన్‌లోడ్',
    'action.exportCsv': 'CSV ఎగుమతి',
    'action.analyze': 'విశ్లేషించండి',
    'action.tryDemo': 'లైవ్ డెమో ప్రయత్నించండి',
    'action.signIn': 'సైన్ ఇన్',
    'action.register': 'ఖాతా సృష్టించండి',
    'action.getStarted': 'ఉచితంగా ప్రారంభించండి',

    // Dashboard
    'dashboard.title': 'సిస్టమ్ అనలిటిక్స్ & ఆపరేషన్స్',
    'dashboard.subtitle': 'భారతీయ భాషలలో రియల్-టైమ్ టెలిమెట్రీ, మోడల్ ఇన్ఫరెన్స్ మెట్రిక్స్ మరియు కంటెంట్ మోడరేషన్ ప్రదర్శన.',
    'dashboard.filter.all': 'మొత్తం సమయం',
    'dashboard.filter.today': 'ఈ రోజు',
    'dashboard.filter.yesterday': 'నిన్న',
    'dashboard.filter.7d': 'గత 7 రోజులు',
    'dashboard.filter.30d': 'గత 30 రోజులు',
    'dashboard.kpi.totalAnalyzed': 'మొత్తం విశ్లేషించినవి',
    'dashboard.kpi.flaggedComments': 'ఫ్లాగ్ చేయబడిన వ్యాఖ్యలు',
    'dashboard.kpi.pendingReview': 'సమీక్ష పెండింగ్',
    'dashboard.kpi.highPriority': 'తీవ్రమైనవి (హై)',
    'dashboard.kpi.todayAnalyzed': 'ఈ రోజు విశ్లేషణ',
    'dashboard.chart.severity': 'తీవ్రత పంపిణీ',
    'dashboard.chart.language': 'భాషా పంపిణీ',
    'dashboard.chart.category': 'ఉల్లంఘన వర్గాలు',
    'dashboard.chart.trend': 'కార్యాచరణ ట్రెండ్',
    'dashboard.recentActivity': 'ఇటీవలి మోడరేషన్ టెలిమెట్రీ',
    'dashboard.empty.title': 'ఇంకా ఎటువంటి మోడరేషన్ డేటా లేదు',
    'dashboard.empty.desc': 'విశ్లేషించబడిన వ్యాఖ్యలు ఇక్కడ ప్రత్యక్ష వర్గీకరణలతో కనిపిస్తాయి.',

    // Moderation Center
    'moderation.title': 'మోడరేటర్ కమాండ్ సెంటర్',
    'moderation.subtitle': 'మానవ ధృవీకరణ మరియు నిరంతర అభ్యాసం కోసం క్రమబద్ధీకరించిన సమీక్ష ఇంటర్‌ఫేస్.',
    'moderation.confirmCorrect': 'సరైనదిగా నిర్ధారించు',
    'moderation.flagFP': 'తప్పుడు హెచ్చరిక (False Positive)',
    'moderation.flagFN': 'మిస్ అయిన హాని (False Negative)',
    'moderation.markAmbiguous': 'సందిగ్ధమైనది',

    // Evaluation
    'eval.title': 'మూల్యాంకన చరిత్ర & పరిశోధనా ఆడిట్',
    'eval.subtitle': 'పరిశోధనా స్థాయి నివేదికలతో బహుభాషా పరీక్షా సెట్లలో మోడల్ బెంచ్‌మార్క్ పనితీరు.',
    'eval.downloadPdf': 'పరిశోధన నివేదిక డౌన్‌లోడ్ (PDF)',

    // Feedback
    'feedback.title': 'ఫీడ్‌బ్యాక్ & లోపాల విశ్లేషణ',
    'feedback.subtitle': 'మోడల్ తప్పు వర్గీకరణలు మరియు నిరంతర అభివృద్ధి మెట్రిక్‌లను ట్రాక్ చేయండి.',
    'feedback.falsePositives': 'ఫాల్స్ పాజిటివ్స్',
    'feedback.falseNegatives': 'ఫాల్స్ నెగటివ్స్',
    'feedback.ambiguous': 'సందిగ్ధ కేసులు',
    'feedback.confirmed': 'నిర్ధారిత ఖచ్చితత్వం',

    // Profile Popover
    'profile.title': 'వినియోగదారు ప్రొఫైల్',
    'profile.email': 'ఈమెయిల్',
    'profile.role': 'పాత్ర',
    'profile.joined': 'చేరిన తేదీ',
    'profile.preferredLang': 'ఇష్టపడే భాష',
    'profile.edit': 'ప్రొఫైల్ సవరించండి',
  },

  kn: {
    // Nav & General
    'nav.dashboard': 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    'nav.contextLab': 'ಸಂದರ್ಭ ಇಂಟೆಲಿಜೆನ್ಸ್ ಲ್ಯಾಬ್',
    'nav.moderation': 'ಮಾಡರೇಟರ್ ಕಮಾಂಡ್ ಸೆಂಟರ್',
    'nav.datasetLab': 'ಡೇಟಾಸೆಟ್ & ಮಾಡೆಲ್ ಲ್ಯಾಬ್',
    'nav.evaluations': 'ನ್ಯಾಯಸಮ್ಮತತೆ ಮತ್ತು ಮೌಲ್ಯಮಾಪನ',
    'nav.feedback': 'ಪ್ರತಿಕ್ರಿಯೆ ಮತ್ತು ದೋಷ ವಿಶ್ಲೇಷಣೆ',
    'nav.navigation': 'ನ್ಯಾವಿಗೇಷನ್',
    'nav.modelOnline': 'ಮಾದರಿ ಸಕ್ರಿಯ',
    'nav.logout': 'ಸೈನ್ ಔಟ್',
    'nav.profile': 'ಪ್ರೊಫೈಲ್ ಮತ್ತು ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
    'nav.language': 'ಭಾಷೆ',

    // Brand card
    'brand.title': 'ಸುರಕ್ಷಿತ ಸಾಮಾಜಿಕ ಮಾಧ್ಯಮ.',
    'brand.subtitle': 'ಆರೋಗ್ಯಕರ ಸಂಭಾಷಣೆಗಳು.',
    'brand.desc': 'ಹೆಚ್ಚು ಅಂತರ್ಗತ ಆನ್‌ಲೈನ್ ಸಮುದಾಯಕ್ಕಾಗಿ ಕೃತಕ ಬುದ್ಧಿಮತ್ತೆ ಆಧಾರಿತ ಮಾಡರೇಶನ್.',

    // Common actions
    'action.refresh': 'ರಿಫ್ರೆಶ್ ಮಾಡಿ',
    'action.cancel': 'ರದ್ದುಮಾಡಿ',
    'action.save': 'ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಿ',
    'action.close': 'ಮುಚ್ಚಿ',
    'action.filter': 'ಫಿಲ್ಟರ್',
    'action.search': 'ಹುಡುಕಿ',
    'action.submit': 'ಸಲ್ಲಿಸಿ',
    'action.downloadReport': 'ಸಂಶೋಧನಾ ವರದಿ ಡೌನ್‌ಲೋಡ್',
    'action.exportCsv': 'CSV ರಫ್ತು',
    'action.analyze': 'ವಿಶ್ಲೇಷಿಸಿ',
    'action.tryDemo': 'ಲೈವ್ ಡೆಮೊ ಪ್ರಯತ್ನಿಸಿ',
    'action.signIn': 'ಸೈನ್ ಇನ್',
    'action.register': 'ಖಾತೆ ತೆರೆಯಿರಿ',
    'action.getStarted': 'ಉಚಿತವಾಗಿ ಪ್ರಾರಂಭಿಸಿ',

    // Dashboard
    'dashboard.title': 'ಸಿಸ್ಟಮ್ ಅನಾಲಿಟಿಕ್ಸ್ & ಕಾರ್ಯಾಚರಣೆಗಳು',
    'dashboard.subtitle': 'ಭಾರತೀಯ ಭಾಷೆಗಳಲ್ಲಿ ರಿಯಲ್-ಟೈಮ್ ಟೆಲಿಮೆಟ್ರಿ, ಮಾಡೆಲ್ ಇನ್‌ಫರೆನ್ಸ್ ಮೆಟ್ರಿಕ್ಸ್ ಮತ್ತು ಮಾಡರೇಶನ್ ಕಾರ್ಯಕ್ಷಮತೆ.',
    'dashboard.filter.all': 'ಎಲ್ಲಾ ಸಮಯ',
    'dashboard.filter.today': 'ಇಂದು',
    'dashboard.filter.yesterday': 'ನಿನ್ನೆ',
    'dashboard.filter.7d': 'ಕಳೆದ 7 ದಿನಗಳು',
    'dashboard.filter.30d': 'ಕಳೆದ 30 ದಿನಗಳು',
    'dashboard.kpi.totalAnalyzed': 'ಒಟ್ಟು ವಿಶ್ಲೇಷಿಸಲಾಗಿದೆ',
    'dashboard.kpi.flaggedComments': 'ಫ್ಲ್ಯಾಗ್ ಮಾಡಲಾದ ಕಾಮೆಂಟ್‌ಗಳು',
    'dashboard.kpi.pendingReview': 'ಪರಿಶೀಲನೆ ಬಾಕಿ',
    'dashboard.kpi.highPriority': 'ಹೆಚ್ಚಿನ ತೀವ್ರತೆ',
    'dashboard.kpi.todayAnalyzed': 'ಇಂದು ವಿಶ್ಲೇಷಿಸಲಾಗಿದೆ',
    'dashboard.chart.severity': 'ತೀವ್ರತೆಯ ಹಂಚಿಕೆ',
    'dashboard.chart.language': 'ಭಾಷಾ ಹಂಚಿಕೆ',
    'dashboard.chart.category': 'ಉಲ್ಲಂಘನೆ ವರ್ಗಗಳು',
    'dashboard.chart.trend': 'ಚಟುವಟಿಕೆ ಪ್ರವೃತ್ತಿ',
    'dashboard.recentActivity': 'ಇತ್ತೀಚಿನ ಮಾಡರೇಶನ್ ಟೆಲಿಮೆಟ್ರಿ',
    'dashboard.empty.title': 'ಇನ್ನೂ ಯಾವುದೇ ಮಾಡರೇಶನ್ ಡೇಟಾ ಇಲ್ಲ',
    'dashboard.empty.desc': 'ವಿಶ್ಲೇಷಿಸಲಾದ ಕಾಮೆಂಟ್‌ಗಳು ಇಲ್ಲಿ ನೇರ ವರ್ಗೀಕರಣಗಳೊಂದಿಗೆ ಗೋಚರಿಸುತ್ತವೆ.',

    // Moderation Center
    'moderation.title': 'ಮಾಡರೇಟರ್ ಕಮಾಂಡ್ ಸೆಂಟರ್',
    'moderation.subtitle': 'ಮಾನವ ಪರಿಶೀಲನೆ ಮತ್ತು ಸಕ್ರಿಯ ಪ್ರತಿಕ್ರಿಯೆಗಾಗಿ ಸುಲಭ ಇಂಟರ್ಫೇಸ್.',
    'moderation.confirmCorrect': 'ಸರಿ ಎಂದು ದೃಢೀಕರಿಸಿ',
    'moderation.flagFP': 'ತಪ್ಪು ಎಚ್ಚರಿಕೆ (False Positive)',
    'moderation.flagFN': 'ತಪ್ಪಿದ ಹಾನಿ (False Negative)',
    'moderation.markAmbiguous': 'ಅಸ್ಪಷ್ಟ',

    // Evaluation
    'eval.title': 'ಮೌಲ್ಯಮಾಪನ ಇತಿಹಾಸ ಮತ್ತು ಸಂಶೋಧನಾ ಆಡಿಟ್',
    'eval.subtitle': 'ಪ್ರಕಟಣೆ ಮಟ್ಟದ ಸಂಶೋಧನಾ ವರದಿಗಳೊಂದಿಗೆ ಬಹುಭಾಷಾ ಪರೀಕ್ಷಾ ಸೆಟ್‌ಗಳಲ್ಲಿ ಮಾಡೆಲ್ ಬೆಂಚ್‌ಮಾರ್ಕ್ ಫಲಿತಾಂಶಗಳು.',
    'eval.downloadPdf': 'ಸಂಶೋಧನಾ ವರದಿ ಡೌನ್‌ಲೋಡ್ (PDF)',

    // Feedback
    'feedback.title': 'ಪ್ರತಿಕ್ರಿಯೆ ಮತ್ತು ದೋಷ ವಿಶ್ಲೇಷಣೆ',
    'feedback.subtitle': 'ಮಾದರಿ ತಪ್ಪು ವರ್ಗೀಕರಣಗಳು ಮತ್ತು ನಿರಂತರ ಸುಧಾರಣಾ ಮೆಟ್ರಿಕ್‌ಗಳನ್ನು ಟ್ರ್ಯಾಕ್ ಮಾಡಿ.',
    'feedback.falsePositives': 'ಫಾಲ್ಸ್ ಪಾಸಿಟಿವ್ಸ್',
    'feedback.falseNegatives': 'ಫಾಲ್ಸ್ ನೆಗೆಟಿವ್ಸ್',
    'feedback.ambiguous': 'ಅಸ್ಪಷ್ಟ ಪ್ರಕರಣಗಳು',
    'feedback.confirmed': 'ದೃಢಪಡಿಸಿದ ನಿಖರತೆ',

    // Profile Popover
    'profile.title': 'ಬಳಕೆದಾರರ ಪ್ರೊಫೈಲ್',
    'profile.email': 'ಇಮೇಲ್',
    'profile.role': 'ಪಾತ್ರ',
    'profile.joined': 'ಸೇರ್ಪಡೆಗೊಂಡ ದಿನಾಂಕ',
    'profile.preferredLang': 'ಆದ್ಯತೆಯ ಭಾಷೆ',
    'profile.edit': 'ಪ್ರೊಫೈಲ್ ಸಂಪಾದಿಸಿ',
  },
};
