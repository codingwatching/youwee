# Nhật ký thay đổi

Tất cả thay đổi đáng chú ý của Youwee sẽ được ghi lại trong file này.

Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
và dự án tuân theo [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Thêm mới
- **Theo dõi kênh & Tải tự động** - Theo dõi các kênh YouTube, duyệt video, chọn và tải hàng loạt. Polling nền phát hiện video mới với thông báo desktop. System tray hỗ trợ thu nhỏ khi đóng
- **Cài đặt tải kênh đầy đủ** - Tải từ kênh giờ dùng cùng cài đặt như trang YouTube: chọn codec video (H.264/VP9/AV1/Auto), bitrate âm thanh, phụ đề, nhúng metadata/thumbnail, SponsorBlock, giới hạn tốc độ. Cài đặt đồng bộ từ cấu hình chung
- **Chọn codec thông minh cho độ phân giải cao** - 8K mặc định AV1, 4K/2K mặc định VP9 khi codec đặt Auto. Hiện hộp thoại FFmpeg khi chọn chất lượng cao mà chưa cài FFmpeg
- **Tùy chọn chất lượng 8K** - Tải từ kênh giờ hỗ trợ 8K (4320p), giống trang YouTube
- **Badge video mới theo kênh** - Mỗi kênh đã theo dõi hiện badge đếm số video mới chưa xem
- **Panel kênh theo dõi thu gọn được** - Danh sách kênh bên phải có thể thu gọn/mở rộng bằng nút toggle

### Sửa lỗi
- **Tải kênh bị kẹt ở 1080p khi chọn 4K** - Codec video bị cố định H.264 mà YouTube không có H.264 trên 1080p. Giờ mặc định Auto codec với chuỗi fallback thông minh
- **Dropdown định dạng trống khi mở trang** - Cài đặt từ localStorage có thể là format âm thanh (mp3) trong khi UI hiện các tùy chọn video. Giờ khởi tạo đúng chế độ âm thanh/video từ cài đặt đã lưu

## [0.8.2] - 2026-02-11

### Thêm mới
- **Ghi chú cập nhật đa ngôn ngữ** - Hộp thoại cập nhật hiển thị ghi chú phát hành theo ngôn ngữ người dùng (Tiếng Anh, Tiếng Việt, Tiếng Trung). CI tự động trích xuất nhật ký thay đổi từ các file CHANGELOG theo ngôn ngữ
- **Tùy chọn chất lượng 8K/4K/2K cho Universal** - Dropdown chất lượng giờ có thêm 8K Ultra HD, 4K Ultra HD và 2K QHD, giống như tab YouTube. Tự động chuyển sang chất lượng cao nhất có sẵn nếu nguồn không hỗ trợ
- **Nút bật/tắt "Phát từ đầu" cho Universal** - Nút mới trong Cài đặt nâng cao để ghi live stream từ đầu thay vì từ thời điểm hiện tại. Sử dụng flag `--live-from-start` của yt-dlp
- **Xem trước video cho Universal** - Tự động hiển thị thumbnail, tiêu đề, thời lượng và kênh khi thêm URL từ TikTok, Bilibili, Facebook, Instagram, Twitter và các trang khác. Thumbnail cũng được lưu vào Thư viện
- **Nhận diện nền tảng thông minh hơn** - Thư viện giờ nhận diện và gắn nhãn chính xác hơn 1800 trang web được yt-dlp hỗ trợ (Bilibili, Dailymotion, SoundCloud, v.v.) thay vì hiển thị "Khác". Thêm tab lọc Bilibili

### Sửa lỗi
- **Trang Xử lý bị treo khi upload video (Linux)** - File video được đọc toàn bộ vào RAM qua `readFile()`, gây tràn bộ nhớ và màn hình trắng. Giờ sử dụng giao thức asset của Tauri để stream video trực tiếp mà không cần tải vào bộ nhớ. Thêm Error Boundary để ngăn màn hình trắng, xử lý lỗi video với thông báo cụ thể theo codec, dọn dẹp blob URL chống rò rỉ bộ nhớ, và nhận dạng MIME type đúng cho các định dạng không phải MP4
- **Thumbnail bị lỗi trong Thư viện** - Sửa thumbnail từ các trang như Bilibili sử dụng URL HTTP. Thumbnail giờ hiển thị biểu tượng thay thế khi không tải được
- **Thư viện không làm mới khi chuyển trang** - Thư viện giờ tự động tải dữ liệu mới nhất khi chuyển đến trang thay vì phải làm mới thủ công
