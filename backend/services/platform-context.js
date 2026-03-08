/**
 * Platform context helpers.
 *
 * Turns the app's lightweight screen context string into structured hints so
 * voice routing can stay grounded in what the user is actually seeing.
 */

const { APP_NAME } = require('./brand');

const SCREEN_CAPABILITY_HINTS = {
    Ask: `This is ${APP_NAME}'s main Ask screen with voice-first entry into Agriculture, Health, Knowledge, Infrastructure, and Economics modules. The user may also have a selected photo or report attachment that should ground the next answer.`,
    AgriMarket: 'This screen shows agriculture market data for the currently selected crop and location, including crop tabs and historical data.',
    MarketPrices: 'This screen shows detailed mandi prices for the currently selected crop and location.',
    Eligibility: 'This is the economics loan eligibility screen. It shows loan readiness, required document status, and the best matching loan schemes.',
    SavingsNudge: 'This is the financial overview screen. It shows harvest income, planned costs, savings target, emergency fund, next-season investment, and insurance protection.',
    InsuranceClaims: 'This is the insurance and claims screen. It shows insurance coverage, claim readiness, recent claim status, and the exact crop-claim process.',
    Orders: 'This is the My Listings & Market screen. It shows the farmer’s active sell listing, verified buyer matches or buyer requests, nearby seller listings, and saved contact details that the app can reuse for voice-based listing creation and updates.',
    HealthDashboard: 'This is the AI Health Screening dashboard. The exact on-screen actions include Start Screening, Upload Report, Get Insights, View All Schemes, Visit Site for telemedicine, and Explore Providers. Medical Report Insights supports MRI, X-ray, CT, ultrasound, and lab reports.',
    SymptomChecker: 'This is the Symptom Checker. It is a voice-first AI Doctor consultation flow. The assistant should ask for symptoms, then age, then gender if missing, and once enough detail is collected it should return possible conditions, urgency, recommended action, home remedies, and warning signs. This is guidance only, not a diagnosis.',
    KnowledgeDashboard: 'This screen helps the user discover videos, articles, courses, and other learning resources.',
    KnowledgeResources: 'This screen shows resource search results such as videos, articles, live sessions, and official courses.',
    VoiceRooms: 'This screen lists available live voice rooms.',
    VoiceRoom: 'This screen is the active live voice room conversation view.',
};

