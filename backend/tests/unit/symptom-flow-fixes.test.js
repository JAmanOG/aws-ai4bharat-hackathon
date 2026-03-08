/**
 * Tests for symptom checker fixes:
 *   1. Hindi number word parsing in extractAge
 *   2. Retry auto-fill in orchestrator
 *   3. Improved follow-up prompts
 *   4. Extended gender aliases
 */

const {
    extractAge,
    extractGender,
    extractSymptomIntake,
    getMissingSymptomSlot,
    buildSymptomFollowUp,
    mergeSymptomIntake,
    toSymptomEntities,
} = require('../../services/symptom-intake');

/* ──────────────────────────────────────────────── */
/*  1. Hindi number word → age parsing              */
/* ──────────────────────────────────────────────── */
describe('extractAge – Hindi number words', () => {
    test('parses पंद्रह (fifteen) → 15', () => {
        expect(extractAge('पंद्रह')).toBe(15);
    });

    test('parses पंद्रह। with Hindi danda → 15', () => {
        expect(extractAge('पंद्रह।')).toBe(15);
    });

    test('parses बीस (twenty) → 20', () => {
        expect(extractAge('बीस')).toBe(20);
    });

    test('parses पच्चीस (twenty-five) → 25', () => {
        expect(extractAge('पच्चीस')).toBe(25);
    });

    test('parses तीस (thirty) → 30', () => {
        expect(extractAge('तीस')).toBe(30);
    });

    test('parses पैंतालीस (forty-five) → 45', () => {
        expect(extractAge('पैंतालीस')).toBe(45);
    });

    test('parses साठ (sixty) → 60', () => {
        expect(extractAge('साठ')).toBe(60);
    });

    test('parses सत्तर (seventy) → 70', () => {
        expect(extractAge('सत्तर')).toBe(70);
    });

    test('parses अस्सी (eighty) → 80', () => {
        expect(extractAge('अस्सी')).toBe(80);
    });

    test('parses नब्बे (ninety) → 90', () => {
        expect(extractAge('नब्बे')).toBe(90);
    });

    test('parses पंद्रह साल → 15', () => {
        expect(extractAge('पंद्रह साल')).toBe(15);
    });

    test('parses English number word fifteen → 15', () => {
        expect(extractAge('fifteen')).toBe(15);
    });

    test('parses English number word twenty → 20', () => {
        expect(extractAge('twenty')).toBe(20);
    });

    test('parses English number word fifty → 50', () => {
        expect(extractAge('fifty')).toBe(50);
    });

    test('still parses digit "15" → 15', () => {
        expect(extractAge('15')).toBe(15);
    });

    test('still parses "15 years" → 15', () => {
        expect(extractAge('15 years')).toBe(15);
    });

    test('returns null for empty string', () => {
        expect(extractAge('')).toBeNull();
    });

    test('returns null for non-number words', () => {
        expect(extractAge('और')).toBeNull();
        expect(extractAge('फिर')).toBeNull();
        expect(extractAge('नहीं')).toBeNull();
    });

    // Multi-language age parsing
    test('Tamil: பத்து → 10', () => expect(extractAge('பத்து')).toBe(10));
    test('Tamil: பதினைந்து → 15', () => expect(extractAge('பதினைந்து')).toBe(15));
    test('Tamil: ஐம்பது → 50', () => expect(extractAge('ஐம்பது')).toBe(50));
    test('Telugu: పది → 10', () => expect(extractAge('పది')).toBe(10));
    test('Telugu: పదిహేను → 15', () => expect(extractAge('పదిహేను')).toBe(15));
    test('Telugu: ఇరవై → 20', () => expect(extractAge('ఇరవై')).toBe(20));
    test('Bengali: দশ → 10', () => expect(extractAge('দশ')).toBe(10));
    test('Bengali: পনেরো → 15', () => expect(extractAge('পনেরো')).toBe(15));
    test('Bengali: বিশ → 20', () => expect(extractAge('বিশ')).toBe(20));
    test('Marathi: दहा → 10', () => expect(extractAge('दहा')).toBe(10));
    test('Marathi: पंधरा → 15', () => expect(extractAge('पंधरा')).toBe(15));
    test('Gujarati: દસ → 10', () => expect(extractAge('દસ')).toBe(10));
    test('Gujarati: પંદર → 15', () => expect(extractAge('પંદર')).toBe(15));
    test('Kannada: ಹತ್ತು → 10', () => expect(extractAge('ಹತ್ತು')).toBe(10));
    test('Kannada: ಹದಿನೈದು → 15', () => expect(extractAge('ಹದಿನೈದು')).toBe(15));
    test('Malayalam: പത്ത് → 10', () => expect(extractAge('പത്ത്')).toBe(10));
    test('Malayalam: ഇരുപത് → 20', () => expect(extractAge('ഇരുപത്')).toBe(20));
    test('Punjabi: ਦਸ → 10', () => expect(extractAge('ਦਸ')).toBe(10));
    test('Punjabi: ਪੰਦਰਾਂ → 15', () => expect(extractAge('ਪੰਦਰਾਂ')).toBe(15));
    test('Odia: ଦଶ → 10', () => expect(extractAge('ଦଶ')).toBe(10));
    test('Odia: ପନ୍ଦର → 15', () => expect(extractAge('ପନ୍ଦର')).toBe(15));
});

