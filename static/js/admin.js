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

        // Donut Chart & Status Breakdown
        updateQueueDonutAndBreakdown(m);
    } catch (err) {
        console.error('[ADMIN] Exception during loadDashboardMetrics:', err);
    }
}

/**
 * Modern Donut Chart + Status Breakdown Renderer
 */
function updateQueueDonutAndBreakdown(m) {
    const waiting = Number(m.waiting_patients) || 0;
    const called = Number(m.called_patients) || 0;
    const consulting = Number(m.consulting_patients) || 0;
    const completed = Number(m.completed_patients) || 0;

    const total = waiting + called + consulting + completed;

    // Center dynamic count
    const elCenterTotal = document.getElementById('donut-center-total');
    if (elCenterTotal) {
        elCenterTotal.textContent = total;
    }

    // Right-side dynamic counts
    const elCountWaiting = document.getElementById('queue-count-waiting');
    const elCountCalled = document.getElementById('queue-count-called');
    const elCountConsulting = document.getElementById('queue-count-consulting');
    const elCountCompleted = document.getElementById('queue-count-completed');

    if (elCountWaiting) elCountWaiting.textContent = waiting;
    if (elCountCalled) elCountCalled.textContent = called;
    if (elCountConsulting) elCountConsulting.textContent = consulting;
    if (elCountCompleted) elCountCompleted.textContent = completed;

    // Percentages (clean integer %, 0% if total === 0, no NaN or Infinity)
    const pWaiting = total > 0 ? Math.round((waiting / total) * 100) : 0;
    const pCalled = total > 0 ? Math.round((called / total) * 100) : 0;
    const pConsulting = total > 0 ? Math.round((consulting / total) * 100) : 0;
    const pCompleted = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Percentage labels
    const elPercentWaiting = document.getElementById('queue-percent-waiting');
    const elPercentCalled = document.getElementById('queue-percent-called');
    const elPercentConsulting = document.getElementById('queue-percent-consulting');
    const elPercentCompleted = document.getElementById('queue-percent-completed');

    if (elPercentWaiting) elPercentWaiting.textContent = `(${pWaiting}%)`;
    if (elPercentCalled) elPercentCalled.textContent = `(${pCalled}%)`;
    if (elPercentConsulting) elPercentConsulting.textContent = `(${pConsulting}%)`;
    if (elPercentCompleted) elPercentCompleted.textContent = `(${pCompleted}%)`;

    // Right-side Progress Bars
    const elProgWaiting = document.getElementById('queue-progress-waiting');
    const elProgCalled = document.getElementById('queue-progress-called');
    const elProgConsulting = document.getElementById('queue-progress-consulting');
    const elProgCompleted = document.getElementById('queue-progress-completed');

    if (elProgWaiting) elProgWaiting.style.width = `${pWaiting}%`;
    if (elProgCalled) elProgCalled.style.width = `${pCalled}%`;
    if (elProgConsulting) elProgConsulting.style.width = `${pConsulting}%`;
    if (elProgCompleted) elProgCompleted.style.width = `${pCompleted}%`;

    // SVG Donut Segments
    // Radius r = 56, Circumference C = 2 * PI * 56 ≈ 351.858
    const C = 2 * Math.PI * 56;
    const segWaiting = document.getElementById('donut-segment-waiting');
    const segCalled = document.getElementById('donut-segment-called');
    const segConsulting = document.getElementById('donut-segment-consulting');
    const segCompleted = document.getElementById('donut-segment-completed');

    if (total === 0) {
        // Safe Zero-Data State
        [segWaiting, segCalled, segConsulting, segCompleted].forEach(seg => {
            if (seg) {
                seg.setAttribute('stroke-dasharray', `0 ${C}`);
                seg.setAttribute('stroke-dashoffset', '0');
            }
        });
    } else {
        const dWaiting = (waiting / total) * C;
        const dCalled = (called / total) * C;
        const dConsulting = (consulting / total) * C;
        const dCompleted = (completed / total) * C;

        let offset = 0;

        if (segWaiting) {
            segWaiting.setAttribute('stroke-dasharray', `${dWaiting} ${C}`);
            segWaiting.setAttribute('stroke-dashoffset', `${-offset}`);
        }
        offset += dWaiting;

        if (segCalled) {
            segCalled.setAttribute('stroke-dasharray', `${dCalled} ${C}`);
            segCalled.setAttribute('stroke-dashoffset', `${-offset}`);
        }
        offset += dCalled;

        if (segConsulting) {
            segConsulting.setAttribute('stroke-dasharray', `${dConsulting} ${C}`);
            segConsulting.setAttribute('stroke-dashoffset', `${-offset}`);
        }
        offset += dConsulting;

        if (segCompleted) {
            segCompleted.setAttribute('stroke-dasharray', `${dCompleted} ${C}`);
            segCompleted.setAttribute('stroke-dashoffset', `${-offset}`);
        }
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

    // 1. Calculate dynamic 7 calendar days chronologically from current date
    const chartDays = getDynamicPast7Days(days);

    // 2. Compute labels and i18n
    const completedLabel = typeof I18N !== 'undefined' ? I18N.t('completed', 'Completed') : 'Completed';
    const totalLabel = typeof I18N !== 'undefined' ? I18N.t('total', 'Total') : 'Total';
    const completionLabel = typeof I18N !== 'undefined' ? I18N.t('completion', 'Completion') : 'Completion';
    const todayLabel = typeof I18N !== 'undefined' ? I18N.t('today', 'Today') : 'Today';
    const dateLabel = typeof I18N !== 'undefined' ? I18N.t('date', 'Date') : 'Date';

    // 3. Compute 7-day summary metrics for legend pills
    const sumTotal = chartDays.reduce((acc, d) => acc + d.total, 0);
    const sumCompleted = chartDays.reduce((acc, d) => acc + d.completed, 0);
    const avgPct = sumTotal > 0 ? (Math.round((sumCompleted / sumTotal) * 1000) / 10) : 0.0;

    const legendContainer = document.getElementById('chart-legend-container');
    if (legendContainer) {
        legendContainer.innerHTML = `
            <div class="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 text-blue-800 rounded-xl border border-blue-200/80 font-bold shadow-xs">
                <span class="w-2.5 h-2.5 rounded-full bg-blue-600 shadow-sm"></span>
                <span>${totalLabel}:</span>
                <span class="font-black text-blue-900 font-mono">${sumTotal}</span>
            </div>
            <div class="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200/80 font-bold shadow-xs">
                <span class="w-2.5 h-2.5 rounded-full bg-emerald-600 shadow-sm"></span>
                <span>${completedLabel}:</span>
                <span class="font-black text-emerald-900 font-mono">${sumCompleted}</span>
            </div>
            <div class="hidden xs:flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-xl border border-slate-200 font-bold shadow-xs">
                <span>${completionLabel}:</span>
                <span class="font-black font-mono ${avgPct >= 50 ? 'text-emerald-700' : 'text-slate-800'}">${avgPct}%</span>
            </div>
        `;
    }

    // 4. Compute Y-Axis max scale with nice headroom
    const maxVal = Math.max(...chartDays.map(d => Math.max(d.total, d.completed)), 0);
    const yMax = maxVal > 0 ? (maxVal <= 4 ? 4 : Math.ceil(maxVal * 1.25)) : 4;
    const tickMidTop = Math.round(yMax * 0.67);
    const tickMidBottom = Math.round(yMax * 0.33);

    // 5. Store globally for interactive touch/click selection
    window.__adminChartDays = chartDays;

    // 6. Generate Vertical Grouped Bar Chart HTML
    container.innerHTML = `
        <div class="bg-slate-50/60 rounded-3xl p-3 sm:p-6 border border-slate-200/80 space-y-4">
            <!-- Chart Drawing Box -->
            <div class="relative w-full h-56 sm:h-64 flex">
                <!-- Left Y-Axis Scale -->
                <div class="w-6 sm:w-8 h-full flex flex-col justify-between items-end pr-2 text-[10px] font-mono font-bold text-slate-400 select-none pb-7">
                    <span>${yMax}</span>
                    <span>${tickMidTop}</span>
                    <span>${tickMidBottom}</span>
                    <span>0</span>
                </div>

                <!-- Plot Area with Horizontal Grid Lines & 7 Grouped Bar Columns -->
                <div class="relative flex-1 h-full flex flex-col justify-between">
                    <!-- Background Grid Lines -->
                    <div class="absolute inset-0 flex flex-col justify-between pointer-events-none pb-7">
                        <div class="w-full border-b border-dashed border-slate-200"></div>
                        <div class="w-full border-b border-dashed border-slate-200"></div>
                        <div class="w-full border-b border-dashed border-slate-200"></div>
                        <div class="w-full border-b border-slate-300"></div>
                    </div>

                    <!-- 7 Day Columns Grid -->
                    <div class="relative z-10 grid grid-cols-7 h-full w-full gap-1 sm:gap-2">
                        ${chartDays.map((d, idx) => {
                            const totalPct = yMax > 0 ? Math.min(100, Math.max(d.total > 0 ? 5 : 0, (d.total / yMax) * 100)) : 0;
                            const completedPct = yMax > 0 ? Math.min(100, Math.max(d.completed > 0 ? 5 : 0, (d.completed / yMax) * 100)) : 0;
                            
                            // Align tooltip so edges don't overflow on small mobile screens
                            let tooltipPosClass = "left-1/2 -translate-x-1/2";
                            let arrowPosClass = "left-1/2 -translate-x-1/2";
                            if (idx === 0) {
                                tooltipPosClass = "left-0 translate-x-0 sm:left-1/2 sm:-translate-x-1/2";
                                arrowPosClass = "left-4 sm:left-1/2 sm:-translate-x-1/2";
                            } else if (idx === 6) {
                                tooltipPosClass = "right-0 translate-x-0 sm:left-1/2 sm:-translate-x-1/2";
                                arrowPosClass = "right-4 sm:left-1/2 sm:-translate-x-1/2";
                            }

                            return `
                                <div class="group relative flex flex-col justify-between items-center h-full px-0.5 sm:px-1 cursor-pointer rounded-2xl hover:bg-blue-50/50 transition-colors"
                                     onclick="selectAdminChartDay(${idx})"
                                     tabindex="0"
                                     role="button"
                                     aria-label="${d.tooltip_date_label}: ${d.completed} completed out of ${d.total} total">
                                    
                                    <!-- Hover / Touch Tooltip Popup -->
                                    <div class="absolute bottom-[90%] mb-2 ${tooltipPosClass} opacity-0 pointer-events-none group-hover:opacity-100 group-focus:opacity-100 transition-all duration-200 z-30 transform group-hover:-translate-y-1 group-focus:-translate-y-1 w-48 sm:w-56">
                                        <div class="bg-slate-900/95 backdrop-blur-md text-white p-3 rounded-2xl shadow-2xl border border-slate-700/80 text-xs space-y-1.5">
                                            <div class="flex items-center justify-between pb-1.5 border-b border-slate-700/80">
                                                <div class="text-[11px] font-extrabold text-slate-100 truncate">${d.tooltip_date_label}</div>
                                                ${d.is_today ? `<span class="px-1.5 py-0.2 bg-blue-500 text-white rounded-md text-[9px] font-black uppercase tracking-wider">${todayLabel}</span>` : ''}
                                            </div>
                                            <div class="flex items-center justify-between font-mono text-[11px] pt-0.5">
                                                <span class="text-blue-300 flex items-center gap-1.5">
                                                    <span class="w-2 h-2 rounded-full bg-blue-400"></span>
                                                    ${totalLabel}:
                                                </span>
                                                <span class="font-bold text-white text-xs">${d.total}</span>
                                            </div>
                                            <div class="flex items-center justify-between font-mono text-[11px]">
                                                <span class="text-emerald-300 flex items-center gap-1.5">
                                                    <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
                                                    ${completedLabel}:
                                                </span>
                                                <span class="font-bold text-white text-xs">${d.completed}</span>
                                            </div>
                                            <div class="flex items-center justify-between font-mono text-[11px] pt-1 border-t border-slate-800">
                                                <span class="text-slate-300">${completionLabel}:</span>
                                                <span class="font-black ${d.percentage >= 50 ? 'text-emerald-400' : 'text-slate-200'}">${d.percentage}%</span>
                                            </div>
                                        </div>
                                        <!-- Arrow Pointer -->
                                        <div class="w-2.5 h-2.5 bg-slate-900 rotate-45 absolute -bottom-1 ${arrowPosClass} border-r border-b border-slate-700/80"></div>
                                    </div>

                                    <!-- Grouped Vertical Bars Area (Total & Completed) -->
                                    <div class="w-full h-full flex items-end justify-center gap-1 sm:gap-2 pb-2">
                                        <!-- Total Bar (Blue) -->
                                        <div class="flex flex-col items-center justify-end h-full w-2.5 sm:w-4 lg:w-6" title="${totalLabel}: ${d.total}">
                                            ${d.total > 0 ? `
                                                <span class="text-[9px] font-black text-blue-700 font-mono opacity-0 group-hover:opacity-100 transition-opacity mb-0.5">${d.total}</span>
                                                <div class="w-full bg-gradient-to-t from-blue-700 via-blue-600 to-blue-500 rounded-t-md sm:rounded-t-lg shadow-sm transition-all duration-500 group-hover:brightness-110" style="height: ${totalPct}%;"></div>
                                            ` : `
                                                <div class="w-full max-w-[14px] bg-slate-200 h-[2px] rounded-full"></div>
                                            `}
                                        </div>

                                        <!-- Completed Bar (Teal / Emerald) -->
                                        <div class="flex flex-col items-center justify-end h-full w-2.5 sm:w-4 lg:w-6" title="${completedLabel}: ${d.completed}">
                                            ${d.completed > 0 ? `
                                                <span class="text-[9px] font-black text-emerald-700 font-mono opacity-0 group-hover:opacity-100 transition-opacity mb-0.5">${d.completed}</span>
                                                <div class="w-full bg-gradient-to-t from-teal-700 via-teal-600 to-emerald-500 rounded-t-md sm:rounded-t-lg shadow-sm transition-all duration-500 group-hover:brightness-110" style="height: ${completedPct}%;"></div>
                                            ` : `
                                                <div class="w-full max-w-[14px] bg-slate-200 h-[2px] rounded-full"></div>
                                            `}
                                        </div>
                                    </div>

                                    <!-- Bottom X-Axis Weekday & Date Labels -->
                                    <div class="h-8 flex flex-col items-center justify-center text-center w-full select-none">
                                        <div class="font-extrabold text-[10px] sm:text-xs leading-none ${d.is_today ? 'text-blue-700 font-black' : 'text-slate-800'}">
                                            ${d.weekday_short}
                                        </div>
                                        <div class="font-mono text-[9px] sm:text-[10px] font-semibold leading-tight mt-0.5 ${d.is_today ? 'text-blue-600 font-bold' : 'text-slate-400'}">
                                            <span class="hidden sm:inline">${d.day_padded} ${d.month_short}</span>
                                            <span class="sm:hidden">${d.day_padded}</span>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>

            <!-- Interactive Selected Day Detail Strip (Mobile & Accessibility Support) -->
            <div id="chart-selected-day-strip" class="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span class="font-bold text-slate-800" id="strip-day-title">${chartDays[6].tooltip_date_label}</span>
                    ${chartDays[6].is_today ? `<span class="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[9px] font-extrabold uppercase">${todayLabel}</span>` : ''}
                </div>
                <div class="flex items-center gap-3 font-mono font-bold text-slate-700 text-xs">
                    <span class="text-blue-700">${totalLabel}: <strong class="text-slate-900" id="strip-total">${chartDays[6].total}</strong></span>
                    <span class="text-slate-300">•</span>
                    <span class="text-emerald-700">${completedLabel}: <strong class="text-slate-900" id="strip-completed">${chartDays[6].completed}</strong></span>
                    <span class="text-slate-300">•</span>
                    <span class="${chartDays[6].percentage >= 50 ? 'text-emerald-700 font-black' : 'text-slate-700'}" id="strip-pct">${chartDays[6].percentage}%</span>
                </div>
            </div>
        </div>
    `;
}

/**
 * Helper to dynamically generate the last 7 calendar days chronologically from current date
 */
function getDynamicPast7Days(apiData = []) {
    const apiMap = new Map();
    if (Array.isArray(apiData)) {
        apiData.forEach(item => {
            if (item && item.date) {
                const dateKey = String(item.date).split('T')[0];
                apiMap.set(dateKey, item);
            }
        });
    }

    const shortDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const fullDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const today = new Date();
    const result = [];

    // Chronological order: 6 days ago -> today (i = 6 down to 0)
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        const y = d.getFullYear();
        const m = d.getMonth();
        const dayNum = d.getDate();
        const padMonth = String(m + 1).padStart(2, '0');
        const padDay = String(dayNum).padStart(2, '0');
        const isoKey = `${y}-${padMonth}-${padDay}`;

        const dayOfWeekIndex = d.getDay();
        const shortWeekday = shortDays[dayOfWeekIndex];
        const fullWeekday = fullDays[dayOfWeekIndex];
        const shortMonth = shortMonths[m];

        const matched = apiMap.get(isoKey);
        const total = matched ? (Number(matched.total) || 0) : 0;
        const completed = matched ? (Number(matched.completed) || 0) : 0;
        const inProgress = matched ? (Number(matched.in_progress) || 0) : 0;

        let pct = 0.0;
        if (total > 0) {
            if (matched && typeof matched.percentage === 'number') {
                pct = matched.percentage;
            } else if (matched && matched.percentage) {
                pct = parseFloat(matched.percentage) || 0.0;
            } else {
                pct = Math.round((completed / total) * 1000) / 10;
            }
        }
        if (isNaN(pct) || !isFinite(pct)) {
            pct = 0.0;
        }

        const isToday = (i === 0);

        result.push({
            date: isoKey,
            day: dayNum,
            day_padded: padDay,
            weekday_short: shortWeekday,
            weekday_full: fullWeekday,
            month_short: shortMonth,
            year: y,
            tooltip_date_label: `${fullWeekday}, ${padDay} ${shortMonth} ${y}`,
            is_today: isToday,
            total: total,
            completed: completed,
            in_progress: inProgress,
            percentage: pct
        });
    }

    return result;
}

/**
 * Interactive touch / click day selector
 */
function selectAdminChartDay(idx) {
    if (!window.__adminChartDays || !window.__adminChartDays[idx]) return;
    const d = window.__adminChartDays[idx];

    const titleEl = document.getElementById('strip-day-title');
    const totalEl = document.getElementById('strip-total');
    const compEl = document.getElementById('strip-completed');
    const pctEl = document.getElementById('strip-pct');

    if (titleEl) titleEl.textContent = d.tooltip_date_label;
    if (totalEl) totalEl.textContent = d.total;
    if (compEl) compEl.textContent = d.completed;
    if (pctEl) {
        pctEl.textContent = `${d.percentage}%`;
        pctEl.className = d.percentage >= 50 ? 'text-emerald-700 font-black' : 'text-slate-700 font-bold';
    }
}

/**
 * Pure Frontend 7-Day Activity Report CSV Generator and Downloader
 */
function download7DayReport() {
    const chartDays = window.__adminChartDays || getDynamicPast7Days();
    if (!chartDays || chartDays.length === 0) {
        if (typeof API !== 'undefined' && API.showToast) {
            API.showToast('No activity data available to generate report.', 'warning');
        }
        return;
    }

    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayISO = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const generatedDateStr = `${pad(today.getDate())} ${shortMonths[today.getMonth()]} ${today.getFullYear()}`;

    // Summary calculations from existing frontend chart data
    const sumTotal = chartDays.reduce((acc, d) => acc + (Number(d.total) || 0), 0);
    const sumCompleted = chartDays.reduce((acc, d) => acc + (Number(d.completed) || 0), 0);
    const avgPct = sumTotal > 0 ? (Math.round((sumCompleted / sumTotal) * 1000) / 10).toFixed(1) : '0';

    // CSV Header & Metadata Rows
    const rows = [
        ['DoctorQueue', 'Past 7 Days Activity Report'],
        ['Generated Date', generatedDateStr],
        [],
        ['Date', 'Day', 'Total Appointments', 'Completed Appointments', 'Completion Percentage']
    ];

    // 7-day Activity Rows
    chartDays.forEach(d => {
        const formattedDate = `${d.day_padded} ${d.month_short} ${d.year}`;
        const dayName = d.weekday_full;
        const total = d.total || 0;
        const completed = d.completed || 0;
        const pct = `${d.percentage}%`;
        rows.push([formattedDate, dayName, total, completed, pct]);
    });

    // Summary Rows
    rows.push([]);
    rows.push(['Summary', '']);
    rows.push(['Total Appointments', sumTotal]);
    rows.push(['Total Completed', sumCompleted]);
    rows.push(['Overall Completion', `${avgPct}%`]);

    // Encode to standard CSV format
    const csvContent = rows.map(r => r.map(field => {
        const str = String(field !== undefined && field !== null ? field : '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return `"${str}"`;
    }).join(',')).join('\r\n');

    // Create Blob & Trigger Download in browser
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `doctorqueue_7_day_report_${todayISO}.csv`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Non-intrusive feedback toast
    if (typeof API !== 'undefined' && API.showToast) {
        const toastMsg = typeof I18N !== 'undefined' ? I18N.t('reportDownloaded', '7-Day Activity Report downloaded successfully.') : '7-Day Activity Report downloaded successfully.';
        API.showToast(toastMsg, 'success');
    }
}

let adminActivitiesMap = new Map();

function registerAdminActivities(list) {
    if (!Array.isArray(list)) return;
    list.forEach(a => {
        if (!a) return;
        const key = a.id || `${a.created_at || ''}_${a.action || ''}_${a.user || ''}_${a.entity_id || ''}`;
        adminActivitiesMap.set(key, a);
    });
    window.__adminAllActivities = Array.from(adminActivitiesMap.values());
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
        window.__adminLiveActivities = activities;
        registerAdminActivities(activities);
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
    window.__adminPastActivities = logs;
    registerAdminActivities(logs);

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

/**
 * Pure Frontend "Download All Activities" CSV Generator and Downloader
 */
function downloadAllActivities() {
    let activities = [];
    if (adminActivitiesMap.size > 0) {
        activities = Array.from(adminActivitiesMap.values());
    } else if (window.__adminAllActivities && window.__adminAllActivities.length > 0) {
        activities = window.__adminAllActivities;
    } else if (window.__adminPastActivities && window.__adminPastActivities.length > 0) {
        activities = window.__adminPastActivities;
    } else if (window.__adminLiveActivities && window.__adminLiveActivities.length > 0) {
        activities = window.__adminLiveActivities;
    }

    if (!activities || activities.length === 0) {
        if (typeof API !== 'undefined' && API.showToast) {
            API.showToast('No activity records currently available to download.', 'warning');
        }
        return;
    }

    // Sort chronologically (newest first)
    activities.sort((a, b) => {
        const tA = new Date(a.created_at || 0).getTime();
        const tB = new Date(b.created_at || 0).getTime();
        return tB - tA;
    });

    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const todayISO = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const generatedDateStr = `${pad(today.getDate())} ${shortMonths[today.getMonth()]} ${today.getFullYear()}`;

    // CSV Header & Metadata Rows
    const rows = [
        ['DoctorQueue', 'Past Activities & Historical Audit Trail'],
        ['Generated Date', generatedDateStr],
        ['Total Records', activities.length],
        [],
        ['Date / Time', 'Action', 'Actor / User', 'Role', 'Entity']
    ];

    // Activity Log Rows
    activities.forEach(a => {
        const timeDisplay = a.created_at_full || a.created_at_formatted || a.created_at || '';
        const actionText = a.action_display || formatAction(a.action);
        const user = a.user || 'System';
        const role = a.user_role || 'USER';
        const entity = a.entity_type && a.entity_id ? `${a.entity_type} #${a.entity_id}` : (a.entity_type || '-');

        rows.push([timeDisplay, actionText, user, role, entity]);
    });

    // Encode to standard CSV with proper escaping
    const csvContent = rows.map(r => r.map(field => {
        const str = String(field !== undefined && field !== null ? field : '').trim();
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return `"${str}"`;
    }).join(',')).join('\r\n');

    // Create Blob & Trigger Download in browser
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const filename = `doctorqueue_all_past_activities_${todayISO}.csv`;

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Feedback Toast
    if (typeof API !== 'undefined' && API.showToast) {
        const toastMsg = typeof I18N !== 'undefined' ? I18N.t('activitiesDownloaded', 'All activities report downloaded successfully.') : 'All activities report downloaded successfully.';
        API.showToast(toastMsg, 'success');
    }
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
