# Translation Feedback App

Mütercim-Tercümanlık öğrencileri için LLM ve XAI destekli çeviri geri bildirim uygulaması.

## Mimari

Uygulama üç parçadan oluşur:

1. Vercel uyumlu Next.js App Router web uygulaması
2. Supabase PostgreSQL kalıcı veri ve iş kuyruğu
3. Rig üzerinde çalışan Python worker

Rig doğrudan internete açık HTTP API değildir. Web uygulaması model işlerini Supabase'e `queued` olarak yazar; worker işleri atomik olarak claim eder, mock LLM/XAI adapter'larıyla işler ve sonucu Supabase'e kaydeder.

## Proje Yolu

```text
/home/ailab-rig/translation-feedback-app
```

Qwen model klasörü değiştirilmez:

```text
/media/ailab-rig/943b1761-0043-4605-b329-9f6c0e5a6402/models/Qwen3.8-27B
```

## Ortam Değişkenleri

`.env.example` dosyasını temel alarak web uygulaması için gerçek değerleri `.env.local` veya deployment ortamında tanımlayın. Worker için `.env.worker.example` dosyasını temel alarak `.env.worker.local` kullanın. Secret değerleri istemci bundle'ına koymayın.

```text
NEXT_PUBLIC_APP_URL=
SUPABASE_URL=
SUPABASE_SECRET_KEY=
SESSION_TOKEN_PEPPER=
WORKER_DATABASE_URL=
WORKER_ID=
WORKER_POLL_INTERVAL_SECONDS=
MODEL_PROVIDER=mock
QWEN_MODEL_PATH=/media/ailab-rig/943b1761-0043-4605-b329-9f6c0e5a6402/models/Qwen3.8-27B
```

`SUPABASE_SECRET_KEY`, `WORKER_DATABASE_URL` ve `SESSION_TOKEN_PEPPER` hiçbir zaman `NEXT_PUBLIC_` ile tanımlanmamalıdır.

## Kurulum

Node.js 22 gereklidir.

```bash
npm install
```

Worker bağımlılıkları mevcut `qwen38` conda ortamında kurulmalıdır:

```bash
conda run -n qwen38 python -m pip install -r requirements-worker.txt
```

## Supabase Migration

Bağlantı bilgileri hazır olduğunda migration dosyasını Supabase projesine uygulayın:

```bash
supabase db push
```

Migration:

```text
supabase/migrations/0001_initial_schema.sql
```

RLS tüm public tablolarda aktiftir. Tarayıcıya doğrudan tablo yetkisi verilmez. Next.js server tarafı `SUPABASE_SECRET_KEY`, worker ise `WORKER_DATABASE_URL` kullanır.

## Web Uygulamasını Çalıştırma

```bash
npm run dev
```

Üretim doğrulaması:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Worker Çalıştırma

İlk aşamada yalnızca mock provider kullanılır:

```bash
PYTHONPATH=. conda run -n qwen38 python -m worker.main
```

Worker `.env.worker.local` dosyasını okur. Bu dosya Git dışındadır.

Worker sıralı işler. Her turda:

1. `claim_next_model_job` fonksiyonuyla işi atomik claim eder.
2. `llm_feedback` için `MockLLMAdapter`, `xai_feedback` için `MockXAIAdapter` çalıştırır.
3. `complete_model_job` ile sonucu kaydeder.
4. Hata olursa `fail_model_job` ile temiz kısa hata yazar.

## Sayfalar

- `/` — ad/soyad başlangıç formu
- `/session/[sessionId]/task/1` — Çalışma 1
- `/session/[sessionId]/task/2` — Çalışma 2
- `/session/[sessionId]/result` — sonuç ekranı
- `/session/[sessionId]/result/report` — PDF indirme

## Öğrenci Akışı

- Başlangıçta UUID tabanlı session ve yüksek entropili erişim tokenı üretilir.
- Ham token veritabanına yazılmaz; HMAC-SHA256 hash saklanır.
- HttpOnly, Secure, SameSite=Lax cookie kullanılır.
- Aynı ad/soyad ile sorgu yapılmaz.
- Çalışma 1 tamamlanmadan Çalışma 2 açılamaz.
- Çalışma 2 tamamlanmadan sonuç ekranı açılamaz.
- İlk gönderimden sonra kaynak metin ve ilk çeviri kilitlenir.

## PDF

PDF React PDF ile server tarafında üretilir. Türkçe karakterler için `public/fonts/DejaVuSans.ttf` kullanılır. Raporda teknik model adları yerine `Yöntem A` ve `Yöntem B` gösterilir.

## Gerçek Qwen Entegrasyonu

Bu aşamada gerçek model yüklenmez. Sonraki aşamada worker içine Qwen adapter'ı eklenirken mevcut çalışan test scriptindeki ayarlar korunmalıdır:

- 4-bit NF4
- `device_map="balanced"`
- GPU başına `22GiB`
- CPU `64GiB`
- `enable_thinking=False`
- Model worker başlangıcında yalnızca bir kez yüklenmeli

## Güvenlik Notları

- `.env`, rapor çıktıları, cache ve model ağırlıkları Git dışındadır.
- Service key istemci tarafına aktarılmaz.
- Tarayıcı doğrudan tablo sorgulamaz.
- Worker hata traceback'ini öğrenciye göstermez.
- Supabase RLS public tablolarda aktiftir.
