// Tiga model unsupervised untuk prediksi amar.
// Label amar tidak dipakai saat pelatihan. Label hanya dipakai mengukur akurasi
// (klaster → mayoritas amar pada data uji) dan menerjemahkan klaster perkara baru.

function acak(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng) {
  const u = Math.max(rng(), 1e-9);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
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
    for (let j = 0; j < d; j += 1) {
      const dlt = x[j] - mean[j];
      std[j] += dlt * dlt;
    }
  }
  for (let j = 0; j < d; j += 1) std[j] = Math.sqrt(std[j] / X.length) || 1;
  return { mean, std };
}

function skala(x, stat) {
  return x.map((v, j) => (v - stat.mean[j]) / stat.std[j]);
}

function kAcuan(label, n) {
  const unik = new Set(label).size;
  return Math.max(2, Math.min(4, unik, n - 1));
}

function mayoritas(label) {
  if (!label.length) return { amar: null, skor: 0, hitung: new Map() };
  const hitung = new Map();
  for (const y of label) hitung.set(y, (hitung.get(y) || 0) + 1);
  let nama = label[0];
  let n = -1;
  for (const [y, c] of hitung) {
    if (c > n || (c === n && String(y) < String(nama))) {
      nama = y;
      n = c;
    }
  }
  return { amar: nama, skor: n / label.length, hitung };
}

function kmeans(X, k, rng) {
  const pusat = [X[Math.floor(rng() * X.length)].slice()];
  while (pusat.length < k) {
    const jarak = X.map((x) => Math.min(...pusat.map((c) => jarak2(x, c))));
    const total = jarak.reduce((a, b) => a + b, 0) || 1;
    let r = rng() * total;
    let idx = 0;
    for (; idx < X.length; idx += 1) {
      r -= jarak[idx];
      if (r <= 0) break;
    }
    pusat.push(X[Math.min(idx, X.length - 1)].slice());
  }
  const milik = Array(X.length).fill(0);
  for (let iter = 0; iter < 40; iter += 1) {
    let berubah = false;
    for (let i = 0; i < X.length; i += 1) {
      let terbaik = 0;
      let terbaikJarak = Infinity;
      for (let c = 0; c < k; c += 1) {
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
    for (let c = 0; c < k; c += 1) {
      const anggota = X.filter((_, i) => milik[i] === c);
      pusat[c] = anggota.length ? rata(anggota) : X[Math.floor(rng() * X.length)].slice();
    }
    if (!berubah && iter > 0) break;
  }
  return { pusat, milik };
}

function logGauss(x, mean, variansi) {
  let s = 0;
  for (let d = 0; d < x.length; d += 1) {
    const v = Math.max(variansi[d], 1e-3);
    const z = x[d] - mean[d];
    s += -0.5 * (Math.log(2 * Math.PI * v) + (z * z) / v);
  }
  return s;
}

function gmm(X, k, rng) {
  const awal = kmeans(X, k, rng);
  const d = X[0].length;
  const mean = awal.pusat.map((p) => p.slice());
  const bobot = Array(k).fill(1 / k);
  const variansi = mean.map(() => Array(d).fill(1));
  for (let c = 0; c < k; c += 1) {
    const anggota = X.filter((_, i) => awal.milik[i] === c);
    if (anggota.length < 2) continue;
    for (let j = 0; j < d; j += 1) {
      let s = 0;
      for (const x of anggota) s += (x[j] - mean[c][j]) ** 2;
      variansi[c][j] = s / anggota.length;
    }
  }
  let tanggung = X.map(() => Array(k).fill(1 / k));
  for (let iter = 0; iter < 25; iter += 1) {
    for (let i = 0; i < X.length; i += 1) {
      const log = mean.map((m, c) => Math.log(bobot[c] + 1e-12) + logGauss(X[i], m, variansi[c]));
      const maks = Math.max(...log);
      const eks = log.map((v) => Math.exp(v - maks));
      const jumlah = eks.reduce((a, b) => a + b, 0) || 1;
      tanggung[i] = eks.map((v) => v / jumlah);
    }
    for (let c = 0; c < k; c += 1) {
      const nk = tanggung.reduce((s, r) => s + r[c], 0) || 1e-6;
      bobot[c] = nk / X.length;
      for (let j = 0; j < d; j += 1) {
        let m = 0;
        for (let i = 0; i < X.length; i += 1) m += tanggung[i][c] * X[i][j];
        mean[c][j] = m / nk;
      }
      for (let j = 0; j < d; j += 1) {
        let v = 0;
        for (let i = 0; i < X.length; i += 1) {
          const z = X[i][j] - mean[c][j];
          v += tanggung[i][c] * z * z;
        }
        variansi[c][j] = v / nk;
      }
    }
  }
  return { mean, variansi, bobot };
}

function klasterGmm(model, x) {
  let terbaik = 0;
  let terbaikLog = -Infinity;
  for (let c = 0; c < model.mean.length; c += 1) {
    const log = Math.log(model.bobot[c] + 1e-12) + logGauss(x, model.mean[c], model.variansi[c]);
    if (log > terbaikLog) {
      terbaikLog = log;
      terbaik = c;
    }
  }
  return terbaik;
}

function aglomeratif(X, k) {
  const n = X.length;
  const jarak = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const d = Math.sqrt(jarak2(X[i], X[j]));
      jarak[i][j] = d;
      jarak[j][i] = d;
    }
  }
  let kelompok = Array.from({ length: n }, (_, i) => [i]);
  while (kelompok.length > k) {
    let bi = 0;
    let bj = 1;
    let terbaik = Infinity;
    for (let i = 0; i < kelompok.length; i += 1) {
      for (let j = i + 1; j < kelompok.length; j += 1) {
        let s = 0;
        for (const a of kelompok[i]) {
          for (const b of kelompok[j]) s += jarak[a][b];
        }
        const d = s / (kelompok[i].length * kelompok[j].length);
        if (d < terbaik) {
          terbaik = d;
          bi = i;
          bj = j;
        }
      }
    }
    kelompok[bi] = kelompok[bi].concat(kelompok[bj]);
    kelompok.splice(bj, 1);
  }
  const milik = Array(n).fill(0);
  kelompok.forEach((anggota, c) => {
    for (const i of anggota) milik[i] = c;
  });
  const pusat = kelompok.map((anggota) => rata(anggota.map((i) => X[i])));
  return { pusat, milik };
}

