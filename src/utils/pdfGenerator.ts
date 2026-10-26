import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { PaperSize } from '../types';

export interface ExportPdfOptions {
  filename?: string;
  orientation?: 'landscape' | 'portrait';
  elementId: string;
  paperSize?: PaperSize;
  onProgress?: (status: string) => void;
}

// Paper dimensions in mm
const PAPER_DIMENSIONS = {
  F4: {
    landscape: { width: 330, height: 215 },
    portrait: { width: 215, height: 330 },
  },
  A4: {
    landscape: { width: 297, height: 210 },
    portrait: { width: 210, height: 297 },
  },
};

export async function exportToPdfClient(options: ExportPdfOptions): Promise<boolean> {
  const {
    filename = 'Dokumen-AsistenGuru.pdf',
    orientation = 'landscape',
    elementId,
    paperSize = 'F4',
    onProgress,
  } = options;

  const element = document.getElementById(elementId);
  if (!element) {
    console.error(`Element #${elementId} not found`);
    return false;
  }

  // Pre-capture delay to ensure web fonts, icons, and logos are completely rendered
  await new Promise((resolve) => setTimeout(resolve, 200));

  const paperDims = PAPER_DIMENSIONS[paperSize][orientation];
  const scales = [2, 1.5, 1.2, 1];

  for (let i = 0; i < scales.length; i++) {
    const scale = scales[i];
    try {
      if (onProgress) {
        onProgress(`Menyiapkan render PDF ${paperSize} (${scale}x)...`);
      }

      const canvas = await html2canvas(element, {
        scale: scale,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
        windowWidth: paperSize === 'F4' ? 1650 : 1450,
        onclone: (clonedDoc) => {
          const clonedElement = clonedDoc.getElementById(elementId);
          if (clonedElement) {
            // Unconstrain ALL ancestor elements
            let parent = clonedElement.parentElement;
            while (parent && parent !== clonedDoc.body) {
              parent.style.overflow = 'visible';
              parent.style.maxHeight = 'none';
              parent.style.height = 'auto';
              parent.style.maxWidth = 'none';
              parent.style.width = 'auto';
              parent.style.position = 'static';
              parent.style.transform = 'none';
              parent = parent.parentElement;
            }

            // Unconstrain target element
            clonedElement.style.overflow = 'visible';
            clonedElement.style.maxHeight = 'none';
            clonedElement.style.height = 'auto';
            clonedElement.style.width = paperSize === 'F4' ? '1140px' : '990px';
            clonedElement.style.minWidth = paperSize === 'F4' ? '1140px' : '990px';
            clonedElement.style.margin = '0 auto';
            clonedElement.style.padding = '8px 12px';
            clonedElement.style.boxSizing = 'border-box';

            // Unconstrain all child tables and scrollable wrapper divs
            const scrollWrappers = clonedElement.querySelectorAll('div, table, tr, td, th');
            scrollWrappers.forEach((el) => {
              const htmlEl = el as HTMLElement;
              if (htmlEl.style) {
                htmlEl.style.overflow = 'visible';
                htmlEl.style.maxHeight = 'none';
              }
            });
          }
        },
      });

      if (onProgress) {
        onProgress(`Menyusun halaman PDF ${paperSize}...`);
      }

      const pdf = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: paperSize === 'A4' ? 'a4' : [paperDims.width, paperDims.height],
        compress: true,
      });

      const margin = 5; // 5mm margin
      const printableWidth = paperDims.width - margin * 2;
      const printableHeight = paperDims.height - margin * 2;
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = imgWidth / imgHeight;
      const renderWidth = printableWidth;
      const renderHeight = renderWidth / ratio;

      if (renderHeight > printableHeight) {
        const totalPages = Math.ceil(renderHeight / printableHeight);
        const canvasPageHeight = (canvas.width * printableHeight) / printableWidth;

        for (let page = 0; page < totalPages; page++) {
          if (page > 0) {
            pdf.addPage(paperSize === 'A4' ? 'a4' : [paperDims.width, paperDims.height], orientation);
          }

          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          const sliceHeight = Math.min(canvasPageHeight, canvas.height - page * canvasPageHeight);
          pageCanvas.height = sliceHeight;
          const ctx = pageCanvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            ctx.drawImage(
              canvas,
              0,
              page * canvasPageHeight,
              canvas.width,
              sliceHeight,
              0,
              0,
              canvas.width,
              sliceHeight
            );
            const sliceImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
            const sliceRenderHeight = (sliceHeight * printableWidth) / canvas.width;
            pdf.addImage(sliceImgData, 'JPEG', margin, margin, printableWidth, sliceRenderHeight, undefined, 'FAST');
          }
        }
      } else {
        const posX = margin;
        const posY = margin + (printableHeight - renderHeight) / 2;
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(imgData, 'JPEG', posX, posY, renderWidth, renderHeight, undefined, 'FAST');
      }

      pdf.save(filename);
      if (onProgress) {
        onProgress('Selesai!');
      }
      return true;
    } catch (err) {
      console.warn(`Render scale ${scale}x error:`, err);
      if (i === scales.length - 1) {
        console.warn('Canvas render failed, using print dialog.');
        printDocumentUniversal({ elementId, paperSize });
        return false;
      }
    }
  }
  return false;
}

export function printDocumentUniversal(options: { elementId: string; paperSize?: PaperSize }): void {
  const { elementId, paperSize = 'F4' } = options;
  const element = document.getElementById(elementId);
  if (!element) {
    console.warn(`Element #${elementId} not found, falling back to window.print()`);
    try { window.print(); } catch {}
    return;
  }

  document.querySelectorAll('.printable-document-root').forEach((el) => {
    el.classList.remove('printable-document-root');
  });

  element.classList.add('printable-document-root');
  document.body.classList.remove('print-a4', 'print-f4');
  document.body.classList.add(`print-${paperSize.toLowerCase()}`);

  const cleanup = () => {
    element.classList.remove('printable-document-root');
    document.body.classList.remove('print-a4', 'print-f4');
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  setTimeout(() => {
    try {
      window.print();
    } catch (err) {
      console.warn('Direct window.print failed, falling back to PDF download:', err);
      exportToPdfClient({
        elementId,
        paperSize,
        filename: `Dokumen_${paperSize}_${new Date().toISOString().split('T')[0]}.pdf`,
      });
    }
  }, 50);

  setTimeout(cleanup, 4000);
}
