import { CommonModule } from '@angular/common';
import { Component, ElementRef, signal, ViewChild } from '@angular/core';
import { PdfViewerModule } from 'ng2-pdf-viewer';
import { NgxExtendedPdfViewerModule } from 'ngx-extended-pdf-viewer';
import { PDFDocument } from 'pdf-lib';
@Component({
  selector: 'app-pdf-editor-component',
  imports: [PdfViewerModule, CommonModule, NgxExtendedPdfViewerModule],
  templateUrl: './pdf-editor-component.html',
  styleUrl: './pdf-editor-component.scss',
  standalone: true,
})
export class PdfEditorComponent {
  pdfSrc = signal<string | undefined>(undefined);
  isLoading = signal(false);
  modifiedPdfBytes?: Uint8Array;
  currentPdfDoc?: PDFDocument;
  uploadedPdfBytes = signal<any | undefined>(undefined);
  originalPdfBytes = signal<Uint8Array | undefined>(undefined);
  
  logoBytes = signal<Uint8Array | undefined>(undefined);
  logoFileType = signal<string | undefined>(undefined);
  logoPosition: { left: number; top: number } | null = null;
  @ViewChild('logoEl') logoEl?: ElementRef<HTMLImageElement>;
  logoSize = { width: 100, height: 100 };
  private dragging = false;
  private dragOffset = { x: 0, y: 0 };
  private resizing = false;
  private resizeDir: string | null = null;
  private startX = 0;
  private startY = 0;
  private startWidth = 0;
  private startHeight = 0;
  private startLeft = 0;
  private startTop = 0;

  async onPdfUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.isLoading.set(true);
    const ab = await file.arrayBuffer();
    this.originalPdfBytes.set(new Uint8Array(ab));
    this.uploadedPdfBytes.set(ab.slice(0));
    this.currentPdfDoc = await PDFDocument.load(ab);
    const url = URL.createObjectURL(
      new Blob([ab], { type: 'application/pdf' })
    );
    this.pdfSrc.set(url);
    this.isLoading.set(false);

