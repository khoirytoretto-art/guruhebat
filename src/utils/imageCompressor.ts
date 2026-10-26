/**
 * Image compression utility to prevent LocalStorage QuotaExceeded errors
 * Scales images down smoothly using HTML5 Canvas and outputs efficient webp/jpeg/png
 */

export async function compressImageToDataUrl(
  input: File | string,
  maxWidth = 360,
  maxHeight = 360,
  quality = 0.85
): Promise<string> {
  if (typeof window === 'undefined') {
    return typeof input === 'string' ? input : '';
  }

  let dataUri = '';
  if (typeof input === 'string') {
    dataUri = input;
    // If it's already an SVG or tiny data uri, don't re-compress
    if (dataUri.startsWith('data:image/svg+xml') || dataUri.length < 20000) {
      return dataUri;
    }
  } else {
    dataUri = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve((e.target?.result as string) || '');
      reader.onerror = reject;
      reader.readAsDataURL(input);
    });
  }

  if (!dataUri) return '';

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width <= 0 || height <= 0) {
        return resolve(dataUri);
      }

      // Calculate aspect ratio
      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUri);

      // Smooth scaling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Try webp first, fallback to jpeg/png
      try {
        const webp = canvas.toDataURL('image/webp', quality);
        if (webp && webp.startsWith('data:image/webp')) {
          return resolve(webp);
        }
      } catch {}

      try {
        const jpeg = canvas.toDataURL('image/jpeg', quality);
        if (jpeg && jpeg.startsWith('data:image/jpeg')) {
          return resolve(jpeg);
        }
      } catch {}

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => {
      resolve(dataUri);
    };

    img.src = dataUri;
  });
}
