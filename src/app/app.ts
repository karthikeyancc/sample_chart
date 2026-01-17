import { Component, signal } from '@angular/core';
import { GridPanelComponent } from "./components/grid-panel.component";
import { ChartPanelComponent } from "./components/chart-panel.component";
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ChartConfigPanelComponent } from "./components/config-panel.component";

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CommonModule,
    ChartPanelComponent,
    GridPanelComponent,
    ChartConfigPanelComponent
],
  templateUrl: './app.html',
})
export class App {
  title = 'Grand Chart';
}
