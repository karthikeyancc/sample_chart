import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NGX_ECHARTS_CONFIG, NgxEchartsModule } from 'ngx-echarts';
import { ECharts, EChartsOption } from 'echarts';
import { ChartUtils, ChartFilter } from '../utils/data-util';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-chart-panel',
  standalone: true,
  imports: [CommonModule, NgxEchartsModule,FormsModule],
  templateUrl: './chart-panel.component.html',
  providers: [
    {
      provide: NGX_ECHARTS_CONFIG,
      useFactory: () => ({
        echarts: () => import('echarts')
      }),
    },
  ],
})
export class ChartPanelComponent implements OnInit, OnDestroy {

  chart!: ECharts;
  chartOptions: EChartsOption = {};
  userChartOptions: any = {};
  seriesOptions: any[] = [];
  rawData: any[] = [];
  filters: ChartFilter[] = [];
  private chartUtils = new ChartUtils();

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    window.addEventListener('json-fetched', this.onJsonFetched);
    window.addEventListener('config-changed', this.onConfigChanged);
    window.addEventListener('grid-config-changed', this.onGridConfigChanged);
  }

  ngOnDestroy(): void {
    window.removeEventListener('json-fetched', this.onJsonFetched);
    window.removeEventListener('config-changed', this.onConfigChanged);
    window.removeEventListener('grid-config-changed', this.onGridConfigChanged);
  }
  onGridConfigChanged = (e: any) => {
    this.seriesOptions = e.detail || {};
    this.buildChart();
  }

  
  onJsonFetched = (e: any) => {
    this.rawData = e.detail || [];
  };

  onConfigChanged = (e: any) => {
    this.userChartOptions = e.detail||{};
    this.buildChart();
  };
  buildChart(): void {
    if (!this.rawData || !this.seriesOptions) return;

    // 1️⃣ Apply filters to data
    const filteredData =
      this.filters.length > 0
        ? this.chartUtils.applyFilters(this.rawData, this.filters)
        : this.rawData;

    // 2️⃣ Generate chart config
    const result = this.chartUtils.generateChartConfig(
      filteredData,
      this.userChartOptions,
      this.seriesOptions
    );

    if (!result) {
      this.chartOptions = {};
      return;
    }

    // 3️⃣ Update state
    this.chartOptions = result.chartOptions;
      if (!this.filters.length) {
         this.filters = result.filters || [];
      }

    this.cdr.detectChanges();
  }
  onChartInit(chart: ECharts): void {
    this.chart = chart;
  }
}
