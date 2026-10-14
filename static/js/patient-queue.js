/**
 * Patient: live queue tracking, appointment history and health profile.
 */

const tr = (key, fallback) => (typeof I18N !== 'undefined' ? I18N.t(key, fallback) : fallback);
const esc = (v) => API.escapeHtml(v);

const POLL_SECONDS = 5;
const localISODate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

let pollTimer = null;
let countdownTimer = null;
let secondsToRefresh = POLL_SECONDS;
let currentAppointmentId = null;
let previousStatus = null;
let previousValidated = null;
let allAppointments = [];
let appointmentsTab = 'upcoming';
let healthProfile = null;

const STATUS_LABEL_KEYS = {
    BOOKED: ['statusBooked', 'Booked'], WAITING: ['statusWaiting', 'Waiting'], CALLED: ['statusCalled', 'Called'],
    CONSULTING: ['statusConsulting', 'In consultation'], COMPLETED: ['statusCompleted', 'Completed'], CANCELLED: ['statusCancelled', 'Cancelled'],
};
const statusLabel = (s) => { const [k, f] = STATUS_LABEL_KEYS[s] || [s, s]; return tr(k, f); };
const bookingLabel = (t) => t === 'WALK_IN' ? tr('walkIn', 'Walk-in') : tr('online', 'Online');

document.addEventListener('DOMContentLoaded', async () => {
    if (!API.requireAuth(['PATIENT'])) return;

    const urlParams = new URLSearchParams(window.location.search);
    currentAppointmentId = urlParams.get('appointment_id') ? parseInt(urlParams.get('appointment_id')) : null;

    document.getElementById('hf-blood').innerHTML = `<option value="">${esc(tr('selectOption', 'Select'))}</option>` +
        ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(b => `<option value="${b}">${b}</option>`).join('');
    document.getElementById('health-form').addEventListener('submit', saveHealthProfile);

    await Promise.all([loadHealthProfile(), refreshAll()]);
    startPolling();

    // Pause polling in background tabs; refresh the moment the patient comes back.
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            stopPolling();
        } else {
            refreshAll();
            startPolling();
        }
    });
    // Instant refresh when a new notification (called / checked in...) arrives.
    window.addEventListener('notificationReceived', () => refreshAll());
});

function startPolling() {
    stopPolling();
    secondsToRefresh = POLL_SECONDS;
    pollTimer = setInterval(refreshAll, POLL_SECONDS * 1000);
    countdownTimer = setInterval(() => {
        secondsToRefresh = Math.max(0, secondsToRefresh - 1);
        const el = document.getElementById('refresh-countdown');
        if (el) el.textContent = `${tr('nextRefreshIn', 'next update in')} ${secondsToRefresh}s`;
    }, 1000);
}

function stopPolling() {
    clearInterval(pollTimer);
    clearInterval(countdownTimer);
    pollTimer = countdownTimer = null;
}

async function refreshAll() {
    secondsToRefresh = POLL_SECONDS;
    await loadAllAppointments();
    await fetchQueueStatus();
}

function refreshQueueManual() {
    API.showToast(tr('refreshingQueue', 'Refreshing queue state...'), 'info');
    refreshAll();
}

/* ---------------- Appointments list ---------------- */

function isPastAppointment(a) {
    return ['COMPLETED', 'CANCELLED'].includes(a.status) || a.appointment_date < localISODate();
}

async function loadAllAppointments() {
    const res = await API.get('/appointments/my-appointments/');
    if (!res.ok || !Array.isArray(res.data)) return;
    allAppointments = res.data;

    if (!currentAppointmentId || !allAppointments.some(a => a.id === currentAppointmentId)) {
        // Track whatever matters most right now: in the room > checked in today > today > next upcoming
        const rank = (a) => {
            if (['CALLED', 'CONSULTING'].includes(a.status)) return 0;
            if (a.appointment_date === localISODate()) return a.is_validated ? 1 : 2;
            return 3;
        };
        const upcoming = allAppointments.filter(a => !isPastAppointment(a))
            .sort((a, b) => rank(a) - rank(b) || a.appointment_date.localeCompare(b.appointment_date));
        currentAppointmentId = (upcoming[0] || allAppointments[0] || {}).id || null;
    }
    renderAppointmentsList();
}

