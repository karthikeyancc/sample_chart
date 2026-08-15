
export const PIE_CHART_TYPES = ["pie","nightingale","doughnut","half_doughnut"];
export const CHART_TYPES = [
  "bar","line","smoothline","area","smootharea","radialbar","tangentialbar",
  "stacked_radialbar","stacked_tangentialbar","normalised_stack_bar",
  "pie","doughnut","half_doughnut","nightingale","scatter","gauge",
  "radar","heatmap","tree","righttree","bottomtree","toptree","radialtree",
  "treemap","sunburst","waterfall","funnel"
];
export interface EChartsAxisBreak {
  start: number;
  end: number;
  gap: string;
}
export interface ChartFilter {
  field: string;
  label: string;
  type: 'string' | 'number' | 'date';
  operator: string;
  value1?: any;
  value2?: any;
}


export class ChartUtils {
  SERIES_TYPE_2_PARAMS: Record<string, any> = {
    smoothline: { type: 'line', smooth: true },
    area: { type: 'line', areaStyle: {} },
    smootharea: { type: 'line', smooth: true, areaStyle: {} },
    radialbar: { type: 'bar', coordinateSystem: 'polar', label: true },
    tangentialbar: { type: 'bar', coordinateSystem: 'polar', label: true },
    stacked_radialbar: { type: 'bar', coordinateSystem: 'polar', label: true },
    stacked_tangentialbar: { type: 'bar', coordinateSystem: 'polar', label: true },
    normalised_stack_bar: { type: 'bar', stack: 'normalised' },
    nightingale: { type: 'pie', itemStyle: { borderRadius: 5 }, roseType: true },
    doughnut: { type: 'pie', padAngle: 2, itemStyle: { borderRadius: 5 }, roseType: true },
    half_doughnut: { type: 'pie', startAngle: 180, endAngle: 0 },
  };
  SERIES_SPECIFIC_OPTIONS: Record<string, any> = {
    treemap: {
      series: [
        {
          type: 'treemap',
          id: 'echarts-package-size',
          animationDurationUpdate: 1000,
          roam: false,
          nodeClick: undefined,
          universalTransition: true,
          label: {
            show: true,
          },
          breadcrumb: {
            show: false,
          },
        },
      ],
    },
    sunburst: {
      series: [
        {
          type: 'sunburst',
          id: 'echarts-package-size',
          radius: ['20%', '90%'],
          animationDurationUpdate: 1000,
          nodeClick: undefined,
          universalTransition: true,
          itemStyle: {
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,.5)'
          },
          label: {
            show: false
          }
        }
      ]
    },
    tree:{
      series: [
        {
          type: 'tree',
          top: '1%',
          left: '7%',
          bottom: '1%',
          right: '20%',
          symbolSize: 7,
          label: {
            position: 'left',
            verticalAlign: 'middle',
            align: 'right',
            fontSize: 9
          },
          leaves: {
            label: {
              position: 'right',
              verticalAlign: 'middle',
              align: 'left'
            }
          },
          emphasis: {
            focus: 'descendant'
          },
          expandAndCollapse: true,
          animationDuration: 550,
          animationDurationUpdate: 750
        }
      ]
    }
  };
  generateChartConfig(
    data: Record<string, any>[],
    chartOptions: Record<string, any>,
    configRows: Record<string, any>[]
  ): { chartOptions: any; filters: ChartFilter[] } | undefined {
    if (!data || !data.length) {
      console.error('❌ No data available to generate chart configuration.');
      return undefined;
    }
    console.log('Generating chart configuration with options:', {chartOptions,configRows});
    if(data[0].hasOwnProperty("children")){
      console.log('✅ Tree Chart configuration generated successfully.');
      return this.getOptionAnFilters(this.getTreeChartConfig(data[0], chartOptions),data,configRows);
    }
    const xColumn = chartOptions['Major-Axis'];
    if (!xColumn) {
      console.error('❌ No Major Axis selected! Cannot build chart.');
      return undefined;
    }

    // Extract category values
    const xCategories = [...new Set(data.map((row) => row[xColumn]))];

    // ---------------------------------------------------------
    // 2. Build Y-axis and Series based on aggregation
    // ---------------------------------------------------------
    const series: any[] = [];
    const minorAxis: any[] = [];

    let yAxisIndex = 0;
    let cl = configRows.length;
    for (let idx = 0; idx < cl; idx++) {
      const cfg = configRows[idx];

      const colName = cfg['name'];
      const color = cfg['color'];
      const isSeparateAxis = cfg['sep_axis'] === true;
      const chartType = cfg['series_type'] || chartOptions['Chart-Type'] || 'line';
      // Create separate Y-axis if requested
      if (isSeparateAxis) {
        minorAxis.push({
          type: 'value',
          position: 'right',
          offset: yAxisIndex * 50,
          name: colName,
        });
      } else {
        if (minorAxis.length === 0) {
          // main primary y-axis
          minorAxis.push({
            type: 'value',
            position: 'left',
            name: 'Values',
          });
        }
      }

      const yAxisForSeries = isSeparateAxis ? yAxisIndex : 0;

      if (isSeparateAxis) yAxisIndex++;

      // ---------------------------------------------------------
      // Compute aggregated values for each category
      // ---------------------------------------------------------

      const values = xCategories.map((cat) => {
        const items = data.filter((row) => row[xColumn] === cat).map((row) => Number(row[colName]));
        let val: number | null = null;
        val = this.aggregate(cfg, val, items);
        return this.seriesAggregation(chartOptions, cfg, cat, val);
      });

      // ---------------------------------------------------------
      // Create the series entry
      // ---------------------------------------------------------
      const seriesEntry: any = {
        name: colName,
        data: values,
        itemStyle: { color },
        [chartOptions['Direction'] === 'Vertical' || chartOptions['Chart-Type'] === 'radar'
          ? 'yAxisIndex'
          : 'xAxisIndex']: yAxisForSeries,
      };
      Object.assign(seriesEntry, this.SERIES_TYPE_2_PARAMS[chartType] || { type: chartType });
      this.seriesOptions(chartOptions, configRows, idx, seriesEntry);
      series.push(seriesEntry);
    }

    if (chartOptions['Breaks'] === true) {
      const seriesValues = series.map((s) => s.data);
      const breaks = this.findAxisBreaks(seriesValues, 5);
      console.log('Detected Axis Breaks:', breaks);
      if (breaks.length > 0) {
        minorAxis[0]['breaks'] = breaks;
        minorAxis[0]['breakArea'] = { itemStyle: { opacity: 1 }, zigzagZ: 200 };
      }
    }
    // ---------------------------------------------------------
    // Build Final JSON
    // ---------------------------------------------------------
    const majorAxis = {
      type: 'category',
      data: xCategories,
    };

    let ret: Record<string, any> = {
      tooltip: { trigger: 'axis' },
      legend: { type: 'scroll' },
      series,
    };
    this.chartOptionTweeks(chartOptions, ret, majorAxis, minorAxis);
    if (chartOptions['Chart-Type'] === 'normalised_stack_bar') {
      ret = this.normalizeStackedSeriesToPercent(ret, chartOptions['Direction'] === 'Vertical');
    }
    console.log('✅ Normalized Chart configuration generated successfully.', ret);

    return this.getOptionAnFilters(ret,data,configRows);
  }
  getOptionAnFilters(options:any,data: Record<string, any>[],
    configRows: Record<string, any>[]):{ chartOptions: any; filters: ChartFilter[] } | undefined{
      return {chartOptions:options,filters:this.buildFilters(data,configRows)};
  }
  chartOptionTweeks(
    chartOptions: Record<string, any>,
    ret: Record<string, any>,
    majorAxis: { type: string; data: any[] },
    minorAxis: any[]
  ) {
    if (
      chartOptions['Chart-Type'] === 'radialbar' ||
      chartOptions['Chart-Type'] === 'stacked_radialbar'
    ) {
      ret['angleAxis'] = { ...majorAxis, startAngle: 90 };
      ret['radiusAxis'] = { max: Math.round(Math.max(...majorAxis.data) * 1.1) };
      ret['polar'] = { radius: [10, '80%'] };
    } else if (
      chartOptions['Chart-Type'] === 'tangentialbar' ||
      chartOptions['Chart-Type'] === 'stacked_tangentialbar'
    ) {
      ret['radiusAxis'] = { ...majorAxis, startAngle: 90 };
      ret['angleAxis'] = { max: Math.round(Math.max(...majorAxis.data) * 1.1) };
      ret['polar'] = { radius: [10, '80%'] };
    } else if (chartOptions['Chart-Type'] === 'scatter') {
      ret['xAxis'] = { scale: true };
      ret['yAxis'] = { scale: true };
    } else if (chartOptions['Chart-Type'] === 'radar') {
      const radarMaxes = majorAxis.data.map((cat, idx) => {
        console.log(cat, idx);
        let max: number[] = [];
        ret['series'].map((s: any) => {
          max.push(s.data[idx] || 0);
        });
        return { name: cat, max: Math.round(Math.max(...max) * 1.1) || 100 };
      });

      let sd: any[] = [];
      ret['series'].forEach((s: any) => {
        sd.push({ value: s.data, name: s.name });
      });
      ret['series'] = [{ type: 'radar', data: sd }];
      ret['radar'] = { indicator: radarMaxes };
    } else if (chartOptions['Chart-Type'] === 'heatmap') {
      ret['xAxis'] = { type: 'category', data: majorAxis.data };
      ret['yAxis'] = { type: 'category', data: ret['series'].map((s: any) => s.name) };
      ret['visualMap'] = {
        min: 0,
        max: 100,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: '15%',
      };
      let heatmapData: number[][] = [];
      ret['series'].forEach((s: any, seriesIdx: number) => {
        s.data.forEach((val: number, dataIdx: number) => {
          heatmapData.push([dataIdx, seriesIdx, val]);
        });
      });
      ret['series'] = [
        {
          type: 'heatmap',
          data: heatmapData,
          label: { show: true },
          emphasis: { itemStyle: { shadowBlur: 10, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
        },
      ];
    } else if (chartOptions['Chart-Type'] === 'tree') {
      ret['series'] = [
        {
          type: 'tree',
          data: ret['series'].map((s: any) => ({ name: s.name, children: s.data })),
          top: '1%',
          left: '7%',
          bottom: '1%',
          right: '20%',
          symbolSize: 7,
          label: { position: 'left', verticalAlign: 'middle', align: 'right', fontSize: 9 },
          leaves: { label: { position: 'right', verticalAlign: 'middle', align: 'left' } },
          expandAndCollapse: true,
          animationDuration: 550,
          animationDurationUpdate: 750,
        },
      ];
    } else if (!PIE_CHART_TYPES.includes(chartOptions['Chart-Type'])) {
      ret['xAxis'] = chartOptions['Direction'] === 'Vertical' ? majorAxis : minorAxis;
      ret['yAxis'] = chartOptions['Direction'] === 'Vertical' ? minorAxis : majorAxis;
    }
  }

  seriesOptions(
    chartOptions: Record<string, any>,
    configRows: Record<string, any>[],
    idx: number,
    seriesEntry: Record<string, any>
  ) {
    let cfg = configRows[idx];
    let cl = configRows.length;
    let chartType = cfg['series_type'];
    if (cfg['stack'] && cfg['stack'].trim().length > 0) {
      seriesEntry['stack'] = cfg['stack'].trim();
    }
    if (chartOptions['label'] && chartOptions['label'].show === true) {
      Object.assign(seriesEntry['label'], chartOptions['label']);
    }
    let zero = chartType === 'pie' && cl === 1 ? true : false;
    if (PIE_CHART_TYPES.includes(chartType)) {
      delete seriesEntry['itemStyle'].color;
      let radiusInner = idx * Math.floor(70 / configRows.length) + 10;
      let radiusOuter = Math.floor(70 / configRows.length) + radiusInner;
      radiusInner += Math.floor((radiusOuter - radiusInner) * 0.1);
      seriesEntry['radius'] = [zero ? '0%' : radiusInner + '%', radiusOuter + '%'];
    }
    if (chartType === 'radar') {
      seriesEntry['min'] = 0;
      seriesEntry['max'] = Math.max(...seriesEntry['data']) * 1.2;
    }
  }

  seriesAggregation(
    chartOptions: Record<string, any>,
    cfg: Record<string, any>,
    cat: any,
    val: number | null
  ) {
    if (PIE_CHART_TYPES.includes(chartOptions['Chart-Type'])) {
      return { value: val, name: `${cat} - ${cfg['name']}` };
    } else if (chartOptions['Chart-Type'] === 'scatter') {
      return [cat, val];
    } else {
      return val;
    }
  }

  aggregate(cfg: Record<string, any>, val: number | null, items: number[]) {
    switch (cfg['agg']) {
      case 'Number':
        val = items.length ? items[0] : null;
        break;
      case 'Count':
        val = items.length;
        break;
      case 'Distinct Count':
        val = new Set(items).size;
        break;
      case 'Sum':
        val = items.reduce((a, b) => a + b, 0);
        break;
      case 'Cumulative Sum':
        let cumulative = 0; val = items.map(item => { cumulative += item; return cumulative;});
        break;
      case 'Average':
        val = items.length ? items.reduce((a, b) => a + b, 0) / items.length : 0;
        break;
      case 'Minimum':
        val = Math.min(...items);
        break;
      case 'Maximum':
        val = Math.max(...items);
        break;
    }
    return val;
  }

  findAxisBreaks(
    seriesData: number[][],
    minGapPercent: number = 5,
    marginPercent: number = 4
  ): EChartsAxisBreak[] {
    // 1. Flatten + sanitize
    const values = seriesData
      .flat()
      .filter((v) => typeof v === 'number' && !isNaN(v))
      .sort((a, b) => a - b);

    if (values.length < 2) return [];

    const min = values[0];
    const max = values[values.length - 1];
    const range = max - min;

    if (range === 0) return [];

    const gapThreshold = (minGapPercent / 100) * range;
    const margin = (marginPercent / 100) * range;

    const breaks: EChartsAxisBreak[] = [];

    // 2. Detect gaps
    for (let i = 0; i < values.length - 1; i++) {
      const curr = values[i];
      const next = values[i + 1];

      const gapValue = next - curr;

      if (gapValue > gapThreshold) {
        // Apply margin safely
        const start = curr + margin;
        const end = next - margin;

        // Guard: margin should not invert the break
        if (start >= end) continue;

        const gapPercent = ((gapValue / range) * 100).toFixed(2) + '%';

        breaks.push({
          start,
          end,
          gap: '1.5%',
        });
      }
    }

    return breaks;
  }
  buildFilters(
    data: Record<string, any>[],
    configRows: Record<string, any>[]
  ): ChartFilter[] {

    const sample = data[0];
    const filters: ChartFilter[] = [];

    configRows.forEach(cfg => {
      if (!cfg["filter"]) return;

      const field = cfg["name"];
      const value = sample[field];

      let type: ChartFilter['type'] = 'string';
      if (typeof value === 'number') type = 'number';
      else if (value instanceof Date || !isNaN(Date.parse(value))) type = 'date';

      filters.push({
        field,
        label: field,
        type,
        operator: cfg["filter"]['operator'],
        value1: '',
        value2: ''
      });
    });

    return filters;
  }

  applyFilters(data: any[], filters: ChartFilter[]): any[] {
    return data.filter(row =>
      filters.every(f => this.matchFilter(row[f.field], f))
    );
  }

  matchFilter(value: any, f: ChartFilter): boolean {
    if (value == null) return false;

    switch (f.operator) {

      /* ---- STRING ---- */
      case 'contains': return String(value).includes(f.value1);
      case 'startsWith': return String(value).startsWith(f.value1);
      case 'endsWith': return String(value).endsWith(f.value1);
      case 'equals': return String(value) === String(f.value1);

      /* ---- NUMBER ---- */
      case '=': return +value === +f.value1;
      case '!=': return +value !== +f.value1;
      case '>': return +value > +f.value1;
      case '>=': return +value >= +f.value1;
      case '<': return +value < +f.value1;
      case '<=': return +value <= +f.value1;
      case 'between': return +value >= +f.value1 && +value <= +f.value2;

      /* ---- DATE ---- */
      case 'date=': return new Date(value).getTime() === new Date(f.value1).getTime();
      case 'date>': return new Date(value) > new Date(f.value1);
      case 'date<': return new Date(value) < new Date(f.value1);

      default: return true;
    }
  }
  normalizeStackedSeriesToPercent(option: any, vertical: boolean): any {
    const key = vertical ? 'yAxis' : 'xAxis';
    const key1 = vertical ? 'xAxis' : 'yAxis';
    if (!option?.series || !option?.[key1]?.data) return option;

    const series = option.series;
    const categoryCount = option[key1].data.length;

    // Step 1: build totals per category
    const totals: number[] = new Array(categoryCount).fill(0);

    for (let i = 0; i < categoryCount; i++) {
      for (const s of series) {
        const v = Number(s.data?.[i] ?? 0);
        totals[i] += isNaN(v) ? 0 : v;
      }
    }

    // Step 2: normalize each series
    const normalizedSeries = series.map((s: any) => {
      const normalizedData = s.data.map((v: number, idx: number) => {
        const total = totals[idx];
        if (!total) return 0;
        return +((v / total) * 100).toFixed(2); // keep 2 decimals
      });

      return {
        ...s,
        stack: s.stack ?? 'total',
        data: normalizedData,
      };
    });

    // Step 3: update yAxis for percent
    const keyAxis = Array.isArray(option[key])
      ? option[key].map((ax: any, i: number) =>
          i === 0
            ? {
                ...ax,
                min: 0,
                max: 100,
                axisLabel: {
                  formatter: '{value} %',
                },
              }
            : ax
        )
      : {
          ...option[key],
          min: 0,
          max: 100,
          axisLabel: {
            formatter: '{value} %',
          },
        };

    return {
      ...option,
      series: normalizedSeries,
      [key]: keyAxis,
    };
  }
  getTreeChartConfig(data: Record<string, any>, chartOptions: Record<string, any>): Record<string, any> {
    let t:string=chartOptions['Chart-Type'] || 'tree';
    let ret=Object.assign({}, this.SERIES_SPECIFIC_OPTIONS[t]||this.SERIES_SPECIFIC_OPTIONS["tree"]);
    if(t==='tree' || t==='radialtree'||t==='righttree'||t==='lefttree'||t==='toptree'||t==='bottomtree'){
      ret.series[0].data=[data];
      if(t==='radialtree'){
        ret.series[0]['layout']='radial';
        ret.series[0]['symbol']='emptyCircle';
      }
      if(t==='righttree'){
        ret.series[0]['orient']='RL';
        ret.series[0]['label']['position']='right';
        ret.series[0]['leaves']['label']['position']='left';
      }
      if(t==='bottomtree'){
        ret.series[0]['orient']='BT';
        ret.series[0]['label']['position']='bottom';
        ret.series[0]['label']['rotate']='90';
        ret.series[0]['leaves']['label']['position']='top';
      }
      if(t==='toptree'){
        ret.series[0]['orient']='vertical';
        ret.series[0]['label']['position']='top';
        ret.series[0]['label']['rotate']='-90';
        ret.series[0]['leaves']['label']['position']='bottom';
      }
    }else if(t==='sunburst' || t==='treemap'){
      ret.series[0].data=data["children"] || [];
    }
    return ret;
}

}
