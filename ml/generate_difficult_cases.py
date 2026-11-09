"""
Curated supplementary dataset of difficult and nuanced moderation examples.
Used to calibrate multi-category classification for:
- Harmless compliments
- Normal criticism & policy disagreement (NOT harassment)
- Friendly teasing & banter (NOT harassment)
- Direct insults & personal attacks (HARASSMENT)
- Targeted harassment & intimidation (HARASSMENT)
- Hate speech (IDENTITY ATTACK)
- Cyberbullying & Threats (CYBERBULLYING)
"""
import pandas as pd
import os

DIFFICULT_CASES = [
    # ── Harmless Compliments & Civil Feedback ──
    {"text": "Great recipe, absolutely loved the detailed steps!", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "Thank you for sharing this informative video.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "Awesome work, really enjoyed watching this tutorial!", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "Clear explanation and very well structured presentation.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "I really appreciate you taking the time to explain this in detail.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "Wonderful content as always, looking forward to the next part.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "Excellent breakdown of the topic, helped me understand a lot.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "Love the positive energy in your videos!", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},

    # ── Normal Criticism & Opinion Disagreement (NOT Harassment) ──
    {"text": "I strongly disagree with your political opinion here.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "This policy is completely wrong and your economic reasoning makes no sense.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "I didn't like this movie, the plot was boring and the pacing was terrible.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "The code in this repository has serious architectural flaws and memory leaks.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "This is bad financial advice and people should be very careful.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "Your argument is factually incorrect according to the latest research paper.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "I think this product is overpriced for the features it offers.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "I have to disagree, the previous version of the software was much more intuitive.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "Your methodology has significant sample bias that undermines your conclusion.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "I don't think this strategy will work in real production environments.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},

    # ── Friendly Teasing / Colloquial Banter (NOT Harassment, NOT Hate Speech) ──
    {"text": "Nice troll", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "Haha you are such a nerd", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "Bro thought he cooked with this one 💀", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "Look at this boomer trying to understand modern memes 😂", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "Nice try grandpa, maybe next time!", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "Haha typical developer excuses, it works on my machine right?", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "You are crazy man, who even does that! 😂", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},

    # ── Direct Insults & Personal Attacks (HARASSMENT) ──
    {"text": "Shut up you idiot", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},
    {"text": "You are completely useless and pathetic person", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},
    {"text": "Go away loser nobody cares about you", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},
    {"text": "You are a fraud, a thief, and a habitual liar", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},
    {"text": "You are disgusting and should disappear forever", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},
    {"text": "You are an ugly clown with zero talent", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},
    {"text": "Nobody likes you, you are absolute garbage", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},
    {"text": "Stop embarrassing yourself, you stupid moron", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},
    {"text": "You are the dumbest person on this entire platform", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},
    {"text": "What a pathetic excuse for a human being", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},
    {"text": "You are an obnoxious piece of trash", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},
    {"text": "Get lost you incompetent fool, you ruin everything you touch", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},
    {"text": "You are completely delusional and brainless", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},

    # ── Targeted Harassment & Intimidation (HARASSMENT) ──
    {"text": "I will make sure your career is destroyed", "hate_speech": 0, "harassment": 1, "cyberbullying": 1, "legitimate": 0},
    {"text": "Everyone in this forum is going to report and ruin you", "hate_speech": 0, "harassment": 1, "cyberbullying": 1, "legitimate": 0},
    {"text": "We will keep messaging you everywhere until you delete your account", "hate_speech": 0, "harassment": 1, "cyberbullying": 1, "legitimate": 0},
    {"text": "You won't be able to show your face anywhere after this", "hate_speech": 0, "harassment": 1, "cyberbullying": 1, "legitimate": 0},
    {"text": "I'm going to expose all your private information and humiliate you", "hate_speech": 0, "harassment": 1, "cyberbullying": 1, "legitimate": 0},

    # ── Hate Speech (Targeted Identity Attacks on Protected Groups) ──
    {"text": "All Muslims should be deported from our country", "hate_speech": 1, "harassment": 0, "cyberbullying": 0, "legitimate": 0},
    {"text": "Dalits and lower castes are dirty and don't belong in polite society", "hate_speech": 1, "harassment": 0, "cyberbullying": 0, "legitimate": 0},
    {"text": "Women are inferior and should not be allowed to work or vote", "hate_speech": 1, "harassment": 0, "cyberbullying": 0, "legitimate": 0},
    {"text": "Filthy immigrants are ruining our nation, kick them all out", "hate_speech": 1, "harassment": 0, "cyberbullying": 0, "legitimate": 0},
    {"text": "All Jews are parasites and control everything behind the scenes", "hate_speech": 1, "harassment": 0, "cyberbullying": 0, "legitimate": 0},
    {"text": "Black people are criminals and should all be locked up", "hate_speech": 1, "harassment": 0, "cyberbullying": 0, "legitimate": 0},

    # ── Cyberbullying & Severe Threats (THREATS / SEVERE HARM) ──
    {"text": "You deserve to die and I will ruin you.", "hate_speech": 0, "harassment": 1, "cyberbullying": 1, "legitimate": 0},
    {"text": "I will find you and make your life hell", "hate_speech": 0, "harassment": 1, "cyberbullying": 1, "legitimate": 0},
    {"text": "Go kill yourself, nobody in this world will ever miss you", "hate_speech": 0, "harassment": 1, "cyberbullying": 1, "legitimate": 0},
    {"text": "I know where you live and I'm coming to hurt you", "hate_speech": 0, "harassment": 1, "cyberbullying": 1, "legitimate": 0},
    {"text": "I will shoot you if you ever show up here again", "hate_speech": 0, "harassment": 1, "cyberbullying": 1, "legitimate": 0},

    # ── Hindi Civil Compliments & Constructive Feedback (LEGITIMATE) ──
    {"text": "आपने बहुत अच्छी जानकारी साझा की है। धन्यवाद।", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "बहुत ही सुंदर और ज्ञानवर्धक वीडियो, बहुत बहुत शुक्रिया।", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "मुझे आपका यह तरीका बहुत पसंद आया, शानदार प्रस्तुति।", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "बहुत अच्छा काम किया आपने, ऐसे ही आगे बढ़ते रहें।", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "मैं आपके इस विचार से सहमत नहीं हूँ लेकिन आपकी बात का सम्मान करता हूँ।", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "यह नीति सही नहीं है और हमें इस पर पुनर्विचार करना चाहिए।", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "क्या आप इस विषय पर और विस्तार से समझा सकते हैं?", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},

    # ── Hindi Insults & Harassment (HARASSMENT) ──
    {"text": "तू बहुत ही घटिया इंसान है, यहां से निकल जा", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},
    {"text": "तुम्हें कुछ भी नहीं आता, तुम्हारी बात कोई नहीं सुनना चाहता।", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},
    {"text": "बेवकूफ और जाहिल इंसान, अपना मुंह बंद रख।", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},
    {"text": "तेरी कोई औकात नहीं है, चुपचाप बैठ जा।", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},
    {"text": "शर्म करो कुछ, कितने गिरे हुए इंसान हो तुम।", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},

    # ── Telugu Civil Compliments & Feedback (LEGITIMATE) ──
    {"text": "చాలా మంచి సమాచారం పంచుకున్నారు. ధన్యవాదాలు.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "మీ వివరణ చాలా బాగుంది, ధన్యవాదాలు!", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "చాలా స్పష్టంగా అర్థమయ్యేలా చెప్పారు, కృతజ్ఞతలు.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "నేను మీ అభిప్రాయంతో విభేదిస్తున్నాను కానీ మీ శ్రమను గౌరవిస్తాను.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "నువ్వు చాలా మంచివాడివి, నీ సహాయం చాలా బాగుంది.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "నువ్వు చాలా బాగా చెప్పావు, నీ వివరణ అద్భుతంగా ఉంది.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "నీ సహాయానికి చాలా కృతజ్ఞతలు, నువ్వు చాలా గొప్ప వ్యక్తివి.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "నువ్వు నా మంచి స్నేహితుడివి, నీకు నా ధన్యవాదాలు.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "నువ్వు చేసిన పని చాలా బాగుంది, నీ ప్రయత్నం ప్రశంసనీయం.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "నువ్వు చాలా తెలివైనవాడివి, నీ ఆలోచన బాగుంది.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "nuvvu chala manchivadivi, nee sahayam chala bagundi", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},

    # ── Telugu Insults & Harassment (HARASSMENT) ──
    {"text": "నీకు ఏమీ తెలియదు, నీ మాటలు ఎవరికీ అవసరం లేదు.", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},
    {"text": "నువ్వు చాలా పనికిరాని వెధవవి, ఇక్కడి నుంచి వెళ్ళిపో.", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},
    {"text": "నువ్వు ఒక పనికిరాని వెధవ.", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},
    {"text": "nuvvu oka panikirani vedhava", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},

    # ── Kannada Civil & Compliments (LEGITIMATE) ──
    {"text": "ನೀವು ತುಂಬಾ ಚೆನ್ನಾಗಿ ವಿವರಿಸಿದ್ದೀರಿ. ಧನ್ಯವಾದಗಳು.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "ನಿಮ್ಮ ಮಾಹಿತಿ ತುಂಬಾ ಉಪಯುಕ್ತವಾಗಿದೆ, ಧನ್ಯವಾದಗಳು.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "ನೀನು ತುಂಬಾ ಒಳ್ಳೆಯ ವ್ಯಕ್ತಿ, ನಿನ್ನ ಸಹಾಯಕ್ಕೆ ಧನ್ಯವಾದಗಳು.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},

    # ── Kannada Insults & Harassment (HARASSMENT) ──
    {"text": "ನಿನಗೆ ಏನೂ ಗೊತ್ತಿಲ್ಲ, ನೀನು ಮೂರ್ಖ.", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},

    # ── Hinglish Civil & Compliments (LEGITIMATE) ──
    {"text": "Bahut achha explanation diya, thank you!", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "Bhai tune bahut accha kaam kiya hai, thanks a lot.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},

    # ── Hinglish Insults & Harassment (HARASSMENT) ──
    {"text": "Tu bilkul bekaar hai, tujhe kuch nahi aata.", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},

    # ── English Exact Benchmark Compliments & Insults ──
    {"text": "Thank you for your help. You explained everything very clearly.", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "You are a useless idiot. Nobody wants to hear you.", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},

    # ── Hindi Casual Pronoun Civil & Insult ──
    {"text": "तुम बहुत अच्छे इंसान हो, तुम्हारी मदद के लिए शुक्रिया।", "hate_speech": 0, "harassment": 0, "cyberbullying": 0, "legitimate": 1},
    {"text": "तुम बिल्कुल बेकार इंसान हो।", "hate_speech": 0, "harassment": 1, "cyberbullying": 0, "legitimate": 0},
]

out_path = os.path.join(os.path.dirname(__file__), "..", "data", "processed", "difficult_moderation_cases.csv")
pd.DataFrame(DIFFICULT_CASES).to_csv(out_path, index=False)
print(f"Saved {len(DIFFICULT_CASES)} difficult moderation examples to {out_path}")
