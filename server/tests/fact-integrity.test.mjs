// "I could not find out" must never be returned as a fact.
//
// The rule this codebase already applies to health.model's authenticationFacts, applied
// to the two repository lookups that decide WHERE a save is written. Both wrapped their
// query in a catch that answered an empty value, and every caller read that as the truth:
//
//   getFormsFolders -> []  reads as "there are no forms repositories", so getSaveTargets
//                          computes repoMode=false, skips the "not cloned yet" guard,
//                          takes NO git write-lock, and writes every form into the local
//                          persistent/forms folder. The save reports success; once the
//                          database recovers the repository copies are served again and
//                          the user's work is gone.
//   getConfigPath   -> ""  reads as "use the local config file", same outcome for
//                          config.yaml.
import { test, describe } from "vitest";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
const src = readFileSync(path.join(here, "../src/models/repository.model.js"), "utf8");

const slice = (from, to) => src.slice(src.indexOf(from), src.indexOf(to));

describe("getFormsFolders reports failure instead of inventing an answer", () => {
  const fn = slice("static async getFormsFolders()", "static async getFormsFolderPath()");

  test("the slice really is the function, so these assertions are not vacuous", () => {
    assert.match(fn, /use_for_forms/);
  });

  test("it does not answer [] when the query fails", () => {
    // any catch that returns an empty array is the bug coming back
    assert.doesNotMatch(fn, /catch\s*\([^)]*\)\s*\{[^}]*return\s*\[\]/s);
  });

  test("the query is not swallowed at all", () => {
    const upToQuery = fn.slice(0, fn.indexOf("use_for_forms"));
    assert.doesNotMatch(upToQuery, /try\s*\{/, "the lookup must not sit in a try that hides it");
  });
});

describe("getConfigPath reports failure instead of inventing an answer", () => {
  const fn = slice("static async getConfigPath()", "static async getFormsFolders()");

  test("the slice really is the function, so these assertions are not vacuous", () => {
    assert.match(fn, /use_for_config/);
  });

  test("no catch answers the empty string", () => {
    assert.doesNotMatch(fn, /catch\s*\([^)]*\)\s*\{[^}]*return\s*""/s);
  });
});

describe("a pull whose repository cannot be read withholds the git output", () => {
  const fn = slice("static async pull(", "static async claimForWrite(");

  test("the slice really is the function, so these assertions are not vacuous", () => {
    assert.match(fn, /Repo\.pull\(name\)/);
  });

  test("it notices that the record could not be read", () => {
    assert.match(fn, /repoUnknown/);
  });

  test("and does not publish output it could not mask", () => {
    // maskSecrets only blanks the literal password when it HAS the repo ; with null it
    // silently degrades to the url-pattern rewrite alone
    assert.match(fn, /if \(repoUnknown\)/);
    assert.match(fn, /withheld/i);
  });
});

describe("the row cache is flushed, not orphaned", () => {
  const crud = readFileSync(path.join(here, "../src/models/crud.model.js"), "utf8");

  test("delete caches[modelName] is gone", () => {
    // strip comments first : the comment explaining the fix names the old code, so a
    // bare regex matched the PROSE and failed against the fixed file
    // NodeCache re-arms its checkperiod timer on every fire, and that timer holds a
    // strong reference to the instance - so dropping the map entry leaks the instance
    // AND leaves a recurring timer behind, once per update on every cached model
    const code = crud.replace(/\/\/[^\n]*/g, "");
    assert.doesNotMatch(code, /delete caches\[modelName\]/);
  });

  test("flushAll is used instead", () => {
    assert.match(crud, /cache\.flushAll\(\)/);
  });
});

describe("the backup and restore commands get a real timeout", () => {
  const backup = readFileSync(path.join(here, "../src/models/backup.model.js"), "utf8");

  test("both pass an explicit timeout", () => {
    // Cmd.executeSilentCommand defaults to 60 seconds, which no real database can dump
    // or replay in - and a killed RESTORE is destructive, because the dump it replays
    // drops and recreates each table in turn
    const calls = [...backup.matchAll(/Cmd\.executeSilentCommand\(cmdObj[^)]*\)/g)].map(m => m[0]);
    assert.ok(calls.length >= 2, `expected the dump and the restore, found ${calls.length}`);
    for (const c of calls) {
      assert.match(c, /appConfig\.backupCommandTimeoutSeconds/, `${c} still runs on the 60s default`);
    }
  });

  test("a failed restore says the database may be half replayed", () => {
    const fn = backup.slice(backup.indexOf("static async restore("), backup.indexOf("static async listBackups("));
    assert.match(fn, /partially restored/i, "there is no rollback, so the state has to be stated");
  });
});

