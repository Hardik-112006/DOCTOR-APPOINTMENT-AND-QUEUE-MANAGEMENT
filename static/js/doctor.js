/**
 * Doctor desk: validated queue, patient details, consultation timer, notes, private remarks,
 * prescriptions and the attended-patients history.
 */

const tr = (key, fallback) => (typeof I18N !== 'undefined' ? I18N.t(key, fallback) : fallback);
const esc = (v) => API.escapeHtml(v);
const localISODate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

let doctorQueue = [];
let selectedApptId = null;
let manualSelection = false;   // true while the doctor is looking at a patient they clicked on
let renderedKey = null;        // what the active card currently shows; avoids wiping typed notes on every poll
let selectedDate = localISODate();
let pollInterval = null;
let timerInterval = null;
let attendedSearchTimer = null;

const isToday = () => selectedDate === localISODate();
const statusText = (s) => tr('status' + s.charAt(0) + s.slice(1).toLowerCase(), s);

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth(['DOCTOR'])) return;

    const dateInput = document.getElementById('doctor-queue-date');
    dateInput.value = selectedDate;
    dateInput.addEventListener('change', (e) => {
        selectedDate = e.target.value || localISODate();
        manualSelection = false;
        selectedApptId = null;
        renderedKey = null;
        document.getElementById('call-next-btn').classList.toggle('hidden', !isToday());
        loadDoctorQueue();
    });

    document.getElementById('attended-search').addEventListener('input', () => {
        clearTimeout(attendedSearchTimer);
        attendedSearchTimer = setTimeout(loadAttended, 300);
    });

    await loadDoctorQueue();
    pollInterval = setInterval(loadDoctorQueue, 5000);
    timerInterval = setInterval(updateConsultTimer, 1000);
});

function switchDoctorTab(tab) {
    const isQueue = tab === 'queue';
    document.getElementById('doctor-queue-panel').classList.toggle('hidden', !isQueue);
    document.getElementById('doctor-attended-panel').classList.toggle('hidden', isQueue);
    document.getElementById('doc-tab-queue').className = `flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-extrabold ${isQueue ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`;
    document.getElementById('doc-tab-attended').className = `flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-extrabold ${!isQueue ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`;
    if (!isQueue) loadAttended();
}

/* ---------------- Queue ---------------- */

async function loadDoctorQueue() {
    const res = await API.get('/queue/live/', { date: selectedDate });
    if (!res.ok || !res.data) {
        if (res.status === 404) renderMessageCard('🩺', res.error?.message || tr('noDoctorProfile', 'No doctor profile linked to this account.'), '');
        return;
    }
    doctorQueue = res.data.queue || [];

    const badge = document.getElementById('doc-badge');
    if (res.data.doctor_name) {
        badge.textContent = `${res.data.doctor_name}${res.data.specialization ? ' • ' + res.data.specialization : ''}`;
        badge.classList.remove('hidden');
    }

    const inRoom = doctorQueue.find(e => e.status === 'CONSULTING') || doctorQueue.find(e => e.status === 'CALLED');
    const nextReady = doctorQueue.find(e => e.status === 'WAITING' && e.is_validated);

    if (manualSelection && !doctorQueue.some(e => e.appointment_id === selectedApptId)) manualSelection = false;
    if (!manualSelection) selectedApptId = (inRoom || nextReady || {}).appointment_id || null;

    renderSidebar();
    renderActiveArea();
}

function patientLine(e) {
    const bits = [];
    if (e.patient_age !== null && e.patient_age !== undefined) bits.push(`${e.patient_age} ${tr('yearsShort', 'yrs')}`);
    if (e.patient_gender) bits.push(tr('gender' + e.patient_gender, e.patient_gender));
    if (e.patient_blood_group) bits.push(e.patient_blood_group);
    return bits.join(' · ');
}

