/**
 * Sign In / Create Account page (the site's landing page).
 */

const tr = (key, fallback) => (typeof I18N !== 'undefined' ? I18N.t(key, fallback) : fallback);

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Remaining seeded accounts (seed_demo) shown under "More seeded accounts"
const EXTRA_DEMO_ACCOUNTS = [
    ['Test Patient', 'patient@test.com', 'Patient@123', 'PATIENT'],
    ['Meera Singh (in consultation)', '9000000006', 'Demo@123', 'PATIENT'],
    ['Kabir Gupta', '9000000007', 'Demo@123', 'PATIENT'],
    ['Ananya Patel (walk-in)', '9000000008', 'Demo@123', 'PATIENT'],
    ['Rohan Mehta (completed)', '9000000009', 'Demo@123', 'PATIENT'],
    ['Dr. Neha Verma (Cardiology)', '9000000004', 'Demo@123', 'DOCTOR'],
    ['Dr. Vikram Seth', 'doctor@test.com', 'Doctor@123', 'DOCTOR'],
    ['Test Receptionist', 'receptionist@test.com', 'Receptionist@123', 'RECEPTIONIST'],
    ['Test Admin', 'admin@test.com', 'Admin@123', 'ADMIN'],
    ['Dr. Kavita Rao (pending approval)', '9000000020', 'Demo@123', 'DOCTOR'],
];

document.addEventListener('DOMContentLoaded', () => {
    // Already signed in? Go straight to your own panel.
    const user = API.getUser();
    if (user && API.getToken()) {
        API.redirectUserDashboard(user.role);
        return;
    }

    if (new URLSearchParams(window.location.search).get('session_expired')) {
        document.getElementById('session-expired-banner')?.classList.remove('hidden');
    }

    document.querySelectorAll('.blood-group-select').forEach(sel => {
        sel.innerHTML = `<option value="">${tr('selectOption', 'Select')}</option>` + BLOOD_GROUPS.map(b => `<option value="${b}">${b}</option>`).join('');
    });

    renderExtraDemoAccounts();

    document.getElementById('login-form')?.addEventListener('submit', handleLogin);
    document.getElementById('register-form')?.addEventListener('submit', handleRegister);
    document.getElementById('staff-register-form')?.addEventListener('submit', handleStaffRegister);

    if (window.location.hash === '#register') switchAuthTab('register');
});

function showAuthMessage(message, type = 'error') {
    const box = document.getElementById('auth-message');
    if (!box) return;
    const styles = {
        error: 'bg-rose-50 border-rose-200 text-rose-800',
        success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
        info: 'bg-blue-50 border-blue-200 text-blue-800'
    };
    const icons = { error: '✕', success: '✓', info: 'ℹ' };
    box.className = `mb-5 p-3.5 rounded-xl text-xs font-semibold border flex items-start gap-2 ${styles[type] || styles.info}`;
    box.innerHTML = `<span class="font-black">${icons[type] || 'ℹ'}</span><span>${API.escapeHtml(message)}</span>`;
}

function clearAuthMessage() {
    const box = document.getElementById('auth-message');
    if (box) box.className = 'hidden';
}

function switchAuthTab(tab) {
    clearAuthMessage();
    const isSignIn = tab === 'signin';
    document.getElementById('panel-signin').classList.toggle('hidden', !isSignIn);
    document.getElementById('panel-register').classList.toggle('hidden', isSignIn);
    const active = 'border-blue-600 text-blue-700 bg-blue-50/50';
    const inactive = 'border-transparent text-slate-500 hover:text-slate-800';
    const signinTab = document.getElementById('tab-signin');
    const registerTab = document.getElementById('tab-register');
    signinTab.className = `auth-tab py-4 text-sm font-extrabold transition-colors border-b-2 ${isSignIn ? active : inactive}`;
    registerTab.className = `auth-tab py-4 text-sm font-extrabold transition-colors border-b-2 ${!isSignIn ? active : inactive}`;
}

function switchAccountType(type) {
    clearAuthMessage();
    const isPatient = type === 'patient';
    document.getElementById('register-form').classList.toggle('hidden', !isPatient);
    document.getElementById('staff-register-form').classList.toggle('hidden', isPatient);
    document.getElementById('acct-type-patient').className = `acct-type py-2.5 rounded-xl text-xs font-extrabold ${isPatient ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500'}`;
    document.getElementById('acct-type-staff').className = `acct-type py-2.5 rounded-xl text-xs font-extrabold ${!isPatient ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500'}`;
    if (!isPatient) loadDepartmentsForStaff();
}

function toggleStaffDoctorFields() {
    const isDoctor = document.getElementById('staff-role').value === 'DOCTOR';
    document.getElementById('staff-doctor-fields').classList.toggle('hidden', !isDoctor);
}

let departmentsLoaded = false;
async function loadDepartmentsForStaff() {
    if (departmentsLoaded) return;
    const res = await API.get('/departments/');
    const select = document.getElementById('staff-department');
    if (res.ok && Array.isArray(res.data) && select) {
        select.innerHTML = res.data.map(d => `<option value="${d.id}">${API.escapeHtml(tr(d.name, d.name))}</option>`).join('');
        departmentsLoaded = true;
    }
}

