/**
 * Booking Controller for Doctor Appointment Booking
 * Fully internationalized (English / Hindi) with dynamic slot, doctor & department resolution.
 */

let selectedDoctorId = null;
let selectedSlotId = null;
let selectedDepartmentId = null;
let selectedDate = new Date().toISOString().split('T')[0];
let loadDoctorsRequestId = 0;

document.addEventListener('DOMContentLoaded', async () => {
    API.requireAuth();

    // Ensure language state is strictly synchronized
    const currentLang = (typeof I18N !== 'undefined') ? I18N.getLanguage() : (localStorage.getItem('doctorqueue_lang') || 'en');
    const langSelector = document.getElementById('lang-selector');
    if (langSelector) langSelector.value = currentLang;
    if (typeof I18N !== 'undefined') I18N.applyTranslations();

    await loadDepartments();
    await loadDoctors();

    const dateInput = document.getElementById('appointment-date');
    if (dateInput) {
        dateInput.value = selectedDate;
        dateInput.min = selectedDate;
        dateInput.addEventListener('change', (e) => {
            selectedDate = e.target.value;
            if (selectedDoctorId) {
                loadSlots(selectedDoctorId, selectedDate);
            }
        });
    }

    const bookingForm = document.getElementById('booking-form');
    if (bookingForm) {
        bookingForm.addEventListener('submit', handleBookAppointment);
    }

    window.addEventListener('languageChanged', async () => {
        if (typeof I18N !== 'undefined') I18N.applyTranslations();
        await loadDepartments();
        await loadDoctors();
        if (selectedDoctorId) {
            await loadSlots(selectedDoctorId, selectedDate);
        }
    });
});

async function loadDepartments() {
    const res = await API.get('/departments/');
    const container = document.getElementById('department-tabs');
    if (!container) return;

    if (res.ok && res.data) {
        const allText = typeof I18N !== 'undefined' ? I18N.t('allSpecialties', 'All Specialties') : 'All Specialties';
        const isAllActive = selectedDepartmentId === null;
        
        container.innerHTML = `
            <button onclick="filterDepartment(null)" class="dept-tab px-4 py-2 rounded-xl text-xs font-bold transition-all ${isAllActive ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" data-id="all">
                ${allText}
            </button>
        ` + res.data.map(d => {
            const deptDisplayName = typeof I18N !== 'undefined' ? I18N.t(d.name, d.name) : d.name;
            const isMatch = selectedDepartmentId == d.id;
            return `
                <button onclick="filterDepartment(${d.id})" class="dept-tab px-4 py-2 rounded-xl text-xs font-bold transition-all ${isMatch ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}" data-id="${d.id}">
                    ${deptDisplayName}
                </button>
            `;
        }).join('');
    }
}

function filterDepartment(deptId) {
    selectedDepartmentId = deptId;
    document.querySelectorAll('.dept-tab').forEach(b => {
        const isMatch = (deptId === null && b.dataset.id === 'all') || (b.dataset.id == deptId);
        if (isMatch) {
            b.className = 'dept-tab px-4 py-2 rounded-xl text-xs font-bold transition-all bg-blue-600 text-white shadow-sm';
        } else {
            b.className = 'dept-tab px-4 py-2 rounded-xl text-xs font-bold transition-all bg-slate-100 text-slate-700 hover:bg-slate-200';
        }
    });
    loadDoctors();
}

