/**
 * Reception desk: validate patients, walk-ins, remarks, prescriptions, doctor roster & timings.
 */

const tr = (key, fallback) => (typeof I18N !== 'undefined' ? I18N.t(key, fallback) : fallback);
const esc = (v) => API.escapeHtml(v);
const localISODate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const DAYS = [['MON', 'Monday'], ['TUE', 'Tuesday'], ['WED', 'Wednesday'], ['THU', 'Thursday'], ['FRI', 'Friday'], ['SAT', 'Saturday'], ['SUN', 'Sunday']];
const QUICK_REMARKS = ['Fee paid', 'Fee pending', 'Reports pending', 'Senior citizen', 'Needs wheelchair', 'Follow-up visit'];

let allQueueEntries = [];
let roster = [];
let currentFilter = 'ALL';
let deskDate = localISODate();
let pollInterval = null;
let remarkAppointmentId = null;
let scheduleDoctor = null;

const isToday = () => deskDate === localISODate();

const FILTERS = [
    ['ALL', 'filterAll', 'All'],
    ['NEEDS_CHECKIN', 'needsCheckIn', 'Awaiting validation'],
    ['READY', 'readyForDoctor', 'Validated, waiting'],
    ['IN_ROOM', 'inRoom', 'In room'],
    ['COMPLETED', 'statusCompleted', 'Completed'],
    ['WALK_IN', 'walkIns', 'Walk-ins'],
];

const DUTY = {
    ON_DUTY: ['bg-emerald-50 text-emerald-700 border-emerald-200', 'dutyOnNow', 'On duty now'],
    LATER_TODAY: ['bg-blue-50 text-blue-700 border-blue-200', 'dutyLaterToday', 'Later today'],
    DONE_FOR_TODAY: ['bg-slate-100 text-slate-600 border-slate-200', 'dutyDoneToday', 'Done for today'],
    SCHEDULED: ['bg-blue-50 text-blue-700 border-blue-200', 'dutyScheduled', 'Scheduled'],
    OFF_TODAY: ['bg-amber-50 text-amber-700 border-amber-200', 'dutyOffToday', 'Off today'],
    UNAVAILABLE: ['bg-rose-50 text-rose-700 border-rose-200', 'dutyUnavailable', 'Unavailable'],
};

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth(['RECEPTIONIST'])) return;

    const dateInput = document.getElementById('desk-date');
    dateInput.value = deskDate;
    dateInput.addEventListener('change', (e) => {
        deskDate = e.target.value || localISODate();
        document.getElementById('walkin-open-btn').classList.toggle('hidden', !isToday());
        refreshAll();
    });

    document.getElementById('walkin-blood').innerHTML = '<option value="">-</option>' + ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => `<option value="${b}">${b}</option>`).join('');
    document.getElementById('remark-quick').innerHTML = QUICK_REMARKS.map(r =>
        `<button type="button" onclick="appendQuickRemark('${r}')" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-[11px] font-semibold text-slate-700">${esc(tr('remark_' + r, r))}</button>`
    ).join('');

    renderFilterTabs();
    document.getElementById('queue-search').addEventListener('input', renderQueueTable);
    document.getElementById('queue-doctor-filter').addEventListener('change', renderQueueTable);
    document.getElementById('walkin-form').addEventListener('submit', handleAddWalkIn);

    await refreshAll();
    pollInterval = setInterval(refreshAll, 5000);
});

async function refreshAll() {
    await Promise.all([loadRoster(), loadQueue()]);
}

/* ---------------- Roster ---------------- */

async function loadRoster() {
    const res = await API.get('/doctors/roster/', { date: deskDate });
    if (!res.ok || !res.data) return;
    roster = res.data.doctors || [];
    renderRoster(res.data.summary || {});
    renderDoctorFilter();
}

