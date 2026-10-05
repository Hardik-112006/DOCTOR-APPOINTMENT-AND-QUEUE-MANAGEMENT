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

    if (allAppointments.length === 0) {
        currentAppointmentId = null;
    } else {
        // If currentAppointmentId is not set or not in list, pick the first active one
        if (!currentAppointmentId || !allAppointments.some(a => a.id === currentAppointmentId)) {
            const activeAppt = allAppointments.find(a => a.status !== 'CANCELLED' && a.status !== 'COMPLETED') || allAppointments[0];
            currentAppointmentId = activeAppt ? activeAppt.id : null;
        }
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
            <div class="p-4 sm:p-5 rounded-2xl border transition-all ${
                isTracking 
                ? 'bg-blue-50/70 border-blue-500 shadow-md ring-2 ring-blue-500/20' 
                : 'bg-white border-slate-200 hover:border-slate-300 shadow-sm'
            }">
                <div class="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="font-mono font-black text-xs text-blue-800 bg-blue-100 px-2 py-0.5 rounded-md">
                                ${appt.token_number || '#--'}
                            </span>
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${getStatusBadgeClass(appt.status)}">
                                ${appt.status}
                            </span>
                        </div>
                        <h4 class="font-extrabold text-slate-900 text-sm mt-1.5 truncate">${appt.doctor_name}</h4>
                        <p class="text-[11px] text-blue-600 font-semibold truncate">${spec}</p>
                    </div>

                    <div class="text-right shrink-0">
                        ${fee ? `<div class="text-xs font-black text-slate-800">${fee}</div>` : ''}
                        <div class="text-[10px] text-slate-400 mt-0.5">${appt.booking_type}</div>
                    </div>
                </div>

                <!-- Appointment Details Grid -->
                <div class="grid grid-cols-2 gap-2 pt-3 text-xs text-slate-600">
                    <div class="min-w-0">
                        <span class="text-[10px] text-slate-400 block">${typeof I18N !== 'undefined' ? I18N.t('date', 'Date') : 'Date'}</span>
                        <strong class="font-semibold text-slate-800 text-xs truncate block">${appt.appointment_date}</strong>
                    </div>
                    <div class="min-w-0">
                        <span class="text-[10px] text-slate-400 block">${typeof I18N !== 'undefined' ? I18N.t('timeSlot', 'Time / Slot') : 'Time / Slot'}</span>
                        <strong class="font-semibold text-slate-800 text-xs truncate block">${slotLabel}</strong>
                    </div>
                </div>

                <!-- Actions -->
                <div class="flex items-center justify-between pt-3 sm:pt-4 mt-3 border-t border-slate-100 gap-2 flex-wrap">
                    <div class="min-w-0">
                        ${(String(appt.status).toUpperCase() === 'WAITING' || String(appt.status).toUpperCase() === 'BOOKED') ? `
                            <button onclick="cancelPatientAppointment(${appt.id})" class="text-[11px] font-bold text-rose-600 hover:text-rose-700 hover:underline min-h-[36px] flex items-center">
                                ${typeof I18N !== 'undefined' ? I18N.t('cancelAppt', 'Cancel') : 'Cancel'}
                            </button>
                        ` : ''}
                        ${(String(appt.status).toUpperCase() === 'COMPLETED' || String(appt.queue_status || '').toUpperCase() === 'COMPLETED') ? `
                            <button type="button" 
                                    onclick="downloadPrescription(${appt.id})" 
                                    class="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-800 font-bold text-[11px] border border-blue-200 transition-all flex items-center gap-1.5 shadow-xs active:scale-95 min-h-[36px] cursor-pointer" 
                                    title="Download Doctor Prescription">
                                <svg class="w-3.5 h-3.5 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span class="whitespace-nowrap">${typeof I18N !== 'undefined' ? I18N.t('downloadPrescription', '↓ Download Prescription') : '↓ Download Prescription'}</span>
                            </button>
                        ` : ''}
                    </div>

                    <div class="shrink-0">
                        ${isTracking ? `
                            <span class="px-3 py-1.5 rounded-xl bg-blue-600 text-white font-bold text-[11px] shadow-sm flex items-center gap-1 min-h-[36px]">
                                <span class="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span>
                                <span class="whitespace-nowrap">${typeof I18N !== 'undefined' ? I18N.t('currentlyTracking', 'Live Tracking') : 'Live Tracking'}</span>
                            </span>
                        ` : `
                            <button onclick="selectAppointmentForTracking(${appt.id})" class="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 font-bold text-[11px] border border-slate-200 transition-colors min-h-[36px] whitespace-nowrap">
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
            const btmRx = document.getElementById('hero-prescription-container');
            if (btmRx) { btmRx.classList.add('hidden'); btmRx.style.display = 'none'; }
        } else {
            // Show first appointment details if queue entry is completed or pending
            const selected = allAppointments.find(a => a.id === currentAppointmentId) || allAppointments[0];
            if (selected) {
                if (trackerContent) trackerContent.classList.remove('hidden');
                if (emptyState) emptyState.classList.add('hidden');
                document.getElementById('display-token').textContent = selected.token_number || '--';
                document.getElementById('display-doctor').textContent = selected.doctor_name || '--';
                const specEl = document.getElementById('display-specialization');
                if (specEl) specEl.textContent = selected.specialization ? `(${selected.specialization})` : (selected.department_name ? `(${selected.department_name})` : '');
                document.getElementById('display-department').textContent = selected.department_name || '--';
                document.getElementById('display-booking-type').textContent = selected.booking_type || 'ONLINE';
                document.getElementById('display-position').textContent = selected.queue_position || '-';
                document.getElementById('display-ahead').textContent = selected.patients_ahead !== undefined ? selected.patients_ahead : '-';
                document.getElementById('display-eta').textContent = `${selected.estimated_wait_minutes || 0} min`;
                const statusBadge = document.getElementById('display-status-badge');
                statusBadge.textContent = selected.status;
                statusBadge.className = `px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${getStatusBadgeClass(selected.status)}`;
                updateProgressBar(selected.status);
                updateHeroPrescription(selected);
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
    if (specEl) specEl.textContent = entry.specialization ? `(${entry.specialization})` : (entry.department_name ? `(${entry.department_name})` : '');
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

    // Update Hero Prescription Section with merged appointment & entry details
    const matchedAppt = allAppointments.find(a => a.id === (entry.appointment_id || currentAppointmentId));
    const mergedAppt = Object.assign({}, matchedAppt || {}, entry || {});
    updateHeroPrescription(mergedAppt);
}

function updateHeroPrescription(selectedAppt) {
    const rxContainer = document.getElementById('hero-prescription-container');
    const rxStatus = document.getElementById('hero-prescription-status');
    const rxBtnWrapper = document.getElementById('hero-rx-action-wrapper');

    const isCompleted = selectedAppt && (
        String(selectedAppt.status || '').toUpperCase() === 'COMPLETED' ||
        String(selectedAppt.queue_status || '').toUpperCase() === 'COMPLETED'
    );

    if (isCompleted) {
        const apptId = selectedAppt.id || selectedAppt.appointment_id;

        // Proactively fetch consultation data in the background if prescription_notes not cached
        if (!selectedAppt.prescription_notes && apptId) {
            API.get(`/consultations/appointment/${apptId}/`).then(res => {
                if (res.ok && res.data) {
                    selectedAppt.prescription_notes = res.data.prescription_notes || '';
                    selectedAppt.consultation_notes = res.data.notes || '';
                }
            }).catch(() => {});
        }

        // Prescription Banner in Hero Card
        if (rxContainer) {
            rxContainer.classList.remove('hidden');
            rxContainer.style.display = 'flex';

            if (rxStatus) {
                rxStatus.textContent = typeof I18N !== 'undefined'
                    ? I18N.t('prescriptionAvailableDesc', 'Doctor has completed consultation and saved prescription.')
                    : 'Doctor has completed consultation and saved prescription.';
            }
            if (rxBtnWrapper) {
                rxBtnWrapper.innerHTML = `
                    <button type="button" 
                            id="hero-download-rx-btn" 
                            onclick="downloadPrescription(${apptId})" 
                            class="w-full sm:w-auto px-5 py-2.5 sm:py-2.5 bg-white hover:bg-blue-50 text-blue-800 font-black rounded-xl sm:rounded-2xl text-xs sm:text-sm shadow-lg transition-all flex items-center justify-center gap-2 border border-blue-200 min-h-[42px] sm:min-h-[44px] active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                            title="Download Consultation Prescription as PDF">
                        <svg class="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>${typeof I18N !== 'undefined' ? I18N.t('downloadPrescription', '↓ Download Prescription') : '↓ Download Prescription'}</span>
                    </button>
                `;
            }
        }
    } else {
        if (rxContainer) {
            rxContainer.classList.add('hidden');
            rxContainer.style.display = 'none';
        }
    }
}

async function downloadActivePrescription() {
    if (currentAppointmentId) {
        await downloadPrescription(currentAppointmentId);
    }
}

/**
 * Downloads the actual prescription saved by the doctor for the given appointment.
 */
async function downloadPrescription(appointmentId) {
    if (!appointmentId) return;

    try {
        let appt = allAppointments.find(a => a.id === appointmentId);

        // Fetch fresh consultation detail directly from API
        const res = await API.get(`/consultations/appointment/${appointmentId}/`);
        let data = null;

        if (res.ok && res.data && (res.data.prescription_notes || res.data.notes)) {
            data = res.data;
            if (appt) {
                if (!data.doctor_name || data.doctor_name === 'Doctor') data.doctor_name = appt.doctor_name;
                if (!data.specialization) data.specialization = appt.specialization;
                if (!data.department_name) data.department_name = appt.department_name;
                if (!data.token_number) data.token_number = appt.token_number;
                if (!data.appointment_date) data.appointment_date = appt.appointment_date;
                if (!data.booking_type) data.booking_type = appt.booking_type;
                if (!data.patient_name) data.patient_name = appt.patient_name;
                if (!data.patient_phone) data.patient_phone = appt.patient_phone;
            }
        } else if (appt && appt.prescription_notes) {
            data = {
                appointment_id: appt.id,
                token_number: appt.token_number,
                doctor_name: appt.doctor_name,
                specialization: appt.specialization,
                department_name: appt.department_name,
                appointment_date: appt.appointment_date,
                booking_type: appt.booking_type,
                patient_name: appt.patient_name,
                patient_phone: appt.patient_phone,
                notes: appt.consultation_notes || '',
                prescription_notes: appt.prescription_notes
            };
        }

        if (!data || !data.prescription_notes) {
            API.showToast(typeof I18N !== 'undefined' ? I18N.t('prescriptionNotAvailable', 'Prescription not available yet.') : 'Prescription not available yet.', 'warning');
            return;
        }

        generatePrescriptionPdf(data);
        API.showToast(typeof I18N !== 'undefined' ? I18N.t('prescriptionDownloaded', 'Prescription downloaded successfully.') : 'Prescription downloaded successfully.', 'success');
    } catch (err) {
        console.error('[PRESCRIPTION] Error downloading prescription:', err);
        API.showToast('Failed to generate prescription PDF.', 'error');
    }
}

/**
 * Generates and downloads a clean, professional medical Prescription PDF.
 */
function generatePrescriptionPdf(data) {
    const filename = `DoctorQueue_Prescription_${data.appointment_id || data.id}.pdf`;

    if (window.jspdf && window.jspdf.jsPDF) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // 1. Header Banner (Medical Blue)
        doc.setFillColor(29, 78, 216); // #1D4ED8
        doc.rect(0, 0, pageWidth, 28, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('DoctorQueue', 15, 12);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text('SmartCare Clinic • Doctor Appointment & Queue Management', 15, 18);
        doc.text('Official Clinical Consultation Record', 15, 23);

        // Document Type Badge
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(pageWidth - 55, 8, 40, 12, 2, 2, 'F');
        doc.setTextColor(29, 78, 216);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text('PRESCRIPTION', pageWidth - 35, 15.5, { align: 'center' });

        // 2. Patient & Consultation Metadata Box
        doc.setFillColor(248, 250, 252); // #F8FAFC
        doc.setDrawColor(226, 232, 240); // #E2E8F0
        doc.setLineWidth(0.4);
        doc.roundedRect(15, 34, pageWidth - 30, 42, 3, 3, 'FD');

        // Column 1: Patient Info
        doc.setTextColor(100, 116, 139); // #64748B
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('PATIENT NAME:', 20, 42);
        doc.text('CONTACT / PHONE:', 20, 50);
        doc.text('TOKEN NUMBER:', 20, 58);
        doc.text('APPOINTMENT ID:', 20, 66);

        doc.setTextColor(15, 23, 42); // #0F172A
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(data.patient_name || 'N/A', 55, 42);
        doc.setFont('helvetica', 'normal');
        doc.text(data.patient_phone || 'N/A', 55, 50);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(29, 78, 216);
        doc.text(data.token_number || '#--', 55, 58);
        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'normal');
        doc.text(`#${data.appointment_id || data.id || '--'}`, 55, 66);

        // Column 2: Doctor & Clinic Info
        const col2X = pageWidth / 2 + 5;
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('CONSULTING DOCTOR:', col2X, 42);
        doc.text('DEPARTMENT:', col2X, 50);
        doc.text('CONSULTATION DATE:', col2X, 58);
        doc.text('BOOKING TYPE:', col2X, 66);

        doc.setTextColor(15, 23, 42);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.text(data.doctor_name || 'N/A', col2X + 42, 42);
        doc.setFont('helvetica', 'normal');
        doc.text(data.department_name || data.specialization || '', col2X + 42, 50);
        doc.text(data.appointment_date || new Date().toISOString().split('T')[0], col2X + 42, 58);
        doc.text(data.booking_type || 'ONLINE', col2X + 42, 66);

        let currentY = 84;

        // 3. Clinical Notes (if available)
        if (data.notes && data.notes.trim()) {
            doc.setFillColor(241, 245, 249);
            doc.setDrawColor(203, 213, 225);
            doc.roundedRect(15, currentY, pageWidth - 30, 8, 1.5, 1.5, 'FD');

            doc.setTextColor(30, 41, 59);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text('CLINICAL NOTES & OBSERVATIONS', 20, currentY + 5.5);

            currentY += 12;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(51, 65, 85);
            const splitNotes = doc.splitTextToSize(data.notes.trim(), pageWidth - 40);
            doc.text(splitNotes, 20, currentY);
            currentY += (splitNotes.length * 4.5) + 8;
        }

        // 4. Rx - Prescription & Medication Section
        doc.setFillColor(238, 242, 255); // Indigo 50
        doc.setDrawColor(199, 210, 254);
        doc.roundedRect(15, currentY, pageWidth - 30, 9, 1.5, 1.5, 'FD');

        doc.setTextColor(37, 99, 235); // Blue 600
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Rx — PRESCRIPTION, MEDICATIONS & ADVICE', 20, currentY + 6);

        currentY += 14;

        // Prescription Text Box
        const rxBoxStartY = currentY - 2;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);

        const rxText = data.prescription_notes ? data.prescription_notes.trim() : 'Standard follow-up instructions.';
        const splitRx = doc.splitTextToSize(rxText, pageWidth - 44);
        const rxBoxHeight = Math.max(32, (splitRx.length * 5) + 12);

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(15, rxBoxStartY, pageWidth - 30, rxBoxHeight, 2, 2, 'FD');

        doc.text(splitRx, 22, currentY + 5);
        currentY = rxBoxStartY + rxBoxHeight + 14;

        // 5. Doctor Signature & Disclaimer
        const sigY = Math.min(pageHeight - 45, Math.max(currentY, pageHeight - 55));

        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.line(pageWidth - 75, sigY, pageWidth - 15, sigY);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(data.doctor_name || 'Consulting Doctor', pageWidth - 45, sigY + 5, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);
        doc.text(data.specialization || 'Medical Practitioner', pageWidth - 45, sigY + 9, { align: 'center' });
        doc.text('Authorized Digital Prescription', pageWidth - 45, sigY + 13, { align: 'center' });

        // 6. Footer Bar
        doc.setDrawColor(226, 232, 240);
        doc.line(15, pageHeight - 16, pageWidth - 15, pageHeight - 16);

        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('Generated from DoctorQueue Live Core • SmartCare Clinic Management System', 15, pageHeight - 10);
        doc.text(`Doc ID: DQ-RX-${data.appointment_id || data.id || '0'}-${Date.now().toString().slice(-6)}`, pageWidth - 15, pageHeight - 10, { align: 'right' });

        doc.save(filename);
    } else {
        // Fallback: Pure standard vector PDF generator
        downloadPureVectorPdf(data, filename);
    }
}

