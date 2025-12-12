import { GoogleGenAI, Type, Schema } from "@google/genai";
import { BookData, BookPage } from "../types";
import { getPdfPageCount, extractImagesFromPdf } from "../utils/pdfUtils";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to convert file to base64
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  });
  
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
};

// Robust JSON parser
const robustJsonParse = (jsonString: string): any => {
  let cleanString = jsonString.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  
  try {
    return JSON.parse(cleanString);
  } catch (error: any) {
    console.warn("JSON Parse failed, attempting recovery...", error.message);
    const pagesIndex = cleanString.indexOf('"pages"');
    if (pagesIndex === -1) throw error; 

    const lastPageEnd = cleanString.lastIndexOf('},');
    
    if (lastPageEnd > pagesIndex) {
      const recoveredString = cleanString.substring(0, lastPageEnd + 1) + ']}';
      try {
        const recoveredData = JSON.parse(recoveredString);
        console.log("Successfully recovered truncated JSON");
        return recoveredData;
      } catch (recoveryError) {
         const lastBrace = cleanString.lastIndexOf('}');
         if (lastBrace > pagesIndex) {
            const recoveredString2 = cleanString.substring(0, lastBrace + 1) + ']}';
            try {
              return JSON.parse(recoveredString2);
            } catch(e) {}
         }
      }
    }
    throw error;
  }
};

/**
 * PHASE 2: THE TWIN (A Gêmea)
 * Refines raw content for mobile reading, proper pagination, and chapter detection.
 */
const refineContentWithTheTwin = async (
  rawBook: Omit<BookData, 'id' | 'createdAt'>, 
  onProgress: (percent: number) => void
): Promise<Omit<BookData, 'id' | 'createdAt'>> => {
  
  console.log("Iniciando Fase 2: A Gêmea");
  
  // Combine all raw content to re-split intelligently
  const fullContent = rawBook.pages.map(p => p.content).join('\n\n');
  
  // Split content by rough chunks (e.g., Markdown headers # or ##) to process in manageable batches
  // or simple character chunks if headers aren't clear.
  // We use a safe chunk size (~15k characters) to fit in context and output
  const chunks: string[] = [];
  let currentChunk = "";
  const lines = fullContent.split('\n');
  
  for (const line of lines) {
    if ((currentChunk.length + line.length > 15000) && (line.startsWith('#') || line.trim() === '')) {
      chunks.push(currentChunk);
      currentChunk = line + "\n";
    } else {
      currentChunk += line + "\n";
    }
  }
  if (currentChunk) chunks.push(currentChunk);

  const refinedPages: BookPage[] = [];
  let currentPageOffset = 1;

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const progressBase = 60; // Starts at 60%
    const progressRange = 40; // Goes up to 100%
    const currentPercent = progressBase + Math.round(((i) / chunks.length) * progressRange);
    onProgress(currentPercent);

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [{
            text: `Você é a "Gêmea", uma editora de elite especializada em UX para leitura mobile.
            Sua tarefa é refinar o texto bruto extraído de um PDF.

            ENTRADA: Um trecho de texto bruto em Markdown.

            TAREFAS OBRIGATÓRIAS:
            1. **Reorganização Mobile**: Quebre parágrafos longos em parágrafos menores e mais legíveis. O texto deve respirar.
            2. **Identificação de Capítulo**: Analise o texto para identificar a qual capítulo ou seção ele pertence (Ex: "Capítulo 1", "Introdução", "Conclusão"). Se não houver título explícito, deduza pelo contexto do trecho anterior.
            3. **Repaginação**: Divida o conteúdo em páginas lógicas (aprox. 300-400 palavras por página). Não corte frases no meio.
            4. **Markdown Rico**:
               - Citações devem usar blockquote (>).
               - Listas devem estar formatadas corretamente.
               - Mantenha os links de imagem existentes ![...](...).
            5. **Índice**: Se encontrar o Índice/Sumário do livro, formate-o como uma lista de links limpa.

            SAÍDA: Um JSON contendo um array de objetos de página.
            `
          }, {
            text: `CONTEÚDO BRUTO PARA REFINAR:\n${chunk}`
          }]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              processedPages: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    content: { type: Type.STRING, description: "Conteúdo formatado em Markdown para mobile" },
                    chapterTitle: { type: Type.STRING, description: "Título do capítulo atual (ex: 'Capítulo 1: O Começo')" }
                  }
                }
              }
            }
          }
        }
      });

      if (response.text) {
        const json = robustJsonParse(response.text);
        if (json.processedPages && Array.isArray(json.processedPages)) {
          json.processedPages.forEach((p: any) => {
            refinedPages.push({
              pageNumber: currentPageOffset++,
              content: p.content,
              chapterTitle: p.chapterTitle || "Seção Geral"
            });
          });
        }
      }

    } catch (err) {
      console.error("Erro na Fase 2 (Chunking):", err);
      // Fallback: use raw chunk as a single page if Gemini fails
      refinedPages.push({
        pageNumber: currentPageOffset++,
        content: chunk,
        chapterTitle: "Conteúdo Recuperado"
      });
    }
  }

  return {
    title: rawBook.title,
    author: rawBook.author,
    pages: refinedPages
  };
};

