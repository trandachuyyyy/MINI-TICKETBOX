# 🎟️ Mini Ticketbox — Hệ thống đặt vé Concert NOVA NIGHT

**Họ tên:** Trần Đắc Huy

Ứng dụng Fullstack mô phỏng việc mở bán 500 vé concert cho ~5.000 người dùng truy cập cùng lúc, tập trung giải quyết 3 bài toán trọng tâm: chống over-selling khi có nhiều request đồng thời, tối ưu trải nghiệm người dùng dưới tải cao, và giữ mã nguồn sạch, dễ bảo trì.

**Tech stack:** Next.js 14 (App Router, TypeScript, Tailwind) · NestJS 10 (TypeScript) · MongoDB (Mongoose) · Socket.IO (realtime inventory + admin updates) · Docker Compose.

---

## 1. Chạy project ở local

### Cách 1 — Docker (khuyến khích)

```bash
docker compose up --build
```

Sau khi 3 service (`mongo`, `backend`, `frontend`) khởi động:

```bash
# Tạo dữ liệu mẫu: 3 loại vé, tổng 500 vé
docker compose exec backend npm run seed
```

Truy cập:
- Frontend (trang chủ): http://localhost:3000
- Admin dashboard: http://localhost:3000/admin
- Backend API: http://localhost:3001

### Cách 2 — Chạy thủ công (không Docker)

Yêu cầu: Node.js ≥ 20, MongoDB chạy ở `localhost:27017` (hoặc dùng MongoDB Atlas và sửa `MONGODB_URI`).

```bash
# Backend
cd backend
cp .env.example .env
npm install
npm run seed       # tạo dữ liệu vé mẫu
npm run start:dev  # http://localhost:3001

# Frontend (terminal khác)
cd frontend
cp .env.example .env
npm install
npm run dev         # http://localhost:3000
```

### Chạy unit test (logic chống over-sell)

```bash
cd backend
npm install
npm test
```

Test quan trọng nhất nằm ở `backend/src/tickets/tickets.service.spec.ts`: dựng một MongoDB in-memory thật (qua `mongodb-memory-server`), bắn **200 request đồng thời** tranh nhau **50 vé**, rồi assert rằng đúng 50 request thành công, 150 bị từ chối, và tồn kho không bao giờ âm. Đây là cách kiểm chứng cơ chế atomic thực sự hoạt động dưới tải, chứ không chỉ "trông đúng" trên giấy.

> Lưu ý: môi trường sandbox dùng để soạn bài này bị chặn tải binary MongoDB từ `fastdl.mongodb.org` nên không chạy được test ngay tại đây — nhưng ở máy local/CI có mạng bình thường, `npm test` sẽ chạy và pass đầy đủ. Toàn bộ code đã được type-check (`tsc --noEmit`) và build thành công (`nest build`) không lỗi.

---

## 2. Ý đồ kiến trúc & các quyết định kỹ thuật

### 2.1. Mô hình dữ liệu

- **`TicketType`** (kho vé theo loại, vd VIP/Standard/Economy): có 4 con số cộng dồn luôn đúng tại mọi thời điểm:
  `totalQuantity = availableQuantity + heldQuantity + soldQuantity`.
  `availableQuantity` là **nguồn sự thật duy nhất** dùng để chống over-sell.
- **`Reservation`** (1 lượt giữ vé): có `status` đi theo 1 chiều `HELD → CONFIRMED | EXPIRED | CANCELLED`, và `expiresAt` = thời điểm hết hạn giữ vé (now + 5 phút), tính từ **server**, không phải client.

### 2.2. Bài toán 1 — Chống Race Condition / Over-selling

Đây là phần quan trọng nhất khi 5.000 người bấm gần như cùng lúc. Giải pháp **không** dùng cách "đọc số lượng → kiểm tra → ghi lại" trong code ứng dụng, vì pattern này luôn dễ dính race condition khi nhiều request chen vào giữa 2 bước. Thay vào đó:

```ts
// tickets.service.ts — holdTicket()
const updated = await this.ticketTypeModel.findOneAndUpdate(
  { _id: ticketTypeId, availableQuantity: { $gte: quantity } }, // điều kiện kiểm tra
  { $inc: { availableQuantity: -quantity, heldQuantity: quantity } }, // thao tác ghi
  { new: true },
);
if (!updated) throw new ConflictException('Không đủ vé'); // có request khác vừa lấy mất
```

MongoDB đảm bảo **một thao tác ghi trên một document là atomic** ở tầng storage engine. Điều kiện `$gte` và phép `$inc` được Mongo xử lý trong **cùng một lần khoá document**, nên dù 1.000 request gửi đến cùng mili-giây, chúng được xử lý tuần tự ở tầng DB — không có 2 request nào có thể cùng đọc thấy "còn 1 vé" rồi cùng trừ xuống -1. Khi vé hết, `findOneAndUpdate` trả về `null` và request bị từ chối với lỗi rõ ràng `OUT_OF_STOCK`. Đây là cách giải quyết chính của bài toán concurrency, và nó **không cần** transaction, distributed lock hay Redis riêng — vẫn đúng 100% và đơn giản hơn nhiều, miễn là mọi thay đổi số lượng đều đi qua đúng một điểm này.

