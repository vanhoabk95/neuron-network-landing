import { DigitNetHero } from "../components/figures/digit-net/figure";

export default function Home() {
  return (
    <main>
      <section className="hero">
        <DigitNetHero
          intro={
            <header>
              <p className="hero-kicker">Mạng nơ-ron, nhìn từ bên trong</p>
              <h1 className="hero-title">Viết một chữ số. Xem mạng nơ-ron đọc nó.</h1>
              <p className="hero-lede">
                784 điểm ảnh đi qua hai lớp, mỗi lớp 16 nơ-ron, rồi tới 10 lựa chọn. Mỗi nơ-ron chỉ cộng có trọng số rồi bỏ đi phần âm, vậy mà cả mạng nhận ra nét chữ của bạn.
              </p>
            </header>
          }
        />
      </section>
    </main>
  );
}
