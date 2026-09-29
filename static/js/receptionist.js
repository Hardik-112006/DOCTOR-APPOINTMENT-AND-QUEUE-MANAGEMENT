/**
 * Receptionist Queue Control Desk Controller
 */

let allQueueEntries = [];
let currentFilter = 'ALL';
let receptionistPollInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
    API.requireAuth(['RECEPTIONIST', 'ADMIN']);

    await loadDoctorsForWalkIn();
    await loadQueue();
    startReceptionistPolling();

    const searchInput = document.getElementById('queue-search');
    if (searchInput) {
        searchInput.addEventListener('input', renderQueueTable);
    }

    const walkInForm = document.getElementById('walkin-form');
    if (walkInForm) {
        walkInForm.addEventListener('submit', handleAddWalkIn);
    }
});

function startReceptionistPolling() {
    if (receptionistPollInterval) clearInterval(receptionistPollInterval);
    receptionistPollInterval = setInterval(loadQueue, 5000);
}

async function loadQueue() {
    const res = await API.get('/queue/live/');
    if (res.ok && res.data) {
        allQueueEntries = res.data.queue || [];
        updateSummaryCounters();
        renderQueueTable();
    }
}

function updateSummaryCounters() {
    const waiting = allQueueEntries.filter(e => e.status === 'WAITING').length;
    const called = allQueueEntries.filter(e => e.status === 'CALLED').length;
    const consulting = allQueueEntries.filter(e => e.status === 'CONSULTING').length;
    const completed = allQueueEntries.filter(e => e.status === 'COMPLETED').length;

    document.getElementById('count-total').textContent = allQueueEntries.length;
    document.getElementById('count-waiting').textContent = waiting;
    document.getElementById('count-called').textContent = called;
    document.getElementById('count-consulting').textContent = consulting;
    document.getElementById('count-completed').textContent = completed;
}

function filterStatus(status) {
    currentFilter = status;
    document.querySelectorAll('.tab-filter').forEach(btn => {
        if (btn.dataset.status === status) {
            btn.className = 'tab-filter px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all bg-blue-600 text-white shadow-sm';
        } else {
            btn.className = 'tab-filter px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-600 hover:bg-slate-200';
        }
    });
    renderQueueTable();
}