function renderRoster(summary) {
    const pill = (cls, label, n) => `<span class="px-2.5 py-1 rounded-xl border font-bold ${cls}">${esc(label)}: <span class="font-black">${n}</span></span>`;
    document.getElementById('roster-summary').innerHTML =
        pill('bg-slate-50 border-slate-200 text-slate-700', tr('totalDoctors', 'Total doctors'), summary.total || 0) +
        (isToday()
            ? pill('bg-emerald-50 border-emerald-200 text-emerald-700', tr('dutyOnNow', 'On duty now'), summary.on_duty || 0) +
              pill('bg-blue-50 border-blue-200 text-blue-700', tr('dutyLaterToday', 'Later today'), summary.later_today || 0)
            : pill('bg-blue-50 border-blue-200 text-blue-700', tr('dutyScheduled', 'Scheduled'), summary.scheduled || 0)) +
        pill('bg-amber-50 border-amber-200 text-amber-700', tr('offOrUnavailable', 'Off / unavailable'), summary.off || 0);

    const grid = document.getElementById('roster-grid');
    if (roster.length === 0) {
        grid.innerHTML = `<div class="col-span-full p-6 text-center text-slate-400 text-xs">${esc(tr('noDoctorsFound', 'No doctors found.'))}</div>`;
        return;
    }
    grid.innerHTML = roster.map(d => {
        const [cls, key, fb] = DUTY[d.duty_status] || DUTY.OFF_TODAY;
        let dutyText = tr(key, fb);
        if (d.duty_status === 'LATER_TODAY' && d.next_start) dutyText = `${tr('dutyFrom', 'From')} ${d.next_start}`;
        const timings = d.windows.map(w => `${w.start_time}–${w.end_time}`).join(', ') || tr('noSessionsToday', 'No sessions');
        return `
            <div class="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm space-y-3">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                        <div class="font-bold text-slate-900 text-sm truncate">${esc(d.name)}</div>
                        <div class="text-[11px] text-teal-600 font-semibold truncate">${esc(tr(d.department_name, d.department_name))}</div>
                    </div>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${cls}">${esc(dutyText)}</span>
                </div>
                <div class="text-[11px] text-slate-600"><span class="text-slate-400">${esc(tr('timings', 'Timings'))}:</span> <strong>${esc(timings)}</strong></div>
                <div class="grid grid-cols-3 gap-1.5 text-center">
                    <div class="p-1.5 rounded-lg bg-amber-50"><div class="text-[9px] font-bold text-amber-700 uppercase">${esc(tr('statusWaiting', 'Waiting'))}</div><div class="text-sm font-black text-amber-900">${d.waiting}<span class="text-[10px] font-semibold text-amber-600"> (${d.waiting_validated}✓)</span></div></div>
                    <div class="p-1.5 rounded-lg bg-blue-50"><div class="text-[9px] font-bold text-blue-700 uppercase">${esc(tr('nowServing', 'Serving'))}</div><div class="text-sm font-black text-blue-900 font-mono">${esc(d.now_serving || '—')}</div></div>
                    <div class="p-1.5 rounded-lg bg-emerald-50"><div class="text-[9px] font-bold text-emerald-700 uppercase">${esc(tr('statusCompleted', 'Done'))}</div><div class="text-sm font-black text-emerald-900">${d.completed}</div></div>
                </div>
                <div class="flex items-center gap-2 pt-1">
                    <button onclick="openScheduleModal(${d.id})" class="flex-1 px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold border border-indigo-200">⏰ ${esc(tr('setTimings', 'Set timings'))}</button>
                    <button onclick="toggleDoctorAvailability(${d.id}, ${!d.is_available})" class="flex-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border ${d.is_available ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200' : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'}">
                        ${esc(d.is_available ? tr('markUnavailable', 'Mark unavailable') : tr('markAvailable', 'Mark available'))}
                    </button>
                </div>
            </div>`;
    }).join('');
}

function renderDoctorFilter() {
    // Polling must not rebuild a dropdown the receptionist is using
    const select = document.getElementById('queue-doctor-filter');
    if (document.activeElement !== select) {
        const current = select.value;
        select.innerHTML = `<option value="">${esc(tr('allDoctors', 'All doctors'))}</option>` +
            roster.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
        select.value = current;
    }

    if (!document.getElementById('walkin-modal').classList.contains('hidden')) return;
    const walkinSelect = document.getElementById('walkin-doctor');
    const walkinCurrent = walkinSelect.value;
    walkinSelect.innerHTML = roster.map(d => {
        const bookable = d.is_available && ['ON_DUTY', 'LATER_TODAY'].includes(d.duty_status);
        const note = bookable ? '' : ` — ${tr((DUTY[d.duty_status] || DUTY.OFF_TODAY)[1], (DUTY[d.duty_status] || DUTY.OFF_TODAY)[2])}`;
        return `<option value="${d.id}" ${bookable ? '' : 'disabled'}>${esc(d.name)} (${esc(tr(d.department_name, d.department_name))})${esc(note)}</option>`;
    }).join('');
    if (walkinCurrent) walkinSelect.value = walkinCurrent;
}

