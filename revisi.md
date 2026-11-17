# Revisi Portal Penawaran Agusta

Daftar revisi dari tim Agusta: status, keputusan/data yang dibutuhkan, dan langkah pengerjaan.
Update file ini setiap ada progres (centang `[x]`, ubah status, isi kolom keputusan).

**Legenda status:** ✅ Selesai · 🟡 Sebagian · 🔨 Dikerjakan · ⏳ Menunggu keputusan/data · ❌ Belum

_Terakhir diperbarui: 17 Nov 2026 — Tahap 1 selesai; masukan ke-2 dari Agusta ditambahkan (R7 diperjelas, R11–R14 baru)_

---

## Ringkasan

| ID | Revisi | Untuk | Status | Tahap | Menunggu |
|---|---|---|---|---|---|
| R1 | Nomor telepon customer opsional | Sales | ✅ Selesai | 1 | — |
| R2 | Segmen customer opsional | Sales | ✅ Selesai | 1 | Konfirmasi Q2 (pakai usulan default) |
| R3 | Diskon custom diisi Sales | Sales | ✅ Selesai | 1 | Konfirmasi Q3 (pakai usulan default) |
| R4 | Centang tampil/sembunyikan PPN & Diskon di PDF | Sales Support | ✅ Selesai | 1 | Konfirmasi Q4 (pakai usulan default) |
| R5 | Revisi penawaran yang sudah jadi | Sales Support | ❌ Belum | 2 | Keputusan Q5 |
| R6 | Biaya tambahan jasa pasang & ongkir | Sales Support | ❌ Belum | 2 | Data Q6 |
| R7 | Eskalasi ke Management (diskon di luar standar & harga custom khusus) | Sales Support | 🟡 Sebagian | 2 | Q7 (sebagian terjawab) |
| R8 | Analisa lama penawaran | Management | ❌ Belum | 3 | Data Q8 |
| R9 | Update harga dari PDF supplier ke master data | General | ❌ Belum | 4 | Data Q9 |
| R10 | Produk custom dicari ke website supplier (selain e-commerce) | General | 🟡 Sebagian | 4 | Data Q10 |
| R11 | "Target harga per unit" diganti **Pagu / anggaran** | Sales | ❌ Belum | 2 | Q11 |
| R12 | Aturan diskon **per merek** (bukan per segmen) | Sales Support | ❌ Belum | 2 | Q12 |
| R13 | Sales update perkembangan penawaran **seminggu sekali** | Sales | ❌ Belum | 3 | Q13 |
| R14 | Analisis **success rate** penawaran | Management | ❌ Belum | 3 | Q14 (butuh R13) |

**Progres:** 4 dari 14 selesai (Tahap 1).

---

## Alur kerja yang diminta Agusta (masukan ke-2)

1. **Sales** menginput pengajuan barang yang ingin dibuatkan penawaran.
2. **Sales Support** menerima dan memproses pengajuan.
3. **Eskalasi Management** (hanya kasus tertentu): bila ada **diskon tambahan di luar standar** atau **barang custom yang harganya perlu dihitung khusus**, Sales Support **meneruskan** pengajuan ke Management untuk perhitungan harga dan approval.
4. Setelah disetujui Management, **Sales Support** membuat dokumen penawaran final dan meneruskannya ke Sales.
5. **(R13)** Setelah penawaran terkirim, Sales meng-update perkembangannya **seminggu sekali** sampai menang/kalah.
6. **(R14)** Management melihat **success rate** penawaran.

---

## Detail per revisi

### R1 — Nomor telepon customer opsional
- **Hasil:** ✅ nomor telepon customer opsional. Bila diisi, tercetak di surat & PDF (“Telp. …”); bila kosong tidak dicetak.
- **Butuh dari Agusta:** —
- **Langkah:**
  - [x] Hapus validasi wajib nomor telepon di wizard
  - [x] PDF & pratinjau surat: tampilkan telepon hanya bila diisi
  - [x] Uji: ajukan penawaran tanpa nomor telepon

