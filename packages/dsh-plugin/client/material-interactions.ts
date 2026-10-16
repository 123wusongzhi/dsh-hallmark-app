/** Transient host-owned state. Never persisted inside a ViewSpec or RenderSpec. */
export interface MaterialQuery { search:string; sort?:{field:string;direction:'asc'|'desc'} }
export interface MaterialBindingInteraction {
  selectedProductId?:string;
  /** Search currently applied to the returned binding, including restored saved queries. */
  appliedSearch?:string;
  /** Verified complete source result; local search, sort and pages share this snapshot. */
  fullDataset?:boolean;
  pagination?:{hasMore?:boolean;total?:number;loadedCount?:number;loading?:boolean};
  operations?:{search:'server'|'loaded';sort:'server'|'loaded'};
  onPage?:()=>void;
  onQueryChange?:(query:MaterialQuery)=>void;
}
export interface ViewInteractions {
  selectedByWidget?:Record<string,string>;
  onSelect?:(event:{widgetId:string;field:'product.id';value:string;row:Record<string,unknown>})=>void;
  bindings?:Record<string,MaterialBindingInteraction>;
}