async function toggleDoctorAvailability(doctorId, makeAvailable) {
    const doc = roster.find(d => d.id === doctorId);
    if (!makeAvailable && !confirm(`${tr('confirmUnavailable', 'Mark this doctor unavailable? Patients will not be able to book them.')}\n${doc ? doc.name : ''}`)) return;
    const res = await API.put(`/doctors/${doctorId}/schedule/`, { is_available: makeAvailable });
    if (res.ok) {
        API.showToast(makeAvailable ? tr('doctorNowAvailable', 'Doctor marked available.') : tr('doctorNowUnavailable', 'Doctor marked unavailable.'), 'success');
        loadRoster();
    } else {
        API.showToast(res.error?.message || tr('saveFailed', 'Could not save.'), 'error');
    }
}

/* ---------------- Schedule modal ---------------- */

function openScheduleModal(doctorId) {
    scheduleDoctor = roster.find(d => d.id === doctorId);
    if (!scheduleDoctor) return;
    document.getElementById('schedule-doctor-name').textContent = `${scheduleDoctor.name} · ${scheduleDoctor.department_name}`;
    document.getElementById('schedule-available').checked = scheduleDoctor.is_available;
    document.getElementById('schedule-error').classList.add('hidden');

    const byDay = {};
    (scheduleDoctor.availabilities || []).forEach(a => {
        (byDay[a.day_of_week] = byDay[a.day_of_week] || []).push([a.start_time.substring(0, 5), a.end_time.substring(0, 5)]);
    });
    document.getElementById('schedule-days').innerHTML = DAYS.map(([code, name]) => `
        <div class="p-3 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-start gap-2" data-day="${code}">
            <div class="w-28 shrink-0 text-xs font-extrabold text-slate-700 pt-2">${esc(tr('day' + code, name))}</div>
            <div class="flex-1 space-y-2 day-windows">
                ${(byDay[code] || []).map(([s, e]) => windowRow(s, e)).join('')}
            </div>
            <button type="button" onclick="addWindow('${code}')" class="shrink-0 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-[11px] font-bold text-slate-700">+ ${esc(tr('addSession', 'Add session'))}</button>
        </div>`).join('');
    document.querySelectorAll('#schedule-days .day-windows').forEach(updateEmptyDayLabel);
    document.getElementById('schedule-modal').classList.remove('hidden');
}

function windowRow(start = '09:00', end = '13:00') {
    return `
        <div class="flex items-center gap-2 window-row">
            <input type="time" value="${start}" class="win-start px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold">
            <span class="text-slate-400 text-xs">→</span>
            <input type="time" value="${end}" class="win-end px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold">
            <button type="button" onclick="removeWindow(this)" class="px-2 py-1 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-bold" aria-label="Remove">✕</button>
        </div>`;
}

function updateEmptyDayLabel(container) {
    const hasRows = container.querySelector('.window-row');
    let label = container.querySelector('.day-off-label');
    if (!hasRows && !label) {
        container.insertAdjacentHTML('beforeend', `<div class="day-off-label text-[11px] text-slate-400 pt-2">${esc(tr('dayOff', 'Day off'))}</div>`);
    } else if (hasRows && label) {
        label.remove();
    }
}

function addWindow(code) {
    const container = document.querySelector(`#schedule-days [data-day="${code}"] .day-windows`);
    container.insertAdjacentHTML('beforeend', windowRow());
    updateEmptyDayLabel(container);
}

function removeWindow(btn) {
    const container = btn.closest('.day-windows');
    btn.closest('.window-row').remove();
    updateEmptyDayLabel(container);
}

function closeScheduleModal() {
    document.getElementById('schedule-modal').classList.add('hidden');
    scheduleDoctor = null;
}

