// Text extraction module for PDF, DOCX, and plain text files
// Uses pdf.js (Mozilla) and mammoth.js for client-side extraction

const TextExtractor = (() => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
    const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc', '.txt'];
    const ALLOWED_MIMES = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'text/plain',
    ];

    /**
     * Validate file before extraction
     * @param {File} file
     * @returns {{ valid: boolean, error?: string }}
     */
    function validateFile(file) {
        if (!file) {
            return { valid: false, error: 'Файл не выбран' };
        }

        if (file.size > MAX_FILE_SIZE) {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            return { valid: false, error: `Файл слишком большой (${sizeMB} МБ). Максимум: 10 МБ` };
        }

        const ext = getFileExtension(file.name);
        const mimeOk = ALLOWED_MIMES.includes(file.type);
        const extOk = ALLOWED_EXTENSIONS.includes(ext);

        if (!mimeOk && !extOk) {
            return { valid: false, error: `Неподдерживаемый формат. Допустимы: PDF, DOCX, TXT` };
        }

        return { valid: true };
    }

    /**
     * Determine file format from extension
     * @param {File} file
     * @returns {string} 'pdf' | 'docx' | 'txt' | 'unknown'
     */
    function getFileFormat(file) {
        const ext = getFileExtension(file.name);
        if (ext === '.pdf') return 'pdf';
        if (ext === '.docx' || ext === '.doc') return 'docx';
        if (ext === '.txt') return 'txt';

        // Fallback to MIME type
        if (file.type === 'application/pdf') return 'pdf';
        if (file.type.includes('wordprocessingml') || file.type === 'application/msword') return 'docx';
        if (file.type === 'text/plain') return 'txt';

        return 'unknown';
    }

    /**
     * Extract text from a file (PDF, DOCX, or TXT)
     * @param {File} file
     * @returns {Promise<{ text: string, pages: number, format: string }>}
     */
    async function extractFromFile(file) {
        const validation = validateFile(file);
        if (!validation.valid) {
            throw new Error(validation.error);
        }

        const format = getFileFormat(file);
        const arrayBuffer = await file.arrayBuffer();

        switch (format) {
            case 'pdf':
                return extractFromPDF(arrayBuffer);
            case 'docx':
                return extractFromDOCX(arrayBuffer);
            case 'txt':
                return extractFromTXT(arrayBuffer);
            default:
                throw new Error('Неподдерживаемый формат файла');
        }
    }

    /**
     * Extract text from PDF using pdf.js
     * @param {ArrayBuffer} arrayBuffer
     * @returns {Promise<{ text: string, pages: number, format: string }>}
     */
    async function extractFromPDF(arrayBuffer) {
        if (!window.pdfjsLib) {
            throw new Error('pdf.js не загружен. Обновите страницу.');
        }

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const textParts = [];

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            const pageText = content.items.map(item => item.str).join(' ');
            textParts.push(pageText);
        }

        return {
            text: textParts.join('\n\n'),
            pages: pdf.numPages,
            format: 'pdf',
        };
    }

    /**
     * Extract text from DOCX using mammoth.js
     * @param {ArrayBuffer} arrayBuffer
     * @returns {Promise<{ text: string, pages: number, format: string }>}
     */
    async function extractFromDOCX(arrayBuffer) {
        if (!window.mammoth) {
            throw new Error('mammoth.js не загружен. Обновите страницу.');
        }

        const result = await mammoth.extractRawText({ arrayBuffer });
        const text = result.value;
        // Approximate page count (~3000 chars per page)
        const pages = Math.ceil(text.length / 3000);

        return { text, pages, format: 'docx' };
    }

    /**
     * Extract text from plain text file
     * @param {ArrayBuffer} arrayBuffer
     * @returns {Promise<{ text: string, pages: number, format: string }>}
     */
    async function extractFromTXT(arrayBuffer) {
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(arrayBuffer);
        const pages = Math.ceil(text.length / 3000);

        return { text, pages, format: 'txt' };
    }

    // --- Helpers ---
    function getFileExtension(filename) {
        const idx = filename.lastIndexOf('.');
        return idx >= 0 ? filename.substring(idx).toLowerCase() : '';
    }

    return {
        extractFromFile,
        extractFromPDF,
        extractFromDOCX,
        validateFile,
        getFileFormat,
    };
})();