function switchAppointmentsTab(tab) {
    appointmentsTab = tab;
    const active = 'appt-tab px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-blue-700 shadow-sm';
    const inactive = 'appt-tab px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500';
    document.getElementById('appt-tab-upcoming').className = tab === 'upcoming' ? active : inactive;
    document.getElementById('appt-tab-past').className = tab === 'past' ? active : inactive;
    renderAppointmentsList();
}

function renderAppointmentsList() {
    const list = document.getElementById('appointments-cards-list');
    const upcoming = allAppointments.filter(a => !isPastAppointment(a)).sort((a, b) => a.appointment_date.localeCompare(b.appointment_date));
    const past = allAppointments.filter(isPastAppointment);
    document.getElementById('count-upcoming').textContent = `(${upcoming.length})`;
    document.getElementById('count-past').textContent = `(${past.length})`;

    const items = appointmentsTab === 'upcoming' ? upcoming : past;
    if (items.length === 0) {
        list.innerHTML = `
            <div class="col-span-full p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                <p class="text-xs font-semibold text-slate-500">${esc(appointmentsTab === 'upcoming' ? tr('noUpcoming', 'No upcoming appointments.') : tr('noPastHistory', 'No past appointments yet.'))}</p>
                ${appointmentsTab === 'upcoming' ? `<a href="/book/" class="inline-block mt-2 text-xs font-bold text-blue-600 hover:underline">${esc(tr('bookFirstAppt', '+ Book an appointment'))}</a>` : ''}
            </div>`;
        return;
    }

    list.innerHTML = items.map(appt => {
        const isTracking = currentAppointmentId === appt.id;
        const fee = appt.consultation_fee ? `₹${parseFloat(appt.consultation_fee).toFixed(2)}` : '';
        const canCancel = ['WAITING', 'BOOKED'].includes(appt.status) && !isPastAppointment(appt);
        const hasRx = appt.status === 'COMPLETED';
        const checkIn = !isPastAppointment(appt) && appt.appointment_date === localISODate()
            ? (appt.is_validated
                ? `<span class="text-[10px] font-bold text-emerald-700">✓ ${esc(tr('checkedIn', 'Checked in'))}</span>`
                : `<span class="text-[10px] font-bold text-amber-700">${esc(tr('notCheckedIn', 'Not checked in'))}</span>`)
            : '';

        return `
            <div class="p-4 sm:p-5 rounded-2xl border transition-all ${isTracking ? 'bg-blue-50/70 border-blue-500 shadow-md ring-2 ring-blue-500/20' : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'}">
                <div class="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-mono font-black text-xs text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md">${esc(appt.token_number || '#--')}</span>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusBadgeClass(appt.status)}">${esc(statusLabel(appt.status))}</span>
                            ${checkIn}
                        </div>
                        <h4 class="font-extrabold text-slate-900 text-sm mt-1.5 truncate">${esc(appt.doctor_name)}</h4>
                        <p class="text-[11px] text-blue-600 font-semibold truncate">${esc(appt.specialization || appt.department_name || '')}</p>
                    </div>
                    <div class="text-right shrink-0">
                        ${fee ? `<div class="text-xs font-black text-slate-800">${fee}</div>` : ''}
                        <div class="text-[10px] text-slate-400 mt-0.5">${esc(bookingLabel(appt.booking_type))}</div>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2 pt-3 text-xs text-slate-600">
                    <div><span class="text-[10px] text-slate-400 block">${esc(tr('date', 'Date'))}</span><strong class="font-semibold text-slate-800">${esc(appt.appointment_date)}</strong></div>
                    <div><span class="text-[10px] text-slate-400 block">${esc(tr('timeSlot', 'Time / Slot'))}</span><strong class="font-semibold text-slate-800">${esc(appt.slot_time || tr('generalQueue', 'General Queue'))}</strong></div>
                </div>
                ${appt.problem_description ? `
                    <div class="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600">
                        <span class="font-bold text-slate-500">${esc(tr('yourProblem', 'Your problem'))}:</span> ${esc(appt.problem_description)}
                    </div>` : ''}
                <div class="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 gap-2 flex-wrap">
                    <div class="flex items-center gap-2">
                        ${canCancel ? `<button onclick="cancelPatientAppointment(${appt.id})" class="text-[11px] font-bold text-rose-600 hover:underline min-h-[36px]">${esc(tr('cancelAppt', 'Cancel'))}</button>` : ''}
                        ${hasRx ? `
                            <button type="button" onclick="downloadPrescription(${appt.id})" class="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-[11px] border border-blue-200 min-h-[36px]">
                                ${esc(tr('downloadPrescription', '↓ Download Prescription'))}
                            </button>` : ''}
                    </div>
                    ${isTracking
                        ? `<span class="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-[11px] shadow-sm flex items-center gap-1 min-h-[36px]"><span class="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>${esc(tr('currentlyTracking', 'Tracking'))}</span>`
                        : `<button onclick="selectAppointmentForTracking(${appt.id})" class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-[11px] border border-slate-200 min-h-[36px]">${esc(isPastAppointment(appt) ? tr('viewDetails', 'View') : tr('trackThis', 'Track Live →'))}</button>`}
                </div>
            </div>`;
    }).join('');
}

function selectAppointmentForTracking(appointmentId) {
    currentAppointmentId = appointmentId;
    previousStatus = previousValidated = null;
    renderAppointmentsList();
    fetchQueueStatus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function cancelPatientAppointment(appointmentId) {
    if (!confirm(tr('confirmCancelAppt', 'Are you sure you want to cancel this appointment?'))) return;
    const res = await API.post(`/appointments/${appointmentId}/cancel/`);
    if (res.ok) {
        API.showToast(tr('apptCancelled', 'Appointment cancelled successfully.'), 'info');
        refreshAll();
    } else {
        API.showToast(res.error?.message || tr('cancelFailed', 'Cancellation failed'), 'error');
    }
}

function downloadPrescription(appointmentId) {
    const appt = allAppointments.find(a => a.id === appointmentId) || {};
    Prescription.download(appointmentId, {
        doctor_name: appt.doctor_name, specialization: appt.specialization, department_name: appt.department_name,
        token_number: appt.token_number, appointment_date: appt.appointment_date, booking_type: appt.booking_type,
        patient_name: appt.patient_name, patient_phone: appt.patient_phone,
    });
}

/* ---------------- Live tracker ---------------- */

async function fetchQueueStatus() {
    const res = await API.get('/queue/patient-status/', currentAppointmentId ? { appointment_id: currentAppointmentId } : {});
    document.getElementById('last-updated-time').textContent = new Date().toLocaleTimeString();

    const tracker = document.getElementById('tracker-content');
    const empty = document.getElementById('empty-state');
    const calledAlert = document.getElementById('called-alert-banner');

    const entry = res.ok ? res.data : null;
    if (!entry) {
        calledAlert.classList.add('hidden');
        const selected = allAppointments.find(a => a.id === currentAppointmentId);
        if (!selected) {
            tracker.classList.add('hidden');
            empty.classList.toggle('hidden', allAppointments.length > 0);
            return;
        }
        // Cancelled appointments have no queue entry; show their details without live numbers
        empty.classList.add('hidden');
        tracker.classList.remove('hidden');
        renderHero(Object.assign({}, selected, { queue: null }));
        document.getElementById('tracker-board').innerHTML = '';
        renderProgress(selected.status, false);
        return;
    }

    tracker.classList.remove('hidden');
    empty.classList.add('hidden');

    const appt = allAppointments.find(a => a.id === entry.appointment_id) || {};
    const merged = Object.assign({}, appt, entry, { id: entry.appointment_id });

    // Turn alert + sound on the transition to CALLED
    if (entry.status === 'CALLED') {
        calledAlert.classList.remove('hidden');
        if (previousStatus && previousStatus !== 'CALLED') {
            API.showToast(tr('doctorCalledToast', 'The doctor has called your token! Please proceed to the consultation room.'), 'warning');
            try { new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3').play().catch(() => {}); } catch (e) {}
        }
    } else {
        calledAlert.classList.add('hidden');
    }
    if (previousValidated === false && entry.is_validated) {
        API.showToast(tr('checkedInToast', 'You are checked in! Please wait for the doctor to call you.'), 'success');
    }
    previousStatus = entry.status;
    previousValidated = entry.is_validated;

    renderHero(merged);
    renderBoard(merged);
    renderProgress(entry.status, entry.is_validated);
}

function formatClock(iso) {
    try {
        return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '';
    }
}

function renderHero(e) {
    const q = e.queue;
    const isWaiting = e.status === 'WAITING';
    const isToday = q ? q.is_today : e.appointment_date === localISODate();
    const isFuture = e.appointment_date > localISODate();
    const ahead = q ? q.ahead : null;

    let headline = '';
    if (e.status === 'CANCELLED') {
        headline = `<div class="text-center py-4"><div class="text-2xl font-black text-slate-300">${esc(tr('statusCancelled', 'Cancelled'))}</div></div>`;
    } else if (e.status === 'COMPLETED') {
        headline = `<div class="text-center py-4"><div class="text-3xl font-black text-emerald-300">✓ ${esc(tr('consultationDone', 'Consultation completed'))}</div></div>`;
    } else if (e.status === 'CALLED' || e.status === 'CONSULTING') {
        headline = `<div class="text-center py-4"><div class="text-3xl sm:text-4xl font-black text-rose-300">${esc(e.status === 'CALLED' ? tr('itsYourTurn', "It's your turn!") : tr('youAreInConsultation', 'You are with the doctor'))}</div></div>`;
    } else if (ahead) {
        const chip = (cls, text) => `<span class="px-2.5 py-1 rounded-full text-[11px] font-bold ${cls}">${esc(text)}</span>`;
        headline = `
            <div class="text-center py-2">
                <div class="text-[11px] sm:text-xs uppercase tracking-widest font-bold text-blue-300">${esc(isFuture ? tr('bookingsBeforeYou', 'Bookings before you so far') : tr('peopleAheadOfYou', 'People ahead of you'))}</div>
                <div class="text-7xl sm:text-8xl font-black text-white leading-none mt-2" id="display-ahead">${ahead.total}</div>
                <div class="flex flex-wrap items-center justify-center gap-2 mt-4">
                    ${chip('bg-amber-400/20 text-amber-200 border border-amber-300/30', `🚶 ${ahead.walk_in} ${tr('walkInPlural', 'walk-in')}`)}
                    ${chip('bg-sky-400/20 text-sky-200 border border-sky-300/30', `🌐 ${ahead.online} ${tr('onlinePlural', 'online')}`)}
                    ${ahead.in_room ? chip('bg-rose-400/20 text-rose-200 border border-rose-300/30', `🩺 ${ahead.in_room} ${tr('inRoomNow', 'in room now')}`) : ''}
                </div>
                ${isToday && ahead.total ? `
                    <div class="text-[11px] text-slate-300 mt-2">
                        ✓ ${ahead.checked_in} ${esc(tr('aheadCheckedIn', 'already at the clinic'))} · ${ahead.not_checked_in} ${esc(tr('aheadNotArrived', 'not arrived yet'))}
                    </div>` : ''}
            </div>`;
    }

    // Check-in banner (today only)
    let checkInBanner = '';
    if (isToday && isWaiting) {
        checkInBanner = e.is_validated
            ? `<div class="mt-5 p-3 rounded-2xl bg-emerald-500/15 border border-emerald-400/30 text-emerald-200 text-xs font-semibold flex items-center gap-2">
                   <span class="text-base">✓</span><span>${esc(tr('checkedInAt', 'Checked in at reception'))}${e.validated_at ? ` · ${formatClock(e.validated_at)}` : ''}. ${esc(tr('waitForCall', 'Please wait — the doctor will call you.'))}</span>
               </div>`
            : `<div class="mt-5 p-3 rounded-2xl bg-amber-400/15 border border-amber-300/40 text-amber-100 text-xs font-semibold flex items-center gap-2">
                   <span class="text-base">⚠</span><span>${esc(tr('pleaseCheckIn', 'Not checked in yet. Please report at the reception desk when you arrive — the doctor can call you only after reception validates you.'))}</span>
               </div>`;
    } else if (isFuture && e.status !== 'CANCELLED') {
        checkInBanner = `<div class="mt-5 p-3 rounded-2xl bg-white/5 border border-white/10 text-slate-300 text-xs font-semibold">
            📅 ${esc(tr('scheduledFor', 'Scheduled for'))} <strong class="text-white">${esc(e.appointment_date)}</strong>. ${esc(tr('liveTrackingStarts', 'Live tracking starts on the day of your appointment.'))}
        </div>`;
    }

    const metric = (label, value, cls = 'text-white') => `
        <div class="p-2.5 sm:p-4 rounded-2xl bg-white/5 border border-white/10 min-w-0">
            <span class="text-[9px] sm:text-[10px] uppercase tracking-wide text-slate-400 font-semibold block leading-tight">${esc(label)}</span>
            <span class="text-sm sm:text-xl font-black mt-1 block whitespace-nowrap ${cls}">${value}</span>
        </div>`;

    const metrics = q && isToday && !['COMPLETED', 'CANCELLED'].includes(e.status) ? `
        <div class="grid grid-cols-3 gap-2 sm:gap-3 mt-5">
            ${metric(tr('nowServing', 'Now serving'), esc(q.now_serving ? q.now_serving.token_number : '—'), 'text-teal-300 font-mono')}
            ${metric(tr('dynamicEta', 'Estimated wait'), isWaiting ? `~${e.eta_minutes || 0} ${esc(tr('minutesShort', 'min'))}` : '—', 'text-amber-300')}
            ${metric(tr('expectedTurn', 'Expected turn'), isWaiting && q.expected_call_at ? `~${formatClock(q.expected_call_at)}` : '—', 'text-white')}
        </div>
        <div class="text-[10px] text-slate-400 mt-2 text-center">${esc(tr('queueTotals', 'Today with this doctor'))}: ${q.total_waiting} ${esc(tr('statusWaiting', 'waiting'))} · ${q.completed_count} ${esc(tr('statusCompleted', 'completed'))} · ${q.walk_in_total} ${esc(tr('walkInPlural', 'walk-in'))} · ~${q.avg_consultation_minutes} ${esc(tr('minPerPatient', 'min per patient'))}</div>
    ` : '';

    const rx = e.status === 'COMPLETED' ? `
        <div class="mt-5 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white/5 p-4 rounded-2xl border border-white/10">
            <div>
                <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span><span class="text-xs sm:text-sm font-bold text-white uppercase tracking-wider">${esc(tr('prescriptionTitle', 'Medical Prescription'))}</span></div>
                <p class="text-[11px] sm:text-xs text-slate-300 mt-0.5">${esc(tr('prescriptionAvailableDesc', 'Doctor has completed consultation and saved prescription.'))}</p>
            </div>
            <button type="button" onclick="downloadPrescription(${e.id})" class="px-5 py-2.5 bg-white hover:bg-blue-50 text-blue-800 font-black rounded-xl text-xs sm:text-sm shadow-lg border border-blue-200 min-h-[44px]">
                ${esc(tr('downloadPrescription', '↓ Download Prescription'))}
            </button>
        </div>` : '';

    document.getElementById('tracker-hero').innerHTML = `
        <div class="bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white p-5 sm:p-8 rounded-3xl shadow-2xl relative overflow-hidden">
            <div class="flex items-center justify-between gap-3 pb-4 border-b border-white/10">
                <div class="min-w-0">
                    <span class="text-[10px] sm:text-xs font-semibold text-blue-300 uppercase tracking-wider block">${esc(tr('yourActiveToken', 'Your Token'))}</span>
                    <div class="text-4xl sm:text-5xl font-black tracking-tight mt-0.5 font-mono truncate" id="display-token">${esc(e.token_number || '--')}</div>
                </div>
                <div class="flex flex-col items-end gap-1 shrink-0">
                    <span class="px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[11px] sm:text-xs font-black uppercase tracking-wider ${getStatusBadgeClass(e.status)}">${esc(statusLabel(e.status))}</span>
                    <span class="text-[11px] text-slate-300 font-medium">${esc(bookingLabel(e.booking_type))}${e.slot_time ? ` · ${esc(e.slot_time)}` : ''}</span>
                </div>
            </div>
            ${headline}
            ${checkInBanner}
            ${metrics}
            <div class="mt-5 pt-4 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-slate-300">
                <div><span class="text-slate-400">${esc(tr('consultingDoctor', 'Doctor'))}:</span> <strong class="text-white">${esc(e.doctor_name || '--')}</strong> <span class="text-blue-300 text-[11px]">${esc(e.specialization || '')}</span></div>
                <div><span class="text-slate-400">${esc(tr('date', 'Date'))}:</span> <strong class="text-white">${esc(e.appointment_date || e.queue_date || '')}</strong></div>
            </div>
            ${rx}
        </div>`;
}

function renderBoard(e) {
    const q = e.queue;
    const container = document.getElementById('tracker-board');
    if (!q || !q.board || q.board.length === 0 || ['COMPLETED', 'CANCELLED'].includes(e.status)) {
        container.innerHTML = '';
        return;
    }

    const youIndex = q.board.findIndex(b => b.is_you);
    // Show everyone up to you plus a few after, so long queues stay readable
    const visible = q.board.slice(0, youIndex >= 0 ? youIndex + 4 : 12);
    const hiddenAfter = q.board.length - visible.length;

    const chip = (b) => {
        let cls = 'bg-white border-slate-200 text-slate-700';
        let note = b.is_validated ? tr('atClinic', 'At clinic') : tr('notArrived', 'Not arrived');
        if (b.status === 'CONSULTING') { cls = 'bg-blue-600 border-blue-600 text-white'; note = tr('inRoom', 'In room'); }
        else if (b.status === 'CALLED') { cls = 'bg-rose-500 border-rose-500 text-white'; note = tr('statusCalled', 'Called'); }
        else if (!b.is_validated) cls = 'bg-slate-50 border-dashed border-slate-300 text-slate-400';
        if (b.is_you) cls += ' ring-4 ring-amber-300 scale-105';
        return `
            <div class="shrink-0 w-24 p-2.5 rounded-2xl border text-center transition-all ${cls}">
                <div class="text-[9px] font-extrabold uppercase tracking-wider ${b.is_you ? '' : 'opacity-70'}">${b.is_you ? esc(tr('you', 'YOU')) : (b.booking_type === 'WALK_IN' ? '🚶 ' + esc(tr('walkIn', 'Walk-in')) : '🌐 ' + esc(tr('online', 'Online')))}</div>
                <div class="font-mono font-black text-base mt-0.5">${esc(b.token_number)}</div>
                <div class="text-[9px] font-semibold mt-0.5 opacity-80">${esc(note)}</div>
            </div>`;
    };

    container.innerHTML = `
        <div class="bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
                <h3 class="font-extrabold text-slate-900 text-sm">${esc(tr('liveQueueBoard', 'Live queue'))} · ${esc(e.doctor_name || '')}</h3>
                <div class="flex flex-wrap items-center gap-3 text-[10px] font-semibold text-slate-500">
                    <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded bg-blue-600"></span>${esc(tr('inRoom', 'In room'))}</span>
                    <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded border border-slate-300 bg-white"></span>${esc(tr('atClinic', 'At clinic'))}</span>
                    <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded border border-dashed border-slate-300 bg-slate-50"></span>${esc(tr('notArrived', 'Not arrived'))}</span>
                </div>
            </div>
            <div class="flex items-stretch gap-2 overflow-x-auto pb-2 pt-1 px-1">
                ${visible.map(chip).join('<div class="self-center text-slate-300 shrink-0">→</div>')}
                ${hiddenAfter > 0 ? `<div class="self-center text-[11px] font-bold text-slate-400 shrink-0 px-2">+${hiddenAfter} ${esc(tr('more', 'more'))}</div>` : ''}
            </div>
            <p class="text-[10px] text-slate-400">${esc(tr('boardPrivacyNote', 'Only token numbers are shown — other patients\' details are private.'))}</p>
        </div>`;
}

function renderProgress(status, isValidated) {
    const steps = [
        ['stepBooked', 'Booked'],
        ['stepCheckedIn', 'Checked in'],
        ['statusCalled', 'Called'],
        ['statusConsulting', 'In consultation'],
        ['statusCompleted', 'Completed'],
    ];
    let reached = 0;
    if (status === 'WAITING' || status === 'BOOKED') reached = isValidated ? 1 : 0;
    else if (status === 'CALLED') reached = 2;
    else if (status === 'CONSULTING') reached = 3;
    else if (status === 'COMPLETED') reached = 4;
    const cancelled = status === 'CANCELLED';

    document.getElementById('tracker-progress').innerHTML = `
        <h3 class="font-extrabold text-slate-900 text-sm mb-6">${esc(tr('consultationFlowStage', 'Your visit progress'))}</h3>
        <div class="relative">
            <div class="absolute top-4 left-4 right-4 h-1 bg-slate-200">
                <div class="h-1 ${cancelled ? 'bg-slate-300' : 'bg-blue-600'} transition-all duration-500" style="width: ${cancelled ? 0 : (reached / (steps.length - 1)) * 100}%"></div>
            </div>
            <div class="flex items-start justify-between relative z-10">
                ${steps.map(([key, fallback], idx) => {
                    const done = !cancelled && idx <= reached;
                    return `
                        <div class="flex flex-col items-center w-14 sm:w-20">
                            <div class="w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center font-bold text-xs ${done ? 'bg-blue-600 text-white ring-4 ring-blue-100' : 'bg-slate-200 text-slate-500'}">${idx === steps.length - 1 ? '✓' : idx + 1}</div>
                            <span class="text-[10px] sm:text-xs mt-2 text-center leading-tight ${done ? 'font-bold text-blue-700' : 'font-medium text-slate-400'}">${esc(tr(key, fallback))}</span>
                        </div>`;
                }).join('')}
            </div>
        </div>`;
}

/* ---------------- Health profile ---------------- */

async function loadHealthProfile() {
    const res = await API.get('/auth/me/');
    healthProfile = res.ok && res.data ? res.data.patient : null;
    renderHealthView();
}

function renderHealthView() {
    const p = healthProfile || {};
    const cell = (label, value) => `
        <div class="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <div class="text-[10px] font-bold uppercase tracking-wider text-slate-400">${esc(label)}</div>
            <div class="text-base font-black ${value ? 'text-slate-900' : 'text-slate-300'} mt-0.5">${esc(value || '—')}</div>
        </div>`;
    document.getElementById('health-view').innerHTML =
        cell(tr('bloodGroup', 'Blood Group'), p.blood_group) +
        cell(tr('age', 'Age'), p.age !== null && p.age !== undefined ? `${p.age} ${tr('yearsShort', 'yrs')}` : '') +
        cell(tr('weight', 'Weight'), p.weight_kg ? `${parseFloat(p.weight_kg)} kg` : '') +
        cell(tr('height', 'Height'), p.height_cm ? `${parseFloat(p.height_cm)} cm` : '') +
        cell(tr('gender', 'Gender'), p.gender ? tr('gender' + p.gender, p.gender) : '');
}

function toggleHealthEdit(editing) {
    const p = healthProfile || {};
    document.getElementById('health-form').classList.toggle('hidden', !editing);
    document.getElementById('health-view').classList.toggle('hidden', editing);
    document.getElementById('health-edit-btn').classList.toggle('hidden', editing);
    if (editing) {
        document.getElementById('hf-blood').value = p.blood_group || '';
        document.getElementById('hf-age').value = p.age ?? '';
        document.getElementById('hf-weight').value = p.weight_kg ? parseFloat(p.weight_kg) : '';
        document.getElementById('hf-height').value = p.height_cm ? parseFloat(p.height_cm) : '';
        document.getElementById('hf-gender').value = p.gender || '';
    }
}

async function saveHealthProfile(e) {
    e.preventDefault();
    const val = (id) => document.getElementById(id).value;
    const payload = {};
    if (val('hf-blood')) payload.blood_group = val('hf-blood');
    if (val('hf-age') !== '') payload.age = parseInt(val('hf-age'));
    if (val('hf-weight') !== '') payload.weight_kg = val('hf-weight');
    if (val('hf-height') !== '') payload.height_cm = val('hf-height');
    if (val('hf-gender')) payload.gender = val('hf-gender');

    const btn = document.getElementById('health-save-btn');
    btn.disabled = true;
    const res = await API.patch('/auth/me/', payload);
    btn.disabled = false;
    if (res.ok) {
        healthProfile = res.data;
        renderHealthView();
        toggleHealthEdit(false);
        API.showToast(tr('healthSaved', 'Health profile saved.'), 'success');
    } else {
        API.showToast(res.error?.message || tr('saveFailed', 'Could not save. Please check the values.'), 'error');
    }
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'WAITING': return 'bg-amber-100 text-amber-800 border border-amber-300';
        case 'BOOKED': return 'bg-blue-100 text-blue-800 border border-blue-300';
        case 'CALLED': return 'bg-rose-600 text-white animate-pulse shadow-lg';
        case 'CONSULTING': return 'bg-blue-600 text-white shadow-md';
        case 'COMPLETED': return 'bg-emerald-600 text-white';
        case 'CANCELLED': return 'bg-slate-200 text-slate-600 line-through';
        default: return 'bg-slate-100 text-slate-700';
    }
}