/* ──────────────────────────────────────────────── */
/*  2. Extended gender detection                    */
/* ──────────────────────────────────────────────── */
describe('extractGender – extended aliases', () => {
    test('detects आदमी (man) → male', () => {
        expect(extractGender('आदमी')).toBe('male');
    });

    test('detects मेल (Hinglish male) → male', () => {
        expect(extractGender('मेल')).toBe('male');
    });

    test('detects स्त्री (woman) → female', () => {
        expect(extractGender('स्त्री')).toBe('female');
    });

    test('detects फीमेल (Hinglish female) → female', () => {
        expect(extractGender('फीमेल')).toBe('female');
    });

    test('detects भाई (brother context) → male', () => {
        expect(extractGender('भाई')).toBe('male');
    });

    test('still detects पुरुष → male', () => {
        expect(extractGender('पुरुष')).toBe('male');
    });

    test('still detects महिला → female', () => {
        expect(extractGender('महिला')).toBe('female');
    });

    test('still detects male → male', () => {
        expect(extractGender('male')).toBe('male');
    });

    test('still detects female → female', () => {
        expect(extractGender('female')).toBe('female');
    });

    test('returns empty for confusion words', () => {
        expect(extractGender('और')).toBe('');
        expect(extractGender('फिर')).toBe('');
    });

    // Multi-language gender
    test('Tamil: ஆண் → male', () => expect(extractGender('ஆண்')).toBe('male'));
    test('Tamil: பெண் → female', () => expect(extractGender('பெண்')).toBe('female'));
    test('Telugu: పురుషుడు → male', () => expect(extractGender('పురుషుడు')).toBe('male'));
    test('Telugu: స్త్రీ → female', () => expect(extractGender('స్త్రీ')).toBe('female'));
    test('Bengali: পুরুষ → male', () => expect(extractGender('পুরুষ')).toBe('male'));
    test('Bengali: মেয়ে → female', () => expect(extractGender('মেয়ে')).toBe('female'));
    test('Kannada: ಪುರುಷ → male', () => expect(extractGender('ಪುರುಷ')).toBe('male'));
    test('Kannada: ಮಹಿಳೆ → female', () => expect(extractGender('ಮಹಿಳೆ')).toBe('female'));
    test('Malayalam: ആൺ → male', () => expect(extractGender('ആൺ')).toBe('male'));
    test('Malayalam: സ്ത്രീ → female', () => expect(extractGender('സ്ത്രീ')).toBe('female'));
    test('Gujarati: પુરુષ → male', () => expect(extractGender('પુરુષ')).toBe('male'));
    test('Gujarati: છોકરી → female', () => expect(extractGender('છોકરી')).toBe('female'));
    test('Punjabi: ਮਰਦ → male', () => expect(extractGender('ਮਰਦ')).toBe('male'));
    test('Punjabi: ਔਰਤ → female', () => expect(extractGender('ਔਰਤ')).toBe('female'));
    test('Odia: ପୁରୁଷ → male', () => expect(extractGender('ପୁରୁଷ')).toBe('male'));
    test('Odia: ମହିଳା → female', () => expect(extractGender('ମହିଳା')).toBe('female'));
    test('Marathi: मुलगा → male', () => expect(extractGender('मुलगा')).toBe('male'));
    test('Marathi: मुलगी → female', () => expect(extractGender('मुलगी')).toBe('female'));
});

