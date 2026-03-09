function InitCopyPaste(){
    const codeBlocks = document.querySelectorAll("div.highlighter-rouge");

    codeBlocks.forEach((codeblock, index) => {
      const code = codeBlocks[index].innerText;
      const copyCodeButton = document.createElement("button");
      copyCodeButton.innerHTML = "<i class='fat fa-copy'></i>";
      copyCodeButton.classList = "btn btn-sm btn-dark";
      // insert a copy button
      copyCodeButton.onclick = function () {
        window.navigator.clipboard.writeText(code);
        copyCodeButton.innerHTML = "COPIED";
        copyCodeButton.classList.add("btn-success");
        copyCodeButton.classList.remove("btn-dark");

        setTimeout(() => {
          copyCodeButton.innerHTML = "<i class='fat fa-copy'></i>";
          copyCodeButton.classList.remove("btn-success");
          copyCodeButton.classList.add("btn-dark");
        }, 2000);
      };
      // make the button
      codeblock.appendChild(copyCodeButton);
    });
  }

  document.addEventListener("DOMContentLoaded", InitCopyPaste);

  // Initialize Showdown markdown processor
  function InitMarkdown() {
    // Check if showdown is loaded
    if (typeof showdown === 'undefined') {
      console.error('Showdown library not loaded - markdown processing disabled');
      return;
    }

    console.log('Showdown loaded, processing markdown...');

    // Configure Showdown converter
    const converter = new showdown.Converter({
      tables: true,
      strikethrough: true,
      tasklists: true,
      simplifiedAutoLink: true,
      openLinksInNewWindow: false,
      backslashEscapesHTMLTags: true,
      simpleLineBreaks: false,
      ghCodeBlocks: true
    });

    // Find all elements with markdown="1" attribute OR class="render-markdown"
    const selectors = '[markdown="1"], .render-markdown, p[markdown], div[markdown], td[markdown]';
    const markdownElements = document.querySelectorAll(selectors);
    
    console.log(`Found ${markdownElements.length} elements to process`);
    
    markdownElements.forEach((element, index) => {
      // Get the innerHTML to preserve existing <br> and <code> tags that Jekyll already processed
      let content = element.innerHTML;
      
      // Check if content contains bullet points (lines starting with -)
      if (content.includes('- ')) {
        console.log(`Processing element ${index + 1}:`, content.substring(0, 100));
        
        // Convert markdown to HTML
        const html = converter.makeHtml(content);
        
        // Replace the element's content with rendered HTML
        element.innerHTML = html;
        
        console.log(`Processed element ${index + 1}`);
      }
      
      // Remove the markdown attribute and class
      element.removeAttribute('markdown');
      element.classList.remove('render-markdown');
    });
    
    console.log('Markdown processing complete');
  }

  document.addEventListener("DOMContentLoaded", InitMarkdown);

  // Get the button:
let toTop = document.getElementById("toTop");

// When the user scrolls down 20px from the top of the document, show the button
window.onscroll = function() {scrollFunction()};

function scrollFunction() {
  if (document.body.scrollTop > 20 || document.documentElement.scrollTop > 20) {
    toTop.style.display = "block";
  } else {
    toTop.style.display = "none";
  }
}

// When the user clicks on the button, scroll to the top of the document
function topFunction() {
  document.body.scrollTop = 0; // For Safari
  document.documentElement.scrollTop = 0; // For Chrome, Firefox, IE and Opera
}