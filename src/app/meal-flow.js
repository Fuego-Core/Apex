import { TODAY, save, state } from './store.js'

function tagLatestEntry(){
  if((location.hash||'#home')!=='#nutrition')return
  const rows=Array.isArray(state.foodLog?.[TODAY()])?state.foodLog[TODAY()]:[]
  const last=rows.at(-1)
  if(last&&!last.mealName){last.mealName=state.activeMeal||'Repas';save()}
}

function decorateJournal(){
  if((location.hash||'#home')!=='#nutrition')return
  const rows=Array.isArray(state.foodLog?.[TODAY()])?state.foodLog[TODAY()]:[]
  document.querySelectorAll('.food-row[data-food]').forEach(button=>{
    const row=rows[Number(button.dataset.food)]
    if(!row||button.querySelector('.meal-tag'))return
    const tag=document.createElement('em')
    tag.className='meal-tag'
    tag.textContent=row.mealName||state.activeMeal||'Repas'
    button.querySelector('span')?.prepend(tag)
  })
}

window.addEventListener('apex:state-changed',()=>setTimeout(tagLatestEntry,0))
window.addEventListener('apex:rendered',()=>setTimeout(()=>{tagLatestEntry();decorateJournal()},0))
setTimeout(()=>{tagLatestEntry();decorateJournal()},0)