function sidebarItem(e, dim = false) {
    const isCurrent = selectedApptId === e.appointment_id;
    return `
        <div onclick="selectPatientForView(${e.appointment_id})" role="button" tabindex="0"
             class="p-3 rounded-2xl border transition-all cursor-pointer ${isCurrent ? 'bg-blue-50/80 border-blue-500 shadow-sm ring-2 ring-blue-500/20' : (dim ? 'bg-white/60 border-slate-200 opacity-75 hover:opacity-100' : 'bg-white border-slate-200 hover:border-slate-300')}">
            <div class="flex items-center justify-between gap-2">
                <span class="font-mono font-black text-xs text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md">${esc(e.token_number)}</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusBadgeClass(e.status)}">${esc(statusText(e.status))}</span>
            </div>
            <div class="font-bold text-slate-900 text-xs mt-2 truncate">${esc(e.patient_name)}</div>
            <div class="text-[10px] text-slate-500 truncate">${esc(patientLine(e))}</div>
            ${e.problem_description ? `<div class="text-[10px] text-slate-600 mt-1 line-clamp-1">🩹 ${esc(e.problem_description)}</div>` : ''}
            <div class="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                <span>${esc(e.booking_type === 'WALK_IN' ? tr('walkIn', 'Walk-in') : tr('online', 'Online'))}${e.slot_time ? ' • ' + esc(e.slot_time) : ''}</span>
            </div>
        </div>`;
}

function renderSidebar() {
    const inRoom = doctorQueue.filter(e => e.status === 'CALLED' || e.status === 'CONSULTING');
    const ready = doctorQueue.filter(e => e.status === 'WAITING' && e.is_validated);
    const unvalidated = doctorQueue.filter(e => e.status === 'WAITING' && !e.is_validated);
    const completed = doctorQueue.filter(e => e.status === 'COMPLETED');

    document.getElementById('waiting-count-badge').textContent = `${ready.length} ${tr('waitingCount', 'waiting')}`;
    const readyList = document.getElementById('ready-queue-list');
    const readyItems = [...inRoom, ...ready];
    readyList.innerHTML = readyItems.length
        ? readyItems.map(e => sidebarItem(e)).join('')
        : `<div class="p-6 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-100">${esc(tr('noReadyPatients', 'No validated patients waiting.'))}</div>`;

    document.getElementById('unvalidated-count').textContent = unvalidated.length;
    document.getElementById('unvalidated-list').innerHTML = unvalidated.map(e => sidebarItem(e, true)).join('') ||
        `<div class="text-[11px] text-slate-400">${esc(tr('none', 'None'))}</div>`;

    document.getElementById('completed-count').textContent = completed.length;
    document.getElementById('completed-list').innerHTML = completed.map(e => sidebarItem(e, true)).join('') ||
        `<div class="text-[11px] text-slate-400">${esc(tr('none', 'None'))}</div>`;
}

function selectPatientForView(appointmentId) {
    selectedApptId = appointmentId;
    const inRoom = doctorQueue.find(e => e.status === 'CONSULTING' || e.status === 'CALLED');
    // Clicking the in-room patient hands control back to automatic following
    manualSelection = !(inRoom && inRoom.appointment_id === appointmentId);
    renderSidebar();
    renderActiveArea();
}

function renderMessageCard(icon, title, body, withCallButton = false) {
    renderedKey = `msg:${title}`;
    document.getElementById('active-patient-container').innerHTML = `
        <div class="bg-white p-10 sm:p-12 rounded-3xl border border-slate-200 shadow-sm text-center space-y-4">
            <div class="w-16 h-16 rounded-full bg-blue-50 text-blue-600 text-2xl font-black flex items-center justify-center mx-auto">${icon}</div>
            <h3 class="text-xl font-bold text-slate-900">${esc(title)}</h3>
            ${body ? `<p class="text-xs text-slate-500 max-w-sm mx-auto">${esc(body)}</p>` : ''}
            ${withCallButton ? `<button onclick="callNextPatient()" class="px-6 py-3 bg-gradient-to-r from-blue-600 to-teal-600 text-white font-bold rounded-xl text-xs shadow-md">${esc(tr('callNextPatient', '🔔 Call Next Patient'))}</button>` : ''}
        </div>`;
}

