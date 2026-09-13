// Cắt văn bản dài thành từng đoạn ngắn trước khi nhờ VoiceStudio trên máy A đọc.
//
// Lý do tồn tại: đo thật 13/09/2026 trên chính gateway này — 37 ký tự mất 6,5 giây còn
// 1.080 ký tự mất 38,9 giây (≈5 giây khởi động + ~31ms/ký tự). Một bài 4.000 ký tự (trần
// của VoiceStudio) vì thế cần ~145 giây cho MỘT lượt gọi, trong khi:
//   - backend cắt request ở 60 giây (AbortSignal.timeout trong aiController.synthesizeSpeech),
//   - IIS/ARR đứng trước Node cắt ở 120 giây (system.webServer/proxy không đặt timeout,
//     mặc định 00:02:00).
// Cả hai đều bắn trước khi máy A kịp trả audio, và cái nào bắn trước cũng ra lỗi mạng chứ
// không phải lỗi nội dung — đó chính là câu "không kết nối AI Gateway" mà người dùng gặp
// dù gateway vẫn sống. Chỗ sửa được mà không phải đụng vào máy A là client: cắt nhỏ rồi
// gọi nhiều lượt, mỗi lượt gọn dưới mọi trần nói trên, sau đó nối audio theo thứ tự.

// 150 ký tự — xấp xỉ MỘT câu. Nghe thì nhỏ, nhưng đo thật trên máy A (GTX 1080) ngày
// 13/09/2026 cho thấy thời gian sinh giọng tăng phi tuyến rất gắt theo độ dài đầu vào:
//   124 ký tự -> 11,4 giây | 157 ký tự -> 39,1 giây | 300 ký tự -> 228 giây
// Tức là gấp đôi độ dài không phải gấp đôi thời gian mà gấp hàng chục lần. Cắt theo câu
// giữ mỗi lượt trong vùng 10-40 giây (an toàn dưới trần 110 giây của backend và 120 giây
// của ARR), còn gộp 2-3 câu là đủ rơi thẳng vào vùng vài phút và hỏng cả bài.
export const SPEECH_CHUNK_CHARS = 150;

// Ưu tiên cắt ở cuối câu (. ! ? … và xuống dòng) để giọng đọc không bị hụt hơi giữa câu.
const SENTENCE_BOUNDARY = /(?<=[.!?…])\s+|\n+/;

// Câu dài hơn cả trần (bảng số liệu dán nguyên khối, văn bản không dấu chấm) vẫn phải đọc
// được: cắt cứng theo độ dài thay vì bỏ qua.
const hardSplit = (piece, maxChars) => {
  const parts = [];
  for (let start = 0; start < piece.length; start += maxChars) {
    parts.push(piece.slice(start, start + maxChars));
  }
  return parts;
};

// Trả về mảng các đoạn văn bản theo đúng thứ tự gốc, không đoạn nào vượt maxChars.
export const splitTextForSpeech = (text, maxChars = SPEECH_CHUNK_CHARS) => {
  const source = String(text || '').trim();
  if (!source) return [];

  const limit = Number(maxChars) > 0 ? Number(maxChars) : SPEECH_CHUNK_CHARS;
  if (source.length <= limit) return [source];

  const pieces = source
    .split(SENTENCE_BOUNDARY)
    .map(piece => piece.trim())
    .filter(Boolean)
    .flatMap(piece => (piece.length > limit ? hardSplit(piece, limit) : piece));

  // Gộp các câu liền nhau lại cho tới sát trần: ít lượt gọi hơn thì tổng thời gian chờ
  // ngắn hơn, vì mỗi lượt đều mất ~5 giây khởi động ở máy A.
  const chunks = [];
  let current = '';
  for (const piece of pieces) {
    const merged = current ? `${current} ${piece}` : piece;
    if (merged.length > limit) {
      if (current) chunks.push(current);
      current = piece;
    } else {
      current = merged;
    }
  }
  if (current) chunks.push(current);

  return chunks;
};
