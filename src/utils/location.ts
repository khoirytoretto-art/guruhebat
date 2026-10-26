/**
 * Menghitung jarak antara dua titik koordinat (Haversine Formula) dalam satuan Meter.
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Radius bumi dalam meter
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // Dalam meter
  return distance;
}

/**
 * Mendapatkan lokasi perangkat saat ini.
 */
export function getCurrentLocation(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation tidak didukung oleh browser ini.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => {
        // Fallback jika mode akurasi tinggi bermasalah / timeout
        navigator.geolocation.getCurrentPosition(
          (position) => resolve(position),
          (err2) => {
            let msg = 'Gagal mendapatkan lokasi.';
            switch (err2.code) {
              case err2.PERMISSION_DENIED:
                msg = 'Izin akses lokasi ditolak oleh browser/perangkat.';
                break;
              case err2.POSITION_UNAVAILABLE:
                msg = 'Informasi lokasi tidak tersedia.';
                break;
              case err2.TIMEOUT:
                msg = 'Waktu permintaan lokasi habis.';
                break;
            }
            reject(new Error(msg));
          },
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
    );
  });
}
