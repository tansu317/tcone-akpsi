// Tiga model unsupervised untuk prediksi amar.
// Label amar tidak dipakai saat pelatihan. Label hanya dipakai mengukur akurasi
// (klaster → mayoritas amar pada data uji) dan menerjemahkan klaster perkara baru
// menjadi distribusi amar.

const K = 9;
const SUHU = 1.5;
const ALFA = 0.5;

export function acak(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function jarak2(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return s;
}

function rata(baris) {
  const d = baris[0].length;
  const m = Array(d).fill(0);
  for (const x of baris) {
    for (let j = 0; j < d; j += 1) m[j] += x[j];
  }
  for (let j = 0; j < d; j += 1) m[j] /= baris.length;
  return m;
}

function statistik(X) {
  const d = X[0].length;
  const mean = Array(d).fill(0);
  for (const x of X) {
    for (let j = 0; j < d; j += 1) mean[j] += x[j];
  }
  for (let j = 0; j < d; j += 1) mean[j] /= X.length;
  const std = Array(d).fill(0);
  for (const x of X) {
    for (let j = 0; j < d; j += 1) std[j] += (x[j] - mean[j]) ** 2;
  }
  for (let j = 0; j < d; j += 1) std[j] = Math.sqrt(std[j] / X.length) || 1;
  return { mean, std };
}

function skala(x, stat) {
  return x.map((v, j) => (v - stat.mean[j]) / stat.std[j]);
}

function softmax(log) {
  const maks = Math.max(...log);
  const eks = log.map((v) => Math.exp(v - maks));
  const jumlah = eks.reduce((a, b) => a + b, 0) || 1;
  return eks.map((v) => v / jumlah);
}

function kmeans(X, k, rng) {
  const pusat = [X[Math.floor(rng() * X.length)].slice()];
  while (pusat.length < k) {
    const jarak = X.map((x) => Math.min(...pusat.map((c) => jarak2(x, c))));
    const total = jarak.reduce((a, b) => a + b, 0);
    if (!total) break;
    let r = rng() * total;
    let idx = 0;
    for (; idx < X.length; idx += 1) {
      r -= jarak[idx];
      if (r <= 0) break;
    }
    pusat.push(X[Math.min(idx, X.length - 1)].slice());
  }
  const milik = Array(X.length).fill(0);
  for (let iter = 0; iter < 60; iter += 1) {
    let berubah = false;
    for (let i = 0; i < X.length; i += 1) {
      let terbaik = 0;
      let terbaikJarak = Infinity;
      for (let c = 0; c < pusat.length; c += 1) {
        const d = jarak2(X[i], pusat[c]);
        if (d < terbaikJarak) {
          terbaikJarak = d;
          terbaik = c;
        }
      }
      if (milik[i] !== terbaik) {
        milik[i] = terbaik;
        berubah = true;
      }
    }
    for (let c = 0; c < pusat.length; c += 1) {
      const anggota = X.filter((_, i) => milik[i] === c);
      if (anggota.length) pusat[c] = rata(anggota);
    }
    if (!berubah && iter > 0) break;
  }
  return { pusat, milik };
}

function logGauss(x, mean, variansi) {
  let s = 0;
  for (let d = 0; d < x.length; d += 1) {
    const v = Math.max(variansi[d], 0.05);
    const z = x[d] - mean[d];
    s += -0.5 * (Math.log(2 * Math.PI * v) + (z * z) / v);
  }
  return s;
}

function gmm(X, k, rng) {
  const awal = kmeans(X, k, rng);
  const kk = awal.pusat.length;
  const d = X[0].length;
  const mean = awal.pusat.map((p) => p.slice());
  const bobot = Array(kk).fill(1 / kk);
  const variansi = mean.map(() => Array(d).fill(1));
  for (let c = 0; c < kk; c += 1) {
    const anggota = X.filter((_, i) => awal.milik[i] === c);
    if (anggota.length < 2) continue;
    bobot[c] = anggota.length / X.length;
    for (let j = 0; j < d; j += 1) {
      let s = 0;
      for (const x of anggota) s += (x[j] - mean[c][j]) ** 2;
      variansi[c][j] = s / anggota.length;
    }
  }
  const tanggung = X.map(() => Array(kk).fill(1 / kk));
  for (let iter = 0; iter < 30; iter += 1) {
    for (let i = 0; i < X.length; i += 1) {
      tanggung[i] = softmax(mean.map((m, c) => Math.log(bobot[c] + 1e-12) + logGauss(X[i], m, variansi[c])));
    }
    for (let c = 0; c < kk; c += 1) {
      const nk = tanggung.reduce((s, r) => s + r[c], 0) || 1e-6;
      bobot[c] = nk / X.length;
      for (let j = 0; j < d; j += 1) {
        let m = 0;
        for (let i = 0; i < X.length; i += 1) m += tanggung[i][c] * X[i][j];
        mean[c][j] = m / nk;
      }
      for (let j = 0; j < d; j += 1) {
        let v = 0;
        for (let i = 0; i < X.length; i += 1) v += tanggung[i][c] * (X[i][j] - mean[c][j]) ** 2;
        variansi[c][j] = v / nk;
      }
    }
  }
  const model = { mean, variansi, bobot };
  const peluang = (x) => softmax(mean.map((m, c) => Math.log(bobot[c] + 1e-12) + logGauss(x, m, variansi[c])));
  const milik = X.map((x) => {
    const p = peluang(x);
    return p.indexOf(Math.max(...p));
  });
  return { model, milik, peluang };
}

// Average linkage dengan pembaruan Lance–Williams: O(n²) memori, O(n³) waktu terburuk.
function aglomeratif(X, k) {
  const n = X.length;
  const D = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const d = Math.sqrt(jarak2(X[i], X[j]));
      D[i][j] = d;
      D[j][i] = d;
    }
  }
  const aktif = Array(n).fill(true);
  const ukuran = Array(n).fill(1);
  const anggota = Array.from({ length: n }, (_, i) => [i]);
  let sisa = n;
  while (sisa > k) {
    let bi = -1;
    let bj = -1;
    let terbaik = Infinity;
    for (let i = 0; i < n; i += 1) {
      if (!aktif[i]) continue;
      const Di = D[i];
      for (let j = i + 1; j < n; j += 1) {
        if (aktif[j] && Di[j] < terbaik) {
          terbaik = Di[j];
          bi = i;
          bj = j;
        }
      }
    }
    const ni = ukuran[bi];
    const nj = ukuran[bj];
    for (let t = 0; t < n; t += 1) {
      if (!aktif[t] || t === bi || t === bj) continue;
      const d = (ni * D[bi][t] + nj * D[bj][t]) / (ni + nj);
      D[bi][t] = d;
      D[t][bi] = d;
    }
    ukuran[bi] = ni + nj;
    anggota[bi] = anggota[bi].concat(anggota[bj]);
    aktif[bj] = false;
    sisa -= 1;
  }
  const kelompok = anggota.filter((_, i) => aktif[i]);
  const milik = Array(n).fill(0);
  kelompok.forEach((isi, c) => {
    for (const i of isi) milik[i] = c;
  });
  const pusat = kelompok.map((isi) => rata(isi.map((i) => X[i])));
  return { pusat, milik };
}

