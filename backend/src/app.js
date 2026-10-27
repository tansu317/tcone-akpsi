import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import auth from './routes/auth.js';
import perkara from './routes/perkara.js';
import prediksi from './routes/prediksi.js';
import modul from './routes/modul.js';
import { query } from './db.js';
import { spesifikasi } from './openapi.js';

const app = express();
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json());

app.get('/api/kesehatan', async (_req, res) => {
  await query('SELECT 1');
  res.json({ status: 'ok', layanan: 'siproperti-api' });
});

app.get('/api/docs.json', (_req, res) => res.json(spesifikasi));
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(spesifikasi, {
  customSiteTitle: 'SIPROPERTI API',
  swaggerOptions: { persistAuthorization: true },
}));

app.use('/api/auth', auth);
app.use('/api/perkara', perkara);
app.use('/api/prediksi', prediksi);
app.use('/api', modul);

app.use((_req, res) => {
  res.status(404).json({ pesan: 'Endpoint tidak ditemukan.' });
});

app.use((err, _req, res, _next) => {
  if (!err.status || err.status >= 500) console.error(err);
  const status = err.status || 500;
  res.status(status).json({
    pesan: status >= 500 ? 'Terjadi kesalahan pada server.' : err.message,
  });
});

export default app;