function renderActiveArea() {
    const entry = doctorQueue.find(e => e.appointment_id === selectedApptId);
    if (!entry) {
        const unvalidated = doctorQueue.filter(e => e.status === 'WAITING' && !e.is_validated).length;
        if (unvalidated) {
            renderMessageCard('⏳', tr('waitingForReception', 'Waiting for reception'), `${unvalidated} ${tr('patientsNotValidated', 'patient(s) booked but not yet validated by reception.')}`);
        } else {
            renderMessageCard('🩺', tr('noPatientInRoom', 'No patients waiting'), isToday() ? tr('callNextPatientPrompt', 'New validated patients will appear here automatically.') : '');
        }
        return;
    }

    const key = `${entry.appointment_id}:${entry.status}:${entry.is_validated}`;
    if (key === renderedKey) return;   // same patient & state - keep whatever the doctor is typing
    // Same patient, new status: carry unsaved text over to the re-rendered card
    const carried = renderedKey && renderedKey.split(':')[0] === String(entry.appointment_id) ? formValues() : null;
    renderedKey = key;
    renderPatientCard(entry);
    if (carried) {
        document.getElementById('consult-notes').value = carried.notes;
        document.getElementById('consult-prescription').value = carried.prescription_notes;
        document.getElementById('consult-remark').value = carried.doctor_remark;
    }
    loadConsultationDetails(entry);
    loadPatientHistory(entry);
}

function bmi(e) {
    const w = parseFloat(e.patient_weight_kg), h = parseFloat(e.patient_height_cm);
    if (!w || !h) return null;
    return (w / ((h / 100) ** 2)).toFixed(1);
}

