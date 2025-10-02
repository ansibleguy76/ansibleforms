import hljs from 'highlight.js'

export default function (app) {
  app.directive('highlightjs', (el, binding) => {
    
    const codeNodes = el.querySelectorAll('code:not([data-highlightjs])')


    for (let i = 0; i < codeNodes.length; i++) {
      const codeNode = codeNodes[i]

      if (typeof binding.value === 'string') {
        codeNode.textContent = binding.value
      }

      hljs.highlightElement(codeNode)

    }
  })
}