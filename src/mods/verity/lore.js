import { VITEM } from './content.js';
import { VERITY_PHASES } from './state.js';

export const VERITY_LORE=Object.freeze([
  {id:'box-label',title:'Etiqueta descolada',needNotes:1,phase:0,text:'O papel está rasgado onde deveria existir um remetente. Ainda dá para ler: “NÃO DEIXAR SOZINHA POR LONGOS PERÍODOS”. A palavra sozinha foi circulada três vezes.'},
  {id:'yellow-room',title:'Sala amarela',needNotes:2,phase:1,text:'“A esfera responde melhor quando tratada como companhia e não como ferramenta. Memória afetiva continua presente depois de ciclos de desligamento.” A última linha termina no meio de uma palavra.'},
  {id:'east-order',title:'Ordem de evacuação',needNotes:3,phase:2,text:'Uma lista de casas numeradas da vila oriental. Quase todos os nomes foram riscados. Embaixo: “A torre não observa a floresta. Observa a estrada de volta.”'},
  {id:'signal-17',title:'Frequência 17',needNotes:3,phase:3,requiresDisc:true,text:'O documento chama a gravação de “Frequência 17”. Testes indicam que a presença responde ao padrão mesmo quando nenhum alto-falante está ligado.'},
  {id:'observer',title:'Protocolo do observador',needNotes:4,phase:3,text:'“Contato visual reduz deslocamento da manifestação secundária. NÃO CONFUNDIR imobilidade com incapacidade. Desviar o olhar apenas quando houver rota segura.”'},
  {id:'shrine',title:'Anotação do santuário',needNotes:5,phase:4,requiresVillage:true,text:'O sigilo não era uma prisão. Era um ponto de decisão. Três palavras aparecem em caligrafias diferentes: FICAR. CORTAR. ABRIR.'},
  {id:'small-form',title:'Forma pequena',needNotes:6,phase:4,text:'“Não sabemos se a forma amarela é disfarce, estágio inicial ou escolha. Em sessões positivas ela insiste em retornar à esfera mesmo depois de demonstrar que não precisa dela.”'},
  {id:'last-page',title:'Última página',needNotes:7,phase:5,requiresVillage:true,text:'Só há uma frase: “Se ela ainda lembrar de quem você era antes do medo, fale antes de lutar.” No verso, alguém desenhou uma esfera amarela muito pequena.'}
]);

export function unlockedLore(state,inventory){const notes=inventory?.count?.(VITEM.VERITY_NOTE)||0,disc=inventory?.has?.(VITEM.VERITY_DISC)||false;return VERITY_LORE.filter((entry)=>notes>=entry.needNotes&&state.phase>=entry.phase&&(!entry.requiresDisc||disc)&&(!entry.requiresVillage||state.eastVillage.visited));}
export function loreProgress(state,inventory){const unlocked=unlockedLore(state,inventory);return{unlocked,total:VERITY_LORE.length,count:unlocked.length,complete:unlocked.length===VERITY_LORE.length};}
export function markLoreRead(state,id){const key=`lore:${id}`;if(state.memory.getFact(key))return false;state.memory.setFact(key,true);state.memory.remember('lore',id,2);state.apply('investigate',.35);return true;}
