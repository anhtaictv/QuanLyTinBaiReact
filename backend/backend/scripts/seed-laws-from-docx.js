const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const ragStore = require('../services/ragStore');

const LAWS = [
    {
        file: '91_2015_QH13_296215.docx',
        sourceId: 'regulatory-luat-dan-su-2015',
        title: 'Bộ Luật Dân sự 2015 (Luật số 91/2015/QH13)',
        type: 'regulatory'
    },
    {
        file: '100_2015_QH13_296661.docx',
        sourceId: 'regulatory-luat-hinh-su-2015',
        title: 'Bộ Luật Hình sự 2015 (Luật số 100/2015/QH13)',
        type: 'regulatory'
    },
    {
        file: '103_2016_QH13_280645.docx',
        sourceId: 'regulatory-luat-bao-chi-2016',
        title: 'Luật Báo chí 2016 (Luật số 103/2016/QH13)',
        type: 'regulatory'
    }
];

async function extractAndSeed() {
    try {
        for (const law of LAWS) {
            const docPath = path.join(__dirname, '../../..', law.file);

            if (!fs.existsSync(docPath)) {
                console.warn(`⚠️  File không tìm thấy: ${law.file}`);
                continue;
            }

            console.log(`\n📄 Đang extract: ${law.file}...`);
            const docBuffer = fs.readFileSync(docPath);
            const result = await mammoth.extractRawText({ buffer: docBuffer });

            const content = result.value.trim();
            if (!content) {
                console.warn(`⚠️  ${law.file}: không extract được text`);
                continue;
            }

            console.log(`✅ Extract thành công: ${content.length} ký tự`);

            // Xóa cái cũ nếu tồn tại
            const existing = ragStore.listDocuments();
            if (existing.some(d => d.sourceId === law.sourceId)) {
                console.log(`🔄 Xóa version cũ của ${law.sourceId}...`);
                ragStore.deleteDocument(law.sourceId);
            }

            // Thêm vào RAG
            console.log(`🔄 Đang nạp vào RAG...`);
            const addResult = ragStore.addDocument(
                law.title,
                content,
                { type: law.type }
            );

            console.log(`✅ Seed thành công!`);
            console.log(`   - Source ID: ${law.sourceId}`);
            console.log(`   - Chunks: ${addResult.chunkCount || '?'}`);
        }

        console.log('\n✅ Hoàn tất nạp các bộ luật vào RAG');
    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        process.exit(1);
    }
}

extractAndSeed();
