const {
  extractSymptomIntake,
} = require('../../services/symptom-intake');

describe('symptom intake parsing', () => {
  test('treats age-only follow-up with Hindi danda as age, not symptom text', () => {
    const result = extractSymptomIntake('18।', {
      symptoms: 'not feeling well',
    });

    expect(result.age).toBe(18);
    expect(result.symptoms).toBe('not feeling well');
  });

  test('treats gender-only follow-up as gender, not symptom text', () => {
    const result = extractSymptomIntake('male', {
      symptoms: 'fever and cough',
      age: 35,
    });

    expect(result.gender).toBe('male');
    expect(result.symptoms).toBe('fever and cough');
  });

  test('treats repeated Hindi age reply as age, not symptom text', () => {
    const result = extractSymptomIntake('18 साल, 18 साल।', {
      symptoms: 'not feeling well what can you check',
    });

    expect(result.age).toBe(18);
    expect(result.symptoms).toBe('not feeling well what can you check');
  });

  test('keeps symptoms unchanged for noisy age reply with STT filler words', () => {
    const result = extractSymptomIntake('मरी इसको मरी 18 साल है ब्रो।', {
      symptoms: 'not feeling well what can you check',
    });

    expect(result.age).toBe(18);
    expect(result.symptoms).toBe('not feeling well what can you check');
  });

  test('parses Hindi gender reply without appending to symptoms', () => {
    const result = extractSymptomIntake('पुरुष।', {
      symptoms: 'fever and cough',
      age: 18,
    });

    expect(result.gender).toBe('male');
    expect(result.symptoms).toBe('fever and cough');
  });
});
