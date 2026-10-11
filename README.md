# neuron-network-landing

Phần đầu (hero) cho landing page: viết một chữ số và xem một mạng nơ-ron thật đọc nó, từng lớp một.

Mạng 784 → 16 → 16 → 10 được huấn luyện trên MNIST và chạy ngay trong trình duyệt (trọng số int8, 17,5 KB), đọc đúng 95,8 % trên 10 000 ảnh test. Hình minh hoạ là một bàn thí nghiệm isometric: màn cảm biến 28 × 28, ba giá nơ-ron nối bằng 432 dây, và màn kết quả LED 7 đoạn. Mọi con số trên hình đều do chính mô hình tính.

## Chạy

```sh
cd landing
npm install
npm run dev        # http://localhost:3000
```

Sáng/tối tự theo cài đặt hệ thống.

## Dùng trong landing page khác

Chép `landing/components/iso/` và `landing/components/figures/digit-net/`, import `components/iso/iso.css`, đặt `className="iso"` và script theme như trong `landing/app/layout.tsx`, rồi dùng:

```tsx
<DigitNetHero intro={<header>…</header>} />
```

## Huấn luyện lại

Cần Python 3 + numpy và Node 22+.

```sh
training/fetch_mnist.sh
python3 training/train.py      # khoảng 1 phút, in độ chính xác test
python3 training/export.py     # ghi landing/components/figures/digit-net/weights.json
node training/parity.mjs       # model trong trình duyệt phải khớp numpy và đọc đúng 10 nét mẫu
```

## Cấu trúc

- `landing/components/figures/digit-net/model.ts`: forward pass và chuyển nét bút thành ảnh 28 × 28 kiểu MNIST
- `landing/components/figures/digit-net/view.ts`, `geometry.ts`: bố cục và hình học của bàn (camera, giá, màn)
- `landing/components/figures/digit-net/art.tsx`: phần hình tĩnh (server component)
- `landing/components/figures/digit-net/live.tsx`: bàn vẽ, vòng lặp chuyển động, tour, hover xem trọng số
- `landing/components/iso/`: bộ kit vẽ isometric (từ skill anatomy)
- `training/`: huấn luyện, lượng tử hoá, kiểm tra parity
