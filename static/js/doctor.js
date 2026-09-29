/**
 * Doctor Desk & Consultation Controller
 * Manages doctor consultation flow, queue transitions, clinical notes, and prescriptions.
 */

let doctorQueue = [];
let activePatient = null;
let doctorPollInterval = null;
let selectedDoctorDate = new Date().toISOString().split('T')[0];
let selectedDoctorId = null;

document.addEventListener('DOMContentLoaded', async () => {
    API.requireAuth(['DOCTOR', 'ADMIN']);

    const dateInput = document.getElementById('doctor-queue-date');
    if (dateInput) {
        dateInput.value = selectedDoctorDate;
        dateInput.addEventListener('change', (e) => {
            selectedDoctorDate = e.target.value;
            loadDoctorQueue();
        });
    }

    const user = API.getUser();
    if (user && user.role === 'ADMIN') {
        await loadDoctorsListForAdmin();
    }

    await loadDoctorQueue();
    startDoctorPolling();
});

async function loadDoctorsListForAdmin() {
    const wrapper = document.getElementById('doctor-select-wrapper');
    const dropdown = document.getElementById('doctor-select-dropdown');
    if (!wrapper || !dropdown) return;

    const res = await API.get('/doctors/');
    if (res.ok && res.data) {
        const docs = Array.isArray(res.data) ? res.data : (res.data.data || []);
        if (docs.length > 0) {
            wrapper.classList.remove('hidden');
            dropdown.innerHTML = docs.map(d => {
                const spec = d.specialization || d.department_name || 'General';
                const specTranslated = typeof I18N !== 'undefined' ? I18N.t(spec, spec) : spec;
                return `<option value="${d.id}">${d.full_name || d.doctor_name || d.name} (${specTranslated})</option>`;
            }).join('');
            selectedDoctorId = docs[0].id;
        }
    }
}

function switchDoctorQueue(docId) {
    selectedDoctorId = parseInt(docId);
    activePatient = null;
    loadDoctorQueue();
}

function startDoctorPolling() {
    if (doctorPollInterval) clearInterval(doctorPollInterval);
    doctorPollInterval = setInterval(loadDoctorQueue, 5000);
}

async function loadDoctorQueue() {
    const params = { date: selectedDoctorDate };
    if (selectedDoctorId) params.doctor_id = selectedDoctorId;

    const res = await API.get('/queue/live/', params);
    if (!res.ok || !res.data) return;

    doctorQueue = res.data.queue || [];

    // Update doctor header badge
    const docBadge = document.getElementById('doc-badge');
    if (docBadge) {
        const user = API.getUser();
        const docName = res.data.doctor_name || (user ? user.full_name : '');
        const spec = res.data.specialization ? ` • ${res.data.specialization}` : '';
        if (docName) {
            docBadge.textContent = `${docName}${spec}`;
            docBadge.classList.remove('hidden');
        }
    }

    renderQueueSidebar();

    // Identify active patient (first with CONSULTING or CALLED)
    const currentActive = doctorQueue.find(e => e.status === 'CONSULTING' || e.status === 'CALLED');

    if (currentActive) {
        if (!activePatient || activePatient.appointment_id !== currentActive.appointment_id || activePatient.status !== currentActive.status) {
            setActivePatient(currentActive);
        }
    } else if (activePatient) {
        const refreshed = doctorQueue.find(e => e.appointment_id === activePatient.appointment_id);
        if (refreshed && refreshed.status !== 'COMPLETED') {
            setActivePatient(refreshed);
        } else {
            renderWaitingOrEmptyState();
        }
    } else {
        renderWaitingOrEmptyState();
    }
}

function renderWaitingOrEmptyState() {
    const waitingPatients = doctorQueue.filter(e => e.status === 'WAITING');
    if (waitingPatients.length > 0) {
        // Automatically show details of the next waiting patient
        renderNextWaitingPatientCard(waitingPatients[0]);
    } else {
        renderNoActivePatientState();
    }
}

