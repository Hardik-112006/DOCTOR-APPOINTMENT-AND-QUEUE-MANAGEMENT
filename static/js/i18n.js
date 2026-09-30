/**
 * Centralized Internationalization (i18n) Engine for DoctorQueue
 * Complete English & Hindi dynamic UI translation system.
 */

const I18N = (() => {
    const TRANSLATIONS = {
        en: {
            // Brand & Nav
            appName: "DoctorQueue",
            clinicBadge: "SmartCare",
            navDashboard: "Dashboard",
            navLiveQueue: "Live Queue",
            navBookToken: "Book Token",
            navReception: "Reception",
            navDoctorDesk: "Doctor Desk",
            navAdminOverview: "Admin Overview",
            signIn: "Sign In",
            signOut: "Sign Out",
            notifications: "Notifications",
            markAllRead: "Mark all read",
            noNotifications: "No notifications yet",

            // Footer
            footerTitle: "DoctorQueue Live Core v1.0 • SmartCare Clinic",
            dbSync: "PostgreSQL DB Sync",
            dbActive: "Active",
            pollingInterval: "Polling: 5s Interval",

            // Auth / Login Page
            loginBanner: "Live Clinic Management",
            loginHeader: "SmartCare Clinic Queue Portal",
            loginSubtitle: "Real-time appointments, unified queue flow, instant wait-time tracking, and doctor consultation management.",
            demoProfiles: "1-Click Demo Profiles",
            demoDesc: "Select any role to autofill test credentials (Password: Demo@123):",
            patientDemo: "Primary Patient (Token A-27)",
            patientDemoSub: "Aarav Sharma • 9000000001",
            patientDemoStatus: "Status: In Queue (30m ETA)",
            receptionistDemo: "Receptionist Desk",
            receptionistDemoSub: "Priya Receptionist • 9000000002",
            receptionistDemoStatus: "Manage unified queue & walk-ins",
            doctorDemo: "Doctor Consultation",
            doctorDemoSub: "Dr. Rajesh Kumar • 9000000003",
            doctorDemoStatus: "Call next, write notes, complete",
            adminDemo: "Clinic Admin",
            adminDemoSub: "Clinic Admin • 9000000005",
            adminDemoStatus: "Metrics, active queue, audit logs",
            useRole: "Use →",
            signInTitle: "Sign In to DoctorQueue",
            signInSubtitle: "Enter your registered mobile phone or email address.",
            phoneOrEmail: "Phone Number or Email",
            phoneOrEmailPlaceholder: "e.g. 9000000001 or aarav.patient@example.com",
            password: "Password",
            passwordPlaceholder: "Enter your password",
            signInBtn: "Sign In to Dashboard",
            newPatientPrompt: "New patient?",
            registerNewAccount: "Register New Account",

            // Registration Modal
            patientRegistration: "Patient Registration",
            regSubtitle: "Create an account to book and track doctor appointments.",
            fullName: "Full Name *",
            fullNamePlaceholder: "e.g. Aarav Sharma",
            mobilePhone: "Mobile Phone *",
            phonePlaceholder: "10-digit number",
            emailOptional: "Email (Optional)",
            emailPlaceholder: "patient@example.com",
            dateOfBirth: "Date of Birth",
            gender: "Gender",
            genderMale: "Male",
            genderFemale: "Female",
            genderOther: "Other",
            createPassword: "Password * (min 6 characters)",
            createPasswordPlaceholder: "Create password",
            completeRegistrationBtn: "Complete Registration",

            // Book Appointment Page
            bookApptHeader: "Book Doctor Appointment",
            bookApptSubtitle: "Select a specialist doctor, preferred consultation slot, and confirm your real-time queue token.",
            selectDepartment: "1. Select Medical Department / Specialty",
            allSpecialties: "All Specialties",
            selectDoctor: "2. Choose Doctor & View Profile",
            loadingDoctors: "Loading available doctors...",
            noDoctorsFound: "No doctors available for this department today.",
            experience: "Experience",
            yearsExp: "yrs experience",
            consultationFee: "Consultation Fee",
            availableToday: "Available Today",
            offlineToday: "Offline Today",
            selectBtn: "Select",
            selectedBtn: "Selected ✓",
            selectDoctorBtn: "Select Doctor & Schedule",
            selectedDoctorBadge: "Selected Doctor",
            bookingDetails: "3. Choose Date & Slot",
            appointmentDate: "Appointment Date",
            appointmentType: "Appointment Type",
            typeOnline: "Online Booking (Advance Slot)",
            typeWalkIn: "Walk-In / Immediate Queue Token",
            availableSlots: "Available Slots",
            selectSlotPrompt: "Select a doctor and date to view time slots.",
            noSlotsToday: "No time slots scheduled for this date. You can still book a Walk-in / Queue Token.",
            bookingSummary: "Appointment Summary",
            summaryDoctor: "Selected Doctor",
            summaryDept: "Department",
            summaryDate: "Date",
            summarySlot: "Selected Time Slot",
            summaryFee: "Consultation Fee",
            selectDoctorPrompt: "Select a doctor above",
            anyAvailableSlot: "Any Available Slot",
            statusAvailable: "AVAILABLE",
            statusBooked: "BOOKED",
            confirmingBooking: "Confirming Booking...",
            confirmBookingBtn: "Confirm & Generate Token",
            bookingConfirmed: "Appointment Confirmed!",
            bookingConfirmedSubtitle: "Your queue token has been generated successfully.",
            tokenNumber: "Token Number",
            estimatedWait: "Estimated Wait Time",
            goToTrack: "Go to Live Queue Tracking →",
            close: "Close",

            // Patient Dashboard & Live Tracking
            liveQueueSync: "Live Queue Sync",
            lastUpdated: "Updated",
            refresh: "⟳ Refresh",
            bookAnother: "+ Book Another",
            turnAlert: "Turn Alert",
            proceedToRoom: "Please Proceed to Consultation Room!",
            doctorCalledMsg: "The doctor has called your token. Please step inside immediately.",
            doctorIsReady: "Doctor is Ready",
            noActiveToken: "No Active Queue Token Found",
            noActiveTokenDesc: "You don't have an active appointment for today. Book an appointment or register with the clinic.",
            bookAppointmentNow: "Book Appointment Now →",
            yourActiveToken: "Your Active Token",
            queuePosition: "Queue Position",
            patientsAhead: "Patients Ahead",
            dynamicEta: "Dynamic ETA",
            consultingDoctor: "Consulting Doctor:",
            department: "Department:",
            consultationFlowStage: "Consultation Flow Stage",
            statusWaiting: "Waiting",
            statusCalled: "Called",
            statusConsulting: "Consulting",
            statusCompleted: "Completed",
            statusCancelled: "Cancelled",
            myAppointments: "My Appointments",
            myAppointmentsSubtitle: "All appointments and active queue tokens for your profile",
            date: "Date",
            timeSlot: "Time / Slot",
            cancelAppt: "Cancel",
            currentlyTracking: "Live Tracking",
            trackThis: "Track Live →",
            generalQueue: "General Queue",
            noAppointmentsBooked: "No appointments booked yet.",
            bookFirstAppt: "+ Book your first appointment",

            // Doctor Consultation Desk
            doctorConsultationDesk: "Doctor Consultation Desk",
            doctorDeskSubtitle: "Manage consultations, call waiting patients in order, record clinical notes & prescriptions.",
            callNextPatient: "🔔 Call Next Patient",
            todaysQueue: "Today's Patient Queue",
            waitingCount: "Waiting",
            nextInQueue: "Next Patient in Queue",
            callToRoom: "Call to Room",
            startConsultation: "Start Consultation",
            completeAndNext: "Complete & Next",
            clinicalNotes: "Clinical Notes & Observations",
            notesPlaceholder: "Patient symptoms, examination findings, diagnosis...",
            prescriptionAdvice: "Prescription & Advice",
            prescriptionPlaceholder: "Medication dosage, follow-up instructions, diet advice...",
            saveDraft: "Save Notes Draft",
            saveAndComplete: "Save & Complete Consultation ✓",
            noPatientInRoom: "No Patient Currently in Consultation Room",
            callNextPatientPrompt: "Click \"Call Next Patient\" to notify the next waiting patient to enter the consultation room.",
            noAppointmentsInQueue: "No appointments in today's queue.",
            walkIn: "Walk-in",

            // Receptionist Dashboard
            receptionistControlCenter: "Receptionist Control Center",
            receptionistSubtitle: "Unified clinic queue operations, instant walk-in registration, and patient queue monitoring.",
            registerWalkIn: "+ Register Walk-In Patient",
            allDoctors: "All Doctors",
            filterByDoctor: "Filter by Doctor",
            filterByStatus: "Filter by Status",
            allStatuses: "All Statuses",
            liveQueueMonitor: "Live Queue Monitor",
            token: "Token",
            patient: "Patient",
            doctor: "Doctor",
            type: "Type",
            status: "Status",
            actions: "Actions",
            call: "Call",
            markArrived: "Mark Arrived",
            arrived: "Arrived",

            // Admin Dashboard
            clinicAdminOverview: "Clinic Operational Command Center",
            adminSubtitle: "Live overview of appointments, patient queue throughput, doctor availability, and audit logs.",
            totalAppointments: "Total Tokens",
            waitingPatients: "Waiting Patients",
            completedConsultations: "Completed Today",
            avgWaitTime: "Avg Wait Time",
            recentActivityLogs: "Recent Clinic Activity Logs",
            liveAuditTitle: "Live Audit & Activity Trail",
            liveAuditSubtitle: "Real-time audit log stream of clinic events and transactions.",
            dailyProgressTitle: "Daily Progress & Throughput",
            dailyProgressSubtitle: "Real-time completed vs scheduled consultation progress per day.",
            pastActivitiesTitle: "Past Activities & Historical Audit Trail",
            pastActivitiesSubtitle: "Comprehensive chronological log of all past clinic system actions, logins, and consultation events.",
            today: "Today",
            completed: "Completed",
            total: "Total",
            showingLogs: "Showing logs",
            previous: "Previous",
            next: "Next",
            action: "Action",
            actor: "Actor / User",
            role: "Role",
            entity: "Entity",
            timestamp: "Timestamp",
            noPastActivities: "No past activities recorded yet.",

            // Department Names Translations
            "General Medicine": "General Medicine",
            "Cardiology": "Cardiology",
            "Dermatology": "Dermatology",
            "Orthopedics": "Orthopedics",
            "Gynecology": "Gynecology",
            "Pediatrics": "Pediatrics",
            "Neurology": "Neurology",
            "ENT": "ENT",

            // Common / Messages
            loading: "Loading...",
            success: "Success",
            error: "Error",
            warning: "Warning",
            info: "Info",
            loginSuccess: "Login successful!",
            logoutSuccess: "Logged out successfully",
            refreshingQueue: "Refreshing queue state...",
            doctorCalledToast: "Dr. has called your token! Please proceed to Consultation Room.",
            confirmCancelAppt: "Are you sure you want to cancel this appointment?",
            apptCancelled: "Appointment cancelled successfully.",
            appointmentsCount: "Appointments"
        },

        hi: {
            // Brand & Nav
            appName: "डॉक्टर कतार",
            clinicBadge: "स्मार्टकेयर",
            navDashboard: "डैशबोर्ड",
            navLiveQueue: "लाइव कतार",
            navBookToken: "टोकन बुक करें",
            navReception: "रिसेप्शन",
            navDoctorDesk: "डॉक्टर डेस्क",
            navAdminOverview: "व्यवस्थापक दृश्य",
            signIn: "लॉग इन",
            signOut: "लॉग आउट",
            notifications: "सूचनाएं",
            markAllRead: "सभी पढ़ी गईं",
            noNotifications: "कोई नई सूचना नहीं",

            // Footer
            footerTitle: "डॉक्टर कतार लाइव कोर v1.0 • स्मार्टकेयर क्लिनिक",
            dbSync: "PostgreSQL डेटाबेस सिंक",
            dbActive: "सक्रिय",
            pollingInterval: "डेटा रिफ्रेश: 5 सेकंड अंतराल",

            // Auth / Login Page
            loginBanner: "लाइव क्लिनिक प्रबंधन",
            loginHeader: "स्मार्टकेयर क्लिनिक कतार पोर्टल",
            loginSubtitle: "वास्तविक समय की अपॉइंटमेंट, एकीकृत कतार प्रबंधन, त्वरित प्रतीक्षा समय ट्रैकिंग और डॉक्टर परामर्श।",
            demoProfiles: "1-क्लिक डेमो प्रोफाइल",
            demoDesc: "डेमो क्रेडेंशियल स्वतः भरने के लिए कोई भी भूमिका चुनें (पासवर्ड: Demo@123):",
            patientDemo: "प्राथमिक मरीज (टोकन A-27)",
            patientDemoSub: "आरव शर्मा • 9000000001",
            patientDemoStatus: "स्थिति: कतार में (30 मिनट अनुमानित समय)",
            receptionistDemo: "रिसेप्शनिस्ट डेस्क",
            receptionistDemoSub: "प्रिया रिसेप्शनिस्ट • 9000000002",
            receptionistDemoStatus: "एकीकृत कतार और वॉक-इन प्रबंधित करें",
            doctorDemo: "डॉक्टर परामर्श",
            doctorDemoSub: "डॉ. राजेश कुमार • 9000000003",
            doctorDemoStatus: "कॉल करें, नोट्स लिखें, परामर्श पूरा करें",
            adminDemo: "क्लिनिक व्यवस्थापक",
            adminDemoSub: "क्लिनिक व्यवस्थापक • 9000000005",
            adminDemoStatus: "मेट्रिक्स, सक्रिय कतार, ऑडिट लॉग",
            useRole: "उपयोग करें →",
            signInTitle: "डॉक्टर कतार में साइन इन करें",
            signInSubtitle: "अपना पंजीकृत मोबाइल नंबर या ईमेल पता दर्ज करें।",
            phoneOrEmail: "मोबाइल नंबर या ईमेल",
            phoneOrEmailPlaceholder: "उदा. 9000000001 या aarav.patient@example.com",
            password: "पासवर्ड",
            passwordPlaceholder: "अपना पासवर्ड दर्ज करें",
            signInBtn: "डैशबोर्ड में साइन इन करें",
            newPatientPrompt: "नए मरीज हैं?",
            registerNewAccount: "नया खाता पंजीकृत करें",

            // Registration Modal
            patientRegistration: "मरीज पंजीकरण",
            regSubtitle: "डॉक्टर अपॉइंटमेंट बुक करने और ट्रैक करने के लिए खाता बनाएं।",
            fullName: "पूरा नाम *",
            fullNamePlaceholder: "उदा. आरव शर्मा",
            mobilePhone: "मोबाइल नंबर *",
            phonePlaceholder: "10 अंकों का मोबाइल नंबर",
            emailOptional: "ईमेल (वैकल्पिक)",
            emailPlaceholder: "patient@example.com",
            dateOfBirth: "जन्म तिथि",
            gender: "लिंग",
            genderMale: "पुरुष",
            genderFemale: "महिला",
            genderOther: "अन्य",
            createPassword: "पासवर्ड * (न्यूनतम 6 अक्षर)",
            createPasswordPlaceholder: "पासवर्ड बनाएं",
            completeRegistrationBtn: "पंजीकरण पूरा करें",

            // Book Appointment Page
            bookApptHeader: "डॉक्टर अपॉइंटमेंट बुक करें",
            bookApptSubtitle: "विशेषज्ञ डॉक्टर चुनें, पसंदीदा परामर्श स्लॉट चुनें और अपना वास्तविक समय का कतार टोकन सुरक्षित करें।",
            selectDepartment: "1. चिकित्सा विभाग / विशेषज्ञता चुनें",
            allSpecialties: "सभी विभाग",
            selectDoctor: "2. डॉक्टर चुनें और प्रोफाइल देखें",
            loadingDoctors: "उपलब्ध डॉक्टरों को लोड किया जा रहा है...",
            noDoctorsFound: "आज इस विभाग के लिए कोई डॉक्टर उपलब्ध नहीं है।",
            experience: "अनुभव",
            yearsExp: "वर्ष का अनुभव",
            consultationFee: "परामर्श शुल्क",
            availableToday: "आज उपलब्ध",
            offlineToday: "आज अनुपलब्ध",
            selectBtn: "चुनें",
            selectedBtn: "चयनित ✓",
            selectDoctorBtn: "डॉक्टर चुनें और समय निर्धारित करें",
            selectedDoctorBadge: "चयनित डॉक्टर",
            bookingDetails: "3. तिथि और स्लॉट चुनें",
            appointmentDate: "अपॉइंटमेंट तिथि",
            appointmentType: "अपॉइंटमेंट प्रकार",
            typeOnline: "ऑनलाइन पूर्व-बुकिंग (अग्रिम स्लॉट)",
            typeWalkIn: "वॉक-इन / त्वरित कतार टोकन",
            availableSlots: "उपलब्ध स्लॉट",
            selectSlotPrompt: "समय स्लॉट देखने के लिए डॉक्टर और तिथि चुनें।",
            noSlotsToday: "इस तिथि के लिए कोई स्लॉट नहीं है। आप वॉक-इन टोकन बुक कर सकते हैं।",
            bookingSummary: "अपॉइंटमेंट सारांश",
            summaryDoctor: "चयनित डॉक्टर",
            summaryDept: "विभाग",
            summaryDate: "तिथि",
            summarySlot: "चयनित समय स्लॉट",
            summaryFee: "परामर्श शुल्क",
            selectDoctorPrompt: "ऊपर से डॉक्टर चुनें",
            anyAvailableSlot: "कोई भी उपलब्ध स्लॉट",
            statusAvailable: "उपलब्ध",
            statusBooked: "आरक्षित",
            confirmingBooking: "बुकिंग की पुष्टि हो रही है...",
            confirmBookingBtn: "पुष्टि करें और टोकन प्राप्त करें",
            bookingConfirmed: "अपॉइंटमेंट की पुष्टि हो गई!",
            bookingConfirmedSubtitle: "आपका कतार टोकन सफलतापूर्वक जारी कर दिया गया है।",
            tokenNumber: "टोकन नंबर",
            estimatedWait: "अनुमानित प्रतीक्षा समय",
            goToTrack: "लाइव कतार ट्रैकिंग पर जाएं →",
            close: "बंद करें",

            // Patient Dashboard & Live Tracking
            liveQueueSync: "लाइव कतार सिंक",
            lastUpdated: "अपडेट",
            refresh: "⟳ ताज़ा करें",
            bookAnother: "+ दूसरा बुक करें",
            turnAlert: "आपकी बारी की चेतावनी",
            proceedToRoom: "कृपया परामर्श कक्ष में प्रवेश करें!",
            doctorCalledMsg: "डॉक्टर ने आपका टोकन बुलाया है। कृपया तुरंत अंदर आएं।",
            doctorIsReady: "डॉक्टर तैयार हैं",
            noActiveToken: "कोई सक्रिय कतार टोकन नहीं मिला",
            noActiveTokenDesc: "आज के लिए आपकी कोई सक्रिय अपॉइंटमेंट नहीं है। नया अपॉइंटमेंट बुक करें या क्लिनिक में पंजीकरण कराएं।",
            bookAppointmentNow: "अभी अपॉइंटमेंट बुक करें →",
            yourActiveToken: "आपका सक्रिय टोकन",
            queuePosition: "कतार में स्थान",
            patientsAhead: "आगे मरीज",
            dynamicEta: "अनुमानित समय",
            consultingDoctor: "परामर्शदाता डॉक्टर:",
            department: "विभाग:",
            consultationFlowStage: "परामर्श प्रगति चरण",
            statusWaiting: "प्रतीक्षारत",
            statusCalled: "बुलाया गया",
            statusConsulting: "परामर्श जारी",
            statusCompleted: "पूर्ण",
            statusCancelled: "रद्द",
            myAppointments: "मेरी अपॉइंटमेंट",
            myAppointmentsSubtitle: "आपके खाते की सभी अपॉइंटमेंट और सक्रिय कतार टोकन",
            date: "तिथि",
            timeSlot: "समय / स्लॉट",
            cancelAppt: "रद्द करें",
            currentlyTracking: "लाइव ट्रैकिंग",
            trackThis: "लाइव ट्रैक करें →",
            generalQueue: "सामान्य कतार",
            noAppointmentsBooked: "अभी तक कोई अपॉइंटमेंट बुक नहीं की गई है।",
            bookFirstAppt: "+ अपनी पहली अपॉइंटमेंट बुक करें",

            // Doctor Consultation Desk
            doctorConsultationDesk: "डॉक्टर परामर्श डेस्क",
            doctorDeskSubtitle: "परामर्श प्रबंधित करें, कतार अनुसार मरीजों को बुलाएं, और नुस्खे दर्ज करें।",
            callNextPatient: "🔔 अगले मरीज को बुलाएं",
            todaysQueue: "आज की मरीज कतार",
            waitingCount: "प्रतीक्षारत",
            nextInQueue: "कतार में अगला मरीज",
            callToRoom: "कक्ष में बुलाएं",
            startConsultation: "परामर्श शुरू करें",
            completeAndNext: "पूर्ण करें और अगला बुलाएं",
            clinicalNotes: "नैदानिक नोट्स और निष्कर्ष",
            notesPlaceholder: "मरीज के लक्षण, जांच निष्कर्ष, निदान...",
            prescriptionAdvice: "दवाएं और सलाह",
            prescriptionPlaceholder: "दवा की खुराक, अनुवर्ती निर्देश, आहार सलाह...",
            saveDraft: "नोट्स ड्राफ्ट सहेजें",
            saveAndComplete: "सहेजें और परामर्श पूरा करें ✓",
            noPatientInRoom: "वर्तमान में परामर्श कक्ष में कोई मरीज नहीं है",
            callNextPatientPrompt: "\"अगले मरीज को बुलाएं\" पर क्लिक करें ताकि अगले प्रतीक्षारत मरीज को कक्ष में बुलाया जा सके।",
            noAppointmentsInQueue: "आज की कतार में कोई अपॉइंटमेंट नहीं है।",
            walkIn: "वॉक-इन",

            // Receptionist Dashboard
            receptionistControlCenter: "रिसेप्शनिस्ट नियंत्रण केंद्र",
            receptionistSubtitle: "एकीकृत क्लिनिक कतार संचालन, त्वरित वॉक-इन पंजीकरण, और कतार निगरानी।",
            registerWalkIn: "+ वॉक-इन मरीज पंजीकृत करें",
            allDoctors: "सभी डॉक्टर",
            filterByDoctor: "डॉक्टर द्वारा फ़िल्टर करें",
            filterByStatus: "स्थिति द्वारा फ़िल्टर करें",
            allStatuses: "सभी स्थितियां",
            liveQueueMonitor: "लाइव कतार मॉनिटर",
            token: "टोकन",
            patient: "मरीज",
            doctor: "डॉक्टर",
            type: "प्रकार",
            status: "स्थिति",
            actions: "कार्रवाई",
            call: "कॉल करें",
            markArrived: "उपस्थित चिह्नित करें",
            arrived: "उपस्थित",

            // Admin Dashboard
            clinicAdminOverview: "क्लिनिक परिचालन कमान केंद्र",
            adminSubtitle: "अपॉइंटमेंट, मरीज कतार प्रवाह, डॉक्टर उपलब्धता और ऑडिट लॉग का लाइव अवलोकन।",
            totalAppointments: "कुल टोकन",
            waitingPatients: "प्रतीक्षारत मरीज",
            completedConsultations: "आज पूर्ण परामर्श",
            avgWaitTime: "औसत प्रतीक्षा समय",
            recentActivityLogs: "हाल के क्लिनिक गतिविधि लॉग",
            liveAuditTitle: "लाइव ऑडिट और गतिविधि इतिहास",
            liveAuditSubtitle: "क्लिनिक घटनाओं और लेनदेन का रीयल-टाइम ऑडिट लॉग",
            dailyProgressTitle: "दैनिक प्रगति और थ्रूपुट",
            dailyProgressSubtitle: "प्रति दिन पूर्ण बनाम निर्धारित परामर्श प्रगति",
            today: "आज",
            completed: "पूर्ण",
            total: "कुल",

            // Department Names Translations in Hindi
            "General Medicine": "सामान्य चिकित्सा",
            "Cardiology": "हृदय रोग",
            "Dermatology": "त्वचा रोग",
            "Orthopedics": "हड्डी रोग",
            "Gynecology": "स्त्री रोग",
            "Pediatrics": "बाल रोग",
            "Neurology": "न्यूरोलॉजी",
            "ENT": "ईएनटी (नाक-कान-गला)",

            // Patient Dashboard & Live Tracking
            liveQueueSync: "लाइव कतार सिंक",
            lastUpdated: "अपडेट",
            refresh: "⟳ ताज़ा करें",
            bookAnother: "+ दूसरा बुक करें",
            turnAlert: "आपकी बारी की चेतावनी",
            proceedToRoom: "कृपया परामर्श कक्ष में प्रवेश करें!",
            doctorCalledMsg: "डॉक्टर ने आपका टोकन बुलाया है। कृपया तुरंत अंदर आएं।",
            doctorIsReady: "डॉक्टर तैयार हैं",
            noActiveToken: "कोई सक्रिय कतार टोकन नहीं मिला",
            noActiveTokenDesc: "आज के लिए आपकी कोई सक्रिय अपॉइंटमेंट नहीं है। नया अपॉइंटमेंट बुक करें या क्लिनिक में पंजीकरण कराएं।",
            bookAppointmentNow: "अभी अपॉइंटमेंट बुक करें →",
            yourActiveToken: "आपका सक्रिय टोकन",
            queuePosition: "कतार में स्थान",
            patientsAhead: "आगे मरीज",
            dynamicEta: "अनुमानित समय",
            consultingDoctor: "परामर्शदाता डॉक्टर:",
            department: "विभाग:",
            consultationFlowStage: "परामर्श प्रगति चरण",
            statusWaiting: "प्रतीक्षारत",
            statusCalled: "बुलाया गया",
            statusConsulting: "परामर्श जारी",
            statusCompleted: "पूर्ण",
            statusCancelled: "रद्द",
            myAppointments: "मेरी अपॉइंटमेंट",
            myAppointmentsSubtitle: "आपके खाते की सभी अपॉइंटमेंट और सक्रिय कतार टोकन",
            date: "तिथि",
            timeSlot: "समय / स्लॉट",
            cancelAppt: "रद्द करें",
            currentlyTracking: "लाइव ट्रैकिंग",
            trackThis: "लाइव ट्रैक करें →",
            generalQueue: "सामान्य कतार",
            noAppointmentsBooked: "अभी तक कोई अपॉइंटमेंट बुक नहीं की गई है।",
            bookFirstAppt: "+ अपनी पहली अपॉइंटमेंट बुक करें",

            // Doctor Consultation Desk
            doctorConsultationDesk: "डॉक्टर परामर्श डेस्क",
            doctorDeskSubtitle: "परामर्श प्रबंधित करें, कतार अनुसार मरीजों को बुलाएं, और नुस्खे दर्ज करें।",
            callNextPatient: "🔔 अगले मरीज को बुलाएं",
            todaysQueue: "आज की मरीज कतार",
            waitingCount: "प्रतीक्षारत",
            nextInQueue: "कतार में अगला मरीज",
            callToRoom: "कक्ष में बुलाएं",
            startConsultation: "परामर्श शुरू करें",
            completeAndNext: "पूर्ण करें और अगला बुलाएं",
            clinicalNotes: "नैदानिक नोट्स और निष्कर्ष",
            notesPlaceholder: "मरीज के लक्षण, जांच निष्कर्ष, निदान...",
            prescriptionAdvice: "दवाएं और सलाह",
            prescriptionPlaceholder: "दवा की खुराक, अनुवर्ती निर्देश, आहार सलाह...",
            saveDraft: "नोट्स ड्राफ्ट सहेजें",
            saveAndComplete: "सहेजें और परामर्श पूरा करें ✓",
            noPatientInRoom: "वर्तमान में परामर्श कक्ष में कोई मरीज नहीं है",
            callNextPatientPrompt: "\"अगले मरीज को बुलाएं\" पर क्लिक करें ताकि अगले प्रतीक्षारत मरीज को कक्ष में बुलाया जा सके।",
            noAppointmentsInQueue: "आज की कतार में कोई अपॉइंटमेंट नहीं है।",
            walkIn: "वॉक-इन",

            // Receptionist Dashboard
            receptionistControlCenter: "रिसेप्शनिस्ट नियंत्रण केंद्र",
            receptionistSubtitle: "एकीकृत क्लिनिक कतार संचालन, त्वरित वॉक-इन पंजीकरण, और कतार निगरानी।",
            registerWalkIn: "+ वॉक-इन मरीज पंजीकृत करें",
            allDoctors: "सभी डॉक्टर",
            filterByDoctor: "डॉक्टर द्वारा फ़िल्टर करें",
            filterByStatus: "स्थिति द्वारा फ़िल्टर करें",
            allStatuses: "सभी स्थितियां",
            liveQueueMonitor: "लाइव कतार मॉनिटर",
            token: "टोकन",
            patient: "मरीज",
            doctor: "डॉक्टर",
            type: "प्रकार",
            status: "स्थिति",
            actions: "कार्रवाई",
            call: "कॉल करें",
            markArrived: "उपस्थित चिह्नित करें",
            arrived: "उपस्थित",

            // Admin Dashboard
            clinicAdminOverview: "क्लिनिक परिचालन कमान केंद्र",
            adminSubtitle: "अपॉइंटमेंट, मरीज कतार प्रवाह, डॉक्टर उपलब्धता और ऑडिट लॉग का लाइव अवलोकन।",
            totalAppointments: "कुल टोकन",
            waitingPatients: "प्रतीक्षारत मरीज",
            completedConsultations: "आज पूर्ण परामर्श",
            avgWaitTime: "औसत प्रतीक्षा समय",
            recentActivityLogs: "हाल के क्लिनिक गतिविधि लॉग",
            liveAuditTitle: "लाइव ऑडिट और गतिविधि इतिहास",
            liveAuditSubtitle: "क्लिनिक घटनाओं और लेनदेन का रीयल-टाइम ऑडिट लॉग।",
            dailyProgressTitle: "दैनिक प्रगति और थ्रूपुट",
            dailyProgressSubtitle: "प्रति दिन पूर्ण बनाम निर्धारित परामर्श प्रगति।",
            pastActivitiesTitle: "पिछली गतिविधियाँ और ऐतिहासिक ऑडिट लॉग",
            pastActivitiesSubtitle: "सभी पिछली क्लिनिक गतिविधियों, लॉगिन और परामर्श घटनाओं का विस्तृत इतिहास।",
            today: "आज",
            completed: "पूर्ण",
            total: "कुल",
            showingLogs: "लॉग प्रदर्शित",
            previous: "पिछला",
            next: "अगला",
            action: "कार्रवाई",
            actor: "उपयोगकर्ता",
            role: "भूमिका",
            entity: "इकाई",
            timestamp: "समय",
            noPastActivities: "कोई पिछली गतिविधि दर्ज नहीं है।",

            // Common / Messages
            loading: "लोड हो रहा है...",
            success: "सफलता",
            error: "त्रुटि",
            warning: "चेतावनी",
            info: "सूचना",
            loginSuccess: "सफलतापूर्वक साइन इन किया!",
            logoutSuccess: "सफलतापूर्वक लॉग आउट किया",
            refreshingQueue: "कतार की स्थिति ताज़ा की जा रही है...",
            doctorCalledToast: "डॉक्टर ने आपका टोकन बुलाया है! कृपया परामर्श कक्ष में जाएं।",
            confirmCancelAppt: "क्या आप वाकई इस अपॉइंटमेंट को रद्द करना चाहते हैं?",
            apptCancelled: "अपॉइंटमेंट सफलतापूर्वक रद्द कर दी गई।",
            appointmentsCount: "अपॉइंटमेंट"
        }
    };

    const getLanguage = () => {
        const raw = (localStorage.getItem('doctorqueue_lang') || 'en').trim().toLowerCase();
        if (raw.startsWith('hi')) return 'hi';
        return 'en';
    };

    const setLanguage = (lang) => {
        const normalized = (lang && String(lang).trim().toLowerCase().startsWith('hi')) ? 'hi' : 'en';
        localStorage.setItem('doctorqueue_lang', normalized);
        document.documentElement.lang = normalized;
        const langDropdown = document.getElementById('lang-selector');
        if (langDropdown) {
            langDropdown.value = normalized;
        }
        applyTranslations();
    };

    const t = (key, fallback = '') => {
        const lang = getLanguage();
        if (TRANSLATIONS[lang] && TRANSLATIONS[lang][key] !== undefined) {
            return TRANSLATIONS[lang][key];
        }
        if (TRANSLATIONS.en && TRANSLATIONS.en[key] !== undefined) {
            return TRANSLATIONS.en[key];
        }
        return fallback || key;
    };

    const applyTranslations = (root = document) => {
        const lang = getLanguage();
        document.documentElement.lang = lang;

        // 1. Text elements with data-i18n
        root.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (key) {
                el.textContent = t(key, el.textContent);
            }
        });

        // 2. Placeholder elements with data-i18n-placeholder
        root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const key = el.getAttribute('data-i18n-placeholder');
            if (key) {
                el.placeholder = t(key, el.placeholder);
            }
        });

        // 3. Title attributes with data-i18n-title
        root.querySelectorAll('[data-i18n-title]').forEach(el => {
            const key = el.getAttribute('data-i18n-title');
            if (key) {
                el.title = t(key, el.title);
            }
        });

        // 4. Sync language select dropdown if present
        const langDropdown = document.getElementById('lang-selector');
        if (langDropdown) {
            langDropdown.value = lang;
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        applyTranslations();
    });

    return {
        t,
        getLanguage,
        setLanguage,
        applyTranslations,
        TRANSLATIONS
    };
})();