async function loadDoctors() {
    const listContainer = document.getElementById('doctors-list');
    if (!listContainer) return;

    const currentReq = ++loadDoctorsRequestId;
    const loadingText = typeof I18N !== 'undefined' ? I18N.t('loadingDoctors', 'Loading available doctors...') : 'Loading available doctors...';
    listContainer.innerHTML = `
        <div class="col-span-full p-8 text-center">
            <div class="inline-block animate-spin text-blue-600 text-2xl">⟳</div>
            <p class="text-xs text-slate-400 mt-2">${loadingText}</p>
        </div>
    `;

    const params = {};
    if (selectedDepartmentId) params.department_id = selectedDepartmentId;

    const res = await API.get('/doctors/', params);
    if (currentReq !== loadDoctorsRequestId) return; // Prevent race conditions

    let doctors = [];
    if (res.ok && res.data) {
        if (Array.isArray(res.data)) {
            doctors = res.data;
        } else if (Array.isArray(res.data.data)) {
            doctors = res.data.data;
        } else if (Array.isArray(res.data.doctors)) {
            doctors = res.data.doctors;
        }
    }

    if (!res.ok || doctors.length === 0) {
        const noDocText = typeof I18N !== 'undefined' ? I18N.t('noDoctorsFound', 'No doctors available for this department today.') : 'No doctors available for this department today.';
        listContainer.innerHTML = `
            <div class="col-span-full p-8 text-center bg-white rounded-2xl border border-slate-200">
                <p class="text-sm font-semibold text-slate-600">${noDocText}</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = doctors.map(doc => {
        const docName = doc.name || doc.full_name || 'Doctor';
        const docDept = doc.department_name || doc.department || 'General';
        const docDeptTranslated = typeof I18N !== 'undefined' ? I18N.t(docDept, docDept) : docDept;
        const specTranslated = typeof I18N !== 'undefined' ? I18N.t(doc.specialization, doc.specialization || 'Specialist') : (doc.specialization || 'Specialist');
        const isAvailable = doc.is_available !== false;
        const isSelected = selectedDoctorId === doc.id;
        const initial = docName.replace('Dr. ', '').trim().charAt(0) || 'D';

        const availText = typeof I18N !== 'undefined' 
            ? (isAvailable ? I18N.t('availableToday', 'Available Today') : I18N.t('offlineToday', 'Offline Today'))
            : (isAvailable ? 'Available Today' : 'Offline Today');
        const deptLabel = typeof I18N !== 'undefined' ? I18N.t('department', 'Department') : 'Department';
        const expLabel = typeof I18N !== 'undefined' ? I18N.t('experience', 'Experience') : 'Experience';
        const yrsText = typeof I18N !== 'undefined' ? I18N.t('yearsExp', 'yrs experience') : 'yrs experience';
        const feeLabel = typeof I18N !== 'undefined' ? I18N.t('consultationFee', 'Consultation Fee') : 'Consultation Fee';
        const selectText = isSelected 
            ? (typeof I18N !== 'undefined' ? I18N.t('selectedBtn', 'Selected ✓') : 'Selected ✓') 
            : (typeof I18N !== 'undefined' ? I18N.t('selectBtn', 'Select') : 'Select');

        return `
            <div onclick="selectDoctor(${doc.id}, '${docName.replace(/'/g, "\\'")}', '${docDept.replace(/'/g, "\\'")}', ${doc.consultation_fee || 0})" 
                 class="doctor-card cursor-pointer bg-white p-5 rounded-2xl border ${isSelected ? 'border-blue-600 ring-2 ring-blue-500/20' : 'border-slate-200'} hover:border-blue-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                 data-doc-id="${doc.id}">
                <div>
                    <div class="flex items-start justify-between">
                        <div class="flex items-center gap-3">
                            <div class="w-12 h-12 rounded-xl bg-blue-100 text-blue-700 font-black text-lg flex items-center justify-center">
                                ${initial}
                            </div>
                            <div>
                                <h4 class="font-bold text-slate-900 text-base leading-tight">${docName}</h4>
                                <span class="text-xs text-teal-600 font-semibold">${specTranslated}</span>
                            </div>
                        </div>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isAvailable ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}">
                            ${availText}
                        </span>
                    </div>

                    <div class="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
                        <div>
                            <span class="text-slate-400 block text-[10px]">${deptLabel}</span>
                            <span class="font-semibold text-slate-800">${docDeptTranslated}</span>
                        </div>
                        <div>
                            <span class="text-slate-400 block text-[10px]">${expLabel}</span>
                            <span class="font-semibold text-slate-800">${doc.experience || 0} ${yrsText}</span>
                        </div>
                    </div>
                </div>

                <div class="mt-4 flex items-center justify-between pt-3 border-t border-slate-100">
                    <div>
                        <span class="text-[10px] text-slate-400 block">${feeLabel}</span>
                        <span class="text-sm font-extrabold text-blue-700">₹${parseFloat(doc.consultation_fee || 0).toFixed(2)}</span>
                    </div>
                    <button type="button" class="select-btn px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}">
                        ${selectText}
                    </button>
                </div>
            </div>
        `;
    }).join('');

    // If a doctor is already selected, re-highlight and update slots
    if (selectedDoctorId) {
        const activeDoc = doctors.find(d => d.id === selectedDoctorId);
        if (activeDoc) {
            const activeName = activeDoc.name || activeDoc.full_name || 'Doctor';
            const activeDept = activeDoc.department_name || activeDoc.department || 'General';
            selectDoctor(activeDoc.id, activeName, activeDept, activeDoc.consultation_fee || 0);
        } else if (doctors.length > 0) {
            const first = doctors[0];
            const firstName = first.name || first.full_name || 'Doctor';
            const firstDept = first.department_name || first.department || 'General';
            selectDoctor(first.id, firstName, firstDept, first.consultation_fee || 0);
        }
    } else if (doctors.length > 0) {
        const first = doctors[0];
        const firstName = first.name || first.full_name || 'Doctor';
        const firstDept = first.department_name || first.department || 'General';
        selectDoctor(first.id, firstName, firstDept, first.consultation_fee || 0);
    }
}

function selectDoctor(docId, name, dept, fee) {
    selectedDoctorId = docId;
    selectedSlotId = null;

    const selectedBtnText = typeof I18N !== 'undefined' ? I18N.t('selectedBtn', 'Selected ✓') : 'Selected ✓';
    const unselectedBtnText = typeof I18N !== 'undefined' ? I18N.t('selectBtn', 'Select') : 'Select';

    document.querySelectorAll('.doctor-card').forEach(card => {
        const btn = card.querySelector('.select-btn') || card.querySelector('button');
        if (card.dataset.docId == docId) {
            card.classList.add('border-blue-600', 'ring-2', 'ring-blue-500/20');
            if (btn) {
                btn.className = 'select-btn px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all bg-blue-600 text-white';
                btn.textContent = selectedBtnText;
            }
        } else {
            card.classList.remove('border-blue-600', 'ring-2', 'ring-blue-500/20');
            if (btn) {
                btn.className = 'select-btn px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all bg-slate-100 text-slate-700 hover:bg-slate-200';
                btn.textContent = unselectedBtnText;
            }
        }
    });

    const summaryDoc = document.getElementById('summary-doctor');
    if (summaryDoc) summaryDoc.textContent = name;
    const summaryFee = document.getElementById('summary-fee');
    if (summaryFee) summaryFee.textContent = `₹${parseFloat(fee).toFixed(2)}`;

    loadSlots(docId, selectedDate);
}

async function loadSlots(docId, date) {
    const slotsContainer = document.getElementById('slots-grid');
    if (!slotsContainer) return;

    const loadingSlotsText = typeof I18N !== 'undefined' ? I18N.t('loading', 'Loading available slots...') : 'Loading available slots...';
    slotsContainer.innerHTML = `
        <div class="col-span-full p-6 text-center">
            <div class="inline-block animate-spin text-blue-600 text-xl">⟳</div>
            <p class="text-xs text-slate-400 mt-1">${loadingSlotsText}</p>
        </div>
    `;

    const res = await API.get(`/doctors/${docId}/slots/`, { date });

    if (!res.ok || !res.data || !res.data.slots || res.data.slots.length === 0) {
        const noSlotsText = typeof I18N !== 'undefined' 
            ? I18N.t('noSlotsToday', 'No time slots scheduled for this date. You can still book a Walk-in / Queue Token.') 
            : 'No time slots scheduled for this date. You can still book a Walk-in / Queue Token.';
        slotsContainer.innerHTML = `
            <div class="col-span-full p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <p class="text-xs font-semibold text-slate-500">${noSlotsText}</p>
            </div>
        `;
        return;
    }

    slotsContainer.innerHTML = res.data.slots.map(slot => {
        const isAvailable = slot.status === 'AVAILABLE';
        const isSelected = selectedSlotId === slot.id;
        const timeLabel = `${slot.start_time.substring(0, 5)} - ${slot.end_time.substring(0, 5)}`;
        const statusLabel = isAvailable 
            ? (typeof I18N !== 'undefined' ? I18N.t('statusAvailable', 'AVAILABLE') : 'AVAILABLE')
            : (typeof I18N !== 'undefined' ? I18N.t('statusBooked', 'BOOKED') : 'BOOKED');

        return `
            <button type="button"
                    ${!isAvailable ? 'disabled' : ''}
                    onclick="selectSlot(${slot.id}, '${timeLabel}')"
                    class="p-3 rounded-xl text-xs font-bold text-center border transition-all ${
                        !isAvailable 
                        ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed line-through' 
                        : isSelected 
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-400/30' 
                            : 'bg-white text-slate-700 border-slate-200 hover:border-blue-400 hover:bg-blue-50/50'
                    }">
                <div>${timeLabel}</div>
                <span class="text-[10px] font-medium block mt-0.5 ${!isAvailable ? 'text-slate-400' : isSelected ? 'text-blue-100' : 'text-teal-600'}">
                    ${statusLabel}
                </span>
            </button>
        `;
    }).join('');
}

function selectSlot(slotId, label) {
    selectedSlotId = slotId;
    const summarySlot = document.getElementById('summary-slot');
    if (summarySlot) summarySlot.textContent = label;

    if (selectedDoctorId) {
        loadSlots(selectedDoctorId, selectedDate);
    }
}

async function handleBookAppointment(e) {
    e.preventDefault();
    if (!selectedDoctorId) {
        const selectDocMsg = typeof I18N !== 'undefined' ? I18N.t('selectDoctorPrompt', 'Please select a doctor first.') : 'Please select a doctor first.';
        API.showToast(selectDocMsg, 'warning');
        return;
    }

    const btn = document.getElementById('book-submit-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    const confirmingText = typeof I18N !== 'undefined' ? I18N.t('confirmingBooking', 'Confirming Booking...') : 'Confirming Booking...';
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⟳</span> ${confirmingText}`;

    const bookingType = document.getElementById('booking-type').value;

    const payload = {
        doctor_id: selectedDoctorId,
        appointment_date: selectedDate,
        slot_id: selectedSlotId,
        booking_type: bookingType
    };

    const res = await API.post('/appointments/book/', payload);
    btn.disabled = false;
    btn.innerHTML = originalText;

    if (res.ok && res.data) {
        showConfirmationModal(res.data);
    } else {
        API.showToast(res.error?.message || 'Booking failed. Slot may be taken.', 'error');
    }
}

function showConfirmationModal(appt) {
    const modal = document.getElementById('confirmation-modal');
    document.getElementById('conf-token').textContent = appt.token_number;
    document.getElementById('conf-doctor').textContent = appt.doctor_name;
    document.getElementById('conf-date').textContent = appt.appointment_date;
    const generalQueueText = typeof I18N !== 'undefined' ? I18N.t('generalQueue', 'General Queue') : 'General Queue';
    document.getElementById('conf-slot').textContent = appt.slot_time || generalQueueText;
    const minSuffix = typeof I18N !== 'undefined' && I18N.getLanguage() === 'hi' ? ' मिनट' : ' Minutes';
    document.getElementById('conf-wait').textContent = `${appt.estimated_wait_minutes}${minSuffix}`;

    modal.classList.remove('hidden');
}
