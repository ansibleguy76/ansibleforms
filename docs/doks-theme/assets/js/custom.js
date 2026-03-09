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