// Chạy 1 lần (an toàn chạy lại nhiều lần — xóa-rồi-nạp-lại theo sourceId cố định, không
// phình index): nạp sẵn vài tài liệu nền cho kho tri thức RAG (Module 4 + Fact-check/
// Consistency checker), vì trước đó kho này trống hoàn toàn.
//
// QUAN TRỌNG: nội dung "Luật Báo chí 2016" và "10 điều đạo đức nghề nghiệp" dưới đây là
// TÓM TẮT/DIỄN GIẢI dựa trên hiểu biết chung, KHÔNG PHẢI trích dẫn nguyên văn đã đối chiếu
// với văn bản gốc — số điều/khoản cụ thể có thể không chính xác 100%. Biên tập viên cần
// tự đối chiếu thuvienphapluat.vn / trang Hội Nhà báo Việt Nam trước khi dùng để trích dẫn
// pháp lý chính thức. Mục đích ở đây là cho AI có NGỮ CẢNH CHUNG để rà soát bài viết, không
// thay thế việc tra cứu văn bản gốc. Khi tòa soạn có văn bản chính thức, THAY THẾ nội dung
// này bằng cách sửa DOCS bên dưới rồi chạy lại script.
const ragStore = require('../services/ragStore');

// 102 xã/phường Đắk Lắk (sau sáp nhập với Phú Yên, hiệu lực 01/07/2025 theo Nghị quyết
// 1660/NQ-UBTVQH15) — lấy đúng danh sách đã dùng ở utils/newsDigestFetcher.js, không tự
// bịa thêm.
const DAKLAK_WARDS = [
    'Hòa Phú', 'Ea Drông', 'Ea Súp', 'Ea Rốk', 'Ea Bung', 'Ea Wer', 'Ea Nuôl', 'Ea Kiết',
    "Ea M'Droh", 'Quảng Phú', 'Cuôr Đăng', "Cư M'gar", 'Ea Tul', 'Pơng Drang', 'Krông Búk',
    'Cư Pơng', 'Ea Khăl', 'Ea Drăng', 'Ea Wy', 'Ea Hiao', 'Krông Năng', 'Dliê Ya', 'Tam Giang',
    'Phú Xuân', 'Krông Pắc', 'Ea Knuếc', 'Tân Tiến', 'Ea Phê', 'Ea Kly', 'Ea Kar', 'Ea Ô',
    'Ea Knốp', 'Cư Yang', 'Ea Păl', "M'Drắk", 'Ea Riêng', "Cư M'ta", 'Krông Á', 'Cư Prao',
    'Hòa Sơn', 'Dang Kang', 'Krông Bông', 'Yang Mao', 'Cư Pui', 'Liên Sơn Lắk', 'Đắk Liêng',
    'Nam Ka', 'Đắk Phơi', 'Ea Ning', 'Dray Bhăng', 'Ea Ktur', 'Krông Ana', 'Dur Kmăl', 'Ea Na',
    'Xuân Thọ', 'Xuân Cảnh', 'Xuân Lộc', 'Hòa Xuân', 'Tuy An Bắc', 'Tuy An Đông', 'Ô Loan',
    'Tuy An Nam', 'Tuy An Tây', 'Phú Hòa 1', 'Phú Hòa 2', 'Tây Hòa', 'Hòa Thịnh', 'Hòa Mỹ',
    'Sơn Thành', 'Sơn Hòa', 'Vân Hòa', 'Tây Sơn', 'Suối Trai', 'Ea Ly', 'Ea Bá', 'Đức Bình',
    'Sông Hinh', 'Xuân Lãnh', 'Phú Mỡ', 'Xuân Phước', 'Đồng Xuân', 'Buôn Đôn', "Ea H'Leo",
    'Ea Trang', 'Ia Lốp', 'Ia Rvê', 'Krông Nô', 'Vụ Bổn',
    'Buôn Ma Thuột', 'Tân An', 'Tân Lập', 'Thành Nhất', 'Ea Kao', 'Buôn Hồ', 'Cư Bao',
    'Phú Yên', 'Tuy Hòa', 'Bình Kiến', 'Xuân Đài', 'Sông Cầu', 'Đông Hòa', 'Hòa Hiệp',
];