function toCamelCase(label) {
    const cleaned = String(label || '')
        .trim()
        .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');

    if (!cleaned) {
        return '';
    }

    if (!/[^a-zA-Z0-9]/.test(cleaned)) {
        return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
    }

    return cleaned
        .split(/[^a-zA-Z0-9]+/)
        .filter(Boolean)
        .map((part, index) => {
            const lower = part.toLowerCase();
            return index === 0 ? lower : lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join('');
}

function parseScreenContext(screenContext = '') {
    const raw = String(screenContext || '').trim();
    const parsed = {
        raw,
        screen: '',
        values: {},
    };

    if (!raw) {
        return parsed;
    }

    const parts = raw
        .split('.')
        .map((part) => part.trim())
        .filter(Boolean);

    for (const part of parts) {
        if (/^User is on screen:/i.test(part)) {
            parsed.screen = part.replace(/^User is on screen:/i, '').trim();
            continue;
        }

        const colonIndex = part.indexOf(':');
        if (colonIndex === -1) {
            continue;
        }

        const key = toCamelCase(part.slice(0, colonIndex));
        const value = part.slice(colonIndex + 1).trim();
        if (key) {
            parsed.values[key] = value;
        }
    }

    return parsed;
}

function buildPlatformCapabilityHint(screenContext = '') {
    const parsed = parseScreenContext(screenContext);
    if (!parsed.raw) {
        return '';
    }

    const hints = [];
    if (parsed.screen && SCREEN_CAPABILITY_HINTS[parsed.screen]) {
        hints.push(SCREEN_CAPABILITY_HINTS[parsed.screen]);
    }

    if (parsed.values.availableActions) {
        hints.push(`Actions currently available on screen: ${parsed.values.availableActions}.`);
    }

    if (parsed.screen === 'Ask' && parsed.values.selectedAttachmentStatus && parsed.values.selectedAttachmentStatus !== 'none') {
        if (parsed.values.selectedAttachmentName) {
            hints.push(`Selected attachment on Ask screen: ${parsed.values.selectedAttachmentName}.`);
        }
        if (parsed.values.selectedAttachmentType) {
            hints.push(`Attachment type: ${parsed.values.selectedAttachmentType}.`);
        }
        if (parsed.values.attachmentSummary) {
            hints.push(`Attachment summary: ${parsed.values.attachmentSummary}.`);
        }
        if (parsed.values.attachmentObservations) {
            hints.push(`Attachment observations: ${parsed.values.attachmentObservations}.`);
        }
        if (parsed.values.attachmentPromptHint) {
            hints.push(`Suggested follow-up prompt: ${parsed.values.attachmentPromptHint}.`);
        }
    }

    if (parsed.screen === 'HealthDashboard') {
        if (parsed.values.availableReportTypes) {
            hints.push(`Supported report types on screen: ${parsed.values.availableReportTypes}.`);
        }
        if (parsed.values.selectedReportType) {
            hints.push(`Selected report type on screen: ${parsed.values.selectedReportType}.`);
        }
        if (parsed.values.reportStatus) {
            hints.push(`Current report status: ${parsed.values.reportStatus}.`);
        }
        if (parsed.values.visibleSchemeNames) {
            hints.push(`Visible health schemes on screen: ${parsed.values.visibleSchemeNames}.`);
        }
        if (parsed.values.visibleProviderNames) {
            hints.push(`Visible consultation providers on screen: ${parsed.values.visibleProviderNames}.`);
        }
    }

    if (parsed.screen === 'SymptomChecker') {
        if (parsed.values.conversationStage) {
            hints.push(`Current symptom interview stage: ${parsed.values.conversationStage}.`);
        }
        if (parsed.values.capturedSymptoms) {
            hints.push(`Symptoms already captured on screen: ${parsed.values.capturedSymptoms}.`);
        }
        if (parsed.values.capturedAge) {
            hints.push(`Age already captured on screen: ${parsed.values.capturedAge}.`);
        }
        if (parsed.values.capturedGender) {
            hints.push(`Gender already captured on screen: ${parsed.values.capturedGender}.`);
        }
        if (parsed.values.missingField) {
            hints.push(`The next missing detail on screen is: ${parsed.values.missingField}.`);
        }
        if (parsed.values.resultReady) {
            hints.push(`Symptom results ready: ${parsed.values.resultReady}.`);
        }
        if (parsed.values.riskLevel) {
            hints.push(`Current risk level shown on screen: ${parsed.values.riskLevel}.`);
        }
    }

    return hints.join('\n');
}

function enrichAnalysisWithScreenContext(analysis, originalText = '', screenContext = '') {
    const parsed = parseScreenContext(screenContext);
    if (!parsed.raw) {
        return { analysis, reason: null };
    }

    const englishText = String(analysis?.english_text || '');
    const combined = `${englishText} ${originalText} ${screenContext}`.toLowerCase();
    const next = {
        ...analysis,
        entities: { ...(analysis?.entities || {}) },
    };

    const asksReportInsights = /upload|report|reports|scan|scans|imaging|image|x[\s-]?ray|\bmri\b|\bct\b|\bct scan\b|\bultrasound\b|\bpathology\b|lab report|medical report|insight|insights|analy[sz]e|screening report|रिपोर्ट|स्कैन|अपलोड|एक्सरे|एमआरआई|जांच/.test(combined);
    const asksScreenHelp = /what can i do|what is on this screen|what is on this page|how do i use|how to use|use this screen|current screen|this screen|this page|screen help|dashboard help|यहां क्या|कैसे उपयोग|क्या कर/.test(combined);
    const asksSchemes = /ayushman|pm[-\s]?jay|cghs|e[\s-]?sanjeevani|health scheme|health schemes|scheme|yojana|portal|portals|सकीम|योजना|आयुष्मान/.test(combined);
    const asksDoctorAccess = /doctor|doctors|provider|providers|consult|consultation|telemedicine|hospital|phc|clinic|specialist|appointment|डॉक्टर|अस्पताल|परामर्श/.test(combined);
    const asksSymptomFlow = /symptom|symptoms|fever|cough|pain|headache|vomiting|risk profiling|check symptoms|symptom checker|बुकार|बुखार|लक्षण|दर्द/.test(combined);
    const asksLoan = /loan|credit|kcc|eligib|bank|interest|limit|finance|कर्ज|लोन|ब्याज|पात्र/.test(combined);
    const asksSavings = /save|saving|income|profit|cost|expense|harvest|budget|cash flow|margin|बचत|आय|खर्च|मुनाफ/.test(combined);
    const asksInsurance = /insurance|claim|coverage|damage|bima|rain|hail|flood|drought|बीमा|क्लेम|नुकसान|मुआव/.test(combined);
    const asksMarketListing = /sell|listing|post listing|create listing|sell order|list produce|mark sold|cancel listing|buyer|buyers|orders|contact buyer|buyer requests|खरीदार|लिस्टिंग|बेचना|ऑर्डर/.test(combined);
    const attachmentType = String(parsed.values.selectedAttachmentType || '').toLowerCase();
    const attachmentStatus = String(parsed.values.selectedAttachmentStatus || '').toLowerCase();
    const hasAttachment = attachmentStatus === 'ready';
    const asksAttachmentQuestion = /this image|this photo|this picture|this report|this file|what is this|what does this show|what do you see|is this|how bad is this|what happened here|ye kya|yeh kya|is photo|is image|is report|isme kya|iska matlab|kya dikh raha|क्‍या है|क्या है|इस फोटो|इस इमेज|इस रिपोर्ट|इसमें क्या|मतलब/.test(combined);

    if (parsed.screen === 'HealthDashboard' && asksReportInsights) {
        next.domain = 'health';
        next.intent = 'medical_report_analysis';
        next.complexity = 'moderate';
        next.can_answer_directly = false;
        return { analysis: next, reason: 'health-dashboard-report-insights' };
    }

    if (parsed.screen === 'HealthDashboard' && asksScreenHelp) {
        next.domain = 'health';
        next.intent = 'health_platform_help';
        next.complexity = 'simple';
        next.can_answer_directly = false;
        return { analysis: next, reason: 'health-dashboard-platform-help' };
    }

    if (parsed.screen === 'HealthDashboard' && asksSchemes) {
        next.domain = 'health';
        next.intent = 'health_scheme';
        next.complexity = 'moderate';
        next.can_answer_directly = false;
        return { analysis: next, reason: 'health-dashboard-schemes' };
    }

    if (parsed.screen === 'HealthDashboard' && asksDoctorAccess) {
        next.domain = 'health';
        next.intent = 'facility_referral';
        next.complexity = 'moderate';
        next.can_answer_directly = false;
        return { analysis: next, reason: 'health-dashboard-providers' };
    }

    if (parsed.screen === 'SymptomChecker' && (asksScreenHelp || asksSymptomFlow)) {
        next.domain = 'health';
        next.intent = asksScreenHelp ? 'health_platform_help' : 'symptom_guidance';
        next.complexity = 'simple';
        next.can_answer_directly = false;
        return { analysis: next, reason: 'symptom-checker-guidance' };
    }

    if (parsed.screen === 'Eligibility' && (asksScreenHelp || asksLoan)) {
        next.domain = 'schemes';
        next.intent = asksLoan ? 'loan_info' : 'scheme_eligibility';
        next.complexity = 'simple';
        next.can_answer_directly = false;
        return { analysis: next, reason: 'economics-loan-screen' };
    }

    if (parsed.screen === 'SavingsNudge' && (asksScreenHelp || asksSavings)) {
        next.domain = 'schemes';
        next.intent = 'financial_aid';
        next.complexity = 'simple';
        next.can_answer_directly = false;
        return { analysis: next, reason: 'economics-savings-screen' };
    }

    if (parsed.screen === 'InsuranceClaims' && (asksScreenHelp || asksInsurance)) {
        next.domain = 'schemes';
        next.intent = 'insurance_claim';
        next.complexity = 'simple';
        next.can_answer_directly = false;
        return { analysis: next, reason: 'economics-insurance-screen' };
    }

    if (parsed.screen === 'Orders' && (asksScreenHelp || asksMarketListing)) {
        next.domain = 'market';
        if (/mark sold|sold/.test(combined) || /cancel listing|remove listing|delete listing/.test(combined)) {
            next.intent = 'listing_management';
        } else if (/contact buyer|call buyer|buyer number|buyer phone/.test(combined)) {
            next.intent = 'contact_buyer';
        } else if (/orders|buyer requests|request/.test(combined)) {
            next.intent = 'orders';
        } else if (/sell|create listing|post listing|list produce|बेचना|लिस्टिंग/.test(combined)) {
            next.intent = 'create_listing';
        } else {
            next.intent = 'buyer_connection';
        }
        next.complexity = 'simple';
        next.can_answer_directly = false;
        return { analysis: next, reason: 'market-screen-workflow' };
    }

    if (parsed.screen === 'Ask' && hasAttachment && attachmentType.includes('medical') && (asksAttachmentQuestion || asksReportInsights || asksDoctorAccess)) {
        next.domain = 'health';
        next.intent = asksDoctorAccess ? 'facility_referral' : 'medical_report_analysis';
        next.complexity = 'moderate';
        next.can_answer_directly = false;
        next.entities.attachmentType = attachmentType;
        return { analysis: next, reason: 'ask-screen-medical-attachment' };
    }

    if (parsed.screen === 'Ask' && hasAttachment && (attachmentType.includes('crop') || attachmentType.includes('field') || attachmentType.includes('farm')) && (asksAttachmentQuestion || /crop|leaf|field|farm|plant|disease|pest|fungus|soil|irrigation|treatment|spray|yellow|spot|wilting|leaf spot|कीड़ा|फसल|पत्ता|खेत|पौधा|रोग|कीट|दवा/.test(combined))) {
        next.domain = 'agriculture';
        next.intent = 'crop_advice';
        next.complexity = 'moderate';
        next.can_answer_directly = false;
        next.entities.attachmentType = attachmentType;
        return { analysis: next, reason: 'ask-screen-crop-attachment' };
    }

    if (parsed.screen === 'Ask' && hasAttachment && asksAttachmentQuestion) {
        next.domain = 'general';
        next.intent = 'general_question';
        next.complexity = next.complexity === 'complex' ? 'complex' : 'moderate';
        next.can_answer_directly = false;
        next.entities.attachmentType = attachmentType || 'selected attachment';
        return { analysis: next, reason: 'ask-screen-generic-attachment' };
    }

    if (asksReportInsights) {
        next.domain = 'health';
        next.intent = 'medical_report_analysis';
        next.complexity = next.complexity === 'complex' ? 'complex' : 'moderate';
        next.can_answer_directly = false;
        return { analysis: next, reason: 'global-health-report-insights' };
    }

    return { analysis, reason: null };
}

module.exports = {
    parseScreenContext,
    buildPlatformCapabilityHint,
    enrichAnalysisWithScreenContext,
    SCREEN_CAPABILITY_HINTS,
};
