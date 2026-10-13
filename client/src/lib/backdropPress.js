/******************************************************************/
/*                                                                */
/*  A modal's backdrop closes it on a press that starts and ends  */
/*  on the backdrop. A click's target is where the button was     */
/*  released : a text selection or a drag that starts inside the  */
/*  modal and ends outside it was a click on the backdrop, and    */
/*  the modal closed under the user (a workflow node's identifier */
/*  selected with the mouse).                                     */
/*                                                                */
/******************************************************************/

/**
 * The backdrop's press, followed from the button going down to the click.
 *
 * Args:
 *   isBackdrop (function): (target) => whether an element is the backdrop itself.
 *
 * Returns:
 *   object: { down(event) on mousedown, closes(event) on click : true when both were on the
 *     backdrop }.
 */
export function backdropPress(isBackdrop) {
  let startedOnBackdrop = false;
  return {
    down(event) {
      startedOnBackdrop = isBackdrop(event.target);
    },
    closes(event) {
      const closes = startedOnBackdrop && isBackdrop(event.target);
      startedOnBackdrop = false;
      return closes;
    },
  };
}

export default { backdropPress };