function renderPatientCard(entry) {
    const container = document.getElementById('active-patient-container');
    const s = entry.status;
    const canAct = isToday() && s !== 'COMPLETED';
    const fact = (label, value) => `
        <div class="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
            <div class="text-[9px] font-bold uppercase tracking-wider text-slate-400">${esc(label)}</div>
            <div class="text-sm font-black ${value ? 'text-slate-900' : 'text-slate-300'}">${esc(value || '—')}</div>
        </div>`;

    let actionButtons = '';
    if (canAct && s === 'WAITING') {
        actionButtons = entry.is_validated
            ? `<button onclick="updateActivePatientStatus('CALLED')" class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-md">🔔 ${esc(tr('callToRoom', 'Call to Room'))}</button>`
            : `<span class="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">⚠ ${esc(tr('awaitingReceptionValidation', 'Awaiting reception validation'))}</span>`;
    } else if (canAct && s === 'CALLED') {
        actionButtons = `<button onclick="updateActivePatientStatus('CONSULTING')" class="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs shadow-md">▶ ${esc(tr('startConsultation', 'Start Consultation'))}</button>`;
    } else if (s === 'CONSULTING') {
        actionButtons = `<span class="px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-sm font-black font-mono" title="${esc(tr('consultationTime', 'Consultation time'))}">⏱ <span id="consult-timer">00:00</span></span>`;
    } else if (s === 'COMPLETED') {
        actionButtons = `<button onclick="downloadRx(${entry.appointment_id})" class="px-4 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs border border-blue-200">↓ ${esc(tr('downloadPrescriptionPdf', 'Prescription PDF'))}</button>`;
    }

    // Notes are written once the consultation (and its timer) has started
    const editable = s === 'CONSULTING';
    const textareaCls = 'w-full px-4 py-3 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-slate-50 disabled:text-slate-500';

    container.innerHTML = `
        <div class="bg-white rounded-3xl border border-slate-200 shadow-md p-5 sm:p-8 space-y-6">
            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
                <div class="flex items-center gap-4 min-w-0">
                    <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-mono font-black text-xl flex items-center justify-center shadow-lg shrink-0">${esc(entry.token_number)}</div>
                    <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                            <h2 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight truncate">${esc(entry.patient_name)}</h2>
                            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold ${getStatusBadgeClass(s)}">${esc(statusText(s))}</span>
                        </div>
                        <p class="text-xs text-slate-500 mt-0.5">
                            ${esc(entry.patient_phone || '-')} • ${esc(entry.booking_type === 'WALK_IN' ? tr('walkIn', 'Walk-in') : tr('online', 'Online'))}${entry.slot_time ? ' • ' + esc(entry.slot_time) : ''}
                            ${entry.is_validated ? ` • <span class="text-emerald-700 font-bold">✓ ${esc(tr('validated', 'Validated'))}</span>` : ''}
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">${actionButtons}</div>
            </div>

            <!-- Details the patient gave while booking -->
            <div class="space-y-3">
                <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-500">${esc(tr('patientDetails', 'Patient details'))}</h3>
                <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    ${fact(tr('age', 'Age'), entry.patient_age !== null && entry.patient_age !== undefined ? `${entry.patient_age} ${tr('yearsShort', 'yrs')}` : '')}
                    ${fact(tr('gender', 'Gender'), entry.patient_gender ? tr('gender' + entry.patient_gender, entry.patient_gender) : '')}
                    ${fact(tr('bloodGroup', 'Blood'), entry.patient_blood_group)}
                    ${fact(tr('weight', 'Weight'), entry.patient_weight_kg ? `${parseFloat(entry.patient_weight_kg)} kg` : '')}
                    ${fact(tr('height', 'Height'), entry.patient_height_cm ? `${parseFloat(entry.patient_height_cm)} cm` : '')}
                    ${fact('BMI', bmi(entry))}
                </div>
                <div class="p-4 rounded-2xl ${entry.problem_description ? 'bg-amber-50 border border-amber-200' : 'bg-slate-50 border border-slate-100'}">
                    <div class="text-[10px] font-extrabold uppercase tracking-wider ${entry.problem_description ? 'text-amber-700' : 'text-slate-400'}">${esc(tr('problemReported', 'Problem described by patient'))}</div>
                    <p class="text-sm ${entry.problem_description ? 'text-slate-900 font-semibold' : 'text-slate-400'} mt-1 whitespace-pre-line">${esc(entry.problem_description || tr('noProblemGiven', 'Not provided'))}</p>
                </div>
                ${entry.reception_remark ? `<div class="text-[11px] text-slate-600"><span class="font-bold text-slate-500">${esc(tr('receptionRemark', 'Reception remark'))}:</span> <span class="bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-lg">${esc(entry.reception_remark)}</span></div>` : ''}
            </div>

            <!-- Previous visits with this doctor -->
            <div id="patient-history" class="space-y-2"></div>

            <!-- Consultation form -->
            <form id="consultation-form" class="space-y-4" onsubmit="return false;">
                <div>
                    <label for="consult-notes" class="block text-xs font-bold uppercase text-slate-700 mb-1">${esc(tr('clinicalNotes', 'Clinical Notes & Observations'))}</label>
                    <textarea id="consult-notes" rows="3" ${editable ? '' : 'disabled'} placeholder="${esc(tr('notesPlaceholder', 'Symptoms, examination findings, diagnosis...'))}" class="${textareaCls}"></textarea>
                </div>
                <div>
                    <label for="consult-prescription" class="block text-xs font-bold uppercase text-slate-700 mb-1">${esc(tr('prescriptionAdvice', 'Prescription & Advice'))}</label>
                    <textarea id="consult-prescription" rows="4" ${editable ? '' : 'disabled'} placeholder="${esc(tr('prescriptionPlaceholder', 'Medicines with dosage, follow-up instructions, diet advice...'))}" class="${textareaCls}"></textarea>
                </div>
                <div class="p-4 rounded-2xl bg-violet-50/60 border border-violet-200">
                    <label for="consult-remark" class="block text-xs font-bold uppercase text-violet-800 mb-1">🔒 ${esc(tr('privateRemark', 'Private remark (only you can see this)'))}</label>
                    <textarea id="consult-remark" rows="2" maxlength="1000" ${editable || s === 'COMPLETED' ? '' : 'disabled'} placeholder="${esc(tr('remarkPlaceholder', 'e.g. Anxious about injections, prefers Hindi, check BP next visit'))}" class="${textareaCls} border-violet-200 bg-white"></textarea>
                    ${s === 'COMPLETED' ? `<div class="flex justify-end mt-2"><button type="button" onclick="saveRemarkOnly(${entry.appointment_id})" class="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold">${esc(tr('saveRemark', 'Save remark'))}</button></div>` : ''}
                </div>
                ${editable ? `
                    <div class="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
                        <button type="button" onclick="handleSaveDraft()" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs">${esc(tr('saveDraft', 'Save Draft'))}</button>
                        <button type="button" onclick="handleCompleteConsultation()" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md">${esc(tr('saveAndComplete', 'Save & Complete Consultation ✓'))}</button>
                    </div>` : (s === 'CALLED' ? `<p class="text-[11px] text-slate-500">${esc(tr('startToWrite', 'Press "Start Consultation" when the patient enters to begin the timer and write notes.'))}</p>` : '')}
            </form>
        </div>`;
    updateConsultTimer();
}

