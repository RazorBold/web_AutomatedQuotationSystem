# Design — Agusta Quotation Portal

Sumber kebenaran lengkap untuk aturan UI ada di skill `.claude/skills/agusta-ui/SKILL.md`. Ringkasan keputusan:

- **World:** kelanjutan katalog agusta.co.id — putih, foto produk di atas putih, merah Agusta `#D6202A` untuk aksi utama, biru katalog `#2459D8` untuk kategori/tautan/seleksi, navy logo `#1D2A6E` untuk kop dokumen.
- **Type:** Plus Jakarta Sans, skala tetap 12–30px, angka tabular.
- **Layout:** sidebar putih + hero merah `#C41C25` di atas setiap halaman (judul, aksi, angka ringkasan, garis emblem bola) + kartu putih bershadow lembut yang naik menimpa tepi hero; layar kerja dua kolom dengan ringkasan sticky.
- **Hal yang diingat:** dokumen penawaran itu sendiri — pratinjau surat ber-kop Agusta yang tampil seperti kertas A4 asli, dan baris margin per item di layar review Sales Support.
- **Motion:** hanya perubahan state, 150–220ms, hormati reduced-motion.
- **Tokens:** didefinisikan di `src/index.css` (`@theme`).
