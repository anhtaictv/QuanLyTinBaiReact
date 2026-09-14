// Kho tri thức RAG cho module "Tra cứu & Hỏi đáp Dữ liệu Local": lưu chunk văn bản +
// embedding vào 1 file JSON, tìm kiếm bằng cosine similarity thuần JS.
// # ponytail: quét toàn bộ index mỗi lần hỏi (O(n)) — đủ nhanh cho vài trăm/nghìn
// chunk (vài chục văn bản quy định nội bộ). Nếu corpus lớn hơn nhiều, chuyển sang
// vector DB thật (Chroma/FAISS) thay vì scan tuyến tính.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const aiGateway = require('./aiGatewayClient');

const INDEX_PATH = path.join(__dirname, '../data/rag-index.json');
const CHUNK_SIZE = 800;

function loadIndex() {
    try {
        return JSON.parse(fs.readFileSync(INDEX_PATH, 'utf8'));
    } catch {
        return [];
    }
}

function saveIndex(index) {
    fs.mkdirSync(path.dirname(INDEX_PATH), { recursive: true });
    fs.writeFileSync(INDEX_PATH, JSON.stringify(index), 'utf8');
}

// Tách theo đoạn văn (\n\n) rồi gom lại thành các chunk ~CHUNK_SIZE ký tự, không cắt
// ngang câu/đoạn khi có thể.
function chunkText(text) {
    const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
    const chunks = [];
    let current = '';
    for (const p of paragraphs) {
        if (current && (current.length + p.length + 2) > CHUNK_SIZE) {
            chunks.push(current);
            current = p;
        } else {
            current = current ? `${current}\n\n${p}` : p;
        }
    }
    if (current) chunks.push(current);
    return chunks;
}

function cosineSimilarity(a, b) {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// type phân biệt corpus dùng cho việc gì ('style-guide' = cẩm nang tòa soạn nạp tay,
// 'approved-article' = tự động nạp từ bài đã duyệt — xem ingestApprovedArticle).
// sourceId cho phép gọi lại (upsert) đúng 1 nguồn thay vì luôn tạo nguồn mới — dùng khi
// nạp lại nội dung của cùng 1 bài viết mỗi lần duyệt lại.
async function addDocument(title, text, { type = 'style-guide', sourceId } = {}) {
    const finalSourceId = sourceId || crypto.randomUUID();
    const chunks = chunkText(text);
    const index = loadIndex();
    const createdAt = new Date().toISOString();
    for (const chunk of chunks) {
        const embedding = await aiGateway.embed(chunk);
        index.push({ id: crypto.randomUUID(), sourceId: finalSourceId, title, chunk, embedding, createdAt, type });
    }
    saveIndex(index);
    return { sourceId: finalSourceId, chunkCount: chunks.length };
}

// Nạp bài đã duyệt vào corpus fact-check — xóa bản cũ (nếu có) rồi nạp lại, tránh phình
// index vô hạn khi 1 bài được duyệt lại nhiều lần (editor sửa xong duyệt lại...).
async function ingestApprovedArticle(postId, title, text) {
    if (!text || !text.trim()) return { sourceId: `post-${postId}`, chunkCount: 0 };
    const sourceId = `post-${postId}`;
    deleteDocument(sourceId);
    return addDocument(title, text, { type: 'approved-article', sourceId });
}

function listDocuments() {
    const index = loadIndex();
    const bySource = new Map();
    for (const item of index) {
        if (!bySource.has(item.sourceId)) {
            bySource.set(item.sourceId, { sourceId: item.sourceId, title: item.title, createdAt: item.createdAt, chunkCount: 0 });
        }
        bySource.get(item.sourceId).chunkCount += 1;
    }
    return [...bySource.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function deleteDocument(sourceId) {
    const index = loadIndex();
    const remaining = index.filter(item => item.sourceId !== sourceId);
    const removed = index.length - remaining.length;
    saveIndex(remaining);
    return removed;
}

function search(queryEmbedding, topK = 4, { type } = {}) {
    const index = loadIndex();
    return index
        .filter(item => !type || item.type === type)
        .map(item => ({ ...item, score: cosineSimilarity(queryEmbedding, item.embedding) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
}

module.exports = { addDocument, listDocuments, deleteDocument, search, ingestApprovedArticle };
