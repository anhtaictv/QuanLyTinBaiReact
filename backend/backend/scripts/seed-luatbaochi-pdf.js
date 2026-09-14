const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');
const ragStore = require('../services/ragStore');

async function seedLuatBaoChi() {
    try {
        const pdfPath = path.join(__dirname, '../../..', 'luatbaochi.pdf');

        if (!fs.existsSync(pdfPath)) {
            console.error('❌ File không tìm thấy:', pdfPath);
            process.exit(1);
        }

        console.log('📄 Đang extract PDF...');
        const pdfBuffer = fs.readFileSync(pdfPath);
        const data = await pdfParse(pdfBuffer);

        const content = data.text.trim();
        if (!content) {
            console.error('❌ PDF trống hoặc không thể extract text');
            process.exit(1);
        }

        console.log(`✅ Extract thành công: ${content.length} ký tự`);

        // Kiểm tra nếu đã tồn tại, xóa cái cũ
        const sourceId = 'luatbaochi-2016-pdf';
        const existing = ragStore.listDocuments();
        if (existing.some(d => d.sourceId === sourceId)) {
            console.log('🔄 Đang xóa version cũ...');
            ragStore.deleteDocument(sourceId);
        }

        console.log('🔄 Đang nạp vào RAG...');
        const result = ragStore.addDocument(
            'Luật Báo chí 2016 (từ PDF)',
            content,
            { type: 'regulatory' }
        );

        console.log(`✅ Seed thành công!`);
        console.log(`   - Source ID: ${sourceId}`);
        console.log(`   - Title: Luật Báo chí 2016 (từ PDF)`);
        console.log(`   - Chunks: ${result.chunksAdded || '?'}`);

    } catch (err) {
        console.error('❌ Lỗi:', err.message);
        process.exit(1);
    }
}

seedLuatBaoChi();
