export function sourceTheme(options:{explicit?:string;className?:string;colorScheme?:string;background?:string;systemDark:boolean}):'light'|'dark' {
  if(options.explicit==='light'||options.explicit==='dark')return options.explicit;
  const classes=options.className?.split(/\s+/)??[];if(classes.includes('dark'))return 'dark';if(classes.includes('light'))return 'light';
  if(options.colorScheme==='dark'||options.colorScheme==='light')return options.colorScheme;
  const background=options.background?.trim();
  const hex=/^#([0-9a-f]{6})$/i.exec(background??'');
  const rgb=/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i.exec(background??'');
  const channels=hex?[0,2,4].map(offset=>parseInt(hex[1].slice(offset,offset+2),16)):rgb&&rgb[4]!=='0'?[Number(rgb[1]),Number(rgb[2]),Number(rgb[3])]:undefined;
  if(channels)return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722<128?'dark':'light';
  return options.systemDark?'dark':'light';
}
export function readSourceTheme(): 'light'|'dark' {
  const root=document.documentElement,style=getComputedStyle(root);const bodyStyle=document.body?getComputedStyle(document.body):undefined;
  return sourceTheme({explicit:root.getAttribute('data-theme')??root.getAttribute('data-color-mode')??root.getAttribute('data-mode')??undefined,className:root.className,colorScheme:style.colorScheme,
    background:style.getPropertyValue('--dsw-alias-bg-base')||bodyStyle?.getPropertyValue('--dsw-alias-bg-base'),systemDark:window.matchMedia('(prefers-color-scheme: dark)').matches});
}
