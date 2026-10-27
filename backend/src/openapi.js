const pesan = { $ref: '#/components/schemas/Pesan' };
const bearer = [{ bearerAuth: [] }];
const galat = {
  400: { description: 'Permintaan tidak valid', content: { 'application/json': { schema: pesan } } },
  401: { description: 'Belum masuk atau token kedaluwarsa', content: { 'application/json': { schema: pesan } } },
  403: { description: 'Peran tidak berwenang', content: { 'application/json': { schema: pesan } } },
  404: { description: 'Data tidak ditemukan', content: { 'application/json': { schema: pesan } } },
};

const uuid = { type: 'string', format: 'uuid' };

function path(ringkas, tag, extra = {}) {
  return { summary: ringkas, tags: [tag], security: bearer, responses: { 200: { description: 'Berhasil' }, ...galat }, ...extra };
}

export const spesifikasi = {
  openapi: '3.0.3',
  info: {
    title: 'SIPROPERTI API',
    version: '1.0.0',
    description: 'API lokal Fitur Prediksi Putusan pada Tax Court One. Prediksi amar memakai tiga model unsupervised: K-Means, Gaussian Mixture Model, dan Agglomerative Clustering. Model dengan akurasi 5-fold tertinggi yang dipakai. Masuk lewat POST /api/auth/masuk, lalu kirim header Authorization: Bearer {token}.',
  },
  servers: [{ url: 'http://localhost:4000', description: 'API lokal' }],
  tags: [
    { name: 'Kesehatan' },
    { name: 'Autentikasi' },
    { name: 'Perkara' },
    { name: 'Prediksi' },
    { name: 'Evaluasi' },
    { name: 'ChatAI' },
    { name: 'Disparitas' },
    { name: 'Audit' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Pesan: { type: 'object', properties: { pesan: { type: 'string' } } },
      Masuk: {
        type: 'object',
        required: ['nip', 'kataSandi'],
        properties: {
          nip: { type: 'string', example: '197208041999031004' },
          kataSandi: { type: 'string', example: 'demo123' },
        },
      },
      Generate: {
        type: 'object',
        required: ['perkaraId', 'kunci'],
        properties: {
          perkaraId: uuid,
          kunci: { type: 'string', minLength: 8, description: 'Kunci idempoten, misalnya UUID' },
        },
      },
    },
  },
  paths: {
    '/api/kesehatan': {
      get: { summary: 'Cek API dan database', tags: ['Kesehatan'], security: [], responses: { 200: { description: 'Layanan siap' } } },
    },
    '/api/docs.json': {
      get: { summary: 'Spesifikasi OpenAPI mentah', tags: ['Kesehatan'], security: [], responses: { 200: { description: 'Dokumen OpenAPI' } } },
    },
    '/api/auth/masuk': {
      post: {
        summary: 'Masuk dengan NIP',
        tags: ['Autentikasi'],
        security: [],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Masuk' } } } },
        responses: { 200: { description: 'Token JWT dan profil pengguna' }, 401: galat[401] },
      },
    },
    '/api/auth/saya': { get: path('Profil pengguna yang sedang masuk', 'Autentikasi') },
    '/api/auth/keluar': { post: path('Catat keluar', 'Autentikasi') },
    '/api/perkara': { get: path('Daftar sengketa penyelesaian', 'Perkara') },
    '/api/perkara/{id}': {
      get: path('Detail sengketa', 'Perkara', { parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }] }),
    },
    '/api/perkara/{id}/pilih': {
      post: path('Pilih sengketa dan catat audit', 'Perkara', { parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }] }),
    },
    '/api/prediksi/riwayat': { get: path('Riwayat hasil prediksi', 'Prediksi') },
    '/api/prediksi/generate': {
      post: path('Jalankan tiga model unsupervised dan simpan prediksi model terakurat', 'Prediksi', {
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Generate' } } } },
        responses: {
          201: { description: 'Prediksi berhasil disimpan' },
          200: { description: 'Prediksi dihentikan (data tidak ada atau dokumen tidak lengkap)' },
          ...galat,
        },
      }),
    },
    '/api/prediksi/{id}': {
      get: path('Hasil prediksi, termasuk akurasi K-Means, GMM, dan Agglomerative Clustering', 'Prediksi', {
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
      }),
    },
    '/api/prediksi/{id}/analisis': {
      get: path('Analisis hasil prediksi', 'Prediksi', { parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }] }),
    },
    '/api/prediksi/{id}/pembanding/{putusanId}': {
      get: path('Bandingkan perkara dengan satu putusan sejenis', 'Prediksi', {
        parameters: [
          { name: 'id', in: 'path', required: true, schema: uuid },
          { name: 'putusanId', in: 'path', required: true, schema: uuid },
        ],
      }),
    },
    '/api/prediksi/putusan/{id}/unduh': {
      get: path('Unduh teks putusan sejenis', 'Prediksi', {
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        responses: { 200: { description: 'Berkas teks' }, ...galat },
      }),
    },
    '/api/meta': { get: path('Daftar amar, langkah prediksi, dan jenis pertanyaan ChatAI', 'Prediksi') },
    '/api/dashboard': { get: path('Kartu ringkasan sesuai peran', 'Perkara') },
    '/api/notifikasi': { get: path('Notifikasi pengguna', 'Perkara') },
    '/api/notifikasi/{id}/baca': {
      post: path('Tandai notifikasi sudah dibaca', 'Perkara', { parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }] }),
    },
    '/api/evaluasi/prediksi/{id}': {
      get: path('Riwayat evaluasi satu prediksi', 'Evaluasi', { parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }] }),
    },
    '/api/evaluasi/prediksi': {
      post: path('Simpan evaluasi hakim atas amar prediksi', 'Evaluasi', {
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['prediksiId', 'status'],
                properties: {
                  prediksiId: uuid,
                  status: { type: 'string', enum: ['DITERIMA', 'DIKOREKSI', 'DITOLAK', 'DITANDAI'] },
                  keterangan: { type: 'string' },
                  amarKoreksi: { type: 'string' },
                  bagianDikoreksi: { type: 'string' },
                },
              },
            },
          },
        },
      }),
    },
    '/api/evaluasi/analisis': {
      post: path('Simpan evaluasi analisis', 'Evaluasi', {
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['prediksiId', 'status', 'nilai'],
                properties: {
                  prediksiId: uuid,
                  status: { type: 'string', enum: ['SETUJU', 'TIDAK SETUJU'] },
                  nilai: { type: 'array', items: { type: 'string' } },
                  alasan: { type: 'string' },
                },
              },
            },
          },
        },
      }),
    },
    '/api/evaluasi/saya': { get: path('Evaluasi yang disimpan hakim ini', 'Evaluasi') },
    '/api/chat/sesi': {
      get: path('Daftar sesi ChatAI', 'ChatAI'),
      post: path('Buka atau lanjutkan sesi ChatAI', 'ChatAI', {
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['prediksiId'], properties: { prediksiId: uuid } } } },
        },
      }),
    },
    '/api/chat/sesi/{id}': {
      get: path('Isi satu sesi ChatAI', 'ChatAI', { parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }] }),
    },
    '/api/chat/sesi/{id}/pesan': {
      post: path('Kirim pertanyaan ChatAI', 'ChatAI', {
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['jenis'],
                properties: { jenis: { type: 'string' }, isi: { type: 'string' } },
              },
            },
          },
        },
      }),
    },
    '/api/chat/sesi/{id}/akhiri': {
      post: path('Akhiri sesi ChatAI', 'ChatAI', { parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }] }),
    },
    '/api/chat/feedback': {
      post: path('Kirim feedback hasil prediksi', 'ChatAI', {
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['prediksiId', 'jenis', 'rating'],
                properties: {
                  prediksiId: uuid,
                  percakapanId: uuid,
                  jenis: { type: 'string', enum: ['Sesuai', 'Tidak Sesuai'] },
                  rating: { type: 'integer' },
                  kategori: { type: 'array', items: { type: 'string' } },
                  penjelasan: { type: 'string' },
                },
              },
            },
          },
        },
      }),
    },
    '/api/disparitas/parameter': {
      get: path('Parameter deteksi disparitas yang berlaku', 'Disparitas'),
      put: path('Ubah ambang dan periode disparitas', 'Disparitas', {
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  periodeDari: { type: 'string', format: 'date' },
                  periodeSampai: { type: 'string', format: 'date' },
                  jenisPajak: { type: 'string' },
                  ambang: { type: 'number' },
                  minimum: { type: 'integer' },
                },
              },
            },
          },
        },
      }),
    },
    '/api/disparitas/target': {
      get: path('Sengketa yang bisa dideteksi disparitasnya', 'Disparitas', {
        parameters: [{ name: 'jenisPajak', in: 'query', schema: { type: 'string' } }],
      }),
    },
    '/api/disparitas/deteksi': {
      post: path('Hitung indeks disparitas satu sengketa', 'Disparitas', {
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['perkaraId'], properties: { perkaraId: uuid } } } },
        },
      }),
    },
    '/api/disparitas/simpan': {
      post: path('Simpan hasil deteksi menjadi laporan', 'Disparitas', {
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['perkaraId'], properties: { perkaraId: uuid } } } },
        },
      }),
    },
    '/api/disparitas/laporan': { get: path('Daftar laporan disparitas', 'Disparitas') },
    '/api/disparitas/laporan/{id}': {
      get: path('Detail laporan disparitas', 'Disparitas', { parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }] }),
      patch: path('Ubah status peninjauan laporan', 'Disparitas', {
        parameters: [{ name: 'id', in: 'path', required: true, schema: uuid }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['Terkonfirmasi', 'Diabaikan', 'Ditindaklanjuti'] },
                  catatan: { type: 'string' },
                },
              },
            },
          },
        },
      }),
    },
    '/api/audit': {
      get: path('Jejak audit', 'Audit', {
        parameters: [{ name: 'q', in: 'query', schema: { type: 'string' }, description: 'Saring nama, aksi, atau objek' }],
      }),
    },
  },
};