function siluet(X, milik, batas = 400) {
  const langkah = Math.max(1, Math.floor(X.length / batas));
  const idx = X.map((_, i) => i).filter((i) => i % langkah === 0);
  const k = Math.max(...milik) + 1;
  const kelompok = Array.from({ length: k }, () => []);
  idx.forEach((i) => kelompok[milik[i]].push(i));
  let jumlah = 0;
  let n = 0;
  for (const i of idx) {
    const sendiri = kelompok[milik[i]];
    if (sendiri.length < 2) continue;
    let a = 0;
    for (const j of sendiri) if (j !== i) a += Math.sqrt(jarak2(X[i], X[j]));
    a /= sendiri.length - 1;
    let b = Infinity;
    for (let c = 0; c < k; c += 1) {
      if (c === milik[i] || !kelompok[c].length) continue;
      let s = 0;
      for (const j of kelompok[c]) s += Math.sqrt(jarak2(X[i], X[j]));
      b = Math.min(b, s / kelompok[c].length);
    }
    if (!Number.isFinite(b)) continue;
    jumlah += (b - a) / Math.max(a, b, 1e-9);
    n += 1;
  }
  return n ? jumlah / n : 0;
}

function bagiUji(n, lipatan, seed) {
  const indeks = Array.from({ length: n }, (_, i) => i);
  const rng = acak(seed);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [indeks[i], indeks[j]] = [indeks[j], indeks[i]];
  }
  return Array.from({ length: lipatan }, (_, f) => ({
    uji: indeks.filter((_, i) => i % lipatan === f),
    latih: indeks.filter((_, i) => i % lipatan !== f),
  }));
}

// Distribusi amar per klaster dengan pemulusan Laplace agar tidak ada amar berpeluang 0 atau 1.
function distribusiKlaster(milik, y, k, semuaAmar) {
  return Array.from({ length: k }, (_, c) => {
    const hitung = new Map(semuaAmar.map((a) => [a, ALFA]));
    let total = ALFA * semuaAmar.length;
    milik.forEach((m, i) => {
      if (m === c) {
        hitung.set(y[i], (hitung.get(y[i]) || ALFA) + 1);
        total += 1;
      }
    });
    return semuaAmar.map((a) => hitung.get(a) / total);
  });
}

