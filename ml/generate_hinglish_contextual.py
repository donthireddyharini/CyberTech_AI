"""
Curated Hinglish Contextual & Conversational Diversity Dataset v2
Sentinel AI (CSEAIML2026-P03)
"""
import pandas as pd

HINGLISH_EXAMPLES = [
    # --- 1. DIRECT INSULTS & SEVERE PROFANITY (Harmful = 1.0, Legit = 0.0) ---
    ("tere baap ko bol saale kutte madarchod", "direct_insult", 1.0, 1.0, 0.0),
    ("tu ek number ka madarchod hai", "direct_insult", 1.0, 1.0, 0.0),
    ("saale kutte teri aukaat kya hai", "direct_insult", 1.0, 1.0, 0.0),
    ("harami insaan tera pura khandan chor hai", "direct_insult", 1.0, 1.0, 0.0),
    ("chup kar be saale kutte kamine", "direct_insult", 1.0, 1.0, 0.0),
    ("bhadwe chup chaap nikal le yahan se", "direct_insult", 1.0, 1.0, 0.0),
    ("gandu tere jaise roz aate hain", "direct_insult", 1.0, 1.0, 0.0),
    ("chutiye apna ganda dimag apne paas rakh", "direct_insult", 1.0, 1.0, 0.0),
    ("teri maa ki aankh saale haramkhor", "direct_insult", 1.0, 1.0, 0.0),
    ("tu aur tera khandan sab ke sab ghatiya hain", "direct_insult", 1.0, 1.0, 0.0),
    ("sharam kar be besharam kutte", "direct_insult", 0.0, 1.0, 0.0),
    ("chal nikal bhikhmange yahan se", "direct_insult", 1.0, 1.0, 0.0),
    ("bikhari kahin ke shakal dekhi hai apni", "direct_insult", 1.0, 1.0, 0.0),
    ("kutte ki maut marega tu harami", "direct_insult", 1.0, 1.0, 0.0),
    ("tu ek number ka fraud aur 420 chor hai", "direct_insult", 1.0, 1.0, 0.0),
    
    # --- 2. CONTEXTUAL THREATS & PHYSICAL INTIMIDATION (Harmful) ---
    ("tu dekh tera kya haal karta hoon main raste pe", "threat", 1.0, 1.0, 0.0),
    ("tujhe zinda nahi chhodenge hum log", "threat", 1.0, 1.0, 0.0),
    ("ghar se bahar nikal phir batata hoon tereko", "threat", 1.0, 1.0, 0.0),
    ("tera aakhri din hai aaj samjha na", "threat", 1.0, 1.0, 0.0),
    ("tere ghar aake marunga tu bas wait kar", "threat", 1.0, 1.0, 0.0),
    ("tujhe toh sadak pe ghasit kar marenge", "threat", 1.0, 1.0, 0.0),
    ("jaan se maar dunga agar dobara bola toh", "threat", 1.0, 1.0, 0.0),
    ("tere haath pair tod ke bhejunga ghar", "threat", 1.0, 1.0, 0.0),
    ("tujhe police bhi nahi bacha payegi dekh lena", "threat", 1.0, 1.0, 0.0),
    ("saamne mil phir dekhta hoon kitna dum hai tere mein", "threat", 1.0, 1.0, 0.0),
    ("tu raste pe mil tereko batata hoon", "threat", 1.0, 1.0, 0.0),
    
    # --- 3. TARGETED HUMILIATION, HARASSMENT & CLASS ABUSE (Harmful) ---
    ("is bikhari ko yahan se bhagao, koi izzat nahi hai iski", "humiliation", 1.0, 1.0, 0.0),
    ("ye bikhari log yahan kyun aa jaate hain bhagao inko", "humiliation", 1.0, 1.0, 0.0),
    ("apne gande chehre ke saath yahan mat aaya kar", "humiliation", 0.0, 1.0, 0.0),
    ("teri jaisi ghatiya ladki ko sabak sikhana padega", "humiliation", 1.0, 1.0, 0.0),
    ("tu bas internet pe bhonk sakta hai samne aana dum hai toh", "humiliation", 0.0, 1.0, 0.0),
    ("shut up you worthless trash tu kisi kaam ka nahi hai", "humiliation", 0.0, 1.0, 0.0),
    ("tereko dekh ke ulti aati hai itna ghatiya insaan", "humiliation", 0.0, 1.0, 0.0),
    ("teri aukaat do kaudi ki nahi hai aur badi baatein kar raha hai", "humiliation", 1.0, 1.0, 0.0),
    ("apni aukaat mein reh samjha na do takey ke aadmi", "humiliation", 1.0, 1.0, 0.0),
    ("tujhe kisne paida kiya itna ghatiya namoona", "humiliation", 0.0, 1.0, 0.0),
    ("teri shakal dekh ke kutte bhi bhonkna band kar dete hain", "humiliation", 0.0, 1.0, 0.0),
    ("tu aur tera opinion dono gutter ke kachre hain", "humiliation", 0.0, 1.0, 0.0),
    ("tujhe kisi ne baat karne ki tameez nahi sikhayi kya loser", "humiliation", 0.0, 1.0, 0.0),
    ("iski koi izzat nahi hai society mein kachra aadmi", "humiliation", 1.0, 1.0, 0.0),
    
    # --- 4. DEHUMANIZATION & HATE ATTACKS (Harmful) ---
    ("tujh jaise logo ko zinda rehne ka koi haq nahi", "dehumanization", 1.0, 1.0, 0.0),
    ("desh ke gaddar tum log sabko khatam karna chahiye", "dehumanization", 1.0, 1.0, 0.0),
    ("tum jaise kide makode marne layak ho", "dehumanization", 1.0, 1.0, 0.0),
    ("tum log iss desh par bojh ho nikal jao yahan se", "dehumanization", 1.0, 1.0, 0.0),
    ("aise logon ko zinda jala dena chahiye", "dehumanization", 1.0, 1.0, 0.0),
    ("gandi naali ke keede ho tum sab ke sab", "dehumanization", 1.0, 1.0, 0.0),
    
    # --- 5. CIVIL CONTROLS, NEGATION, POLITE REQUESTS & DEBATE (Legitimate = 1.0) ---
    ("kya aap meri madad kar sakte hain?", "civil_request", 0.0, 0.0, 1.0),
    ("main kisi ko gaali nahi dena chahta", "civil_negation", 0.0, 0.0, 1.0),
    ("hume kisi ko gaali nahi deni chahiye shanti rakho", "civil_negation", 0.0, 0.0, 1.0),
    ("kripya karke yahan gaali mat do bhai", "civil_negation", 0.0, 0.0, 1.0),
    ("bhai ye kya kar raha hai, bilkul samajh nahi aa raha yaar.", "civil_colloquial", 0.0, 0.0, 1.0),
    ("tu pagal hai kya itna accha kaam kaise kiya", "friendly_banter", 0.0, 0.0, 1.0),
    ("bhai tu pagal hai kya itna mast surprise diya", "friendly_banter", 0.0, 0.0, 1.0),
    ("ye film bilkul ghatiya thi par actors acche the", "neutral_review", 0.0, 0.0, 1.0),
    ("aaj ka match bohot mast tha maza aa gaya", "civil_social", 0.0, 0.0, 1.0),
    ("thanks bhai for your support", "civil_greeting", 0.0, 0.0, 1.0),
    ("please send me the notes whenever you are free", "civil_request", 0.0, 0.0, 1.0),
    ("bhai kal milte hain chai pe sham ko", "civil_social", 0.0, 0.0, 1.0),
    ("mujhe lagta hai ye logic galat hai, doosra approach try karo", "neutral_criticism", 0.0, 0.0, 1.0),
    ("yeh gana sunke sach mein dil khush ho gaya yaar", "civil_social", 0.0, 0.0, 1.0),
    ("aapki baat se agree nahi karta lekin points interesting hain", "neutral_criticism", 0.0, 0.0, 1.0),
    ("hum sab ko milkar issue solve karna chahiye", "civil_request", 0.0, 0.0, 1.0),
    ("bhai congratulations for your new job, party kab de raha hai", "civil_social", 0.0, 0.0, 1.0),
    ("kya aap mujhe bata sakte hain office ka rasta kahan hai?", "civil_request", 0.0, 0.0, 1.0),
    ("hum kisi se ladai nahi chahte, shanti se baat karo please", "civil_negation", 0.0, 0.0, 1.0),
    ("aaj office mein bohot kaam tha thak gaya hoon", "civil_social", 0.0, 0.0, 1.0),
    ("yeh project time pe complete ho gaya, thank you team", "civil_greeting", 0.0, 0.0, 1.0),
    ("bhai tu toh hero nikla, maza dila diya", "friendly_banter", 0.0, 0.0, 1.0),
    ("khana bohot swadist tha, mummy ko thanks bolna", "civil_social", 0.0, 0.0, 1.0),
    ("traffic bohot zyada hai main 15 minute late pahunchunga", "civil_social", 0.0, 0.0, 1.0),
    ("bhai tension mat le sab theek ho jayega", "civil_social", 0.0, 0.0, 1.0),
    ("sir please review this pull request whenever you have time", "civil_request", 0.0, 0.0, 1.0),
    ("koi baat nahi dost, next time better karenge", "civil_social", 0.0, 0.0, 1.0),
    ("kya kal college mein holiday hai kya?", "civil_request", 0.0, 0.0, 1.0),
    ("code mein thoda syntax error hai par logic perfectly fine hai", "neutral_criticism", 0.0, 0.0, 1.0),
    ("yeh book sach mein padhne layak hai", "neutral_review", 0.0, 0.0, 1.0),
    ("main aapke opinion ka respect karta hoon", "civil_greeting", 0.0, 0.0, 1.0),
    ("dhanyawad aapka bahut bahut", "civil_greeting", 0.0, 0.0, 1.0),
    ("weather aaj kaafi pleasant hai walk pe chalein?", "civil_social", 0.0, 0.0, 1.0),
    ("mujhe lagta hai thoda aur research karna padega is topic pe", "neutral_criticism", 0.0, 0.0, 1.0),
    ("aap please gussa mat hoiye, mistake ho gayi thi", "civil_negation", 0.0, 0.0, 1.0),
    ("aapka presentation bahut clear and concise tha", "civil_greeting", 0.0, 0.0, 1.0),
    ("chalo milkar kaam karte hain", "civil_social", 0.0, 0.0, 1.0),
    ("safe journey bhai acche se pahuncho", "civil_greeting", 0.0, 0.0, 1.0),
    ("mere paas iska answer nahi hai, google check karlo", "civil_social", 0.0, 0.0, 1.0),
    ("aapki family kaisi hai sab theek hain?", "civil_greeting", 0.0, 0.0, 1.0),
    ("yeh policy sabke fayde ke liye banayi gayi hai", "neutral_review", 0.0, 0.0, 1.0),
    ("main aapse kal subah baat karta hoon", "civil_social", 0.0, 0.0, 1.0),
    ("bhai weekend ka kya plan hai?", "civil_social", 0.0, 0.0, 1.0)
]

rows = []
for text, cat, hate, har, legit in HINGLISH_EXAMPLES:
    rows.append({
        "text": text,
        "language": "hinglish",
        "category": cat,
        "is_code_mixed": True,
        "source_dataset": "sentinel_hinglish_contextual_v2",
        "split": "train",
        "hate_speech": hate,
        "harassment": har,
        "cyberbullying": 0.0,
        "legitimate": legit
    })

df = pd.DataFrame(rows)
output_path = "data/processed/indic/hinglish_supplementary_context.csv"
df.to_csv(output_path, index=False, encoding="utf-8")
print(f"Generated {len(df)} Hinglish contextual samples:")
print(f"  Harmful: {(df['legitimate']==0.0).sum()}")
print(f"  Legitimate: {(df['legitimate']==1.0).sum()}")
print(f"Saved to {output_path}")
