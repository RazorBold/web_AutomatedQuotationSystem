# Setup backend: Supabase + WhatsApp Business

Portal punya dua mode, dipilih otomatis dari env:

| Mode | Kapan aktif | Data |
|---|---|---|
| **Demo lokal** | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` kosong | Disimpan di browser masing-masing (localStorage) |
| **Supabase** | Kedua env di atas terisi | Database Postgres pusat, login Supabase Auth, PDF di Supabase Storage |

WhatsApp berjalan **mode simulasi** sampai `WHATSAPP_ACCESS_TOKEN` dan `WHATSAPP_PHONE_NUMBER_ID` diisi.

---

## 1. Buat project Supabase

1. Daftar di <https://supabase.com>, lalu **New project**. Pilih region **Southeast Asia (Singapore)**.
2. Buka **SQL Editor → New query**, lalu jalankan dua file migrasi **berurutan** (tempel isinya, klik **Run**):
   1. `supabase/migrations/20261109000000_init.sql`: tabel, aturan akses (RLS), fungsi persetujuan, bucket PDF `quotations`, realtime.
   2. `supabase/migrations/20261110000000_notifications.sql`: notifikasi di portal (lonceng), dibuat otomatis oleh trigger.
3. Buka **Project Settings → API**, lalu salin tiga nilai berikut ke `.env.local` (lihat `.env.example`):
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` → `VITE_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (**rahasia**: jangan pernah diberi awalan `VITE_`)
4. Buka **Authentication → Sign In / Providers → Email**, lalu matikan **Allow new users to sign up**.
   Akun hanya dibuat oleh Management dari menu *User & hak akses*.

## 2. Isi data awal

```bash
npm install
npm run db:seed
```

Perintah ini membuat 5 akun demo (kata sandi `agusta123`, atau nilai `SEED_PASSWORD`), lalu mengisi katalog, aturan diskon, contoh penawaran, dan request custom. Perintah aman dijalankan ulang.

> Sebelum dipakai sungguhan, ganti kata sandi akun demo atau nonaktifkan akunnya dari menu *User & hak akses*.

## 3. Jalankan

```bash
npm run dev      # http://localhost:3000. Fungsi /api ikut jalan di dev server.
```

Untuk deploy ke Vercel, masukkan semua env dari `.env.example` di **Vercel → Project → Settings → Environment Variables**, lalu deploy ulang. Folder `api/` otomatis menjadi serverless function.

## 4. Siapa melihat apa

- **Sales** hanya menerima data penawaran dan request miliknya sendiri. Kolom HPP/COGS dan margin disimpan di tabel terpisah (`*_costs`), dan RLS memblokirnya untuk Sales. Data itu tidak pernah terkirim ke browser Sales.
- Semua perubahan (ajukan, setujui, tolak, ubah harga, aturan diskon) lewat fungsi database yang mengecek role. Hitungan subtotal, PPN 11%, dan margin dilakukan di database.
- PDF disimpan privat. Link di WhatsApp adalah *signed URL* yang berlaku 7 hari.

## 5. Alur otomatis saat Sales Support klik "Setujui & terbitkan PDF"

1. Harga final dan HPP disimpan, status menjadi `Disetujui`.
2. Browser membuat PDF (foto produk, spesifikasi, harga, tanda tangan Sales + Direktur), lalu mengunggahnya ke Storage.
3. `/api/whatsapp` membuat link PDF dan mengirim template WhatsApp ke nomor Sales yang mengajukan.
4. Status menjadi `Terkirim`. Riwayat mencatat apakah pengiriman sungguhan atau simulasi.

Jika WhatsApp gagal, penawaran tetap disetujui dan muncul pesan error. Tombol **Kirim ulang WhatsApp** tersedia di halaman penawaran.

---

## 6. Menghubungkan WhatsApp Business (Meta Cloud API)

### a. Siapkan akun
1. Buat **Meta Business Account** di <https://business.facebook.com>, lalu verifikasi bisnis.
2. Di <https://developers.facebook.com>, buat **App** bertipe *Business*, lalu tambahkan produk **WhatsApp**.
3. Di **WhatsApp → API Setup**, daftarkan nomor pengirim (nomor yang belum dipakai di aplikasi WhatsApp biasa). Catat **Phone number ID**.
4. Buat **System User** di Business Settings, beri aset App + WhatsApp Account, lalu generate token permanen dengan izin `whatsapp_business_messaging` dan `whatsapp_business_management`.

### b. Buat template pesan
Di **WhatsApp Manager → Message templates → Create**:

- **Nama:** `agusta_quotation_approved`
- **Kategori:** Utility
- **Bahasa:** Indonesian (`id`)
- **Header:** Document
- **Body** (urutan variabel harus sama):
  ```
  Halo {{1}}, penawaran {{2}} untuk {{3}} telah DISETUJUI oleh Sales Support.
  Total penawaran: {{4}} (termasuk PPN 11%).
  Dokumen PDF resmi bertanda tangan terlampir dan siap diteruskan ke customer.
  ```
- **Footer:** `Agusta Quotation System`

Tunggu sampai status template **Approved**. Biasanya beberapa menit sampai 1 hari.

### c. Isi env
```
WHATSAPP_ACCESS_TOKEN=<token system user>
WHATSAPP_PHONE_NUMBER_ID=<phone number id>
WHATSAPP_TEMPLATE_NAME=agusta_quotation_approved
WHATSAPP_TEMPLATE_LANG=id
```
Restart `npm run dev` atau deploy ulang Vercel. Pengiriman berikutnya akan sungguhan (riwayat tidak lagi menyebut "mode simulasi").

### d. (Opsional) Status terkirim/dibaca
Di App Dashboard → **WhatsApp → Configuration → Webhook**:
- Callback URL: `https://<domain-anda>/api/whatsapp-webhook`
- Verify token: nilai `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (bebas, buat sendiri)
- Subscribe field **messages**
- Isi `WHATSAPP_APP_SECRET` (App Settings → Basic → App secret) agar tanda tangan webhook diverifikasi.

Status WhatsApp penawaran akan ikut berubah: `SENT → DELIVERED → READ`, atau `FAILED`.

---

## 7. Notifikasi

### Siapa menerima apa
| Kejadian | Penerima | Di portal (lonceng) | WhatsApp |
|---|---|---|---|
| Penawaran baru diajukan | Semua Sales Support & Management | ✅ | ✅ |
| Penawaran direvisi & diajukan ulang | Semua Sales Support & Management | ✅ | ✅ |
| Penawaran disetujui | Sales pengaju | ✅ | ✅ (pesan PDF, lihat §5) |
| Penawaran dikembalikan untuk revisi | Sales pengaju | ✅ | ✅ |
| Request barang custom baru | Semua Sales Support & Management | ✅ | ✅ |
| Harga custom dihitung / disetujui / ditolak | Sales pengaju | ✅ | ✅ |

Pelaku aksi tidak menerima notifikasi atas aksinya sendiri. Notifikasi di portal muncul seketika (realtime). Jika tab portal sedang tidak dibuka, notifikasi desktop browser juga bisa diaktifkan dari panel lonceng.

### Mengaktifkan WhatsApp untuk notifikasi
1. Buat template kedua di WhatsApp Manager:
   - **Nama:** `agusta_notifikasi`, **Kategori:** Utility, **Bahasa:** Indonesian
   - **Body:**
     ```
     Halo {{1}}, ada pembaruan di Portal Penawaran Agusta.
     *{{2}}*
     {{3}}
     Buka {{4}} untuk melihat detail dan menindaklanjuti.
     ```
2. Isi env `NOTIFY_WEBHOOK_SECRET` (string acak panjang) dan `APP_URL` (alamat portal), lalu deploy ulang.
3. Di Supabase: **Database → Webhooks → Create a new hook**
   - Table `notifications`, event **Insert**, type **HTTP Request**, method **POST**
   - URL `https://<domain-anda>/api/notification-webhook`
   - HTTP Headers: `x-webhook-secret` = nilai `NOTIFY_WEBHOOK_SECRET`
4. Hasil tiap pengiriman tercatat di kolom `notifications.whatsapp_status` (`SENT`, `SIMULATED`, `SKIPPED`, `FAILED` + `whatsapp_error`).

Untuk memilih jenis yang dikirim ke WhatsApp, isi `WHATSAPP_NOTIFY_TYPES`, contoh `QUOTATION_SUBMITTED,QUOTATION_REJECTED`. Isi `none` untuk mematikan semuanya.

## 8. Mesin pencari (Google)
Portal ini sengaja **tidak diindeks**. Ada tiga lapisan: header `X-Robots-Tag: noindex` di semua respons (`vercel.json`), `<meta name="robots" content="noindex">` di `index.html`, dan deskripsi halaman yang netral. `robots.txt` sengaja tidak memblokir crawler. Kalau crawler diblokir, Google tidak pernah membaca perintah `noindex`, dan URL-nya justru bisa tetap muncul di hasil pencarian.

Kalau domain portal sudah sempat terindeks, ajukan penghapusan lewat Google Search Console → **Removals**.

### Catatan nomor Sales
Nomor WhatsApp diambil dari profil Sales (menu *User & hak akses*). Format `+62 812-…` atau `0812…` diterima.