function updateConsultTimer() {
    const el = document.getElementById('consult-timer');
    const entry = doctorQueue.find(e => e.appointment_id === selectedApptId);
    if (!el || !entry || !entry.consultation_started_at) return;
    const secs = Math.max(0, Math.floor((Date.now() - new Date(entry.consultation_started_at).getTime()) / 1000));
    const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), sec = secs % 60;
    el.textContent = `${h ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

async function loadConsultationDetails(entry) {
    const res = await API.get(`/consultations/appointment/${entry.appointment_id}/`);
    if (selectedApptId !== entry.appointment_id || !res.ok || !res.data) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el && !el.value) el.value = v || ''; };
    set('consult-notes', res.data.notes);
    set('consult-prescription', res.data.prescription_notes);
    set('consult-remark', res.data.doctor_remark);
}

async function loadPatientHistory(entry) {
    const res = await API.get('/consultations/attended/', { patient_id: entry.patient_id, exclude_appointment_id: entry.appointment_id, limit: 5 });
    const box = document.getElementById('patient-history');
    if (!box || selectedApptId !== entry.appointment_id || !res.ok) return;
    const visits = Array.isArray(res.data) ? res.data : [];
    if (visits.length === 0) {
        box.innerHTML = `<div class="text-[11px] text-slate-400">${esc(tr('firstVisitWithYou', 'First visit with you.'))}</div>`;
        return;
    }
    box.innerHTML = `
        <h3 class="text-xs font-extrabold uppercase tracking-wider text-slate-500">${esc(tr('previousVisits', 'Previous visits with you'))} (${visits.length})</h3>
        ${visits.map(v => `
            <div class="p-3 rounded-2xl border border-slate-200 bg-white text-xs space-y-1">
                <div class="flex items-center justify-between gap-2">
                    <span class="font-bold text-slate-800">${esc(v.appointment_date)} · <span class="font-mono text-blue-700">${esc(v.token_number)}</span></span>
                    <button type="button" onclick="downloadRx(${v.appointment_id})" class="text-[10px] font-bold text-blue-700 hover:underline">↓ PDF</button>
                </div>
                ${v.problem_description ? `<div class="text-slate-500">🩹 ${esc(v.problem_description)}</div>` : ''}
                ${v.notes ? `<div class="text-slate-700"><span class="font-semibold">${esc(tr('notesShort', 'Notes'))}:</span> ${esc(v.notes)}</div>` : ''}
                ${v.doctor_remark ? `<div class="text-violet-800 bg-violet-50 border border-violet-100 rounded-lg px-2 py-1">🔒 ${esc(v.doctor_remark)}</div>` : ''}
            </div>`).join('')}`;
}

async function callNextPatient() {
    const res = await API.post('/queue/call-next/', {});
    if (res.ok && res.data) {
        API.showToast(`${tr('tokenCalled', 'Token called to room')}: #${res.data.token_number}`, 'success');
        manualSelection = false;
        await loadDoctorQueue();
    } else {
        API.showToast(res.error?.message || tr('noWaitingPatients', 'No validated patients waiting.'), 'info');
    }
}

async function updateActivePatientStatus(newStatus) {
    if (!selectedApptId) return;
    const res = await API.post('/queue/update-status/', { appointment_id: selectedApptId, status: newStatus });
    if (res.ok && res.data) {
        API.showToast(`${tr('statusUpdated', 'Status updated')}: ${statusText(newStatus)}`, 'success');
        manualSelection = false;
        await loadDoctorQueue();
    } else {
        API.showToast(res.error?.message || tr('statusUpdateFailed', 'Status update failed'), 'error');
    }
}

function formValues() {
    return {
        notes: document.getElementById('consult-notes')?.value || '',
        prescription_notes: document.getElementById('consult-prescription')?.value || '',
        doctor_remark: document.getElementById('consult-remark')?.value || '',
    };
}

async function handleSaveDraft() {
    if (!selectedApptId) return;
    const res = await API.post('/consultations/save/', Object.assign({ appointment_id: selectedApptId, complete: false }, formValues()));
    API.showToast(res.ok ? tr('notesSaved', 'Consultation notes saved.') : (res.error?.message || tr('saveFailed', 'Failed to save notes')), res.ok ? 'success' : 'error');
}

async function handleCompleteConsultation() {
    if (!selectedApptId) return;
    const values = formValues();
    if (!values.prescription_notes.trim() && !confirm(tr('confirmNoPrescription', 'Complete without writing a prescription?'))) return;
    const entry = doctorQueue.find(e => e.appointment_id === selectedApptId);
    const res = await API.post('/consultations/save/', Object.assign({ appointment_id: selectedApptId, complete: true }, values));
    if (res.ok) {
        API.showToast(`${tr('consultationCompleted', 'Consultation completed')}: ${entry ? entry.token_number : ''}`, 'success');
        manualSelection = false;
        renderedKey = null;
        await loadDoctorQueue();
    } else {
        API.showToast(res.error?.message || tr('completeFailed', 'Failed to complete consultation'), 'error');
    }
}