const DOCS = [
    {
        sourceId: 'style-guide-diadanh-daklak',
        title: 'Danh mục địa danh Đắk Lắk (sau sáp nhập, hiệu lực 01/07/2025)',
        content:
            'Tỉnh Đắk Lắk (sau sáp nhập với tỉnh Phú Yên theo Nghị quyết 1660/NQ-UBTVQH15, ' +
            'hiệu lực từ 01/07/2025) có các đơn vị hành chính cấp xã/phường sau. Khi biên tập, ' +
            'đối chiếu đúng tên gọi và cách viết hoa/dấu câu theo danh sách này, tránh viết sai ' +
            'chính tả địa danh hoặc dùng tên đơn vị hành chính cũ đã sáp nhập:\n\n' +
            DAKLAK_WARDS.join(', ') + '.\n\n' +
            'Lưu ý: một số tên trùng với đơn vị hành chính ở tỉnh khác (ví dụ Quảng Phú, Tân An, ' +
            'Sông Cầu) — cần đọc theo ngữ cảnh bài viết để xác nhận đúng là địa danh Đắk Lắk.',
    },
    {
        sourceId: 'style-guide-luat-bao-chi-2016',
        title: 'Luật Báo chí 2016 — tóm tắt điểm chính (THAM KHẢO, cần đối chiếu văn bản gốc)',
        content:
            '[Đây là bản tóm tắt/diễn giải dựa trên hiểu biết chung, chưa đối chiếu số điều/khoản ' +
            'chính xác với văn bản gốc — không dùng để trích dẫn pháp lý chính thức, chỉ dùng làm ' +
            'ngữ cảnh rà soát chung.]\n\n' +
            'Luật Báo chí năm 2016 (Luật số 103/2016/QH13, hiệu lực từ 01/01/2017) quy định một số ' +
            'nội dung biên tập cần lưu ý:\n\n' +
            '- Nghiêm cấm đăng, phát thông tin sai sự thật, xuyên tạc, vu khống, xúc phạm uy tín cơ ' +
            'quan/tổ chức, danh dự và nhân phẩm cá nhân.\n' +
            '- Nghiêm cấm tiết lộ bí mật đời tư cá nhân, bí mật gia đình khi chưa được người liên ' +
            'quan đồng ý, trừ trường hợp pháp luật có quy định khác.\n' +
            '- Nghiêm cấm tiết lộ bí mật nhà nước, bí mật quân sự, an ninh, kinh tế, đối ngoại theo ' +
            'quy định pháp luật về bảo vệ bí mật nhà nước.\n' +
            '- Không nêu tên, địa chỉ, hình ảnh, thông tin đời tư của trẻ em khi chưa có sự đồng ý ' +
            'của cha mẹ hoặc người giám hộ, trừ trường hợp pháp luật cho phép; cần đặc biệt thận ' +
            'trọng khi trẻ em là nạn nhân hoặc liên quan vụ án.\n' +
            '- Thận trọng khi đăng tải thông tin nhận diện nạn nhân trong các vụ án, đặc biệt vụ ' +
            'xâm hại tình dục hoặc bạo lực gia đình.\n' +
            '- Báo chí, nhà báo có quyền và nghĩa vụ bảo vệ bí mật nguồn tin; chỉ được yêu cầu tiết ' +
            'lộ trong trường hợp có văn bản của cơ quan tố tụng cấp tỉnh trở lên khi thật cần thiết ' +
            'cho điều tra, truy tố, xét xử.\n' +
            '- Khi đăng, phát thông tin sai sự thật gây ảnh hưởng đến tổ chức/cá nhân, cơ quan báo ' +
            'chí phải đăng, phát cải chính, xin lỗi trên chính ấn phẩm/kênh đã đăng tin sai, đồng ' +
            'thời gửi cải chính tới bên bị ảnh hưởng.\n' +
            '- Tổ chức, cá nhân bị nêu thông tin sai sự thật có quyền yêu cầu cơ quan báo chí đăng, ' +
            'phát lời phản hồi/trả lời.\n' +
            '- Nhà báo tác nghiệp đúng pháp luật được nhà nước bảo hộ; không ai được đe dọa, cản ' +
            'trở, thu giữ phương tiện tác nghiệp trái luật.',
    },
    {
        sourceId: 'style-guide-dao-duc-nghe-bao',
        title: '10 điều Quy định đạo đức nghề nghiệp người làm báo Việt Nam (tóm tắt tham khảo)',
        content:
            '[Tóm tắt/diễn giải theo tinh thần 10 điều quy định đạo đức nghề nghiệp người làm báo ' +
            'Việt Nam do Hội Nhà báo Việt Nam ban hành — chưa đối chiếu nguyên văn chính thức, cần ' +
            'kiểm tra lại wording chính xác khi cần trích dẫn.]\n\n' +
            '1. Trung thành với sự nghiệp xây dựng và bảo vệ Tổ quốc, vì lợi ích đất nước và nhân dân.\n' +
            '2. Nghiêm chỉnh thực hiện Hiến pháp, pháp luật và các quy định của cơ quan, tổ chức.\n' +
            '3. Hành nghề trung thực, khách quan, công tâm, không vụ lợi; không xuyên tạc, che giấu ' +
            'sự thật, gây chia rẽ, kích động xã hội.\n' +
            '4. Nêu cao tinh thần nhân văn, tôn trọng quyền con người; không xâm phạm đời tư, làm ' +
            'tổn hại danh dự, nhân phẩm, lợi ích hợp pháp của tổ chức và cá nhân.\n' +
            '5. Chuẩn mực và trách nhiệm khi tham gia mạng xã hội và các phương tiện truyền thông khác.\n' +
            '6. Bảo vệ bí mật quốc gia, bí mật nguồn tin theo quy định pháp luật.\n' +
            '7. Đoàn kết, giúp đỡ đồng nghiệp; không lợi dụng cạnh tranh để nói xấu, làm tổn hại uy ' +
            'tín đồng nghiệp hoặc cơ quan báo chí khác.\n' +
            '8. Tích cực học tập, nâng cao trình độ chính trị, nghiệp vụ, ngoại ngữ.\n' +
            '9. Giữ gìn sự trong sáng của tiếng Việt, bảo vệ và phát huy các giá trị văn hóa Việt Nam.\n' +
            '10. Cam kết thực hiện những quy định trên như bổn phận và lương tâm nghề nghiệp của ' +
            'người làm báo.',
    },
    {
        sourceId: 'regulatory-luat-hinh-su-2015',
        title: 'Bộ Luật Hình sự 2015 — nguyên tắc chung (tóm tắt tham khảo)',
        content:
            '[Tóm tắt/diễn giải dựa trên Bộ Luật Hình sự 2015 — chưa đối chiếu nguyên văn chính xác, ' +
            'cần kiểm tra thực tế với văn bản gốc trước khi trích dẫn.]\n\n' +
            'Bộ Luật Hình sự năm 2015 (Luật số 100/2015/QH13, hiệu lực từ 01/01/2018) quy định:\n\n' +
            '- Nguyên tắc hợp pháp: không ai bị truy cứu trách nhiệm hình sự nếu hành vi không được ' +
            'quy định là tội phạm trong luật hình sự.\n' +
            '- Nguyên tắc bình đẳng: mọi người bằng nhau trước pháp luật hình sự; không ai được ' +
            'phân biệt đối xử.\n' +
            '- Nguyên tắc có lỗi: chỉ những ai có lỗi mới bị truy cứu trách nhiệm hình sự (lỗi ' +
            'cố ý hoặc lỗi vô ý).\n' +
            '- Bảo vệ nhân quyền: việc áp dụng luật hình sự phải tôn trọng nhân quyền, quyền con người.\n' +
            '- Nhân đạo: thực thi các biện pháp trực buộc phải phù hợp với tính chất, mức độ nguy hiểm ' +
            'của tội phạm.\n' +
            '- Công khai, dân chủ: việc điều tra, truy tố, xét xử phải công khai, dân chủ, đúng thủ tục.\n' +
            '- Căn cứ để truy cứu trách nhiệm hình sự: hành vi phạm tội, hành vi nguy hiểm cho xã hội, ' +
            'sự cần thiết của biện pháp xử lý.\n' +
            '- Các loại tội phạm: tội phạm về trật tự an toàn xã hội, tài sản, tính mạng và sức khỏe, ' +
            'quyền con người, hoạt động kinh tế, công vụ, v.v.',
    },
    {
        sourceId: 'regulatory-luat-dan-su-2015',
        title: 'Bộ Luật Dân sự 2015 — nguyên tắc và giao dịch dân sự (tóm tắt tham khảo)',
        content:
            '[Tóm tắt/diễn giải dựa trên Bộ Luật Dân sự 2015 — chưa đối chiếu nguyên văn chính xác, ' +
            'cần kiểm tra thực tế với văn bản gốc trước khi sử dụng cho mục đích pháp lý.]\n\n' +
            'Bộ Luật Dân sự năm 2015 (Luật số 91/2015/QH13, hiệu lực từ 01/01/2017) quy định:\n\n' +
            '- Đối tượng điều chỉnh: các quan hệ dân sự (hợp đồng, thừa kế, hôn nhân gia đình, ' +
            'quyền sở hữu, v.v.).\n' +
            '- Nguyên tắc bình đẳng: mọi cá nhân, tổ chức đều bình đẳng trong các quan hệ dân sự.\n' +
            '- Tự do hợp đồng: các bên tự do lập, thay đổi, chấm dứt hợp đồng (trừ những điểm ' +
            'pháp luật quy định bắt buộc).\n' +
            '- Bảo vệ quyền lợi hợp pháp: nhà nước bảo vệ quyền lợi hợp pháp của công dân, tổ chức.\n' +
            '- Nguyên tắc lành mạnh: giao dịch dân sự phải tuân theo quy tắc ứng xử lành mạnh.\n' +
            '- Bảo vệ danh dự, nhân phẩm: nghiêm cấm xâm phạm danh dự, nhân phẩm, quyền riêng tư.\n' +
            '- Quyền sở hữu tài sản: cá nhân, tổ chức có quyền sở hữu, sử dụng, xử lý tài sản theo ' +
            'pháp luật.\n' +
            '- Hợp đồng hôn nhân: hai bên có quyền lựa chọn bằng cấp tài sản (chung hoặc riêng từng người).\n' +
            '- Quyền thừa kế: quyền thừa kế tài sản của người khai tử theo di chúc hoặc luật định.\n' +
            '- Chính sách bảo vệ người tiêu dùng, người lao động theo đặc thù từng loại giao dịch.',
    },
];

(async () => {
    for (const doc of DOCS) {
        console.log(`Đang nạp lại: ${doc.title} (sourceId=${doc.sourceId})...`);
        await ragStore.deleteDocument(doc.sourceId);
        const result = await ragStore.addDocument(doc.title, doc.content, { type: 'style-guide', sourceId: doc.sourceId });
        console.log(`  → OK, ${result.chunkCount} đoạn.`);
    }
    console.log('Hoàn tất nạp kho tri thức RAG.');
    process.exit(0);
})().catch(err => {
    console.error('Lỗi nạp kho tri thức RAG:', err.message);
    process.exit(1);
});
