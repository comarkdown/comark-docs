import { addIcon } from '@iconify/vue'

export default defineNuxtPlugin(() => {
  addIcon('custom:comark', {
    body: '<g clip-path="url(#a)"><path fill="none" stroke="currentColor" stroke-width="8" d="M194 44v110H4V44z"/><path fill="currentColor" d="M123 86.25V67h19.937v19.25zm0 44.75v-19.25h19.937V131zM153.063 86.25V67H173v19.25zm0 44.75v-19.25H173V131zM25 133V65h20l20 25 20-25h20v68H85V94l-20 25-20-25v39z"/></g><defs><clipPath id="a"><path fill="#fff" d="M0 0h198v198H0z"/></clipPath></defs>',
    width: 198,
    height: 198,
  })
})
