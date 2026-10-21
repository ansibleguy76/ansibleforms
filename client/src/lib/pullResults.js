/******************************************************************/
/*                                                                */
/*  What a Pull all did, repository by repository : pulled,       */
/*  skipped (its changes are not pushed yet : the server refuses  */
/*  the pull with a 409 until they are pushed or the repository   */
/*  is reset) or failed. The settings' Pull all and the           */
/*  designer's pull both say it.                                  */
/*                                                                */
/******************************************************************/

/**
 * Sorts the outcome of one pull per repository (the settings' Pull all) into the ones pulled,
 * skipped and failed.
 *
 * Args:
 *   repos (object[]): the repositories, each with its name.
 *   settled (object[]): the Promise.allSettled outcome of their pulls, in the same order.
 *
 * Returns:
 *   object: { pulled, skipped, failed }, each a list of repository names. A pull refused with a
 *     409 is skipped : the repository has changes not pushed yet.
 */
export function sortPulls(repos, settled) {
  const out = { pulled: [], skipped: [], failed: [] };
  repos.forEach((repo, i) => {
    const outcome = settled[i];
    if (outcome?.status === 'fulfilled') out.pulled.push(repo.name);
    else if (outcome?.reason?.response?.status === 409) out.skipped.push(repo.name);
    else out.failed.push(repo.name);
  });
  return out;
}

/**
 * The repositories the server's Pull all skipped (POST /api/v2/forms-repos/pull) : their
 * changes are not pushed yet.
 *
 * Args:
 *   data (object): the answer's body, { results, skipped }.
 *
 * Returns:
 *   string[]: the names of the repositories skipped ; none for a single pull.
 */
export function skippedPulls(data) {
  if (Array.isArray(data?.skipped)) return data.skipped;
  return (Array.isArray(data?.results) ? data.results : []).filter((r) => r?.status === 'skipped').map((r) => r.name);
}
