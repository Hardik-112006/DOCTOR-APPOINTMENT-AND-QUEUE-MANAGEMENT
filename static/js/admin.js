/**
 * Admin Overview & Clinic Analytics Controller
 * Fully independent API consumers: Metrics (5s), Activity Logs (5s), Daily Progress (30s), Doctor Roster.
 */

let metricsPollInterval = null;
let activityPollInterval = null;
let dailyProgressPollInterval = null;
let currentPastPage = 1;
const PAST_PAGE_LIMIT = 10;
let totalPastLogs = 0;

document.addEventListener('DOMContentLoaded', async () => {
    API.requireAuth(['ADMIN']);

    // 1. Initial independent API calls
    await Promise.allSettled([
        loadDashboardMetrics(),
        loadDailyProgress(),
        loadActivityLogs(),
        loadDoctorStatuses(),
        loadPastActivities(1)
    ]);

    // 2. Start independent polling
    startAdminPolling();

    // 3. React to language changes
    window.addEventListener('languageChanged', () => {
        loadDashboardMetrics();
        loadDailyProgress();
        loadActivityLogs();
        loadDoctorStatuses();
        loadPastActivities(currentPastPage);
    });
});

function startAdminPolling() {
    if (metricsPollInterval) clearInterval(metricsPollInterval);
    if (activityPollInterval) clearInterval(activityPollInterval);
    if (dailyProgressPollInterval) clearInterval(dailyProgressPollInterval);

    // Metrics every 5 seconds
    metricsPollInterval = setInterval(loadDashboardMetrics, 5000);

    // Live Audit Activity logs every 5 seconds
    activityPollInterval = setInterval(loadActivityLogs, 5000);

    // Daily progress every 30 seconds
    dailyProgressPollInterval = setInterval(loadDailyProgress, 30000);
}

/**
 * 1. KPI Metrics & Visual Distribution
 */
async function loadDashboardMetrics() {
    try {
        const res = await API.get('/dashboard/metrics/');
        console.log('[ADMIN] Metrics:', res);

        if (!res.ok || !res.data) {
            console.error('[ADMIN] Metrics API Error:', res.status, res.error);
            return;
        }

        const m = res.data;

        // KPI Numbers
        const elTotal = document.getElementById('metric-total');
        const elWaiting = document.getElementById('metric-waiting');
        const elCalled = document.getElementById('metric-called');
        const elConsulting = document.getElementById('metric-consulting');
        const elCompleted = document.getElementById('metric-completed');
        const elAvgWait = document.getElementById('metric-avg-wait');
        const elDoctors = document.getElementById('metric-doctors');

        if (elTotal) elTotal.textContent = m.total_appointments || 0;
        if (elWaiting) elWaiting.textContent = m.waiting_patients || 0;
        if (elCalled) elCalled.textContent = m.called_patients || 0;
        if (elConsulting) elConsulting.textContent = m.consulting_patients || 0;
        if (elCompleted) elCompleted.textContent = m.completed_patients || 0;
        if (elAvgWait) elAvgWait.textContent = `${m.average_waiting_minutes || 0}m`;
        if (elDoctors) elDoctors.textContent = `${m.available_doctors || 0}/${m.total_doctors || 0}`;

        // Visual Queue Breakdown Progress
        const total = m.total_appointments || 1;
        const pWaiting = ((m.waiting_patients || 0) / total) * 100;
        const pCalled = ((m.called_patients || 0) / total) * 100;
        const pConsulting = ((m.consulting_patients || 0) / total) * 100;
        const pCompleted = ((m.completed_patients || 0) / total) * 100;

        const barWaiting = document.getElementById('bar-waiting');
        const barCalled = document.getElementById('bar-called');
        const barConsulting = document.getElementById('bar-consulting');
        const barCompleted = document.getElementById('bar-completed');

        if (barWaiting) barWaiting.style.width = `${pWaiting}%`;
        if (barCalled) barCalled.style.width = `${pCalled}%`;
        if (barConsulting) barConsulting.style.width = `${pConsulting}%`;
        if (barCompleted) barCompleted.style.width = `${pCompleted}%`;
    } catch (err) {
        console.error('[ADMIN] Exception during loadDashboardMetrics:', err);
    }
}

/**
 * 2. Daily Consultation Progress & Throughput
 */