async function saveSchedule() {
    if (!scheduleDoctor) return;
    const availabilities = [];
    document.querySelectorAll('#schedule-days [data-day]').forEach(dayEl => {
        dayEl.querySelectorAll('.window-row').forEach(row => {
            const start = row.querySelector('.win-start').value;
            const end = row.querySelector('.win-end').value;
            if (start && end) availabilities.push({ day_of_week: dayEl.dataset.day, start_time: start, end_time: end });
        });
    });

    const btn = document.getElementById('schedule-save-btn');
    btn.disabled = true;
    const res = await API.put(`/doctors/${scheduleDoctor.id}/schedule/`, {
        is_available: document.getElementById('schedule-available').checked,
        availabilities,
    });
    btn.disabled = false;

    if (res.ok) {
        API.showToast(tr('scheduleSaved', 'Doctor timings saved.'), 'success');
        closeScheduleModal();
        loadRoster();
    } else {
        const box = document.getElementById('schedule-error');
        box.textContent = res.error?.message || tr('saveFailed', 'Could not save.');
        box.classList.remove('hidden');
    }
}

/* ---------------- Queue ---------------- */

async function loadQueue() {
    const res = await API.get('/queue/live/', { date: deskDate });
    if (res.ok && res.data) {
        allQueueEntries = res.data.queue || [];
        updateSummaryCounters();
        renderQueueTable();
    }
}

function matchesFilter(e, filter) {
    switch (filter) {
        case 'NEEDS_CHECKIN': return e.status === 'WAITING' && !e.is_validated;
        case 'READY': return e.status === 'WAITING' && e.is_validated;
        case 'IN_ROOM': return e.status === 'CALLED' || e.status === 'CONSULTING';
        case 'COMPLETED': return e.status === 'COMPLETED';
        case 'WALK_IN': return e.booking_type === 'WALK_IN';
        default: return true;
    }
}

function updateSummaryCounters() {
    const count = (f) => allQueueEntries.filter(e => matchesFilter(e, f)).length;
    document.getElementById('count-total').textContent = allQueueEntries.length;
    document.getElementById('count-unvalidated').textContent = count('NEEDS_CHECKIN');
    document.getElementById('count-waiting').textContent = count('READY');
    document.getElementById('count-inroom').textContent = count('IN_ROOM');
    document.getElementById('count-completed').textContent = count('COMPLETED');
    renderFilterTabs();
}

function renderFilterTabs() {
    document.getElementById('queue-filter-tabs').innerHTML = FILTERS.map(([key, i18nKey, fallback]) => {
        const active = currentFilter === key;
        const n = allQueueEntries.filter(e => matchesFilter(e, key)).length;
        return `<button onclick="filterStatus('${key}')" class="whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${active ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">${esc(tr(i18nKey, fallback))} <span class="opacity-70">${n}</span></button>`;
    }).join('');
}

function filterStatus(filter) {
    currentFilter = filter;
    renderFilterTabs();
    renderQueueTable();
}

function patientMeta(e) {
    const bits = [];
    if (e.patient_age !== null && e.patient_age !== undefined) bits.push(`${e.patient_age}${tr('yearsShort', 'y')}`);
    if (e.patient_gender) bits.push(e.patient_gender);
    if (e.patient_blood_group) bits.push(e.patient_blood_group);
    return bits.join(' · ');
}

