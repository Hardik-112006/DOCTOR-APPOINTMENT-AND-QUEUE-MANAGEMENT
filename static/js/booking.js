/**
 * Patient appointment booking.
 * English / Hindi, live doctor availability, optional problem description & health details,
 * and an explicit success / failure result for every booking attempt.
 */

const tr = (key, fallback) => (typeof I18N !== 'undefined' ? I18N.t(key, fallback) : fallback);
const esc = (v) => API.escapeHtml(v);

const localISODate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

let selectedDoctor = null;
let selectedSlot = null;
let selectedDepartmentId = null;
let selectedDate = localISODate();
let bookingBlockedReason = null;
let doctorsCache = [];
let loadDoctorsRequestId = 0;
let loadSlotsRequestId = 0;

const DUTY_BADGES = {
    ON_DUTY: ['bg-emerald-50 text-emerald-700 border-emerald-200', 'dutyOnNow', 'On duty now'],
    LATER_TODAY: ['bg-blue-50 text-blue-700 border-blue-200', 'dutyLaterToday', 'Later today'],
    DONE_FOR_TODAY: ['bg-slate-100 text-slate-600 border-slate-200', 'dutyDoneToday', 'Done for today'],
    OFF_TODAY: ['bg-amber-50 text-amber-700 border-amber-200', 'dutyOffToday', 'Off today'],
    UNAVAILABLE: ['bg-rose-50 text-rose-700 border-rose-200', 'dutyUnavailable', 'Unavailable'],
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth(['PATIENT'])) return;

    const bloodSelect = document.getElementById('hp-blood');
    bloodSelect.innerHTML = `<option value="">${tr('selectOption', 'Select')}</option>` +
        ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => `<option value="${b}">${b}</option>`).join('');

    const dateInput = document.getElementById('appointment-date');
    dateInput.value = selectedDate;
    dateInput.min = selectedDate;
    dateInput.addEventListener('change', (e) => {
        selectedDate = e.target.value;
        selectedSlot = null;
        updateSummary();
        if (selectedDoctor) loadSlots();
    });

    const problem = document.getElementById('problem-description');
    problem.addEventListener('input', () => {
        document.getElementById('problem-count').textContent = problem.value.length;
    });

    document.getElementById('booking-form').addEventListener('submit', handleBookAppointment);

    await Promise.all([loadProfile(), loadDepartments()]);
    await loadDoctors();
    updateSummary();
});

async function loadProfile() {
    const res = await API.get('/auth/me/');
    const p = res.ok && res.data ? res.data.patient : null;
    if (!p) return;
    if (p.blood_group) document.getElementById('hp-blood').value = p.blood_group;
    if (p.age !== null && p.age !== undefined) document.getElementById('hp-age').value = p.age;
    if (p.weight_kg) document.getElementById('hp-weight').value = parseFloat(p.weight_kg);
    if (p.height_cm) document.getElementById('hp-height').value = parseFloat(p.height_cm);
}

async function loadDepartments() {
    const res = await API.get('/departments/');
    const container = document.getElementById('department-tabs');
    if (!container || !res.ok || !Array.isArray(res.data)) return;

    const tab = (id, label) => {
        const active = (id === null && selectedDepartmentId === null) || (id !== null && selectedDepartmentId == id);
        return `<button onclick="filterDepartment(${id === null ? 'null' : id})" class="dept-tab whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all ${active ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">${esc(label)}</button>`;
    };
    container.innerHTML = tab(null, tr('allSpecialties', 'All Specialties')) + res.data.map(d => tab(d.id, tr(d.name, d.name))).join('');
}

function filterDepartment(deptId) {
    selectedDepartmentId = deptId;
    loadDepartments();
    loadDoctors();
}

async function loadDoctors() {
    const listContainer = document.getElementById('doctors-list');
    const currentReq = ++loadDoctorsRequestId;
    listContainer.innerHTML = `
        <div class="col-span-full p-8 text-center">
            <div class="inline-block animate-spin text-blue-600 text-2xl">⟳</div>
            <p class="text-xs text-slate-400 mt-2">${esc(tr('loadingDoctors', 'Loading available doctors...'))}</p>
        </div>`;

    const params = selectedDepartmentId ? { department_id: selectedDepartmentId } : {};
    const res = await API.get('/doctors/', params);
    if (currentReq !== loadDoctorsRequestId) return;

    doctorsCache = res.ok && Array.isArray(res.data) ? res.data : [];
    if (doctorsCache.length === 0) {
        listContainer.innerHTML = `
            <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200">
                <p class="text-sm font-semibold text-slate-600">${esc(tr('noDoctorsFound', 'No doctors found for this department.'))}</p>
            </div>`;
        selectedDoctor = null;
        updateSummary();
        renderSlotsMessage(tr('selectDoctorFirst', 'Select a doctor to see available time slots.'));
        return;
    }

    if (!selectedDoctor || !doctorsCache.some(d => d.id === selectedDoctor.id)) {
        // Prefer a doctor who is taking patients today
        selectedDoctor = doctorsCache.find(d => d.is_available && ['ON_DUTY', 'LATER_TODAY'].includes(d.today?.status)) || doctorsCache[0];
        selectedSlot = null;
    }
    renderDoctors();
    updateSummary();
    loadSlots();
}