### R2 — Segmen customer opsional
- **Hasil:** ✅ pilihan **Tidak ditentukan** (default). Tanpa segmen: tidak ada saran diskon otomatis, Sales mengisi diskon sendiri; batas tanpa persetujuan khusus 5%. Laporan margin punya kelompok **Tanpa segmen**.
- **Butuh dari Agusta:** Q2
- **Langkah:**
  - [x] Tambah opsi segmen kosong di wizard (data & database)
  - [x] Aturan saran diskon saat segmen kosong (usulan default Q2)
  - [x] Laporan margin: kelompok "Tanpa segmen"
  - [x] Uji wizard, review, laporan

### R3 — Diskon custom diisi Sales
- **Hasil:** ✅ diskon per item bisa diketik dalam **%** atau **Rp per unit** (tombol % / Rp). Ada **Diskon tambahan (Rp)** untuk seluruh penawaran, dipotong sebelum PPN. Keduanya bisa diisi Sales dan disesuaikan Sales Support saat review; tercetak di surat & PDF dan ikut dihitung di margin.
- **Butuh dari Agusta:** Q3
- **Langkah:**
  - [x] Input diskon Rupiah per item (dikonversi otomatis ke %)
  - [x] Diskon total penawaran (sebelum PPN)
  - [x] Tampil di review Sales Support, PDF, perhitungan margin
  - [x] Uji perhitungan subtotal, PPN, total

### R4 — Centang tampil/sembunyikan PPN & Diskon di PDF
- **Hasil:** ✅ dua centang **Tampilan di PDF** di layar review Sales Support, disimpan per penawaran.
  - *Tampilkan PPN* tidak dicentang → baris PPN hilang, total ditulis **“Total (belum termasuk PPN)”**, syarat & ketentuan berbunyi *“Harga belum termasuk PPN”*, dan pesan WhatsApp memakai total sebelum PPN.
  - *Tampilkan diskon* tidak dicentang → kolom diskon hilang, harga satuan langsung harga setelah diskon item. Diskon tambahan tetap tertulis.
- **Butuh dari Agusta:** Q4
- **Langkah:**
  - [x] Simpan pengaturan tampilan per penawaran (database)
  - [x] Centang di layar review Sales Support
  - [x] PDF, pratinjau, dan pesan WhatsApp mengikuti pengaturan
  - [x] Uji kombinasi tampilan, total tetap benar

### R5 — Revisi penawaran yang sudah jadi
- **Kondisi sekarang:** revisi hanya untuk penawaran berstatus *Perlu revisi*. Penawaran yang sudah *Disetujui/Terkirim* tidak bisa diubah.
- **Rencana:** tombol **Buat revisi** → penawaran baru bernomor `-R1`, `-R2`, … → review ulang → PDF baru. PDF lama tetap tersimpan sebagai arsip, riwayat saling terhubung.
- **Butuh dari Agusta:** Q5
- **Langkah:**
  - [ ] Model data versi revisi (nomor `-Rn`, tautan ke versi sebelumnya)
  - [ ] Tombol "Buat revisi" sesuai hak akses (Q5)
  - [ ] Alur review ulang + notifikasi lonceng/WhatsApp
  - [ ] Tampilan riwayat versi & PDF lama
  - [ ] Uji: revisi dari status Disetujui dan Terkirim

### R6 — Biaya tambahan jasa pasang & ongkir
- **Kondisi sekarang:** penawaran hanya berisi produk katalog.
- **Rencana:** bagian **Biaya tambahan** (jasa pasang, ongkir, lainnya) yang bisa ditambahkan walau Sales lupa, ikut di total dan PDF.
- **Butuh dari Agusta:** Q6
- **Langkah:**
  - [ ] Model data baris biaya tambahan (jenis, keterangan, jumlah, kena PPN/tidak)
  - [ ] Input di layar review Sales Support (dan di wizard Sales, bila diizinkan)
  - [ ] Perhitungan total, PPN, margin
  - [ ] Tampil di PDF
  - [ ] Uji perhitungan