    console.log(url);
    
  }
  async onLogoUpload(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.logoFileType.set(file.type);
    const ab = await file.arrayBuffer();
    this.logoBytes.set(new Uint8Array(ab));
    this.logoPosition = { left: 200, top: 200 };
  }
  getLogoBase64(): string | undefined {
    const bytes = this.logoBytes();
    if (!bytes) return undefined;
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return 'data:image/png;base64,' + btoa(binary);
  }
  onLogoMouseDown(event: MouseEvent) {
    if (!this.logoPosition) return;
    this.dragging = true;
    this.dragOffset = {
      x: event.clientX - this.logoPosition.left,
      y: event.clientY - this.logoPosition.top,
    };
  }
  onMouseMove(event: MouseEvent) {
    if (!this.dragging || !this.logoPosition) return;
    this.logoPosition.left = event.clientX - this.dragOffset.x;
    this.logoPosition.top = event.clientY - this.dragOffset.y;
  }
  onMouseUp() {
    this.dragging = false;
  }
  async confirmPlacement() {
    if (!this.logoBytes() || !this.uploadedPdfBytes() || !this.currentPdfDoc)
      return;
    const logoEl = this.logoEl?.nativeElement;
    if (!logoEl) return;
    const logoRect = logoEl.getBoundingClientRect();
    const pages = Array.from(document.querySelectorAll('.page'));
    let pageIndex = -1;
    for (let i = 0; i < pages.length; i++) {
      const pageRect = pages[i].getBoundingClientRect();
      if (logoRect.top >= pageRect.top && logoRect.bottom <= pageRect.bottom) {
        pageIndex = i;
        const pdfPage = this.currentPdfDoc.getPages()[pageIndex];
        const { width: pageWidth, height: pageHeight } = pdfPage.getSize();
        const logoLeftInPage = logoRect.left - pageRect.left;
        const logoTopInPage = logoRect.top - pageRect.top;
        const logoWidth = logoRect.width;
        const logoHeight = logoRect.height;
        const xRatio = (logoLeftInPage + logoWidth / 2) / pageRect.width;
        const yRatio = (logoTopInPage + logoHeight / 2) / pageRect.height;
        const widthRatio = logoWidth / pageRect.width;
        const heightRatio = logoHeight / pageRect.height;
        const pdfLogoWidth = widthRatio * pageWidth;
        const pdfLogoHeight = heightRatio * pageHeight;
        console.log(`xRatio: ${xRatio}, yRatio: ${yRatio}`);
        const x = xRatio * pageWidth - pdfLogoWidth / 2;
        const y = pageHeight - yRatio * pageHeight - pdfLogoHeight / 2;
        await this.addLogoToPdf(pageIndex, x, y, pdfLogoWidth, pdfLogoHeight);
        logoEl.remove();
        this.logoBytes.set(undefined);
        this.logoPosition = null;
        break;
      }
    }
  }
  startResize(event: MouseEvent, dir: string) {
    event.stopPropagation();
    event.preventDefault();
    this.resizing = true;
    this.resizeDir = dir;
    this.startX = event.clientX;
    this.startY = event.clientY;
    this.startWidth = this.logoSize.width;
    this.startHeight = this.logoSize.height;
    this.startLeft = this.logoPosition!.left;
    this.startTop = this.logoPosition!.top;
    window.addEventListener('mousemove', this.onResizing);
    window.addEventListener('mouseup', this.stopResize);
  }
  onResizing = (event: MouseEvent) => {
    if (!this.resizing || !this.logoPosition) return;
    const deltaX = event.clientX - this.startX;
    const deltaY = event.clientY - this.startY;
    if (this.resizeDir === 'bottom-right') {
      this.logoSize.width = this.startWidth + deltaX;
      this.logoSize.height = this.startHeight + deltaY;
    } else if (this.resizeDir === 'bottom-left') {
      this.logoSize.width = this.startWidth - deltaX;
      this.logoPosition.left = this.startLeft + deltaX;
      this.logoSize.height = this.startHeight + deltaY;
    } else if (this.resizeDir === 'top-right') {
      this.logoSize.width = this.startWidth + deltaX;
      this.logoSize.height = this.startHeight - deltaY;
      this.logoPosition.top = this.startTop + deltaY;
    } else if (this.resizeDir === 'top-left') {
      this.logoSize.width = this.startWidth - deltaX;
      this.logoPosition.left = this.startLeft + deltaX;
      this.logoSize.height = this.startHeight - deltaY;
      this.logoPosition.top = this.startTop + deltaY;
    }
    console.log(
      `Resizing logo to ${this.logoSize.width}x${this.logoSize.height}`
    );
  };
  stopResize = () => {
    this.resizing = false;
    this.resizeDir = null;
    window.removeEventListener('mousemove', this.onResizing);
    window.removeEventListener('mouseup', this.stopResize);
  };

  async addLogoToPdf(
    pageIndex: number,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    if (!this.logoBytes() || !this.uploadedPdfBytes()) return;
    const pdfDoc = await PDFDocument.load(this.uploadedPdfBytes()!);
    const page = pdfDoc.getPages()[pageIndex];
    let logoImage;
    if (this.logoFileType() === 'image/png') {
      logoImage = await pdfDoc.embedPng(this.logoBytes()!);
    } else {
      logoImage = await pdfDoc.embedJpg(this.logoBytes()!);
    }
    console.log(
      `Adding logo to page ${pageIndex} at (${x}, ${y}) with size ${width}x${height}`
    );
    page.drawImage(logoImage, { x, y, width, height });
    this.modifiedPdfBytes = await pdfDoc.save();
    this.uploadedPdfBytes.set(this.modifiedPdfBytes);
    const arrayBuffer = new Uint8Array(this.modifiedPdfBytes).buffer;
    const url = URL.createObjectURL(
      new Blob([arrayBuffer], { type: 'application/pdf' })
    );
    this.pdfSrc.set(url);
  }
  downloadPdf() {
    if (!this.modifiedPdfBytes) return;
    const arrayBuffer = new Uint8Array(this.modifiedPdfBytes).buffer;
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'modified.pdf';
    link.click();
  }
}
