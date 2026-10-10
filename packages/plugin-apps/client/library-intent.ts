/** Carry a sidebar's explicit library request across the workspace's first mount. */
let pending=false;
const listeners=new Set<()=>void>();
export const savedLibraryIntent={
  open(){pending=true;for(const listener of listeners)listener();},
  take(){const value=pending;pending=false;return value;},
  subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};},
};
