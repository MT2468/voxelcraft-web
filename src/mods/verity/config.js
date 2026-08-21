export const VERITY_CONFIG_KEY='voxelcraft-verity-config-v1';
export const DEFAULT_VERITY_CONFIG=Object.freeze({preset:'faithful',intensity:1,eventFrequency:1,realDamage:true,worldCorruption:true,extremeDarkness:true,voice:true});

export function loadVerityConfig(){try{return normalize({...DEFAULT_VERITY_CONFIG,...JSON.parse(localStorage.getItem(VERITY_CONFIG_KEY)||'{}')});}catch{return{...DEFAULT_VERITY_CONFIG};}}
export function saveVerityConfig(config){const clean=normalize(config);try{localStorage.setItem(VERITY_CONFIG_KEY,JSON.stringify(clean));}catch{}return clean;}
export function applyPreset(name,current={}){const preset=String(name||'faithful');if(preset==='story')return normalize({...current,preset,intensity:.7,eventFrequency:.7,realDamage:false,worldCorruption:false,extremeDarkness:true});if(preset==='nightmare')return normalize({...current,preset,intensity:1.35,eventFrequency:1.35,realDamage:true,worldCorruption:true,extremeDarkness:true});return normalize({...current,preset:'faithful',intensity:1,eventFrequency:1,realDamage:true,worldCorruption:true,extremeDarkness:true});}
function normalize(raw){return{preset:['faithful','story','nightmare','custom'].includes(raw?.preset)?raw.preset:'faithful',intensity:clamp(Number(raw?.intensity)||1,.4,1.6),eventFrequency:clamp(Number(raw?.eventFrequency)||1,.4,1.8),realDamage:raw?.realDamage!==false,worldCorruption:raw?.worldCorruption!==false,extremeDarkness:raw?.extremeDarkness!==false,voice:raw?.voice!==false};}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