describe("every tree-touching repository operation claims the lock first", () => {
  // reset() states the invariant: "a reset rm's the working tree, which must not race a
  // pull/sync running git on it (issue #414)". delete() does the same rm -rf and had no
  // claim - so a scheduled pull could be checking out into the directory as it was being
  // removed, and since the row is then gone the tree is left orphaned with a stale
  // .git/config. Creating a repository with that name afterwards hits Repo.clone's
  // "already exists, pulling instead" path and silently pulls from the OLD remote.
  const fn = slice("static async delete(name, opts = {})", "static async findById(id)");

  test("the slice really is the function, so these assertions are not vacuous", () => {
    assert.match(fn, /Repo\.delete\(name\)/);
  });

  test("it claims before touching the tree", () => {
    const claim = fn.indexOf("set status = 'running'");
    const rm = fn.indexOf("Repo.delete(name)");
    assert.ok(claim > -1, "no claim at all");
    assert.ok(claim < rm, "the claim must come before the rm -rf");
  });

  test("the claim is taken after the managed guard, so a refused delete leaves it alone", () => {
    assert.ok(fn.indexOf("assertNotManaged") < fn.indexOf("set status = 'running'"));
  });

  test("the tree removal is awaited", () => {
    // unawaited, a validateRepoName throw became an unhandled rejection while the record
    // was removed anyway
    assert.match(fn, /await Repo\.delete\(name\)/);
  });

  test("a failed removal releases the claim instead of wedging the repo", () => {
    assert.match(fn, /status = 'failed'/);
  });
});