### R7 — Diskon/harga custom diteruskan ke Management
- **Kondisi sekarang:** 🟡 Sales Support bisa menyetujui sendiri margin di bawah batas (dengan centang konfirmasi). Belum ada alur persetujuan Management.
- **Rencana (sesuai alur masukan ke-2):** tombol **Teruskan ke Management** di layar review penawaran dan di penetapan harga barang custom. Dipakai Sales Support untuk (a) diskon tambahan di luar standar, (b) barang custom yang harganya perlu dihitung khusus. Sistem juga **menyarankan** eskalasi bila diskon melebihi batas aturan. Status menjadi **Menunggu Management** → Management **menghitung/mengubah harga** lalu menyetujui (atau mengembalikan dengan catatan) → kembali ke Sales Support untuk menerbitkan PDF final ke Sales. Notifikasi lonceng + WhatsApp di setiap perpindahan.
- **Butuh dari Agusta:** Q7
- **Langkah:**
  - [ ] Status & riwayat eskalasi (database)
  - [ ] Tombol "Teruskan ke Management" + saran otomatis bila diskon di luar standar
  - [ ] Antrean & layar hitung harga/approval di akun Management (penawaran + barang custom)
  - [ ] Setelah disetujui: kembali ke Sales Support untuk terbitkan PDF final
  - [ ] Notifikasi ke Management & balik ke Sales Support/Sales
  - [ ] Uji tiap aturan

### R8 — Analisa lama penawaran
- **Kondisi sekarang:** waktu tiap tahap sudah tercatat di riwayat penawaran, tetapi belum diolah. Laporan yang ada baru margin per Sales & per segmen.
- **Rencana:** bagian baru di **Laporan**: rata-rata & median durasi tiap tahap, per Sales dan per Sales Support, penawaran yang paling lama mengendap, tren per bulan, pencapaian target (SLA).
- **Butuh dari Agusta:** Q8
- **Langkah:**
  - [ ] Hitung durasi tiap tahap dari riwayat
  - [ ] Tabel & grafik di halaman Laporan
  - [ ] Daftar penawaran melewati target
  - [ ] Uji dengan data contoh

### R9 — Update harga dari PDF supplier ke master data
- **Kondisi sekarang:** harga & HPP diubah satu per satu di Katalog.
- **Rencana:** **Import price list**: upload Excel/PDF supplier → sistem mencocokkan produk → pratinjau *harga lama → harga baru* → Sales Support konfirmasi → master data terupdate + tercatat riwayatnya.
- **Catatan:** Excel dibaca akurat. PDF tiap supplier formatnya berbeda, perlu dibaca otomatis (bisa dibantu AI, ada biaya per dokumen), dan selalu lewat pratinjau sebelum disimpan.
- **Butuh dari Agusta:** Q9
- **Langkah:**
  - [ ] Pelajari contoh price list tiap supplier
  - [ ] Import Excel/CSV + pencocokan produk
  - [ ] Pembacaan PDF
  - [ ] Layar pratinjau & konfirmasi
  - [ ] Riwayat perubahan harga per produk
  - [ ] Uji dengan file asli supplier

### R10 — Produk custom dicari ke website supplier (selain e-commerce)
- **Kondisi sekarang:** 🟡 Riset harga pasar memakai Google Shopping (marketplace). Website supplier hanya muncul bila kebetulan terdaftar di Google Shopping.
- **Rencana:** di panel **Riset harga pasar**, tambah bagian **Website supplier** yang mencari langsung di daftar website supplier (pakai API key Serper yang sudah aktif), ditampilkan terpisah dari marketplace.
- **Butuh dari Agusta:** Q10
- **Langkah:**
  - [ ] Daftar website supplier di pengaturan (bisa diubah Sales Support/Management)
  - [ ] Pencarian per website supplier
  - [ ] Tampil terpisah di panel Riset harga pasar + "Pakai sebagai acuan"
  - [ ] Uji dengan website supplier asli

### R11 — "Target harga per unit" diganti Pagu / anggaran
- **Kondisi sekarang:** form barang custom punya field *Target harga per unit (opsional)*.
- **Rencana:** ganti menjadi **Pagu / anggaran** (Rp). Ditampilkan ke Sales Support saat menghitung harga, dibandingkan dengan hasil riset harga pasar dan harga final (di atas/di bawah pagu).
- **Butuh dari Agusta:** Q11
- **Langkah:**
  - [ ] Ubah field & label di form barang custom (dan data lama ikut terbawa)
  - [ ] Tampilkan pagu di layar Sales Support + indikator di atas/di bawah pagu
  - [ ] Uji

