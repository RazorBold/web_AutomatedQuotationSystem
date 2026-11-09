---
name: agusta-ui
description: Design system and frontend rules for the Agusta Automated Quotation System (React 19 + Tailwind v4). Use before building or changing ANY screen, component, modal, table, form, or PDF layout in this repo — login, sales portal, quotation wizard, Sales Support review, catalog, custom requests, discount rules, reports, user management. Keeps the UI on-brand with agusta.co.id and free of generic AI-template patterns.
---

# Agusta UI

Portal internal untuk tim Sales, Sales Support, dan Management Agusta (Business & Office Equipment). Ini **alat kerja**, bukan landing page: orang membuka portal ini puluhan kali sehari untuk membuat, mereview, dan menerbitkan surat penawaran. Desain harus terasa seperti kelanjutan dari katalog publik agusta.co.id — putih bersih, foto produk di atas putih, merah Agusta untuk aksi utama, biru untuk kategori dan tautan — tetapi lebih padat dan presisi.

Sebelum menulis UI, baca juga `DESIGN.md` dan `PRODUCT.md` di root proyek. Jika ada konflik: brief user > file ini > selera pribadi.

## 1. Dunia visual

| Peran | Token (Tailwind) | Hex | Pakai untuk |
|---|---|---|---|
| Merah Agusta | `brand` | `#D6202A` | Satu aksi utama per layar, item nav aktif (indikator), logo |
| Merah tua | `brand-strong` | `#B0141D` | Hover/pressed tombol utama, aksi destruktif |
| Biru katalog | `link` | `#2459D8` | Label kategori produk, tautan, checkbox/radio terpilih, fokus |
| Navy logo | `navy` | `#1D2A6E` | Kop surat dokumen, judul dokumen PDF |
| Tinta | `ink` | `#141821` | Teks utama |
| Tinta 2 | `ink-2` | `#4B5262` | Teks sekunder (kontras ≥ 4.5:1 di putih) |
| Tinta 3 | `ink-3` | `#6E7586` | Meta, placeholder (≥ 4.5:1) |
| Garis | `line` | `#E3E6EC` | Border kartu, pemisah tabel |
| Kanvas | `canvas` | `#F5F6F8` | Latar aplikasi & sidebar |
| Permukaan | `surface` | `#FFFFFF` | Panel, tabel, kartu produk |

Status (selalu teks + warna, jangan warna saja):
- Menunggu review → `amber` (`bg-amber-50 text-amber-800 ring-amber-200`)
- Disetujui / PDF terbit → `green` (`bg-emerald-50 text-emerald-800 ring-emerald-200`)
- Perlu revisi / ditolak → `red` (`bg-red-50 text-red-800 ring-red-200`)
- Terkirim WhatsApp → `blue` (`bg-blue-50 text-blue-800 ring-blue-200`)

Merah adalah warna paling mahal di layar. **Satu tombol merah per area kerja.** Aksi sekunder = putih bergaris (`btn-secondary`), aksi tersier = teks (`btn-ghost`).

### Hero merah (merah-putih)
Setiap halaman dibuka dengan **hero merah** (`PageHeader`, latar `brand-deep #C41C25`) berisi judul, deskripsi, aksi, dan opsional `children` (angka ringkasan `HeroStats`, tab `Segmented`, stepper). Di kanan hero ada garis lengkung emblem bola Agusta (`HeroLines`), besar dan samar. Konten pertama setelah hero otomatis naik menimpa tepi bawahnya (`.page-hero + *`). Sidebar putih, kanvas abu hangat — merah hanya di hero, tombol utama, item nav aktif.
- Di dalam hero, `Button` dan `Segmented` otomatis berganti skin lewat `OnBrandContext` (primary = putih berteks merah). Jangan menaruh tombol merah di atas merah.
- Teks di hero: putih penuh untuk judul/angka, `white/90` untuk deskripsi. Jangan memakai `ink-*` di hero.
- Angka ringkasan tampil langsung di hero (angka putih besar + garis pemisah tipis), bukan kartu metrik.
- Jangan menaruh teks lepas (tanpa kartu) tepat setelah hero — elemen pertama harus kartu/panel.

## 2. Tipografi

- Satu keluarga: **Plus Jakarta Sans** (dirancang di Jakarta — relevan dengan merek lokal). 400/500/600/700. Jangan pakai 800/black kecuali logo.
- Skala tetap (rem, rasio ±1.2): 12 · 13 · 14 (body) · 16 · 20 · 24 · 30. Judul halaman 24/600, judul panel 16/600, body 14/400, meta 12–13.
- Angka uang & kuantitas: selalu `tabular-nums`, rata kanan di tabel. Format `formatRupiah()` (Rp 1.250.000).
- Nomor penawaran (QTN-…) boleh `font-mono` karena itu memang kode/identifier — bukan dekorasi.
- Nama produk tampil **sesuai katalog** (sering huruf kapital, mis. "KURSI INDACHI FILMORE I AL"). Jangan ubah.
- Label kategori produk di kartu katalog: biru, 11–12px, kapital, tracking ringan — ini meniru website Agusta dan satu-satunya tempat label kapital diizinkan.

## 3. Layout

