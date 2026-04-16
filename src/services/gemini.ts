import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface GeneratedContent {
  title: string;
  caption: string;
  visualPromptImage: string;
  visualPromptVideo: string;
  platform: string;
  format: string;
  date: string;
}

export async function generateProjectStrategy(name: string, description: string, images?: { data: string; mimeType: string }[]) {
  const prompt = `
    Você é um estrategista de marketing digital e diretor de arte especialista em criação de marcas.
    O usuário quer criar um projeto para a marca "${name}", que faz o seguinte: "${description}".
    
    Com base nisso, gere uma estratégia de conteúdo completa preenchendo os seguintes campos:
    - Público-alvo (targetAudience)
    - Tom de voz (toneOfVoice)
    - Objetivos principais (mainGoals)
    - Pilares de conteúdo (contentPillars)
    - Concorrentes/Referências genéricas do nicho (competitors)
    - Palavras-chave (keywords)
    - Valores da Marca (brandValues): 3 a 5 valores fundamentais.
    - O que EVITAR (avoidTopics): Temas, abordagens ou termos que a marca não deve usar.
    - Direcionamento de Arte (artDirection): Baseado na descrição da marca e nas imagens de referência fornecidas (se houver), descreva o estilo visual, cores predominantes, tipografia e a "vibe" que a marca deve transmitir.
    
    Seja direto, profissional e estratégico.
  `;

  const contents: any[] = [];
  if (images && images.length > 0) {
    contents.push({ text: "Imagens de Referência da Marca:" });
    images.forEach(img => {
      contents.push({ inlineData: { data: img.data, mimeType: img.mimeType } });
    });
  }
  contents.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts: contents },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          targetAudience: { type: Type.STRING },
          toneOfVoice: { type: Type.STRING },
          mainGoals: { type: Type.STRING },
          contentPillars: { type: Type.STRING },
          competitors: { type: Type.STRING },
          keywords: { type: Type.STRING },
          brandValues: { type: Type.STRING },
          avoidTopics: { type: Type.STRING },
          artDirection: { type: Type.STRING }
        },
        required: ["targetAudience", "toneOfVoice", "mainGoals", "contentPillars", "competitors", "keywords", "brandValues", "avoidTopics", "artDirection"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

export async function generateEditorialLine(project: {
  name: string;
  description: string;
  targetAudience: string;
  toneOfVoice: string;
  mainGoals: string;
  contentPillars: string;
  competitors: string;
  keywords: string;
  brandValues?: string;
  avoidTopics?: string;
  artDirection?: string;
  logoLightImage?: { data: string; mimeType: string } | null;
  logoDarkImage?: { data: string; mimeType: string } | null;
  typographyImage?: { data: string; mimeType: string } | null;
  graphicElementsImage?: { data: string; mimeType: string } | null;
  referenceCreativeImages?: ({ data: string; mimeType: string } | null)[];
}, startDate: string, days: number): Promise<GeneratedContent[]> {
  const prompt = `
    Crie uma linha editorial estratégica de ${days} dias para a marca "${project.name}".
    
    CONTEXTO ESTRATÉGICO:
    - Descrição: ${project.description}
    - Público-alvo: ${project.targetAudience}
    - Tom de voz: ${project.toneOfVoice}
    - Objetivos: ${project.mainGoals}
    - Pilares de Conteúdo: ${project.contentPillars}
    - Referências/Concorrentes: ${project.competitors}
    - Palavras-chave: ${project.keywords}
    - Valores da Marca: ${project.brandValues || 'Não especificado.'}
    - O que EVITAR: ${project.avoidTopics || 'Não especificado.'}
    - Direcionamento de Arte: ${project.artDirection || 'Não especificado.'}
    
    Data de início: ${startDate}

    INSTRUÇÕES CRÍTICAS:
    1. Para cada dia, gere um conteúdo estratégico para Instagram ou Facebook.
    2. Alterne entre os pilares de conteúdo mencionados.
    3. Use as palavras-chave de forma natural.
    4. EVITE REPETIÇÃO: Cada post deve ter um ângulo, gancho e abordagem ÚNICOS. Não repita o mesmo tema ou estrutura de legenda em dias próximos. Varie os formatos (Reel, Post, Story, Carousel) de forma equilibrada.
    5. RESPEITE O QUE EVITAR: Nunca aborde temas ou use tons listados em "O que EVITAR".
    6. INTELIGÊNCIA DE DATAS E EVENTOS: Analise a descrição do projeto e objetivos em busca de DATAS ESPECÍFICAS de eventos, lançamentos ou marcos. 
       - Se houver um evento mencionado (ex: "Evento dia 19/10"), crie uma sequência lógica e estratégica: "Save the Date", "Contagem Regressiva", "É Hoje", "Obrigado/Recap".
       - NUNCA coloque uma contagem regressiva para uma data que já passou ou que está muito distante sem nexo (ex: evento dia 19/10 e contagem regressiva em 10/11).
       - A linha editorial deve fazer sentido CRONOLÓGICO com o calendário real a partir da data de início fornecida (${startDate}).
    5. LEGENDA (caption): Crie legendas ALTAMENTE ENGAJADORAS com formatação IMPECÁVEL para o Instagram. 
       - Use quebras de linha (parágrafos curtos) para respiro e leitura fácil.
       - Adicione emojis estrategicamente (sem poluir).
       - Inclua um gancho (hook) forte na primeira linha.
       - Desenvolva o conteúdo com clareza e pontuação perfeita.
       - Finalize SEMPRE com uma Chamada para Ação (CTA) clara.
       - Inclua hashtags relevantes no final.
    121. PROMPT VISUAL (visualPromptImage/visualPromptVideo): Forneça apenas uma descrição BREVE e CONCEITUAL em inglês (ex: "Modern lifestyle scene with brand colors"). Não gaste muitos tokens aqui, pois o prompt detalhado será gerado individualmente depois. 
    
    O FOCO TOTAL deve ser na ESTRATÉGIA e na LEGENDA (caption). As legendas devem ser ricas, contextualizadas e prontas para uso, pois elas servirão de base para a geração dos prompts visuais definitivos posteriormente.
    
    Retorne um array JSON de objetos seguindo o schema.
  `;

  const parts: any[] = [];
  
  if (project.logoLightImage) {
    parts.push({ text: "Logo da Marca (Versão Clara):" }, { inlineData: { data: project.logoLightImage.data, mimeType: project.logoLightImage.mimeType } });
  }
  if (project.logoDarkImage) {
    parts.push({ text: "Logo da Marca (Versão Escura):" }, { inlineData: { data: project.logoDarkImage.data, mimeType: project.logoDarkImage.mimeType } });
  }
  if (project.typographyImage) {
    parts.push({ text: "Estilo de Tipografia / Fonte:" }, { inlineData: { data: project.typographyImage.data, mimeType: project.typographyImage.mimeType } });
  }
  if (project.graphicElementsImage) {
    parts.push({ text: "Elementos Gráficos da Marca:" }, { inlineData: { data: project.graphicElementsImage.data, mimeType: project.graphicElementsImage.mimeType } });
  }
  if (project.referenceCreativeImages) {
    project.referenceCreativeImages.forEach((img, idx) => {
      if (img) {
        parts.push({ text: `Criativo de Referência ${idx + 1}:` }, { inlineData: { data: img.data, mimeType: img.mimeType } });
      }
    });
  }

  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            caption: { type: Type.STRING },
            visualPromptImage: { type: Type.STRING, description: "Prompt detalhado para uma IA geradora de imagens criar a arte ESTÁTICA deste post" },
            visualPromptVideo: { type: Type.STRING, description: "Prompt detalhado para uma IA geradora de VÍDEO criar o conteúdo em movimento deste post" },
            platform: { type: Type.STRING, enum: ["Instagram", "Facebook", "Both"] },
            format: { type: Type.STRING, enum: ["Reel", "Post", "Story", "Carousel"] },
            date: { type: Type.STRING, description: "Data no formato YYYY-MM-DD" }
          },
          required: ["title", "caption", "visualPromptImage", "visualPromptVideo", "platform", "format", "date"]
        }
      }
    }
  });

  return JSON.parse(response.text || "[]");
}

