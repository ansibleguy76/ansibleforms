function InitCopyPaste(){
    const codeBlocks = document.querySelectorAll("div.highlighter-rouge");

    codeBlocks.forEach((codeblock, index) => {
      const code = codeBlocks[index].innerText;
      const copyCodeButton = document.createElement("button");
      copyCodeButton.innerHTML = "<i class='fat fa-copy'></i>";
      copyCodeButton.classList = "btn btn-sm btn-dark";
      // insert a copy button
      copyCodeButton.onclick = function () {
        navigator.clipboard.writeText(code);
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