async function loadDailyProgress() {
    const container = document.getElementById('daily-progress-container');
    try {
        const res = await API.get('/dashboard/daily-progress/');
        console.log('[ADMIN] Daily Progress:', res);

        if (!container) return;

        if (!res.ok) {
            const statusMsg = res.status === 401 ? 'Unauthorized' : res.status === 403 ? 'Forbidden' : res.status === 404 ? 'Not Found' : 'Server error';
            const errorMsg = res.error?.message || statusMsg;
            container.innerHTML = `<div class="p-4 text-center text-rose-600 text-xs bg-rose-50 rounded-2xl border border-rose-200">Unable to load daily progress (HTTP ${res.status}): ${errorMsg}</div>`;
            return;
        }

        const days = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        renderDailyProgress(days);
    } catch (err) {
        console.error('[ADMIN] Exception during loadDailyProgress:', err);
        if (container) {
            container.innerHTML = `<div class="p-4 text-center text-rose-600 text-xs bg-rose-50 rounded-2xl border border-rose-200">Error rendering daily progress: ${err.message || 'Client error'}</div>`;
        }
    }
}

function renderDailyProgress(days) {
    const container = document.getElementById('daily-progress-container');
    if (!container) return;

    if (!days || days.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-slate-400 text-xs">No daily consultation data recorded yet.</div>`;
        return;
    }

    const completedLabel = typeof I18N !== 'undefined' ? I18N.t('completed', 'completed') : 'completed';
    const totalLabel = typeof I18N !== 'undefined' ? I18N.t('total', 'total') : 'total';
    const todayBadgeText = typeof I18N !== 'undefined' ? I18N.t('today', 'Today') : 'Today';

    container.innerHTML = days.map(d => {
        const total = d.total || 0;
        const completed = d.completed || 0;
        const pct = total > 0 ? (typeof d.percentage === 'number' ? d.percentage : parseFloat(d.percentage || 0)) : 0.0;
        const isToday = !!d.is_today;

        // Progress bar color gradient based on completion rate
        let barColor = 'bg-emerald-500';
        if (pct < 30 && total > 0) barColor = 'bg-amber-500';
        else if (pct >= 80) barColor = 'bg-gradient-to-r from-teal-500 to-emerald-600';

        return `
            <div class="p-3.5 rounded-2xl border ${isToday ? 'border-blue-300 bg-blue-50/20 shadow-sm' : 'border-slate-100 bg-slate-50/50'} space-y-2">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                    <div class="flex items-center gap-2">
                        <span class="font-extrabold text-slate-900">${d.day_name}</span>
                        <span class="text-slate-400 font-medium font-mono">(${d.date_formatted || d.date})</span>
                        ${isToday ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 uppercase tracking-wider">${todayBadgeText}</span>` : ''}
                    </div>
                    <div class="flex items-center gap-3">
                        <span class="font-bold text-slate-700 text-xs font-mono">${completed} ${completedLabel} / ${total} ${totalLabel}</span>
                        <span class="font-black text-xs ${pct >= 50 ? 'text-emerald-700' : 'text-slate-700'}">${pct}%</span>
                    </div>
                </div>

                <!-- Horizontal Progress Bar -->
                <div class="h-3 w-full bg-slate-200 rounded-full overflow-hidden shadow-inner flex">
                    <div class="${barColor} h-full transition-all duration-700 rounded-full" style="width: ${Math.min(pct, 100)}%;"></div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * 3. Live Audit Activity Logs Stream
 */
async function loadActivityLogs() {
    const logList = document.getElementById('activity-log-list');
    try {
        const res = await API.get('/dashboard/activity-logs/', { limit: 50 });
        console.log('[ADMIN] Activity Logs:', res);

        if (!logList) return;

        if (!res.ok) {
            const statusMsg = res.status === 401 ? 'Unauthorized' : res.status === 403 ? 'Forbidden' : res.status === 404 ? 'Not Found' : 'Server error';
            const errorMsg = res.error?.message || statusMsg;
            logList.innerHTML = `<div class="p-4 text-center text-rose-600 text-xs bg-rose-50 rounded-2xl border border-rose-200">Unable to load audit activities (HTTP ${res.status}): ${errorMsg}</div>`;
            return;
        }

        const activities = Array.isArray(res.data) ? res.data : (res.data?.data || []);
        renderLiveAuditLogs(activities);
    } catch (err) {
        console.error('[ADMIN] Exception during loadActivityLogs:', err);
        if (logList) {
            logList.innerHTML = `<div class="p-4 text-center text-rose-600 text-xs bg-rose-50 rounded-2xl border border-rose-200">Error rendering audit activities: ${err.message || 'Client error'}</div>`;
        }
    }
}

function renderLiveAuditLogs(activities) {
    const logList = document.getElementById('activity-log-list');
    if (!logList) return;

    if (!activities || activities.length === 0) {
        logList.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">No activity recorded yet today.</div>`;
        return;
    }

    logList.innerHTML = activities.map(a => {
        const style = getActionStyle(a.action);
        const userRole = a.user_role || 'USER';
        const rolePillClass = getRolePillClass(userRole);
        const actionText = a.action_display || formatAction(a.action);
        const timeDisplay = a.created_at_full || a.created_at_formatted || a.created_at;

        return `
            <div class="flex items-start gap-3 py-3 first:pt-0 last:pb-0 text-xs transition-colors hover:bg-slate-50/80 px-2 rounded-xl">
                <div class="w-8 h-8 rounded-xl ${style.iconBg} ${style.iconColor} font-black text-sm flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    ${style.icon}
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2">
                        <span class="font-bold text-slate-900 truncate">${actionText}</span>
                        <span class="text-[10px] font-mono text-slate-400 shrink-0 font-medium">${timeDisplay}</span>
                    </div>
                    <div class="flex items-center gap-2 mt-1 flex-wrap">
                        <span class="text-[11px] text-slate-600 font-semibold">By ${a.user || 'System'}</span>
                        <span class="px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase ${rolePillClass}">${userRole}</span>
                        ${a.entity_type && a.entity_id ? `
                            <span class="text-[10px] text-slate-400">• ${a.entity_type} #${a.entity_id}</span>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * 4. Past Activities Historical Audit Log with Pagination
 */
async function loadPastActivities(page = 1) {
    currentPastPage = page;
    const tableBody = document.getElementById('past-activity-table-body');
    if (!tableBody) return;

    const offset = (page - 1) * PAST_PAGE_LIMIT;
    const res = await API.get('/dashboard/activity-logs/', { limit: PAST_PAGE_LIMIT, offset });

    if (!res.ok) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="p-6 text-center text-rose-600 text-xs bg-rose-50">
                    Unable to load past activities: ${res.error?.message || 'Server error'}
                </td>
            </tr>
        `;
        return;
    }

    const logs = Array.isArray(res.data) ? res.data : (res.data?.data || []);
    totalPastLogs = typeof res.total === 'number' ? res.total : (res.meta?.total || logs.length);

    const countBadge = document.getElementById('past-activities-count');
    if (countBadge) {
        const showingLabel = typeof I18N !== 'undefined' ? I18N.t('showingLogs', 'Showing logs') : 'Showing logs';
        countBadge.textContent = `${showingLabel}: ${logs.length} (Total: ${totalPastLogs})`;
    }

    if (logs.length === 0) {
        const noPastMsg = typeof I18N !== 'undefined' ? I18N.t('noPastActivities', 'No past activities recorded yet.') : 'No past activities recorded yet.';
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="p-6 text-center text-slate-400 text-xs">${noPastMsg}</td>
            </tr>
        `;
        updatePastPaginationControls(1, 1);
        return;
    }

    tableBody.innerHTML = logs.map(a => {
        const style = getActionStyle(a.action);
        const userRole = a.user_role || 'USER';
        const rolePillClass = getRolePillClass(userRole);
        const actionText = a.action_display || formatAction(a.action);
        const timeDisplay = a.created_at_full || a.created_at_formatted || a.created_at || '';
        const entityDisplay = a.entity_type && a.entity_id ? `${a.entity_type} #${a.entity_id}` : (a.entity_type || '-');

        return `
            <tr class="hover:bg-slate-50/80 transition-colors">
                <td class="py-3 px-3">
                    <div class="flex items-center gap-2">
                        <span class="w-6 h-6 rounded-lg ${style.iconBg} ${style.iconColor} flex items-center justify-center font-bold text-xs shrink-0">${style.icon}</span>
                        <span class="font-bold text-slate-900">${actionText}</span>
                    </div>
                </td>
                <td class="py-3 px-3 font-semibold text-slate-700">${a.user || 'System'}</td>
                <td class="py-3 px-3">
                    <span class="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${rolePillClass}">${userRole}</span>
                </td>
                <td class="py-3 px-3 font-mono text-[11px] text-slate-500">${entityDisplay}</td>
                <td class="py-3 px-3 text-right font-mono text-slate-400 text-[11px] whitespace-nowrap">${timeDisplay}</td>
            </tr>
        `;
    }).join('');

    const totalPages = Math.max(1, Math.ceil(totalPastLogs / PAST_PAGE_LIMIT));
    updatePastPaginationControls(page, totalPages);
}

function updatePastPaginationControls(page, totalPages) {
    const pageInfo = document.getElementById('past-page-info');
    if (pageInfo) {
        pageInfo.textContent = `Page ${page} of ${totalPages} (${totalPastLogs} total)`;
    }

    const prevBtn = document.getElementById('past-prev-btn');
    const nextBtn = document.getElementById('past-next-btn');

    if (prevBtn) {
        prevBtn.disabled = page <= 1;
    }
    if (nextBtn) {
        nextBtn.disabled = page >= totalPages;
    }
}

function prevPastPage() {
    if (currentPastPage > 1) {
        loadPastActivities(currentPastPage - 1);
    }
}

function nextPastPage() {
    const totalPages = Math.max(1, Math.ceil(totalPastLogs / PAST_PAGE_LIMIT));
    if (currentPastPage < totalPages) {
        loadPastActivities(currentPastPage + 1);
    }
}

function getActionStyle(action) {
    if (!action) return { icon: 'ℹ', iconBg: 'bg-slate-100', iconColor: 'text-slate-600' };

    if (action.includes('BOOKED') || action.includes('WALK_IN')) {
        return { icon: '+', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-700' };
    }
    if (action.includes('CANCELLED')) {
        return { icon: '✕', iconBg: 'bg-rose-100', iconColor: 'text-rose-700' };
    }
    if (action.includes('CALL_NEXT') || action.includes('CALLED')) {
        return { icon: '🔔', iconBg: 'bg-amber-100', iconColor: 'text-amber-700' };
    }
    if (action.includes('CONSULTING') || action.includes('CONSULTATION')) {
        return { icon: '⚕', iconBg: 'bg-blue-100', iconColor: 'text-blue-700' };
    }
    if (action.includes('COMPLETED')) {
        return { icon: '✓', iconBg: 'bg-teal-100', iconColor: 'text-teal-700' };
    }
    if (action.includes('ARRIVED')) {
        return { icon: '🚶', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-700' };
    }
    if (action.includes('LOGIN')) {
        return { icon: '🔑', iconBg: 'bg-purple-100', iconColor: 'text-purple-700' };
    }
    if (action.includes('REGISTERED')) {
        return { icon: '👤', iconBg: 'bg-sky-100', iconColor: 'text-sky-700' };
    }
    return { icon: '•', iconBg: 'bg-slate-100', iconColor: 'text-slate-600' };
}

function getRolePillClass(role) {
    switch (role) {
        case 'ADMIN': return 'bg-amber-100 text-amber-800 border border-amber-200';
        case 'DOCTOR': return 'bg-blue-100 text-blue-800 border border-blue-200';
        case 'RECEPTIONIST': return 'bg-indigo-100 text-indigo-800 border border-indigo-200';
        case 'PATIENT': return 'bg-teal-100 text-teal-800 border border-teal-200';
        default: return 'bg-slate-100 text-slate-700';
    }
}

/**
 * 5. Doctor Roster
 */
async function loadDoctorStatuses() {
    const container = document.getElementById('doctor-status-grid');
    if (!container) return;

    const res = await API.get('/doctors/');
    if (!res.ok || !res.data) {
        container.innerHTML = `<div class="col-span-full p-4 text-center text-rose-500 text-xs bg-rose-50 rounded-xl">Unable to load doctor roster: ${res.error?.message || 'Server error'}</div>`;
        return;
    }

    const docs = Array.isArray(res.data) ? res.data : (res.data.data || []);
    if (docs.length === 0) {
        container.innerHTML = `<div class="col-span-full p-4 text-center text-slate-400 text-xs">No doctors found in roster.</div>`;
        return;
    }

    container.innerHTML = docs.map(doc => {
        const docName = doc.name || doc.full_name || 'Doctor';
        const docInitial = docName.replace('Dr. ', '').charAt(0) || 'D';
        const isAvail = doc.is_available !== false;
        const spec = doc.specialization || doc.department_name || 'General';
        const specTranslated = typeof I18N !== 'undefined' ? I18N.t(spec, spec) : spec;
        const availText = typeof I18N !== 'undefined' 
            ? (isAvail ? I18N.t('availableToday', 'Available Today') : I18N.t('offlineToday', 'Offline Today'))
            : (isAvail ? 'Available' : 'Unavailable');

        return `
            <div class="p-4 rounded-2xl border border-slate-200 bg-white flex items-center justify-between shadow-sm">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 font-black text-sm flex items-center justify-center">
                        ${docInitial}
                    </div>
                    <div>
                        <h4 class="font-bold text-slate-900 text-xs leading-tight">${docName}</h4>
                        <span class="text-[11px] text-teal-600 font-medium">${specTranslated}</span>
                    </div>
                </div>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${isAvail ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}">
                    ${availText}
                </span>
            </div>
        `;
    }).join('');
}

function formatAction(action) {
    if (!action) return 'System Activity';
    switch (action) {
        case 'CALL_NEXT_PATIENT': return 'Called Next Patient';
        case 'CONSULTATION_STARTED': return 'Started Consultation';
        case 'QUEUE_STATUS_COMPLETED': return 'Completed Consultation';
        case 'APPOINTMENT_BOOKED': return 'New Appointment Booked';
        case 'APPOINTMENT_CANCELLED': return 'Appointment Cancelled';
        case 'WALK_IN_REGISTERED': return 'Walk-in Token Issued';
        case 'PATIENT_ARRIVED': return 'Patient Marked Arrived';
        case 'PATIENT_REGISTERED': return 'Patient Account Registered';
        default: return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
}
