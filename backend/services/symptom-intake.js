function normalizeReplyText(text = '') {
    return String(text || '')
        .replace(/[?!.।,]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

const AGE_UNIT_PATTERN = '(?:years?\\s*old|yrs?\\s*old|years?|yrs?|yo|y\\/o|saal|साल|varsh|वर्ष|বছর|வயது|సంవత్సరాలు|ವರ್ಷ|വയസ്സ്|ਸਾਲ|ବର୍ଷ|વર્ષ|वर्ष)';
const AGE_LABEL_PATTERN = '(?:age|umr|umar|उम्र|বয়স|வயது|వయస్సు|ವಯಸ್ಸು|പ്രായം|ਉਮਰ|ବୟସ|ઉંમર)';

/* ─── Gender word map (multi-language lookup) ─── */
const GENDER_WORD_MAP = {
    // English
    'male': 'male', 'man': 'male', 'boy': 'male', 'gentleman': 'male',
    'female': 'female', 'woman': 'female', 'girl': 'female', 'lady': 'female',
    'other': 'other', 'transgender': 'other', 'others': 'other',
    // Hindi
    'पुरुष': 'male', 'पुरष': 'male', 'मर्द': 'male', 'आदमी': 'male',
    'लड़का': 'male', 'भाई': 'male', 'मेल': 'male',
    'महिला': 'female', 'औरत': 'female', 'लड़की': 'female', 'स्त्री': 'female', 'फीमेल': 'female',
    'अन्य': 'other',
    // Romanized Hindi/Hinglish
    'mard': 'male', 'aadmi': 'male', 'ladka': 'male',
    'mahila': 'female', 'aurat': 'female', 'ladki': 'female',
    // Bengali
    'পুরুষ': 'male', 'ছেলে': 'male', 'মহিলা': 'female', 'মেয়ে': 'female', 'অন্য': 'other',
    // Tamil
    'ஆண்': 'male', 'ஆண்மகன்': 'male', 'பெண்': 'female', 'பெண்மணி': 'female', 'மற்ற': 'other',
    // Telugu
    'మగ': 'male', 'పురుషుడు': 'male', 'ఆడ': 'female', 'స్త్రీ': 'female', 'మహిళ': 'female', 'ఇతర': 'other',
    // Kannada
    'ಪುರುಷ': 'male', 'ಹುಡುಗ': 'male', 'ಮಹಿಳೆ': 'female', 'ಹುಡುಗಿ': 'female', 'ಇತರ': 'other',
    // Malayalam
    'പുരുഷൻ': 'male', 'ആൺ': 'male', 'സ്ത്രീ': 'female', 'പെൺ': 'female', 'മറ്റ്': 'other',
    // Gujarati
    'પુરુષ': 'male', 'છોકરો': 'male', 'સ્ત્રી': 'female', 'છોકરી': 'female', 'અન્ય': 'other',
    // Marathi
    'मुलगा': 'male', 'मुलगी': 'female', 'इतर': 'other',
    // Punjabi
    'ਮਰਦ': 'male', 'ਮੁੰਡਾ': 'male', 'ਔਰਤ': 'female', 'ਕੁੜੀ': 'female', 'ਹੋਰ': 'other',
    // Odia
    'ପୁରୁଷ': 'male', 'ପୁଅ': 'male', 'ମହିଳା': 'female', 'ଝିଅ': 'female', 'ଅନ୍ୟ': 'other',
};

// Regex patterns kept for sanitizeSymptomText stripping (covers most common)
const MALE_PATTERN = '(?:male|man|boy|mard|aadmi|आदमी|पुरुष|पुरष|लड़का|मेल|मर्द|भाई)';
const FEMALE_PATTERN = '(?:female|woman|girl|mahila|aurat|महिला|औरत|lady|लड़की|स्त्री|फीमेल)';
const OTHER_PATTERN = '(?:other|transgender|non binary|non-binary|others|अन्य)';

/* ─── Number words → digits (all major Indian languages + English) ─── */
const NUMBER_WORD_MAP = {
    // Hindi 1-100
    'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4, 'पांच': 5, 'पाँच': 5,
    'छह': 6, 'छ:': 6, 'छः': 6, 'सात': 7, 'आठ': 8, 'नौ': 9, 'दस': 10,
    'ग्यारह': 11, 'बारह': 12, 'तेरह': 13, 'चौदह': 14, 'पंद्रह': 15,
    'सोलह': 16, 'सत्रह': 17, 'अठारह': 18, 'उन्नीस': 19, 'बीस': 20,
    'इक्कीस': 21, 'बाईस': 22, 'तेईस': 23, 'चौबीस': 24, 'पच्चीस': 25,
    'छब्बीस': 26, 'सत्ताईस': 27, 'अट्ठाईस': 28, 'उनतीस': 29, 'तीस': 30,
    'इकतीस': 31, 'बत्तीस': 32, 'तैंतीस': 33, 'चौंतीस': 34, 'पैंतीस': 35,
    'छत्तीस': 36, 'सैंतीस': 37, 'अड़तीस': 38, 'उनतालीस': 39, 'चालीस': 40,
    'इकतालीस': 41, 'बयालीस': 42, 'तैंतालीस': 43, 'चौवालीस': 44, 'पैंतालीस': 45,
    'छियालीस': 46, 'सैंतालीस': 47, 'अड़तालीस': 48, 'उनचास': 49, 'पचास': 50,
    'इक्यावन': 51, 'बावन': 52, 'तिरपन': 53, 'चौवन': 54, 'पचपन': 55,
    'छप्पन': 56, 'सत्तावन': 57, 'अट्ठावन': 58, 'उनसठ': 59, 'साठ': 60,
    'इकसठ': 61, 'बासठ': 62, 'तिरसठ': 63, 'चौंसठ': 64, 'पैंसठ': 65,
    'छियासठ': 66, 'सड़सठ': 67, 'अड़सठ': 68, 'उनहत्तर': 69, 'सत्तर': 70,
    'इकहत्तर': 71, 'बहत्तर': 72, 'तिहत्तर': 73, 'चौहत्तर': 74, 'पचहत्तर': 75,
    'छिहत्तर': 76, 'सतहत्तर': 77, 'अठहत्तर': 78, 'उन्यासी': 79, 'अस्सी': 80,
    'इक्यासी': 81, 'बयासी': 82, 'तिरासी': 83, 'चौरासी': 84, 'पचासी': 85,
    'छियासी': 86, 'सत्तासी': 87, 'अट्ठासी': 88, 'नवासी': 89, 'नब्बे': 90,
    'इक्यानवे': 91, 'बानवे': 92, 'तिरानवे': 93, 'चौरानवे': 94, 'पंचानवे': 95,
    'छियानवे': 96, 'सत्तानवे': 97, 'अट्ठानवे': 98, 'निन्यानवे': 99, 'सौ': 100,
    // English number words
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
    'eleven': 11, 'twelve': 12, 'thirteen': 13, 'fourteen': 14, 'fifteen': 15,
    'sixteen': 16, 'seventeen': 17, 'eighteen': 18, 'nineteen': 19, 'twenty': 20,
    'thirty': 30, 'forty': 40, 'fifty': 50, 'sixty': 60, 'seventy': 70,
    'eighty': 80, 'ninety': 90, 'hundred': 100,
    // Tamil (1-20 + tens)
    'ஒன்று': 1, 'இரண்டு': 2, 'மூன்று': 3, 'நான்கு': 4, 'ஐந்து': 5,
    'ஆறு': 6, 'ஏழு': 7, 'எட்டு': 8, 'ஒன்பது': 9, 'பத்து': 10,
    'பதினொன்று': 11, 'பன்னிரண்டு': 12, 'பதிமூன்று': 13, 'பதினான்கு': 14, 'பதினைந்து': 15,
    'பதினாறு': 16, 'பதினேழு': 17, 'பதினெட்டு': 18, 'பத்தொன்பது': 19, 'இருபது': 20,
    'முப்பது': 30, 'நாற்பது': 40, 'ஐம்பது': 50, 'அறுபது': 60,
    'எழுபது': 70, 'எண்பது': 80, 'தொண்ணூறு': 90, 'நூறு': 100,
    // Telugu (1-20 + tens)
    'ఒకటి': 1, 'రెండు': 2, 'మూడు': 3, 'నాలుగు': 4, 'ఐదు': 5,
    'ఆరు': 6, 'ఏడు': 7, 'ఎనిమిది': 8, 'తొమ్మిది': 9, 'పది': 10,
    'పదకొండు': 11, 'పన్నెండు': 12, 'పదమూడు': 13, 'పధ్నాలుగు': 14, 'పదిహేను': 15,
    'పదహారు': 16, 'పదిహేడు': 17, 'పధ్ధెనిమిది': 18, 'పందొమ్మిది': 19, 'ఇరవై': 20,
    'ముప్పై': 30, 'నలభై': 40, 'యాభై': 50, 'అరవై': 60,
    'డెబ్భై': 70, 'ఎనభై': 80, 'తొంభై': 90, 'నూరు': 100,
    // Bengali (1-20 + tens)
    'এক': 1, 'দুই': 2, 'তিন': 3, 'চার': 4, 'পাঁচ': 5,
    'ছয়': 6, 'সাত': 7, 'আট': 8, 'নয়': 9, 'দশ': 10,
    'এগারো': 11, 'বারো': 12, 'তেরো': 13, 'চৌদ্দ': 14, 'পনেরো': 15,
    'ষোলো': 16, 'সতেরো': 17, 'আঠারো': 18, 'উনিশ': 19, 'কুড়ি': 20, 'বিশ': 20,
    'তিরিশ': 30, 'চল্লিশ': 40, 'পঞ্চাশ': 50, 'ষাট': 60,
    'সত্তর': 70, 'আশি': 80, 'নব্বই': 90, 'একশ': 100, 'একশো': 100,
    // Marathi (where different from Hindi, 1-20 + tens)
    'दोन': 2, 'पाच': 5, 'सहा': 6, 'नऊ': 9, 'दहा': 10,
    'अकरा': 11, 'बारा': 12, 'तेरा': 13, 'चौदा': 14, 'पंधरा': 15,
    'सोळा': 16, 'सतरा': 17, 'अठरा': 18, 'एकोणीस': 19, 'वीस': 20,
    'चाळीस': 40, 'पन्नास': 50, 'ऐंशी': 80, 'नव्वद': 90, 'शंभर': 100,
    // Gujarati (1-20 + tens)
    'એક': 1, 'બે': 2, 'ત્રણ': 3, 'ચાર': 4, 'પાંચ': 5,
    'છ': 6, 'સાત': 7, 'આઠ': 8, 'નવ': 9, 'દસ': 10,
    'અગિયાર': 11, 'બાર': 12, 'તેર': 13, 'ચૌદ': 14, 'પંદર': 15,
    'સોળ': 16, 'સત્તર': 17, 'અઢાર': 18, 'ઓગણિસ': 19, 'વીસ': 20,
    'ત્રીસ': 30, 'ચાળીસ': 40, 'પચાસ': 50, 'સાઠ': 60,
    'સિત્તેર': 70, 'એંશી': 80, 'નેવું': 90, 'સો': 100,
    // Kannada (1-20 + tens)
    'ಒಂದು': 1, 'ಎರಡು': 2, 'ಮೂರು': 3, 'ನಾಲ್ಕು': 4, 'ಐದು': 5,
    'ಆರು': 6, 'ಏಳು': 7, 'ಎಂಟು': 8, 'ಒಂಬತ್ತು': 9, 'ಹತ್ತು': 10,
    'ಹನ್ನೊಂದು': 11, 'ಹನ್ನೆರಡು': 12, 'ಹದಿಮೂರು': 13, 'ಹದಿನಾಲ್ಕು': 14, 'ಹದಿನೈದು': 15,
    'ಹದಿನಾರು': 16, 'ಹದಿನೇಳು': 17, 'ಹದಿನೆಂಟು': 18, 'ಹತ್ತೊಂಬತ್ತು': 19, 'ಇಪ್ಪತ್ತು': 20,
    'ಮೂವತ್ತು': 30, 'ನಲವತ್ತು': 40, 'ಐವತ್ತು': 50, 'ಅರವತ್ತು': 60,
    'ಎಪ್ಪತ್ತು': 70, 'ಎಂಬತ್ತು': 80, 'ತೊಂಬತ್ತು': 90, 'ನೂರು': 100,
    // Malayalam (1-20 + tens)
    'ഒന്ന്': 1, 'രണ്ട്': 2, 'മൂന്ന്': 3, 'നാല്': 4, 'അഞ്ച്': 5,
    'ആറ്': 6, 'ഏഴ്': 7, 'എട്ട്': 8, 'ഒൻപത്': 9, 'പത്ത്': 10,
    'പതിനൊന്ന്': 11, 'പന്ത്രണ്ട്': 12, 'പതിമൂന്ന്': 13, 'പതിനാല്': 14, 'പതിനഞ്ച്': 15,
    'പതിനാറ്': 16, 'പതിനേഴ്': 17, 'പതിനെട്ട്': 18, 'പത്തൊൻപത്': 19, 'ഇരുപത്': 20,
    'മുപ്പത്': 30, 'നാൽപത്': 40, 'അൻപത്': 50, 'അറുപത്': 60,
    'എഴുപത്': 70, 'എൺപത്': 80, 'തൊണ്ണൂറ്': 90, 'നൂറ്': 100,
    // Punjabi (1-20 + tens)
    'ਇੱਕ': 1, 'ਦੋ': 2, 'ਤਿੰਨ': 3, 'ਚਾਰ': 4, 'ਪੰਜ': 5,
    'ਛੇ': 6, 'ਸੱਤ': 7, 'ਅੱਠ': 8, 'ਨੌਂ': 9, 'ਦਸ': 10,
    'ਗਿਆਰਾਂ': 11, 'ਬਾਰਾਂ': 12, 'ਤੇਰਾਂ': 13, 'ਚੌਦਾਂ': 14, 'ਪੰਦਰਾਂ': 15,
    'ਸੋਲਾਂ': 16, 'ਸਤਾਰਾਂ': 17, 'ਅਠਾਰਾਂ': 18, 'ਉਨੀ': 19, 'ਵੀਹ': 20,
    'ਤੀਹ': 30, 'ਚਾਲੀ': 40, 'ਪੰਜਾਹ': 50, 'ਸੱਠ': 60,
    'ਸੱਤਰ': 70, 'ਅੱਸੀ': 80, 'ਨੱਬੇ': 90, 'ਸੌ': 100,
    // Odia (1-20 + tens)
    'ଏକ': 1, 'ଦୁଇ': 2, 'ତିନି': 3, 'ଚାରି': 4, 'ପାଞ୍ଚ': 5,
    'ଛଅ': 6, 'ସାତ': 7, 'ଆଠ': 8, 'ନଅ': 9, 'ଦଶ': 10,
    'ଏଗାର': 11, 'ବାର': 12, 'ତେର': 13, 'ଚୌଦ': 14, 'ପନ୍ଦର': 15,
    'ଷୋଳ': 16, 'ସତର': 17, 'ଅଠର': 18, 'ଊନେଇଶ': 19, 'କୋଡ଼ିଏ': 20,
    'ତିରିଶ': 30, 'ଚାଳିଶ': 40, 'ପଚାଶ': 50, 'ଷାଠିଏ': 60,
    'ସତୁରୀ': 70, 'ଅଶୀ': 80, 'ନବେ': 90, 'ଶହେ': 100,
};
const PRONOUN_PATTERN = "(?:i am|i'm|my age is|meri age|mera age|meri umr|mujhe|mere ko|patient is|main|mai)";
const SYMPTOM_HINT_PATTERN = /fever|cough|cold|pain|ache|vomit|vomiting|weak|weakness|chest|breath|breathing|dizzy|dizziness|rash|infection|loose motion|diarrhea|headache|swelling|burning|बुखार|बुख़ार|खांसी|कफ|दर्द|उल्टी|कमजोरी|सांस|चक्‍कर|चक्कर|सूजन|जलन/i;

function normalizeGender(value = '') {
    const text = normalizeReplyText(value).toLowerCase();
    if (!text) return '';

    // 1. Map-based lookup: check each token against GENDER_WORD_MAP
    const tokens = text.split(/\s+/);
    for (const token of tokens) {
        const mapped = GENDER_WORD_MAP[token];
        if (mapped) return mapped;
    }

    // 2. Fallback regex patterns for multi-word matches
    if (new RegExp(`(?:^|\\s)${MALE_PATTERN}(?=$|\\s)`, 'i').test(text)) return 'male';
    if (new RegExp(`(?:^|\\s)${FEMALE_PATTERN}(?=$|\\s)`, 'i').test(text)) return 'female';
    if (new RegExp(`(?:^|\\s)${OTHER_PATTERN}(?=$|\\s)`, 'i').test(text)) return 'other';
    return '';
}

function parseAge(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return null;
    const age = Math.round(numeric);
    if (age <= 0 || age > 120) return null;
    return age;
}

function numberWordToDigit(word = '') {
    const key = String(word || '').trim().toLowerCase();
    if (!key) return null;
    const val = NUMBER_WORD_MAP[key];
    return val != null ? val : null;
}

function extractAge(text = '') {
    const raw = normalizeReplyText(text);
    if (!raw) return null;

    // 1. Explicit digit + unit: "15 years", "15 saal"
    const explicit = raw.match(new RegExp(`(?:^|\\s)(\\d{1,3})\\s*${AGE_UNIT_PATTERN}(?=$|\\s)`, 'i'));
    if (explicit) {
        return parseAge(explicit[1]);
    }

    // 2. Pure digit: "15"
    if (/^\d{1,3}$/.test(raw)) {
        return parseAge(raw);
    }

    // 3. Conversational: "age is 15", "umr 15"
    const conversational = raw.match(new RegExp(`(?:^|\\s)${AGE_LABEL_PATTERN}\\s*(?:is|hai|=|:)?\\s*(\\d{1,3})(?=$|\\s)`, 'i'));
    if (conversational) {
        return parseAge(conversational[1]);
    }

    // 4. Hindi/English number word: "पंद्रह", "fifteen", "बीस"
    const tokens = raw.split(/\s+/);
    for (const token of tokens) {
        const digit = numberWordToDigit(token);
        if (digit != null && digit > 0 && digit <= 120) {
            return digit;
        }
    }

    // 5. Number word + unit: "पंद्रह साल", "twenty years"
    for (const token of tokens) {
        const digit = numberWordToDigit(token);
        if (digit != null) {
            const rest = raw.replace(token, '').trim();
            if (new RegExp(AGE_UNIT_PATTERN, 'i').test(rest)) {
                return parseAge(digit);
            }
        }
    }

    return null;
}

function extractGender(text = '') {
    return normalizeGender(text);
}

function sanitizeSymptomText(text = '') {
    return normalizeReplyText(text)
        .replace(new RegExp(`(?:^|\\s)\\d{1,3}\\s*${AGE_UNIT_PATTERN}(?=$|\\s)`, 'gi'), ' ')
        .replace(new RegExp(`(?:^|\\s)${AGE_LABEL_PATTERN}\\s*(?:is|hai|=|:)?\\s*\\d{1,3}(?=$|\\s)`, 'gi'), ' ')
        .replace(new RegExp(`(?:^|\\s)(?:${MALE_PATTERN}|${FEMALE_PATTERN}|${OTHER_PATTERN})(?=$|\\s)`, 'gi'), ' ')
        .replace(new RegExp(`(?:^|\\s)${PRONOUN_PATTERN}(?=$|\\s)`, 'gi'), ' ')
        .replace(/\s+/g, ' ')
        .replace(/^[,.\-\s]+|[,.\-\s]+$/g, '')
        .trim();
}

function looksLikeNonSymptomReply(text = '') {
    const cleaned = normalizeReplyText(text).toLowerCase();

    if (!cleaned) return true;

    // Short non-symptom replies: greetings, yes/no, confusion cues, filler words
    return /^(yes|no|ok|okay|thanks|thank you|hello|hi|hey|namaste|haan|haan ji|hmm|hmmm|हां|हाँ|नहीं|नही|ठीक|और|फिर|aur|phir|then|again|what|kya|क्या|बोलो|bolo|batao|बताओ|accha|अच्छा)$/i.test(cleaned);
}

function combineSymptoms(existing = '', next = '') {
    const current = String(existing || '').trim();
    const incoming = String(next || '').trim();

    if (!current) return incoming;
    if (!incoming) return current;
    if (current.toLowerCase() === incoming.toLowerCase()) return current;
    if (current.toLowerCase().includes(incoming.toLowerCase())) return current;
    if (incoming.toLowerCase().includes(current.toLowerCase())) return incoming;
    return `${current}, ${incoming}`;
}

function extractSymptoms(text = '', existingSymptoms = '') {
    const normalized = normalizeReplyText(text);
    const currentSymptoms = String(existingSymptoms || '').trim();

    if (looksLikeNonSymptomReply(text)) {
        return currentSymptoms;
    }

    if (extractAge(normalized) != null && /^\d{1,3}$/.test(normalized)) {
        return currentSymptoms;
    }

    if (extractGender(normalized) && normalizeReplyText(
        normalized.replace(new RegExp(`(?:^|\\s)(?:${MALE_PATTERN}|${FEMALE_PATTERN}|${OTHER_PATTERN})(?=$|\\s)`, 'gi'), ' ')
    ) === '') {
        return currentSymptoms;
    }

    const cleaned = sanitizeSymptomText(text);
    if (!cleaned || cleaned.length < 3) {
        return currentSymptoms;
    }

    if (currentSymptoms && extractAge(normalized) != null && !SYMPTOM_HINT_PATTERN.test(cleaned)) {
        return currentSymptoms;
    }

    if (currentSymptoms && extractGender(normalized) && !SYMPTOM_HINT_PATTERN.test(cleaned)) {
        return currentSymptoms;
    }

    return combineSymptoms(existingSymptoms, cleaned);
}

function extractDuration(text = '', currentValue = '') {
    const raw = String(text || '');
    const match = raw.match(/\b(for\s+\d+\s+(?:days?|weeks?|months?)|since\s+(?:yesterday|today|last night|\d+\s+(?:days?|weeks?|months?))|(\d+\s+(?:days?|weeks?|months?)))\b/i);
    if (match) {
        return match[1] || match[2] || currentValue || '';
    }
    return currentValue || '';
}

function extractSeverity(text = '', currentValue = '') {
    const raw = String(text || '').toLowerCase();
    if (/\b(mild|light|कम)\b/.test(raw)) return 'mild';
    if (/\b(moderate|medium|moderately)\b/.test(raw)) return 'moderate';
    if (/\b(severe|very bad|intense|high|ज्यादा|तेज)\b/.test(raw)) return 'severe';
    return currentValue || '';
}

function mergeSymptomIntake(base = {}, update = {}) {
    const merged = {
        symptoms: String(base.symptoms || '').trim(),
        age: parseAge(base.age),
        gender: normalizeGender(base.gender),
        duration: String(base.duration || '').trim(),
        severity: String(base.severity || '').trim(),
    };

    const nextSymptoms = String(update.symptoms || '').trim();
    if (nextSymptoms) {
        merged.symptoms = combineSymptoms(merged.symptoms, nextSymptoms);
    }

    const nextAge = parseAge(update.age);
    if (nextAge != null) {
        merged.age = nextAge;
    }

    const nextGender = normalizeGender(update.gender);
    if (nextGender) {
        merged.gender = nextGender;
    }

    if (update.duration) {
        merged.duration = String(update.duration).trim();
    }

    if (update.severity) {
        merged.severity = String(update.severity).trim();
    }

    return merged;
}

function extractSymptomIntake(text = '', base = {}) {
    const age = extractAge(text);
    const gender = extractGender(text);
    const symptoms = extractSymptoms(text, base.symptoms);
    const duration = extractDuration(text, base.duration);
    const severity = extractSeverity(text, base.severity);

    return mergeSymptomIntake(base, {
        symptoms,
        age,
        gender,
        duration,
        severity,
    });
}

function getMissingSymptomSlot(intake = {}) {
    if (!String(intake.symptoms || '').trim()) return 'symptoms';
    if (parseAge(intake.age) == null) return 'age';
    if (!normalizeGender(intake.gender)) return 'gender';
    return null;
}

function buildSymptomFollowUp(slot, intake = {}, retryCount = 0) {
    switch (slot) {
        case 'symptoms':
            return retryCount > 0
                ? 'Please describe your health problem. For example: fever, cough, chest pain, headache, or weakness.'
                : 'I am your AI health agent. Please tell me your main symptoms in your own words, like fever, cough, chest pain, vomiting, or weakness.';
        case 'age':
            return retryCount > 0
                ? 'I did not catch the age. Please say a number, for example 15, 25, or 40.'
                : 'What is the patient age in years?';
        case 'gender':
            return retryCount > 0
                ? 'Sorry, I did not understand. Please say male, female, or other.'
                : 'Please tell me the patient gender: male, female, or other.';
        default:
            return 'Please continue and tell me more about the symptoms.';
    }
}

function buildSymptomContextSummary(intake = {}) {
    const parts = [];
    if (intake.symptoms) parts.push(`Symptoms: ${String(intake.symptoms).trim()}`);
    if (parseAge(intake.age) != null) parts.push(`Age: ${parseAge(intake.age)}`);
    if (normalizeGender(intake.gender)) parts.push(`Gender: ${normalizeGender(intake.gender)}`);
    if (intake.duration) parts.push(`Duration: ${String(intake.duration).trim()}`);
    if (intake.severity) parts.push(`Severity: ${String(intake.severity).trim()}`);
    return parts.join('. ');
}

function toSymptomEntities(intake = {}) {
    return {
        ...(intake.symptoms ? { symptoms: String(intake.symptoms).trim() } : {}),
        ...(parseAge(intake.age) != null ? { age: String(parseAge(intake.age)) } : {}),
        ...(normalizeGender(intake.gender) ? { gender: normalizeGender(intake.gender) } : {}),
        ...(intake.duration ? { duration: String(intake.duration).trim() } : {}),
        ...(intake.severity ? { severity: String(intake.severity).trim() } : {}),
    };
}

module.exports = {
    normalizeGender,
    parseAge,
    extractAge,
    extractGender,
    extractSymptoms,
    extractSymptomIntake,
    mergeSymptomIntake,
    getMissingSymptomSlot,
    buildSymptomFollowUp,
    buildSymptomContextSummary,
    toSymptomEntities,
};
