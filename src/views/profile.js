/* PROFIL — ce qu'APEX sait de toi, et rien d'autre.

   Tout est facultatif : un champ vide s'affiche vide, jamais avec une valeur
   par défaut inventée. Ces informations serviront de socle aux phases
   suivantes (génération de programme, besoins caloriques) ; aujourd'hui elles
   servent déjà à lire une tendance de poids dans le bon sens. */

import { getState, updateProfile } from '../state.js'
import { esc, header, num, toast } from '../ui.js'
import { blank, openSheet, parseNumber } from '../ui/components.js'

const SEX = [
  { value: '', label: '—' },
  { value: 'homme', label: 'Homme' },
  { value: 'femme', label: 'Femme' },
  { value: 'autre', label: 'Autre' }
]

const GOALS = [
  { value: '', label: '—' },
  { value: 'seche', label: 'Perdre du gras' },
  { value: 'prise', label: 'Prendre du muscle' },
  { value: 'maintien', label: 'Maintenir' },
  { value: 'recomp', label: 'Recomposition' }
]

const EXPERIENCE = [
  { value: '', label: '—' },
  { value: 'debutant', label: 'Débutant (< 1 an)' },
  { value: 'intermediaire', label: 'Intermédiaire (1-3 ans)' },
  { value: 'avance', label: 'Avancé (3 ans et +)' }
]

const ACTIVITY = [
  { value: '', label: '—' },
  { value: 'sedentaire', label: 'Sédentaire' },
  { value: 'leger', label: 'Peu actif' },
  { value: 'modere', label: 'Actif' },
  { value: 'intense', label: 'Très actif' }
]

const labelOf = (options, value) => options.find((o) => o.value === value)?.label || null

export default function profileView(root) {
  async function openProfileSheet() {
    const p = getState().profile
    const values = await openSheet({
      title: 'Mon profil',
      subtitle: 'Tout est facultatif. Rien ne quitte cet appareil.',
      submitLabel: 'Enregistrer',
      fields: [
        { name: 'sex', label: 'Sexe', type: 'select', options: SEX },
        { name: 'birthYear', label: 'Année de naissance', type: 'number', placeholder: '1994' },
        { name: 'height', label: 'Taille (cm)', type: 'number', placeholder: '178' },
        { name: 'goal', label: 'Objectif principal', type: 'select', options: GOALS },
        { name: 'experience', label: 'Expérience', type: 'select', options: EXPERIENCE },
        { name: 'activity', label: 'Activité hors salle', type: 'select', options: ACTIVITY },
        { name: 'trainingDays', label: 'Séances par semaine', type: 'number', placeholder: '4' },
        { name: 'sessionDuration', label: 'Durée d’une séance (min)', type: 'number', placeholder: '60' }
      ],
      values: {
        sex: p.sex ?? '',
        birthYear: p.birthYear ?? '',
        height: p.height ?? '',
        goal: p.goal ?? '',
        experience: p.experience ?? '',
        activity: p.activity ?? '',
        trainingDays: p.trainingDays ?? '',
        sessionDuration: p.sessionDuration ?? ''
      },
      validate: (data) => {
        const errors = {}
        const year = parseNumber(data.birthYear)
        const currentYear = new Date().getFullYear()
        if (data.birthYear && (year === null || year < 1900 || year > currentYear)) {
          errors.birthYear = `Une année entre 1900 et ${currentYear}.`
        }
        const height = parseNumber(data.height)
        if (data.height && (height === null || height < 100 || height > 250)) {
          errors.height = 'Une taille en centimètres, entre 100 et 250.'
        }
        const days = parseNumber(data.trainingDays)
        if (data.trainingDays && (days === null || days < 1 || days > 14)) {
          errors.trainingDays = 'Entre 1 et 14 séances par semaine.'
        }
        const dur = parseNumber(data.sessionDuration)
        if (data.sessionDuration && (dur === null || dur < 10 || dur > 300)) {
          errors.sessionDuration = 'Entre 10 et 300 minutes.'
        }
        return errors
      }
    })
    if (!values) return

    await updateProfile({
      sex: values.sex || null,
      birthYear: parseNumber(values.birthYear),
      height: parseNumber(values.height),
      goal: values.goal || null,
      experience: values.experience || null,
      activity: values.activity || null,
      trainingDays: parseNumber(values.trainingDays),
      sessionDuration: parseNumber(values.sessionDuration)
    })
    toast('Profil enregistré', 'gold')
    render()
  }

  function render() {
    const p = getState().profile
    const filled = Object.entries(p).filter(([k, v]) => k !== 'updatedAt' && v !== null).length

    const lines = [
      { title: 'Sexe', meta: labelOf(SEX, p.sex) },
      { title: 'Année de naissance', meta: p.birthYear ? String(p.birthYear) : null },
      { title: 'Taille', meta: p.height ? `${num(p.height)} cm` : null },
      { title: 'Objectif principal', meta: labelOf(GOALS, p.goal) },
      { title: 'Expérience', meta: labelOf(EXPERIENCE, p.experience) },
      { title: 'Activité hors salle', meta: labelOf(ACTIVITY, p.activity) },
      { title: 'Séances par semaine', meta: p.trainingDays ? `${p.trainingDays}` : null },
      { title: 'Durée d’une séance', meta: p.sessionDuration ? `${p.sessionDuration} min` : null }
    ]

    root.innerHTML = `
      <div class="page">
        ${header({ back: '#/', title: 'Profil', sub: filled ? `${filled} information${filled > 1 ? 's' : ''}` : 'À compléter' })}

        ${
          filled
            ? `<div class="card">
                ${lines
                  .map(
                    (l) => `
                  <div class="kv">
                    <span class="kv__key">${esc(l.title)}</span>
                    <span class="kv__value ${l.meta ? '' : 'kv__value--empty'}">${esc(l.meta || 'non renseigné')}</span>
                  </div>`
                  )
                  .join('')}
              </div>
              <p class="note">Ces informations restent sur cet appareil. Elles serviront à adapter les
              recommandations dans les prochaines versions — aucune n'est envoyée nulle part.</p>`
            : blank({
                title: 'Profil vide',
                text: 'Renseigne l’essentiel : APEX pourra lire tes tendances dans le bon sens et, plus tard, adapter ton programme.'
              })
        }

        <div class="sticky-actions">
          <button class="btn btn--gold btn--block btn--lg" data-act="edit">
            ${filled ? 'Modifier mon profil' : 'Compléter mon profil'}
          </button>
        </div>
      </div>`
  }

  function onClick(e) {
    if (e.target.closest('[data-act="edit"]')) openProfileSheet()
  }

  root.addEventListener('click', onClick)
  render()

  return () => root.removeEventListener('click', onClick)
}