```
┌────────────┬───────────────────────────────────────────┐
│ Sidebar    │ Topbar: judul halaman · cari · notifikasi │
│ (kanvas)   ├───────────────────────────────────────────┤
│ logo       │ Konten di atas kanvas                     │
│ nav grup   │  ┌ panel putih (border line, radius 12) ┐ │
│ per role   │  │ tabel / form / daftar                │ │
│ ─────────  │  └──────────────────────────────────────┘ │
│ user card  │                                           │
└────────────┴───────────────────────────────────────────┘
```

- Sidebar 248px, latar putih (`surface`) bergaris kanan, tanpa bayangan. Item aktif: latar `brand-soft` + teks `brand-ink` + ikon merah (bukan blok merah penuh, bukan border-left tebal).
- Konten mengisi lebar di samping sidebar (tanpa max-width terpusat), padding 16–32px.
- Layar kerja dua kolom (review, wizard): kolom kerja kiri lebar, panel ringkasan kanan 360–400px yang `sticky`.
- Radius berhierarki: tombol/input 8px, panel 12px, chip/badge 999px. Jangan satu radius untuk semuanya.
- Kartu/panel: radius 14px, `border-line/80`, `shadow-card` (offset lembut). Elemen mengambang (drawer, dialog, toast) memakai `shadow-float`.
- Mobile: sidebar jadi drawer, tabel jadi daftar kartu bertumpuk di < 768px.

## 4. Kosakata komponen

Gunakan primitive di `src/components/ui/` — jangan bikin varian baru per layar.

- `Button` variant `primary | secondary | ghost | danger`, size `sm | md`. Semua punya hover, focus-visible ring biru, disabled, loading.
- `StatusBadge` untuk status penawaran/request — satu sumber label & warna (`STATUS_META`).
- `Field` + `Input` / `Select` / `Textarea`: label di atas, hint/error di bawah, error menyebut masalah + cara memperbaiki.
- `Panel` (header opsional + body). Jangan menumpuk panel di dalam panel.
- `Drawer` dari kanan untuk edit/tambah (user, request custom). `Dialog` hanya untuk konfirmasi destruktif atau pratinjau dokumen.
- `EmptyState`: kalimat yang menyuruh bertindak + satu tombol, bukan "Tidak ada data".
- Tabel: header 12px ink-3 sentence case, baris 52px, hover `bg-canvas`, aksi baris di kanan.

## 5. Copywriting (Bahasa Indonesia)

- Sentence case di semua tombol, judul, label. "Ajukan ke Sales Support", bukan "AJUKAN".
- Tombol menyebut hasil: "Setujui & terbitkan PDF", "Kirim ke WhatsApp", "Simpan perubahan". Toast memakai kata kerja yang sama ("PDF diterbitkan").
- Pakai istilah bisnis user: penawaran, HPP/COGS, harga jual, diskon, margin, PPN 11%, e-Katalog LKPP, TKDN.
- Error: sebut apa yang salah dan apa yang harus dilakukan. Tanpa "Oops", tanpa emoji.

## 6. RBAC di UI

- `SALES` tidak boleh melihat HPP/COGS, margin, atau aturan modal di layar mana pun — termasuk tooltip, PDF, payload WhatsApp. Gunakan `can(user, 'cogs:view')` dari `src/auth/permissions.ts`, jangan cek string role langsung.
- Navigasi dibangun dari permission, bukan hard-code per role.
- Aksi yang tidak diizinkan disembunyikan, bukan di-disable tanpa penjelasan.

## 7. Dilarang (pola template AI)

- Label kecil kapital (eyebrow) di atas judul. Badge "✨ AI-powered".
- Kartu metrik besar seragam (angka besar + label kecil + ikon berwarna) sebagai isi utama dashboard. Ringkasan angka boleh, tapi sebagai satu strip padat, dan dashboard harus dibuka dengan **pekerjaan** (antrean yang perlu ditindaklanjuti).
- Gradient sebagai dekorasi, teks gradient, glassmorphism, glow.
- Border-left berwarna tebal di kartu/alert.
- Emoji atau karakter unicode sebagai ikon — pakai `lucide-react`, stroke 1.75, ukuran 16/18/20.
- Animasi fade-up di setiap section, hover-lift di setiap kartu. Motion hanya untuk perubahan state (drawer, dialog, toast, langkah wizard), 150–220ms ease-out, dan hormati `prefers-reduced-motion`.
- Teks abu-abu di atas latar berwarna. `#0B0B0B`/`#111` sebagai "hitam".

## 8. Checklist sebelum selesai

1. Satu aksi merah per area kerja; sisanya sekunder/ghost.
2. Semua angka uang `tabular-nums` dan rata kanan.
3. Hover, focus-visible, disabled, loading, empty, error ada di setiap komponen interaktif.
4. Login sebagai Sales → cari di DOM: tidak ada nilai HPP/margin.
5. Lebar 375px: tidak ada scroll horizontal halaman; sidebar jadi drawer.
6. Kontras teks ≥ 4.5:1 (ink-3 adalah batas terendah untuk teks).
7. `npm run lint` lulus.
8. Jalankan `/impeccable critique` atau `polish` untuk layar baru.
