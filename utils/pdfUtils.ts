import * as pdfjsLib from 'pdfjs-dist';

// Configure the worker to use the same version from esm.sh
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

export const getPdfPageCount = async (file: File): Promise<number> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    // Load the document using pdfjs
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    return pdf.numPages;
  } catch (error) {
    console.error("Error counting PDF pages:", error);
    return 0; // Return 0 if failed, so we can fallback to indeterminate state
  }
};

interface ExtractedImage {
  page: number;
  url: string;
}

const uploadToCatbox = async (blob: Blob, filename: string): Promise<string | null> => {
  const formData = new FormData();
  formData.append('reqtype', 'fileupload');
  formData.append('fileToUpload', blob, filename);

  try {
    const response = await fetch('https://catbox.moe/user/api.php', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    const url = await response.text();
    return url;
  } catch (error) {
    console.warn("Catbox upload failed (likely CORS or network issue):", error);
    return null;
  }
};

export const extractImagesFromPdf = async (file: File): Promise<ExtractedImage[]> => {
  const images: ExtractedImage[] = [];
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const ops = await page.getOperatorList();
      
      for (let j = 0; j < ops.fnArray.length; j++) {
        const fn = ops.fnArray[j];
        
        // Check for paintImageXObject (usually means an image)
        if (fn === pdfjsLib.OPS.paintImageXObject) {
          const imgName = ops.argsArray[j][0];
          
          try {
            // Retrieve image object
            const imgObj = await page.objs.get(imgName);
            
            if (imgObj && imgObj.width && imgObj.height) {
              // Create a canvas to draw the image
              const canvas = document.createElement('canvas');
              canvas.width = imgObj.width;
              canvas.height = imgObj.height;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                // If it's a bitmap, we can draw it easily
                if (imgObj.bitmap) {
                   ctx.drawImage(imgObj.bitmap, 0, 0);
                } else if (imgObj.data) {
                   // Handle raw data (RGB/RGBA)
                   const imageData = new ImageData(
                     new Uint8ClampedArray(imgObj.data), 
                     imgObj.width, 
                     imgObj.height
                   );
                   ctx.putImageData(imageData, 0, 0);
                }

                // Convert to blob and upload
                const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png'));
                
                if (blob) {
                  const url = await uploadToCatbox(blob, `page_${i}_img_${j}.png`);
                  if (url) {
                    images.push({ page: i, url });
                  }
                }
              }
            }
          } catch (imgErr) {
            console.warn(`Failed to process image on page ${i}:`, imgErr);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error extracting images from PDF:", error);
  }

  return images;
};