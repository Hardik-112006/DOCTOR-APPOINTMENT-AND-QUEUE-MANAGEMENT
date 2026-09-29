/**
 * Patient Live Queue Tracker & Appointments Manager
 * Manages multiple appointments, live queue polling, and room call notifications.
 */

let pollInterval = null;
let currentAppointmentId = null;
let previousStatus = null;
let allAppointments = [];

document.addEventListener('DOMContentLoaded', async () => {
    API.requireAuth();

    // Check query params for appointment_id
    const urlParams = new URLSearchParams(window.location.search);
    currentAppointmentId = urlParams.get('appointment_id') ? parseInt(urlParams.get('appointment_id')) : null;

    await loadAllAppointments();
    await fetchQueueStatus();
    startPolling();
});

function startPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
        await loadAllAppointments(false);
        await fetchQueueStatus();
    }, 5000);
}

async function loadAllAppointments(renderLoading = true) {
    const listContainer = document.getElementById('appointments-cards-list');
    const badge = document.getElementById('appointment-count-badge');

    const res = await API.get('/appointments/my-appointments/');
    if (!res.ok || !res.data) return;

    allAppointments = Array.isArray(res.data) ? res.data : (res.data.data || []);

    if (badge) {
        const countText = typeof I18N !== 'undefined' 
            ? `${allAppointments.length} ${I18N.t('appointmentsCount', 'Appointments')}`
            : `${allAppointments.length} Appointments`;
        badge.textContent = countText;
    }

    // If no appointment is currently selected, select the first active one
    if (!currentAppointmentId && allAppointments.length > 0) {
        const activeAppt = allAppointments.find(a => a.status !== 'CANCELLED' && a.status !== 'COMPLETED') || allAppointments[0];
        currentAppointmentId = activeAppt.id;
    }

    renderAppointmentsList();
}