### R12 — Aturan diskon per merek (bukan per segmen)
- **Kondisi sekarang:** aturan diskon (saran %, maks %, margin min.) disusun per **segmen customer** dan jumlah barang.
- **Rencana:** aturan disusun per **merek** (Indachi, Chairman, Lenovo, …) dan jumlah barang. Saran diskon di wizard mengikuti merek tiap item. Segmen customer tetap ada sebagai info & laporan (sudah opsional, R2).
- **Catatan data:** produk hasil sinkron agusta.co.id belum punya kolom merek terpisah. Merek diambil dari spesifikasi ("Merek: …") / nama produk, dan bisa dikoreksi di Katalog.
- **Butuh dari Agusta:** Q12
- **Langkah:**
  - [ ] Merek di master produk (isi otomatis dari spesifikasi/nama + bisa diedit)
  - [ ] Halaman Aturan diskon per merek (+ aturan "merek lainnya")
  - [ ] Saran & batas diskon per item mengikuti merek
  - [ ] Pindahkan aturan lama / isi aturan awal
  - [ ] Uji wizard, review, simulator aturan

### R13 — Sales update perkembangan penawaran seminggu sekali
- **Kondisi sekarang:** setelah PDF terkirim, penawaran berhenti di status *Terkirim*. Tidak ada catatan tindak lanjut.
- **Rencana:** di penawaran yang sudah terkirim, Sales mengisi **Update** (status + catatan): *Menunggu keputusan · Negosiasi · Menang (PO) · Kalah · Batal*. Kalah/Batal wajib alasan; Menang mencatat nilai PO. **Pengingat mingguan** (lonceng + WhatsApp) untuk penawaran yang belum di-update 7 hari. Daftar "Perlu update" di Beranda Sales.
- **Butuh dari Agusta:** Q13
- **Langkah:**
  - [ ] Data update penawaran (status, catatan, nilai PO, alasan) + riwayat
  - [ ] Form update di halaman penawaran (Sales)
  - [ ] Daftar "Perlu update minggu ini" di Beranda Sales
  - [ ] Pengingat mingguan otomatis (lonceng + WhatsApp)
  - [ ] Uji

### R14 — Analisis success rate penawaran (Management)
- **Kondisi sekarang:** laporan baru margin per Sales & per segmen.
- **Rencana:** di Laporan: **success rate** (menang ÷ penawaran yang sudah ada hasil), nilai menang vs nilai ditawarkan, per **Sales / merek / segmen / bulan**, alasan kalah terbanyak, dan penawaran yang lama tanpa update. Digabung dengan R8 (lama penawaran).
- **Butuh dari Agusta:** Q14. Datanya berasal dari R13.
- **Langkah:**
  - [ ] Hitung success rate & nilai menang
  - [ ] Tabel/grafik per Sales, merek, segmen, bulan
  - [ ] Alasan kalah & penawaran tanpa update
  - [ ] Uji dengan data contoh

---

## Pertanyaan untuk tim Agusta

Isi kolom **Jawaban** lalu ubah status revisi terkait.

