---
name: dak-lak-news
description: Tìm tin tức mới về Đắk Lắk/Buôn Ma Thuột qua tìm kiếm web, rút gọn, lọc trùng, xuất ra bản "tổng hợp tin địa phương" để biên tập tham khảo/dán vào hệ thống. Dùng khi người dùng yêu cầu tìm/gom/tổng hợp tin Đắk Lắk, hoặc gọi /dak-lak-news.
---

# Tổng hợp tin địa phương Đắk Lắk

Skill này dùng khi cần một bản quét tin THỦ CÔNG, ngoài lịch tự động của hệ thống — ví dụ
biên tập muốn có ngay tin trong vài phút qua, hoặc muốn quét rộng hơn phạm vi các nguồn cố
định. Kết quả là văn bản để đọc/dán, KHÔNG tự ghi vào database.

> Lưu ý: mục "Tổng hợp tin địa phương" trong app (`backend/utils/newsDigestFetcher.js`) đã
> tự động gom tin theo lịch (RSS báo lớn + Google Tin tức, lọc trùng, rút gọn). Chỉ chạy skill
> này cho nhu cầu tra cứu tại chỗ, không phải để thay thế pipeline tự động đó.

## Quy trình

1. **Tìm kiếm** bằng tool WebSearch (không cào trực tiếp HTML trang kết quả google.com.vn —
   dễ vỡ, có thể vi phạm điều khoản dùng của Google; WebSearch/Google Tin tức RSS là cách
   chính thức tương đương). Chạy vài truy vấn để phủ rộng, ví dụ:
   - `tin tức Đắk Lắk mới nhất`
   - `Buôn Ma Thuột hôm nay`
   - Nếu người dùng cho từ khoá/chủ đề cụ thể (vd "giá cà phê", "sạt lở", "giao thông"), thêm
     truy vấn riêng cho chủ đề đó kèm "Đắk Lắk".
2. **Chọn tin liên quan thật** — bỏ kết quả chỉ nhắc tên Đắk Lắk/Buôn Ma Thuột một cách tình
   cờ (vd bài tổng hợp giá cà phê toàn quốc chỉ liệt bảng giá), giữ tin thực sự về địa bàn này.
3. **Lọc trùng** — nhiều báo đăng lại nguyên văn tin TTXVN, hoặc cùng 1 sự kiện được nhiều báo
   viết. So theo tiêu đề đã chuẩn hoá (bỏ dấu, viết thường, bỏ dấu câu) và theo nội dung chính:
   nếu 2 kết quả cùng một sự kiện/tiêu đề, **chỉ giữ 1** — ưu tiên giữ bản của nguồn gốc/uy tín
   hơn (báo lớn, TTXVN, cơ quan nhà nước) thay vì bản đăng lại.
4. **Rút gọn** — với mỗi tin giữ lại, viết tóm tắt 2-3 câu tiếng Việt (không chép nguyên văn cả
   đoạn dài), đủ để biên tập hiểu nội dung chính mà không cần bấm vào link.
5. **Xuất kết quả** theo đúng format bảng dưới, mới nhất trước, để nhất quán với dữ liệu trong
   bảng `NewsDigestItems` của hệ thống (Title/SourceName/Summary/Link/PublishedAt):

   ```
   ### <Tiêu đề>
   Nguồn: <Tên báo/đài>  |  Ngày: <dd/mm/yyyy nếu có>
   Tóm tắt: <2-3 câu>
   Link: <url>
   ```

6. Nếu không tìm được tin nào liên quan, nói rõ "không có tin mới" — không bịa tin.

## Không làm

- Không tự ý gọi API/route của app hoặc sửa database — skill này chỉ tạo văn bản tham khảo.
- Không suy diễn nội dung bài báo khi chưa đọc được (WebSearch chỉ cho snippet ngắn) — nếu
  cần chắc chắn nội dung trước khi tóm tắt, dùng WebFetch mở link gốc.
