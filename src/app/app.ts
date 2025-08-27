import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PdfEditorComponent } from "./pdf-editor-component/pdf-editor-component";

@Component({
  selector: 'app-root',
  imports: [PdfEditorComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('test');
}
