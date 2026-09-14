// Nén nội dung tin nhắn dài trước khi lưu DB, giải nén khi đọc ra.
// Tin nhắn ngắn (đa số chat thường ngày) không nén: overhead gzip header (~20 byte)
// khiến chuỗi ngắn nén xong còn to hơn bản gốc, nên chỉ nén khi thực sự có lợi.
const zlib = require('zlib');

const COMPRESS_THRESHOLD_BYTES = 200;

// Trả về { content, contentBin, isCompressed } để ghi vào 3 cột Content/ContentBin/IsCompressed.
function packContent(content) {
    if (content == null) return { content: null, contentBin: null, isCompressed: false };

    const buf = Buffer.from(content, 'utf8');
    if (buf.length < COMPRESS_THRESHOLD_BYTES) {
        return { content, contentBin: null, isCompressed: false };
    }

    const gz = zlib.gzipSync(buf);
    if (gz.length < buf.length) {
        return { content: null, contentBin: gz, isCompressed: true };
    }
    return { content, contentBin: null, isCompressed: false };
}

// Nhận 1 row có Content/ContentBin/IsCompressed, trả về row với Content đã giải nén (đã bỏ ContentBin).
function unpackContent(row) {
    if (!row) return row;
    if (row.IsCompressed && row.ContentBin) {
        row.Content = zlib.gunzipSync(row.ContentBin).toString('utf8');
    }
    delete row.ContentBin;
    return row;
}

module.exports = { packContent, unpackContent, COMPRESS_THRESHOLD_BYTES };
