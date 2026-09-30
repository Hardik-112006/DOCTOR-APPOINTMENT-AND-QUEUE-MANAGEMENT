/**
 * Dashboard-specific JavaScript for DoctorQueue
 * Handles:
 * 1. English ⇄ हिन्दी Frontend Language Toggle for Dashboard
 * 2. Mobile Sidebar & Drawer Navigation
 * 3. User Session State & Dynamic Auth Action
 * 4. Interactive UI Effects for Dashboard Cards
 */

(function () {
    'use strict';

    // Dashboard-specific Translation Dictionary (English and Hindi)
    const DASHBOARD_I18N = {
        en: {
            // Navbar & Brand
            brandName: "DoctorQueue",
            clinicBadge: "SmartCare",
            langBtnLabel: "English ⇄ हिन्दी",
            signInBtn: "Sign In",
            signOutBtn: "Sign Out",
            welcomeUser: "Welcome",

            // Sidebar
            navDashboard: "Dashboard",
            navBook: "Book Appointment",
            navTrack: "Live Queue / Tracking",
            navReception: "Receptionist Queue",
            navDoctor: "Doctor Queue",
            navAdmin: "Admin Overview",
            systemStatus: "System Status",
            dbConnected: "PostgreSQL Live",
            opdActive: "OPD Flow Active",

            // Hero Banner
            heroBadge: "SmartCare Clinic Management",
            heroTitle: "Doctor Appointment & Queue Management Portal",
            heroSubtitle: "Unified healthcare OPD portal for real-time appointments, live patient queue tracking, receptionist desk control, doctor consultations, and clinic operations.",
            liveSyncPill: "Live OPD Operational",

            // Quick Stats / Highlights
            statAppointmentsTitle: "Smart Booking",
            statAppointmentsDesc: "Online advance slots & instant walk-in OPD tokens",
            statQueueTitle: "Live Tracking",
            statQueueDesc: "Dynamic ETA wait-time forecasting & queue position",
            statDoctorTitle: "Doctor Desk",
            statDoctorDesc: "1-Click patient calling, diagnosis & Rx records",
            statAdminTitle: "Admin Command",
            statAdminDesc: "Real-time KPIs, throughput analytics & audit trail",

            // Card 1: Book Appointment
            cardBookBadge: "Patient Booking",
            cardBookTitle: "Book Appointment",
            cardBookDesc: "Choose medical department, pick specialist doctor, select available date & time slots, or generate an instant token for today's OPD.",
            cardBookFeature1: "Specialist Doctors & Department Filter",
            cardBookFeature2: "Real-Time Slot Availability Grid",
            cardBookFeature3: "Instant Token Confirmation & PDF Slip",
            cardBookBtn: "Book Appointment →",

            // Card 2: Live Queue / Tracking
            cardTrackBadge: "Patient Tracking",
            cardTrackTitle: "Live Queue / Tracking",
            cardTrackDesc: "Check live token number, monitor patients ahead of you, see calculated waiting time (ETA), and receive real-time room call notifications.",
            cardTrackFeature1: "Live Token Display & Queue Position",
            cardTrackFeature2: "Dynamic ETA Waiting Time Forecast",
            cardTrackFeature3: "Audio-Visual Turn Call Alerts",
            cardTrackBtn: "Track Live Queue →",

            // Card 3: Receptionist Queue
            cardReceptionBadge: "Desk Management",
            cardReceptionTitle: "Receptionist Queue",
            cardReceptionDesc: "Manage today's unified OPD queue, register walk-in patients on the spot, verify arrivals, and coordinate doctor queue allocations.",
            cardReceptionFeature1: "1-Click Walk-In Token Dispatch",
            cardReceptionFeature2: "Arrival Check-in & Queue Reordering",
            cardReceptionFeature3: "Real-Time Multi-Doctor Lane View",
            cardReceptionBtn: "Receptionist Desk →",

            // Card 4: Doctor Queue
            cardDoctorBadge: "Clinical Desk",
            cardDoctorTitle: "Doctor Queue",
            cardDoctorDesc: "Manage your active patient consultation queue, call next patient in priority order, record clinical diagnosis notes, and prescribe medicines.",
            cardDoctorFeature1: "Instant 'Call Next Patient' Action",
            cardDoctorFeature2: "Clinical Diagnosis & Medical Notes",
            cardDoctorFeature3: "Prescription Management & History",
            cardDoctorBtn: "Doctor Consultation →",

            // Card 5: Admin Overview
            cardAdminBadge: "Operational Command",
            cardAdminTitle: "Admin Overview",
            cardAdminDesc: "Comprehensive operational overview with real-time KPI metrics, daily consultation throughput, doctor availability, and audit activity stream.",
            cardAdminFeature1: "6 Real-Time Clinic KPI Metric Cards",
            cardAdminFeature2: "Daily Throughput & Wait-Time Trends",
            cardAdminFeature3: "Live Security & Transaction Audit Log",
            cardAdminBtn: "Admin Overview →",

            // How It Works / Workflow Section
            workflowTitle: "End-to-End Clinic Workflow",
            workflowSubtitle: "How the DoctorQueue smart flow minimizes waiting uncertainty and optimizes OPD throughput.",
            step1Title: "1. Slot Booking & Token",
            step1Desc: "Patient books online slot or gets a walk-in token at reception.",
            step2Title: "2. Real-Time Tracking",
            step2Desc: "Patient monitors queue position & dynamic ETA from phone or screen.",
            step3Title: "3. Reception Check-In",
            step3Desc: "Receptionist marks arrival and prepares queue for doctor call.",
            step4Title: "4. Doctor Consultation",
            step4Desc: "Doctor calls token, conducts consultation, and issues digital Rx.",

            // Footer
            footerCopy: "DoctorQueue SmartCare Core v1.0 • Live Queue & Clinic Operations",
            footerDb: "Database: PostgreSQL Active",
            footerInterval: "Polling: 5s Live Sync"
        },
        hi: {
            // Navbar & Brand
            brandName: "डॉक्टर कतार",
            clinicBadge: "स्मार्टकेयर",
            langBtnLabel: "हिन्दी ⇄ English",
            signInBtn: "साइन इन करें",
            signOutBtn: "साइन आउट",
            welcomeUser: "स्वागत है",

            // Sidebar
            navDashboard: "डैशबोर्ड",
            navBook: "अपॉइंटमेंट बुक करें",
            navTrack: "लाइव कतार / ट्रैकिंग",
            navReception: "रिसेप्शनिस्ट कतार",
            navDoctor: "डॉक्टर कतार",
            navAdmin: "एडमिन ओवरव्यू",
            systemStatus: "सिस्टम स्थिति",
            dbConnected: "पोस्टग्रेएसक्यूएल लाइव",
            opdActive: "ओपीडी प्रवाह सक्रिय",

            // Hero Banner
            heroBadge: "स्मार्टकेयर क्लिनिक प्रबंधन",
            heroTitle: "डॉक्टर अपॉइंटमेंट एवं कतार प्रबंधन पोर्टल",
            heroSubtitle: "वास्तविक समय अपॉइंटमेंट, लाइव कतार ट्रैकिंग, रिसेप्शनिस्ट डेस्क नियंत्रण, डॉक्टर परामर्श और क्लिनिक संचालन के लिए एकीकृत स्वास्थ्य सेवा पोर्टल।",
            liveSyncPill: "लाइव ओपीडी सक्रिय",

            // Quick Stats / Highlights
            statAppointmentsTitle: "स्मार्ट बुकिंग",
            statAppointmentsDesc: "ऑनलाइन स्लॉट एवं तत्काल वॉक-इन ओपीडी टोकन",
            statQueueTitle: "लाइव ट्रैकिंग",
            statQueueDesc: "प्रतीक्षा समय (ETA) पूर्वानुमान एवं कतार स्थिति",
            statDoctorTitle: "डॉक्टर डेस्क",
            statDoctorDesc: "1-क्लिक मरीज कॉलिंग, निदान एवं पर्चा रिकॉर्ड",
            statAdminTitle: "एडमिन कमांड",
            statAdminDesc: "वास्तविक समय मेट्रिक्स, थ्रूपुट विश्लेषण एवं ऑडिट",

            // Card 1: Book Appointment
            cardBookBadge: "मरीज बुकिंग",
            cardBookTitle: "अपॉइंटमेंट बुक करें",
            cardBookDesc: "चिकित्सा विभाग चुनें, विशेषज्ञ डॉक्टर चुनें, उपलब्ध तिथि व समय स्लॉट चुनें, या आज की ओपीडी के लिए तुरंत टोकन प्राप्त करें।",
            cardBookFeature1: "विशेषज्ञ डॉक्टर एवं विभाग फ़िल्टर",
            cardBookFeature2: "वास्तविक समय स्लॉट उपलब्धता ग्रिड",
            cardBookFeature3: "त्वरित टोकन पुष्टि एवं विवरण",
            cardBookBtn: "अपॉइंटमेंट बुक करें →",

            // Card 2: Live Queue / Tracking
            cardTrackBadge: "मरीज ट्रैकिंग",
            cardTrackTitle: "लाइव कतार / ट्रैकिंग",
            cardTrackDesc: "अपना लाइव टोकन नंबर देखें, आगे मौजूद मरीजों की संख्या जांचें, अनुमानित प्रतीक्षा समय (ETA) देखें और रूम कॉल अलर्ट प्राप्त करें।",
            cardTrackFeature1: "लाइव टोकन डिस्प्ले एवं कतार स्थान",
            cardTrackFeature2: "गतिशील प्रतीक्षा समय (ETA) पूर्वानुमान",
            cardTrackFeature3: "ऑडियो-विजुअल टर्न कॉल अलर्ट",
            cardTrackBtn: "लाइव कतार ट्रैक करें →",

            // Card 3: Receptionist Queue
            cardReceptionBadge: "डेस्क प्रबंधन",
            cardReceptionTitle: "रिसेप्शनिस्ट कतार",
            cardReceptionDesc: "आज की एकीकृत ओपीडी कतार प्रबंधित करें, नए वॉक-इन मरीजों का पंजीकरण करें, उपस्थिति सत्यापित करें और डॉक्टर कतार समन्वय करें।",
            cardReceptionFeature1: "1-क्लिक वॉक-इन टोकन जारी करें",
            cardReceptionFeature2: "उपस्थिति चेक-इन एवं कतार व्यवस्था",
            cardReceptionFeature3: "बहु-डॉक्टर लेन की लाइव स्थिति",
            cardReceptionBtn: "रिसेप्शनिस्ट डेस्क खोलें →",

            // Card 4: Doctor Queue
            cardDoctorBadge: "क्लिनिकल परामर्श",
            cardDoctorTitle: "डॉक्टर कतार",
            cardDoctorDesc: "अपनी परामर्श कतार प्रबंधित करें, प्राथमिकता से अगले मरीज को बुलाएं, क्लिनिकल निदान लिखें और डिजिटल दवा पर्चा जारी करें।",
            cardDoctorFeature1: "त्वरित 'अगला मरीज बुलाएं' एक्शन",
            cardDoctorFeature2: "क्लिनिकल निदान एवं मेडिकल नोट्स",
            cardDoctorFeature3: "दवा पर्चा प्रबंधन एवं इतिहास",
            cardDoctorBtn: "डॉक्टर परामर्श शुरू करें →",

            // Card 5: Admin Overview
            cardAdminBadge: "संचालन कमांड",
            cardAdminTitle: "एडमिन ओवरव्यू",
            cardAdminDesc: "वास्तविक समय KPI मेट्रिक्स, दैनिक परामर्श थ्रूपुट, डॉक्टर उपलब्धता रोस्टर और लाइव ऑडिट एक्टिविटी स्ट्रीम की विस्तृत समीक्षा।",
            cardAdminFeature1: "6 लाइव क्लिनिक KPI मेट्रिक्स कार्ड",
            cardAdminFeature2: "दैनिक थ्रूपुट एवं प्रतीक्षा रुझान",
            cardAdminFeature3: "लाइव सुरक्षा एवं लेनदेन ऑडिट लॉग",
            cardAdminBtn: "एडमिन एनालिटिक्स देखें →",

            // How It Works / Workflow Section
            workflowTitle: "क्लिनिक की सम्पूर्ण कार्यप्रणाली",
            workflowSubtitle: "डॉक्टरकतार की स्मार्ट प्रणाली कैसे प्रतीक्षा अनिश्चितता को घटाती है और ओपीडी कार्यक्षमता बढ़ाती है।",
            step1Title: "1. स्लॉट बुकिंग एवं टोकन",
            step1Desc: "मरीज ऑनलाइन स्लॉट बुक करता है या रिसेप्शन पर वॉक-इन टोकन लेता है।",
            step2Title: "2. लाइव ट्रैकिंग",
            step2Desc: "मरीज फोन या स्क्रीन से कतार स्थान एवं अनुमानित प्रतीक्षा समय देखता है।",
            step3Title: "3. रिसेप्शन चेक-इन",
            step3Desc: "रिसेप्शनिस्ट उपस्थिति दर्ज करता है और डॉक्टर के लिए कतार तैयार करता है।",
            step4Title: "4. डॉक्टर परामर्श",
            step4Desc: "डॉक्टर टोकन कॉल करते हैं, परामर्श पूरा करते हैं और डिजिटल पर्चा देते हैं।",

            // Footer
            footerCopy: "डॉक्टर कतार स्मार्टकेयर कोर v1.0 • लाइव कतार एवं क्लिनिक संचालन",
            footerDb: "डेटाबेस: पोस्टग्रेएसक्यूएल सक्रिय",
            footerInterval: "सिंक: 5 सेकंड अंतराल"
        }
    };

    /**
     * Get current dashboard language from localStorage or default to 'en'
     */
    function getDashboardLanguage() {
        const stored = localStorage.getItem('doctorqueue_lang');
        return (stored && stored.toLowerCase().startsWith('hi')) ? 'hi' : 'en';
    }

    /**
     * Apply translation strings to all DOM elements marked with [data-dash-i18n]
     */
    function applyDashboardTranslations(lang) {
        const dictionary = DASHBOARD_I18N[lang] || DASHBOARD_I18N.en;
        document.documentElement.lang = lang;

        const elements = document.querySelectorAll('[data-dash-i18n]');
        elements.forEach(el => {
            const key = el.getAttribute('data-dash-i18n');
            if (dictionary[key]) {
                el.textContent = dictionary[key];
            }
        });

        // Update placeholder texts if any
        const placeholders = document.querySelectorAll('[data-dash-placeholder]');
        placeholders.forEach(el => {
            const key = el.getAttribute('data-dash-placeholder');
            if (dictionary[key]) {
                el.placeholder = dictionary[key];
            }
        });

        // Update active language label in navbar button
        const langBtnLabel = document.getElementById('dashboard-lang-label');
        if (langBtnLabel) {
            langBtnLabel.textContent = lang === 'hi' ? 'हिन्दी ⇄ English' : 'English ⇄ हिन्दी';
        }
    }

    /**
     * Toggle between English and Hindi on user click
     */
    window.toggleDashboardLanguage = function () {
        const current = getDashboardLanguage();
        const next = (current === 'hi') ? 'en' : 'hi';

        localStorage.setItem('doctorqueue_lang', next);

        // Also sync with API helper if loaded
        if (typeof API !== 'undefined' && typeof API.setLanguage === 'function') {
            API.setLanguage(next);
        }
        if (typeof I18N !== 'undefined' && typeof I18N.setLanguage === 'function') {
            I18N.setLanguage(next);
        }

        applyDashboardTranslations(next);

        // Dispatch language change event for other listeners
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang: next } }));
    };

    /**
     * Mobile Sidebar & Drawer toggle handlers
     */
    window.toggleDashboardSidebar = function () {
        const sidebar = document.getElementById('dashboard-sidebar');
        const overlay = document.getElementById('dashboard-overlay');
        if (!sidebar) return;

        const isHidden = sidebar.classList.contains('-translate-x-full');
        if (isHidden) {
            sidebar.classList.remove('-translate-x-full');
            if (overlay) overlay.classList.remove('hidden');
            document.body.classList.add('overflow-hidden');
        } else {
            sidebar.classList.add('-translate-x-full');
            if (overlay) overlay.classList.add('hidden');
            document.body.classList.remove('overflow-hidden');
        }
    };

    window.closeDashboardSidebar = function () {
        const sidebar = document.getElementById('dashboard-sidebar');
        const overlay = document.getElementById('dashboard-overlay');
        if (sidebar) sidebar.classList.add('-translate-x-full');
        if (overlay) overlay.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
    };

    /**
     * Dynamic User Auth State Management
     */
    function updateDashboardAuthUI() {
        const authContainer = document.getElementById('dashboard-auth-container');
        if (!authContainer) return;

        let user = null;
        if (typeof API !== 'undefined' && typeof API.getUser === 'function') {
            user = API.getUser();
        } else {
            try {
                user = JSON.parse(localStorage.getItem('doctorqueue_current_user') || 'null');
            } catch (e) {
                user = null;
            }
        }

        if (user && user.full_name) {
            const roleBadges = {
                'PATIENT': 'bg-teal-50 text-teal-700 border-teal-200',
                'RECEPTIONIST': 'bg-indigo-50 text-indigo-700 border-indigo-200',
                'DOCTOR': 'bg-blue-50 text-blue-700 border-blue-200',
                'ADMIN': 'bg-amber-50 text-amber-700 border-amber-200'
            };

            authContainer.innerHTML = `
                <div class="flex items-center gap-2">
                    <div class="text-right hidden sm:block">
                        <div class="text-xs font-extrabold text-slate-900 leading-tight">${user.full_name}</div>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase ${roleBadges[user.role] || 'bg-slate-100 text-slate-700'}">${user.role}</span>
                    </div>
                    <button onclick="handleDashboardLogout()" class="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors border border-slate-200" title="Sign Out">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                        </svg>
                    </button>
                </div>
            `;
        }
    }

    window.handleDashboardLogout = function () {
        if (typeof API !== 'undefined' && typeof API.logout === 'function') {
            API.logout();
        } else {
            localStorage.removeItem('doctorqueue_access_token');
            localStorage.removeItem('doctorqueue_refresh_token');
            localStorage.removeItem('doctorqueue_current_user');
            window.location.href = '/login/';
        }
    };

    /**
     * Card interactive enhancement (Subtle tilt / pulse on hover)
     */
    function initCardInteractions() {
        const cards = document.querySelectorAll('.dashboard-module-card');
        cards.forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.classList.add('shadow-xl', 'border-blue-300');
            });
            card.addEventListener('mouseleave', () => {
                card.classList.remove('shadow-xl', 'border-blue-300');
            });
        });
    }

    /**
     * Initialize Dashboard on DOMContentLoaded
     */
    document.addEventListener('DOMContentLoaded', () => {
        const lang = getDashboardLanguage();
        applyDashboardTranslations(lang);
        updateDashboardAuthUI();
        initCardInteractions();

        // Listen for language changes from other components
        window.addEventListener('languageChanged', (e) => {
            if (e.detail && e.detail.lang) {
                applyDashboardTranslations(e.detail.lang);
            }
        });
    });

})();
