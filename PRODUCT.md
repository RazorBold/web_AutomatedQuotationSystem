# Product — Agusta Automated Quotation System

## What it is
Portal web internal Agusta (Business & Office Equipment, penyedia perabot kantor, perangkat IT, dan produk e-Katalog LKPP) untuk mempercepat surat penawaran harga dari Sales ke Sales Support sampai dokumen resmi terbit dan dikirim via WhatsApp.

## Users & roles
- **Sales** — mencari produk (smart search), menyusun penawaran, mengajukan request barang custom. Tidak boleh melihat HPP/COGS atau margin.
- **Sales Support** — mereview pengajuan, override HPP & harga final, menghitung harga barang custom, menyetujui/menolak, menerbitkan PDF, mengirim notifikasi WhatsApp.
- **Management** — semua akses Sales Support + laporan margin + manajemen user & hak akses.

## Core workflow
Sales susun penawaran → `Menunggu review` → Sales Support review (HPP, harga, diskon, margin floor) → `Disetujui` (PDF terbit dengan tanda tangan) → `Terkirim` via WhatsApp ke Sales. Atau `Perlu revisi` dengan alasan → Sales revisi & ajukan ulang.

## Constraints
- Bahasa UI: Indonesia. Mata uang Rupiah, PPN 11%.
- HPP/COGS sensitif (RBAC).
- Tahap saat ini: frontend dengan data mock & sesi lokal; backend, database, WhatsApp API sungguhan menyusul.

## Mode
Operate (alat kerja harian). Login screen boleh sedikit lebih ekspresif tetapi tetap tenang.