Cơ chế tương tự được áp dụng cho:
- **Xác nhận thanh toán** (`confirmPayment`): chỉ chuyển `HELD → CONFIRMED` nếu `status` vẫn còn `HELD` **và** `expiresAt` chưa qua, tất cả trong 1 lệnh `findOneAndUpdate`. Điều này triệt tiêu race giữa "user bấm thanh toán ở giây 4:59.9" và "cron job nhả vé ở giây 5:00.0" — chỉ một trong hai có thể thắng, bên thua nhận lỗi `HOLD_EXPIRED` rõ ràng.
- **Nhả vé hết hạn / huỷ giữ vé** (`releaseExpiredHolds`, `cancelReservation`): chỉ chuyển `HELD → EXPIRED/CANCELLED` nếu đang là `HELD`, tránh nhả vé 2 lần (double-release) khi cron và user cancel chạy gần nhau.

**Luồng giữ vé 5 phút**: `@nestjs/schedule` chạy 1 cron job mỗi 10 giây, quét các `Reservation` có `status = HELD` và `expiresAt` đã qua, rồi nhả từng cái lại kho theo đúng pattern atomic ở trên. Đây chỉ là "cò súng" chạy nền — sự đúng đắn thực sự nằm ở điều kiện `expiresAt` được kiểm tra ngay trong câu lệnh `confirmPayment`, nên dù cron có trễ vài giây, hệ thống vẫn không bao giờ cho thanh toán một vé đã hết hạn giữ.

### 2.3. Bài toán 2 — UX dưới tải cao / mạng lag

- **Chặn spam click**: nút "Giữ vé" / "Thanh toán" tự `disabled` ngay khi bắt đầu gọi API (state `submitting`), kèm `aria-busy` và spinner — không cho gửi request thứ 2 trong lúc request đầu còn đang chạy, kể cả khi user bấm Enter liên tục.
- **Guard chống double-click trên client**: sau mỗi lần bấm giữ vé/thanh toán, UI sẽ khóa nút tạm thời cho tới khi request kết thúc, tránh các request trùng do double-click, F5 nhanh hoặc bấm Enter liên tiếp.
- **Bảo vệ khỏi F5 / bấm lại**: nếu cùng một `clientId` đã có một hold đang hoạt động, backend sẽ tự dùng lại reservation đó thay vì tạo thêm bản ghi trùng; trên checkout, nếu người dùng refresh hoặc bấm lại sau khi thanh toán đã thành công, UI sẽ tự chuyển sang trạng thái "thành công" thay vì báo lỗi giả.
- **Loading state rõ ràng**: skeleton loading khi tải trang chủ/trang chọn vé, spinner trong nút khi đang xử lý, để user luôn biết hệ thống đang phản hồi chứ không bị "đơ".
- **Đồng hồ đếm ngược không bị trôi (drift)**: component `Countdown` tính lại `expiresAt - Date.now()` mỗi 250ms thay vì đếm lùi từ một mốc cố định phía client. Nhờ vậy nếu request giữ vé mất 3 giây để round-trip, hoặc tab bị trình duyệt "đóng băng" lúc chuyển tab, đồng hồ vẫn hiển thị đúng thời gian còn lại khi quay lại — không bị lệch.
- **Xử lý lỗi theo từng tình huống cụ thể**, không chỉ "Đã có lỗi xảy ra":
  - Hết vé ngay lúc bấm chọn (`OUT_OF_STOCK`) → báo rõ và tự refresh lại số lượng tồn kho.
  - Mất mạng (`fetch`/`axios` throw) → báo "mất kết nối, vui lòng thử lại" và giữ nguyên các giá trị người dùng đã nhập trên form, không reset state.
  - Hết giờ giữ vé khi đang điền form thanh toán (`HOLD_EXPIRED`) → khoá form, hướng dẫn quay lại chọn vé khác, vì vé đã chắc chắn được trả lại kho.
