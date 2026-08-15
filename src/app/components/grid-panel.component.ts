import {  Component, Input, AfterViewInit, OnDestroy, inject, OnInit } from '@angular/core';
import {TabulatorFull as Tabulator} from "tabulator-tables";   // ✅ FIXED IMPORT
import { HttpClient } from '@angular/common/http';
import { CHART_TYPES } from '../utils/data-util';

/* ---------------- FILTER OPERATORS ---------------- */

const STRING_FILTERS = ["String equal", "String contains", "String starts with", "String ends with"];
const NUMBER_FILTERS = ["Number equal", "Number Vertical List", "Number Between", "Number greater than", "Number greater than or equal to", "Number less than", "Number less than or equal to", "Number drop down", "Number Top n", "Number Least n"];
const DATE_FILTERS = ["Date equal", "Date Vertical List", "Date drop down", "Date Between": , "Date after": , "Date before": , "Date Relative": , ];

@Component({
  selector: 'app-grid-panel',
  templateUrl: './grid-panel.component.html'
})
export class GridPanelComponent implements AfterViewInit, OnDestroy,OnInit {
    private http = inject(HttpClient);

  @Input() data: any[] = [];  // API result JSON array
  
  private grid: any;
  aggregationTypes = ["None", "Number", "Count", "Distinct Count", "Sum","Cumulative Sum", "Average", "Minimum", "Maximum"];
  chartOptions:Record<string,any>={};
  chartType: string = this.chartOptions["Chart-Type"] || 'line';
  ngOnInit() {
    window.addEventListener('json-fetched', this.onJsonFetched);
    window.addEventListener('chart-type-changed',this.onChartTypeChanged);
    window.addEventListener('config-changed',this.onConfigChanged);
  }

  ngAfterViewInit() {
    this.initGrid();
  }
  
  ngOnDestroy() {
    window.removeEventListener('json-fetched', this.onJsonFetched);
    window.removeEventListener('chart-type-changed', this.onChartTypeChanged);
    window.removeEventListener('config-changed', this.onConfigChanged);
    if (this.grid) {
      this.grid.destroy();
      this.grid = null;
    }
  }
  onConfigChanged = (e: any) => {
    this.chartOptions = e.detail;
  }
  onChartTypeChanged = (e: any) => {
    this.chartType=e.detail;
    this.updateGrid();
  }
  onJsonFetched = (e: any) => {
    this.data = e.detail || [];
    this.updateGrid();
  }
  applyConfig() {
    if (!this.grid || !this.data.length) return;

    const rows = this.grid.getData();

    const configRows = rows
      .filter((r: any) => r.agg !== 'None' || r.filter_op)
      .map((r: any) => ({
        name: r.name,
        agg: r.agg,
        color: r.color,
        series_type: r.series_type,
        stack: r.stack,
        sep_axis: r.sep_axis,

        filter: r.filter_op
          ? {
              type: r.filter_type,
              operator: r.filter_op,
              value: r.filter_val,
              value2:
                r.filter_op === 'between' ? r.filter_val2 : undefined,
            }
          : null,
      }));

    window.dispatchEvent(
      new CustomEvent('grid-config-changed', { detail: configRows  })
    );
  }

  /* ---------------- GRID INIT ---------------- */

