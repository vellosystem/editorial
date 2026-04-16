export async function uploadImageToDrive(
  base64Data: string,
  filename: string,
  accessToken: string
): Promise<string | null> {
  try {
    // Extract base64 content
    const base64Content = base64Data.split(',')[1];
    if (!base64Content) throw new Error("Invalid base64 data");

    const mimeType = base64Data.split(';')[0].split(':')[1] || 'image/png';

    // Convert base64 to Blob
    const byteCharacters = atob(base64Content);
    const byteArrays = [];
    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }
    const blob = new Blob(byteArrays, { type: mimeType });

    // Create multipart form data
    const metadata = {
      name: filename,
      mimeType: mimeType,
    };

    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    form.append('file', blob);

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Drive upload error:', errorData);
      throw new Error('Failed to upload to Google Drive');
    }

    const data = await response.json();
    return data.id; // Returns the Drive file ID
  } catch (error) {
    console.error('Error uploading to Drive:', error);
    return null;
  }
}