function renderQueueSidebar() {
    const list = document.getElementById('waiting-queue-list');
    const waitingCountEl = document.getElementById('waiting-count-badge');
    if (!list) return;

    const waitingPatients = doctorQueue.filter(e => e.status === 'WAITING');
    if (waitingCountEl) {
        const waitingText = typeof I18N !== 'undefined'
            ? `${waitingPatients.length} ${I18N.t('waitingCount', 'Waiting')}`
            : `${waitingPatients.length} Waiting`;
        waitingCountEl.textContent = waitingText;
    }

    if (doctorQueue.length === 0) {
        list.innerHTML = `
            <div class="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-100">
                ${typeof I18N !== 'undefined' ? I18N.t('noAppointmentsInQueue', 'No appointments in today’s queue.') : 'No appointments in today’s queue.'}
            </div>
        `;
        return;
    }

    list.innerHTML = doctorQueue.map(e => {
        const isCurrent = activePatient && activePatient.appointment_id === e.appointment_id;
        const slotText = e.slot_time || (typeof I18N !== 'undefined' ? I18N.t('walkIn', 'Walk-in') : 'Walk-in');

        return `
            <div onclick="selectPatientForView(${e.appointment_id})" 
                 class="p-3.5 rounded-2xl border transition-all cursor-pointer ${
                     isCurrent 
                     ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-2 ring-blue-500/20' 
                     : 'bg-white border-slate-200 hover:border-slate-300'
                 }">
                <div class="flex items-center justify-between">
                    <span class="font-mono font-black text-xs text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md">
                        ${e.token_number}
                    </span>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusBadgeClass(e.status)}">
                        ${e.status}
                    </span>
                </div>
                <div class="font-bold text-slate-900 text-xs mt-2">${e.patient_name}</div>
                <div class="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                    <span>${e.booking_type} • ${slotText}</span>
                    <span>#${e.queue_position}</span>
                </div>
            </div>
        `;
    }).join('');
}

function selectPatientForView(appointmentId) {
    const entry = doctorQueue.find(e => e.appointment_id === appointmentId);
    if (entry) {
        setActivePatient(entry);
    }
}

async function setActivePatient(entry) {
    activePatient = entry;
    renderActivePatientCard(entry);
    await loadConsultationDetails(entry.appointment_id);
    renderQueueSidebar();
}

function renderNextWaitingPatientCard(entry) {
    const container = document.getElementById('active-patient-container');
    if (!container) return;

    container.innerHTML = `
        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
            <div class="flex items-center justify-between pb-4 border-b border-slate-100">
                <span class="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    ${typeof I18N !== 'undefined' ? I18N.t('nextInQueue', 'Next Patient in Queue') : 'Next Patient in Queue'}
                </span>
                <span class="text-xs text-slate-400">Position: <strong>#${entry.queue_position}</strong></span>
            </div>

            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div class="flex items-center gap-4">
                    <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-mono font-black text-2xl flex items-center justify-center shadow-lg">
                        ${entry.token_number}
                    </div>
                    <div>
                        <h2 class="text-2xl font-black text-slate-900">${entry.patient_name}</h2>
                        <p class="text-xs text-slate-500 mt-0.5">
                            Phone: <strong class="text-slate-700">${entry.patient_phone || '-'}</strong> • 
                            Gender: <strong class="text-slate-700">${entry.patient_gender || 'Unspecified'}</strong> • 
                            Booking: <strong class="text-slate-700">${entry.booking_type}</strong>
                        </p>
                    </div>
                </div>

                <div>
                    <button onclick="callSpecificPatient(${entry.appointment_id})" class="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/20 transition-all flex items-center gap-2">
                        <span>🔔 ${typeof I18N !== 'undefined' ? I18N.t('callToRoom', 'Call to Room') : 'Call to Room'}</span>
                    </button>
                </div>
            </div>

            <div class="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-slate-600">
                <p>Click <strong>"Call to Room"</strong> to notify this patient and initiate the consultation session.</p>
            </div>
        </div>
    `;
}

