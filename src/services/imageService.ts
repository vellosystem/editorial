import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export interface GeneratedCreative {
  feedImageUrl: string;
  storyImageUrl: string;
  caption: string;
}

export async function generateImagesFromPrompt(
  brandAssets: {
    logoLightImage?: { data: string; mimeType: string } | null;
    logoDarkImage?: { data: string; mimeType: string } | null;
    typographyImage?: { data: string; mimeType: string } | null;
    graphicElementsImage?: { data: string; mimeType: string } | null;
    referenceCreativeImages?: ({ data: string; mimeType: string } | null)[];
  },
  visualPrompt: string,
  contentTitle: string,
  artDirection: string,
  caption: string,
  onProgress?: (progress: number) => void,
  referenceImage?: { data: string; mimeType: string } | null,
  fontReferenceImage?: { data: string; mimeType: string } | null
): Promise<{ feedImageUrl: string; storyImageUrl: string }> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  if (onProgress) onProgress(5);

  // Generate a short, punchy headline based on the caption to be used on the image
  let imageText = contentTitle; // Fallback
  try {
    const textResponse = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Baseado nesta legenda de post de rede social: "${caption}"
      
      Crie uma frase MUITO CURTA (máximo de 3 a 5 palavras) e de alto impacto para ser escrita DENTRO da imagem do post.
      A frase deve ser criativa, fazer sentido com a legenda e chamar atenção.
      Retorne APENAS a frase, sem aspas, sem explicações.`,
    });
    if (textResponse.text) {
      imageText = textResponse.text.trim().replace(/^["']|["']$/g, ''); // Remove quotes if any
    }
  } catch (error) {
    console.error("Error generating image text, falling back to title:", error);
  }

  if (onProgress) onProgress(15);

  const parts: any[] = [];
  
  if (brandAssets.logoLightImage) {
    parts.push({ text: "Brand Logo (Light):" }, { inlineData: { data: brandAssets.logoLightImage.data, mimeType: brandAssets.logoLightImage.mimeType } });
  }
  if (brandAssets.logoDarkImage) {
    parts.push({ text: "Brand Logo (Dark):" }, { inlineData: { data: brandAssets.logoDarkImage.data, mimeType: brandAssets.logoDarkImage.mimeType } });
  }
  if (brandAssets.typographyImage) {
    parts.push({ text: "Typography Style:" }, { inlineData: { data: brandAssets.typographyImage.data, mimeType: brandAssets.typographyImage.mimeType } });
  }
  if (brandAssets.graphicElementsImage) {
    parts.push({ text: "Graphic Elements:" }, { inlineData: { data: brandAssets.graphicElementsImage.data, mimeType: brandAssets.graphicElementsImage.mimeType } });
  }
  if (brandAssets.referenceCreativeImages) {
    brandAssets.referenceCreativeImages.forEach((img, idx) => {
      if (img) {
        parts.push({ text: `Reference Creative Style ${idx + 1}:` }, { inlineData: { data: img.data, mimeType: img.mimeType } });
      }
    });
  }

  if (referenceImage) {
    parts.push({ text: "USER ATTACHED IMAGE (USE AS BASE FOR THIS CONTENT):" }, { inlineData: { data: referenceImage.data, mimeType: referenceImage.mimeType } });
  }

  if (fontReferenceImage) {
    parts.push({ text: "FONT REFERENCE IMAGE (MANDATORY: USE THIS FONT STYLE FOR ALL TEXT IN THE IMAGE):" }, { inlineData: { data: fontReferenceImage.data, mimeType: fontReferenceImage.mimeType } });
  }

  // 1. Generate Feed Image (4:5)
  if (onProgress) onProgress(20);
  const feedResponse = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: {
      parts: [
        ...parts,
        { text: `Create a high-quality Instagram Feed post (4:5). 
Topic: ${contentTitle}
Brand Art Direction: ${artDirection}
Specific Visual Prompt: ${visualPrompt}

BRAND FIDELITY GUIDELINES:
1. FOUNDATION: Use the provided "Brand Logo", "Typography Style", "Graphic Elements", and "FONT REFERENCE IMAGE" reference images as the MANDATORY foundation for the brand's visual identity. The generated image MUST reflect this identity.
2. LOGO INTEGRATION: Analyze the background and apply the most visible version of the provided logo (Light/Dark). Place it professionally.
3. TYPOGRAPHY (MANDATORY): The text "${imageText}" MUST be written using the EXACT font from the attached "FONT REFERENCE IMAGE". REPLICATE the letterforms exactly. CRITICAL: Apply this font style ONLY to the text! The rest of the image background, elements, and composition MUST remain highly professional, photorealistic, and cinematic. Do NOT make the entire image cartoonish or flat.
4. GRAPHIC ELEMENTS: Incorporate the provided "Graphic Elements" into the composition in a way that feels organic and professional.
5. STYLE INSPIRATION: Use the "Reference Creative Style" images as the primary source for the visual vibe, color palette, and layout. Feel free to create a unique, creative composition, but it MUST feel like it belongs to the same brand as the reference creatives.
6. The text "${imageText}" should be included in the image.
7. Ensure the final result looks like a high-end, professional advertising piece.` }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: "4:5",
        imageSize: "1K"
      }
    }
  });

  if (onProgress) onProgress(55);

  // 2. Generate Story Image (9:16)
  const storyResponse = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: {
      parts: [
        ...parts,
        { text: `Create a high-quality Instagram Story (9:16). 
Topic: ${contentTitle}
Brand Art Direction: ${artDirection}
Specific Visual Prompt: ${visualPrompt}

BRAND FIDELITY GUIDELINES:
1. FOUNDATION: Use the provided "Brand Logo", "Typography Style", "Graphic Elements", and "FONT REFERENCE IMAGE" reference images as the MANDATORY foundation for the brand's visual identity. The generated image MUST reflect this identity.
2. LOGO INTEGRATION: Analyze the background and apply the most visible version of the provided logo (Light/Dark). Place it professionally.
3. TYPOGRAPHY (MANDATORY): The text "${imageText}" MUST be written using the EXACT font from the attached "FONT REFERENCE IMAGE". REPLICATE the letterforms exactly. CRITICAL: Apply this font style ONLY to the text! The rest of the image background, elements, and composition MUST remain highly professional, photorealistic, and cinematic. Do NOT make the entire image cartoonish or flat.
4. GRAPHIC ELEMENTS: Incorporate the provided "Graphic Elements" into the composition in a way that feels organic and professional.
5. STYLE INSPIRATION: Use the "Reference Creative Style" images as the primary source for the visual vibe, color palette, and layout. Feel free to create a unique, creative composition, but it MUST feel like it belongs to the same brand as the reference creatives.
6. The text "${imageText}" should be included in the image.
7. Ensure the final result looks like a high-end, professional advertising piece.` }
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: "9:16",
        imageSize: "1K"
      }
    }
  });

  if (onProgress) onProgress(90);

  let feedImageUrl = "";
  for (const part of feedResponse.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      feedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
      break;
    }
  }

  let storyImageUrl = "";
  for (const part of storyResponse.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) {
      storyImageUrl = `data:image/png;base64,${part.inlineData.data}`;
      break;
    }
  }

  if (onProgress) onProgress(100);

  return { feedImageUrl, storyImageUrl };
}

export async function generateVideoFromPrompt(
  visualPrompt: string,
  contentTitle: string,
  artDirection: string,
  options: {
    aspectRatio?: '16:9' | '9:16';
    resolution?: '720p' | '1080p';
    logoLightImage?: { data: string; mimeType: string } | null;
    logoDarkImage?: { data: string; mimeType: string } | null;
    referenceImage?: { data: string; mimeType: string } | null;
    fontReferenceImage?: { data: string; mimeType: string } | null;
  } = {},
  onProgress?: (progress: number) => void
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  // Use 720p by default when a logo is provided for better compatibility with reference images
  const { 
    aspectRatio = '16:9', 
    resolution = (options.logoLightImage || options.logoDarkImage || options.referenceImage || options.fontReferenceImage) ? '720p' : '1080p', 
    logoLightImage,
    logoDarkImage,
    referenceImage,
    fontReferenceImage
  } = options;

  const logoToUse = logoLightImage || logoDarkImage;

  const videoConfig: any = {
    numberOfVideos: 1,
    resolution,
    aspectRatio
  };

  const videoRequest: any = {
    model: 'veo-3.1-lite-generate-preview',
    prompt: `Create a professional social media video about: ${contentTitle}.
    Visual Style: ${artDirection}.
    Scene Description: ${visualPrompt}.
    
    BRAND FIDELITY GUIDELINES:
    1. FOUNDATION: Use the provided "Brand Logo", "Reference Images", and "Font Reference" as the MANDATORY foundation for the brand's visual identity. The video MUST reflect this identity.
    2. CREATIVITY: Be creative and impactful. Use the references for stylistic inspiration (sophistication, style) but create an original composition that feels like an official brand piece.
    3. LOGO & CONTRAST: The video should feature the provided brand logo. Use the version that offers the best contrast against the final frame.
    4. FORMAT: The video MUST be in ${aspectRatio === '9:16' ? 'VERTICAL (9:16) format' : 'HORIZONTAL (16:9) format'}.
    5. TEXT (MANDATORY): The text "${contentTitle}" MUST be written in the video using the EXACT font style from the "Font Reference" image provided. REPLICATE the letterforms exactly. CRITICAL: Apply this font style ONLY to the text! The rest of the video MUST remain highly professional, photorealistic, and cinematic. Do NOT make the entire video cartoonish or flat.
    6. QUALITY: High-end cinematic quality, smooth transitions, and professional lighting.`,
    config: videoConfig
  };

  if (referenceImage || logoToUse || fontReferenceImage) {
    // Providing both start (image) and end (lastFrame) images often resolves "Unsupported request" errors
    // when using reference images in Veo models.
    const baseImage = referenceImage || logoToUse || fontReferenceImage;
    if (baseImage) {
      videoRequest.image = {
        imageBytes: baseImage.data,
        mimeType: baseImage.mimeType
      };
    }
    
    if (logoToUse) {
      videoConfig.lastFrame = {
        imageBytes: logoToUse.data,
        mimeType: logoToUse.mimeType
      };
    }
  }

  let operation = await ai.models.generateVideos(videoRequest);

  // Poll for completion
  let progress = 0;
  let pollCount = 0;
  while (!operation.done) {
    pollCount++;
    const metadata = (operation as any).metadata;
    if (metadata && typeof metadata.progressNumber === 'number') {
      progress = metadata.progressNumber;
    } else if (metadata && typeof metadata.progress === 'number') {
      progress = metadata.progress;
    } else {
      progress = Math.min(progress + 4, 98);
    }
    
    if (onProgress) onProgress(progress);
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  if (onProgress) onProgress(100);

  if (operation.error) {
    console.error("Video generation operation error:", operation.error);
    if (operation.error.code === 400) {
      throw new Error(`Video generation failed: The model rejected the request. This usually happens when the combination of resolution, aspect ratio, and reference images is not supported. Try using 720p and 16:9 ratio, or try generating without a logo.`);
    }
    throw new Error(`Video generation failed: ${operation.error.message || 'Unknown error'}`);
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) {
    console.error("Video generation response missing download link:", operation.response);
    throw new Error("Failed to generate video: No download link returned from server");
  }

  // To fetch the video, append the Gemini API key to the `x-goog-api-key` header.
  // We try both process.env.API_KEY and process.env.GEMINI_API_KEY as per instructions
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY || '';
  
  const response = await fetch(downloadLink, {
    method: 'GET',
    headers: {
      'x-goog-api-key': apiKey,
    },
  });
  
  if (!response.ok) throw new Error("Failed to fetch generated video");
  
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}