export async function generateSingleVisualPrompt(
  project: any,
  contentTitle: string,
  contentCaption: string,
  type: 'image' | 'video' = 'image',
  referenceImage?: { data: string; mimeType: string } | null,
  fontReferenceImage?: { data: string; mimeType: string } | null
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

  const isVideo = type === 'video';

  const prompt = `
    Você é um Diretor de Arte Especialista em IA.
    Sua tarefa é criar um PROMPT VISUAL em INGLÊS extremamente detalhado para um gerador de ${isVideo ? 'VÍDEO (Veo 3.1)' : 'IMAGENS (Midjourney/DALL-E/Gemini)'} criar a arte de um post de rede social.

    Título do Post: "${contentTitle}"
    Legenda do Post: "${contentCaption}"
    Direcionamento de Arte da Marca: "${project.artDirection || 'Não especificado'}"

    INSTRUÇÕES DE CRIAÇÃO:
    1. FIDELIDADE VISUAL (DNA DA MARCA): Analise as imagens de referência (Logo, Tipografia, Elementos Gráficos e Criativos) e use-as como a FUNDAÇÃO OBRIGATÓRIA para o DNA visual da marca. O prompt gerado DEVE descrever com precisão as cores, o estilo de tipografia, os padrões de layout e o tratamento de imagem que façam sentido com a marca.
    2. CRIATIVIDADE E ORIGINALIDADE: O objetivo é criar algo impactante e original. Use as referências para entender a "vibe" e o "nível de sofisticação", mas crie uma imagem original que conte a história do post de forma criativa e surpreendente, SEMPRE respeitando o DNA visual da marca.
    3. EQUILÍBRIO: O resultado deve parecer uma peça publicitária profissional da marca, mas com um conceito visual novo e criativo.
    ${referenceImage ? '4. IMPORTANTE: O usuário anexou uma IMAGEM ESPECÍFICA para este post. Use esta imagem como BASE principal para a composição, estilo ou tema do conteúdo. Sinta-se livre para integrar os elementos da marca de forma criativa nesta imagem.' : '4. AVISO IMPORTANTE: As referências da marca servem como guia de estilo visual (cores, layout, elementos).'}
    ${fontReferenceImage ? '5. EXACT FONT REPLICATION (MANDATORY): The user attached a "FONT REFERENCE IMAGE". Instruct the generator to replicate this exact font style (e.g., if it is flat 2D, specify NO 3D effects) FOR THE TEXT ONLY. CRITICAL: You MUST explicitly state that the overall image style MUST REMAIN HIGH-END, PHOTOREALISTIC, AND PROFESSIONAL. Do NOT let the font style (like "cartoonish" or "flat") bleed into the background or overall composition.' : ''}
    6. Incorpore o Direcionamento de Arte da Marca de forma orgânica.
    6. Estruture o prompt visual detalhando:
       ${isVideo ? `
       * Subject/Action: O que está acontecendo na imagem (o tema do post), focando em MOVIMENTO dinâmico e cinematografia.
       * Style/Medium: Estilo cinematográfico, movimentos de câmera, iluminação dramática.
       * Color Palette: Cores sugeridas baseadas nas referências e na marca.
       * Motion: Detalhe como os elementos se movem, a velocidade e a fluidez.
       ` : `
       * Subject/Action: O que está acontecendo na imagem (o tema do post).
       * Style/Medium: Estilo sugerido (ex: "mixed media, collage style, real photography combined with vector graphics").
       * Color Palette: Cores sugeridas baseadas nas referências e na marca.
       * Lighting: Ex: "studio lighting, high contrast, vibrant".
       * Composition & Layout: Sugestão de composição para os elementos gráficos e texto.
       `}
    7. O prompt deve ser um parágrafo contínuo em inglês.
    8. O prompt deve ser descritivo o suficiente para que a IA entenda como aplicar a direção de arte, as cores e a tipografia de forma harmoniosa e criativa.

    Retorne APENAS o texto do prompt em inglês, sem aspas adicionais, sem formatação markdown, apenas o texto puro.
  `;

  const parts: any[] = [];
  
  if (project.logoLightImage) {
    parts.push({ text: "Logo da Marca (Versão Clara):" }, { inlineData: { data: project.logoLightImage.data, mimeType: project.logoLightImage.mimeType } });
  }
  if (project.logoDarkImage) {
    parts.push({ text: "Logo da Marca (Versão Escura):" }, { inlineData: { data: project.logoDarkImage.data, mimeType: project.logoDarkImage.mimeType } });
  }
  if (project.typographyImage) {
    parts.push({ text: "Estilo de Tipografia / Fonte:" }, { inlineData: { data: project.typographyImage.data, mimeType: project.typographyImage.mimeType } });
  }
  if (project.graphicElementsImage) {
    parts.push({ text: "Elementos Gráficos da Marca:" }, { inlineData: { data: project.graphicElementsImage.data, mimeType: project.graphicElementsImage.mimeType } });
  }
  if (project.referenceCreativeImages) {
    project.referenceCreativeImages.forEach((img: any, idx: number) => {
      if (img) {
        parts.push({ text: `Criativo de Referência ${idx + 1}:` }, { inlineData: { data: img.data, mimeType: img.mimeType } });
      }
    });
  }

  if (referenceImage) {
    parts.push({ text: "IMAGEM DE BASE PARA ESTE CONTEÚDO ESPECÍFICO:" }, { inlineData: { data: referenceImage.data, mimeType: referenceImage.mimeType } });
  }

  if (fontReferenceImage) {
    parts.push({ text: "REFERÊNCIA DE FONTE PARA OS TÍTULOS DESTE POST:" }, { inlineData: { data: fontReferenceImage.data, mimeType: fontReferenceImage.mimeType } });
  }

  parts.push({ text: prompt });

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: { parts }
  });

  return response.text?.trim() || "";
}