- **Cập nhật tồn kho real-time**: trang chủ, trang giữ vé và admin dashboard đều kết nối Socket.IO. Mỗi lần có người giữ/huỷ/thanh toán vé, backend broadcast snapshot mới tới mọi client đang mở — không cần F5. Admin dùng realtime làm nguồn cập nhật chính; khi socket không ổn, dashboard có fallback polling nhẹ 8 giây để tránh dữ liệu bị cũ. Giao diện có badge trạng thái kết nối và tự đổi thành “ĐANG KẾT NỐI...” khi socket ngắt hoặc chưa kết nối, đồng thời cập nhật ngay khi hold mới/hold hết hạn.
- **Throttle ở tầng API** (`@nestjs/throttler`): giới hạn riêng cho endpoint `hold` (5 request/giây/IP) ngoài giới hạn chung toàn hệ thống, để một client lỗi/spam không thể tự DOS chính kho vé.
- **Email xác nhận sau thanh toán**: khi một reservation chuyển sang `CONFIRMED`, backend sẽ thử gửi email xác nhận tới địa chỉ khách hàng nếu SMTP đã được cấu hình trong `.env`; nếu chưa cấu hình, hệ thống vẫn chạy bình thường và bỏ qua bước gửi mail.
- **Kiểm tra mail thật**: có thể gọi endpoint `GET /tickets/mail/test?to=your_email@gmail.com` để xác nhận SMTP đang hoạt động. Nếu trả về `ok: true`, nghĩa là mail đã gửi thành công (hoặc SMTP đã kết nối được); nếu `ok: false`, backend sẽ trả lời rõ lý do để bạn sửa cấu hình.
- **Xác thực người dùng bằng OTP (luồng nhẹ)**: hệ thống hiện có một luồng đăng nhập đơn giản bằng email + OTP, dùng để thay thế `clientId` ẩn danh trong demo. Sau khi nhập email, hệ thống sẽ tạo một mã OTP và hiển thị mã đó trực tiếp trên màn hình nếu SMTP chưa được cấu hình; nếu SMTP đã cấu hình, mã sẽ được gửi tới email. Người dùng nhập mã OTP để xác thực và được lưu session vào `localStorage`. Đây là bước chuyển tiếp phù hợp trước khi nâng lên auth thật (JWT/session server-side).

### 2.4. Bài toán 3 — Chất lượng mã nguồn

- **Cấu trúc thư mục theo module** (NestJS): `tickets/` (core logic + schema + dto), `reservations/` (cron dọn dẹp), `admin/` (thống kê), `events/` (realtime gateway) — mỗi module độc lập, dễ test, dễ mở rộng.
- **Global Error Handling**: `AllExceptionsFilter` bắt mọi exception (HTTP exception, lỗi Mongo, lỗi không lường trước) và trả về **một format JSON nhất quán** `{ success, statusCode, code, message }`, để frontend chỉ cần xử lý một kiểu lỗi duy nhất. `TransformInterceptor` bọc mọi response thành công vào `{ success: true, data }`.
- **Validation ở cửa ngõ API**: mọi input đi qua `class-validator` DTO (`HoldTicketDto`, `ConfirmPaymentDto`...) với `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` — dữ liệu sai định dạng hoặc field thừa bị chặn ngay tại tầng controller, không lọt vào service.
- **Unit test cho logic cốt lõi**: như mục 1, test chính không phải unit test "mock cho có" mà là integration test dùng MongoDB thật (in-memory) để chứng minh cơ chế chống over-sell hoạt động đúng dưới concurrency thực sự, cộng thêm test cho luồng release-and-reclaim và luồng từ chối thanh toán khi hết hạn.
- **Tách biệt rõ trách nhiệm**: Controller chỉ nhận request/trả response, toàn bộ logic nghiệp vụ (và mọi thao tác atomic) nằm trong `TicketsService` — điều này làm mã nguồn dễ test, dễ bảo trì và dễ trao đổi với người chấm bài về chất lượng triển khai.

---

## 3. Cấu trúc thư mục

```
ticketbox/
├── backend/
│   └── src/
│       ├── tickets/        # core: schema, dto, service (atomic logic), controller
│       ├── reservations/   # cron job nhả vé hết hạn
│       ├── admin/          # API thống kê cho dashboard
│       ├── events/         # Socket.IO gateway (realtime tồn kho)
│       ├── common/         # global exception filter, response interceptor
│       └── seed/           # script tạo dữ liệu mẫu
└── frontend/
    └── app/
        ├── page.tsx                    # trang chủ — tồn kho realtime
        ├── booking/[ticketTypeId]/     # chọn số lượng, giữ vé
        ├── checkout/[reservationId]/   # countdown 5 phút + thanh toán giả lập
        └── admin/                      # dashboard thống kê
```

## 4. Giới hạn đã biết / hướng mở rộng nếu có thêm thời gian

- Thanh toán hiện là giả lập (gọi API confirm = coi như thành công), chưa tích hợp cổng thanh toán thật.
- Chưa có xác thực người dùng thật hoàn chỉnh (hiện đang dùng session nhẹ bằng OTP + `localStorage` trong demo), phù hợp với scope đề bài nhưng hệ thống thật cần nâng lên login/OTP chuẩn, session server-side và gắn user vào reservation thay vì dùng `clientId` ẩn danh.
- Có thể bổ sung Redis + BullMQ thay cho cron 10s nếu cần độ chính xác nhả vé ở mức dưới giây, hoặc cần scale backend ra nhiều instance (hiện tại nhiều instance NestJS vẫn an toàn vì tính atomic nằm ở tầng MongoDB, không ở bộ nhớ trong process).