function renderAppointmentsList() {
    const listContainer = document.getElementById('appointments-cards-list');
    if (!listContainer) return;

    if (allAppointments.length === 0) {
        listContainer.innerHTML = `
            <div class="col-span-full p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                <p class="text-xs font-semibold text-slate-500">${typeof I18N !== 'undefined' ? I18N.t('noAppointmentsBooked', 'No appointments booked yet.') : 'No appointments booked yet.'}</p>
                <a href="/book/" class="inline-block mt-2 text-xs font-bold text-blue-600 hover:underline">
                    ${typeof I18N !== 'undefined' ? I18N.t('bookFirstAppt', '+ Book your first appointment') : '+ Book your first appointment'}
                </a>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = allAppointments.map(appt => {
        const isTracking = currentAppointmentId === appt.id;
        const fee = appt.consultation_fee ? `₹${parseFloat(appt.consultation_fee).toFixed(2)}` : '';
        const slotLabel = appt.slot_time || (typeof I18N !== 'undefined' ? I18N.t('generalQueue', 'General Queue') : 'General Queue');
        const spec = appt.specialization || appt.department_name || '';

        return `
            <div class="p-5 rounded-2xl border transition-all ${
                isTracking 
                ? 'bg-blue-50/70 border-blue-500 shadow-md ring-2 ring-blue-500/20' 
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
            }">
                <div class="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="font-mono font-black text-xs text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md">
                                ${appt.token_number || '#--'}
                            </span>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusBadgeClass(appt.status)}">
                                ${appt.status}
                            </span>
                        </div>
                        <h4 class="font-extrabold text-slate-900 text-sm mt-2">${appt.doctor_name}</h4>
                        <p class="text-[11px] text-blue-600 font-semibold">${spec}</p>
                    </div>

                    <div class="text-right">
                        ${fee ? `<div class="text-xs font-black text-slate-800">${fee}</div>` : ''}
                        <div class="text-[10px] text-slate-400 mt-0.5">${appt.booking_type}</div>
                    </div>
                </div>

                <!-- Appointment Details Grid -->
                <div class="grid grid-cols-2 gap-2 pt-3 text-xs text-slate-600">
                    <div>
                        <span class="text-[10px] text-slate-400 block">${typeof I18N !== 'undefined' ? I18N.t('date', 'Date') : 'Date'}</span>
                        <strong class="font-semibold text-slate-800">${appt.appointment_date}</strong>
                    </div>
                    <div>
                        <span class="text-[10px] text-slate-400 block">${typeof I18N !== 'undefined' ? I18N.t('timeSlot', 'Time / Slot') : 'Time / Slot'}</span>
                        <strong class="font-semibold text-slate-800">${slotLabel}</strong>
                    </div>
                </div>

                <!-- Actions -->
                <div class="flex items-center justify-between pt-4 mt-3 border-t border-slate-100">
                    <div>
                        ${appt.status === 'WAITING' || appt.status === 'BOOKED' ? `
                            <button onclick="cancelPatientAppointment(${appt.id})" class="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline">
                                ${typeof I18N !== 'undefined' ? I18N.t('cancelAppt', 'Cancel') : 'Cancel'}
                            </button>
                        ` : ''}
                    </div>

                    <div>
                        ${isTracking ? `
                            <span class="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-[11px] shadow-sm flex items-center gap-1">
                                <span class="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                                ${typeof I18N !== 'undefined' ? I18N.t('currentlyTracking', 'Live Tracking') : 'Live Tracking'}
                            </span>
                        ` : `
                            <button onclick="selectAppointmentForTracking(${appt.id})" class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-[11px] border border-slate-200 transition-colors">
                                ${typeof I18N !== 'undefined' ? I18N.t('trackThis', 'Track Live →') : 'Track Live →'}
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function selectAppointmentForTracking(appointmentId) {
    currentAppointmentId = appointmentId;
    renderAppointmentsList();
    fetchQueueStatus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function cancelPatientAppointment(appointmentId) {
    const confirmMsg = typeof I18N !== 'undefined' 
        ? I18N.t('confirmCancelAppt', 'Are you sure you want to cancel this appointment?') 
        : 'Are you sure you want to cancel this appointment?';

    if (!confirm(confirmMsg)) return;

    const res = await API.post(`/appointments/${appointmentId}/cancel/`);
    if (res.ok) {
        API.showToast(typeof I18N !== 'undefined' ? I18N.t('apptCancelled', 'Appointment cancelled successfully.') : 'Appointment cancelled successfully.', 'info');
        await loadAllAppointments();
        await fetchQueueStatus();
    } else {
        API.showToast(res.error?.message || 'Cancellation failed', 'error');
    }
}

async function fetchQueueStatus() {
    const params = {};
    if (currentAppointmentId) params.appointment_id = currentAppointmentId;

    const res = await API.get('/queue/patient-status/', params);
    const lastUpdatedEl = document.getElementById('last-updated-time');
    if (lastUpdatedEl) {
        lastUpdatedEl.textContent = new Date().toLocaleTimeString();
    }

    const trackerContent = document.getElementById('tracker-content');
    const emptyState = document.getElementById('empty-state');
    const calledAlert = document.getElementById('called-alert-banner');

    if (!res.ok || !res.data) {
        if (allAppointments.length === 0) {
            if (trackerContent) trackerContent.classList.add('hidden');
            if (emptyState) emptyState.classList.remove('hidden');
        } else {
            // Show first appointment details if queue entry is completed or pending
            const selected = allAppointments.find(a => a.id === currentAppointmentId) || allAppointments[0];
            if (selected) {
                if (trackerContent) trackerContent.classList.remove('hidden');
                if (emptyState) emptyState.classList.add('hidden');
                document.getElementById('display-token').textContent = selected.token_number || '--';
                document.getElementById('display-doctor').textContent = selected.doctor_name || '--';
                document.getElementById('display-specialization').textContent = selected.specialization ? `(${selected.specialization})` : '';
                document.getElementById('display-department').textContent = selected.department_name || '--';
                document.getElementById('display-booking-type').textContent = selected.booking_type || 'ONLINE';
                document.getElementById('display-position').textContent = selected.queue_position || '-';
                document.getElementById('display-ahead').textContent = selected.patients_ahead !== undefined ? selected.patients_ahead : '-';
                document.getElementById('display-eta').textContent = `${selected.estimated_wait_minutes || 0} min`;
                const statusBadge = document.getElementById('display-status-badge');
                statusBadge.textContent = selected.status;
                statusBadge.className = `px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusBadgeClass(selected.status)}`;
                updateProgressBar(selected.status);
            }
        }
        if (calledAlert) calledAlert.classList.add('hidden');
        return;
    }

    const entry = res.data;
    if (trackerContent) trackerContent.classList.remove('hidden');
    if (emptyState) emptyState.classList.add('hidden');

    // Update Token and Doctor Info
    document.getElementById('display-token').textContent = entry.token_number;
    document.getElementById('display-doctor').textContent = entry.doctor_name;
    const specEl = document.getElementById('display-specialization');
    if (specEl) specEl.textContent = entry.specialization ? `(${entry.specialization})` : '';
    document.getElementById('display-department').textContent = entry.department_name;
    document.getElementById('display-booking-type').textContent = entry.booking_type;

    // Update Position, Ahead, and ETA
    document.getElementById('display-position').textContent = entry.queue_position || '-';
    document.getElementById('display-ahead').textContent = entry.patients_ahead !== undefined ? entry.patients_ahead : '-';
    document.getElementById('display-eta').textContent = `${entry.eta_minutes || 0} min`;

    // Status Badge
    const statusBadge = document.getElementById('display-status-badge');
    statusBadge.textContent = entry.status;
    statusBadge.className = `px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusBadgeClass(entry.status)}`;

    // Called Room Banner Handling
    if (entry.status === 'CALLED') {
        calledAlert.classList.remove('hidden');
        if (previousStatus !== 'CALLED') {
            const callMsg = typeof I18N !== 'undefined'
                ? I18N.t('doctorCalledToast', 'Dr. has called your token! Please proceed to Consultation Room.')
                : 'Dr. has called your token! Please proceed to Consultation Room.';
            API.showToast(callMsg, 'warning');
            try {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.play().catch(() => {});
            } catch (e) {}
        }
    } else {
        calledAlert.classList.add('hidden');
    }

    previousStatus = entry.status;
    updateProgressBar(entry.status);
}

function getStatusBadgeClass(status) {
    switch (status) {
        case 'WAITING': return 'bg-amber-100 text-amber-800 border border-amber-300 font-bold';
        case 'BOOKED': return 'bg-blue-100 text-blue-800 border border-blue-300 font-bold';
        case 'CALLED': return 'bg-rose-600 text-white animate-pulse shadow-lg font-bold';
        case 'CONSULTING': return 'bg-blue-600 text-white shadow-md font-bold';
        case 'COMPLETED': return 'bg-emerald-600 text-white font-bold';
        case 'CANCELLED': return 'bg-slate-200 text-slate-600 line-through';
        default: return 'bg-slate-100 text-slate-700';
    }
}

function updateProgressBar(status) {
    const steps = ['WAITING', 'CALLED', 'CONSULTING', 'COMPLETED'];
    const stepIndex = steps.indexOf(status);

    steps.forEach((step, idx) => {
        const stepCircle = document.getElementById(`step-circle-${step.toLowerCase()}`);
        const stepLabel = document.getElementById(`step-label-${step.toLowerCase()}`);
        if (!stepCircle || !stepLabel) return;

        if (idx <= stepIndex && stepIndex !== -1) {
            stepCircle.className = 'w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-md ring-4 ring-blue-100';
            stepLabel.className = 'text-xs font-bold text-blue-700 mt-2';
        } else {
            stepCircle.className = 'w-9 h-9 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center font-bold text-xs';
            stepLabel.className = 'text-xs font-medium text-slate-400 mt-2';
        }
    });

    const progressFill = document.getElementById('progress-fill-bar');
    if (progressFill) {
        const percentages = { 0: '15%', 1: '50%', 2: '75%', 3: '100%' };
        progressFill.style.width = (stepIndex !== -1 ? percentages[stepIndex] : '0%');
    }
}

function refreshQueueManual() {
    API.showToast(typeof I18N !== 'undefined' ? I18N.t('refreshingQueue', 'Refreshing queue state...') : 'Refreshing queue state...', 'info');
    loadAllAppointments(false);
    fetchQueueStatus();
}