export interface GeneratedEmail {
  subject: string;
  previewText: string;
  htmlContent: string;
}

export async function generateEmailTemplate(project: any, userPrompt: string): Promise<GeneratedEmail> {
  const prompt = `
    Você é um Especialista em E-mail Marketing e Copywriter de alta conversão.
    Sua tarefa é criar um template de e-mail marketing completo e profissional para a marca "${project.name}".
    
    CONTEXTO DA MARCA:
    - Descrição: ${project.description}
    - Público-alvo: ${project.targetAudience}
    - Tom de voz: ${project.toneOfVoice}
    - Direcionamento de Arte: ${project.artDirection}
    
    COMANDO DO USUÁRIO:
    "${userPrompt}"
    
    REQUISITOS TÉCNICOS E DE DESIGN:
    1. ASSUNTO (subject): Deve ser irresistível, curto e focado em abertura.
    2. TEXTO DE APOIO (previewText): Complementa o assunto para aumentar o CTR.
    3. HTML CONTENT:
       - Use HTML inline CSS (essencial para e-mail).
       - O design deve ser responsivo (mobile-friendly).
       - Use uma estrutura de tabela (table) para máxima compatibilidade.
       - Inclua um Header com o nome da marca.
       - O corpo deve ter parágrafos curtos e escaneáveis.
       - Inclua um botão de Chamada para Ação (CTA) centralizado e com cor de destaque.
       - O Footer deve conter informações de descadastro (placeholder) e redes sociais.
       - O design deve refletir o "Direcionamento de Arte" da marca (cores e vibe).
       - NÃO use imagens externas reais, use placeholders de cores ou formas se necessário.
    
    Retorne um objeto JSON seguindo o schema.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          previewText: { type: Type.STRING },
          htmlContent: { type: Type.STRING }
        },
        required: ["subject", "previewText", "htmlContent"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}
