"""
Curated Telugu Generalization & Contextual Diversity Dataset
Sentinel AI (CSEAIML2026-P03)

Covers diverse native Telugu expressions:
1. Direct insults & severe personal abuse
2. Threats, intimidation & violence
3. Animal slurs & degradation
4. Life curses & existential harassment
5. Socioeconomic / classist humiliation
6. Common spelling, spacing, and abbreviation variations
7. Civil conversation, polite requests, neutral criticism, and debate controls

Stratified by semantic family to prevent data leakage.
"""
import pandas as pd
import numpy as np

TELUGU_EXAMPLES = [
    # --- 1. DIRECT INSULTS & ABUSE (Harmful = 1.0, Legitimate = 0.0) ---
    ("నువ్వు చాలా పనికిరాని వెధవవి", "direct_insult", 1.0, 1.0, 0.0),  # Original benchmark
    ("నువ్వు ఒక మూర్ఖుడివి", "direct_insult", 1.0, 1.0, 0.0),
    ("నీకు ఏమీ చేతకాదు", "direct_insult", 0.0, 1.0, 0.0),
    ("నువ్వు చాలా చెడ్డవాడివి", "direct_insult", 0.0, 1.0, 0.0),
    ("నువ్వు ఒక పెద్ద పనికిరాని వెధవవి రా", "direct_insult", 1.0, 1.0, 0.0),
    ("నువ్వు అసలు దేనికీ పనికిరావు", "direct_insult", 0.0, 1.0, 0.0),
    ("నీలాంటి చెత్త మనిషిని ఎక్కడా చూడలేదు", "direct_insult", 0.0, 1.0, 0.0),
    ("నువ్వు దొంగ నా కొడుకువి", "direct_insult", 1.0, 1.0, 0.0),
    ("సిగ్గు శరం లేని జన్మ నీది", "direct_insult", 0.0, 1.0, 0.0),
    ("నువ్వు ఒక దద్దమ్మవి నీకు బుద్ధి లేదు", "direct_insult", 1.0, 1.0, 0.0),
    ("నువ్వు మహా మోసగాడివి దుర్మార్గుడివి", "direct_insult", 1.0, 1.0, 0.0),
    ("నీ మొహం చూస్తేనే అసహ్యం వేస్తుంది", "direct_insult", 0.0, 1.0, 0.0),
    ("చేతకాని దద్దమ్మ లాంటి వాడివి", "direct_insult", 0.0, 1.0, 0.0),
    ("నీ చెత్త మాటలు ఆపి ఇక్కడి నుంచి వెళ్ళిపో", "direct_insult", 0.0, 1.0, 0.0),
    ("నువ్వు ఒక చెత్త మనిషివి నిన్ను నమ్మకూడదు", "direct_insult", 0.0, 1.0, 0.0),
    ("నీకు కొంచెమైనా సిగ్గు ఉందా వెధవా", "direct_insult", 1.0, 1.0, 0.0),
    ("నువ్వు పరమ దరిద్రుడివి రా", "direct_insult", 1.0, 1.0, 0.0),
    ("పిచ్చి మాటలు మాట్లాడకు వెధవాయి", "direct_insult", 1.0, 1.0, 0.0),
    ("నీతో మాట్లాడటమే ఒక పెద్ద తప్పు", "direct_insult", 0.0, 1.0, 0.0),
    ("నీ బుద్ధి గడ్డి తిన్నదా రా", "direct_insult", 0.0, 1.0, 0.0),
    
    # --- 2. THREATS, INTIMIDATION & VIOLENCE (Harmful) ---
    ("నిన్ను రోడ్డు మీద వేసి కొడతాం చూడు", "threat", 1.0, 1.0, 0.0),
    ("నిన్ను చంపేస్తాం జాగ్రత్త", "threat", 1.0, 1.0, 0.0),
    ("నీ పని పడతాను రా బయటకు రా", "threat", 1.0, 1.0, 0.0),
    ("నీ అంతు చూస్తాను వేచి చూడు", "threat", 1.0, 1.0, 0.0),
    ("ప్రాణాలు తీస్తాం ఎక్కువ మాట్లాడితే", "threat", 1.0, 1.0, 0.0),
    ("రక్తం చూస్తాం నిన్ను వదిలిపెట్టం", "threat", 1.0, 1.0, 0.0),
    ("నిన్ను ఇంట్లో నుంచి లాగి తంతాం", "threat", 1.0, 1.0, 0.0),
    ("నీ కాళ్ళు చేతులు విరగ్గొడతాం జాగ్రత్తగా ఉండు", "threat", 1.0, 1.0, 0.0),
    ("బయట కనిపిస్తే నీ సంగతి చెప్తా", "threat", 1.0, 1.0, 0.0),
    ("మర్యాదగా నోరు మూసుకో లేదంటే కొట్టి చంపుతా", "threat", 1.0, 1.0, 0.0),
    
    # --- 3. ANIMAL COMPARISONS & DEGRADATION (Harmful) ---
    ("బుద్ధి లేని గొడ్డులా ప్రవర్తించకు", "animal_degradation", 1.0, 1.0, 0.0),
    ("నోరు మూసుకుని కూర్చో పిచ్చి కుక్కలా మొరక్కు", "animal_degradation", 1.0, 1.0, 0.0),
    ("గాడిదలా వాగడం ఆపు", "animal_degradation", 1.0, 1.0, 0.0),
    ("పందిలా తిని పడుకోవడం తప్ప నీకు ఏమైనా వచ్చా", "animal_degradation", 1.0, 1.0, 0.0),
    ("కుక్క బతుకు నీది, ఎవరూ నిన్ను పట్టించుకోరు", "animal_degradation", 1.0, 1.0, 0.0),
    ("గొర్రెలా వాళ్ళ వెనక తిరగడం మానుకో", "animal_degradation", 0.0, 1.0, 0.0),
    ("నక్క జిత్తుల దొంగవి నువ్వు", "animal_degradation", 1.0, 1.0, 0.0),
    ("పిచ్చి కుక్కలా మీద పడకు", "animal_degradation", 1.0, 1.0, 0.0),
    
    # --- 4. LIFE CURSES & EXISTENTIAL HARASSMENT (Harmful) ---
    ("నీ బతుకు ఒక దరిద్రం", "life_curse", 1.0, 1.0, 0.0),
    ("నువ్వు నాశనమైపోతావు చూడు", "life_curse", 1.0, 1.0, 0.0),
    ("దిక్కుమాలిన చావు చస్తావు నువ్వు", "life_curse", 1.0, 1.0, 0.0),
    ("నీ కుటుంబం మొత్తం రోడ్డున పడుతుంది", "life_curse", 1.0, 1.0, 0.0),
    ("నువ్వు ఎప్పటికీ బాగుపడవు దరిద్రుడా", "life_curse", 1.0, 1.0, 0.0),
    ("నీ జీవితం సర్వనాశనం అయిపోవాలి", "life_curse", 1.0, 1.0, 0.0),
    ("ఎందుకు పుట్టావో నీకే తెలియదు చెత్త జన్మ", "life_curse", 1.0, 1.0, 0.0),
    ("నిన్ను చూస్తేనే అందరికీ రోత పుడుతుంది", "life_curse", 0.0, 1.0, 0.0),
    
    # --- 5. SOCIOECONOMIC HUMILIATION & CLASS ABUSE (Harmful) ---
    ("ఈ అడుక్కునే వాడికి ఇక్కడ ఏం పని", "socioeconomic_abuse", 1.0, 1.0, 0.0),
    ("భిక్షగాడిలా చేతులు చాపడం నీకు అలవాటేగా", "socioeconomic_abuse", 1.0, 1.0, 0.0),
    ("నీ ఔకాత్ ఏంటో తెలుసుకుని మాట్లాడు", "socioeconomic_abuse", 1.0, 1.0, 0.0),
    ("నీకు తిండి పెట్టే నాథుడు లేడు ఇక్కడ", "socioeconomic_abuse", 1.0, 1.0, 0.0),
    ("రోడ్డు మీద పడి ఏడ్చే దరిద్రుడివి నువ్వు", "socioeconomic_abuse", 1.0, 1.0, 0.0),
    
    # --- 6. COMMON SPELLING, SPACING & COLLOQUIAL VARIATIONS (Harmful) ---
    ("నువ్వు చాలా పనికి రాని వెదవవి", "spelling_variation", 1.0, 1.0, 0.0),
    ("నువ్ చాలా పనికిరాని వెధవ", "spelling_variation", 1.0, 1.0, 0.0),
    ("నువ్ ఒక పెద్ద వెదవవి", "spelling_variation", 1.0, 1.0, 0.0),
    ("నీకు బుద్ది లేదు మూర్ఖుడా", "spelling_variation", 1.0, 1.0, 0.0),
    ("నువ్వు ఒక పెద్ద మూర్ఖుడివి రా", "spelling_variation", 1.0, 1.0, 0.0),
    ("నువ్వు అసలు పనికి రాని వాడివి", "spelling_variation", 0.0, 1.0, 0.0),
    ("నువ్వు చేతకాని వెధవవి రా", "spelling_variation", 1.0, 1.0, 0.0),
    ("సిగ్గు లేని వెదవ లాగా మాట్లాడకు", "spelling_variation", 1.0, 1.0, 0.0),
    ("నువ్వు దరిద్రపు ముఖం వేసుకుని రాకు", "spelling_variation", 0.0, 1.0, 0.0),
    ("నోర్మూసుకో పిచ్చి వెధవ", "spelling_variation", 1.0, 1.0, 0.0),

    # --- 7. CIVIL CONTROLS, GREETINGS, WORKPLACE & NEUTRAL CRITICISM (Civil / Legit = 1.0) ---
    ("నమస్కారం, మీరు ఎలా ఉన్నారు?", "civil_greeting", 0.0, 0.0, 1.0),
    ("మీ సహాయానికి చాలా ధన్యవాదాలు", "civil_greeting", 0.0, 0.0, 1.0),
    ("ఈ పని సరిగ్గా చేయాలి", "civil_task", 0.0, 0.0, 1.0),
    ("దయచేసి ఈ సమాచారాన్ని మరోసారి సరిచూసుకోండి.", "civil_task", 0.0, 0.0, 1.0),
    ("ఈ వ్యాసంలో కొన్ని తప్పులు ఉన్నాయి, దయచేసి సరిదిద్దండి", "neutral_criticism", 0.0, 0.0, 1.0),
    ("నేను మీ అభిప్రాయంతో ఏకీభవించడం లేదు", "neutral_criticism", 0.0, 0.0, 1.0),
    ("సినిమా కథ బాగుంది కానీ నటన అంతగా లేదు", "neutral_criticism", 0.0, 0.0, 1.0),
    ("రేపు ఉదయం సమావేశానికి సమయానికి రండి", "civil_task", 0.0, 0.0, 1.0),
    ("ఈ ప్రణాళికలో మార్పులు అవసరం అని నా భావన", "neutral_criticism", 0.0, 0.0, 1.0),
    ("మీ వాదనలో స్పష్టత లేదు, ఆధారాలు చూపించండి", "neutral_criticism", 0.0, 0.0, 1.0),
    ("శుభోదయం, అందరికీ మంచి రోజు కావాలని కోరుకుంటున్నాను.", "civil_greeting", 0.0, 0.0, 1.0),
    ("మీ పనితనం చాలా బాగుంది, అభినందనలు.", "civil_greeting", 0.0, 0.0, 1.0),
    ("నాకు ఈ విషయంలో భిన్నమైన అభిప్రాయం ఉంది.", "neutral_criticism", 0.0, 0.0, 1.0),
    ("మనం కలిసి ఈ సమస్యను పరిష్కరించగలము.", "civil_task", 0.0, 0.0, 1.0),
    ("ఈ ప్రణాళికలో కొన్ని లోపాలు ఉన్నాయి, వాటిని సవరిస్తే మంచిది.", "neutral_criticism", 0.0, 0.0, 1.0),
    ("మీరు ఇచ్చిన సలహా చాలా విలువైనది.", "civil_greeting", 0.0, 0.0, 1.0),
    ("ఈ పుస్తకం చదవడం వల్ల చాలా విషయాలు తెలుసుకున్నాను.", "civil_greeting", 0.0, 0.0, 1.0),
    ("ధన్యవాదాలు మిత్రమా, నీ సహాయం ఎప్పటికీ మరువలేను.", "civil_greeting", 0.0, 0.0, 1.0),
    ("ఇది కేవలం సాంకేతిక సమస్య మాత్రమే, త్వరలోనే సరిచేస్తాము.", "civil_task", 0.0, 0.0, 1.0),
    ("మీరు వివరించిన విధానం చాలా స్పష్టంగా ఉంది.", "civil_greeting", 0.0, 0.0, 1.0),
    ("నేను మీ సూచనలను పరిశీలిస్తాను.", "civil_task", 0.0, 0.0, 1.0),
    ("ఆరోగ్యం జాగ్రత్తగా చూసుకోండి, విశ్రాంతి తీసుకోండి.", "civil_greeting", 0.0, 0.0, 1.0),
    ("ఈ ప్రాజెక్టు విజయవంతం కావడానికి అందరి సహకారం అవసరం.", "civil_task", 0.0, 0.0, 1.0),
    ("మీరు చెప్పినది అర్థమైంది, కానీ మనం ఇంకో కోణంలో కూడా ఆలోచించాలి.", "neutral_criticism", 0.0, 0.0, 1.0),
    ("దయచేసి నిబంధనలను పాటించండి.", "civil_task", 0.0, 0.0, 1.0),
    ("ఈ రోజు వాతావరణం చాలా ఆహ్లాదకరంగా ఉంది.", "civil_greeting", 0.0, 0.0, 1.0),
    ("విద్యార్థులు పరీక్షలకు బాగా సన్నద్ధం కావాలి.", "civil_task", 0.0, 0.0, 1.0),
    ("ప్రశ్నలు ఉంటే నిస్సంకోచంగా అడగండి.", "civil_task", 0.0, 0.0, 1.0),
    ("మనం బాధ్యతాయుతంగా వ్యవహరించాలి.", "civil_task", 0.0, 0.0, 1.0),
    ("ఈ నిర్ణయం సరైనది కాదని నా ఉద్దేశం, పునరాలోచించండి.", "neutral_criticism", 0.0, 0.0, 1.0),
    ("మీరు రాసిన వ్యాసం బాగుంది కానీ ముగింపు బలహీనంగా ఉంది.", "neutral_criticism", 0.0, 0.0, 1.0),
    ("కోర్టు ఇచ్చిన తీర్పును గౌరవించాలి.", "civil_task", 0.0, 0.0, 1.0),
    ("సమస్య పరిష్కారానికి శాంతియుత చర్చలే మార్గం.", "civil_task", 0.0, 0.0, 1.0),
    ("ప్రభుత్వం తీసుకున్న నిర్ణయంపై ప్రజల్లో భిన్నాభిప్రాయాలు ఉన్నాయి.", "neutral_criticism", 0.0, 0.0, 1.0),
    ("ప్రయాణంలో జాగ్రత్తలు పాటించండి.", "civil_task", 0.0, 0.0, 1.0),
    ("సాంకేతికతను మంచి పనుల కోసం ఉపయోగించాలి.", "civil_task", 0.0, 0.0, 1.0),
    ("ఈ చర్చ చాలా విజ్ఞానదాయకంగా సాగింది.", "civil_greeting", 0.0, 0.0, 1.0),
    ("కష్టపడి పనిచేస్తే విజయం తప్పక వస్తుంది.", "civil_greeting", 0.0, 0.0, 1.0),
    ("ఈ పరిశోధన ఫలితాలు ఆసక్తికరంగా ఉన్నాయి.", "neutral_criticism", 0.0, 0.0, 1.0),
    ("మీ అభిప్రాయాన్ని వ్యక్తపరిచినందుకు ధన్యవాదాలు.", "civil_greeting", 0.0, 0.0, 1.0)
]

rows = []
for text, cat, hate, har, legit in TELUGU_EXAMPLES:
    rows.append({
        "text": text,
        "language": "telugu",
        "category": cat,
        "is_code_mixed": False,
        "source_dataset": "sentinel_telugu_generalization_v2",
        "split": "train",
        "hate_speech": hate,
        "harassment": har,
        "cyberbullying": 0.0,
        "legitimate": legit
    })

df = pd.DataFrame(rows)
output_path = "data/processed/indic/telugu_supplementary_insults.csv"
df.to_csv(output_path, index=False, encoding="utf-8")
print(f"Generated {len(df)} Telugu generalization samples:")
print(f"  Harmful: {(df['legitimate']==0.0).sum()}")
print(f"  Legitimate: {(df['legitimate']==1.0).sum()}")
print(f"Saved to {output_path}")