function renderExtraDemoAccounts() {
    const container = document.getElementById('more-demo-accounts');
    if (!container) return;
    container.innerHTML = EXTRA_DEMO_ACCOUNTS.map(([label, id, pass, role]) => `
        <button type="button" onclick="demoLogin('${id}', '${pass}')" class="w-full flex items-center justify-between gap-2 py-2 text-left hover:bg-slate-50 rounded-lg px-1">
            <span class="min-w-0">
                <span class="font-bold text-slate-800 block truncate">${API.escapeHtml(label)}</span>
                <span class="text-slate-400 font-mono">${API.escapeHtml(id)} / ${API.escapeHtml(pass)}</span>
            </span>
            <span class="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-slate-100 text-slate-600 shrink-0">${role}</span>
        </button>
    `).join('');
}

async function demoLogin(identifier, password) {
    switchAuthTab('signin');
    document.getElementById('identifier').value = identifier;
    document.getElementById('password').value = password;
    await handleLogin();
}

async function handleLogin(e) {
    if (e) e.preventDefault();
    clearAuthMessage();
    const btn = document.getElementById('login-submit-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⟳</span> ${tr('signingIn', 'Signing In...')}`;

    const identifier = document.getElementById('identifier').value.trim();
    const password = document.getElementById('password').value;

    const res = await API.login(identifier, password);
    btn.disabled = false;
    btn.innerHTML = originalText;

    if (res.ok && res.data?.user) {
        API.redirectUserDashboard(res.data.user.role);
    } else {
        const code = res.error?.code;
        const type = code === 'ACCOUNT_PENDING_APPROVAL' ? 'info' : 'error';
        showAuthMessage(res.error?.message || tr('invalidCredentials', 'Invalid credentials'), type);
    }
}

function markFieldErrors(fields, fieldMap) {
    Object.entries(fields || {}).forEach(([fKey, fVal]) => {
        const inputEl = fieldMap[fKey] ? document.getElementById(fieldMap[fKey]) : null;
        if (!inputEl) return;
        inputEl.classList.add('border-rose-500', 'ring-2', 'ring-rose-200');
        const errSpan = document.createElement('span');
        errSpan.className = 'reg-error-msg text-[11px] font-bold text-rose-600 block mt-1';
        errSpan.textContent = Array.isArray(fVal) ? fVal[0] : fVal;
        inputEl.parentElement.appendChild(errSpan);
    });
}

function clearFieldErrors(formId) {
    document.querySelectorAll(`#${formId} .reg-error-msg`).forEach(el => el.remove());
    document.querySelectorAll(`#${formId} input, #${formId} select`).forEach(el => {
        el.classList.remove('border-rose-500', 'ring-2', 'ring-rose-200');
    });
}

async function handleRegister(e) {
    e.preventDefault();
    clearAuthMessage();
    clearFieldErrors('register-form');
    const btn = document.getElementById('register-submit-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⟳</span> ${tr('registering', 'Creating account...')}`;

    const val = (id) => document.getElementById(id).value.trim();
    const payload = {
        full_name: val('reg-name'),
        phone: val('reg-phone'),
        email: val('reg-email') || null,
        password: document.getElementById('reg-password').value,
        gender: val('reg-gender') || null,
        date_of_birth: val('reg-dob') || null,
        blood_group: val('reg-blood') || null,
        weight_kg: val('reg-weight') || null,
        height_cm: val('reg-height') || null,
        language: API.getLanguage()
    };

    const res = await API.post('/auth/register/', payload);
    btn.disabled = false;
    btn.innerHTML = originalText;

    if (res.ok && res.data) {
        API.setAuth(res.data);
        API.showToast(tr('accountCreated', 'Account created successfully! Welcome.'), 'success');
        API.redirectUserDashboard('PATIENT');
        return;
    }
    showAuthMessage(res.error?.message || tr('registrationFailed', 'Registration failed. Check your information.'));
    markFieldErrors(res.error?.fields, {
        full_name: 'reg-name', phone: 'reg-phone', email: 'reg-email', password: 'reg-password',
        gender: 'reg-gender', date_of_birth: 'reg-dob', blood_group: 'reg-blood', weight_kg: 'reg-weight', height_cm: 'reg-height'
    });
}

async function handleStaffRegister(e) {
    e.preventDefault();
    clearAuthMessage();
    clearFieldErrors('staff-register-form');
    const btn = document.getElementById('staff-submit-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;

    const val = (id) => document.getElementById(id).value.trim();
    const role = val('staff-role');
    const payload = {
        role,
        full_name: val('staff-name'),
        phone: val('staff-phone'),
        email: val('staff-email') || null,
        password: document.getElementById('staff-password').value,
    };
    if (role === 'DOCTOR') {
        Object.assign(payload, {
            department_id: parseInt(val('staff-department')) || null,
            specialization: val('staff-specialization'),
            experience: parseInt(val('staff-experience')) || 0,
            consultation_fee: val('staff-fee') || 0,
        });
    }

    const res = await API.post('/auth/register-staff/', payload);
    btn.disabled = false;
    btn.innerHTML = originalText;

    if (res.ok) {
        document.getElementById('staff-register-form').reset();
        toggleStaffDoctorFields();
        showAuthMessage(res.data?.message || tr('staffRequestSubmitted', 'Request submitted. You can sign in once the admin approves your account.'), 'success');
        return;
    }
    showAuthMessage(res.error?.message || tr('registrationFailed', 'Registration failed. Check your information.'));
    markFieldErrors(res.error?.fields, {
        full_name: 'staff-name', phone: 'staff-phone', email: 'staff-email', password: 'staff-password',
        department_id: 'staff-department', experience: 'staff-experience', consultation_fee: 'staff-fee'
    });
}
