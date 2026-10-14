/**
 * Shared prescription PDF generator.
 * Used by the patient (own history), receptionist (walk-in patients without an account) and doctor desks.
 * Requires jsPDF (loaded from CDN on the page); falls back to a minimal hand-built PDF if it is unavailable.
 */

const Prescription = (() => {
    const tr = (key, fallback) => (typeof I18N !== 'undefined' ? I18N.t(key, fallback) : fallback);

    /**
     * Fetches the saved consultation for an appointment and downloads it as a PDF.
     * `extra` fills gaps (e.g. doctor name) from data the page already has.
     */
    async function download(appointmentId, extra = {}) {
        if (!appointmentId) return;
        try {
            const res = await API.get(`/consultations/appointment/${appointmentId}/`);
            const data = res.ok && res.data ? Object.assign({}, extra, stripEmpty(res.data)) : null;
            if (!data || !data.prescription_notes) {
                API.showToast(tr('prescriptionNotAvailable', 'Prescription not available yet.'), 'warning');
                return;
            }
            generate(data);
            API.showToast(tr('prescriptionDownloaded', 'Prescription downloaded successfully.'), 'success');
        } catch (err) {
            console.error('[PRESCRIPTION] Error downloading prescription:', err);
            API.showToast(tr('prescriptionFailed', 'Failed to generate prescription PDF.'), 'error');
        }
    }

    function stripEmpty(obj) {
        const out = {};
        Object.entries(obj).forEach(([k, v]) => {
            if (v !== null && v !== undefined && v !== '' && !(k === 'doctor_name' && v === 'Doctor')) out[k] = v;
        });
        return out;
    }

    function vitalsLine(data) {
        const parts = [];
        if (data.patient_age !== null && data.patient_age !== undefined) parts.push(`Age: ${data.patient_age} yrs`);
        if (data.patient_gender) parts.push(`Gender: ${data.patient_gender}`);
        if (data.patient_blood_group) parts.push(`Blood Group: ${data.patient_blood_group}`);
        if (data.patient_weight_kg) parts.push(`Weight: ${data.patient_weight_kg} kg`);
        if (data.patient_height_cm) parts.push(`Height: ${data.patient_height_cm} cm`);
        return parts.join('   |   ');
    }

    function generate(data) {
        const filename = `DoctorQueue_Prescription_${data.token_number || ''}_${data.appointment_id || data.id}.pdf`.replace(/\s+/g, '');

        if (!(window.jspdf && window.jspdf.jsPDF)) {
            downloadPureVectorPdf(data, filename);
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();

        // 1. Header banner
        doc.setFillColor(29, 78, 216);
        doc.rect(0, 0, pageWidth, 28, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.text('DoctorQueue', 15, 12);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text('SmartCare Clinic • Doctor Appointment & Queue Management', 15, 18);
        doc.text('Official Clinical Consultation Record', 15, 23);

        doc.setFillColor(255, 255, 255);
        doc.roundedRect(pageWidth - 55, 8, 40, 12, 2, 2, 'F');
        doc.setTextColor(29, 78, 216);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.text('PRESCRIPTION', pageWidth - 35, 15.5, { align: 'center' });

        // 2. Patient & consultation metadata box
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.4);
        doc.roundedRect(15, 34, pageWidth - 30, 42, 3, 3, 'FD');

        const label = (text, x, y) => {
            doc.setTextColor(100, 116, 139);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text(text, x, y);
        };
        const value = (text, x, y, bold = false, blue = false) => {
            doc.setTextColor(...(blue ? [29, 78, 216] : [15, 23, 42]));
            doc.setFontSize(9);
            doc.setFont('helvetica', bold ? 'bold' : 'normal');
            doc.text(String(text), x, y);
        };

        label('PATIENT NAME:', 20, 42);
        label('CONTACT / PHONE:', 20, 50);
        label('TOKEN NUMBER:', 20, 58);
        label('APPOINTMENT ID:', 20, 66);
        value(data.patient_name || 'N/A', 55, 42, true);
        value(data.patient_phone || 'N/A', 55, 50);
        value(data.token_number || '#--', 55, 58, true, true);
        value(`#${data.appointment_id || data.id || '--'}`, 55, 66);

        const col2X = pageWidth / 2 + 5;
        label('CONSULTING DOCTOR:', col2X, 42);
        label('DEPARTMENT:', col2X, 50);
        label('CONSULTATION DATE:', col2X, 58);
        label('BOOKING TYPE:', col2X, 66);
        value(data.doctor_name || 'N/A', col2X + 42, 42, true);
        value(data.department_name || data.specialization || '', col2X + 42, 50);
        value(data.appointment_date || new Date().toISOString().split('T')[0], col2X + 42, 58);
        value(data.booking_type === 'WALK_IN' ? 'WALK-IN' : (data.booking_type || 'ONLINE'), col2X + 42, 66);

        let currentY = 84;

        const vitals = vitalsLine(data);
        if (vitals) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(51, 65, 85);
            doc.text(vitals, 20, currentY);
            currentY += 8;
        }

        const section = (title, body, fill = [241, 245, 249], stroke = [203, 213, 225], color = [30, 41, 59]) => {
            doc.setFillColor(...fill);
            doc.setDrawColor(...stroke);
            doc.roundedRect(15, currentY, pageWidth - 30, 8, 1.5, 1.5, 'FD');
            doc.setTextColor(...color);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.text(title, 20, currentY + 5.5);
            currentY += 12;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(51, 65, 85);
            const lines = doc.splitTextToSize(body.trim(), pageWidth - 40);
            doc.text(lines, 20, currentY);
            currentY += (lines.length * 4.5) + 8;
        };

        // 3. Chief complaint (what the patient wrote while booking) and clinical notes
        if (data.problem_description && data.problem_description.trim()) {
            section('CHIEF COMPLAINT (AS REPORTED BY PATIENT)', data.problem_description);
        }
        if (data.notes && data.notes.trim()) {
            section('CLINICAL NOTES & OBSERVATIONS', data.notes);
        }

        // 4. Rx
        doc.setFillColor(238, 242, 255);
        doc.setDrawColor(199, 210, 254);
        doc.roundedRect(15, currentY, pageWidth - 30, 9, 1.5, 1.5, 'FD');
        doc.setTextColor(37, 99, 235);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text('Rx — PRESCRIPTION, MEDICATIONS & ADVICE', 20, currentY + 6);
        currentY += 14;

        const rxBoxStartY = currentY - 2;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        const splitRx = doc.splitTextToSize((data.prescription_notes || 'Standard follow-up instructions.').trim(), pageWidth - 44);
        const rxBoxHeight = Math.max(32, (splitRx.length * 5) + 12);
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(15, rxBoxStartY, pageWidth - 30, rxBoxHeight, 2, 2, 'FD');
        doc.text(splitRx, 22, currentY + 5);
        currentY = rxBoxStartY + rxBoxHeight + 14;

        // 5. Signature
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

        // 6. Footer
        doc.setDrawColor(226, 232, 240);
        doc.line(15, pageHeight - 16, pageWidth - 15, pageHeight - 16);
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text('Generated from DoctorQueue Live Core • SmartCare Clinic Management System', 15, pageHeight - 10);
        doc.text(`Doc ID: DQ-RX-${data.appointment_id || data.id || '0'}-${Date.now().toString().slice(-6)}`, pageWidth - 15, pageHeight - 10, { align: 'right' });

        doc.save(filename);
    }

    /** Minimal PDF 1.4 writer used when the jsPDF CDN could not be loaded. */
    function downloadPureVectorPdf(data, filename) {
        const clean = (v, fb = '') => String(v || fb).replace(/[()\\]/g, '').replace(/\r?\n/g, ' ');
        const lines = [
            ['F2', 18, 'DoctorQueue - Medical Prescription'],
            ['F1', 9, 'SmartCare Clinic - Official Consultation Record'],
            ['F1', 10, `Patient: ${clean(data.patient_name, 'Patient')}   Phone: ${clean(data.patient_phone, 'N/A')}`],
            ['F1', 10, clean(vitalsLine(data))],
            ['F1', 10, `Doctor: ${clean(data.doctor_name, 'Doctor')} - ${clean(data.department_name || data.specialization)}`],
            ['F1', 10, `Token: ${clean(data.token_number, 'N/A')}   Date: ${clean(data.appointment_date)}`],
            ['F2', 11, 'Chief complaint:'],
            ['F1', 10, clean(data.problem_description, '-')],
            ['F2', 11, 'Clinical notes:'],
            ['F1', 10, clean(data.notes, '-')],
            ['F2', 11, 'Rx - Prescription & Advice:'],
            ['F1', 10, clean(data.prescription_notes, 'No prescription notes provided.')],
            ['F2', 10, `Doctor Signature: ${clean(data.doctor_name, 'Doctor')}`],
        ];
        let stream = 'BT\n50 790 Td\n';
        lines.forEach(([font, size, text], idx) => {
            stream += `/${font} ${size} Tf\n${idx === 0 ? '' : '0 -18 Td\n'}(${text}) Tj\n`;
        });
        stream += 'ET\n';

        const objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
            `<< /Length ${stream.length} >>\nstream\n${stream}endstream`,
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
        ];
        let pdf = '%PDF-1.4\n';
        const offsets = [];
        objects.forEach((body, i) => {
            offsets.push(pdf.length);
            pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
        });
        const xrefStart = pdf.length;
        pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
        offsets.forEach(off => { pdf += `${String(off).padStart(10, '0')} 00000 n \n`; });
        pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

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

    return { download, generate };
})();