  initGrid() {
  const options: any = {
      layout: 'fitColumns',
      reactiveData: true,
      height: '100%',
      cellEdited: (cell: any) => {
        if (cell.getField() === 'filter_op') {
          const row = cell.getRow();
          const op = cell.getValue();
          const col = row.getCell('filter_val2')?.getColumn();
          if (col) col.setVisible(op === 'between');
        }
      },

      columns: [
        {
          title: "Column",
          field: "name",
          headerSort: false
        },
        {
          title: "Aggregation",
          field: "agg",
          editor: "list",
          editorParams: {
            values: ["None", "Number", "Count", "Distinct Count", "Sum","Cumulative Sum", "Average", "Minimum", "Maximum"]
          },
        },
        {
          title: "Color",
          field: "color",
          editor: "input",
          formatter(cell:any) {
            const val = cell.getValue();
            return `<div style="width:20px; height:20px; background:${val}; border:1px solid #ccc;"></div>`;
          },
        },
        {
          title: "Type",
          field: "series_type",
          hozAlign: "center",
          editor: "list",
          editorParams: {
            values: CHART_TYPES
          }
        },
        {
          title: "Stack Name",
          field: "stack",
          hozAlign: "center",
          editor: "input",
        },
        {
          title: "Separate Axis?",
          field: "sep_axis",
          hozAlign: "center",
          formatter: "tickCross",
          editor: true,
        },

        /* -------- FILTER CONFIG -------- */

        {
          title: 'Filter',
          field: 'filter_op',
          editor: 'list',
          editorParams: (cell: any) => {
            const type = cell.getRow().getData().filter_type;
            if (type === 'number') return { values: NUMBER_FILTERS };
            if (type === 'date') return { values: DATE_FILTERS };
            return { values: STRING_FILTERS };
          },
        },
      ],
    };
    this.grid=new Tabulator('#dataGrid',options);
  }

  /* ---------------- GRID DATA ---------------- */

  updateGrid() {
    if (!this.grid || !this.data || this.data.length<1) return;
    let idx = -1;
    const rows = Object.keys(this.data[0]).map((col) => {
      idx++;
      const type = this.detectColumnType(col);

      return {
        name: col,
        agg: 'None',
        color: this.generateColor(idx),
        series_type: this.chartType,
        stack: '',
        sep_axis: false,

        filter_type: type,
        filter_op: '',
        filter_val: '',
        filter_val2: '',
      };
    });

    this.grid.replaceData(rows);
  }

  /* ---------------- HELPERS ---------------- */

  detectColumnType(col: string): 'string' | 'number' | 'date' {
    for (const row of this.data) {
      const val = row[col];
      if (val === null || val === undefined) continue;
      if (typeof val === 'number') return 'number';
      if (!isNaN(Date.parse(val))) return 'date';
      return 'string';
    }
    return 'string';
  }

  generateColor(i: number) {
    const colors = [
      // Vibrant & Bright Colors
      "#FF0000", "#CCFF00", "#00FFFF", "#FF00FF", "#FF6600",
      "#FF69B4", "#BF00FF", "#39FF14", "#FFD700", "#00BFFF",
      "#FF5733", "#33FF57", "#5733FF", "#FF33A1", "#33FFF0",
      "#F0FF33", "#FFBD33", "#76FF33", "#3376FF", "#FF33DD",

      // Dark & Deep Tones
      "#000080", "#228B22", "#800000", "#301934", "#36454F",
      "#191970", "#2F4F4F", "#800020", "#3E2723", "#556B2F",
      "#141414", "#2C3E50", "#154360", "#0B5345", "#186A3B",
      "#784212", "#4A235A", "#641E16", "#1B2631", "#212F3D",

      // Random Mix
      "#8E44AD", "#2980B9", "#27AE60", "#16A085", "#F39C12",
      "#D35400", "#C0392B", "#7F8C8D", "#3498DB", "#9B59B2",
      "#1ABC9C", "#2ECC71", "#F1C40F", "#E67E22", "#E74C3C",
      "#95A5A6", "#34495E", "#ECF0F1", "#BA4A00", "#148F77",
      
      // Neutral & Earthy Shades
      "#E2725B", "#708090", "#9CAF88", "#C2B280", "#6F4E37",
      "#483C32", "#CC7722", "#B66655", "#5F9EA0", "#F0E68C",
      "#8D6E63", "#795548", "#6D4C41", "#5D4037", "#9E9E9E",
      "#BDBDBD", "#616161", "#424242", "#AEB6BF", "#85929E",

      // Pastel & Soft Hues
      "#E6E6FA", "#BDFCC9", "#89CFF0", "#FFDAB9", "#FFCCCC",
      "#FFFACD", "#CCCCFF", "#979B8E", "#AFEEEE", "#FBCEB1",
      "#FDEBD0", "#D6EAF8", "#E8DAEF", "#FADBD8", "#D5F5E3",
      "#F9E79F", "#EBF5FB", "#F4ECF7", "#D4E6F1", "#D1F2EB",
    ];
    return colors[i % colors.length];
  }
}