function siluet(X, milik) {
  const k = Math.max(...milik) + 1;
  const kelompok = Array.from({ length: k }, () => []);
  milik.forEach((c, i) => kelompok[c].push(i));
  let jumlah = 0;
  let n = 0;
  for (let i = 0; i < X.length; i += 1) {
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

function buatModel(nama, latihX, latihY, rng) {
  const k = kAcuan(latihY, latihX.length);
  if (nama === 'kmeans') {
    const model = kmeans(latihX, k, rng);
    const label = Array.from({ length: k }, (_, c) => {
      const y = latihY.filter((_, i) => model.milik[i] === c);
      return y.length ? mayoritas(y).amar : latihY[0];
    });
    return {
      milik: model.milik,
      prediksi(x) {
        let c = 0;
        let terbaik = Infinity;
        for (let i = 0; i < model.pusat.length; i += 1) {
          const d = jarak2(x, model.pusat[i]);
          if (d < terbaik) {
            terbaik = d;
            c = i;
          }
        }
        return { klaster: c, amar: label[c], anggota: latihY.filter((_, i) => model.milik[i] === c) };
      },
    };
  }
  if (nama === 'gmm') {
    const model = gmm(latihX, k, rng);
    const milik = latihX.map((x) => klasterGmm(model, x));
    const label = Array.from({ length: k }, (_, c) => {
      const y = latihY.filter((_, i) => milik[i] === c);
      return y.length ? mayoritas(y).amar : latihY[0];
    });
    return {
      milik,
      prediksi(x) {
        const c = klasterGmm(model, x);
        return { klaster: c, amar: label[c], anggota: latihY.filter((_, i) => milik[i] === c) };
      },
    };
  }
  const model = aglomeratif(latihX, k);
  const label = Array.from({ length: k }, (_, c) => {
    const y = latihY.filter((_, i) => model.milik[i] === c);
    return y.length ? mayoritas(y).amar : latihY[0];
  });
  return {
    milik: model.milik,
    prediksi(x) {
      let c = 0;
      let terbaik = Infinity;
      for (let i = 0; i < model.pusat.length; i += 1) {
        const d = jarak2(x, model.pusat[i]);
        if (d < terbaik) {
          terbaik = d;
          c = i;
        }
      }
      return { klaster: c, amar: label[c], anggota: latihY.filter((_, i) => model.milik[i] === c) };
    },
  };
}

const MODEL = [
  { kode: 'kmeans', nama: 'K-Means' },
  { kode: 'gmm', nama: 'Gaussian Mixture Model' },
  { kode: 'aglomeratif', nama: 'Agglomerative Clustering' },
];

function akurasiLipat(sampel, kode, lipatan, seed) {
  const bagi = bagiUji(sampel.length, lipatan, seed);
  let benar = 0;
  let total = 0;
  bagi.forEach((lipat, i) => {
    const latih = lipat.latih.map((idx) => sampel[idx]);
    const stat = statistik(latih.map((s) => s.x));
    const latihX = latih.map((s) => skala(s.x, stat));
    const latihY = latih.map((s) => s.y);
    const model = buatModel(kode, latihX, latihY, acak(seed + i * 97 + kode.length * 13));
    for (const idx of lipat.uji) {
      const hasil = model.prediksi(skala(sampel[idx].x, stat));
      if (hasil.amar === sampel[idx].y) benar += 1;
      total += 1;
    }
  });
  return total ? benar / total : 0;
}

function distribusiDari(anggota, semuaAmar) {
  const { hitung } = mayoritas(anggota.length ? anggota : ['Menolak']);
  const mentah = semuaAmar.map((amar) => ({ amar, probabilitas: (hitung.get(amar) || 0) / (anggota.length || 1) }));
  const total = mentah.reduce((s, d) => s + d.probabilitas, 0) || 1;
  const hasil = mentah.map((d) => ({ ...d, probabilitas: d.probabilitas / total }));
  let sisa = 1;
  for (let i = 0; i < hasil.length - 1; i += 1) {
    hasil[i].probabilitas = Math.round(hasil[i].probabilitas * 10000) / 10000;
    sisa -= hasil[i].probabilitas;
  }
  hasil[hasil.length - 1].probabilitas = Math.max(0, Math.round(sisa * 10000) / 10000);
  return hasil;
}

export function perluasKorpus(dasar, salinan, sigma, seed) {
  const rng = acak(seed);
  const keluar = [];
  for (const item of dasar) {
    keluar.push({ x: item.x.slice(), y: item.y });
    for (let i = 0; i < salinan; i += 1) {
      keluar.push({
        y: item.y,
        x: item.x.map((v) => v + gauss(rng) * sigma),
      });
    }
  }
  return keluar;
}

export function bandingkanModel(sampel, kueri, semuaAmar) {
  const seed = 20251027;
  const stat = statistik(sampel.map((s) => s.x));
  const X = sampel.map((s) => skala(s.x, stat));
  const y = sampel.map((s) => s.y);
  const xq = skala(kueri, stat);
  const model = MODEL.map((meta) => {
    const lengkap = buatModel(meta.kode, X, y, acak(seed + meta.kode.length * 101));
    const pred = lengkap.prediksi(xq);
    const akurasi = akurasiLipat(sampel, meta.kode, 5, seed);
    return {
      kode: meta.kode,
      nama: meta.nama,
      akurasi: Math.round(akurasi * 10000) / 10000,
      siluet: Math.round(siluet(X, lengkap.milik) * 10000) / 10000,
      amar: pred.amar,
      skor: Math.round((pred.anggota.length ? mayoritas(pred.anggota).skor : 0) * 10000) / 10000,
      distribusi: distribusiDari(pred.anggota, semuaAmar),
      dipilih: false,
    };
  });
  const terbaik = [...model].sort((a, b) => b.akurasi - a.akurasi || b.siluet - a.siluet || a.nama.localeCompare(b.nama))[0];
  const terpilih = model.find((m) => m.kode === terbaik.kode);
  terpilih.dipilih = true;
  return model;
}