function dutyBadge(doc) {
    const status = doc.today?.status || (doc.is_available ? 'ON_DUTY' : 'UNAVAILABLE');
    const [cls, key, fallback] = DUTY_BADGES[status] || DUTY_BADGES.OFF_TODAY;
    let label = tr(key, fallback);
    if (status === 'LATER_TODAY' && doc.today?.next_start) label = `${tr('dutyFrom', 'From')} ${doc.today.next_start}`;
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls} whitespace-nowrap">${esc(label)}</span>`;
}

function renderDoctors() {
    const listContainer = document.getElementById('doctors-list');
    listContainer.innerHTML = doctorsCache.map(doc => {
        const docName = doc.name || doc.full_name || 'Doctor';
        const dept = doc.department_name || 'General';
        const isSelected = selectedDoctor && selectedDoctor.id === doc.id;
        const initial = docName.replace('Dr. ', '').trim().charAt(0) || 'D';
        const timings = (doc.today?.windows || []).map(w => `${w.start_time}–${w.end_time}`).join(', ');

        return `
            <div onclick="selectDoctor(${doc.id})" role="button" tabindex="0"
                 class="doctor-card cursor-pointer bg-white p-5 rounded-2xl border ${isSelected ? 'border-blue-600 ring-2 ring-blue-500/20' : 'border-slate-200'} hover:border-blue-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
                <div>
                    <div class="flex items-start justify-between gap-2">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 font-black text-lg flex items-center justify-center shrink-0">${esc(initial)}</div>
                            <div class="min-w-0">
                                <h4 class="font-bold text-slate-900 text-base leading-tight truncate">${esc(docName)}</h4>
                                <span class="text-xs text-teal-600 font-semibold">${esc(tr(doc.specialization, doc.specialization || 'Specialist'))}</span>
                            </div>
                        </div>
                        ${dutyBadge(doc)}
                    </div>
                    <div class="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <span class="text-slate-400 block text-[10px]">${esc(tr('departmentLabel', 'Department'))}</span>
                            <span class="font-semibold text-slate-800">${esc(tr(dept, dept))}</span>
                        </div>
                        <div>
                            <span class="text-slate-400 block text-[10px]">${esc(tr('experience', 'Experience'))}</span>
                            <span class="font-semibold text-slate-800">${doc.experience || 0} ${esc(tr('yearsExp', 'yrs'))}</span>
                        </div>
                        <div class="col-span-2">
                            <span class="text-slate-400 block text-[10px]">${esc(tr('todaysTimings', "Today's timings"))}</span>
                            <span class="font-semibold text-slate-800">${esc(timings || tr('noSessionsToday', 'No sessions today'))}</span>
                        </div>
                    </div>
                </div>
                <div class="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
                    <div>
                        <span class="text-[10px] text-slate-400 block">${esc(tr('consultationFee', 'Consultation Fee'))}</span>
                        <span class="text-sm font-extrabold text-blue-700">₹${parseFloat(doc.consultation_fee || 0).toFixed(2)}</span>
                    </div>
                    <span class="px-3.5 py-1.5 rounded-lg text-xs font-bold ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'}">
                        ${esc(isSelected ? tr('selectedBtn', 'Selected ✓') : tr('selectBtn', 'Select'))}
                    </span>
                </div>
            </div>`;
    }).join('');
}

function selectDoctor(docId) {
    selectedDoctor = doctorsCache.find(d => d.id === docId) || null;
    selectedSlot = null;
    renderDoctors();
    updateSummary();
    loadSlots();
}

function renderSlotsMessage(message, tone = 'neutral') {
    const cls = tone === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-slate-50 border-slate-300 text-slate-500';
    document.getElementById('slots-grid').innerHTML = `
        <div class="col-span-full p-6 text-center rounded-xl border border-dashed ${cls}">
            <p class="text-xs font-semibold">${esc(message)}</p>
        </div>`;
}