| ID | Pertanyaan | Usulan default | Jawaban |
|---|---|---|---|
| Q2 | Bila segmen kosong, saran diskon pakai aturan apa? | Tanpa saran diskon otomatis, Sales isi sendiri | |
| Q3 | Diskon dalam % saja atau juga Rupiah? Per item saja atau ada diskon total penawaran? | % dan Rupiah per item + diskon total | |
| Q4a | Bila PPN disembunyikan: harga ditampilkan *sudah termasuk PPN* (harga satuan +11%), atau PPN dihilangkan dengan keterangan *"harga belum termasuk PPN"*? | Keterangan "harga belum termasuk PPN" | |
| Q4b | Bila diskon disembunyikan: harga satuan langsung harga setelah diskon (kolom diskon hilang)? | Ya | |
| Q5 | Siapa boleh membuka revisi (Sales / Sales Support / keduanya)? Wajib review ulang? Format nomor? PDF lama disimpan? | Keduanya · wajib review ulang · `QTN-…-R1` · PDF lama diarsipkan | |
| Q6 | Jenis biaya tambahan apa saja? Kena PPN? Kena diskon? Ada tarif standar? Siapa yang boleh menambah? | Jasa pasang, ongkir, lainnya · kena PPN · tidak kena diskon · tanpa tarif standar · Sales & Sales Support | |
| Q7 | ✅ *Terjawab sebagian:* Sales Support yang meneruskan, untuk diskon di luar standar & barang custom yang perlu dihitung khusus; Management menghitung harga & approve. **Sisa:** apakah sistem juga perlu **memaksa** eskalasi (tidak bisa disetujui Sales Support) bila diskon melewati batas? Penerimanya semua user Management atau orang tertentu? | Tidak memaksa, hanya menyarankan · semua user Management | |
| Q8 | Angka apa yang ingin dilihat? Target SLA (mis. review ≤ 1 hari kerja)? Hitung jam kerja saja atau 24 jam? | Durasi tiap tahap + SLA review 1 hari kerja, jam kerja Senin–Jumat | |
| Q9 | Contoh price list 2–3 supplier (PDF asli). Bisa Excel? Kolom kunci pencocokan? Harga supplier = HPP? Harga jual ikut naik otomatis? | Harga supplier = HPP · harga jual tetap manual | |
| Q10 | Daftar website supplier (nama + alamat web). Website-nya mencantumkan harga? | — | |
| Q11 | Pagu/anggaran itu **total** untuk seluruh jumlah barang, atau **per unit**? Wajib atau opsional? | Total untuk seluruh jumlah, opsional (per unit dihitung otomatis) | |
| Q12 | Daftar merek yang punya aturan diskon + angka per merek (saran %, maks %, margin min., per jumlah barang?). Merek yang tidak terdaftar pakai aturan apa? Segmen customer masih dipakai untuk apa pun di diskon? | Aturan per merek + tingkat jumlah · merek lain: saran 0%, maks 5% · segmen hanya info & laporan | |
| Q13 | Pilihan status update yang dipakai? Daftar alasan kalah? Pengingat hari apa? Berapa lama penawaran dipantau (mis. sampai berlaku habis / 3 bulan)? | Menunggu keputusan · Negosiasi · Menang (PO) · Kalah · Batal · alasan: harga, kompetitor, anggaran, spesifikasi, lainnya · pengingat Senin pagi · dipantau sampai menang/kalah/batal | |
| Q14 | Definisi "berhasil": PO diterima saja, atau termasuk menang tender? Dihitung per jumlah penawaran atau per nilai (Rp)? | Berhasil = Menang (PO) · tampil keduanya: per jumlah & per nilai | |

---

## Urutan pengerjaan

| Tahap | Isi | Syarat mulai |
|---|---|---|
| **1. Perubahan cepat** | R1, R2, R4, R3 (tambahan) | Bisa langsung, pakai usulan default bila belum dijawab |
| **2. Alur kerja penawaran** | R11 → R12 → R6 → R7 → R5 | R11/R12/R7 bisa dimulai dengan usulan default; R6 & R5 menunggu Q6 & Q5 |
| **3. Tindak lanjut & laporan** | R13 → R14 → R8 | R13 bisa dimulai dengan usulan default Q13 |
| **4. Integrasi supplier** | R10 → R9 | Data Q10 (daftar website) dan Q9 (contoh price list) |

**Prasyarat penting:** R5, R7, R8, R13, dan R14 bisa dicoba di mode demo, tetapi baru benar-benar berguna setelah **database pusat (Supabase) dipasang**. Persetujuan Management dan analisa lama penawaran butuh data bersama, bukan data di browser masing-masing. Lihat [docs/backend-setup.md](docs/backend-setup.md).

---

## Log progres

| Tanggal | Revisi | Catatan |
|---|---|---|
| 17 Nov 2026 | R7, R11–R14 | **Masukan ke-2 dari Agusta:** alur eskalasi Management diperjelas (R7, Q7 sebagian terjawab); baru: pagu/anggaran (R11), aturan diskon per merek (R12), update mingguan Sales (R13), analisis success rate (R14). |
| 17 Nov 2026 | R1–R4 | **Tahap 1 live di production** (commit `ed4d730`, Vercel *Ready*): https://agusta-quotation-portal.vercel.app |
| 17 Nov 2026 | R1–R4 | **Tahap 1 selesai.** Memakai usulan default Q2–Q4 (mohon dikonfirmasi tim Agusta). Database: migrasi `20261117000000_quote_options.sql`. Diuji: unit test, database (PGlite), dan alur di browser. |
| 17 Nov 2026 | — | Daftar revisi diterima dan dianalisis. R3 sudah sebagian ada (diskon % per item), R7 sebagian (konfirmasi margin rendah oleh Sales Support), R10 sebagian (riset via Google Shopping). |
