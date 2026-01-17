import {
  Component,
  Output,
  EventEmitter,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { CHART_TYPES } from '../utils/data-util';

interface ConfigField {
  name: string;
  type: 'number' | 'string' | 'select' | 'boolean' | 'color';
  enum?: string[];
  default?: any;
  description?: string;
  caption?:string;
  key?: string;
  eventName?: string;  
  listener?: string;  
}

interface FieldSection {
  name: string;
  fields: ConfigField[];
}

@Component({
  selector: 'app-chart-config-panel',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './config-panel.component.html',
})
export class ChartConfigPanelComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  
  // FULL SCHEMA FROM JSON
  private fullSchema: any = null;
  loading: boolean = false;

  // UI DATA
  formValue: Record<string, any> = {};
  
  // Tabbed sections created dynamically
  sectionList: FieldSection[] = [];
  activeSection: string = '';
  
  // Emit configuration to host
  @Output() apply = new EventEmitter();
  data: any;
  constructor(private cdr: ChangeDetectorRef) {}
  customListeners: Record<string, (params: any) => void> = {};
  
  ngOnInit(): void {
    window.addEventListener('data-url-changed', this.onURLChanged);
    
    this.http.get('assets/echarts-condensed-schema.json').subscribe({
      next: (json: any) => { // Explicitly type 'json' as 'any'
        json['general'] && json['general']['Chart-Type'] && 
        (json['general']['Chart-Type'].enum = CHART_TYPES);
        this.fullSchema = json;
        this.chartTypeHandler({ detail: "line" });
        this.customListenersSetup();
        this.cdr.detectChanges();
      },
      error: (err) => console.error('❌ Failed to load schema JSON', err),
    });
  }
  onURLChanged = (e: any) => {
    const url = e.detail;
    if (!url) return;
    this.loading = true;
    this.http.get(url).subscribe({
      next: (data) => {
        this.loading = false;
        this.data = data;
        window.dispatchEvent(
          new CustomEvent("json-fetched", { detail: data })
        );
      },
      error: (err) => {
        this.loading = false;
        alert('Failed to fetch JSON: ' + (err.message || err.statusText || err));
      },
    });
  }
  
  ngOnDestroy() {
    window.removeEventListener('data-url-changed', this.onURLChanged);
    window.removeEventListener('chart-type-changed', this.chartTypeHandler);

    for (const listenerName of Object.keys(this.customListeners)) {
      window.removeEventListener(listenerName, this.customListeners[listenerName]);
    }
  }
  
  // ----------------------------
  // LISTEN TO CHART TYPE CHANGE
  // ----------------------------
  chartTypeHandler = (ev: any) => {
    const chartType = ev.detail;
    const allSchemas = this.fullSchema?.seriesTypes;
    const schema = allSchemas?.[chartType];

    if (!schema) {
      console.warn(`⚠ No schema found for: ${chartType}`);
      this.sectionList = [];
      this.formValue = {};
      //return;
    }

    const props = schema?.props ?? schema?.properties ?? {};
    this.prepareSections({...this.fullSchema.general, ...props});
  
  }

  // ----------------------------
  // BUILD TABS + FIELD SECTIONS
  // ----------------------------
  private prepareSections(props: any) {
    const sections: Record<string, ConfigField[]> = {};
    this.formValue = {};

    for (const key of Object.keys(props)) {
      const def = props[key];
      const type = this.toFieldType(def);

      const sectionName = def.category ?? 'General';
      if (!sections[sectionName]) sections[sectionName] = [];

      sections[sectionName].push({
        name: key,
        type,
        enum: def.enum ?? null,
        default: def.default,
        description: def.description,
        caption: def['caption'] || key,
        key: def['key'] || key,
        eventName: def['event-name'] ?? null,
        listener: def['listener'] ?? null,
      });
    }

    // Convert to list
    this.sectionList = Object.keys(sections).map((sectionName) => ({
      name: sectionName,
      fields: sections[sectionName],
    }));

    // Initialize form values
    for (const section of this.sectionList) {
      for (const field of section.fields) {
        this.formValue[field.name] =
          field.default ?? this.defaultValueFor(field);
      }
    }

    // Default active section
    this.activeSection = this.sectionList[0]?.name ?? '';
  }

  // ----------------------------
  // FIELD TYPE DETECTION
  // ----------------------------
  private toFieldType(def: any): ConfigField['type'] {
    if (def.type === 'number') return 'number';
    if (def.type === 'boolean') return 'boolean';
    if (def.type === 'color') return 'color';
    if (def.enum) return 'select';
    return 'string';
  }
  private buildNestedConfig(): any {
    const result: any = {};

    for (const section of this.sectionList) {
      for (const field of section.fields) {
        if (!field.key) continue;

        const value = this.formValue[field.name];
        if (value === undefined || value === null) continue;

        this.setByPath(result, field.key, value);
      }
    }
    return result;
  }
  private setByPath(obj: any, path: string, value: any) {
    const parts = path.split('.');
    let curr = obj;

    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (!curr[p] || typeof curr[p] !== 'object') {
        curr[p] = {};
      }
      curr = curr[p];
    }

    curr[parts[parts.length - 1]] = value;
  }
  // ----------------------------
  // DEFAULT FIELD VALUE
  // ----------------------------
  private defaultValueFor(f: ConfigField) {
    switch (f.type) {
      case 'number':
        return 0;
      case 'boolean':
        return false;
      case 'select':
        return f.enum ? f.enum[0] : '';
      case 'color':
        return '#000000';
      default:
        return '';
    }
  }
  onApplyClicked() {
      const finalConfig = this.buildNestedConfig();
    window.dispatchEvent(
      new CustomEvent('config-changed', { detail: finalConfig })
    );
  }
  customListenersSetup() {
    for (const section of this.sectionList) {
      for (const field of section.fields) { 
        if (field.listener) {
          this.customListeners[field.listener] = (params: any) => this.listenerProcess(field, params);
          window.addEventListener(field.listener, this.customListeners[field.listener]);
        }
      }
    }
  }
  listenerProcess(field: ConfigField, ev: any) {
    if(!field.listener || !ev.detail || !ev.detail.length || ev.detail.length<1) return;
    if(field.name === "Major-Axis") {
        field.enum = Object.keys( ev.detail[0] ); 
        this.formValue[field.name] = field.enum[0]; 
        this.cdr.detectChanges();
    }
  }
  onFieldChanged(field: ConfigField, value: any) {
    // Update model (already done by ngModel)
    
    // Dispatch schema-driven event if configured
    if (field.eventName) {
      window.dispatchEvent(
        new CustomEvent(field.eventName, { detail: value })
      );
  }
}
  // ----------------------------
  // TAB CLICK
  // ----------------------------
  onTabClick(sectionName: string) {
    this.activeSection = sectionName;
  }
}