function renderQueueTable() {
    const tbody = document.getElementById('queue-table-body');
    if (!tbody) return;

    const searchTerm = (document.getElementById('queue-search')?.value || '').toLowerCase();

    let filtered = allQueueEntries;
    if (currentFilter !== 'ALL') {
        filtered = filtered.filter(e => e.status === currentFilter);
    }

    if (searchTerm) {
        filtered = filtered.filter(e =>
            (e.token_number && e.token_number.toLowerCase().includes(searchTerm)) ||
            (e.patient_name && e.patient_name.toLowerCase().includes(searchTerm)) ||
            (e.patient_phone && e.patient_phone.toLowerCase().includes(searchTerm)) ||
            (e.doctor_name && e.doctor_name.toLowerCase().includes(searchTerm))
        );
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="p-8 text-center text-slate-400 text-xs">
                    No patient tokens found matching this filter.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(e => {
        const isArrived = !!e.arrival_time;
        return `
            <tr class="hover:bg-slate-50/80 transition-colors border-b border-slate-100 text-xs">
                <td class="px-4 py-3.5 font-bold text-slate-900">
                    #${e.queue_position}
                </td>
                <td class="px-4 py-3.5">
                    <span class="font-mono font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 text-sm">
                        ${e.token_number}
                    </span>
                </td>
                <td class="px-4 py-3.5">
                    <div class="font-bold text-slate-900">${e.patient_name}</div>
                    <div class="text-[11px] text-slate-400">${e.patient_phone || '-'} • ${e.patient_gender || ''}</div>
                </td>
                <td class="px-4 py-3.5">
                    <div class="font-semibold text-slate-800">${e.doctor_name}</div>
                    <div class="text-[10px] text-teal-600 font-bold">${e.department_name}</div>
                </td>
                <td class="px-4 py-3.5">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold ${e.booking_type === 'ONLINE' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'}">
                        ${e.booking_type}
                    </span>
                    <span class="block text-[10px] text-slate-400 mt-0.5">${e.slot_time || 'Walk-in'}</span>
                </td>
                <td class="px-4 py-3.5">
                    <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${getStatusClass(e.status)}">
                        ${e.status}
                    </span>
                    <span class="block text-[10px] text-slate-400 mt-1">${e.status === 'WAITING' ? `${e.eta_minutes}m ETA` : ''}</span>
                </td>
                <td class="px-4 py-3.5 text-right space-x-1">
                    ${!isArrived ? `
                        <button onclick="markPatientArrived(${e.appointment_id})" class="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[11px] font-bold border border-emerald-200 transition-colors">
                            Mark Arrived
                        </button>
                    ` : ''}

                    ${e.status === 'WAITING' ? `
                        <button onclick="updatePatientStatus(${e.appointment_id}, 'CALLED')" class="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold shadow-sm transition-colors">
                            Call
                        </button>
                    ` : ''}

                    ${e.status === 'CALLED' ? `
                        <button onclick="updatePatientStatus(${e.appointment_id}, 'CONSULTING')" class="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold shadow-sm transition-colors">
                            Start
                        </button>
                    ` : ''}

                    ${e.status === 'CONSULTING' ? `
                        <button onclick="updatePatientStatus(${e.appointment_id}, 'COMPLETED')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-sm transition-colors">
                            Complete
                        </button>
                    ` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

function getStatusClass(status) {
    switch (status) {
        case 'WAITING': return 'bg-amber-50 text-amber-800 border border-amber-200';
        case 'CALLED': return 'bg-rose-50 text-rose-800 border border-rose-200 font-black animate-pulse';
        case 'CONSULTING': return 'bg-blue-50 text-blue-800 border border-blue-200';
        case 'COMPLETED': return 'bg-emerald-50 text-emerald-800 border border-emerald-200';
        default: return 'bg-slate-100 text-slate-700';
    }
}

async function markPatientArrived(appointmentId) {
    const res = await API.post('/queue/mark-arrived/', { appointment_id: appointmentId });
    if (res.ok) {
        API.showToast('Patient marked as arrived at clinic.', 'success');
        loadQueue();
    } else {
        API.showToast(res.error?.message || 'Failed to update arrival status', 'error');
    }
}

async function updatePatientStatus(appointmentId, status) {
    const res = await API.post('/queue/update-status/', { appointment_id: appointmentId, status });
    if (res.ok) {
        API.showToast(`Status updated to ${status}`, 'success');
        loadQueue();
    } else {
        API.showToast(res.error?.message || 'Failed to update status', 'error');
    }
}

async function loadDoctorsForWalkIn() {
    const res = await API.get('/doctors/');
    const select = document.getElementById('walkin-doctor');
    if (select && res.ok && res.data) {
        const docs = Array.isArray(res.data) ? res.data : (res.data.data || []);
        select.innerHTML = docs.map(d => {
            const deptName = d.department_name || 'General';
            const deptTranslated = typeof I18N !== 'undefined' ? I18N.t(deptName, deptName) : deptName;
            return `<option value="${d.id}" data-dept="${d.department_id}">${d.name || d.full_name} (${deptTranslated})</option>`;
        }).join('');
    }
}

function openWalkInModal() {
    document.getElementById('walkin-modal').classList.remove('hidden');
}

function closeWalkInModal() {
    document.getElementById('walkin-modal').classList.add('hidden');
}

async function handleAddWalkIn(e) {
    e.preventDefault();
    const btn = document.getElementById('walkin-submit-btn');
    btn.disabled = true;
    btn.innerHTML = 'Registering Token...';

    const doctorSelect = document.getElementById('walkin-doctor');
    const selectedOption = doctorSelect.options[doctorSelect.selectedIndex];
    const doctorId = doctorSelect.value;
    const departmentId = selectedOption.dataset.dept;

    const payload = {
        doctor_id: parseInt(doctorId),
        department_id: parseInt(departmentId),
        patient_name: document.getElementById('walkin-name').value.trim(),
        patient_phone: document.getElementById('walkin-phone').value.trim()
    };

    const res = await API.post('/queue/walk-in/', payload);
    btn.disabled = false;
    btn.innerHTML = 'Issue Walk-In Token';

    if (res.ok && res.data) {
        API.showToast(`Walk-in Token #${res.data.token_number} Issued!`, 'success');
        closeWalkInModal();
        document.getElementById('walkin-form').reset();
        loadQueue();
    } else {
        API.showToast(res.error?.message || 'Failed to register walk-in patient.', 'error');
    }
}
