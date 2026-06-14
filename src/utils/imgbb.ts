/**
 * Utility to upload base64 image data to ImgBB and return the public secure URL.
 */
export async function uploadToImgBB(base64DataUrl: string): Promise<string> {
  try {
    // Strip the data MIME-type prefix if there's one; ImgBB expects raw base64 or standard multipart upload
    const base64Content = base64DataUrl.includes(',') 
      ? base64DataUrl.split(',')[1] 
      : base64DataUrl;

    const formData = new FormData();
    formData.append('image', base64Content);

    const response = await fetch('https://api.imgbb.com/1/upload?key=5fd2a4346ac2e5485a916a5d734d508b', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('ImgBB API error response:', errText);
      throw new Error(`Upload server responded with code ${response.status}`);
    }

    const data = await response.json();
    if (data && data.success && data.data && data.data.url) {
      return data.data.url;
    } else {
      throw new Error(data?.error?.message || 'Malformed ImgBB response structure.');
    }
  } catch (error: any) {
    console.error('ImgBB Upload Exception:', error);
    throw error;
  }
}