describe("the background clone cannot vanish", () => {
  const fn = slice("static async create(data, opts = {})", "static async update(data, name, opts = {})");

  test("the slice really is the function, so these assertions are not vacuous", () => {
    assert.match(fn, /Repository\.clone\(data\.name\)/);
  });

  test("its rejection is caught and recorded on the row", () => {
    // clone() throws BEFORE writing any status when the claim fails, so the row was left
    // with no status and no output and the reason reached only the process-level logger
    assert.match(fn, /Repository\.clone\(data\.name\)\.catch\(/);
    assert.match(fn, /status = 'failed'/);
  });
});

describe("a missing HEAD does not unwind a successful git operation", () => {
  test("every Repo.info call is guarded", () => {
    // `git rev-parse --short HEAD` exits 128 on a repository cloned from an EMPTY remote,
    // which this model explicitly supports. In the clone path that rejection has no
    // caller at all - create() runs it in the background.
    const calls = [...src.matchAll(/head = await Repo\.info\(name\)/g)];
    assert.ok(calls.length >= 3, `expected clone, pull and sync, found ${calls.length}`);
    for (const m of calls) {
      const before = src.slice(Math.max(0, m.index - 400), m.index);
      assert.match(before, /try \{\s*$/m, "the Repo.info call must sit in a try");
    }
  });
});

describe("queue numbers are allocated atomically", () => {
  // Both queues used to read MAX(queue_id) and write it back in a separate statement, so
  // a cron tick and a manual queue could interleave and hand two rows the same number -
  // losing the FIFO order the processor depends on (ORDER BY queue_id LIMIT 1). The
  // datasource one was worse: MAX(x)+1 over an all-NULL column is NULL, not 1, so on a
  // fresh install the first datasource was queued with no queue number at all.
  const models = {
    datasource: readFileSync(path.join(here, "../src/models/datasource.model.js"), "utf8"),
    schedule: readFileSync(path.join(here, "../src/models/schedule.model.js"), "utf8"),
  };

  test.each([["datasource", "Ds.queue = async function(id)"], ["schedule", "static async queue(id)"]])(
    "%s allocates and writes in one statement",
    (name, marker) => {
      const src = models[name];
      const fn = src.slice(src.indexOf(marker), src.indexOf(marker) + 1200);
      assert.ok(fn.includes("queue_id"), "the slice must be the queue function");
      // exactly one statement reaches the database
      const stmts = [...fn.matchAll(/mysql\.do\(|super\.update\(|super\.findAll\(/g)];
      assert.equal(stmts.length, 1, `${name} still makes ${stmts.length} calls to allocate a queue slot`);
      assert.match(fn, /COALESCE\(MAX\(queue_id\),0\)\+1/, "the next number must be computed in SQL");
    }
  );

  test("the datasource cannot be queued with a NULL number", () => {
    // COALESCE, not a bare MAX+1. Comments stripped first: the comment explaining this
    // fix quotes the old SQL, so matching the raw file matched the PROSE.
    const code = models.datasource.replace(/\/\/[^\n]*/g, "");
    assert.doesNotMatch(code, /SELECT MAX\(queue_id\)\+1/);
  });
});

describe("the backup shell command quotes every value it interpolates", () => {
  const backup = readFileSync(path.join(here, "../src/models/backup.model.js"), "utf8");

  test("there is a single quoting helper", () => {
    assert.match(backup, /function shQuote\(value\)/);
    // the '"'"' idiom : close the quote, emit an escaped one, reopen
    assert.match(backup, /replace\(\/'\/g, `'"'"'`\)/);
  });

  test("host, user, port and database all go through it", () => {
    const cmds = [...backup.matchAll(/const (?:dumpCmd|restoreCmd) = `[^`]*`/g)].map(m => m[0]);
    assert.equal(cmds.length, 2, "expected the dump and the restore command");
    for (const c of cmds) {
      for (const v of ["dbHost", "dbUser", "dbPort", "dbName", "dbPassword"]) {
        assert.match(c, new RegExp(`shQuote\\(${v}\\)`), `${v} is not quoted in ${c.slice(0, 40)}...`);
      }
    }
  });

  test("the old hand-rolled password escape is gone", () => {
    // it escaped the password only, leaving host and port bare
    assert.doesNotMatch(backup, /safePassword/);
  });
});

describe("errors.ReturnError forwards only OUR status", () => {
  // axios sets .status on every HTTP-error rejection, and ReturnError trusted whatever
  // set it - so a third-party AWX/AAP answering 401 to a "test connection" became
  // AnsibleForms' own 401, and App.vue's global interceptor cleared the session. The
  // admin was logged out because a DIFFERENT system rejected a DIFFERENT credential.
  const src = readFileSync(path.join(here, "../src/lib/errors.js"), "utf8");

  test("the discriminator is our own error base class", () => {
    assert.match(src, /err instanceof ApiError && err\.status/);
  });

  test("a bare err.status is no longer trusted", () => {
    const code = src.replace(/\/\/[^\n]*/g, "");
    assert.doesNotMatch(code, /if \(err && err\.status\)/);
  });

  test("every error this app raises extends ApiError, so nothing legitimate loses its status", () => {
    const classes = [...src.matchAll(/class (\w+Error) extends (\w+)/g)].map((m) => m.slice(1));
    assert.ok(classes.length >= 5);
    for (const [name, base] of classes) {
      assert.ok(base === "ApiError" || name === "ApiError", `${name} extends ${base}, not ApiError`);
    }
  });
});

describe("a malformed cookie cannot 500 every translated response", () => {
  const src = readFileSync(path.join(here, "../src/lib/i18n.js"), "utf8");

  test("cookie decoding cannot throw", () => {
    // decodeURIComponent throws URIError on a stray '%', and parseCookies runs for every
    // t(req, ...). middleware.js calls t() again in its catch, so the guard threw twice
    // and escaped - a permission check became an unconditional 500.
    assert.match(src, /function safeDecode\(value\)/);
    // sliced to the end of the function, not by a character count : the explanatory
    // comment inside it is long enough that a fixed window stopped short of the code
    const at = src.indexOf("function parseCookies");
    const fn = src.slice(at, src.indexOf("\n}", at));
    assert.doesNotMatch(fn, /cookies\[decodeURIComponent/);
    assert.match(fn, /safeDecode\(name\)/);
  });
});

describe("hasChanges does not invent a clean working tree", () => {
  const src = readFileSync(path.join(here, "../src/models/repo.model.js"), "utf8");
  const fn = src.slice(src.indexOf("Repo.hasChanges"), src.indexOf("Repo.sync ="));

  test("the slice really is the function, so these assertions are not vacuous", () => {
    assert.match(fn, /git status --porcelain/);
  });

  test("git status runs outside the catch", () => {
    // cron.service guards the scheduled pull with this answer, so a fabricated `false`
    // runs git pull over a tree with uncommitted designer work (issue #414)
    const statusAt = fn.indexOf("git status --porcelain");
    const tryAt = fn.indexOf("try {");
    assert.ok(tryAt > statusAt, "the status command must not sit inside the try");
  });

  test("only the ahead-count is allowed to fail", () => {
    const tail = fn.slice(fn.indexOf("try {"));
    assert.match(tail, /@\{u\}\.\.HEAD/);
    assert.match(tail, /return false/);
  });
});

describe("the default AAP flag is cleared only once its row is stored", () => {
  // preProcess used to clear is_default on every unmanaged row BEFORE the insert, and
  // `name` carries a unique key - so creating a connection with a name that already
  // exists cleared the flag everywhere and then died with ER_DUP_ENTRY. Measured against
  // the live database: no record created AND zero rows holding the default, so every job
  // targeting the default AAP failed until somebody set it again by hand.
  const src = readFileSync(path.join(here, "../src/models/awx.model.js"), "utf8");

  test("preProcess no longer writes", () => {
    const fn = src.slice(src.indexOf("static async preProcess"), src.indexOf("static async clearOtherDefaults"));
    assert.match(fn, /AccessDeniedError/, "it must still REFUSE a managed holder");
    assert.doesNotMatch(fn, /UPDATE AnsibleForms\.`awx` SET is_default = 0/,
      "the blanket clear must not run before the insert");
  });

  test("create clears the others only after a successful insert", () => {
    const fn = src.slice(src.indexOf("static async create(data"), src.indexOf("static async update(data"));
    const insert = fn.indexOf("super.create(");
    const clear = fn.indexOf("clearOtherDefaults(");
    assert.ok(insert > -1 && clear > insert, "the clear must follow the insert");
    assert.match(fn, /if \(data\.is_default && insertId\)/, "and only when the row really landed");
  });

  test("update does the same", () => {
    const fn = src.slice(src.indexOf("static async update(data"), src.indexOf("static async delete(id"));
    assert.ok(fn.indexOf("super.update(") < fn.indexOf("clearOtherDefaults("));
  });

  test("the new row keeps its own flag", () => {
    const fn = src.slice(src.indexOf("static async clearOtherDefaults"), src.indexOf("static async create(data"));
    assert.match(fn, /WHERE id <> \?/, "clearing every row would leave no default at all");
    // the seed still clears managed rows, an API caller does not
    assert.match(fn, /opts\.fromSeed \? '' : ' AND managed = 0'/);
  });
});

describe("an unsupported dbConfig is an error, not an empty result", () => {
  const src = readFileSync(path.join(here, "../src/models/query.model.js"), "utf8");

  test("the type dispatch has an else that raises", () => {
    // a `dbConfig: 1` in a form's yaml left config empty, the loop never ran, and the
    // endpoint answered 200 with [] - an empty dropdown and no sign anything was wrong
    const fn = src.slice(src.indexOf("var config = []"), src.indexOf("for await"));
    assert.match(fn, /\}else\{/);
    assert.match(fn, /Invalid dbConfig/);
  });

  test("null is rejected rather than treated as an object", () => {
    // typeof null === 'object'
    const fn = src.slice(src.indexOf("var config = []"), src.indexOf("for await"));
    assert.match(fn, /cfg && typeof cfg == "object"/);
  });
});

describe("the forms walk and the delete pass see the same files", () => {
  // They disagreed, and the disagreement destroyed data. readdirSync does not follow
  // symlinks, so a Dirent for one is neither isFile() nor isDirectory(): the loader's
  // walk (isFile) skipped a symlinked form yaml entirely - not listed, not in the
  // designer, not even a warning - while listYamlFiles matches on the EXTENSION and
  // still saw it. On the next designer save it was an unknown file whose form names were
  // not among the saved ones, so it was removed. Measured: the form was absent from
  // /config/formlist with no warning, and present after the fix.
  const src = readFileSync(path.join(here, "../src/models/form.model.js"), "utf8");
  const walk = src.slice(src.indexOf("const walk = (dir) =>"), src.indexOf("files.sort()"));

  test("the slice really is the walk, so these assertions are not vacuous", () => {
    assert.match(walk, /readdirSync/);
  });

  test("it resolves symlinks", () => {
    assert.match(walk, /entry\.isSymbolicLink\(\)/);
    assert.match(walk, /fs\.statSync\(fullPath\)/, "statSync follows the link, lstat would not");
  });

  test("a broken symlink is reported, not dropped silently", () => {
    assert.match(walk, /does not resolve/);
  });

  test("both walks skip .git", () => {
    assert.match(walk, /entry\.name === "\.git"/);
    const lister = src.slice(src.indexOf("function listYamlFiles"), src.indexOf("function listYamlFiles") + 500);
    assert.match(lister, /entry\.name === "\.git"/);
  });
});

describe("a malformed forms block is reported, not fatal", () => {
  // The base config's `forms:` is never schema validated, so whatever the yaml parsed to
  // arrives raw. A trailing empty list item parses to null and `delete null.source` threw;
  // a mapping made `for...of` throw. Neither was inside a try, so every forms endpoint
  // answered 500 with a raw TypeError - measured on /config/formlist and the designer's
  // /config. Both now return 200 with the problem in `errors`.
  const src = readFileSync(path.join(here, "../src/models/form.model.js"), "utf8");
  const block = src.slice(src.indexOf("var unvalidatedForms = unvalidatedBase.forms"), src.indexOf("// read extra form files"));

  test("the slice really is the block, so these assertions are not vacuous", () => {
    assert.match(block, /DEPRECATED/);
  });

  test("a non-array forms section is rejected before it is iterated", () => {
    assert.match(block, /!Array\.isArray\(unvalidatedForms\)/);
    const guard = block.indexOf("Array.isArray");
    const loop = block.indexOf("for(let f of unvalidatedForms)");
    assert.ok(guard < loop, "the guard must come before the loop");
  });

  test("entries that are not objects are filtered out", () => {
    assert.match(block, /typeof f !== 'object'/);
  });

  test("both cases are surfaced to the user, not just logged", () => {
    // error() pushes into the errors array the client renders
    const errs = [...block.matchAll(/\berror\(/g)];
    assert.equal(errs.length, 2, `expected both cases to report, found ${errs.length}`);
  });
});

describe("a form name resolves to one definition on every path", () => {
  // The name was claimed AFTER the role check, so the two ways through the loop picked
  // different copies of a duplicated name. Measured with two files both defining
  // 'DupProbe', the admin-only one first in walk order, as a non-admin user: the LIST
  // showed the tile (copy 1 was skipped without claiming the name, so copy 2 passed the
  // duplicate check) and opening it answered 500. Now: not listed, and 403.
  const src = readFileSync(path.join(here, "../src/models/form.model.js"), "utf8");
  const loop = src.slice(src.indexOf("// Process all collected forms"), src.indexOf("form = getFormInfo("));

  test("the slice really is the loop, so these assertions are not vacuous", () => {
    assert.match(loop, /checkFormRole/);
  });

  test("the name is claimed before the role check", () => {
    const claim = loop.indexOf("existingFormNames.push(f.name)");
    const role = loop.indexOf("if(!checkFormRole(f,userRoles))");
    assert.ok(claim > -1 && role > -1);
    assert.ok(claim < role, "claiming after the role check makes the list and the loader disagree");
  });

  test("the duplicate check still comes first of all", () => {
    const dup = loop.indexOf("existingFormNames.includes(f.name)");
    assert.ok(dup > -1 && dup < loop.indexOf("existingFormNames.push(f.name)"));
  });
});

describe("a refused form open is a 403, not a 500", () => {
  const src = readFileSync(path.join(here, "../src/controllers/v2/config.controller.js"), "utf8");
  const fn = src.slice(src.indexOf("const findOne ="), src.indexOf("const findAll ="));

  test("AccessDeniedError maps to 403", () => {
    // a bare 500 says the server broke, and auditMiddleware files only 401/403 as
    // 'denied' - so the refusal was recorded as a failure
    assert.match(fn, /err\.name === 'AccessDeniedError'/);
    assert.match(fn, /res\.status\(403\)/);
  });

  test("and 403 is used, never 401", () => {
    // 401 would make the client's global interceptor drop the session
    assert.doesNotMatch(fn, /res\.status\(401\)/);
  });
});

describe("a varsFile that cannot be read is reported", () => {
  // Every failure was logged and dropped, so the caller's catch could never fire: the
  // form loaded 200 with vars: {}, $vars.* resolved to nothing and the job ran with the
  // wrong extravars, with nothing on screen. Measured: errors was empty before, and now
  // names the file and the resolved path.
  const src = readFileSync(path.join(here, "../src/models/form.model.js"), "utf8");
  const fn = src.slice(src.indexOf("async function loadVarsFiles"), src.indexOf("function getFormInfo"));

  test("the slice really is the function, so these assertions are not vacuous", () => {
    assert.match(fn, /varsFilesPath/);
  });

  test("failures are collected, not just logged", () => {
    assert.match(fn, /const problems = \[\]/);
    assert.match(fn, /return \{ vars: mergedVars, problems \}/);
  });

  test("all three failure kinds are collected", () => {
    // wrong extension, not a dictionary, and unreadable
    assert.equal([...fn.matchAll(/problems\.push\(/g)].length, 3);
  });

  test("the caller surfaces them through the errors the client renders", () => {
    const caller = src.slice(src.indexOf("Loading varsFiles for form"), src.indexOf("Loading varsFiles for form") + 700);
    assert.match(caller, /for \(const p of loaded\.problems\)/);
    assert.match(caller, /error\(`Form '\$\{f\.name\}': \$\{p\}`\)/);
  });
});

describe("a failure is never reported inside a success envelope", () => {
  // v1's RestResult carries the outcome in its first field, and two handlers built a
  // "success" envelope whose own message said "failed" - so a client checking the status
  // field was told a failed job launch, or a failed expression, had worked. The same bug
  // was in v1/query.controller.
  const dir = path.join(here, "../src/controllers");

  test("no controller pairs a success status with a failure message", () => {
    const offenders = [];
    for (const version of ["v1", "v2"]) {
      const d = path.join(dir, version);
      for (const f of readdirSync(d)) {
        if (!f.endsWith(".js")) continue;
        const src = readFileSync(path.join(d, f), "utf8");
        for (const m of src.matchAll(/RestResult\("success"\s*,\s*"([^"]*)"/g)) {
          if (/fail|error/i.test(m[1])) offenders.push(`${version}/${f}: "${m[1]}"`);
        }
      }
    }
    assert.deepEqual(offenders, []);
  });

  test("both former offenders now answer 500 with an error envelope", () => {
    for (const [file, needle] of [
      ["v1/job.controller.js", "failed to launch form"],
      ["v1/expression.controller.js", "failed to execute expression"],
    ]) {
      const src = readFileSync(path.join(dir, file), "utf8");
      const at = src.indexOf(needle);
      assert.ok(at > -1, `${file} no longer mentions ${needle}`);
      const line = src.slice(src.lastIndexOf("\n", at), at);
      assert.match(line, /RestResult\("error"/, `${file} still uses a success envelope`);
      assert.match(line, /status\(500\)/, `${file} still answers 200`);
    }
  });
});

describe("a refused credential edit answers a real status", () => {
  // The v1 controller's catches called res.json() with NO status, so a refusal - or any
  // failure - came back as HTTP 200 with an "error" envelope: a client checking the
  // status code was told it had worked. And a seeded credential must answer 403, never
  // 401 (which drops the session) and never 500 (which claims the server broke).
  const model = readFileSync(path.join(here, "../src/models/credential.model.js"), "utf8");
  const ctrl = readFileSync(path.join(here, "../src/controllers/v1/credential.controller.js"), "utf8");

  test("the managed refusal is a typed error, not a bare string", () => {
    assert.match(model, /throw new Errors\.AccessDeniedError\(/);
    assert.doesNotMatch(model.replace(/\/\/[^\n]*/g, ""), /throw "This credential is managed/);
  });

  test("both mutations map it to 403 and everything else to 500", () => {
    for (const verb of ["update", "delete"]) {
      const at = ctrl.indexOf(`failed to ${verb} credential`);
      assert.ok(at > -1, `${verb} handler not found`);
      const around = ctrl.slice(Math.max(0, at - 600), at + 200);
      assert.match(around, /err\?\.name === 'AccessDeniedError' \? 403 : 500/, `${verb} has no status mapping`);
      assert.match(around, /res\.status\(code\)\.json\(/, `${verb} still answers 200`);
    }
  });

  test("neither answers 401", () => {
    assert.doesNotMatch(ctrl, /res\.status\(401\)/);
  });
});