function renderNoActivePatientState() {
    activePatient = null;
    const card = document.getElementById('active-patient-container');
    if (card) {
        card.innerHTML = `
            <div class="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm text-center space-y-4">
                <div class="w-16 h-16 rounded-full bg-blue-50 text-blue-600 text-2xl font-black flex items-center justify-center mx-auto">
                    🩺
                </div>
                <h3 class="text-xl font-bold text-slate-900">${typeof I18N !== 'undefined' ? I18N.t('noPatientInRoom', 'No Patient Currently in Consultation Room') : 'No Patient Currently in Consultation Room'}</h3>
                <p class="text-xs text-slate-500 max-w-sm mx-auto">${typeof I18N !== 'undefined' ? I18N.t('callNextPatientPrompt', 'Click "Call Next Patient" to notify the next waiting patient to enter the consultation room.') : 'Click "Call Next Patient" to notify the next waiting patient to enter the consultation room.'}</p>
                <div class="pt-2">
                    <button onclick="callNextPatient()" class="px-6 py-3 bg-gradient-to-r from-blue-600 to-teal-600 hover:from-blue-700 hover:to-teal-700 text-white font-bold rounded-xl text-xs shadow-md shadow-blue-500/20">
                        🔔 ${typeof I18N !== 'undefined' ? I18N.t('callNextPatient', 'Call Next Patient') : 'Call Next Patient'}
                    </button>
                </div>
            </div>
        `;
    }
}

function renderActivePatientCard(entry) {
    const container = document.getElementById('active-patient-container');
    if (!container) return;

    container.innerHTML = `
        <div class="bg-white rounded-3xl border border-slate-200 shadow-md p-6 sm:p-8 space-y-6">
            <!-- Patient Hero Header -->
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div class="flex items-center gap-4">
                    <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-mono font-black text-2xl flex items-center justify-center shadow-lg">
                        ${entry.token_number}
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <h2 class="text-2xl font-black text-slate-900 tracking-tight">${entry.patient_name}</h2>
                            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusBadgeClass(entry.status)}">
                                ${entry.status}
                            </span>
                        </div>
                        <p class="text-xs text-slate-500 mt-0.5">
                            Phone: <strong class="text-slate-700">${entry.patient_phone || '-'}</strong> • 
                            Gender: <strong class="text-slate-700">${entry.patient_gender || 'Unspecified'}</strong> • 
                            Booking: <strong class="text-slate-700">${entry.booking_type}</strong>
                        </p>
                    </div>
                </div>

                <!-- Action Lifecycle Buttons -->
                <div class="flex items-center gap-2">
                    ${entry.status === 'WAITING' ? `
                        <button onclick="updateActivePatientStatus('CALLED')" class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md transition-all">
                            🔔 ${typeof I18N !== 'undefined' ? I18N.t('callToRoom', 'Call to Room') : 'Call to Room'}
                        </button>
                    ` : ''}

                    ${entry.status === 'CALLED' ? `
                        <button onclick="updateActivePatientStatus('CONSULTING')" class="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-md transition-all">
                            ▶ ${typeof I18N !== 'undefined' ? I18N.t('startConsultation', 'Start Consultation') : 'Start Consultation'}
                        </button>
                    ` : ''}

                    ${entry.status === 'CONSULTING' ? `
                        <button onclick="handleCompleteConsultation()" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-all">
                            ✓ ${typeof I18N !== 'undefined' ? I18N.t('completeAndNext', 'Complete & Next') : 'Complete & Next'}
                        </button>
                    ` : ''}
                </div>
            </div>

            <!-- Consultation Notes & Prescription Form -->
            <form id="consultation-form" class="space-y-4">
                <input type="hidden" id="consult-appt-id" value="${entry.appointment_id}">

                <div>
                    <label class="block text-xs font-bold uppercase text-slate-700 mb-1">${typeof I18N !== 'undefined' ? I18N.t('clinicalNotes', 'Clinical Notes & Observations') : 'Clinical Notes & Observations'}</label>
                    <textarea id="consult-notes" rows="3" placeholder="${typeof I18N !== 'undefined' ? I18N.t('notesPlaceholder', 'Patient symptoms, examination findings, diagnosis...') : 'Patient symptoms, examination findings, diagnosis...'}" class="w-full px-4 py-3 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
                </div>

                <div>
                    <label class="block text-xs font-bold uppercase text-slate-700 mb-1">${typeof I18N !== 'undefined' ? I18N.t('prescriptionAdvice', 'Prescription & Advice') : 'Prescription & Advice'}</label>
                    <textarea id="consult-prescription" rows="3" placeholder="${typeof I18N !== 'undefined' ? I18N.t('prescriptionPlaceholder', 'Medication dosage, follow-up instructions, diet advice...') : 'Medication dosage, follow-up instructions, diet advice...'}" class="w-full px-4 py-3 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none"></textarea>
                </div>

                <div class="flex items-center justify-between pt-2">
                    <button type="button" onclick="handleSaveDraft()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors">
                        ${typeof I18N !== 'undefined' ? I18N.t('saveDraft', 'Save Notes Draft') : 'Save Notes Draft'}
                    </button>
                    <button type="button" onclick="handleCompleteConsultation()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition-colors flex items-center gap-1.5">
                        <span>${typeof I18N !== 'undefined' ? I18N.t('saveAndComplete', 'Save & Complete Consultation ✓') : 'Save & Complete Consultation ✓'}</span>
                    </button>
                </div>
            </form>
        </div>
    `;
}