async function loadSlots() {
    if (!selectedDoctor) return;
    const currentReq = ++loadSlotsRequestId;
    renderSlotsMessage(tr('loading', 'Loading available slots...'));

    const res = await API.get(`/doctors/${selectedDoctor.id}/slots/`, { date: selectedDate });
    if (currentReq !== loadSlotsRequestId) return;

    if (!res.ok || !res.data) {
        bookingBlockedReason = res.error?.message || tr('slotsLoadFailed', 'Could not load slots. Please try again.');
        renderSlotsMessage(bookingBlockedReason, 'error');
        updateSummary();
        return;
    }

    bookingBlockedReason = res.data.unavailable_reason || null;
    const slots = res.data.slots || [];
    if (bookingBlockedReason) {
        renderSlotsMessage(bookingBlockedReason, 'error');
    } else if (slots.length === 0) {
        renderSlotsMessage(tr('noSlotsToday', 'No time slots for this date. You can still join the queue without a slot.'));
    } else {
        document.getElementById('slots-grid').innerHTML = slots.map(slot => {
            const bookable = slot.status === 'AVAILABLE' && !slot.is_past;
            const isSelected = selectedSlot && selectedSlot.id === slot.id;
            const timeLabel = `${slot.start_time.substring(0, 5)} - ${slot.end_time.substring(0, 5)}`;
            const statusLabel = slot.is_past ? tr('slotPassed', 'PASSED') : (slot.status === 'AVAILABLE' ? tr('statusAvailable', 'AVAILABLE') : tr('statusBooked', 'BOOKED'));
            const cls = !bookable
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                : isSelected
                    ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-400/30'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50';
            return `
                <button type="button" ${bookable ? '' : 'disabled'} onclick="selectSlot(${slot.id}, '${timeLabel}')"
                        class="p-3 rounded-xl text-xs font-bold text-center border transition-all ${cls}">
                    <div class="${!bookable ? 'line-through' : ''}">${timeLabel}</div>
                    <span class="text-[10px] font-medium block mt-0.5 ${!bookable ? 'text-slate-400' : isSelected ? 'text-blue-100' : 'text-teal-600'}">${esc(statusLabel)}</span>
                </button>`;
        }).join('');
    }
    updateSummary();
}

function selectSlot(slotId, label) {
    selectedSlot = (selectedSlot && selectedSlot.id === slotId) ? null : { id: slotId, label };
    loadSlots();
}

function updateSummary() {
    document.getElementById('summary-doctor').textContent = selectedDoctor ? (selectedDoctor.name || selectedDoctor.full_name) : tr('selectDoctorPrompt', 'Select a doctor');
    document.getElementById('summary-fee').textContent = `₹${parseFloat(selectedDoctor?.consultation_fee || 0).toFixed(2)}`;
    document.getElementById('summary-date').textContent = selectedDate || '-';
    document.getElementById('summary-slot').textContent = selectedSlot ? selectedSlot.label : tr('anyAvailableSlot', 'Join queue (no slot)');

    const note = document.getElementById('booking-blocked-note');
    const btn = document.getElementById('book-submit-btn');
    note.classList.toggle('hidden', !bookingBlockedReason);
    note.textContent = bookingBlockedReason || '';
    btn.disabled = !selectedDoctor || !!bookingBlockedReason;
}

function collectHealthDetails() {
    const out = {};
    const blood = document.getElementById('hp-blood').value;
    const age = document.getElementById('hp-age').value;
    const weight = document.getElementById('hp-weight').value;
    const height = document.getElementById('hp-height').value;
    if (blood) out.blood_group = blood;
    if (age !== '') out.age = parseInt(age);
    if (weight !== '') out.weight_kg = weight;
    if (height !== '') out.height_cm = height;
    return out;
}