/**
 * Fallback pure vector PDF 1.4 generator when offline / without CDN.
 */
function downloadPureVectorPdf(data, filename) {
    const patientName = (data.patient_name || 'Patient').replace(/[()]/g, '');
    const doctorName = (data.doctor_name || 'Doctor').replace(/[()]/g, '');
    const dept = (data.department_name || data.specialization || 'General Medicine').replace(/[()]/g, '');
    const token = (data.token_number || 'N/A').replace(/[()]/g, '');
    const date = (data.appointment_date || new Date().toISOString().split('T')[0]).replace(/[()]/g, '');
    const rx = (data.prescription_notes || 'No prescription notes provided.').replace(/[()]/g, '');
    const notes = (data.notes || '').replace(/[()]/g, '');

    let stream = `
BT
/F2 18 Tf
50 780 Td
(DoctorQueue - Medical Prescription) Tj
/F1 9 Tf
0 -14 Td
(SmartCare Clinic - Official Consultation Record) Tj
0 -25 Td
/F2 11 Tf
(PRESCRIPTION DETAILS) Tj
/F1 10 Tf
0 -18 Td
(Patient Name: ${patientName}) Tj
0 -15 Td
(Consulting Doctor: ${doctorName} - ${dept}) Tj
0 -15 Td
(Token: ${token} | Date: ${date}) Tj
0 -22 Td
/F2 11 Tf
(Rx - Prescription & Advice:) Tj
/F1 10 Tf
0 -16 Td
(${rx}) Tj
`;
    if (notes) {
        stream += `
0 -22 Td
/F2 11 Tf
(Clinical Notes:) Tj
/F1 10 Tf
0 -16 Td
(${notes}) Tj
`;
    }
    stream += `
0 -40 Td
/F2 10 Tf
(Doctor Signature: ${doctorName}) Tj
0 -15 Td
/F1 8 Tf
(Generated from DoctorQueue Live Core - SmartCare Clinic) Tj
ET
`;

    const streamLength = stream.length;
    const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
6 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj
4 0 obj
<< /Length ${streamLength} >>
stream
${stream}
endstream
endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000300 00000 n 
0000000216 00000 n 
0000000280 00000 n 
trailer
<< /Size 7 /Root 1 0 R >>
startxref
500
%%EOF`;

    const blob = new Blob([pdf], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