async function loadConsultationDetails(appointmentId) {
    const res = await API.get(`/consultations/appointment/${appointmentId}/`);
    if (res.ok && res.data) {
        const notesEl = document.getElementById('consult-notes');
        const presEl = document.getElementById('consult-prescription');
        if (notesEl) notesEl.value = res.data.notes || '';
        if (presEl) presEl.value = res.data.prescription_notes || '';
    }
}

async function callNextPatient() {
    const body = {};
    if (selectedDoctorId) body.doctor_id = selectedDoctorId;

    const res = await API.post('/queue/call-next/', body);
    if (res.ok && res.data) {
        API.showToast(`Token #${res.data.token_number} called to room!`, 'success');
        await loadDoctorQueue();
    } else {
        API.showToast(res.error?.message || 'No waiting patients in queue.', 'info');
    }
}

async function callSpecificPatient(appointmentId) {
    const res = await API.post('/queue/update-status/', {
        appointment_id: appointmentId,
        status: 'CALLED'
    });
    if (res.ok && res.data) {
        API.showToast(`Patient called to room!`, 'success');
        await loadDoctorQueue();
    } else {
        API.showToast(res.error?.message || 'Failed to call patient', 'error');
    }
}

async function updateActivePatientStatus(newStatus) {
    if (!activePatient) return;
    const res = await API.post('/queue/update-status/', {
        appointment_id: activePatient.appointment_id,
        status: newStatus
    });
    if (res.ok && res.data) {
        API.showToast(`Status updated to ${newStatus}`, 'success');
        await loadDoctorQueue();
    } else {
        API.showToast(res.error?.message || 'Status update failed', 'error');
    }
}

async function handleSaveDraft() {
    if (!activePatient) return;
    const apptId = activePatient.appointment_id;
    const notes = document.getElementById('consult-notes')?.value || '';
    const pres = document.getElementById('consult-prescription')?.value || '';

    const res = await API.post('/consultations/save/', {
        appointment_id: apptId,
        notes: notes,
        prescription_notes: pres,
        complete: false
    });

    if (res.ok) {
        API.showToast('Consultation notes saved.', 'success');
    } else {
        API.showToast(res.error?.message || 'Failed to save notes', 'error');
    }
}

async function handleCompleteConsultation() {
    if (!activePatient) return;
    const apptId = activePatient.appointment_id;
    const notes = document.getElementById('consult-notes')?.value || '';
    const pres = document.getElementById('consult-prescription')?.value || '';

    const res = await API.post('/consultations/save/', {
        appointment_id: apptId,
        notes: notes,
        prescription_notes: pres,
        complete: true
    });

    if (res.ok) {
        API.showToast(`Consultation for ${activePatient.token_number} Completed!`, 'success');
        await loadDoctorQueue();
    } else {
        API.showToast(res.error?.message || 'Failed to complete consultation', 'error');
    }
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'WAITING': return 'bg-amber-100 text-amber-800 border border-amber-300 font-bold';
        case 'CALLED': return 'bg-rose-50 text-rose-800 border border-rose-300 font-bold animate-pulse';
        case 'CONSULTING': return 'bg-blue-100 text-blue-800 border border-blue-300 font-bold';
        case 'COMPLETED': return 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold';
        default: return 'bg-slate-100 text-slate-700';
    }
}