function renderQueueTable() {
    const tbody = document.getElementById('queue-table-body');
    const searchTerm = (document.getElementById('queue-search').value || '').toLowerCase();
    const doctorFilter = document.getElementById('queue-doctor-filter').value;

    const filtered = allQueueEntries.filter(e =>
        matchesFilter(e, currentFilter) &&
        (!doctorFilter || String(e.doctor_id) === doctorFilter) &&
        (!searchTerm || [e.token_number, e.patient_name, e.patient_phone, e.doctor_name, e.problem_description]
            .some(v => v && String(v).toLowerCase().includes(searchTerm)))
    );

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-400 text-xs">${esc(tr('noQueueMatches', 'No patient tokens found for this filter.'))}</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(e => {
        const needsValidation = e.status === 'WAITING' && !e.is_validated;
        const validatedBadge = e.is_validated
            ? `<span class="block text-[10px] font-bold text-emerald-700 mt-1">✓ ${esc(tr('validated', 'Validated'))}${e.validated_at ? ' ' + new Date(e.validated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>`
            : (e.status === 'WAITING' ? `<span class="block text-[10px] font-bold text-amber-700 mt-1">⚠ ${esc(tr('notValidated', 'Not validated'))}</span>` : '');

        const actions = [];
        if (needsValidation && isToday()) {
            actions.push(`<button onclick="validatePatient(${e.appointment_id})" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-sm">✓ ${esc(tr('validateSend', 'Validate'))}</button>`);
        }
        actions.push(`<button onclick="openRemarkModal(${e.appointment_id})" class="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold">✎ ${esc(tr('remark', 'Remark'))}</button>`);
        if (e.status === 'WAITING') {
            actions.push(`<button onclick="cancelAppointment(${e.appointment_id})" class="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[11px] font-bold border border-rose-200">${esc(tr('cancelAppt', 'Cancel'))}</button>`);
        }
        if (e.status === 'COMPLETED') {
            actions.push(`<button onclick="downloadRx(${e.appointment_id})" class="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[11px] font-bold border border-blue-200">↓ ${esc(tr('prescriptionShort', 'Prescription'))}</button>`);
        }

        return `
            <tr class="hover:bg-slate-50/80 transition-colors text-xs align-top ${needsValidation ? 'bg-amber-50/30' : ''}">
                <td class="px-3 py-3.5">
                    <span class="font-mono font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 text-sm whitespace-nowrap">${esc(e.token_number)}</span>
                </td>
                <td class="px-3 py-3.5 max-w-[260px]">
                    <div class="font-bold text-slate-900">${esc(e.patient_name)}</div>
                    <div class="text-[11px] text-slate-400">${esc(e.patient_phone || '-')}${patientMeta(e) ? ' · ' + esc(patientMeta(e)) : ''}</div>
                    ${e.problem_description ? `<div class="text-[11px] text-slate-600 mt-1 line-clamp-2" title="${esc(e.problem_description)}">🩹 ${esc(e.problem_description)}</div>` : ''}
                </td>
                <td class="px-3 py-3.5">
                    <div class="font-semibold text-slate-800">${esc(e.doctor_name)}</div>
                    <div class="text-[10px] text-teal-600 font-bold">${esc(tr(e.department_name, e.department_name))}</div>
                </td>
                <td class="px-3 py-3.5">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${e.booking_type === 'ONLINE' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}">${esc(e.booking_type === 'WALK_IN' ? tr('walkIn', 'Walk-in') : tr('online', 'Online'))}</span>
                    <span class="block text-[10px] text-slate-400 mt-0.5">${esc(e.slot_time || tr('noSlot', 'No slot'))}</span>
                </td>
                <td class="px-3 py-3.5">
                    <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${getStatusClass(e.status)}">${esc(tr('status' + e.status.charAt(0) + e.status.slice(1).toLowerCase(), e.status))}</span>
                    ${validatedBadge}
                    ${e.status === 'WAITING' ? `<span class="block text-[10px] text-slate-400 mt-0.5">${e.patients_ahead} ${esc(tr('ahead', 'ahead'))} · ~${e.eta_minutes}m</span>` : ''}
                </td>
                <td class="px-3 py-3.5 max-w-[180px]">
                    ${e.reception_remark ? `<span class="text-[11px] text-slate-700 bg-yellow-50 border border-yellow-200 px-2 py-1 rounded-lg inline-block">${esc(e.reception_remark)}</span>` : '<span class="text-slate-300">—</span>'}
                </td>
                <td class="px-3 py-3.5 text-right">
                    <div class="flex flex-wrap justify-end gap-1">${actions.join('')}</div>
                </td>
            </tr>`;
    }).join('');
}

function getStatusClass(status) {
    switch (status) {
        case 'WAITING': return 'bg-amber-50 text-amber-800 border border-amber-200';
        case 'CALLED': return 'bg-rose-50 text-rose-800 border border-rose-200 animate-pulse';
        case 'CONSULTING': return 'bg-blue-50 text-blue-800 border border-blue-200';
        case 'COMPLETED': return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
        default: return 'bg-slate-100 text-slate-700';
    }
}

async function validatePatient(appointmentId) {
    const res = await API.post('/queue/validate/', { appointment_id: appointmentId });
    if (res.ok) {
        API.showToast(`${tr('patientValidated', 'Patient validated and sent to the doctor queue')}: ${res.data.token_number}`, 'success');
        refreshAll();
    } else {
        API.showToast(res.error?.message || tr('validateFailed', 'Could not validate patient.'), 'error');
    }
}

