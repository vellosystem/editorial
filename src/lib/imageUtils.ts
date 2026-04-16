/**
 * Optimizes an image file by resizing it and converting it to a compressed JPEG.
 * @param file The image file to optimize.
 * @param maxSize The maximum width or height of the optimized image. Defaults to 800.
 * @param quality The quality of the compressed JPEG (0 to 1). Defaults to 0.7.
 * @returns A promise that resolves to an object containing the base64 data and mime type.
 */
export async function optimizeImage(
  file: File,
  maxSize: number = 800,
  quality: number = 0.7
): Promise<{ data: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height *= maxSize / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width *= maxSize / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const [mimePart, base64Data] = dataUrl.split(',');
        const mimeType = mimePart.split(':')[1].split(';')[0];

        resolve({
          data: base64Data,
          mimeType: mimeType,
        });
      };
      img.onerror = () => reject(new Error('Could not load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}