export const parsePdfToBook = async (
  file: File, 
  onProgress: (percent: number) => void
): Promise<Omit<BookData, 'id' | 'createdAt'>> => {
  try {
    onProgress(5); // Started
    
    // 1. Get total pages for progress calculation
    const totalPages = await getPdfPageCount(file);
    console.log(`Total pages detected for ${file.name}: ${totalPages}`);

    onProgress(10); // Extracted page count

    // 2. Extract Images
    let imageContext = "";
    try {
      const images = await extractImagesFromPdf(file);
      if (images.length > 0) {
        imageContext = `\n\n**IMAGENS DISPONÍVEIS**:\nEncontrei as seguintes imagens extraídas do PDF. Se você identificar que uma dessas imagens pertence visualmente a um trecho do texto, insira-a usando Markdown padrão: ![Descrição da imagem](URL).\n\nLista de Imagens:\n${images.map(img => `- Página ${img.page}: ${img.url}`).join('\n')}\n`;
      }
    } catch (e) {
      console.warn("Image extraction skipped due to error:", e);
    }
    
    onProgress(15); 

    // 3. PHASE 1: Raw Extraction
    const pdfPart = await fileToGenerativePart(file);

    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          pdfPart,
          {
            text: `FASE 1: EXTRAÇÃO ESTRUTURAL
            Analise o PDF e extraia todo o texto mantendo a estrutura original.
            
            ${imageContext}

            OBJETIVO:
            Criar uma base fiel do conteúdo para posterior refinamento.
            
            1. Extraia Título e Autor.
            2. Extraia o conteúdo texto corrido.
            3. Identifique cabeçalhos com #, ##, ###.
            4. Insira as imagens nos locais corretos.
            
            Não se preocupe com a paginação perfeita agora, foque em não perder conteúdo.
            `
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            author: { type: Type.STRING },
            pages: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  pageNumber: { type: Type.INTEGER },
                  content: { type: Type.STRING }
                }
              }
            }
          }
        }
      }
    });

    let fullText = '';
    
    for await (const chunk of responseStream) {
      const chunkText = chunk.text || '';
      fullText += chunkText;

      if (totalPages > 0) {
        const matches = fullText.match(/"pageNumber":/g);
        const pagesProcessed = matches ? matches.length : 0;
        // Phase 1 goes from 15% to 60%
        const percent = 15 + Math.min(45, Math.round((pagesProcessed / totalPages) * 45));
        onProgress(percent);
      }
    }

    if (!fullText) throw new Error("Sem resposta do Gemini");

    const rawData = robustJsonParse(fullText) as Omit<BookData, 'id' | 'createdAt'>;
    
    // 4. PHASE 2: The Twin (Refinement)
    onProgress(60); // Start Phase 2
    const refinedData = await refineContentWithTheTwin(rawData, onProgress);
    
    onProgress(100); 
    return refinedData;

  } catch (error) {
    console.error(`Erro ao processar ${file.name}:`, error);
    throw error;
  }
};