async function cancelAppointment(appointmentId) {
    const entry = allQueueEntries.find(x => x.appointment_id === appointmentId);
    if (!confirm(`${tr('confirmCancelToken', 'Cancel token')} ${entry ? entry.token_number : ''}?`)) return;
    const res = await API.post(`/appointments/${appointmentId}/cancel/`);
    if (res.ok) {
        API.showToast(tr('apptCancelled', 'Appointment cancelled successfully.'), 'info');
        refreshAll();
    } else {
        API.showToast(res.error?.message || tr('cancelFailed', 'Cancellation failed'), 'error');
    }
}

function downloadRx(appointmentId) {
    const e = allQueueEntries.find(x => x.appointment_id === appointmentId) || {};
    Prescription.download(appointmentId, {
        token_number: e.token_number, doctor_name: e.doctor_name, specialization: e.specialization,
        department_name: e.department_name, booking_type: e.booking_type,
        patient_name: e.patient_name, patient_phone: e.patient_phone,
    });
}

/* ---------------- Remarks ---------------- */

function openRemarkModal(appointmentId) {
    const e = allQueueEntries.find(x => x.appointment_id === appointmentId);
    if (!e) return;
    remarkAppointmentId = appointmentId;
    document.getElementById('remark-token').textContent = e.token_number;
    document.getElementById('remark-text').value = e.reception_remark || '';
    document.getElementById('remark-modal').classList.remove('hidden');
    document.getElementById('remark-text').focus();
}

function closeRemarkModal() {
    document.getElementById('remark-modal').classList.add('hidden');
    remarkAppointmentId = null;
}

function appendQuickRemark(text) {
    const box = document.getElementById('remark-text');
    const label = tr('remark_' + text, text);
    box.value = box.value.trim() ? `${box.value.trim()}, ${label}` : label;
}

async function saveRemark() {
    if (!remarkAppointmentId) return;
    const btn = document.getElementById('remark-save-btn');
    btn.disabled = true;
    const res = await API.post('/queue/remark/', { appointment_id: remarkAppointmentId, remark: document.getElementById('remark-text').value });
    btn.disabled = false;
    if (res.ok) {
        API.showToast(tr('remarkSaved', 'Remark saved.'), 'success');
        closeRemarkModal();
        loadQueue();
    } else {
        API.showToast(res.error?.message || tr('saveFailed', 'Could not save.'), 'error');
    }
}

/* ---------------- Walk-in ---------------- */

function openWalkInModal() {
    document.getElementById('walkin-error').classList.add('hidden');
    document.getElementById('walkin-modal').classList.remove('hidden');
}

function closeWalkInModal() {
    document.getElementById('walkin-modal').classList.add('hidden');
}

async function handleAddWalkIn(e) {
    e.preventDefault();
    const btn = document.getElementById('walkin-submit-btn');
    const errorBox = document.getElementById('walkin-error');
    errorBox.classList.add('hidden');
    btn.disabled = true;

    const val = (id) => document.getElementById(id).value.trim();
    const payload = {
        doctor_id: parseInt(val('walkin-doctor')),
        patient_name: val('walkin-name'),
        patient_phone: val('walkin-phone'),
        problem_description: val('walkin-problem'),
    };
    if (val('walkin-age') !== '') payload.age = parseInt(val('walkin-age'));
    if (val('walkin-gender')) payload.gender = val('walkin-gender');
    if (val('walkin-blood')) payload.blood_group = val('walkin-blood');
    if (val('walkin-weight') !== '') payload.weight_kg = val('walkin-weight');
    if (val('walkin-height') !== '') payload.height_cm = val('walkin-height');

    const res = await API.post('/queue/walk-in/', payload);
    btn.disabled = false;

    if (res.ok && res.data) {
        API.showToast(`${tr('walkInIssued', 'Walk-in token issued')}: #${res.data.token_number} (${res.data.patients_ahead} ${tr('ahead', 'ahead')})`, 'success');
        closeWalkInModal();
        document.getElementById('walkin-form').reset();
        refreshAll();
    } else {
        const fieldErr = res.error?.fields ? Object.values(res.error.fields)[0] : null;
        errorBox.textContent = res.error?.message && res.error.message !== 'Validation failed'
            ? res.error.message
            : (Array.isArray(fieldErr) ? fieldErr[0] : (fieldErr || tr('walkInFailed', 'Failed to register walk-in patient.')));
        errorBox.classList.remove('hidden');
    }
}