async function saveRemarkOnly(appointmentId, inputId = 'consult-remark') {
    const value = document.getElementById(inputId)?.value || '';
    const res = await API.post(`/consultations/appointment/${appointmentId}/remark/`, { doctor_remark: value });
    API.showToast(res.ok ? tr('remarkSaved', 'Remark saved.') : (res.error?.message || tr('saveFailed', 'Could not save.')), res.ok ? 'success' : 'error');
}

function downloadRx(appointmentId) {
    Prescription.download(appointmentId);
}

/* ---------------- Attended patients ---------------- */

async function loadAttended() {
    const list = document.getElementById('attended-list');
    const q = document.getElementById('attended-search').value.trim();
    const res = await API.get('/consultations/attended/', { q, limit: 100 });
    if (!res.ok) {
        list.innerHTML = `<div class="p-6 text-center text-rose-600 text-xs bg-rose-50 rounded-2xl">${esc(res.error?.message || tr('loadFailed', 'Could not load.'))}</div>`;
        return;
    }
    const rows = Array.isArray(res.data) ? res.data : [];
    if (rows.length === 0) {
        list.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs bg-slate-50 rounded-2xl">${esc(q ? tr('noMatches', 'No matches.') : tr('noAttendedYet', 'You have not attended any patients yet.'))}</div>`;
        return;
    }
    list.innerHTML = rows.map(c => {
        const meta = [c.patient_age !== null && c.patient_age !== undefined ? `${c.patient_age} ${tr('yearsShort', 'yrs')}` : '', c.patient_gender, c.patient_blood_group].filter(Boolean).join(' · ');
        return `
            <div class="p-4 rounded-2xl border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                <div class="md:col-span-4 min-w-0">
                    <div class="flex items-center gap-2">
                        <span class="font-mono font-black text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">${esc(c.token_number)}</span>
                        <span class="text-[11px] text-slate-500">${esc(c.appointment_date)}</span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${c.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'}">${esc(statusText(c.status))}</span>
                    </div>
                    <div class="font-bold text-slate-900 text-sm mt-1 truncate">${esc(c.patient_name)}</div>
                    <div class="text-[11px] text-slate-500">${esc(c.patient_phone || '')}${meta ? ' · ' + esc(meta) : ''}</div>
                    ${c.problem_description ? `<div class="text-[11px] text-slate-600 mt-1">🩹 ${esc(c.problem_description)}</div>` : ''}
                </div>
                <div class="md:col-span-6">
                    <label for="remark-${c.appointment_id}" class="block text-[10px] font-bold uppercase text-violet-700 mb-1">🔒 ${esc(tr('privateRemark', 'Private remark'))}</label>
                    <textarea id="remark-${c.appointment_id}" rows="2" maxlength="1000" class="w-full px-3 py-2 rounded-xl border border-violet-200 text-xs focus:ring-2 focus:ring-violet-400 outline-none" placeholder="${esc(tr('remarkPlaceholder', 'Add a note to remember this patient'))}">${esc(c.doctor_remark || '')}</textarea>
                </div>
                <div class="md:col-span-2 flex md:flex-col gap-2">
                    <button type="button" onclick="saveRemarkOnly(${c.appointment_id}, 'remark-${c.appointment_id}')" class="flex-1 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold">${esc(tr('saveRemark', 'Save remark'))}</button>
                    ${c.prescription_notes ? `<button type="button" onclick="downloadRx(${c.appointment_id})" class="flex-1 px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold border border-blue-200">↓ PDF</button>` : ''}
                </div>
            </div>`;
    }).join('');
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'WAITING': return 'bg-amber-100 text-amber-800 border border-amber-300';
        case 'CALLED': return 'bg-rose-50 text-rose-800 border border-rose-300 animate-pulse';
        case 'CONSULTING': return 'bg-blue-100 text-blue-800 border border-blue-300';
        case 'COMPLETED': return 'bg-emerald-100 text-emerald-800 border border-emerald-300';
        default: return 'bg-slate-100 text-slate-700';
    }
}