function campur(bobot, dist) {
  const hasil = Array(dist[0].length).fill(0);
  bobot.forEach((w, c) => {
    for (let a = 0; a < hasil.length; a += 1) hasil[a] += w * dist[c][a];
  });
  return hasil;
}

function bobotJarak(x, pusat) {
  return softmax(pusat.map((p) => -jarak2(x, p) / SUHU));
}

function buatModel(kode, X, y, semuaAmar, rng) {
  const k = Math.min(K, X.length - 1);
  let milik;
  let bobot;
  if (kode === 'gmm') {
    const hasil = gmm(X, k, rng);
    milik = hasil.milik;
    bobot = hasil.peluang;
  } else {
    const hasil = kode === 'kmeans' ? kmeans(X, k, rng) : aglomeratif(X, k);
    milik = hasil.milik;
    bobot = (x) => bobotJarak(x, hasil.pusat);
  }
  const kk = Math.max(...milik) + 1;
  const dist = distribusiKlaster(milik, y, kk, semuaAmar);
  return {
    milik,
    prediksi(x) {
      const w = bobot(x).slice(0, kk);
      const p = campur(w, dist);
      const i = p.indexOf(Math.max(...p));
      return { amar: semuaAmar[i], probabilitas: p, klaster: w.indexOf(Math.max(...w)) };
    },
  };
}

export const MODEL = [
  { kode: 'kmeans', nama: 'K-Means' },
  { kode: 'gmm', nama: 'Gaussian Mixture Model' },
  { kode: 'aglomeratif', nama: 'Agglomerative Clustering' },
];

function akurasiLipat(sampel, kode, semuaAmar, lipatan, seed) {
  const bagi = bagiUji(sampel.length, lipatan, seed);
  let benar = 0;
  let total = 0;
  bagi.forEach((lipat, i) => {
    const latih = lipat.latih.map((idx) => sampel[idx]);
    const stat = statistik(latih.map((s) => s.x));
    const model = buatModel(
      kode,
      latih.map((s) => skala(s.x, stat)),
      latih.map((s) => s.y),
      semuaAmar,
      acak(seed + i * 97 + kode.length * 13),
    );
    for (const idx of lipat.uji) {
      if (model.prediksi(skala(sampel[idx].x, stat)).amar === sampel[idx].y) benar += 1;
      total += 1;
    }
  });
  return total ? benar / total : 0;
}

function bulatkan(probabilitas, semuaAmar) {
  const hasil = semuaAmar.map((amar, i) => ({ amar, probabilitas: Math.round(probabilitas[i] * 10000) / 10000 }));
  const selisih = 1 - hasil.reduce((s, d) => s + d.probabilitas, 0);
  const atas = hasil.reduce((m, d, i) => (d.probabilitas > hasil[m].probabilitas ? i : m), 0);
  hasil[atas].probabilitas = Math.round((hasil[atas].probabilitas + selisih) * 10000) / 10000;
  return hasil;
}

// Latih ketiga model pada korpus sekali; hasilnya dipakai ulang untuk setiap perkara.
export function latihModel(sampel, semuaAmar, seed = 20251027) {
  const stat = statistik(sampel.map((s) => s.x));
  const X = sampel.map((s) => skala(s.x, stat));
  const y = sampel.map((s) => s.y);
  const model = MODEL.map((meta) => {
    const lengkap = buatModel(meta.kode, X, y, semuaAmar, acak(seed + meta.kode.length * 101));
    return {
      ...meta,
      akurasi: Math.round(akurasiLipat(sampel, meta.kode, semuaAmar, 5, seed) * 10000) / 10000,
      siluet: Math.round(siluet(X, lengkap.milik) * 10000) / 10000,
      lengkap,
    };
  });
  const terbaik = [...model].sort((a, b) => b.akurasi - a.akurasi || b.siluet - a.siluet || a.nama.localeCompare(b.nama))[0];
  return { stat, model, terpilih: terbaik.kode, semuaAmar };
}

export function prediksiModel(latih, kueri) {
  const xq = skala(kueri, latih.stat);
  return latih.model.map((m) => {
    const hasil = m.lengkap.prediksi(xq);
    const distribusi = bulatkan(hasil.probabilitas, latih.semuaAmar);
    const skor = Math.max(...distribusi.map((d) => d.probabilitas));
    return {
      kode: m.kode,
      nama: m.nama,
      akurasi: m.akurasi,
      siluet: m.siluet,
      amar: hasil.amar,
      skor,
      distribusi,
      dipilih: m.kode === latih.terpilih,
    };
  });
}
