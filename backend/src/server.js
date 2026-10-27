import 'dotenv/config';
import app from './app.js';

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`SIPROPERTI API berjalan di http://localhost:${port}`);
});