/* ──────────────────────────────────────────────── */
/*  3. End-to-end intake with Hindi numbers         */
/* ──────────────────────────────────────────────── */
describe('extractSymptomIntake – Hindi number follow-up', () => {
    test('correctly fills age from Hindi word पंद्रह', () => {
        const base = { symptoms: 'fever and cough', age: null, gender: '' };
        const result = extractSymptomIntake('पंद्रह।', base);

        expect(result.age).toBe(15);
        expect(result.symptoms).toBe('fever and cough');
    });

    test('correctly fills age from English word "twenty"', () => {
        const base = { symptoms: 'headache', age: null, gender: '' };
        const result = extractSymptomIntake('twenty', base);

        expect(result.age).toBe(20);
        expect(result.symptoms).toBe('headache');
    });

    test('correctly fills age then gender in sequence', () => {
        const step1 = extractSymptomIntake('बीस', { symptoms: 'chest pain' });
        expect(step1.age).toBe(20);
        expect(getMissingSymptomSlot(step1)).toBe('gender');

        const step2 = extractSymptomIntake('पुरुष', step1);
        expect(step2.gender).toBe('male');
        expect(getMissingSymptomSlot(step2)).toBeNull();
    });
});

/* ──────────────────────────────────────────────── */
/*  4. buildSymptomFollowUp with retry count        */
/* ──────────────────────────────────────────────── */
describe('buildSymptomFollowUp – retry-aware prompts', () => {
    test('first ask for age → standard prompt', () => {
        const msg = buildSymptomFollowUp('age', {}, 0);
        expect(msg).toContain('age in years');
    });

    test('retry ask for age → rephrased prompt', () => {
        const msg = buildSymptomFollowUp('age', {}, 1);
        expect(msg).toContain('did not catch');
    });

    test('first ask for gender → standard prompt', () => {
        const msg = buildSymptomFollowUp('gender', {}, 0);
        expect(msg.toLowerCase()).toContain('male');
        expect(msg.toLowerCase()).toContain('female');
    });

    test('retry ask for gender → clearer hint', () => {
        const msg = buildSymptomFollowUp('gender', {}, 1);
        expect(msg).toContain('did not understand');
    });

    test('first ask for symptoms → intro prompt', () => {
        const msg = buildSymptomFollowUp('symptoms', {}, 0);
        expect(msg).toContain('AI health agent');
    });

    test('retry ask for symptoms → simpler prompt', () => {
        const msg = buildSymptomFollowUp('symptoms', {}, 1);
        expect(msg).toContain('describe your health problem');
    });
});

/* ──────────────────────────────────────────────── */
/*  5. Retry auto-fill simulation (orchestrator)    */
/* ──────────────────────────────────────────────── */
describe('Retry auto-fill for stuck slots', () => {
    test('after 2 gender retries, auto-filling makes all slots present', () => {
        const intake = {
            symptoms: 'fever',
            age: 15,
            gender: '', // stuck — user can't answer
        };

        // Simulate what orchestrator does after retryCount >= 2
        const missing = getMissingSymptomSlot(intake);
        expect(missing).toBe('gender');

        // Auto-fill
        intake.gender = 'other';
        expect(getMissingSymptomSlot(intake)).toBeNull();
    });

    test('after 2 age retries, auto-filling makes slot pass', () => {
        const intake = {
            symptoms: 'weakness',
            age: null,
            gender: '',
        };

        expect(getMissingSymptomSlot(intake)).toBe('age');

        // Auto-fill
        intake.age = 30;
        expect(getMissingSymptomSlot(intake)).toBe('gender');
    });
});