async function handleBookAppointment(e) {
    e.preventDefault();
    if (!selectedDoctor) {
        showResultModal(false, tr('selectDoctorPrompt', 'Please select a doctor first.'));
        return;
    }

    const btn = document.getElementById('book-submit-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⟳</span> ${esc(tr('confirmingBooking', 'Confirming Booking...'))}`;

    const payload = Object.assign({
        doctor_id: selectedDoctor.id,
        appointment_date: selectedDate,
        slot_id: selectedSlot ? selectedSlot.id : null,
        problem_description: document.getElementById('problem-description').value.trim(),
    }, collectHealthDetails());

    const res = await API.post('/appointments/book/', payload);
    btn.innerHTML = originalText;

    if (res.ok && res.data) {
        showResultModal(true, null, res.data);
        document.getElementById('problem-description').value = '';
        document.getElementById('problem-count').textContent = '0';
        selectedSlot = null;
        loadSlots();
    } else {
        const reason = res.status === 0
            ? tr('networkError', 'Could not reach the server. Check your internet connection and try again.')
            : (res.error?.message || tr('bookingFailedGeneric', 'The booking could not be completed. Please try again.'));
        showResultModal(false, reason);
        updateSummary();
    }
}

function showResultModal(success, reason, appt = null) {
    const modal = document.getElementById('result-modal');
    const body = document.getElementById('result-modal-body');
    const close = `document.getElementById('result-modal').classList.add('hidden')`;

    if (success) {
        const ahead = appt.patients_ahead ?? 0;
        body.innerHTML = `
            <div class="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 font-black text-3xl flex items-center justify-center mx-auto">✓</div>
            <div>
                <span class="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200 uppercase tracking-wider">${esc(tr('bookingConfirmed', 'Booking Confirmed'))}</span>
                <h3 class="text-2xl font-black text-slate-900 mt-2">${esc(tr('bookingConfirmedSubtitle', 'Your appointment is booked!'))}</h3>
            </div>
            <div class="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-left text-xs">
                <div class="flex items-center justify-between pb-2 border-b border-slate-200">
                    <span class="text-slate-500 font-medium">${esc(tr('tokenNumber', 'Token Number'))}</span>
                    <span class="text-2xl font-black text-blue-700 font-mono">${esc(appt.token_number)}</span>
                </div>
                <div class="flex items-center justify-between py-1"><span class="text-slate-500">${esc(tr('summaryDoctor', 'Doctor'))}</span><span class="font-bold text-slate-800">${esc(appt.doctor_name)}</span></div>
                <div class="flex items-center justify-between py-1"><span class="text-slate-500">${esc(tr('date', 'Date'))}</span><span class="font-semibold text-slate-800">${esc(appt.appointment_date)}</span></div>
                <div class="flex items-center justify-between py-1"><span class="text-slate-500">${esc(tr('timeSlot', 'Slot'))}</span><span class="font-semibold text-slate-800">${esc(appt.slot_time || tr('generalQueue', 'General Queue'))}</span></div>
                <div class="flex items-center justify-between py-1"><span class="text-slate-500">${esc(tr('patientsAhead', 'People ahead of you'))}</span><span class="font-black text-slate-900">${ahead}</span></div>
                <div class="flex items-center justify-between pt-2 border-t border-slate-200"><span class="text-slate-500">${esc(tr('estimatedWait', 'Estimated wait'))}</span><span class="font-bold text-amber-600">~${appt.estimated_wait_minutes || 0} ${esc(tr('minutesShort', 'min'))}</span></div>
            </div>
            <div class="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] font-semibold text-blue-800 text-left">
                ${esc(tr('checkInReminder', 'On arrival, check in at reception so the doctor can call you.'))}
            </div>
            <div class="pt-1 flex flex-col gap-2">
                <a href="/track/?appointment_id=${appt.id}" class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm shadow-md transition-colors">${esc(tr('trackMyToken', 'Track my token live →'))}</a>
                <button onclick="${close}" type="button" class="w-full py-2.5 text-slate-500 hover:text-slate-700 font-semibold text-xs">${esc(tr('bookAnother', 'Close & book another'))}</button>
            </div>`;
    } else {
        body.innerHTML = `
            <div class="w-16 h-16 rounded-full bg-rose-100 text-rose-600 font-black text-3xl flex items-center justify-center mx-auto">✕</div>
            <div>
                <span class="px-3 py-1 bg-rose-50 text-rose-700 rounded-full text-xs font-bold border border-rose-200 uppercase tracking-wider">${esc(tr('bookingFailed', 'Booking Not Confirmed'))}</span>
                <h3 class="text-xl font-black text-slate-900 mt-2">${esc(tr('bookingFailedTitle', 'Your appointment was NOT booked'))}</h3>
            </div>
            <div class="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-left">
                <div class="text-[10px] font-extrabold uppercase tracking-wider text-rose-500 mb-1">${esc(tr('reason', 'Reason'))}</div>
                <p class="text-sm font-semibold text-rose-800">${esc(reason)}</p>
            </div>
            <p class="text-xs text-slate-500">${esc(tr('bookingFailedHelp', 'No token was generated. Please change the doctor, date or slot and try again.'))}</p>
            <button onclick="${close}" type="button" class="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm shadow-md">${esc(tr('tryAgain', 'Try again'))}</button>`;
    }
    modal.classList.remove('hidden');
}
