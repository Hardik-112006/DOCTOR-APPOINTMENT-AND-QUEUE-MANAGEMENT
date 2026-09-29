/**
 * Auth Controller for Login and Registration
 */

document.addEventListener('DOMContentLoaded', () => {
    // If already logged in, redirect to respective dashboard
    const user = API.getUser();
    if (user && API.getToken()) {
        API.redirectUserDashboard(user.role);
        return;
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
});

function selectDemoRole(role) {
    const credentials = {
        patient: { id: '9000000001', pass: 'Demo@123', label: 'Aarav Sharma (Patient #A-27)' },
        receptionist: { id: '9000000002', pass: 'Demo@123', label: 'Priya Receptionist' },
        doctor: { id: '9000000003', pass: 'Demo@123', label: 'Dr. Rajesh Kumar (General Physician)' },
        admin: { id: '9000000005', pass: 'Demo@123', label: 'Clinic Admin' }
    };

    const cred = credentials[role];
    if (cred) {
        document.getElementById('identifier').value = cred.id;
        document.getElementById('password').value = cred.pass;
        API.showToast(`Selected Demo Profile: ${cred.label}`, 'info');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('login-submit-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⟳</span> Signing In...`;

    const identifier = document.getElementById('identifier').value.trim();
    const password = document.getElementById('password').value;

    const res = await API.login(identifier, password);
    btn.disabled = false;
    btn.innerHTML = originalText;

    if (res.ok && res.data?.user) {
        API.redirectUserDashboard(res.data.user.role);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById('register-submit-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="inline-block animate-spin mr-2">⟳</span> Registering...`;

    // Clear previous field errors
    document.querySelectorAll('.reg-error-msg').forEach(el => el.remove());
    document.querySelectorAll('#register-form input, #register-form select').forEach(el => {
        el.classList.remove('border-rose-500', 'ring-2', 'ring-rose-200');
    });

    const payload = {
        full_name: document.getElementById('reg-name').value.trim(),
        phone: document.getElementById('reg-phone').value.trim(),
        email: document.getElementById('reg-email').value.trim() || null,
        password: document.getElementById('reg-password').value,
        gender: document.getElementById('reg-gender').value || null,
        date_of_birth: document.getElementById('reg-dob').value || null
    };

    const res = await API.post('/auth/register/', payload);
    btn.disabled = false;
    btn.innerHTML = originalText;

    if (res.ok && res.data) {
        API.setAuth(res.data);
        API.showToast('Account created successfully! Welcome.', 'success');
        API.redirectUserDashboard('PATIENT');
    } else {
        const errorMsg = res.error?.message || 'Registration failed. Check your information.';
        API.showToast(errorMsg, 'error');

        // Render field-specific errors
        if (res.error?.fields) {
            const fieldMap = {
                full_name: 'reg-name',
                phone: 'reg-phone',
                email: 'reg-email',
                password: 'reg-password',
                gender: 'reg-gender',
                date_of_birth: 'reg-dob'
            };

            Object.entries(res.error.fields).forEach(([fKey, fVal]) => {
                const inputId = fieldMap[fKey];
                const inputEl = inputId ? document.getElementById(inputId) : null;
                if (inputEl) {
                    inputEl.classList.add('border-rose-500', 'ring-2', 'ring-rose-200');
                    const errSpan = document.createElement('span');
                    errSpan.className = 'reg-error-msg text-[11px] font-bold text-rose-600 block mt-1';
                    errSpan.textContent = Array.isArray(fVal) ? fVal[0] : fVal;
                    inputEl.parentElement.appendChild(errSpan);
                }
            });
        }
    }
}

function showRegisterModal() {
    document.getElementById('register-modal').classList.remove('hidden');
}

function closeRegisterModal() {
    document.getElementById('register-modal').classList.add('hidden');
}
