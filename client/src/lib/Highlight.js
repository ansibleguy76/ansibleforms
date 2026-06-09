import hljs from 'highlight.js'

// v-highlightjs: highlights every <code> inside the element with highlight.js
//
// The function shorthand of `app.directive` registers the same callback for
// both `mounted` and `updated`. highlight.js marks processed nodes with
// `data-highlighted="yes"` and warns when called twice on the same node, so
// we have to either skip those nodes (content unchanged) or clear the marker
// and re-render text from the binding before re-highlighting (content changed).
export default function (app) {
  app.directive('highlightjs', (el, binding) => {
    const codeNodes = el.querySelectorAll('code')
    for (let i = 0; i < codeNodes.length; i++) {
      const codeNode = codeNodes[i]
      const incoming = typeof binding.value === 'string' ? binding.value : null
      // Track the last source we highlighted so updates only re-run when the
      // actual text changed. Avoids hljs "previously highlighted" warnings on
      // every reactivity tick.
      const last = codeNode.dataset.highlightSource
      const current = incoming !== null ? incoming : codeNode.textContent
      if (codeNode.dataset.highlighted === 'yes' && last === current) {
        continue
      }
      if (incoming !== null) {
        codeNode.textContent = incoming
      }
      // Reset hljs marker so highlightElement does not warn.
      delete codeNode.dataset.highlighted
      hljs.highlightElement(codeNode)
      codeNode.dataset.highlightSource = current
    }
  })
}
