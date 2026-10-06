export type WidgetType = 'stat_card' | 'table' | 'bar_chart' | 'line_chart' | 'product_card' | 'status_badge' | 'text';
export interface ThemeTokens {
  background: string; surface: string; text: string; mutedText: string; primary: string; profit: string; loss: string; warning: string;
  fontSize: { small: number; body: number; title: number }; spacing: number; radius: number; shadow: string;
}
export interface LayoutNode { type: 'grid' | 'row' | 'column' | 'tabs'; children: (LayoutNode | string)[]; columns?: number; gap?: number }
export interface WidgetSpec {
  id: string; type: WidgetType; title?: string; bindingId?: string; fields?: Record<string, string>;
  columns?: { field: string; label: string; format?: 'text' | 'currency' | 'percent' | 'date' }[];
  text?: string; options?: Record<string, unknown>;
}
export interface DataBinding { id: string; datasetKey?: string; query?: { tool: string; params: Record<string, unknown> }; fieldMap: Record<string, string> }
export interface SourcePreview { screenshotPath:string; reportPath:string; width?:number; height?:number; capturedAt?:string }
export interface SourceArtifact { buildId: string; directory: string; entry: string; files: string[]; thumbnail?:string; preview?:SourcePreview }
export interface ViewSpec { id: string; title: string; templateId?: string; theme?: Partial<ThemeTokens>; layout: LayoutNode; widgets: WidgetSpec[]; bindings: DataBinding[]; kind?: 'source'; source?: SourceArtifact }
export interface SourceView extends ViewSpec { kind: 'source'; source: SourceArtifact }
export interface Template {
  id: string; name: string; description: string; theme: Partial<ThemeTokens>; layout: LayoutNode;
  widgetStyles: WidgetSpec[]; contentRules: Record<string, unknown>; version: number; kind?: 'source'; source?: SourceArtifact; bindings?: DataBinding[];
}
export interface Entry { id: string; appId: 'hallmark'; kind: 'component' | 'data'; title: string; viewId?: string; binding?: DataBinding; pinned: boolean; order: number }
export interface ComponentRevision { revision: number; title: string; savedAt: string; buildId?: string }
export interface SavedComponent { id: string; title: string; spec: ViewSpec; template?: Template; userRequest: string; savedAt: string; revision?: number; revisions?: ComponentRevision[] }
export interface ComponentDraft { spec: ViewSpec; sourceComponentId: string; baseRevision: number }
export interface SaveComponentOptions { mode?: 'save_as'|'update'; componentId?: string; expectedRevision?: number }
export interface Patch { op: 'add' | 'remove' | 'replace' | 'move' | 'copy' | 'test'; path: string; value?: unknown; from?: string }
export interface BindingData { bindingId: string; datasetKey: string; payload: unknown; dataTime?: string; lastSuccessAt?: string; state: string; lastError?: unknown; provenance: Record<string, unknown>; metricBasis?: string }
